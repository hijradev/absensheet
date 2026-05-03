// Reports.js - Reports component with total recap and export features
import { t } from '../i18n/i18n.js';

export class Reports {
    constructor(state, setState, callGas) {
        this.state = state;
        this.setState = setState;
        this.callGas = callGas;
        this.currentPage = 1;
        this.pageSize = 25;
        this.searchQuery = '';
        this.filteredData = [];
        this.allReportData = [];
    }

    async loadData() {
        const period = document.getElementById('report-period-filter')?.value || 'monthly';
        if (period === 'custom') {
            const startDate = document.getElementById('report-date-start')?.value || '';
            const endDate   = document.getElementById('report-date-end')?.value   || '';
            if (!startDate || !endDate) return;
            await this.loadReportData(startDate, endDate);
        } else {
            await this.loadReportData(period);
        }
    }

    async loadReportData(startDateOrPeriod, endDate) {
        const spinner = document.getElementById('report-load-spinner');
        const icon = document.getElementById('report-load-icon');
        const tableBody = document.getElementById('report-table-body');

        if (spinner) spinner.style.display = 'inline-block';
        if (icon) icon.style.display = 'none';

        // Show skeletons in table
        if (tableBody) {
            tableBody.innerHTML = [1, 2, 3, 4, 5].map(() => `
                <tr>
                    <td colspan="8">
                        <div class="placeholder-glow"><span class="placeholder col-12 rounded"></span></div>
                    </td>
                </tr>
            `).join('');
        }

        try {
            let res;
            if (endDate) {
                res = await this.callGas('getReportData', this.state.token, startDateOrPeriod, endDate);
            } else {
                res = await this.callGas('getReportData', this.state.token, startDateOrPeriod);
            }
            if (res && res.status === 'success') {
                this.allReportData = res.data.reportData || [];
                this.filteredData = [...this.allReportData];
                this.currentPage = 1;

                // Update summary stats
                this.updateSummaryStats(res.data.summary);

                // Update period label
                const periodLabel = document.getElementById('report-period-label');
                if (periodLabel) {
                    if (endDate) {
                        periodLabel.textContent = `${startDateOrPeriod} — ${endDate}`;
                    } else {
                        periodLabel.textContent = startDateOrPeriod.charAt(0).toUpperCase() + startDateOrPeriod.slice(1);
                    }
                }

                this.render();
            } else {
                this.showError(res?.message || 'Failed to load report data.');
            }
        } catch (error) {
            this.showError('Failed to load report data.');
        } finally {
            if (spinner) spinner.style.display = 'none';
            if (icon) icon.style.display = 'inline-block';
        }
    }

    updateSummaryStats(summary) {
        const setEl = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val || '0%';
        };
        
        const onTime = summary?.totalOnTime || 0;
        const late = summary?.totalLate || 0;
        const absent = summary?.totalAbsent || 0;
        const total = onTime + late + absent;
        const pct = (val) => total > 0 ? `${Math.round((val / total) * 100)}%` : '0%';

