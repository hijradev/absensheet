
import QRCode from 'qrcode';
import * as bootstrap from 'bootstrap';
import '@tabler/core/dist/js/tabler.min.js';
import './style.css';
import { initLanguage, t, getLanguage, onLanguageChange, setLanguage } from './i18n/i18n.js';

// Make bootstrap available globally for components
// We ensure it has the Modal class even if the module structure is nested
if (typeof window !== 'undefined') {
    window.bootstrap = bootstrap;
}

// Initialize language
initLanguage();

// Make t function available globally for components and HTML attributes
window.absenT = t;
window.T = t;

// --- HTML Escaping (XSS prevention) ---
// All user-supplied data rendered into innerHTML must go through this.
function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

function formatTimeStr(str) {
    if (!str) return '';
    const m = String(str).match(/\d{2}:\d{2}/);
    return m ? m[0] : str;
}

// --- State ---
// Plain object — no Proxy. We call render() explicitly only when needed.
const state = {
    view: 'login',
    token: localStorage.getItem('absen_token') || null,
    user: JSON.parse(localStorage.getItem('absen_user')) || null,
    loading: false,
    checkInLoading: false,
    checkOutLoading: false,
    dataLoaded: false,
    dataError: '',          // non-empty when the initial data load fails
    errorMessage: '',
    successMessage: '',
    confirmDialog: { visible: false, message: '', onConfirm: null },
    deleteLoading: false,

    loginData: { employeeId: '', password: '' },

    // Employee
    attendanceHistory: [],

    // Admin — split into dashboard data and management data
    adminView: 'dashboard',
    adminStats: { onTime: 0, late: 0, absent: 0, notPresent: 0, cuti: 0, izin: 0, sakit: 0, libur: 0 },
    adminRecap: [],
    adminMonthlyTrend: [],
    // Management data loaded lazily per-tab
    adminManagement: { employees: [], shifts: [], positions: [], logs: [] },
    managementLoaded: false,   // true once management data has been fetched
    managementLoading: false,
    viewLoading: false, // New: track if HTML partial is being loaded

    // User Management pagination and filters
    userSearch: '',
    userRoleFilter: 'all',
    userPage: 1,
    userPageSize: 10,

    logsLoaded: false,         // true once logs have been fetched
    logsLoading: false,
    logsPage: 1,
    logsPageSize: 10,
    logsSearch: '',
    reportsLoaded: false,      // true once reports view has been visited
    reportsLoading: false,

    // Manual Attendance
    manualAttRecords: [],
    manualAttEmployees: [],
    manualAttLoading: false,
    manualAttLoaded: false,
    manualAttError: '',
    manualAttSearch: '',
    manualAttPage: 1,
    manualAttPageSize: 10,
    manualAttModalOpen: false,
    manualAttModalLoading: false,
    manualAttEditRecord: null,  // null = new, object = editing existing

    // Daily Attendance
    dailyAttendance: { records: [], summary: { total: 0, tepatWaktu: 0, terlambat: 0, pulangAwal: 0, belumAbsen: 0 }, date: '' },
    dailyAttendanceLoading: false,
    dailyAttendanceLoaded: false,
    dailyAttendanceError: '',
    attFilterStatus: '',
    attFilterGroup: '',
    attFilterShift: '',
    attSearch: '',
    attPage: 1,
    attPageSize: 10,

    // Modals / Forms
    formType: '',
    formData: {},
    isNewRecord: true,

    // QR Codes
    qrGenerated: false,
    qrGenerating: false,
    qrSearch: '',

    // Settings
    organizationName: '',


    // Geofence / location
    geofenceEnabled: false,
    geofenceRadius: null,
    geofenceWorkLat: null,
    geofenceWorkLng: null,
    locationPayload: null,       // { latitude, longitude, accuracy } — current GPS fix
    locationStatus: 'disabled',  // 'disabled' | 'acquiring' | 'within' | 'outside' | 'error'
    locationErrorMessage: '',
    locationDistance: null,      // computed client-side distance in meters
    // Leave Management
    leaveRequests: [],
    leaveLoading: false,
    leaveLoaded: false,
    leaveSearch: '',
    leaveFilterStatus: 'Pending',
    currentLeaveComponent: null,
    
    // Employee Leave Management
    employeeLeaveRequests: [],
    employeeLeavesLoaded: false,
    employeeLeavesLoading: false,

    // Schedule Management
    currentScheduleComponent: null,
    currentMyScheduleComponent: null,
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
                .withFailureHandler(err => {
                    console.error(`GAS Error in ${functionName}:`, err);
                    reject(err);
                })
                [functionName](...args);
        } else {
            // Mock fallback for local dev
            console.log(`Mock GAS: ${functionName}`, args);
            setTimeout(() => {
                if (functionName === 'login') {
                    resolve({ status: 'success', data: { token: 'mock-token', user: { id: 'admin', role: 'Admin', name: 'Mock Admin' } } });
                } else if (functionName === 'getDashboardData') {
                    resolve({
                        status: 'success',
                        data: {
                            stats: { onTime: 15, late: 3, absent: 1, notPresent: 1 },
                            recap: [
                                { id: 'EMP001', name: 'John Doe', onTime: 10, late: 1, absent: 0, notPresent: 0 }
                            ],
                            monthlyTrend: [
                                { month: '2024-01', label: 'Jan 2024', percentage: 90, onTime: 18, late: 2, absent: 0, notPresent: 0, total: 20 },
                                { month: '2024-02', label: 'Feb 2024', percentage: 85, onTime: 17, late: 3, absent: 0, notPresent: 0, total: 20 }
                            ]
                        }
                    });
                } else if (functionName === 'getAdminInitialData') {
                    resolve({ status: 'success', data: { employees: [], shifts: [], positions: [], logs: [] } });
                } else if (functionName === 'getAdminAllData') {
                    resolve({ status: 'success', data: { stats: { tepatWaktu: 10, terlambat: 2, pulangAwal: 1 }, logs: [], recap: [], management: { employees: [], shifts: [], positions: [], logs: [] } } });
                } else if (functionName === 'getMyHistory') {
                    resolve({ status: 'success', data: [] });
                } else if (functionName === 'getDailyAttendance') {
                    resolve({ status: 'success', data: { records: [], summary: { total: 0, tepatWaktu: 0, terlambat: 0, pulangAwal: 0, belumAbsen: 0 }, date: args[1] || new Date().toISOString().slice(0, 10) } });
                } else if (functionName === 'getDailyAttendanceRange') {
                    resolve({ status: 'success', data: { records: [], summary: { total: 0, tepatWaktu: 0, terlambat: 0, pulangAwal: 0, belumAbsen: 0 }, startDate: args[1], endDate: args[2], isRange: true } });
                } else if (functionName === 'getManualAttendanceRecords') {
                    resolve({ status: 'success', data: { records: [], employees: [] } });
                } else if (functionName === 'saveManualAttendance') {
                    resolve({ status: 'success', message: 'Attendance record saved.' });
                } else if (functionName === 'deleteManualAttendance') {
                    resolve({ status: 'success', message: 'Attendance record deleted.' });
                } else if (functionName === 'saveEmployeeQRCode') {
                    resolve({ status: 'success', message: 'QR code saved for employee ' + args[1] });
                } else if (functionName === 'getEmployeeQRCodes') {
                    resolve({ status: 'success', data: [] });
                } else if (functionName === 'processAttendanceByQR') {
                    resolve({ status: 'success', data: { action: 'checkin', time: '08:00:00', status: 'Tepat Waktu', employeeName: 'Mock Employee' }, message: 'Check In Successful' });
                } else if (functionName === 'getSystemSettings') {
                    resolve({ status: 'success', data: { organizationName: 'My Organization', language: 'en' } });
                } else if (functionName === 'getGeofenceSettings') {
                    resolve({ status: 'success', data: { enabled: false, latitude: null, longitude: null, radius: null } });
                } else if (functionName === 'saveOrganizationSettings') {
                    resolve({ status: 'success', message: 'Organization settings saved successfully' });
                } else if (functionName === 'saveLanguagePreference') {
                    resolve({ status: 'success', message: 'Language preference saved successfully' });
                } else if (functionName === 'changeAdminPassword') {
                    resolve({ status: 'success', message: 'Password changed successfully' });
                } else if (functionName === 'getMyProfile') {
                    const u = state.user || {};
                    resolve({ status: 'success', data: {
                        id: u.id || 'EMP001',
                        name: u.name || 'Mock User',
                        role: u.role || 'Employee',
                        shift_id: u.shift_id || 'SHIFT1',
                        shift: { id: 'SHIFT1', start_time: '08:00', end_time: '17:00' },
                        jabatan_id: 'POS1',
                        jabatan_name: 'Staff',
                        photo_url: ''
                    }});
                } else if (functionName === 'changeMyPassword') {
                    resolve({ status: 'success', message: 'Password changed successfully' });
                } else if (functionName === 'uploadMyAvatar') {
                    resolve({ status: 'success', data: { photo_url: '' }, message: 'Avatar updated' });
                } else if (functionName === 'getMonthScheduleSummary') {
                    resolve({ status: 'success', data: { schedules: [], employees: [], shifts: [], groups: [], year: args[1] || new Date().getFullYear(), month: args[2] || (new Date().getMonth() + 1) } });
                } else if (functionName === 'saveBulkSchedule') {
                    resolve({ status: 'success', data: { saved: (args[1] || []).length, message: 'Schedule saved.' } });
                } else if (functionName === 'saveScheduleEntry') {
                    resolve({ status: 'success', data: { id: 'SCH_MOCK', message: 'Schedule entry saved.' } });
                } else if (functionName === 'deleteScheduleEntry') {
                    resolve({ status: 'success', message: 'Schedule entry deleted.' });
                } else {
                    resolve({ status: 'success', data: null });
                }
            }, 500);
        }
    });
};

// --- View Management ---
const loadView = async (viewName) => {
    if (state.viewLoading) return;
    
    // Phase 1: Show full-page overlay
    setState({ viewLoading: true, dataError: '' });
    
    try {
        const partialName = `${viewName}_partial`;
        const html = await callGas('include', partialName);
        
        const contentDiv = document.getElementById('app-content');
        if (contentDiv) {
            contentDiv.innerHTML = html;
            
            // Re-execute scripts in injected HTML if any (GAS include might contain them)
            const scripts = contentDiv.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });
        }
        
        // Update state but DON'T trigger data load yet, let render finish
        state.view = viewName;
        state.viewLoading = false;
        render(); // Force a render to update UI structure
        
        // Restore language indicator after HTML is injected
        updateLanguageDisplay(getLanguage());
        
        // Phase 2: Start data loading
        if (viewName === 'admin') {
            initAdminSidebar();
            loadAdminData();
        } else if (viewName === 'employee') {
            loadEmployeeData();
        } else if (viewName === 'login') {
            initLoginTabs();
            initScannerButton();
        }
    } catch (err) {
        setState({ 
            viewLoading: false, 
            dataError: `Failed to load view "${viewName}". ${err.message || err}` 
        });
    }
};

// --- Rendering ---



// Targeted render helpers — each only touches its own DOM section.

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
            loadView(state.view);
        });
        document.getElementById('btn-retry-logout')?.addEventListener('click', logout);
    } else if (state.viewLoading) {
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="spinner-border text-primary" style="width:3rem; height:3rem;" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="text-muted fw-medium mt-3 mb-0">Initial loading, please wait…</p>`;
    } else {
        overlay.style.display = 'none';
    }
}

// Timers for auto-hiding alerts
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
        
        const defaultText = state.deleteLoading ? (t('common.deleting') || 'Deleting...') : (t('common.delete') || 'Delete');
        okBtn.querySelector('.confirm-btn-text').textContent = state.confirmDialog.confirmText || defaultText;
        okBtn.className = 'btn ' + (state.confirmDialog.confirmColor || 'btn-danger');
    }
    if (cancelBtn) cancelBtn.disabled = state.deleteLoading;
}

function renderEmployeeView() {
    if (state.view !== 'employee') return;

    const nameEl = document.getElementById('employee-name');
    if (nameEl) nameEl.textContent = state.user?.name || '';

    // Check In / Check Out button loading state
    const btnCheckin = document.getElementById('btn-checkin');
    const btnCheckout = document.getElementById('btn-checkout');
    const checkinSpinner = document.getElementById('checkin-spinner');
    const checkoutSpinner = document.getElementById('checkout-spinner');
    const checkinIcon = document.getElementById('checkin-icon');
    const checkoutIcon = document.getElementById('checkout-icon');
    const checkinText = document.getElementById('checkin-btn-text');
    const checkoutText = document.getElementById('checkout-btn-text');

    const checkinProcessing = state.checkInLoading || state.checkOutLoading || (state.geofenceEnabled && state.locationStatus === 'acquiring');
    const checkoutProcessing = state.checkInLoading || state.checkOutLoading || (state.geofenceEnabled && state.locationStatus === 'acquiring');

    if (btnCheckin) btnCheckin.disabled = checkinProcessing;
    if (btnCheckout) btnCheckout.disabled = checkoutProcessing;
    if (checkinSpinner) checkinSpinner.style.display = state.checkInLoading ? 'inline-block' : 'none';
    if (checkoutSpinner) checkoutSpinner.style.display = state.checkOutLoading ? 'inline-block' : 'none';
    if (checkinIcon) checkinIcon.style.display = state.checkInLoading ? 'none' : 'inline-block';
    if (checkoutIcon) checkoutIcon.style.display = state.checkOutLoading ? 'none' : 'inline-block';
    if (checkinText) checkinText.textContent = state.checkInLoading ? t('common.processing') : t('employeeDashboard.checkIn');
    if (checkoutText) checkoutText.textContent = state.checkOutLoading ? t('common.processing') : t('employeeDashboard.checkOut');

    // Load employee leave requests
    if (!state.employeeLeavesLoading && !state.employeeLeavesLoaded) {
        loadEmployeeLeaveRequests();
    } else if (state.employeeLeavesLoaded) {
        renderEmployeeLeaveRequests();
    }

    // Load employee schedule
    loadEmployeeSchedule();

    // --- Location alerts and status ---
    const locationAlerts    = document.getElementById('location-alerts-container');
    const locationContainer = document.getElementById('location-status-container');
    const locationBadge     = document.getElementById('location-status-badge');
    const distanceDisplay   = document.getElementById('location-distance-display');
    const btnCheckinEl      = document.getElementById('btn-checkin');
    const btnCheckoutEl     = document.getElementById('btn-checkout');

    if (locationAlerts) {
        let alertHtml = '';
        const radius = state.geofenceRadius || 0;
        const dist = state.locationDistance;

        if (state.locationStatus === 'acquiring') {
            alertHtml = `<div class="alert alert-warning mb-0 border-0 shadow-sm d-flex align-items-center">
                <div class="spinner-border spinner-border-sm me-3" role="status"></div>
                <div>${t('employeeDashboard.locationAcquiring')}</div>
            </div>`;
        } else if (state.locationStatus === 'within') {
            alertHtml = `<div class="alert alert-success mb-0 border-0 shadow-sm d-flex align-items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-circle-check me-3" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 12l2 2l4 -4" /></svg>
                <div>${t('employeeDashboard.locationWithinRadius').replace('{radius}', radius)}</div>
            </div>`;
        } else if (state.locationStatus === 'outside') {
            alertHtml = `<div class="alert alert-danger mb-0 border-0 shadow-sm d-flex align-items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-alert-circle me-3" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
                <div>${t('employeeDashboard.locationOutsideRadius').replace('{distance}', dist).replace('{radius}', radius)}</div>
            </div>`;
        } else if (state.locationStatus === 'error' && state.locationErrorMessage) {
            alertHtml = `<div class="alert alert-secondary mb-0 border-0 shadow-sm d-flex align-items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-exclamation-circle me-3" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 9v4" /><path d="M12 16h.01" /></svg>
                <div>${escHtml(state.locationErrorMessage)}</div>
            </div>`;
        }
        locationAlerts.innerHTML = alertHtml;
    }

    if (locationContainer && locationBadge) {
        if (state.geofenceEnabled) {
            locationContainer.style.display = 'block';

            const badgeConfigs = {
                acquiring: { cls: 'bg-warning text-dark', label: t('employeeDashboard.acquiring') || 'Acquiring\u2026' },
                within:    { cls: 'bg-success text-white', label: t('employeeDashboard.within') || 'Within Zone' },
                outside:   { cls: 'bg-danger text-white',  label: t('employeeDashboard.outside') || 'Outside Zone' },
                error:     { cls: 'bg-secondary text-white', label: t('employeeDashboard.error') || 'Location Error' },
                disabled:  { cls: 'bg-secondary text-white', label: t('employeeDashboard.disabled') || 'Location Disabled' }
            };
            const cfg = badgeConfigs[state.locationStatus] || badgeConfigs.error;
            locationBadge.className = `badge fs-6 px-3 py-2 ${cfg.cls}`;
            locationBadge.textContent = cfg.label;

            // Distance display
            if (distanceDisplay) {
                if (state.locationStatus === 'outside' && state.locationDistance !== null && state.geofenceRadius !== null) {
                    distanceDisplay.textContent = `You are ${state.locationDistance}m from the work location (max ${state.geofenceRadius}m allowed).`;
                } else if (state.locationStatus === 'error' && state.locationErrorMessage) {
                    distanceDisplay.textContent = state.locationErrorMessage;
                } else if (state.locationStatus === 'within' && state.locationDistance !== null) {
                    distanceDisplay.textContent = `${state.locationDistance}m from work location.`;
                } else {
                    distanceDisplay.textContent = '';
                }
            }

            // Show/hide and enable/disable buttons based on location status
            const canSubmit = state.locationStatus === 'within';
            if (btnCheckinEl) {
                btnCheckinEl.style.display = canSubmit ? '' : 'none';
                btnCheckinEl.disabled = !canSubmit || checkinProcessing;
            }
            if (btnCheckoutEl) {
                btnCheckoutEl.style.display = canSubmit ? '' : 'none';
                btnCheckoutEl.disabled = !canSubmit || checkoutProcessing;
            }

            updateEmployeeMap();
        } else if (state.geofenceWorkLat && state.geofenceWorkLng) {
            // Even if geofencing is NOT enabled, show the map if office coordinates exist
            locationContainer.style.display = 'block';
            
            // Show a simpler status or just the distance
            if (locationBadge) {
                locationBadge.className = 'badge bg-secondary-lt text-secondary fs-6 px-3 py-2';
                locationBadge.textContent = t('employeeDashboard.locationTracking');
            }
            
            if (distanceDisplay && state.locationDistance !== null) {
                distanceDisplay.textContent = `${state.locationDistance}m from work location.`;
            }

            if (btnCheckinEl)  btnCheckinEl.style.display  = '';
            if (btnCheckoutEl) btnCheckoutEl.style.display = '';
            
            updateEmployeeMap();
        } else {
            locationContainer.style.display = 'none';
            if (btnCheckinEl)  btnCheckinEl.style.display  = '';
            if (btnCheckoutEl) btnCheckoutEl.style.display = '';
        }
    }

    const historyTable = document.getElementById('employee-history-table');
    if (!historyTable) return;

    if (!state.dataLoaded) {
        historyTable.innerHTML = [1, 2, 3].map(() =>
            `<tr><td colspan="5"><div class="placeholder-glow"><span class="placeholder col-12 rounded"></span></div></td></tr>`
        ).join('');
    } else if (state.attendanceHistory.length === 0) {
        historyTable.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">${t('reports.noAttendanceRecordsFound')}</td></tr>`;
    } else {
        historyTable.innerHTML = state.attendanceHistory.map(log => `
            <tr>
                <td>${escHtml(log.date)}</td>
                <td>${escHtml(log.checkInTime)}</td>
                <td><span class="badge text-white ${log.checkInStatus === 'Tepat Waktu' ? 'bg-success' : 'bg-danger'}">${t(log.checkInStatus === 'Tepat Waktu' ? 'onTime' : (log.checkInStatus === 'Terlambat' ? 'late' : 'absent'))}</span></td>
                <td>${escHtml(log.checkOutTime)}</td>
                <td><span class="badge text-white ${log.checkOutStatus === 'Tepat Waktu' ? 'bg-success' : 'bg-warning'}">${t(log.checkOutStatus === 'Tepat Waktu' ? 'onTime' : 'absent')}</span></td>
            </tr>`).join('');
    }
}

