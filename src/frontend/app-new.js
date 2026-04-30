import { Html5QrcodeScanner } from 'html5-qrcode';

// --- HTML Escaping (XSS prevention) ---
function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// --- State ---
const state = {
    view: 'login',
    token: localStorage.getItem('absen_token') || null,
    user: JSON.parse(localStorage.getItem('absen_user')) || null,
    loading: false,
    checkInLoading: false,
    checkOutLoading: false,
    dataLoaded: false,
    dataError: '',
    errorMessage: '',
    successMessage: '',
    confirmDialog: { visible: false, message: '', onConfirm: null },
    deleteLoading: false,

    loginData: { employeeId: '', password: '' },

    // Employee
    attendanceHistory: [],
    scannerActive: false,

    // Admin — split loading: dashboard data loads first, management data loads on-demand per tab
    adminView: 'dashboard',
    adminStats: { tepatWaktu: 0, terlambat: 0, bolos: 0 },
    adminRecap: [],
    adminManagement: { employees: [], shifts: [], positions: [], logs: [] },
    managementLoaded: false,   // true once management data has been fetched
    managementLoading: false,

    // Daily Attendance
    dailyAttendance: { records: [], summary: { total: 0, tepatWaktu: 0, terlambat: 0, bolos: 0, belumAbsen: 0 }, date: '' },
    dailyAttendanceLoading: false,
    dailyAttendanceLoaded: false,
    dailyAttendanceError: '',
    attFilterStatus: '',
    attSearch: '',
    attPage: 1,
    attPageSize: 10,

    // Modals / Forms
    formType: '',
    formData: {},
    isNewRecord: true
};

// Batch-update state and render once.
function setState(updates) {
    Object.assign(state, updates);
    render();
}

// --- GAS Communication ---
const callGas = (functionName, ...args) => {
    return new Promise((resolve, reject) => {
        if (typeof google !== 'undefined' && google.script) {
            google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject)
                [functionName](...args);
        } else {
            // Mock fallback for local dev
            console.log(`Mock GAS: ${functionName}`, args);
            setTimeout(() => {
                if (functionName === 'login') {
                    resolve({ status: 'success', data: { token: 'mock-token', user: { id: 'admin', role: 'Admin', name: 'Mock Admin' } } });
                } else if (functionName === 'getDashboardData') {
                    resolve({ status: 'success', data: { stats: { tepatWaktu: 10, terlambat: 2, bolos: 1 }, logs: [] } });
                } else if (functionName === 'getRecap') {
                    resolve({ status: 'success', data: [] });
                } else if (functionName === 'getAdminInitialData') {
                    resolve({ status: 'success', data: { employees: [], shifts: [], positions: [], logs: [] } });
                } else if (functionName === 'getMyHistory') {
                    resolve({ status: 'success', data: [] });
                } else if (functionName === 'getDailyAttendance') {
                    resolve({ status: 'success', data: { records: [], summary: { total: 0, tepatWaktu: 0, terlambat: 0, bolos: 0, belumAbsen: 0 }, date: args[1] || new Date().toISOString().slice(0, 10) } });
                } else {
                    resolve({ status: 'success', data: null });
                }
            }, 500);
        }
    });
};

// --- Rendering ---
let html5QrcodeScanner = null;

function renderDataError() {
    const overlay = document.getElementById('page-loading-overlay');
    if (!overlay) return;
    if (state.dataError) {
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="text-center px-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler mb-3 text-danger" width="48" height="48" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" /><path d="M12 16h.01" /></svg>
                <p class="fw-semibold text-danger mb-1">Failed to load data</p>
                <p class="text-muted small mb-3">${escHtml(state.dataError)}</p>
                <button class="btn btn-primary" id="btn-retry-load">Retry</button>
                <button class="btn btn-link text-danger ms-2" id="btn-retry-logout">Logout</button>
            </div>`;
        document.getElementById('btn-retry-load')?.addEventListener('click', () => {
            setState({ dataError: '', dataLoaded: false });
            if (state.view === 'admin') loadAdminDashboard();
            else loadEmployeeData();
        });
        document.getElementById('btn-retry-logout')?.addEventListener('click', logout);
    } else if (!state.dataLoaded) {
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="spinner-border text-primary" style="width:3rem; height:3rem;" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="text-muted fw-medium mt-3 mb-0">Loading data, please wait…</p>`;
    } else {
        overlay.style.display = 'none';
    }
}

