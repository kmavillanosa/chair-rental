import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, TextInput } from 'flowbite-react';
import toast from 'react-hot-toast';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { getVendorBySlug } from '../../api/vendors';
import { getInventory } from '../../api/items';
import { checkAvailability, createBooking } from '../../api/bookings';
import type { Vendor, InventoryItem } from '../../types';
import { formatCurrency, calcDays, formatDate } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';

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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, number>>({});
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [hasPredefinedDates, setHasPredefinedDates] = useState(false);

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    if (!slug) return;

    // Get dates from URL params if provided
    const urlStartDate = searchParams.get('startDate') || '';
    const urlEndDate = searchParams.get('endDate') || '';

    if (urlStartDate && urlEndDate) {
      setStartDate(urlStartDate);
      setEndDate(urlEndDate);
      setHasPredefinedDates(true);
    }

    getVendorBySlug(slug).then(v => { setVendor(v); return getInventory(v.id); }).then(setInventory).finally(() => setLoading(false));
  }, [slug, token, navigate, searchParams]);

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
  const itemsTotal = cartItems.reduce((s, i) => s + Number(i.ratePerDay) * (cart[i.id] || 0) * days, 0);
  const platformFee = itemsTotal * 0.1;
  const total = itemsTotal;

  const setItemQuantity = (itemId: string, nextValue: number, max: number) => {
    const boundedMax = Math.max(0, max);
    const sanitized = Number.isFinite(nextValue) ? Math.floor(nextValue) : 0;
    const next = Math.min(boundedMax, Math.max(0, sanitized));
    setCart(current => ({ ...current, [itemId]: next }));
  };

  const handleBook = async () => {
    if (!vendor) return;
    setSubmitting(true);
    try {
      await createBooking({
        vendorId: vendor.id,
        startDate,
        endDate,
        deliveryAddress,
        notes,
        items: cartItems.map(i => ({ inventoryItemId: i.id, quantity: cart[i.id] })),
      });
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
                <div key={item.id} className="bg-white rounded-2xl shadow p-5 flex items-center justify-between">
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
                  {availQty > 0 && (
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
              <TextInput value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder={t('bookingFlow.deliveryAddressPlaceholder')} sizing="lg" />
            </div>
            <div>
              <label className="block text-xl font-semibold mb-2">{t('bookingFlow.specialInstructions')}</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('bookingFlow.specialInstructionsPlaceholder')} className="w-full text-xl p-4 border rounded-xl" rows={3} />
            </div>
            <div className="flex gap-4">
              <Button color="gray" size="xl" className="flex-1" onClick={() => setStep(hasPredefinedDates ? 1 : 2)}>← {t('common.back')}</Button>
              <Button size="xl" className="flex-1" disabled={!deliveryAddress} onClick={() => setStep(4)}>{t('bookingFlow.nextReview')} →</Button>
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
              <hr />
              <div className="flex justify-between text-2xl font-bold"><span>💵 {t('bookingFlow.total')}</span><span>{formatCurrency(total)}</span></div>
              <p className="text-gray-400 text-sm">{t('bookingFlow.platformFeeIncluded', { fee: formatCurrency(platformFee) })}</p>
            </div>
            <div className="flex gap-4">
              <Button color="gray" size="xl" className="flex-1" onClick={() => setStep(3)}>← {t('common.back')}</Button>
              <Button size="xl" className="flex-1 bg-green-500 hover:bg-green-600" onClick={handleBook} disabled={submitting} isProcessing={submitting}>
                🎉 {t('bookingFlow.confirmBooking')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
