// AdminDashboard.js - Dashboard component
export class AdminDashboard {
    constructor(state, setState, callGas) {
        this.state = state;
        this.setState = setState;
        this.callGas = callGas;
        this.pieChart = null;
        this.barChart = null;
        this.monthlyTrendChart = null;
    }

    async loadData() {
        this.setState({ loading: true });
        try {
            const res = await this.callGas('getDashboardData', this.state.token);
            if (res && res.status === 'success') {
                this.setState({
                    adminStats: res.data.stats,
                    adminMonthStats: res.data.monthStats || res.data.stats,
                    adminRecap: res.data.recap,
                    adminMonthlyTrend: res.data.monthlyTrend || [],
                    loading: false,
                    dataLoaded: true
                });
            } else {
                this.setState({ 
                    loading: false, 
                    errorMessage: res?.message || 'Failed to load dashboard data.' 
                });
            }
        } catch {
            this.setState({ 
                loading: false, 
                errorMessage: 'Failed to load dashboard data.' 
            });
        }
    }

    render() {
        const { adminStats, adminMonthStats, adminRecap, dataLoaded } = this.state;
        const monthStats = adminMonthStats || adminStats;
        
        // Update stats (this month)
        const setEl = (id, val) => { 
            const el = document.getElementById(id); 
            if (el) el.textContent = val; 
        };
        
        setEl('stats-ontime', monthStats.tepatWaktu);
        setEl('stats-late', monthStats.terlambat);
        setEl('stats-absent', monthStats.bolos);

        // Render charts
        this.renderCharts();

        // Render recap table
        const table = document.getElementById('admin-recap-table');
        if (!table) return;

        if (!dataLoaded) {
            table.innerHTML = [1, 2, 3].map(() =>
                `<tr><td colspan="5"><div class="placeholder-glow"><span class="placeholder col-12 rounded"></span></div></td></tr>`
            ).join('');
        } else if (adminRecap.length === 0) {
            table.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No data found.</td></tr>';
        } else {
            const top10Recap = adminRecap
                .slice()
                .sort((a, b) => b.tepatWaktu - a.tepatWaktu)
                .slice(0, 10);
            table.innerHTML = top10Recap.map((r, idx) => {
                const total = r.tepatWaktu + r.terlambat + r.bolos;
                const rate = total > 0 ? Math.round((r.tepatWaktu / total) * 100) : 0;
                const rateColor = rate >= 90 ? 'bg-success' : rate >= 70 ? 'bg-warning' : 'bg-danger';
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
                const name = this.escHtml(r.name || r.id);
                const empId = r.name ? `<small class="text-muted d-block">${this.escHtml(r.id)}</small>` : '';
                return `
                <tr>
                    <td class="text-center fw-bold">${medal}</td>
                    <td>${name}${empId}</td>
                    <td class="text-center"><span class="badge bg-success-lt text-success fw-semibold">${this.escHtml(r.tepatWaktu)}</span></td>
                    <td class="text-center"><span class="badge bg-warning-lt text-warning fw-semibold">${this.escHtml(r.terlambat)}</span></td>
                    <td class="text-center"><span class="badge bg-danger-lt text-danger fw-semibold">${this.escHtml(r.bolos)}</span></td>
                    <td class="text-center">
                        <div class="d-flex align-items-center gap-2">
                            <div class="progress flex-grow-1" style="height: 6px;">
                                <div class="progress-bar ${rateColor}" style="width: ${rate}%"></div>
                            </div>
                            <span class="text-muted small fw-semibold" style="min-width: 36px;">${rate}%</span>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        }
    }

    renderCharts() {
        const { adminStats, adminRecap, adminMonthlyTrend } = this.state;

        // Pie Chart: Attendance Status Distribution (current week)
        const pieData = [
            adminStats.tepatWaktu,
            adminStats.terlambat,
            adminStats.bolos
        ];
        
        const pieOptions = {
            series: pieData,
            chart: { type: 'donut', height: 350 },
            labels: ['On Time', 'Late', 'Left Early'],
            colors: ['#2fb344', '#f76707', '#d63939'],
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
            responsive: [{ breakpoint: 480, options: { chart: { width: 200 }, legend: { position: 'bottom' } } }]
        };

        // Bar Chart: Month-to-month attendance percentage (aggregate of all employees)
        const trend = (adminMonthlyTrend || []);
        const barOptions = {
            series: [
                {
                    name: 'Attendance %',
                    data: trend.map(m => m.percentage)
                }
            ],
            chart: {
                type: 'bar',
                height: 350,
                toolbar: { show: false }
            },
            colors: trend.map(m =>
                m.percentage >= 90 ? '#2fb344' :
                m.percentage >= 70 ? '#f76707' : '#d63939'
            ),
            plotOptions: {
                bar: {
                    horizontal: false,
                    columnWidth: '55%',
                    borderRadius: 4,
                    distributed: true,
                    dataLabels: { position: 'top' }
                }
            },
            dataLabels: {
                enabled: true,
                formatter: val => val + '%',
                offsetY: -20,
                style: { fontSize: '11px', colors: ['#304758'] }
            },
            xaxis: {
                categories: trend.map(m => m.label),
                labels: { rotate: -30, style: { fontSize: '11px' } }
            },
            yaxis: {
                min: 0,
                max: 100,
                labels: { formatter: val => val + '%' }
            },
            tooltip: {
                y: { formatter: val => val + '%' },
                custom: ({ series, seriesIndex, dataPointIndex }) => {
                    const m = trend[dataPointIndex];
                    if (!m) return '';
                    return `<div class="apexcharts-tooltip-box p-2">
                        <strong>${m.label}</strong><br/>
                        On Time: ${m.tepatWaktu} &nbsp; Late: ${m.terlambat}<br/>
                        Absent: ${m.bolos}<br/>
                        <strong>Attendance Rate: ${m.percentage}%</strong>
                    </div>`;
                }
            },
            legend: { show: false },
            fill: { opacity: 1 }
        };

        // Use a small timeout to ensure DOM elements are rendered
        setTimeout(() => {
            if (this.pieChart) this.pieChart.destroy();
            if (this.barChart) this.barChart.destroy();
            
            const pieEl = document.querySelector("#chart-pie-attendance");
            const barEl = document.querySelector("#chart-bar-attendance");
            
            if (pieEl && typeof ApexCharts !== 'undefined') {
                this.pieChart = new ApexCharts(pieEl, pieOptions);
                this.pieChart.render();
            }
            
            if (barEl && typeof ApexCharts !== 'undefined') {
                this.barChart = new ApexCharts(barEl, barOptions);
                this.barChart.render();
            }
        }, 10);
    }

    destroy() {
        if (this.pieChart) this.pieChart.destroy();
        if (this.barChart) this.barChart.destroy();
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
