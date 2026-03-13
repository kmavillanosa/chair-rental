import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, TextInput } from 'flowbite-react';
import toast from 'react-hot-toast';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { getVendorBySlug } from '../../api/vendors';
import { getInventory } from '../../api/items';
import { createBooking } from '../../api/bookings';
import type { Vendor, InventoryItem } from '../../types';
import { formatCurrency, calcDays } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';

const getTodayDateInputValue = () => {
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localTime.toISOString().split('T')[0];
};

export default function BookingFlow() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [step, setStep] = useState(1);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [startDate, setStartDate] = useState(getTodayDateInputValue());
  const [endDate, setEndDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');

  const setItemQuantity = (itemId: string, nextQuantity: number, maxAvailable: number) => {
    const safeQuantity = Number.isFinite(nextQuantity)
      ? Math.max(0, Math.min(maxAvailable, Math.trunc(nextQuantity)))
      : 0;

    setCart((current) => ({
      ...current,
      [itemId]: safeQuantity,
    }));
  };

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    if (!slug) return;
    getVendorBySlug(slug).then(v => { setVendor(v); return getInventory(v.id); }).then(setInventory).finally(() => setLoading(false));
  }, [slug]);

  const days = startDate && endDate ? calcDays(startDate, endDate) : 1;
  const cartItems = inventory.filter(i => cart[i.id] > 0);
  const itemsTotal = cartItems.reduce((s, i) => s + Number(i.ratePerDay) * (cart[i.id] || 0) * days, 0);
  const platformFee = itemsTotal * 0.1;
  const total = itemsTotal;

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
      toast.success('🎉 Booking submitted! Wait for vendor confirmation.');
      navigate('/my-bookings');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Booking failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <CustomerLayout><LoadingSpinner size="lg" /></CustomerLayout>;

  const steps = ['📦 Items', '📅 Dates', '📍 Delivery', '✅ Confirm'];

  return (
    <CustomerLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-2">Book from {vendor?.businessName}</h1>

        {/* Step indicator */}
        <div className="flex gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={i} className={`flex-1 text-center py-3 rounded-xl font-semibold text-lg ${i + 1 === step ? 'bg-blue-600 text-white' : i + 1 < step ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {s}
            </div>
          ))}
        </div>

        {/* Step 1: Select Items */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">Select Items & Quantities</h2>
            {inventory.map(item => (
              <div key={item.id} className="bg-white rounded-2xl shadow p-5 flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold">{item.itemType?.name}</p>
                  <p className="text-gray-500">{formatCurrency(item.ratePerDay)}/day • {item.availableQuantity} available</p>
                  {item.availableQuantity <= 0 && (
                    <p className="mt-1 text-sm font-semibold text-red-600">Out of stock</p>
                  )}
                </div>
                {item.availableQuantity > 0 && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setItemQuantity(item.id, (cart[item.id] || 0) - 1, item.availableQuantity)}
                      className="w-10 h-10 rounded-full bg-gray-200 text-xl font-bold"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={item.availableQuantity}
                      step={1}
                      value={cart[item.id] || 0}
                      onChange={(e) => setItemQuantity(item.id, Number(e.target.value), item.availableQuantity)}
                      className="w-24 rounded-xl border border-gray-300 px-3 py-2 text-center text-xl font-bold"
                      aria-label={`${item.itemType?.name || 'Item'} quantity`}
                    />
                    <button
                      onClick={() => setItemQuantity(item.id, (cart[item.id] || 0) + 1, item.availableQuantity)}
                      className="w-10 h-10 rounded-full bg-blue-600 text-white text-xl font-bold"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            ))}
            <Button size="xl" className="w-full mt-4" disabled={cartItems.length === 0} onClick={() => setStep(2)}>Next: Select Dates →</Button>
          </div>
        )}

        {/* Step 2: Dates */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">When do you need the items?</h2>
            <div>
              <label className="block text-xl font-semibold mb-2">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full text-xl p-4 border rounded-xl" />
            </div>
            <div>
              <label className="block text-xl font-semibold mb-2">End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} className="w-full text-xl p-4 border rounded-xl" />
            </div>
            {startDate && endDate && <p className="text-xl text-blue-600 font-semibold">📅 {days} day(s) selected</p>}
            <div className="flex gap-4">
              <Button color="gray" size="xl" className="flex-1" onClick={() => setStep(1)}>← Back</Button>
              <Button size="xl" className="flex-1" disabled={!startDate || !endDate} onClick={() => setStep(3)}>Next: Delivery →</Button>
            </div>
          </div>
        )}

        {/* Step 3: Delivery */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">Where should we deliver?</h2>
            <div>
              <label className="block text-xl font-semibold mb-2">Delivery Address</label>
              <TextInput value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="House #, Street, Barangay, City" sizing="lg" />
            </div>
            <div>
              <label className="block text-xl font-semibold mb-2">Special Instructions (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Call before delivery, gate code: 1234" className="w-full text-xl p-4 border rounded-xl" rows={3} />
            </div>
            <div className="flex gap-4">
              <Button color="gray" size="xl" className="flex-1" onClick={() => setStep(2)}>← Back</Button>
              <Button size="xl" className="flex-1" disabled={!deliveryAddress} onClick={() => setStep(4)}>Next: Review →</Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">Review Your Booking</h2>
            <div className="bg-white rounded-2xl shadow p-6 space-y-3">
              <h3 className="text-xl font-bold text-gray-700">📦 Items</h3>
              {cartItems.map(i => (
                <div key={i.id} className="flex justify-between text-xl">
                  <span>{i.itemType?.name} × {cart[i.id]}</span>
                  <span>{formatCurrency(Number(i.ratePerDay) * cart[i.id] * days)}</span>
                </div>
              ))}
              <hr />
              <div className="flex justify-between text-xl"><span>📅 Days:</span><span>{days}</span></div>
              <div className="flex justify-between text-xl"><span>📍 Delivery to:</span><span className="text-right max-w-xs">{deliveryAddress}</span></div>
              <hr />
              <div className="flex justify-between text-2xl font-bold"><span>💵 Total:</span><span>{formatCurrency(total)}</span></div>
              <p className="text-gray-400 text-sm">Platform fee ({formatCurrency(platformFee)}) included in vendor settlement.</p>
            </div>
            <div className="flex gap-4">
              <Button color="gray" size="xl" className="flex-1" onClick={() => setStep(3)}>← Back</Button>
              <Button size="xl" className="flex-1 bg-green-500 hover:bg-green-600" onClick={handleBook} disabled={submitting} isProcessing={submitting}>
                🎉 Confirm Booking!
              </Button>
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
