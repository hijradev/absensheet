// SeedData.gs
// Run seedAllData() from the GAS editor to populate the database with 50 sample users
// and 3 months of attendance history with realistic distributions.

/**
 * Master entry point — run this once from the GAS editor.
 * It seeds positions, shifts, employees, and attendance data.
 */
function seedAllData() {
  try {
    const props = getProps();
    if (!props.MASTER_DB_ID) return "Master DB ID not found. Run setupDatabase() first.";

    const results = [];
    results.push(seedPositions(props));
    results.push(seedShifts(props));
    results.push(seedEmployees(props));
    results.push(seedAttendance(props));

    invalidateMasterCache();
    return results.join("\n");
  } catch (e) {
    return "Error during seeding: " + e.message;
  }
}

// ─────────────────────────────────────────────
// 1. POSITIONS  (8 jabatan)
// ─────────────────────────────────────────────
function seedPositions(props) {
  const ss = SpreadsheetApp.openById(props.MASTER_DB_ID);
  const sheet = ss.getSheetByName("Positions");
  if (!sheet) return "Positions sheet not found.";

  const positions = [
    ["P1", "Staff"],
    ["P2", "Manager"],
    ["P3", "Supervisor"],
    ["P4", "Senior Staff"],
    ["P5", "Junior Staff"],
    ["P6", "Team Lead"],
    ["P7", "Coordinator"],
    ["P8", "Director"],
  ];

  // Clear existing data (keep header)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();

  positions.forEach(row => sheet.appendRow(row));
  return "Positions seeded: " + positions.length + " records.";
}

// ─────────────────────────────────────────────
// 2. SHIFTS  (3 shifts)
// ─────────────────────────────────────────────
function seedShifts(props) {
  const ss = SpreadsheetApp.openById(props.MASTER_DB_ID);
  const sheet = ss.getSheetByName("Shifts");
  if (!sheet) return "Shifts sheet not found.";

  const shifts = [
    ["S1", "08:00", "17:00"],  // Morning shift
    ["S2", "09:00", "18:00"],  // Regular shift
    ["S3", "13:00", "22:00"],  // Afternoon shift
  ];

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();

  shifts.forEach(row => sheet.appendRow(row));
  return "Shifts seeded: " + shifts.length + " records.";
}

