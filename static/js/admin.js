let currentEditCode = null;
let faceTrackInterval = null;

async function setupWebcam() {
    const video = document.getElementById('admin-webcam');
    const statusBox = document.getElementById('admin-status');

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
        });
        video.srcObject = stream;
        statusBox.innerText = "Camera connected. Ready for face sampling.";
    } catch (err) {
        statusBox.innerText = "Error: Webcam access denied!";
        statusBox.style.color = "#f87171";
    }
}

async function loadFaceModels() {
    const statusBox = document.getElementById('admin-status');
    try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        statusBox.innerText = "Face Detector Models Active. Position face in camera frame.";
        startLiveFaceTracker();
    } catch (e) {
        statusBox.innerText = "Face API warning: Models failed to load.";
        statusBox.style.color = "#f87171";
    }
}

function startLiveFaceTracker() {
    const video = document.getElementById('admin-webcam');
    const statusBox = document.getElementById('admin-status');

    if (faceTrackInterval) clearInterval(faceTrackInterval);

    faceTrackInterval = setInterval(async () => {
        // Skip live tracking if user is currently submitting
        if (statusBox.getAttribute('data-processing') === 'true') return;

        if (typeof faceapi !== 'undefined' && video.srcObject && video.readyState === 4) {
            try {
                const detection = await faceapi.detectSingleFace(video);
                if (detection) {
                    statusBox.style.color = "#4ade80";
                    statusBox.innerText = "✓ Face Detected in Feed — Ready to Register";
                } else {
                    statusBox.style.color = "#facc15";
                    statusBox.innerText = "⚠ Looking for face... Please center yourself in the camera view.";
                }
            } catch (err) {
                // Video frame processing error
            }
        }
    }, 800);
}

async function captureFaceDescriptor() {
    const video = document.getElementById('admin-webcam');
    try {
        if (typeof faceapi !== 'undefined' && video.srcObject && video.readyState === 4) {
            const detection = await faceapi.detectSingleFace(video)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (detection) {
                return { success: true, descriptor: Array.from(detection.descriptor) };
            }
        }
    } catch (err) {
        console.error("Face detection error:", err);
    }
    return { success: false, descriptor: null };
}

async function saveEmployee() {
    sounds.playClick();
    const statusBox = document.getElementById('admin-status');
    const empCode = document.getElementById('reg-code').value.trim();
    const name = document.getElementById('reg-name').value.trim();
    const age = document.getElementById('reg-age').value;
    const gender = document.getElementById('reg-gender').value;
    const birthday = document.getElementById('reg-birthday').value;
    const address = document.getElementById('reg-address').value.trim();
    const contact = document.getElementById('reg-contact').value.trim();
    const pin = document.getElementById('reg-pin').value.trim();

    statusBox.setAttribute('data-processing', 'true');
    statusBox.style.color = "#38bdf8";
    statusBox.innerText = "Scanning face... Please look directly at the camera.";

    const captureResult = await captureFaceDescriptor();

    if (!captureResult.success) {
        sounds.playError();
        statusBox.removeAttribute('data-processing');
        statusBox.style.color = "#f87171";
        statusBox.innerText = "✖ Face Capture Failed! No face detected in camera stream.";
        alert("Face Capture Failed!\n\nNo face was detected in the camera feed. Please center your face in front of the lens and try again.");
        return;
    }

    // Explicit success notification
    statusBox.style.color = "#4ade80";
    statusBox.innerText = "✓ Face captured successfully! Submitting employee record...";

    const payload = {
        emp_code: empCode,
        name: name,
        age: parseInt(age),
        gender: gender,
        birthday: birthday,
        address: address,
        contact: contact,
        pin: pin,
        face_descriptor: captureResult.descriptor
    };

    try {
        let response;
        if (currentEditCode) {
            response = await fetch(`/api/employees/${currentEditCode}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        const result = await response.json();

        if (response.ok) {
            sounds.playSuccess();
            alert(`✓ SUCCESS: Face captured and employee "${name}" successfully saved!`);
            statusBox.style.color = "#4ade80";
            statusBox.innerText = `✓ ${result.message}`;
            resetForm();
            loadEmployees();
        } else {
            sounds.playError();
            statusBox.style.color = "#f87171";
            statusBox.innerText = result.message;
            alert(`Error: ${result.message}`);
        }
    } catch (err) {
        sounds.playError();
        statusBox.style.color = "#f87171";
        statusBox.innerText = "Server communication error!";
    } finally {
        statusBox.removeAttribute('data-processing');
    }
}

async function loadEmployees() {
    try {
        const res = await fetch('/api/employees');
        const employees = await res.json();
        const tbody = document.getElementById('employees-list');
        tbody.innerHTML = '';

        employees.forEach(emp => {
            const row = document.createElement('tr');
            const safeCode = emp.emp_code.replace(/[^a-zA-Z0-9]/g, '_');
            const qrContainerId = `qr-cell-${safeCode}`;

            row.innerHTML = `
                <td><strong>${emp.emp_code}</strong></td>
                <td>${emp.name}</td>
                <td>${emp.age}</td>
                <td>${emp.gender}</td>
                <td>${emp.birthday}</td>
                <td>${emp.address}</td>
                <td>${emp.contact || '-'}</td>
                <td>
                    <div id="${qrContainerId}" style="background: #ffffff; padding: 4px; border-radius: 4px; display: inline-block; cursor: pointer;" onclick="viewEmployee('${emp.emp_code}')" title="Click to enlarge QR"></div>
                </td>
                <td style="text-align: center;">
                    <div style="display: flex; gap: 6px; justify-content: center;">
                        <button class="btn-action btn-primary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="viewEmployee('${emp.emp_code}')"><i class="ri-eye-line"></i> View</button>
                        <button class="btn-action btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="editEmployee('${emp.emp_code}')"><i class="ri-edit-line"></i> Edit</button>
                        <button class="btn-action" style="padding: 4px 8px; font-size: 0.8rem; background: rgba(239, 68, 68, 0.2); color: #f87171;" onclick="deleteEmployee('${emp.emp_code}')"><i class="ri-delete-bin-line"></i> Delete</button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);

            const qrPayload = JSON.stringify({
                code: emp.emp_code,
                name: emp.name,
                address: emp.address,
                contact: emp.contact || ''
            });

            new QRCode(document.getElementById(qrContainerId), {
                text: qrPayload,
                width: 48,
                height: 48
            });
        });
    } catch (err) {
        console.error("Error loading employees:", err);
    }
}

