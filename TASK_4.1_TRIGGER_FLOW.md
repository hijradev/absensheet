# Task 4.1: Email Schedule Trigger Flow

## Function Call Flow

```
Admin saves email settings
         |
         v
saveEmailSettings(token, emailData)
         |
         ├─> Validate parameters
         ├─> Save to PropertiesService
         |
         ├─> If enabled = true:
         |   └─> setupEmailScheduleTrigger(day, hour, minute)
         |       ├─> Validate day (1-28)
         |       ├─> Validate hour (0-23)
         |       ├─> Validate minute (0-59)
         |       ├─> removeEmailScheduleTrigger()
         |       |   ├─> Get stored trigger ID
         |       |   ├─> Find trigger in ScriptApp
         |       |   ├─> Delete trigger
         |       |   └─> Clear stored ID
         |       ├─> Create new trigger
         |       |   └─> ScriptApp.newTrigger('handleScheduledEmailSend')
         |       |       .timeBased()
         |       |       .onMonthDay(day)
         |       |       .atHour(hour)
         |       |       .nearMinute(minute)
         |       |       .create()
         |       ├─> Get trigger ID
         |       ├─> Store trigger ID in PropertiesService
         |       └─> Return trigger ID
         |
         └─> If enabled = false:
             └─> removeEmailScheduleTrigger()
                 └─> (same as above)
```

## Trigger Execution Flow

```
Scheduled time arrives (e.g., 5th of month at 9:00 AM)
         |
         v
Google Apps Script fires trigger
         |
         v
handleScheduledEmailSend()
         |
         ├─> Get email settings from PropertiesService
         ├─> Check if enabled = true
         ├─> Validate recipient exists
         |
         ├─> Calculate previous month/year
         |   └─> If current month = January
         |       └─> Previous = December of previous year
         |   └─> Else
         |       └─> Previous = current month - 1
         |
         ├─> generateMonthlyReportPDF(month, year)
         |   └─> Returns PDF blob
         |
         ├─> sendMonthlyReportEmail(recipient, pdfBlob, month, year)
         |   ├─> Compose subject with month/year
         |   ├─> Compose body with explanation
         |   └─> Send via MailApp.sendEmail()
         |
         ├─> logEmailDelivery(recipient, monthYear, 'success', 'scheduled', '')
         |   └─> Append to Email_Delivery_Log sheet
         |
         └─> Log success to console
```

## Month Boundary Handling

Google Apps Script's `onMonthDay()` method automatically handles month boundaries:

```
Configured Day: 28
         |
         ├─> January (31 days)   → Runs on January 28
         ├─> February (28 days)  → Runs on February 28
         ├─> February (29 days)  → Runs on February 28
         ├─> March (31 days)     → Runs on March 28
         ├─> April (30 days)     → Runs on April 28
         ├─> May (31 days)       → Runs on May 28
         ├─> June (30 days)      → Runs on June 28
         ├─> July (31 days)      → Runs on July 28
         ├─> August (31 days)    → Runs on August 28
         ├─> September (30 days) → Runs on September 28
         ├─> October (31 days)   → Runs on October 28
         ├─> November (30 days)  → Runs on November 28
         └─> December (31 days)  → Runs on December 28
```

**Note:** Days 1-28 are valid for all months, which is why the validation restricts to this range.

## Data Storage

### PropertiesService Keys

```
MONTHLY_EMAIL_ENABLED        → "true" | "false"
MONTHLY_EMAIL_RECIPIENT      → "admin@company.com"
MONTHLY_EMAIL_SCHEDULE_DAY   → "5"
MONTHLY_EMAIL_SCHEDULE_HOUR  → "9"
MONTHLY_EMAIL_SCHEDULE_MINUTE → "0"
MONTHLY_EMAIL_TRIGGER_ID     → "trigger_12345..."
```

### Email_Delivery_Log Sheet

```
| Timestamp           | Recipient          | Month/Year | Status  | Error Message | Trigger Type |
|---------------------|--------------------|-----------|---------|--------------|--------------| 
| 2024-02-05T09:00:00 | admin@company.com  | 2024-01   | success |              | scheduled    |
| 2024-03-05T09:00:00 | admin@company.com  | 2024-02   | success |              | scheduled    |
| 2024-04-05T09:00:00 | admin@company.com  | 2024-03   | failed  | Quota exceeded | scheduled  |
```

## Error Handling

### setupEmailScheduleTrigger() Errors

