# Smarta Tech Tracker - API Documentation

A multi-tenant client progress tracking system built with Express.js, MongoDB, and React Native.

---

## Base URL

```
http://localhost:3000
```

---

## Authentication

All protected routes require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

Token expires in 7 days.

---

## API Routes

### Authentication Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Register new organization |
| POST | `/auth/login` | No | Login and get token |
| GET | `/auth/me` | Yes | Get current organization profile |
| PUT | `/auth/update` | Yes | Update organization profile |
| PUT | `/auth/change-password` | Yes | Change password |

---

#### POST `/auth/register`

Register a new organization.

**Request Body:**
```json
{
  "organizationName": "string (required)",
  "email": "string (required)",
  "password": "string (required)",
  "phone": "string (optional)",
  "address": "string (optional)"
}
```

**Response (201):**
```json
{
  "message": "Organization registered successfully",
  "organization": {
    "_id": "string",
    "organizationName": "string",
    "email": "string",
    "phone": "string",
    "address": "string"
  },
  "token": "string"
}
```

---

#### POST `/auth/login`

Login with email and password.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "organization": {
    "_id": "string",
    "organizationName": "string",
    "email": "string",
    "phone": "string",
    "address": "string"
  },
  "token": "string"
}
```

---

### Client Routes (Protected)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/clients` | Yes | Get all clients for organization |
| GET | `/clients/:id` | Yes | Get single client by ID |
| POST | `/add/clients` | Yes | Add new client |
| PUT | `/update/client/:id` | Yes | Update client name |
| DELETE | `/delete/client/:id` | Yes | Delete client and progress |

---

#### GET `/clients`

Get all clients for the logged-in organization.

**Response (200):**
```json
[
  {
    "_id": "string",
    "clientName": "string",
    "organizationId": {
      "_id": "string",
      "organizationName": "string"
    },
    "createdAt": "string",
    "updatedAt": "string"
  }
]
```

---

#### GET `/clients/:id`

Get a single client by ID.

**Response (200):**
```json
{
  "_id": "string",
  "clientName": "string",
  "organizationId": {
    "_id": "string",
    "organizationName": "string"
  },
  "createdAt": "string",
  "updatedAt": "string"
}
```

---

#### POST `/add/clients`

Add a new client with auto-created progress.

**Request Body:**
```json
{
  "clientName": "string (required)"
}
```

**Response (201):**
```json
{
  "client": {
    "_id": "string",
    "clientName": "string",
    "organizationId": "string"
  },
  "progress": {
    "_id": "string",
    "clientId": "string",
    "delivered": false
  },
  "message": "Client and Progress created successfully"
}
```

---

#### PUT `/update/client/:id`

Update client name.

**Request Body:**
```json
{
  "clientName": "string"
}
```

**Response (200):**
```json
{
  "client": { ... },
  "message": "Client updated successfully"
}
```

---

#### DELETE `/delete/client/:id`

Delete client and all associated progress data.

**Response (200):**
```json
{
  "message": "Client and associated progress deleted successfully"
}
```

---

### Progress Routes (Protected)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/progress` | Yes | Get all progress for organization |
| GET | `/progress?clientId=<id>` | Yes | Get progress for specific client |
| PUT | `/update/progress?clientId=<id>` | Yes | Update progress for client |

---

#### GET `/progress`

Get progress data. Optionally filter by clientId.

**Query Parameters:**
- `clientId` (optional): Filter by specific client

**Response (200):**
```json
[
  {
    "_id": "string",
    "clientId": {
      "_id": "string",
      "clientName": "string",
      "organizationId": {
        "_id": "string",
        "organizationName": "string"
      }
    },
    "Lead": {
      "assignee": "string",
      "date": "YYYY-MM-DD"
    },
    "firstContact": {
      "assignee": "string",
      "date": "YYYY-MM-DD"
    },
    "followUp": {
      "assignee": "string",
      "date": "YYYY-MM-DD"
    },
    "RFQ": {
      "assignee": "string",
      "date": "YYYY-MM-DD"
    },
    "quote": {
      "assignee": "string",
      "date": "YYYY-MM-DD"
    },
    "quoteFollowUp": {
      "assignee": "string",
      "date": "YYYY-MM-DD"
    },
    "order": {
      "assignee": "string",
      "value": 0
    },
    "delivered": false,
    "createdAt": "string",
    "updatedAt": "string"
  }
]
```

---

#### PUT `/update/progress?clientId=<id>`

Update progress fields for a client.

**Query Parameters:**
- `clientId` (required): Client ID

**Request Body (partial update):**
```json
{
  "Lead": {
    "assignee": "John Doe",
    "date": "2026-03-11"
  }
}
```

Or:
```json
{
  "delivered": true
}
```

**Response (200):**
```json
{
  "_id": "string",
  "clientId": "string",
  "Lead": { ... },
  "delivered": true,
  ...
}
```

---

### Organization Routes (Public)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/organizations` | No | List all active organizations |
| GET | `/organizations/:id` | No | Get organization by ID |

---

## Progress Pipeline Stages

| Stage | Fields | Description |
|-------|--------|-------------|
| Lead | `assignee`, `date` | Initial lead assignment |
| First Contact | `assignee`, `date` | First contact made |
| Follow Up | `assignee`, `date` | Follow up communication |
| RFQ | `assignee`, `date` | Request for Quote |
| Quote | `assignee`, `date` | Quote sent/received |
| Quote Follow Up | `assignee`, `date` | Quote follow up |
| Order | `assignee`, `value` | Order placed (value = amount) |
| Delivered | `boolean` | Final delivery status |

---

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid/missing token |
| 404 | Not Found - Resource doesn't exist |
| 500 | Server Error |

**Error Response Format:**
```json
{
  "message": "Error description"
}
```

---

## Environment Variables

```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
PORT=3000
```

---

## Project Structure

```
client-progress-/
├── index.js                 # Main server entry
├── package.json
├── .env
├── clientSchma.js           # Client model
├── progressSchma.js         # Progress model
├── organizationSchema.js    # Organization model
├── middleware/
│   └── authMiddleware.js    # JWT authentication
├── routes/
│   ├── authRoutes.js        # Auth endpoints
│   ├── clientRoutes.js      # Client CRUD
│   ├── progressRoutes.js    # Progress updates
│   ├── organizationRoutes.js # Org listing
│   └── viewRoutes.js        # EJS views
└── views/
    ├── login.ejs            # Login/Register UI
    ├── home.ejs             # Client list UI
    ├── progress.ejs         # Progress pipeline UI
    └── dashboard.ejs        # API tester UI
```

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
