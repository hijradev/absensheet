// Settings.js - Admin Settings component
import { t, setLanguage, getLanguage } from '../i18n/i18n.js';
import { availableLanguages } from '../i18n/languages.js';

export class Settings {
    constructor(state, setState, callGas) {
        this.state = state;
        this.setState = setState;
        this.callGas = callGas;
        this.currentSettings = {
            organizationName: '',
            currentLanguage: getLanguage(),
            geofence: {
                enabled: false,
                latitude: '',
                longitude: '',
                radius: ''
            }
        };
        this.loading = {
            organizationName: false,
            language: false,
            geofence: false
        };
        this.pageLoading = true;
    }

    async loadData() {
        this.pageLoading = true;
        this.render();
        try {
            const [systemRes, geofenceRes] = await Promise.all([
                this.callGas('getSystemSettings', this.state.token),
                this.callGas('getGeofenceSettings', this.state.token)
            ]);

            if (systemRes && systemRes.status === 'success') {
                this.currentSettings.organizationName = systemRes.data.organizationName || '';
            } else {
                this.setState({ errorMessage: systemRes?.message || t('failedToLoadSettings') });
            }

            if (geofenceRes && geofenceRes.status === 'success') {
                const gd = geofenceRes.data;
                this.currentSettings.geofence = {
                    enabled: gd.enabled || false,
                    latitude:  gd.latitude  !== null && gd.latitude  !== undefined ? String(gd.latitude)  : '',
                    longitude: gd.longitude !== null && gd.longitude !== undefined ? String(gd.longitude) : '',
                    radius:    gd.radius    !== null && gd.radius    !== undefined ? String(gd.radius)    : ''
                };
            }
            // If geofence settings fail to load, keep defaults (empty fields, disabled)

            this.pageLoading = false;
            this.render();
        } catch (error) {
            this.pageLoading = false;
            this.setState({ errorMessage: t('failedToLoadSettings') });
            this.render();
        }
    }

