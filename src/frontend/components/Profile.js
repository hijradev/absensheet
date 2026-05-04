// Profile.js - User/Admin profile page component
import { t } from '../i18n/i18n.js';

export class Profile {
    constructor(state, setState, callGas) {
        this.state = state;
        this.setState = setState;
        this.callGas = callGas;
        this.profile = null;
        this.loading = { profile: false, password: false, avatar: false };
        this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
        this.passwordError = '';
        this.passwordSuccess = '';
        this.avatarError = '';
        this.avatarSuccess = '';
    }

    async loadData() {
        this.loading.profile = true;
        this.render();
        try {
            const res = await this.callGas('getMyProfile', this.state.token);
            if (res && res.status === 'success') {
                this.profile = res.data;
                this.loading.profile = false;
                this.render();
            } else {
                this.loading.profile = false;
                this.setState({ errorMessage: res?.message || t('profile.failedToLoad') });
            }
        } catch {
            this.loading.profile = false;
            this.setState({ errorMessage: t('connectionError') });
        }
    }

    svgAvatar(size) {
        return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'%3E%3Crect width='${size}' height='${size}' fill='%23e2e8f0'/%3E%3Ccircle cx='${size/2}' cy='${size*0.4}' r='${size*0.22}' fill='%2394a3b8'/%3E%3Cellipse cx='${size/2}' cy='${size*0.9}' rx='${size*0.35}' ry='${size*0.26}' fill='%2394a3b8'/%3E%3C/svg%3E`;
    }

    escHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
    }

    _getContainer() {
        const isAdmin = this.state.user?.role === 'Admin';
        return isAdmin
            ? document.getElementById('admin-profile-content')
            : document.getElementById('employee-profile-content');
    }

    render() {
        const container = this._getContainer();
        if (!container) return;
        if (this.loading.profile) {
            container.innerHTML = this._skeletonHTML();
            return;
        }
        container.innerHTML = this._pageHTML();
        this._attachListeners();
    }

    _skeletonHTML() {
        return `
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col">
                        <div class="page-pretitle placeholder-glow"><span class="placeholder col-3 rounded"></span></div>
                        <h2 class="page-title placeholder-glow"><span class="placeholder col-4 rounded"></span></h2>
                    </div>
                </div>
            </div>
        </div>
        <div class="page-body">
            <div class="container-xl">
                <div class="row row-cards">
                    <div class="col-12 col-lg-4">
                        <div class="card">
                            <div class="card-body text-center py-5">
                                <div class="placeholder-glow">
                                    <span class="placeholder rounded-circle d-inline-block" style="width:96px;height:96px;"></span>
                                </div>
                                <div class="placeholder-glow mt-3"><span class="placeholder col-6 rounded"></span></div>
                                <div class="placeholder-glow mt-2"><span class="placeholder col-4 rounded"></span></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-12 col-lg-8">
                        <div class="card">
                            <div class="card-body">
                                ${[1,2,3,4].map(() => `<div class="placeholder-glow mb-3"><span class="placeholder col-12 rounded" style="height:38px;"></span></div>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }

    _pageHTML() {
        const p = this.profile || {};
        const avatarSrc = this.escHtml(p.photo_url || this.svgAvatar(96));
        const fallback = this.svgAvatar(96);
        const isAdmin = this.state.user?.role === 'Admin';

        const infoRows = [
            { label: t('profile.employeeId'), value: p.id },
            { label: t('profile.fullName'), value: p.name },
            { label: t('role'), value: p.role },
            { label: t('profile.shift'), value: p.shift ? `${this.escHtml(p.shift.id)} (${this.escHtml(p.shift.start_time)} – ${this.escHtml(p.shift.end_time)})` : (p.shift_id || '—') },
            { label: t('profile.group'), value: p.jabatan_name || p.jabatan_id || '—' }
        ];

        const infoHTML = infoRows.map(r => `
            <div class="row mb-3">
                <div class="col-sm-4 text-muted fw-semibold small">${this.escHtml(r.label)}</div>
                <div class="col-sm-8">${typeof r.value === 'string' && r.value.startsWith('<') ? r.value : this.escHtml(r.value || '—')}</div>
            </div>`).join('');

        const pwdErrorHTML = this.passwordError
            ? `<div class="alert alert-danger py-2 small mb-3">${this.escHtml(this.passwordError)}</div>` : '';
        const pwdSuccessHTML = this.passwordSuccess
            ? `<div class="alert alert-success py-2 small mb-3">${this.escHtml(this.passwordSuccess)}</div>` : '';
        const avatarErrorHTML = this.avatarError
            ? `<div class="alert alert-danger py-2 small mt-2">${this.escHtml(this.avatarError)}</div>` : '';
        const avatarSuccessHTML = this.avatarSuccess
            ? `<div class="alert alert-success py-2 small mt-2">${this.escHtml(this.avatarSuccess)}</div>` : '';

        return `
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col">
                        <h2 class="page-title">${this.escHtml(t('profile.myProfile'))}</h2>
                    </div>
                </div>
            </div>
        </div>

        <div class="page-body">
            <div class="container-xl">
                <div class="row row-cards">

                    <!-- Left: Avatar card -->
                    <div class="col-12 col-lg-4">
                        <div class="card">
                            <div class="card-body text-center py-4">
                                <div class="mb-3 position-relative d-inline-block">
                                    <img id="profile-avatar-img"
                                         src="${avatarSrc}"
                                         class="rounded-circle"
                                         style="width:96px;height:96px;object-fit:cover;border:3px solid #e2e8f0;"
                                         alt="${this.escHtml(p.name || '')}"
                                         onerror="this.src='${fallback}'">
                                </div>
                                <h3 class="mb-1">${this.escHtml(p.name || '')}</h3>
                                <div class="text-muted small mb-1">${this.escHtml(p.id || '')}</div>
                                <span class="badge ${p.role === 'Admin' ? 'bg-purple-lt text-purple' : 'bg-blue-lt text-blue'} mb-3">
                                    ${this.escHtml(p.role || '')}
                                </span>

                                <!-- Avatar upload -->
                                <div class="mt-2">
                                    <label class="btn btn-outline-secondary btn-sm w-100" for="profile-avatar-input">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="icon me-1" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 8h.01"/><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z"/><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5"/><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3"/></svg>
                                        <span id="profile-avatar-btn-text">${this.escHtml(t('profile.changeAvatar'))}</span>
                                        <span id="profile-avatar-spinner" class="spinner-border spinner-border-sm ms-1" style="display:none;"></span>
                                    </label>
                                    <input type="file" id="profile-avatar-input" accept="image/jpeg,image/png,image/webp" class="d-none">
                                    <div class="text-muted" style="font-size:0.75rem;margin-top:4px;">${this.escHtml(t('profile.avatarHint'))}</div>
                                    ${avatarErrorHTML}
                                    ${avatarSuccessHTML}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Info + Password -->
                    <div class="col-12 col-lg-8">

                        <!-- Profile info card -->
                        <div class="card mb-3">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="icon me-2" width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/></svg>
                                    ${this.escHtml(t('profile.accountInfo'))}
                                </h3>
                            </div>
                            <div class="card-body">
                                ${infoHTML}
                            </div>
                        </div>

                        <!-- Change password card -->
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="icon me-2" width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z"/><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0"/><path d="M8 11v-4a4 4 0 1 1 8 0v4"/></svg>
                                    ${this.escHtml(t('changePassword'))}
                                </h3>
                            </div>
                            <div class="card-body">
                                ${pwdErrorHTML}
                                ${pwdSuccessHTML}
                                <div class="mb-3">
                                    <label class="form-label" for="profile-current-pwd">${this.escHtml(t('currentPassword'))}</label>
                                    <input type="password" id="profile-current-pwd" class="form-control"
                                           placeholder="${this.escHtml(t('enterCurrentPassword'))}"
                                           autocomplete="current-password" maxlength="128">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label" for="profile-new-pwd">${this.escHtml(t('newPassword'))}</label>
                                    <input type="password" id="profile-new-pwd" class="form-control"
                                           placeholder="${this.escHtml(t('enterNewPassword'))}"
                                           autocomplete="new-password" maxlength="128">
                                    <div class="form-hint">${this.escHtml(t('passwordRequirements'))}</div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label" for="profile-confirm-pwd">${this.escHtml(t('confirmNewPassword'))}</label>
                                    <input type="password" id="profile-confirm-pwd" class="form-control"
                                           placeholder="${this.escHtml(t('confirmNewPassword'))}"
                                           autocomplete="new-password" maxlength="128">
                                    <div id="profile-pwd-match-hint" class="form-hint"></div>
                                </div>
                                <button id="profile-save-pwd-btn" class="btn btn-primary">
                                    <span id="profile-pwd-spinner" class="spinner-border spinner-border-sm me-1" style="display:none;"></span>
                                    <span id="profile-pwd-btn-text">${this.escHtml(t('changePassword'))}</span>
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>`;
    }

    _attachListeners() {
        // Password match hint
        const newPwd = document.getElementById('profile-new-pwd');
        const confirmPwd = document.getElementById('profile-confirm-pwd');
        const matchHint = document.getElementById('profile-pwd-match-hint');

        const checkMatch = () => {
            if (!confirmPwd.value) { matchHint.textContent = ''; matchHint.className = 'form-hint'; return; }
            if (newPwd.value === confirmPwd.value) {
                matchHint.textContent = '✓ ' + t('profile.passwordsMatch');
                matchHint.className = 'form-hint text-success';
            } else {
                matchHint.textContent = t('passwordsDoNotMatch');
                matchHint.className = 'form-hint text-danger';
            }
        };
        if (newPwd) newPwd.addEventListener('input', checkMatch);
        if (confirmPwd) confirmPwd.addEventListener('input', checkMatch);

        // Save password
        const saveBtn = document.getElementById('profile-save-pwd-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this._handlePasswordChange());
        }

        // Avatar upload
        const avatarInput = document.getElementById('profile-avatar-input');
        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => this._handleAvatarUpload(e));
        }
    }

    async _handlePasswordChange() {
        const currentPwd = document.getElementById('profile-current-pwd')?.value || '';
        const newPwd = document.getElementById('profile-new-pwd')?.value || '';
        const confirmPwd = document.getElementById('profile-confirm-pwd')?.value || '';

        this.passwordError = '';
        this.passwordSuccess = '';

        if (!currentPwd || !newPwd || !confirmPwd) {
            this.passwordError = t('allPasswordFieldsRequired');
            this._refreshPasswordSection();
            return;
        }
        if (newPwd.length < 6) {
            this.passwordError = t('passwordTooShort');
            this._refreshPasswordSection();
            return;
        }
        if (newPwd !== confirmPwd) {
            this.passwordError = t('passwordsDoNotMatch');
            this._refreshPasswordSection();
            return;
        }
        if (newPwd === currentPwd) {
            this.passwordError = t('newPasswordSameAsCurrent');
            this._refreshPasswordSection();
            return;
        }

        this.loading.password = true;
        this._setPasswordBtnLoading(true);

        try {
            const res = await this.callGas('changeMyPassword', this.state.token, { currentPassword: currentPwd, newPassword: newPwd });
            if (res && res.status === 'success') {
                this.passwordSuccess = t('passwordChangedSuccessfully');
                this.passwordError = '';
                // Clear fields
                const fields = ['profile-current-pwd', 'profile-new-pwd', 'profile-confirm-pwd'];
                fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
                const hint = document.getElementById('profile-pwd-match-hint');
                if (hint) { hint.textContent = ''; hint.className = 'form-hint'; }
            } else {
                this.passwordError = res?.message || t('failedToChangePassword');
            }
        } catch {
            this.passwordError = t('connectionError');
        }

        this.loading.password = false;
        this._setPasswordBtnLoading(false);
        this._refreshPasswordSection();
    }

    _setPasswordBtnLoading(loading) {
        const btn = document.getElementById('profile-save-pwd-btn');
        const spinner = document.getElementById('profile-pwd-spinner');
        const text = document.getElementById('profile-pwd-btn-text');
        if (btn) btn.disabled = loading;
        if (spinner) spinner.style.display = loading ? 'inline-block' : 'none';
        if (text) text.textContent = loading ? t('changing') : t('changePassword');
    }

    _refreshPasswordSection() {
        // Re-render only the alert area without full re-render to preserve field values
        const pwdErrorEl = document.querySelector('#profile-save-pwd-btn')?.closest('.card-body');
        if (!pwdErrorEl) { this.render(); return; }

        // Remove existing alerts
        pwdErrorEl.querySelectorAll('.alert').forEach(el => el.remove());

        const insertBefore = document.getElementById('profile-current-pwd')?.closest('.mb-3');
        if (!insertBefore) { this.render(); return; }

        if (this.passwordError) {
            const div = document.createElement('div');
            div.className = 'alert alert-danger py-2 small mb-3';
            div.textContent = this.passwordError;
            pwdErrorEl.insertBefore(div, insertBefore);
        }
        if (this.passwordSuccess) {
            const div = document.createElement('div');
            div.className = 'alert alert-success py-2 small mb-3';
            div.textContent = this.passwordSuccess;
            pwdErrorEl.insertBefore(div, insertBefore);
        }
    }

    async _handleAvatarUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        this.avatarError = '';
        this.avatarSuccess = '';

        // Validate type
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.type)) {
            this.avatarError = t('profile.avatarTypeError');
            this._refreshAvatarSection();
            return;
        }
        // Validate size (2MB)
        if (file.size > 2 * 1024 * 1024) {
            this.avatarError = t('profile.avatarSizeError');
            this._refreshAvatarSection();
            return;
        }

        this._setAvatarBtnLoading(true);

        try {
            const base64 = await this._fileToBase64(file);
            const res = await this.callGas('uploadMyAvatar', this.state.token, base64, file.name);
            if (res && res.status === 'success') {
                const newUrl = res.data?.photo_url || '';
                this.avatarSuccess = t('profile.avatarUpdated');
                if (this.profile) this.profile.photo_url = newUrl;
                // Update avatar img in place
                const img = document.getElementById('profile-avatar-img');
                if (img && newUrl) img.src = newUrl;
                // Update user state so navbar avatar reflects change
                if (this.state.user) {
                    const updatedUser = { ...this.state.user, photo_url: newUrl };
                    this.setState({ user: updatedUser });
                    localStorage.setItem('absen_user', JSON.stringify(updatedUser));
                }
            } else {
                this.avatarError = res?.message || t('profile.avatarUploadFailed');
            }
        } catch {
            this.avatarError = t('connectionError');
        }

        this._setAvatarBtnLoading(false);
        this._refreshAvatarSection();
        // Reset file input
        e.target.value = '';
    }

    _fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    _setAvatarBtnLoading(loading) {
        const spinner = document.getElementById('profile-avatar-spinner');
        const text = document.getElementById('profile-avatar-btn-text');
        const input = document.getElementById('profile-avatar-input');
        if (spinner) spinner.style.display = loading ? 'inline-block' : 'none';
        if (text) text.textContent = loading ? t('processing') : t('profile.changeAvatar');
        if (input) input.disabled = loading;
    }

    _refreshAvatarSection() {
        // Update alert messages below the avatar upload button
        const avatarCard = document.getElementById('profile-avatar-img')?.closest('.card-body');
        if (!avatarCard) { this.render(); return; }

        avatarCard.querySelectorAll('.alert').forEach(el => el.remove());

        const hint = avatarCard.querySelector('[style*="font-size:0.75rem"]');
        const insertAfter = hint || avatarCard.querySelector('input[type="file"]');

        if (this.avatarError) {
            const div = document.createElement('div');
            div.className = 'alert alert-danger py-2 small mt-2';
            div.textContent = this.avatarError;
            insertAfter?.insertAdjacentElement('afterend', div);
        }
        if (this.avatarSuccess) {
            const div = document.createElement('div');
            div.className = 'alert alert-success py-2 small mt-2';
            div.textContent = this.avatarSuccess;
            insertAfter?.insertAdjacentElement('afterend', div);
        }
    }
}
