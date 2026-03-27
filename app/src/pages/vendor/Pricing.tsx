import { useEffect, useMemo, useState } from 'react';
import { Button, Select, Table, TextInput, Textarea } from 'flowbite-react';
import toast from 'react-hot-toast';
import VendorLayout from '../../components/layout/VendorLayout';
import { getMyPricingConfig, updateMyPricingConfig } from '../../api/payments';
import type { HelpersPricingMode, VendorPricingConfig } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency } from '../../utils/format';

type DeliveryTierForm = {
  minDistanceKm: string;
  maxDistanceKm: string;
  priceAmount: string;
};

type HelperTierForm = {
  helperCount: string;
  priceAmount: string;
};

type PricingForm = {
  deliveryFreeRadiusKm: string;
  deliveryPerKmEnabled: boolean;
  deliveryPerKmRate: string;
  helpersEnabled: boolean;
  helpersPricingMode: HelpersPricingMode;
  helpersFixedPrice: string;
  helpersHourlyRate: string;
  helpersMaxCount: string;
  waitingFeePerHour: string;
  nightSurcharge: string;
  minOrderAmount: string;
  isActive: boolean;
  notes: string;
};

const DEFAULT_FORM: PricingForm = {
  deliveryFreeRadiusKm: '2',
  deliveryPerKmEnabled: false,
  deliveryPerKmRate: '',
  helpersEnabled: true,
  helpersPricingMode: 'tiered',
  helpersFixedPrice: '',
  helpersHourlyRate: '',
  helpersMaxCount: '3',
  waitingFeePerHour: '100',
  nightSurcharge: '0',
  minOrderAmount: '0',
  isActive: true,
  notes: '',
};

const DEFAULT_DELIVERY_TIERS: DeliveryTierForm[] = [
  { minDistanceKm: '3', maxDistanceKm: '5', priceAmount: '100' },
  { minDistanceKm: '6', maxDistanceKm: '10', priceAmount: '200' },
  { minDistanceKm: '11', maxDistanceKm: '20', priceAmount: '400' },
];

const DEFAULT_HELPER_TIERS: HelperTierForm[] = [
  { helperCount: '1', priceAmount: '500' },
  { helperCount: '2', priceAmount: '900' },
  { helperCount: '3', priceAmount: '1300' },
];

function formatNumberInput(value: number | string | null | undefined) {
  if (value === null || value === undefined) return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return `${numeric}`;
}

