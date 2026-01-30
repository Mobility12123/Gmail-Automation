# API Documentation

## Base URL

- Development: `http://localhost:3001`
- Production: `https://api.yourdomain.com`

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Authentication Endpoints

### Register User

```http
POST /api/auth/register
```

**Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Login

```http
POST /api/auth/login
```

**Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Get Gmail OAuth URL

```http
GET /api/auth/gmail/url
```

**Response:**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

### Verify Token

```http
GET /api/auth/verify
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

---

## Email Accounts

### Get All Email Accounts

```http
GET /api/email-accounts
Authorization: Bearer <token>
```

**Response:**
```json
{
  "accounts": [
    {
      "id": "uuid",
      "email": "myemail@gmail.com",
      "provider": "gmail",
      "isActive": true,
      "lastChecked": "2026-01-29T10:30:00Z",
      "createdAt": "2026-01-20T08:00:00Z"
    }
  ]
}
```

### Connect Email Account

```http
POST /api/email-accounts
Authorization: Bearer <token>
```

**Body:**
```json
{
  "email": "myemail@gmail.com",
  "accessToken": "ya29.a0...",
  "refreshToken": "1//...",
  "expiresIn": 3600
}
```

**Response:**
```json
{
  "account": {
    "id": "uuid",
    "email": "myemail@gmail.com",
    "provider": "gmail",
    "isActive": true,
    "createdAt": "2026-01-29T10:30:00Z"
  }
}
```

### Update Email Account

```http
PATCH /api/email-accounts/:id
Authorization: Bearer <token>
```

**Body:**
```json
{
  "isActive": false
}
```

### Delete Email Account

```http
DELETE /api/email-accounts/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Email account deleted successfully"
}
```

### Test Email Account

```http
POST /api/email-accounts/:id/test
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "messageCount": 10,
  "lastChecked": "2026-01-29T10:30:00Z"
}
```

---

## Rules

### Get All Rules

```http
GET /api/rules?emailAccountId=<optional>
Authorization: Bearer <token>
```

**Response:**
```json
{
  "rules": [
    {
      "id": "uuid",
      "name": "Accept Instacart Orders",
      "description": "Automatically accept all Instacart batch offers",
      "emailAccountId": "uuid",
      "isActive": true,
      "priority": 10,
      "conditions": [
        {
          "field": "from",
          "operator": "CONTAINS",
          "value": "instacart.com"
        },
        {
          "field": "subject",
          "operator": "CONTAINS",
          "value": "New Batch Available"
        }
      ],
      "logic": "AND",
      "autoAccept": true,
      "markAsRead": true,
      "matchCount": 45,
      "successCount": 42,
      "failureCount": 3,
      "lastMatched": "2026-01-29T10:25:00Z",
      "emailAccount": {
        "email": "myemail@gmail.com"
      }
    }
  ]
}
```

### Create Rule

```http
POST /api/rules
Authorization: Bearer <token>
```

**Body:**
```json
{
  "emailAccountId": "uuid",
  "name": "Accept Instacart Orders",
  "description": "Automatically accept all Instacart batch offers",
  "conditions": [
    {
      "field": "from",
      "operator": "CONTAINS",
      "value": "instacart.com"
    },
    {
      "field": "subject",
      "operator": "CONTAINS",
      "value": "batch"
    }
  ],
  "logic": "AND",
  "autoAccept": true,
  "markAsRead": true,
  "priority": 10,
  "isActive": true
}
```

**Available Operators:**
- `EQUALS`: Exact match
- `NOT_EQUALS`: Not equal
- `CONTAINS`: Contains substring
- `NOT_CONTAINS`: Does not contain
- `STARTS_WITH`: Starts with
- `ENDS_WITH`: Ends with
- `REGEX`: Regular expression match

**Available Fields:**
- `from`: Sender email
- `to`: Recipient email(s)
- `subject`: Email subject
- `body`: Email body
- `label`: Gmail labels

**Logic:**
- `AND`: All conditions must match
- `OR`: At least one condition must match

### Update Rule

```http
PATCH /api/rules/:id
Authorization: Bearer <token>
```

**Body:** (all fields optional)
```json
{
  "name": "Updated Rule Name",
  "isActive": false,
  "priority": 5
}
```

### Delete Rule

```http
DELETE /api/rules/:id
Authorization: Bearer <token>
```

### Test Rule

```http
POST /api/rules/:id/test
Authorization: Bearer <token>
```

**Body:**
```json
{
  "sampleEmail": {
    "from": "batches@instacart.com",
    "to": ["myemail@gmail.com"],
    "subject": "New Batch Available - $45",
    "body": "You have a new batch...",
    "labels": ["INBOX"]
  }
}
```

**Response:**
```json
{
  "matches": true,
  "rule": {
    "id": "uuid",
    "name": "Accept Instacart Orders",
    "conditions": [...],
    "logic": "AND"
  }
}
```

### Get Rule Statistics

```http
GET /api/rules/:id/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "stats": {
    "matchCount": 45,
    "successCount": 42,
    "failureCount": 3,
    "totalProcessed": 45,
    "accepted": 42,
    "failed": 3,
    "successRate": 93.33,
    "lastMatched": "2026-01-29T10:25:00Z"
  }
}
```

---

## Activity

### Get Activity Logs

```http
GET /api/activity?emailAccountId=<optional>&type=<optional>&limit=50&offset=0
Authorization: Bearer <token>
```

**Activity Types:**
- `EMAIL_RECEIVED`
- `EMAIL_PROCESSED`
- `ORDER_ACCEPTED`
- `ORDER_FAILED`
- `RULE_MATCHED`
- `RULE_SKIPPED`
- `ACCOUNT_CONNECTED`
- `ACCOUNT_DISCONNECTED`
- `ERROR`

**Response:**
```json
{
  "activities": [
    {
      "id": "uuid",
      "type": "ORDER_ACCEPTED",
      "title": "Order accepted",
      "description": "Successfully accepted order from batches@instacart.com",
      "createdAt": "2026-01-29T10:30:00Z",
      "emailAccount": {
        "email": "myemail@gmail.com"
      },
      "processedEmail": {
        "subject": "New Batch Available",
        "from": "batches@instacart.com",
        "status": "ACCEPTED"
      }
    }
  ],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

### Get Recent Activity

```http
GET /api/activity/recent
Authorization: Bearer <token>
```

Returns activity from last 24 hours with summary.

### Get Processed Emails

```http
GET /api/activity/emails?emailAccountId=<optional>&status=<optional>&limit=50&offset=0
Authorization: Bearer <token>
```

**Status Values:**
- `PENDING`: Waiting to be processed
- `PROCESSING`: Currently processing
- `ACCEPTED`: Successfully accepted
- `FAILED`: Failed to accept
- `SKIPPED`: Skipped (no matching rule or no accept link)
- `DUPLICATE`: Already processed

**Response:**
```json
{
  "emails": [
    {
      "id": "uuid",
      "messageId": "gmail-message-id",
      "subject": "New Batch Available - $45",
      "from": "batches@instacart.com",
      "to": ["myemail@gmail.com"],
      "receivedAt": "2026-01-29T10:20:00Z",
      "processedAt": "2026-01-29T10:20:05Z",
      "acceptedAt": "2026-01-29T10:20:08Z",
      "status": "ACCEPTED",
      "bodyPreview": "You have a new batch available...",
      "acceptLink": "https://instacart.com/accept/12345",
      "retryCount": 0,
      "emailAccount": {
        "email": "myemail@gmail.com"
      },
      "rule": {
        "name": "Accept Instacart Orders"
      }
    }
  ],
  "total": 200,
  "limit": 50,
  "offset": 0
}
```

### Get Single Processed Email

```http
GET /api/activity/emails/:id
Authorization: Bearer <token>
```

---

## Statistics

### Get Dashboard Statistics

```http
GET /api/stats/dashboard
Authorization: Bearer <token>
```

**Response:**
```json
{
  "overview": {
    "emailAccounts": 2,
    "activeRules": 5,
    "totalProcessed": 450,
    "accepted": 420,
    "failed": 15,
    "successRate": "93.33",
    "last24h": 45
  },
  "statusBreakdown": {
    "ACCEPTED": 420,
    "FAILED": 15,
    "SKIPPED": 10,
    "PENDING": 5
  },
  "dailyStats": [
    {
      "date": "2026-01-23",
      "count": 62
    },
    {
      "date": "2026-01-24",
      "count": 58
    }
  ],
  "recentEmails": [...],
  "topRules": [
    {
      "id": "uuid",
      "name": "Accept Instacart Orders",
      "matchCount": 120,
      "successCount": 115,
      "failureCount": 5
    }
  ],
  "systemHealth": [
    {
      "serviceName": "email-worker",
      "isHealthy": true,
      "lastCheck": "2026-01-29T10:30:00Z"
    }
  ]
}
```

### Get Email Account Statistics

```http
GET /api/stats/email-accounts/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "accountId": "uuid",
  "email": "myemail@gmail.com",
  "stats": {
    "totalProcessed": 225,
    "accepted": 210,
    "failed": 8,
    "pending": 2,
    "successRate": "93.33"
  },
  "hourlyStats": [
    {
      "hour": 10,
      "count": 5
    },
    {
      "hour": 11,
      "count": 8
    }
  ],
  "lastChecked": "2026-01-29T10:30:00Z"
}
```

---

## WebSocket Events

Connect to WebSocket at: `ws://localhost:3001` (or your backend URL)

**Authentication:**
```javascript
io.connect(url, {
  auth: { token: 'your-jwt-token' }
});
```

**Events (Server → Client):**

- `email:matched` - New email matched a rule
  ```json
  {
    "emailAccountId": "uuid",
    "processedEmailId": "uuid",
    "rule": { "id": "uuid", "name": "Rule Name" },
    "subject": "Email Subject",
    "from": "sender@example.com"
  }
  ```

- `order:processing` - Order acceptance started
- `order:accepted` - Order accepted successfully
- `order:failed` - Order acceptance failed

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

**Common Error Codes:**
- `BAD_REQUEST` - Invalid input (400)
- `UNAUTHORIZED` - Not authenticated (401)
- `FORBIDDEN` - Not authorized (403)
- `NOT_FOUND` - Resource not found (404)
- `CONFLICT` - Resource already exists (409)
- `INTERNAL_ERROR` - Server error (500)

---

## Rate Limiting

- Default: 100 requests per 15 minutes per IP
- Authenticated: 1000 requests per 15 minutes per user

Exceeded rate limit returns:
```json
{
  "error": {
    "message": "Too many requests",
    "code": "RATE_LIMIT_EXCEEDED"
  }
}
```
