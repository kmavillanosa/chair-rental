import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Button, TextInput } from 'flowbite-react';
import toast from 'react-hot-toast';
import L from 'leaflet';
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
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
import { savePostLoginRedirect } from '../../utils/postLoginRedirect';

type Coordinates = {
  lat: number;
  lng: number;
};

type RouteArrowPoint = {
  id: string;
  position: [number, number];
  bearing: number;
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

const vendorPinIcon = L.divIcon({
  className: '',
  html: '<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:#0f172a;color:#ffffff;border:2px solid #ffffff;font-weight:700;font-size:12px;box-shadow:0 4px 10px rgba(15,23,42,0.35);">V</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function formatCoordinates(point: Coordinates) {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}

function areCoordinatesEqual(left: Coordinates, right: Coordinates) {
  return left.lat === right.lat && left.lng === right.lng;
}

function parseCoordinateAddress(value: string): Coordinates | null {
  const match = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}

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
  const cssRotation = (bearing - 90 + 360) % 360;

  return L.divIcon({
    className: 'route-direction-arrow',
    html: `<span style="display:inline-block;transform:rotate(${cssRotation.toFixed(2)}deg);font-size:14px;color:#ea580c;text-shadow:0 0 2px #ffffff,0 0 4px #ffffff;">➤</span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

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
  const location = useLocation();
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
  const lastAutoResolvedKeyRef = useRef<string | null>(null);
  const routeRequestRef = useRef<AbortController | null>(null);
  const routeCacheRef = useRef(
    new Map<string, { points: [number, number][]; onRoads: boolean }>(),
  );
  const [platformCommissionRatePercent, setPlatformCommissionRatePercent] =
    useState(10);
  const [launchNoCommissionEnabled, setLaunchNoCommissionEnabled] =
    useState(false);
  const [launchNoCommissionUntil, setLaunchNoCommissionUntil] = useState<string | null>(null);
  const [deliveryRoutePoints, setDeliveryRoutePoints] = useState<[number, number][]>([]);
  const [deliveryRouteOnRoads, setDeliveryRouteOnRoads] = useState(false);

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

  const vendorCoordinates = useMemo(() => {
    const lat = Number(vendor?.latitude);
    const lng = Number(vendor?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng } as Coordinates;
  }, [vendor?.latitude, vendor?.longitude]);

  const setDeliveryCoordinatesWithMode = useCallback(
    (nextCoordinates: Coordinates, mode: 'auto' | 'manual') => {
      const normalized = {
        lat: Number(nextCoordinates.lat.toFixed(6)),
        lng: Number(nextCoordinates.lng.toFixed(6)),
      };

      setDeliveryCoordinates((current) => {
        if (current && areCoordinatesEqual(current, normalized)) {
          return current;
        }

        return normalized;
      });
      setDeliveryMapCenter((current) => {
        if (current[0] === normalized.lat && current[1] === normalized.lng) {
          return current;
        }

        return [normalized.lat, normalized.lng];
      });
      setDeliveryCoordinatesMode((current) => {
        if (current === mode) {
          return current;
        }

        return mode;
      });
    },
    [],
  );

  useEffect(() => {
    if (!vendorCoordinates || deliveryCoordinates) return;
    setDeliveryMapCenter([vendorCoordinates.lat, vendorCoordinates.lng]);
  }, [deliveryCoordinates, vendorCoordinates]);

  useEffect(() => {
    if (!token) {
      savePostLoginRedirect(`${location.pathname}${location.search}${location.hash}`);
      navigate('/login', { replace: true });
      return;
    }
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
    location.hash,
    location.pathname,
    location.search,
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
    if (!vendorCoordinates) {
      lastAutoResolvedKeyRef.current = null;
      setDeliveryCharge(0);
      setDeliveryDistanceKm(null);
      return;
    }

    if (!deliveryRates.length) {
      lastAutoResolvedKeyRef.current = null;
      setDeliveryCharge(0);
      setDeliveryDistanceKm(null);
      return;
    }

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
      lastAutoResolvedKeyRef.current = null;
      applyEstimate(deliveryCoordinates, {
        persistCoordinates: false,
        mode: 'manual',
      });
      return;
    }

    const normalizedAddress = deliveryAddress.trim();
    const fallbackResolutionKey = fallbackSearchCoordinates
      ? `fallback:${fallbackSearchCoordinates.lat.toFixed(6)},${fallbackSearchCoordinates.lng.toFixed(6)}`
      : null;
    if (!normalizedAddress) {
      if (fallbackSearchCoordinates) {
        if (
          deliveryCoordinatesMode === 'auto' &&
          deliveryCoordinates &&
          lastAutoResolvedKeyRef.current === fallbackResolutionKey
        ) {
          applyEstimate(deliveryCoordinates, {
            persistCoordinates: false,
            mode: 'auto',
          });
        } else {
          lastAutoResolvedKeyRef.current = fallbackResolutionKey;
          applyEstimate(fallbackSearchCoordinates, { mode: 'auto' });
        }
      } else {
        lastAutoResolvedKeyRef.current = null;
        setDeliveryCharge(0);
        setDeliveryDistanceKm(null);
        setDeliveryCoordinates(null);
        setDeliveryMapCenter(DEFAULT_DELIVERY_MAP_CENTER);
      }
      return;
    }

    const coordinateAddress = parseCoordinateAddress(normalizedAddress);
    const resolutionKey = coordinateAddress
      ? `coords:${coordinateAddress.lat.toFixed(6)},${coordinateAddress.lng.toFixed(6)}`
      : `address:${normalizedAddress.toLowerCase()}`;

    if (
      deliveryCoordinatesMode === 'auto' &&
      deliveryCoordinates &&
      lastAutoResolvedKeyRef.current === resolutionKey
    ) {
      applyEstimate(deliveryCoordinates, {
        persistCoordinates: false,
        mode: 'auto',
      });
      return;
    }

    if (coordinateAddress) {
      lastAutoResolvedKeyRef.current = resolutionKey;
      applyEstimate(coordinateAddress, { mode: 'auto' });
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

        lastAutoResolvedKeyRef.current = resolutionKey;
        applyEstimate({ lat, lng }, { mode: 'auto' });
      } catch (error: any) {
        if (error?.name === 'AbortError') return;

        if (fallbackSearchCoordinates) {
          lastAutoResolvedKeyRef.current = fallbackResolutionKey;
          applyEstimate(fallbackSearchCoordinates, { mode: 'auto' });
        } else {
          lastAutoResolvedKeyRef.current = null;
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
    vendorCoordinates,
  ]);

  useEffect(() => {
    if (!vendorCoordinates || !deliveryCoordinates) {
      routeRequestRef.current?.abort();
      setDeliveryRoutePoints([]);
      setDeliveryRouteOnRoads(false);
      return;
    }

    const cacheKey = [
      vendorCoordinates.lat.toFixed(6),
      vendorCoordinates.lng.toFixed(6),
      deliveryCoordinates.lat.toFixed(6),
      deliveryCoordinates.lng.toFixed(6),
    ].join(':');

    const cachedRoute = routeCacheRef.current.get(cacheKey);
    if (cachedRoute) {
      setDeliveryRoutePoints(cachedRoute.points);
      setDeliveryRouteOnRoads(cachedRoute.onRoads);
      return;
    }

    routeRequestRef.current?.abort();

    const controller = new AbortController();
    routeRequestRef.current = controller;

    const fallbackPath: [number, number][] = [
      [vendorCoordinates.lat, vendorCoordinates.lng],
      [deliveryCoordinates.lat, deliveryCoordinates.lng],
    ];

    setDeliveryRoutePoints(fallbackPath);
    setDeliveryRouteOnRoads(false);

    void (async () => {
      try {
        const routeUrl = new URL(
          `https://router.project-osrm.org/route/v1/driving/${vendorCoordinates.lng},${vendorCoordinates.lat};${deliveryCoordinates.lng},${deliveryCoordinates.lat}`,
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

        setDeliveryRoutePoints(resolvedPath);
        setDeliveryRouteOnRoads(onRoads);
      } catch (error: any) {
        if (error?.name === 'AbortError') return;

        routeCacheRef.current.set(cacheKey, {
          points: fallbackPath,
          onRoads: false,
        });

        setDeliveryRoutePoints(fallbackPath);
        setDeliveryRouteOnRoads(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [deliveryCoordinates, vendorCoordinates]);

  const deliveryRouteArrows = useMemo(
    () => buildRouteArrowPoints(deliveryRoutePoints),
    [deliveryRoutePoints],
  );

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

              <div className="h-[240px] overflow-hidden rounded-xl border border-gray-200 sm:h-[300px]">
                <MapContainer center={deliveryMapCenter} zoom={15} className="h-full w-full">
                  <DeliveryMapCenterController center={deliveryMapCenter} />
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                  />
                  {deliveryRoutePoints.length > 1 && (
                    <Polyline
                      positions={deliveryRoutePoints}
                      pathOptions={{
                        color: deliveryRouteOnRoads ? '#ea580c' : '#2563eb',
                        weight: 4,
                        opacity: 0.85,
                        dashArray: deliveryRouteOnRoads ? undefined : '6 8',
                      }}
                    />
                  )}
                  {deliveryRouteArrows.map((arrow) => (
                    <Marker
                      key={arrow.id}
                      position={arrow.position}
                      icon={createRouteArrowIcon(arrow.bearing)}
                      interactive={false}
                      keyboard={false}
                    />
                  ))}
                  {vendorCoordinates && (
                    <Marker
                      position={[vendorCoordinates.lat, vendorCoordinates.lng]}
                      icon={vendorPinIcon}
                      interactive={false}
                    >
                      <Tooltip direction="top" offset={[0, -12]} permanent>
                        {t('bookingFlow.vendorLocationPin')}
                      </Tooltip>
                    </Marker>
                  )}
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
                    >
                      <Tooltip direction="top" offset={[0, -28]} permanent>
                        {t('bookingFlow.deliveryLocationPin')}
                      </Tooltip>
                    </Marker>
                  )}
                </MapContainer>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                <p className="mb-2 font-semibold text-gray-800">{t('bookingFlow.mapLegend')}</p>
                <div className="flex flex-wrap gap-4">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">V</span>
                    {t('bookingFlow.vendorLocationPin')}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">D</span>
                    {t('bookingFlow.deliveryLocationPin')}
                  </span>
                </div>
              </div>

              <p className="text-sm font-medium text-gray-700">
                {deliveryCoordinates
                  ? t('bookingFlow.deliveryCoordinatesSelected', {
                    coordinates: formatCoordinates(deliveryCoordinates),
                  })
                  : t('bookingFlow.deliveryCoordinatesRequiredHint')}
              </p>
              {vendorCoordinates && (
                <p className="text-sm font-medium text-gray-700">
                  {t('bookingFlow.vendorCoordinatesLine', {
                    coordinates: formatCoordinates(vendorCoordinates),
                  })}
                </p>
              )}
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
