# Component Usage Guide

## Quick Start

### Using Individual Components

Each component can be imported and used independently:

```javascript
// Import a specific component
import { AdminDashboard } from './components/AdminDashboard.js';

// Create instance
const dashboard = new AdminDashboard(state, setState, callGas);

// Load data (shows skeleton loaders automatically)
await dashboard.loadData();

// Render to DOM
dashboard.render();
```

### Using the Component Loader

For dynamic loading based on user navigation:

```javascript
import { ComponentLoader } from './utils/componentLoader.js';

const loader = new ComponentLoader();

// Load component by name
const component = await loader.loadComponent('dashboard', state, setState, callGas);
await component.loadData();
component.render();

// Component is cached - subsequent calls return the same instance
const sameComponent = await loader.loadComponent('dashboard', state, setState, callGas);
```

## Available Components

| Component Name | Import Path | Description |
|---------------|-------------|-------------|
| `AdminDashboard` | `./components/AdminDashboard.js` | Dashboard stats and recap |
| `UserManagement` | `./components/UserManagement.js` | User CRUD operations |
| `ShiftManagement` | `./components/ShiftManagement.js` | Shift CRUD operations |
| `PositionManagement` | `./components/PositionManagement.js` | Position CRUD operations |
| `DailyAttendance` | `./components/DailyAttendance.js` | Daily attendance with filters |
| `ActivityLogs` | `./components/ActivityLogs.js` | Activity logs display |
| `Reports` | `./components/Reports.js` | Charts and reports |

## Component Loader Names

Use these names with `ComponentLoader.loadComponent()`:

- `'dashboard'` → AdminDashboard
- `'users'` → UserManagement
- `'shifts'` → ShiftManagement
- `'positions'` → PositionManagement
- `'attendance'` → DailyAttendance
- `'logs'` → ActivityLogs
- `'reports'` → Reports

## Integration Example

Here's how to integrate the component loader into the existing admin view switching:

```javascript
import { ComponentLoader } from './utils/componentLoader.js';

const componentLoader = new ComponentLoader();
let currentAdminComponent = null;

// Update the sidebar click handler
document.body.addEventListener('click', async (e) => {
    const sidebarItem = e.target.closest('.admin-sidebar-item');
    if (sidebarItem) {
        const viewName = sidebarItem.dataset.view;
        
        // Update UI to show which tab is active
        setState({ adminView: viewName });
        
        // Show/hide view containers
        ['dashboard', 'users', 'shifts', 'positions', 'attendance', 'logs', 'reports'].forEach(v => {
            const viewEl = document.getElementById(`admin-view-${v}`);
            if (viewEl) viewEl.style.display = viewName === v ? 'block' : 'none';
        });
        
        // Load and render component
        try {
            currentAdminComponent = await componentLoader.loadComponent(
                viewName, 
                state, 
                setState, 
                callGas
            );
            await currentAdminComponent.loadData();
            currentAdminComponent.render();
        } catch (error) {
            console.error('Failed to load component:', error);
            setState({ errorMessage: 'Failed to load view. Please try again.' });
        }
    }
});
```

## Loading States

### Skeleton Loaders (Automatic)

Each component automatically shows skeleton loaders while data is loading:

```javascript
// In component render() method
if (!dataLoaded) {
    table.innerHTML = [1, 2, 3].map(() =>
        `<tr><td colspan="5">
            <div class="placeholder-glow">
                <span class="placeholder col-12 rounded"></span>
            </div>
        </td></tr>`
    ).join('');
}
```

### Error States

Components handle errors gracefully:

```javascript
// Error state with retry button
if (error) {
    table.innerHTML = `
        <tr><td colspan="8" class="text-center py-5">
            <svg>...</svg>
            <p class="text-danger">Failed to load data</p>
            <button class="btn btn-primary js-retry">Retry</button>
        </td></tr>`;
}
```

## Component Lifecycle

1. **Import** - Component class is imported (lazy loaded)
2. **Instantiate** - New instance created with state, setState, callGas
3. **Load Data** - `loadData()` fetches data from backend
4. **Render** - `render()` updates DOM with data
5. **Cache** - Component instance cached for reuse

## State Management

Components use the global state object:

```javascript
// Reading state
const { adminStats, adminRecap } = this.state;

// Updating state (triggers re-render)
this.setState({ 
    adminStats: newStats,
    dataLoaded: true 
});
```

## Best Practices

### 1. Always await loadData()

```javascript
// ✅ Good
await component.loadData();
component.render();

// ❌ Bad - render might happen before data loads
component.loadData();
component.render();
```

### 2. Handle errors

```javascript
try {
    const component = await loader.loadComponent('dashboard', state, setState, callGas);
    await component.loadData();
    component.render();
} catch (error) {
    console.error('Component error:', error);
    setState({ errorMessage: 'Failed to load view' });
}
```

### 3. Check if data already loaded

```javascript
// Components check if data is already loaded
async loadData() {
    if (this.state.managementLoaded || this.state.managementLoading) {
        return; // Skip if already loaded or loading
    }
    // ... fetch data
}
```

### 4. Clean up when needed

```javascript
// Some components (like Reports) need cleanup
if (currentComponent && currentComponent.destroy) {
    currentComponent.destroy();
}
```

## Customization

### Adding a New Component

1. Create component file in `src/frontend/components/`:

```javascript
// MyComponent.js
export class MyComponent {
    constructor(state, setState, callGas) {
        this.state = state;
        this.setState = setState;
        this.callGas = callGas;
    }

    async loadData() {
        // Fetch data
    }

    render() {
        // Update DOM
    }
}
```

2. Add to component loader:

```javascript
// In componentLoader.js
case 'mycomponent':
    const { MyComponent } = await import('../components/MyComponent.js');
    ComponentClass = MyComponent;
    break;
```

3. Use it:

```javascript
const component = await loader.loadComponent('mycomponent', state, setState, callGas);
```

## Performance Tips

1. **Component Caching** - Components are cached after first load
2. **Lazy Loading** - Components only load when needed
3. **Data Caching** - Components check if data already loaded
4. **Skeleton Loaders** - Instant feedback while loading

## Troubleshooting

### Component not loading
- Check browser console for import errors
- Verify component name matches loader case statement
- Ensure component file exports the class correctly

### Data not showing
- Check if `loadData()` is being awaited
- Verify backend API is returning data
- Check state is being updated correctly

### Skeleton loaders not showing
- Ensure `dataLoaded` state is false initially
- Check if render() is called before data loads
- Verify skeleton HTML is in component render()

## Migration Path

To fully migrate from current app.js to modular components:

1. **Phase 1** (Current) - Components created, progress bar removed
2. **Phase 2** - Replace render functions with component calls
3. **Phase 3** - Remove duplicate code from app.js
4. **Phase 4** - Add routing and advanced features

You're currently at Phase 1 - components are ready to use!

