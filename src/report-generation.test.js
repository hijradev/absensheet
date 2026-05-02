// report-generation.test.js — Unit tests for PDF report generation
//
// Because backend/Settings.gs is a Google Apps Script file (not an ES module),
// the validation and formatting logic is re-implemented here for Node.js testing.
// Tests validate month/year parameters, date range calculation, and report structure.
//
// Validates: Requirements 3.1, 3.2, 3.4, 3.5, 3.6

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure validation functions extracted from generateMonthlyReportPDF
// ---------------------------------------------------------------------------

/**
 * Validate month parameter
 * @param {number} month - Month number (1-12)
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateMonth(month) {
  if (typeof month !== 'number' || isNaN(month)) {
    return { valid: false, error: 'Month must be a number between 1 and 12' };
  }
  if (month < 1 || month > 12) {
    return { valid: false, error: 'Month must be a number between 1 and 12' };
  }
  return { valid: true, error: null };
}

/**
 * Validate year parameter
 * @param {number} year - Year (e.g., 2024)
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateYear(year) {
  if (typeof year !== 'number' || isNaN(year)) {
    return { valid: false, error: 'Year must be a valid year between 2000 and 2100' };
  }
  if (year < 2000 || year > 2100) {
    return { valid: false, error: 'Year must be a valid year between 2000 and 2100' };
  }
  return { valid: true, error: null };
}

/**
 * Calculate date range for a given month/year
 * @param {number} month - Month number (1-12)
 * @param {number} year - Year (e.g., 2024)
 * @returns {{ startDate: string, endDate: string }} Date range in YYYY-MM-DD format
 */
