// componentLoader.js - Dynamic component loader
export class ComponentLoader {
    constructor() {
        this.loadedComponents = new Map();
    }

    async loadComponent(componentName, state, setState, callGas) {
        // Return cached component if already loaded
        if (this.loadedComponents.has(componentName)) {
            return this.loadedComponents.get(componentName);
        }

        let ComponentClass;
        
        try {
            switch (componentName) {
                case 'dashboard':
                    const { AdminDashboard } = await import('../components/AdminDashboard.js');
                    ComponentClass = AdminDashboard;
                    break;
                case 'users':
                    const { UserManagement } = await import('../components/UserManagement.js');
                    ComponentClass = UserManagement;
                    break;
                case 'shifts':
                    const { ShiftManagement } = await import('../components/ShiftManagement.js');
                    ComponentClass = ShiftManagement;
                    break;
                case 'positions':
                    const { PositionManagement } = await import('../components/PositionManagement.js');
                    ComponentClass = PositionManagement;
                    break;
                case 'attendance':
                    const { DailyAttendance } = await import('../components/DailyAttendance.js');
                    ComponentClass = DailyAttendance;
                    break;
                case 'logs':
                    const { ActivityLogs } = await import('../components/ActivityLogs.js');
                    ComponentClass = ActivityLogs;
                    break;
                case 'reports':
                    const { Reports } = await import('../components/Reports.js');
                    ComponentClass = Reports;
                    break;
                case 'settings':
                    const { Settings } = await import('../components/Settings.js');
                    ComponentClass = Settings;
                    break;
                default:
                    throw new Error(`Unknown component: ${componentName}`);
            }

            const component = new ComponentClass(state, setState, callGas);
            this.loadedComponents.set(componentName, component);
            return component;
        } catch (error) {
            console.error(`Failed to load component ${componentName}:`, error);
            throw error;
        }
    }

    clearCache() {
        this.loadedComponents.clear();
    }

    getComponent(componentName) {
        return this.loadedComponents.get(componentName);
    }
}