function renderViews() {
    const views = ['login', 'employee', 'admin'];
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) el.style.display = state.view === v ? (v === 'login' ? 'flex' : 'block') : 'none';
    });
}

let _errorTimer = null;
let _successTimer = null;

function renderAlerts() {
    const errorAlert = document.getElementById('error-alert-container');
    const successAlert = document.getElementById('success-alert-container');

    if (errorAlert) {
        errorAlert.innerHTML = state.errorMessage ? `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <span>${escHtml(state.errorMessage)}</span>
                <button type="button" class="btn-close" aria-label="Close"></button>
            </div>` : '';

        if (state.errorMessage) {
            clearTimeout(_errorTimer);
            _errorTimer = setTimeout(() => setState({ errorMessage: '' }), 6000);
        }
    }

    if (successAlert) {
        successAlert.innerHTML = state.successMessage ? `
            <div class="alert alert-success alert-dismissible fade show" role="alert">
                <span>${escHtml(state.successMessage)}</span>
                <button type="button" class="btn-close" aria-label="Close"></button>
            </div>` : '';

        if (state.successMessage) {
            clearTimeout(_successTimer);
            _successTimer = setTimeout(() => setState({ successMessage: '' }), 4000);
        }
    }
}

function renderConfirmDialog() {
    const overlay = document.getElementById('confirm-dialog-overlay');
    if (!overlay) return;
    overlay.style.display = (state.confirmDialog.visible || state.deleteLoading) ? 'flex' : 'none';
    const msgEl = document.getElementById('confirm-dialog-message');
    if (msgEl) msgEl.textContent = state.confirmDialog.message || 'Are you sure?';

    const okBtn = document.getElementById('confirm-dialog-ok');
    const cancelBtn = document.getElementById('confirm-dialog-cancel');
    const spinnerEl = document.getElementById('confirm-dialog-spinner');
    if (okBtn) {
        okBtn.disabled = state.deleteLoading;
        if (spinnerEl) spinnerEl.style.display = state.deleteLoading ? 'inline-block' : 'none';
        okBtn.querySelector('.confirm-btn-text').textContent = state.deleteLoading ? 'Deleting...' : 'Delete';
    }
    if (cancelBtn) cancelBtn.disabled = state.deleteLoading;
}

function renderLoginForm() {
    const btn = document.getElementById('login-submit-btn');
    if (!btn) return;
    btn.disabled = state.loading;
    const spinner = document.getElementById('login-spinner');
    const btnText = document.getElementById('login-btn-text');
    if (spinner) spinner.style.display = state.loading ? 'inline-block' : 'none';
    if (btnText) btnText.textContent = state.loading ? 'Authenticating...' : 'Sign In';
}

