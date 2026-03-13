import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, TextInput } from 'flowbite-react';
import toast from 'react-hot-toast';
import L from 'leaflet';
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { getVendorBySlug } from '../../api/vendors';
import { getInventory } from '../../api/items';
import { checkAvailability, createBooking } from '../../api/bookings';
import { getVendorDeliveryRates } from '../../api/payments';
import { getFeatureFlagsSettings } from '../../api/settings';
import type { Vendor, InventoryItem, DeliveryRate } from '../../types';
import { formatCurrency, calcDays, formatDate } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';

type Coordinates = {
  lat: number;
  lng: number;
};

const DEFAULT_DELIVERY_MAP_CENTER: [number, number] = [14.5995, 120.9842];

const deliveryPinIcon = L.icon({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function formatCoordinates(point: Coordinates) {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}

function DeliveryLocationPicker({
  onPick,
}: {
  onPick: (nextCoordinates: Coordinates) => void;
}) {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  return null;
}

function DeliveryMapCenterController({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);

  return null;
}

function haversineDistanceKm(a: Coordinates, b: Coordinates) {
  const earthRadiusKm = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const aTerm =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const cTerm = 2 * Math.atan2(Math.sqrt(aTerm), Math.sqrt(1 - aTerm));

  return earthRadiusKm * cTerm;
}

function estimateDeliveryRate(
  distanceKm: number,
  helpersNeeded: number,
  rates: DeliveryRate[],
) {
  const normalizedRates = rates
    .map((rate) => {
      const parsedDistance = Number(rate.distanceKm);
      const parsedCharge = Number(rate.chargeAmount);
      const parsedHelpers = Number(rate.helpersCount);

      return {
        distanceKm: Number.isFinite(parsedDistance) ? parsedDistance : 0,
        chargeAmount: Number.isFinite(parsedCharge) ? parsedCharge : 0,
        helpersCount:
          Number.isFinite(parsedHelpers) && parsedHelpers >= 0
            ? Math.floor(parsedHelpers)
            : 0,
      };
    })
    .sort((left, right) => {
      if (left.distanceKm !== right.distanceKm) {
        return left.distanceKm - right.distanceKm;
      }
      return left.helpersCount - right.helpersCount;
    });

  if (!normalizedRates.length) return null;

  const helperScopedRates = normalizedRates.filter(
    (rate) => rate.helpersCount >= helpersNeeded,
  );
  const candidateRates = helperScopedRates.length
    ? helperScopedRates
    : normalizedRates;

  return (
    candidateRates.find((rate) => rate.distanceKm >= distanceKm) ||
    candidateRates[candidateRates.length - 1]
  );
}

function isNoCommissionWindowActive(until: string | null) {
  if (!until) return true;
  const timestamp = Date.parse(until);
  if (Number.isNaN(timestamp)) return true;
  return Date.now() <= timestamp;
}

export default function BookingFlow() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token } = useAuthStore();
  const [step, setStep] = useState(1);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [deliveryRates, setDeliveryRates] = useState<DeliveryRate[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState<number | null>(null);
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<Coordinates | null>(null);
  const [deliveryMapCenter, setDeliveryMapCenter] = useState<[number, number]>(
    DEFAULT_DELIVERY_MAP_CENTER,
  );
  const [deliveryCoordinatesMode, setDeliveryCoordinatesMode] = useState<
    'auto' | 'manual'
  >('auto');
  const [locatingDelivery, setLocatingDelivery] = useState(false);
  const [estimatingDelivery, setEstimatingDelivery] = useState(false);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, number>>({});
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [hasPredefinedDates, setHasPredefinedDates] = useState(false);
  const [platformCommissionRatePercent, setPlatformCommissionRatePercent] =
    useState(10);
  const [launchNoCommissionEnabled, setLaunchNoCommissionEnabled] =
    useState(false);
  const [launchNoCommissionUntil, setLaunchNoCommissionUntil] = useState<string | null>(null);

  const parsedHelpersNeeded = useMemo(() => {
    const parsed = Number(searchParams.get('helpersNeeded'));
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }, [searchParams]);

  const fallbackSearchCoordinates = useMemo(() => {
    const lat = Number(searchParams.get('lat'));
    const lng = Number(searchParams.get('lng'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng } as Coordinates;
  }, [searchParams]);

  const setDeliveryCoordinatesWithMode = useCallback(
    (nextCoordinates: Coordinates, mode: 'auto' | 'manual') => {
      const normalized = {
        lat: Number(nextCoordinates.lat.toFixed(6)),
        lng: Number(nextCoordinates.lng.toFixed(6)),
      };

      setDeliveryCoordinates(normalized);
      setDeliveryMapCenter([normalized.lat, normalized.lng]);
      setDeliveryCoordinatesMode(mode);
    },
    [],
  );

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    if (!slug) return;

    // Get dates from URL params if provided
    const urlStartDate = searchParams.get('startDate') || '';
    const urlEndDate = searchParams.get('endDate') || '';
    const urlAddress = searchParams.get('address') || '';

    if (urlStartDate && urlEndDate) {
      setStartDate(urlStartDate);
      setEndDate(urlEndDate);
      setHasPredefinedDates(true);
    }

    if (urlAddress.trim()) {
      setDeliveryAddress(urlAddress);
    }

    if (fallbackSearchCoordinates) {
      setDeliveryCoordinatesWithMode(fallbackSearchCoordinates, 'auto');
    }

    getVendorBySlug(slug)
      .then(async (v) => {
        setVendor(v);
        const [inventoryData, rates] = await Promise.all([
          getInventory(v.id),
          getVendorDeliveryRates(v.id).catch(() => []),
        ]);
        setDeliveryRates(rates);
        return inventoryData;
      })
      .then(setInventory)
      .finally(() => setLoading(false));
  }, [
    fallbackSearchCoordinates,
    navigate,
    searchParams,
    setDeliveryCoordinatesWithMode,
    slug,
    token,
  ]);

  useEffect(() => {
    getFeatureFlagsSettings()
      .then((settings) => {
        const parsedPercent = Number(settings.defaultPlatformCommissionRatePercent);
        if (Number.isFinite(parsedPercent)) {
          setPlatformCommissionRatePercent(parsedPercent);
        }
        setLaunchNoCommissionEnabled(Boolean(settings.launchNoCommissionEnabled));
        setLaunchNoCommissionUntil(settings.launchNoCommissionUntil);
      })
      .catch(() => {
        // Keep default local values when settings endpoint is unavailable.
      });
  }, []);

  useEffect(() => {
    const vendorLat = Number(vendor?.latitude);
    const vendorLng = Number(vendor?.longitude);

    if (!vendor || !Number.isFinite(vendorLat) || !Number.isFinite(vendorLng)) {
      setDeliveryCharge(0);
      setDeliveryDistanceKm(null);
      return;
    }

    if (!deliveryRates.length) {
      setDeliveryCharge(0);
      setDeliveryDistanceKm(null);
      return;
    }

    const vendorCoordinates: Coordinates = { lat: vendorLat, lng: vendorLng };
    const applyEstimate = (
      targetCoordinates: Coordinates,
      options?: { persistCoordinates?: boolean; mode?: 'auto' | 'manual' },
    ) => {
      const distanceKm = haversineDistanceKm(vendorCoordinates, targetCoordinates);
      const matchedRate = estimateDeliveryRate(
        distanceKm,
        parsedHelpersNeeded,
        deliveryRates,
      );

      setDeliveryDistanceKm(distanceKm);
      if (options?.persistCoordinates !== false) {
        setDeliveryCoordinatesWithMode(targetCoordinates, options?.mode || 'auto');
      }
      setDeliveryCharge(Number(matchedRate?.chargeAmount || 0));
    };

    if (deliveryCoordinatesMode === 'manual' && deliveryCoordinates) {
      applyEstimate(deliveryCoordinates, {
        persistCoordinates: false,
        mode: 'manual',
      });
      return;
    }

    const normalizedAddress = deliveryAddress.trim();
    if (!normalizedAddress) {
      if (fallbackSearchCoordinates) {
        applyEstimate(fallbackSearchCoordinates, { mode: 'auto' });
      } else {
        setDeliveryCharge(0);
        setDeliveryDistanceKm(null);
        setDeliveryCoordinates(null);
        setDeliveryMapCenter(DEFAULT_DELIVERY_MAP_CENTER);
      }
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setEstimatingDelivery(true);
      try {
        const params = new URLSearchParams({
          format: 'jsonv2',
          q: normalizedAddress,
          countrycodes: 'ph',
          limit: '1',
        });

        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?${params.toString()}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error('Failed to geocode delivery address');
        }

        const payload = (await response.json()) as Array<{ lat: string; lon: string }>;
        const firstResult = payload[0];
        const lat = Number(firstResult?.lat);
        const lng = Number(firstResult?.lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          throw new Error('Could not resolve delivery coordinates');
        }

        applyEstimate({ lat, lng }, { mode: 'auto' });
      } catch (error: any) {
        if (error?.name === 'AbortError') return;

        if (fallbackSearchCoordinates) {
          applyEstimate(fallbackSearchCoordinates, { mode: 'auto' });
        } else {
          setDeliveryCharge(0);
          setDeliveryDistanceKm(null);
          setDeliveryCoordinates(null);
          setDeliveryMapCenter(DEFAULT_DELIVERY_MAP_CENTER);
        }
      } finally {
        setEstimatingDelivery(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    deliveryCoordinates,
    deliveryCoordinatesMode,
    deliveryAddress,
    deliveryRates,
    fallbackSearchCoordinates,
    parsedHelpersNeeded,
    setDeliveryCoordinatesWithMode,
    vendor,
  ]);

  // Check availability when dates change
  useEffect(() => {
    if (!vendor || !startDate || !endDate) {
      setAvailabilityMap({});
      return;
    }
    setCheckingAvailability(true);
    checkAvailability(vendor.id, startDate, endDate)
      .then(data => {
        const map: Record<string, number> = {};
        data.forEach((item: any) => {
          map[item.inventory.id] = item.available;
        });
        setAvailabilityMap(map);
      })
      .catch(() => {
        toast.error('Failed to check availability');
        setAvailabilityMap({});
      })
      .finally(() => setCheckingAvailability(false));
  }, [vendor, startDate, endDate]);

  const days = startDate && endDate ? calcDays(startDate, endDate) : 1;
  const cartItems = inventory.filter(i => cart[i.id] > 0);
  const itemsSubtotal = cartItems.reduce((s, i) => s + Number(i.ratePerDay) * (cart[i.id] || 0) * days, 0);
  const effectiveCommissionRate = useMemo(() => {
    const parsedPercent = Number(platformCommissionRatePercent);
    const boundedPercent = Number.isFinite(parsedPercent)
      ? Math.min(Math.max(parsedPercent, 0), 100)
      : 10;

    if (
      launchNoCommissionEnabled &&
      isNoCommissionWindowActive(launchNoCommissionUntil)
    ) {
      return 0;
    }

    return boundedPercent / 100;
  }, [
    platformCommissionRatePercent,
    launchNoCommissionEnabled,
    launchNoCommissionUntil,
  ]);
  const platformFee = itemsSubtotal * effectiveCommissionRate;
  const total = itemsSubtotal + deliveryCharge;

  const setItemQuantity = (itemId: string, nextValue: number, max: number) => {
    const boundedMax = Math.max(0, max);
    const sanitized = Number.isFinite(nextValue) ? Math.floor(nextValue) : 0;
    const next = Math.min(boundedMax, Math.max(0, sanitized));
    setCart(current => ({ ...current, [itemId]: next }));
  };

  const handleDeliveryPinPick = (nextCoordinates: Coordinates) => {
    setDeliveryCoordinatesWithMode(nextCoordinates, 'manual');
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error(t('bookingFlow.toastLocationUnavailable'));
      return;
    }

    setLocatingDelivery(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeliveryCoordinatesWithMode(
          {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          'manual',
        );
        toast.success(t('bookingFlow.toastDeliveryCoordinatesUpdated'));
        setLocatingDelivery(false);
      },
      () => {
        toast.error(t('bookingFlow.toastLocationUnavailable'));
        setLocatingDelivery(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleBook = async () => {
    if (!vendor) return;
    if (cartItems.length === 0) {
      toast.error(t('bookingFlow.toastSelectItems'));
      setStep(1);
      return;
    }

    if (!startDate || !endDate) {
      toast.error(t('bookingFlow.toastSelectDates'));
      setStep(hasPredefinedDates ? 3 : 2);
      return;
    }

    if (!deliveryAddress.trim()) {
      toast.error(t('bookingFlow.toastDeliveryAddressRequired'));
      setStep(3);
      return;
    }

    if (!deliveryCoordinates) {
      toast.error(t('bookingFlow.toastDeliveryCoordinatesRequired'));
      setStep(3);
      return;
    }

    setSubmitting(true);
    try {
      const booking = await createBooking({
        vendorId: vendor.id,
        startDate,
        endDate,
        deliveryAddress,
        deliveryCharge,
        deliveryLatitude: deliveryCoordinates.lat,
        deliveryLongitude: deliveryCoordinates.lng,
        notes,
        items: cartItems.map(i => ({ inventoryItemId: i.id, quantity: cart[i.id] })),
      });

      if (booking.paymentCheckoutUrl) {
        toast.success(t('bookingFlow.toastRedirectingToPayment'));
        window.location.href = booking.paymentCheckoutUrl;
        return;
      }

      toast.success(t('bookingFlow.toastSubmitted'));
      navigate('/my-bookings');
    } catch (e: any) {
      toast.error(e.response?.data?.message || t('bookingFlow.toastFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <CustomerLayout><LoadingSpinner size="lg" /></CustomerLayout>;

  const steps = hasPredefinedDates
    ? [
      `📦 ${t('bookingFlow.stepItems')}`,
      `📍 ${t('bookingFlow.stepDelivery')}`,
      `✅ ${t('bookingFlow.stepConfirm')}`,
    ]
    : [
      `📦 ${t('bookingFlow.stepItems')}`,
      `📅 ${t('bookingFlow.stepDates')}`,
      `📍 ${t('bookingFlow.stepDelivery')}`,
      `✅ ${t('bookingFlow.stepConfirm')}`,
    ];

  // Get available quantity for an item based on selected dates
  const getAvailableQuantity = (itemId: string) => {
    if (startDate && endDate && availabilityMap[itemId] !== undefined) {
      return availabilityMap[itemId];
    }
    return inventory.find(i => i.id === itemId)?.availableQuantity || 0;
  };

  const getItemDisplayName = (item: InventoryItem) => {
    const baseName = item.itemType?.name || t('common.na');
    return item.color ? `${baseName} (${item.color})` : baseName;
  };

  const hasDateAvailabilityData = Boolean(startDate && endDate && Object.keys(availabilityMap).length > 0);
  const hasPartiallyUnavailableItems = hasDateAvailabilityData && inventory.some(item => {
    const available = availabilityMap[item.id];
    return available !== undefined && Number(available) < Number(item.quantity);
  });
  const selectedDateRangeLabel = startDate && endDate
    ? `${formatDate(startDate)} to ${formatDate(endDate)}`
    : '';
  const predefinedDateBanner = (() => {
    if (!hasPredefinedDates || !selectedDateRangeLabel) return null;
    if (checkingAvailability) {
      return {
        text: 'Checking availability for your selected schedule...',
        className: 'bg-blue-50 border-blue-200 text-blue-700',
        icon: 'ℹ️',
      };
    }
    if (hasDateAvailabilityData && !hasPartiallyUnavailableItems) {
      return {
        text: `Your selected schedule is available: ${selectedDateRangeLabel}`,
        className: 'bg-green-50 border-green-200 text-green-700',
        icon: '✅',
      };
    }
    if (hasDateAvailabilityData && hasPartiallyUnavailableItems) {
      return {
        text: `Dates already selected for some items: ${selectedDateRangeLabel}`,
        className: 'bg-amber-50 border-amber-200 text-amber-700',
        icon: 'ℹ️',
      };
    }
    return {
      text: `Dates already selected: ${selectedDateRangeLabel}`,
      className: 'bg-blue-50 border-blue-200 text-blue-700',
      icon: 'ℹ️',
    };
  })();

  return (
    <CustomerLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-2">{t('bookingFlow.title', { name: vendor?.businessName || '' })}</h1>

        {/* Step indicator */}
        <div className="flex gap-2 mb-8">
          {steps.map((s, i) => {
            const displayStep = hasPredefinedDates ? [1, 3, 4][i] : i + 1;
            const isCurrentStep = step === displayStep;
            const isCompletedStep = step > displayStep;
            return (
              <div key={i} className={`flex-1 text-center py-3 rounded-xl font-semibold text-lg ${isCurrentStep ? 'bg-blue-600 text-white' : isCompletedStep ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {s}
              </div>
            );
          })}
        </div>

        {/* Step 1: Select Items */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">{t('bookingFlow.selectItemsAndQuantities')}</h2>
            {predefinedDateBanner && (
              <div className={`border rounded-lg p-3 flex items-center gap-2 mb-4 ${predefinedDateBanner.className}`}>
                <span>{predefinedDateBanner.icon} {predefinedDateBanner.text}</span>
              </div>
            )}
            {inventory.map(item => {
              const availQty = getAvailableQuantity(item.id);
              const currentQty = cart[item.id] || 0;
              const itemPictureUrl = item.pictureUrl || item.itemType?.pictureUrl;

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl shadow p-5 flex items-center justify-between ${availQty <= 0 ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    {itemPictureUrl && <img src={itemPictureUrl} alt={item.itemType?.name || 'Item'} className="h-16 w-16 rounded-lg object-cover" />}
                    <div>
                      <p className="text-xl font-bold">{getItemDisplayName(item)}</p>
                      <p className="text-gray-500">{t('bookingFlow.itemAvailabilityLine', { rate: formatCurrency(item.ratePerDay), count: availQty })}</p>
                      {availQty <= 0 && (
                        <p className="mt-1 text-sm font-semibold text-red-600">{t('bookingFlow.outOfStock')}</p>
                      )}
                    </div>
                  </div>
                  {availQty > 0 ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setItemQuantity(item.id, currentQty - 1, availQty)}
                        className="w-10 h-10 rounded-full bg-gray-200 text-xl font-bold"
                        disabled={currentQty <= 0}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={availQty}
                        value={currentQty}
                        onChange={(event) => {
                          const raw = event.target.value;
                          const parsed = raw === '' ? 0 : Number(raw);
                          setItemQuantity(item.id, parsed, availQty);
                        }}
                        className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-center text-lg font-bold"
                      />
                      <button
                        onClick={() => setItemQuantity(item.id, currentQty + 1, availQty)}
                        className="w-10 h-10 rounded-full bg-blue-600 text-white text-xl font-bold"
                        disabled={currentQty >= availQty}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 font-semibold">Unavailable</span>
                    </div>
                  )}
                </div>
              );
            })}
            <Button size="xl" className="w-full mt-4" disabled={cartItems.length === 0} onClick={() => hasPredefinedDates ? setStep(3) : setStep(2)}>{hasPredefinedDates ? t('bookingFlow.nextDelivery') : t('bookingFlow.nextSelectDates')} →</Button>
          </div>
        )}

        {/* Step 2: Dates */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">{t('bookingFlow.whenNeeded')}</h2>
            <div>
              <label className="block text-xl font-semibold mb-2">{t('bookingFlow.startDate')}</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full text-xl p-4 border rounded-xl" />
            </div>
            <div>
              <label className="block text-xl font-semibold mb-2">{t('bookingFlow.endDate')}</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} className="w-full text-xl p-4 border rounded-xl" />
            </div>
            {startDate && endDate && (
              <div>
                <p className="text-xl text-blue-600 font-semibold">📅 {t('bookingFlow.daysSelected', { count: days })}</p>
                {checkingAvailability && <p className="text-sm text-gray-500 mt-2">Checking availability...</p>}
                {!checkingAvailability && startDate && endDate && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm font-semibold text-blue-800 mb-2">Available items for {startDate} to {endDate}:</p>
                    <div className="space-y-1">
                      {inventory.map(item => {
                        const availQty = getAvailableQuantity(item.id);
                        return (
                          <p key={item.id} className="text-sm text-blue-700">
                            {getItemDisplayName(item)}: {availQty} {availQty === 1 ? 'unit' : 'units'}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-4">
              <Button color="gray" size="xl" className="flex-1" onClick={() => setStep(1)}>← {t('common.back')}</Button>
              <Button size="xl" className="flex-1" disabled={!startDate || !endDate} onClick={() => setStep(3)}>{t('bookingFlow.nextDelivery')} →</Button>
            </div>
          </div>
        )}

        {/* Step 3: Delivery */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">{t('bookingFlow.whereDeliver')}</h2>
            <div>
              <label className="block text-xl font-semibold mb-2">{t('bookingFlow.deliveryAddress')}</label>
              <TextInput
                value={deliveryAddress}
                onChange={e => {
                  setDeliveryAddress(e.target.value);
                  setDeliveryCoordinatesMode('auto');
                }}
                placeholder={t('bookingFlow.deliveryAddressPlaceholder')}
                sizing="lg"
              />
            </div>
            <div className="space-y-3 rounded-xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-gray-800">{t('bookingFlow.deliveryCoordinatesPicker')}</p>
                  <p className="text-sm text-gray-600">{t('bookingFlow.deliveryCoordinatesPickerHint')}</p>
                </div>
                <Button
                  type="button"
                  color="light"
                  size="sm"
                  isProcessing={locatingDelivery}
                  disabled={locatingDelivery}
                  onClick={handleUseCurrentLocation}
                >
                  {t('bookingFlow.useCurrentLocation')}
                </Button>
              </div>

              <div className="h-[300px] overflow-hidden rounded-xl border border-gray-200">
                <MapContainer center={deliveryMapCenter} zoom={15} className="h-full w-full">
                  <DeliveryMapCenterController center={deliveryMapCenter} />
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                  />
                  <DeliveryLocationPicker onPick={handleDeliveryPinPick} />
                  {deliveryCoordinates && (
                    <Marker
                      position={[deliveryCoordinates.lat, deliveryCoordinates.lng]}
                      draggable
                      icon={deliveryPinIcon}
                      eventHandlers={{
                        dragend: (event) => {
                          const marker = event.target as L.Marker;
                          const { lat, lng } = marker.getLatLng();
                          handleDeliveryPinPick({ lat, lng });
                        },
                      }}
                    />
                  )}
                </MapContainer>
              </div>

              <p className="text-sm font-medium text-gray-700">
                {deliveryCoordinates
                  ? t('bookingFlow.deliveryCoordinatesSelected', {
                    coordinates: formatCoordinates(deliveryCoordinates),
                  })
                  : t('bookingFlow.deliveryCoordinatesRequiredHint')}
              </p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-900">
              {estimatingDelivery ? (
                <p>{t('bookingFlow.estimatingDelivery')}</p>
              ) : (
                <>
                  <p className="font-semibold">
                    {t('bookingFlow.deliveryChargeEstimate', { charge: formatCurrency(deliveryCharge) })}
                  </p>
                  {deliveryDistanceKm != null && (
                    <p className="mt-1 text-blue-700">
                      {t('bookingFlow.estimatedDistance', { distance: deliveryDistanceKm.toFixed(1) })}
                    </p>
                  )}
                  <p className="mt-1 text-blue-700">
                    {t('bookingFlow.helpersNeeded', { count: parsedHelpersNeeded })}
                  </p>
                </>
              )}
            </div>
            <div>
              <label className="block text-xl font-semibold mb-2">{t('bookingFlow.specialInstructions')}</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('bookingFlow.specialInstructionsPlaceholder')} className="w-full text-xl p-4 border rounded-xl" rows={3} />
            </div>
            <div className="flex gap-4">
              <Button color="gray" size="xl" className="flex-1" onClick={() => setStep(hasPredefinedDates ? 1 : 2)}>← {t('common.back')}</Button>
              <Button
                size="xl"
                className="flex-1"
                disabled={!deliveryAddress.trim() || !deliveryCoordinates}
                onClick={() => setStep(4)}
              >
                {t('bookingFlow.nextReview')} →
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">{t('bookingFlow.reviewBooking')}</h2>
            <div className="bg-white rounded-2xl shadow p-6 space-y-3">
              <h3 className="text-xl font-bold text-gray-700">📦 {t('bookingFlow.itemsHeading')}</h3>
              {cartItems.map(i => {
                const itemPictureUrl = i.pictureUrl || i.itemType?.pictureUrl;

                return (
                  <div key={i.id} className="flex justify-between text-xl">
                    <span className="flex items-center gap-3">
                      {itemPictureUrl && <img src={itemPictureUrl} alt={i.itemType?.name || 'Item'} className="h-10 w-10 rounded-md object-cover" />}
                      <span>{getItemDisplayName(i)} × {cart[i.id]}</span>
                    </span>
                    <span>{formatCurrency(Number(i.ratePerDay) * cart[i.id] * days)}</span>
                  </div>
                );
              })}
              <hr />
              <div className="flex justify-between text-xl"><span>📅 {t('bookingFlow.daysLine')}</span><span>{days}</span></div>
              <div className="flex justify-between text-xl"><span>📍 {t('bookingFlow.deliveryTo')}</span><span className="text-right max-w-xs">{deliveryAddress}</span></div>
              {deliveryCoordinates && (
                <div className="flex justify-between text-xl">
                  <span>🧭 {t('bookingFlow.deliveryCoordinatesLine')}</span>
                  <span className="text-right max-w-xs">{formatCoordinates(deliveryCoordinates)}</span>
                </div>
              )}
              {deliveryDistanceKm != null && (
                <div className="flex justify-between text-xl"><span>🛣️ {t('bookingFlow.distanceLine')}</span><span>{deliveryDistanceKm.toFixed(1)} km</span></div>
              )}
              <hr />
              <div className="flex justify-between text-xl"><span>{t('bookingFlow.subtotal')}</span><span>{formatCurrency(itemsSubtotal)}</span></div>
              <div className="flex justify-between text-xl"><span>{t('bookingFlow.deliveryCharge')}</span><span>{formatCurrency(deliveryCharge)}</span></div>
              <div className="flex justify-between text-2xl font-bold"><span>💵 {t('bookingFlow.total')}</span><span>{formatCurrency(total)}</span></div>
              <p className="text-gray-400 text-sm">{t('bookingFlow.platformFeeIncluded', { fee: formatCurrency(platformFee) })}</p>
            </div>
            <div className="flex gap-4">
              <Button color="gray" size="xl" className="flex-1" onClick={() => setStep(3)}>← {t('common.back')}</Button>
              <Button
                size="xl"
                className="flex-1 bg-green-500 hover:bg-green-600"
                onClick={handleBook}
                disabled={submitting || cartItems.length === 0}
                isProcessing={submitting}
              >
                🎉 {t('bookingFlow.confirmBooking')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
