import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req, @Res() res) {
    const { access_token, user } = this.authService.login(req.user);
    const customerFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const staffFrontendUrl = process.env.STAFF_FRONTEND_URL || 'http://localhost:5174';
    const frontendUrl = user.role === 'admin' || user.role === 'vendor'
      ? staffFrontendUrl
      : customerFrontendUrl;
    return res.redirect(
      `${frontendUrl}/auth/callback?token=${access_token}&role=${user.role}`,
    );
  }
}
