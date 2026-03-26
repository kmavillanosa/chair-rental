# Triggering Notifications on Events

To send a push notification when a booking is created, status changes, or a transaction occurs, inject `NotificationsService` and call `sendNotification` for each relevant user (customer, vendor, admin).

## Example (in bookings.service.ts):

```ts
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BookingsService {
  constructor(
    // ...other injections
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(...) {
    // ...booking creation logic
    await this.notificationsService.sendNotification(
      booking.customerId,
      { title: 'Booking Placed', body: 'Your booking was placed successfully!', url: `/my-bookings/${booking.id}` }
    );
    await this.notificationsService.sendNotification(
      booking.vendorId,
      { title: 'New Booking', body: 'You have a new booking request.', url: `/vendor/bookings/${booking.id}` }
    );
    // Optionally notify admin(s)
  }

  async updateStatus(bookingId: string, newStatus: string) {
    // ...status update logic
    await this.notificationsService.sendNotification(
      booking.customerId,
      { title: 'Booking Status Updated', body: `Your booking status is now ${newStatus}.`, url: `/my-bookings/${bookingId}` }
    );
    // ...etc
  }
}
```

## Frontend
- Use `registerPushNotifications` after login to register the user's subscription.
- Service worker will display notifications automatically.
