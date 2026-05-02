// email-settings.test.js — Unit tests for email configuration functions
//
// Because backend/Settings.gs is a Google Apps Script file (not an ES module),
// the validation logic is re-implemented here for Node.js testing.
// Tests validate email format, schedule parameters, and configuration persistence.
//
// Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.5, 7.5

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure validation functions extracted from backend/Settings.gs
// ---------------------------------------------------------------------------

/**
 * Validate email format using regex pattern
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
function validateEmailFormat(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate schedule day (1-28)
 * @param {number} day - Day of month
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateScheduleDay(day) {
  if (typeof day !== 'number' || isNaN(day)) {
    return { valid: false, error: 'Schedule day must be a number' };
  }
  if (!Number.isInteger(day)) {
    return { valid: false, error: 'Schedule day must be an integer' };
  }
  if (day < 1 || day > 28) {
    return { valid: false, error: 'Schedule day must be between 1 and 28' };
  }
  return { valid: true, error: null };
}

/**
 * Validate schedule hour (0-23)
 * @param {number} hour - Hour of day
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateScheduleHour(hour) {
  if (typeof hour !== 'number' || isNaN(hour)) {
    return { valid: false, error: 'Schedule hour must be a number' };
  }
  if (!Number.isInteger(hour)) {
    return { valid: false, error: 'Schedule hour must be an integer' };
  }
  if (hour < 0 || hour > 23) {
    return { valid: false, error: 'Schedule hour must be between 0 and 23' };
  }
  return { valid: true, error: null };
}

/**
 * Validate schedule minute (0-59)
 * @param {number} minute - Minute of hour
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateScheduleMinute(minute) {
  if (typeof minute !== 'number' || isNaN(minute)) {
    return { valid: false, error: 'Schedule minute must be a number' };
  }
  if (!Number.isInteger(minute)) {
    return { valid: false, error: 'Schedule minute must be an integer' };
  }
  if (minute < 0 || minute > 59) {
    return { valid: false, error: 'Schedule minute must be between 0 and 59' };
  }
  return { valid: true, error: null };
}

/**
 * Validate complete email settings
 * @param {{ enabled: boolean, recipient: string, scheduleDay: number, scheduleHour: number, scheduleMinute: number }} emailData
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateEmailSettings(emailData) {
  if (!emailData || typeof emailData !== 'object') {
    return { valid: false, error: 'Invalid email settings data' };
  }

  const { enabled, recipient, scheduleDay, scheduleHour, scheduleMinute } = emailData;

  // Validate enabled flag
  if (typeof enabled !== 'boolean') {
    return { valid: false, error: 'Enabled flag must be a boolean' };
  }

  // Validate recipient email if enabling automatic emails
  if (enabled) {
    if (!recipient || typeof recipient !== 'string') {
      return { valid: false, error: 'Email recipient is required when enabling automatic emails' };
    }
    if (!validateEmailFormat(recipient)) {
      return { valid: false, error: 'Invalid email format' };
    }
  }

  // Validate schedule day
  const dayValidation = validateScheduleDay(scheduleDay);
  if (!dayValidation.valid) {
    return dayValidation;
  }

  // Validate schedule hour
  const hourValidation = validateScheduleHour(scheduleHour);
  if (!hourValidation.valid) {
    return hourValidation;
  }

  // Validate schedule minute
  const minuteValidation = validateScheduleMinute(scheduleMinute);
  if (!minuteValidation.valid) {
    return minuteValidation;
  }

  return { valid: true, error: null };
}

// ---------------------------------------------------------------------------
// Email Format Validation Tests
// ---------------------------------------------------------------------------

describe('validateEmailFormat() - valid emails', () => {
  // Validates: Requirements 1.2

  it('accepts standard email format', () => {
    expect(validateEmailFormat('user@example.com')).toBe(true);
  });

  it('accepts email with subdomain', () => {
    expect(validateEmailFormat('admin@mail.company.com')).toBe(true);
  });

  it('accepts email with numbers', () => {
    expect(validateEmailFormat('user123@example456.com')).toBe(true);
  });

  it('accepts email with dots in local part', () => {
    expect(validateEmailFormat('first.last@example.com')).toBe(true);
  });

  it('accepts email with plus sign', () => {
    expect(validateEmailFormat('user+tag@example.com')).toBe(true);
  });

  it('accepts email with hyphen in domain', () => {
    expect(validateEmailFormat('user@my-company.com')).toBe(true);
  });

  it('accepts email with underscore', () => {
    expect(validateEmailFormat('user_name@example.com')).toBe(true);
  });
});

describe('validateEmailFormat() - invalid emails', () => {
  // Validates: Requirements 1.2, 1.4

  it('rejects email without @ symbol', () => {
    expect(validateEmailFormat('userexample.com')).toBe(false);
  });

  it('rejects email without domain', () => {
    expect(validateEmailFormat('user@')).toBe(false);
  });

  it('rejects email without local part', () => {
    expect(validateEmailFormat('@example.com')).toBe(false);
  });

  it('rejects email without TLD', () => {
    expect(validateEmailFormat('user@example')).toBe(false);
  });

  it('rejects email with spaces', () => {
    expect(validateEmailFormat('user name@example.com')).toBe(false);
  });

  it('rejects email with multiple @ symbols', () => {
    expect(validateEmailFormat('user@@example.com')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateEmailFormat('')).toBe(false);
  });

  it('rejects null', () => {
    expect(validateEmailFormat(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validateEmailFormat(undefined)).toBe(false);
  });

  it('rejects number', () => {
    expect(validateEmailFormat(123)).toBe(false);
  });

  it('rejects object', () => {
    expect(validateEmailFormat({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Schedule Day Validation Tests
// ---------------------------------------------------------------------------

describe('validateScheduleDay() - valid days', () => {
  // Validates: Requirements 2.2, 2.6

  it('accepts day = 1 (minimum valid)', () => {
    const result = validateScheduleDay(1);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('accepts day = 28 (maximum valid)', () => {
    const result = validateScheduleDay(28);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('accepts day = 15 (middle value)', () => {
    const result = validateScheduleDay(15);
    expect(result.valid).toBe(true);
  });

  it('accepts day = 5 (default value)', () => {
    const result = validateScheduleDay(5);
    expect(result.valid).toBe(true);
  });
});

describe('validateScheduleDay() - invalid days', () => {
  // Validates: Requirements 2.2, 2.6

  it('rejects day = 0', () => {
    const result = validateScheduleDay(0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 1 and 28');
  });

  it('rejects day = 29', () => {
    const result = validateScheduleDay(29);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 1 and 28');
  });

  it('rejects day = -1', () => {
    const result = validateScheduleDay(-1);
    expect(result.valid).toBe(false);
  });

  it('rejects day = 31', () => {
    const result = validateScheduleDay(31);
    expect(result.valid).toBe(false);
  });

  it('rejects decimal day = 15.5', () => {
    const result = validateScheduleDay(15.5);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('integer');
  });

  it('rejects NaN', () => {
    const result = validateScheduleDay(NaN);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('number');
  });

  it('rejects string', () => {
    const result = validateScheduleDay('15');
    expect(result.valid).toBe(false);
  });

  it('rejects null', () => {
    const result = validateScheduleDay(null);
    expect(result.valid).toBe(false);
  });

  it('rejects undefined', () => {
    const result = validateScheduleDay(undefined);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Schedule Hour Validation Tests
// ---------------------------------------------------------------------------

describe('validateScheduleHour() - valid hours', () => {
  // Validates: Requirements 2.7

  it('accepts hour = 0 (minimum valid)', () => {
    const result = validateScheduleHour(0);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('accepts hour = 23 (maximum valid)', () => {
    const result = validateScheduleHour(23);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('accepts hour = 9 (default value)', () => {
    const result = validateScheduleHour(9);
    expect(result.valid).toBe(true);
  });

  it('accepts hour = 12 (noon)', () => {
    const result = validateScheduleHour(12);
    expect(result.valid).toBe(true);
  });
});

describe('validateScheduleHour() - invalid hours', () => {
  // Validates: Requirements 2.7

  it('rejects hour = -1', () => {
    const result = validateScheduleHour(-1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 0 and 23');
  });

  it('rejects hour = 24', () => {
    const result = validateScheduleHour(24);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 0 and 23');
  });

  it('rejects decimal hour = 9.5', () => {
    const result = validateScheduleHour(9.5);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('integer');
  });

  it('rejects NaN', () => {
    const result = validateScheduleHour(NaN);
    expect(result.valid).toBe(false);
  });

  it('rejects string', () => {
    const result = validateScheduleHour('9');
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Schedule Minute Validation Tests
// ---------------------------------------------------------------------------

describe('validateScheduleMinute() - valid minutes', () => {
  // Validates: Requirements 2.7

  it('accepts minute = 0 (minimum valid)', () => {
    const result = validateScheduleMinute(0);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('accepts minute = 59 (maximum valid)', () => {
    const result = validateScheduleMinute(59);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('accepts minute = 30 (middle value)', () => {
    const result = validateScheduleMinute(30);
    expect(result.valid).toBe(true);
  });

  it('accepts minute = 15', () => {
    const result = validateScheduleMinute(15);
    expect(result.valid).toBe(true);
  });
});

describe('validateScheduleMinute() - invalid minutes', () => {
  // Validates: Requirements 2.7

  it('rejects minute = -1', () => {
    const result = validateScheduleMinute(-1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 0 and 59');
  });

  it('rejects minute = 60', () => {
    const result = validateScheduleMinute(60);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 0 and 59');
  });

  it('rejects decimal minute = 30.5', () => {
    const result = validateScheduleMinute(30.5);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('integer');
  });

  it('rejects NaN', () => {
    const result = validateScheduleMinute(NaN);
    expect(result.valid).toBe(false);
  });

  it('rejects string', () => {
    const result = validateScheduleMinute('30');
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Complete Email Settings Validation Tests
// ---------------------------------------------------------------------------

describe('validateEmailSettings() - valid configurations', () => {
  // Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.5

  it('accepts valid configuration with enabled = true', () => {
    const result = validateEmailSettings({
      enabled: true,
      recipient: 'admin@company.com',
      scheduleDay: 5,
      scheduleHour: 9,
      scheduleMinute: 0
    });
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('accepts valid configuration with enabled = false and empty recipient', () => {
    const result = validateEmailSettings({
      enabled: false,
      recipient: '',
      scheduleDay: 15,
      scheduleHour: 14,
      scheduleMinute: 30
    });
    expect(result.valid).toBe(true);
  });

  it('accepts boundary values: day=1, hour=0, minute=0', () => {
    const result = validateEmailSettings({
      enabled: true,
      recipient: 'test@example.com',
      scheduleDay: 1,
      scheduleHour: 0,
      scheduleMinute: 0
    });
    expect(result.valid).toBe(true);
  });

  it('accepts boundary values: day=28, hour=23, minute=59', () => {
    const result = validateEmailSettings({
      enabled: true,
      recipient: 'test@example.com',
      scheduleDay: 28,
      scheduleHour: 23,
      scheduleMinute: 59
    });
    expect(result.valid).toBe(true);
  });
});

describe('validateEmailSettings() - invalid configurations', () => {
  // Validates: Requirements 1.2, 1.4, 2.2, 2.6, 2.7

  it('rejects null data', () => {
    const result = validateEmailSettings(null);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid email settings data');
  });

  it('rejects undefined data', () => {
    const result = validateEmailSettings(undefined);
    expect(result.valid).toBe(false);
  });

  it('rejects missing enabled flag', () => {
    const result = validateEmailSettings({
      recipient: 'admin@company.com',
      scheduleDay: 5,
      scheduleHour: 9,
      scheduleMinute: 0
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('boolean');
  });

  it('rejects enabled=true with empty recipient', () => {
    const result = validateEmailSettings({
      enabled: true,
      recipient: '',
      scheduleDay: 5,
      scheduleHour: 9,
      scheduleMinute: 0
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects enabled=true with invalid email format', () => {
    const result = validateEmailSettings({
      enabled: true,
      recipient: 'invalid-email',
      scheduleDay: 5,
      scheduleHour: 9,
      scheduleMinute: 0
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid email format');
  });

  it('rejects invalid schedule day', () => {
    const result = validateEmailSettings({
      enabled: true,
      recipient: 'admin@company.com',
      scheduleDay: 29,
      scheduleHour: 9,
      scheduleMinute: 0
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 1 and 28');
  });

  it('rejects invalid schedule hour', () => {
    const result = validateEmailSettings({
      enabled: true,
      recipient: 'admin@company.com',
      scheduleDay: 5,
      scheduleHour: 24,
      scheduleMinute: 0
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 0 and 23');
  });

  it('rejects invalid schedule minute', () => {
    const result = validateEmailSettings({
      enabled: true,
      recipient: 'admin@company.com',
      scheduleDay: 5,
      scheduleHour: 9,
      scheduleMinute: 60
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 0 and 59');
  });
});

// ---------------------------------------------------------------------------
// Configuration Storage Round-Trip Tests
// ---------------------------------------------------------------------------

describe('Configuration persistence simulation', () => {
  // Validates: Requirements 1.3, 2.5, 7.5
  // Simulates PropertiesService storage and retrieval

  /**
   * Simulate storing and retrieving email settings
   * @param {{ enabled: boolean, recipient: string, scheduleDay: number, scheduleHour: number, scheduleMinute: number }} settings
   * @returns {{ enabled: boolean, recipient: string, scheduleDay: number, scheduleHour: number, scheduleMinute: number }}
   */
  function storageRoundTrip(settings) {
    // Simulate PropertiesService storage (convert to strings)
    const stored = {
      MONTHLY_EMAIL_ENABLED: settings.enabled ? 'true' : 'false',
      MONTHLY_EMAIL_RECIPIENT: settings.recipient || '',
      MONTHLY_EMAIL_SCHEDULE_DAY: String(settings.scheduleDay),
      MONTHLY_EMAIL_SCHEDULE_HOUR: String(settings.scheduleHour),
      MONTHLY_EMAIL_SCHEDULE_MINUTE: String(settings.scheduleMinute)
    };

    // Simulate retrieval (parse back to original types)
    return {
      enabled: stored.MONTHLY_EMAIL_ENABLED === 'true',
      recipient: stored.MONTHLY_EMAIL_RECIPIENT,
      scheduleDay: parseInt(stored.MONTHLY_EMAIL_SCHEDULE_DAY, 10),
      scheduleHour: parseInt(stored.MONTHLY_EMAIL_SCHEDULE_HOUR, 10),
      scheduleMinute: parseInt(stored.MONTHLY_EMAIL_SCHEDULE_MINUTE, 10)
    };
  }

  it('preserves enabled=true through storage round-trip', () => {
    const original = {
      enabled: true,
      recipient: 'admin@company.com',
      scheduleDay: 5,
      scheduleHour: 9,
      scheduleMinute: 0
    };
    const retrieved = storageRoundTrip(original);
    expect(retrieved).toEqual(original);
  });

  it('preserves enabled=false through storage round-trip', () => {
    const original = {
      enabled: false,
      recipient: 'test@example.com',
      scheduleDay: 15,
      scheduleHour: 14,
      scheduleMinute: 30
    };
    const retrieved = storageRoundTrip(original);
    expect(retrieved).toEqual(original);
  });

  it('preserves boundary values through storage round-trip', () => {
    const original = {
      enabled: true,
      recipient: 'boundary@test.com',
      scheduleDay: 28,
      scheduleHour: 23,
      scheduleMinute: 59
    };
    const retrieved = storageRoundTrip(original);
    expect(retrieved).toEqual(original);
  });

  it('preserves empty recipient when disabled', () => {
    const original = {
      enabled: false,
      recipient: '',
      scheduleDay: 1,
      scheduleHour: 0,
      scheduleMinute: 0
    };
    const retrieved = storageRoundTrip(original);
    expect(retrieved).toEqual(original);
  });
});
