// DailyAttendance.js - Daily attendance component
export class DailyAttendance {
    constructor(state, setState, callGas) {
        this.state = state;
        this.setState = setState;
        this.callGas = callGas;
    }

    async loadData(dateStr) {
        this.setState({ dailyAttendanceLoading: true, dailyAttendanceLoaded: false, dailyAttendanceError: '' });
        try {
            const res = await this.callGas('getDailyAttendance', this.state.token, dateStr);
            if (res && res.status === 'success' && res.data) {
                this.setState({
                    dailyAttendance: res.data,
                    dailyAttendanceLoading: false,
                    dailyAttendanceLoaded: true
                });
            } else {
                this.setState({
                    dailyAttendanceLoading: false,
                    dailyAttendanceLoaded: false,
                    dailyAttendanceError: res?.message || 'Failed to load attendance data.'
                });
            }
        } catch (err) {
            const msg = (err && (err.message || err.toString())) || 'Unknown error';
            this.setState({
                dailyAttendanceLoading: false,
                dailyAttendanceLoaded: false,
                dailyAttendanceError: msg
            });
        }
    }

    render() {
        const { dailyAttendance, dailyAttendanceLoading, dailyAttendanceLoaded, dailyAttendanceError, attFilterStatus, attFilterGroup, attFilterShift, attSearch, attPage, attPageSize, geofenceRadius } = this.state;
        
        // Update summary cards
        const s = dailyAttendance.summary;
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        if (dailyAttendanceLoaded) {
            const total = (s.tepatWaktu || 0) + (s.terlambat || 0) + (s.pulangAwal || 0) + (s.belumAbsen || 0);
            const pct = (val) => total > 0 ? `${Math.round((val / total) * 100)}%` : '0%';
            setEl('att-stat-ontime', pct(s.tepatWaktu));
            setEl('att-stat-late', pct(s.terlambat));
            setEl('att-stat-absent', pct(s.pulangAwal));
            setEl('att-stat-notpresent', pct(s.belumAbsen));
        } else {
            ['att-stat-ontime','att-stat-late','att-stat-absent','att-stat-notpresent']
                .forEach(id => setEl(id, '—'));
        }

        // Update load button
        const spinner = document.getElementById('attendance-load-spinner');
        const icon = document.getElementById('attendance-load-icon');
        const btn = document.getElementById('btn-load-attendance');
        if (spinner) spinner.style.display = dailyAttendanceLoading ? 'inline-block' : 'none';
        if (icon) icon.style.display = dailyAttendanceLoading ? 'none' : 'inline-block';
        if (btn) btn.disabled = dailyAttendanceLoading;

        // Sync page size select
        const pageSizeEl = document.getElementById('att-page-size');
        if (pageSizeEl && parseInt(pageSizeEl.value, 10) !== attPageSize) {
            pageSizeEl.value = String(attPageSize);
        }

        // Render table
        const table = document.getElementById('admin-attendance-table');
        if (!table) return;

        if (dailyAttendanceLoading) {
            table.innerHTML = [1,2,3,4,5].map(() =>
                `<tr><td colspan="9"><div class="placeholder-glow"><span class="placeholder col-12 rounded"></span></div></td></tr>`
            ).join('');
            this.renderPagination(0, 0);
            return;
        }

        if (!dailyAttendanceLoaded) {
            if (dailyAttendanceError) {
                table.innerHTML = `<tr><td colspan="9" class="text-center py-5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler mb-2 d-block mx-auto text-danger" width="40" height="40" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" /><path d="M12 16h.01" /></svg>
                    <p class="text-danger fw-semibold mb-1">Failed to load attendance</p>
                    <p class="text-muted small mb-3">${this.escHtml(dailyAttendanceError)}</p>
                    <button class="btn btn-sm btn-primary js-att-retry">Retry</button>
                </td></tr>`;
            } else {
                table.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler mb-2 d-block mx-auto text-muted" width="40" height="40" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 5m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /><path d="M16 3l0 4" /><path d="M8 3l0 4" /><path d="M4 11l16 0" /></svg>
                    Select a date and click load to view attendance
                </td></tr>`;
            }
            this.renderPagination(0, 0);
            return;
        }

        // Apply filters
        const filterStatus = attFilterStatus;
        const filterGroup  = attFilterGroup;
        const filterShift  = attFilterShift;
        const searchTerm = (attSearch || '').toLowerCase().trim();

        const filtered = dailyAttendance.records.filter(r => {
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

        const total = filtered.length;
        const pageSize = attPageSize;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const page = Math.min(attPage, totalPages);
        const start = (page - 1) * pageSize;
        const end = Math.min(start + pageSize, total);
        const pageSlice = filtered.slice(start, end);

        // Result count
        const countEl = document.getElementById('att-result-count');
        if (countEl) {
            countEl.textContent = total > 0
                ? `Showing ${start + 1}–${end} of ${total} employee${total !== 1 ? 's' : ''}`
                : '';
        }

        if (total === 0) {
            table.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">No records match the current filter.</td></tr>`;
            this.renderPagination(0, 0);
            return;
        }

        table.innerHTML = pageSlice.map((r, idx) => {
            const rowNum = start + idx + 1;
            const inStatusBadge = this.attStatusBadge(r.checkInStatus);
            const outStatusBadge = r.checkOutTime ? this.attStatusBadge(r.checkOutStatus) : '<span class="text-muted">—</span>';
            const locationBadge = this.locationBadge(r, geofenceRadius);
            const rowClass = r.checkInStatus === 'Tidak Hadir' ? 'table-light text-muted' : '';
            return `<tr class="${rowClass}">
                <td class="text-muted">${rowNum}</td>
                <td>
                    <div class="fw-semibold">${this.escHtml(r.employeeName)}</div>
                    <div class="text-muted small">${this.escHtml(r.employeeId)}</div>
                </td>
                <td>${this.escHtml(r.position)}</td>
                <td>
                    <span class="badge bg-secondary-lt">${this.escHtml(r.shiftId)}</span>
                    <div class="text-muted small">${this.escHtml(r.shiftStart)} – ${this.escHtml(r.shiftEnd)}</div>
                </td>
                <td>${r.checkInTime ? `<span class="fw-medium">${this.escHtml(r.checkInTime)}</span>` : '<span class="text-muted">—</span>'}</td>
                <td>${inStatusBadge}</td>
                <td>${r.checkOutTime ? `<span class="fw-medium">${this.escHtml(r.checkOutTime)}</span>` : '<span class="text-muted">—</span>'}</td>
                <td>${outStatusBadge}</td>
                <td>${locationBadge}</td>
            </tr>`;
        }).join('');

        this.renderPagination(page, totalPages);
    }

    renderPagination(page, totalPages) {
        const container = document.getElementById('att-pagination');
        if (!container) return;

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        const delta = 2;
        const rangeStart = Math.max(1, page - delta);
        const rangeEnd = Math.min(totalPages, page + delta);

        let pages = '';

        if (rangeStart > 1) {
            pages += this.paginationBtn(1, page, '1');
            if (rangeStart > 2) pages += `<li class="page-item disabled"><span class="page-link">…</span></li>`;
        }
        for (let i = rangeStart; i <= rangeEnd; i++) {
            pages += this.paginationBtn(i, page, String(i));
        }
        if (rangeEnd < totalPages) {
            if (rangeEnd < totalPages - 1) pages += `<li class="page-item disabled"><span class="page-link">…</span></li>`;
            pages += this.paginationBtn(totalPages, page, String(totalPages));
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

    paginationBtn(pageNum, currentPage, label) {
        const active = pageNum === currentPage ? 'active' : '';
        return `<li class="page-item page-number ${active}">
            <button class="page-link js-att-page" data-page="${pageNum}">${label}</button>
        </li>`;
    }

    attStatusBadge(status) {
        const map = {
            'Tepat Waktu': 'bg-success text-white',
            'Terlambat': 'bg-warning text-white',
            'Pulang Awal': 'bg-danger text-white',
            'Tidak Hadir': 'bg-secondary text-white'
        };
        const labelMap = {
            'Tepat Waktu': 'Tepat Waktu',
            'Terlambat': 'Terlambat',
            'Pulang Awal': 'Pulang Awal',
            'Tidak Hadir': 'Tidak Hadir'
        };
        if (!status) return '<span class="text-muted">—</span>';
        const cls = map[status] || 'bg-secondary';
        const label = labelMap[status] || this.escHtml(status);
        return `<span class="badge ${cls}">${label}</span>`;
    }

    /**
     * Render a location indicator badge for an attendance record.
     *
     * Logic:
     *  - source === "admin"                          → neutral "Admin Entry" badge
     *  - checkInDistance is a number                 → green "✓ In Zone" or red "✗ Out Zone"
     *    (compare against record's stored radius, or fall back to the configured geofenceRadius)
     *  - location fields empty/null or pre-geofencing → grey "N/A"
     *
     * Uses both color AND text to satisfy WCAG 1.4.1 (use of color).
     *
     * @param {Object} record - attendance record from getDailyAttendance
     * @param {number|null} configuredRadius - geofenceRadius from app state (fallback)
     * @returns {string} HTML string
     */
    locationBadge(record, configuredRadius) {
        // Admin manual entry — neutral indicator
        if (record.source === 'admin') {
            return `<span class="badge bg-secondary-lt text-secondary" aria-label="Admin Entry">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></svg>
                Admin Entry
            </span>`;
        }

        // Check if we have a numeric distance value
        const distance = record.checkInDistance;
        if (distance !== null && distance !== undefined && distance !== '' && !isNaN(Number(distance))) {
            const dist = Number(distance);
            // Use the radius stored on the record if available, otherwise fall back to configured radius
            const radius = (record.geofenceRadius !== null && record.geofenceRadius !== undefined && record.geofenceRadius !== '')
                ? Number(record.geofenceRadius)
                : configuredRadius;

            if (radius !== null && radius !== undefined && !isNaN(radius)) {
                if (dist <= radius) {
                    return `<span class="badge bg-success-lt text-success" aria-label="Within geofence zone, ${dist}m from work location">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10" /></svg>
                        In Zone
                    </span>`;
                } else {
                    return `<span class="badge bg-danger-lt text-danger" title="${dist}m (max ${radius}m)" aria-label="Outside geofence zone, ${dist}m from work location, maximum ${radius}m allowed">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
                        Out Zone
                    </span>`;
                }
            }
        }

        // No location data (pre-geofencing record, geofencing was disabled, or source is empty)
        return `<span class="text-muted small" aria-label="No location data">N/A</span>`;
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
