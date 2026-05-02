# Task 5.4: Manual Testing Guide for Error Handling

## Overview

This guide provides step-by-step instructions for manually testing the comprehensive error handling implementation for email delivery failures.

## Prerequisites

- Admin access to the Google Apps Script attendance system
- Access to the Settings page
- Ability to modify Script Properties (for testing purposes)

## Test Scenarios

### Test 1: Invalid Email Format

**Purpose**: Verify that invalid email addresses are rejected and automatic sending is disabled.

**Steps**:
1. Navigate to Settings > Monthly Report Email section
2. Enable automatic emails
3. Enter an invalid email address (e.g., "notanemail", "missing@domain", "@nodomain.com")
4. Save the settings
5. Trigger a manual send or wait for scheduled send

**Expected Results**:
- Error message: "Invalid email format - automatic sending has been disabled"
- `MONTHLY_EMAIL_ENABLED` property is set to `false`
- Error is logged in Email_Delivery_Log sheet with status "failed"
- Automatic sending toggle is disabled in UI

**Verification**:
```javascript
// Check Script Properties
var props = PropertiesService.getScriptProperties();
Logger.log(props.getProperty('MONTHLY_EMAIL_ENABLED')); // Should be "false"
```

---

### Test 2: Attachment Size Limit

**Purpose**: Verify that attachments larger than 25MB are rejected.

**Steps**:
1. Modify `generateMonthlyReportPDF()` to create a large test PDF (for testing only)
2. Configure valid email settings
3. Trigger a manual send

**Expected Results**:
- Error message: "Attachment size (XXmb) exceeds Gmail limit of 25MB"
- Error is logged with size details
- Automatic sending remains enabled

**Note**: This test requires code modification and should be done in a development environment.

---

### Test 3: Quota Exceeded

**Purpose**: Verify that quota exceeded errors are detected and logged with retry timestamp.

**Steps**:
1. Send multiple emails rapidly to trigger Gmail's daily quota limit
2. Attempt to send monthly report after quota is exceeded

**Expected Results**:
- Error message includes: "Email quota exceeded - retry scheduled for [timestamp]"
- Error is logged with retry timestamp
- Automatic sending remains enabled
- Next day, automatic retry should succeed

**Verification**:
```javascript
// Check Email_Delivery_Log sheet
// Look for entries with error message containing "quota exceeded" and retry timestamp
```

---

### Test 4: Network Failure with Retry

**Purpose**: Verify that transient network errors trigger retry logic with exponential backoff.

**Steps**:
1. Simulate network failure by temporarily disconnecting internet (difficult to test in production)
2. Alternative: Modify `MailApp.sendEmail` to throw a transient error for testing

**Test Code** (for development environment):
```javascript
// Temporarily add to sendMonthlyReportEmail for testing
var testRetryCount = 0;
if (testRetryCount < 2) {
  testRetryCount++;
  throw new Error('Network timeout - please try again');
}
```

**Expected Results**:
- First attempt fails with network error
- System waits 1 second (2^0)
- Second attempt fails
- System waits 2 seconds (2^1)
- Third attempt succeeds
- Success is logged in Email_Delivery_Log

**Console Output**:
```
Transient error detected (attempt 1/3). Retrying in 1 seconds...
Transient error detected (attempt 2/3). Retrying in 2 seconds...
Successfully sent scheduled monthly report for 2024-01
```

---

### Test 5: Maximum Retries Exhausted

**Purpose**: Verify that after 3 failed retries, the system logs the failure and stops.

**Test Code** (for development environment):
```javascript
// Temporarily modify MailApp.sendEmail to always fail with transient error
MailApp.sendEmail = function() {
  throw new Error('Network timeout - please try again');
};
```

**Expected Results**:
- System attempts 4 times total (initial + 3 retries)
- Exponential backoff delays: 1s, 2s, 4s
- Final error message: "Failed to send monthly report email after 3 retries: Network timeout - please try again"
- Error is logged in Email_Delivery_Log
- Automatic sending remains enabled

---

### Test 6: PDF Generation Failure

**Purpose**: Verify that PDF generation errors are caught and logged separately.

**Steps**:
1. Temporarily remove access to the attendance database
2. Trigger a scheduled or manual send

**Expected Results**:
- Error message: "PDF generation failed: [specific error]"
- Error is logged with "PDF generation failed" prefix
- Email sending is not attempted
- Automatic sending remains enabled

