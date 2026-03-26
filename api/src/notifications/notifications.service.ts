import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webPush from 'web-push';
import { PushSubscription } from './entities/push-subscription.entity';

export type NotificationPayload = {
  title: string;
  body: string;
  url?: string;
};

type PushSubscriptionInput = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly vapidSubject = String(
    process.env.VAPID_SUBJECT || 'mailto:no-reply@rentalbasic.com',
  ).trim();
  private readonly vapidPublicKey = String(process.env.VAPID_PUBLIC_KEY || '').trim();
  private readonly vapidPrivateKey = String(process.env.VAPID_PRIVATE_KEY || '').trim();

  constructor(
    @InjectRepository(PushSubscription)
    private readonly pushSubscriptionsRepo: Repository<PushSubscription>,
  ) {
    if (this.isEnabled()) {
      webPush.setVapidDetails(
        this.vapidSubject,
        this.vapidPublicKey,
        this.vapidPrivateKey,
      );
    } else {
      this.logger.warn(
        'Web push notifications are disabled. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to enable them.',
      );
    }
  }

  isEnabled() {
    return Boolean(this.vapidPublicKey && this.vapidPrivateKey);
  }

  getClientConfig() {
    return {
      enabled: this.isEnabled(),
      publicKey: this.vapidPublicKey || null,
    };
  }

  async saveSubscription(
    userId: string,
    subscription: PushSubscriptionInput,
    userAgent?: string,
  ) {
    const normalized = this.normalizeSubscription(subscription);
    const existing = await this.pushSubscriptionsRepo.findOne({
      where: { endpoint: normalized.endpoint },
    });

    const entity = this.pushSubscriptionsRepo.create({
      id: existing?.id,
      userId,
      endpoint: normalized.endpoint,
      p256dh: normalized.keys.p256dh,
      auth: normalized.keys.auth,
      contentEncoding: normalized.contentEncoding,
      userAgent: String(userAgent || '').trim() || existing?.userAgent || null,
      lastUsedAt: existing?.lastUsedAt || null,
    });

    await this.pushSubscriptionsRepo.save(entity);
  }

  async sendNotification(userId: string, payload: NotificationPayload) {
    if (!this.isEnabled()) {
      return;
    }

    const subscriptions = await this.pushSubscriptionsRepo.find({
      where: { userId },
    });

    if (!subscriptions.length) {
      return;
    }

    const body = JSON.stringify(payload);

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webPush.sendNotification(
            this.toWebPushSubscription(subscription),
            body,
          );
          await this.pushSubscriptionsRepo.update(subscription.id, {
            lastUsedAt: new Date(),
          });
        } catch (error) {
          if (this.isExpiredSubscriptionError(error)) {
            await this.pushSubscriptionsRepo.delete(subscription.id);
            return;
          }

          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Failed to send push notification to user ${userId}: ${message}`,
          );
        }
      }),
    );
  }

  private normalizeSubscription(subscription: PushSubscriptionInput) {
    const endpoint = String(subscription?.endpoint || '').trim();
    const p256dh = String(subscription?.keys?.p256dh || '').trim();
    const auth = String(subscription?.keys?.auth || '').trim();
    const contentEncoding = this.detectContentEncoding(subscription);

    if (!endpoint || !p256dh || !auth) {
      throw new BadRequestException('Invalid push subscription payload');
    }

    return {
      endpoint,
      keys: {
        p256dh,
        auth,
      },
      contentEncoding,
    };
  }

  private detectContentEncoding(subscription: PushSubscriptionInput) {
    const rawValue = (subscription as PushSubscriptionInput & { contentEncoding?: string })
      ?.contentEncoding;
    const contentEncoding = String(rawValue || '').trim();
    return contentEncoding || 'aes128gcm';
  }

  private toWebPushSubscription(subscription: PushSubscription) {
    return {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };
  }

  private isExpiredSubscriptionError(error: unknown) {
    const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
    return statusCode === 404 || statusCode === 410;
  }
}