// ─────────────────────────────────────────────
// 3. EMPLOYEES  (50 users + 1 admin)
// ─────────────────────────────────────────────
function seedEmployees(props) {
  const ss = SpreadsheetApp.openById(props.MASTER_DB_ID);
  const sheet = ss.getSheetByName("Employees");
  if (!sheet) return "Employees sheet not found.";

  // Distribution:
  //   Positions: P1(Staff)=18, P2(Manager)=5, P3(Supervisor)=7, P4(Senior Staff)=8,
  //              P5(Junior Staff)=6, P6(Team Lead)=3, P7(Coordinator)=2, P8(Director)=1
  //   Shifts:    S1=20, S2=20, S3=10
  //   Roles:     Employee=49, Admin=1 (A001)

  const employees = [
    // id, password (plain — will be hashed), name, shift_id, role, photo_url, jabatan_id
    // ── Directors & Managers ──
    ["E001", "pass1234", "Budi Santoso",       "S2", "Employee", "", "P8"],  // Director
    ["E002", "pass1234", "Siti Rahayu",        "S2", "Employee", "", "P2"],  // Manager
    ["E003", "pass1234", "Ahmad Fauzi",        "S2", "Employee", "", "P2"],  // Manager
    ["E004", "pass1234", "Dewi Lestari",       "S1", "Employee", "", "P2"],  // Manager
    ["E005", "pass1234", "Rudi Hartono",       "S2", "Employee", "", "P2"],  // Manager
    ["E006", "pass1234", "Rina Wulandari",     "S1", "Employee", "", "P2"],  // Manager
    // ── Team Leads ──
    ["E007", "pass1234", "Hendra Kusuma",      "S1", "Employee", "", "P6"],
    ["E008", "pass1234", "Yuni Astuti",        "S2", "Employee", "", "P6"],
    ["E009", "pass1234", "Doni Prasetyo",      "S3", "Employee", "", "P6"],
    // ── Supervisors ──
    ["E010", "pass1234", "Fitri Handayani",    "S1", "Employee", "", "P3"],
    ["E011", "pass1234", "Agus Setiawan",      "S2", "Employee", "", "P3"],
    ["E012", "pass1234", "Lina Marlina",       "S3", "Employee", "", "P3"],
    ["E013", "pass1234", "Wahyu Nugroho",      "S1", "Employee", "", "P3"],
    ["E014", "pass1234", "Sri Mulyani",        "S2", "Employee", "", "P3"],
    ["E015", "pass1234", "Bambang Irawan",     "S3", "Employee", "", "P3"],
    ["E016", "pass1234", "Nita Permata",       "S1", "Employee", "", "P3"],
    // ── Coordinators ──
    ["E017", "pass1234", "Eko Purnomo",        "S2", "Employee", "", "P7"],
    ["E018", "pass1234", "Mega Sari",          "S1", "Employee", "", "P7"],
    // ── Senior Staff ──
    ["E019", "pass1234", "Tono Wijaya",        "S1", "Employee", "", "P4"],
    ["E020", "pass1234", "Ani Suryani",        "S2", "Employee", "", "P4"],
    ["E021", "pass1234", "Bagas Pratama",      "S3", "Employee", "", "P4"],
    ["E022", "pass1234", "Citra Dewi",         "S1", "Employee", "", "P4"],
    ["E023", "pass1234", "Dian Puspita",       "S2", "Employee", "", "P4"],
    ["E024", "pass1234", "Edi Susanto",        "S3", "Employee", "", "P4"],
    ["E025", "pass1234", "Fani Oktavia",       "S1", "Employee", "", "P4"],
    ["E026", "pass1234", "Gilang Ramadhan",    "S2", "Employee", "", "P4"],
    // ── Staff ──
    ["E027", "pass1234", "Hani Safitri",       "S1", "Employee", "", "P1"],
    ["E028", "pass1234", "Irfan Maulana",      "S2", "Employee", "", "P1"],
    ["E029", "pass1234", "Joko Susilo",        "S3", "Employee", "", "P1"],
    ["E030", "pass1234", "Kartika Sari",       "S1", "Employee", "", "P1"],
    ["E031", "pass1234", "Lukman Hakim",       "S2", "Employee", "", "P1"],
    ["E032", "pass1234", "Mira Agustina",      "S3", "Employee", "", "P1"],
    ["E033", "pass1234", "Nanda Putra",        "S1", "Employee", "", "P1"],
    ["E034", "pass1234", "Oki Firmansyah",     "S2", "Employee", "", "P1"],
    ["E035", "pass1234", "Putri Ramadhani",    "S3", "Employee", "", "P1"],
    ["E036", "pass1234", "Qori Amalia",        "S1", "Employee", "", "P1"],
    ["E037", "pass1234", "Rizky Aditya",       "S2", "Employee", "", "P1"],
    ["E038", "pass1234", "Sari Indah",         "S3", "Employee", "", "P1"],
    ["E039", "pass1234", "Teguh Santoso",      "S1", "Employee", "", "P1"],
    ["E040", "pass1234", "Umi Kalsum",         "S2", "Employee", "", "P1"],
    ["E041", "pass1234", "Vino Pratama",       "S3", "Employee", "", "P1"],
    ["E042", "pass1234", "Winda Sari",         "S1", "Employee", "", "P1"],
    ["E043", "pass1234", "Xena Putri",         "S2", "Employee", "", "P1"],
    ["E044", "pass1234", "Yogi Setiawan",      "S3", "Employee", "", "P1"],
    // ── Junior Staff ──
    ["E045", "pass1234", "Zara Amelia",        "S1", "Employee", "", "P5"],
    ["E046", "pass1234", "Aldi Nugraha",       "S2", "Employee", "", "P5"],
    ["E047", "pass1234", "Bella Safira",       "S3", "Employee", "", "P5"],
    ["E048", "pass1234", "Candra Wijaya",      "S1", "Employee", "", "P5"],
    ["E049", "pass1234", "Dita Anggraini",     "S2", "Employee", "", "P5"],
    ["E050", "pass1234", "Evan Kusuma",        "S3", "Employee", "", "P5"],
    // ── Admin ──
    ["A001", "admin123", "Admin User",         "S1", "Admin",    "", "P2"],
  ];

  // Clear existing data (keep header)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();

  employees.forEach(emp => {
    const hashed = hashPassword(emp[1]);
    sheet.appendRow([emp[0], hashed, emp[2], emp[3], emp[4], emp[5], emp[6]]);
  });

  return "Employees seeded: " + employees.length + " records (50 employees + 1 admin).";
}

// ─────────────────────────────────────────────
// 4. ATTENDANCE  (last 90 days, Mon–Fri only)
// ─────────────────────────────────────────────