// Map instances for reuse
let _employeeMap = null;
let _employeeMarker = null;
let _employeeWorkMarker = null;
let _employeeCircle = null;

function updateEmployeeMap() {
    const mapEl = document.getElementById('employee-location-map');
    if (!mapEl) return;

    // Show map if we have work coordinates OR if we have acquired a user position
    if ((!state.geofenceWorkLat && !state.locationPayload) || state.locationStatus === 'disabled') {
        mapEl.style.display = 'none';
        return;
    }

    mapEl.style.display = 'block';
    const userLat = state.locationPayload?.latitude;
    const userLng = state.locationPayload?.longitude;
    const workLat = state.geofenceWorkLat;
    const workLng = state.geofenceWorkLng;
    const radius  = state.geofenceRadius;

    // Center map on user if available, otherwise on work location
    const centerLat = userLat || workLat;
    const centerLng = userLng || workLng;

    if (!centerLat || !centerLng) return;

    try {
        if (!_employeeMap) {
            _employeeMap = L.map('employee-location-map').setView([centerLat, centerLng], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(_employeeMap);
        } else {
            _employeeMap.invalidateSize();
        }

        // Work Marker and Geofence Circle (if work coordinates exist)
        if (workLat && workLng) {
            const workPos = [workLat, workLng];

            // Work Marker
            if (!_employeeWorkMarker) {
                _employeeWorkMarker = L.marker(workPos, { 
                    icon: L.icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    }),
                    title: 'Work Location' 
                }).addTo(_employeeMap);
                _employeeWorkMarker.bindPopup('Work Location');
            } else {
                _employeeWorkMarker.setLatLng(workPos);
            }

            // Geofence Circle
            const statusColor = state.locationStatus === 'within' ? '#2fb344' : '#d63939';
            if (!_employeeCircle) {
                _employeeCircle = L.circle(workPos, {
                    color: statusColor,
                    fillColor: statusColor,
                    fillOpacity: 0.15,
                    radius: radius
                }).addTo(_employeeMap);
            } else {
                _employeeCircle.setLatLng(workPos);
                _employeeCircle.setRadius(radius);
                _employeeCircle.setStyle({ color: statusColor, fillColor: statusColor });
            }
        }

        // User Marker (if user coordinates exist)
        if (userLat && userLng) {
            const userPos = [userLat, userLng];
            if (!_employeeMarker) {
                _employeeMarker = L.marker(userPos, { title: 'Your Location' }).addTo(_employeeMap);
                _employeeMarker.bindPopup('You are here').openPopup();
            } else {
                _employeeMarker.setLatLng(userPos);
            }

            // Adjust view to fit both if possible
            if (workLat && workLng) {
                const bounds = L.latLngBounds([[userLat, userLng], [workLat, workLng]]);
                _employeeMap.fitBounds(bounds, { padding: [30, 30] });
            } else {
                _employeeMap.setView([userLat, userLng], 15);
            }
        }
    } catch (e) {
        console.error('Leaflet Employee Map Error:', e);
    }
}

