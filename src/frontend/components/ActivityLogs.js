// ActivityLogs.js - Activity logs component
export class ActivityLogs {
    constructor(state, setState, callGas) {
        this.state = state;
        this.setState = setState;
        this.callGas = callGas;
    }

    async loadData() {
        if (this.state.logsLoaded || this.state.logsLoading) return;
        
        this.setState({ logsLoading: true });
        try {
            const res = await this.callGas('getAdminInitialData', this.state.token);
            if (res && res.status === 'success') {
                this.setState({
                    adminManagement: { ...this.state.adminManagement, logs: res.data.logs },
                    logsLoaded: true,
                    logsLoading: false
                });
            } else {
                this.setState({ 
                    logsLoading: false, 
                    errorMessage: res?.message || 'Failed to load logs.' 
                });
            }
        } catch {
            this.setState({ 
                logsLoading: false, 
                errorMessage: 'Connection error while loading logs.' 
            });
        }
    }

    render() {
        const table = document.getElementById('admin-logs-table');
        if (!table) return;

        const { adminManagement, logsLoading, dataLoaded } = this.state;

        if (logsLoading || !dataLoaded) {
            table.innerHTML = [1, 2, 3].map(() =>
                `<tr><td colspan="3"><div class="placeholder-glow"><span class="placeholder col-12 rounded"></span></div></td></tr>`
            ).join('');
        } else if (!adminManagement.logs || adminManagement.logs.length === 0) {
            table.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">No logs found.</td></tr>';
        } else {
            table.innerHTML = adminManagement.logs.map(log => `
                <tr>
                    <td>${this.escHtml(log.timestamp)}</td>
                    <td>${this.escHtml(log.user_id)}</td>
                    <td>${this.escHtml(log.action)}</td>
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
}
