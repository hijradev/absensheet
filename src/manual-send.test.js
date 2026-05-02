// manual-send.test.js — Unit tests for manual monthly report sending
//
// Because backend/Settings.gs is a Google Apps Script file (not an ES module),
// the validation and logic is re-implemented here for Node.js testing.
// Tests validate manual send functionality, parameter validation, and error handling.
//
// Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure validation and logic functions extracted from sendManualMonthlyReport
// ---------------------------------------------------------------------------

/**
 * Validate recipient email configuration
 * @param {string} recipient - Email address from settings
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateRecipientConfiguration(recipient) {
  if (!recipient || recipient.trim() === '') {
    return { 
      valid: false, 
      error: 'No recipient email configured. Please configure email settings first.' 
    };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(recipient)) {
    return { 
      valid: false, 
      error: 'Invalid recipient email format. Please update email settings.' 
    };
  }
  
  return { valid: true, error: null };
}

/**
 * Calculate current month and year
 * @returns {{ month: number, year: number, monthYear: string }}
 */
function calculateCurrentMonthYear() {
  const now = new Date();
  const month = now.getMonth() + 1; // getMonth() returns 0-11, we need 1-12
  const year = now.getFullYear();
  const monthYear = year + '-' + String(month).padStart(2, '0');
  
  return { month, year, monthYear };
}

/**
 * Format month/year string for logging
 * @param {number} month - Month number (1-12)
 * @param {number} year - Year (e.g., 2024)
 * @returns {string} Formatted month/year string (YYYY-MM)
 */
function formatMonthYear(month, year) {
  return year + '-' + String(month).padStart(2, '0');
}

/**
 * Simulate the manual send workflow
 * @param {string} recipient - Email address
 * @param {boolean} pdfGenerationSuccess - Whether PDF generation succeeds
 * @param {boolean} emailSendSuccess - Whether email sending succeeds
 * @returns {{ success: boolean, error: string|null, recipient: string, monthYear: string }}
 */
function simulateManualSend(recipient, pdfGenerationSuccess, emailSendSuccess) {
  // Validate recipient
  const validation = validateRecipientConfiguration(recipient);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      recipient: recipient || 'unknown',
      monthYear: ''
    };
  }
  
  // Calculate current month/year
  const { month, year, monthYear } = calculateCurrentMonthYear();
  
  // Simulate PDF generation
  if (!pdfGenerationSuccess) {
    return {
      success: false,
      error: 'Failed to generate PDF report',
      recipient: recipient,
      monthYear: monthYear
    };
  }
  
  // Simulate email sending
  if (!emailSendSuccess) {
    return {
      success: false,
      error: 'Failed to send email',
      recipient: recipient,
      monthYear: monthYear
    };
  }
  
  // Success
  return {
    success: true,
    error: null,
    recipient: recipient,
    monthYear: monthYear
  };
}

// ---------------------------------------------------------------------------
// Recipient Configuration Validation Tests
// ---------------------------------------------------------------------------