function renderAdminView() {
    if (state.view !== 'admin') return;

    // Update navbar title with organization name
    const brandEl = document.querySelector('.navbar-brand');
    if (brandEl) {
        brandEl.textContent = state.organizationName || t('adminPanel.adminPanel');
    }

    // Sidebar active states + sub-view visibility
    ['dashboard', 'users', 'shifts', 'positions', 'attendance', 'manual-attendance', 'logs', 'reports', 'qrcodes', 'settings', 'profile', 'leaves', 'schedule'].forEach(v => {
        const navEl = document.getElementById(`nav-${v}`);
        if (navEl) navEl.classList.toggle('active', state.adminView === v);
        const viewEl = document.getElementById(`admin-view-${v}`);
        if (viewEl) viewEl.style.display = state.adminView === v ? 'block' : 'none';
    });

    // Auto-expand the submenu group that contains the active view
    const viewToGroup = {
        'attendance':        'attendance-group',
        'manual-attendance': 'attendance-group',
        'qrcodes':           'attendance-group',
        'users':             'management-group',
        'shifts':            'management-group',
        'positions':         'management-group',
        'leaves':            'management-group',
        'schedule':          'management-group',
        'reports':           'reports-group',
        'logs':              'reports-group',
    };
    const activeGroup = viewToGroup[state.adminView];
    ['attendance-group', 'management-group', 'reports-group'].forEach(groupId => {
        const header  = document.querySelector(`[data-group="${groupId}"]`);
        const submenu = document.getElementById(`submenu-${groupId}`);
        if (!header || !submenu) return;
        const shouldOpen = groupId === activeGroup;
        submenu.classList.toggle('open', shouldOpen);
        header.classList.toggle('open', shouldOpen);
    });

    // Stats — elements only exist in the admin view
    const statsOntime   = document.getElementById('stats-ontime');
    const statsLate     = document.getElementById('stats-late');
    const statsAbsent   = document.getElementById('stats-absent');
    const statsNotPresent = document.getElementById('stats-notpresent');
    
    const totalMonth = (state.adminStats.onTime || 0) + (state.adminStats.late || 0) + (state.adminStats.absent || 0) + (state.adminStats.notPresent || 0);
    const getPct = (val) => totalMonth > 0 ? Math.round((val / totalMonth) * 100) + '%' : '0%';
    
    if (statsOntime)   statsOntime.textContent   = getPct(state.adminStats.onTime || 0);
    if (statsLate)     statsLate.textContent      = getPct(state.adminStats.late || 0);
    if (statsAbsent)   statsAbsent.textContent    = getPct(state.adminStats.absent || 0);
    if (statsNotPresent) statsNotPresent.textContent  = getPct(state.adminStats.notPresent || 0);

    // Render charts when on dashboard view and data is loaded
    if (state.adminView === 'dashboard' && state.dataLoaded) {
        renderDashboardCharts();
    }

    // Recap table — top 10 by timeliness (onTime count), sorted descending
    const top10Recap = state.adminRecap
        .slice() // avoid mutating state
        .sort((a, b) => b.onTime - a.onTime)
        .slice(0, 10);
    renderTable('admin-recap-table', top10Recap, 7, (r, idx) => {
        const total = r.onTime + r.late + r.absent + r.notPresent;
        const rate = total > 0 ? Math.round((r.onTime / total) * 100) : 0;
        const rateColor = rate >= 90 ? 'bg-success' : rate >= 70 ? 'bg-warning' : 'bg-danger';
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
        const name = escHtml(r.name || r.id);
        const empId = r.name ? `<small class="text-muted d-block">${escHtml(r.id)}</small>` : '';
        return `
        <tr>
            <td class="text-center fw-bold">${medal}</td>
            <td>${name}${empId}</td>
            <td class="text-center"><span class="badge bg-success-lt text-success fw-semibold">${escHtml(r.onTime)}</span></td>
            <td class="text-center"><span class="badge bg-warning-lt text-warning fw-semibold">${escHtml(r.late)}</span></td>
            <td class="text-center"><span class="badge bg-danger-lt text-danger fw-semibold">${escHtml(r.absent)}</span></td>
            <td class="text-center"><span class="badge bg-secondary-lt text-secondary fw-semibold">${escHtml(r.notPresent)}</span></td>
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

    // Sub-view tables — only render the active one
    if (state.adminView === 'users') { renderUsersTable(); setupUserManagementListeners(); }
    if (state.adminView === 'shifts') renderShiftsTable();
    if (state.adminView === 'positions') renderPositionsTable();
    if (state.adminView === 'attendance') renderDailyAttendanceView();
    if (state.adminView === 'manual-attendance') renderManualAttendanceView();
    if (state.adminView === 'logs') renderLogsTable();
    if (state.adminView === 'reports') renderReports();
    if (state.adminView === 'qrcodes') renderQrCodesView();
    if (state.adminView === 'leaves') renderLeavesView();
    if (state.adminView === 'schedule') renderScheduleView();
}

let _attendancePieChart = null;
let _attendanceBarChart = null;

function renderDashboardCharts() {
    const pieLoading = document.getElementById('chart-pie-loading');
    const barLoading = document.getElementById('chart-bar-loading');
    
    // If data is not loaded yet, show loading spinners
    if (!state.dataLoaded) {
        if (pieLoading) pieLoading.style.display = 'flex';
        if (barLoading) barLoading.style.display = 'flex';
        return;
    }
    
    // Hide loading spinners
    if (pieLoading) pieLoading.style.display = 'none';
    if (barLoading) barLoading.style.display = 'none';

    // Pie Chart: Attendance Status Distribution
    const pieData = [
        state.adminStats.onTime || 0,
        state.adminStats.late || 0,
        state.adminStats.absent || 0,
        state.adminStats.notPresent || 0
    ];
    
    const pieOptions = {
        series: pieData,
        chart: { type: 'donut', height: 350 },
        labels: ['On Time', 'Late', 'Absent', 'Not Present'],
        colors: ['#2fb344', '#f76707', '#d63939', '#6c7a9c'],
        legend: { position: 'bottom' },
        plotOptions: {
            pie: {
                donut: {
                    size: '70%',
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Total This Week',
                            formatter: () => pieData.reduce((a, b) => a + b, 0)
                        }
                    }
                }
            }
        },
        responsive: [
            { breakpoint: 768, options: { chart: { height: 280 }, legend: { position: 'bottom' } } },
            { breakpoint: 480, options: { chart: { height: 240, width: '100%' }, legend: { position: 'bottom', fontSize: '11px' } } }
        ],
        noData: {
            text: 'No data available',
            align: 'center',
            verticalAlign: 'middle'
        }
    };

    // Bar Chart: Monthly Attendance Rate Trend (aggregate across all employees, by month)
    const trend = (state.adminMonthlyTrend || []);
    const barOptions = {
        series: [
            { name: 'On Time', data: trend.map(m => m.total > 0 ? Math.round((m.onTime / m.total) * 100) : 0) },
            { name: 'Late', data: trend.map(m => m.total > 0 ? Math.round((m.late / m.total) * 100) : 0) },
            { name: 'Absent', data: trend.map(m => m.total > 0 ? Math.round((m.absent / m.total) * 100) : 0) },
            { name: 'Not Present', data: trend.map(m => m.total > 0 ? Math.round((m.notPresent / m.total) * 100) : 0) }
        ],
        chart: { type: 'bar', height: 350, stacked: true },
        colors: ['#2fb344', '#f76707', '#d63939', '#6c7a9c'],
        xaxis: {
            categories: trend.map(m => m.label || m.month || ''),
            labels: { rotate: -30, style: { fontSize: '11px' } }
        },
        yaxis: { max: 100, labels: { formatter: val => Math.round(val) + '%' } },
        legend: { position: 'top' },
        fill: { opacity: 1 },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '55%',
                borderRadius: 4,
                dataLabels: { total: { enabled: false } }
            }
        },
        dataLabels: {
            enabled: true,
            formatter: val => val > 0 ? val + '%' : '',
            style: { fontSize: '11px', colors: ['#fff'] }
        },
        tooltip: {
            y: { formatter: val => val + '%' },
            custom: ({ dataPointIndex }) => {
                const m = trend[dataPointIndex];
                if (!m) return '';
                const onTimePct = m.total > 0 ? Math.round((m.onTime / m.total) * 100) : 0;
                const latePct = m.total > 0 ? Math.round((m.late / m.total) * 100) : 0;
                const absentPct = m.total > 0 ? Math.round((m.absent / m.total) * 100) : 0;
                const notPresentPct = m.total > 0 ? Math.round((m.notPresent / m.total) * 100) : 0;
                return `<div class="apexcharts-tooltip-box p-2">
                    <strong>${m.label}</strong><br/>
                    On Time: ${onTimePct}% (${m.onTime}) &nbsp; Late: ${latePct}% (${m.late})<br/>
                    Absent: ${absentPct}% (${m.absent}) &nbsp; Not Present: ${notPresentPct}% (${m.notPresent})<br/>
                    <strong>Attendance Rate: ${m.percentage}%</strong>
                </div>`;
            }
        },
        responsive: [
            { breakpoint: 768, options: { chart: { height: 280 }, xaxis: { labels: { rotate: -45, style: { fontSize: '10px' } } } } },
            { breakpoint: 480, options: { chart: { height: 240 }, xaxis: { labels: { rotate: -45, style: { fontSize: '9px' } } }, dataLabels: { enabled: false } } }
        ],
        noData: {
            text: 'No data available',
            align: 'center',
            verticalAlign: 'middle'
        }
    };

    // Use a small timeout to ensure DOM elements are rendered
    setTimeout(() => {
        const pieEl = document.querySelector("#chart-pie-attendance");
        const barEl = document.querySelector("#chart-bar-attendance");
        
        // Destroy existing charts
        if (_attendancePieChart) {
            _attendancePieChart.destroy();
            _attendancePieChart = null;
        }
        if (_attendanceBarChart) {
            _attendanceBarChart.destroy();
            _attendanceBarChart = null;
        }
        
        // Render new charts
        if (pieEl && typeof ApexCharts !== 'undefined') {
            _attendancePieChart = new ApexCharts(pieEl, pieOptions);
            _attendancePieChart.render();
        }
        
        if (barEl && typeof ApexCharts !== 'undefined') {
            _attendanceBarChart = new ApexCharts(barEl, barOptions);
            _attendanceBarChart.render();
        }
    }, 100);
}

async function renderLeavesView() {
    if (state.currentLeaveComponent) {
        state.currentLeaveComponent.render();
        return;
    }

    try {
        const { LeaveManagement } = await import('./components/LeaveManagement.js');
        const component = new LeaveManagement(state, setState, callGas);
        state.currentLeaveComponent = component;
        await component.loadData();
    } catch (error) {
        console.error('Failed to load LeaveManagement component:', error);
    }
}

async function renderScheduleView() {
    if (state.currentScheduleComponent) {
        state.currentScheduleComponent.render();
        return;
    }
    try {
        const { ScheduleManagement } = await import('./components/ScheduleManagement.js');
        const component = new ScheduleManagement(state, setState, callGas);
        state.currentScheduleComponent = component;
        await component.loadData();
    } catch (error) {
        console.error('Failed to load ScheduleManagement component:', error);
    }
}

async function renderReports() {
    try {
        const { Reports } = await import('./components/Reports.js');
        const component = new Reports(state, setState, callGas);
        state.currentReportComponent = component;
        await component.loadData();
    } catch (error) {
        console.error('Failed to load Reports component:', error);
    }
}

async function loadSettingsView() {
    try {
        const { Settings } = await import('./components/Settings.js');
        const component = new Settings(state, setState, callGas);
        state.currentSettingsComponent = component;
        await component.loadData();
    } catch (error) {
        console.error('Failed to load Settings component:', error);
    }
}

async function loadAdminProfileView() {
    try {
        const { Profile } = await import('./components/Profile.js');
        const component = new Profile(state, setState, callGas);
        state.currentProfileComponent = component;
        await component.loadData();
    } catch (error) {
        console.error('Failed to load Profile component:', error);
    }
}

async function loadEmployeeProfileView() {
    try {
        const { Profile } = await import('./components/Profile.js');
        const component = new Profile(state, setState, callGas);
        state.currentProfileComponent = component;
        await component.loadData();
    } catch (error) {
        console.error('Failed to load Profile component:', error);
    }
}

// --- Employee Schedule ---

async function loadEmployeeSchedule() {
    const container = document.getElementById('employee-schedule-container');
    if (!container) return;

    if (state.currentMyScheduleComponent) {
        // Already initialized — just re-render if container is empty
        if (!container.querySelector('.sched-calendar') && !container.querySelector('.spinner-border')) {
            state.currentMyScheduleComponent.render();
        }
        return;
    }

    try {
        const { MySchedule } = await import('./components/MySchedule.js');
        const component = new MySchedule(state, setState, callGas);
        state.currentMyScheduleComponent = component;
        await component.loadData();
    } catch (error) {
        console.error('Failed to load MySchedule component:', error);
    }
}

// --- Employee Leave Management ---

async function loadEmployeeLeaveRequests() {
    if (state.employeeLeavesLoading) return;
    setState({ employeeLeavesLoading: true });
    try {
        const res = await callGas('getLeaveRequests', state.token);
        if (res && res.status === 'success') {
            setState({
                employeeLeaveRequests: res.data,
                employeeLeavesLoaded: true,
                employeeLeavesLoading: false
            });
        } else {
            setState({ 
                employeeLeavesLoading: false, 
                errorMessage: res?.message || 'Failed to load leave requests.' 
            });
        }
    } catch {
        setState({ 
            employeeLeavesLoading: false, 
            errorMessage: 'Connection error while loading leave requests.' 
        });
    }
}

function renderEmployeeLeaveRequests() {
    const container = document.getElementById('employee-leave-requests-container');
    if (!container) return;

    if (state.employeeLeavesLoading && !state.employeeLeavesLoaded) {
        container.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="mt-2 text-muted">${t('common.loading')}</p>
            </div>
        `;
        return;
    }

    const leaves = state.employeeLeaveRequests || [];
    if (leaves.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-muted">
                <p>${t('employeeDashboard.noLeaveRequests')}</p>
            </div>
        `;
        return;
    }

    // Status badge colors
    const statusColors = {
        pending: 'bg-warning-lt text-warning',
        approved: 'bg-success-lt text-success',
        rejected: 'bg-danger-lt text-danger'
    };

    const rows = leaves.map(leave => {
        const startDate = new Date(leave.startDate);
        const endDate = new Date(leave.endDate);
        const daysDiff = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        const isPending = leave.status === 'pending';

        return `
            <tr>
                <td>
                    <div class="fw-semibold">${t(`leaveManagement.${leave.leaveType.toLowerCase()}`)}</div>
                </td>
                <td>
                    <div class="text-muted small">${escHtml(formatDateDisplay(leave.startDate))} - ${escHtml(formatDateDisplay(leave.endDate))}</div>
                </td>
                <td><span class="badge bg-secondary-lt">${daysDiff} ${t('employeeDashboard.days')}</span></td>
                <td><span class="badge ${statusColors[leave.status] || 'bg-secondary'}">${t(`employeeDashboard.${leave.status}`)}</span></td>
                <td class="text-end">
                    ${isPending ? `
                        <button class="btn btn-icon btn-sm btn-ghost-primary js-edit-leave" data-id="${leave.id}" title="${t('common.edit')}">${iconEdit()}</button>
                        <button class="btn btn-icon btn-sm btn-ghost-danger js-delete-leave" data-id="${leave.id}" title="${t('common.delete')}">${iconDelete()}</button>
                    ` : '-'}
                </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="table-responsive">
            <table class="table table-vcenter card-table">
                <thead>
                    <tr>
                        <th>${t('employeeDashboard.leaveType')}</th>
                        <th>${t('employeeDashboard.date')}</th>
                        <th>${t('employeeDashboard.days')}</th>
                        <th>${t('employeeDashboard.status')}</th>
                        <th class="w-1"></th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

// Helper to format date for display in Indonesian format or YYYY-MM-DD
function formatDateDisplay(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
    } catch {
        return dateString;
    }
}

async function openEmployeeLeaveModal(leaveId = null) {
    try {
        const { LeaveManagement } = await import('./components/LeaveManagement.js');
        
        if (!state.currentLeaveComponent) {
            state.currentLeaveComponent = new LeaveManagement(state, setState, callGas, {
                onSuccess: (res) => {
                    loadEmployeeLeaveRequests();
                    setState({ successMessage: res.message });
                }
            });
        }
        
        const component = state.currentLeaveComponent;
        
        // Ensure modal container exists
        const dashboardPanel = document.getElementById('employee-dashboard-panel');
        if (!dashboardPanel) return;
        
        component.renderModal(dashboardPanel);
        
        if (leaveId) {
            const leave = state.employeeLeaveRequests.find(l => l.id === leaveId);
            if (leave) {
                component.editLeave(leave);
            }
        } else {
            component.prepareNewLeave();
        }
        
        const modalEl = document.getElementById('leave-form-modal');
        if (modalEl) {
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();
        }
    } catch (error) {
        console.error('Failed to open leave modal:', error);
    }
}

async function deleteEmployeeLeaveRequest(leaveId) {
    if (!confirm(t('confirmAction') + '? ' + t('areYouSure'))) return;
    
    try {
        const res = await callGas('deleteLeaveRequest', state.token, leaveId);
        if (res && res.status === 'success') {
            loadEmployeeLeaveRequests();
            setState({ successMessage: res.message });
        } else {
            setState({ errorMessage: res?.message || 'Failed to delete leave request.' });
        }
    } catch {
        setState({ errorMessage: 'Connection error while deleting leave request.' });
    }
}

async function loadReportData(startDateOrPeriod, endDate) {
    const component = state.currentReportComponent;
    if (component) {
        await component.loadReportData(startDateOrPeriod, endDate);
    }
}

function exportReportCSV() {
    const component = state.currentReportComponent;
    if (component) component.exportCSV();
}

function exportReportExcel() {
    const component = state.currentReportComponent;
    if (component) component.exportExcel();
}

function exportReportPDF() {
    const component = state.currentReportComponent;
    if (component) component.exportPDF();
}

// Generic table renderer.
// isLoading: show skeleton rows while data is being fetched for this specific section.
function renderTable(tableId, data, colspan, rowFn, isLoading = false) {
    const table = document.getElementById(tableId);
    if (!table) return;
    if (isLoading || !state.dataLoaded) {
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
    const table = document.getElementById('admin-users-table');
    if (!table) return;

    const employees = state.adminManagement.employees || [];
    
    if (state.managementLoading) {
        table.innerHTML = [1, 2, 3].map(() =>
            `<tr><td colspan="5"><div class="placeholder-glow"><span class="placeholder col-12 rounded"></span></div></td></tr>`
        ).join('');
        return;
    }

    if (employees.length === 0) {
        table.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No users found.</td></tr>';
        return;
    }

    // Apply filters and reverse to show newest first
    let filtered = [...employees].reverse();
    
    // Search filter
    if (state.userSearch) {
        const query = state.userSearch.toLowerCase();
        filtered = filtered.filter(u =>
            u.id.toLowerCase().includes(query) ||
            u.name.toLowerCase().includes(query) ||
            (u.role && u.role.toLowerCase().includes(query))
        );
    }
    
    // Role filter
    if (state.userRoleFilter !== 'all') {
        filtered = filtered.filter(u => u.role === state.userRoleFilter);
    }

    // Pagination
    const totalPages = Math.ceil(filtered.length / state.userPageSize);
    const startIndex = (state.userPage - 1) * state.userPageSize;
    const endIndex = startIndex + state.userPageSize;
    const paginatedUsers = filtered.slice(startIndex, endIndex);

    if (paginatedUsers.length === 0) {
        table.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No users match the current filter.</td></tr>';
    } else {
        table.innerHTML = paginatedUsers.map(u => `
            <tr>
                <td><img src="${escHtml(u.photo_url || svgAvatar(40))}" class="avatar avatar-sm" alt="" onerror="this.src='${svgAvatar(40)}'"></td>
                <td>${escHtml(u.id)}</td>
                <td>${escHtml(u.name)}</td>
                <td>${escHtml(u.role)}</td>
                <td>
                    <button class="btn btn-icon btn-sm btn-ghost-primary js-edit-user" data-id="${escHtml(u.id)}" aria-label="Edit user">${iconEdit()}</button>
                    <button class="btn btn-icon btn-sm btn-ghost-danger js-delete-user" data-id="${escHtml(u.id)}" aria-label="Delete user">${iconDelete()}</button>
                </td>
            </tr>`).join('');
    }

    // Render pagination
    renderUserPagination(filtered.length, totalPages);
    
    // Render stats
    renderUserStats(filtered);
    
    // Populate role filter dropdown
    populateRoleFilter();
}

function renderUserPagination(filteredCount, totalPages) {
    const container = document.getElementById('user-pagination');
    if (!container) return;

    const totalCount = (state.adminManagement.employees || []).length;

    if (totalPages <= 1) {
        container.innerHTML = `<div class="text-muted small">${t('show')} ${filteredCount} ${t('of')} ${totalCount} ${t('records')}</div>`;
        return;
    }

    const startIndex = (state.userPage - 1) * state.userPageSize + 1;
    const endIndex = Math.min(state.userPage * state.userPageSize, filteredCount);

    const maxVisible = 5;
    let startPage = Math.max(1, state.userPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

    let pages = '';
    if (startPage > 1) {
        pages += `<li class="page-item"><a class="page-link js-user-page" href="#" data-page="1">1</a></li>`;
        if (startPage > 2) pages += `<li class="page-item disabled"><span class="page-link">…</span></li>`;
    }
    for (let i = startPage; i <= endPage; i++) {
        pages += `<li class="page-item ${i === state.userPage ? 'active' : ''}"><a class="page-link js-user-page" href="#" data-page="${i}">${i}</a></li>`;
    }
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) pages += `<li class="page-item disabled"><span class="page-link">…</span></li>`;
        pages += `<li class="page-item"><a class="page-link js-user-page" href="#" data-page="${totalPages}">${totalPages}</a></li>`;
    }

    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div class="text-muted small">${t('show')} ${startIndex}–${endIndex} ${t('of')} ${filteredCount} ${t('records')}</div>
            <ul class="pagination m-0">
                <li class="page-item ${state.userPage === 1 ? 'disabled' : ''}">
                    <a class="page-link js-user-page-prev" href="#">
                        <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><polyline points="15 6 9 12 15 18"/></svg>
                        ${t('previous')}
                    </a>
                </li>
                ${pages}
                <li class="page-item ${state.userPage === totalPages ? 'disabled' : ''}">
                    <a class="page-link js-user-page-next" href="#">
                        ${t('next')}
                        <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><polyline points="9 6 15 12 9 18"/></svg>
                    </a>
                </li>
            </ul>
        </div>`;
}

function renderUserStats(filtered) {
    const container = document.getElementById('user-stats');
    if (!container) return;

    const roleCount = {};
    filtered.forEach(u => {
        const role = u.role || 'Unknown';
        roleCount[role] = (roleCount[role] || 0) + 1;
    });

    container.innerHTML = Object.entries(roleCount)
        .map(([role, count]) => `<span class="badge bg-blue-lt me-1">${escHtml(role)}: ${count}</span>`)
        .join('') || '<span class="text-muted small">No data</span>';
}

function populateRoleFilter() {
    const select = document.getElementById('user-role-filter');
    if (!select) return;

    const employees = state.adminManagement.employees || [];
    const roles = [...new Set(employees.map(u => u.role).filter(Boolean))].sort();

    // Keep current value
    const current = state.userRoleFilter;

    select.innerHTML = `<option value="all">${t('all')}</option>` +
        roles.map(r => `<option value="${escHtml(r)}" ${current === r ? 'selected' : ''}>${escHtml(r)}</option>`).join('');
}

function exportUsersCSV() {
    const employees = state.adminManagement.employees || [];
    let filtered = [...employees].reverse();

    if (state.userSearch) {
        const q = state.userSearch.toLowerCase();
        filtered = filtered.filter(u =>
            u.id.toLowerCase().includes(q) ||
            u.name.toLowerCase().includes(q) ||
            (u.role && u.role.toLowerCase().includes(q))
        );
    }
    if (state.userRoleFilter !== 'all') {
        filtered = filtered.filter(u => u.role === state.userRoleFilter);
    }

    if (!filtered.length) { alert('No data to export'); return; }

    const escCSV = v => {
        const s = String(v ?? '');
        return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csv = [
        ['ID', 'Name', 'Role'].join(','),
        ...filtered.map(u => [escCSV(u.id), escCSV(u.name), escCSV(u.role || '')].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function printUsers() {
    const employees = state.adminManagement.employees || [];
    let filtered = employees.slice().reverse();

    if (state.userSearch) {
        const q = state.userSearch.toLowerCase();
        filtered = filtered.filter(u =>
            u.id.toLowerCase().includes(q) ||
            u.name.toLowerCase().includes(q) ||
            (u.role && u.role.toLowerCase().includes(q))
        );
    }
    if (state.userRoleFilter !== 'all') {
        filtered = filtered.filter(u => u.role === state.userRoleFilter);
    }

    if (!filtered.length) { alert('No data to print'); return; }

    const rows = filtered.map(u => `
        <tr>
            <td>${escHtml(u.id)}</td>
            <td>${escHtml(u.name)}</td>
            <td>${escHtml(u.role || '')}</td>
        </tr>`).join('');

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html>
<html>
<head>
    <title>User Management</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        h1 { font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 8px; }
        .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 10px 12px; text-align: left; }
        th { background: #f1f5f9; font-weight: bold; }
        tr:nth-child(even) { background: #f8fafc; }
        @media print { body { padding: 0; } }
    </style>
</head>
<body>
    <h1>${t('userManagement')}</h1>
    <div class="meta">Printed: ${new Date().toLocaleString()} &nbsp;|&nbsp; Total: ${filtered.length} users</div>
    <table>
        <thead><tr><th>${t('id')}</th><th>${t('name')}</th><th>${t('role')}</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>
    <script>window.onload = () => window.print();<\/script>
</body>
</html>`);
    win.document.close();
}

function setupUserManagementListeners() {
    // Search
    const searchInput = document.getElementById('user-search-input');
    if (searchInput && !searchInput.dataset.bound) {
        searchInput.dataset.bound = '1';
        searchInput.value = state.userSearch;
        searchInput.addEventListener('input', e => {
            state.userSearch = e.target.value;
            state.userPage = 1;
            renderUsersTable();
        });
    }

    // Role filter
    const roleFilter = document.getElementById('user-role-filter');
    if (roleFilter && !roleFilter.dataset.bound) {
        roleFilter.dataset.bound = '1';
        roleFilter.addEventListener('change', e => {
            state.userRoleFilter = e.target.value;
            state.userPage = 1;
            renderUsersTable();
        });
    }

    // Items per page
    const perPage = document.getElementById('user-items-per-page');
    if (perPage && !perPage.dataset.bound) {
        perPage.dataset.bound = '1';
        perPage.value = String(state.userPageSize);
        perPage.addEventListener('change', e => {
            state.userPageSize = parseInt(e.target.value);
            state.userPage = 1;
            renderUsersTable();
        });
    }

    // Export CSV
    const exportBtn = document.getElementById('user-export-btn');
    if (exportBtn && !exportBtn.dataset.bound) {
        exportBtn.dataset.bound = '1';
        exportBtn.addEventListener('click', exportUsersCSV);
    }

    // Print
    const printBtn = document.getElementById('user-print-btn');
    if (printBtn && !printBtn.dataset.bound) {
        printBtn.dataset.bound = '1';
        printBtn.addEventListener('click', printUsers);
    }

    // Pagination (delegated — re-bind each render)
    const paginationContainer = document.getElementById('user-pagination');
    if (paginationContainer) {
        paginationContainer.onclick = e => {
            e.preventDefault();
            const link = e.target.closest('a');
            if (!link) return;
            if (link.classList.contains('js-user-page-prev')) {
                if (state.userPage > 1) { state.userPage--; renderUsersTable(); }
            } else if (link.classList.contains('js-user-page-next')) {
                const totalPages = Math.ceil(
                    (state.adminManagement.employees || []).filter(u => {
                        if (state.userSearch) {
                            const q = state.userSearch.toLowerCase();
                            if (!u.id.toLowerCase().includes(q) && !u.name.toLowerCase().includes(q) && !(u.role && u.role.toLowerCase().includes(q))) return false;
                        }
                        if (state.userRoleFilter !== 'all' && u.role !== state.userRoleFilter) return false;
                        return true;
                    }).length / state.userPageSize
                );
                if (state.userPage < totalPages) { state.userPage++; renderUsersTable(); }
            } else if (link.classList.contains('js-user-page')) {
                const page = parseInt(link.dataset.page);
                if (page && page !== state.userPage) { state.userPage = page; renderUsersTable(); }
            }
        };
    }
}

function renderShiftsTable() {
    const shifts = [...(state.adminManagement.shifts || [])].reverse();
    renderTable('admin-shifts-table', shifts, 4, s => `
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
    const positions = [...(state.adminManagement.positions || [])].reverse();
    renderTable('admin-positions-table', positions, 3, p => `
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
    let logs = state.adminManagement.logs || [];
    
    // Apply search
    if (state.logsSearch) {
        const term = state.logsSearch.toLowerCase();
        logs = logs.filter(log => 
            (log.timestamp && String(log.timestamp).toLowerCase().includes(term)) ||
            (log.user_id && String(log.user_id).toLowerCase().includes(term)) ||
            (log.action && String(log.action).toLowerCase().includes(term))
        );
    }
    
    // Pagination
    const totalRecords = logs.length;
    const totalPages = Math.ceil(totalRecords / state.logsPageSize) || 1;
    if (state.logsPage > totalPages) state.logsPage = totalPages;
    if (state.logsPage < 1) state.logsPage = 1;

    const start = (state.logsPage - 1) * state.logsPageSize;
    const end = start + state.logsPageSize;
    const pageData = logs.slice(start, end);

    const countEl = document.getElementById('logs-result-count');
    if (countEl) {
        countEl.textContent = `Showing ${totalRecords === 0 ? 0 : start + 1}-${Math.min(end, totalRecords)} of ${totalRecords} records`;
    }

    renderTable('admin-logs-table', pageData, 3, log => `
        <tr>
            <td>${escHtml(log.timestamp)}</td>
            <td>${escHtml(log.user_id)}</td>
            <td>${escHtml(log.action)}</td>
        </tr>`, state.logsLoading);
        
    renderLogsPagination(state.logsPage, totalPages);
}

function renderLogsPagination(page, totalPages) {
    const container = document.getElementById('logs-pagination');
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let pages = '';
    
    pages += `<li class="page-item ${page === 1 ? 'disabled' : ''}">
        <a class="page-link js-logs-page" href="#" data-page="${page - 1}">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 6l-6 6l6 6" /></svg>
        </a>
    </li>`;

    const maxVisible = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        pages += paginationBtnLogs(1, page, '1');
        if (startPage > 2) pages += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        pages += paginationBtnLogs(i, page, String(i));
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) pages += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        pages += paginationBtnLogs(totalPages, page, String(totalPages));
    }

    pages += `<li class="page-item ${page === totalPages ? 'disabled' : ''}">
        <a class="page-link js-logs-page" href="#" data-page="${page + 1}">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 6l6 6l-6 6" /></svg>
        </a>
    </li>`;

    container.innerHTML = `<ul class="pagination mb-0">${pages}</ul>`;
}

