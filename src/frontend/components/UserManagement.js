// UserManagement.js - User management component
export class UserManagement {
    constructor(state, setState, callGas) {
        this.state = state;
        this.setState = setState;
        this.callGas = callGas;
        
        // Pagination and filter state
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.searchQuery = '';
        this.roleFilter = 'all';
    }

    async loadData() {
        if (this.state.managementLoaded || this.state.managementLoading) return;
        
        this.setState({ managementLoading: true });
        try {
            const res = await this.callGas('getAdminInitialData', this.state.token);
            if (res && res.status === 'success') {
                this.setState({
                    adminManagement: res.data,
                    managementLoaded: true,
                    managementLoading: false
                });
                this.render();
            } else {
                this.setState({ 
                    managementLoading: false, 
                    errorMessage: res?.message || 'Failed to load management data.' 
                });
            }
        } catch {
            this.setState({ 
                managementLoading: false, 
                errorMessage: 'Connection error while loading management data.' 
            });
        }
    }

    getFilteredUsers() {
        const { adminManagement } = this.state;
        if (!adminManagement || !adminManagement.employees) return [];
        
        let filtered = [...adminManagement.employees].reverse();
        
        // Apply search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(u => 
                u.id.toLowerCase().includes(query) ||
                u.name.toLowerCase().includes(query) ||
                (u.role && u.role.toLowerCase().includes(query))
            );
        }
        
        // Apply role filter
        if (this.roleFilter !== 'all') {
            filtered = filtered.filter(u => u.role === this.roleFilter);
        }
        
        return filtered;
    }

    getPaginatedUsers() {
        const filtered = this.getFilteredUsers();
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        return filtered.slice(startIndex, endIndex);
    }

    getTotalPages() {
        const filtered = this.getFilteredUsers();
        return Math.ceil(filtered.length / this.itemsPerPage);
    }

    getUniqueRoles() {
        const { adminManagement } = this.state;
        if (!adminManagement || !adminManagement.employees) return [];
        
        const roles = new Set();
        adminManagement.employees.forEach(u => {
            if (u.role) roles.add(u.role);
        });
        return Array.from(roles).sort();
    }

    render() {
        const table = document.getElementById('admin-users-table');
        if (!table) return;

        const { adminManagement, managementLoading, dataLoaded } = this.state;

        if (managementLoading || !dataLoaded) {
            table.innerHTML = [1, 2, 3].map(() =>
                `<tr><td colspan="5"><div class="placeholder-glow"><span class="placeholder col-12 rounded"></span></div></td></tr>`
            ).join('');
        } else if (!adminManagement.employees || adminManagement.employees.length === 0) {
            table.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">${this.t('noUsersFound')}</td></tr>`;
        } else {
            const paginatedUsers = this.getPaginatedUsers();
            
            if (paginatedUsers.length === 0) {
                table.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">${this.t('noUsersMatchFilter')}</td></tr>`;
            } else {
                table.innerHTML = paginatedUsers.map(u => `
                    <tr>
                        <td><img src="${this.escHtml(u.photo_url || this.svgAvatar(40))}" class="avatar avatar-sm" alt="" onerror="this.src='${this.svgAvatar(40)}'"></td>
                        <td>${this.escHtml(u.id)}</td>
                        <td>${this.escHtml(u.name)}</td>
                        <td>${this.escHtml(u.role)}</td>
                        <td>
                            <button class="btn btn-icon btn-sm btn-ghost-primary js-edit-user" data-id="${this.escHtml(u.id)}" aria-label="Edit user">${this.iconEdit()}</button>
                            <button class="btn btn-icon btn-sm btn-ghost-danger js-delete-user" data-id="${this.escHtml(u.id)}" aria-label="Delete user">${this.iconDelete()}</button>
                        </td>
                    </tr>`).join('');
            }
            
            this.renderPagination();
            this.renderStats();
        }
    }

    renderPagination() {
        const paginationContainer = document.getElementById('user-pagination');
        if (!paginationContainer) return;

        const totalPages = this.getTotalPages();
        const filteredCount = this.getFilteredUsers().length;
        const totalCount = this.state.adminManagement.employees.length;
        
        if (totalPages <= 1) {
            paginationContainer.innerHTML = `
                <div class="text-muted small">
                    ${this.t('show')} ${filteredCount} ${this.t('of')} ${totalCount} ${this.t('records')}
                </div>
            `;
            return;
        }

        const startIndex = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endIndex = Math.min(this.currentPage * this.itemsPerPage, filteredCount);

        let paginationHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div class="text-muted small">
                    ${this.t('show')} ${startIndex}-${endIndex} ${this.t('of')} ${filteredCount} ${this.t('records')}
                </div>
                <ul class="pagination m-0">
                    <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
                        <a class="page-link js-user-page-prev" href="#" tabindex="${this.currentPage === 1 ? '-1' : '0'}">
                            ${this.iconChevronLeft()} ${this.t('previous')}
                        </a>
                    </li>
        `;

        // Page numbers
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            paginationHTML += `
                <li class="page-item page-number">
                    <a class="page-link js-user-page" href="#" data-page="1">1</a>
                </li>
            `;
            if (startPage > 2) {
                paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <li class="page-item page-number ${i === this.currentPage ? 'active' : ''}">
                    <a class="page-link js-user-page" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
            paginationHTML += `
                <li class="page-item page-number">
                    <a class="page-link js-user-page" href="#" data-page="${totalPages}">${totalPages}</a>
                </li>
            `;
        }

        paginationHTML += `
                    <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
                        <a class="page-link js-user-page-next" href="#" tabindex="${this.currentPage === totalPages ? '-1' : '0'}">
                            ${this.t('next')} ${this.iconChevronRight()}
                        </a>
                    </li>
                </ul>
            </div>
        `;

        paginationContainer.innerHTML = paginationHTML;
        this.attachPaginationListeners();
    }

    renderStats() {
        const statsContainer = document.getElementById('user-stats');
        if (!statsContainer) return;

        const filteredUsers = this.getFilteredUsers();
        const roleCount = {};
        
        filteredUsers.forEach(u => {
            const role = u.role || 'Unknown';
            roleCount[role] = (roleCount[role] || 0) + 1;
        });

        const statsHTML = Object.entries(roleCount)
            .map(([role, count]) => `
                <span class="badge bg-blue-lt me-2">${this.escHtml(role)}: ${count}</span>
            `).join('');

        statsContainer.innerHTML = statsHTML || '<span class="text-muted small">No data</span>';
    }

    attachPaginationListeners() {
        // Previous button
        const prevBtn = document.querySelector('.js-user-page-prev');
        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.render();
                }
            });
        }

        // Next button
        const nextBtn = document.querySelector('.js-user-page-next');
        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.currentPage < this.getTotalPages()) {
                    this.currentPage++;
                    this.render();
                }
            });
        }

        // Page number buttons
        document.querySelectorAll('.js-user-page').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(btn.dataset.page);
                if (page !== this.currentPage) {
                    this.currentPage = page;
                    this.render();
                }
            });
        });
    }

    setupFilters() {
        // Search input
        const searchInput = document.getElementById('user-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.currentPage = 1; // Reset to first page
                this.render();
            });
        }

        // Role filter
        const roleFilter = document.getElementById('user-role-filter');
        if (roleFilter) {
            roleFilter.addEventListener('change', (e) => {
                this.roleFilter = e.target.value;
                this.currentPage = 1; // Reset to first page
                this.render();
            });
        }

        // Items per page
        const itemsPerPageSelect = document.getElementById('user-items-per-page');
        if (itemsPerPageSelect) {
            itemsPerPageSelect.addEventListener('change', (e) => {
                this.itemsPerPage = parseInt(e.target.value);
                this.currentPage = 1; // Reset to first page
                this.render();
            });
        }

        // Export button
        const exportBtn = document.getElementById('user-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportToCSV());
        }

        // Print button
        const printBtn = document.getElementById('user-print-btn');
        if (printBtn) {
            printBtn.addEventListener('click', () => this.printUsers());
        }
    }

    exportToCSV() {
        const users = this.getFilteredUsers();
        if (users.length === 0) {
            alert(this.t('noDataToExport'));
            return;
        }

        // CSV headers
        const headers = ['ID', 'Name', 'Role'];
        const csvContent = [
            headers.join(','),
            ...users.map(u => [
                this.escapeCSV(u.id),
                this.escapeCSV(u.name),
                this.escapeCSV(u.role || '')
            ].join(','))
        ].join('\n');

        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `users_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    printUsers() {
        const users = this.getFilteredUsers();
        if (users.length === 0) {
            alert(this.t('noDataToPrint'));
            return;
        }

        const printWindow = window.open('', '_blank');
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>User Management - Print</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                    }
                    h1 {
                        color: #333;
                        border-bottom: 2px solid #333;
                        padding-bottom: 10px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 12px;
                        text-align: left;
                    }
                    th {
                        background-color: #f8f9fa;
                        font-weight: bold;
                    }
                    tr:nth-child(even) {
                        background-color: #f8f9fa;
                    }
                    .print-date {
                        color: #666;
                        font-size: 14px;
                        margin-top: 10px;
                    }
                    @media print {
                        body {
                            padding: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <h1>${this.t('userManagement')}</h1>
                <div class="print-date">Printed on: ${new Date().toLocaleString()}</div>
                <table>
                    <thead>
                        <tr>
                            <th>${this.t('id')}</th>
                            <th>${this.t('name')}</th>
                            <th>${this.t('role')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(u => `
                            <tr>
                                <td>${this.escHtml(u.id)}</td>
                                <td>${this.escHtml(u.name)}</td>
                                <td>${this.escHtml(u.role || '')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();
    }

    escapeCSV(str) {
        if (str === null || str === undefined) return '';
        const s = String(str);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    }

    t(key) {
        // Translation helper - assumes window.T exists
        return window.T ? window.T(key) : key;
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

    svgAvatar(size) {
        return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'%3E%3Crect width='${size}' height='${size}' fill='%23e2e8f0'/%3E%3Ccircle cx='${size/2}' cy='${size*0.4}' r='${size*0.22}' fill='%2394a3b8'/%3E%3Cellipse cx='${size/2}' cy='${size*0.9}' rx='${size*0.35}' ry='${size*0.26}' fill='%2394a3b8'/%3E%3C/svg%3E`;
    }

    iconEdit() {
        return `<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /></svg>`;
    }

    iconDelete() {
        return `<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>`;
    }

    iconChevronLeft() {
        return `<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><polyline points="15 6 9 12 15 18" /></svg>`;
    }

    iconChevronRight() {
        return `<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><polyline points="9 6 15 12 9 18" /></svg>`;
    }
}