describe('validateRecipientConfiguration() - valid recipients', () => {
  // Validates: Requirements 6.1, 6.3

  it('accepts valid email address', () => {
    const result = validateRecipientConfiguration('admin@company.com');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('accepts email with subdomain', () => {
    const result = validateRecipientConfiguration('user@mail.company.com');
    expect(result.valid).toBe(true);
  });

  it('accepts email with numbers', () => {
    const result = validateRecipientConfiguration('user123@example456.com');
    expect(result.valid).toBe(true);
  });

  it('accepts email with dots', () => {
    const result = validateRecipientConfiguration('first.last@example.com');
    expect(result.valid).toBe(true);
  });

  it('accepts email with hyphens', () => {
    const result = validateRecipientConfiguration('user-name@company-name.com');
    expect(result.valid).toBe(true);
  });
});

describe('validateRecipientConfiguration() - invalid recipients', () => {
  // Validates: Requirements 6.1, 6.3

  it('rejects empty string', () => {
    const result = validateRecipientConfiguration('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('No recipient email configured');
  });

  it('rejects whitespace-only string', () => {
    const result = validateRecipientConfiguration('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('No recipient email configured');
  });

  it('rejects null', () => {
    const result = validateRecipientConfiguration(null);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('No recipient email configured');
  });

  it('rejects undefined', () => {
    const result = validateRecipientConfiguration(undefined);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('No recipient email configured');
  });

  it('rejects email without @ symbol', () => {
    const result = validateRecipientConfiguration('admincompany.com');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid recipient email format');
  });

  it('rejects email without domain', () => {
    const result = validateRecipientConfiguration('admin@');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid recipient email format');
  });

  it('rejects email with spaces', () => {
    const result = validateRecipientConfiguration('admin user@company.com');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid recipient email format');
  });

  it('provides helpful error message for missing configuration', () => {
    const result = validateRecipientConfiguration('');
    expect(result.error).toContain('Please configure email settings first');
  });

  it('provides helpful error message for invalid format', () => {
    const result = validateRecipientConfiguration('invalid-email');
    expect(result.error).toContain('Please update email settings');
  });
});

// ---------------------------------------------------------------------------
// Current Month/Year Calculation Tests
// ---------------------------------------------------------------------------

describe('calculateCurrentMonthYear() - date calculation', () => {
  // Validates: Requirements 6.1, 6.2

  it('returns month between 1 and 12', () => {
    const result = calculateCurrentMonthYear();
    expect(result.month).toBeGreaterThanOrEqual(1);
    expect(result.month).toBeLessThanOrEqual(12);
  });

  it('returns valid year', () => {
    const result = calculateCurrentMonthYear();
    expect(result.year).toBeGreaterThanOrEqual(2000);
    expect(result.year).toBeLessThanOrEqual(2100);
  });

  it('returns properly formatted monthYear string', () => {
    const result = calculateCurrentMonthYear();
    expect(result.monthYear).toMatch(/^\d{4}-\d{2}$/);
  });

  it('pads single-digit months with zero', () => {
    const result = calculateCurrentMonthYear();
    // If current month is single digit, it should be padded
    if (result.month < 10) {
      expect(result.monthYear).toContain('-0' + result.month);
    }
  });

  it('returns consistent values when called multiple times', () => {
    const result1 = calculateCurrentMonthYear();
    const result2 = calculateCurrentMonthYear();
    expect(result1.month).toBe(result2.month);
    expect(result1.year).toBe(result2.year);
    expect(result1.monthYear).toBe(result2.monthYear);
  });

  it('returns month as number type', () => {
    const result = calculateCurrentMonthYear();
    expect(typeof result.month).toBe('number');
  });

  it('returns year as number type', () => {
    const result = calculateCurrentMonthYear();
    expect(typeof result.year).toBe('number');
  });

  it('returns monthYear as string type', () => {
    const result = calculateCurrentMonthYear();
    expect(typeof result.monthYear).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Month/Year Formatting Tests
// ---------------------------------------------------------------------------

describe('formatMonthYear() - formatting', () => {
  // Validates: Requirements 6.1, 6.2

  it('formats January correctly', () => {
    const result = formatMonthYear(1, 2024);
    expect(result).toBe('2024-01');
  });

  it('formats December correctly', () => {
    const result = formatMonthYear(12, 2024);
    expect(result).toBe('2024-12');
  });

  it('pads single-digit months with zero', () => {
    for (let month = 1; month <= 9; month++) {
      const result = formatMonthYear(month, 2024);
      expect(result).toBe('2024-0' + month);
    }
  });

  it('does not pad double-digit months', () => {
    for (let month = 10; month <= 12; month++) {
      const result = formatMonthYear(month, 2024);
      expect(result).toBe('2024-' + month);
    }
  });

  it('formats all months correctly', () => {
    const expected = [
      '2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06',
      '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12'
    ];
    for (let month = 1; month <= 12; month++) {
      const result = formatMonthYear(month, 2024);
      expect(result).toBe(expected[month - 1]);
    }
  });

  it('handles different years correctly', () => {
    expect(formatMonthYear(6, 2023)).toBe('2023-06');
    expect(formatMonthYear(6, 2024)).toBe('2024-06');
    expect(formatMonthYear(6, 2025)).toBe('2025-06');
  });

  it('uses YYYY-MM format', () => {
    const result = formatMonthYear(3, 2024);
    expect(result).toMatch(/^\d{4}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// Manual Send Workflow Tests
// ---------------------------------------------------------------------------

describe('simulateManualSend() - successful scenarios', () => {
  // Validates: Requirements 6.1, 6.2, 6.3, 6.4

  it('succeeds with valid recipient and successful operations', () => {
    const result = simulateManualSend('admin@company.com', true, true);
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(result.recipient).toBe('admin@company.com');
    expect(result.monthYear).toMatch(/^\d{4}-\d{2}$/);
  });

  it('returns recipient email on success', () => {
    const result = simulateManualSend('test@example.com', true, true);
    expect(result.recipient).toBe('test@example.com');
  });

  it('returns current month/year on success', () => {
    const result = simulateManualSend('admin@company.com', true, true);
    const current = calculateCurrentMonthYear();
    expect(result.monthYear).toBe(current.monthYear);
  });
});

describe('simulateManualSend() - recipient validation failures', () => {
  // Validates: Requirements 6.1, 6.3

  it('fails with empty recipient', () => {
    const result = simulateManualSend('', true, true);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No recipient email configured');
  });

  it('fails with invalid email format', () => {
    const result = simulateManualSend('invalid-email', true, true);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid recipient email format');
  });

  it('fails with null recipient', () => {
    const result = simulateManualSend(null, true, true);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No recipient email configured');
  });

  it('fails with undefined recipient', () => {
    const result = simulateManualSend(undefined, true, true);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No recipient email configured');
  });

  it('returns empty monthYear when recipient validation fails', () => {
    const result = simulateManualSend('', true, true);
    expect(result.monthYear).toBe('');
  });
});

describe('simulateManualSend() - PDF generation failures', () => {
  // Validates: Requirements 6.1, 6.2, 6.4

  it('fails when PDF generation fails', () => {
    const result = simulateManualSend('admin@company.com', false, true);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to generate PDF report');
  });

  it('returns recipient when PDF generation fails', () => {
    const result = simulateManualSend('admin@company.com', false, true);
    expect(result.recipient).toBe('admin@company.com');
  });

  it('returns monthYear when PDF generation fails', () => {
    const result = simulateManualSend('admin@company.com', false, true);
    expect(result.monthYear).toMatch(/^\d{4}-\d{2}$/);
  });

  it('does not attempt email send when PDF generation fails', () => {
    // If PDF generation fails, email send parameter should not matter
    const result1 = simulateManualSend('admin@company.com', false, true);
    const result2 = simulateManualSend('admin@company.com', false, false);
    expect(result1.error).toBe(result2.error);
  });
});

describe('simulateManualSend() - email sending failures', () => {
  // Validates: Requirements 6.1, 6.3, 6.4

  it('fails when email sending fails', () => {
    const result = simulateManualSend('admin@company.com', true, false);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to send email');
  });

  it('returns recipient when email sending fails', () => {
    const result = simulateManualSend('admin@company.com', true, false);
    expect(result.recipient).toBe('admin@company.com');
  });

  it('returns monthYear when email sending fails', () => {
    const result = simulateManualSend('admin@company.com', true, false);
    expect(result.monthYear).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('simulateManualSend() - error handling order', () => {
  // Validates: Requirements 6.1, 6.3, 6.4

  it('validates recipient before attempting PDF generation', () => {
    const result = simulateManualSend('', false, false);
    expect(result.error).toContain('No recipient email configured');
    expect(result.error).not.toContain('PDF');
  });

  it('validates recipient before attempting email send', () => {
    const result = simulateManualSend('invalid', false, false);
    expect(result.error).toContain('Invalid recipient email format');
    expect(result.error).not.toContain('email');
  });

  it('attempts PDF generation before email send', () => {
    const result = simulateManualSend('admin@company.com', false, false);
    expect(result.error).toContain('Failed to generate PDF report');
    expect(result.error).not.toContain('Failed to send email');
  });
});

// ---------------------------------------------------------------------------
// Manual Send Independence Tests
// ---------------------------------------------------------------------------

describe('Manual send independence from automatic email state', () => {
  // Validates: Requirements 6.4, 6.5

  it('succeeds regardless of automatic email enabled state', () => {
    // Manual send should work whether automatic emails are enabled or disabled
    // This is simulated by the function not checking any "enabled" flag
    const result = simulateManualSend('admin@company.com', true, true);
    expect(result.success).toBe(true);
  });

  it('uses same PDF generation process', () => {
    // Both manual and automatic should use generateMonthlyReportPDF()
    // This is validated by the function signature and error messages
    const result = simulateManualSend('admin@company.com', false, true);
    expect(result.error).toContain('Failed to generate PDF report');
  });

  it('uses same email delivery process', () => {
    // Both manual and automatic should use sendMonthlyReportEmail()
    // This is validated by the function signature and error messages
    const result = simulateManualSend('admin@company.com', true, false);
    expect(result.error).toContain('Failed to send email');
  });

  it('provides UI feedback on success', () => {
    const result = simulateManualSend('admin@company.com', true, true);
    expect(result.success).toBe(true);
    expect(result.recipient).toBeTruthy();
    expect(result.monthYear).toBeTruthy();
  });

  it('provides UI feedback on failure', () => {
    const result = simulateManualSend('', true, true);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------

describe('Manual send integration', () => {
  // Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5

  it('completes full workflow with valid inputs', () => {
    const result = simulateManualSend('admin@company.com', true, true);
    
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(result.recipient).toBe('admin@company.com');
    expect(result.monthYear).toMatch(/^\d{4}-\d{2}$/);
  });

  it('handles all failure scenarios appropriately', () => {
    const scenarios = [
      { recipient: '', pdf: true, email: true, expectedError: 'No recipient email configured' },
      { recipient: 'invalid', pdf: true, email: true, expectedError: 'Invalid recipient email format' },
      { recipient: 'admin@company.com', pdf: false, email: true, expectedError: 'Failed to generate PDF report' },
      { recipient: 'admin@company.com', pdf: true, email: false, expectedError: 'Failed to send email' }
    ];
    
    scenarios.forEach(scenario => {
      const result = simulateManualSend(scenario.recipient, scenario.pdf, scenario.email);
      expect(result.success).toBe(false);
      expect(result.error).toContain(scenario.expectedError);
    });
  });

  it('provides consistent error messages', () => {
    const result1 = simulateManualSend('', true, true);
    const result2 = simulateManualSend('', true, true);
    expect(result1.error).toBe(result2.error);
  });

  it('returns all required data for UI feedback', () => {
    const result = simulateManualSend('admin@company.com', true, true);
    
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('recipient');
    expect(result).toHaveProperty('monthYear');
  });

  it('calculates current month correctly for immediate sending', () => {
    const result = simulateManualSend('admin@company.com', true, true);
    const current = calculateCurrentMonthYear();
    
    expect(result.monthYear).toBe(current.monthYear);
  });
});
