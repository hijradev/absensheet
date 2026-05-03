// ScheduleManagement.js - Monthly schedule management for admin
import { t } from '../i18n/i18n.js';

export class ScheduleManagement {
    constructor(state, setState, callGas) {
        this.state = state;
        this.setState = setState;
        this.callGas = callGas;

        // View state
        this.year = new Date().getFullYear();
        this.month = new Date().getMonth() + 1; // 1-12
        this.filterGroup = '';
        this.filterShift = '';
        this.filterEmployee = '';
        this.loading = false;
        this.saving = false;

        // Data
        this.scheduleData = null; // { schedules, employees, shifts, groups }
        // pendingChanges: map of "empId_day" -> { scheduleType, shiftId, groupId, notes }
        this.pendingChanges = {};
    }

    async loadData() {
        if (this.loading) return;
        this.loading = true;
        this._renderLoading();
        try {
            const res = await this.callGas('getMonthScheduleSummary', this.state.token, this.year, this.month);
            if (res && res.status === 'success') {
                this.scheduleData = res.data;
                this.pendingChanges = {};
                this.loading = false;
                this.render();
            } else {
                this.loading = false;
                this._renderError(res?.message || this.t('scheduleManagement.failedToLoad'));
            }
        } catch (e) {
            this.loading = false;
            this._renderError(this.t('scheduleManagement.connectionError'));
        }
    }

    async saveChanges() {
        const keys = Object.keys(this.pendingChanges);
        if (keys.length === 0) return;

        this.saving = true;
        this._updateSaveBtn();

        const entries = keys.map(key => {
            const [empId, day] = key.split('_');
            const ch = this.pendingChanges[key];
            return {
                employeeId: empId,
                year: this.year,
                month: this.month,
                day: Number(day),
                shiftId: ch.shiftId || '',
                groupId: ch.groupId || '',
                scheduleType: ch.scheduleType || 'work',
                notes: ch.notes || ''
            };
        });

        try {
            const res = await this.callGas('saveBulkSchedule', this.state.token, entries);
            if (res && res.status === 'success') {
                this.pendingChanges = {};
                this.saving = false;
                this.setState({ successMessage: res.data?.message || this.t('scheduleManagement.saveSuccess') });
                await this.loadData();
            } else {
                this.saving = false;
                this._updateSaveBtn();
                this.setState({ errorMessage: res?.message || this.t('scheduleManagement.saveFailed') });
            }
        } catch (e) {
            this.saving = false;
            this._updateSaveBtn();
            this.setState({ errorMessage: this.t('scheduleManagement.connectionError') });
        }
    }

    async deleteEntry(scheduleId) {
        try {
            const res = await this.callGas('deleteScheduleEntry', this.state.token, scheduleId);
            if (res && res.status === 'success') {
                this.setState({ successMessage: this.t('scheduleManagement.deleteSuccess') });
                await this.loadData();
            } else {
                this.setState({ errorMessage: res?.message || this.t('scheduleManagement.deleteFailed') });
            }
        } catch (e) {
            this.setState({ errorMessage: this.t('scheduleManagement.connectionError') });
        }
    }

    // ---- Rendering ----

