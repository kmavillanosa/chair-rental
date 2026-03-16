import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

interface RcAdminAuth {
  userId: string;
  authToken: string;
  expiresAt: number;
}

@Injectable()
export class RocketChatService {
  private readonly logger = new Logger(RocketChatService.name);

  private readonly internalUrl: string;
  private readonly publicUrl: string;
  private readonly adminEmail: string;
  private readonly adminPassword: string;
  private readonly userSecret: string;
  readonly webhookSecret: string;

  private cachedAdminAuth: RcAdminAuth | null = null;

  constructor() {
    this.internalUrl = (
      process.env.ROCKETCHAT_URL || 'http://rocketchat:3000'
    ).replace(/\/$/, '');
    this.publicUrl = (
      process.env.ROCKETCHAT_PUBLIC_URL ||
      process.env.ROCKETCHAT_URL ||
      'http://localhost:4000'
    ).replace(/\/$/, '');
    this.adminEmail =
      process.env.ROCKETCHAT_ADMIN_EMAIL || 'admin@rentalbasic.com';
    this.adminPassword =
      process.env.ROCKETCHAT_ADMIN_PASSWORD || 'ChangeMe_RC_Password_2024';
    this.userSecret =
      process.env.ROCKETCHAT_USER_SECRET ||
      process.env.JWT_SECRET ||
      'rc-user-secret';
    this.webhookSecret = process.env.ROCKETCHAT_WEBHOOK_SECRET || '';
  }

  get rocketchatPublicUrl(): string {
    return this.publicUrl;
  }

  // ── Admin auth ──────────────────────────────────────────────────────────────

