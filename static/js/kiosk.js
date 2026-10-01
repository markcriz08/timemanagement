let currentMode = 'FACE';
let registeredEmployees = [];
let isProcessingClock = false;
let clockCooldown = false;
let qrScanner = null;

function updateClock() {
    const clockElem = document.getElementById('live-clock');
    if (clockElem) {
        const now = new Date();
        clockElem.innerText = now.toLocaleTimeString();
    }
}
setInterval(updateClock, 1000);

async function initKiosk() {
    updateClock();
    await fetchEmployees();
    await setupWebcam();
    await loadFaceModels();
    startQRRecognition();
    
    const manualForm = document.getElementById('manual-clock-form');
    if (manualForm) {
        manualForm.addEventListener('submit', handleManualSubmit);
    }
}

async function fetchEmployees() {
    try {
        const response = await fetch('/api/employees');
        if (response.ok) {
            registeredEmployees = await response.json();
        }
    } catch (err) {
        console.error("Failed to fetch employee list:", err);
    }
}

async function setupWebcam() {
    const video = document.getElementById('webcam');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => video.play();
    } catch (err) {
        console.error("Webcam access error:", err);
        updateStatus("Camera Access Failed!", "error");
    }
}

async function loadFaceModels() {
    try {
        updateStatus("Loading AI Face Recognition models...", "neutral");
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

        updateStatus("Ready for Face Scan", "neutral");
        startFaceRecognition();
    } catch (err) {
        console.error("Face-API loading failed:", err);
        updateStatus("Face recognition offline. Use QR or Keypad.", "error");
    }
}

function getEuclideanDistance(desc1, desc2) {
    if (!desc1 || !desc2 || desc1.length !== desc2.length) return Infinity;
    return Math.sqrt(
        desc1.reduce((sum, val, i) => sum + Math.pow(val - desc2[i], 2), 0)
    );
}

async function startFaceRecognition() {
    const video = document.getElementById('webcam');

    setInterval(async () => {
        if (currentMode !== 'FACE' || isProcessingClock || clockCooldown) return;

        try {
            if (typeof faceapi !== 'undefined' && video.readyState === 4) {
                const detection = await faceapi.detectSingleFace(video)
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (detection) {
                    const liveDescriptor = Array.from(detection.descriptor);
                    let bestMatch = null;
                    let lowestDistance = 0.55;

                    registeredEmployees.forEach(emp => {
                        if (emp.face_descriptor && emp.face_descriptor.length === liveDescriptor.length) {
                            const dist = getEuclideanDistance(liveDescriptor, emp.face_descriptor);
                            if (dist < lowestDistance) {
                                lowestDistance = dist;
                                bestMatch = emp;
                            }
                        }
                    });

                    if (bestMatch) {
                        submitClockLog(bestMatch.emp_code, 'FACE');
                    }
                }
            }
        } catch (err) {
            console.error("Face scanning frame error:", err);
        }
    }, 1000);
}