function paginationBtnLogs(pageNum, currentPage, label) {
    return `<li class="page-item ${pageNum === currentPage ? 'active' : ''}">
        <a class="page-link js-logs-page" href="#" data-page="${pageNum}">${label}</a>
    </li>`;
}

function renderDailyAttendanceView() {
    // Summary cards
    const s = state.dailyAttendance.summary;
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    if (state.dailyAttendanceLoaded) {
        setEl('att-stat-ontime',     s.tepatWaktu);
        setEl('att-stat-late',       s.terlambat);
        setEl('att-stat-absent',     s.pulangAwal);
        setEl('att-stat-notpresent', s.belumAbsen);
    } else {
        ['att-stat-ontime','att-stat-late','att-stat-absent','att-stat-notpresent']
            .forEach(id => setEl(id, '—'));
    }

    // Load button spinner
    const spinner = document.getElementById('attendance-load-spinner');
    const icon    = document.getElementById('attendance-load-icon');
    const btn     = document.getElementById('btn-load-attendance');
    if (spinner) spinner.style.display = state.dailyAttendanceLoading ? 'inline-block' : 'none';
    if (icon)    icon.style.display    = state.dailyAttendanceLoading ? 'none' : 'inline-block';
    if (btn)     btn.disabled          = state.dailyAttendanceLoading;

    // Keep page-size select in sync with state
    const pageSizeEl = document.getElementById('att-page-size');
    if (pageSizeEl && parseInt(pageSizeEl.value, 10) !== state.attPageSize) {
        pageSizeEl.value = String(state.attPageSize);
    }

    // Populate Group and Shift filter dropdowns from management data
    const groupSel = document.getElementById('att-filter-group');
    if (groupSel) {
        const positions = state.adminManagement.positions || [];
        const currentGroup = state.attFilterGroup;
        groupSel.innerHTML = `<option value="">All Groups</option>` +
            positions.map(p => `<option value="${escHtml(p.name)}" ${currentGroup === p.name ? 'selected' : ''}>${escHtml(p.name)}</option>`).join('');
    }
    const shiftSel = document.getElementById('att-filter-shift');
    if (shiftSel) {
        const shifts = state.adminManagement.shifts || [];
        const currentShift = state.attFilterShift;
        shiftSel.innerHTML = `<option value="">All Shifts</option>` +
            shifts.map(s => `<option value="${escHtml(s.id)}" ${currentShift === s.id ? 'selected' : ''}>${escHtml(formatTimeStr(s.start_time))}–${escHtml(formatTimeStr(s.end_time))}</option>`).join('');
    }

    // Show/hide Date column based on whether this is a range result
    const isRange = !!(state.dailyAttendance && state.dailyAttendance.isRange);
    const dateColHeader = document.getElementById('att-col-date');
    if (dateColHeader) dateColHeader.style.display = isRange ? '' : 'none';
    const colspan = isRange ? 9 : 8;

    // Table
    const table = document.getElementById('admin-attendance-table');
    if (!table) return;

    if (state.dailyAttendanceLoading) {
        table.innerHTML = [1,2,3,4,5].map(() =>
            `<tr><td colspan="${colspan}"><div class="placeholder-glow"><span class="placeholder col-12 rounded"></span></div></td></tr>`
        ).join('');
        renderAttendancePagination(0, 0);
        return;
    }

    if (!state.dailyAttendanceLoaded) {
        if (state.dailyAttendanceError) {
            table.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-5">
                <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler mb-2 d-block mx-auto text-danger" width="40" height="40" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" /><path d="M12 16h.01" /></svg>
                <p class="text-danger fw-semibold mb-1">Failed to load attendance</p>
                <p class="text-muted small mb-3">${escHtml(state.dailyAttendanceError)}</p>
                <button class="btn btn-sm btn-primary js-att-retry">Retry</button>
            </td></tr>`;
        } else {
            table.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted py-5">
                <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler mb-2 d-block mx-auto text-muted" width="40" height="40" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 5m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /><path d="M16 3l0 4" /><path d="M8 3l0 4" /><path d="M4 11l16 0" /></svg>
                Select a date range and click Load to view attendance
            </td></tr>`;
        }
        renderAttendancePagination(0, 0);
        return;
    }

    // Apply filters
    const filterStatus = state.attFilterStatus;
    const filterGroup  = state.attFilterGroup;
    const filterShift  = state.attFilterShift;
    const searchTerm   = (state.attSearch || '').toLowerCase().trim();

    const filtered = state.dailyAttendance.records.filter(r => {
        const matchStatus = !filterStatus ||
            r.checkInStatus === filterStatus ||
            r.checkOutStatus === filterStatus;
        const matchGroup  = !filterGroup  || r.position === filterGroup;
        const matchShift  = !filterShift  || r.shiftId  === filterShift;
        const matchSearch = !searchTerm ||
            r.employeeId.toLowerCase().includes(searchTerm) ||
            r.employeeName.toLowerCase().includes(searchTerm) ||
            r.position.toLowerCase().includes(searchTerm);
        return matchStatus && matchGroup && matchShift && matchSearch;
    });

    const total      = filtered.length;
    const pageSize   = state.attPageSize;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // Clamp current page in case filters reduced the result set
    const page       = Math.min(state.attPage, totalPages);
    const start      = (page - 1) * pageSize;
    const end        = Math.min(start + pageSize, total);
    const pageSlice  = filtered.slice(start, end);

    // Result count info
    const countEl = document.getElementById('att-result-count');
    if (countEl) {
        countEl.textContent = total > 0
            ? `Showing ${start + 1}–${end} of ${total} record${total !== 1 ? 's' : ''}`
            : '';
    }

    if (total === 0) {
        table.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted py-4">No records match the current filter.</td></tr>`;
        renderAttendancePagination(0, 0);
        return;
    }

    table.innerHTML = pageSlice.map((r, idx) => {
        const rowNum         = start + idx + 1;
        const inStatusBadge  = attStatusBadge(r.checkInStatus);
        const outStatusBadge = r.checkOutTime ? attStatusBadge(r.checkOutStatus) : '<span class="text-muted">—</span>';
        const rowClass       = r.checkInStatus === 'Tidak Hadir' ? 'table-light text-muted' : '';
        const dateCell       = isRange ? `<td class="text-muted small">${escHtml(r.date || '')}</td>` : '';
        return `<tr class="${rowClass}">
            <td class="text-muted">${rowNum}</td>
            ${dateCell}
            <td>
                <div class="fw-semibold">${escHtml(r.employeeName)}</div>
                <div class="text-muted small">${escHtml(r.employeeId)}</div>
            </td>
            <td>${escHtml(r.position)}</td>
            <td>
                <span class="badge bg-secondary-lt">${escHtml(r.shiftId)}</span>
                <div class="text-muted small">${escHtml(r.shiftStart)} – ${escHtml(r.shiftEnd)}</div>
            </td>
            <td>${r.checkInTime ? `<span class="fw-medium">${escHtml(r.checkInTime)}</span>` : '<span class="text-muted">—</span>'}</td>
            <td>${inStatusBadge}</td>
            <td>${r.checkOutTime ? `<span class="fw-medium">${escHtml(r.checkOutTime)}</span>` : '<span class="text-muted">—</span>'}</td>
            <td>${outStatusBadge}</td>
        </tr>`;
    }).join('');

    renderAttendancePagination(page, totalPages);
}

function renderAttendancePagination(page, totalPages) {
    const container = document.getElementById('att-pagination');
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    // Build page number buttons — show at most 5 around current page
    const delta   = 2;
    const rangeStart = Math.max(1, page - delta);
    const rangeEnd   = Math.min(totalPages, page + delta);

    let pages = '';

    if (rangeStart > 1) {
        pages += paginationBtn(1, page, '1');
        if (rangeStart > 2) pages += `<li class="page-item disabled"><span class="page-link">…</span></li>`;
    }
    for (let i = rangeStart; i <= rangeEnd; i++) {
        pages += paginationBtn(i, page, String(i));
    }
    if (rangeEnd < totalPages) {
        if (rangeEnd < totalPages - 1) pages += `<li class="page-item disabled"><span class="page-link">…</span></li>`;
        pages += paginationBtn(totalPages, page, String(totalPages));
    }

    container.innerHTML = `
        <ul class="pagination mb-0">
            <li class="page-item ${page <= 1 ? 'disabled' : ''}">
                <button class="page-link js-att-page" data-page="${page - 1}" aria-label="Previous">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 6l-6 6l6 6" /></svg>
                </button>
            </li>
            ${pages}
            <li class="page-item ${page >= totalPages ? 'disabled' : ''}">
                <button class="page-link js-att-page" data-page="${page + 1}" aria-label="Next">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 6l6 6l-6 6" /></svg>
                </button>
            </li>
        </ul>`;
}

function attStatusBadge(status) {
    const map = {
        'Tepat Waktu': 'bg-success text-white',
        'Terlambat':   'bg-warning text-white',
        'Pulang Awal': 'bg-danger text-white',
        'Tidak Hadir': 'bg-secondary text-white',
        'Cuti':        'bg-info text-white',
        'Izin':        'bg-primary text-white',
        'Sakit':       'bg-warning text-white',
        'Libur':       'bg-secondary text-white',
        'Day Off':     'bg-danger text-white',
        'Holiday':     'bg-warning text-white'
    };
    const labelMap = {
        'Tepat Waktu': t('onTime'),
        'Terlambat':   t('late'),
        'Pulang Awal': t('absent'),
        'Tidak Hadir': t('notPresent'),
        'Cuti':        t('annualLeave'),
        'Izin':        t('permission'),
        'Sakit':       t('sickLeave'),
        'Libur':       t('holiday'),
        'Day Off':     t('employeeDashboard.dayOff'),
        'Holiday':     t('scheduleManagement.holiday')
    };
    if (!status) return '<span class="text-muted">—</span>';
    const cls   = map[status]   || 'bg-secondary text-white';
    const label = labelMap[status] || escHtml(status);
    return `<span class="badge ${cls}">${label}</span>`;
}

function paginationBtn(pageNum, currentPage, label) {
    const active = pageNum === currentPage ? 'active' : '';
    return `<li class="page-item ${active}">
        <button class="page-link js-att-page" data-page="${pageNum}">${label}</button>
    </li>`;
}

