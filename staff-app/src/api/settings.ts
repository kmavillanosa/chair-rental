import api from './axios';

export type KycSettings = {
  vendorRegistrationEnabled: boolean;
  requireOtpBeforeVendorRegistration: boolean;
};

export type FeatureFlagsSettings = {
  allowKycWithoutMerchantId: boolean;
  defaultPlatformCommissionRatePercent: number;
  launchNoCommissionEnabled: boolean;
  launchNoCommissionUntil: string | null;
  cancellationFullRefundMinDays: number;
  cancellationHalfRefundMinDays: number;
  cancellationHalfRefundPercent: number;
};

export const getKycSettings = () =>
  api.get<KycSettings>('/settings/kyc').then((response) => response.data);

export const updateKycSettings = (payload: Partial<KycSettings>) =>
  api.patch<KycSettings>('/settings/kyc', payload).then((response) => response.data);

export const getFeatureFlagsSettings = () =>
  api
    .get<FeatureFlagsSettings>('/settings/feature-flags')
    .then((response) => response.data);

export const updateFeatureFlagsSettings = (
  payload: Partial<FeatureFlagsSettings>,
) =>
  api
    .patch<FeatureFlagsSettings>('/settings/feature-flags', payload)
    .then((response) => response.data);