    render() {
        const container = document.getElementById('admin-content');
        if (!container) return;

        if (this.pageLoading) {
            container.innerHTML = `
                <div class="page-header d-print-none">
                    <div class="container-xl">
                        <div class="row g-2 align-items-center">
                            <div class="col">
                                <div class="page-pretitle placeholder-glow"><span class="placeholder col-2 rounded"></span></div>
                                <h2 class="page-title placeholder-glow"><span class="placeholder col-3 rounded"></span></h2>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="page-body">
                    <div class="container-xl">
                        <div class="row row-cards">
                            <div class="col-12 col-lg-6">
                                <div class="card">
                                    <div class="card-body">
                                        <div class="placeholder-glow mb-3"><span class="placeholder col-4 rounded"></span></div>
                                        <div class="placeholder-glow mb-3"><span class="placeholder col-12 rounded" style="height:38px;"></span></div>
                                        <div class="placeholder-glow"><span class="placeholder col-3 rounded" style="height:38px;"></span></div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-12 col-lg-6">
                                <div class="card">
                                    <div class="card-body">
                                        <div class="placeholder-glow mb-3"><span class="placeholder col-4 rounded"></span></div>
                                        <div class="row g-2">
                                            <div class="col-6"><div class="placeholder-glow"><span class="placeholder col-12 rounded" style="height:70px;"></span></div></div>
                                            <div class="col-6"><div class="placeholder-glow"><span class="placeholder col-12 rounded" style="height:70px;"></span></div></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="page-header d-print-none">
                <div class="container-xl">
                    <div class="row g-2 align-items-center">
                        <div class="col">
                            <div class="page-pretitle">${t('adminPanel')}</div>
                            <h2 class="page-title">${t('settings')}</h2>
                        </div>
                    </div>
                </div>
            </div>

            <div class="page-body">
                <div class="container-xl">
                    <div class="row row-deck row-cards">
                        <!-- Organization Settings -->
                        <div class="col-12 col-lg-6">
                            <div class="card">
                                <div class="card-header">
                                    <h3 class="card-title">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="icon me-2" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                            <path d="M3 21l18 0"/>
                                            <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16"/>
                                            <path d="M9 9l0 .01"/>
                                            <path d="M15 9l0 .01"/>
                                            <path d="M10 12l4 0"/>
                                            <path d="M10 15l4 0"/>
                                        </svg>
                                        ${t('organizationSettings')}
                                    </h3>
                                </div>
                                <div class="card-body">
                                    <form id="organization-form">
                                        <div class="mb-3">
                                            <label class="form-label" for="organization-name">${t('organizationName')}</label>
                                            <input type="text" 
                                                   class="form-control" 
                                                   id="organization-name" 
                                                   value="${this.escHtml(this.currentSettings.organizationName)}"
                                                   placeholder="${t('enterOrganizationName')}"
                                                   maxlength="100">
                                            <div class="form-hint">${t('organizationNameHint')}</div>
                                        </div>
                                        <div class="d-flex">
                                            <button type="submit" class="btn btn-primary" ${this.loading.organizationName ? 'disabled' : ''}>
                                                ${this.loading.organizationName ? `
                                                    <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                                                    ${t('saving')}
                                                ` : `
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="icon me-2" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                        <path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2"/>
                                                        <circle cx="12" cy="14" r="2"/>
                                                        <polyline points="14,4 14,8 8,8 8,4"/>
                                                    </svg>
                                                    ${t('save')}
                                                `}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>

                        <!-- Language Settings -->
                        <div class="col-12 col-lg-6">
                            <div class="card">
                                <div class="card-header">
                                    <h3 class="card-title">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="icon me-2" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                            <circle cx="12" cy="12" r="9"/>
                                            <line x1="3.6" y1="9" x2="20.4" y2="9"/>
                                            <line x1="3.6" y1="15" x2="20.4" y2="15"/>
                                            <path d="M11.5 3a17 17 0 0 0 0 18"/>
                                            <path d="M12.5 3a17 17 0 0 1 0 18"/>
                                        </svg>
                                        ${t('languageSettings')}
                                    </h3>
                                </div>
                                <div class="card-body">
                                    <div class="mb-3">
                                        <label class="form-label">${t('selectLanguage')}</label>
                                        <div class="row g-2">
                                            ${availableLanguages.map(lang => `
                                                <div class="col-6">
                                                    <label class="form-selectgroup-item">
                                                        <input type="radio" 
                                                               name="language" 
                                                               value="${lang.code}" 
                                                               class="form-selectgroup-input"
                                                               ${this.currentSettings.currentLanguage === lang.code ? 'checked' : ''}>
                                                        <span class="form-selectgroup-label d-flex align-items-center p-3">
                                                            <span class="me-3">
                                                                <span class="flag flag-${lang.code === 'en' ? 'us' : 'id'}"></span>
                                                            </span>
                                                            <span class="form-selectgroup-label-content">
                                                                <span class="form-selectgroup-title strong">${lang.name}</span>
                                                                <span class="d-block text-muted">${lang.code.toUpperCase()}</span>
                                                            </span>
                                                        </span>
                                                    </label>
                                                </div>
                                            `).join('')}
                                        </div>
                                        <div class="form-hint">${t('languageChangeHint')}</div>
                                    </div>
                                    <div class="d-flex">
                                        <button type="button" id="save-language-btn" class="btn btn-primary" ${this.loading.language ? 'disabled' : ''}>
                                            ${this.loading.language ? `
                                                <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                                                ${t('saving')}
                                            ` : `
                                                <svg xmlns="http://www.w3.org/2000/svg" class="icon me-2" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                    <path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2"/>
                                                    <circle cx="12" cy="14" r="2"/>
                                                    <polyline points="14,4 14,8 8,8 8,4"/>
                                                </svg>
                                                ${t('save')}
                                            `}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Geofence Settings -->
                        <div class="col-12">
                            <div class="card">
                                <div class="card-header">
                                    <h3 class="card-title">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="icon me-2" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                            <circle cx="12" cy="11" r="3"/>
                                            <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"/>
                                        </svg>
                                        Geofence Settings
                                    </h3>
                                </div>
                                <div class="card-body">
                                    <form id="geofence-form">
                                        <!-- Enable/Disable toggle -->
                                        <div class="mb-3">
                                            <label class="form-check form-switch">
                                                <input class="form-check-input" type="checkbox" id="geofence-enabled"
                                                       ${this.currentSettings.geofence.enabled ? 'checked' : ''}>
                                                <span class="form-check-label">Enable geofencing</span>
                                            </label>
                                            <div class="form-hint" id="geofence-enabled-hint">
                                                When enabled, employees must be within the configured radius to clock in or out.
                                            </div>
                                        </div>

                                        <div class="row g-3">
                                            <!-- Latitude -->
                                            <div class="col-12 col-md-4">
                                                <label class="form-label" for="geofence-latitude">Latitude</label>
                                                <input type="number"
                                                       class="form-control"
                                                       id="geofence-latitude"
                                                       value="${this.escHtml(this.currentSettings.geofence.latitude)}"
                                                       step="any"
                                                       min="-90"
                                                       max="90"
                                                       placeholder="e.g. -6.200000"
                                                       aria-describedby="geofence-latitude-hint">
                                                <div class="form-hint" id="geofence-latitude-hint">
                                                    Decimal degrees, −90 to 90.
                                                </div>
                                            </div>

                                            <!-- Longitude -->
                                            <div class="col-12 col-md-4">
                                                <label class="form-label" for="geofence-longitude">Longitude</label>
                                                <input type="number"
                                                       class="form-control"
                                                       id="geofence-longitude"
                                                       value="${this.escHtml(this.currentSettings.geofence.longitude)}"
                                                       step="any"
                                                       min="-180"
                                                       max="180"
                                                       placeholder="e.g. 106.816666"
                                                       aria-describedby="geofence-longitude-hint">
                                                <div class="form-hint" id="geofence-longitude-hint">
                                                    Decimal degrees, −180 to 180.
                                                </div>
                                            </div>

                                            <!-- Radius -->
                                            <div class="col-12 col-md-4">
                                                <label class="form-label" for="geofence-radius">Radius</label>
                                                <input type="number"
                                                       class="form-control"
                                                       id="geofence-radius"
                                                       value="${this.escHtml(this.currentSettings.geofence.radius)}"
                                                       min="10"
                                                       max="50000"
                                                       placeholder="meters"
                                                       aria-describedby="geofence-radius-hint">
                                                <div class="form-hint" id="geofence-radius-hint">
                                                    Allowed radius in meters (10–50,000).
                                                </div>
                                            </div>
                                        </div>

                                        <div class="d-flex gap-2 mt-3">
                                            <button type="button" id="geofence-use-location-btn" class="btn btn-secondary">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="icon me-2" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                    <circle cx="12" cy="12" r="4"/>
                                                    <path d="M12 2v2"/>
                                                    <path d="M12 20v2"/>
                                                    <path d="M2 12h2"/>
                                                    <path d="M20 12h2"/>
                                                </svg>
                                                Use My Current Location
                                            </button>
                                            <button type="submit" class="btn btn-primary" ${this.loading.geofence ? 'disabled' : ''}>
                                                ${this.loading.geofence ? `
                                                    <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                                                    Saving…
                                                ` : `
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="icon me-2" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                        <path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2"/>
                                                        <circle cx="12" cy="14" r="2"/>
                                                        <polyline points="14,4 14,8 8,8 8,4"/>
                                                    </svg>
                                                    ${t('save')}
                                                `}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    attachEventListeners() {
        // Organization form
        const orgForm = document.getElementById('organization-form');
        if (orgForm) {
            orgForm.addEventListener('submit', (e) => this.handleOrganizationSave(e));
        }

        // Language selection
        const languageRadios = document.querySelectorAll('input[name="language"]');
        languageRadios.forEach(radio => {
            radio.addEventListener('change', () => this.handleLanguageChange());
        });

        const saveLanguageBtn = document.getElementById('save-language-btn');
        if (saveLanguageBtn) {
            saveLanguageBtn.addEventListener('click', () => this.handleLanguageSave());
        }

        // Geofence form
        const geofenceForm = document.getElementById('geofence-form');
        if (geofenceForm) {
            geofenceForm.addEventListener('submit', (e) => this.handleGeofenceSave(e));
        }

        const useLocationBtn = document.getElementById('geofence-use-location-btn');
        if (useLocationBtn) {
            useLocationBtn.addEventListener('click', () => this.handleUseMyLocation());
        }
    }

    async handleOrganizationSave(e) {
        e.preventDefault();
        
        const orgNameInput = document.getElementById('organization-name');
        const organizationName = orgNameInput.value.trim();

        if (!organizationName) {
            this.showError(t('organizationNameRequired'));
            return;
        }

        this.loading.organizationName = true;
        this.render();

        try {
            const res = await this.callGas('saveOrganizationSettings', this.state.token, {
                organizationName: organizationName
            });

            if (res && res.status === 'success') {
                this.currentSettings.organizationName = organizationName;
                this.setState({ organizationName: organizationName });
                this.showSuccess(t('organizationSettingsSaved'));
            } else {
                this.showError(res?.message || t('failedToSaveSettings'));
            }
        } catch (error) {
            this.showError(t('failedToSaveSettings'));
        } finally {
            this.loading.organizationName = false;
            this.render();
        }
    }

    handleLanguageChange() {
        const selectedRadio = document.querySelector('input[name="language"]:checked');
        if (selectedRadio) {
            this.currentSettings.currentLanguage = selectedRadio.value;
        }
    }

    async handleLanguageSave() {
        const selectedLanguage = this.currentSettings.currentLanguage;
        
        if (selectedLanguage === getLanguage()) {
            this.showInfo(t('languageAlreadySelected'));
            return;
        }

        this.loading.language = true;
        this.render();

        try {
            // Save language preference to backend
            const res = await this.callGas('saveLanguagePreference', this.state.token, {
                language: selectedLanguage
            });

            if (res && res.status === 'success') {
                // Apply language change locally
                setLanguage(selectedLanguage);
                this.showSuccess(t('languageChanged'));
                
                // Re-render the entire page with new language
                setTimeout(() => {
                    this.render();
                    // Update the main app language display
                    if (window.updateAllTranslations) {
                        window.updateAllTranslations();
                    }
                }, 500);
            } else {
                this.showError(res?.message || t('failedToChangeLanguage'));
            }
        } catch (error) {
            this.showError(t('failedToChangeLanguage'));
        } finally {
            this.loading.language = false;
        }
    }

    async handleGeofenceSave(e) {
        e.preventDefault();

        const enabledInput  = document.getElementById('geofence-enabled');
        const latInput      = document.getElementById('geofence-latitude');
        const lngInput      = document.getElementById('geofence-longitude');
        const radiusInput   = document.getElementById('geofence-radius');

        const enabled   = enabledInput ? enabledInput.checked : false;
        const latitude  = latInput    ? parseFloat(latInput.value)   : NaN;
        const longitude = lngInput    ? parseFloat(lngInput.value)   : NaN;
        const radius    = radiusInput ? parseFloat(radiusInput.value) : NaN;

        this.loading.geofence = true;
        this.render();

        try {
            const res = await this.callGas('saveGeofenceSettings', this.state.token, {
                enabled,
                latitude,
                longitude,
                radius
            });

            if (res && res.status === 'success') {
                this.currentSettings.geofence = {
                    enabled,
                    latitude:  isNaN(latitude)  ? '' : String(latitude),
                    longitude: isNaN(longitude) ? '' : String(longitude),
                    radius:    isNaN(radius)    ? '' : String(radius)
                };
                this.showSuccess('Geofence settings saved successfully.');
            } else {
                this.showError(res?.message || 'Failed to save geofence settings.');
            }
        } catch (error) {
            this.showError('Failed to save geofence settings.');
        } finally {
            this.loading.geofence = false;
            this.render();
        }
    }

    handleUseMyLocation() {
        if (!navigator.geolocation) {
            this.showError('Location services are not supported by this browser.');
            return;
        }

        const useLocationBtn = document.getElementById('geofence-use-location-btn');
        if (useLocationBtn) {
            useLocationBtn.disabled = true;
            useLocationBtn.textContent = 'Acquiring location…';
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const latInput = document.getElementById('geofence-latitude');
                const lngInput = document.getElementById('geofence-longitude');

                if (latInput) latInput.value = position.coords.latitude;
                if (lngInput) lngInput.value = position.coords.longitude;

                if (useLocationBtn) {
                    useLocationBtn.disabled = false;
                    useLocationBtn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" class="icon me-2" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                            <circle cx="12" cy="12" r="4"/>
                            <path d="M12 2v2"/>
                            <path d="M12 20v2"/>
                            <path d="M2 12h2"/>
                            <path d="M20 12h2"/>
                        </svg>
                        Use My Current Location
                    `;
                }
            },
            (error) => {
                if (useLocationBtn) {
                    useLocationBtn.disabled = false;
                    useLocationBtn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" class="icon me-2" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                            <circle cx="12" cy="12" r="4"/>
                            <path d="M12 2v2"/>
                            <path d="M12 20v2"/>
                            <path d="M2 12h2"/>
                            <path d="M20 12h2"/>
                        </svg>
                        Use My Current Location
                    `;
                }

                let message;
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'Location permission denied. Please allow location access and try again.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'Unable to determine your location. Please check your GPS signal.';
                        break;
                    case error.TIMEOUT:
                        message = 'Location request timed out. Please try again.';
                        break;
                    default:
                        message = 'Failed to obtain your location. Please enter coordinates manually.';
                }
                this.showError(message);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }

    showSuccess(message) {
        this.setState({ 
            successMessage: message, 
            errorMessage: '' 
        });
        setTimeout(() => {
            this.setState({ successMessage: '' });
        }, 3000);
    }

    showError(message) {
        this.setState({ 
            errorMessage: message, 
            successMessage: '' 
        });
        setTimeout(() => {
            this.setState({ errorMessage: '' });
        }, 5000);
    }

    showInfo(message) {
        this.showSuccess(message);
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
