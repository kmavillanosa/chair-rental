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

  it('resolves feature flags with clamped values', async () => {
    const { service, mocks } = createService();

    process.env.PLATFORM_COMMISSION_RATE = '0.25';

    mocks.settingsRepo.find.mockResolvedValue([
      { key: 'flags.allowOrdersWithoutPayment', value: 'true' },
      { key: 'flags.maintenanceModeEnabled', value: 'true' },
      { key: 'flags.defaultPlatformCommissionRatePercent', value: '150' },
      { key: 'flags.launchNoCommissionEnabled', value: 'true' },
      { key: 'flags.launchNoCommissionUntil', value: 'not-a-date' },
      { key: 'flags.cancellationFullRefundMinDays', value: '-5' },
      { key: 'flags.cancellationHalfRefundMinDays', value: '500' },
      { key: 'flags.cancellationHalfRefundPercent', value: '250' },
    ]);

    const result = await service.getFeatureFlagsSettings();

    expect(result).toEqual({
      allowOrdersWithoutPayment: true,
      maintenanceModeEnabled: true,
      showTestVendorsOnCustomerMap: false,
      defaultPlatformCommissionRatePercent: 100,
      defaultDepositPercent: 30,
      newVendorCompletedOrdersThreshold: 5,
      newVendorMaxActiveListings: 40,
      flaggedVendorMaxActiveListings: 15,
      payoutDelayDaysForNewVendors: 3,
      launchNoCommissionEnabled: true,
      launchNoCommissionUntil: null,
      cancellationFullRefundMinDays: 0,
      cancellationHalfRefundMinDays: 365,
      cancellationHalfRefundPercent: 100,
    });
  });

  it('updates feature flags using sanitized values and persists all keys', async () => {
    const { service, mocks } = createService();

    mocks.settingsRepo.find.mockResolvedValue([]);
    mocks.settingsRepo.findOne.mockResolvedValue(null);

    const result = await service.updateFeatureFlagsSettings({
      allowOrdersWithoutPayment: true,
      maintenanceModeEnabled: true,
      defaultPlatformCommissionRatePercent: 999,
      launchNoCommissionEnabled: true,
      launchNoCommissionUntil: 'invalid-date',
      cancellationFullRefundMinDays: -10,
      cancellationHalfRefundMinDays: 999,
      cancellationHalfRefundPercent: -1,
    });

    expect(result.allowOrdersWithoutPayment).toBe(true);
    expect(result.maintenanceModeEnabled).toBe(true);
    expect(result.defaultPlatformCommissionRatePercent).toBe(100);
    expect(result.defaultDepositPercent).toBe(30);
    expect(result.newVendorCompletedOrdersThreshold).toBe(5);
    expect(result.newVendorMaxActiveListings).toBe(40);
    expect(result.flaggedVendorMaxActiveListings).toBe(15);
    expect(result.payoutDelayDaysForNewVendors).toBe(3);
    expect(result.showTestVendorsOnCustomerMap).toBe(false);
    expect(result.cancellationFullRefundMinDays).toBe(0);
    expect(result.cancellationHalfRefundMinDays).toBe(365);
    expect(result.cancellationHalfRefundPercent).toBe(0);
    expect(result.launchNoCommissionUntil).toBeNull();
    expect(mocks.settingsRepo.save).toHaveBeenCalledTimes(14);
  });

  it('getKycSettings returns defaults when no settings are stored', async () => {
    const { service, mocks } = createService();
    mocks.settingsRepo.find.mockResolvedValue([]);

    const result = await service.getKycSettings();

    expect(result.vendorRegistrationEnabled).toBe(true);
    expect(result.requireOtpBeforeVendorRegistration).toBe(true);
  });

  it('getKycSettings reads stored boolean settings correctly', async () => {
    const { service, mocks } = createService();
    mocks.settingsRepo.find.mockResolvedValue([
      { key: 'kyc.vendorRegistrationEnabled', value: '0' },
      { key: 'kyc.requireOtpBeforeVendorRegistration', value: 'false' },
    ]);

    const result = await service.getKycSettings();

    expect(result.vendorRegistrationEnabled).toBe(false);
    expect(result.requireOtpBeforeVendorRegistration).toBe(false);
  });

  it('updateKycSettings saves both fields and returns the next state', async () => {
    const { service, mocks } = createService();
    mocks.settingsRepo.find.mockResolvedValue([]);
    mocks.settingsRepo.findOne.mockResolvedValue(null);

    const result = await service.updateKycSettings({
      vendorRegistrationEnabled: false,
      requireOtpBeforeVendorRegistration: false,
    });

    expect(result.vendorRegistrationEnabled).toBe(false);
    expect(result.requireOtpBeforeVendorRegistration).toBe(false);
    expect(mocks.settingsRepo.save).toHaveBeenCalledTimes(2);
  });

  it('upsertSetting updates existing record instead of creating new one', async () => {
    const { service, mocks } = createService();
    const existing = { key: 'flags.launchNoCommissionEnabled', value: 'false' };
    mocks.settingsRepo.findOne.mockResolvedValue(existing);
    mocks.settingsRepo.find.mockResolvedValue([
      { key: 'flags.launchNoCommissionEnabled', value: 'false' },
    ]);

    await service.updateFeatureFlagsSettings({
      allowOrdersWithoutPayment: false,
      maintenanceModeEnabled: false,
      defaultPlatformCommissionRatePercent: 10,
      launchNoCommissionEnabled: true,
      launchNoCommissionUntil: null,
      cancellationFullRefundMinDays: 3,
      cancellationHalfRefundMinDays: 1,
      cancellationHalfRefundPercent: 50,
    });

    expect(mocks.settingsRepo.save).toHaveBeenCalled();
  });

  it('getPlatformCommissionFallbackPercent converts fractional env value to percent', async () => {
    const { service, mocks } = createService();
    process.env.PLATFORM_COMMISSION_RATE = '0.08';
    mocks.settingsRepo.find.mockResolvedValue([]);

    const result = await service.getFeatureFlagsSettings();

    expect(result.defaultPlatformCommissionRatePercent).toBe(8);
  });

  it('getPlatformCommissionFallbackPercent uses 10 as default when env is not set', async () => {
    const { service, mocks } = createService();
    delete process.env.PLATFORM_COMMISSION_RATE;
    mocks.settingsRepo.find.mockResolvedValue([]);

    const result = await service.getFeatureFlagsSettings();

    expect(result.defaultPlatformCommissionRatePercent).toBe(10);
  });

  it('feature flags returns valid launchNoCommissionUntil when a valid date is stored', async () => {
    const { service, mocks } = createService();
    mocks.settingsRepo.find.mockResolvedValue([
      { key: 'flags.launchNoCommissionUntil', value: '2030-12-31' },
    ]);

    const result = await service.getFeatureFlagsSettings();

    expect(result.launchNoCommissionUntil).toBe('2030-12-31');
  });
});