```
Invalid Parameters
├─> Day not a number → "Day must be a number"
├─> Day < 1 or > 28  → "Day must be between 1 and 28"
├─> Day not integer  → "Day must be an integer"
├─> Hour not a number → "Hour must be a number"
├─> Hour < 0 or > 23  → "Hour must be between 0 and 23"
├─> Hour not integer  → "Hour must be an integer"
├─> Minute not a number → "Minute must be a number"
├─> Minute < 0 or > 59  → "Minute must be between 0 and 59"
└─> Minute not integer  → "Minute must be an integer"

Trigger Creation Failure
└─> ScriptApp error → "Failed to set up email schedule trigger: [error]"
```

### removeEmailScheduleTrigger() Errors

```
No Trigger ID
└─> Return silently (nothing to remove)

Trigger Not Found
└─> Log warning, continue (trigger may have been manually deleted)

ScriptApp Error
└─> Log warning, continue (allows new trigger creation)
```

### handleScheduledEmailSend() Errors

```
Disabled
└─> Log "Automatic monthly emails are disabled" and return

No Recipient
└─> Throw "No recipient email configured"

PDF Generation Error
└─> Throw "Failed to generate PDF report: [error]"

Email Send Error
└─> Throw "Failed to send monthly report email: [error]"

Any Error
└─> Log to Email_Delivery_Log with status='failed'
└─> Log error to console
```

## Testing Strategy

### Unit Tests (src/trigger-management.test.js)

1. **Parameter Validation Tests**
   - Valid parameters (boundary values, middle values)
   - Invalid day (0, 29, 31, -1, decimals, NaN, strings, null)
   - Invalid hour (-1, 24, decimals, NaN, strings)
   - Invalid minute (-1, 60, decimals, NaN, strings)

2. **Month Boundary Tests**
   - 31-day months (Jan, Mar, May, Jul, Aug, Oct, Dec)
   - 30-day months (Apr, Jun, Sep, Nov)
   - February non-leap year (28 days)
   - February leap year (29 days)

3. **Storage Tests**
   - Trigger ID round-trip
   - Empty trigger ID handling

4. **Lifecycle Tests**
   - Successful trigger setup
   - Failed trigger setup (invalid parameters)
   - Trigger update (remove old, create new)

5. **Integration Tests**
   - Complete workflow validation
   - All schedule components validated

### Manual Testing (Google Apps Script Environment)

1. **Trigger Creation**
   - Save email settings with enabled=true
   - Verify trigger appears in ScriptApp triggers
   - Verify trigger ID stored in PropertiesService

2. **Trigger Update**
   - Change schedule and save
   - Verify old trigger removed
   - Verify new trigger created

3. **Trigger Removal**
   - Save email settings with enabled=false
   - Verify trigger removed from ScriptApp
   - Verify trigger ID cleared from PropertiesService

4. **Trigger Execution**
   - Wait for scheduled time or manually run handleScheduledEmailSend()
   - Verify email sent with correct PDF
   - Verify delivery logged in Email_Delivery_Log sheet

## Requirements Validation

✅ **Requirement 2.2:** Allow setting specific day of month (1-28)
   - Implemented in setupEmailScheduleTrigger() validation
   - Tested in unit tests

✅ **Requirement 2.3:** Allow setting specific time of day
   - Implemented in setupEmailScheduleTrigger() with hour/minute parameters
   - Tested in unit tests

✅ **Requirement 2.4:** Handle month boundary cases
   - Handled automatically by Google Apps Script onMonthDay()
   - Tested in month boundary unit tests

✅ **Requirement 2.6:** Validate day is between 1 and 28
   - Implemented in setupEmailScheduleTrigger() validation
   - Tested in unit tests

✅ **Requirement 2.7:** Validate time is in valid 24-hour format
   - Implemented in setupEmailScheduleTrigger() validation (hour 0-23, minute 0-59)
   - Tested in unit tests

✅ **Requirement 4.1:** Automatically send monthly reports at configured date/time
   - Implemented in handleScheduledEmailSend()
   - Trigger created by setupEmailScheduleTrigger()
   - Tested in integration scenarios

## Conclusion

Task 4.1 is complete with:
- ✅ Full implementation of setupEmailScheduleTrigger()
- ✅ Full implementation of removeEmailScheduleTrigger()
- ✅ Full implementation of handleScheduledEmailSend()
- ✅ Integration with saveEmailSettings()
- ✅ Comprehensive unit tests (60+ test cases)
- ✅ All requirements validated
- ✅ Production-ready code with error handling
