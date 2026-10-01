let cachedRecords = [];

async function loadRecords() {
    try {
        const response = await fetch('/api/records');
        cachedRecords = await response.json();
        updateKPIs(cachedRecords);
        renderTable(cachedRecords);
    } catch (err) {
        console.error("Failed to load records:", err);
    }
}

function updateKPIs(records) {
    let countIn = 0, countLunch = 0, countOut = 0;
    records.forEach(r => {
        if (r.time_in !== '-') countIn++;
        if (r.lunch_out !== '-' || r.lunch_in !== '-') countLunch++;
        if (r.time_out !== '-') countOut++;
    });

    document.getElementById('kpi-total').innerText = records.length;
    document.getElementById('kpi-in').innerText = countIn;
    document.getElementById('kpi-lunch').innerText = countLunch;
    document.getElementById('kpi-out').innerText = countOut;
}

function renderTable(records) {
    const tbody = document.getElementById('logs-table-body');
    tbody.innerHTML = '';

    records.forEach(log => {
        const tr = document.createElement('tr');
        tr.id = `row-${log.emp_code}-${log.date}`;
        tr.innerHTML = `
            <td><strong>#${log.id}</strong></td>
            <td><strong>${log.emp_code}</strong></td>
            <td>${log.name}</td>
            <td class="cell-time-in"><span class="badge ${log.time_in !== '-' ? 'badge-in' : ''}">${log.time_in}</span></td>
            <td class="cell-lunch-out"><span class="badge ${log.lunch_out !== '-' ? 'badge-lunch' : ''}">${log.lunch_out}</span></td>
            <td class="cell-lunch-in"><span class="badge ${log.lunch_in !== '-' ? 'badge-lunch' : ''}">${log.lunch_in}</span></td>
            <td class="cell-time-out"><span class="badge ${log.time_out !== '-' ? 'badge-out' : ''}">${log.time_out}</span></td>
            <td><span class="badge badge-method">${log.method}</span></td>
            <td style="text-align: center;">
                <button class="btn-action btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="enableRowEdit('${log.emp_code}', '${log.date}')">
                    <i class="ri-edit-line"></i> Edit
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function enableRowEdit(empCode, dateStr) {
    sounds.playClick();
    const row = document.getElementById(`row-${empCode}-${dateStr}`);
    if (!row) return;

    const record = cachedRecords.find(r => r.emp_code === empCode && r.date === dateStr);
    if (!record) return;

    row.querySelector('.cell-time-in').innerHTML = `<input type="text" class="input-control input-time-in" style="padding: 2px 4px; text-align: center;" value="${record.time_in !== '-' ? record.time_in : ''}" placeholder="HH:MM:SS">`;
    row.querySelector('.cell-lunch-out').innerHTML = `<input type="text" class="input-control input-lunch-out" style="padding: 2px 4px; text-align: center;" value="${record.lunch_out !== '-' ? record.lunch_out : ''}" placeholder="HH:MM:SS">`;
    row.querySelector('.cell-lunch-in').innerHTML = `<input type="text" class="input-control input-lunch-in" style="padding: 2px 4px; text-align: center;" value="${record.lunch_in !== '-' ? record.lunch_in : ''}" placeholder="HH:MM:SS">`;
    row.querySelector('.cell-time-out').innerHTML = `<input type="text" class="input-control input-time-out" style="padding: 2px 4px; text-align: center;" value="${record.time_out !== '-' ? record.time_out : ''}" placeholder="HH:MM:SS">`;

    const actionCell = row.cells[row.cells.length - 1];
    actionCell.innerHTML = `
        <button class="btn-action btn-success" style="padding: 4px 8px; font-size: 0.8rem;" onclick="saveRowEdit('${empCode}', '${dateStr}')"><i class="ri-save-line"></i> Save</button>
        <button class="btn-action btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="loadRecords()"><i class="ri-close-line"></i></button>
    `;
}

async function saveRowEdit(empCode, dateStr) {
    sounds.playClick();
    const row = document.getElementById(`row-${empCode}-${dateStr}`);
    if (!row) return;

    const timeIn = row.querySelector('.input-time-in').value.trim();
    const lunchOut = row.querySelector('.input-lunch-out').value.trim();
    const lunchIn = row.querySelector('.input-lunch-in').value.trim();
    const timeOut = row.querySelector('.input-time-out').value.trim();

    try {
        const response = await fetch('/api/records/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                emp_code: empCode,
                date: dateStr,
                time_in: timeIn,
                lunch_out: lunchOut,
                lunch_in: lunchIn,
                time_out: timeOut
            })
        });

        if (response.ok) {
            sounds.playSuccess();
            await loadRecords();
        } else {
            sounds.playError();
            alert("Failed to update record!");
        }
    } catch (err) {
        sounds.playError();
        console.error("Save error:", err);
    }
}

function filterLogs() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const rows = document.querySelectorAll('#logs-table-body tr');

    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

function exportToExcel() {
    sounds.playClick();
    window.location.href = '/api/export_excel';
}

document.addEventListener('DOMContentLoaded', loadRecords);