/**
 * Shift schedule reference (mirrors the Shifts sheet):
 *   S1: 08:00–17:00
 *   S2: 09:00–18:00
 *   S3: 13:00–22:00
 *
 * Check-in status distribution per employee type:
 *   Director/Manager  → 90% Tepat Waktu, 10% Terlambat
 *   Supervisor/Lead   → 80% Tepat Waktu, 20% Terlambat
 *   Staff/Senior/Jr   → 70% Tepat Waktu, 25% Terlambat, 5% absent (no record)
 *
 * Check-out status distribution:
 *   ~60% Tepat Waktu, ~25% Lembur, ~15% Pulang Awal
 *   (Pulang Awal only possible for Staff/Junior)
 *
 * Absence rate: ~5% of working days for Staff/Junior, ~2% for others.
 */
function seedAttendance(props) {
  const currentYear = new Date().getFullYear();
  const attendanceDbId = props["ATTENDANCE_DB_ID_" + currentYear];
  if (!attendanceDbId) return "Attendance DB for " + currentYear + " not found. Run setupDatabase() first.";

  const ss = SpreadsheetApp.openById(attendanceDbId);
  const sheet = ss.getSheetByName("Attendance_Data");
  if (!sheet) return "Attendance_Data sheet not found.";

  // Clear existing attendance data (keep header)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();

  // Build date range: last 90 calendar days (weekdays only)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 90);

  const workdays = [];
  const d = new Date(startDate);
  while (d <= today) {
    const dow = d.getDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) workdays.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }

  // Employee roster with their shift and "tier" for distribution
  // tier: 0=Director/Manager, 1=Supervisor/Lead, 2=Staff/Senior/Junior
  const roster = [
    { id: "E001", shift: "S2", tier: 0 }, { id: "E002", shift: "S2", tier: 0 },
    { id: "E003", shift: "S2", tier: 0 }, { id: "E004", shift: "S1", tier: 0 },
    { id: "E005", shift: "S2", tier: 0 }, { id: "E006", shift: "S1", tier: 0 },
    { id: "E007", shift: "S1", tier: 1 }, { id: "E008", shift: "S2", tier: 1 },
    { id: "E009", shift: "S3", tier: 1 }, { id: "E010", shift: "S1", tier: 1 },
    { id: "E011", shift: "S2", tier: 1 }, { id: "E012", shift: "S3", tier: 1 },
    { id: "E013", shift: "S1", tier: 1 }, { id: "E014", shift: "S2", tier: 1 },
    { id: "E015", shift: "S3", tier: 1 }, { id: "E016", shift: "S1", tier: 1 },
    { id: "E017", shift: "S2", tier: 1 }, { id: "E018", shift: "S1", tier: 1 },
    { id: "E019", shift: "S1", tier: 2 }, { id: "E020", shift: "S2", tier: 2 },
    { id: "E021", shift: "S3", tier: 2 }, { id: "E022", shift: "S1", tier: 2 },
    { id: "E023", shift: "S2", tier: 2 }, { id: "E024", shift: "S3", tier: 2 },
    { id: "E025", shift: "S1", tier: 2 }, { id: "E026", shift: "S2", tier: 2 },
    { id: "E027", shift: "S1", tier: 2 }, { id: "E028", shift: "S2", tier: 2 },
    { id: "E029", shift: "S3", tier: 2 }, { id: "E030", shift: "S1", tier: 2 },
    { id: "E031", shift: "S2", tier: 2 }, { id: "E032", shift: "S3", tier: 2 },
    { id: "E033", shift: "S1", tier: 2 }, { id: "E034", shift: "S2", tier: 2 },
    { id: "E035", shift: "S3", tier: 2 }, { id: "E036", shift: "S1", tier: 2 },
    { id: "E037", shift: "S2", tier: 2 }, { id: "E038", shift: "S3", tier: 2 },
    { id: "E039", shift: "S1", tier: 2 }, { id: "E040", shift: "S2", tier: 2 },
    { id: "E041", shift: "S3", tier: 2 }, { id: "E042", shift: "S1", tier: 2 },
    { id: "E043", shift: "S2", tier: 2 }, { id: "E044", shift: "S3", tier: 2 },
    { id: "E045", shift: "S1", tier: 2 }, { id: "E046", shift: "S2", tier: 2 },
    { id: "E047", shift: "S3", tier: 2 }, { id: "E048", shift: "S1", tier: 2 },
    { id: "E049", shift: "S2", tier: 2 }, { id: "E050", shift: "S3", tier: 2 },
  ];

  // Shift start/end in minutes from midnight
  const shiftTimes = {
    S1: { start: 8 * 60,  end: 17 * 60 },
    S2: { start: 9 * 60,  end: 18 * 60 },
    S3: { start: 13 * 60, end: 22 * 60 },
  };

  // Absence probability per tier
  const absenceRate = [0.02, 0.03, 0.05];

  // Batch rows for performance
  const rows = [];

  roster.forEach(function(emp) {
    const times = shiftTimes[emp.shift];
    const absentProb = absenceRate[emp.tier];

    workdays.forEach(function(day) {
      // Skip today — no future records
      if (day >= today) return;

      // Random absence
      if (Math.random() < absentProb) return;

      const dateStr = formatDate(day);

      // ── Check-in ──
      let checkInMinutes, checkInStatus;
      const r = Math.random();

      if (emp.tier === 0) {
        // Director/Manager: 90% on-time, 10% late
        if (r < 0.90) {
          checkInMinutes = times.start - randomInt(1, 20); // 1–20 min early
          checkInStatus = "Tepat Waktu";
        } else {
          checkInMinutes = times.start + randomInt(1, 30); // 1–30 min late
          checkInStatus = "Terlambat";
        }
      } else if (emp.tier === 1) {
        // Supervisor/Lead: 80% on-time, 20% late
        if (r < 0.80) {
          checkInMinutes = times.start - randomInt(0, 15);
          checkInStatus = "Tepat Waktu";
        } else {
          checkInMinutes = times.start + randomInt(1, 45);
          checkInStatus = "Terlambat";
        }
      } else {
        // Staff/Junior: 70% on-time, 25% late, 5% very late
        if (r < 0.70) {
          checkInMinutes = times.start - randomInt(0, 10);
          checkInStatus = "Tepat Waktu";
        } else if (r < 0.95) {
          checkInMinutes = times.start + randomInt(1, 60);
          checkInStatus = "Terlambat";
        } else {
          checkInMinutes = times.start + randomInt(61, 120);
          checkInStatus = "Terlambat";
        }
      }

      const checkInStr = minutesToTimeStr(checkInMinutes);

      // ── Check-out ──
      let checkOutMinutes, checkOutStatus;
      const r2 = Math.random();

      if (emp.tier === 0) {
        // Director/Manager: 50% on-time, 45% overtime, 5% early
        if (r2 < 0.50) {
          checkOutMinutes = times.end + randomInt(0, 10);
          checkOutStatus = "Tepat Waktu";
        } else if (r2 < 0.95) {
          checkOutMinutes = times.end + randomInt(31, 120);
          checkOutStatus = "Lembur";
        } else {
          checkOutMinutes = times.end - randomInt(1, 30);
          checkOutStatus = "Pulang Awal";
        }
      } else if (emp.tier === 1) {
        // Supervisor/Lead: 55% on-time, 35% overtime, 10% early
        if (r2 < 0.55) {
          checkOutMinutes = times.end + randomInt(0, 10);
          checkOutStatus = "Tepat Waktu";
        } else if (r2 < 0.90) {
          checkOutMinutes = times.end + randomInt(31, 90);
          checkOutStatus = "Lembur";
        } else {
          checkOutMinutes = times.end - randomInt(1, 45);
          checkOutStatus = "Pulang Awal";
        }
      } else {
        // Staff/Junior: 60% on-time, 25% overtime, 15% early
        if (r2 < 0.60) {
          checkOutMinutes = times.end + randomInt(0, 10);
          checkOutStatus = "Tepat Waktu";
        } else if (r2 < 0.85) {
          checkOutMinutes = times.end + randomInt(31, 90);
          checkOutStatus = "Lembur";
        } else {
          checkOutMinutes = times.end - randomInt(1, 60);
          checkOutStatus = "Pulang Awal";
        }
      }

      const checkOutStr = minutesToTimeStr(checkOutMinutes);

      rows.push([dateStr, emp.id, checkInStr, checkInStatus, checkOutStr, checkOutStatus]);
    });
  });

  // Write in batches of 500 to avoid timeout
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const startRowIndex = sheet.getLastRow() + 1;
    sheet.getRange(startRowIndex, 1, batch.length, 6).setValues(batch);
  }

  return "Attendance seeded: " + rows.length + " records across " + workdays.length + " workdays for " + roster.length + " employees.";
}

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

/** Returns a random integer between min and max (inclusive). */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Formats a Date object as "YYYY-MM-DD". */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + "-" + m + "-" + d;
}

/** Converts total minutes from midnight to "HH:mm:ss" string. */
function minutesToTimeStr(totalMinutes) {
  // Clamp to 00:00–23:59
  totalMinutes = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const s = randomInt(0, 59);
  return String(h).padStart(2, '0') + ":" + String(m).padStart(2, '0') + ":" + String(s).padStart(2, '0');
}
