let allRecords = [];

async function loadRecords() {
    try {
        const res = await fetch('/api/records');
        allRecords = await res.json();
        renderTable(allRecords);
        updateKPIs(allRecords);
    } catch (err) {
        console.error("Failed to fetch records:", err);
    }
}

function renderTable(records) {
    const tbody = document.getElementById('logs-table-body');
    if (!tbody) return;

    if (!records || records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">No attendance records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = records.map(r => `
        <tr>
            <td style="font-weight: 700; color: #fff;">#${r.id}</td>
            <td style="font-weight: 700; color: var(--accent-cyan);">${r.emp_code}</td>
            <td style="color: #f1f5f9; font-weight: 600;">${r.name}</td>
            <td>${r.time_in !== '-' ? `<span class="badge-time">${r.time_in}</span>` : '-'}</td>
            <td>${r.lunch_out !== '-' ? `<span class="badge-time">${r.lunch_out}</span>` : '-'}</td>
            <td>${r.lunch_in !== '-' ? `<span class="badge-time">${r.lunch_in}</span>` : '-'}</td>
            <td>${r.time_out !== '-' ? `<span class="badge-time">${r.time_out}</span>` : '-'}</td>
            <td><span class="badge-method">${r.method || 'FACE'}</span></td>
            <td>
                <div class="action-group">
                    <button class="btn-table-action btn-table-edit" onclick="openEditModal('${r.emp_code}', '${r.date}', '${r.name}', '${r.time_in}', '${r.lunch_out}', '${r.lunch_in}', '${r.time_out}')">
                        <i class="ri-edit-line"></i> Edit
                    </button>
                    <button class="btn-table-action btn-table-delete" onclick="deleteRecord('${r.emp_code}', '${r.date}', '${r.name}')">
                        <i class="ri-delete-bin-line"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function updateKPIs(records) {
    document.getElementById('kpi-total').textContent = records.length;
    document.getElementById('kpi-in').textContent = records.filter(r => r.time_in !== '-').length;
    document.getElementById('kpi-lunch').textContent = records.filter(r => r.lunch_out !== '-' || r.lunch_in !== '-').length;
    document.getElementById('kpi-out').textContent = records.filter(r => r.time_out !== '-').length;
}

function filterLogs() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const filtered = allRecords.filter(r => 
        r.emp_code.toLowerCase().includes(query) || 
        r.name.toLowerCase().includes(query)
    );
    renderTable(filtered);
}

function exportToExcel() {
    window.location.href = '/api/export_excel';
}

function openEditModal(empCode, dateStr, name, timeIn, lunchOut, lunchIn, timeOut) {
    document.getElementById('edit-emp-code').value = empCode;
    document.getElementById('edit-date').value = dateStr;
    document.getElementById('edit-name').value = name;
    document.getElementById('edit-time-in').value = timeIn === '-' ? '' : timeIn;
    document.getElementById('edit-lunch-out').value = lunchOut === '-' ? '' : lunchOut;
    document.getElementById('edit-lunch-in').value = lunchIn === '-' ? '' : lunchIn;
    document.getElementById('edit-time-out').value = timeOut === '-' ? '' : timeOut;
    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

async function saveEdit(e) {
    e.preventDefault();
    const payload = {
        emp_code: document.getElementById('edit-emp-code').value,
        date: document.getElementById('edit-date').value,
        time_in: document.getElementById('edit-time-in').value,
        lunch_out: document.getElementById('edit-lunch-out').value,
        lunch_in: document.getElementById('edit-lunch-in').value,
        time_out: document.getElementById('edit-time-out').value
    };

    try {
        const res = await fetch('/api/records/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok) {
            closeEditModal();
            loadRecords();
        } else {
            alert(data.message || 'Error updating attendance record');
        }
    } catch (err) {
        console.error("Failed to update record:", err);
        alert("An error occurred while saving changes.");
    }
}

async function deleteRecord(empCode, dateStr, name) {
    if (!confirm(`Are you sure you want to delete all logs for ${name} (${empCode}) on ${dateStr}?`)) {
        return;
    }

    try {
        const res = await fetch('/api/records/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emp_code: empCode, date: dateStr })
        });

        const data = await res.json();
        if (res.ok) {
            loadRecords();
        } else {
            alert(data.message || 'Failed to delete attendance record.');
        }
    } catch (err) {
        console.error("Delete request failed:", err);
        alert("An error occurred while deleting the record.");
    }
}

document.addEventListener('DOMContentLoaded', loadRecords);