function renderEmployeeView() {
    if (state.view !== 'employee') return;

    const nameEl = document.getElementById('employee-name');
    if (nameEl) nameEl.textContent = state.user?.name || '';

    const btnOpen = document.getElementById('btn-open-scanner');
    const btnClose = document.getElementById('btn-close-scanner');
    const reader = document.getElementById('reader');
    if (btnOpen) btnOpen.style.display = state.scannerActive ? 'none' : 'inline-block';
    if (btnClose) btnClose.style.display = state.scannerActive ? 'inline-block' : 'none';
    if (reader) reader.style.display = state.scannerActive ? 'block' : 'none';

    const btnCheckin = document.getElementById('btn-checkin');
    const btnCheckout = document.getElementById('btn-checkout');
    const checkinSpinner = document.getElementById('checkin-spinner');
    const checkoutSpinner = document.getElementById('checkout-spinner');
    const checkinIcon = document.getElementById('checkin-icon');
    const checkoutIcon = document.getElementById('checkout-icon');
    const checkinText = document.getElementById('checkin-btn-text');
    const checkoutText = document.getElementById('checkout-btn-text');

    if (btnCheckin) btnCheckin.disabled = state.checkInLoading || state.checkOutLoading;
    if (btnCheckout) btnCheckout.disabled = state.checkInLoading || state.checkOutLoading;
    if (checkinSpinner) checkinSpinner.style.display = state.checkInLoading ? 'inline-block' : 'none';
    if (checkoutSpinner) checkoutSpinner.style.display = state.checkOutLoading ? 'inline-block' : 'none';
    if (checkinIcon) checkinIcon.style.display = state.checkInLoading ? 'none' : 'inline-block';
    if (checkoutIcon) checkoutIcon.style.display = state.checkOutLoading ? 'none' : 'inline-block';
    if (checkinText) checkinText.textContent = state.checkInLoading ? 'Processing...' : 'Check In';
    if (checkoutText) checkoutText.textContent = state.checkOutLoading ? 'Processing...' : 'Check Out';

    const historyTable = document.getElementById('employee-history-table');
    if (!historyTable) return;

    if (!state.dataLoaded) {
        historyTable.innerHTML = [1, 2, 3].map(() =>
            `<tr><td colspan="5"><div class="placeholder-glow"><span class="placeholder col-12 rounded"></span></div></td></tr>`
        ).join('');
    } else if (state.attendanceHistory.length === 0) {
        historyTable.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No attendance records found.</td></tr>';
    } else {
        historyTable.innerHTML = state.attendanceHistory.map(log => `
            <tr>
                <td>${escHtml(log.date)}</td>
                <td>${escHtml(log.checkInTime)}</td>
                <td><span class="badge text-white ${log.checkInStatus === 'Tepat Waktu' ? 'bg-success' : 'bg-danger'}">${escHtml(log.checkInStatus)}</span></td>
                <td>${escHtml(log.checkOutTime)}</td>
                <td><span class="badge text-white ${log.checkOutStatus === 'Tepat Waktu' ? 'bg-success' : 'bg-warning'}">${escHtml(log.checkOutStatus)}</span></td>
            </tr>`).join('');
    }
}

function renderAdminView() {
    if (state.view !== 'admin') return;

    ['dashboard', 'users', 'shifts', 'positions', 'attendance', 'logs'].forEach(v => {
        const navEl = document.getElementById(`nav-${v}`);
        if (navEl) navEl.classList.toggle('active', state.adminView === v);
        const viewEl = document.getElementById(`admin-view-${v}`);
        if (viewEl) viewEl.style.display = state.adminView === v ? 'block' : 'none';
    });

    const statsOntime   = document.getElementById('stats-ontime');
    const statsLate     = document.getElementById('stats-late');
    const statsAbsent   = document.getElementById('stats-absent');
    if (statsOntime)   statsOntime.textContent   = state.adminStats.tepatWaktu;
    if (statsLate)     statsLate.textContent      = state.adminStats.terlambat;
    if (statsAbsent)   statsAbsent.textContent    = state.adminStats.bolos;

    // Top 10 best performers by timeliness
    const top10Recap = state.adminRecap
        .slice()
        .sort((a, b) => b.tepatWaktu - a.tepatWaktu)
        .slice(0, 10);
    renderTable('admin-recap-table', top10Recap, 6, (r, idx) => {
        const total = r.tepatWaktu + r.terlambat + r.bolos;
        const rate = total > 0 ? Math.round((r.tepatWaktu / total) * 100) : 0;
        const rateColor = rate >= 90 ? 'bg-success' : rate >= 70 ? 'bg-warning' : 'bg-danger';
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
        const name = escHtml(r.name || r.id);
        const empId = r.name ? `<small class="text-muted d-block">${escHtml(r.id)}</small>` : '';
        return `
        <tr>
            <td class="text-center fw-bold">${medal}</td>
            <td>${name}${empId}</td>
            <td class="text-center"><span class="badge bg-success-lt text-success fw-semibold">${escHtml(r.tepatWaktu)}</span></td>
            <td class="text-center"><span class="badge bg-warning-lt text-warning fw-semibold">${escHtml(r.terlambat)}</span></td>
            <td class="text-center"><span class="badge bg-danger-lt text-danger fw-semibold">${escHtml(r.bolos)}</span></td>
            <td class="text-center">
                <div class="d-flex align-items-center gap-2">
                    <div class="progress flex-grow-1" style="height: 6px;">
                        <div class="progress-bar ${rateColor}" style="width: ${rate}%"></div>
                    </div>
                    <span class="text-muted small fw-semibold" style="min-width: 36px;">${rate}%</span>
                </div>
            </td>
        </tr>`;
    });

    if (state.adminView === 'users') renderUsersTable();
    if (state.adminView === 'shifts') renderShiftsTable();
    if (state.adminView === 'positions') renderPositionsTable();
    if (state.adminView === 'attendance') renderDailyAttendanceView();
    if (state.adminView === 'logs') renderLogsTable();
}

