# Notification Routes Explained

This document explains how your notification backend works, what must be sent to each route, and how notifications are actually pushed to mobile devices.

## 1) Where notifications are wired

- Routes are defined in routes/notificationRoutes.js
- Routes are mounted in index.js through app.use(notificationRoutes)
- Cron reminder logic is in services/staleProgressCron.js
- Device storage model is notificationDeviceSchema.js
- Deduplication log model is notificationLogSchema.js

## 2) Authentication requirement for all notification routes

All notification routes use authMiddleware.

What this means:
- You must send Authorization header with a valid JWT.
- Header format:

    Authorization: Bearer <your_jwt_token>

- Backend decodes JWT and sets:
  - req.organizationId
  - req.organization

Important:
- orgId is never taken from frontend body.
- Organization isolation comes from req.organizationId set by middleware.

## 3) Route: POST /notifications/register-device

Purpose:
- Save or update the mobile device push token for the logged-in organization.
- Reactivate token if it already exists.

Body required:

    {
      "platform": "android" | "ios",
      "expoPushToken": "ExponentPushToken[...]"
    }

Validation performed:
- platform must exist
- expoPushToken must exist
- platform must be android or ios
- expoPushToken must be a valid Expo token format

What backend does:
- Finds by { organizationId, expoPushToken }
- Upserts record in NotificationDevice
- Sets isActive = true
- Updates lastSeenAt

Success response example:

    {
      "message": "Device registered",
      "data": {
        "_id": "...",
        "organizationId": "...",
        "platform": "android",
        "expoPushToken": "ExponentPushToken[...]",
        "isActive": true,
        "lastSeenAt": "2026-03-23T...",
        "createdAt": "2026-03-23T...",
        "updatedAt": "2026-03-23T..."
      }
    }

If invalid input:
- 400 platform and expoPushToken are required
- 400 platform must be android or ios
- 400 Invalid Expo push token

## 4) Route: DELETE /notifications/register-device

Purpose:
- Mark a token inactive on logout or device sign-out.

Body required:

    {
      "expoPushToken": "ExponentPushToken[...]"
    }

What backend does:
- Finds record by { organizationId, expoPushToken }
- Sets isActive = false
- Updates lastSeenAt

Success response:

    {
      "message": "Device unregistered"
    }

If missing input:
- 400 expoPushToken is required

## 5) Route: POST /notifications/test

Purpose:
- Immediately test push delivery to all active devices in the logged-in organization.

Body required:
- No body required.

What backend does step by step:
1. Query active devices:
   - NotificationDevice.find({ organizationId, isActive: true })
2. Filter only valid Expo tokens.
3. Build push messages with title/body/data.
4. Split messages into chunks using Expo SDK.
5. Send each chunk using expo.sendPushNotificationsAsync.
6. Return success with count.

Payload sent to Expo (per device):

    {
      "to": "ExponentPushToken[...]",
      "sound": "default",
      "title": "Test reminder",
      "body": "Background notification is working.",
      "data": { "type": "test" }
    }

Success response:

    {
      "message": "Test notification sent",
      "count": 2
    }

If no active devices:
- 404 No active device found

## 6) How stale progress notifications are pushed automatically

The scheduler runs in services/staleProgressCron.js and is started from index.js after MongoDB connection.

Schedule:
- Every hour at minute 0
- Cron expression: 0 * * * *

Job logic summary:
1. Load Progress records where delivered != true.
2. Populate client and organization data.
3. Compute last update timestamp from:
   - stage date fields
   - document updatedAt and createdAt
4. Mark client as stale if daysAgo >= 2.
5. Group stale clients by organization.
6. For each org, load active notification devices.
7. For each stale client, create dedupe key:
   - orgId:clientId:stale_progress:YYYY-MM-DD (UTC)
8. Skip if key already exists in NotificationLog.
9. Send Expo push to all active org devices.
10. Store NotificationLog so same client is not spammed in the same day.
11. If Expo ticket says DeviceNotRegistered, deactivate that token.

Notification content for stale progress:

    {
      "title": "Progress reminder",
      "body": "<ClientName> has not been updated for X day(s).",
      "data": {
        "type": "stale_progress",
        "clientId": "..."
      }
    }

## 7) What frontend must send exactly

After getting Expo token:

    POST /notifications/register-device
    Headers: Authorization: Bearer <JWT>
    Body:
    {
      "platform": "android",
      "expoPushToken": "ExponentPushToken[...]"
    }

On logout:

    DELETE /notifications/register-device
    Headers: Authorization: Bearer <JWT>
    Body:
    {
      "expoPushToken": "ExponentPushToken[...]"
    }

Optional test button:

    POST /notifications/test
    Headers: Authorization: Bearer <JWT>

## 8) Why this works when app is closed

- Push is sent from backend server to Expo push service.
- Expo routes push to APNs (iOS) or FCM (Android).
- OS displays notification even when app is in background or terminated.

Your backend does not depend on app being open because sending is server-side.

## 9) Common failure points checklist

- Missing or expired JWT in Authorization header.
- Invalid Expo token string.
- Device never registered (test route returns 404).
- App permissions not granted on phone.
- Running cron only on instances that sleep/scale-to-zero.
- Forgetting logout unregister leads to stale tokens.

## 10) Debug hints already present

The register route currently logs:
- organizationId
- platform
- token presence
- token preview
- success/failure status

This helps confirm registration requests are hitting backend correctly.
