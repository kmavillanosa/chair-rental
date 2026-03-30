import { useEffect, useMemo, useState } from 'react';
import { Button, TextInput } from 'flowbite-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import CustomerLayout from '../../components/layout/CustomerLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
    addFavoriteVendor,
    getMyFavoriteVendorIds,
    getNearbyVendors,
    getPublicVendorDirectory,
    removeFavoriteVendor,
} from '../../api/vendors';
import type { Vendor } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { getCurrentAppPath, savePostLoginRedirect } from '../../utils/postLoginRedirect';

const DIRECTORY_RADIUS_KM = 20000;

function formatDistance(distanceKm?: number) {
    if (!Number.isFinite(distanceKm)) return 'Distance unavailable';
    const value = Number(distanceKm);
    return `${value < 10 ? value.toFixed(1) : value.toFixed(0)} km away`;
}

export default function RentalPartners() {
    const navigate = useNavigate();
    const { token, user } = useAuthStore();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [partners, setPartners] = useState<Vendor[]>([]);
    const [favoriteVendorIds, setFavoriteVendorIds] = useState<string[]>([]);
    const [favoritesLoading, setFavoritesLoading] = useState(false);
    const [activeFavoriteVendorId, setActiveFavoriteVendorId] = useState<string | null>(null);
    const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
    const [hasRealDistanceOrigin, setHasRealDistanceOrigin] = useState(false);

    const canManageFavorites = Boolean(token) && user?.role === 'customer';

    useEffect(() => {
        let cancelled = false;

        setLoading(true);
        setError(null);

        const applyDirectory = (vendors: Vendor[], withDistanceOrigin: boolean) => {
            if (cancelled) return;

            const normalized = [...vendors].sort((a, b) =>
                a.businessName.localeCompare(b.businessName),
            );
            setHasRealDistanceOrigin(withDistanceOrigin);
            setPartners(normalized);
            setLoading(false);
        };

        const loadPublicDirectory = async () => {
            const vendors = await getPublicVendorDirectory();
            applyDirectory(vendors, false);
        };

        const loadNearbyFromCurrentLocation = async (latitude: number, longitude: number) => {
            const vendors = await getNearbyVendors(latitude, longitude, {
                radius: DIRECTORY_RADIUS_KM,
                helpersNeeded: 0,
            });
            applyDirectory(vendors, true);
        };

        const handleLoadFailure = (requestError: any) => {
            if (cancelled) return;

            const message =
                requestError?.response?.data?.message ||
                'Unable to load rental partners right now.';
            setError(message);
            setPartners([]);
            setHasRealDistanceOrigin(false);
            setLoading(false);
        };

        if (!navigator.geolocation) {
            loadPublicDirectory().catch(handleLoadFailure);
            return () => {
                cancelled = true;
            };
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                void loadNearbyFromCurrentLocation(
                    position.coords.latitude,
                    position.coords.longitude,
                ).catch(async () => {
                    try {
                        await loadPublicDirectory();
                    } catch (requestError: any) {
                        handleLoadFailure(requestError);
                    }
                });
            },
            () => {
                void loadPublicDirectory().catch(handleLoadFailure);
            },
            {
                enableHighAccuracy: true,
                timeout: 8000,
                maximumAge: 300000,
            },
        );

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!canManageFavorites) {
            setFavoriteVendorIds([]);
            setShowOnlyFavorites(false);
            return;
        }

        setFavoritesLoading(true);
        getMyFavoriteVendorIds()
            .then((vendorIds) => setFavoriteVendorIds(vendorIds))
            .catch(() => {
                setFavoriteVendorIds([]);
                toast.error('Unable to load your Suki partners right now.');
            })
            .finally(() => setFavoritesLoading(false));
    }, [canManageFavorites]);

    const filteredPartners = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        const filtered = partners.filter((partner) => {
            const haystack = [
                partner.businessName,
                partner.slug,
                partner.address || '',
                partner.description || '',
            ]
                .join(' ')
                .toLowerCase();

            return haystack.includes(normalizedQuery);
        });

        const favoritesFirst = [...filtered].sort((left, right) => {
            const leftFavorite = favoriteVendorIds.includes(left.id) ? 1 : 0;
            const rightFavorite = favoriteVendorIds.includes(right.id) ? 1 : 0;
            if (leftFavorite !== rightFavorite) return rightFavorite - leftFavorite;
            return left.businessName.localeCompare(right.businessName);
        });

        if (!showOnlyFavorites) return favoritesFirst;
        return favoritesFirst.filter((partner) => favoriteVendorIds.includes(partner.id));
    }, [favoriteVendorIds, partners, query, showOnlyFavorites]);

    const favoriteCount = favoriteVendorIds.length;

    const openShop = (slug: string) => {
        navigate(`/shop/${slug}`);
    };

    const toggleFavorite = async (vendorId: string) => {
        if (!token) {
            savePostLoginRedirect(getCurrentAppPath());
            navigate('/login');
            return;
        }

        if (user?.role !== 'customer') {
            toast.error('Only customer accounts can save Suki partners.');
            return;
        }

        const isFavorite = favoriteVendorIds.includes(vendorId);
        setActiveFavoriteVendorId(vendorId);

        try {
            if (isFavorite) {
                await removeFavoriteVendor(vendorId);
                setFavoriteVendorIds((current) => current.filter((id) => id !== vendorId));
                toast.success('Removed from your Suki partners.');
            } else {
                await addFavoriteVendor(vendorId);
                setFavoriteVendorIds((current) => [...current, vendorId]);
                toast.success('Saved as one of your Suki partners.');
            }
        } catch {
            toast.error('Unable to update your Suki partners right now.');
        } finally {
            setActiveFavoriteVendorId(null);
        }
    };

    const startBooking = (slug: string) => {
        const bookingPath = `/book/${slug}`;

        if (!token) {
            savePostLoginRedirect(bookingPath);
            navigate('/login');
            return;
        }

        navigate(bookingPath);
    };

    return (
        <CustomerLayout>
            <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
                <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-6 shadow-sm sm:p-8">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
                        Rental Partner Directory
                    </p>
                    <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">
                        Browse all rental partners
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                        Search your trusted suki partners, compare profiles, and open their shop page even without signing in.
                        You will only be asked to sign in when you proceed to booking.
                    </p>
                    {!hasRealDistanceOrigin ? (
                        <p className="mt-3 text-sm font-medium text-sky-700">
                            Enable location to see distance from you.
                        </p>
                    ) : null}

                    <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="max-w-xl flex-1">
                            <TextInput
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search by name, slug, or location"
                                sizing="lg"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowOnlyFavorites((current) => !current)}
                                disabled={!canManageFavorites || favoritesLoading}
                                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${showOnlyFavorites
                                    ? 'bg-slate-900 text-white'
                                    : 'border border-slate-300 bg-white text-slate-700'} ${!canManageFavorites ? 'cursor-not-allowed opacity-60' : 'hover:border-slate-400 hover:text-slate-900'}`}
                            >
                                {showOnlyFavorites ? 'Showing Suki only' : `Suki only${favoriteCount ? ` (${favoriteCount})` : ''}`}
                            </button>
                            {!canManageFavorites ? (
                                <span className="text-xs text-slate-500">
                                    Sign in as customer to save Suki partners.
                                </span>
                            ) : favoritesLoading ? (
                                <span className="text-xs text-slate-500">Loading your Suki partners...</span>
                            ) : favoriteCount > 0 ? (
                                <span className="text-xs text-slate-500">{favoriteCount} saved</span>
                            ) : (
                                <span className="text-xs text-slate-500">Save the partners you trust most.</span>
                            )}
                        </div>
                    </div>
                </section>

                {loading ? (
                    <div className="py-20 text-center">
                        <LoadingSpinner size="lg" />
                    </div>
                ) : error ? (
                    <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
                        {error}
                    </div>
                ) : filteredPartners.length === 0 ? (
                    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
                        No rental partners matched your search.
                    </div>
                ) : (
                    <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredPartners.map((partner) => (
                            <article
                                key={partner.id}
                                className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">{partner.businessName}</h2>
                                        {favoriteVendorIds.includes(partner.id) ? (
                                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                                                Suki Partner
                                            </p>
                                        ) : null}
                                    </div>
                                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                        Verified
                                    </span>
                                </div>

                                <p className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                                    @{partner.slug}
                                </p>

                                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                                    {partner.description?.trim() || partner.address || 'Trusted rental partner on RentalBasic.'}
                                </p>

                                <div className="mt-4 space-y-1 text-sm text-slate-600">
                                    {hasRealDistanceOrigin && Number.isFinite(partner.distanceKm) ? (
                                        <p>{formatDistance(partner.distanceKm)}</p>
                                    ) : null}
                                    {partner.address ? <p className="line-clamp-1">{partner.address}</p> : null}
                                </div>

                                <div className="mt-auto pt-5">
                                    <button
                                        type="button"
                                        onClick={() => void toggleFavorite(partner.id)}
                                        disabled={activeFavoriteVendorId === partner.id}
                                        className={`mb-2 w-full rounded-xl border px-3 py-2 text-sm font-semibold transition ${favoriteVendorIds.includes(partner.id)
                                            ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900'} ${activeFavoriteVendorId === partner.id ? 'cursor-wait opacity-70' : ''}`}
                                    >
                                        {activeFavoriteVendorId === partner.id
                                            ? 'Saving...'
                                            : favoriteVendorIds.includes(partner.id)
                                                ? 'Remove from Suki'
                                                : 'Save as Suki'}
                                    </button>

                                    <div className="flex gap-2">
                                        <Button color="light" className="w-full" onClick={() => openShop(partner.slug)}>
                                            View Shop
                                        </Button>
                                        <Button className="w-full" onClick={() => startBooking(partner.slug)}>
                                            Book
                                        </Button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </section>
                )}
            </div>
        </CustomerLayout>
    );
}