function renderTable(tableId, data, colspan, rowFn, isLoading = false) {
    const table = document.getElementById(tableId);
    if (!table) return;
    if (isLoading || (!state.dataLoaded && tableId === 'admin-recap-table')) {
        table.innerHTML = [1, 2, 3].map(() =>
            `<tr><td colspan="${colspan}"><div class="placeholder-glow"><span class="placeholder col-12 rounded"></span></div></td></tr>`
        ).join('');
    } else if (!data || data.length === 0) {
        table.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted py-4">No data found.</td></tr>`;
    } else {
        table.innerHTML = data.map(rowFn).join('');
    }
}

function renderUsersTable() {
    renderTable('admin-users-table', state.adminManagement.employees, 5, u => `
        <tr>
            <td><img src="${escHtml(u.photo_url || svgAvatar(40))}" class="avatar avatar-sm" alt=""></td>
            <td>${escHtml(u.id)}</td>
            <td>${escHtml(u.name)}</td>
            <td>${escHtml(u.role)}</td>
            <td>
                <button class="btn btn-icon btn-sm btn-ghost-primary js-edit-user" data-id="${escHtml(u.id)}" aria-label="Edit user">${iconEdit()}</button>
                <button class="btn btn-icon btn-sm btn-ghost-danger js-delete-user" data-id="${escHtml(u.id)}" aria-label="Delete user">${iconDelete()}</button>
            </td>
        </tr>`, state.managementLoading);
}

function renderShiftsTable() {
    renderTable('admin-shifts-table', state.adminManagement.shifts, 4, s => `
        <tr>
            <td>${escHtml(s.id)}</td>
            <td>${escHtml(s.start_time)}</td>
            <td>${escHtml(s.end_time)}</td>
            <td>
                <button class="btn btn-icon btn-sm btn-ghost-primary js-edit-shift" data-id="${escHtml(s.id)}" aria-label="Edit shift">${iconEdit()}</button>
                <button class="btn btn-icon btn-sm btn-ghost-danger js-delete-shift" data-id="${escHtml(s.id)}" aria-label="Delete shift">${iconDelete()}</button>
            </td>
        </tr>`, state.managementLoading);
}

function renderPositionsTable() {
    renderTable('admin-positions-table', state.adminManagement.positions, 3, p => `
        <tr>
            <td>${escHtml(p.id)}</td>
            <td>${escHtml(p.name)}</td>
            <td>
                <button class="btn btn-icon btn-sm btn-ghost-primary js-edit-position" data-id="${escHtml(p.id)}" aria-label="Edit group">${iconEdit()}</button>
                <button class="btn btn-icon btn-sm btn-ghost-danger js-delete-position" data-id="${escHtml(p.id)}" aria-label="Delete group">${iconDelete()}</button>
            </td>
        </tr>`, state.managementLoading);
}

function renderLogsTable() {
    renderTable('admin-logs-table', state.adminManagement.logs, 3, log => `
        <tr>
            <td>${escHtml(log.timestamp)}</td>
            <td>${escHtml(log.user_id)}</td>
            <td>${escHtml(log.action)}</td>
        </tr>`, state.managementLoading);
}
