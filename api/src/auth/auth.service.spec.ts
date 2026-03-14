import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const UserRole = {
  ADMIN: 'admin',
  VENDOR: 'vendor',
  CUSTOMER: 'customer',
} as const;

vi.mock('../users/entities/user.entity', () => ({
  UserRole,
}));

vi.mock('../vendors/entities/vendor.entity', () => ({
  Vendor: class Vendor {},
}));

type TestUser = {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: (typeof UserRole)[keyof typeof UserRole];
  googleId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

let AuthService: any;

function buildUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    avatar: null as any,
    role: UserRole.CUSTOMER,
    googleId: 'google-1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  beforeAll(async () => {
    ({ AuthService } = await import('./auth.service'));
  });

  const jwtService = {
    sign: vi.fn(() => 'signed-token'),
  };

  const usersService = {
    findById: vi.fn(),
  };

  const vendorsRepo = {
    findOne: vi.fn(),
  };

  let service: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      jwtService as any,
      usersService as any,
      vendorsRepo as any,
    );
  });

  it('returns an active customer user', async () => {
    const customer = buildUser({ role: UserRole.CUSTOMER });
    usersService.findById.mockResolvedValue(customer);

    const result = await service.validateAuthenticatedUser(customer.id);

    expect(result).toBe(customer);
    expect(vendorsRepo.findOne).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when account is missing', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(service.validateAuthenticatedUser('missing-user')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws ForbiddenException for inactive account during login flow', async () => {
    usersService.findById.mockResolvedValue(buildUser({ isActive: false }));

    await expect(service.validateAuthenticatedUser('inactive-user', true)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws UnauthorizedException when vendor record is missing', async () => {
    const vendorUser = buildUser({ role: UserRole.VENDOR });
    usersService.findById.mockResolvedValue(vendorUser);
    vendorsRepo.findOne.mockResolvedValue(null);

    await expect(service.validateAuthenticatedUser(vendorUser.id)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws ForbiddenException when vendor record is missing during login', async () => {
    const vendorUser = buildUser({ role: UserRole.VENDOR });
    usersService.findById.mockResolvedValue(vendorUser);
    vendorsRepo.findOne.mockResolvedValue(null);

    await expect(service.validateAuthenticatedUser(vendorUser.id, true)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws UnauthorizedException when vendor is inactive', async () => {
    const vendorUser = buildUser({ role: UserRole.VENDOR });
    usersService.findById.mockResolvedValue(vendorUser);
    vendorsRepo.findOne.mockResolvedValue({
      userId: vendorUser.id,
      isActive: false,
    });

    await expect(service.validateAuthenticatedUser(vendorUser.id)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns signed token and sanitized user payload from login', async () => {
    const user = buildUser({ id: 'user-42', role: UserRole.CUSTOMER });
    usersService.findById.mockResolvedValue(user);

    const result = await service.login(user);

    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    expect(result).toEqual({
      access_token: 'signed-token',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
      },
    });
  });
});