function renderManualAttendanceView() {
    // Populate employee dropdowns (filter bar + modal)
    const filterEmpSel = document.getElementById('manual-att-filter-employee');
    const modalEmpSel  = document.getElementById('manual-att-employee');
    const employees    = state.manualAttEmployees.length
        ? state.manualAttEmployees
        : state.adminManagement.employees.map(e => ({ id: e.id, name: e.name }));

    if (filterEmpSel && filterEmpSel.options.length <= 1 && employees.length > 0) {
        filterEmpSel.innerHTML = '<option value="">All Employees</option>' +
            employees.map(e => `<option value="${escHtml(e.id)}">${escHtml(e.name)} (${escHtml(e.id)})</option>`).join('');
    }
    if (modalEmpSel && modalEmpSel.options.length <= 1 && employees.length > 0) {
        modalEmpSel.innerHTML = '<option value="">— Select Employee —</option>' +
            employees.map(e => `<option value="${escHtml(e.id)}">${escHtml(e.name)} (${escHtml(e.id)})</option>`).join('');
    }

    // Load button state
    const loadSpinner = document.getElementById('manual-att-load-spinner');
    const loadIcon    = document.getElementById('manual-att-load-icon');
    const loadBtn     = document.getElementById('btn-load-manual-att');
    if (loadSpinner) loadSpinner.style.display = state.manualAttLoading ? 'inline-block' : 'none';
    if (loadIcon)    loadIcon.style.display    = state.manualAttLoading ? 'none' : 'inline-block';
    if (loadBtn)     loadBtn.disabled          = state.manualAttLoading;

    // Sync page size
    const pageSizeEl = document.getElementById('manual-att-page-size');
    if (pageSizeEl && parseInt(pageSizeEl.value, 10) !== state.manualAttPageSize) {
        pageSizeEl.value = String(state.manualAttPageSize);
    }

    // Modal overlay
    const modalOverlay = document.getElementById('manual-att-modal-overlay');
    if (modalOverlay) modalOverlay.style.display = state.manualAttModalOpen ? 'flex' : 'none';

    // Table
    const table = document.getElementById('manual-att-table');
    if (!table) return;

    if (state.manualAttLoading) {
        table.innerHTML = [1,2,3,4,5].map(() =>
            `<tr><td colspan="9"><div class="placeholder-glow"><span class="placeholder col-12 rounded"></span></div></td></tr>`
        ).join('');
        renderManualAttPagination(0, 0);
        return;
    }

    if (!state.manualAttLoaded) {
        if (state.manualAttError) {
            table.innerHTML = `<tr><td colspan="9" class="text-center py-5">
                <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler mb-2 d-block mx-auto text-danger" width="40" height="40" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" /><path d="M12 16h.01" /></svg>
                <p class="text-danger fw-semibold mb-1">Failed to load records</p>
                <p class="text-muted small mb-3">${escHtml(state.manualAttError)}</p>
            </td></tr>`;
        } else {
            table.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-5">
                <div class="spinner-border text-primary mb-3" role="status"></div>
                <p class="mb-0">Loading attendance records automatically...</p>
                <p class="text-muted small">Setting default date range to current month.</p>
            </td></tr>`;
        }
        renderManualAttPagination(0, 0);
        return;
    }

    // Apply search filter
    const searchTerm = (state.manualAttSearch || '').toLowerCase().trim();
    const filtered = state.manualAttRecords.filter(r => {
        if (!searchTerm) return true;
        return r.employeeId.toLowerCase().includes(searchTerm) ||
               r.employeeName.toLowerCase().includes(searchTerm) ||
               r.position.toLowerCase().includes(searchTerm) ||
               r.checkInStatus.toLowerCase().includes(searchTerm);
    });

    const total      = filtered.length;
    const pageSize   = state.manualAttPageSize;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page       = Math.min(state.manualAttPage, totalPages);
    const start      = (page - 1) * pageSize;
    const end        = Math.min(start + pageSize, total);
    const pageSlice  = filtered.slice(start, end);

    const countEl = document.getElementById('manual-att-result-count');
    if (countEl) {
        countEl.textContent = total > 0
            ? `Showing ${start + 1}–${end} of ${total} record${total !== 1 ? 's' : ''}`
            : '';
    }

    if (total === 0) {
        table.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-5">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler mb-2 d-block mx-auto text-muted" width="40" height="40" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 9h.01" /><path d="M11 12h1v4h1" /><path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9 -9 9s-9 -1.8 -9 -9s1.8 -9 9 -9z" /></svg>
            No attendance records found for this period.
        </td></tr>`;
        renderManualAttPagination(0, 0);
        return;
    }

    table.innerHTML = pageSlice.map((r, idx) => {
        const rowNum = start + idx + 1;
        const inBadge  = manualAttStatusBadge(r.checkInStatus);
        const outBadge = r.checkOutStatus ? manualAttStatusBadge(r.checkOutStatus) : '<span class="text-muted">—</span>';
        return `<tr>
            <td class="text-muted">${rowNum}</td>
            <td class="fw-medium">${escHtml(r.date)}</td>
            <td>
                <div class="fw-semibold">${escHtml(r.employeeName)}</div>
                <div class="text-muted small">${escHtml(r.employeeId)}</div>
            </td>
            <td>${escHtml(r.position)}</td>
            <td>${r.checkInTime ? `<span class="fw-medium">${escHtml(r.checkInTime)}</span>` : '<span class="text-muted">—</span>'}</td>
            <td>${inBadge}</td>
            <td>${r.checkOutTime ? `<span class="fw-medium">${escHtml(r.checkOutTime)}</span>` : '<span class="text-muted">—</span>'}</td>
            <td>${outBadge}</td>
            <td>
                <button class="btn btn-icon btn-sm btn-ghost-primary js-edit-manual-att"
                    data-employee-id="${escHtml(r.employeeId)}"
                    data-date="${escHtml(r.date)}"
                    aria-label="Edit record">${iconEdit()}</button>
                <button class="btn btn-icon btn-sm btn-ghost-danger js-delete-manual-att"
                    data-employee-id="${escHtml(r.employeeId)}"
                    data-date="${escHtml(r.date)}"
                    data-name="${escHtml(r.employeeName)}"
                    aria-label="Delete record">${iconDelete()}</button>
            </td>
        </tr>`;
    }).join('');

    renderManualAttPagination(page, totalPages);
}

function manualAttStatusBadge(status) {
    const map = {
        'Tepat Waktu': 'bg-success text-white',
        'Terlambat':   'bg-warning text-white',
        'Pulang Awal': 'bg-danger text-white',
        'Tidak Hadir': 'bg-secondary text-white',
        'Izin':        'bg-azure text-white',
        'Sakit':       'bg-purple text-white',
        'Cuti':        'bg-teal text-white',
        'Libur':       'bg-secondary text-white',
        'Day Off':     'bg-danger text-white',
        'Holiday':     'bg-warning text-white'
    };
    const labelMap = {
        'Tepat Waktu': t('onTime'),
        'Terlambat':   t('late'),
        'Pulang Awal': t('absent'),
        'Tidak Hadir': t('notPresent'),
        'Izin':        t('permission'),
        'Sakit':       t('sickLeave'),
        'Cuti':        t('annualLeave'),
        'Libur':       t('holiday'),
        'Day Off':     t('employeeDashboard.dayOff'),
        'Holiday':     t('scheduleManagement.holiday')
    };
    if (!status) return '<span class="text-muted">—</span>';
    const cls   = map[status]      || 'bg-secondary text-white';
    const label = labelMap[status] || escHtml(status);
    return `<span class="badge ${cls}">${label}</span>`;
}

function renderManualAttPagination(page, totalPages) {
    const container = document.getElementById('manual-att-pagination');
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    const delta = 2;
    const rangeStart = Math.max(1, page - delta);
    const rangeEnd   = Math.min(totalPages, page + delta);
    let pages = '';

    if (rangeStart > 1) {
        pages += manualAttPageBtn(1, page, '1');
        if (rangeStart > 2) pages += `<li class="page-item disabled"><span class="page-link">…</span></li>`;
    }
    for (let i = rangeStart; i <= rangeEnd; i++) pages += manualAttPageBtn(i, page, String(i));
    if (rangeEnd < totalPages) {
        if (rangeEnd < totalPages - 1) pages += `<li class="page-item disabled"><span class="page-link">…</span></li>`;
        pages += manualAttPageBtn(totalPages, page, String(totalPages));
    }

    container.innerHTML = `
        <ul class="pagination mb-0">
            <li class="page-item ${page <= 1 ? 'disabled' : ''}">
                <button class="page-link js-manual-att-page" data-page="${page - 1}" aria-label="Previous">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 6l-6 6l6 6" /></svg>
                </button>
            </li>
            ${pages}
            <li class="page-item ${page >= totalPages ? 'disabled' : ''}">
                <button class="page-link js-manual-att-page" data-page="${page + 1}" aria-label="Next">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 6l6 6l-6 6" /></svg>
                </button>
            </li>
        </ul>`;
}

function manualAttPageBtn(pageNum, currentPage, label) {
    const active = pageNum === currentPage ? 'active' : '';
    return `<li class="page-item ${active}">
        <button class="page-link js-manual-att-page" data-page="${pageNum}">${label}</button>
    </li>`;
}

function renderManualAttModal() {
    const overlay = document.getElementById('manual-att-modal-overlay');
    if (!overlay) return;
    overlay.style.display = state.manualAttModalOpen ? 'flex' : 'none';
    if (!state.manualAttModalOpen) return;

    const titleEl   = document.getElementById('manual-att-modal-title');
    const saveBtn   = document.getElementById('btn-save-manual-att');
    const spinner   = document.getElementById('manual-att-save-spinner');
    const saveText  = document.getElementById('manual-att-save-text');
    const alertEl   = document.getElementById('manual-att-modal-alert');

    if (titleEl)  titleEl.textContent  = state.manualAttEditRecord ? 'Edit Attendance Record' : 'Add Manual Attendance';
    if (spinner)  spinner.style.display = state.manualAttModalLoading ? 'inline-block' : 'none';
    if (saveText) saveText.textContent  = state.manualAttModalLoading ? 'Saving…' : 'Save Record';
    if (saveBtn)  saveBtn.disabled      = state.manualAttModalLoading;
    if (alertEl)  alertEl.style.display = 'none';

    // Populate employee dropdown
    const empSel   = document.getElementById('manual-att-employee');
    const employees = state.manualAttEmployees.length
        ? state.manualAttEmployees
        : state.adminManagement.employees.map(e => ({ id: e.id, name: e.name }));
    if (empSel) {
        empSel.innerHTML = '<option value="">— Select Employee —</option>' +
            employees.map(e => `<option value="${escHtml(e.id)}">${escHtml(e.name)} (${escHtml(e.id)})</option>`).join('');
    }

    // Pre-fill form if editing
    const rec = state.manualAttEditRecord;
    if (rec) {
        if (empSel) { empSel.value = rec.employeeId; empSel.disabled = true; }
        const dateEl = document.getElementById('manual-att-date');
        if (dateEl) { dateEl.value = rec.date; dateEl.disabled = true; }
        const reasonEl = document.getElementById('manual-att-reason');
        if (reasonEl) reasonEl.value = rec.checkInStatus || 'Izin';
        const ciEl = document.getElementById('manual-att-checkin-time');
        if (ciEl) ciEl.value = rec.checkInTime ? rec.checkInTime.substring(0, 5) : '';
        const coEl = document.getElementById('manual-att-checkout-time');
        if (coEl) coEl.value = rec.checkOutTime ? rec.checkOutTime.substring(0, 5) : '';
        const coStatusEl = document.getElementById('manual-att-checkout-status');
        if (coStatusEl) coStatusEl.value = rec.checkOutStatus || '';
    } else {
        if (empSel) { empSel.value = ''; empSel.disabled = false; }
        const dateEl = document.getElementById('manual-att-date');
        if (dateEl) { dateEl.value = new Date().toISOString().slice(0, 10); dateEl.disabled = false; }
        const reasonEl = document.getElementById('manual-att-reason');
        if (reasonEl) reasonEl.value = 'Izin';
        const ciEl = document.getElementById('manual-att-checkin-time');
        if (ciEl) ciEl.value = '';
        const coEl = document.getElementById('manual-att-checkout-time');
        if (coEl) coEl.value = '';
        const coStatusEl = document.getElementById('manual-att-checkout-status');
        if (coStatusEl) coStatusEl.value = '';
    }
}

function renderModal() {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;
    overlay.style.display = state.formType ? 'flex' : 'none';
    if (!state.formType) return;

    const titleEl = document.getElementById('modal-title');
    if (titleEl) titleEl.textContent = (state.isNewRecord ? 'Add New ' : 'Edit ') + state.formType;

    ['user', 'shift', 'position'].forEach(t => {
        const el = document.getElementById(`form-${t}`);
        if (el) el.style.display = state.formType === t ? 'block' : 'none';
    });

    const saveSpinner = document.getElementById('save-spinner');
    if (saveSpinner) saveSpinner.style.display = state.loading ? 'inline-block' : 'none';

    if (state.formType === 'user') {
        const photoPreview = document.getElementById('user-photo-preview');
        photoPreview.src = state.formData.photo_url || svgAvatar(100);
        photoPreview.onerror = function() { this.src = svgAvatar(100); this.onerror = null; };
        document.getElementById('user-id').value = state.formData.id || '';
        document.getElementById('user-id').disabled = !state.isNewRecord;
        document.getElementById('user-name').value = state.formData.name || '';
        document.getElementById('user-password').value = state.formData.password || '';
        document.getElementById('user-role').value = state.formData.role || 'Employee';

        const shiftSel = document.getElementById('user-shift');
        if (shiftSel) shiftSel.innerHTML = state.adminManagement.shifts.map(s =>
            `<option value="${escHtml(s.id)}" ${state.formData.shift_id === s.id ? 'selected' : ''}>${escHtml(formatTimeStr(s.start_time))}–${escHtml(formatTimeStr(s.end_time))}</option>`
        ).join('');

        const posSel = document.getElementById('user-position');
        if (posSel) posSel.innerHTML = state.adminManagement.positions.map(p =>
            `<option value="${p.id}" ${state.formData.jabatan_id === p.id ? 'selected' : ''}>${p.name}</option>`
        ).join('');
    } else if (state.formType === 'shift') {
        document.getElementById('shift-id').value = state.formData.id || '';
        document.getElementById('shift-id').disabled = !state.isNewRecord;
        document.getElementById('shift-start').value = state.formData.start_time || '08:00';
        document.getElementById('shift-end').value = state.formData.end_time || '17:00';
    } else if (state.formType === 'position') {
        document.getElementById('position-id').value = state.formData.id || '';
        document.getElementById('position-id').disabled = !state.isNewRecord;
        document.getElementById('position-name').value = state.formData.name || '';
    }
}

function renderQrCodesView() {
    const loadingEl = document.getElementById('qr-loading');
    const emptyEl   = document.getElementById('qr-empty');
    const gridEl    = document.getElementById('qr-grid');
    const countEl   = document.getElementById('qr-result-count');

    if (!loadingEl || !emptyEl || !gridEl) return;

    if (state.qrGenerating) {
        loadingEl.style.display = 'block';
        emptyEl.style.display   = 'none';
        gridEl.style.display    = 'none';
        return;
    }

    if (!state.qrGenerated) {
        loadingEl.style.display = 'none';
        emptyEl.style.display   = 'block';
        gridEl.style.display    = 'none';
        if (countEl) countEl.textContent = '';
        return;
    }

    loadingEl.style.display = 'none';
    emptyEl.style.display   = 'none';
    gridEl.style.display    = 'flex';

    const searchTerm = (state.qrSearch || '').toLowerCase().trim();
    const employees  = state.adminManagement.employees || [];
    const filtered   = employees.filter(e =>
        !searchTerm ||
        e.id.toLowerCase().includes(searchTerm) ||
        e.name.toLowerCase().includes(searchTerm)
    );

    if (countEl) {
        countEl.textContent = filtered.length > 0
            ? `${filtered.length} employee${filtered.length !== 1 ? 's' : ''}`
            : '';
    }

    if (filtered.length === 0) {
        gridEl.innerHTML = `<div class="col-12 text-center text-muted py-4">No employees match your search.</div>`;
        return;
    }

    gridEl.innerHTML = filtered.map(emp => `
        <div class="col-6 col-sm-4 col-md-3 col-lg-2">
            <div class="card premium-card text-center h-100">
                <div class="card-body p-3">
                    <canvas id="qr-canvas-${escHtml(emp.id)}" class="d-block mx-auto mb-2" style="max-width: 120px; width: 100%;"></canvas>
                    <div class="fw-semibold small text-truncate" title="${escHtml(emp.name)}">${escHtml(emp.name)}</div>
                    <div class="text-muted small mb-2">${escHtml(emp.id)}</div>
                    <div class="d-flex gap-1 justify-content-center flex-wrap">
                        <button class="btn btn-sm btn-outline-primary js-qr-download"
                            data-id="${escHtml(emp.id)}"
                            data-name="${escHtml(emp.name)}"
                            title="Download QR Code">
                            <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
                        </button>
                        <button class="btn btn-sm btn-outline-success js-qr-save"
                            data-id="${escHtml(emp.id)}"
                            data-name="${escHtml(emp.name)}"
                            title="Save QR to Database">
                            <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /><path d="M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M14 4l0 4l-6 0l0 -4" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>`).join('');

    // Draw QR codes on canvases after DOM update
    setTimeout(() => {
        filtered.forEach(emp => {
            const canvas = document.getElementById(`qr-canvas-${emp.id}`);
            if (canvas) {
                QRCode.toCanvas(canvas, emp.id, {
                    width: 120,
                    margin: 1,
                    color: { dark: '#000000', light: '#ffffff' }
                }, (err) => {
                    if (err) console.error('QR generation error for', emp.id, err);
                });
            }
        });
    }, 50);
}

// Master render — calls all targeted renderers.
function render() {
    renderDataError();
    renderAlerts();
    renderConfirmDialog();
    renderEmployeeView();
    renderAdminView();
    renderModal();
    renderManualAttModal();
};

// --- SVG helpers (extracted to avoid repetition in table rows) ---
function svgAvatar(size) {
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'%3E%3Crect width='${size}' height='${size}' fill='%23e2e8f0'/%3E%3Ccircle cx='${size/2}' cy='${size*0.4}' r='${size*0.22}' fill='%2394a3b8'/%3E%3Cellipse cx='${size/2}' cy='${size*0.9}' rx='${size*0.35}' ry='${size*0.26}' fill='%2394a3b8'/%3E%3C/svg%3E`;
}

function iconEdit() {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /></svg>`;
}

function iconDelete() {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>`;
}

// --- Logic ---

const init = () => {
    if (state.token && state.user) {
        loadView(state.user.role === 'Admin' ? 'admin' : 'employee');
    } else {
        loadView('login');
    }
};

const doLogin = async (e) => {
    if (e) e.preventDefault();
    setState({ loading: true, errorMessage: '' });
    
    // Update login button state
    const btn = document.getElementById('login-submit-btn');
    const spinner = document.getElementById('login-spinner');
    const btnText = document.getElementById('login-btn-text');
    if (btn) btn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    if (btnText) btnText.textContent = t('common.processing');

    const employeeId = document.getElementById('login-employee-id').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await callGas('login', employeeId, password);
        if (res && res.status === 'success') {
            localStorage.setItem('absen_token', res.data.token);
            localStorage.setItem('absen_user', JSON.stringify(res.data.user));
            setState({ token: res.data.token, user: res.data.user });
            loadView(res.data.user.role === 'Admin' ? 'admin' : 'employee');
        } else {
            setState({ loading: false, errorMessage: res ? res.message : t('login.invalidCredentials') });
            if (btn) btn.disabled = false;
            if (spinner) spinner.style.display = 'none';
            if (btnText) btnText.textContent = t('login.signIn');
        }
    } catch {
        setState({ loading: false, errorMessage: t('login.errorDuringLogin') + ' ' + t('common.connectionError') });
        if (btn) btn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (btnText) btnText.textContent = t('login.signIn');
    }
};

const logout = () => {
    localStorage.removeItem('absen_token');
    localStorage.removeItem('absen_user');
    setState({ token: null, user: null });
    loadView('login');
};

const loadEmployeeData = async (showPageSpinner = true) => {
    if (showPageSpinner) setState({ dataLoaded: false, dataError: '' });
    try {
        // Fetch history and geofence settings in parallel
        const [histRes, geoRes] = await Promise.all([
            callGas('getMyHistory', state.token),
            callGas('getGeofenceSettings', state.token)
        ]);

        const updates = {};

        if (histRes && histRes.status === 'success') {
            updates.attendanceHistory = histRes.data;
            updates.dataLoaded = true;
            updates.dataError = '';
        } else {
            const msg = histRes?.message || 'Failed to load attendance data.';
            updates.dataLoaded = true;
            if (showPageSpinner) {
                updates.dataError = msg;
            } else {
                updates.errorMessage = msg;
            }
        }

        if (geoRes && geoRes.status === 'success') {
            const gd = geoRes.data;
            updates.geofenceEnabled  = gd.enabled || false;
            updates.geofenceRadius   = gd.radius   || null;
            updates.geofenceWorkLat  = gd.latitude  !== null && gd.latitude  !== undefined ? gd.latitude  : null;
            updates.geofenceWorkLng  = gd.longitude !== null && gd.longitude !== undefined ? gd.longitude : null;
        }

        setState(updates);

        // Always attempt to acquire location if office coordinates are available, 
        // even if enforcement (geofenceEnabled) is currently off.
        if (state.geofenceWorkLat && state.geofenceWorkLng) {
            startLocationAcquisition();
        } else {
            setState({ locationStatus: 'disabled', locationPayload: null });
        }
    } catch {
        setState({
            dataLoaded: true,
            dataError: showPageSpinner ? 'Failed to load data. Check your connection.' : '',
            errorMessage: showPageSpinner ? '' : 'Failed to reload data.'
        });
    }
};

