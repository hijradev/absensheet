# Implementation Plan: Scheduled Monthly Report Email Feature

## Overview

This implementation plan converts the scheduled monthly report email feature design into actionable coding tasks for a Google Apps Script web application. The tasks build incrementally from backend email configuration functions through frontend UI components to complete integration and testing.

## Tasks

- [x] 1. Set up email configuration data model and storage functions
  - Create email settings data structure in Settings.gs
  - Implement getEmailSettings() function to retrieve configuration from PropertiesService
  - Implement saveEmailSettings() function with validation for email format and schedule parameters
  - Add email delivery log data structure and storage functions
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.5, 7.5_

- [ ]* 1.1 Write property test for email format validation
  - **Property 1: Email Format Validation**
  - **Validates: Requirements 1.2, 1.4**

- [ ]* 1.2 Write property test for configuration persistence
  - **Property 2: Configuration Persistence Round-Trip**
  - **Validates: Requirements 1.3, 2.5, 5.4, 7.5**

- [ ] 2. Implement report generation and PDF creation functions
  - [x] 2.1 Create generateMonthlyReportPDF() function that uses existing getReportData
    - Generate PDF from monthly attendance data excluding stat cards
    - Include proper headers, organization name, and month/year labels
    - Handle cases where no attendance data exists for a month
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6_

  - [ ]* 2.2 Write property test for report content completeness
    - **Property 5: Report Content Completeness**
    - **Validates: Requirements 3.2, 3.4, 3.5**

  - [ ]* 2.3 Write property test for report content filtering
    - **Property 6: Report Content Filtering**
    - **Validates: Requirements 3.3**

  - [x] 2.4 Create sendMonthlyReportEmail() function for email composition and delivery
    - Compose email with descriptive subject line including month and year
    - Include explanatory message body about the attachment
    - Attach PDF report and send via MailApp service
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

  - [ ]* 2.5 Write property test for email composition consistency
    - **Property 7: Email Composition Consistency**
    - **Validates: Requirements 4.5, 4.6**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement trigger management and scheduling functions
  - [x] 4.1 Create setupEmailScheduleTrigger() function for time-based trigger creation
    - Create Google Apps Script time-based triggers based on schedule configuration
    - Handle month boundary cases where configured day doesn't exist
    - Store trigger ID for management purposes
    - _Requirements: 2.2, 2.3, 2.4, 2.6, 2.7, 4.1_

  - [ ]* 4.2 Write property test for schedule validation
    - **Property 3: Schedule Validation Completeness**
    - **Validates: Requirements 2.2, 2.6, 2.7**

  - [ ]* 4.3 Write property test for month boundary handling
    - **Property 4: Month Boundary Handling**
    - **Validates: Requirements 2.4**

  - [x] 4.4 Create removeEmailScheduleTrigger() function for trigger cleanup
    - Remove existing triggers when schedule changes or feature is disabled
    - Handle cases where trigger ID is invalid or trigger doesn't exist
    - _Requirements: 5.2, 5.3_

  - [x] 4.5 Create handleScheduledEmailSend() function as trigger execution handler
    - Generate and send monthly report when trigger fires
    - Log delivery attempts with comprehensive error handling
    - _Requirements: 4.1, 4.2, 4.3, 4.7_

- [ ] 5. Implement email delivery logging and error handling
  - [x] 5.1 Create logEmailDelivery() function for delivery tracking
    - Log successful and failed email deliveries with timestamp, recipient, and status
    - Store error details for failed deliveries
    - Use spreadsheet-based logging for persistence
    - _Requirements: 4.7, 7.1, 7.2, 7.3_

  - [ ]* 5.2 Write property test for error logging completeness
    - **Property 8: Error Logging Completeness**
    - **Validates: Requirements 4.7, 7.1, 7.2, 7.3**

  - [x] 5.3 Create getEmailDeliveryLogs() function for log retrieval
    - Retrieve and format recent delivery logs for display
    - Return last 10 delivery attempts with proper formatting
    - _Requirements: 7.4, 7.6_

  - [x] 5.4 Implement comprehensive error handling for email delivery failures
    - Handle invalid recipients, quota exceeded, network failures
    - Implement retry logic with exponential backoff for transient failures
    - Log all error conditions with appropriate detail
    - _Requirements: 4.7_

