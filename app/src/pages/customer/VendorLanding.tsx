import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from 'flowbite-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { getVendorBySlug } from '../../api/vendors';
import { getInventory, getInventoryBreakdown } from '../../api/items';
import type { Vendor, InventoryItem } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency } from '../../utils/format';
import { useTranslation } from 'react-i18next';

const ITEM_PALETTE = [
  { bg: 'bg-rose-400', pill: 'bg-rose-100 text-rose-700 border-rose-300' },
  { bg: 'bg-amber-400', pill: 'bg-amber-100 text-amber-700 border-amber-300' },
  { bg: 'bg-sky-400', pill: 'bg-sky-100 text-sky-700 border-sky-300' },
  { bg: 'bg-emerald-400', pill: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { bg: 'bg-violet-400', pill: 'bg-violet-100 text-violet-700 border-violet-300' },
  { bg: 'bg-pink-400', pill: 'bg-pink-100 text-pink-700 border-pink-300' },
  { bg: 'bg-teal-400', pill: 'bg-teal-100 text-teal-700 border-teal-300' },
  { bg: 'bg-orange-400', pill: 'bg-orange-100 text-orange-700 border-orange-300' },
];

type ItemColor = (typeof ITEM_PALETTE)[number];
type ItemColorMap = Record<string, ItemColor>;
type VendorLandingTab = 'equipment' | 'army';

const MAX_RENDERED_ARMY_UNITS = 720;

function UnitCell({ bgClass, label }: { bgClass: string; label: string }) {
  return (
    <div title={label} className={`h-4 w-4 rounded-sm ${bgClass} flex flex-col items-stretch p-[2px]`}>
      <div className="h-[35%] rounded-t-sm bg-black/20 mb-[1px]" />
      <div className="flex-1 rounded-sm bg-black/10" />
    </div>
  );
}

export default function VendorLanding() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  useEffect(() => {
    if (!slug) return;
    getVendorBySlug(slug)
      .then((v) => {
        setVendor(v);
        return getInventory(v.id);
      })
      .then(setInventory)
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (vendor) {
      setBreakdownLoading(true);
      getInventoryBreakdown(vendor.id)
        .then(setBreakdown)
        .finally(() => setBreakdownLoading(false));
    }
  }, [vendor]);

  const colorMap = useMemo(() => {
    const map: ItemColorMap = {};
    inventory.forEach((item, index) => {
      map[item.id] = ITEM_PALETTE[index % ITEM_PALETTE.length];
    });
    return map;
  }, [inventory]);

  const handleBookNow = () => {
    const params = new URLSearchParams();
    [
      'lat',
      'lng',
      'radius',
      'helpersNeeded',
      'address',
      'startDate',
      'endDate',
      'itemTypeIds',
      'eventTag',
    ].forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });

    const bookingUrl = params.toString()
      ? `/book/${slug}?${params.toString()}`
      : `/book/${slug}`;
    navigate(bookingUrl);
  };

  if (loading) return <CustomerLayout><LoadingSpinner size="lg" /></CustomerLayout>;
  if (!vendor) return <CustomerLayout><div className="text-center py-20 text-slate-400">{t('vendorLandingPage.notFound')}</div></CustomerLayout>;

  return (
    <CustomerLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {/* Profile Section */}
        <section className="bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-2xl p-8 shadow-lg flex flex-col gap-2">
          <h1 className="text-3xl font-bold mb-1">{vendor.businessName}</h1>
          <p className="text-sm text-slate-400">{vendor.address}</p>
          {vendor.phone && <p className="text-sm text-slate-400 mt-0.5">{vendor.phone}</p>}
          {vendor.description && <p className="text-sm text-slate-300 mt-3">{vendor.description}</p>}
          {(vendor.verificationBadge || vendor.isVerified) && (
            <span className="inline-flex items-center gap-1 mt-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-3 py-0.5 rounded-full text-xs font-medium">
              ✓ {vendor.verificationBadge || t('vendorLandingPage.verifiedVendor')}
            </span>
          )}
          <div className="mt-4">
            <Button onClick={handleBookNow} color="dark" size="sm">
              {t('vendorLandingPage.bookNow')}
            </Button>
          </div>
        </section>

        {/* Available Equipment Section */}
        <section>
          <h2 className="text-xl font-semibold text-slate-700 mb-4">{t('vendorLandingPage.availableEquipment')}</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {inventory.map((item) => {
              const itemPictureUrl = item.pictureUrl || item.itemType?.pictureUrl;
              const color = colorMap[item.id] ?? ITEM_PALETTE[0];
              return (
                <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className={color.bg + ' h-1.5 w-full'} />
                  <div className="h-36 bg-slate-50 flex items-center justify-center p-2 border-b border-slate-100">
                    {itemPictureUrl
                      ? <img src={itemPictureUrl} alt={item.itemType?.name ?? ''} className="h-full w-full object-contain" />
                      : <span className="text-slate-300 text-xs">No image</span>}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-slate-800 leading-tight">
                      {item.itemType?.name}
                      {item.color ? <span className="font-normal text-slate-500"> - {item.color}</span> : ''}
                    </p>
                    {item.brand && <p className="text-xs text-slate-400 mt-0.5">{item.brand.name}</p>}
                    <div className="mt-2.5 space-y-1">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${color.pill}`}>
                        {item.availableQuantity} units available
                      </span>
                      <p className="text-sm font-bold text-slate-800">
                        {formatCurrency(item.ratePerDay)}
                        <span className="text-xs font-normal text-slate-400">/day</span>
                      </p>
                      {item.condition && <p className="text-xs text-slate-400 capitalize">{item.condition}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
            {inventory.length === 0 && (
              <div className="col-span-full text-center py-10 text-sm text-slate-400">
                {t('vendorLandingPage.noItems')}
              </div>
            )}
          </div>
        </section>

        {/* Equipment Breakdown Section */}
        <section>
          <h2 className="text-xl font-semibold text-slate-700 mb-4">Equipment Breakdown</h2>
          <BreakdownArmy />
        </section>
      </div>
    </CustomerLayout>
  );

  function BreakdownArmy() {
    if (breakdownLoading) return <LoadingSpinner size="md" />;
    if (!breakdown.length) return <div className="text-slate-400 py-8 text-center">No breakdown data.</div>;
    return (
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-900 to-slate-800 p-5 sm:p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 tabular-nums">
            {breakdown.reduce((sum, row) => sum + row.total, 0)} total units
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-300">
          Color = available, Grey = reserved. Each block is one unit.
        </p>
        <div className="mt-5 space-y-4">
          {breakdown.map((row, idx) => {
            const color = colorMap[row.id] ?? ITEM_PALETTE[idx % ITEM_PALETTE.length];
            return (
              <div key={row.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-sm ${color.bg}`} />
                    <span className="text-sm font-medium text-slate-100">
                      {row.itemType?.name}
                      {row.color ? <span className="text-slate-300"> - {row.color}</span> : null}
                    </span>
                  </div>
                  <span className="text-xs text-slate-300 tabular-nums">
                    {row.total} unit{row.total !== 1 ? 's' : ''} ({row.available} available, {row.reserved} reserved)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: row.available }).map((_, i) => (
                    <div key={`a-${i}`} className={`h-4 w-4 rounded-sm ${color.bg} border border-white/10`} title="Available" />
                  ))}
                  {Array.from({ length: row.reserved }).map((_, i) => (
                    <div key={`r-${i}`} className="h-4 w-4 rounded-sm bg-gray-400 border border-white/10 opacity-60" title="Reserved" />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }
}