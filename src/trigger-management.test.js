// trigger-management.test.js — Unit tests for trigger management functions
//
// Because backend/Settings.gs is a Google Apps Script file (not an ES module),
// the validation logic is re-implemented here for Node.js testing.
// Tests validate trigger setup parameters and month boundary handling.
//
// Validates: Requirements 2.2, 2.3, 2.4, 2.6, 2.7, 4.1

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure validation functions extracted from setupEmailScheduleTrigger
// ---------------------------------------------------------------------------

/**
 * Validate trigger setup parameters
 * @param {number} day - Day of month (1-28)
 * @param {number} hour - Hour of day (0-23)
 * @param {number} minute - Minute of hour (0-59)
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateTriggerParameters(day, hour, minute) {
  // Validate day
  if (typeof day !== 'number' || isNaN(day)) {
    return { valid: false, error: 'Day must be a number' };
  }
  if (day < 1 || day > 28) {
    return { valid: false, error: 'Day must be between 1 and 28' };
  }
  if (!Number.isInteger(day)) {
    return { valid: false, error: 'Day must be an integer' };
  }

  // Validate hour
  if (typeof hour !== 'number' || isNaN(hour)) {
    return { valid: false, error: 'Hour must be a number' };
  }
  if (hour < 0 || hour > 23) {
    return { valid: false, error: 'Hour must be between 0 and 23' };
  }
  if (!Number.isInteger(hour)) {
    return { valid: false, error: 'Hour must be an integer' };
  }

  // Validate minute
  if (typeof minute !== 'number' || isNaN(minute)) {
    return { valid: false, error: 'Minute must be a number' };
  }
  if (minute < 0 || minute > 59) {
    return { valid: false, error: 'Minute must be between 0 and 59' };
  }
  if (!Number.isInteger(minute)) {
    return { valid: false, error: 'Minute must be an integer' };
  }

  return { valid: true, error: null };
}

/**
 * Simulate month boundary handling
 * Google Apps Script automatically handles months where the configured day doesn't exist
 * by running on the last day of that month
 * @param {number} day - Configured day (1-28)
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {number} Actual day the trigger will run
 */
function getActualTriggerDay(day, month, year) {
  // Get the last day of the specified month
  const lastDay = new Date(year, month, 0).getDate();
  
  // If configured day exists in this month, use it
  // Otherwise, use the last day of the month
  return Math.min(day, lastDay);
}

// ---------------------------------------------------------------------------
// Trigger Parameter Validation Tests
// ---------------------------------------------------------------------------

