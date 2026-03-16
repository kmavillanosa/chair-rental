import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PlatformSetting } from './entities/platform-setting.entity';
import { UpdateKycSettingsDto } from './dto/update-kyc-settings.dto';
import { UpdateFeatureFlagsSettingsDto } from './dto/update-feature-flags-settings.dto';

export type KycSettingsResponse = {
  vendorRegistrationEnabled: boolean;
  requireOtpBeforeVendorRegistration: boolean;
};

export type FeatureFlagsSettingsResponse = {
  allowKycWithoutMerchantId: boolean;
  allowOrdersWithoutPayment: boolean;
  maintenanceModeEnabled: boolean;
  defaultPlatformCommissionRatePercent: number;
  defaultDepositPercent: number;
  newVendorCompletedOrdersThreshold: number;
  newVendorMaxActiveListings: number;
  flaggedVendorMaxActiveListings: number;
  payoutDelayDaysForNewVendors: number;
  launchNoCommissionEnabled: boolean;
  launchNoCommissionUntil: string | null;
  cancellationFullRefundMinDays: number;
  cancellationHalfRefundMinDays: number;
  cancellationHalfRefundPercent: number;
};

const KYC_VENDOR_REGISTRATION_ENABLED_KEY =
  'kyc.vendorRegistrationEnabled';
const KYC_REQUIRE_OTP_KEY = 'kyc.requireOtpBeforeVendorRegistration';
const FLAGS_DEFAULT_PLATFORM_COMMISSION_RATE_PERCENT_KEY =
  'flags.defaultPlatformCommissionRatePercent';
const FLAGS_DEFAULT_DEPOSIT_PERCENT_KEY = 'flags.defaultDepositPercent';
const FLAGS_NEW_VENDOR_COMPLETED_ORDERS_THRESHOLD_KEY =
  'flags.newVendorCompletedOrdersThreshold';
const FLAGS_NEW_VENDOR_MAX_ACTIVE_LISTINGS_KEY =
  'flags.newVendorMaxActiveListings';
const FLAGS_FLAGGED_VENDOR_MAX_ACTIVE_LISTINGS_KEY =
  'flags.flaggedVendorMaxActiveListings';
const FLAGS_PAYOUT_DELAY_DAYS_FOR_NEW_VENDORS_KEY =
  'flags.payoutDelayDaysForNewVendors';
const FLAGS_ALLOW_KYC_WITHOUT_MERCHANT_ID_KEY =
  'flags.allowKycWithoutMerchantId';
const FLAGS_ALLOW_ORDERS_WITHOUT_PAYMENT_KEY =
  'flags.allowOrdersWithoutPayment';
const FLAGS_MAINTENANCE_MODE_ENABLED_KEY =
  'flags.maintenanceModeEnabled';
const FLAGS_LAUNCH_NO_COMMISSION_ENABLED_KEY =
  'flags.launchNoCommissionEnabled';
const FLAGS_LAUNCH_NO_COMMISSION_UNTIL_KEY = 'flags.launchNoCommissionUntil';
const FLAGS_CANCELLATION_FULL_REFUND_MIN_DAYS_KEY =
  'flags.cancellationFullRefundMinDays';
const FLAGS_CANCELLATION_HALF_REFUND_MIN_DAYS_KEY =
  'flags.cancellationHalfRefundMinDays';
