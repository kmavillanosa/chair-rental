import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Button, Modal } from 'flowbite-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import L from 'leaflet';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { getItemTypes } from '../../api/items';
import type { ItemType } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import { getCurrentAppPath, savePostLoginRedirect } from '../../utils/postLoginRedirect';
import { resolveSafeDocsUrl } from '../../utils/envUrl';
import type { TFunction } from 'i18next';
import {
    HiDeviceMobile,
    HiLocationMarker,
    HiSearch,
    HiSparkles,
} from 'react-icons/hi';

// Fix Leaflet default icon when bundled by Vite.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_EVENT_POINT: [number, number] = [9.7392, 118.7353];
const DEFAULT_EVENT_TAGS = [
    'birthday',
    'debut',
    'wedding',
    'funeral',
    'baptism',
    'anniversary',
    'corporate',
    'reunion',
    'graduation',
    'fiesta',
    'seminar',
    'concert',
];

const HERO_SELECT_OPTION_STYLE = {
    color: '#1f2944',
    backgroundColor: '#ffffff',
};

const HERO_SENTENCE_TEXT_CLASS = 'text-[clamp(1rem,1.55vw,1.75rem)] leading-[1.35]';
const HERO_INLINE_TEXT_CLASS = '[font-size:inherit] [line-height:1.1]';
const HERO_SELECT_CLASS = 'mx-1 my-1 inline-block max-w-full border-0 border-b-2 border-slate-300 bg-transparent px-1 pb-1 font-serif font-medium text-[#0d4ea8] focus:border-[#1561bf] focus:outline-none';
const HERO_ITEM_BUTTON_CLASS = 'mx-1 my-1 inline-block max-w-full border-0 border-b-2 border-slate-300 bg-transparent px-1 pb-1 font-serif font-medium text-[#0d4ea8] hover:text-[#0b3f89]';
const HERO_LOCATION_INPUT_CLASS = 'mx-1 my-1 inline-block w-[min(90vw,520px)] max-w-full border-0 border-b-2 border-slate-300 bg-transparent px-1 pb-1 font-serif font-medium text-[#0d4ea8] placeholder:text-[#2382a8] focus:border-[#1561bf] focus:outline-none sm:w-[min(56vw,520px)]';
const RADIUS_OPTIONS_KM = [1, 3, 5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100];

interface LocationSuggestion {
    id: string;
    label: string;
    lat: number;
    lng: number;
}

interface NominatimSearchResult {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
}

interface NominatimReverseResult {
    display_name?: string;
}

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function fallbackEventLabel(tag: string) {
    return tag
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

function toEventLabel(tag: string, t: TFunction) {
    return t(`customerHome.eventTags.${tag}.label`, { defaultValue: fallbackEventLabel(tag) });
}

function toEventSentenceLabel(tag: string, t: TFunction) {
    return t(`customerHome.eventTags.${tag}.sentence`, {
        defaultValue: fallbackEventLabel(tag).toLowerCase(),
    });
}

function pointToCoordinatesLabel(point: [number, number]) {
    return `${point[0].toFixed(5)}, ${point[1].toFixed(5)}`;
}

function toDateInputValue(date: Date) {
    return date.toISOString().slice(0, 10);
}

function getDefaultDateRange() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    return {
        startDate: toDateInputValue(today),
        endDate: toDateInputValue(tomorrow),
    };
}

function formatDateRangeValue(value: string) {
    if (!value) return '--';

    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isFinite(parsed.getTime())) return value;

    return new Intl.DateTimeFormat(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(parsed);
}

function getRangeDayCount(start: string, end: string) {
    if (!start || !end) return 0;

    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);

    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
        return 0;
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const diffDays = Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
    return Math.max(diffDays, 0);
}

