// LeaveManagement.js - Component for managing employee leave requests
import { t } from '../i18n/i18n.js';

export class LeaveManagement {
    constructor(state, setState, callGas, callbacks = {}) {
        this.state = state;
        this.setState = setState;
        this.callGas = callGas;
        this.callbacks = callbacks;
        
        // Pagination and filter state
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.searchQuery = '';
        this.statusFilter = 'all';
        this.leaveTypeFilter = 'all';
        this.startDateFilter = '';
        this.endDateFilter = '';
        
        // Form state
        this.editingLeave = null;
        this.formData = {
            employeeId: '',
            leaveType: 'Cuti',
            startDate: '',
            endDate: '',
            reason: ''
        };
        
        // Track if modal event listeners have been added
        this.modalEventListenersAdded = false;
        
        // Form submitting state
        this.formSubmitting = false;
    }

    async loadData() {
        this.setState({ managementLoading: true });
        try {
            // Load leave requests
            const filters = {};
            if (this.statusFilter !== 'all') filters.status = this.statusFilter;
            if (this.leaveTypeFilter !== 'all') filters.leaveType = this.leaveTypeFilter;
            if (this.startDateFilter) filters.startDate = this.startDateFilter;
            if (this.endDateFilter) filters.endDate = this.endDateFilter;
            
            const res = await this.callGas('getLeaveRequests', this.state.token, filters);
            if (res && res.status === 'success') {
                this.setState({
                    leaveRequests: res.data,
                    managementLoaded: true,
                    managementLoading: false
                });
                this.render();
            } else {
                this.setState({ 
                    managementLoading: false, 
                    errorMessage: res?.message || 'Failed to load leave requests.' 
                });
            }
        } catch {
            this.setState({ 
                managementLoading: false, 
                errorMessage: 'Connection error while loading leave requests.' 
            });
        }
    }

    async loadEmployees() {
        try {
            const res = await this.callGas('getAdminInitialData', this.state.token);
            if (res && res.status === 'success') {
                this.setState({
                    employees: res.data.employees || []
                });
            }
        } catch {
            // Silently fail - employees might already be loaded
        }
    }

