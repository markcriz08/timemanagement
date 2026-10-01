let allRecords = [];

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

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

    tbody.innerHTML = records.map(r => {
        const empCode = escapeHtml(r.emp_code || '');
        const dateStr = escapeHtml(r.date || '');
        const name = escapeHtml(r.name || '');
        const timeIn = escapeHtml(r.time_in || '-');
        const lunchOut = escapeHtml(r.lunch_out || '-');
        const lunchIn = escapeHtml(r.lunch_in || '-');
        const timeOut = escapeHtml(r.time_out || '-');
        const method = escapeHtml(r.method || 'FACE');

        return `
        <tr>
            <td style="font-weight: 700; color: #fff;">#${r.id}</td>
            <td style="font-weight: 700; color: var(--accent-cyan);">${empCode}</td>
            <td style="color: #f1f5f9; font-weight: 600;">${name}</td>
            <td>${timeIn !== '-' ? `<span class="badge-time">${timeIn}</span>` : '-'}</td>
            <td>${lunchOut !== '-' ? `<span class="badge-time">${lunchOut}</span>` : '-'}</td>
            <td>${lunchIn !== '-' ? `<span class="badge-time">${lunchIn}</span>` : '-'}</td>
            <td>${timeOut !== '-' ? `<span class="badge-time">${timeOut}</span>` : '-'}</td>
            <td><span class="badge-method">${method}</span></td>
            <td>
                <div class="action-group">
                    <button class="btn-table-action btn-table-edit" 
                        data-empcode="${empCode}" 
                        data-date="${dateStr}" 
                        data-name="${name}" 
                        data-timein="${timeIn}" 
                        data-lunchout="${lunchOut}" 
                        data-lunchin="${lunchIn}" 
                        data-timeout="${timeOut}"
                        onclick="handleEditClick(this)">
                        <i class="ri-edit-line"></i> Edit
                    </button>
                    <button class="btn-table-action btn-table-delete" 
                        data-empcode="${empCode}" 
                        data-date="${dateStr}" 
                        data-name="${name}"
                        onclick="handleDeleteClick(this)">
                        <i class="ri-delete-bin-line"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

function handleEditClick(btn) {
    const ds = btn.dataset;
    openEditModal(ds.empcode, ds.date, ds.name, ds.timein, ds.lunchout, ds.lunchin, ds.timeout);
}

function handleDeleteClick(btn) {
    const ds = btn.dataset;
    deleteRecord(ds.empcode, ds.date, ds.name);
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