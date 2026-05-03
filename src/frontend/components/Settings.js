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
            },
            monthlyEmail: {
                enabled: false,
                recipient: '',
                scheduleDay: '1',
                scheduleHour: '9',
                scheduleMinute: '0'
            }
        };
        this.loading = {
            organizationName: false,
            language: false,
            geofence: false,
            monthlyEmail: false
        };
        this.deliveryLogs = [];
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

            // Load email settings and delivery logs independently so failures don't block the page
            await this.loadEmailSettings();

            this.pageLoading = false;
            this.render();
        } catch (error) {
            this.pageLoading = false;
            this.setState({ errorMessage: t('failedToLoadSettings') });
            this.render();
        }
    }

    /**
     * Fetch current email configuration from the backend and update UI state.
     * Also loads delivery logs. Handles loading states and error conditions
     * gracefully — failures keep the existing defaults rather than breaking the page.
     * Requirements: 1.3, 5.4
     */
    async loadEmailSettings() {
        this.loading.monthlyEmail = true;

        try {
            const [emailRes] = await Promise.all([
                this.callGas('getEmailSettings', this.state.token)
            ]);

            if (emailRes && emailRes.status === 'success') {
                const ed = emailRes.data;
                this.currentSettings.monthlyEmail = {
                    enabled: ed.enabled || false,
                    recipient: ed.recipient || '',
                    scheduleDay:    ed.scheduleDay    !== null && ed.scheduleDay    !== undefined ? String(ed.scheduleDay)    : '1',
                    scheduleHour:   ed.scheduleHour   !== null && ed.scheduleHour   !== undefined ? String(ed.scheduleHour)   : '9',
                    scheduleMinute: ed.scheduleMinute !== null && ed.scheduleMinute !== undefined ? String(ed.scheduleMinute) : '0'
                };
            }
            // If email settings fail to load, keep defaults silently

            // Load delivery logs as part of the email settings initialisation
            await this.loadDeliveryLogs();
        } catch (error) {
            // Non-fatal: email settings are optional for the page to function
            console.error('Failed to load email settings:', error);
        } finally {
            this.loading.monthlyEmail = false;
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
                            <div class="page-pretitle">${t('adminPanel.adminPanel')}</div>
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
                                        ${t('enableGeofencing')}
                                    </h3>
                                </div>
                                <div class="card-body">
                                    <form id="geofence-form">
                                        <!-- Enable/Disable toggle -->
                                        <div class="mb-3">
                                            <label class="form-check form-switch">
                                                <input class="form-check-input" type="checkbox" id="geofence-enabled"
                                                       ${this.currentSettings.geofence.enabled ? 'checked' : ''}>
                                                <span class="form-check-label">${t('enableGeofencing')}</span>
                                            </label>
                                            <div class="form-hint" id="geofence-enabled-hint">
                                                ${t('geofenceEnabledHint')}
                                            </div>
                                        </div>

                                        <div class="row g-3">
                                            <!-- Latitude -->
                                            <div class="col-12 col-md-4">
                                                <label class="form-label" for="geofence-latitude">${t('latitude')}</label>
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
                                                    ${t('latitudeHint')}
                                                </div>
                                            </div>

                                            <!-- Longitude -->
                                            <div class="col-12 col-md-4">
                                                <label class="form-label" for="geofence-longitude">${t('longitude')}</label>
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
                                                    ${t('longitudeHint')}
                                                </div>
                                            </div>

                                            <!-- Radius -->
                                            <div class="col-12 col-md-4">
                                                <label class="form-label" for="geofence-radius">${t('radius')}</label>
                                                <input type="number"
                                                       class="form-control"
                                                       id="geofence-radius"
                                                       value="${this.escHtml(this.currentSettings.geofence.radius)}"
                                                       min="10"
                                                       max="50000"
                                                       placeholder="meters"
                                                       aria-describedby="geofence-radius-hint">
                                                <div class="form-hint" id="geofence-radius-hint">
                                                    ${t('radiusHint')}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <!-- Interactive Map -->
                                        <div class="mt-3">
                                            <label class="form-label">Location Preview</label>
                                            <div id="geofence-map" style="height: 350px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.1); background: #f8f9fa;" class="mb-2"></div>
                                            <div class="text-muted small">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-inline me-1" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 12l3 2" /><path d="M12 7v5" /></svg>
                                                Click on the map to set the work location.
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
                                                ${t('useMyCurrentLocation')}
                                            </button>
                                            <button type="submit" class="btn btn-primary" ${this.loading.geofence ? 'disabled' : ''}>
                                                ${this.loading.geofence ? `
                                                    <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                                                    ${t('savingEllipsis')}
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

                        <!-- Monthly Report Email Settings -->
                        <div class="col-12">
                            <div class="card">
                                <div class="card-header">
                                    <h3 class="card-title">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="icon me-2" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                            <rect x="3" y="5" width="18" height="14" rx="2"/>
                                            <polyline points="3 7 12 13 21 7"/>
                                        </svg>
                                        ${t('enableAutomaticMonthlyEmails')}
                                    </h3>
                                </div>
                                <div class="card-body">
                                    <form id="monthly-email-form">
                                        <!-- Enable/Disable toggle -->
                                        <div class="mb-3">
                                            <label class="form-check form-switch">
                                                <input class="form-check-input" type="checkbox" id="monthly-email-enabled"
                                                       ${this.currentSettings.monthlyEmail.enabled ? 'checked' : ''}>
                                                <span class="form-check-label">${t('enableAutomaticMonthlyEmails')}</span>
                                            </label>
                                            <div class="form-hint">
                                                ${t('monthlyEmailEnabledHint')}
                                            </div>
                                        </div>

                                        <!-- Email Recipient -->
                                        <div class="mb-3">
                                            <label class="form-label" for="monthly-email-recipient">${t('emailRecipient')}</label>
                                            <input type="email"
                                                   class="form-control"
                                                   id="monthly-email-recipient"
                                                   value="${this.escHtml(this.currentSettings.monthlyEmail.recipient)}"
                                                   placeholder="admin@company.com"
                                                   aria-describedby="monthly-email-recipient-hint">
                                            <div class="form-hint" id="monthly-email-recipient-hint">
                                                ${t('emailRecipientHint')}
                                            </div>
                                        </div>

                                        <!-- Schedule Configuration -->
                                        <div class="mb-3">
                                            <label class="form-label">${t('schedule')}</label>
                                            <div class="row g-2">
                                                <div class="col-12 col-md-4">
                                                    <label class="form-label" for="monthly-email-day">${t('dayOfMonth')}</label>
                                                    <input type="number"
                                                           class="form-control"
                                                           id="monthly-email-day"
                                                           value="${this.escHtml(this.currentSettings.monthlyEmail.scheduleDay)}"
                                                           min="1"
                                                           max="28"
                                                           placeholder="1-28">
                                                    <div class="form-hint">${t('dayOfMonth')} (1-28)</div>
                                                </div>
                                                <div class="col-12 col-md-4">
                                                    <label class="form-label" for="monthly-email-hour">${t('hour')}</label>
                                                    <input type="number"
                                                           class="form-control"
                                                           id="monthly-email-hour"
                                                           value="${this.escHtml(this.currentSettings.monthlyEmail.scheduleHour)}"
                                                           min="0"
                                                           max="23"
                                                           placeholder="0-23">
                                                    <div class="form-hint">${t('hour')} (0-23)</div>
                                                </div>
                                                <div class="col-12 col-md-4">
                                                    <label class="form-label" for="monthly-email-minute">${t('minute')}</label>
                                                    <input type="number"
                                                           class="form-control"
                                                           id="monthly-email-minute"
                                                           value="${this.escHtml(this.currentSettings.monthlyEmail.scheduleMinute)}"
                                                           min="0"
                                                           max="59"
                                                           placeholder="0-59">
                                                    <div class="form-hint">${t('minute')} (0-59)</div>
                                                </div>
                                            </div>
                                            <div class="form-hint mt-2">
                                                Reports will be sent on the specified day and time each month. If the day doesn't exist in a month, it will be sent on the last day of that month.
                                            </div>
                                        </div>

                                        <!-- Action Buttons -->
                                        <div class="d-flex gap-2">
                                            <button type="submit" class="btn btn-primary" ${this.loading.monthlyEmail ? 'disabled' : ''}>
                                                ${this.loading.monthlyEmail ? `
                                                    <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                                                    ${t('savingEllipsis')}
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
                                            <button type="button" id="monthly-email-send-now-btn" class="btn btn-secondary">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="icon me-2" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                    <line x1="10" y1="14" x2="21" y2="3"/>
                                                    <path d="M21 3l-6.5 18a0.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a0.55 .55 0 0 1 0 -1l18 -6.5"/>
                                                </svg>
                                                Send Now
                                            </button>
                                        </div>
                                    </form>

                                    <!-- Delivery Logs -->
                                    <div class="mt-4">
                                        <h4 class="card-title">Delivery Logs</h4>
                                        <div class="table-responsive">
                                            <table class="table table-vcenter card-table">
                                                <thead>
                                                    <tr>
                                                        <th>Timestamp</th>
                                                        <th>Recipient</th>
                                                        <th>Month/Year</th>
                                                        <th>Status</th>
                                                        <th>Type</th>
                                                    </tr>
                                                </thead>
                                                <tbody id="delivery-logs-tbody">
                                                    ${this.deliveryLogs.length === 0 ? `
                                                        <tr>
                                                            <td colspan="5" class="text-muted text-center">No delivery logs available</td>
                                                        </tr>
                                                    ` : this.deliveryLogs.map(log => `
                                                        <tr>
                                                            <td>${this.escHtml(log.timestamp)}</td>
                                                            <td>${this.escHtml(log.recipient)}</td>
                                                            <td>${this.escHtml(log.monthYear)}</td>
                                                            <td>
                                                                <span class="badge bg-${log.status === 'success' ? 'success' : 'danger'}">
                                                                    ${this.escHtml(log.status)}
                                                                </span>
                                                            </td>
                                                            <td>${this.escHtml(log.triggerType)}</td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
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

        // Monthly email form — submit and manual send
        // Requirements: 1.1, 2.1, 6.1
        const monthlyEmailForm = document.getElementById('monthly-email-form');
        if (monthlyEmailForm) {
            monthlyEmailForm.addEventListener('submit', (e) => this.handleEmailSettingsSave(e));
        }

        const sendNowBtn = document.getElementById('monthly-email-send-now-btn');
        if (sendNowBtn) {
            sendNowBtn.addEventListener('click', () => this.handleManualSend());
        }

        // Keep in-memory state in sync with the enable/disable toggle so that
        // Requirement 5.5 (UI state consistency) is satisfied without requiring
        // a full save first.
        const enabledToggle = document.getElementById('monthly-email-enabled');
        if (enabledToggle) {
            enabledToggle.addEventListener('change', () => {
                this.currentSettings.monthlyEmail.enabled = enabledToggle.checked;
            });
        }

        // Mirror schedule control changes into in-memory state so that a
        // subsequent manual send or re-render reflects the latest values.
        const dayInput = document.getElementById('monthly-email-day');
        if (dayInput) {
            dayInput.addEventListener('change', () => {
                this.currentSettings.monthlyEmail.scheduleDay = dayInput.value;
            });
        }

        const hourInput = document.getElementById('monthly-email-hour');
        if (hourInput) {
            hourInput.addEventListener('change', () => {
                this.currentSettings.monthlyEmail.scheduleHour = hourInput.value;
            });
        }

        const minuteInput = document.getElementById('monthly-email-minute');
        if (minuteInput) {
            minuteInput.addEventListener('change', () => {
                this.currentSettings.monthlyEmail.scheduleMinute = minuteInput.value;
            });
        }
        
        // Initialise geofence map if visible
        this.initGeofenceMap();
    }

    initGeofenceMap() {
        const mapEl = document.getElementById('geofence-map');
        if (!mapEl) return;

        const latInput = document.getElementById('geofence-latitude');
        const lngInput = document.getElementById('geofence-longitude');
        const radInput = document.getElementById('geofence-radius');

        let lat = parseFloat(latInput.value);
        let lng = parseFloat(lngInput.value);
        let rad = parseFloat(radInput.value) || 100;

        // Default to Indonesia center if no coords
        if (isNaN(lat) || isNaN(lng)) {
            lat = -6.2088;
            lng = 106.8456;
        }

        if (this.map) {
            this.map.remove();
        }

        try {
            this.map = L.map('geofence-map').setView([lat, lng], 16);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.map);

            this.marker = L.marker([lat, lng], { draggable: true }).addTo(this.map);
            this.circle = L.circle([lat, lng], {
                color: '#2fb344',
                fillColor: '#2fb344',
                fillOpacity: 0.2,
                radius: rad
            }).addTo(this.map);

            // Sync marker drag to inputs
            this.marker.on('dragend', (e) => {
                const pos = e.target.getLatLng();
                latInput.value = pos.lat.toFixed(6);
                lngInput.value = pos.lng.toFixed(6);
                this.circle.setLatLng(pos);
            });

            // Map click to move marker
            this.map.on('click', (e) => {
                const pos = e.latlng;
                this.marker.setLatLng(pos);
                this.circle.setLatLng(pos);
                latInput.value = pos.lat.toFixed(6);
                lngInput.value = pos.lng.toFixed(6);
            });

            // Input listeners to sync to map
            const updateMap = () => {
                const nLat = parseFloat(latInput.value);
                const nLng = parseFloat(lngInput.value);
                const nRad = parseFloat(radInput.value) || 0;
                if (!isNaN(nLat) && !isNaN(nLng)) {
                    const pos = [nLat, nLng];
                    this.marker.setLatLng(pos);
                    this.circle.setLatLng(pos);
                    if (this.circle.getRadius() !== nRad) this.circle.setRadius(nRad);
                }
            };

            latInput.addEventListener('input', updateMap);
            lngInput.addEventListener('input', updateMap);
            radInput.addEventListener('input', updateMap);

        } catch (e) {
            console.error('Leaflet error:', e);
            mapEl.innerHTML = `<div class="p-4 text-center text-danger">Failed to load map. Please check your connection.</div>`;
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
                
                // Synchronize with global state immediately
                this.setState({
                    geofenceEnabled: enabled,
                    geofenceWorkLat: isNaN(latitude) ? null : latitude,
                    geofenceWorkLng: isNaN(longitude) ? null : longitude,
                    geofenceRadius: isNaN(radius) ? null : radius
                });

                this.showSuccess(t('organizationSettingsSaved'));
            } else {
                this.showError(res?.message || t('failedToSaveSettings'));
            }
        } catch (error) {
            this.showError(t('failedToSaveSettings'));
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

    /**
     * Handle email configuration form submission.
     * Validates email format and schedule parameters on the frontend before
     * submitting to the backend. Updates UI state and shows success/error messages.
     * Requirements: 1.2, 1.4, 1.5, 2.2, 2.6, 2.7
     */
    async handleEmailSettingsSave(e) {
        e.preventDefault();

        const enabledInput   = document.getElementById('monthly-email-enabled');
        const recipientInput = document.getElementById('monthly-email-recipient');
        const dayInput       = document.getElementById('monthly-email-day');
        const hourInput      = document.getElementById('monthly-email-hour');
        const minuteInput    = document.getElementById('monthly-email-minute');

        const enabled        = enabledInput   ? enabledInput.checked          : false;
        const recipient      = recipientInput ? recipientInput.value.trim()   : '';
        const scheduleDay    = dayInput       ? dayInput.value                : '1';
        const scheduleHour   = hourInput      ? hourInput.value               : '9';
        const scheduleMinute = minuteInput    ? minuteInput.value             : '0';

        // Requirement 1.2 / 1.4: validate email format
        if (enabled && !recipient) {
            this.showError('Email recipient is required when automatic emails are enabled.');
            return;
        }

        if (recipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
            this.showError('Please enter a valid email address.');
            return;
        }

        // Requirement 2.2 / 2.6 / 2.7: validate schedule parameters
        const day    = parseInt(scheduleDay,    10);
        const hour   = parseInt(scheduleHour,   10);
        const minute = parseInt(scheduleMinute, 10);

        if (isNaN(day) || day < 1 || day > 28) {
            this.showError('Day must be between 1 and 28.');
            return;
        }

        if (isNaN(hour) || hour < 0 || hour > 23) {
            this.showError('Hour must be between 0 and 23.');
            return;
        }

        if (isNaN(minute) || minute < 0 || minute > 59) {
            this.showError('Minute must be between 0 and 59.');
            return;
        }

        this.loading.monthlyEmail = true;
        this.render();

        try {
            const res = await this.callGas('saveEmailSettings', this.state.token, {
                enabled,
                recipient,
                scheduleDay:    day,
                scheduleHour:   hour,
                scheduleMinute: minute
            });

            if (res && res.status === 'success') {
                this.currentSettings.monthlyEmail = {
                    enabled,
                    recipient,
                    scheduleDay:    String(day),
                    scheduleHour:   String(hour),
                    scheduleMinute: String(minute)
                };
                this.showSuccess('Monthly email settings saved successfully.');
            } else {
                this.showError(res?.message || 'Failed to save monthly email settings.');
            }
        } catch (error) {
            this.showError('Failed to save monthly email settings.');
        } finally {
            this.loading.monthlyEmail = false;
            this.render();
        }
    }

    /** Alias kept for backward compatibility with existing event listener wiring. */
    async handleMonthlyEmailSave(e) {
        return this.handleEmailSettingsSave(e);
    }

    async handleManualSend() {
        const sendNowBtn = document.getElementById('monthly-email-send-now-btn');
        if (sendNowBtn) {
            sendNowBtn.disabled = true;
            sendNowBtn.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                Sending…
            `;
        }

        try {
            const res = await this.callGas('sendManualMonthlyReport', this.state.token);

            if (res && res.status === 'success') {
                this.showSuccess('Monthly report sent successfully.');
                // Reload delivery logs to show the new entry
                await this.loadDeliveryLogs();
            } else {
                this.showError(res?.message || 'Failed to send monthly report.');
            }
        } catch (error) {
            this.showError('Failed to send monthly report.');
        } finally {
            if (sendNowBtn) {
                sendNowBtn.disabled = false;
                sendNowBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="icon me-2" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                        <path d="M21 3l-6.5 18a0.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a0.55 .55 0 0 1 0 -1l18 -6.5"/>
                    </svg>
                    Send Now
                `;
            }
        }
    }

    async loadDeliveryLogs() {
        try {
            const res = await this.callGas('getEmailDeliveryLogs', this.state.token);

            if (res && res.status === 'success') {
                this.deliveryLogs = res.data || [];
                this.render();
            }
        } catch (error) {
            // Silently fail - logs are not critical
            console.error('Failed to load delivery logs:', error);
        }
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
        // Mark the instance as destroyed so any in-flight async operations
        // (e.g. pending callGas responses) can bail out early and avoid
        // updating state on an unmounted component.
        this._destroyed = true;

        // Clear the rendered DOM so event listeners attached to child elements
        // are garbage-collected along with those elements.
        const container = document.getElementById('admin-content');
        if (container) {
            container.innerHTML = '';
        }
    }
}
