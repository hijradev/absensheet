import { t } from '../i18n/i18n.js';

export class MySchedule {
    constructor(state, setState, callGas) {
        this.state = state;
        this.setState = setState;
        this.callGas = callGas;

        this.year = new Date().getFullYear();
        this.month = new Date().getMonth() + 1;
        this.loading = false;
        this.scheduleData = null; // { schedules, shifts }
    }

    async loadData() {
        if (this.loading) return;
        this.loading = true;
        this._renderLoading();
        try {
            const res = await this.callGas('getMonthScheduleSummary', this.state.token, this.year, this.month);
            if (res && res.status === 'success') {
                this.scheduleData = res.data;
                this.loading = false;
                this.render();
            } else {
                this.loading = false;
                this._renderError(res?.message || t('scheduleManagement.failedToLoad'));
            }
        } catch (e) {
            this.loading = false;
            const errorMsg = e.message || e.toString() || t('scheduleManagement.connectionError');
            this._renderError(`${t('scheduleManagement.connectionError')} (${errorMsg})`);
        }
    }

    render() {
        // Defensive: ensure we only render if our container exists and we are the current active instance
        const container = document.getElementById('employee-schedule-container');
        if (!container) return;
        
        if (this.state.currentMyScheduleComponent !== this) {
            console.log('[MySchedule] component instance is stale, skipping render');
            return;
        }

        if (!this.scheduleData) {
            this.loadData();
            return;
        }

        const { schedules, shifts } = this.scheduleData;
        const daysInMonth = new Date(this.year, this.month, 0).getDate();
        const monthNames = t('employeeDashboard.months');

        // Build shift map
        const shiftMap = {};
        (shifts || []).forEach(s => { shiftMap[s.id] = s; });

        // Build schedule map: day -> entry
        const schedMap = {};
        (schedules || []).forEach(s => { schedMap[s.day] = s; });

        // Count stats
        let workDays = 0, offDays = 0, holidayDays = 0, unsetDays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const entry = schedMap[d];
            if (!entry) { unsetDays++; continue; }
            if (entry.scheduleType === 'work') workDays++;
            else if (entry.scheduleType === 'off') offDays++;
            else if (entry.scheduleType === 'holiday') holidayDays++;
        }

