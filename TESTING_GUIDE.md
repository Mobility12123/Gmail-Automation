# Email Order Automation - Testing Guide

This guide explains how to test the complete order confirmation workflow end-to-end.

## Workflow Overview

1. **Email Arrives**: Customer order email arrives at store owner's Gmail
2. **Rule Matches**: Bot detects the email matches a rule (e.g., subject contains "order")
3. **Action Executes**: Bot processes the email (accepts it and/or sends confirmation)
4. **Confirmation Sent**: Customer receives an automated confirmation email

## Pre-Test Setup

### 1. System Requirements

Ensure both backend and frontend are running:

```bash
# Terminal 1 - Backend (port 3002)
cd backend
npm run dev

# Terminal 2 - Frontend (port 3001)
cd frontend
npm run dev
```

### 2. Email Account Configuration

1. Navigate to **Email Accounts** page (http://localhost:3001)
2. Click **Connect Gmail**
3. Sign in with your test Gmail account
4. Grant permissions to access emails
5. Verify the account appears in the list with "Active" badge

**Note**: When you connect an email account, a default rule is automatically created:
- Name: "Auto-accept orders from [your-email@example.com]"
- Condition: Subject contains "order"
- Action: ACCEPT

## Testing Scenario 1: Basic Order Acceptance

### Setup

1. Keep your connected Gmail account (no additional setup needed)
2. The default rule should already be active

### Test Steps

1. **Send a test email to your Gmail account** with:
   - Subject: "New Order from Customer"
   - Body: "Order ID: 12345, Amount: $99.99"

2. **Wait 30 seconds** for the system to process

3. **Check Dashboard** (http://localhost:3001):
   - "Orders Accepted" count should increase
   - Email should appear in "Recent Emails" table
   - Status should show "ACCEPTED"

### Success Criteria

- ✅ Email appears in Dashboard
- ✅ Status shows "ACCEPTED"
- ✅ Rule statistics update (match count increases)

---

## Testing Scenario 2: Order Confirmation Email (SEND_CONFIRMATION)

### Setup

1. Go to **Rules** page (http://localhost:3001/rules)
2. Click **Create Rule**
3. Fill in the form:

   **Basic Info:**
   - Rule Name: "Order Confirmation"
   - Description: "Send automatic confirmation to customers"
   - Email Account: Select your connected Gmail

   **Match Conditions:**
   - Subject Contains: `order`
   - From Email: Leave empty (match all)
   - Body Contains: Leave empty

   **Action & Priority:**
   - Action: **Select "Send Confirmation Email"**
   - Priority: 1
   - ✅ Activate rule immediately

   **Confirmation Email Template:**
   - Email Subject: `Order Confirmation - Thank You!`
   - Email Body:
     ```
     Dear Customer,

     Thank you for your order! We have received it and are processing it right away.

     Your order has been confirmed. You will receive shipping updates via email.

     If you have any questions, please reply to this email.

     Best regards,
     The Store Team
     ```

4. Click **Create Rule**

### Test Steps

1. **Send a test email to your Gmail account** with:
   - Subject: "New Store Order - Order #5678"
   - Body: "Customer John Doe ordered 2 items"

2. **Wait 30 seconds** for the bot to process

3. **Check Gmail Inbox**:
   - You should see the original order email
   - **Look for a reply** from your account (sent by the bot)
   - The reply should have:
     - Subject line matching: "Order Confirmation - Thank You!"
     - Body matching your template
     - In the same email thread as the original order

4. **Check Dashboard**:
   - Email should appear in recent list
   - Status should show "ACCEPTED"
   - Rule statistics should update

### Success Criteria

- ✅ Confirmation email is sent back via Gmail
- ✅ Reply is in the same thread as the original email
- ✅ Confirmation has correct subject and body
- ✅ Dashboard shows email as processed
- ✅ Rule match count increases

---

## Testing Scenario 3: Multiple Rules with Priority

### Setup

1. Go to **Rules** page
2. Create two rules:

   **Rule 1: Priority 1 - High Priority Orders**
   - Name: "VIP Orders"
   - Match: Subject contains "VIP"
   - Action: SEND_CONFIRMATION
   - Subject: "VIP Order Confirmed"
   - Body: "Thank you VIP customer! Your order gets priority processing."

   **Rule 2: Priority 2 - Regular Orders**
   - Name: "Regular Orders"
   - Match: Subject contains "order"
   - Action: SEND_CONFIRMATION
   - Subject: "Order Received"
   - Body: "Your order has been received."

### Test Steps

1. **Test VIP Rule**: Send email with subject "VIP Order from Premium Customer"
   - Should match Rule 1 (higher priority)
   - Should send VIP confirmation

2. **Test Regular Rule**: Send email with subject "Order from Regular Customer"
   - Should match Rule 2
   - Should send regular confirmation

### Success Criteria

- ✅ VIP email gets VIP confirmation (not regular)
- ✅ Regular email gets regular confirmation
- ✅ Priority ordering works correctly

---

## Testing Scenario 4: Rule Editing & Toggling

### Test Steps

1. Go to **Rules** page
2. Find your "Order Confirmation" rule
3. Click **Edit** (pencil icon)
4. Change the confirmation subject to: "URGENT: Your order was received"
5. Click **Update Rule**
6. Send a test email
7. Verify the updated subject in the reply

**Toggle Test:**
1. Click **Power** icon on a rule
2. Rule should show "Inactive" badge
3. Send a test email that matches this rule
4. Email should NOT be processed (status remains PENDING)
5. Click **Power** again to reactivate
6. Send another test email
7. Email should be processed again

### Success Criteria

- ✅ Rule updates are saved
- ✅ New confirmation uses updated text
- ✅ Toggling deactivates/reactivates rules
- ✅ Inactive rules don't process emails

---

## Testing Scenario 5: Activity Tracking

### Test Steps

1. Process several test emails (5-10 different ones)
2. Go to **Activity** page (http://localhost:3001/activity)
3. Verify all emails appear in the table with:
   - From address
   - Subject line
   - Account used
   - Rule that matched (or "No rule")
   - Status (ACCEPTED, PENDING, etc.)
   - Received and processed times

### Success Criteria

- ✅ All processed emails appear in Activity log
- ✅ Information is accurate (from, subject, rule, status)
- ✅ Timestamps are correct
- ✅ Table is sortable and responsive

---

## Troubleshooting

### Issue: Email not being processed
- **Check 1**: Is the rule active? (Look for "Active" badge)
- **Check 2**: Does the rule conditions match your email?
  - Try updating rule with more generic conditions
- **Check 3**: Check browser console for errors (F12)
- **Check 4**: Check terminal where backend is running for error logs

### Issue: Confirmation email not sent
- **Check 1**: Is action set to "SEND_CONFIRMATION"?
- **Check 2**: Are subject and body filled in?
- **Check 3**: Check Gmail connection is active
- **Check 4**: Check backend logs: `npm run dev` terminal output

### Issue: Email appears but status is PENDING
- Means no rule matched it
- Verify your rule conditions are correct
- Try a simpler condition like just "order" in subject

### Issue: Duplicate confirmations sent
- Multiple rules might be matching the same email
- Check rule conditions for overlap
- Adjust conditions to be more specific
- Or disable the extra rules

---

## Dashboard Metrics Explained

After testing, you should see:

- **Email Accounts**: Number of connected Gmail accounts
- **Active Rules**: Number of enabled rules
- **Orders Accepted**: Emails processed successfully (status = ACCEPTED)
- **Failed**: Emails that had errors processing
- **Success Rate**: Percentage of successful processing
- **Last 24h**: Emails processed in the last day
- **Recent Emails**: Table of last 5 processed emails
- **Top Rules**: Your best performing rules

---

## API Testing (Advanced)

For direct API testing, use curl or Postman:

### Create a Rule
```bash
curl -X POST http://localhost:3002/api/rules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Test Rule",
    "emailAccountId": "ACCOUNT_ID",
    "action": "SEND_CONFIRMATION",
    "confirmationSubject": "Order Confirmed",
    "confirmationBody": "Thanks for ordering!",
    "priority": 1,
    "isActive": true,
    "conditions": {
      "matchSubject": "order"
    }
  }'
```

### Get All Rules
```bash
curl http://localhost:3002/api/rules \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Next Steps After Testing

Once you've verified all scenarios:

1. **Deploy to Production**: Same system works with real Shopify/WooCommerce webhooks
2. **Customize Templates**: Update confirmation emails to match your brand
3. **Add More Rules**: Create rules for different order types (cancellations, returns, etc.)
4. **Monitor Activity**: Check Activity page regularly to ensure emails are being processed
5. **Optimize**: Adjust rule priorities and conditions based on real usage

---

## Key Features Working

✅ **Email Processing**: Incoming emails detected and processed automatically
✅ **Rule Matching**: Emails matched against conditions (subject, from, body)
✅ **Multiple Rules**: Different confirmations for different email types
✅ **Priority System**: Rules execute in priority order
✅ **Email Threading**: Confirmations stay in the same conversation thread
✅ **Activity Tracking**: All emails logged with timestamps and status
✅ **Dashboard**: Real-time statistics and metrics
✅ **Dark Mode**: Full dark mode support throughout
✅ **Professional UI**: Clean, modern, responsive interface
