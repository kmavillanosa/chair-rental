import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from 'flowbite-react';
import toast from 'react-hot-toast';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { getVendorBySlug, getVendorReviews, submitVendorReview } from '../../api/vendors';
import { getInventory, getInventoryBreakdown } from '../../api/items';
import { getPublicVendorPackages } from '../../api/packages';
import { getVendorDeliveryRates } from '../../api/payments';
import type {
  Vendor,
  InventoryItem,
  DeliveryRate,
  VendorReview,
  PublicVendorPackage,
} from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/format';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { getCurrentAppPath, savePostLoginRedirect } from '../../utils/postLoginRedirect';

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
type Coordinates = { lat: number; lng: number };
type NormalizedDeliveryRate = {
  distanceKm: number;
  chargeAmount: number;
  helpersCount: number;
};

const MAX_RENDERED_ARMY_UNITS = 720;

function getInventoryItemImageUrls(item: InventoryItem) {
  const galleryPhotos = (item.galleryPhotos || []).filter(Boolean);
  if (galleryPhotos.length) {
    return galleryPhotos;
  }

  const fallbackPhoto = item.pictureUrl || item.itemType?.pictureUrl;
  return fallbackPhoto ? [fallbackPhoto] : [];
}

function UnitCell({ bgClass, label }: { bgClass: string; label: string }) {
  return (
    <div title={label} className={`h-4 w-4 rounded-sm ${bgClass} flex flex-col items-stretch p-[2px]`}>
      <div className="h-[35%] rounded-t-sm bg-black/20 mb-[1px]" />
      <div className="flex-1 rounded-sm bg-black/10" />
    </div>
  );
}

function getAllGalleryPhotos(inventory: InventoryItem[]): string[] {
  const photos: string[] = [];
  const seenUrls = new Set<string>();

  for (const item of inventory) {
    const urls = getInventoryItemImageUrls(item);
    for (const url of urls) {
      if (url && !seenUrls.has(url)) {
        photos.push(url);
        seenUrls.add(url);
      }
    }
  }

  return photos.slice(0, 8); // Limit to 8 images for the gallery
}

