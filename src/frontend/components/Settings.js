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
            passwordData: {
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            }
        };
        this.loading = {
            organizationName: false,
            password: false,
            language: false
        };
    }

    async loadData() {
        this.setState({ loading: true });
        try {
            const res = await this.callGas('getSystemSettings', this.state.token);
            if (res && res.status === 'success') {
                this.currentSettings.organizationName = res.data.organizationName || '';
                this.setState({ loading: false });
                this.render();
            } else {
                this.setState({ 
                    loading: false, 
                    errorMessage: res?.message || t('failedToLoadSettings')
                });
            }
        } catch (error) {
            this.setState({ 
                loading: false, 
                errorMessage: t('failedToLoadSettings')
            });
        }
    }

    render() {
        const container = document.getElementById('admin-content');
        if (!container) return;

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

                        <!-- Password Change -->
                        <div class="col-12">
                            <div class="card">
                                <div class="card-header">
                                    <h3 class="card-title">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="icon me-2" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                            <rect x="5" y="11" width="14" height="10" rx="2"/>
                                            <circle cx="12" cy="16" r="1"/>
                                            <path d="M8 11v-4a4 4 0 0 1 8 0v4"/>
                                        </svg>
                                        ${t('changePassword')}
                                    </h3>
                                </div>
                                <div class="card-body">
                                    <div class="row">
                                        <div class="col-lg-8">
                                            <form id="password-form">
                                                <div class="mb-3">
                                                    <label class="form-label" for="current-password">${t('currentPassword')}</label>
                                                    <input type="password" 
                                                           class="form-control" 
                                                           id="current-password" 
                                                           placeholder="${t('enterCurrentPassword')}"
                                                           required>
                                                </div>
                                                <div class="mb-3">
                                                    <label class="form-label" for="new-password">${t('newPassword')}</label>
                                                    <input type="password" 
                                                           class="form-control" 
                                                           id="new-password" 
                                                           placeholder="${t('enterNewPassword')}"
                                                           minlength="6"
                                                           required>
                                                    <div class="form-hint">${t('passwordRequirements')}</div>
                                                </div>
                                                <div class="mb-3">
                                                    <label class="form-label" for="confirm-password">${t('confirmNewPassword')}</label>
                                                    <input type="password" 
                                                           class="form-control" 
                                                           id="confirm-password" 
                                                           placeholder="${t('confirmNewPassword')}"
                                                           required>
                                                </div>
                                                <div class="d-flex">
                                                    <button type="submit" class="btn btn-primary" ${this.loading.password ? 'disabled' : ''}>
                                                        ${this.loading.password ? `
                                                            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                                                            ${t('changing')}
                                                        ` : `
                                                            <svg xmlns="http://www.w3.org/2000/svg" class="icon me-2" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                                <path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2"/>
                                                                <circle cx="12" cy="14" r="2"/>
                                                                <polyline points="14,4 14,8 8,8 8,4"/>
                                                            </svg>
                                                            ${t('changePassword')}
                                                        `}
                                                    </button>
                                                    <button type="button" class="btn btn-link ms-2" id="btn-clear-password-form">
                                                        ${t('cancel')}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                        <div class="col-lg-4">
                                            <div class="card card-sm">
                                                <div class="card-body">
                                                    <div class="row align-items-center">
                                                        <div class="col-auto">
                                                            <span class="bg-blue text-white avatar">
                                                                <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                                                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                                                    <path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/>
                                                                </svg>
                                                            </span>
                                                        </div>
                                                        <div class="col">
                                                            <div class="font-weight-medium">${t('securityTip')}</div>
                                                            <div class="text-muted">${t('securityTipDescription')}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
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

        // Password form
        const passwordForm = document.getElementById('password-form');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => this.handlePasswordChange(e));
        }

        // Clear password form button
        const clearBtn = document.getElementById('btn-clear-password-form');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearPasswordForm());
        }

        // Real-time password validation
        const newPasswordInput = document.getElementById('new-password');
        const confirmPasswordInput = document.getElementById('confirm-password');
        
        if (newPasswordInput && confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', () => {
                this.validatePasswordMatch();
            });
            
            newPasswordInput.addEventListener('input', () => {
                this.validatePasswordMatch();
            });
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

    async handlePasswordChange(e) {
        e.preventDefault();

        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showError(t('allPasswordFieldsRequired'));
            return;
        }

        if (newPassword.length < 6) {
            this.showError(t('passwordTooShort'));
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showError(t('passwordsDoNotMatch'));
            return;
        }

        if (currentPassword === newPassword) {
            this.showError(t('newPasswordSameAsCurrent'));
            return;
        }

        this.loading.password = true;
        this.render();

        try {
            const res = await this.callGas('changeAdminPassword', this.state.token, {
                currentPassword: currentPassword,
                newPassword: newPassword
            });

            if (res && res.status === 'success') {
                this.clearPasswordForm();
                this.showSuccess(t('passwordChangedSuccessfully'));
            } else {
                this.showError(res?.message || t('failedToChangePassword'));
            }
        } catch (error) {
            this.showError(t('failedToChangePassword'));
        } finally {
            this.loading.password = false;
            this.render();
        }
    }

    validatePasswordMatch() {
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const confirmInput = document.getElementById('confirm-password');

        if (confirmPassword && newPassword !== confirmPassword) {
            confirmInput.classList.add('is-invalid');
            confirmInput.classList.remove('is-valid');
        } else if (confirmPassword) {
            confirmInput.classList.add('is-valid');
            confirmInput.classList.remove('is-invalid');
        } else {
            confirmInput.classList.remove('is-invalid', 'is-valid');
        }
    }

    clearPasswordForm() {
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
        
        // Remove validation classes
        const inputs = ['current-password', 'new-password', 'confirm-password'];
        inputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.classList.remove('is-invalid', 'is-valid');
            }
        });
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
        // You can implement info messages similar to success/error
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