# Gmail API Setup Guide

## 📧 Complete Step-by-Step Guide to Get Gmail API Credentials

This guide will walk you through setting up Gmail API credentials for your email automation system.

---

## Prerequisites

- A Google account
- 10 minutes of time

---

## Step 1: Go to Google Cloud Console

1. Open your browser and go to: https://console.cloud.google.com/
2. Sign in with your Google account

---

## Step 2: Create a New Project

1. Click on the project dropdown at the top (next to "Google Cloud")
2. Click **"NEW PROJECT"**
3. Enter project details:
   - **Project name**: `Email Automation System` (or any name you prefer)
   - **Organization**: Leave as default (or select if you have one)
4. Click **"CREATE"**
5. Wait for the project to be created (takes a few seconds)
6. Make sure your new project is selected in the dropdown

---

## Step 3: Enable Gmail API

1. In the left sidebar, go to **"APIs & Services"** → **"Library"**
   - Or use direct link: https://console.cloud.google.com/apis/library

2. In the search bar, type: `Gmail API`

3. Click on **"Gmail API"** from the results

4. Click the blue **"ENABLE"** button

5. Wait for it to enable (takes a few seconds)

---

## Step 4: Configure OAuth Consent Screen

Before creating credentials, you need to set up the OAuth consent screen.

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
   - Or use: https://console.cloud.google.com/apis/credentials/consent

2. Choose **"External"** (unless you have a Google Workspace)
   - External allows anyone with a Google account to use your app
   - Internal is only for Google Workspace organizations

3. Click **"CREATE"**

4. Fill in the required fields:

   **App information:**
   - **App name**: `Email Automation System`
   - **User support email**: Your email address
   - **App logo**: (Optional) Skip for now

   **App domain:** (Optional for testing)
   - Leave blank for now

   **Developer contact information:**
   - **Email addresses**: Your email address

5. Click **"SAVE AND CONTINUE"**

6. **Scopes page:**
   - Click **"ADD OR REMOVE SCOPES"**
   - Search for and select these scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.modify`
     - `https://www.googleapis.com/auth/gmail.labels`
     - `https://www.googleapis.com/auth/userinfo.email`
   - Click **"UPDATE"**
   - Click **"SAVE AND CONTINUE"**

7. **Test users page:**
   - Click **"ADD USERS"**
   - Add your Gmail address (the one you want to monitor)
   - Click **"ADD"**
   - Click **"SAVE AND CONTINUE"**

8. **Summary page:**
   - Review your settings
   - Click **"BACK TO DASHBOARD"**

---

## Step 5: Create OAuth 2.0 Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
   - Or use: https://console.cloud.google.com/apis/credentials

2. Click **"+ CREATE CREDENTIALS"** at the top

3. Select **"OAuth client ID"**

4. If prompted to configure consent screen, you've already done it in Step 4

5. Fill in the application type and details:
   - **Application type**: Select **"Web application"**
   - **Name**: `Email Automation OAuth Client`

6. **Authorized JavaScript origins:** (Optional)
   - Click **"+ ADD URI"**
   - Add: `http://localhost:3000`
   - For production, add: `https://yourdomain.com`

7. **Authorized redirect URIs:** (IMPORTANT!)
   - Click **"+ ADD URI"**
   - Add EXACTLY: `http://localhost:3001/api/auth/gmail/callback`
   - For production, also add: `https://yourdomain.com/api/auth/gmail/callback`

8. Click **"CREATE"**

---

## Step 6: Get Your Credentials

1. A popup will appear with your credentials:
   - **Client ID**: `123456789-xxxxx.apps.googleusercontent.com`
   - **Client Secret**: `GOCSPX-xxxxx`

2. **IMPORTANT**: Copy both values immediately!

3. You can also download the JSON file for reference

4. Click **"OK"**

---

## Step 7: Configure Your Application

1. Open your `.env` file in the `Gmail-Automation` folder

2. Update these lines with your credentials:

```env
GMAIL_CLIENT_ID=YOUR_CLIENT_ID_HERE.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GMAIL_REDIRECT_URI=http://localhost:3001/api/auth/gmail/callback
```

Example:
```env
GMAIL_CLIENT_ID=123456789-abcdefgh.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xyz123abc
GMAIL_REDIRECT_URI=http://localhost:3001/api/auth/gmail/callback
```

