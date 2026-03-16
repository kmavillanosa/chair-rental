import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'crypto';
import { RocketChatService } from './rocketchat.service';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly rocketchatService: RocketChatService) {}

  /**
   * Rocket.Chat outgoing webhook endpoint.
   * Configure in RC Admin > Integrations > Outgoing Webhook:
   *   URL: https://your-domain/chat/webhook
   *   Token (optional): matches ROCKETCHAT_WEBHOOK_SECRET env var
   *
   * Triggered events: message sent, file uploaded, etc.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Headers('x-rocketchat-signature') signature: string | undefined,
    @Body() body: unknown,
  ) {
    const secret = this.rocketchatService.webhookSecret;

    if (secret) {
      if (!signature) {
        throw new ForbiddenException('Missing webhook signature');
      }

      const expected = createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex');

      const sigBuf = Buffer.from(signature, 'utf8');
      const expBuf = Buffer.from(expected, 'utf8');

      if (
        sigBuf.length !== expBuf.length ||
        !timingSafeEqual(sigBuf, expBuf)
      ) {
        throw new ForbiddenException('Invalid webhook signature');
      }
    }

    // Log event for observability — future handlers can emit notifications,
    // flag messages for disputes, etc.
    this.logger.log(
      `RC webhook received: ${JSON.stringify(body).substring(0, 200)}`,
    );

    return { ok: true };
  }
}