- [ ] 6. Create manual sending functionality
  - [x] 6.1 Implement sendManualMonthlyReport() function
    - Generate and send current month's report on demand
    - Use same PDF generation and email delivery process as automatic sending
    - Return success/error status for UI feedback
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 6.2 Write property test for manual send independence
    - **Property 10: Manual Send Independence**
    - **Validates: Requirements 6.4, 6.5**

  - [ ]* 6.3 Write unit tests for manual sending functionality
    - Test manual send with various enabled/disabled states
    - Test error handling and success scenarios
    - _Requirements: 6.4, 6.5_

- [x] 7. Checkpoint - Ensure all backend functions pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Extend Settings.js frontend component with email configuration UI
  - [x] 8.1 Add Monthly Report Email section to Settings.js render method
    - Create email configuration form with recipient input and schedule controls
    - Add enable/disable toggle for automatic emails
    - Include manual send button and delivery logs display area
    - _Requirements: 1.1, 2.1, 5.1, 6.1, 7.4_

  - [x] 8.2 Implement loadEmailSettings() method in Settings.js
    - Fetch current email configuration from backend
    - Update UI state with retrieved settings
    - Handle loading states and error conditions
    - _Requirements: 1.3, 5.4_

  - [x] 8.3 Implement handleEmailSettingsSave() method for form submission
    - Validate email format and schedule parameters on frontend
    - Submit configuration to backend with proper error handling
    - Update UI state and show success/error messages
    - _Requirements: 1.2, 1.4, 1.5, 2.2, 2.6, 2.7_

  - [ ]* 8.4 Write property test for UI state consistency
    - **Property 9: UI State Consistency**
    - **Validates: Requirements 5.5**

- [x] 9. Implement manual sending and delivery log display in frontend
  - [x] 9.1 Create handleManualSend() method for immediate report sending
    - Trigger manual report generation and delivery
    - Display loading state during operation
    - Show success or error messages based on result
    - _Requirements: 6.1, 6.4, 6.5_

  - [x] 9.2 Implement loadDeliveryLogs() method for log display
    - Fetch recent delivery logs from backend
    - Format and display logs in UI table
    - Show timestamp, recipient, month/year, and delivery status
    - _Requirements: 7.4, 7.6_

  - [ ]* 9.3 Write property test for log display content completeness
    - **Property 11: Log Display Content Completeness**
    - **Validates: Requirements 7.6**

  - [ ]* 9.4 Write unit tests for frontend email functionality
    - Test form validation and submission
    - Test manual send button functionality
    - Test delivery log display and formatting
    - _Requirements: 1.2, 6.4, 7.6_

- [x] 10. Integrate email configuration with existing Settings component lifecycle
  - [x] 10.1 Update Settings.js loadData() method to include email settings
    - Add email settings loading to existing data loading process
    - Handle email settings loading errors gracefully
    - Maintain existing loading state management
    - _Requirements: 1.3, 5.4_

  - [x] 10.2 Update Settings.js attachEventListeners() method
    - Add event listeners for email configuration form
    - Add event listeners for manual send button and schedule controls
    - Ensure proper cleanup in destroy() method
    - _Requirements: 1.1, 2.1, 6.1_

  - [ ]* 10.3 Write integration tests for Settings component email functionality
    - Test complete email configuration workflow
    - Test integration with existing settings functionality
    - Test error handling and state management
    - _Requirements: 1.1, 2.1, 5.1, 6.1_

- [ ] 11. Final integration and end-to-end testing
  - [x] 11.1 Wire all email functions together in Settings.gs
    - Ensure all new functions are properly integrated
    - Test complete workflow from configuration to delivery
    - Verify trigger creation and execution
    - _Requirements: 4.1, 4.2, 4.3, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ] 11.2 Test email delivery with actual Gmail integration
    - Verify PDF attachment generation and email sending
    - Test with various email providers and attachment sizes
    - Validate email formatting and content
    - _Requirements: 4.2, 4.3, 4.5, 4.6_

  - [ ]* 11.3 Write integration tests for complete email workflow
    - Test end-to-end email configuration and delivery
    - Test trigger creation, execution, and cleanup
    - Test error scenarios and recovery
    - _Requirements: All requirements_

- [ ] 12. Final checkpoint - Ensure all tests pass and feature is complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout development
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Integration tests verify complete workflows and external service integration
- All email functionality integrates with existing Google Apps Script services and authentication