function parseQueryNumber(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDistanceKm(distanceKm: number) {
  return Number.isInteger(distanceKm) ? `${distanceKm}` : distanceKm.toFixed(1);
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

function normalizeDeliveryRates(rates: DeliveryRate[]): NormalizedDeliveryRate[] {
  return rates
    .map((rate) => {
      const distanceKm = Number(rate.distanceKm);
      const chargeAmount = Number(rate.chargeAmount);
      const helpersCount = Number(rate.helpersCount);

      return {
        distanceKm: Number.isFinite(distanceKm) ? distanceKm : 0,
        chargeAmount: Number.isFinite(chargeAmount) ? chargeAmount : 0,
        helpersCount:
          Number.isFinite(helpersCount) && helpersCount >= 0
            ? Math.floor(helpersCount)
            : 0,
      };
    })
    .sort((left, right) => {
      if (left.distanceKm !== right.distanceKm) {
        return left.distanceKm - right.distanceKm;
      }
      return left.helpersCount - right.helpersCount;
    });
}

function estimateDeliveryRate(
  distanceKm: number,
  helpersNeeded: number,
  rates: NormalizedDeliveryRate[],
) {
  if (!rates.length) return null;

  const helperScopedRates = rates.filter(
    (rate) => rate.helpersCount >= helpersNeeded,
  );
  const candidateRates = helperScopedRates.length
    ? helperScopedRates
    : rates;

  return (
    candidateRates.find((rate) => rate.distanceKm >= distanceKm) ||
    candidateRates[candidateRates.length - 1]
  );
}

function renderStars(rating: number) {
  const rounded = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return '★★★★★'.slice(0, rounded) + '☆☆☆☆☆'.slice(0, 5 - rounded);
}

export default function VendorLanding({ slugOverride }: { slugOverride?: string | null } = {}) {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const resolvedSlug = slugOverride || slug;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, user } = useAuthStore();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [deliveryRates, setDeliveryRates] = useState<DeliveryRate[]>([]);
  const [deliveryRatesLoading, setDeliveryRatesLoading] = useState(false);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState(0);
  const [reviews, setReviews] = useState<VendorReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [publicPackages, setPublicPackages] = useState<PublicVendorPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);

  useEffect(() => {
    if (!resolvedSlug) {
      setLoading(false);
      return;
    }

    setLoading(true);
    getVendorBySlug(resolvedSlug)
      .then((v) => {
        setVendor(v);
        return getInventory(v.id);
      })
      .then(setInventory)
      .catch(() => {
        setVendor(null);
        setInventory([]);
      })
      .finally(() => setLoading(false));
  }, [resolvedSlug]);

  useEffect(() => {
    if (vendor) {
      setBreakdownLoading(true);
      setDeliveryRatesLoading(true);
      setReviewsLoading(true);
      setPackagesLoading(true);
      getInventoryBreakdown(vendor.id)
        .then(setBreakdown)
        .finally(() => setBreakdownLoading(false));

      getVendorDeliveryRates(vendor.id)
        .then(setDeliveryRates)
        .catch(() => setDeliveryRates([]))
        .finally(() => setDeliveryRatesLoading(false));

      getVendorReviews(vendor.id)
        .then(setReviews)
        .catch(() => setReviews([]))
        .finally(() => setReviewsLoading(false));

      getPublicVendorPackages(vendor.id)
        .then(setPublicPackages)
        .catch(() => setPublicPackages([]))
        .finally(() => setPackagesLoading(false));
    }
  }, [vendor]);

  const customerExistingReview = useMemo(() => {
    if (!user?.id) return null;
    return reviews.find((review) => review.reviewerUserId === user.id) || null;
  }, [reviews, user?.id]);

  const displayedTotalRatings = useMemo(() => {
    return reviews.length > 0 ? reviews.length : Number(vendor?.totalRatings || 0);
  }, [reviews, vendor?.totalRatings]);

  const displayedAverageRating = useMemo(() => {
    if (reviews.length > 0) {
      return Number(
        (
          reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) /
          reviews.length
        ).toFixed(1),
      );
    }

    return Number(Number(vendor?.averageRating || 0).toFixed(1));
  }, [reviews, vendor?.averageRating]);

  useEffect(() => {
    if (!customerExistingReview) {
      setReviewRating(5);
      setReviewComment('');
      return;
    }

    setReviewRating(Math.max(1, Math.min(5, Number(customerExistingReview.rating) || 5)));
    setReviewComment(customerExistingReview.comment || '');
  }, [customerExistingReview]);

  const colorMap = useMemo(() => {
    const map: ItemColorMap = {};
    inventory.forEach((item, index) => {
      map[item.id] = ITEM_PALETTE[index % ITEM_PALETTE.length];
    });
    return map;
  }, [inventory]);

  const galleryPhotos = useMemo(() => getAllGalleryPhotos(inventory), [inventory]);
  const normalizedDeliveryRates = useMemo(
    () => normalizeDeliveryRates(deliveryRates),
    [deliveryRates],
  );
  const pricedInventory = useMemo(
    () => inventory
      .filter((item) => Number.isFinite(Number(item.ratePerDay)) && Number(item.ratePerDay) > 0)
      .sort((left, right) => Number(left.ratePerDay) - Number(right.ratePerDay)),
    [inventory],
  );

  const handleBookNow = (packageId?: string) => {
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

    if (packageId) {
      params.set('packageId', packageId);
    }

    const bookingUrl = params.toString()
      ? `/book/${resolvedSlug}?${params.toString()}`
      : `/book/${resolvedSlug}`;
    navigate(bookingUrl);
  };

  if (loading) return <CustomerLayout normalHeader><LoadingSpinner size="lg" /></CustomerLayout>;
  if (!vendor) return <CustomerLayout normalHeader><div className="text-center py-20 text-slate-400">{t('vendorLandingPage.notFound')}</div></CustomerLayout>;

  const vendorLatitude = Number(vendor.latitude);
  const vendorLongitude = Number(vendor.longitude);
  const vendorMapUrl = Number.isFinite(vendorLatitude) && Number.isFinite(vendorLongitude)
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${vendorLatitude},${vendorLongitude}`)}`
    : null;
  const helpersNeeded = Math.max(0, Math.floor(parseQueryNumber(searchParams.get('helpersNeeded')) ?? 0));
  const customerLatitude = parseQueryNumber(searchParams.get('lat'));
  const customerLongitude = parseQueryNumber(searchParams.get('lng'));
  const estimatedDistanceKm = customerLatitude != null && customerLongitude != null && vendorMapUrl
    ? haversineDistanceKm(
      { lat: vendorLatitude, lng: vendorLongitude },
      { lat: customerLatitude, lng: customerLongitude },
    )
    : null;
  const estimatedDeliveryRate = estimatedDistanceKm != null
    ? estimateDeliveryRate(estimatedDistanceKm, helpersNeeded, normalizedDeliveryRates)
    : null;
  const lowestDailyRate = pricedInventory.length ? Number(pricedInventory[0].ratePerDay) : null;
  const highestDailyRate = pricedInventory.length ? Number(pricedInventory[pricedInventory.length - 1].ratePerDay) : null;
  const cheapestItemName = pricedInventory[0]?.itemType?.name || null;
  const pricingRangeLabel = lowestDailyRate == null
    ? null
    : highestDailyRate != null && highestDailyRate !== lowestDailyRate
      ? `${formatCurrency(lowestDailyRate)} - ${formatCurrency(highestDailyRate)}`
      : formatCurrency(lowestDailyRate);
  const lowestDeliveryCharge = normalizedDeliveryRates.length
    ? Math.min(...normalizedDeliveryRates.map((rate) => rate.chargeAmount))
    : null;
  const maxDeliveryDistanceKm = normalizedDeliveryRates.length
    ? Math.max(...normalizedDeliveryRates.map((rate) => rate.distanceKm))
    : null;
  const maxHelpersSupported = normalizedDeliveryRates.length
    ? Math.max(...normalizedDeliveryRates.map((rate) => rate.helpersCount))
    : null;
  const totalUnits = breakdown.reduce((sum, row) => sum + row.total, 0);
  const totalAvailable = breakdown.reduce((sum, row) => sum + row.available, 0);

  const handleOpenVendorMap = () => {
    if (!vendorMapUrl) {
      return;
    }

    window.open(vendorMapUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSubmitReview = async () => {
    if (!vendor) return;

    if (!token) {
      savePostLoginRedirect(getCurrentAppPath());
      navigate('/login');
      return;
    }

    if (user?.role !== 'customer') {
      toast.error('Only customer accounts can submit rental partner reviews.');
      return;
    }

    setSubmittingReview(true);
    try {
      const updatedReviews = await submitVendorReview(vendor.id, reviewRating, reviewComment.trim() || undefined);
      setReviews(updatedReviews);
      toast.success(customerExistingReview ? 'Review updated.' : 'Review submitted.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <CustomerLayout normalHeader>
      <div className="max-w-7xl mx-auto px-3 py-6 space-y-6">

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="rounded-2xl overflow-hidden shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[420px]">
            {/* Gallery */}
            <div className="lg:col-span-2 bg-slate-950 flex">
              {galleryPhotos.length > 0 ? (
                <>
                  <div className="flex-1 relative flex items-center justify-center min-h-[280px] bg-slate-950">
                    <img
                      src={galleryPhotos[selectedGalleryImage]}
                      alt="Rental Partner gallery"
                      className="max-w-full max-h-[280px] object-contain px-4"
                    />
                    {galleryPhotos.length > 1 && (
                      <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
                        {selectedGalleryImage + 1} / {galleryPhotos.length}
                      </span>
                    )}
                  </div>
                  {galleryPhotos.length > 1 && (
                    <div className="w-14 flex flex-col gap-1 bg-slate-900 p-1 overflow-y-auto">
                      {galleryPhotos.map((photo, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedGalleryImage(idx)}
                          className={`h-12 rounded-md overflow-hidden border-2 transition flex-shrink-0 bg-slate-950 flex items-center justify-center ${idx === selectedGalleryImage
                            ? 'border-[#b7e92f] ring-1 ring-[#b7e92f]/50'
                            : 'border-slate-700 hover:border-slate-500'
                            }`}
                          aria-label={`Gallery image ${idx + 1}`}
                        >
                          <img src={photo} alt={`Thumbnail ${idx + 1}`} className="max-w-full max-h-full object-contain" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full min-h-[320px] flex items-center justify-center text-slate-500 text-sm">
                  No gallery images available
                </div>
              )}
            </div>

            {/* Vendor Info Panel */}
            <div className="lg:col-span-1 p-6 flex flex-col justify-between bg-[#1f2944]">
              <div className="flex-1 flex flex-col">
                {(vendor.verificationBadge || vendor.isVerified) && (
                  <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-[#b7e92f]/40 bg-[#b7e92f]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#b7e92f]">
                    <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.53 5.53a.75.75 0 0 0-1.06-1.06L7 8.94 5.53 7.47a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4-4Z" clipRule="evenodd" />
                    </svg>
                    {vendor.verificationBadge || t('vendorLandingPage.verifiedVendor')}
                  </span>
                )}

                <h1 className="text-2xl font-extrabold text-white leading-tight mb-1">{vendor.businessName}</h1>

                {displayedTotalRatings > 0 && (
                  <div className="flex items-center gap-1.5 mb-4">
                    <span className="text-amber-400 text-sm">{renderStars(displayedAverageRating)}</span>
                    <span className="text-white/90 text-sm font-semibold">{displayedAverageRating.toFixed(1)}</span>
                    <span className="text-white/50 text-sm">({displayedTotalRatings})</span>
                  </div>
                )}

                <div className="space-y-2.5 mb-4">
                  {vendor.address && (
                    <div className="flex items-start gap-2">
                      <svg className="h-4 w-4 mt-0.5 text-white/40 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M8 1.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM2 6a6 6 0 1 1 10.586 3.938l-3.96 4.43a.75.75 0 0 1-1.12 0l-3.96-4.43A5.972 5.972 0 0 1 2 6Zm6 1a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" clipRule="evenodd" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-white/80 text-sm leading-snug">{vendor.address}</p>
                        {vendorMapUrl && (
                          <button
                            type="button"
                            onClick={handleOpenVendorMap}
                            className="mt-0.5 text-[11px] font-medium text-[#b7e92f] hover:underline focus:outline-none"
                          >
                            {t('vendorLandingPage.openMap')} →
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {vendor.phone && (
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-white/40 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M3.5 2A1.5 1.5 0 0 0 2 3.5V4c0 5.799 4.701 10.5 10.5 10.5h.5a1.5 1.5 0 0 0 1.5-1.5v-.663a1.5 1.5 0 0 0-.964-1.404l-2-.758a1.5 1.5 0 0 0-1.596.34l-.44.44a.75.75 0 0 1-.907.12A8.483 8.483 0 0 1 5.52 7.607a.75.75 0 0 1 .12-.907l.44-.439a1.5 1.5 0 0 0 .341-1.597l-.758-2A1.5 1.5 0 0 0 4.163 2H3.5Z" clipRule="evenodd" />
                      </svg>
                      <p className="text-white/80 text-sm">{vendor.phone}</p>
                    </div>
                  )}
                </div>

                {vendor.description && (
                  <p className="text-white/60 text-sm leading-relaxed line-clamp-3 mb-4">{vendor.description}</p>
                )}

                {/* Trust stats grid */}
                <div className="grid grid-cols-2 gap-2 mb-5">
                  <div className="rounded-xl bg-white/10 px-3 py-2.5">
                    <p className="text-[11px] text-white/50 font-medium uppercase tracking-wider">Available</p>
                    <p className="text-lg font-bold text-white mt-0.5">{totalAvailable} <span className="text-sm font-normal text-white/60">units</span></p>
                  </div>
                  <div className="rounded-xl bg-white/10 px-3 py-2.5">
                    <p className="text-[11px] text-white/50 font-medium uppercase tracking-wider">From</p>
                    <p className="text-lg font-bold text-[#b7e92f] mt-0.5">
                      {lowestDailyRate != null
                        ? <>{formatCurrency(lowestDailyRate)} <span className="text-xs font-normal text-white/60">/day</span></>
                        : '—'}
                    </p>
                  </div>
                  {normalizedDeliveryRates.length > 0 && lowestDeliveryCharge != null && (
                    <div className="rounded-xl bg-white/10 px-3 py-2.5">
                      <p className="text-[11px] text-white/50 font-medium uppercase tracking-wider">Delivery</p>
                      <p className="text-lg font-bold text-white mt-0.5">{formatCurrency(lowestDeliveryCharge)} <span className="text-xs font-normal text-white/60">+up</span></p>
                    </div>
                  )}
                  {inventory.length > 0 && (
                    <div className="rounded-xl bg-white/10 px-3 py-2.5">
                      <p className="text-[11px] text-white/50 font-medium uppercase tracking-wider">Item Types</p>
                      <p className="text-lg font-bold text-white mt-0.5">{inventory.length}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Primary CTA */}
              <div className="pt-3 border-t border-white/10">
                <Button
                  onClick={() => handleBookNow()}
                  size="lg"
                  className="w-full !rounded-xl !border-2 !border-[#b7e92f] !bg-[#b7e92f] !px-6 !py-3 !text-base !font-extrabold !text-[#1f2944] shadow-lg shadow-[#b7e92f]/20 hover:!bg-[#9fcd23] hover:!border-[#9fcd23] focus:!ring-2 focus:!ring-[#b7e92f]/50 transition-all"
                >
                  {t('vendorLandingPage.bookNow')}
                </Button>
                {vendor.deliveryVehicles && vendor.deliveryVehicles.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {vendor.deliveryVehicles.map((vehicle, idx) => (
                      <span key={idx} className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-medium text-white/70">
                        {vehicle.type}{vehicle.description ? ` · ${vehicle.description}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Packages ─────────────────────────────────────────────── */}
        {(packagesLoading || publicPackages.length > 0) && (
          <section className="rounded-2xl overflow-hidden border-2 border-[#b7e92f]/60 bg-white shadow-md">
            <div className="bg-gradient-to-r from-[#1f2944] to-[#2d3d5c] px-6 py-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b7e92f]">Ready-Made Packages</p>
                <h2 className="mt-0.5 text-xl font-extrabold text-white">Book Faster With Curated Sets</h2>
              </div>
              {!packagesLoading && (
                <span className="rounded-full bg-[#b7e92f] px-3 py-1 text-xs font-bold text-[#1f2944]">
                  {publicPackages.length} {publicPackages.length === 1 ? 'Package' : 'Packages'}
                </span>
              )}
            </div>
            <div className="p-5">
              {packagesLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {publicPackages.map((vendorPackage) => {
                    const packageSubtotal = vendorPackage.items.reduce((sum, item) => {
                      const unitPrice = Number(item.unitPrice || 0);
                      return sum + Math.max(0, unitPrice) * Math.max(0, Number(item.requiredQty) || 0);
                    }, 0);
                    return (
                      <article key={vendorPackage.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 hover:border-[#b7e92f] hover:shadow-md transition-all group">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#1f2944]">{vendorPackage.packageName}</h3>
                          <span className="flex-shrink-0 rounded-full border border-[#b7e92f]/60 bg-[#b7e92f]/15 px-2 py-1 text-xs font-semibold text-[#1f2944]">
                            Package
                          </span>
                        </div>
                        <div className="space-y-1.5 mb-4">
                          {vendorPackage.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-2 text-sm text-slate-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#b7e92f] flex-shrink-0" />
                              {item.itemType?.name || 'Item type'}
                              <span className="ml-auto font-medium text-slate-500">×{item.requiredQty}</span>
                            </div>
                          ))}
                        </div>
                        <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                          <div>
                            {packageSubtotal > 0 ? (
                              <>
                                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Est. per day</p>
                                <p className="text-lg font-extrabold text-slate-900">{formatCurrency(packageSubtotal)}</p>
                              </>
                            ) : (
                              <p className="text-sm text-slate-500">Price based on selection</p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleBookNow(vendorPackage.id)}
                            className="!rounded-lg !border !border-[#b7e92f] !bg-[#b7e92f] !text-[#1f2944] !font-bold hover:!bg-[#9fcd23] flex-shrink-0"
                          >
                            Book This Package
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Pricing & Delivery ───────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <span className="h-5 w-1 rounded-full bg-[#b7e92f]" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('vendorLandingPage.pricingAtGlance')}</p>
            </div>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                {lowestDailyRate != null ? (
                  <>
                    <p className="text-xs font-medium text-slate-500">{t('vendorLandingPage.startingAt')}</p>
                    <p className="mt-1 text-4xl font-extrabold text-slate-900">
                      {formatCurrency(lowestDailyRate)}
                      <span className="ml-1 text-base font-medium text-slate-400">/day</span>
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">{t('vendorLandingPage.noItems')}</p>
                )}
                {cheapestItemName && (
                  <p className="mt-1 text-sm text-slate-500">{t('vendorLandingPage.lowestPricedItem', { item: cheapestItemName })}</p>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('vendorLandingPage.itemTypesLabel')}</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{inventory.length}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t('vendorLandingPage.priceRange')}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{pricingRangeLabel ?? '—'}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t('vendorLandingPage.totalUnitsLabel')}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{totalUnits}</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">{t('vendorLandingPage.availableNowLabel')}</p>
                <p className="mt-1 text-sm font-semibold text-emerald-700">{totalAvailable}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <span className="h-5 w-1 rounded-full bg-[#b7e92f]" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('vendorLandingPage.deliveryAndService')}</p>
            </div>
            {deliveryRatesLoading ? (
              <div className="mt-6 flex justify-center">
                <LoadingSpinner size="md" />
              </div>
            ) : normalizedDeliveryRates.length > 0 ? (
              <>
                <p className="text-xs font-medium text-slate-500">{t('vendorLandingPage.deliveryFrom')}</p>
                <p className="mt-1 text-4xl font-extrabold text-slate-900">{formatCurrency(lowestDeliveryCharge ?? 0)}</p>
                <p className="mt-2 text-sm text-slate-500">{t('vendorLandingPage.finalDeliveryQuoteNote')}</p>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t('vendorLandingPage.serviceRadius')}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {maxDeliveryDistanceKm != null ? t('vendorLandingPage.upToKm', { km: formatDistanceKm(maxDeliveryDistanceKm) }) : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t('vendorLandingPage.helpersSupported')}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {maxHelpersSupported != null ? t('vendorLandingPage.upToHelpers', { count: maxHelpersSupported }) : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {estimatedDeliveryRate
                        ? t('vendorLandingPage.estimateForYourLocation')
                        : estimatedDistanceKm != null
                          ? t('vendorLandingPage.distanceToYourLocation')
                          : t('vendorLandingPage.publishedTiers')}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {estimatedDeliveryRate
                        ? formatCurrency(estimatedDeliveryRate.chargeAmount)
                        : estimatedDistanceKm != null
                          ? `${formatDistanceKm(estimatedDistanceKm)} km`
                          : t('vendorLandingPage.tierCount', { count: normalizedDeliveryRates.length })}
                    </p>
                  </div>
                </div>
                {estimatedDeliveryRate && estimatedDistanceKm != null && (
                  <p className="mt-3 text-xs text-slate-500">
                    {t('vendorLandingPage.distanceToYourLocation')}: {formatDistanceKm(estimatedDistanceKm)} km
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="mt-3 text-lg font-semibold text-slate-900">{t('vendorLandingPage.noDeliveryRates')}</p>
                <p className="mt-2 text-sm text-slate-500">{t('vendorLandingPage.finalDeliveryQuoteNote')}</p>
              </>
            )}
          </section>
        </div>

        {/* ── Equipment Catalog ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-5">
              <span className="h-5 w-1 rounded-full bg-[#b7e92f]" />
              <h2 className="text-lg font-bold text-slate-900">Equipment Catalog</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {inventory.map((item) => {
                const itemImageUrls = getInventoryItemImageUrls(item);
                const primaryItemImageUrl = itemImageUrls[0] || '';
                const color = colorMap[item.id] ?? ITEM_PALETTE[0];
                return (
                  <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-slate-300 transition group">
                    <div className={`${color.bg} h-1.5 w-full`} />
                    <div className="h-32 bg-slate-50 flex items-center justify-center p-3 border-b border-slate-100">
                      {primaryItemImageUrl
                        ? <img src={primaryItemImageUrl} alt={item.itemType?.name ?? ''} className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-200" />
                        : <span className="text-slate-300 text-xs">No image</span>}
                    </div>
                    <div className="p-3.5">
                      <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-1">
                        {item.itemType?.name}
                        {item.color ? <span className="font-normal text-slate-400 ml-1">· {item.color}</span> : ''}
                      </p>
                      {item.brand && <p className="text-xs text-slate-400 mt-0.5">{item.brand.name}</p>}
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${color.pill}`}>
                          {item.availableQuantity} avail
                        </span>
                        <p className="text-sm font-extrabold text-slate-900">
                          {formatCurrency(item.ratePerDay)}<span className="text-xs text-slate-400 font-normal">/day</span>
                        </p>
                      </div>
                      {item.condition && <p className="mt-1 text-xs text-slate-400 capitalize">{item.condition}</p>}
                    </div>
                  </div>
                );
              })}
              {inventory.length === 0 && (
                <div className="col-span-full rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-400">
                  {t('vendorLandingPage.noItems')}
                </div>
              )}
            </div>
          </section>

          <section className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-5">
              <span className="h-5 w-1 rounded-full bg-[#b7e92f]" />
              <h2 className="text-lg font-bold text-slate-900">Inventory Status</h2>
            </div>
            <BreakdownArmy />
          </section>
        </div>

        {/* ── Reviews ──────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <span className="h-5 w-1 rounded-full bg-amber-400" />
            <h2 className="text-lg font-bold text-slate-900">Customer Reviews</h2>
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
            {/* Rating Summary */}
            <div className="flex-shrink-0 rounded-2xl bg-slate-50 border border-slate-200 p-5 text-center lg:w-36">
              <p className="text-5xl font-extrabold text-slate-900 leading-none">{displayedAverageRating.toFixed(1)}</p>
              <p className="mt-2 text-base text-amber-500">{renderStars(displayedAverageRating)}</p>
              <p className="mt-1 text-xs text-slate-500">{displayedTotalRatings} review{displayedTotalRatings === 1 ? '' : 's'}</p>
            </div>

            {/* Review Form */}
            <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-bold text-slate-900 mb-3">
                {customerExistingReview ? 'Update your review' : 'Leave a review'}
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setReviewRating(rating)}
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${reviewRating === rating
                      ? 'bg-amber-500 text-white'
                      : 'border border-slate-300 bg-white text-slate-700 hover:border-amber-400'}`}
                  >
                    {rating} star{rating === 1 ? '' : 's'}
                  </button>
                ))}
              </div>
              <textarea
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                rows={3}
                placeholder="Share what customers should know about this rental partner."
                disabled={!token || user?.role !== 'customer' || submittingReview}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-[#1f2944] focus:outline-none resize-none"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                {!token ? (
                  <p className="text-xs text-slate-500">Sign in as customer to post a review.</p>
                ) : user?.role !== 'customer' ? (
                  <p className="text-xs text-slate-500">Only customer accounts can post reviews.</p>
                ) : (
                  <p className="text-xs text-slate-500">One review per account — update anytime.</p>
                )}
                <Button
                  onClick={() => void handleSubmitReview()}
                  isProcessing={submittingReview}
                  disabled={Boolean(token) && user?.role !== 'customer'}
                >
                  {!token ? 'Sign In to Review' : customerExistingReview ? 'Update Review' : 'Post Review'}
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {reviewsLoading ? (
              <div className="flex justify-center py-6">
                <LoadingSpinner size="md" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                No reviews yet. Be the first customer to share feedback.
              </div>
            ) : (
              reviews.map((review) => (
                <article key={review.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{review.reviewerUser?.name || 'Customer'}</p>
                      <p className="text-sm font-medium text-amber-500">{renderStars(review.rating)}</p>
                    </div>
                    <p className="text-xs text-slate-500">{formatDate(review.updatedAt || review.createdAt)}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {review.comment?.trim() || 'Rated this rental partner without a written comment.'}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </CustomerLayout>
  );

  function BreakdownArmy() {
    if (breakdownLoading) return <LoadingSpinner size="md" />;
    if (!breakdown.length) return <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-400">No breakdown data</div>;

    return (
      <div className="space-y-3">
        {breakdown.slice(0, 8).map((row, idx) => {
          const color = colorMap[row.id] ?? ITEM_PALETTE[idx % ITEM_PALETTE.length];
          const availPercent = row.total > 0 ? (row.available / row.total) * 100 : 0;
          return (
            <div key={row.id} className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="flex items-start gap-2 mb-2">
                <span className={`h-3 w-3 rounded-sm mt-0.5 flex-shrink-0 ${color.bg}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 line-clamp-1">
                    {row.itemType?.name}
                    {row.color ? <span className="font-normal text-slate-500"> - {row.color}</span> : null}
                  </p>
                  <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={color.bg}
                      style={{ width: `${availPercent}%` }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 px-5">
                {row.available}/{row.total}
              </p>
            </div>
          );
        })}
        {breakdown.length > 8 && (
          <p className="text-xs text-slate-400 text-center py-2">
            ... and {breakdown.length - 8} more items
          </p>
        )}
      </div>
    );
  }
}