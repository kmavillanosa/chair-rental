import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from 'flowbite-react';
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import L from 'leaflet';
import CustomerLayout from '../../components/layout/CustomerLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { getNearbyVendors } from '../../api/vendors';
import type { Vendor } from '../../types';
import { formatCurrency, formatDate } from '../../utils/format';
import { useTranslation } from 'react-i18next';

// Fix Leaflet default icon when bundled by Vite.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_SEARCH_POINT: [number, number] = [9.7392, 118.7353];
const RADIUS_OPTIONS_KM = [1, 3, 5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100];

function getZoomFromRadius(radiusKm: number) {
    if (radiusKm <= 3) return 14;
    if (radiusKm <= 8) return 13;
    if (radiusKm <= 25) return 12;
    if (radiusKm <= 50) return 11;
    return 10;
}

function ResultsMapViewport({
    center,
    radiusKm,
    vendors,
}: {
    center: [number, number];
    radiusKm: number;
    vendors: Vendor[];
}) {
    const map = useMap();

    useEffect(() => {
        const validVendorPoints = vendors
            .map((vendor) => {
                const lat = Number(vendor.latitude);
                const lng = Number(vendor.longitude);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                return L.latLng(lat, lng);
            })
            .filter((point): point is L.LatLng => Boolean(point));

        if (validVendorPoints.length > 0) {
            const bounds = L.latLngBounds(validVendorPoints);
            bounds.extend(L.latLng(center[0], center[1]));
            map.fitBounds(bounds.pad(0.2), {
                animate: true,
                maxZoom: 14,
                paddingTopLeft: [36, 210],
                paddingBottomRight: [36, 36],
            });
            return;
        }

        map.setView(center, getZoomFromRadius(radiusKm), { animate: true });
    }, [center, map, radiusKm, vendors]);

    return null;
}

