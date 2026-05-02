# Untranslated Strings Report

## Summary
The codebase has been examined for untranslated strings. While there is a comprehensive i18n system in place with translations for English and Bahasa Indonesia, many components still contain hardcoded English strings that should be using the translation system.

## Issues Found

### 1. Frontend Components with Hardcoded English Strings

#### UserManagement.js
- Line 78: `'No users found.'`
- Line 85: `'No users match the current filter.'`
- Line 150: `'Failed to load management data.'`
- Line 154: `'Connection error while loading management data.'`
- Line 240: `'No data to export'` (in exportToCSV method)
- Line 248: `'No data to print'` (in printUsers method)

#### DailyAttendance.js
- Line 50: `'Failed to load attendance data.'`
- Line 77: `'Failed to load attendance'`
- Line 85: `'Select a date and click load to view attendance'`
- Line 100: `'No records match the current filter.'`
- Line 241: `'Admin Entry'`
- Line 258: `'Admin Entry'` (in locationBadge method)
- Line 285: `'In Zone'`
- Line 292: `'Out Zone'`
- Line 299: `'N/A'`

#### PositionManagement.js
- Line 24: `'Failed to load management data.'`
- Line 28: `'Connection error while loading management data.'`

#### ShiftManagement.js
- Similar issues likely exist (not fully examined)

#### GeolocationService.js
- Line 52: `'Location services not supported by this browser.'`
- Line 67: `'Location permission denied. Please allow location access and try again.'`
- Line 70: `'Unable to determine your location. Please check your GPS signal.'`
- Line 73: `'Location request timed out. Please try again.'`
- Line 76: `'Unable to determine your location. Please check your GPS signal.'`

### 2. Backend Files with English Strings

#### Auth.gs
- Line 40: `'Login successful'`
- Line 43: `'Error during login: ' + e.message`
- Line 52: `'Unauthorized'`
- Line 97: `'Invalid data.'`
- Line 131: `'Changed own password'`
- Line 133: `'Password changed successfully.'`
- Line 145: `'Unauthorized'`
- Line 148: `'Missing file data.'`
- Line 173: `'Updated profile photo'`
- Line 175: `'Avatar updated successfully.'`

#### Helper.gs
- Line 17: `'Success'` (default parameter)
- Line 22: `'error'` (status string)

#### Other backend files
- Various success/error messages throughout backend files

### 3. Missing Translation Keys

Many of the hardcoded strings don't have corresponding translation keys in `languages.js`. For example:
- `'No users found.'` - not in translations
- `'No users match the current filter.'` - not in translations  
- `'Select a date and click load to view attendance'` - not in translations
- `'Admin Entry'` - not in translations
- `'In Zone'` / `'Out Zone'` - not in translations
- Geolocation error messages - not in translations

## Recommendations

### 1. Add Missing Translation Keys
Add the following keys to both English and Bahasa Indonesia translations in `languages.js`:

```javascript
// Add to translations.en
noUsersFound: 'No users found',
noUsersMatchFilter: 'No users match the current filter',
selectDateAndLoad: 'Select a date and click Load to view attendance',
adminEntry: 'Admin Entry',
inZone: 'In Zone',
outZone: 'Out Zone',
noLocationData: 'N/A',
locationServicesNotSupported: 'Location services not supported by this browser',
locationPermissionDenied: 'Location permission denied. Please allow location access and try again',
unableToDetermineLocation: 'Unable to determine your location. Please check your GPS signal',
locationRequestTimeout: 'Location request timed out. Please try again',
noDataToExport: 'No data to export',
noDataToPrint: 'No data to print',

// Add to translations.id (with Indonesian translations)
```

### 2. Update Frontend Components
Replace hardcoded strings with translation function calls:

```javascript
// Before:
table.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No users found.</td></tr>';

// After:
table.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">${t('noUsersFound')}</td></tr>`;
```

### 3. Update Backend Files
Consider adding i18n support to backend or at least centralize error/success messages for consistency.

### 4. Create Translation Audit Script
Create a script to scan for hardcoded strings and compare against translation keys to identify gaps.

## Priority
1. **High Priority**: User-facing strings in frontend components
2. **Medium Priority**: Error/success messages in backend
3. **Low Priority**: Console/log messages

The i18n system is well-implemented but not fully utilized. With these fixes, the application will be fully translatable.