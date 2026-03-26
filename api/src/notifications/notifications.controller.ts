import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type SubscribeRequestBody = {
  subscription?: {
    endpoint?: string;
    expirationTime?: number | null;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
};

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('config')
  getConfig() {
    return this.notificationsService.getClientConfig();
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  async subscribe(
    @Req() req,
    @Body() body: SubscribeRequestBody,
    @Headers('user-agent') userAgent?: string,
  ) {
    if (!body?.subscription) {
      throw new BadRequestException('subscription is required');
    }

    await this.notificationsService.saveSubscription(
      req.user.id,
      body.subscription,
      userAgent,
    );

    return { success: true };
  }
}