async function viewEmployee(empCode) {
    sounds.playClick();
    const res = await fetch('/api/employees');
    const employees = await res.json();
    const target = employees.find(e => e.emp_code === empCode);

    if (target) {
        document.getElementById('modal-emp-name').innerText = target.name;
        document.getElementById('modal-emp-code').innerText = `ID: ${target.emp_code}`;

        const modalQrContainer = document.getElementById('modal-qrcode');
        modalQrContainer.innerHTML = '';

        const qrPayload = JSON.stringify({
            code: target.emp_code,
            name: target.name,
            address: target.address,
            contact: target.contact || ''
        });

        new QRCode(modalQrContainer, {
            text: qrPayload,
            width: 180,
            height: 180
        });

        document.getElementById('modal-details').innerHTML = `
            <div><strong>Age:</strong> ${target.age}</div>
            <div><strong>Gender:</strong> ${target.gender}</div>
            <div><strong>Birthday:</strong> ${target.birthday}</div>
            <div><strong>Address:</strong> ${target.address}</div>
            <div><strong>Contact:</strong> ${target.contact || 'N/A'}</div>
        `;

        document.getElementById('view-modal').style.display = 'flex';
    }
}

function closeViewModal() {
    sounds.playClick();
    document.getElementById('view-modal').style.display = 'none';
}

async function editEmployee(empCode) {
    sounds.playClick();
    const res = await fetch('/api/employees');
    const employees = await res.json();
    const target = employees.find(e => e.emp_code === empCode);

    if (target) {
        currentEditCode = target.emp_code;
        document.getElementById('reg-code').value = target.emp_code;
        document.getElementById('reg-code').disabled = true;
        document.getElementById('reg-name').value = target.name;
        document.getElementById('reg-age').value = target.age;
        document.getElementById('reg-gender').value = target.gender;
        document.getElementById('reg-birthday').value = target.birthday;
        document.getElementById('reg-address').value = target.address;
        document.getElementById('reg-contact').value = target.contact || '';
        document.getElementById('reg-pin').value = target.pin;

        document.getElementById('form-title').innerHTML = `<i class="ri-edit-line"></i> Edit Employee (${target.emp_code})`;
        document.getElementById('btn-save').innerHTML = `<i class="ri-save-line"></i> Update Record`;
    }
}

async function deleteEmployee(empCode) {
    sounds.playClick();
    if (confirm(`Are you sure you want to delete employee ${empCode}?`)) {
        try {
            const res = await fetch(`/api/employees/${empCode}`, { method: 'DELETE' });
            const data = await res.json();
            sounds.playSuccess();
            loadEmployees();
        } catch (err) {
            sounds.playError();
        }
    }
}

function resetForm() {
    currentEditCode = null;
    document.getElementById('employee-form').reset();
    document.getElementById('reg-code').disabled = false;
    document.getElementById('form-title').innerHTML = `<i class="ri-user-add-line"></i> Register New Employee`;
    document.getElementById('btn-save').innerHTML = `<i class="ri-save-line"></i> Save & Register`;
}

document.addEventListener('DOMContentLoaded', () => {
    setupWebcam();
    loadFaceModels();
    loadEmployees();
});