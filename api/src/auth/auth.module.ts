import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { Vendor } from '../vendors/entities/vendor.entity';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([Vendor]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'fallback_secret_change_in_production',
      signOptions: { expiresIn: process.env.JWT_EXPIRY || '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
