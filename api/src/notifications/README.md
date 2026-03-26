# Notifications Module

This module handles web push notifications for admin, vendor, and customer users. It uses the Web Push API via the `web-push` package and stores subscriptions in the `push_subscriptions` table.

## Key Endpoints
- `GET /notifications/config` — Returns whether push is enabled and exposes the public VAPID key
- `POST /notifications/subscribe` — Saves the logged-in user's push subscription

## Setup
- Generate VAPID keys with `npx web-push generate-vapid-keys`
- Set `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY`
- Run the push subscription migration in production
- Keep notification triggers in booking or payment flows server-side

## Frontend
- Register the service worker after login
- Request notification permission when supported
- Fetch the public VAPID key from the API config endpoint
- Send the browser push subscription to the backend