        setEl('report-stat-ontime', pct(onTime));
        setEl('report-stat-late', pct(late));
        setEl('report-stat-absent', pct(absent));
    }

    render() {
        const tbody = document.getElementById('report-table-body');
        if (!tbody) return;

        if (this.filteredData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">${t('noData')}</td></tr>`;
            this.updateResultCount(0, 0);
            return;
        }

        // Pagination
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        const pageData = this.filteredData.slice(start, end);

        tbody.innerHTML = pageData.map((row, idx) => `
            <tr>
                <td class="text-muted">${start + idx + 1}</td>
                <td>${this.escHtml(row.employeeId)}</td>
                <td>${this.escHtml(row.employeeName)}</td>
                <td>${this.escHtml(row.position)}</td>
                <td class="text-center text-success fw-bold">${this.escHtml(row.onTime)}</td>
                <td class="text-center text-warning fw-bold">${this.escHtml(row.late)}</td>
                <td class="text-center text-danger fw-bold">${this.escHtml(row.absent)}</td>
                <td class="text-center fw-bold">${this.escHtml(row.totalDays)}</td>
            </tr>
        `).join('');

        this.renderPagination();
        this.updateResultCount(start + 1, Math.min(end, this.filteredData.length));
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
        const paginationEl = document.getElementById('report-pagination');
        if (!paginationEl) return;

        if (totalPages <= 1) {
            paginationEl.innerHTML = '';
            return;
        }

        let html = '<ul class="pagination pagination-sm m-0">';
        
        // Previous button
        html += `<li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${this.currentPage - 1}">
                <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 6l-6 6l6 6" /></svg>
            </a>
        </li>`;

        // Page numbers
        const maxVisible = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (startPage > 1) {
            html += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
            if (startPage > 2) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `<li class="page-item ${i === this.currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            html += `<li class="page-item"><a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a></li>`;
        }

        // Next button
        html += `<li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${this.currentPage + 1}">
                <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="18" height="18" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 6l6 6l-6 6" /></svg>
            </a>
        </li>`;
        
        html += '</ul>';
        paginationEl.innerHTML = html;

        // Add click handlers
        paginationEl.querySelectorAll('a.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(link.dataset.page);
                if (page && page !== this.currentPage && page >= 1 && page <= totalPages) {
                    this.currentPage = page;
                    this.render();
                }
            });
        });
    }

    updateResultCount(start, end) {
        const countEl = document.getElementById('report-result-count');
        if (countEl) {
            const total = this.filteredData.length;
            countEl.textContent = total > 0 ? `${t('show')} ${start}-${end} ${t('of')} ${total} ${t('records')}` : '';
        }
    }

    handleSearch(query) {
        this.searchQuery = query.toLowerCase();
        this.filteredData = this.allReportData.filter(row => 
            row.employeeId.toLowerCase().includes(this.searchQuery) ||
            row.employeeName.toLowerCase().includes(this.searchQuery) ||
            row.position.toLowerCase().includes(this.searchQuery)
        );
        this.currentPage = 1;
        this.render();
    }

    handlePageSizeChange(newSize) {
        this.pageSize = parseInt(newSize);
        this.currentPage = 1;
        this.render();
    }

    exportCSV() {
        const period = document.getElementById('report-period-filter')?.value || 'monthly';
        let rangeLabel, fileSuffix;
        if (period === 'custom') {
            const s = document.getElementById('report-date-start')?.value || 'start';
            const e = document.getElementById('report-date-end')?.value || 'end';
            rangeLabel = `${s} ${t('rangeTo')} ${e}`;
            fileSuffix = `${s}_${e}`;
        } else {
            rangeLabel = period.charAt(0).toUpperCase() + period.slice(1);
            fileSuffix = period;
        }

        let csv = `${this.state.organizationName || t('attendanceReports')} - ${rangeLabel}\n\n`;
        csv += `${t('employeeIdCol')},${t('employeeNameCol')},${t('position')},${t('onTime')},${t('late')},${t('absent')},${t('totalDays')}\n`;

        this.filteredData.forEach(row => {
            csv += `"${row.employeeId}","${row.employeeName}","${row.position}",${row.onTime},${row.late},${row.absent},${row.totalDays}\n`;
        });

        this.downloadFile(csv, `attendance-report-${fileSuffix}.csv`, 'text/csv');
    }

    exportExcel() {
        const period = document.getElementById('report-period-filter')?.value || 'monthly';
        let rangeLabel, fileSuffix;
        if (period === 'custom') {
            const s = document.getElementById('report-date-start')?.value || 'start';
            const e = document.getElementById('report-date-end')?.value || 'end';
            rangeLabel = `${s} ${t('rangeTo')} ${e}`;
            fileSuffix = `${s}_${e}`;
        } else {
            rangeLabel = period.charAt(0).toUpperCase() + period.slice(1);
            fileSuffix = period;
        }

        let html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
            <head><meta charset="UTF-8"><style>table { border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 8px; } th { background-color: #f2f2f2; font-weight: bold; }</style></head>
            <body>
                <h2>${this.state.organizationName || t('attendanceReports')} - ${rangeLabel}</h2>
                <table>
                    <thead>
                        <tr>
                            <th>${t('employeeIdCol')}</th>
                            <th>${t('employeeNameCol')}</th>
                            <th>${t('position')}</th>
                            <th>${t('onTime')}</th>
                            <th>${t('late')}</th>
                            <th>${t('absent')}</th>
                            <th>${t('totalDays')}</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        this.filteredData.forEach(row => {
            html += `
                <tr>
                    <td>${this.escHtml(row.employeeId)}</td>
                    <td>${this.escHtml(row.employeeName)}</td>
                    <td>${this.escHtml(row.position)}</td>
                    <td>${row.onTime}</td>
                    <td>${row.late}</td>
                    <td>${row.absent}</td>
                    <td>${row.totalDays}</td>
                </tr>
            `;
        });

        html += '</tbody></table></body></html>';

        this.downloadFile(html, `attendance-report-${fileSuffix}.xls`, 'application/vnd.ms-excel');
    }

    exportPDF() {
        if (this.filteredData.length === 0) {
            this.setState({ errorMessage: t('noData') });
            return;
        }

        const period = document.getElementById('report-period-filter')?.value || 'monthly';
        let rangeLabel;
        if (period === 'custom') {
            const s = document.getElementById('report-date-start')?.value || 'start';
            const e = document.getElementById('report-date-end')?.value || 'end';
            rangeLabel = `${s} ${t('rangeTo')} ${e}`;
        } else {
            rangeLabel = period.charAt(0).toUpperCase() + period.slice(1);
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            this.setState({ errorMessage: t('popupBlocked') });
            return;
        }

        const rows = this.filteredData.map((row, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${this.escHtml(row.employeeId)}</td>
                <td>${this.escHtml(row.employeeName)}</td>
                <td>${this.escHtml(row.position)}</td>
                <td class="text-center">${row.onTime}</td>
                <td class="text-center">${row.late}</td>
                <td class="text-center">${row.absent}</td>
                <td class="text-center">${row.totalDays}</td>
            </tr>
        `).join('');

        printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
    <title>${t('attendanceReports')}</title>
    <style>
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; color: #1e293b; }
        h2 { text-align: center; margin-bottom: 5px; color: #0f172a; }
        p.subtitle { text-align: center; margin-bottom: 30px; color: #64748b; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
        th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
        th { background-color: #f8fafc; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.025em; }
        .text-center { text-align: center; }
        @media print { 
            body { padding: 0; }
            button { display: none; }
        }
    </style>
</head>
<body>
    <h2>${this.state.organizationName || t('attendanceReports')}</h2>
    <p class="subtitle">${t('periodLabel')}: ${rangeLabel}</p>
    <table>
        <thead>
            <tr>
                <th style="width: 40px;">#</th>
                <th>${t('employeeIdCol')}</th>
                <th>${t('employeeNameCol')}</th>
                <th>${t('position')}</th>
                <th class="text-center">${t('onTime')}</th>
                <th class="text-center">${t('late')}</th>
                <th class="text-center">${t('absent')}</th>
                <th class="text-center">${t('totalDays')}</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    </table>
    <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); }<\/script>
</body>
</html>`);
        printWindow.document.close();
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    getDateString() {
        const now = new Date();
        return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    }

    showError(message) {
        const tbody = document.getElementById('report-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">${this.escHtml(message || t('failedToLoadData'))}</td></tr>`;
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

    destroy() {
        // Cleanup if needed
    }
}