function parseNonNegativeNumber(value: string, fieldLabel: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${fieldLabel} must be a non-negative number`);
  }
  return numeric;
}

function parsePositiveInteger(value: string, fieldLabel: string) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new Error(`${fieldLabel} must be a positive integer`);
  }
  return numeric;
}

export default function Pricing() {
  const [form, setForm] = useState<PricingForm>(DEFAULT_FORM);
  const [deliveryTiers, setDeliveryTiers] = useState<DeliveryTierForm[]>(
    DEFAULT_DELIVERY_TIERS,
  );
  const [helperTiers, setHelperTiers] = useState<HelperTierForm[]>(
    DEFAULT_HELPER_TIERS,
  );
  const [config, setConfig] = useState<VendorPricingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const deliveryPreviewRange = useMemo(() => {
    if (!deliveryTiers.length) return null;
    const prices = deliveryTiers
      .map((tier) => Number(tier.priceAmount))
      .filter((value) => Number.isFinite(value) && value >= 0);
    if (!prices.length) return null;
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [deliveryTiers]);

  const mapConfigToForm = (nextConfig: VendorPricingConfig) => {
    setConfig(nextConfig);
    setForm({
      deliveryFreeRadiusKm: formatNumberInput(nextConfig.deliveryFreeRadiusKm),
      deliveryPerKmEnabled: Boolean(nextConfig.deliveryPerKmEnabled),
      deliveryPerKmRate: formatNumberInput(nextConfig.deliveryPerKmRate),
      helpersEnabled: Boolean(nextConfig.helpersEnabled),
      helpersPricingMode: nextConfig.helpersPricingMode,
      helpersFixedPrice: formatNumberInput(nextConfig.helpersFixedPrice),
      helpersHourlyRate: formatNumberInput(nextConfig.helpersHourlyRate),
      helpersMaxCount: formatNumberInput(nextConfig.helpersMaxCount || 0),
      waitingFeePerHour: formatNumberInput(nextConfig.waitingFeePerHour),
      nightSurcharge: formatNumberInput(nextConfig.nightSurcharge),
      minOrderAmount: formatNumberInput(nextConfig.minOrderAmount),
      isActive: Boolean(nextConfig.isActive),
      notes: nextConfig.notes || '',
    });
    setDeliveryTiers(
      (nextConfig.deliveryTiers || []).length
        ? nextConfig.deliveryTiers.map((tier) => ({
          minDistanceKm: formatNumberInput(tier.minDistanceKm),
          maxDistanceKm: formatNumberInput(tier.maxDistanceKm),
          priceAmount: formatNumberInput(tier.priceAmount),
        }))
        : DEFAULT_DELIVERY_TIERS,
    );
    setHelperTiers(
      (nextConfig.helperTiers || []).length
        ? nextConfig.helperTiers.map((tier) => ({
          helperCount: formatNumberInput(tier.helperCount),
          priceAmount: formatNumberInput(tier.priceAmount),
        }))
        : DEFAULT_HELPER_TIERS,
    );
  };

  const load = () =>
    getMyPricingConfig()
      .then(mapConfigToForm)
      .catch((error: any) => {
        toast.error(
          error?.response?.data?.message || 'Failed to load pricing configuration',
        );
      })
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const updateDeliveryTier = (
    index: number,
    field: keyof DeliveryTierForm,
    value: string,
  ) => {
    setDeliveryTiers((current) =>
      current.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, [field]: value } : tier,
      ),
    );
  };

  const addDeliveryTier = () => {
    const lastMax = Number(deliveryTiers[deliveryTiers.length - 1]?.maxDistanceKm || 0);
    const nextMin = Number.isFinite(lastMax) ? lastMax + 1 : 1;
    setDeliveryTiers((current) => [
      ...current,
      {
        minDistanceKm: `${nextMin}`,
        maxDistanceKm: `${nextMin + 1}`,
        priceAmount: '0',
      },
    ]);
  };

  const removeDeliveryTier = (index: number) => {
    setDeliveryTiers((current) => current.filter((_, tierIndex) => tierIndex !== index));
  };

  const updateHelperTier = (
    index: number,
    field: keyof HelperTierForm,
    value: string,
  ) => {
    setHelperTiers((current) =>
      current.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, [field]: value } : tier,
      ),
    );
  };

  const addHelperTier = () => {
    const nextCount = helperTiers.length
      ? Number(helperTiers[helperTiers.length - 1].helperCount || 0) + 1
      : 1;
    setHelperTiers((current) => [
      ...current,
      { helperCount: `${Math.max(1, nextCount)}`, priceAmount: '0' },
    ]);
  };

  const removeHelperTier = (index: number) => {
    setHelperTiers((current) => current.filter((_, tierIndex) => tierIndex !== index));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const parsedDeliveryTiers = deliveryTiers.map((tier) => ({
        minDistanceKm: parseNonNegativeNumber(tier.minDistanceKm, 'Delivery min distance'),
        maxDistanceKm: parseNonNegativeNumber(tier.maxDistanceKm, 'Delivery max distance'),
        priceAmount: parseNonNegativeNumber(tier.priceAmount, 'Delivery tier amount'),
      }));

      const parsedHelperTiers = helperTiers.map((tier) => ({
        helperCount: parsePositiveInteger(tier.helperCount, 'Helper count'),
        priceAmount: parseNonNegativeNumber(tier.priceAmount, 'Helper tier amount'),
      }));

      if (!form.deliveryPerKmEnabled && parsedDeliveryTiers.length === 0) {
        throw new Error('At least one delivery tier is required when per-km pricing is disabled.');
      }

      if (
        form.helpersEnabled &&
        form.helpersPricingMode === 'tiered' &&
        parsedHelperTiers.length === 0
      ) {
        throw new Error('At least one helper tier is required for tiered helper pricing.');
      }

      const payload: Record<string, unknown> = {
        deliveryFreeRadiusKm: parseNonNegativeNumber(
          form.deliveryFreeRadiusKm,
          'Free delivery radius',
        ),
        deliveryPerKmEnabled: form.deliveryPerKmEnabled,
        deliveryPerKmRate:
          form.deliveryPerKmEnabled && form.deliveryPerKmRate.trim() !== ''
            ? parseNonNegativeNumber(form.deliveryPerKmRate, 'Per-km rate')
            : null,
        helpersEnabled: form.helpersEnabled,
        helpersPricingMode: form.helpersPricingMode,
        helpersFixedPrice:
          form.helpersPricingMode === 'fixed' && form.helpersFixedPrice.trim() !== ''
            ? parseNonNegativeNumber(form.helpersFixedPrice, 'Fixed helper fee')
            : null,
        helpersHourlyRate:
          form.helpersPricingMode === 'hourly' && form.helpersHourlyRate.trim() !== ''
            ? parseNonNegativeNumber(form.helpersHourlyRate, 'Hourly helper fee')
            : null,
        helpersMaxCount: parseNonNegativeNumber(form.helpersMaxCount, 'Max helpers'),
        waitingFeePerHour: parseNonNegativeNumber(form.waitingFeePerHour, 'Waiting fee'),
        nightSurcharge: parseNonNegativeNumber(form.nightSurcharge, 'Night surcharge'),
        minOrderAmount: parseNonNegativeNumber(form.minOrderAmount, 'Minimum order'),
        isActive: form.isActive,
        notes: form.notes.trim(),
      };

      if (!form.deliveryPerKmEnabled) {
        payload.deliveryTiers = parsedDeliveryTiers;
      }

      if (form.helpersEnabled && form.helpersPricingMode === 'tiered') {
        payload.helperTiers = parsedHelperTiers;
      }

      const updated = await updateMyPricingConfig(payload);
      mapConfigToForm(updated);
      toast.success('Pricing configuration updated');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to save pricing configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <VendorLayout><LoadingSpinner /></VendorLayout>;

  return (
    <VendorLayout>
      <h1 className="text-4xl font-bold text-gray-900 mb-6">Pricing Configuration</h1>

      <div className="bg-white rounded-2xl shadow p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextInput
          type="number"
          min="0"
          step="0.1"
          addon="Free delivery radius (km)"
          value={form.deliveryFreeRadiusKm}
          onChange={(event) => setForm((current) => ({ ...current, deliveryFreeRadiusKm: event.target.value }))}
        />
        <TextInput
          type="number"
          min="0"
          step="1"
          addon="Max helpers"
          value={form.helpersMaxCount}
          onChange={(event) => setForm((current) => ({ ...current, helpersMaxCount: event.target.value }))}
        />
        <TextInput
          type="number"
          min="0"
          step="0.01"
          addon="Waiting fee per hour"
          value={form.waitingFeePerHour}
          onChange={(event) => setForm((current) => ({ ...current, waitingFeePerHour: event.target.value }))}
        />
        <TextInput
          type="number"
          min="0"
          step="0.01"
          addon="Night surcharge"
          value={form.nightSurcharge}
          onChange={(event) => setForm((current) => ({ ...current, nightSurcharge: event.target.value }))}
        />
        <TextInput
          type="number"
          min="0"
          step="0.01"
          addon="Minimum order amount"
          value={form.minOrderAmount}
          onChange={(event) => setForm((current) => ({ ...current, minOrderAmount: event.target.value }))}
        />
        <div className="flex items-center rounded-xl border border-slate-200 px-3 py-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            Pricing config is active
          </label>
        </div>

        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Delivery mode
            </label>
            <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.deliveryPerKmEnabled}
                onChange={(event) => setForm((current) => ({ ...current, deliveryPerKmEnabled: event.target.checked }))}
              />
              Enable per-km pricing
            </label>
            {form.deliveryPerKmEnabled && (
              <TextInput
                type="number"
                min="0"
                step="0.01"
                addon="Per-km rate"
                value={form.deliveryPerKmRate}
                onChange={(event) => setForm((current) => ({ ...current, deliveryPerKmRate: event.target.value }))}
              />
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Helper pricing
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.helpersEnabled}
                onChange={(event) => setForm((current) => ({ ...current, helpersEnabled: event.target.checked }))}
              />
              Helpers enabled
            </label>
            <Select
              value={form.helpersPricingMode}
              onChange={(event) => setForm((current) => ({
                ...current,
                helpersPricingMode: event.target.value as HelpersPricingMode,
              }))}
              disabled={!form.helpersEnabled}
            >
              <option value="tiered">Tiered</option>
              <option value="fixed">Fixed per helper</option>
              <option value="hourly">Hourly per helper</option>
            </Select>
            {form.helpersEnabled && form.helpersPricingMode === 'fixed' && (
              <TextInput
                type="number"
                min="0"
                step="0.01"
                addon="Fixed helper fee"
                value={form.helpersFixedPrice}
                onChange={(event) => setForm((current) => ({ ...current, helpersFixedPrice: event.target.value }))}
              />
            )}
            {form.helpersEnabled && form.helpersPricingMode === 'hourly' && (
              <TextInput
                type="number"
                min="0"
                step="0.01"
                addon="Hourly helper fee"
                value={form.helpersHourlyRate}
                onChange={(event) => setForm((current) => ({ ...current, helpersHourlyRate: event.target.value }))}
              />
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          <Textarea
            rows={3}
            placeholder="Internal notes for this pricing setup"
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          />
        </div>

        {deliveryPreviewRange && (
          <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            Current delivery price range: {formatCurrency(deliveryPreviewRange.min)} - {formatCurrency(deliveryPreviewRange.max)}
          </div>
        )}
      </div>

      {!form.deliveryPerKmEnabled && (
        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Delivery Distance Tiers</h2>
            <Button color="light" onClick={addDeliveryTier}>+ Add tier</Button>
          </div>

          <div className="space-y-3 md:hidden">
            {deliveryTiers.map((tier, index) => (
              <article key={`delivery-tier-mobile-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Tier {index + 1}</p>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  <TextInput
                    type="number"
                    min="0"
                    step="0.1"
                    addon="Min km"
                    value={tier.minDistanceKm}
                    onChange={(event) => updateDeliveryTier(index, 'minDistanceKm', event.target.value)}
                  />
                  <TextInput
                    type="number"
                    min="0"
                    step="0.1"
                    addon="Max km"
                    value={tier.maxDistanceKm}
                    onChange={(event) => updateDeliveryTier(index, 'maxDistanceKm', event.target.value)}
                  />
                  <TextInput
                    type="number"
                    min="0"
                    step="0.01"
                    addon="Price"
                    value={tier.priceAmount}
                    onChange={(event) => updateDeliveryTier(index, 'priceAmount', event.target.value)}
                  />
                  <Button
                    color="failure"
                    size="sm"
                    onClick={() => removeDeliveryTier(index)}
                    disabled={deliveryTiers.length <= 1}
                  >
                    Remove Tier
                  </Button>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
            <Table striped className="mobile-friendly-table">
              <Table.Head>
                <Table.HeadCell>Min km</Table.HeadCell>
                <Table.HeadCell>Max km</Table.HeadCell>
                <Table.HeadCell>Price</Table.HeadCell>
                <Table.HeadCell>Action</Table.HeadCell>
              </Table.Head>
              <Table.Body>
                {deliveryTiers.map((tier, index) => (
                  <Table.Row key={`delivery-tier-${index}`}>
                    <Table.Cell>
                      <TextInput
                        type="number"
                        min="0"
                        step="0.1"
                        value={tier.minDistanceKm}
                        onChange={(event) => updateDeliveryTier(index, 'minDistanceKm', event.target.value)}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <TextInput
                        type="number"
                        min="0"
                        step="0.1"
                        value={tier.maxDistanceKm}
                        onChange={(event) => updateDeliveryTier(index, 'maxDistanceKm', event.target.value)}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <TextInput
                        type="number"
                        min="0"
                        step="0.01"
                        value={tier.priceAmount}
                        onChange={(event) => updateDeliveryTier(index, 'priceAmount', event.target.value)}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        color="failure"
                        size="xs"
                        onClick={() => removeDeliveryTier(index)}
                        disabled={deliveryTiers.length <= 1}
                      >
                        Remove
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </div>
      )}

      {form.helpersEnabled && form.helpersPricingMode === 'tiered' && (
        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Helper Tiers</h2>
            <Button color="light" onClick={addHelperTier}>+ Add tier</Button>
          </div>

          <div className="space-y-3 md:hidden">
            {helperTiers.map((tier, index) => (
              <article key={`helper-tier-mobile-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Tier {index + 1}</p>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  <TextInput
                    type="number"
                    min="1"
                    step="1"
                    addon="Helpers"
                    value={tier.helperCount}
                    onChange={(event) => updateHelperTier(index, 'helperCount', event.target.value)}
                  />
                  <TextInput
                    type="number"
                    min="0"
                    step="0.01"
                    addon="Price"
                    value={tier.priceAmount}
                    onChange={(event) => updateHelperTier(index, 'priceAmount', event.target.value)}
                  />
                  <Button
                    color="failure"
                    size="sm"
                    onClick={() => removeHelperTier(index)}
                    disabled={helperTiers.length <= 1}
                  >
                    Remove Tier
                  </Button>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
            <Table striped className="mobile-friendly-table">
              <Table.Head>
                <Table.HeadCell>Helpers</Table.HeadCell>
                <Table.HeadCell>Price</Table.HeadCell>
                <Table.HeadCell>Action</Table.HeadCell>
              </Table.Head>
              <Table.Body>
                {helperTiers.map((tier, index) => (
                  <Table.Row key={`helper-tier-${index}`}>
                    <Table.Cell>
                      <TextInput
                        type="number"
                        min="1"
                        step="1"
                        value={tier.helperCount}
                        onChange={(event) => updateHelperTier(index, 'helperCount', event.target.value)}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <TextInput
                        type="number"
                        min="0"
                        step="0.01"
                        value={tier.priceAmount}
                        onChange={(event) => updateHelperTier(index, 'priceAmount', event.target.value)}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        color="failure"
                        size="xs"
                        onClick={() => removeHelperTier(index)}
                        disabled={helperTiers.length <= 1}
                      >
                        Remove
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </div>
      )}

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button size="xl" onClick={handleSave} isProcessing={saving} disabled={saving}>
          Save Pricing Configuration
        </Button>
      </div>

      {config && (
        <div className="mt-6 text-xs text-slate-500">
          Last updated: {new Date(config.updatedAt).toLocaleString()}
        </div>
      )}
    </VendorLayout>
  );
}
