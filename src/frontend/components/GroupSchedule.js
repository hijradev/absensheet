// GroupSchedule.js - Group-level schedule view for admin
import { t } from '../i18n/i18n.js';

export class GroupSchedule {
    constructor(state, setState, callGas) {
        this.state = state;
        this.setState = setState;
        this.callGas = callGas;

        // View state
        this.year = new Date().getFullYear();
        this.month = new Date().getMonth() + 1; // 1-12
        this.filterGroup = '';    // Selected group ID or '' for all
        this.filterShift = '';    // Selected shift ID or '' for all
        this.loading = false;

        // Data
        this.groupScheduleData = null;
        // Structure: { groups, shifts, schedules, year, month }
        // groups: Array<{ id: string, name: string }>
        // shifts: Array<{ id: string, start_time: string, end_time: string, color: string }>
        // schedules: Array<{ groupId: string, day: number, shiftIds: string[] }>
    }

    async loadData() {
        if (this.loading) return;
        this.loading = true;
        this._renderLoading();
        try {
            const res = await this.callGas('getGroupScheduleSummary', this.state.token, this.year, this.month);
            if (res && res.status === 'success') {
                this.groupScheduleData = res.data;
                this.loading = false;
                this.render();
            } else {
                this.loading = false;
                this._renderError(res?.message || this.t('groupSchedule.failedToLoad'));
            }
        } catch (e) {
            this.loading = false;
            this._renderError(this.t('groupSchedule.connectionError'));
        }
    }

