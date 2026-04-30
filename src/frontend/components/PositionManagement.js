// PositionManagement.js - Group management component
export class PositionManagement {
    constructor(state, setState, callGas) {
        this.state = state;
        this.setState = setState;
        this.callGas = callGas;
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

    render() {
        const table = document.getElementById('admin-positions-table');
        if (!table) return;

        const { adminManagement, managementLoading, dataLoaded } = this.state;

        if (managementLoading || !dataLoaded) {
            table.innerHTML = [1, 2, 3].map(() =>
                `<tr><td colspan="3"><div class="placeholder-glow"><span class="placeholder col-12 rounded"></span></div></td></tr>`
            ).join('');
        } else if (!adminManagement.positions || adminManagement.positions.length === 0) {
            table.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">No groups found.</td></tr>';
        } else {
            table.innerHTML = adminManagement.positions.map(p => `
                <tr>
                    <td>${this.escHtml(p.id)}</td>
                    <td>${this.escHtml(p.name)}</td>
                    <td>
                        <button class="btn btn-icon btn-sm btn-ghost-primary js-edit-position" data-id="${this.escHtml(p.id)}" aria-label="Edit group">${this.iconEdit()}</button>
                        <button class="btn btn-icon btn-sm btn-ghost-danger js-delete-position" data-id="${this.escHtml(p.id)}" aria-label="Delete group">${this.iconDelete()}</button>
                    </td>
                </tr>`).join('');
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

    iconEdit() {
        return `<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /></svg>`;
    }

    iconDelete() {
        return `<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>`;
    }
}