const FLAGS_CANCELLATION_HALF_REFUND_PERCENT_KEY =
  'flags.cancellationHalfRefundPercent';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(PlatformSetting)
    private readonly settingsRepo: Repository<PlatformSetting>,
  ) {}

  async getKycSettings(): Promise<KycSettingsResponse> {
    const settingsMap = await this.findManyAsMap([
      KYC_VENDOR_REGISTRATION_ENABLED_KEY,
      KYC_REQUIRE_OTP_KEY,
    ]);

    return {
      vendorRegistrationEnabled: this.parseBooleanSetting(
        settingsMap.get(KYC_VENDOR_REGISTRATION_ENABLED_KEY),
        true,
      ),
      requireOtpBeforeVendorRegistration: this.parseBooleanSetting(
        settingsMap.get(KYC_REQUIRE_OTP_KEY),
        true,
      ),
    };
  }

  async updateKycSettings(
    payload: UpdateKycSettingsDto,
  ): Promise<KycSettingsResponse> {
    const current = await this.getKycSettings();

    const next: KycSettingsResponse = {
      vendorRegistrationEnabled:
        payload.vendorRegistrationEnabled ?? current.vendorRegistrationEnabled,
      requireOtpBeforeVendorRegistration:
        payload.requireOtpBeforeVendorRegistration ??
        current.requireOtpBeforeVendorRegistration,
    };

    await this.upsertSetting(
      KYC_VENDOR_REGISTRATION_ENABLED_KEY,
      String(next.vendorRegistrationEnabled),
    );
    await this.upsertSetting(
      KYC_REQUIRE_OTP_KEY,
      String(next.requireOtpBeforeVendorRegistration),
    );

    return next;
  }

  async getFeatureFlagsSettings(): Promise<FeatureFlagsSettingsResponse> {
    const settingsMap = await this.findManyAsMap([
      FLAGS_ALLOW_KYC_WITHOUT_MERCHANT_ID_KEY,
      FLAGS_ALLOW_ORDERS_WITHOUT_PAYMENT_KEY,
      FLAGS_MAINTENANCE_MODE_ENABLED_KEY,
      FLAGS_DEFAULT_PLATFORM_COMMISSION_RATE_PERCENT_KEY,
      FLAGS_DEFAULT_DEPOSIT_PERCENT_KEY,
      FLAGS_NEW_VENDOR_COMPLETED_ORDERS_THRESHOLD_KEY,
      FLAGS_NEW_VENDOR_MAX_ACTIVE_LISTINGS_KEY,
      FLAGS_FLAGGED_VENDOR_MAX_ACTIVE_LISTINGS_KEY,
      FLAGS_PAYOUT_DELAY_DAYS_FOR_NEW_VENDORS_KEY,
      FLAGS_LAUNCH_NO_COMMISSION_ENABLED_KEY,
      FLAGS_LAUNCH_NO_COMMISSION_UNTIL_KEY,
      FLAGS_CANCELLATION_FULL_REFUND_MIN_DAYS_KEY,
      FLAGS_CANCELLATION_HALF_REFUND_MIN_DAYS_KEY,
      FLAGS_CANCELLATION_HALF_REFUND_PERCENT_KEY,
    ]);

    const fallbackPercent = this.getPlatformCommissionFallbackPercent();
    const configuredPercent = this.parseNumberSetting(
      settingsMap.get(FLAGS_DEFAULT_PLATFORM_COMMISSION_RATE_PERCENT_KEY),
      fallbackPercent,
    );

    return {
      allowKycWithoutMerchantId: this.parseBooleanSetting(
        settingsMap.get(FLAGS_ALLOW_KYC_WITHOUT_MERCHANT_ID_KEY),
        this.getAllowKycWithoutMerchantIdFallback(),
      ),
      allowOrdersWithoutPayment: this.parseBooleanSetting(
        settingsMap.get(FLAGS_ALLOW_ORDERS_WITHOUT_PAYMENT_KEY),
        false,
      ),
      maintenanceModeEnabled: this.parseBooleanSetting(
        settingsMap.get(FLAGS_MAINTENANCE_MODE_ENABLED_KEY),
        false,
      ),
      defaultPlatformCommissionRatePercent:
        this.clampCommissionPercent(configuredPercent),
      defaultDepositPercent: this.clampDepositPercent(
        this.parseNumberSetting(settingsMap.get(FLAGS_DEFAULT_DEPOSIT_PERCENT_KEY), 30),
      ),
      newVendorCompletedOrdersThreshold: this.clampPositiveInt(
        this.parseNumberSetting(
          settingsMap.get(FLAGS_NEW_VENDOR_COMPLETED_ORDERS_THRESHOLD_KEY),
          5,
        ),
        0,
        500,
      ),
      newVendorMaxActiveListings: this.clampPositiveInt(
        this.parseNumberSetting(
          settingsMap.get(FLAGS_NEW_VENDOR_MAX_ACTIVE_LISTINGS_KEY),
          40,
        ),
        1,
        5000,
      ),
      flaggedVendorMaxActiveListings: this.clampPositiveInt(
        this.parseNumberSetting(
          settingsMap.get(FLAGS_FLAGGED_VENDOR_MAX_ACTIVE_LISTINGS_KEY),
          15,
        ),
        1,
        5000,
      ),
      payoutDelayDaysForNewVendors: this.clampPositiveInt(
        this.parseNumberSetting(
          settingsMap.get(FLAGS_PAYOUT_DELAY_DAYS_FOR_NEW_VENDORS_KEY),
          3,
        ),
        0,
        30,
      ),
      launchNoCommissionEnabled: this.parseBooleanSetting(
        settingsMap.get(FLAGS_LAUNCH_NO_COMMISSION_ENABLED_KEY),
        false,
      ),
      launchNoCommissionUntil: this.parseDateSetting(
        settingsMap.get(FLAGS_LAUNCH_NO_COMMISSION_UNTIL_KEY),
      ),
      cancellationFullRefundMinDays: this.clampPositiveInt(
        this.parseNumberSetting(
          settingsMap.get(FLAGS_CANCELLATION_FULL_REFUND_MIN_DAYS_KEY),
          3,
        ),
        0,
        365,
      ),
      cancellationHalfRefundMinDays: this.clampPositiveInt(
        this.parseNumberSetting(
          settingsMap.get(FLAGS_CANCELLATION_HALF_REFUND_MIN_DAYS_KEY),
          1,
        ),
        0,
        365,
      ),
      cancellationHalfRefundPercent: this.clampCommissionPercent(
        this.parseNumberSetting(
          settingsMap.get(FLAGS_CANCELLATION_HALF_REFUND_PERCENT_KEY),
          50,
        ),
      ),
    };
  }

  async updateFeatureFlagsSettings(
    payload: UpdateFeatureFlagsSettingsDto,
  ): Promise<FeatureFlagsSettingsResponse> {
    const current = await this.getFeatureFlagsSettings();

    const next: FeatureFlagsSettingsResponse = {
      allowKycWithoutMerchantId:
        payload.allowKycWithoutMerchantId ?? current.allowKycWithoutMerchantId,
      allowOrdersWithoutPayment:
        payload.allowOrdersWithoutPayment ?? current.allowOrdersWithoutPayment,
      maintenanceModeEnabled:
        payload.maintenanceModeEnabled ?? current.maintenanceModeEnabled,
      defaultPlatformCommissionRatePercent: this.clampCommissionPercent(
        payload.defaultPlatformCommissionRatePercent ??
          current.defaultPlatformCommissionRatePercent,
      ),
      defaultDepositPercent: this.clampDepositPercent(
        payload.defaultDepositPercent ?? current.defaultDepositPercent,
      ),
      newVendorCompletedOrdersThreshold: this.clampPositiveInt(
        payload.newVendorCompletedOrdersThreshold ??
          current.newVendorCompletedOrdersThreshold,
        0,
        500,
      ),
      newVendorMaxActiveListings: this.clampPositiveInt(
        payload.newVendorMaxActiveListings ?? current.newVendorMaxActiveListings,
        1,
        5000,
      ),
      flaggedVendorMaxActiveListings: this.clampPositiveInt(
        payload.flaggedVendorMaxActiveListings ??
          current.flaggedVendorMaxActiveListings,
        1,
        5000,
      ),
      payoutDelayDaysForNewVendors: this.clampPositiveInt(
        payload.payoutDelayDaysForNewVendors ??
          current.payoutDelayDaysForNewVendors,
        0,
        30,
      ),
      launchNoCommissionEnabled:
        payload.launchNoCommissionEnabled ?? current.launchNoCommissionEnabled,
      launchNoCommissionUntil:
        payload.launchNoCommissionUntil !== undefined
          ? this.parseDateSetting(payload.launchNoCommissionUntil)
          : current.launchNoCommissionUntil,
      cancellationFullRefundMinDays: this.clampPositiveInt(
        payload.cancellationFullRefundMinDays ??
          current.cancellationFullRefundMinDays,
        0,
        365,
      ),
      cancellationHalfRefundMinDays: this.clampPositiveInt(
        payload.cancellationHalfRefundMinDays ??
          current.cancellationHalfRefundMinDays,
        0,
        365,
      ),
      cancellationHalfRefundPercent: this.clampCommissionPercent(
        payload.cancellationHalfRefundPercent ??
          current.cancellationHalfRefundPercent,
      ),
    };

    await this.upsertSetting(
      FLAGS_ALLOW_KYC_WITHOUT_MERCHANT_ID_KEY,
      String(next.allowKycWithoutMerchantId),
    );
    await this.upsertSetting(
      FLAGS_ALLOW_ORDERS_WITHOUT_PAYMENT_KEY,
      String(next.allowOrdersWithoutPayment),
    );
    await this.upsertSetting(
      FLAGS_MAINTENANCE_MODE_ENABLED_KEY,
      String(next.maintenanceModeEnabled),
    );
    await this.upsertSetting(
      FLAGS_DEFAULT_PLATFORM_COMMISSION_RATE_PERCENT_KEY,
      String(next.defaultPlatformCommissionRatePercent),
    );
    await this.upsertSetting(
      FLAGS_DEFAULT_DEPOSIT_PERCENT_KEY,
      String(next.defaultDepositPercent),
    );
    await this.upsertSetting(
      FLAGS_NEW_VENDOR_COMPLETED_ORDERS_THRESHOLD_KEY,
      String(next.newVendorCompletedOrdersThreshold),
    );
    await this.upsertSetting(
      FLAGS_NEW_VENDOR_MAX_ACTIVE_LISTINGS_KEY,
      String(next.newVendorMaxActiveListings),
    );
    await this.upsertSetting(
      FLAGS_FLAGGED_VENDOR_MAX_ACTIVE_LISTINGS_KEY,
      String(next.flaggedVendorMaxActiveListings),
    );
    await this.upsertSetting(
      FLAGS_PAYOUT_DELAY_DAYS_FOR_NEW_VENDORS_KEY,
      String(next.payoutDelayDaysForNewVendors),
    );
    await this.upsertSetting(
      FLAGS_LAUNCH_NO_COMMISSION_ENABLED_KEY,
      String(next.launchNoCommissionEnabled),
    );
    await this.upsertSetting(
      FLAGS_LAUNCH_NO_COMMISSION_UNTIL_KEY,
      next.launchNoCommissionUntil || '',
    );
    await this.upsertSetting(
      FLAGS_CANCELLATION_FULL_REFUND_MIN_DAYS_KEY,
      String(next.cancellationFullRefundMinDays),
    );
    await this.upsertSetting(
      FLAGS_CANCELLATION_HALF_REFUND_MIN_DAYS_KEY,
      String(next.cancellationHalfRefundMinDays),
    );
    await this.upsertSetting(
      FLAGS_CANCELLATION_HALF_REFUND_PERCENT_KEY,
      String(next.cancellationHalfRefundPercent),
    );

    return next;
  }

  private async findManyAsMap(keys: string[]) {
    const rows = await this.settingsRepo.find({
      where: {
        key: In(keys),
      },
    });

    const map = new Map<string, string | null>();
    for (const row of rows) {
      map.set(row.key, row.value ?? null);
    }

    return map;
  }

  private parseBooleanSetting(value: string | null | undefined, fallback: boolean) {
    const normalized = String(value || '').trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }
    return fallback;
  }

  private parseNumberSetting(value: string | null | undefined, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return parsed;
  }

  private parseDateSetting(value: string | null | undefined) {
    const normalized = String(value || '').trim();
    if (!normalized) return null;
    const timestamp = Date.parse(normalized);
    if (Number.isNaN(timestamp)) return null;
    return normalized;
  }

  private getPlatformCommissionFallbackPercent() {
    const configured = Number(process.env.PLATFORM_COMMISSION_RATE);
    if (!Number.isFinite(configured) || configured < 0) {
      return 10;
    }

    if (configured <= 1) {
      return configured * 100;
    }

    return configured;
  }

  private getAllowKycWithoutMerchantIdFallback() {
    const onboardingRequired = this.parseBooleanSetting(
      process.env.PAYMONGO_VENDOR_ONBOARDING_REQUIRED,
      false,
    );
    return !onboardingRequired;
  }

  private clampCommissionPercent(value: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    if (parsed > 100) return 100;
    return Math.round(parsed * 100) / 100;
  }

  private clampDepositPercent(value: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 30;
    if (parsed > 100) return 100;
    return Math.round(parsed * 100) / 100;
  }

  private clampPositiveInt(value: number, min = 0, max = 365) {
    const parsed = Math.round(Number(value));
    if (!Number.isFinite(parsed)) return min;
    return Math.min(Math.max(parsed, min), max);
  }

  private async upsertSetting(key: string, value: string) {
    const existing = await this.settingsRepo.findOne({ where: { key } });
    if (existing) {
      existing.value = value;
      return this.settingsRepo.save(existing);
    }

    return this.settingsRepo.save(
      this.settingsRepo.create({
        key,
        value,
      }),
    );
  }
}