---

### Test 7: Non-Transient Error (No Retry)

**Purpose**: Verify that permanent errors do not trigger retry logic.

**Test Code** (for development environment):
```javascript
// Temporarily modify to throw non-transient error
throw new Error('Invalid attachment format');
```

**Expected Results**:
- System attempts only once (no retries)
- Error message: "Failed to send monthly report email: Invalid attachment format"
- No exponential backoff delays
- Error is logged immediately

---

### Test 8: Successful Delivery After Retry

**Purpose**: Verify that successful delivery after retries is logged correctly.

**Test Code** (for development environment):
```javascript
// Temporarily modify to fail twice then succeed
var attemptCount = 0;
var originalSendEmail = MailApp.sendEmail;
MailApp.sendEmail = function(options) {
  attemptCount++;
  if (attemptCount < 3) {
    throw new Error('Network timeout - please try again');
  }
  return originalSendEmail(options);
};
```

**Expected Results**:
- System retries twice with exponential backoff
- Third attempt succeeds
- Success is logged in Email_Delivery_Log with status "success"
- No error message in log entry

---

## Verification Checklist

After running tests, verify the following:

### Script Properties
```javascript
var props = PropertiesService.getScriptProperties();
Logger.log('Enabled: ' + props.getProperty('MONTHLY_EMAIL_ENABLED'));
Logger.log('Recipient: ' + props.getProperty('MONTHLY_EMAIL_RECIPIENT'));
Logger.log('Trigger ID: ' + props.getProperty('MONTHLY_EMAIL_TRIGGER_ID'));
```

### Email Delivery Logs
```javascript
// Check Email_Delivery_Log sheet
var ss = SpreadsheetApp.openById(MASTER_DB_ID);
var logSheet = ss.getSheetByName('Email_Delivery_Log');
var data = logSheet.getDataRange().getValues();

// Verify log entries contain:
// - Timestamp
// - Recipient email
// - Month/Year
// - Status (success/failed)
// - Error message (if failed)
// - Trigger type (scheduled/manual)
```

### Console Logs
Check Apps Script execution logs for:
- Retry attempt messages
- Exponential backoff delays
- Success/failure messages
- Error details

---

## Production Testing Recommendations

For production environments, use these safer testing approaches:

1. **Invalid Email Test**: Use a test email address that's intentionally invalid
2. **Quota Test**: Monitor natural quota limits rather than forcing them
3. **Network Test**: Test during scheduled maintenance windows
4. **PDF Test**: Use a test database with controlled data

---

## Rollback Procedure

If issues are discovered during testing:

1. Disable automatic emails:
   ```javascript
   PropertiesService.getScriptProperties().setProperty('MONTHLY_EMAIL_ENABLED', 'false');
   ```

2. Remove the trigger:
   ```javascript
   removeEmailScheduleTrigger();
   ```

3. Review Email_Delivery_Log for error patterns

4. Fix issues and re-test in development environment

---

## Success Criteria

The implementation is considered successful when:

- ✅ Invalid email addresses are rejected and automatic sending is disabled
- ✅ Large attachments (>25MB) are rejected with clear error messages
- ✅ Quota exceeded errors include retry timestamps
- ✅ Transient network errors trigger up to 3 retries with exponential backoff
- ✅ Non-transient errors do not trigger retries
- ✅ PDF generation errors are caught and logged separately
- ✅ All errors are logged in Email_Delivery_Log with appropriate detail
- ✅ Successful deliveries after retries are logged correctly
- ✅ System remains stable and doesn't crash on errors

---

## Troubleshooting

### Issue: Retries not working
**Solution**: Check console logs for "Transient error detected" messages. Verify error message contains transient keywords.

### Issue: Automatic sending not disabled for invalid email
**Solution**: Verify email validation regex is working. Check Script Properties for MONTHLY_EMAIL_ENABLED value.

### Issue: Errors not logged
**Solution**: Verify Email_Delivery_Log sheet exists and has correct headers. Check logEmailDelivery() function.

### Issue: Exponential backoff not working
**Solution**: Check Utilities.sleep() calls in console logs. Verify Math.pow(2, retryCount) calculation.

---

## Conclusion

This manual testing guide covers all error handling scenarios implemented in Task 5.4. Follow these tests to verify that the comprehensive error handling works as expected in your environment.