    render() {
        const container = document.getElementById('admin-view-group-schedule');
        if (!container) return;

        if (!this.groupScheduleData) {
            this.loadData();
            return;
        }

        const { groups, shifts, schedules } = this.groupScheduleData;
        const daysInMonth = new Date(this.year, this.month, 0).getDate();
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

        // Build schedule lookup: "groupId_day" -> shiftIds[]
        const schedLookup = this._buildScheduleLookup(schedules);

        // Apply filters
        let filteredGroups = groups || [];
        if (this.filterGroup) {
            filteredGroups = filteredGroups.filter(g => g.id === this.filterGroup);
        }

        const monthNames = this.t('employeeDashboard.months');

        container.innerHTML = `
        <div class="container-fluid">
            <div class="row mb-3 align-items-center">
                <div class="col">
                    <div class="page-pretitle">${this.t('adminPanel.management')}</div>
                    <h2 class="page-title">${this.t('groupSchedule.groupSchedule')}</h2>
                </div>
                <div class="col-auto d-flex gap-2 flex-wrap">
                    <button class="btn btn-outline-secondary js-gs-prev-month">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 6l-6 6l6 6" /></svg>
                    </button>
                    <span class="btn btn-outline-secondary disabled fw-semibold" style="min-width:160px; text-align:center;">
                        ${monthNames[this.month - 1]} ${this.year}
                    </span>
                    <button class="btn btn-outline-secondary js-gs-next-month">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 6l6 6l-6 6" /></svg>
                    </button>
                </div>
            </div>

            <!-- Filters -->
            <div class="card mb-3">
                <div class="card-body py-2">
                    <div class="row g-2 align-items-end">
                        <div class="col-md-4">
                            <label class="form-label mb-1 small">${this.t('groupSchedule.filterByGroup')}</label>
                            <select class="form-select form-select-sm js-gs-filter-group">
                                <option value="">${this.t('groupSchedule.allGroups')}</option>
                                ${(groups || []).map(g => `<option value="${this.escHtml(g.id)}" ${this.filterGroup === g.id ? 'selected' : ''}>${this.escHtml(g.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label mb-1 small">${this.t('groupSchedule.filterByShift')}</label>
                            <select class="form-select form-select-sm js-gs-filter-shift">
                                <option value="">${this.t('groupSchedule.allShifts')}</option>
                                ${(shifts || []).map(s => `<option value="${this.escHtml(s.id)}" ${this.filterShift === s.id ? 'selected' : ''}>${this.escHtml(this._formatTime(s.start_time))}–${this.escHtml(this._formatTime(s.end_time))}</option>`).join('')}
                            </select>
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
                                    <th class="sticky-col" style="min-width:160px; z-index:3;">${this.t('groupSchedule.group')}</th>
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
                                ${filteredGroups.length === 0
                                    ? `<tr><td colspan="${daysInMonth + 1}" class="text-center text-muted py-4">${this.t('groupSchedule.noGroupsFound')}</td></tr>`
                                    : filteredGroups.map(group => {
                                        return `<tr>
                                            <td class="sticky-col fw-semibold" style="min-width:160px; background:#fff; z-index:2;">
                                                ${this.escHtml(group.name)}
                                            </td>
                                            ${days.map(d => {
                                                const key = `${group.id}_${d}`;
                                                const shiftIds = schedLookup[key] || [];
                                                const isFiltered = this.filterShift && !shiftIds.includes(this.filterShift);
                                                return `<td class="text-center p-0${isFiltered ? ' opacity-25' : ''}" style="height:40px;">
                                                    <div class="d-flex align-items-center justify-content-center gap-1 flex-wrap px-1">
                                                        ${shiftIds.map(sid => {
                                                            const shift = (shifts || []).find(s => s.id === sid);
                                                            const color = shift?.color || '#6c757d';
                                                            const timeRange = shift ? `${this._formatTime(shift.start_time)}–${this._formatTime(shift.end_time)}` : '';
                                                            return `<span class="rounded-circle d-inline-block" style="width:12px; height:12px; background-color:${color};" title="${this.escHtml(sid)}: ${this.escHtml(timeRange)}" aria-label="Shift ${this.escHtml(sid)}"></span>`;
                                                        }).join('')}
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

            <!-- Legend -->
            <div class="card mt-3">
                <div class="card-body py-2">
                    <div class="row g-2 align-items-center">
                        <div class="col-auto">
                            <span class="text-muted small fw-semibold">${this.t('groupSchedule.legend')}</span>
                        </div>
                        <div class="col">
                            <div class="d-flex flex-wrap gap-3">
                                ${(shifts || []).map(s => `
                                    <div class="d-flex align-items-center gap-1">
                                        <span class="rounded-circle d-inline-block" style="width:12px; height:12px; background-color:${s.color};"></span>
                                        <span class="small">${this.escHtml(this._formatTime(s.start_time))}–${this.escHtml(this._formatTime(s.end_time))}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

        this._attachListeners();
    }

    _renderLoading() {
        const container = document.getElementById('admin-view-group-schedule');
        if (!container) return;
        container.innerHTML = `
        <div class="container-fluid">
            <div class="d-flex justify-content-center align-items-center py-5">
                <div class="spinner-border text-primary me-3"></div>
                <span class="text-muted">${this.t('groupSchedule.loading')}</span>
            </div>
        </div>`;
    }

    _renderError(msg) {
        const container = document.getElementById('admin-view-group-schedule');
        if (!container) return;
        container.innerHTML = `
        <div class="container-fluid">
            <div class="alert alert-danger">${this.escHtml(msg)}</div>
            <button class="btn btn-primary js-gs-reload">${this.t('common.retry') || 'Retry'}</button>
        </div>`;
        container.querySelector('.js-gs-reload')?.addEventListener('click', () => this.loadData());
    }

    _attachListeners() {
        const container = document.getElementById('admin-view-group-schedule');
        if (!container) return;

        // Month navigation
        container.querySelector('.js-gs-prev-month')?.addEventListener('click', () => {
            this.month--;
            if (this.month < 1) { this.month = 12; this.year--; }
            this.groupScheduleData = null;
            this.loadData();
        });
        container.querySelector('.js-gs-next-month')?.addEventListener('click', () => {
            this.month++;
            if (this.month > 12) { this.month = 1; this.year++; }
            this.groupScheduleData = null;
            this.loadData();
        });

        // Filters
        container.querySelector('.js-gs-filter-group')?.addEventListener('change', e => {
            this.filterGroup = e.target.value;
            this.render();
        });
        container.querySelector('.js-gs-filter-shift')?.addEventListener('change', e => {
            this.filterShift = e.target.value;
            this.render();
        });
    }

    _buildScheduleLookup(schedules) {
        const lookup = {};
        for (const s of (schedules || [])) {
            const key = `${s.groupId}_${s.day}`;
            lookup[key] = s.shiftIds;
        }
        return lookup;
    }

    _formatTime(str) {
        if (!str) return '';
        const m = String(str).match(/\d{2}:\d{2}/);
        return m ? m[0] : str;
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
}