const startLocationAcquisition = async () => {
    setState({ locationStatus: 'acquiring', locationPayload: null, locationDistance: null, locationErrorMessage: '' });
    try {
        const { GeolocationService, haversineDistance } = await import('./utils/GeolocationService.js');
        const coords = await GeolocationService.getCurrentPosition(10000);

        if (coords.accuracy > 200) {
            setState({
                locationStatus: 'error',
                locationPayload: coords,
                locationErrorMessage: `GPS accuracy is insufficient (${Math.round(coords.accuracy)}m). Please move to an open area and try again.`
            });
            return;
        }

        // Compute client-side distance for UX (server is authoritative)
        let distance = null;
        let status = 'error'; // Default to error if geofence is enabled but coords missing
        if (state.geofenceWorkLat !== null && state.geofenceWorkLng !== null && state.geofenceRadius !== null) {
            distance = Math.round(haversineDistance(state.geofenceWorkLat, state.geofenceWorkLng, coords.latitude, coords.longitude));
            status = distance <= state.geofenceRadius ? 'within' : 'outside';
        } else {
            status = 'error';
            setState({ locationErrorMessage: 'Work location not configured. Please contact administrator.' });
        }

        setState({
            locationStatus: status,
            locationPayload: coords,
            locationDistance: distance,
            locationErrorMessage: ''
        });
    } catch (errMsg) {
        // Translate GeolocationService error messages
        let translatedError = 'Unable to determine your location.';
        if (typeof errMsg === 'string') {
            if (errMsg.includes('Location services not supported')) {
                translatedError = t('locationServicesNotSupported');
            } else if (errMsg.includes('Location permission denied')) {
                translatedError = t('locationPermissionDenied');
            } else if (errMsg.includes('Unable to determine your location')) {
                translatedError = t('unableToDetermineLocation');
            } else if (errMsg.includes('Location request timed out')) {
                translatedError = t('locationRequestTimeout');
            } else {
                translatedError = errMsg;
            }
        }
        
        setState({
            locationStatus: 'error',
            locationPayload: null,
            locationErrorMessage: translatedError
        });
    }
};

const doCheckIn = async () => {
    if (state.geofenceEnabled && state.locationStatus !== 'within') {
        setState({ errorMessage: state.locationErrorMessage || 'You must be within the allowed work zone to check in.' });
        return;
    }
    if (state.geofenceEnabled && !state.locationPayload) {
        setState({ errorMessage: 'Location data is required for check-in. Please wait for GPS or refresh.' });
        return;
    }

    setState({ checkInLoading: true, successMessage: '', errorMessage: '' });
    try {
        const res = await callGas('checkIn', state.token, state.locationPayload || undefined);
        if (res && res.status === 'success') {
            setState({ checkInLoading: false, successMessage: t('employeeDashboard.checkedInSuccessfully') + ' ' + res.data.time });
            loadEmployeeData(false);
        } else {
            setState({ checkInLoading: false, errorMessage: res?.message || t('employeeDashboard.checkInFailed') });
        }
    } catch {
        setState({ checkInLoading: false, errorMessage: t('employeeDashboard.connectionError') });
    }
};

const doCheckOut = async () => {
    if (state.geofenceEnabled && state.locationStatus !== 'within') {
        setState({ errorMessage: state.locationErrorMessage || 'You must be within the allowed work zone to check out.' });
        return;
    }
    if (state.geofenceEnabled && !state.locationPayload) {
        setState({ errorMessage: 'Location data is required for check-out. Please wait for GPS or refresh.' });
        return;
    }

    setState({ checkOutLoading: true, successMessage: '', errorMessage: '' });
    try {
        const res = await callGas('checkOut', state.token, state.locationPayload || undefined);
        if (res && res.status === 'success') {
            setState({ checkOutLoading: false, successMessage: t('employeeDashboard.checkedOutSuccessfully') + ' ' + res.data.time });
            loadEmployeeData(false);
        } else {
            setState({ checkOutLoading: false, errorMessage: res?.message || t('employeeDashboard.checkOutFailed') });
        }
    } catch {
        setState({ checkOutLoading: false, errorMessage: t('employeeDashboard.connectionError') });
    }
};

// --- Open Standalone Scanner Page ---
// Opens the QR scanner page in a new tab where camera access works
// (GAS serves the main app in an iframe that blocks getUserMedia)

