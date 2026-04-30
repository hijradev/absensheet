import { translations, defaultLanguage, availableLanguages } from './languages.js';

// Current language state
let currentLanguage = defaultLanguage;

// Get current language
export function getLanguage() {
    return currentLanguage;
}

// Set language
export function setLanguage(lang) {
    if (translations[lang]) {
        currentLanguage = lang;
        localStorage.setItem('absen_language', lang);
        notifyLanguageChange();
        return true;
    }
    return false;
}

// Initialize language from localStorage or default
export function initLanguage() {
    const savedLang = localStorage.getItem('absen_language');
    if (savedLang && translations[savedLang]) {
        currentLanguage = savedLang;
    } else {
        currentLanguage = defaultLanguage;
    }
    return currentLanguage;
}

// Get translation for key
export function t(key) {
    const lang = translations[currentLanguage];
    if (!lang) return key;
    
    // Support nested keys like 'dashboard.stats'
    const keys = key.split('.');
    let value = lang;
    let found = true;
    
    for (const k of keys) {
        if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, k)) {
            value = value[k];
        } else {
            found = false;
            break;
        }
    }
    
    // If found as nested and it's a string, return it
    if (found && typeof value === 'string') return value;

    // Fallback 1: If nested failed, try the last part of the key as a flat key in current language
    const lastPart = keys[keys.length - 1];
    if (Object.prototype.hasOwnProperty.call(lang, lastPart) && typeof lang[lastPart] === 'string') {
        return lang[lastPart];
    }

    // Fallback 2: Try default language
    const defaultLang = translations[defaultLanguage];
    if (defaultLang) {
        let defValue = defaultLang;
        let defFound = true;
        for (const dk of keys) {
            if (defValue && typeof defValue === 'object' && Object.prototype.hasOwnProperty.call(defValue, dk)) {
                defValue = defValue[dk];
            } else {
                defFound = false;
                break;
            }
        }
        if (defFound && typeof defValue === 'string') return defValue;
        
        // Final fallback: last part in default language
        if (Object.prototype.hasOwnProperty.call(defaultLang, lastPart) && typeof defaultLang[lastPart] === 'string') {
            return defaultLang[lastPart];
        }
    }
    
    return key;
}

// Get all translations for current language
export function getAllTranslations() {
    return translations[currentLanguage];
}

// Get available languages
export function getAvailableLanguages() {
    return availableLanguages;
}

// Format number with language-specific formatting
export function formatNumber(num) {
    return new Intl.NumberFormat(currentLanguage === 'id' ? 'id-ID' : 'en-US').format(num);
}

// Format date with language-specific formatting
export function formatDate(date, options = {}) {
    const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    };
    
    return new Intl.DateTimeFormat(
        currentLanguage === 'id' ? 'id-ID' : 'en-US',
        { ...defaultOptions, ...options }
    ).format(new Date(date));
}

// Format time with language-specific formatting
export function formatTime(time, options = {}) {
    const defaultOptions = {
        hour: '2-digit',
        minute: '2-digit'
    };
    
    return new Intl.DateTimeFormat(
        currentLanguage === 'id' ? 'id-ID' : 'en-US',
        { ...defaultOptions, ...options, hour12: false }
    ).format(new Date(`2000-01-01T${time}`));
}

// Get language direction (ltr or rtl)
export function getDirection() {
    return currentLanguage === 'id' ? 'ltr' : 'ltr'; // Both languages are LTR
}

// Callback for language change
let languageChangeCallback = null;

// Set callback for language change
export function onLanguageChange(callback) {
    languageChangeCallback = callback;
}

// Notify listeners when language changes
function notifyLanguageChange() {
    if (languageChangeCallback) {
        languageChangeCallback(currentLanguage);
    }
}

