import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Post('impersonate')
  async impersonate(
    @Req() req,
    @Body('targetUserId') targetUserId: string,
  ) {
    const normalizedTargetUserId = String(targetUserId || '').trim();
    if (!normalizedTargetUserId) {
      throw new BadRequestException('targetUserId is required');
    }

    return this.authService.impersonateAs(req.user.id, normalizedTargetUserId);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req, @Res() res) {
    const customerFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const staffFrontendUrl = process.env.STAFF_FRONTEND_URL || 'http://localhost:5174';

    try {
      const forwardedFor = String(req.headers['x-forwarded-for'] || '').trim();
      const firstForwardedIp = forwardedFor
        ? forwardedFor.split(',')[0].trim()
        : '';
      const requestIp = firstForwardedIp || req.ip || null;

      const { access_token, user } = await this.authService.login(
        req.user,
        requestIp || undefined,
      );
      const frontendUrl = user.role === 'admin' || user.role === 'vendor'
        ? staffFrontendUrl
        : customerFrontendUrl;

      return res.redirect(
        `${frontendUrl}/auth/callback?token=${access_token}&role=${user.role}`,
      );
    } catch (error) {
      const role = req.user?.role;
      const loginUrl =
        role === 'admin' || role === 'vendor'
          ? `${staffFrontendUrl}/login`
          : `${customerFrontendUrl}/login`;
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to sign in right now.';

      return res.redirect(
        `${loginUrl}?error=${encodeURIComponent(message)}`,
      );
    }
  }
}