  private async getAdminAuth(): Promise<{ userId: string; authToken: string }> {
    if (this.cachedAdminAuth && this.cachedAdminAuth.expiresAt > Date.now()) {
      return {
        userId: this.cachedAdminAuth.userId,
        authToken: this.cachedAdminAuth.authToken,
      };
    }

    const res = await fetch(`${this.internalUrl}/api/v1/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: this.adminEmail,
        password: this.adminPassword,
      }),
    });

    if (!res.ok) {
      throw new Error(
        `Rocket.Chat admin login failed: HTTP ${res.status}`,
      );
    }

    const data = (await res.json()) as {
      data?: { userId?: string; authToken?: string };
    };

    const { userId, authToken } = data.data ?? {};
    if (!userId || !authToken) {
      throw new Error('Rocket.Chat admin login returned empty credentials');
    }

    // Cache for 50 minutes (tokens are valid for 1 hour by default)
    this.cachedAdminAuth = {
      userId,
      authToken,
      expiresAt: Date.now() + 50 * 60 * 1000,
    };

    return { userId, authToken };
  }

  // ── Low-level HTTP wrapper ──────────────────────────────────────────────────

  private async rcRequest(
    method: 'GET' | 'POST',
    path: string,
    body?: object,
    retried = false,
  ): Promise<Record<string, unknown>> {
    const auth = await this.getAdminAuth();
    const res = await fetch(`${this.internalUrl}/api/v1/${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': auth.authToken,
        'X-User-Id': auth.userId,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    // On 401, clear cache and retry once (token may have been revoked)
    if (res.status === 401 && !retried) {
      this.cachedAdminAuth = null;
      return this.rcRequest(method, path, body, true);
    }

    const data = (await res.json()) as Record<string, unknown>;
    return data;
  }

  // ── User management ─────────────────────────────────────────────────────────

  /**
   * Deterministic RC username derived from our internal user ID.
   * Format: rb<first20charsOfIdWithoutDashes>
   * Max RC username length is 120 chars; ours is well within that.
   */
  private rcUsername(userId: string): string {
    return `rb${userId.replace(/-/g, '').substring(0, 20)}`;
  }

  /**
   * Deterministic password — users never log in with it directly;
   * they only authenticate via admin-generated tokens.
   */
  private rcPassword(userId: string): string {
    return createHash('sha256')
      .update(`${this.userSecret}:${userId}`)
      .digest('hex');
  }

  /**
   * Ensures a Rocket.Chat user account exists for the given platform user.
   * Returns the RC internal user ID (_id).
   */
  async ensureUser(
    userId: string,
    name: string,
    email: string,
  ): Promise<string> {
    const username = this.rcUsername(userId);

    const createData = await this.rcRequest('POST', 'users.create', {
      email,
      name,
      username,
      password: this.rcPassword(userId),
      requirePasswordChange: false,
      verified: true,
      roles: ['user'],
    });

    if (createData.success === true) {
      const user = createData.user as Record<string, string>;
      return user._id;
    }

    // User already exists — look up by username
    const infoData = await this.rcRequest(
      'GET',
      `users.info?username=${encodeURIComponent(username)}`,
    );

    if (infoData.success !== true) {
      throw new Error(
        `Failed to create or find RC user for platform user ${userId}: ${JSON.stringify(infoData)}`,
      );
    }

    const user = infoData.user as Record<string, string>;
    return user._id;
  }

  // ── Room management ─────────────────────────────────────────────────────────

  /**
   * Creates (or retrieves) a private group for the booking and ensures
   * both the customer and vendor are members.
   * Returns the RC room ID.
   */
  async ensureBookingRoom(
    bookingId: string,
    customerUserId: string,
    customerName: string,
    customerEmail: string,
    vendorUserId: string,
    vendorName: string,
    vendorEmail: string,
  ): Promise<string> {
    const roomName = `booking-${bookingId}`;

    // Ensure RC accounts exist for both participants in parallel
    const [customerRcId, vendorRcId] = await Promise.all([
      this.ensureUser(customerUserId, customerName, customerEmail),
      this.ensureUser(vendorUserId, vendorName, vendorEmail),
    ]);

    // Create private group
    let roomId: string;
    const createData = await this.rcRequest('POST', 'groups.create', {
      name: roomName,
      readOnly: false,
      members: [],
    });

    if (createData.success === true) {
      const group = createData.group as Record<string, string>;
      roomId = group._id;
    } else {
      // Room already exists — look up by name
      const infoData = await this.rcRequest(
        'GET',
        `groups.info?roomName=${encodeURIComponent(roomName)}`,
      );

      if (infoData.success !== true) {
        throw new Error(
          `Failed to create or find RC room for booking ${bookingId}: ${JSON.stringify(infoData)}`,
        );
      }

      const group = infoData.group as Record<string, string>;
      roomId = group._id;
    }

    // Add both participants and enforce success so room access remains aligned.
    await this.addMemberToRoom(roomId, customerRcId);
    await this.addMemberToRoom(roomId, vendorRcId);

    return roomId;
  }

  /**
   * Ensures the given platform user is in the booking's RC room.
   * Used when an admin first accesses a booking chat.
   */
  async ensureUserInBookingRoom(
    roomId: string,
    userId: string,
    name: string,
    email: string,
  ): Promise<void> {
    const rcUserId = await this.ensureUser(userId, name, email);
    await this.addMemberToRoom(roomId, rcUserId);
  }

  private async addMemberToRoom(roomId: string, userId: string): Promise<void> {
    const result = await this.rcRequest('POST', 'groups.invite', {
      roomId,
      userId,
    });

    if (result.success === true) {
      return;
    }

    const errorType = String(result.errorType || '').toLowerCase();
    if (errorType.includes('already') && (errorType.includes('room') || errorType.includes('channel'))) {
      return;
    }

    throw new Error(
      `Failed to add RC user ${userId} to room ${roomId}: ${JSON.stringify(result)}`,
    );
  }

  // ── Token generation ────────────────────────────────────────────────────────

  /**
   * Generates a Rocket.Chat auth token for a platform user so they can
   * authenticate in the embedded iframe widget.
   */
  async generateUserLoginToken(
    userId: string,
    name: string,
    email: string,
  ): Promise<{ rcUserId: string; authToken: string }> {
    const rcUserId = await this.ensureUser(userId, name, email);

    const data = await this.rcRequest('POST', 'users.createToken', {
      userId: rcUserId,
      secret: this.userSecret,
    });

    if (data.success !== true) {
      throw new Error(
        `Failed to create RC token for user ${userId}: ${JSON.stringify(data)}`,
      );
    }

    const tokenData = data.data as Record<string, string>;
    return { rcUserId: tokenData.userId, authToken: tokenData.authToken };
  }
}