async function startQRRecognition() {
    const video = document.getElementById('webcam');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let html5QrCode = null;
    if (typeof Html5Qrcode !== 'undefined') {
        const tempDiv = document.createElement('div');
        tempDiv.id = 'qr-temp-reader';
        tempDiv.style.display = 'none';
        document.body.appendChild(tempDiv);
        html5QrCode = new Html5Qrcode('qr-temp-reader');
    }

    let isScanningFrame = false;

    setInterval(async () => {
        if (currentMode !== 'QR' || isProcessingClock || clockCooldown || isScanningFrame) return;
        if (!video || video.readyState !== 4) return;

        isScanningFrame = true;

        try {
            let qrText = null;

            // 1. Try Native BarcodeDetector API (fastest execution)
            if ('BarcodeDetector' in window) {
                try {
                    const detector = new BarcodeDetector({ formats: ['qr_code'] });
                    const barcodes = await detector.detect(video);
                    if (barcodes && barcodes.length > 0) {
                        qrText = barcodes[0].rawValue;
                    }
                } catch (e) {
                    // Fallback to Html5Qrcode
                }
            }

            // 2. Fallback: Decode frame using Html5Qrcode
            if (!qrText && html5QrCode) {
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 480;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                await new Promise((resolve) => {
                    canvas.toBlob(async (blob) => {
                        if (blob) {
                            const file = new File([blob], "qr_frame.png", { type: "image/png" });
                            try {
                                const result = await html5QrCode.scanFileV2(file, false);
                                if (result && result.decodedText) {
                                    qrText = result.decodedText;
                                }
                            } catch (err) {
                                // No QR detected in current frame
                            }
                        }
                        resolve();
                    }, 'image/png');
                });
            }

            if (qrText) {
                let empCode = qrText.trim();

                // Extract code if payload is JSON formatted (e.g. {"code":"EMP-001",...})
                try {
                    const parsed = JSON.parse(qrText);
                    if (parsed && parsed.code) {
                        empCode = parsed.code;
                    }
                } catch (e) {
                    // Raw string employee code
                }

                if (empCode) {
                    updateStatus(`QR Code Detected: ${empCode}`, 'neutral');
                    submitClockLog(empCode, 'QR');
                }
            }
        } catch (err) {
            console.error("QR scanning error:", err);
        } finally {
            isScanningFrame = false;
        }
    }, 500);
}

function switchMode(mode) {
    if (currentMode === mode) return;

    sounds.playClick();
    currentMode = mode;
    
    document.getElementById('btn-face').classList.toggle('active', mode === 'FACE');
    document.getElementById('btn-qr').classList.toggle('active', mode === 'QR');
    document.getElementById('btn-manual').classList.toggle('active', mode === 'MANUAL');

    const manualPanel = document.getElementById('manual-entry-panel');
    if (mode === 'MANUAL') {
        manualPanel.classList.remove('hidden');
        document.getElementById('manual-code').focus();
    } else {
        manualPanel.classList.add('hidden');
    }

    updateStatus(`Switched to ${mode} Mode`, 'neutral');
}

function updateStatus(message, state = 'neutral') {
    const card = document.getElementById('status-card');
    const display = document.getElementById('status-display');
    if (!display || !card) return;
    
    card.className = 'glass-panel status-card';
    if (state === 'success') card.classList.add('status-success');
    if (state === 'error') card.classList.add('status-error');

    display.innerText = message;
}

async function submitClockLog(empCode, method, pin = null) {
    if (isProcessingClock || clockCooldown) return;
    
    isProcessingClock = true;
    updateStatus('Processing punch record...', 'neutral');

    try {
        const res = await fetch('/api/clock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                emp_code: empCode,
                method: method,
                pin: pin
            })
        });

        const result = await res.json();

        if (res.ok) {
            sounds.playSuccess();
            updateStatus(result.message, 'success');
            
            clockCooldown = true;
            setTimeout(() => {
                clockCooldown = false;
                updateStatus('Ready for Verification', 'neutral');
            }, 5000);
        } else {
            sounds.playError();
            updateStatus(result.message || 'Verification failed!', 'error');
            setTimeout(() => {
                updateStatus('Ready for Verification', 'neutral');
            }, 3000);
        }
    } catch (err) {
        sounds.playError();
        updateStatus('Server connection error!', 'error');
        setTimeout(() => {
            updateStatus('Ready for Verification', 'neutral');
        }, 3000);
    } finally {
        isProcessingClock = false;
    }
}

function handleManualSubmit(event) {
    event.preventDefault();
    const codeInput = document.getElementById('manual-code');
    const pinInput = document.getElementById('manual-pin');

    const empCode = codeInput.value.trim();
    const pin = pinInput.value.trim();

    if (!empCode || !pin) {
        sounds.playError();
        updateStatus('Please enter Code and PIN!', 'error');
        return;
    }

    submitClockLog(empCode, 'MANUAL', pin);
    codeInput.value = '';
    pinInput.value = '';
}

document.addEventListener('DOMContentLoaded', initKiosk);