import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';
import { Vendor } from '../vendors/entities/vendor.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Vendor)
    private readonly vendorsRepo: Repository<Vendor>,
  ) {}

  async login(user: User, requestIp?: string) {
    const authenticatedUser = await this.validateAuthenticatedUser(user.id, true);

    const normalizedIp = this.normalizeIp(requestIp);
    if (normalizedIp) {
      try {
        await this.usersRepo.update(authenticatedUser.id, {
          lastLoginIp: normalizedIp,
        });
      } catch (error) {
        this.logger.warn(
          `Failed to persist last login IP for user ${authenticatedUser.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const payload = {
      sub: authenticatedUser.id,
      email: authenticatedUser.email,
      role: authenticatedUser.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: authenticatedUser.id,
        email: authenticatedUser.email,
        name: authenticatedUser.name,
        role: authenticatedUser.role,
        avatar: authenticatedUser.avatar,
      },
    };
  }

  async validateAuthenticatedUser(
    userId: string,
    forLogin = false,
  ): Promise<User> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Account not found.');
    }

    if (!user.isActive) {
      if (forLogin) {
        throw new ForbiddenException('Your account is inactive. Please contact support.');
      }
      throw new UnauthorizedException('Account is inactive.');
    }

    if (user.role === UserRole.VENDOR) {
      const vendor = await this.vendorsRepo.findOne({
        where: { userId: user.id },
      });

      if (!vendor) {
        if (forLogin) {
          throw new ForbiddenException('Vendor access is unavailable for this account.');
        }
        throw new UnauthorizedException('Vendor access is unavailable.');
      }

      if (!vendor.isActive) {
        if (forLogin) {
          throw new ForbiddenException(
            'Your vendor account is inactive. Please contact the administrator.',
          );
        }
        throw new UnauthorizedException('Vendor account is inactive.');
      }
    }

    return user;
  }

  private normalizeIp(requestIp?: string) {
    const raw = String(requestIp || '').trim();
    if (!raw) return null;

    const first = raw.split(',')[0].trim();
    if (!first) return null;
    return first.slice(0, 255);
  }
}