const openScannerPage = () => {
    const btn = document.getElementById('btn-open-scanner-tab');
    const originalContent = btn ? btn.innerHTML : '';
    
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Loading...`;
    }

    const resetBtn = () => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    };

    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler((url) => {
                resetBtn();
                if (url) {
                    const baseUrl = url.split('?')[0].split('#')[0];
                    const scannerUrl = baseUrl + '?page=scanner';
                    window.open(scannerUrl, '_blank');
                }
            })
            .withFailureHandler(() => {
                resetBtn();
                setState({ errorMessage: 'Failed to get scanner URL. Please try again.' });
            })
            .getScriptUrl();
    } else {
        // Fallback for dev/mock mode
        resetBtn();
        window.open('?page=scanner', '_blank');
    }
};

function initScannerButton() {
    const btn = document.getElementById('btn-open-scanner-tab');
    if (btn) btn.addEventListener('click', openScannerPage);
}

// --- Admin ---

const loadAdminData = async (showPageSpinner = true) => {
    setState({ loading: true, dataError: '', ...(showPageSpinner && { dataLoaded: false }) });
    try {
        const [dashRes, settingsRes] = await Promise.all([
            callGas('getDashboardData', state.token),
            callGas('getSystemSettings', state.token)
        ]);

        if (dashRes && dashRes.status === 'success') {
            const updates = {
                adminStats: dashRes.data.stats,
                adminRecap: dashRes.data.recap,
                adminMonthlyTrend: dashRes.data.monthlyTrend || [],
                loading: false,
                dataLoaded: true,
                dataError: ''
            };

            if (settingsRes && settingsRes.status === 'success') {
                updates.organizationName = settingsRes.data.organizationName || '';
            }

            setState(updates);
            // Load shifts and positions immediately for dashboard (needed for user forms)
            loadManagementData();
        } else {
            const msg = dashRes?.message || 'Failed to load dashboard data.';
            setState({ loading: false, dataLoaded: true, dataError: showPageSpinner ? msg : '', errorMessage: showPageSpinner ? '' : msg });
        }
    } catch (error) {
        console.error('Error loading admin data:', error);
        setState({ loading: false, dataLoaded: true, dataError: showPageSpinner ? 'Failed to load administrative data. Check your connection.' : '', errorMessage: showPageSpinner ? '' : 'Failed to reload data.' });
    }
};

const loadManagementData = async () => {
    if (state.managementLoaded || state.managementLoading) return;
    setState({ managementLoading: true });
    try {
        const res = await callGas('getAdminInitialData', state.token);
        if (res && res.status === 'success') {
            setState({
                adminManagement: res.data,
                managementLoaded: true,
                managementLoading: false,
                logsLoaded: true  // logs are included in getAdminInitialData
            });
        } else {
            setState({ managementLoading: false, errorMessage: res?.message || 'Failed to load management data.' });
        }
    } catch {
        setState({ managementLoading: false, errorMessage: 'Connection error while loading management data.' });
    }
};

const loadDailyAttendance = async (startDate, endDate) => {
    setState({ dailyAttendanceLoading: true, dailyAttendanceLoaded: false, dailyAttendanceError: '' });
    try {
        let res;
        if (startDate && endDate && startDate !== endDate) {
            res = await callGas('getDailyAttendanceRange', state.token, startDate, endDate);
        } else {
            const dateStr = startDate || new Date().toISOString().slice(0, 10);
            res = await callGas('getDailyAttendance', state.token, dateStr);
        }
        if (res && res.status === 'success' && res.data) {
            setState({
                dailyAttendance: res.data,
                dailyAttendanceLoading: false,
                dailyAttendanceLoaded: true
            });
        } else {
            setState({
                dailyAttendanceLoading: false,
                dailyAttendanceLoaded: false,
                dailyAttendanceError: res?.message || 'Failed to load attendance data.'
            });
        }
    } catch (err) {
        // err from withFailureHandler is a plain object with a .message property
        const msg = (err && (err.message || err.toString())) || 'Unknown error';
        setState({
            dailyAttendanceLoading: false,
            dailyAttendanceLoaded: false,
            dailyAttendanceError: msg
        });
    }
};

// --- Manual Attendance ---

const loadManualAttendanceRecords = async () => {
    const startEl = document.getElementById('manual-att-filter-start');
    const endEl   = document.getElementById('manual-att-filter-end');
    const empEl   = document.getElementById('manual-att-filter-employee');

    const startDate  = startEl ? startEl.value : '';
    const endDate    = endEl   ? endEl.value   : '';
    const employeeId = empEl   ? empEl.value   : '';

    if (!startDate || !endDate) {
        setState({ manualAttError: 'Please select a start and end date.', manualAttLoaded: false });
        return;
    }

    setState({ manualAttLoading: true, manualAttLoaded: false, manualAttError: '', manualAttPage: 1 });
    try {
        const res = await callGas('getManualAttendanceRecords', state.token, employeeId, startDate, endDate);
        if (res && res.status === 'success' && res.data) {
            setState({
                manualAttRecords:   res.data.records || [],
                manualAttEmployees: res.data.employees || [],
                manualAttLoading:   false,
                manualAttLoaded:    true,
                manualAttError:     ''
            });
        } else {
            setState({
                manualAttLoading: false,
                manualAttLoaded:  false,
                manualAttError:   res?.message || 'Failed to load records.'
            });
        }
    } catch (err) {
        const msg = (err && (err.message || err.toString())) || 'Unknown error';
        setState({ manualAttLoading: false, manualAttLoaded: false, manualAttError: msg });
    }
};

const openManualAttModal = (record = null) => {
    setState({ manualAttModalOpen: true, manualAttEditRecord: record, manualAttModalLoading: false });
};

const closeManualAttModal = () => {
    setState({ manualAttModalOpen: false, manualAttEditRecord: null, manualAttModalLoading: false });
};

const saveManualAttendance = async () => {
    const empEl      = document.getElementById('manual-att-employee');
    const dateEl     = document.getElementById('manual-att-date');
    const reasonEl   = document.getElementById('manual-att-reason');
    const ciTimeEl   = document.getElementById('manual-att-checkin-time');
    const coTimeEl   = document.getElementById('manual-att-checkout-time');
    const coStatusEl = document.getElementById('manual-att-checkout-status');
    const alertEl    = document.getElementById('manual-att-modal-alert');

    const employeeId      = empEl      ? empEl.value      : '';
    const date            = dateEl     ? dateEl.value     : '';
    const checkInStatus   = reasonEl   ? reasonEl.value   : '';
    const checkInTime     = ciTimeEl   ? ciTimeEl.value   : '';
    const checkOutTime    = coTimeEl   ? coTimeEl.value   : '';
    const checkOutStatus  = coStatusEl ? coStatusEl.value : '';

    // Client-side validation
    const showModalAlert = (msg, type = 'danger') => {
        if (alertEl) {
            alertEl.className = `alert alert-${type}`;
            alertEl.textContent = msg;
            alertEl.style.display = 'block';
        }
    };

    if (!employeeId) { showModalAlert('Please select an employee.'); return; }
    if (!date)       { showModalAlert('Please select a date.'); return; }
    if (!checkInStatus) { showModalAlert('Please select a reason/status.'); return; }

    setState({ manualAttModalLoading: true });
    try {
        const res = await callGas('saveManualAttendance', state.token, {
            employeeId,
            date,
            checkInTime:    checkInTime   || '',
            checkInStatus,
            checkOutTime:   checkOutTime  || '',
            checkOutStatus: checkOutStatus || ''
        });

        if (res && res.status === 'success') {
            setState({
                manualAttModalLoading: false,
                manualAttModalOpen:    false,
                manualAttEditRecord:   null,
                successMessage:        res.message || 'Attendance record saved.',
                // Reload records to reflect the change
                manualAttLoaded:       false
            });
            loadManualAttendanceRecords();
        } else {
            setState({ manualAttModalLoading: false });
            showModalAlert(res?.message || 'Failed to save record.');
        }
    } catch (err) {
        setState({ manualAttModalLoading: false });
        const msg = (err && (err.message || err.toString())) || 'Connection error.';
        showModalAlert(msg);
    }
};

const deleteManualAttendance = async (employeeId, date, employeeName) => {
    showConfirm(
        `Delete attendance record for "${employeeName}" on ${date}? This cannot be undone.`,
        async () => {
            setState({ deleteLoading: true });
            try {
                const res = await callGas('deleteManualAttendance', state.token, employeeId, date);
                if (res && res.status === 'success') {
                    const updated = state.manualAttRecords.filter(
                        r => !(r.employeeId === employeeId && r.date === date)
                    );
                    setState({
                        deleteLoading:    false,
                        manualAttRecords: updated,
                        successMessage:   'Attendance record deleted.'
                    });
                } else {
                    setState({ deleteLoading: false, errorMessage: res?.message || 'Delete failed.' });
                }
            } catch {
                setState({ deleteLoading: false, errorMessage: 'Connection error.' });
            }
        }
    );
};

const openUserModal = (id = null) => {
    const user = id ? state.adminManagement.employees.find(u => u.id === id) : null;
    setState({
        formType: 'user',
        isNewRecord: !user,
        formData: user ? { ...user } : { id: '', password: '', name: '', shift_id: '', role: 'Employee', photo_url: '', jabatan_id: '' }
    });
};

const openShiftModal = (id = null) => {
    const shift = id ? state.adminManagement.shifts.find(s => s.id === id) : null;
    setState({
        formType: 'shift',
        isNewRecord: !shift,
        formData: shift ? { ...shift } : { id: '', start_time: '08:00', end_time: '17:00' }
    });
};

const openPositionModal = (id = null) => {
    const pos = id ? state.adminManagement.positions.find(p => p.id === id) : null;
    setState({
        formType: 'position',
        isNewRecord: !pos,
        formData: pos ? { ...pos } : { id: '', name: '' }
    });
};

const saveForm = async () => {
    // Read all form values BEFORE calling setState (which triggers render and resets inputs)
    let formPayload = {};
    if (state.formType === 'user') {
        formPayload = {
            id: document.getElementById('user-id').value,
            name: document.getElementById('user-name').value,
            password: document.getElementById('user-password').value,
            role: document.getElementById('user-role').value,
            shift_id: document.getElementById('user-shift').value,
            jabatan_id: document.getElementById('user-position').value,
            photo_url: state.formData.photo_url,
            isNew: state.isNewRecord
        };
    } else if (state.formType === 'shift') {
        formPayload = {
            id: document.getElementById('shift-id').value,
            start_time: document.getElementById('shift-start').value,
            end_time: document.getElementById('shift-end').value,
            isNew: state.isNewRecord
        };
    } else if (state.formType === 'position') {
        formPayload = {
            id: document.getElementById('position-id').value,
            name: document.getElementById('position-name').value,
            isNew: state.isNewRecord
        };
    }

    setState({ loading: true });
    let res;
    try {
        if (state.formType === 'user') {
            const data = formPayload;
            res = await callGas('saveUser', state.token, data);
            if (res && res.status === 'success') {
                // Update local state — no full reload needed
                const mgmt = { ...state.adminManagement };
                if (state.isNewRecord) {
                    mgmt.employees = [...mgmt.employees, data];
                } else {
                    mgmt.employees = mgmt.employees.map(u => u.id === data.id ? { ...u, ...data } : u);
                }
                setState({ loading: false, formType: '', successMessage: 'Saved successfully!', adminManagement: mgmt });
                return;
            }
        } else if (state.formType === 'shift') {
            const data = formPayload;
            res = await callGas('saveShift', state.token, data);
            if (res && res.status === 'success') {
                const mgmt = { ...state.adminManagement };
                if (state.isNewRecord) {
                    mgmt.shifts = [...mgmt.shifts, data];
                } else {
                    mgmt.shifts = mgmt.shifts.map(s => s.id === data.id ? { ...s, ...data } : s);
                }
                setState({ loading: false, formType: '', successMessage: 'Saved successfully!', adminManagement: mgmt });
                return;
            }
        } else if (state.formType === 'position') {
            const data = formPayload;
            res = await callGas('savePosition', state.token, data);
            if (res && res.status === 'success') {
                const mgmt = { ...state.adminManagement };
                if (state.isNewRecord) {
                    mgmt.positions = [...mgmt.positions, data];
                } else {
                    mgmt.positions = mgmt.positions.map(p => p.id === data.id ? { ...p, ...data } : p);
                }
                setState({ loading: false, formType: '', successMessage: 'Saved successfully!', adminManagement: mgmt });
                return;
            }
        }

        setState({ loading: false, errorMessage: res?.message || 'Error saving.' });
    } catch {
        setState({ loading: false, errorMessage: 'Connection error.' });
    }
};

const deleteUser = async (id) => {
    showConfirm(`Delete user "${id}"? This cannot be undone.`, async () => {
    setState({ deleteLoading: true });
    try {
        const res = await callGas('deleteUser', state.token, id);
        if (res && res.status === 'success') {
            const mgmt = { ...state.adminManagement, employees: state.adminManagement.employees.filter(u => u.id !== id) };
            setState({ deleteLoading: false, adminManagement: mgmt, successMessage: 'User deleted.' });
        } else {
            setState({ deleteLoading: false, errorMessage: res?.message || 'Delete failed.' });
        }
    } catch {
        setState({ deleteLoading: false, errorMessage: 'Connection error.' });
    }
    });
};

const deleteShift = async (id) => {
    showConfirm(`Delete shift "${id}"? This cannot be undone.`, async () => {
    setState({ deleteLoading: true });
    try {
        const res = await callGas('deleteShift', state.token, id);
        if (res && res.status === 'success') {
            const mgmt = { ...state.adminManagement, shifts: state.adminManagement.shifts.filter(s => s.id !== id) };
            setState({ deleteLoading: false, adminManagement: mgmt, successMessage: 'Shift deleted.' });
        } else {
            setState({ deleteLoading: false, errorMessage: res?.message || 'Delete failed.' });
        }
    } catch {
        setState({ deleteLoading: false, errorMessage: 'Connection error.' });
    }
    });
};

const deletePosition = async (id) => {
    showConfirm(`Delete group "${id}"? This cannot be undone.`, async () => {
    setState({ deleteLoading: true });
    try {
        const res = await callGas('deletePosition', state.token, id);
        if (res && res.status === 'success') {
            const mgmt = { ...state.adminManagement, positions: state.adminManagement.positions.filter(p => p.id !== id) };
            setState({ deleteLoading: false, adminManagement: mgmt, successMessage: 'Group deleted.' });
        } else {
            setState({ deleteLoading: false, errorMessage: res?.message || 'Delete failed.' });
        }
    } catch {
        setState({ deleteLoading: false, errorMessage: 'Connection error.' });
    }
    });
};

const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Client-side validation before sending to GAS
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        setState({ errorMessage: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.' });
        e.target.value = '';
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        setState({ errorMessage: 'Image exceeds the 2MB size limit.' });
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
        setState({ loading: true });
        try {
            const res = await callGas('uploadUserPhoto', state.token, ev.target.result, file.name);
            if (res && res.status === 'success') {
                setState({ loading: false, formData: { ...state.formData, photo_url: res.data } });
            } else {
                setState({ loading: false, errorMessage: res?.message || 'Upload failed.' });
            }
        } catch {
            setState({ loading: false, errorMessage: 'Upload failed. Connection error.' });
        }
    };
    reader.readAsDataURL(file);
};

// --- Global utilities ---
// Tabler-styled confirmation dialog
const showConfirm = (message, onConfirm) => {
    setState({ confirmDialog: { visible: true, message, onConfirm } });
};

// Setup language selector dropdowns
// NOTE: Language clicks are handled via delegated listener on document.body below.
// This function is kept for any future direct-attach needs but is no longer the
// primary mechanism — delegated handling survives dynamic HTML re-injection.
function setupLanguageSelectors() {
    // Intentionally empty — language toggle is handled by the delegated
    // click listener on document.body (see "Language Toggle" section below).
    // Calling updateLanguageDisplay here ensures the indicator reflects the
    // persisted language on first load.
    updateLanguageDisplay(getLanguage());
}

// Update language display in UI
function updateLanguageDisplay(lang) {
    // Update language text in all language selectors
    const langTextElements = document.querySelectorAll('[id="current-language-text"]');
    langTextElements.forEach(el => {
        const langName = lang === 'id' ? 'ID' : 'EN';
        el.textContent = langName;
    });
    
    // Update language selector dropdown text
    const langSelectorText = document.getElementById('current-language-text');
    if (langSelectorText) {
        const langName = lang === 'id' ? 'ID' : 'EN';
        langSelectorText.textContent = langName;
    }
    
    // Update all text with data-i18n attributes
    updateAllTranslations();
}

// Update all translations in the DOM
function updateAllTranslations() {
    const lang = getLanguage();
    const t = window.absenT; // Reference to t function
    
    // Helper to extract the actual translation key from namespaced keys
    // e.g., "adminPanel.userManagement" → "userManagement"
    // e.g., "dashboardStats.onTime" → "onTime"
    // e.g., "settings" → "settings" (no namespace)
    const getActualKey = (key) => {
        const parts = key.split('.');
        return parts[parts.length - 1]; // Return the last part (actual key)
    };
    
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const actualKey = getActualKey(key);
        // Try full key first (supports nested like 'profile.myProfile'), fall back to last part
        const translation = t(key) !== key ? t(key) : t(actualKey);
        if (translation && translation !== key && translation !== actualKey) {
            el.textContent = translation;
        }
    });
    
    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const actualKey = getActualKey(key);
        const translation = t(actualKey);
        if (translation && actualKey !== translation) {
            el.placeholder = translation;
        }
    });
    
    // Update labels for form elements
    document.querySelectorAll('[data-i18n-label]').forEach(el => {
        const key = el.getAttribute('data-i18n-label');
        const actualKey = getActualKey(key);
        const translation = t(actualKey);
        if (translation && actualKey !== translation) {
            el.textContent = translation;
        }
    });
    
    // Update titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const actualKey = getActualKey(key);
        const translation = t(actualKey);
        if (translation && actualKey !== translation) {
            el.title = translation;
        }
    });
}

// Helper to get filtered attendance records for export
const getFilteredAttendance = () => {
    if (!state.dailyAttendanceLoaded || !state.dailyAttendance.records) return [];
    const filterStatus = state.attFilterStatus;
    const filterGroup  = state.attFilterGroup;
    const filterShift  = state.attFilterShift;
    const searchTerm = (state.attSearch || '').toLowerCase().trim();

    return state.dailyAttendance.records.filter(r => {
        const matchStatus = !filterStatus ||
            r.checkInStatus === filterStatus ||
            r.checkOutStatus === filterStatus;
        const matchGroup  = !filterGroup  || r.position === filterGroup;
        const matchShift  = !filterShift  || r.shiftId  === filterShift;
        const matchSearch = !searchTerm ||
            r.employeeId.toLowerCase().includes(searchTerm) ||
            r.employeeName.toLowerCase().includes(searchTerm) ||
            r.position.toLowerCase().includes(searchTerm);
        return matchStatus && matchGroup && matchShift && matchSearch;
    });
};

// Export daily attendance records to CSV
const exportAttendanceCsv = () => {
    const filtered = getFilteredAttendance();
    if (filtered.length === 0) {
        setState({ errorMessage: 'No attendance data to export.' });
        return;
    }

    const isRange = !!(state.dailyAttendance && state.dailyAttendance.isRange);
    let filename;
    if (isRange) {
        filename = `attendance_${state.dailyAttendance.startDate}_to_${state.dailyAttendance.endDate}`;
    } else {
        filename = `attendance_${state.dailyAttendance.date || 'export'}`;
    }

    const headers = isRange
        ? ['No', 'Date', 'Employee ID', 'Employee Name', 'Position', 'Shift', 'Shift Start', 'Shift End', 'Check In', 'In Status', 'Check Out', 'Out Status']
        : ['No', 'Employee ID', 'Employee Name', 'Position', 'Shift', 'Shift Start', 'Shift End', 'Check In', 'In Status', 'Check Out', 'Out Status'];

    const rows = filtered.map((r, i) => {
        const base = [
            i + 1,
            r.employeeId,
            r.employeeName,
            r.position,
            r.shiftId,
            r.shiftStart,
            r.shiftEnd,
            r.checkInTime  || '-',
            r.checkInStatus  || '-',
            r.checkOutTime || '-',
            r.checkOutStatus || '-'
        ];
        return isRange ? [i + 1, r.date || '', ...base.slice(1)] : base;
    });

    const rangeLabel = isRange 
        ? `${state.dailyAttendance.startDate} to ${state.dailyAttendance.endDate}`
        : (state.dailyAttendance.date || '');

    const titleRow = [`${state.organizationName || 'Attendance Report'} - ${rangeLabel}`];
    const csvContent = [titleRow, [], headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.style.display = 'none';
    a.href     = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Export daily attendance records to Excel (.xls)
const exportAttendanceExcel = () => {
    const filtered = getFilteredAttendance();
    if (filtered.length === 0) {
        setState({ errorMessage: 'No attendance data to export.' });
        return;
    }

    const isRange = !!(state.dailyAttendance && state.dailyAttendance.isRange);
    const rangeLabel = isRange 
        ? `${state.dailyAttendance.startDate} to ${state.dailyAttendance.endDate}`
        : (state.dailyAttendance.date || '');
    
    let filename;
    if (isRange) {
        filename = `attendance_${state.dailyAttendance.startDate}_to_${state.dailyAttendance.endDate}`;
    } else {
        filename = `attendance_${state.dailyAttendance.date || 'export'}`;
    }

    let html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="UTF-8"><style>table { border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 8px; } th { background-color: #f2f2f2; font-weight: bold; }</style></head>
        <body>
            <h2>${state.organizationName || 'Attendance Report'} - ${rangeLabel}</h2>
            <table>
                <thead>
                    <tr>
                        <th>No</th>
                        ${isRange ? '<th>Date</th>' : ''}
                        <th>Employee ID</th>
                        <th>Employee Name</th>
                        <th>Group</th>
                        <th>Shift</th>
                        <th>Shift Start</th>
                        <th>Shift End</th>
                        <th>Check In</th>
                        <th>In Status</th>
                        <th>Check Out</th>
                        <th>Out Status</th>
                    </tr>
                </thead>
                <tbody>
    `;

    filtered.forEach((r, i) => {
        html += `
            <tr>
                <td>${i + 1}</td>
                ${isRange ? `<td>${r.date || ''}</td>` : ''}
                <td>${escHtml(r.employeeId)}</td>
                <td>${escHtml(r.employeeName)}</td>
                <td>${escHtml(r.position)}</td>
                <td>${escHtml(r.shiftId)}</td>
                <td>${escHtml(r.shiftStart)}</td>
                <td>${escHtml(r.shiftEnd)}</td>
                <td>${escHtml(r.checkInTime || '-')}</td>
                <td>${escHtml(r.checkInStatus || '-')}</td>
                <td>${escHtml(r.checkOutTime || '-')}</td>
                <td>${escHtml(r.checkOutStatus || '-')}</td>
            </tr>
        `;
    });

    html += '</tbody></table></body></html>';

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `${filename}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Print daily attendance records
const printAttendance = () => {
    const filtered = getFilteredAttendance();
    if (filtered.length === 0) {
        setState({ errorMessage: 'No attendance data to print.' });
        return;
    }

    const isRange = !!(state.dailyAttendance && state.dailyAttendance.isRange);
    const rangeLabel = isRange 
        ? `${state.dailyAttendance.startDate} to ${state.dailyAttendance.endDate}`
        : (state.dailyAttendance.date || '');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        setState({ errorMessage: 'Pop-up blocked. Please allow pop-ups to print.' });
        return;
    }

    const rows = filtered.map((r, i) => `
        <tr>
            <td>${i + 1}</td>
            ${isRange ? `<td>${escHtml(r.date || '')}</td>` : ''}
            <td>${escHtml(r.employeeName)}<br><small>${escHtml(r.employeeId)}</small></td>
            <td>${escHtml(r.position)}</td>
            <td>${escHtml(r.shiftId)}<br><small>${escHtml(r.shiftStart)} - ${escHtml(r.shiftEnd)}</small></td>
            <td>${escHtml(r.checkInTime || '-')}</td>
            <td>${escHtml(r.checkInStatus || '-')}</td>
            <td>${escHtml(r.checkOutTime || '-')}</td>
            <td>${escHtml(r.checkOutStatus || '-')}</td>
        </tr>
    `).join('');

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
    <title>Daily Attendance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        h2 { text-align: center; margin-bottom: 5px; }
        p.subtitle { text-align: center; margin-bottom: 20px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        @media print { body { padding: 0; } }
    </style>
</head>
<body>
    <h2>${state.organizationName || 'Daily Attendance Report'}</h2>
    <p class="subtitle">Period: ${rangeLabel}</p>
    <table>
        <thead>
            <tr>
                <th>#</th>
                ${isRange ? '<th>Date</th>' : ''}
                <th>Employee</th>
                <th>Group</th>
                <th>Shift</th>
                <th>In</th>
                <th>In Status</th>
                <th>Out</th>
                <th>Out Status</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    </table>
    <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`);
    printWindow.document.close();
};