function parseNumberParam(value: string | null, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDateParam(value: string | null) {
    const normalized = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function compareNullableNumberAscending(left: number | null | undefined, right: number | null | undefined) {
    const leftNull = left == null || !Number.isFinite(Number(left));
    const rightNull = right == null || !Number.isFinite(Number(right));

    if (leftNull && rightNull) return 0;
    if (leftNull) return 1;
    if (rightNull) return -1;
    return Number(left) - Number(right);
}

function compareVendorsByBestCriteria(
    left: Vendor,
    right: Vendor,
    requiredItemTypeCount: number,
) {
    const leftMatched = Number(left.matchedItemTypeCount ?? 0);
    const rightMatched = Number(right.matchedItemTypeCount ?? 0);

    if (requiredItemTypeCount > 0 && leftMatched !== rightMatched) {
        return rightMatched - leftMatched;
    }

    const chargeCompare = compareNullableNumberAscending(
        left.estimatedDeliveryCharge,
        right.estimatedDeliveryCharge,
    );
    if (chargeCompare !== 0) return chargeCompare;

    const leftDistance = Number.isFinite(left.distanceKm) ? Number(left.distanceKm) : Number.POSITIVE_INFINITY;
    const rightDistance = Number.isFinite(right.distanceKm) ? Number(right.distanceKm) : Number.POSITIVE_INFINITY;
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;

    return left.businessName.localeCompare(right.businessName);
}

export default function CustomerResults() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [requestError, setRequestError] = useState<string | null>(null);

    const modifySearchPath = useMemo(() => {
        const queryString = searchParams.toString();
        return queryString ? `/?${queryString}` : '/';
    }, [searchParams]);

    const goToModifySearch = useCallback(() => {
        navigate(modifySearchPath);
    }, [modifySearchPath, navigate]);

    const lat = useMemo(() => Number(searchParams.get('lat')), [searchParams]);
    const lng = useMemo(() => Number(searchParams.get('lng')), [searchParams]);
    const radiusKm = useMemo(() => parseNumberParam(searchParams.get('radius'), 25), [searchParams]);
    const helpersNeeded = useMemo(() => parseNumberParam(searchParams.get('helpersNeeded'), 0), [searchParams]);
    const addressLabel = useMemo(() => (searchParams.get('address') || '').trim(), [searchParams]);
    const startDate = useMemo(() => parseDateParam(searchParams.get('startDate')), [searchParams]);
    const endDate = useMemo(() => parseDateParam(searchParams.get('endDate')), [searchParams]);
    const itemTypeIdsParam = useMemo(() => searchParams.get('itemTypeIds') || '', [searchParams]);
    const dateRangeLabel = useMemo(() => {
        if (!startDate || !endDate) return t('common.na');
        return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }, [endDate, startDate, t]);

    const itemTypeIds = useMemo(
        () =>
            itemTypeIdsParam
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean),
        [itemTypeIdsParam],
    );

    // Helper to build vendor URL with dates
    const getVendorShopUrl = (slug: string) => {
        const url = `/shop/${slug}`;
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        return params.toString() ? `${url}?${params}` : url;
    };

    const isCoordinatesValid = Number.isFinite(lat) && Number.isFinite(lng);
    const searchCenter = isCoordinatesValid ? ([lat, lng] as [number, number]) : DEFAULT_SEARCH_POINT;

    useEffect(() => {
        if (!isCoordinatesValid) {
            setRequestError(t('customerResults.missingLocation'));
            setLoading(false);
            return;
        }

        setLoading(true);
        setRequestError(null);

        getNearbyVendors(lat, lng, {
            radius: radiusKm,
            itemTypeIds,
            helpersNeeded,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
        })
            .then((results) => {
                setVendors(results);
            })
            .catch((error: any) => {
                const message = error?.response?.data?.message || t('customerResults.failedLoadNearby');
                setRequestError(message);
                toast.error(message);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [endDate, helpersNeeded, isCoordinatesValid, itemTypeIds, itemTypeIdsParam, lat, lng, radiusKm, startDate, t]);

    const vendorsWithPins = useMemo(() => {
        return vendors.filter((vendor) => {
            const vendorLat = Number(vendor.latitude);
            const vendorLng = Number(vendor.longitude);
            if (!Number.isFinite(vendorLat) || !Number.isFinite(vendorLng)) return false;

            if (!itemTypeIds.length) return true;

            const matchedCount = Number(vendor.matchedItemTypeCount ?? 0);
            return matchedCount >= itemTypeIds.length;
        });
    }, [itemTypeIds.length, vendors]);

    const topVendors = useMemo(() => {
        return [...vendorsWithPins]
            .sort((a, b) => compareVendorsByBestCriteria(a, b, itemTypeIds.length))
            .slice(0, 4);
    }, [itemTypeIds.length, vendorsWithPins]);

    const radiusOptions = useMemo(() => {
        const nextSet = new Set<number>(RADIUS_OPTIONS_KM);
        if (Number.isFinite(radiusKm) && radiusKm > 0) nextSet.add(radiusKm);
        return [...nextSet].sort((a, b) => a - b);
    }, [radiusKm]);

    const updateRadius = (nextRadiusKm: number) => {
        if (!Number.isFinite(nextRadiusKm) || nextRadiusKm <= 0 || nextRadiusKm === radiusKm) return;
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('radius', String(nextRadiusKm));
        setSearchParams(nextParams, { replace: true });
    };

    return (
        <CustomerLayout>
            <section className="relative h-[calc(100dvh-80px)] min-h-[560px] w-full overflow-hidden bg-slate-100">
                <MapContainer center={searchCenter} zoom={12} zoomControl={false} className="h-full w-full">
                    <ResultsMapViewport center={searchCenter} radiusKm={radiusKm} vendors={vendorsWithPins} />
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution="&copy; OpenStreetMap contributors"
                    />
                    <ZoomControl position="bottomright" />

                    <Circle
                        center={searchCenter}
                        radius={radiusKm * 1000}
                        pathOptions={{
                            color: '#dc2626',
                            weight: 3,
                            opacity: 0.7,
                            dashArray: '10 10',
                            fillColor: '#fca5a5',
                            fillOpacity: 0.06,
                        }}
                    />

                    <CircleMarker
                        center={searchCenter}
                        radius={8}
                        pathOptions={{ color: '#1d4ed8', fillColor: '#2563eb', fillOpacity: 0.95, weight: 2 }}
                    >
                        <Popup>
                            <p className="font-semibold">{t('customerResults.popupSearchCenter')}</p>
                            {addressLabel && <p className="text-sm text-gray-700">{addressLabel}</p>}
                        </Popup>
                    </CircleMarker>

                    {vendorsWithPins.map((vendor) => (
                        <Marker key={vendor.id} position={[Number(vendor.latitude), Number(vendor.longitude)]}>
                            <Popup>
                                <p className="text-base font-bold">{vendor.businessName}</p>
                                {vendor.verificationBadge && (
                                    <p className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                        {vendor.verificationBadge}
                                    </p>
                                )}
                                <p className="text-sm text-gray-600">{vendor.address}</p>
                                {vendor.distanceKm != null && (
                                    <p className="mt-1 text-sm">{t('customerResults.popupDistance', { distance: vendor.distanceKm.toFixed(1) })}</p>
                                )}
                                {vendor.estimatedDeliveryCharge != null && (
                                    <p className="mt-1 text-sm text-blue-700">
                                        {t('customerResults.popupEstimatedDelivery', { charge: formatCurrency(vendor.estimatedDeliveryCharge) })}
                                    </p>
                                )}
                                {itemTypeIds.length > 0 && (
                                    <p className="mt-1 text-sm">
                                        {t('customerResults.popupStockMatch', {
                                            matched: vendor.matchedItemTypeCount ?? 0,
                                            required: itemTypeIds.length,
                                        })}
                                    </p>
                                )}
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        navigate(getVendorShopUrl(vendor.slug));
                                    }}
                                    className="mt-2 rounded-lg bg-blue-600 px-3 py-1 text-sm text-white"
                                >
                                    {t('customerResults.popupViewShop')}
                                </button>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>

                <div className="pointer-events-none absolute inset-x-0 top-0 z-[900] h-24 bg-gradient-to-b from-slate-950/30 to-transparent" />

                <div className="absolute left-4 top-4 z-[1000] w-[min(92vw,430px)] rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-2xl backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">{t('customerResults.panelLabel')}</p>
                    <h1 className="mt-1 text-xl font-bold leading-tight text-slate-900 sm:text-2xl">{t('customerResults.panelTitle')}</h1>
                    <p className="mt-1 text-sm text-slate-600">
                        {addressLabel
                            ? t('customerResults.panelAroundAddress', { address: addressLabel })
                            : t('customerResults.panelGeneric')}
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-slate-100 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('customerResults.panelRadius')}</p>
                            <select
                                value={String(radiusKm)}
                                onChange={(event) => updateRadius(Number(event.target.value))}
                                title={`${radiusKm} km`}
                                className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                            >
                                {radiusOptions.map((value) => (
                                    <option key={value} value={String(value)}>
                                        {value} km
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="rounded-xl bg-slate-100 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('customerResults.panelHelpers')}</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-800">{helpersNeeded}</p>
                        </div>
                        <div className="rounded-xl bg-slate-100 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('customerResults.panelEquipment')}</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-800">{itemTypeIds.length || t('common.any')}</p>
                        </div>
                        <div className="col-span-2 rounded-xl bg-slate-100 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('common.dates')}</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-800">{dateRangeLabel}</p>
                        </div>
                        <div className="rounded-xl bg-slate-100 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('customerResults.panelPins')}</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-800">{vendorsWithPins.length}</p>
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="xs" color="light" onClick={goToModifySearch}>
                            {t('customerResults.modifySearch')}
                        </Button>
                        {topVendors[0] && (
                            <Button size="xs" onClick={() => navigate(getVendorShopUrl(topVendors[0].slug))}>
                                {t('customerResults.openNearestShop')}
                            </Button>
                        )}
                    </div>
                </div>

                {!loading && !requestError && topVendors.length > 0 && (
                    <div className="absolute bottom-4 left-4 z-[1000] hidden w-[min(92vw,430px)] rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-2xl backdrop-blur md:block">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('customerResults.closestMatches')}</p>
                        <div className="mt-2 space-y-2">
                            {topVendors.map((vendor) => (
                                <div
                                    key={vendor.id}
                                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                                >
                                    <div className="min-w-0 pr-2">
                                        <p className="truncate text-sm font-semibold text-slate-900">{vendor.businessName}</p>
                                        {vendor.verificationBadge && (
                                            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                                {vendor.verificationBadge}
                                            </p>
                                        )}
                                        <p className="text-xs text-slate-600">
                                            {vendor.distanceKm != null
                                                ? t('customerResults.cardDistanceAway', { distance: vendor.distanceKm.toFixed(1) })
                                                : t('customerResults.cardDistanceUnavailable')}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                                        onClick={() => navigate(`/shop/${vendor.slug}`)}
                                    >
                                        {t('customerResults.cardView')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="absolute inset-0 z-[1100] flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
                        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center shadow-xl">
                            <LoadingSpinner size="lg" />
                            <p className="mt-2 text-sm font-medium text-slate-700">{t('customerResults.loadingNearby')}</p>
                        </div>
                    </div>
                )}

                {!loading && requestError && (
                    <div className="absolute inset-x-4 bottom-6 z-[1100] mx-auto w-[min(92vw,520px)] rounded-2xl border border-red-200 bg-white px-5 py-4 text-center shadow-xl">
                        <p className="text-base font-semibold text-red-700">{t('customerResults.loadFailedTitle')}</p>
                        <p className="mt-1 text-sm text-slate-600">{requestError}</p>
                        <Button size="sm" className="mt-3" onClick={goToModifySearch}>
                            {t('customerResults.backToSearch')}
                        </Button>
                    </div>
                )}

                {!loading && !requestError && vendorsWithPins.length === 0 && (
                    <div className="absolute inset-x-4 bottom-6 z-[1100] mx-auto w-[min(92vw,520px)] rounded-2xl border border-slate-200 bg-white px-5 py-4 text-center shadow-xl">
                        <p className="text-base font-semibold text-slate-900">{t('customerResults.noMatchesTitle')}</p>
                        <p className="mt-1 text-sm text-slate-600">{t('customerResults.noMatchesSubtitle')}</p>
                        <Button size="sm" color="light" className="mt-3" onClick={goToModifySearch}>
                            {t('customerResults.modifySearch')}
                        </Button>
                    </div>
                )}
            </section>
        </CustomerLayout>
    );
}
