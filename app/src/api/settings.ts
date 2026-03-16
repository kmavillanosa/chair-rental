import api from './axios';

export type KycSettings = {
  vendorRegistrationEnabled: boolean;
  requireOtpBeforeVendorRegistration: boolean;
};

export type FeatureFlagsSettings = {
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

export const getKycSettings = () =>
  api.get<KycSettings>('/settings/kyc').then((response) => response.data);

export const getFeatureFlagsSettings = () =>
  api
    .get<FeatureFlagsSettings>('/settings/feature-flags')
    .then((response) => response.data);
