# Web Push Setup

1. Install web-push:
   npm install web-push

2. Generate VAPID keys:
   npx web-push generate-vapid-keys

3. Add the public key to the frontend (replace <YOUR_PUBLIC_VAPID_KEY> in pushNotifications.ts)

4. Add both public and private keys to your backend environment variables and configure web-push:

   webPush.setVapidDetails(
     'mailto:your@email.com',
     process.env.VAPID_PUBLIC_KEY,
     process.env.VAPID_PRIVATE_KEY
   );

5. Import NotificationsModule in your main app.module.ts and inject NotificationsService where needed.

6. Call notificationsService.sendNotification(userId, payload) on booking, transaction, or status change events.
