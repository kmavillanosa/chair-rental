import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let SettingsService: any;

function createService() {
  const settingsRepo = {
    find: vi.fn(),
    findOne: vi.fn(),
    save: vi.fn(async (value) => value),
    create: vi.fn((value) => value),
  };

  const service = new SettingsService(settingsRepo as any);

  return {
    service,
    mocks: {
      settingsRepo,
    },
  };
}

describe('SettingsService', () => {
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    ({ SettingsService } = await import('./settings.service'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it('resolves feature flags with clamped values and onboarding fallback', async () => {
    const { service, mocks } = createService();

    process.env.PLATFORM_COMMISSION_RATE = '0.25';
    process.env.PAYMONGO_VENDOR_ONBOARDING_REQUIRED = 'true';

    mocks.settingsRepo.find.mockResolvedValue([
      { key: 'flags.defaultPlatformCommissionRatePercent', value: '150' },
      { key: 'flags.launchNoCommissionEnabled', value: 'true' },
      { key: 'flags.launchNoCommissionUntil', value: 'not-a-date' },
      { key: 'flags.cancellationFullRefundMinDays', value: '-5' },
      { key: 'flags.cancellationHalfRefundMinDays', value: '500' },
      { key: 'flags.cancellationHalfRefundPercent', value: '250' },
    ]);

    const result = await service.getFeatureFlagsSettings();

    expect(result).toEqual({
      allowKycWithoutMerchantId: false,
      defaultPlatformCommissionRatePercent: 100,
      launchNoCommissionEnabled: true,
      launchNoCommissionUntil: null,
      cancellationFullRefundMinDays: 0,
      cancellationHalfRefundMinDays: 365,
      cancellationHalfRefundPercent: 100,
    });
  });

  it('updates feature flags using sanitized values and persists all keys', async () => {
    const { service, mocks } = createService();

    process.env.PAYMONGO_VENDOR_ONBOARDING_REQUIRED = 'false';
    mocks.settingsRepo.find.mockResolvedValue([]);
    mocks.settingsRepo.findOne.mockResolvedValue(null);

    const result = await service.updateFeatureFlagsSettings({
      allowKycWithoutMerchantId: true,
      defaultPlatformCommissionRatePercent: 999,
      launchNoCommissionEnabled: true,
      launchNoCommissionUntil: 'invalid-date',
      cancellationFullRefundMinDays: -10,
      cancellationHalfRefundMinDays: 999,
      cancellationHalfRefundPercent: -1,
    });

    expect(result.defaultPlatformCommissionRatePercent).toBe(100);
    expect(result.cancellationFullRefundMinDays).toBe(0);
    expect(result.cancellationHalfRefundMinDays).toBe(365);
    expect(result.cancellationHalfRefundPercent).toBe(0);
    expect(result.launchNoCommissionUntil).toBeNull();
    expect(mocks.settingsRepo.save).toHaveBeenCalledTimes(7);
  });
});
