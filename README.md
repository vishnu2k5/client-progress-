# Client Progress Backend API

Complete frontend integration guide for all routes, validation, auth rules, progress logic, and background notifications.

This README is based on the current backend implementation.

## 1) Server Basics

Base URL (local):

```text
http://localhost:3000
```

Health route:

- GET /
- Response:

```json
{ "message": "Welcome to the API" }
```

Route mounting style:

- Routes are mounted directly with app.use(routeFile).
- Endpoints are exactly as written below (no extra /api prefix).

404 behavior:

- Any unknown route returns:

```json
{ "message": "Route not found" }
```

## 2) Authentication Model

Protected routes use JWT auth middleware.

Header format:

```text
Authorization: Bearer <token>
```

Token payload:

- organizationId

Token expiry:

- 7 days

What middleware does internally:

1. Checks Authorization header exists and starts with Bearer.
2. Verifies JWT with JWT_SECRET (or fallback secret in development).
3. Loads organization by organizationId.
4. Rejects if organization does not exist or isActive is false.
5. Attaches:
   - req.organization
   - req.organizationId

Important org isolation rule:

- Frontend never sends organizationId for protected operations.
- Backend always derives org from req.organizationId.

## 3) Data Models Used by API

### Organization

Fields:

- organizationName (unique, required)
- email (unique, required, lowercase)
- password (hashed via pre-save hook)
- phone (optional)
- address (optional)
- logo (optional URL)
- isActive (default true)

### Client

Fields:

- organizationId (required, ref Organization)
- clientName (required)

### Progress

Fields:

- clientId (required, ref Client)
- Lead: { assignee, date }
- firstContact: { assignee, date }
- followUp: { assignee, date }
- RFQ: { assignee, date }
- quote: { assignee, date }
- quoteFollowUp: { assignee, date }
- order: { assignee, value }
- delivered (boolean, default false)
- createdAt, updatedAt

### NotificationDevice

Fields:

- organizationId (required)
- platform (android or ios)
- expoPushToken (required)
- isActive (default true)
- lastSeenAt

Unique index:

- { organizationId, expoPushToken }

### NotificationLog

Used to prevent repeat notification spam.

Fields:

- organizationId
- clientId
- type (stale_progress)
- dedupeKey (unique)
- sentAt

## 4) Error Shape

All routes return errors in this shape:

```json
{ "message": "Some explanation" }
```

Some routes include extra error field for debugging (notification routes):

```json
{ "message": "...", "error": "..." }
```

Common status codes:

- 200 OK
- 201 Created
- 400 Bad Request
- 401 Unauthorized
- 404 Not Found
- 500 Internal Server Error
- 503 Service Unavailable (logo upload attempted while ImageKit is not configured)

## 5) Authentication Routes

### 5.1 POST /auth/register

Purpose:

- Create a new organization account.
- Optionally upload logo using multipart form-data.

Content type options:

- application/json when no logo
- multipart/form-data when sending logo (field name must be logo)

Required body fields:

- organizationName
- email
- password

Optional body fields:

- phone
- address

Validation and logic:

1. Trims organizationName.
2. Trims and lowercases email.
3. Requires password length >= 6.
4. Validates email format.
5. Rejects duplicate email or organizationName.
6. If logo file is present:
   - validates image mime type
   - size limit 5MB
   - if ImageKit not configured, returns 503
   - uploads and stores logo URL
7. Saves organization (password hashed by model hook).
8. Returns JWT token and organization profile.

Example JSON request:

```json
{
  "organizationName": "Acme Pvt Ltd",
  "email": "admin@acme.com",
  "password": "secret123",
  "phone": "+91-9999999999",
  "address": "Bangalore"
}
```

Success response (201):

```json
{
  "message": "Organization registered successfully",
  "organization": {
    "_id": "65f...",
    "organizationName": "Acme Pvt Ltd",
    "email": "admin@acme.com",
    "phone": "+91-9999999999",
    "address": "Bangalore",
    "logo": null
  },
  "token": "<jwt>"
}
```

Potential errors:

- 400 Organization name, email, and password are required
- 400 Password must be at least 6 characters
- 400 Invalid email format
- 400 Email already registered
- 400 Organization name already taken
- 400 File too large. Maximum size is 5MB
- 400 Only image files are allowed
- 503 Logo upload is unavailable. ImageKit is not configured.