3. Also update the JWT_SECRET (change to any random string):
```env
JWT_SECRET=your-super-secret-random-string-minimum-32-characters
```

4. Save the file

---

## Step 8: Test Your Setup

1. Start your application:
   ```bash
   docker-compose up -d
   ```

2. Open http://localhost:3000 in your browser

3. Register a new account

4. Click "Connect Gmail" button

5. You should be redirected to Google's OAuth page

6. Select your Gmail account

7. You might see a warning "Google hasn't verified this app"
   - Click **"Advanced"**
   - Click **"Go to Email Automation System (unsafe)"**
   - This is normal for apps in development/testing

8. Review the permissions and click **"Allow"**

9. You should be redirected back to your app with the account connected!

---

## Troubleshooting

### Error: "Redirect URI mismatch"

**Problem**: The redirect URI in your request doesn't match the one configured in Google Cloud Console.

**Solution**:
1. Go back to Google Cloud Console → Credentials
2. Click on your OAuth client
3. Check "Authorized redirect URIs"
4. Make sure it EXACTLY matches: `http://localhost:3001/api/auth/gmail/callback`
5. No trailing slashes, correct port number, http (not https) for localhost

### Error: "Access blocked: Authorization Error"

**Problem**: Your OAuth consent screen isn't set up correctly.

**Solution**:
1. Go to OAuth consent screen
2. Make sure you added yourself as a test user
3. Make sure you added the required scopes

### Error: "Invalid client"

**Problem**: Your Client ID or Client Secret is incorrect.

**Solution**:
1. Go back to Credentials page
2. Click on your OAuth client
3. Copy the Client ID and Client Secret again
4. Update your `.env` file
5. Restart your application: `docker-compose restart`

### Can't find credentials later

If you need to view your credentials again:
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Click on your OAuth client name
3. View Client ID and Client Secret

---

## Production Deployment

When deploying to production:

1. Update the redirect URI in Google Cloud Console:
   ```
   https://yourdomain.com/api/auth/gmail/callback
   ```

2. Add your production domain to authorized origins:
   ```
   https://yourdomain.com
   ```

3. Update your `.env` with production redirect URI:
   ```env
   GMAIL_REDIRECT_URI=https://yourdomain.com/api/auth/gmail/callback
   ```

4. Consider publishing your OAuth consent screen:
   - Go to OAuth consent screen
   - Click "PUBLISH APP"
   - This removes the warning for users

---

## Security Notes

1. **Never commit credentials to Git**
   - `.env` file is in `.gitignore`
   - Never share your Client Secret publicly

2. **Use different credentials for development and production**
   - Create separate OAuth clients for each environment

3. **Rotate credentials regularly**
   - Delete old credentials from Google Cloud Console
   - Create new ones periodically

4. **Monitor usage**
   - Check Google Cloud Console for API usage
   - Set up alerts for unusual activity

---

## Quota and Limits

Free tier Gmail API limits:
- **1 billion quota units per day**
- Most operations use 5-25 quota units
- You can monitor thousands of emails per day easily

To check your usage:
1. Go to Google Cloud Console
2. Navigate to "APIs & Services" → "Dashboard"
3. Click on "Gmail API"
4. View quotas and usage

---

## Additional Resources

- Gmail API Documentation: https://developers.google.com/gmail/api
- OAuth 2.0 Guide: https://developers.google.com/identity/protocols/oauth2
- Scopes Reference: https://developers.google.com/gmail/api/auth/scopes
- API Quotas: https://developers.google.com/gmail/api/reference/quota

---

## ✅ You're Done!

Once you've completed these steps:
- ✅ Gmail API is enabled
- ✅ OAuth consent screen is configured
- ✅ Credentials are created
- ✅ `.env` file is updated
- ✅ Application can connect to Gmail

**Your email automation system is ready to monitor your inbox!**

---

## Quick Reference

**Required Scopes:**
```
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/gmail.labels
https://www.googleapis.com/auth/userinfo.email
```

**Redirect URI for Development:**
```
http://localhost:3001/api/auth/gmail/callback
```

**Redirect URI for Production:**
```
https://yourdomain.com/api/auth/gmail/callback
```
