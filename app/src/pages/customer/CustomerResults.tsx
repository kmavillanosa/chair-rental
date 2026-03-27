import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'flowbite-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { Circle, CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';
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

type RouteArrowPoint = {
    id: string;
    position: [number, number];
    bearing: number;
};

type VendorComparisonRow = {
    id: string;
    vendorName: string;
    vendorSlug: string;
    shortName: string;
    estimatedDeliveryCharge: number | null;
    distanceKm: number | null;
    matchedItemTypeCount: number;
    stockCoveragePercent: number;
    bestValueScore: number;
};

type ComparisonSortMode = 'best_value' | 'cheapest' | 'nearest' | 'stock';

function toRadians(value: number) {
    return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
    return (value * 180) / Math.PI;
}

function getBearingDegrees(start: [number, number], end: [number, number]) {
    const [startLat, startLng] = start;
    const [endLat, endLng] = end;

    const startLatRad = toRadians(startLat);
    const endLatRad = toRadians(endLat);
    const deltaLngRad = toRadians(endLng - startLng);

    const y = Math.sin(deltaLngRad) * Math.cos(endLatRad);
    const x =
        Math.cos(startLatRad) * Math.sin(endLatRad) -
        Math.sin(startLatRad) * Math.cos(endLatRad) * Math.cos(deltaLngRad);

    return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function createRouteArrowIcon(bearing: number) {
    // Bearing uses 0deg at north, but the glyph points east at 0deg in CSS rotation.
    const cssRotation = (bearing - 90 + 360) % 360;

    return L.divIcon({
        className: 'route-direction-arrow',
        html: `<span style="display:inline-block;transform:rotate(${cssRotation.toFixed(2)}deg);font-size:14px;color:#ea580c;text-shadow:0 0 2px #ffffff,0 0 4px #ffffff;">➤</span>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
    });
}

const vendorPinIcon = L.icon({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [18, 30],
    iconAnchor: [9, 30],
    popupAnchor: [1, -25],
    shadowSize: [30, 30],
    shadowAnchor: [9, 30],
});

const testVendorPinIcon = L.divIcon({
    className: 'test-vendor-pin-icon',
    html: `
            <div style="width:16px;height:26px;">
                <img
                    src="https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png"
                    style="width:100%;height:100%;display:block;filter:hue-rotate(145deg) saturate(2.2) brightness(1.05);"
                    alt="test rental partner pin"
                />
            </div>
        `,
    iconSize: [16, 26],
    iconAnchor: [8, 26],
    popupAnchor: [1, -22],
});

function buildRouteArrowPoints(path: [number, number][]) {
    if (path.length < 3) return [] as RouteArrowPoint[];

    const totalDistanceMeters = path.slice(1).reduce((sum, point, index) => {
        const previous = path[index];
        return sum + L.latLng(previous[0], previous[1]).distanceTo(L.latLng(point[0], point[1]));
    }, 0);

    const preferredArrowCount =
        totalDistanceMeters < 1200 ? 2 : totalDistanceMeters < 3200 ? 3 : totalDistanceMeters < 8000 ? 4 : 6;

    const step = Math.max(2, Math.floor(path.length / (preferredArrowCount + 1)));
    const arrows: RouteArrowPoint[] = [];

    for (let index = step; index < path.length - 1; index += step) {
        const previous = path[Math.max(0, index - 1)];
        const current = path[index];
        const next = path[Math.min(path.length - 1, index + 1)];

        arrows.push({
            id: `${index}:${current[0].toFixed(6)}:${current[1].toFixed(6)}`,
            position: current,
            bearing: getBearingDegrees(previous, next),
        });

        if (arrows.length >= 8) break;
    }

    return arrows;
}

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
    reserveRightPanelSpace,
}: {
    center: [number, number];
    radiusKm: number;
    vendors: Vendor[];
    reserveRightPanelSpace: boolean;
}) {
    const map = useMap();

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const syncSize = () => {
            map.invalidateSize({ animate: false });
        };

        const raf = window.requestAnimationFrame(syncSize);
        const timer = window.setTimeout(syncSize, 180);

        window.addEventListener('resize', syncSize);
        window.addEventListener('orientationchange', syncSize);

        return () => {
            window.cancelAnimationFrame(raf);
            window.clearTimeout(timer);
            window.removeEventListener('resize', syncSize);
            window.removeEventListener('orientationchange', syncSize);
        };
    }, [map]);

    useEffect(() => {
        map.invalidateSize({ animate: false });

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

            const hasTopRightResultsPanel =
                reserveRightPanelSpace &&
                typeof window !== 'undefined' &&
                window.matchMedia('(min-width: 768px)').matches;

            map.fitBounds(bounds.pad(0.2), {
                animate: true,
                maxZoom: 14,
                paddingTopLeft: [20, 20],
                paddingBottomRight: hasTopRightResultsPanel ? [320, 20] : [20, 20],
            });
            return;
        }

        map.setView(center, getZoomFromRadius(radiusKm), { animate: true });
    }, [center, map, radiusKm, reserveRightPanelSpace, vendors]);

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
    const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
    const [desktopMatchesOpen, setDesktopMatchesOpen] = useState(false);
    const [activeRouteVendorId, setActiveRouteVendorId] = useState<string | null>(null);
    const [activeRouteVendorName, setActiveRouteVendorName] = useState('');
    const [activeRoutePoints, setActiveRoutePoints] = useState<[number, number][]>([]);
    const [activeRouteOnRoads, setActiveRouteOnRoads] = useState(false);
    const [loadingRoute, setLoadingRoute] = useState(false);
    const [comparisonOpen, setComparisonOpen] = useState(false);
    const [comparisonSortMode, setComparisonSortMode] = useState<ComparisonSortMode>('best_value');

    const routeRequestRef = useRef<AbortController | null>(null);
    const routeCacheRef = useRef(
        new Map<string, { points: [number, number][]; onRoads: boolean }>(),
    );

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
        return params.toString() ? `${url}?${params}` : url;
    };

    const isCoordinatesValid = Number.isFinite(lat) && Number.isFinite(lng);
    const searchCenter = isCoordinatesValid ? ([lat, lng] as [number, number]) : DEFAULT_SEARCH_POINT;
    const searchCenterKey = `${searchCenter[0].toFixed(6)},${searchCenter[1].toFixed(6)}`;

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

    useEffect(() => {
        return () => {
            routeRequestRef.current?.abort();
        };
    }, []);

    useEffect(() => {
        routeRequestRef.current?.abort();
        routeCacheRef.current.clear();
        setActiveRouteVendorId(null);
        setActiveRouteVendorName('');
        setActiveRoutePoints([]);
        setActiveRouteOnRoads(false);
        setLoadingRoute(false);
    }, [searchCenterKey]);

    useEffect(() => {
        if (!activeRouteVendorId) return;

        const stillVisible = vendorsWithPins.some((vendor) => vendor.id === activeRouteVendorId);
        if (stillVisible) return;

        setActiveRouteVendorId(null);
        setActiveRouteVendorName('');
        setActiveRoutePoints([]);
        setActiveRouteOnRoads(false);
        setLoadingRoute(false);
    }, [activeRouteVendorId, vendorsWithPins]);

    const traceRouteToVendor = useCallback(
        async (vendor: Vendor) => {
            const vendorLat = Number(vendor.latitude);
            const vendorLng = Number(vendor.longitude);
            if (!Number.isFinite(vendorLat) || !Number.isFinite(vendorLng)) return;

            const cacheKey = `${searchCenterKey}:${vendor.id}`;
            const cachedRoute = routeCacheRef.current.get(cacheKey);
            if (cachedRoute) {
                setActiveRouteVendorId(vendor.id);
                setActiveRouteVendorName(vendor.businessName);
                setActiveRoutePoints(cachedRoute.points);
                setActiveRouteOnRoads(cachedRoute.onRoads);
                setLoadingRoute(false);
                return;
            }

            routeRequestRef.current?.abort();

            const controller = new AbortController();
            routeRequestRef.current = controller;

            const fallbackPath: [number, number][] = [
                searchCenter,
                [vendorLat, vendorLng],
            ];

            setActiveRouteVendorId(vendor.id);
            setActiveRouteVendorName(vendor.businessName);
            setActiveRoutePoints(fallbackPath);
            setActiveRouteOnRoads(false);
            setLoadingRoute(true);

            try {
                const routeUrl = new URL(
                    `https://router.project-osrm.org/route/v1/driving/${searchCenter[1]},${searchCenter[0]};${vendorLng},${vendorLat}`,
                );
                routeUrl.searchParams.set('overview', 'full');
                routeUrl.searchParams.set('geometries', 'geojson');
                routeUrl.searchParams.set('steps', 'false');

                const response = await fetch(routeUrl.toString(), {
                    signal: controller.signal,
                });
                if (!response.ok) throw new Error('Route API request failed.');

                const payload = (await response.json()) as {
                    routes?: Array<{
                        geometry?: {
                            coordinates?: [number, number][];
                        };
                    }>;
                };

                const coordinates = payload.routes?.[0]?.geometry?.coordinates || [];
                const routePoints = coordinates
                    .map(([pointLng, pointLat]) => {
                        const latValue = Number(pointLat);
                        const lngValue = Number(pointLng);
                        if (!Number.isFinite(latValue) || !Number.isFinite(lngValue)) return null;
                        return [latValue, lngValue] as [number, number];
                    })
                    .filter((point): point is [number, number] => Boolean(point));

                const resolvedPath = routePoints.length > 1 ? routePoints : fallbackPath;
                const onRoads = routePoints.length > 1;

                routeCacheRef.current.set(cacheKey, {
                    points: resolvedPath,
                    onRoads,
                });

                setActiveRoutePoints(resolvedPath);
                setActiveRouteOnRoads(onRoads);
            } catch (error: any) {
                if (error?.name === 'AbortError') return;

                routeCacheRef.current.set(cacheKey, {
                    points: fallbackPath,
                    onRoads: false,
                });

                setActiveRoutePoints(fallbackPath);
                setActiveRouteOnRoads(false);
            } finally {
                if (!controller.signal.aborted) {
                    setLoadingRoute(false);
                }
            }
        },
        [searchCenter, searchCenterKey],
    );

    const activeRouteArrows = useMemo(
        () => buildRouteArrowPoints(activeRoutePoints),
        [activeRoutePoints],
    );

    const topVendors = useMemo(() => {
        return [...vendorsWithPins]
            .sort((a, b) => compareVendorsByBestCriteria(a, b, itemTypeIds.length));
    }, [itemTypeIds.length, vendorsWithPins]);

    const comparisonRows = useMemo<VendorComparisonRow[]>(() => {
        const requiredStockCount = itemTypeIds.length;
        const rawRows = [...topVendors].map((vendor) => {
            const normalizedCharge =
                vendor.estimatedDeliveryCharge == null || !Number.isFinite(Number(vendor.estimatedDeliveryCharge))
                    ? null
                    : Number(vendor.estimatedDeliveryCharge);
            const normalizedDistance =
                vendor.distanceKm == null || !Number.isFinite(Number(vendor.distanceKm))
                    ? null
                    : Number(vendor.distanceKm);
            const matchedStock = Number(vendor.matchedItemTypeCount ?? 0);
            const stockCoveragePercent =
                requiredStockCount > 0
                    ? Math.min(100, Math.max(0, (matchedStock / requiredStockCount) * 100))
                    : 100;

            return {
                id: vendor.id,
                vendorName: vendor.businessName,
                vendorSlug: vendor.slug,
                shortName: vendor.businessName.slice(0, 14),
                estimatedDeliveryCharge: normalizedCharge,
                distanceKm: normalizedDistance,
                matchedItemTypeCount: matchedStock,
                stockCoveragePercent,
            };
        });

        const deliveryValues = rawRows
            .map((row) => row.estimatedDeliveryCharge)
            .filter((value): value is number => value != null);
        const distanceValues = rawRows
            .map((row) => row.distanceKm)
            .filter((value): value is number => value != null);
        const stockValues = rawRows.map((row) => row.stockCoveragePercent);

        const minDelivery = deliveryValues.length ? Math.min(...deliveryValues) : 0;
        const maxDelivery = deliveryValues.length ? Math.max(...deliveryValues) : 0;
        const minDistance = distanceValues.length ? Math.min(...distanceValues) : 0;
        const maxDistance = distanceValues.length ? Math.max(...distanceValues) : 0;
        const minStock = stockValues.length ? Math.min(...stockValues) : 0;
        const maxStock = stockValues.length ? Math.max(...stockValues) : 0;

        const normalize = (value: number | null, min: number, max: number, fallback = 1) => {
            if (value == null) return fallback;
            if (max <= min) return 0;
            return (value - min) / (max - min);
        };

        return rawRows.map((row) => {
            const deliveryNorm = normalize(row.estimatedDeliveryCharge, minDelivery, maxDelivery);
            const distanceNorm = normalize(row.distanceKm, minDistance, maxDistance);
            const stockNorm = normalize(row.stockCoveragePercent, minStock, maxStock, 0);

            const bestValueScore =
                deliveryNorm * 0.45 +
                distanceNorm * 0.35 +
                (1 - stockNorm) * 0.2;

            return {
                ...row,
                bestValueScore,
            };
        });
    }, [itemTypeIds.length, topVendors]);

    const sortedComparisonRows = useMemo(() => {
        return [...comparisonRows].sort((left, right) => {
            if (comparisonSortMode === 'cheapest') {
                const chargeCompare = compareNullableNumberAscending(left.estimatedDeliveryCharge, right.estimatedDeliveryCharge);
                if (chargeCompare !== 0) return chargeCompare;
                return compareNullableNumberAscending(left.distanceKm, right.distanceKm);
            }

            if (comparisonSortMode === 'nearest') {
                const distanceCompare = compareNullableNumberAscending(left.distanceKm, right.distanceKm);
                if (distanceCompare !== 0) return distanceCompare;
                return compareNullableNumberAscending(left.estimatedDeliveryCharge, right.estimatedDeliveryCharge);
            }

            if (comparisonSortMode === 'stock') {
                if (left.matchedItemTypeCount !== right.matchedItemTypeCount) {
                    return right.matchedItemTypeCount - left.matchedItemTypeCount;
                }
                const chargeCompare = compareNullableNumberAscending(left.estimatedDeliveryCharge, right.estimatedDeliveryCharge);
                if (chargeCompare !== 0) return chargeCompare;
                return left.vendorName.localeCompare(right.vendorName);
            }

            if (left.bestValueScore !== right.bestValueScore) {
                return left.bestValueScore - right.bestValueScore;
            }

            return left.vendorName.localeCompare(right.vendorName);
        });
    }, [comparisonRows, comparisonSortMode]);

    const bestPriceRow = useMemo(() => {
        return sortedComparisonRows.find((row) => row.estimatedDeliveryCharge != null) || null;
    }, [sortedComparisonRows]);

    const bestStockRow = useMemo(() => {
        if (!sortedComparisonRows.length) return null;
        return [...sortedComparisonRows].sort((left, right) => {
            if (left.matchedItemTypeCount !== right.matchedItemTypeCount) {
                return right.matchedItemTypeCount - left.matchedItemTypeCount;
            }

            if (left.estimatedDeliveryCharge == null && right.estimatedDeliveryCharge != null) return 1;
            if (left.estimatedDeliveryCharge != null && right.estimatedDeliveryCharge == null) return -1;
            if (left.estimatedDeliveryCharge != null && right.estimatedDeliveryCharge != null) {
                return left.estimatedDeliveryCharge - right.estimatedDeliveryCharge;
            }

            return left.vendorName.localeCompare(right.vendorName);
        })[0];
    }, [sortedComparisonRows]);

    const bestValueRow = useMemo(() => {
        return sortedComparisonRows[0] || null;
    }, [sortedComparisonRows]);

    const nearestRow = useMemo(() => {
        return [...comparisonRows]
            .sort((left, right) => compareNullableNumberAscending(left.distanceKm, right.distanceKm))[0] || null;
    }, [comparisonRows]);

    const activeModeLabel = useMemo(() => {
        if (comparisonSortMode === 'cheapest') return t('customerResults.compareModeCheapest');
        if (comparisonSortMode === 'nearest') return t('customerResults.compareModeNearest');
        if (comparisonSortMode === 'stock') return t('customerResults.compareModeStock');
        return t('customerResults.compareModeBestValue');
    }, [comparisonSortMode, t]);

    const comparisonChartRows = useMemo(() => {
        return sortedComparisonRows
            .filter((row) => row.estimatedDeliveryCharge != null)
            .map((row) => ({
                ...row,
                estimatedDeliveryCharge: Number(row.estimatedDeliveryCharge),
            }));
    }, [sortedComparisonRows]);

    const comparisonScatterRows = useMemo(() => {
        return sortedComparisonRows.filter(
            (row) => row.estimatedDeliveryCharge != null && row.distanceKm != null,
        );
    }, [sortedComparisonRows]);

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
            <section className="bg-slate-100">
                <div className="lg:mx-auto lg:max-w-[1600px] lg:px-4 lg:pb-6 lg:pt-4">
                    <div className="flex flex-col lg:flex-row lg:gap-3">
                        {/* Desktop sidebar – hidden on mobile; use bottom sheet instead */}
                        <aside className="hidden lg:block lg:w-[360px] lg:shrink-0">
                            <div className="sticky top-20 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">{t('customerResults.panelLabel')}</p>
                                <h1 className="mt-1 text-2xl font-bold leading-tight text-slate-900">{t('customerResults.panelTitle')}</h1>

                                <div className="mt-3">
                                    <p className="text-sm text-slate-600">
                                        {addressLabel
                                            ? t('customerResults.panelAroundAddress', { address: addressLabel })
                                            : t('customerResults.panelGeneric')}
                                    </p>
                                    <p className="mt-2 text-xs font-medium text-amber-700">
                                        {t('customerResults.routeHint')}
                                    </p>

                                    {activeRouteVendorId && (
                                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                                            <p className="text-xs font-semibold text-amber-900">
                                                {loadingRoute
                                                    ? t('customerResults.routeDrawing')
                                                    : t('customerResults.routeToVendor', {
                                                        vendor: activeRouteVendorName,
                                                    })}
                                            </p>
                                            {!loadingRoute && (
                                                <p className="mt-0.5 text-xs text-amber-800">
                                                    {activeRouteOnRoads
                                                        ? t('customerResults.routeOnRoads')
                                                        : t('customerResults.routeFallback')}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-4 grid grid-cols-2 gap-2">
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('customerResults.panelRadius')}</p>
                                            <select
                                                value={String(radiusKm)}
                                                onChange={(event) => updateRadius(Number(event.target.value))}
                                                title={`${radiusKm} km`}
                                                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                                            >
                                                {radiusOptions.map((value) => (
                                                    <option key={value} value={String(value)}>
                                                        {value} km
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('customerResults.panelHelpers')}</p>
                                            <p className="mt-1 text-sm font-bold text-slate-800">{helpersNeeded}</p>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('customerResults.panelEquipment')}</p>
                                            <p className="mt-1 text-sm font-bold text-slate-800">{itemTypeIds.length || t('common.any')}</p>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('customerResults.panelPins')}</p>
                                            <p className="mt-1 text-sm font-bold text-slate-800">{vendorsWithPins.length}</p>
                                        </div>
                                        <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('common.dates')}</p>
                                            <p className="mt-1 text-sm font-bold text-slate-800">{dateRangeLabel}</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-2">
                                        <button
                                            type="button"
                                            onClick={() => setComparisonOpen(true)}
                                            disabled={comparisonRows.length === 0}
                                            className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {t('customerResults.compareVendorPrices')}
                                        </button>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={goToModifySearch}
                                                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                            >
                                                {t('customerResults.modifySearch')}
                                            </button>
                                            {topVendors[0] && (
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(getVendorShopUrl(topVendors[0].slug))}
                                                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                >
                                                    {t('customerResults.openNearestShop')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </aside>

                        <div className="relative h-[calc(100vh-56px)] min-h-[340px] supports-[height:100dvh]:h-[calc(100dvh-56px)] flex-1 overflow-hidden lg:h-[calc(100vh-170px)] lg:supports-[height:100dvh]:h-[calc(100dvh-170px)] lg:min-h-[560px] lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-sm">
                            {/* Mobile: floating stats + filter trigger bar */}
                            <div className="absolute inset-x-0 top-0 z-[900] p-2 lg:hidden">
                                <div className="flex items-center gap-2 rounded-2xl border border-white/30 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-semibold text-slate-800">
                                            {addressLabel || t('customerResults.panelTitle')}
                                        </p>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{radiusKm} km</span>
                                            {vendorsWithPins.length > 0 && (
                                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                                    {vendorsWithPins.length} pins
                                                </span>
                                            )}
                                            {startDate && (
                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                                    {formatDate(startDate)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setMobilePanelOpen(true)}
                                        className="shrink-0 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                                    >
                                        Filters
                                    </button>
                                </div>
                            </div>

                            <MapContainer center={searchCenter} zoom={12} zoomControl={false} className="h-full w-full">
                                <ResultsMapViewport
                                    center={searchCenter}
                                    radiusKm={radiusKm}
                                    vendors={vendorsWithPins}
                                    reserveRightPanelSpace={desktopMatchesOpen && topVendors.length > 0}
                                />
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

                                {activeRoutePoints.length > 1 && (
                                    <Polyline
                                        positions={activeRoutePoints}
                                        pathOptions={{
                                            color: activeRouteOnRoads ? '#ea580c' : '#2563eb',
                                            weight: 4,
                                            opacity: 0.85,
                                            dashArray: activeRouteOnRoads ? undefined : '7 9',
                                        }}
                                    />
                                )}

                                {activeRouteArrows.map((arrow) => (
                                    <Marker
                                        key={arrow.id}
                                        position={arrow.position}
                                        icon={createRouteArrowIcon(arrow.bearing)}
                                        interactive={false}
                                        keyboard={false}
                                    />
                                ))}

                                {vendorsWithPins.map((vendor) => (
                                    <Marker
                                        key={vendor.id}
                                        position={[Number(vendor.latitude), Number(vendor.longitude)]}
                                        icon={vendor.isTestAccount ? testVendorPinIcon : vendorPinIcon}
                                        eventHandlers={{
                                            click: () => {
                                                void traceRouteToVendor(vendor);
                                            },
                                        }}
                                    >
                                        <Popup className="vendor-result-popup" minWidth={170} maxWidth={240}>
                                            <div className="m-0 max-w-[220px] space-y-1 text-xs leading-tight text-slate-700">
                                                <p className="m-0 text-sm font-semibold text-slate-900">{vendor.businessName}</p>
                                                {vendor.verificationBadge && (
                                                    <p className="m-0 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                                        {vendor.verificationBadge}
                                                    </p>
                                                )}
                                                {vendor.isTestAccount && (
                                                    <p className="m-0 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                                        {t('customerResults.testAccountBadge')}
                                                    </p>
                                                )}
                                                <p className="m-0 truncate text-xs text-slate-600">{vendor.address}</p>
                                                {vendor.distanceKm != null && (
                                                    <p className="m-0 text-xs">{t('customerResults.popupDistance', { distance: vendor.distanceKm.toFixed(1) })}</p>
                                                )}
                                                {vendor.estimatedDeliveryCharge != null && (
                                                    <p className="m-0 text-xs font-medium text-blue-700">
                                                        {t('customerResults.popupEstimatedDelivery', { charge: formatCurrency(vendor.estimatedDeliveryCharge) })}
                                                    </p>
                                                )}
                                                {itemTypeIds.length > 0 && (
                                                    <p className="m-0 text-xs">
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
                                                    className="mt-1 inline-flex items-center rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                                                >
                                                    {t('customerResults.popupViewShop')}
                                                </button>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </MapContainer>

                            <div className="pointer-events-none absolute inset-x-0 top-0 z-[900] hidden h-24 bg-gradient-to-b from-slate-950/30 to-transparent lg:block" />

                            {!loading && !requestError && topVendors.length > 0 && (
                                <div className="pointer-events-none absolute right-0 top-1/2 z-[1000] hidden -translate-y-1/2 lg:block">
                                    <div className="relative flex items-center">
                                        <div
                                            className={`pointer-events-auto overflow-hidden rounded-l-2xl border border-r-0 border-slate-200/90 bg-white/95 shadow-2xl backdrop-blur transition-all duration-300 ${desktopMatchesOpen ? 'mr-0 max-w-[320px] opacity-100' : 'mr-[-1px] max-w-0 border-transparent opacity-0'}`}
                                        >
                                            <div className="w-[320px] p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('customerResults.closestMatches')}</p>
                                                        <p className="mt-1 text-xs text-slate-600">{topVendors.length} vendors</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDesktopMatchesOpen(false)}
                                                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                                        aria-label={t('common.close')}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                                <div className="mt-3 max-h-[55dvh] space-y-2 overflow-y-auto pr-1">
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
                                                                {vendor.isTestAccount && (
                                                                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                                                        {t('customerResults.testAccountBadge')}
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
                                                                onClick={() => navigate(getVendorShopUrl(vendor.slug))}
                                                            >
                                                                {t('customerResults.cardView')}
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setDesktopMatchesOpen((current) => !current)}
                                            className="pointer-events-auto flex h-40 w-12 items-center justify-center rounded-l-2xl border border-r-0 border-slate-200 bg-white/95 px-2 text-center shadow-xl backdrop-blur hover:bg-slate-50"
                                            aria-label={t('customerResults.closestMatches')}
                                        >
                                            <span
                                                className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700"
                                                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                                            >
                                                {t('customerResults.closestMatches')}
                                            </span>
                                        </button>
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
                        </div>
                    </div>
                </div>

                {/* Mobile: backdrop when sheet is open */}
                {mobilePanelOpen && (
                    <div
                        className="fixed inset-0 z-[1300] bg-slate-900/30 backdrop-blur-[2px] lg:hidden"
                        onClick={() => setMobilePanelOpen(false)}
                    />
                )}

                {/* Mobile: slide-up bottom sheet with filters + vendor list */}
                <div
                    className={`fixed inset-x-0 bottom-0 z-[1400] rounded-t-3xl border-t border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden ${mobilePanelOpen ? 'translate-y-0' : 'translate-y-[calc(100%-4.5rem)]'}`}
                >
                    {/* Drag handle + always-visible summary row */}
                    <button
                        type="button"
                        onClick={() => setMobilePanelOpen((current) => !current)}
                        className="w-full px-4 pb-3 pt-3 text-left"
                    >
                        <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-slate-300" />
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                                    {t('customerResults.panelLabel')}
                                </p>
                                <p className="text-sm font-bold text-slate-900">
                                    {loading
                                        ? t('customerResults.loadingNearby')
                                        : `${vendorsWithPins.length} pins · ${radiusKm} km`}
                                </p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                                {mobilePanelOpen ? '▼' : '▲'}
                            </span>
                        </div>
                    </button>

                    {/* Scrollable sheet body */}
                    <div className="max-h-[65dvh] overflow-y-auto px-4 pb-8">
                        <p className="text-sm text-slate-600">
                            {addressLabel
                                ? t('customerResults.panelAroundAddress', { address: addressLabel })
                                : t('customerResults.panelGeneric')}
                        </p>
                        <p className="mt-1.5 text-xs font-medium text-amber-700">{t('customerResults.routeHint')}</p>

                        {activeRouteVendorId && (
                            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                                <p className="text-xs font-semibold text-amber-900">
                                    {loadingRoute
                                        ? t('customerResults.routeDrawing')
                                        : t('customerResults.routeToVendor', { vendor: activeRouteVendorName })}
                                </p>
                                {!loadingRoute && (
                                    <p className="mt-0.5 text-xs text-amber-800">
                                        {activeRouteOnRoads
                                            ? t('customerResults.routeOnRoads')
                                            : t('customerResults.routeFallback')}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('customerResults.panelRadius')}</p>
                                <select
                                    value={String(radiusKm)}
                                    onChange={(event) => updateRadius(Number(event.target.value))}
                                    title={`${radiusKm} km`}
                                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                                >
                                    {radiusOptions.map((value) => (
                                        <option key={value} value={String(value)}>
                                            {value} km
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('customerResults.panelHelpers')}</p>
                                <p className="mt-1 text-sm font-bold text-slate-800">{helpersNeeded}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('customerResults.panelEquipment')}</p>
                                <p className="mt-1 text-sm font-bold text-slate-800">{itemTypeIds.length || t('common.any')}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('customerResults.panelPins')}</p>
                                <p className="mt-1 text-sm font-bold text-slate-800">{vendorsWithPins.length}</p>
                            </div>
                            <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('common.dates')}</p>
                                <p className="mt-1 text-sm font-bold text-slate-800">{dateRangeLabel}</p>
                            </div>
                        </div>

                        <div className="mt-4 space-y-2">
                            <button
                                type="button"
                                onClick={() => { setComparisonOpen(true); setMobilePanelOpen(false); }}
                                disabled={comparisonRows.length === 0}
                                className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                                {t('customerResults.compareVendorPrices')}
                            </button>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={goToModifySearch}
                                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    {t('customerResults.modifySearch')}
                                </button>
                                {topVendors[0] && (
                                    <button
                                        type="button"
                                        onClick={() => navigate(getVendorShopUrl(topVendors[0].slug))}
                                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        {t('customerResults.openNearestShop')}
                                    </button>
                                )}
                            </div>
                        </div>

                        {!loading && !requestError && topVendors.length > 0 && (
                            <div className="mt-5">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('customerResults.closestMatches')}</p>
                                <div className="mt-2 space-y-2">
                                    {topVendors.map((vendor) => (
                                        <div
                                            key={vendor.id}
                                            className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                                        >
                                            <div className="min-w-0 pr-2">
                                                <p className="truncate text-sm font-semibold text-slate-900">{vendor.businessName}</p>
                                                {vendor.verificationBadge && (
                                                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                                        {vendor.verificationBadge}
                                                    </p>
                                                )}
                                                {vendor.isTestAccount && (
                                                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                                        {t('customerResults.testAccountBadge')}
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
                                                className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                                onClick={() => navigate(getVendorShopUrl(vendor.slug))}
                                            >
                                                {t('customerResults.cardView')}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {comparisonOpen && (
                <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-slate-950/60 px-3 py-5 backdrop-blur-sm sm:px-6">
                    <div className="relative max-h-[92dvh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{t('customerResults.comparePanelLabel')}</p>
                                <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">{t('customerResults.compareVendorPrices')}</h2>
                                <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                                    {t('customerResults.comparePanelSubtitle', { count: comparisonRows.length })}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setComparisonOpen(false)}
                                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                            >
                                {t('common.close')}
                            </button>
                        </div>

                        <div className="max-h-[calc(92dvh-88px)] space-y-4 overflow-y-auto bg-white px-4 py-4 sm:px-6 sm:py-5">
                            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-800">{t('customerResults.compareHowToTitle')}</p>
                                <p className="mt-1 text-sm text-blue-900">{t('customerResults.compareHowToSteps')}</p>
                            </div>

                            <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <span className="mr-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                    {t('customerResults.compareSortBy')}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setComparisonSortMode('best_value')}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${comparisonSortMode === 'best_value' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                                >
                                    {t('customerResults.compareModeBestValue')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setComparisonSortMode('cheapest')}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${comparisonSortMode === 'cheapest' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                                >
                                    {t('customerResults.compareModeCheapest')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setComparisonSortMode('nearest')}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${comparisonSortMode === 'nearest' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                                >
                                    {t('customerResults.compareModeNearest')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setComparisonSortMode('stock')}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${comparisonSortMode === 'stock' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                                >
                                    {t('customerResults.compareModeStock')}
                                </button>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">{t('customerResults.compareBestPrice')}</p>
                                    <p className="mt-1 truncate text-sm font-bold text-slate-900">{bestPriceRow?.vendorName || t('common.na')}</p>
                                    <p className="mt-0.5 text-sm font-semibold text-emerald-700">
                                        {bestPriceRow?.estimatedDeliveryCharge != null
                                            ? formatCurrency(bestPriceRow.estimatedDeliveryCharge)
                                            : t('customerResults.compareNoDeliveryData')}
                                    </p>
                                </div>

                                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">{t('customerResults.compareTopStock')}</p>
                                    <p className="mt-1 truncate text-sm font-bold text-slate-900">{bestStockRow?.vendorName || t('common.na')}</p>
                                    <p className="mt-0.5 text-sm font-semibold text-blue-700">
                                        {t('customerResults.popupStockMatch', {
                                            matched: bestStockRow?.matchedItemTypeCount ?? 0,
                                            required: itemTypeIds.length,
                                        })}
                                    </p>
                                </div>

                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:col-span-2 lg:col-span-1">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">{t('customerResults.compareTipLabel')}</p>
                                    <p className="mt-1 text-sm text-slate-700">{t('customerResults.compareTip')}</p>
                                </div>

                                <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700">{t('customerResults.compareBestValue')}</p>
                                    <p className="mt-1 truncate text-sm font-bold text-slate-900">{bestValueRow?.vendorName || t('common.na')}</p>
                                    <p className="mt-0.5 text-sm font-semibold text-violet-700">
                                        {bestValueRow ? `${(bestValueRow.bestValueScore * 100).toFixed(0)} ${t('customerResults.compareScorePoints')}` : t('common.na')}
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {bestValueRow && (
                                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">{t('customerResults.compareRecommendedNow', { mode: activeModeLabel })}</p>
                                        <p className="mt-1 truncate text-base font-bold text-slate-900">{bestValueRow.vendorName}</p>
                                        <Button size="xs" className="mt-2" onClick={() => navigate(getVendorShopUrl(bestValueRow.vendorSlug))}>
                                            {t('customerResults.compareOpenRecommended')}
                                        </Button>
                                    </div>
                                )}

                                {bestPriceRow && (
                                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">{t('customerResults.compareModeCheapest')}</p>
                                        <p className="mt-1 truncate text-sm font-bold text-slate-900">{bestPriceRow.vendorName}</p>
                                        <Button size="xs" className="mt-2" color="light" onClick={() => navigate(getVendorShopUrl(bestPriceRow.vendorSlug))}>
                                            {t('customerResults.popupViewShop')}
                                        </Button>
                                    </div>
                                )}

                                {nearestRow && (
                                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">{t('customerResults.compareModeNearest')}</p>
                                        <p className="mt-1 truncate text-sm font-bold text-slate-900">{nearestRow.vendorName}</p>
                                        <Button size="xs" className="mt-2" color="light" onClick={() => navigate(getVendorShopUrl(nearestRow.vendorSlug))}>
                                            {t('customerResults.popupViewShop')}
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                                <p className="text-sm font-semibold text-slate-900">{t('customerResults.compareChartTitle')}</p>
                                {comparisonChartRows.length > 0 ? (
                                    <div className="mt-3 h-[280px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={comparisonChartRows} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="shortName" tick={{ fontSize: 11 }} />
                                                <YAxis
                                                    yAxisId="left"
                                                    tick={{ fontSize: 11 }}
                                                    tickFormatter={(value) => formatCurrency(Number(value))}
                                                />
                                                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(value) => `${Number(value)}%`} tick={{ fontSize: 11 }} />
                                                <Tooltip
                                                    formatter={(value: any, name: string) => {
                                                        if (name === t('customerResults.compareEstimatedDelivery')) {
                                                            return formatCurrency(Number(value));
                                                        }
                                                        if (name === t('customerResults.compareStockCoverage')) {
                                                            return `${Number(value).toFixed(0)}%`;
                                                        }
                                                        return value;
                                                    }}
                                                />
                                                <Legend />
                                                <Bar
                                                    yAxisId="left"
                                                    dataKey="estimatedDeliveryCharge"
                                                    name={t('customerResults.compareEstimatedDelivery')}
                                                    fill="#2563eb"
                                                    radius={[6, 6, 0, 0]}
                                                />
                                                <Bar
                                                    yAxisId="right"
                                                    dataKey="stockCoveragePercent"
                                                    name={t('customerResults.compareStockCoverage')}
                                                    fill="#14b8a6"
                                                    radius={[6, 6, 0, 0]}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <p className="mt-2 text-sm text-slate-600">{t('customerResults.compareNoDeliveryData')}</p>
                                )}
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                                <p className="text-sm font-semibold text-slate-900">{t('customerResults.compareScatterTitle')}</p>
                                {comparisonScatterRows.length > 0 ? (
                                    <div className="mt-3 h-[260px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis
                                                    dataKey="distanceKm"
                                                    name={t('customerResults.compareDistanceLabel')}
                                                    tick={{ fontSize: 11 }}
                                                    tickFormatter={(value) => `${Number(value).toFixed(1)} km`}
                                                />
                                                <YAxis
                                                    dataKey="estimatedDeliveryCharge"
                                                    name={t('customerResults.compareEstimatedDelivery')}
                                                    tick={{ fontSize: 11 }}
                                                    tickFormatter={(value) => formatCurrency(Number(value))}
                                                />
                                                <Tooltip
                                                    cursor={{ strokeDasharray: '3 3' }}
                                                    formatter={(value: any, name: string) => {
                                                        if (name === t('customerResults.compareEstimatedDelivery')) {
                                                            return formatCurrency(Number(value));
                                                        }
                                                        if (name === t('customerResults.compareDistanceLabel')) {
                                                            return `${Number(value).toFixed(1)} km`;
                                                        }
                                                        return value;
                                                    }}
                                                    labelFormatter={(_, payload) => {
                                                        const row = payload?.[0]?.payload as VendorComparisonRow | undefined;
                                                        return row?.vendorName || '';
                                                    }}
                                                />
                                                <Scatter
                                                    name={t('customerResults.comparePriceDistance')}
                                                    data={comparisonScatterRows}
                                                    fill="#0f766e"
                                                />
                                            </ScatterChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <p className="mt-2 text-sm text-slate-600">{t('customerResults.compareNoDistanceData')}</p>
                                )}
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{t('common.vendor')}</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{t('customerResults.compareEstimatedDelivery')}</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{t('customerResults.compareStockMatchLabel')}</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{t('customerResults.compareDistanceLabel')}</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{t('customerResults.compareBestValue')}</th>
                                            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">{t('common.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {sortedComparisonRows.map((row, index) => (
                                            <tr key={row.id} className={index === 0 ? 'bg-emerald-50/60' : ''}>
                                                <td className="px-3 py-2 text-sm font-semibold text-slate-900">{row.vendorName}</td>
                                                <td className="px-3 py-2 text-sm text-slate-700">
                                                    {row.estimatedDeliveryCharge != null
                                                        ? formatCurrency(row.estimatedDeliveryCharge)
                                                        : t('common.na')}
                                                </td>
                                                <td className="px-3 py-2 text-sm text-slate-700">
                                                    {t('customerResults.popupStockMatch', {
                                                        matched: row.matchedItemTypeCount,
                                                        required: itemTypeIds.length,
                                                    })}
                                                </td>
                                                <td className="px-3 py-2 text-sm text-slate-700">
                                                    {row.distanceKm != null
                                                        ? t('customerResults.cardDistanceAway', {
                                                            distance: row.distanceKm.toFixed(1),
                                                        })
                                                        : t('customerResults.cardDistanceUnavailable')}
                                                </td>
                                                <td className="px-3 py-2 text-sm text-slate-700">
                                                    {(row.bestValueScore * 100).toFixed(0)} {t('customerResults.compareScorePoints')}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <Button size="xs" onClick={() => navigate(getVendorShopUrl(row.vendorSlug))}>
                                                        {index === 0 ? t('customerResults.compareTopPickCta') : t('customerResults.popupViewShop')}
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </CustomerLayout>
    );
}