    render() {
        const container = document.getElementById('admin-view-schedule');
        if (!container) return;

        if (!this.scheduleData) {
            this.loadData();
            return;
        }

        const { employees, shifts, groups } = this.scheduleData;
        const daysInMonth = new Date(this.year, this.month, 0).getDate();
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

        // Build schedule lookup: "empId_day" -> entry
        const schedMap = {};
        (this.scheduleData.schedules || []).forEach(s => {
            schedMap[`${s.employeeId}_${s.day}`] = s;
        });

        // Apply filters
        let filteredEmployees = employees || [];
        if (this.filterGroup) filteredEmployees = filteredEmployees.filter(e => e.jabatan_id === this.filterGroup);
        if (this.filterShift) filteredEmployees = filteredEmployees.filter(e => e.shift_id === this.filterShift);
        if (this.filterEmployee) {
            const q = this.filterEmployee.toLowerCase();
            filteredEmployees = filteredEmployees.filter(e =>
                e.id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
            );
        }

        const monthNames = this.t('employeeDashboard.months');
        const hasPending = Object.keys(this.pendingChanges).length > 0;

        container.innerHTML = `
        <div class="container-fluid">
            <div class="row mb-3 align-items-center">
                <div class="col">
                    <div class="page-pretitle">${this.t('adminPanel.management')}</div>
                    <h2 class="page-title">${this.t('scheduleManagement.monthlySchedule')}</h2>
                </div>
                <div class="col-auto d-flex gap-2 flex-wrap">
                    <button class="btn btn-outline-secondary js-sched-prev-month">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 6l-6 6l6 6" /></svg>
                    </button>
                    <span class="btn btn-outline-secondary disabled fw-semibold" style="min-width:160px; text-align:center;">
                        ${monthNames[this.month - 1]} ${this.year}
                    </span>
                    <button class="btn btn-outline-secondary js-sched-next-month">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 6l6 6l-6 6" /></svg>
                    </button>
                    <button class="btn btn-primary js-sched-save ${hasPending ? '' : 'disabled'}" id="sched-save-btn" ${hasPending ? '' : 'disabled'}>
                        <span class="spinner-border spinner-border-sm me-1 d-none" id="sched-save-spinner"></span>
                        <svg id="sched-save-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /><path d="M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M14 4l0 4l-6 0l0 -4" /></svg>
                        ${this.t('scheduleManagement.saveChanges')} ${hasPending ? `<span class="badge bg-white text-primary ms-1">${Object.keys(this.pendingChanges).length}</span>` : ''}
                    </button>
                </div>
            </div>

            <!-- Filters -->
            <div class="card mb-3">
                <div class="card-body py-2">
                    <div class="row g-2 align-items-end">
                        <div class="col-md-3">
                            <label class="form-label mb-1 small">${this.t('scheduleManagement.searchEmployee')}</label>
                            <input type="text" class="form-control form-control-sm js-sched-search" placeholder="${this.t('scheduleManagement.searchPlaceholder')}" value="${this.escHtml(this.filterEmployee)}">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label mb-1 small">${this.t('scheduleManagement.group')}</label>
                            <select class="form-select form-select-sm js-sched-filter-group">
                                <option value="">${this.t('scheduleManagement.allGroups')}</option>
                                ${(groups || []).map(g => `<option value="${this.escHtml(g.id)}" ${this.filterGroup === g.id ? 'selected' : ''}>${this.escHtml(g.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label mb-1 small">${this.t('scheduleManagement.shift')}</label>
                            <select class="form-select form-select-sm js-sched-filter-shift">
                                <option value="">${this.t('scheduleManagement.allShifts')}</option>
                                ${(shifts || []).map(s => `<option value="${this.escHtml(s.id)}" ${this.filterShift === s.id ? 'selected' : ''}>${this.escHtml(this.formatTime(s.start_time))}–${this.escHtml(this.formatTime(s.end_time))}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label mb-1 small">${this.t('scheduleManagement.legend')}</label>
                            <div class="d-flex gap-2 flex-wrap">
                                <span class="badge bg-success-lt text-success">${this.t('scheduleManagement.work')}</span>
                                <span class="badge bg-danger-lt text-danger">${this.t('scheduleManagement.dayOff')}</span>
                                <span class="badge bg-warning-lt text-warning">${this.t('scheduleManagement.holiday')}</span>
                                <span class="badge bg-secondary-lt text-secondary">—</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Calendar Grid -->
            <div class="card">
                <div class="card-body p-0">
                    <div class="table-responsive" style="max-height: 70vh; overflow: auto;">
                        <table class="table table-bordered table-sm mb-0 sched-table" style="min-width: ${120 + daysInMonth * 52}px;">
                            <thead class="table-light sticky-top">
                                <tr>
                                    <th class="sticky-col" style="min-width:160px; z-index:3;">${this.t('scheduleManagement.employee')}</th>
                                    ${days.map(d => {
                                        const dow = new Date(this.year, this.month - 1, d).getDay();
                                        const isWeekend = dow === 0 || dow === 6;
                                        const dowLabel = this.t('employeeDashboard.daysShort')[dow];
                                        return `<th class="text-center ${isWeekend ? 'table-warning' : ''}" style="min-width:52px; font-size:11px;">
                                            <div>${d}</div>
                                            <div class="text-muted" style="font-size:10px;">${dowLabel}</div>
                                        </th>`;
                                    }).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredEmployees.length === 0
                                    ? `<tr><td colspan="${daysInMonth + 1}" class="text-center text-muted py-4">${this.t('scheduleManagement.noEmployeesFound')}</td></tr>`
                                    : filteredEmployees.map(emp => {
                                        return `<tr>
                                            <td class="sticky-col fw-semibold" style="min-width:160px; background:#fff; z-index:2;">
                                                <div style="font-size:13px;">${this.escHtml(emp.name)}</div>
                                                <div class="text-muted" style="font-size:11px;">${this.escHtml(emp.id)}</div>
                                            </td>
                                            ${days.map(d => {
                                                const key = `${emp.id}_${d}`;
                                                const pending = this.pendingChanges[key];
                                                const saved = schedMap[key];
                                                const entry = pending || saved;
                                                const type = entry ? entry.scheduleType : null;
                                                const cellClass = type === 'work' ? 'bg-success-lt'
                                                    : type === 'off' ? 'bg-danger-lt'
                                                    : type === 'holiday' ? 'bg-warning-lt'
                                                    : '';
                                                const isPending = !!pending;
                                                const dow = new Date(this.year, this.month - 1, d).getDay();
                                                const isWeekend = dow === 0 || dow === 6;
                                                return `<td class="text-center p-0 ${cellClass} ${isWeekend && !type ? 'table-warning' : ''} ${isPending ? 'border-primary' : ''}" style="cursor:pointer; position:relative;" 
                                                    data-emp="${this.escHtml(emp.id)}" data-day="${d}" data-shift="${this.escHtml(emp.shift_id || '')}" data-group="${this.escHtml(emp.jabatan_id || '')}">
                                                    <div class="js-sched-cell d-flex align-items-center justify-content-center" style="height:40px; font-size:11px; font-weight:600;">
                                                        ${type === 'work' ? `<span class="text-success">W</span>` 
                                                            : type === 'off' ? `<span class="text-danger">OFF</span>`
                                                            : type === 'holiday' ? `<span class="text-warning">H</span>`
                                                            : `<span class="text-muted">—</span>`}
                                                        ${isPending ? `<span style="position:absolute;top:2px;right:2px;width:6px;height:6px;background:#206bc4;border-radius:50%;"></span>` : ''}
                                                    </div>
                                                </td>`;
                                            }).join('')}
                                        </tr>`;
                                    }).join('')
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>`;
        
        // Ensure modal exists in body
        let modalEl = document.getElementById('sched-cell-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'sched-cell-modal';
            modalEl.className = 'modal fade';
            modalEl.tabIndex = -1;
            modalEl.setAttribute('aria-hidden', 'true');
            document.body.appendChild(modalEl);
        }
        
        // Define modal structure (body will be populated dynamically)
        modalEl.innerHTML = `
            <div class="modal-dialog modal-sm">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="sched-cell-modal-title">${this.t('scheduleManagement.editSchedule')}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="sched-cell-modal-body">
                        <!-- Populated dynamically -->
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${this.t('common.cancel')}</button>
                        <button type="button" class="btn btn-danger btn-sm js-sched-cell-delete d-none" id="sched-cell-delete-btn">${this.t('common.delete')}</button>
                        <button type="button" class="btn btn-primary js-sched-cell-save">${this.t('scheduleManagement.apply')}</button>
                    </div>
                </div>
            </div>
        `;

        this._attachListeners();
    }

    _renderLoading() {
        const container = document.getElementById('admin-view-schedule');
        if (!container) return;
        container.innerHTML = `
        <div class="container-fluid">
            <div class="d-flex justify-content-center align-items-center py-5">
                <div class="spinner-border text-primary me-3"></div>
                <span class="text-muted">${this.t('scheduleManagement.loading')}</span>
            </div>
        </div>`;
    }

    _renderError(msg) {
        const container = document.getElementById('admin-view-schedule');
        if (!container) return;
        container.innerHTML = `
        <div class="container-fluid">
            <div class="alert alert-danger">${this.escHtml(msg)}</div>
            <button class="btn btn-primary js-sched-reload">${this.t('common.retry') || 'Retry'}</button>
        </div>`;
        container.querySelector('.js-sched-reload')?.addEventListener('click', () => this.loadData());
    }

    _updateSaveBtn() {
        const btn = document.getElementById('sched-save-btn');
        const spinner = document.getElementById('sched-save-spinner');
        const icon = document.getElementById('sched-save-icon');
        if (!btn) return;
        if (this.saving) {
            btn.disabled = true;
            if (spinner) spinner.classList.remove('d-none');
            if (icon) icon.style.display = 'none';
        } else {
            const hasPending = Object.keys(this.pendingChanges).length > 0;
            btn.disabled = !hasPending;
            if (spinner) spinner.classList.add('d-none');
            if (icon) icon.style.display = '';
        }
    }

    _attachListeners() {
        const container = document.getElementById('admin-view-schedule');
        if (!container) return;

        // Month navigation
        container.querySelector('.js-sched-prev-month')?.addEventListener('click', () => {
            this.month--;
            if (this.month < 1) { this.month = 12; this.year--; }
            this.scheduleData = null;
            this.pendingChanges = {};
            this.loadData();
        });
        container.querySelector('.js-sched-next-month')?.addEventListener('click', () => {
            this.month++;
            if (this.month > 12) { this.month = 1; this.year++; }
            this.scheduleData = null;
            this.pendingChanges = {};
            this.loadData();
        });

        // Save
        container.querySelector('.js-sched-save')?.addEventListener('click', () => this.saveChanges());

        // Filters
        container.querySelector('.js-sched-search')?.addEventListener('input', e => {
            this.filterEmployee = e.target.value;
            this.render();
        });
        container.querySelector('.js-sched-filter-group')?.addEventListener('change', e => {
            this.filterGroup = e.target.value;
            this.render();
        });
        container.querySelector('.js-sched-filter-shift')?.addEventListener('change', e => {
            this.filterShift = e.target.value;
            this.render();
        });

        // Cell click — open modal
        container.querySelectorAll('.js-sched-cell').forEach(cell => {
            cell.parentElement.addEventListener('click', e => {
                const td = e.currentTarget;
                const empId = td.dataset.emp;
                const day = Number(td.dataset.day);
                const defaultShift = td.dataset.shift || '';
                const defaultGroup = td.dataset.group || '';
                this._openCellModal(empId, day, defaultShift, defaultGroup);
            });
        });
    }

    _openCellModal(empId, day, defaultShift, defaultGroup) {
        const { employees, shifts, groups, schedules } = this.scheduleData || {};
        const emp = (employees || []).find(e => String(e.id) === String(empId));
        const key = `${empId}_${day}`;
        const pending = this.pendingChanges[key];
        const saved = (schedules || []).find(s => s.employeeId === empId && s.day === day);
        const current = pending || saved || {};

        const monthNames = this.t('employeeDashboard.months');
        const title = document.getElementById('sched-cell-modal-title');
        if (title) title.textContent = `${emp ? emp.name : empId} — ${day} ${monthNames[this.month - 1]} ${this.year}`;

        const body = document.getElementById('sched-cell-modal-body');
        if (body) {
            body.innerHTML = `
            <div class="mb-3">
                <label class="form-label">${this.t('scheduleManagement.scheduleType')}</label>
                <select class="form-select" id="sched-modal-type">
                    <option value="work" ${(current.scheduleType || 'work') === 'work' ? 'selected' : ''}>${this.t('scheduleManagement.work')}</option>
                    <option value="off" ${current.scheduleType === 'off' ? 'selected' : ''}>${this.t('scheduleManagement.dayOff')}</option>
                    <option value="holiday" ${current.scheduleType === 'holiday' ? 'selected' : ''}>${this.t('scheduleManagement.holiday')}</option>
                </select>
            </div>
            <div class="mb-3">
                <label class="form-label">${this.t('scheduleManagement.shift')}</label>
                <select class="form-select" id="sched-modal-shift">
                    <option value="">${this.t('scheduleManagement.default')}</option>
                    ${(shifts || []).map(s => `<option value="${this.escHtml(s.id)}" ${(current.shiftId || defaultShift) === s.id ? 'selected' : ''}>${this.escHtml(this.formatTime(s.start_time))}–${this.escHtml(this.formatTime(s.end_time))}</option>`).join('')}
                </select>
            </div>
            <div class="mb-3">
                <label class="form-label">${this.t('scheduleManagement.group')}</label>
                <select class="form-select" id="sched-modal-group">
                    <option value="">${this.t('scheduleManagement.default')}</option>
                    ${(groups || []).map(g => `<option value="${this.escHtml(g.id)}" ${(current.groupId || defaultGroup) === g.id ? 'selected' : ''}>${this.escHtml(g.name)}</option>`).join('')}
                </select>
            </div>
            <div class="mb-3">
                <label class="form-label">${this.t('scheduleManagement.notes')}</label>
                <input type="text" class="form-control" id="sched-modal-notes" value="${this.escHtml(current.notes || '')}" placeholder="${this.t('scheduleManagement.optionalNotes')}">
            </div>`;
        }

        // Show/hide delete button
        const deleteBtn = document.getElementById('sched-cell-delete-btn');
        if (deleteBtn) {
            if (saved && saved.id) {
                deleteBtn.classList.remove('d-none');
                deleteBtn.onclick = async () => {
                    const modalEl = document.getElementById('sched-cell-modal');
                    if (modalEl && window.bootstrap) {
                        const modal = window.bootstrap.Modal.getInstance(modalEl);
                        if (modal) modal.hide();
                    }
                    await this.deleteEntry(saved.id);
                };
            } else {
                deleteBtn.classList.add('d-none');
            }
        }

        // Apply button
        const applyBtn = document.querySelector('.js-sched-cell-save');
        if (applyBtn) {
            applyBtn.onclick = () => {
                const type = document.getElementById('sched-modal-type')?.value || 'work';
                const shift = document.getElementById('sched-modal-shift')?.value || '';
                const group = document.getElementById('sched-modal-group')?.value || '';
                const notes = document.getElementById('sched-modal-notes')?.value || '';
                this.pendingChanges[key] = { scheduleType: type, shiftId: shift, groupId: group, notes };
                const modalEl = document.getElementById('sched-cell-modal');
                if (modalEl && window.bootstrap) {
                    const modal = window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl);
                    modal.hide();
                    setTimeout(() => this.render(), 300);
                } else {
                    this.render();
                }
            };
        }

        // Open modal
        const modalEl = document.getElementById('sched-cell-modal');
        if (modalEl && window.bootstrap) {
            const modal = window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl);
            modal.show();
        }
    }

    escHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    t(key) {
        return t(key);
    }

    formatTime(str) {
        if (!str) return '';
        const m = String(str).match(/\d{2}:\d{2}/);
        return m ? m[0] : str;
    }
}