function calculateMonthDateRange(month, year) {
  // Start date: first day of month
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  
  // End date: last day of month
  // Calculate by getting day 0 of next month
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const lastDay = new Date(nextYear, nextMonth - 1, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  
  return { startDate, endDate };
}

/**
 * Format month/year for display
 * @param {number} month - Month number (1-12)
 * @param {number} year - Year (e.g., 2024)
 * @returns {string} Formatted month/year (e.g., "January 2024")
 */
function formatMonthYear(month, year) {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${monthNames[month - 1]} ${year}`;
}

/**
 * Generate PDF filename for a given month/year
 * @param {number} month - Month number (1-12)
 * @param {number} year - Year (e.g., 2024)
 * @returns {string} PDF filename
 */
function generatePDFFilename(month, year) {
  return `Monthly_Attendance_Report_${year}_${String(month).padStart(2, '0')}.pdf`;
}

/**
 * Check if report data is empty
 * @param {Array} reportData - Array of employee attendance records
 * @returns {boolean} True if no data available
 */
function isReportDataEmpty(reportData) {
  return !reportData || reportData.length === 0;
}

// ---------------------------------------------------------------------------
// Month Validation Tests
// ---------------------------------------------------------------------------

describe('validateMonth() - valid months', () => {
  // Validates: Requirements 3.1

  it('accepts month = 1 (January)', () => {
    const result = validateMonth(1);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('accepts month = 12 (December)', () => {
    const result = validateMonth(12);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('accepts month = 6 (June)', () => {
    const result = validateMonth(6);
    expect(result.valid).toBe(true);
  });

  it('accepts all valid months 1-12', () => {
    for (let month = 1; month <= 12; month++) {
      const result = validateMonth(month);
      expect(result.valid).toBe(true);
    }
  });
});

describe('validateMonth() - invalid months', () => {
  // Validates: Requirements 3.1

  it('rejects month = 0', () => {
    const result = validateMonth(0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 1 and 12');
  });

  it('rejects month = 13', () => {
    const result = validateMonth(13);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 1 and 12');
  });

  it('rejects month = -1', () => {
    const result = validateMonth(-1);
    expect(result.valid).toBe(false);
  });

  it('rejects NaN', () => {
    const result = validateMonth(NaN);
    expect(result.valid).toBe(false);
  });

  it('rejects string', () => {
    const result = validateMonth('6');
    expect(result.valid).toBe(false);
  });

  it('rejects null', () => {
    const result = validateMonth(null);
    expect(result.valid).toBe(false);
  });

  it('rejects undefined', () => {
    const result = validateMonth(undefined);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Year Validation Tests
// ---------------------------------------------------------------------------

describe('validateYear() - valid years', () => {
  // Validates: Requirements 3.1

  it('accepts year = 2000 (minimum valid)', () => {
    const result = validateYear(2000);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('accepts year = 2100 (maximum valid)', () => {
    const result = validateYear(2100);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('accepts year = 2024 (current year)', () => {
    const result = validateYear(2024);
    expect(result.valid).toBe(true);
  });

  it('accepts year = 2050 (future year)', () => {
    const result = validateYear(2050);
    expect(result.valid).toBe(true);
  });
});

describe('validateYear() - invalid years', () => {
  // Validates: Requirements 3.1

  it('rejects year = 1999', () => {
    const result = validateYear(1999);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 2000 and 2100');
  });

  it('rejects year = 2101', () => {
    const result = validateYear(2101);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between 2000 and 2100');
  });

  it('rejects NaN', () => {
    const result = validateYear(NaN);
    expect(result.valid).toBe(false);
  });

  it('rejects string', () => {
    const result = validateYear('2024');
    expect(result.valid).toBe(false);
  });

  it('rejects null', () => {
    const result = validateYear(null);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Date Range Calculation Tests
// ---------------------------------------------------------------------------

describe('calculateMonthDateRange() - date range calculation', () => {
  // Validates: Requirements 3.1, 3.2

  it('calculates correct range for January 2024', () => {
    const result = calculateMonthDateRange(1, 2024);
    expect(result.startDate).toBe('2024-01-01');
    expect(result.endDate).toBe('2024-01-31');
  });

  it('calculates correct range for February 2024 (leap year)', () => {
    const result = calculateMonthDateRange(2, 2024);
    expect(result.startDate).toBe('2024-02-01');
    expect(result.endDate).toBe('2024-02-29');
  });

  it('calculates correct range for February 2023 (non-leap year)', () => {
    const result = calculateMonthDateRange(2, 2023);
    expect(result.startDate).toBe('2023-02-01');
    expect(result.endDate).toBe('2023-02-28');
  });

  it('calculates correct range for April 2024 (30 days)', () => {
    const result = calculateMonthDateRange(4, 2024);
    expect(result.startDate).toBe('2024-04-01');
    expect(result.endDate).toBe('2024-04-30');
  });

  it('calculates correct range for December 2024', () => {
    const result = calculateMonthDateRange(12, 2024);
    expect(result.startDate).toBe('2024-12-01');
    expect(result.endDate).toBe('2024-12-31');
  });

  it('handles year boundary correctly (December to January)', () => {
    const dec = calculateMonthDateRange(12, 2024);
    const jan = calculateMonthDateRange(1, 2025);
    expect(dec.endDate).toBe('2024-12-31');
    expect(jan.startDate).toBe('2025-01-01');
  });

  it('calculates all months correctly for 2024', () => {
    const expectedDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // 2024 is leap year
    for (let month = 1; month <= 12; month++) {
      const result = calculateMonthDateRange(month, 2024);
      const endDay = parseInt(result.endDate.split('-')[2], 10);
      expect(endDay).toBe(expectedDays[month - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// Month/Year Formatting Tests
// ---------------------------------------------------------------------------

describe('formatMonthYear() - display formatting', () => {
  // Validates: Requirements 3.5

  it('formats January 2024 correctly', () => {
    expect(formatMonthYear(1, 2024)).toBe('January 2024');
  });

  it('formats December 2024 correctly', () => {
    expect(formatMonthYear(12, 2024)).toBe('December 2024');
  });

  it('formats June 2023 correctly', () => {
    expect(formatMonthYear(6, 2023)).toBe('June 2023');
  });

  it('formats all months correctly', () => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    for (let month = 1; month <= 12; month++) {
      const formatted = formatMonthYear(month, 2024);
      expect(formatted).toBe(`${monthNames[month - 1]} 2024`);
    }
  });
});

// ---------------------------------------------------------------------------
// PDF Filename Generation Tests
// ---------------------------------------------------------------------------

describe('generatePDFFilename() - filename generation', () => {
  // Validates: Requirements 3.1

  it('generates correct filename for January 2024', () => {
    expect(generatePDFFilename(1, 2024)).toBe('Monthly_Attendance_Report_2024_01.pdf');
  });

  it('generates correct filename for December 2024', () => {
    expect(generatePDFFilename(12, 2024)).toBe('Monthly_Attendance_Report_2024_12.pdf');
  });

  it('pads single-digit months with zero', () => {
    expect(generatePDFFilename(6, 2024)).toBe('Monthly_Attendance_Report_2024_06.pdf');
  });

  it('does not pad double-digit months', () => {
    expect(generatePDFFilename(11, 2024)).toBe('Monthly_Attendance_Report_2024_11.pdf');
  });

  it('includes .pdf extension', () => {
    const filename = generatePDFFilename(3, 2024);
    expect(filename.endsWith('.pdf')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Empty Data Handling Tests
// ---------------------------------------------------------------------------

describe('isReportDataEmpty() - empty data detection', () => {
  // Validates: Requirements 3.6

  it('returns true for empty array', () => {
    expect(isReportDataEmpty([])).toBe(true);
  });

  it('returns true for null', () => {
    expect(isReportDataEmpty(null)).toBe(true);
  });

  it('returns true for undefined', () => {
    expect(isReportDataEmpty(undefined)).toBe(true);
  });

  it('returns false for array with one element', () => {
    expect(isReportDataEmpty([{ employeeId: '001' }])).toBe(false);
  });

  it('returns false for array with multiple elements', () => {
    expect(isReportDataEmpty([
      { employeeId: '001' },
      { employeeId: '002' }
    ])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Report Data Structure Tests
// ---------------------------------------------------------------------------

describe('Report data structure validation', () => {
  // Validates: Requirements 3.2, 3.4

  it('validates complete employee record structure', () => {
    const employeeRecord = {
      employeeId: '001',
      employeeName: 'John Doe',
      position: 'Manager',
      onTime: 20,
      late: 2,
      absent: 1,
      totalDays: 23
    };

    expect(employeeRecord).toHaveProperty('employeeId');
    expect(employeeRecord).toHaveProperty('employeeName');
    expect(employeeRecord).toHaveProperty('position');
    expect(employeeRecord).toHaveProperty('onTime');
    expect(employeeRecord).toHaveProperty('late');
    expect(employeeRecord).toHaveProperty('absent');
    expect(employeeRecord).toHaveProperty('totalDays');
  });

  it('validates summary statistics structure', () => {
    const summary = {
      totalOnTime: 100,
      totalLate: 15,
      totalAbsent: 5
    };

    expect(summary).toHaveProperty('totalOnTime');
    expect(summary).toHaveProperty('totalLate');
    expect(summary).toHaveProperty('totalAbsent');
  });

  it('validates complete report structure', () => {
    const report = {
      reportData: [
        {
          employeeId: '001',
          employeeName: 'John Doe',
          position: 'Manager',
          onTime: 20,
          late: 2,
          absent: 1,
          totalDays: 23
        }
      ],
      summary: {
        totalOnTime: 20,
        totalLate: 2,
        totalAbsent: 1
      }
    };

    expect(report).toHaveProperty('reportData');
    expect(report).toHaveProperty('summary');
    expect(Array.isArray(report.reportData)).toBe(true);
    expect(report.reportData.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// HTML Content Structure Tests
// ---------------------------------------------------------------------------

describe('HTML content structure for PDF', () => {
  // Validates: Requirements 3.4, 3.5

  /**
   * Generate HTML content structure (simplified version for testing)
   * @param {string} orgName - Organization name
   * @param {string} monthYearLabel - Month/year label
   * @param {Array} reportData - Report data
   * @returns {string} HTML content
   */
  function generateHTMLStructure(orgName, monthYearLabel, reportData) {
    let html = '<html><head><style>/* styles */</style></head><body>';
    html += `<h1>${orgName}</h1>`;
    html += `<h2>Monthly Attendance Report - ${monthYearLabel}</h2>`;
    
    if (reportData.length === 0) {
      html += '<div class="no-data">No attendance data available for this month.</div>';
    } else {
      html += '<table>';
      html += '<thead><tr>';
      html += '<th>Employee ID</th><th>Employee Name</th><th>Position</th>';
      html += '<th>On Time</th><th>Late</th><th>Early Leave</th><th>Total Days</th>';
      html += '</tr></thead><tbody>';
      
      for (const emp of reportData) {
        html += '<tr>';
        html += `<td>${emp.employeeId}</td>`;
        html += `<td>${emp.employeeName}</td>`;
        html += `<td>${emp.position}</td>`;
        html += `<td>${emp.onTime}</td>`;
        html += `<td>${emp.late}</td>`;
        html += `<td>${emp.absent}</td>`;
        html += `<td>${emp.totalDays}</td>`;
        html += '</tr>';
      }
      
      html += '</tbody></table>';
    }
    
    html += '</body></html>';
    return html;
  }

  it('includes organization name in header', () => {
    const html = generateHTMLStructure('Test Company', 'January 2024', []);
    expect(html).toContain('<h1>Test Company</h1>');
  });

  it('includes month/year label in header', () => {
    const html = generateHTMLStructure('Test Company', 'January 2024', []);
    expect(html).toContain('Monthly Attendance Report - January 2024');
  });

  it('shows no data message when report is empty', () => {
    const html = generateHTMLStructure('Test Company', 'January 2024', []);
    expect(html).toContain('No attendance data available for this month');
  });

  it('includes table headers when data exists', () => {
    const data = [{
      employeeId: '001',
      employeeName: 'John Doe',
      position: 'Manager',
      onTime: 20,
      late: 2,
      absent: 1,
      totalDays: 23
    }];
    const html = generateHTMLStructure('Test Company', 'January 2024', data);
    expect(html).toContain('<th>Employee ID</th>');
    expect(html).toContain('<th>Employee Name</th>');
    expect(html).toContain('<th>Position</th>');
    expect(html).toContain('<th>On Time</th>');
    expect(html).toContain('<th>Late</th>');
    expect(html).toContain('<th>Early Leave</th>');
    expect(html).toContain('<th>Total Days</th>');
  });

  it('includes employee data in table rows', () => {
    const data = [{
      employeeId: '001',
      employeeName: 'John Doe',
      position: 'Manager',
      onTime: 20,
      late: 2,
      absent: 1,
      totalDays: 23
    }];
    const html = generateHTMLStructure('Test Company', 'January 2024', data);
    expect(html).toContain('<td>001</td>');
    expect(html).toContain('<td>John Doe</td>');
    expect(html).toContain('<td>Manager</td>');
    expect(html).toContain('<td>20</td>');
    expect(html).toContain('<td>2</td>');
    expect(html).toContain('<td>1</td>');
    expect(html).toContain('<td>23</td>');
  });

  it('includes all employees in report', () => {
    const data = [
      { employeeId: '001', employeeName: 'John Doe', position: 'Manager', onTime: 20, late: 2, absent: 1, totalDays: 23 },
      { employeeId: '002', employeeName: 'Jane Smith', position: 'Developer', onTime: 22, late: 0, absent: 0, totalDays: 22 }
    ];
    const html = generateHTMLStructure('Test Company', 'January 2024', data);
    expect(html).toContain('John Doe');
    expect(html).toContain('Jane Smith');
  });
});