        container.innerHTML = `
        <div>
            <!-- Month navigation -->
            <div class="d-flex align-items-center justify-content-between mb-3">
                <button class="btn btn-outline-secondary btn-sm js-my-sched-prev">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 6l-6 6l6 6" /></svg>
                </button>
                <span class="fw-semibold">${monthNames[this.month - 1]} ${this.year}</span>
                <button class="btn btn-outline-secondary btn-sm js-my-sched-next">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 6l6 6l-6 6" /></svg>
                </button>
            </div>

            <!-- Stats row -->
            <div class="row g-2 mb-3">
                <div class="col-3">
                    <div class="card card-sm text-center border-success">
                        <div class="card-body py-2">
                            <div class="h3 mb-0 text-success">${workDays}</div>
                            <div class="text-muted small">${t('employeeDashboard.work')}</div>
                        </div>
                    </div>
                </div>
                <div class="col-3">
                    <div class="card card-sm text-center border-danger">
                        <div class="card-body py-2">
                            <div class="h3 mb-0 text-danger">${offDays}</div>
                            <div class="text-muted small">${t('employeeDashboard.dayOff')}</div>
                        </div>
                    </div>
                </div>
                <div class="col-3">
                    <div class="card card-sm text-center border-warning">
                        <div class="card-body py-2">
                            <div class="h3 mb-0 text-warning">${holidayDays}</div>
                            <div class="text-muted small">${t('employeeDashboard.holidayStat')}</div>
                        </div>
                    </div>
                </div>
                <div class="col-3">
                    <div class="card card-sm text-center">
                        <div class="card-body py-2">
                            <div class="h3 mb-0 text-muted">${unsetDays}</div>
                            <div class="text-muted small">${t('employeeDashboard.unset')}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Calendar grid -->
            <div class="sched-calendar">
                <div class="row g-0 mb-1">
                    ${t('employeeDashboard.daysShort').map(d =>
                        `<div class="col text-center text-muted small fw-semibold py-1">${d}</div>`
                    ).join('')}
                </div>
                <div class="row g-1" id="my-sched-grid">
                    ${this._buildCalendarGrid(daysInMonth, schedMap, shiftMap)}
                </div>
            </div>

            <!-- Schedule list for current month -->
            <div class="mt-3">
                <h6 class="text-muted mb-2">${t('employeeDashboard.scheduleDetails')}</h6>
                <div class="table-responsive">
                    <table class="table table-sm table-hover">
                        <thead>
                            <tr>
                                <th>${t('employeeDashboard.date')}</th>
                                <th>${t('employeeDashboard.day')}</th>
                                <th>${t('employeeDashboard.type')}</th>
                                <th>${t('employeeDashboard.shift')}</th>
                                <th>${t('employeeDashboard.notes')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this._buildScheduleList(daysInMonth, schedMap, shiftMap)}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;

        this._attachListeners();
    }

    _buildCalendarGrid(daysInMonth, schedMap, shiftMap) {
        const firstDow = new Date(this.year, this.month - 1, 1).getDay(); // 0=Sun
        let html = '';

        // Empty cells before first day
        for (let i = 0; i < firstDow; i++) {
            html += `<div class="col" style="min-height:52px;"></div>`;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const entry = schedMap[d];
            const dow = new Date(this.year, this.month - 1, d).getDay();
            const isWeekend = dow === 0 || dow === 6;
            const isToday = (new Date().getFullYear() === this.year && new Date().getMonth() + 1 === this.month && new Date().getDate() === d);

            let bgClass = isWeekend ? 'bg-light' : '';
            let typeLabel = '';
            let typeClass = 'text-muted';

            if (entry) {
                if (entry.scheduleType === 'work') {
                    bgClass = 'bg-success-lt';
                    typeLabel = t('employeeDashboard.labelWork');
                    typeClass = 'text-success fw-bold';
                } else if (entry.scheduleType === 'off') {
                    bgClass = 'bg-danger-lt';
                    typeLabel = t('employeeDashboard.labelOff');
                    typeClass = 'text-danger fw-bold';
                } else if (entry.scheduleType === 'holiday') {
                    bgClass = 'bg-warning-lt';
                    typeLabel = t('employeeDashboard.labelHoliday');
                    typeClass = 'text-warning fw-bold';
                }
            }

            const shiftInfo = entry && entry.shiftId && shiftMap[entry.shiftId]
                ? `<div style="font-size:9px;" class="text-muted">${this.escHtml(shiftMap[entry.shiftId].start_time)}</div>`
                : '';

            html += `<div class="col">
                <div class="rounded p-1 text-center ${bgClass} ${isToday ? 'border border-primary' : ''}" style="min-height:52px; font-size:12px;">
                    <div class="fw-semibold ${isToday ? 'text-primary' : ''}">${d}</div>
                    <div class="${typeClass}" style="font-size:11px;">${typeLabel}</div>
                    ${shiftInfo}
                </div>
            </div>`;
        }

        // Fill remaining cells to complete the last row
        const totalCells = firstDow + daysInMonth;
        const remainder = totalCells % 7;
        if (remainder !== 0) {
            for (let i = 0; i < 7 - remainder; i++) {
                html += `<div class="col" style="min-height:52px;"></div>`;
            }
        }

        return html;
    }

    _buildScheduleList(daysInMonth, schedMap, shiftMap) {
        const dayNames = t('employeeDashboard.daysFull');
        let rows = '';
        for (let d = 1; d <= daysInMonth; d++) {
            const entry = schedMap[d];
            if (!entry) continue; // Only show days with explicit schedule
            const dow = new Date(this.year, this.month - 1, d).getDay();
            const dateStr = `${this.year}-${String(this.month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const typeBadge = entry.scheduleType === 'work'
                ? `<span class="badge bg-success-lt text-success">${t('employeeDashboard.work')}</span>`
                : entry.scheduleType === 'off'
                ? `<span class="badge bg-danger-lt text-danger">${t('employeeDashboard.dayOff')}</span>`
                : `<span class="badge bg-warning-lt text-warning">${t('employeeDashboard.holidayStat')}</span>`;
            const shift = entry.shiftId && shiftMap[entry.shiftId]
                ? `${this.escHtml(entry.shiftId)} (${this.escHtml(shiftMap[entry.shiftId].start_time)}–${this.escHtml(shiftMap[entry.shiftId].end_time)})`
                : entry.shiftId ? this.escHtml(entry.shiftId) : '<span class="text-muted">—</span>';
            rows += `<tr>
                <td>${dateStr}</td>
                <td>${dayNames[dow]}</td>
                <td>${typeBadge}</td>
                <td>${shift}</td>
                <td>${this.escHtml(entry.notes || '')}</td>
            </tr>`;
        }
        return rows || `<tr><td colspan="5" class="text-center text-muted py-3">${t('employeeDashboard.noScheduleForMonth')}</td></tr>`;
    }

    _renderLoading() {
        const container = document.getElementById('employee-schedule-container');
        if (!container) return;
        container.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted small">${t('scheduleManagement.loading')}</p>
        </div>`;
    }

    _renderError(msg) {
        const container = document.getElementById('employee-schedule-container');
        if (!container) return;
        container.innerHTML = `
        <div class="alert alert-danger alert-sm">${this.escHtml(msg)}</div>
        <button class="btn btn-sm btn-primary js-my-sched-reload">${t('retry')}</button>`;
        container.querySelector('.js-my-sched-reload')?.addEventListener('click', () => this.loadData());
    }

    _attachListeners() {
        const container = document.getElementById('employee-schedule-container');
        if (!container) return;

        container.querySelector('.js-my-sched-prev')?.addEventListener('click', () => {
            this.month--;
            if (this.month < 1) { this.month = 12; this.year--; }
            this.scheduleData = null;
            this.loadData();
        });
        container.querySelector('.js-my-sched-next')?.addEventListener('click', () => {
            this.month++;
            if (this.month > 12) { this.month = 1; this.year++; }
            this.scheduleData = null;
            this.loadData();
        });
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
}