function parsePositiveNumber(value: string | null, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInteger(value: string | null, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
}

function parseDateParam(value: string | null): string {
    const normalized = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function EventPinSelector({
    position,
    onPositionChange,
}: {
    position: [number, number];
    onPositionChange: (next: [number, number]) => void;
}) {
    const { t } = useTranslation();

    useMapEvents({
        click(event) {
            onPositionChange([event.latlng.lat, event.latlng.lng]);
        },
    });

    return (
        <Marker position={position}>
            <Popup>
                <p className="font-semibold">{t('customerHome.modalEventLocation')}</p>
                <p className="text-sm text-gray-600">{t('customerHome.modalClickMapToMovePin')}</p>
            </Popup>
        </Marker>
    );
}

function MapCenterController({ center }: { center: [number, number] }) {
    const map = useMap();

    useEffect(() => {
        // Recenter without changing the user's current zoom level.
        map.setView(center, map.getZoom(), { animate: true });
    }, [center, map]);

    return null;
}

export default function CustomerHome() {
    const docsUrl = resolveSafeDocsUrl();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    // Capture the URL params that were present when the page first loaded.
    // Restoration reads from this snapshot so that syncing form state back
    // to the URL does not re-trigger the restoration on every change.
    const initialSearchParamsRef = useRef(searchParams);
    const { user } = useAuthStore();

    const [itemTypes, setItemTypes] = useState<ItemType[]>([]);

    const [selectedEventTag, setSelectedEventTag] = useState('');
    const [radiusKm, setRadiusKm] = useState(3);
    const [helpersNeeded, setHelpersNeeded] = useState(0);
    const [startDate, setStartDate] = useState(getDefaultDateRange().startDate);
    const [endDate, setEndDate] = useState(getDefaultDateRange().endDate);
    const [selectedItemTypeIds, setSelectedItemTypeIds] = useState<string[]>([]);
    const [itemTypeQuery, setItemTypeQuery] = useState('');
    const [showItemPicker, setShowItemPicker] = useState(false);
    const [showDateRangePicker, setShowDateRangePicker] = useState(false);
    const itemPickerRef = useRef<HTMLSpanElement | null>(null);
    const dateRangePickerRef = useRef<HTMLSpanElement | null>(null);
    const searchHeroRef = useRef<HTMLElement | null>(null);

    const [eventPoint, setEventPoint] = useState<[number, number]>(DEFAULT_EVENT_POINT);

    const [addressQuery, setAddressQuery] = useState('Puerto Princesa City, Palawan');
    const [selectedAddressLabel, setSelectedAddressLabel] = useState('Puerto Princesa City, Palawan');
    const [addressSuggestions, setAddressSuggestions] = useState<LocationSuggestion[]>([]);
    const [isAddressLoading, setIsAddressLoading] = useState(false);

    const [showLocationModal, setShowLocationModal] = useState(false);
    const [modalEventPoint, setModalEventPoint] = useState<[number, number]>(DEFAULT_EVENT_POINT);
    const [modalMapCenter, setModalMapCenter] = useState<[number, number]>(DEFAULT_EVENT_POINT);
    const [modalAddressQuery, setModalAddressQuery] = useState('');
    const [modalSelectedAddressLabel, setModalSelectedAddressLabel] = useState('');
    const [modalAddressSuggestions, setModalAddressSuggestions] = useState<LocationSuggestion[]>([]);
    const [isModalAddressLoading, setIsModalAddressLoading] = useState(false);
    const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showInstallButton, setShowInstallButton] = useState(false);
    const [isIosInstallHint, setIsIosInstallHint] = useState(false);

    const hasIncomingSearchState = useMemo(
        () => [
            'lat',
            'lng',
            'radius',
            'helpersNeeded',
            'address',
            'startDate',
            'endDate',
            'itemTypeIds',
            'eventTag',
        ].some((key) => initialSearchParamsRef.current.has(key)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [], // intentionally only checked on mount
    );
    // Becomes true once the initial URL state is restored into form fields
    // (or immediately when there is nothing to restore).
    const hasRestoredRef = useRef(!hasIncomingSearchState);

    useEffect(() => {
        getItemTypes()
            .then(setItemTypes)
            .catch(() => {
                toast.error(t('customerHome.toastUnableLoadItemTypes'));
            });
    }, [t]);

    useEffect(() => {
        const handleBeforeInstallPrompt = (event: Event) => {
            const installEvent = event as BeforeInstallPromptEvent;
            installEvent.preventDefault();
            setDeferredInstallPrompt(installEvent);
        };

        const handleAppInstalled = () => {
            setDeferredInstallPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    useEffect(() => {
        const updateInstallAvailability = () => {
            const isMobileViewport = window.matchMedia('(max-width: 768px)').matches;
            const isStandalone =
                window.matchMedia('(display-mode: standalone)').matches ||
                Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

            const userAgent = window.navigator.userAgent;
            const isIosDevice =
                /iPad|iPhone|iPod/i.test(userAgent) ||
                (userAgent.includes('Macintosh') && 'ontouchend' in document);
            const isIosSafari = isIosDevice && /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(userAgent);

            setIsIosInstallHint(isMobileViewport && isIosSafari && !isStandalone);
            setShowInstallButton(!isStandalone && (Boolean(deferredInstallPrompt) || isIosDevice));
        };

        updateInstallAvailability();
        window.addEventListener('resize', updateInstallAvailability);

        return () => {
            window.removeEventListener('resize', updateInstallAvailability);
        };
    }, [deferredInstallPrompt]);

    // Restore form state from initial URL params (runs at most once on mount).
    useEffect(() => {
        if (!hasIncomingSearchState) return;

        const params = initialSearchParamsRef.current;

        const latParam = Number(params.get('lat'));
        const lngParam = Number(params.get('lng'));

        if (Number.isFinite(latParam) && Number.isFinite(lngParam)) {
            setEventPoint([latParam, lngParam]);
        }

        const addressParam = String(params.get('address') || '').trim();
        if (addressParam) {
            setAddressQuery(addressParam);
            setSelectedAddressLabel(addressParam);
            setAddressSuggestions([]);
        }

        setRadiusKm((current) => parsePositiveNumber(params.get('radius'), current));
        setHelpersNeeded((current) => parseNonNegativeInteger(params.get('helpersNeeded'), current));

        const startDateParam = parseDateParam(params.get('startDate'));
        const endDateParam = parseDateParam(params.get('endDate'));

        if (startDateParam) {
            setStartDate(startDateParam);
            setEndDate(endDateParam || startDateParam);
        } else if (endDateParam) {
            setEndDate(endDateParam);
        }

        const eventTagParam = String(params.get('eventTag') || '').trim().toLowerCase();
        if (eventTagParam) {
            setSelectedEventTag(eventTagParam);
        }

        const itemTypeIdsParam = String(params.get('itemTypeIds') || '').trim();
        if (itemTypeIdsParam) {
            setSelectedItemTypeIds(
                itemTypeIdsParam
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean),
            );
        }

        hasRestoredRef.current = true;
    }, [hasIncomingSearchState]);

    // Mirror form state into the URL as the user fills in the hero search.
    // Uses replace: true so each keystroke/selection does not pollute history.
    useEffect(() => {
        if (!hasRestoredRef.current) return;

        const params = new URLSearchParams();
        params.set('lat', eventPoint[0].toFixed(6));
        params.set('lng', eventPoint[1].toFixed(6));
        params.set('radius', String(radiusKm));
        params.set('helpersNeeded', String(helpersNeeded));

        const addressLabel = selectedAddressLabel.trim() || addressQuery.trim();
        if (addressLabel) params.set('address', addressLabel);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (selectedItemTypeIds.length > 0) params.set('itemTypeIds', selectedItemTypeIds.join(','));
        if (selectedEventTag) params.set('eventTag', selectedEventTag);

        setSearchParams(params, { replace: true });
    }, [
        eventPoint,
        radiusKm,
        helpersNeeded,
        selectedAddressLabel,
        addressQuery,
        startDate,
        endDate,
        selectedItemTypeIds,
        selectedEventTag,
        setSearchParams,
    ]);

    useEffect(() => {
        if (!startDate) return;
        if (!endDate || endDate < startDate) {
            setEndDate(startDate);
        }
    }, [endDate, startDate]);

    useEffect(() => {
        if (hasIncomingSearchState) return;
        if (!navigator.geolocation) return;

        let cancelled = false;

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                if (cancelled) return;

                const nextPoint: [number, number] = [
                    position.coords.latitude,
                    position.coords.longitude,
                ];
                const coordsLabel = pointToCoordinatesLabel(nextPoint);

                setEventPoint(nextPoint);
                setAddressQuery(coordsLabel);
                setSelectedAddressLabel(coordsLabel);
                setAddressSuggestions([]);

                try {
                    const params = new URLSearchParams({
                        format: 'jsonv2',
                        lat: String(nextPoint[0]),
                        lon: String(nextPoint[1]),
                        zoom: '14',
                    });

                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
                    );

                    if (!response.ok || cancelled) return;

                    const payload = (await response.json()) as NominatimReverseResult;
                    const label = String(payload.display_name || '').trim();
                    if (!label || cancelled) return;

                    setAddressQuery(label);
                    setSelectedAddressLabel(label);
                } catch {
                    // Keep coordinate label if reverse geocoding is unavailable.
                }
            },
            () => {
                // Keep configured default when geolocation is denied/unavailable.
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000,
            },
        );

        return () => {
            cancelled = true;
        };
    }, [hasIncomingSearchState]);

    useEffect(() => {
        const normalizedQuery = addressQuery.trim();
        const normalizedSelected = selectedAddressLabel.trim();

        if (normalizedQuery.length < 3 || normalizedQuery === normalizedSelected) {
            setAddressSuggestions([]);
            setIsAddressLoading(false);
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setIsAddressLoading(true);
            try {
                const params = new URLSearchParams({
                    format: 'jsonv2',
                    q: normalizedQuery,
                    countrycodes: 'ph',
                    addressdetails: '1',
                    limit: '6',
                });

                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
                    { signal: controller.signal },
                );

                if (!response.ok) throw new Error('Failed to fetch geocoding results');

                const payload = (await response.json()) as NominatimSearchResult[];
                const mapped = payload
                    .map((entry) => {
                        const lat = Number(entry.lat);
                        const lng = Number(entry.lon);
                        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

                        return {
                            id: String(entry.place_id),
                            label: entry.display_name,
                            lat,
                            lng,
                        } as LocationSuggestion;
                    })
                    .filter((entry): entry is LocationSuggestion => Boolean(entry));

                setAddressSuggestions(mapped);
            } catch (error: any) {
                if (error?.name !== 'AbortError') {
                    setAddressSuggestions([]);
                }
            } finally {
                setIsAddressLoading(false);
            }
        }, 350);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [addressQuery, selectedAddressLabel]);

    useEffect(() => {
        if (!showLocationModal) {
            setModalAddressSuggestions([]);
            setIsModalAddressLoading(false);
            return;
        }

        const normalizedQuery = modalAddressQuery.trim();
        const normalizedSelected = modalSelectedAddressLabel.trim();

        if (normalizedQuery.length < 3 || normalizedQuery === normalizedSelected) {
            setModalAddressSuggestions([]);
            setIsModalAddressLoading(false);
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setIsModalAddressLoading(true);
            try {
                const params = new URLSearchParams({
                    format: 'jsonv2',
                    q: normalizedQuery,
                    countrycodes: 'ph',
                    addressdetails: '1',
                    limit: '6',
                });

                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
                    { signal: controller.signal },
                );

                if (!response.ok) throw new Error('Failed to fetch geocoding results');

                const payload = (await response.json()) as NominatimSearchResult[];
                const mapped = payload
                    .map((entry) => {
                        const lat = Number(entry.lat);
                        const lng = Number(entry.lon);
                        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

                        return {
                            id: String(entry.place_id),
                            label: entry.display_name,
                            lat,
                            lng,
                        } as LocationSuggestion;
                    })
                    .filter((entry): entry is LocationSuggestion => Boolean(entry));

                setModalAddressSuggestions(mapped);
            } catch (error: any) {
                if (error?.name !== 'AbortError') {
                    setModalAddressSuggestions([]);
                }
            } finally {
                setIsModalAddressLoading(false);
            }
        }, 350);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [modalAddressQuery, modalSelectedAddressLabel, showLocationModal]);

    const eventTagOptions = useMemo(() => {
        const uniqueTags = new Set<string>(DEFAULT_EVENT_TAGS);
        itemTypes.forEach((itemType) => {
            (itemType.eventTags || []).forEach((tag) => {
                const normalized = String(tag).trim().toLowerCase();
                if (normalized) uniqueTags.add(normalized);
            });
        });

        return Array.from(uniqueTags).sort((a, b) =>
            toEventLabel(a, t).localeCompare(toEventLabel(b, t)),
        );
    }, [itemTypes, t]);

    const itemTypesForEvent = useMemo(() => {
        if (!selectedEventTag) return itemTypes;

        return itemTypes.filter((itemType) => {
            const tags = (itemType.eventTags || [])
                .map((tag) => String(tag).trim().toLowerCase())
                .filter(Boolean);

            // Keep untagged legacy rows visible until every catalog row has event tags.
            if (!tags.length) return true;
            return tags.includes(selectedEventTag);
        });
    }, [itemTypes, selectedEventTag]);

    const itemTypeIdsForEvent = useMemo(
        () => new Set(itemTypesForEvent.map((itemType) => itemType.id)),
        [itemTypesForEvent],
    );

    useEffect(() => {
        if (!itemTypes.length) return;
        setSelectedItemTypeIds((current) =>
            current.filter((itemTypeId) => itemTypeIdsForEvent.has(itemTypeId)),
        );
    }, [itemTypeIdsForEvent, itemTypes.length]);

    useEffect(() => {
        if (!showItemPicker) return;

        const handleOutsideClick = (event: MouseEvent) => {
            if (!itemPickerRef.current) return;
            if (!itemPickerRef.current.contains(event.target as Node)) {
                setShowItemPicker(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setShowItemPicker(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showItemPicker]);

    useEffect(() => {
        if (!showDateRangePicker) return;

        const handleOutsideClick = (event: MouseEvent) => {
            if (!dateRangePickerRef.current) return;
            if (!dateRangePickerRef.current.contains(event.target as Node)) {
                setShowDateRangePicker(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setShowDateRangePicker(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showDateRangePicker]);

    const filteredItemTypes = useMemo(() => {
        const normalizedQuery = itemTypeQuery.trim().toLowerCase();
        const matches = itemTypesForEvent.filter((itemType) =>
            itemType.name.toLowerCase().includes(normalizedQuery),
        );

        return matches.sort((a, b) => {
            const aSelected = selectedItemTypeIds.includes(a.id);
            const bSelected = selectedItemTypeIds.includes(b.id);
            if (aSelected !== bSelected) return aSelected ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
    }, [itemTypeQuery, itemTypesForEvent, selectedItemTypeIds]);

    const selectedItems = useMemo(
        () => itemTypes.filter((itemType) => selectedItemTypeIds.includes(itemType.id)),
        [itemTypes, selectedItemTypeIds],
    );

    const selectedItemSummary = useMemo(
        () => selectedItems.map((itemType) => itemType.name).join(', '),
        [selectedItems],
    );

    const dateRangeLabel = useMemo(
        () => `${formatDateRangeValue(startDate)} - ${formatDateRangeValue(endDate)}`,
        [endDate, startDate],
    );

    const dateRangeDays = useMemo(
        () => getRangeDayCount(startDate, endDate),
        [endDate, startDate],
    );

    const buildResultsPath = useCallback(
        (point: [number, number], locationLabel: string) => {
            const fallbackDateRange = getDefaultDateRange();
            const safeStartDate = startDate || fallbackDateRange.startDate;
            const safeEndDate = endDate || safeStartDate;

            const params = new URLSearchParams({
                lat: point[0].toFixed(6),
                lng: point[1].toFixed(6),
                radius: String(radiusKm),
                helpersNeeded: String(helpersNeeded),
                address: locationLabel,
                startDate: safeStartDate,
                endDate: safeEndDate,
            });

            if (selectedItemTypeIds.length > 0) {
                params.set('itemTypeIds', selectedItemTypeIds.join(','));
            }

            if (selectedEventTag) {
                params.set('eventTag', selectedEventTag);
            }

            return `/results?${params.toString()}`;
        },
        [endDate, helpersNeeded, radiusKm, selectedEventTag, selectedItemTypeIds, startDate],
    );

    const searchFromPin = useCallback(() => {
        const locationLabel = selectedAddressLabel.trim() || addressQuery.trim() || pointToCoordinatesLabel(eventPoint);
        navigate(buildResultsPath(eventPoint, locationLabel));
    }, [addressQuery, buildResultsPath, eventPoint, navigate, selectedAddressLabel]);

    const findNearMe = useCallback(() => {
        if (!navigator.geolocation) {
            toast(t('customerHome.toastGeoUnavailableUseSelected'));
            const fallbackLabel = selectedAddressLabel.trim() || addressQuery.trim() || pointToCoordinatesLabel(eventPoint);
            navigate(buildResultsPath(eventPoint, fallbackLabel));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const nextPoint: [number, number] = [position.coords.latitude, position.coords.longitude];
                const locationLabel = pointToCoordinatesLabel(nextPoint);

                setEventPoint(nextPoint);
                setAddressQuery(locationLabel);
                setSelectedAddressLabel(locationLabel);
                setAddressSuggestions([]);
                navigate(buildResultsPath(nextPoint, locationLabel));
            },
            () => {
                toast(t('customerHome.toastUnableGetCurrentUseSelected'));
                const fallbackLabel = selectedAddressLabel.trim() || addressQuery.trim() || pointToCoordinatesLabel(eventPoint);
                navigate(buildResultsPath(eventPoint, fallbackLabel));
            },
            { enableHighAccuracy: true, timeout: 8000 },
        );
    }, [addressQuery, buildResultsPath, eventPoint, navigate, selectedAddressLabel, t]);

    const toggleItemTypeSelection = (itemTypeId: string) => {
        setSelectedItemTypeIds((previous) => {
            if (previous.includes(itemTypeId)) {
                return previous.filter((id) => id !== itemTypeId);
            }
            return [...previous, itemTypeId];
        });
    };

    const applyAddressSuggestion = (suggestion: LocationSuggestion) => {
        const nextPoint: [number, number] = [suggestion.lat, suggestion.lng];
        setAddressQuery(suggestion.label);
        setSelectedAddressLabel(suggestion.label);
        setAddressSuggestions([]);
        setEventPoint(nextPoint);
    };

    const openLocationModal = () => {
        setModalEventPoint(eventPoint);
        setModalMapCenter(eventPoint);
        setModalAddressQuery(addressQuery);
        setModalSelectedAddressLabel(selectedAddressLabel || addressQuery);
        setModalAddressSuggestions([]);
        setShowLocationModal(true);
    };

    const applyModalAddressSuggestion = (suggestion: LocationSuggestion) => {
        const nextPoint: [number, number] = [suggestion.lat, suggestion.lng];
        setModalAddressQuery(suggestion.label);
        setModalSelectedAddressLabel(suggestion.label);
        setModalAddressSuggestions([]);
        setModalEventPoint(nextPoint);
        setModalMapCenter(nextPoint);
    };

    const useCurrentLocationInModal = () => {
        if (!navigator.geolocation) {
            toast(t('customerHome.toastGeoUnavailableBrowser'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const nextPoint: [number, number] = [position.coords.latitude, position.coords.longitude];
                const coordsLabel = pointToCoordinatesLabel(nextPoint);

                setModalEventPoint(nextPoint);
                setModalMapCenter(nextPoint);
                setModalAddressQuery(coordsLabel);
                setModalSelectedAddressLabel(coordsLabel);
                setModalAddressSuggestions([]);
            },
            () => {
                toast(t('customerHome.toastUnableRetrieveCurrent'));
            },
            { enableHighAccuracy: true, timeout: 8000 },
        );
    };

    const confirmLocationFromModal = () => {
        const fallbackCoordinates = pointToCoordinatesLabel(modalEventPoint);
        const finalLabel = modalSelectedAddressLabel.trim() || fallbackCoordinates;

        setEventPoint(modalEventPoint);
        setAddressQuery(finalLabel);
        setSelectedAddressLabel(finalLabel);
        setAddressSuggestions([]);
        setShowLocationModal(false);
    };

    const scrollToSearchHero = useCallback(() => {
        if (!searchHeroRef.current) return;

        const topOffset = 86;
        const targetY = searchHeroRef.current.getBoundingClientRect().top + window.scrollY - topOffset;
        window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
    }, []);

    const handleAddToHomeScreen = useCallback(async () => {
        if (deferredInstallPrompt) {
            await deferredInstallPrompt.prompt();
            const choiceResult = await deferredInstallPrompt.userChoice;

            if (choiceResult.outcome === 'accepted') {
                toast.success(
                    t('customerHome.installAccepted', {
                        defaultValue: 'Great! RentalBasic has been added to your home screen.',
                    }),
                );
            }

            setDeferredInstallPrompt(null);
            return;
        }

        if (isIosInstallHint) {
            toast(
                t('customerHome.installIosHint', {
                    defaultValue: 'On iPhone: tap Share, then choose Add to Home Screen.',
                }),
                { duration: 5000, icon: <HiDeviceMobile className="h-4 w-4" /> },
            );
            return;
        }

        toast(
            t('customerHome.installNotAvailable', {
                defaultValue: 'Install is not available right now. Try your mobile browser menu and tap Add to Home Screen.',
            }),
        );
    }, [deferredInstallPrompt, isIosInstallHint, t]);

    const currentYear = new Date().getFullYear();

    return (
        <CustomerLayout hideHeaderBackground>
            <section className="relative min-h-[580px] overflow-hidden bg-slate-900 sm:min-h-[640px]">
                {/* Background image */}
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: "url('/banner-bg.jpg')" }}
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#04162e]/95 via-[#0d3c73]/80 to-[#1d6f8f]/60" />

                {/* Decorative blobs */}
                <div className="pointer-events-none absolute -top-16 right-0 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />
                <div className="pointer-events-none absolute bottom-0 left-1/4 h-56 w-56 rounded-full bg-cyan-300/10 blur-2xl" />

                <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-24 sm:pb-28 sm:pt-32">
                    <div className="mx-auto max-w-3xl text-center text-white">

                        {/* Trust badge */}
                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/50 bg-cyan-500/20 px-5 py-2 text-xs font-bold uppercase tracking-widest text-cyan-100 backdrop-blur-sm">
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                            {t('customerHome.heroBadge', { defaultValue: 'Free to Browse' })}
                        </div>

                        <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
                            {t('customerHome.heroTitle', { defaultValue: 'Find event rentals near you without the usual hassle.' })}
                        </h1>
                        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-sky-100 sm:text-xl">
                            {t('customerHome.heroSubtitle', {
                                defaultValue: 'Search local suppliers, compare available equipment, and book what you need from one place.',
                            })}
                        </p>

                        {/* CTAs */}
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                            <Button
                                size="lg"
                                onClick={scrollToSearchHero}
                                className="!rounded-xl !bg-white !px-8 !py-3 !text-base !font-bold !text-[#04162e] shadow-2xl shadow-white/20 transition hover:!bg-blue-50 hover:shadow-white/40 hover:-translate-y-1"
                            >
                                <span className="inline-flex items-center gap-2">
                                    <HiSearch className="h-5 w-5" aria-hidden="true" />
                                    {t('customerHome.heroFindRentals', { defaultValue: 'Find Rentals' })}
                                </span>
                            </Button>
                            <Button
                                size="lg"
                                color="light"
                                onClick={() => {
                                    savePostLoginRedirect(getCurrentAppPath());
                                    navigate('/login');
                                }}
                                className="!rounded-xl !border-white/40 !bg-white/15 !px-8 !py-3 !text-base !font-semibold !text-white backdrop-blur-md transition hover:!bg-white/25 hover:!border-white/60"
                            >
                                {t('customerHome.heroCreateAccount', { defaultValue: 'Create Account' })}
                            </Button>
                            {showInstallButton && (
                                <Button
                                    size="lg"
                                    color="light"
                                    onClick={handleAddToHomeScreen}
                                    className="md:hidden !rounded-xl !border-white/40 !bg-white/10 !px-6 !py-3 !text-base !font-semibold !text-white backdrop-blur-md transition hover:!bg-white/20 hover:!border-white/60"
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <HiDeviceMobile className="h-5 w-5" aria-hidden="true" />
                                        {t('customerHome.addToHomeScreen', { defaultValue: 'Add to home screen' })}
                                    </span>
                                </Button>
                            )}
                        </div>

                        {/* Trust signals row */}
                        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-sky-100">
                            <span className="flex items-center gap-2">
                                <svg className="h-4 w-4 text-emerald-300 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                <span className="font-medium">{t('customerHome.heroTrust1', { defaultValue: 'Verified local partners' })}</span>
                            </span>
                            <span className="flex items-center gap-2">
                                <svg className="h-4 w-4 text-emerald-300 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                <span className="font-medium">{t('customerHome.heroTrust2', { defaultValue: 'Compare instantly' })}</span>
                            </span>
                            <span className="flex items-center gap-2">
                                <svg className="h-4 w-4 text-emerald-300 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                <span className="font-medium">{t('customerHome.heroTrust3', { defaultValue: 'Book in minutes' })}</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Scroll indicator */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce">
                    <svg className="h-6 w-6 text-white/40" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </section>

            <section
                ref={searchHeroRef}
                className="relative overflow-visible bg-gradient-to-b from-white to-slate-50"
            >
                <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-12 sm:pb-16 sm:pt-16">
                    <div className="mx-auto max-w-3xl text-center text-slate-900">
                        <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
                            {t('customerHome.searchTitle')}
                        </h2>
                        <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-600">
                            {t('customerHome.searchSubtitle')}
                        </p>
                    </div>

                    <div className="mx-auto mt-10 max-w-6xl overflow-visible rounded-2xl border border-slate-200/80 bg-white px-6 py-9 shadow-xl sm:px-10 sm:py-10 backdrop-blur-sm hover:shadow-2xl transition-shadow">
                        <div className={`mx-auto max-w-5xl text-center font-semibold tracking-tight text-slate-800 ${HERO_SENTENCE_TEXT_CLASS}`}>
                            {t('customerHome.sentencePlanning')}
                            <select
                                value={selectedEventTag}
                                onChange={(event) => setSelectedEventTag(event.target.value)}
                                title={selectedEventTag ? toEventSentenceLabel(selectedEventTag, t) : t('customerHome.sentenceEventDefault')}
                                className={`${HERO_SELECT_CLASS} min-w-[8.5rem] ${HERO_INLINE_TEXT_CLASS}`}
                            >
                                <option style={HERO_SELECT_OPTION_STYLE} value="">{t('customerHome.sentenceEventDefault')}</option>
                                {eventTagOptions.map((tag) => (
                                    <option style={HERO_SELECT_OPTION_STYLE} key={tag} value={tag}>
                                        {toEventSentenceLabel(tag, t)}
                                    </option>
                                ))}
                            </select>
                            , {t('customerHome.sentenceNeed')}
                            <span ref={itemPickerRef} className="relative mx-2 inline-block align-middle">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowDateRangePicker(false);
                                        setShowItemPicker((current) => !current);
                                    }}
                                    title={selectedItemSummary || t('customerHome.sentenceEquipmentDefault')}
                                    className={`${HERO_ITEM_BUTTON_CLASS} whitespace-normal ${HERO_INLINE_TEXT_CLASS}`}
                                >
                                    {selectedItemSummary || t('customerHome.sentenceEquipmentDefault')}
                                </button>

                                {showItemPicker && (
                                    <div
                                        onClick={(event) => event.stopPropagation()}
                                        className="absolute left-1/2 top-full z-[1200] mt-3 w-[92vw] max-w-[560px] -translate-x-1/2 rounded-xl border border-white/40 bg-white/95 p-3 text-left shadow-2xl"
                                    >
                                        <div className="mb-2 flex items-center justify-between gap-3">
                                            <p className="text-sm font-semibold text-gray-700">{t('customerHome.itemPickerTitle')}</p>
                                            <div className="flex items-center gap-3">
                                                {selectedItemTypeIds.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedItemTypeIds([])}
                                                        className="text-xs font-medium text-blue-700 hover:underline"
                                                    >
                                                        {t('customerHome.itemPickerClearAll')}
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setShowItemPicker(false)}
                                                    className="text-xs font-medium text-blue-700 hover:underline"
                                                >
                                                    {t('customerHome.itemPickerClose')}
                                                </button>
                                            </div>
                                        </div>

                                        <input
                                            placeholder={t('customerHome.itemSearchPlaceholder')}
                                            value={itemTypeQuery}
                                            onChange={(event) => setItemTypeQuery(event.target.value)}
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                                        />

                                        <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-gray-300 bg-white p-2">
                                            {filteredItemTypes.length === 0 ? (
                                                <p className="px-2 py-3 text-sm text-gray-500">
                                                    {t('customerHome.itemNoMatch')}
                                                </p>
                                            ) : (
                                                filteredItemTypes.map((itemType) => {
                                                    const selected = selectedItemTypeIds.includes(itemType.id);

                                                    return (
                                                        <label
                                                            key={itemType.id}
                                                            className={`mb-1 flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm ${selected
                                                                ? 'border-blue-200 bg-blue-50'
                                                                : 'border-transparent hover:border-gray-200 hover:bg-gray-50'}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={selected}
                                                                onChange={() => toggleItemTypeSelection(itemType.id)}
                                                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                            {itemType.pictureUrl ? (
                                                                <img src={itemType.pictureUrl} alt={itemType.name} className="h-9 w-9 rounded-md object-cover" />
                                                            ) : (
                                                                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-[10px] font-semibold text-slate-500">
                                                                    IMG
                                                                </span>
                                                            )}
                                                            <span className="text-gray-800">{itemType.name}</span>
                                                        </label>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </span>
                            {t('customerHome.sentenceIn')}
                            <button
                                type="button"
                                onClick={openLocationModal}
                                className="mx-1 my-1 inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-slate-300 bg-gradient-to-br from-slate-50 to-slate-100 text-2xl transition hover:border-slate-400 hover:from-slate-100 hover:to-slate-200 hover:shadow-md focus:border-blue-600 focus:outline-none"
                                title={t('customerHome.locationPinTitle')}
                                aria-label={t('customerHome.locationPinTitle')}
                            >
                                <HiLocationMarker className="h-6 w-6 text-slate-700" aria-hidden="true" />
                            </button>
                            <span className="relative mx-2 inline-block align-middle">
                                <input
                                    placeholder={t('customerHome.locationPlaceholder')}
                                    value={addressQuery}
                                    title={addressQuery}
                                    onChange={(event) => {
                                        setAddressQuery(event.target.value);
                                        setSelectedAddressLabel('');
                                    }}
                                    autoComplete="off"
                                    className={`${HERO_LOCATION_INPUT_CLASS} ${HERO_INLINE_TEXT_CLASS}`}
                                />
                                {addressSuggestions.length > 0 && (
                                    <div className="absolute z-[1000] mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white text-left shadow-lg">
                                        {addressSuggestions.map((suggestion) => (
                                            <button
                                                key={suggestion.id}
                                                type="button"
                                                onClick={() => applyAddressSuggestion(suggestion)}
                                                className="w-full border-b border-gray-100 px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50"
                                            >
                                                {suggestion.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </span>
                            {t('customerHome.sentenceWith')}
                            <select
                                value={String(helpersNeeded)}
                                onChange={(event) => setHelpersNeeded(Math.max(0, Number(event.target.value) || 0))}
                                title={helpersNeeded === 0
                                    ? t('customerHome.helperNone')
                                    : helpersNeeded === 1
                                        ? t('customerHome.helperSingle')
                                        : t('customerHome.helperMany', { count: helpersNeeded })}
                                className={`${HERO_SELECT_CLASS} min-w-[8.2rem] ${HERO_INLINE_TEXT_CLASS}`}
                            >
                                <option style={HERO_SELECT_OPTION_STYLE} value="0">{t('customerHome.helperNone')}</option>
                                <option style={HERO_SELECT_OPTION_STYLE} value="1">{t('customerHome.helperSingle')}</option>
                                <option style={HERO_SELECT_OPTION_STYLE} value="2">{t('customerHome.helperMany', { count: 2 })}</option>
                                <option style={HERO_SELECT_OPTION_STYLE} value="3">{t('customerHome.helperMany', { count: 3 })}</option>
                                <option style={HERO_SELECT_OPTION_STYLE} value="4">{t('customerHome.helperMany', { count: 4 })}</option>
                                <option style={HERO_SELECT_OPTION_STYLE} value="5">{t('customerHome.helperMany', { count: 5 })}</option>
                                <option style={HERO_SELECT_OPTION_STYLE} value="6">{t('customerHome.helperMany', { count: 6 })}</option>
                            </select>
                            , {t('customerHome.sentenceFrom')}
                            <span ref={dateRangePickerRef} className="relative mx-2 inline-block align-middle">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowItemPicker(false);
                                        setShowDateRangePicker((current) => !current);
                                    }}
                                    title={dateRangeLabel}
                                    className={`${HERO_ITEM_BUTTON_CLASS} inline-flex items-center gap-2 whitespace-nowrap ${HERO_INLINE_TEXT_CLASS}`}
                                >
                                    <span>{dateRangeLabel}</span>
                                    <span className="text-sm text-slate-500">edit</span>
                                </button>

                                {showDateRangePicker && (
                                    <div className="absolute left-1/2 top-full z-[1200] mt-3 w-[92vw] max-w-[430px] -translate-x-1/2 rounded-xl border border-white/40 bg-white/95 p-4 text-left shadow-2xl">
                                        <p className="text-sm font-semibold text-slate-800">Date range</p>
                                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                Start
                                                <input
                                                    type="date"
                                                    value={startDate}
                                                    max={endDate || undefined}
                                                    onChange={(event) => setStartDate(event.target.value)}
                                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                                                />
                                            </label>
                                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                End
                                                <input
                                                    type="date"
                                                    value={endDate}
                                                    min={startDate || undefined}
                                                    onChange={(event) => setEndDate(event.target.value)}
                                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                                                />
                                            </label>
                                        </div>
                                        <p className="mt-3 text-xs text-slate-600">
                                            {dateRangeDays > 0
                                                ? `${dateRangeDays} day${dateRangeDays === 1 ? '' : 's'} selected`
                                                : 'Pick a valid date range.'}
                                        </p>
                                        <div className="mt-4 flex items-center justify-between gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const defaults = getDefaultDateRange();
                                                    setStartDate(defaults.startDate);
                                                    setEndDate(defaults.endDate);
                                                }}
                                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                            >
                                                Reset
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowDateRangePicker(false)}
                                                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </span>
                            , {t('customerHome.sentenceWithin')}
                            <select
                                value={String(radiusKm)}
                                onChange={(event) => setRadiusKm(Number(event.target.value))}
                                title={`${radiusKm} km`}
                                className={`${HERO_SELECT_CLASS} min-w-[6.8rem] ${HERO_INLINE_TEXT_CLASS}`}
                            >
                                {RADIUS_OPTIONS_KM.map((value) => (
                                    <option style={HERO_SELECT_OPTION_STYLE} key={value} value={String(value)}>
                                        {value} km
                                    </option>
                                ))}
                            </select>
                            .
                        </div>

                        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                            <Button
                                size="lg"
                                onClick={searchFromPin}
                                className="!rounded-xl !bg-gradient-to-r !from-blue-600 !to-blue-700 !px-10 !py-3 !text-base !font-bold !text-white shadow-lg hover:!from-blue-700 hover:!to-blue-800 hover:shadow-xl hover:-translate-y-1 transition"
                            >
                                <span className="inline-flex items-center gap-2">
                                    <HiSparkles className="h-5 w-5" aria-hidden="true" />
                                    {t('customerHome.letsGo')}
                                </span>
                            </Button>
                            <Button
                                size="lg"
                                color="light"
                                onClick={findNearMe}
                                className="!rounded-xl !border-2 !border-slate-300 !bg-white !px-10 !py-3 !text-base !font-semibold !text-slate-700 hover:!border-slate-400 hover:!bg-slate-50 transition"
                            >
                                <span className="inline-flex items-center gap-2">
                                    <HiLocationMarker className="h-5 w-5" aria-hidden="true" />
                                    {t('customerHome.useCurrentLocation')}
                                </span>
                            </Button>
                        </div>

                        {isAddressLoading && (
                            <p className="mt-3 text-center text-xs text-slate-500">{t('customerHome.searchingAddresses')}</p>
                        )}

                        <p className="mt-1 text-center text-xs text-slate-500">
                            {t('customerHome.pinTip')}
                        </p>
                    </div>
                </div>
            </section>

            <section className="bg-gradient-to-b from-white via-slate-50 to-[#f4f7fb] py-16 sm:py-20">
                <div className="mx-auto max-w-7xl px-4">
                    <div className="mx-auto max-w-3xl text-center">
                        <p className="text-[12px] font-bold uppercase tracking-[0.3em] text-blue-700">
                            {t('customerHome.benefitsLabel')}
                        </p>
                        <h3 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                            {t('customerHome.benefitsTitle')}
                        </h3>
                        <p className="mt-3 text-lg text-slate-600">
                            {t('customerHome.benefitsSubtitle')}
                        </p>
                    </div>

                    <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        <article className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-7 shadow-sm hover:shadow-lg hover:border-blue-200 transition">
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">{t('customerHome.card1Label')}</p>
                            <h4 className="mt-3 text-lg font-bold text-slate-900">{t('customerHome.card1Title')}</h4>
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                {t('customerHome.card1Body')}
                            </p>
                        </article>

                        <article className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-7 shadow-sm hover:shadow-lg hover:border-blue-200 transition">
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">{t('customerHome.card2Label')}</p>
                            <h4 className="mt-3 text-lg font-bold text-slate-900">{t('customerHome.card2Title')}</h4>
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                {t('customerHome.card2Body')}
                            </p>
                        </article>

                        <article className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-7 shadow-sm hover:shadow-lg hover:border-blue-200 transition">
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">{t('customerHome.card3Label')}</p>
                            <h4 className="mt-3 text-lg font-bold text-slate-900">{t('customerHome.card3Title')}</h4>
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                {t('customerHome.card3Body')}
                            </p>
                        </article>

                        <article className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-7 shadow-sm hover:shadow-lg hover:border-blue-200 transition">
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">{t('customerHome.card4Label')}</p>
                            <h4 className="mt-3 text-lg font-bold text-slate-900">{t('customerHome.card4Title')}</h4>
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                {t('customerHome.card4Body')}
                            </p>
                        </article>
                    </div>
                </div>
            </section>

            <section className="bg-gradient-to-b from-white to-slate-50 py-16 sm:py-20">
                <div className="mx-auto max-w-7xl px-4">
                    <div className="relative overflow-hidden rounded-3xl border border-slate-300/50 bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600 px-8 py-12 text-white shadow-2xl sm:px-12 sm:py-14">
                        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-12 left-1/4 h-48 w-48 rounded-full bg-cyan-300/15 blur-3xl" />

                        <div className="relative max-w-2xl">
                            <p className="text-[12px] font-bold uppercase tracking-[0.3em] text-cyan-100">
                                {t('customerHome.appComingLabel')}
                            </p>
                            <h3 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                                {t('customerHome.appComingTitle')}
                            </h3>
                            <p className="mt-4 text-base leading-7 text-blue-100">
                                {t('customerHome.appComingBody')}
                            </p>

                            <div className="mt-6 flex flex-wrap gap-3">
                                <span className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm">
                                    <HiDeviceMobile className="h-4 w-4" aria-hidden="true" />
                                    {t('customerHome.appComingAndroid')}
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm">
                                    <HiDeviceMobile className="h-4 w-4" aria-hidden="true" />
                                    {t('customerHome.appComingIos')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-white py-14 sm:py-16">
                <div className="mx-auto max-w-7xl px-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">Fast Discovery</p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                                Browse local inventories in minutes and quickly narrow to what fits your event.
                            </p>
                        </article>
                        <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">Transparent Choices</p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                                Compare options side by side so you can decide with confidence before booking.
                            </p>
                        </article>
                        <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">Verified Partners</p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                                Work with curated rental partners focused on reliable delivery and service.
                            </p>
                        </article>
                        <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">One Place Workflow</p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                                From discovery to booking details, manage your rental plan in one streamlined flow.
                            </p>
                        </article>
                    </div>
                </div>
            </section>

            <section className="bg-[#f5f8fc] py-16 sm:py-20">
                <div className="mx-auto max-w-7xl px-4">
                    <div className="mx-auto max-w-3xl text-center">
                        <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-blue-700">How It Works</p>
                        <h3 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                            Plan your rental in three quick steps
                        </h3>
                    </div>

                    <div className="mt-10 grid gap-4 md:grid-cols-3">
                        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">01 Search</p>
                            <h4 className="mt-2 text-lg font-bold text-slate-900">Set your location and event needs</h4>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Use the smart search controls to choose equipment type, dates, and distance.
                            </p>
                        </article>
                        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">02 Compare</p>
                            <h4 className="mt-2 text-lg font-bold text-slate-900">Review available rental options</h4>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Check listings and narrow down the best options based on your event requirements.
                            </p>
                        </article>
                        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">03 Book</p>
                            <h4 className="mt-2 text-lg font-bold text-slate-900">Secure your rentals faster</h4>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Move forward confidently once you have found the right setup for your event.
                            </p>
                        </article>
                    </div>

                    <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                        <Button
                            size="lg"
                            onClick={scrollToSearchHero}
                            className="!rounded-xl !bg-[#164f96] !px-8 !py-3 !text-base !font-bold !text-white hover:!bg-[#113d74]"
                        >
                            Start Searching Now
                        </Button>
                        <Button
                            size="lg"
                            color="light"
                            onClick={() => {
                                savePostLoginRedirect(getCurrentAppPath());
                                navigate('/login');
                            }}
                            className="!rounded-xl !border-slate-300 !px-8 !py-3 !text-base !font-semibold !text-slate-700 hover:!bg-slate-50"
                        >
                            Create Free Account
                        </Button>
                    </div>
                </div>
            </section>

            <Modal className="mobile-fullscreen-modal" show={showLocationModal}
                size="xl"
                onClose={() => setShowLocationModal(false)}
            >
                <Modal.Header>{t('customerHome.modalTitle')}</Modal.Header>
                <Modal.Body className="space-y-3 !p-3 sm:!p-5">
                    <p className="mb-3 text-sm text-gray-600">
                        {t('customerHome.modalSubtitle')}
                    </p>

                    <div className="relative">
                        <input
                            placeholder={t('customerHome.modalSearchPlaceholder')}
                            value={modalAddressQuery}
                            onChange={(event) => {
                                setModalAddressQuery(event.target.value);
                                setModalSelectedAddressLabel('');
                            }}
                            autoComplete="off"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                        />

                        {modalAddressSuggestions.length > 0 && (
                            <div className="absolute z-[1400] mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white text-left shadow-lg">
                                {modalAddressSuggestions.map((suggestion) => (
                                    <button
                                        key={suggestion.id}
                                        type="button"
                                        onClick={() => applyModalAddressSuggestion(suggestion)}
                                        className="w-full border-b border-gray-100 px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50"
                                    >
                                        {suggestion.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {isModalAddressLoading && (
                        <p className="mt-2 text-xs text-gray-500">{t('customerHome.searchingAddresses')}</p>
                    )}

                    <div className="mt-4 h-[240px] overflow-hidden rounded-xl border border-gray-200 sm:h-[320px]">
                        <MapContainer center={modalMapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                            <MapCenterController center={modalMapCenter} />
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution="&copy; OpenStreetMap contributors"
                            />

                            <EventPinSelector
                                position={modalEventPoint}
                                onPositionChange={(nextPoint) => {
                                    const coords = pointToCoordinatesLabel(nextPoint);
                                    setModalEventPoint(nextPoint);
                                    setModalAddressQuery(coords);
                                    setModalSelectedAddressLabel(coords);
                                    setModalAddressSuggestions([]);
                                }}
                            />
                        </MapContainer>
                    </div>

                    <p className="mt-3 text-xs text-gray-600">
                        {t('customerHome.selectedCoordinates', {
                            lat: modalEventPoint[0].toFixed(5),
                            lng: modalEventPoint[1].toFixed(5),
                        })}
                    </p>

                    <div className="mt-4 flex flex-wrap justify-stretch gap-2 sm:justify-end">
                        <Button size="sm" color="gray" onClick={useCurrentLocationInModal} className="w-full sm:w-auto">
                            {t('customerHome.modalUseCurrentLocation')}
                        </Button>
                        <Button size="sm" color="light" onClick={() => setShowLocationModal(false)} className="w-full sm:w-auto">
                            {t('common.cancel')}
                        </Button>
                        <Button size="sm" onClick={confirmLocationFromModal} className="w-full sm:w-auto">
                            {t('customerHome.modalUseThisLocation')}
                        </Button>
                    </div>
                </Modal.Body>
            </Modal>

            <footer className="border-t border-gray-200 bg-white">
                <div className="mx-auto max-w-7xl px-4 py-8 sm:flex sm:items-start sm:justify-between">
                    <div>
                        <p className="text-lg font-semibold text-gray-900">{t('common.appName')}</p>
                        <p className="mt-1 max-w-md text-sm text-gray-600">
                            {t('customerHome.footerDescription')}
                        </p>
                    </div>

                    <div className="mt-5 space-y-4 text-sm sm:mt-0 sm:max-w-[52rem] sm:text-right">
                        <div className="flex flex-wrap gap-4 sm:justify-end">
                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                className="font-medium text-blue-700 hover:text-blue-900"
                            >
                                {t('customerHome.footerFindRentals')}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/my-bookings')}
                                className="font-medium text-blue-700 hover:text-blue-900"
                            >
                                {t('customerHome.footerMyBookings')}
                            </button>
                            {user?.role === 'customer' && (
                                <button
                                    type="button"
                                    onClick={() => navigate('/become-vendor')}
                                    className="font-medium text-blue-700 hover:text-blue-900"
                                >
                                    {t('customerHome.footerBecomeVendor')}
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2 sm:justify-end" aria-label="Legal links">
                            <button
                                type="button"
                                onClick={() => navigate('/faq')}
                                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                                FAQ
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/legal/terms-of-service')}
                                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                                Terms of Service
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/legal/vendor-agreement')}
                                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                                Rental Partner Agreement
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/legal/platform-commission-policy')}
                                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                                Commission Policy
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/legal/liability-disclaimer')}
                                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                                Liability Disclaimer
                            </button>
                            {docsUrl ? (
                                <a
                                    href={docsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-sky-200 px-3 py-1 text-xs font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-50"
                                >
                                    Documentation
                                </a>
                            ) : null}
                        </div>
                    </div>
                </div>
                <div className="border-t border-gray-100 py-3 text-center text-xs text-gray-500">
                    {t('customerHome.footerRights', { year: currentYear })}
                </div>
            </footer>
        </CustomerLayout >
    );
}
