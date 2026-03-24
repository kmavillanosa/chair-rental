import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    role?: string;
    impersonatedByUserId?: string;
    impersonatedByRole?: string;
  }) {
    const user = await this.authService.validateAuthenticatedUser(payload.sub);

    if (payload.impersonatedByUserId) {
      return {
        ...user,
        impersonation: {
          active: true,
          impersonatedByUserId: payload.impersonatedByUserId,
          impersonatedByRole: payload.impersonatedByRole || null,
        },
      };
    }

    return user;
  }
}