### 5.2 POST /auth/login

Purpose:

- Authenticate organization and return JWT.

Required body:

- email
- password

Logic:

1. Trims and lowercases email.
2. Finds organization by email.
3. Rejects if not found.
4. Rejects if isActive is false.
5. Compares password hash.
6. Returns token + organization profile.

Request:

```json
{
  "email": "admin@acme.com",
  "password": "secret123"
}
```

Success response (200):

```json
{
  "message": "Login successful",
  "organization": {
    "_id": "65f...",
    "organizationName": "Acme Pvt Ltd",
    "email": "admin@acme.com",
    "phone": "+91-9999999999",
    "address": "Bangalore",
    "logo": null
  },
  "token": "<jwt>"
}
```

Errors:

- 400 Email and password are required
- 401 Invalid email or password
- 401 Organization is deactivated

### 5.3 GET /auth/me (Protected)

Purpose:

- Get current authenticated organization profile.

Response:

```json
{
  "organization": {
    "_id": "65f...",
    "organizationName": "Acme Pvt Ltd",
    "email": "admin@acme.com",
    "phone": "+91-9999999999",
    "address": "Bangalore",
    "logo": null,
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### 5.4 PUT /auth/update (Protected)

Purpose:

- Update organization profile fields.
- Optional logo update.

Updatable fields:

- organizationName
- email
- phone
- address
- logo (file field name logo)

Validation and logic:

1. Updates only fields present in request.
2. organizationName if provided:
   - trimmed
   - must not be empty
   - must be unique (excluding current org)
3. email if provided:
   - trimmed + lowercased
   - valid format
   - unique (excluding current org)
4. If logo file provided:
   - image only, max 5MB
   - returns 503 if ImageKit missing
   - uploads to ImageKit and stores URL
5. If no valid field provided and no file, returns 400.
6. Returns updated organization without password.

Example request:

```json
{
  "organizationName": "Acme India",
  "phone": "+91-8888888888"
}
```

Success response:

```json
{
  "message": "Profile updated successfully",
  "organization": {
    "_id": "65f...",
    "organizationName": "Acme India",
    "email": "admin@acme.com",
    "phone": "+91-8888888888",
    "address": "Bangalore",
    "logo": null
  }
}
```

### 5.5 PUT /auth/change-password (Protected)

Required body:

- currentPassword
- newPassword (min 6)

Logic:

1. Validates required fields.
2. Validates newPassword length.
3. Loads current organization.
4. Verifies currentPassword.
5. Saves new password (auto-hashed by model hook).

Request:

```json
{
  "currentPassword": "secret123",
  "newPassword": "newsecret123"
}
```

Success response:

```json
{ "message": "Password changed successfully" }
```

## 6) Client Routes (Protected)

### 6.1 GET /clients

Purpose:

- Fetch all clients belonging to authenticated organization.

Response:

```json
[
  {
    "_id": "...",
    "organizationId": {
      "_id": "...",
      "organizationName": "Acme"
    },
    "clientName": "Client One",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

### 6.2 GET /clients/:id

Purpose:

- Fetch one client if it belongs to authenticated organization.

Behavior:

- Returns 404 if id does not exist in this organization.

### 6.3 POST /add/clients

Purpose:

- Create client and auto-create empty Progress document.

Required body:

- clientName

Logic:

1. Trims clientName and requires non-empty.
2. Creates Client with organizationId from token.
3. Creates Progress with clientId.
4. If Progress creation fails, deletes created client to avoid partial data.

Request:

```json
{ "clientName": "Tata Projects" }
```

Success response (201):

```json
{
  "client": {
    "_id": "...",
    "organizationId": "...",
    "clientName": "Tata Projects",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "progress": {
    "_id": "...",
    "clientId": "...",
    "delivered": false,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "message": "Client and Progress created successfully"
}
```

### 6.4 PUT /update/client/:id

Purpose:

- Update clientName for this organization.

Required body:

```json
{ "clientName": "Updated Name" }
```

Behavior:

- Trims and validates non-empty name.
- 404 if client not found in org.

### 6.5 DELETE /delete/client/:id

Purpose:

- Delete one client in this organization and delete associated progress rows.

Behavior:

1. Deletes client by id + org.
2. Deletes all Progress where clientId = id.

Success:

```json
{ "message": "Client and associated progress deleted successfully" }
```

## 7) Progress Routes (Protected)

### 7.1 GET /progress

Purpose:

- Get all progress entries for authenticated organization.

Implementation details:

- Uses aggregation with lookup on clients and organizations.
- Filters by clientData.organizationId = req.organizationId.

### 7.2 GET /progress?clientId=<id>

Purpose:

- Get progress only for one client.

Validation:

- clientId must be valid ObjectId.
- client must belong to authenticated organization.

Response shape:

```json
[
  {
    "_id": "...",
    "clientId": {
      "_id": "...",
      "clientName": "...",
      "organizationId": {
        "_id": "...",
        "organizationName": "..."
      }
    },
    "Lead": { "assignee": "...", "date": "YYYY-MM-DD" },
    "firstContact": { "assignee": "...", "date": "YYYY-MM-DD" },
    "followUp": { "assignee": "...", "date": "YYYY-MM-DD" },
    "RFQ": { "assignee": "...", "date": "YYYY-MM-DD" },
    "quote": { "assignee": "...", "date": "YYYY-MM-DD" },
    "quoteFollowUp": { "assignee": "...", "date": "YYYY-MM-DD" },
    "order": { "assignee": "...", "value": 10000 },
    "delivered": false,
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

### 7.3 PUT /update/progress?clientId=<id>

Purpose:

- Partial update of progress fields for a single client.

Required query:

- clientId

Allowed body fields only:

- Lead
- firstContact
- followUp
- RFQ
- quote
- quoteFollowUp
- order
- delivered

Any other keys are ignored.

Validation and behavior:

1. clientId required and must be valid ObjectId.
2. Client must belong to authenticated org.
3. Builds update object from allowed fields only.
4. If no allowed field provided, returns 400.
5. Updates one progress row for clientId.

Example update stage:

```json
{
  "Lead": {
    "assignee": "Ravi",
    "date": "2026-03-23"
  }
}
```

Example update delivered:

```json
{ "delivered": true }
```

## 8) Organization Public Routes

### 8.1 GET /organizations

Purpose:

- Public list of active organizations.
- Excludes password.

### 8.2 GET /organizations/:id

Purpose:

- Public organization profile by id.
- Excludes password.

## 9) Notification Routes (Protected)

Notification push provider:

- Expo server SDK

### 9.1 POST /notifications/register-device

Purpose:

- Register or reactivate a device token for the authenticated organization.

Required body:

```json
{
  "platform": "android",
  "expoPushToken": "ExponentPushToken[xxxx]"
}
```

Validation:

- platform required and must be android or ios
- expoPushToken required and must pass Expo token format check

Logic:

1. Upsert by { organizationId, expoPushToken }.
2. Set isActive = true, update lastSeenAt.
3. Returns stored device data.

Success:

```json
{
  "message": "Device registered",
  "data": {
    "_id": "...",
    "organizationId": "...",
    "platform": "android",
    "expoPushToken": "ExponentPushToken[xxxx]",
    "isActive": true,
    "lastSeenAt": "..."
  }
}
```

### 9.2 DELETE /notifications/register-device

Purpose:

- Unregister token on logout.

Required body:

```json
{ "expoPushToken": "ExponentPushToken[xxxx]" }
```

Logic:

- Matches by org + token and sets isActive false.

Success:

```json
{ "message": "Device unregistered" }
```

### 9.3 POST /notifications/test

Purpose:

- Send immediate test push to all active devices in current organization.

Body:

- none

Logic:

1. Loads active org devices.
2. Filters invalid Expo tokens.
3. Builds test payload.
4. Chunks and sends via Expo.

Notification payload sent:

```json
{
  "to": "ExponentPushToken[xxxx]",
  "sound": "default",
  "title": "Test reminder",
  "body": "Background notification is working.",
  "data": { "type": "test" }
}
```

Responses:

- 404 No active device found (no active rows)
- 400 No valid Expo token found for active devices (rows exist but tokens invalid)
- 200 Test notification sent with count

## 10) Background Stale Progress Notification Logic

Scheduler file:

- services/staleProgressCron.js

Started from:

- index.js after MongoDB connection

Schedule:

- Every hour at minute 0
- Cron: 0 * * * *

Business rule:

- Notify when progress was not updated for 2 or more days.
- Ignore records where delivered is true.

How stale detection works:

1. Query Progress where delivered != true.
2. For each progress, calculate last activity timestamp from:
   - each stage date string (slashes normalized)
   - progress updatedAt
   - progress createdAt
3. Compute daysAgo = floor((now - lastTs)/day).
4. overdue when daysAgo >= 2.

Org isolation:

- Progress rows are grouped by client organizationId.
- Devices queried only for matching organizationId and isActive true.

Dedupe logic:

- dedupeKey format:

```text
orgId:clientId:stale_progress:YYYY-MM-DD
```

- Existing dedupe keys for the day are loaded in batch.
- If key exists, notification is skipped.
- After send, key is written to NotificationLog.

Payload for stale reminder:

```json
{
  "to": "ExponentPushToken[xxxx]",
  "sound": "default",
  "title": "Progress reminder",
  "body": "Client Name has not been updated for 3 day(s).",
  "data": {
    "type": "stale_progress",
    "clientId": "..."
  }
}
```

Invalid token cleanup:

- If Expo ticket returns DeviceNotRegistered, matching token is set inactive.

## 11) Frontend Integration Examples

### 11.1 Axios instance

```js
import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000',
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}
```

### 11.2 Register device token after Expo permission + token fetch

```js
await api.post('/notifications/register-device', {
  platform: Platform.OS,
  expoPushToken,
});
```

### 11.3 Unregister token on logout

```js
await api.delete('/notifications/register-device', {
  data: { expoPushToken },
});
```

### 11.4 Create client and initial progress

```js
const { data } = await api.post('/add/clients', {
  clientName: 'Larsen & Toubro',
});
```

### 11.5 Update progress stage

```js
await api.put('/update/progress?clientId=65f...', {
  quote: {
    assignee: 'Amit',
    date: '2026-03-23',
  },
});
```

### 11.6 Mark as delivered

```js
await api.put('/update/progress?clientId=65f...', {
  delivered: true,
});
```

### 11.7 Handle auth errors globally

```js
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      // token expired / invalid, force logout
    }
    return Promise.reject(err);
  }
);
```

## 12) Environment Variables

Required:

```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=replace-with-strong-secret
PORT=3000
```

Optional (needed only if sending logo files):

```env
IMAGEKIT_PUBLIC_KEY=...
IMAGEKIT_PRIVATE_KEY=...
IMAGEKIT_URL_ENDPOINT=...
```

If ImageKit vars are missing:

- Auth routes still work.
- Logo upload requests return 503.

## 13) Notification Setup Checklist For Frontend

1. Get push permission on device.
2. Fetch Expo token.
3. Call POST /notifications/register-device after login.
4. Call DELETE /notifications/register-device on logout.
5. Optionally call POST /notifications/test from debug screen.
6. Confirm app receives notification while background/closed.

## 14) Complete Route Index

Public:

- GET /
- POST /auth/register
- POST /auth/login
- GET /organizations
- GET /organizations/:id

Protected:

- GET /auth/me
- PUT /auth/update
- PUT /auth/change-password
- GET /clients
- GET /clients/:id
- POST /add/clients
- PUT /update/client/:id
- DELETE /delete/client/:id
- GET /progress
- GET /progress?clientId=<id>
- PUT /update/progress?clientId=<id>
- POST /notifications/register-device
- DELETE /notifications/register-device
- POST /notifications/test

---

## Mobile App (React Native)

Located at: `smarta-tech-tracker/`

```
smarta-tech-tracker/
├── App.js
├── app.json
├── package.json
└── src/
    ├── components/
    │   └── Toast.js
    ├── navigation/
    │   └── AppNavigator.js
    ├── screens/
    │   ├── LoginScreen.js
    │   ├── HomeScreen.js
    │   └── ProgressScreen.js
    └── services/
        └── api.js           # API client config
```

**Update API URL in:** `src/services/api.js`

```javascript
const API_URL = 'http://YOUR_SERVER_IP:3000';
```

---

## Quick Start

**Backend:**
```bash
cd client-progress-
npm install
npm run dev
```

**Mobile App:**
```bash
cd smarta-tech-tracker
npm install
npx expo start
```