    getFilteredLeaves() {
        const { leaveRequests } = this.state;
        if (!leaveRequests) return [];
        
        let filtered = [...leaveRequests];
        
        // Apply search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(leave => 
                leave.employeeId.toLowerCase().includes(query) ||
                leave.employeeName.toLowerCase().includes(query) ||
                leave.reason.toLowerCase().includes(query)
            );
        }
        
        // Apply status filter
        if (this.statusFilter !== 'all') {
            filtered = filtered.filter(leave => leave.status === this.statusFilter);
        }
        
        // Apply leave type filter
        if (this.leaveTypeFilter !== 'all') {
            filtered = filtered.filter(leave => leave.leaveType === this.leaveTypeFilter);
        }
        
        // Apply date filters
        if (this.startDateFilter) {
            filtered = filtered.filter(leave => leave.startDate >= this.startDateFilter);
        }
        
        if (this.endDateFilter) {
            filtered = filtered.filter(leave => leave.endDate <= this.endDateFilter);
        }
        
        return filtered;
    }

    getPaginatedLeaves() {
        const filtered = this.getFilteredLeaves();
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        return filtered.slice(startIndex, endIndex);
    }

    getTotalPages() {
        const filtered = this.getFilteredLeaves();
        return Math.max(1, Math.ceil(filtered.length / this.itemsPerPage));
    }

    async submitLeaveRequest() {
        // Fallback for non-admins if employeeId is missing
        if (!this.formData.employeeId && this.state.user?.role !== 'Admin') {
            this.formData.employeeId = this.state.user?.id || '';
        }

        if (!this.formData.employeeId || !this.formData.startDate || !this.formData.endDate) {
            this.setState({ errorMessage: 'Please fill in all required fields.' });
            return;
        }

        // Set form submitting state and update button
        this.setState({ formSubmitting: true });
        this.updateSubmitButton(true);
        
        try {
            const res = await this.callGas('createLeaveRequest', this.state.token, this.formData);
            if (res && res.status === 'success') {
                // Hide modal on SUCCESS BEFORE re-rendering
                const modalEl = document.getElementById('leave-form-modal');
                if (modalEl) {
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                }

                // Reset form
                this.formData = {
                    employeeId: '',
                    leaveType: 'Cuti',
                    startDate: '',
                    endDate: '',
                    reason: ''
                };
                this.editingLeave = null;
                
                // Reload data
                if (this.callbacks.onSuccess) {
                    this.callbacks.onSuccess(res);
                } else {
                    await this.loadData();
                }
                this.setState({ 
                    successMessage: res.message || 'Leave request submitted successfully.',
                    formSubmitting: false
                });
                this.updateSubmitButton(false);
            } else {
                this.setState({ 
                    formSubmitting: false, 
                    errorMessage: res?.message || 'Failed to submit leave request.' 
                });
                this.updateSubmitButton(false);
            }
        } catch {
            this.setState({ 
                formSubmitting: false, 
                errorMessage: 'Connection error while submitting leave request.' 
            });
            this.updateSubmitButton(false);
        }
    }

    updateLeaveStatus(leaveId, status, notes = '') {
        const confirmMsg = status === 'approved' ? 
            (this.t('leaveManagement.confirmApprove') || `Are you sure you want to approve this leave request?`) : 
            (this.t('leaveManagement.confirmReject') || `Are you sure you want to reject this leave request?`);
            
        const confirmText = status === 'approved' ? 
            (this.t('leaveManagement.approve') || 'Approve') : 
            (this.t('leaveManagement.reject') || 'Reject');
            
        const confirmColor = status === 'approved' ? 'btn-success' : 'btn-danger';
            
        this.setState({
            confirmDialog: {
                visible: true,
                message: confirmMsg,
                confirmText: confirmText,
                confirmColor: confirmColor,
                onConfirm: async () => {
                    this.setState({ deleteLoading: true });
                    try {
                        const res = await this.callGas('updateLeaveStatus', this.state.token, leaveId, status, notes);
                        if (res && res.status === 'success') {
                            // Reload data
                            if (this.callbacks.onSuccess) {
                                this.callbacks.onSuccess(res);
                            } else {
                                await this.loadData();
                            }
                            this.setState({ 
                                successMessage: res.message || `Leave request ${status} successfully.`,
                                deleteLoading: false
                            });
                        } else {
                            this.setState({ 
                                deleteLoading: false, 
                                errorMessage: res?.message || `Failed to ${status} leave request.` 
                            });
                        }
                    } catch {
                        this.setState({ 
                            deleteLoading: false, 
                            errorMessage: 'Connection error while updating leave status.' 
                        });
                    }
                }
            }
        });
    }

    deleteLeaveRequest(leaveId) {
        this.setState({
            confirmDialog: {
                visible: true,
                message: this.t('deleteLeaveRequest') || `Delete leave request? This cannot be undone.`,
                onConfirm: async () => {
                    this.setState({ deleteLoading: true });
                    try {
                        const res = await this.callGas('deleteLeaveRequest', this.state.token, leaveId);
                        if (res && res.status === 'success') {
                            // Reload data
                            if (this.callbacks.onSuccess) {
                                this.callbacks.onSuccess(res);
                            } else {
                                await this.loadData();
                            }
                            this.setState({ 
                                successMessage: res.message || 'Leave request deleted successfully.',
                                deleteLoading: false
                            });
                        } else {
                            this.setState({ 
                                deleteLoading: false, 
                                errorMessage: res?.message || 'Failed to delete leave request.' 
                            });
                        }
                    } catch {
                        this.setState({ 
                            deleteLoading: false, 
                            errorMessage: 'Connection error while deleting leave request.' 
                        });
                    }
                }
            }
        });
    }

    editLeave(leave) {
        this.editingLeave = leave;
        this.formData = {
            employeeId: leave.employeeId,
            leaveType: leave.leaveType,
            startDate: leave.startDate,
            endDate: leave.endDate,
            reason: leave.reason
        };
        this.updateModalForm();
    }

    cancelEdit() {
        this.editingLeave = null;
        this.formData = {
            employeeId: '',
            leaveType: 'Cuti',
            startDate: '',
            endDate: '',
            reason: ''
        };
        this.updateModalForm();
    }

    updateModalForm() {
        // Update form fields without re-rendering the entire component
        const employeeSelect = document.querySelector('.js-employee-select');
        if (employeeSelect) {
            // Update employee dropdown options if needed
            const currentOptions = employeeSelect.querySelectorAll('option');
            if (currentOptions.length <= 1 && this.state.employees && this.state.employees.length > 0) {
                // Recreate options
                employeeSelect.innerHTML = `
                    <option value="">${this.t('common.selectEmployee')}</option>
                    ${this.state.employees.map(emp => `
                        <option value="${emp.id}" ${this.formData.employeeId === emp.id ? 'selected' : ''}>
                            ${this.escHtml(emp.name)} (${this.escHtml(emp.id)})
                        </option>
                    `).join('')}
                `;
            } else {
                // Just update selected value
                employeeSelect.value = this.formData.employeeId || '';
            }
        }

        const leaveTypeSelect = document.querySelector('.js-leave-type');
        if (leaveTypeSelect) {
            leaveTypeSelect.value = this.formData.leaveType || 'Cuti';
        }

        const startDateInput = document.querySelector('.js-start-date');
        if (startDateInput) {
            startDateInput.value = this.formData.startDate || '';
        }

        const endDateInput = document.querySelector('.js-end-date');
        if (endDateInput) {
            endDateInput.value = this.formData.endDate || '';
        }

        const reasonInput = document.querySelector('.js-reason');
        if (reasonInput) {
            reasonInput.value = this.formData.reason || '';
        }

        // Update modal title
        const modalTitle = document.querySelector('#leave-form-modal .modal-title');
        if (modalTitle) {
            modalTitle.textContent = this.editingLeave ? 
                this.t('leaveManagement.editLeaveRequest') : 
                this.t('leaveManagement.newLeaveRequest');
        }

        // Update submit button
        this.updateSubmitButton(this.state.formSubmitting || false);

        // Show/hide cancel edit button
        const cancelEditBtn = document.querySelector('.js-cancel-edit');
        if (cancelEditBtn) {
            cancelEditBtn.style.display = this.editingLeave ? 'inline-block' : 'none';
        }
    }

    prepareNewLeave() {
        this.editingLeave = null;
        this.formData = {
            employeeId: this.state.user?.role === 'Admin' ? '' : (this.state.user?.id || ''),
            leaveType: 'Cuti',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            reason: ''
        };
        this.updateModalForm();
    }

    renderModal(container) {
        if (!container) return;
        
        let modalEl = document.getElementById('leave-form-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'leave-form-modal';
            modalEl.className = 'modal fade';
            modalEl.setAttribute('tabindex', '-1');
            modalEl.setAttribute('aria-hidden', 'true');
            container.appendChild(modalEl);
        }
        
        const isAdmin = this.state.user?.role === 'Admin';
        const employees = this.state.employees;
        
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            ${this.editingLeave ? this.t('leaveManagement.editLeaveRequest') : this.t('leaveManagement.newLeaveRequest')}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <form id="leave-form">
                            <div class="mb-3">
                                <label class="form-label">${this.t('leaveManagement.employee')} *</label>
                                ${isAdmin ? `
                                    <select class="form-select js-employee-select" required>
                                        <option value="">${this.t('common.selectEmployee')}</option>
                                        ${employees ? employees.map(emp => `
                                            <option value="${emp.id}" ${this.formData.employeeId === emp.id ? 'selected' : ''}>
                                                ${this.escHtml(emp.name)} (${this.escHtml(emp.id)})
                                            </option>
                                        `).join('') : ''}
                                    </select>
                                ` : `
                                    <input type="text" class="form-control" value="${this.escHtml(this.state.user?.id || '')} - ${this.escHtml(this.state.user?.name || '')}" disabled>
                                    <input type="hidden" class="js-employee-id" value="${this.state.user?.id || ''}">
                                `}
                            </div>
                            <div class="mb-3">
                                <label class="form-label">${this.t('leaveManagement.leaveType')} *</label>
                                <select class="form-select js-leave-type" required>
                                    <option value="Cuti" ${this.formData.leaveType === 'Cuti' ? 'selected' : ''}>${this.t('leaveManagement.cuti')}</option>
                                    <option value="Izin" ${this.formData.leaveType === 'Izin' ? 'selected' : ''}>${this.t('leaveManagement.izin')}</option>
                                    <option value="Sakit" ${this.formData.leaveType === 'Sakit' ? 'selected' : ''}>${this.t('leaveManagement.sakit')}</option>
                                    <option value="Libur" ${this.formData.leaveType === 'Libur' ? 'selected' : ''}>${this.t('leaveManagement.libur')}</option>
                                </select>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">${this.t('leaveManagement.startDate')} *</label>
                                    <input type="date" class="form-control js-start-date" value="${this.formData.startDate}" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">${this.t('leaveManagement.endDate')} *</label>
                                    <input type="date" class="form-control js-end-date" value="${this.formData.endDate}" required>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">${this.t('leaveManagement.reason')}</label>
                                <textarea class="form-control js-reason" rows="3" placeholder="${this.t('leaveManagement.reasonPlaceholder')}">${this.escHtml(this.formData.reason)}</textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${this.t('common.cancel')}</button>
                        ${this.editingLeave ? `
                            <button type="button" class="btn btn-secondary js-cancel-edit">${this.t('common.cancelEdit')}</button>
                        ` : ''}
                        <button type="button" class="btn btn-primary js-submit-leave">
                            ${this.editingLeave ? this.t('common.update') : this.t('common.submit')}
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.addModalEventListeners();
    }

    render() {
        // Load employees if not loaded
        if (!this.state.employees) {
            this.loadEmployees();
        }

        // Load leave requests if not loaded
        if (!this.state.managementLoaded && !this.state.managementLoading) {
            this.loadData();
        }

        const container = document.getElementById('admin-view-leaves');
        if (!container) return;

        const { managementLoading, leaveRequests, employees } = this.state;
        const filteredLeaves = this.getFilteredLeaves();
        const paginatedLeaves = this.getPaginatedLeaves();
        const totalPages = this.getTotalPages();
        const isAdmin = this.state.user?.role === 'Admin';

        // Status badge colors
        const statusColors = {
            pending: 'bg-warning text-white',
            approved: 'bg-success text-white',
            rejected: 'bg-danger text-white'
        };

        // Leave type colors
        const leaveTypeColors = {
            Cuti: 'bg-info text-white',
            Izin: 'bg-primary text-white',
            Sakit: 'bg-warning text-white',
            Libur: 'bg-secondary text-white'
        };

        // Generate main content without modal
        const mainContent = `
            <div class="container-fluid">
                <div class="row mb-4">
                    <div class="col">
                        <div class="page-pretitle">${this.t('adminPanel.management')}</div>
                        <h2 class="page-title">${this.t('leaveManagement.leaveManagement')}</h2>
                    </div>
                    <div class="col-auto">
                        <button class="btn btn-primary js-add-leave">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                <path d="M12 5l0 14" />
                                <path d="M5 12l14 0" />
                            </svg>
                            ${this.t('leaveManagement.newLeaveRequest')}
                        </button>
                    </div>
                </div>

                <!-- Filters -->
                <div class="card mb-4">
                    <div class="card-body">
                        <div class="row g-3">
                            <div class="col-md-3">
                                <label class="form-label">${this.t('common.search')}</label>
                                <div class="input-group">
                                    <input type="text" class="form-control js-leave-search" placeholder="${this.t('common.searchPlaceholder')}" value="${this.escHtml(this.searchQuery)}">
                                    <button class="btn btn-outline-secondary js-clear-search" type="button">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                            <path d="M18 6l-12 12" />
                                            <path d="M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div class="col-md-2">
                                <label class="form-label">${this.t('leaveManagement.status')}</label>
                                <select class="form-select js-status-filter">
                                    <option value="all">${this.t('common.all')}</option>
                                    <option value="pending" ${this.statusFilter === 'pending' ? 'selected' : ''}>${this.t('leaveManagement.pending')}</option>
                                    <option value="approved" ${this.statusFilter === 'approved' ? 'selected' : ''}>${this.t('leaveManagement.approved')}</option>
                                    <option value="rejected" ${this.statusFilter === 'rejected' ? 'selected' : ''}>${this.t('leaveManagement.rejected')}</option>
                                </select>
                            </div>
                            <div class="col-md-2">
                                <label class="form-label">${this.t('leaveManagement.leaveType')}</label>
                                <select class="form-select js-leave-type-filter">
                                    <option value="all">${this.t('common.all')}</option>
                                    <option value="Cuti" ${this.leaveTypeFilter === 'Cuti' ? 'selected' : ''}>${this.t('leaveManagement.cuti')}</option>
                                    <option value="Izin" ${this.leaveTypeFilter === 'Izin' ? 'selected' : ''}>${this.t('leaveManagement.izin')}</option>
                                    <option value="Sakit" ${this.leaveTypeFilter === 'Sakit' ? 'selected' : ''}>${this.t('leaveManagement.sakit')}</option>
                                    <option value="Libur" ${this.leaveTypeFilter === 'Libur' ? 'selected' : ''}>${this.t('leaveManagement.libur')}</option>
                                </select>
                            </div>
                            <div class="col-md-2">
                                <label class="form-label">${this.t('leaveManagement.startDate')}</label>
                                <input type="date" class="form-control js-start-date-filter" value="${this.startDateFilter}">
                            </div>
                            <div class="col-md-2">
                                <label class="form-label">${this.t('leaveManagement.endDate')}</label>
                                <input type="date" class="form-control js-end-date-filter" value="${this.endDateFilter}">
                            </div>
                            <div class="col-md-1 d-flex align-items-end">
                                <button class="btn btn-primary w-100 js-apply-filters">
                                    ${this.t('common.filter')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Leave Requests Table -->
                <div class="card">
                    <div class="card-body">
                        ${managementLoading ? `
                            <div class="text-center py-5">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                                <p class="mt-2 text-muted">${this.t('common.loading')}</p>
                            </div>
                        ` : `
                            ${!leaveRequests || leaveRequests.length === 0 ? `
                                <div class="text-center py-5">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler mb-2 d-block mx-auto text-muted" width="40" height="40" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                        <path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" />
                                        <path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" />
                                        <path d="M9 12h6" />
                                        <path d="M9 16h6" />
                                    </svg>
                                    <p class="text-muted">${this.t('leaveManagement.noLeaveRequests')}</p>
                                </div>
                            ` : `
                                <div class="table-responsive">
                                    <table class="table table-hover">
                                        <thead>
                                            <tr>
                                                <th>${this.t('leaveManagement.employee')}</th>
                                                <th>${this.t('leaveManagement.leaveType')}</th>
                                                <th>${this.t('leaveManagement.period')}</th>
                                                <th>${this.t('leaveManagement.days')}</th>
                                                <th>${this.t('leaveManagement.status')}</th>
                                                <th>${this.t('leaveManagement.reason')}</th>
                                                <th>${this.t('leaveManagement.created')}</th>
                                                <th class="text-end">${this.t('common.actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${paginatedLeaves.map(leave => {
                                                const startDate = new Date(leave.startDate);
                                                const endDate = new Date(leave.endDate);
                                                const daysDiff = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                                                
                                                return `
                                                    <tr>
                                                        <td>
                                                            <div class="fw-semibold">${this.escHtml(leave.employeeName)}</div>
                                                            <div class="text-muted small">${this.escHtml(leave.employeeId)}</div>
                                                        </td>
                                                        <td>
                                                            <span class="badge ${leaveTypeColors[leave.leaveType] || 'bg-secondary'}">
                                                                ${this.t(`leaveManagement.${leave.leaveType.toLowerCase()}`)}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            ${this.escHtml(this.formatDate(leave.startDate))} - ${this.escHtml(this.formatDate(leave.endDate))}
                                                        </td>
                                                        <td>
                                                            <span class="badge bg-secondary-lt">${daysDiff} ${this.t('leaveManagement.days')}</span>
                                                        </td>
                                                        <td>
                                                            <span class="badge ${statusColors[leave.status] || 'bg-secondary'}">
                                                                ${this.t(`leaveManagement.${leave.status}`)}
                                                            </span>
                                                        </td>
                                                        <td class="text-truncate" style="max-width: 200px;" title="${this.escHtml(leave.reason)}">
                                                            ${this.escHtml(leave.reason || '-')}
                                                        </td>
                                                        <td>
                                                            <div class="text-muted small">${this.escHtml(this.formatDate(leave.createdAt))}</div>
                                                        </td>
                                                        <td class="text-end">
                                                            <div class="d-flex gap-1 justify-content-end">
                                                                ${(() => {
                                                                    const showApproveReject = isAdmin && leave.status === 'pending';
                                                                    const showDelete = isAdmin;
                                                                    const showEdit = leave.status === 'pending';
                                                                    
                                                                    let buttons = '';
                                                                    
                                                                    // Approve button (admin only for pending leaves)
                                                                    if (showApproveReject) {
                                                                        buttons += `
                                                                            <button class="btn btn-sm btn-success js-approve-leave" data-id="${leave.id}" title="${this.t('leaveManagement.approve')}">
                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                                                                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                                                    <path d="M5 12l5 5l10 -10" />
                                                                                </svg>
                                                                            </button>
                                                                        `;
                                                                    }
                                                                    
                                                                    // Reject button (admin only for pending leaves)
                                                                    if (showApproveReject) {
                                                                        buttons += `
                                                                            <button class="btn btn-sm btn-danger js-reject-leave" data-id="${leave.id}" title="${this.t('leaveManagement.reject')}">
                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                                                                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                                                    <path d="M18 6l-12 12" />
                                                                                    <path d="M6 6l12 12" />
                                                                                </svg>
                                                                            </button>
                                                                        `;
                                                                    }
                                                                    
                                                                    // Edit button (for pending leaves)
                                                                    if (showEdit) {
                                                                        buttons += `
                                                                            <button class="btn btn-sm btn-primary js-edit-leave" data-id="${leave.id}" title="${this.t('common.edit')}">
                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                                                                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                                                    <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" />
                                                                                    <path d="M13.5 6.5l4 4" />
                                                                                </svg>
                                                                            </button>
                                                                        `;
                                                                    }
                                                                    
                                                                    // Delete button (admin only)
                                                                    if (showDelete) {
                                                                        buttons += `
                                                                            <button class="btn btn-sm btn-outline-danger js-delete-leave" data-id="${leave.id}" title="${this.t('common.delete')}">
                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                                                                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                                                    <path d="M4 7l16 0" />
                                                                                    <path d="M10 11l0 6" />
                                                                                    <path d="M14 11l0 6" />
                                                                                    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                                                                                    <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
                                                                                </svg>
                                                                            </button>
                                                                        `;
                                                                    }
                                                                    
                                                                    return buttons || '<span class="text-muted small">-</span>';
                                                                })()}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>

                                <!-- Pagination -->
                                ${totalPages > 1 ? `
                                    <div class="d-flex justify-content-between align-items-center mt-4">
                                        <div class="text-muted">
                                            ${this.t('common.showing')} ${(this.currentPage - 1) * this.itemsPerPage + 1}-${Math.min(this.currentPage * this.itemsPerPage, filteredLeaves.length)} ${this.t('common.of')} ${filteredLeaves.length}
                                        </div>
                                        <nav>
                                            <ul class="pagination mb-0">
                                                <li class="page-item ${this.currentPage <= 1 ? 'disabled' : ''}">
                                                    <button class="page-link js-prev-page">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                            <path d="M15 6l-6 6l6 6" />
                                                        </svg>
                                                    </button>
                                                </li>
                                                ${Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                    let pageNum;
                                                    if (totalPages <= 5) {
                                                        pageNum = i + 1;
                                                    } else if (this.currentPage <= 3) {
                                                        pageNum = i + 1;
                                                    } else if (this.currentPage >= totalPages - 2) {
                                                        pageNum = totalPages - 4 + i;
                                                    } else {
                                                        pageNum = this.currentPage - 2 + i;
                                                    }
                                                    
                                                    return `
                                                        <li class="page-item ${this.currentPage === pageNum ? 'active' : ''}">
                                                            <button class="page-link js-page" data-page="${pageNum}">${pageNum}</button>
                                                        </li>
                                                    `;
                                                }).join('')}
                                                <li class="page-item ${this.currentPage >= totalPages ? 'disabled' : ''}">
                                                    <button class="page-link js-next-page">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                            <path d="M9 6l6 6l-6 6" />
                                                        </svg>
                                                    </button>
                                                </li>
                                            </ul>
                                        </nav>
                                    </div>
                                ` : ''}
                            `}
                        `}
                    </div>
                </div>
            </div>
        `;

        // Remove all children except the modal
        const modalEl = document.getElementById('leave-form-modal');
        const children = Array.from(container.children);
        for (const child of children) {
            if (child.id !== 'leave-form-modal') {
                container.removeChild(child);
            }
        }
        
        // Add main content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = mainContent;
        while (tempDiv.firstChild) {
            container.insertBefore(tempDiv.firstChild, modalEl || null);
        }
        
        // Create or update modal
        if (!modalEl) {
            const newModalEl = document.createElement('div');
            newModalEl.id = 'leave-form-modal';
            newModalEl.className = 'modal fade';
            newModalEl.setAttribute('tabindex', '-1');
            newModalEl.setAttribute('aria-hidden', 'true');
            newModalEl.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                ${this.editingLeave ? this.t('leaveManagement.editLeaveRequest') : this.t('leaveManagement.newLeaveRequest')}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="leave-form">
                                <div class="mb-3">
                                    <label class="form-label">${this.t('leaveManagement.employee')} *</label>
                                    ${isAdmin ? `
                                        <select class="form-select js-employee-select" required>
                                            <option value="">${this.t('common.selectEmployee')}</option>
                                            ${employees ? employees.map(emp => `
                                                <option value="${emp.id}" ${this.formData.employeeId === emp.id ? 'selected' : ''}>
                                                    ${this.escHtml(emp.name)} (${this.escHtml(emp.id)})
                                                </option>
                                            `).join('') : ''}
                                        </select>
                                    ` : `
                                        <input type="text" class="form-control" value="${this.escHtml(this.state.user?.id || '')} - ${this.escHtml(this.state.user?.name || '')}" disabled>
                                        <input type="hidden" class="js-employee-id" value="${this.state.user?.id || ''}">
                                    `}
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">${this.t('leaveManagement.leaveType')} *</label>
                                    <select class="form-select js-leave-type" required>
                                        <option value="Cuti" ${this.formData.leaveType === 'Cuti' ? 'selected' : ''}>${this.t('leaveManagement.cuti')}</option>
                                        <option value="Izin" ${this.formData.leaveType === 'Izin' ? 'selected' : ''}>${this.t('leaveManagement.izin')}</option>
                                        <option value="Sakit" ${this.formData.leaveType === 'Sakit' ? 'selected' : ''}>${this.t('leaveManagement.sakit')}</option>
                                        <option value="Libur" ${this.formData.leaveType === 'Libur' ? 'selected' : ''}>${this.t('leaveManagement.libur')}</option>
                                    </select>
                                </div>
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">${this.t('leaveManagement.startDate')} *</label>
                                        <input type="date" class="form-control js-start-date" value="${this.formData.startDate}" required>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">${this.t('leaveManagement.endDate')} *</label>
                                        <input type="date" class="form-control js-end-date" value="${this.formData.endDate}" required>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">${this.t('leaveManagement.reason')}</label>
                                    <textarea class="form-control js-reason" rows="3" placeholder="${this.t('leaveManagement.reasonPlaceholder')}">${this.escHtml(this.formData.reason)}</textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${this.t('common.cancel')}</button>
                            ${this.editingLeave ? `
                                <button type="button" class="btn btn-secondary js-cancel-edit">${this.t('common.cancelEdit')}</button>
                            ` : ''}
                            <button type="button" class="btn btn-primary js-submit-leave">
                                ${this.editingLeave ? this.t('common.update') : this.t('common.submit')}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(newModalEl);
            // Add modal event listeners once
            this.addModalEventListeners();
        } else {
            // Modal exists, update its form fields and ensure event listeners are set
            this.updateModalForm();
            this.addModalEventListeners();
        }

        // Add event listeners
        this.addEventListeners();
    }

    addEventListeners() {
        // Add new leave
        const addLeaveBtn = document.querySelector('.js-add-leave');
        if (addLeaveBtn) {
            addLeaveBtn.addEventListener('click', () => {
                this.prepareNewLeave();
                const modalEl = document.getElementById('leave-form-modal');
                if (modalEl) {
                    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                    modal.show();
                }
            });
        }

        // Search
        const searchInput = document.querySelector('.js-leave-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.currentPage = 1;
                this.render();
            });
        }

        // Clear search
        const clearSearchBtn = document.querySelector('.js-clear-search');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                this.searchQuery = '';
                this.currentPage = 1;
                this.render();
            });
        }

        // Filters
        const statusFilter = document.querySelector('.js-status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.statusFilter = e.target.value;
                this.currentPage = 1;
                this.render();
            });
        }

        const leaveTypeFilter = document.querySelector('.js-leave-type-filter');
        if (leaveTypeFilter) {
            leaveTypeFilter.addEventListener('change', (e) => {
                this.leaveTypeFilter = e.target.value;
                this.currentPage = 1;
                this.render();
            });
        }

        const startDateFilter = document.querySelector('.js-start-date-filter');
        if (startDateFilter) {
            startDateFilter.addEventListener('change', (e) => {
                this.startDateFilter = e.target.value;
                this.currentPage = 1;
                this.render();
            });
        }

        const endDateFilter = document.querySelector('.js-end-date-filter');
        if (endDateFilter) {
            endDateFilter.addEventListener('change', (e) => {
                this.endDateFilter = e.target.value;
                this.currentPage = 1;
                this.render();
            });
        }

        const applyFiltersBtn = document.querySelector('.js-apply-filters');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                this.currentPage = 1;
                this.loadData();
            });
        }

        // Pagination
        const prevPageBtn = document.querySelector('.js-prev-page');
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.render();
                }
            });
        }

        const nextPageBtn = document.querySelector('.js-next-page');
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                if (this.currentPage < this.getTotalPages()) {
                    this.currentPage++;
                    this.render();
                }
            });
        }

        const pageBtns = document.querySelectorAll('.js-page');
        pageBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(e.target.dataset.page);
                if (page && page !== this.currentPage) {
                    this.currentPage = page;
                    this.render();
                }
            });
        });

        // Leave actions
        const approveBtns = document.querySelectorAll('.js-approve-leave');
        approveBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const leaveId = e.target.closest('.js-approve-leave').dataset.id;
                this.updateLeaveStatus(leaveId, 'approved');
            });
        });

        const rejectBtns = document.querySelectorAll('.js-reject-leave');
        rejectBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const leaveId = e.target.closest('.js-reject-leave').dataset.id;
                this.updateLeaveStatus(leaveId, 'rejected');
            });
        });

        const deleteBtns = document.querySelectorAll('.js-delete-leave');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const leaveId = e.target.closest('.js-delete-leave').dataset.id;
                this.deleteLeaveRequest(leaveId);
            });
        });

        const editBtns = document.querySelectorAll('.js-edit-leave');
        editBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const leaveId = e.target.dataset.id || e.target.closest('.js-edit-leave')?.dataset.id;
                const leave = this.state.leaveRequests?.find(l => l.id === leaveId);
                if (leave) {
                    this.editLeave(leave);
                    const modalEl = document.getElementById('leave-form-modal');
                    if (modalEl) {
                        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                        modal.show();
                    }
                }
            });
        });
    }

    t(key) {
        // Translation helper
        return t(key);
    }

    updateSubmitButton(isSubmitting) {
        const submitBtn = document.querySelector('.js-submit-leave');
        if (submitBtn) {
            if (isSubmitting) {
                const text = this.editingLeave ? 
                    (this.t('common.update') + '...') : 
                    (this.t('common.submit') + '...');
                submitBtn.innerHTML = `
                    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    ${text}
                `;
                submitBtn.disabled = true;
            } else {
                submitBtn.textContent = this.editingLeave ? 
                    this.t('common.update') : 
                    this.t('common.submit');
                submitBtn.disabled = false;
            }
        }
    }

    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            // Format as YYYY-MM-DD
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch {
            // If parsing fails, try to extract date part from string
            const dateMatch = dateString.match(/\d{4}-\d{2}-\d{2}/);
            if (dateMatch) return dateMatch[0];
            
            // Try other common date formats
            const isoMatch = dateString.match(/(\d{4})-(\d{2})-(\d{2})T/);
            if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
            
            // Return original if no date found
            return dateString;
        }
    }

    addModalEventListeners() {
        // Only add event listeners once
        if (this.modalEventListenersAdded) {
            return;
        }
        
        // Form submission
        const submitBtn = document.querySelector('.js-submit-leave');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                this.submitLeaveRequest();
            });
        }

        // Cancel edit
        const cancelEditBtn = document.querySelector('.js-cancel-edit');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => {
                const modal = bootstrap.Modal.getInstance(document.getElementById('leave-form-modal'));
                if (modal) modal.hide();
                this.cancelEdit();
            });
        }

        // Form inputs
        const employeeSelect = document.querySelector('.js-employee-select');
        if (employeeSelect) {
            employeeSelect.addEventListener('change', (e) => {
                this.formData.employeeId = e.target.value;
            });
        }

        const leaveTypeSelect = document.querySelector('.js-leave-type');
        if (leaveTypeSelect) {
            leaveTypeSelect.addEventListener('change', (e) => {
                this.formData.leaveType = e.target.value;
            });
        }

        const startDateInput = document.querySelector('.js-start-date');
        if (startDateInput) {
            startDateInput.addEventListener('change', (e) => {
                this.formData.startDate = e.target.value;
            });
        }

        const endDateInput = document.querySelector('.js-end-date');
        if (endDateInput) {
            endDateInput.addEventListener('change', (e) => {
                this.formData.endDate = e.target.value;
            });
        }

        const reasonInput = document.querySelector('.js-reason');
        if (reasonInput) {
            reasonInput.addEventListener('input', (e) => {
                this.formData.reason = e.target.value;
            });
        }
        
        this.modalEventListenersAdded = true;
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