const printLogs = () => {
    let logs = state.adminManagement.logs || [];
    if (state.logsSearch) {
        const term = state.logsSearch.toLowerCase();
        logs = logs.filter(log => 
            (log.timestamp && String(log.timestamp).toLowerCase().includes(term)) ||
            (log.user_id && String(log.user_id).toLowerCase().includes(term)) ||
            (log.action && String(log.action).toLowerCase().includes(term))
        );
    }

    if (logs.length === 0) {
        setState({ errorMessage: 'No logs to print.' });
        return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        setState({ errorMessage: 'Pop-up blocked. Please allow pop-ups to print.' });
        return;
    }

    const rows = logs.map(log => `
        <tr>
            <td>${escHtml(log.timestamp)}</td>
            <td>${escHtml(log.user_id)}</td>
            <td>${escHtml(log.action)}</td>
        </tr>
    `).join('');

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
    <title>Activity Logs Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        h2 { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        @media print { body { padding: 0; } }
    </style>
</head>
<body>
    <h2>${state.organizationName || 'Activity Logs Report'}</h2>
    <table>
        <thead>
            <tr>
                <th>Timestamp</th>
                <th>User ID</th>
                <th>Action</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    </table>
    <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`);
    printWindow.document.close();
};

// --- QR Code Generation ---

const generateAllQrCodes = async () => {
    // Ensure employee data is loaded first
    if (!state.managementLoaded) {
        setState({ qrGenerating: true });
        await loadManagementData();
    }

    if (!state.adminManagement.employees || state.adminManagement.employees.length === 0) {
        setState({ errorMessage: 'No employees found. Please add employees first.', qrGenerating: false });
        return;
    }

    setState({ qrGenerating: true, qrGenerated: false });

    // Small delay to let the loading state render, then flip to generated
    setTimeout(() => {
        setState({ qrGenerating: false, qrGenerated: true });
    }, 300);
};

const downloadQrCode = (employeeId, employeeName) => {
    const canvas = document.getElementById(`qr-canvas-${employeeId}`);
    if (!canvas) {
        setState({ errorMessage: 'QR code not found. Please generate QR codes first.' });
        return;
    }

    // Create a larger canvas for the download with employee info label
    const exportCanvas = document.createElement('canvas');
    const padding = 20;
    const labelHeight = 50;
    exportCanvas.width  = 200 + padding * 2;
    exportCanvas.height = 200 + padding * 2 + labelHeight;

    const ctx = exportCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Draw QR code (scaled up)
    ctx.drawImage(canvas, padding, padding, 200, 200);

    // Draw employee info below
    ctx.fillStyle = '#1a1a2e';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(employeeName, exportCanvas.width / 2, 200 + padding + 22);
    ctx.font = '12px Arial, sans-serif';
    ctx.fillStyle = '#666666';
    ctx.fillText(`ID: ${employeeId}`, exportCanvas.width / 2, 200 + padding + 40);

    const link = document.createElement('a');
    link.download = `qr_${employeeId}_${employeeName.replace(/\s+/g, '_')}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
};

const saveQrCodeToDb = async (employeeId, employeeName) => {
    const canvas = document.getElementById(`qr-canvas-${employeeId}`);
    if (!canvas) {
        setState({ errorMessage: 'QR code not found. Please generate QR codes first.' });
        return;
    }

    const qrDataUrl = canvas.toDataURL('image/png');

    try {
        const res = await callGas('saveEmployeeQRCode', state.token, employeeId, qrDataUrl);
        if (res && res.status === 'success') {
            setState({ successMessage: `QR code for ${employeeName} saved to database.` });
        } else {
            setState({ errorMessage: res?.message || 'Failed to save QR code.' });
        }
    } catch {
        setState({ errorMessage: 'Connection error while saving QR code.' });
    }
};

const printAllQrCodes = () => {
    if (!state.qrGenerated) {
        setState({ errorMessage: 'Please generate QR codes first.' });
        return;
    }

    const employees = state.adminManagement.employees || [];
    const searchTerm = (state.qrSearch || '').toLowerCase().trim();
    const filtered = employees.filter(e =>
        !searchTerm ||
        e.id.toLowerCase().includes(searchTerm) ||
        e.name.toLowerCase().includes(searchTerm)
    );

    if (filtered.length === 0) {
        setState({ errorMessage: 'No employees to print.' });
        return;
    }

    // Build a print window with all QR codes
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        setState({ errorMessage: 'Pop-up blocked. Please allow pop-ups to print QR codes.' });
        return;
    }

    // Collect canvas data URLs
    const cards = filtered.map(emp => {
        const canvas = document.getElementById(`qr-canvas-${emp.id}`);
        const dataUrl = canvas ? canvas.toDataURL('image/png') : '';
        return { id: emp.id, name: emp.name, dataUrl };
    });

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
    <title>Employee QR Codes</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 16px; }
        .grid { display: flex; flex-wrap: wrap; gap: 16px; }
        .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; text-align: center; width: 140px; page-break-inside: avoid; }
        .card img { width: 120px; height: 120px; display: block; margin: 0 auto 8px; }
        .name { font-weight: bold; font-size: 11px; word-break: break-word; }
        .id { color: #666; font-size: 10px; margin-top: 2px; }
        @media print { body { padding: 0; } }
    </style>
</head>
<body>
    <h2 style="margin-bottom: 16px;">Employee QR Codes</h2>
    <div class="grid">
        ${cards.map(c => `
        <div class="card">
            <img src="${c.dataUrl}" alt="QR ${c.id}">
            <div class="name">${c.name}</div>
            <div class="id">ID: ${c.id}</div>
        </div>`).join('')}
    </div>
    <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`);
    printWindow.document.close();
};

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    init();
    
    // Initialize language change listener
    onLanguageChange(() => {
        // Re-render all views when language changes
        render();
        // Re-render any active components that need translation
        if (state.currentReportComponent) {
            state.currentReportComponent.render();
        }
        if (state.currentSettingsComponent && state.adminView === 'settings') {
            state.currentSettingsComponent.render();
        }
        if (state.currentProfileComponent && (state.adminView === 'profile' || state.view === 'employee')) {
            state.currentProfileComponent.render();
        }
    });
    
    // Set up language selector dropdowns
    setupLanguageSelectors();

    // --- Delegated Click Listeners ---
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        
        // Logout
        if (target.closest('.logout-btn')) { logout(); return; }

        // Employee Actions
        if (target.closest('#btn-checkin')) { doCheckIn(); return; }
        if (target.closest('#btn-checkout')) { doCheckOut(); return; }

        if (target.closest('.js-employee-add-leave')) { openEmployeeLeaveModal(); return; }

        const editLeaveBtn = target.closest('.js-edit-leave');
        if (editLeaveBtn && state.view === 'employee') { openEmployeeLeaveModal(editLeaveBtn.dataset.id); return; }

        const deleteLeaveBtn = target.closest('.js-delete-leave');
        if (deleteLeaveBtn && state.view === 'employee') { deleteEmployeeLeaveRequest(deleteLeaveBtn.dataset.id); return; }

        // Employee Profile
        if (target.closest('.js-employee-profile-btn')) {
            const dashboard = document.getElementById('employee-dashboard-panel');
            const profilePanel = document.getElementById('employee-profile-panel');
            if (dashboard) dashboard.style.display = 'none';
            if (profilePanel) profilePanel.style.display = 'block';
            loadEmployeeProfileView();
            return;
        }
        if (target.closest('.js-employee-back-btn')) {
            const dashboard = document.getElementById('employee-dashboard-panel');
            const profilePanel = document.getElementById('employee-profile-panel');
            if (dashboard) dashboard.style.display = 'block';
            if (profilePanel) profilePanel.style.display = 'none';
            return;
        }

        // Language Toggle — delegated, survives dynamic HTML re-injection
        const langItem = target.closest('a[data-lang]');
        if (langItem) {
            e.preventDefault();
            const lang = langItem.dataset.lang;
            if (lang) {
                setLanguage(lang);
                updateLanguageDisplay(lang);
            }
            return;
        }

        // Admin Sidebar — group header toggle
        const groupHeader = target.closest('.admin-sidebar-group-header');
        if (groupHeader) {
            const groupId = groupHeader.dataset.group;
            const submenu = document.getElementById(`submenu-${groupId}`);
            if (submenu) {
                const isOpen = submenu.classList.contains('open');
                submenu.classList.toggle('open', !isOpen);
                groupHeader.classList.toggle('open', !isOpen);
            }
            return;
        }

        // Admin Sidebar
        const sidebarItem = target.closest('.admin-sidebar-item');
        if (sidebarItem) {
            const view = sidebarItem.dataset.view;
            setState({ adminView: view });
            if (['users', 'shifts', 'positions', 'logs'].includes(view)) loadManagementData();
            if (view === 'attendance' && !state.dailyAttendanceLoaded) {
                // Initialize date pickers to today if not already set
                const today = new Date().toISOString().slice(0, 10);
                const startEl = document.getElementById('attendance-date-start');
                const endEl   = document.getElementById('attendance-date-end');
                if (startEl && !startEl.value) startEl.value = today;
                if (endEl   && !endEl.value)   endEl.value   = today;
                loadDailyAttendance(startEl ? startEl.value : today, endEl ? endEl.value : today);
            }
            if (view === 'manual-attendance') {
                loadManagementData(); // ensure employees are loaded for dropdowns
                // Set default date range to current month
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const startEl = document.getElementById('manual-att-filter-start');
                const endEl   = document.getElementById('manual-att-filter-end');
                
                let startVal = `${y}-${m}-01`;
                let endVal   = now.toISOString().slice(0, 10);
                
                if (startEl && !startEl.value) startEl.value = startVal;
                if (endEl   && !endEl.value)   endEl.value   = endVal;

                // Auto-load if not yet loaded for this view
                if (!state.manualAttLoaded && !state.manualAttLoading) {
                    loadManualAttendanceRecords();
                }
            }
            if (view === 'reports') {
                if (!state.reportsLoaded) setState({ reportsLoaded: true });
                renderReports();
            }
            if (view === 'qrcodes') {
                loadManagementData(); // ensure employees are loaded
            }
            if (view === 'settings') {
                loadSettingsView();
            }
            if (view === 'profile') {
                loadAdminProfileView();
            }
            return;
        }

        // Admin Actions
        if (target.closest('#btn-load-attendance')) {
            const startEl = document.getElementById('attendance-date-start');
            const endEl   = document.getElementById('attendance-date-end');
            const today   = new Date().toISOString().slice(0, 10);
            const start   = startEl ? startEl.value : today;
            const end     = endEl   ? endEl.value   : today;
            if (!start) { setState({ errorMessage: 'Please select a start date.' }); return; }
            if (!end)   { setState({ errorMessage: 'Please select an end date.' }); return; }
            if (start > end) { setState({ errorMessage: 'Start date must be before or equal to end date.' }); return; }
            loadDailyAttendance(start, end);
            return;
        }
        if (target.closest('#btn-export-attendance')) { exportAttendanceCsv(); return; }
        if (target.closest('#btn-export-attendance-excel')) { exportAttendanceExcel(); return; }
        if (target.closest('#btn-print-attendance')) { printAttendance(); return; }

        // Manual Attendance Actions
        if (target.closest('#btn-add-manual-att')) { openManualAttModal(); return; }
        if (target.closest('#btn-load-manual-att')) { loadManualAttendanceRecords(); return; }
        if (target.closest('#btn-save-manual-att')) { saveManualAttendance(); return; }
        if (target.closest('.js-close-manual-att-modal')) { closeManualAttModal(); return; }
        if (target.id === 'manual-att-modal-overlay' && !target.closest('.modal-dialog')) { closeManualAttModal(); return; }

        const editManualAttBtn   = target.closest('.js-edit-manual-att');
        const deleteManualAttBtn = target.closest('.js-delete-manual-att');
        const manualAttPageBtn   = target.closest('.js-manual-att-page');

        if (editManualAttBtn) {
            const empId = editManualAttBtn.dataset.employeeId;
            const date  = editManualAttBtn.dataset.date;
            const rec   = state.manualAttRecords.find(r => r.employeeId === empId && r.date === date);
            if (rec) openManualAttModal(rec);
            return;
        }
        if (deleteManualAttBtn) {
            deleteManualAttendance(
                deleteManualAttBtn.dataset.employeeId,
                deleteManualAttBtn.dataset.date,
                deleteManualAttBtn.dataset.name
            );
            return;
        }
        if (manualAttPageBtn && !manualAttPageBtn.closest('.page-item.disabled')) {
            const newPage = parseInt(manualAttPageBtn.dataset.page, 10);
            if (!isNaN(newPage)) setState({ manualAttPage: newPage });
            return;
        }
        
        // Report Actions
        if (target.closest('#btn-load-report')) {
            const period = document.getElementById('report-period-filter')?.value || 'monthly';
            if (period === 'custom') {
                const start = document.getElementById('report-date-start')?.value || '';
                const end   = document.getElementById('report-date-end')?.value   || '';
                if (!start) { setState({ errorMessage: 'Please select a start date.' }); return; }
                if (!end)   { setState({ errorMessage: 'Please select an end date.' }); return; }
                if (start > end) { setState({ errorMessage: 'Start date must be before or equal to end date.' }); return; }
                loadReportData(start, end);
            } else {
                loadReportData(period);
            }
            return;
        }
        if (target.closest('#btn-export-csv')) { exportReportCSV(); return; }
        if (target.closest('#btn-export-excel')) { exportReportExcel(); return; }
        if (target.closest('#btn-export-pdf')) { exportReportPDF(); return; }

        // QR Code Actions
        if (target.closest('#btn-qr-generate-all') || target.closest('#btn-qr-generate-all-empty')) { generateAllQrCodes(); return; }
        if (target.closest('#btn-qr-print-all')) { printAllQrCodes(); return; }
        const qrDownloadBtn = target.closest('.js-qr-download');
        const qrSaveBtn     = target.closest('.js-qr-save');
        if (qrDownloadBtn) { downloadQrCode(qrDownloadBtn.dataset.id, qrDownloadBtn.dataset.name); return; }
        if (qrSaveBtn)     { saveQrCodeToDb(qrSaveBtn.dataset.id, qrSaveBtn.dataset.name); return; }
        
        if (target.closest('.btn-add-user')) { openUserModal(); return; }
        if (target.closest('.btn-add-shift')) { openShiftModal(); return; }
        if (target.closest('.btn-add-position')) { openPositionModal(); return; }
        if (target.closest('.btn-close-modal') || target.id === 'modal-overlay') { setState({ formType: '' }); return; }
        if (target.closest('#btn-save-form')) { saveForm(); return; }

        // Table actions (Admin)
        const editUserBtn    = target.closest('.js-edit-user');
        const deleteUserBtn  = target.closest('.js-delete-user');
        const editShiftBtn   = target.closest('.js-edit-shift');
        const deleteShiftBtn = target.closest('.js-delete-shift');
        const editPosBtn     = target.closest('.js-edit-position');
        const deletePosBtn   = target.closest('.js-delete-position');
        const pageBtn        = target.closest('.js-att-page');
        const retryBtn       = target.closest('.js-att-retry');

        if (editUserBtn)    { openUserModal(editUserBtn.dataset.id); return; }
        if (deleteUserBtn)  { deleteUser(deleteUserBtn.dataset.id); return; }
        if (editShiftBtn)   { openShiftModal(editShiftBtn.dataset.id); return; }
        if (deleteShiftBtn) { deleteShift(deleteShiftBtn.dataset.id); return; }
        if (editPosBtn)     { openPositionModal(editPosBtn.dataset.id); return; }
        if (deletePosBtn)   { deletePosition(deletePosBtn.dataset.id); return; }
        if (pageBtn && !pageBtn.closest('.page-item.disabled')) {
            const newPage = parseInt(pageBtn.dataset.page, 10);
            if (!isNaN(newPage)) setState({ attPage: newPage });
            return;
        }
        if (retryBtn) {
            const startEl = document.getElementById('attendance-date-start');
            const endEl   = document.getElementById('attendance-date-end');
            const today   = new Date().toISOString().slice(0, 10);
            loadDailyAttendance(startEl ? startEl.value : today, endEl ? endEl.value : today);
            return;
        }

        const logsPageBtn = target.closest('.js-logs-page');
        if (logsPageBtn && !logsPageBtn.closest('.page-item.disabled')) {
            const newPage = parseInt(logsPageBtn.dataset.page, 10);
            if (!isNaN(newPage)) setState({ logsPage: newPage });
            return;
        }
        if (target.closest('#btn-print-logs')) { printLogs(); return; }

        // Dialog Actions
        if (target.closest('#confirm-dialog-ok')) {
            const cb = state.confirmDialog.onConfirm;
            setState({ confirmDialog: { visible: false, message: '', confirmText: '', confirmColor: '', onConfirm: null } });
            if (cb) cb();
            return;
        }
        if (target.closest('#confirm-dialog-cancel')) {
            setState({ confirmDialog: { visible: false, message: '', confirmText: '', confirmColor: '', onConfirm: null } });
            return;
        }

        // Alert close
        if (target.closest('.btn-close')) {
            if (target.closest('#error-alert-container')) setState({ errorMessage: '' });
            if (target.closest('#success-alert-container')) setState({ successMessage: '' });
        }
    });

    // --- Delegated Change/Input Listeners ---
    document.body.addEventListener('change', (e) => {
        const target = e.target;
        if (target.id === 'att-filter-status') {
            setState({ attFilterStatus: target.value, attPage: 1 });
        }
        if (target.id === 'att-filter-group') {
            setState({ attFilterGroup: target.value, attPage: 1 });
        }
        if (target.id === 'att-filter-shift') {
            setState({ attFilterShift: target.value, attPage: 1 });
        }
        if (target.id === 'att-page-size') {
            setState({ attPageSize: parseInt(target.value, 10) || 10, attPage: 1 });
        }
        if (target.id === 'manual-att-page-size') {
            setState({ manualAttPageSize: parseInt(target.value, 10) || 10, manualAttPage: 1 });
        }
        if (target.id === 'logs-page-size') {
            setState({ logsPageSize: parseInt(target.value, 10) || 10, logsPage: 1 });
        }
        if (target.id === 'report-period-filter') {
            const rangeEl = document.getElementById('report-custom-range');
            if (target.value === 'custom') {
                if (rangeEl) rangeEl.style.cssText = 'display: flex !important;';
            } else {
                if (rangeEl) rangeEl.style.cssText = 'display: none !important;';
                loadReportData(target.value);
            }
        }
        if (target.id === 'report-page-size') {
            const component = state.currentReportComponent;
            if (component) component.handlePageSizeChange(target.value);
        }
        if (target.id === 'user-photo-input') {
            handleImageUpload(e);
        }
    });

    document.body.addEventListener('input', (e) => {
        if (e.target.id === 'att-search') {
            setState({ attSearch: e.target.value, attPage: 1 });
        }
        if (e.target.id === 'manual-att-search') {
            setState({ manualAttSearch: e.target.value, manualAttPage: 1 });
        }
        if (e.target.id === 'report-search') {
            const component = state.currentReportComponent;
            if (component) component.handleSearch(e.target.value);
        }
        if (e.target.id === 'qr-search') {
            setState({ qrSearch: e.target.value });
        }
        if (e.target.id === 'logs-search') {
            setState({ logsSearch: e.target.value, logsPage: 1 });
        }
    });

    // --- Delegated Submit Listeners ---
    document.body.addEventListener('submit', (e) => {
        if (e.target.id === 'login-form') {
            e.preventDefault();
            doLogin(e);
        }
    });

    // --- Login page tab switching (mobile) ---
    document.body.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.login-tab-btn');
        if (!tabBtn) return;
        const tab = tabBtn.dataset.tab;
        const formPanel   = document.getElementById('login-panel-form');
        const scanPanel   = document.getElementById('login-panel-scanner');
        const btnForm     = document.getElementById('tab-btn-form');
        const btnScanner  = document.getElementById('tab-btn-scanner');
        if (!formPanel || !scanPanel) return;

        if (tab === 'form') {
            formPanel.classList.remove('hidden');
            scanPanel.classList.remove('active');
            if (btnForm)    btnForm.classList.add('active');
            if (btnScanner) btnScanner.classList.remove('active');
        } else if (tab === 'scanner') {
            formPanel.classList.add('hidden');
            scanPanel.classList.add('active');
            if (btnScanner) btnScanner.classList.add('active');
            if (btnForm)    btnForm.classList.remove('active');
        }
    });
});

function initAdminSidebar() {
  const hamburger = document.getElementById('btn-hamburger');
  const overlay   = document.getElementById('sidebar-overlay');
  const sidebar   = document.querySelector('.admin-sidebar');

  function openSidebar() {
    document.body.classList.add('sidebar-open');
    hamburger?.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    hamburger?.setAttribute('aria-expanded', 'false');
  }

  hamburger?.addEventListener('click', () => {
    document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
  });

  overlay?.addEventListener('click', closeSidebar);

  // Auto-close on nav item click (mobile)
  sidebar?.querySelectorAll('.admin-sidebar-item, .admin-sidebar-group-header').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 767) closeSidebar();
    });
  });
}

function initLoginTabs() {
  const tabBtns   = document.querySelectorAll('.login-tab-btn');
  const formPanel = document.getElementById('login-panel-form');
  const scanPanel = document.getElementById('login-panel-scanner');
  if (!tabBtns.length || !formPanel || !scanPanel) return;

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      if (tab === 'scanner') {
        formPanel.classList.add('hidden');
        scanPanel.classList.add('active');
      } else {
        formPanel.classList.remove('hidden');
        scanPanel.classList.remove('active');
      }
    });
  });
}