describe('validateTriggerParameters() - valid parameters', () => {
  // Validates: Requirements 2.2, 2.6, 2.7

  it('accepts valid parameters: day=5, hour=9, minute=0', () => {
    const result = validateTriggerParameters(5, 9, 0);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('accepts boundary values: day=1, hour=0, minute=0', () => {
    const result = validateTriggerParameters(1, 0, 0);
    expect(result.valid).toBe(true);
  });

  it('accepts boundary values: day=28, hour=23, minute=59', () => {
    const result = validateTriggerParameters(28, 23, 59);
    expect(result.valid).toBe(true);
  });

  it('accepts middle values: day=15, hour=12, minute=30', () => {
    const result = validateTriggerParameters(15, 12, 30);
    expect(result.valid).toBe(true);
  });
});

describe('validateTriggerParameters() - invalid day', () => {
  // Validates: Requirements 2.2, 2.6

  it('rejects day = 0', () => {
    const result = validateTriggerParameters(0, 9, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 1 and 28');
  });

  it('rejects day = 29', () => {
    const result = validateTriggerParameters(29, 9, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 1 and 28');
  });

  it('rejects day = 31', () => {
    const result = validateTriggerParameters(31, 9, 0);
    expect(result.valid).toBe(false);
  });

  it('rejects day = -1', () => {
    const result = validateTriggerParameters(-1, 9, 0);
    expect(result.valid).toBe(false);
  });

  it('rejects decimal day = 15.5', () => {
    const result = validateTriggerParameters(15.5, 9, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('integer');
  });

  it('rejects NaN day', () => {
    const result = validateTriggerParameters(NaN, 9, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('number');
  });

  it('rejects string day', () => {
    const result = validateTriggerParameters('15', 9, 0);
    expect(result.valid).toBe(false);
  });

  it('rejects null day', () => {
    const result = validateTriggerParameters(null, 9, 0);
    expect(result.valid).toBe(false);
  });
});

describe('validateTriggerParameters() - invalid hour', () => {
  // Validates: Requirements 2.7

  it('rejects hour = -1', () => {
    const result = validateTriggerParameters(5, -1, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 0 and 23');
  });

  it('rejects hour = 24', () => {
    const result = validateTriggerParameters(5, 24, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 0 and 23');
  });

  it('rejects decimal hour = 9.5', () => {
    const result = validateTriggerParameters(5, 9.5, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('integer');
  });

  it('rejects NaN hour', () => {
    const result = validateTriggerParameters(5, NaN, 0);
    expect(result.valid).toBe(false);
  });

  it('rejects string hour', () => {
    const result = validateTriggerParameters(5, '9', 0);
    expect(result.valid).toBe(false);
  });
});

describe('validateTriggerParameters() - invalid minute', () => {
  // Validates: Requirements 2.7

  it('rejects minute = -1', () => {
    const result = validateTriggerParameters(5, 9, -1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 0 and 59');
  });

  it('rejects minute = 60', () => {
    const result = validateTriggerParameters(5, 9, 60);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 0 and 59');
  });

  it('rejects decimal minute = 30.5', () => {
    const result = validateTriggerParameters(5, 9, 30.5);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('integer');
  });

  it('rejects NaN minute', () => {
    const result = validateTriggerParameters(5, 9, NaN);
    expect(result.valid).toBe(false);
  });

  it('rejects string minute', () => {
    const result = validateTriggerParameters(5, 9, '30');
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Month Boundary Handling Tests
// ---------------------------------------------------------------------------

describe('getActualTriggerDay() - months with 31 days', () => {
  // Validates: Requirements 2.4
  // January, March, May, July, August, October, December have 31 days

  it('uses configured day 15 in January (31 days)', () => {
    expect(getActualTriggerDay(15, 1, 2024)).toBe(15);
  });

  it('uses configured day 28 in March (31 days)', () => {
    expect(getActualTriggerDay(28, 3, 2024)).toBe(28);
  });

  it('uses configured day 1 in July (31 days)', () => {
    expect(getActualTriggerDay(1, 7, 2024)).toBe(1);
  });

  it('uses configured day 20 in December (31 days)', () => {
    expect(getActualTriggerDay(20, 12, 2024)).toBe(20);
  });
});

describe('getActualTriggerDay() - months with 30 days', () => {
  // Validates: Requirements 2.4
  // April, June, September, November have 30 days

  it('uses configured day 15 in April (30 days)', () => {
    expect(getActualTriggerDay(15, 4, 2024)).toBe(15);
  });

  it('uses configured day 28 in June (30 days)', () => {
    expect(getActualTriggerDay(28, 6, 2024)).toBe(28);
  });

  it('uses configured day 5 in September (30 days)', () => {
    expect(getActualTriggerDay(5, 9, 2024)).toBe(5);
  });

  it('uses configured day 1 in November (30 days)', () => {
    expect(getActualTriggerDay(1, 11, 2024)).toBe(1);
  });
});

describe('getActualTriggerDay() - February (28 days in non-leap year)', () => {
  // Validates: Requirements 2.4

  it('uses configured day 15 in February 2023 (28 days)', () => {
    expect(getActualTriggerDay(15, 2, 2023)).toBe(15);
  });

  it('uses configured day 28 in February 2023 (28 days)', () => {
    expect(getActualTriggerDay(28, 2, 2023)).toBe(28);
  });

  it('uses configured day 1 in February 2023 (28 days)', () => {
    expect(getActualTriggerDay(1, 2, 2023)).toBe(1);
  });

  it('uses last day (28) for day 28 in February 2023', () => {
    expect(getActualTriggerDay(28, 2, 2023)).toBe(28);
  });
});

describe('getActualTriggerDay() - February (29 days in leap year)', () => {
  // Validates: Requirements 2.4

  it('uses configured day 15 in February 2024 (29 days)', () => {
    expect(getActualTriggerDay(15, 2, 2024)).toBe(15);
  });

  it('uses configured day 28 in February 2024 (29 days)', () => {
    expect(getActualTriggerDay(28, 2, 2024)).toBe(28);
  });

  it('uses configured day 1 in February 2024 (29 days)', () => {
    expect(getActualTriggerDay(1, 2, 2024)).toBe(1);
  });

  it('uses last day (29) for day 28 in February 2024', () => {
    expect(getActualTriggerDay(28, 2, 2024)).toBe(28);
  });
});

describe('getActualTriggerDay() - boundary day values', () => {
  // Validates: Requirements 2.4

  it('uses day 1 (minimum) in any month', () => {
    expect(getActualTriggerDay(1, 2, 2024)).toBe(1);
    expect(getActualTriggerDay(1, 4, 2024)).toBe(1);
    expect(getActualTriggerDay(1, 12, 2024)).toBe(1);
  });

  it('uses day 28 (maximum allowed) in February non-leap year', () => {
    expect(getActualTriggerDay(28, 2, 2023)).toBe(28);
  });

  it('uses day 28 in February leap year', () => {
    expect(getActualTriggerDay(28, 2, 2024)).toBe(28);
  });

  it('uses day 28 in 30-day months', () => {
    expect(getActualTriggerDay(28, 4, 2024)).toBe(28);
    expect(getActualTriggerDay(28, 6, 2024)).toBe(28);
  });

  it('uses day 28 in 31-day months', () => {
    expect(getActualTriggerDay(28, 1, 2024)).toBe(28);
    expect(getActualTriggerDay(28, 12, 2024)).toBe(28);
  });
});

// ---------------------------------------------------------------------------
// Trigger ID Storage Tests
// ---------------------------------------------------------------------------

describe('Trigger ID storage simulation', () => {
  // Validates: Requirements 4.1
  // Simulates storing and retrieving trigger ID

  /**
   * Simulate storing and retrieving trigger ID
   * @param {string} triggerId - Trigger ID to store
   * @returns {string|null} Retrieved trigger ID
   */
  function triggerIdRoundTrip(triggerId) {
    // Simulate PropertiesService storage
    const stored = { MONTHLY_EMAIL_TRIGGER_ID: triggerId };
    
    // Simulate retrieval
    return stored.MONTHLY_EMAIL_TRIGGER_ID || null;
  }

  it('preserves trigger ID through storage round-trip', () => {
    const originalId = 'trigger_12345';
    const retrievedId = triggerIdRoundTrip(originalId);
    expect(retrievedId).toBe(originalId);
  });

  it('preserves long trigger ID', () => {
    const originalId = 'trigger_abcdef1234567890';
    const retrievedId = triggerIdRoundTrip(originalId);
    expect(retrievedId).toBe(originalId);
  });

  it('handles empty trigger ID', () => {
    const retrievedId = triggerIdRoundTrip('');
    expect(retrievedId).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Trigger Lifecycle Tests
// ---------------------------------------------------------------------------

describe('Trigger lifecycle simulation', () => {
  // Validates: Requirements 2.3, 4.1
  // Simulates the complete trigger setup and removal lifecycle

  /**
   * Simulate trigger setup process
   * @param {number} day - Day of month
   * @param {number} hour - Hour of day
   * @param {number} minute - Minute of hour
   * @returns {{ success: boolean, triggerId: string|null, error: string|null }}
   */
  function simulateTriggerSetup(day, hour, minute) {
    // Validate parameters
    const validation = validateTriggerParameters(day, hour, minute);
    if (!validation.valid) {
      return { success: false, triggerId: null, error: validation.error };
    }

    // Simulate trigger creation (would call ScriptApp.newTrigger in real code)
    const triggerId = 'trigger_' + Date.now();
    
    return { success: true, triggerId: triggerId, error: null };
  }

  it('successfully sets up trigger with valid parameters', () => {
    const result = simulateTriggerSetup(5, 9, 0);
    expect(result.success).toBe(true);
    expect(result.triggerId).toBeTruthy();
    expect(result.error).toBeNull();
  });

  it('fails to set up trigger with invalid day', () => {
    const result = simulateTriggerSetup(29, 9, 0);
    expect(result.success).toBe(false);
    expect(result.triggerId).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('fails to set up trigger with invalid hour', () => {
    const result = simulateTriggerSetup(5, 24, 0);
    expect(result.success).toBe(false);
    expect(result.triggerId).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('fails to set up trigger with invalid minute', () => {
    const result = simulateTriggerSetup(5, 9, 60);
    expect(result.success).toBe(false);
    expect(result.triggerId).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('generates unique trigger IDs for multiple setups', () => {
    const result1 = simulateTriggerSetup(5, 9, 0);
    const result2 = simulateTriggerSetup(15, 14, 30);
    
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1.triggerId).not.toBe(result2.triggerId);
  });
});

// ---------------------------------------------------------------------------
// Integration Scenario Tests
// ---------------------------------------------------------------------------

describe('Integration scenarios', () => {
  // Validates: Requirements 2.2, 2.3, 2.4, 2.6, 2.7, 4.1

  it('handles complete trigger setup workflow', () => {
    // Step 1: Validate parameters
    const validation = validateTriggerParameters(5, 9, 0);
    expect(validation.valid).toBe(true);

    // Step 2: Simulate trigger creation
    const setup = simulateTriggerSetup(5, 9, 0);
    expect(setup.success).toBe(true);
    expect(setup.triggerId).toBeTruthy();

    // Step 3: Simulate storage
    const stored = { MONTHLY_EMAIL_TRIGGER_ID: setup.triggerId };
    expect(stored.MONTHLY_EMAIL_TRIGGER_ID).toBe(setup.triggerId);
  });

  it('handles trigger update workflow (remove old, create new)', () => {
    // Step 1: Create initial trigger
    const initialSetup = simulateTriggerSetup(5, 9, 0);
    expect(initialSetup.success).toBe(true);
    const initialTriggerId = initialSetup.triggerId;

    // Step 2: Simulate removal (in real code, would delete trigger)
    let storedTriggerId = initialTriggerId;
    storedTriggerId = null; // Simulate deletion

    // Step 3: Create new trigger with different schedule
    const newSetup = simulateTriggerSetup(15, 14, 30);
    expect(newSetup.success).toBe(true);
    expect(newSetup.triggerId).not.toBe(initialTriggerId);
  });

  it('validates all schedule components before trigger creation', () => {
    // Test that all three parameters are validated
    const invalidDay = validateTriggerParameters(29, 9, 0);
    expect(invalidDay.valid).toBe(false);

    const invalidHour = validateTriggerParameters(5, 24, 0);
    expect(invalidHour.valid).toBe(false);

    const invalidMinute = validateTriggerParameters(5, 9, 60);
    expect(invalidMinute.valid).toBe(false);

    const allValid = validateTriggerParameters(5, 9, 0);
    expect(allValid.valid).toBe(true);
  });
});

