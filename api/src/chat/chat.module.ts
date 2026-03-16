import { Module } from '@nestjs/common';
import { RocketChatService } from './rocketchat.service';
import { ChatController } from './chat.controller';

@Module({
  providers: [RocketChatService],
  controllers: [ChatController],
  exports: [RocketChatService],
})
export class ChatModule {}
