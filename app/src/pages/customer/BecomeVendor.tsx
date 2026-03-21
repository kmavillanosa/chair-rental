import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Label, TextInput } from 'flowbite-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import CustomerLayout from '../../components/layout/CustomerLayout';
import {
    requestVendorEmailOtp,
    submitVendorRegistration,
    verifyVendorEmailOtp,
    checkSlugAvailability,
} from '../../api/vendors';
import { getKycSettings, type KycSettings } from '../../api/settings';
import { useAuthStore } from '../../store/authStore';
import type {
    BusinessRegistrationType,
    Vendor,
    VendorType,
} from '../../types';
import { useTranslation } from 'react-i18next';
import { getCurrentAppPath, savePostLoginRedirect } from '../../utils/postLoginRedirect';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_VENDOR_LOCATION: [number, number] = [9.7392, 118.7353];

function normalizeSlugInput(value: string) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function formatCoordinates(point: [number, number]) {
    return `${point[0].toFixed(6)}, ${point[1].toFixed(6)}`;
}

function VendorLocationPin({
    position,
    onPositionChange,
}: {
    position: [number, number];
    onPositionChange: (nextPoint: [number, number]) => void;
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
                <p className="font-semibold">{t('becomeVendorPage.locationPopupTitle')}</p>
                <p className="text-sm text-gray-600">{t('becomeVendorPage.locationPopupHint')}</p>
            </Popup>
        </Marker>
    );
}

function VendorMapCenterController({ center }: { center: [number, number] }) {
    const map = useMap();

    useEffect(() => {
        map.setView(center, map.getZoom(), { animate: true });
    }, [center, map]);

    return null;
}

interface FormState {
    vendorType: VendorType;
    businessName: string;
    businessRegistrationType: BusinessRegistrationType;
    businessRegistrationNumber: string;
    birTin: string;
    ownerFullName: string;
    governmentIdNumber: string;
    address: string;
    latitude: string;
    longitude: string;
    phone: string;
    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
    socialMediaLink: string;
    description: string;
    subdomainSlug: string;
}

interface AttachmentState {
    governmentIdFile: File | null;
    selfieFile: File | null;
    mayorsPermitFile: File | null;
    barangayPermitFile: File | null;
    logoFile: File | null;
}

const INITIAL_FORM: FormState = {
    vendorType: 'registered_business',
    businessName: '',
    businessRegistrationType: 'dti',
    businessRegistrationNumber: '',
    birTin: '',
    ownerFullName: '',
    governmentIdNumber: '',
    address: '',
    latitude: `${DEFAULT_VENDOR_LOCATION[0]}`,
    longitude: `${DEFAULT_VENDOR_LOCATION[1]}`,
    phone: '',
    bankName: '',
    bankAccountName: '',
    bankAccountNumber: '',
    socialMediaLink: '',
    description: '',
    subdomainSlug: '',
};

const INITIAL_ATTACHMENTS: AttachmentState = {
    governmentIdFile: null,
    selfieFile: null,
    mayorsPermitFile: null,
    barangayPermitFile: null,
    logoFile: null,
};

const DEFAULT_KYC_SETTINGS: KycSettings = {
    vendorRegistrationEnabled: true,
    requireOtpBeforeVendorRegistration: true,
};

export default function BecomeVendor() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
    const [slugTouched, setSlugTouched] = useState(false);
    const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const VENDOR_DOMAIN = import.meta.env.VITE_VENDOR_DOMAIN || 'rentalbasic.com';

    const scheduleSlugCheck = useCallback((slug: string) => {
        if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
        const normalized = normalizeSlugInput(slug);
        if (!normalized) { setSlugStatus('idle'); return; }
        setSlugStatus('checking');
        slugCheckTimer.current = setTimeout(async () => {
            try {
                const result = await checkSlugAvailability(normalized);
                setSlugStatus(result.available ? 'available' : 'taken');
                setForm((prev) => ({ ...prev, subdomainSlug: result.slug }));
            } catch {
                setSlugStatus('idle');
            }
        }, 500);
    }, []);

    useEffect(() => {
        return () => {
            if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
        };
    }, []);

    const handleBusinessNameChange = (value: string) => {
        setForm((prev) => {
            if (slugTouched) {
                return { ...prev, businessName: value };
            }
            const autoSlug = normalizeSlugInput(value || prev.ownerFullName);
            scheduleSlugCheck(autoSlug);
            return { ...prev, businessName: value, subdomainSlug: autoSlug };
        });
    };

    const handleOwnerFullNameChange = (value: string) => {
        setForm((prev) => {
            if (slugTouched) {
                return { ...prev, ownerFullName: value };
            }
            const source = prev.businessName || value;
            const autoSlug = normalizeSlugInput(source);
            scheduleSlugCheck(autoSlug);
            return { ...prev, ownerFullName: value, subdomainSlug: autoSlug };
        });
    };
    const [attachments, setAttachments] = useState<AttachmentState>(INITIAL_ATTACHMENTS);
    const [selectedLocation, setSelectedLocation] = useState<[number, number]>(DEFAULT_VENDOR_LOCATION);
    const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_VENDOR_LOCATION);
    const [locating, setLocating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [otpBusy, setOtpBusy] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [otpRequested, setOtpRequested] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const [settingsLoading, setSettingsLoading] = useState(true);
    const [kycSettings, setKycSettings] = useState<KycSettings>(DEFAULT_KYC_SETTINGS);
    const [registration, setRegistration] = useState<Vendor | null>(null);

    const deviceFingerprint = useMemo(() => {
        if (typeof window === 'undefined') return '';

        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
        return [
            navigator.userAgent,
            navigator.language,
            navigator.platform,
            timezone,
        ].join('|');
    }, []);

    useEffect(() => {
        let active = true;

        getKycSettings()
            .then((response) => {
                if (!active) return;

                setKycSettings(response);
                if (!response.requireOtpBeforeVendorRegistration) {
                    setOtpRequested(true);
                    setOtpVerified(true);
                }
            })
            .catch(() => {
                if (!active) return;
                setKycSettings(DEFAULT_KYC_SETTINGS);
            })
            .finally(() => {
                if (active) {
                    setSettingsLoading(false);
                }
            });

        return () => {
            active = false;
        };
    }, []);

    const handleFileChange =
        (field: keyof AttachmentState) =>
            (event: ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0] || null;
                setAttachments((prev) => ({ ...prev, [field]: file }));
            };

    const updateLocation = (nextPoint: [number, number]) => {
        setSelectedLocation(nextPoint);
        setMapCenter(nextPoint);
        setForm((prev) => ({
            ...prev,
            latitude: nextPoint[0].toFixed(6),
            longitude: nextPoint[1].toFixed(6),
        }));
    };

    const handleUseCurrentLocation = () => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            toast.error(t('becomeVendorPage.toastGeoUnavailable'));
            return;
        }

        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                updateLocation([position.coords.latitude, position.coords.longitude]);
                toast.success(t('becomeVendorPage.toastCurrentLocationSelected'));
                setLocating(false);
            },
            () => {
                toast.error(t('becomeVendorPage.toastUnableRetrieveCurrent'));
                setLocating(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000,
            },
        );
    };

    const handleRequestOtp = async () => {
        if (!user?.email) {
            toast.error('No account email found. Please sign in again.');
            return;
        }

        setOtpBusy(true);
        try {
            const response: any = await requestVendorEmailOtp(
                user.email,
                deviceFingerprint || undefined,
            );
            setOtpRequested(true);
            setOtpVerified(false);

            const debugCode = response?.developmentOtpCode;
            if (debugCode) {
                toast.success(`Email OTP sent. Dev code: ${debugCode}`);
            } else {
                toast.success('Email OTP sent. Check your inbox.');
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to request email OTP.');
        } finally {
            setOtpBusy(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otpRequested) {
            toast.error('Request OTP first.');
            return;
        }
        if (!otpCode.trim()) {
            toast.error('Enter the OTP code.');
            return;
        }
        if (!user?.email) {
            toast.error('No account email found. Please sign in again.');
            return;
        }

        setOtpBusy(true);
        try {
            await verifyVendorEmailOtp(user.email, otpCode.trim());
            setOtpVerified(true);
            toast.success('Email verified.');
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'OTP verification failed.');
            setOtpVerified(false);
        } finally {
            setOtpBusy(false);
        }
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();

        if (!kycSettings.vendorRegistrationEnabled) {
            toast.error('Vendor registration is currently disabled by platform admin.');
            return;
        }

        if (user?.role !== 'customer') {
            toast.error(t('becomeVendorPage.onlyCustomerAllowed'));
            return;
        }

        if (kycSettings.requireOtpBeforeVendorRegistration && !otpVerified) {
            toast.error('Email OTP must be verified before submission.');
            return;
        }

        if (!form.ownerFullName.trim()) {
            toast.error('Owner full name is required.');
            return;
        }

        if (!form.governmentIdNumber.trim()) {
            toast.error('Government ID number is required.');
            return;
        }

        if (!form.address.trim()) {
            toast.error(t('becomeVendorPage.businessNameAddressRequired'));
            return;
        }

        if (!form.bankName.trim()) {
            toast.error('Payout method (bank or e-wallet) is required.');
            return;
        }

        if (!form.bankAccountName.trim()) {
            toast.error('Payout account name is required.');
            return;
        }

        if (!form.bankAccountNumber.trim()) {
            toast.error('Payout account number is required.');
            return;
        }

        if (form.vendorType === 'registered_business') {
            if (!form.businessName.trim()) {
                toast.error('Business name is required for registered businesses.');
                return;
            }
            if (!form.businessRegistrationNumber.trim()) {
                toast.error('Business registration number is required.');
                return;
            }
        }

        if (!attachments.governmentIdFile || !attachments.selfieFile) {
            toast.error('Government ID and selfie uploads are required.');
            return;
        }

        const requestedSlug = normalizeSlugInput(
            form.subdomainSlug ||
            (form.vendorType === 'registered_business'
                ? form.businessName
                : form.ownerFullName),
        );
        if (!requestedSlug) {
            toast.error('Store web address is required.');
            return;
        }

        setSaving(true);
        try {
            const slugAvailability = await checkSlugAvailability(requestedSlug);
            if (!slugAvailability.available) {
                setSlugStatus('taken');
                toast.error(`${slugAvailability.slug}.${VENDOR_DOMAIN} is already taken.`);
                return;
            }
            setSlugStatus('available');

            const result = await submitVendorRegistration({
                vendorType: form.vendorType,
                businessName:
                    form.vendorType === 'registered_business'
                        ? form.businessName.trim()
                        : undefined,
                businessRegistrationType:
                    form.vendorType === 'registered_business'
                        ? form.businessRegistrationType
                        : undefined,
                businessRegistrationNumber:
                    form.vendorType === 'registered_business'
                        ? form.businessRegistrationNumber.trim()
                        : undefined,
                birTin: form.birTin.trim() || undefined,
                ownerFullName: form.ownerFullName.trim(),
                governmentIdNumber: form.governmentIdNumber.trim(),
                address: form.address.trim(),
                latitude: selectedLocation[0],
                longitude: selectedLocation[1],
                phone: form.phone.trim(),
                bankName: form.bankName.trim(),
                bankAccountName: form.bankAccountName.trim(),
                bankAccountNumber: form.bankAccountNumber.trim(),
                socialMediaLink: form.socialMediaLink.trim() || undefined,
                description: form.description.trim() || undefined,
                slug: slugAvailability.slug,
                governmentIdFile: attachments.governmentIdFile,
                selfieFile: attachments.selfieFile,
                mayorsPermitFile: attachments.mayorsPermitFile,
                barangayPermitFile: attachments.barangayPermitFile,
                logoFile: attachments.logoFile,
                deviceFingerprint: deviceFingerprint || undefined,
            });
            setRegistration(result);
            toast.success(t('becomeVendorPage.toastSubmitted'));
        } catch (error: any) {
            toast.error(error?.response?.data?.message || t('becomeVendorPage.toastSubmitFailed'));
        } finally {
            setSaving(false);
        }
    };

    if (!user) {
        return (
            <CustomerLayout>
                <div className="max-w-3xl mx-auto px-4 py-10">
                    <h1 className="text-3xl font-bold text-gray-900">{t('becomeVendorPage.title')}</h1>
                    <p className="text-gray-600 mt-3">{t('becomeVendorPage.signInFirst')}</p>
                    <Button className="mt-6" onClick={() => { savePostLoginRedirect(getCurrentAppPath()); navigate('/login'); }}>{t('common.signIn')}</Button>
                </div>
            </CustomerLayout>
        );
    }

    if (user.role !== 'customer') {
        return (
            <CustomerLayout>
                <div className="max-w-3xl mx-auto px-4 py-10">
                    <h1 className="text-3xl font-bold text-gray-900">{t('becomeVendorPage.title')}</h1>
                    <p className="text-gray-600 mt-3">
                        {t('becomeVendorPage.roleAlready', { role: user.role })}
                    </p>
                    <Button className="mt-6" onClick={() => navigate('/')}>{t('becomeVendorPage.backToHome')}</Button>
                </div>
            </CustomerLayout>
        );
    }

    if (settingsLoading) {
        return (
            <CustomerLayout>
                <div className="max-w-3xl mx-auto px-4 py-10">
                    <h1 className="text-3xl font-bold text-gray-900">{t('becomeVendorPage.title')}</h1>
                    <p className="text-gray-600 mt-3">Loading registration settings...</p>
                </div>
            </CustomerLayout>
        );
    }

    if (!kycSettings.vendorRegistrationEnabled) {
        return (
            <CustomerLayout>
                <div className="max-w-3xl mx-auto px-4 py-10">
                    <h1 className="text-3xl font-bold text-gray-900">{t('becomeVendorPage.title')}</h1>
                    <p className="text-gray-600 mt-3">
                        Vendor registration is temporarily disabled by platform admin.
                    </p>
                    <Button className="mt-6" onClick={() => navigate('/')}>
                        {t('becomeVendorPage.backToHome')}
                    </Button>
                </div>
            </CustomerLayout>
        );
    }

    return (
        <CustomerLayout>
            <div className="max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-4xl font-bold text-gray-900">🏪 {t('becomeVendorPage.titleRegistration')}</h1>
                <p className="text-gray-600 mt-2 text-lg">
                    {t('becomeVendorPage.intro')}
                </p>

                {registration && (
                    <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
                        <p className="font-semibold text-blue-900">
                            {t('becomeVendorPage.latestRegistrationStatus', {
                                status:
                                    registration.verificationStatus ||
                                    registration.registrationStatus ||
                                    t('becomeVendorPage.pending'),
                            })}
                        </p>
                        <p className="text-blue-800 text-sm mt-1">
                            {t('becomeVendorPage.kycStatus', {
                                status: registration.kycStatus || t('becomeVendorPage.pending'),
                            })}
                        </p>
                        {registration.rejectionReason && (
                            <p className="text-blue-800 text-sm mt-1">
                                Rejection reason: {registration.rejectionReason}
                            </p>
                        )}
                        {registration.kycNotes && (
                            <p className="text-blue-800 text-sm mt-1">
                                {t('becomeVendorPage.adminNotes', { notes: registration.kycNotes })}
                            </p>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="mt-8 bg-white rounded-2xl shadow p-6 space-y-5">
                    <div>
                        <Label htmlFor="vendorType" value="Vendor Type" />
                        <select
                            id="vendorType"
                            value={form.vendorType}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    vendorType: e.target.value as VendorType,
                                }))
                            }
                            className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-blue-500"
                        >
                            <option value="registered_business">Registered Business</option>
                            <option value="individual_owner">Individual Owner</option>
                        </select>
                    </div>

                    {form.vendorType === 'registered_business' && (
                        <>
                            <div>
                                <Label htmlFor="businessName" value={t('becomeVendorPage.businessName')} />
                                <TextInput
                                    id="businessName"
                                    required={form.vendorType === 'registered_business'}
                                    value={form.businessName}
                                    onChange={(e) => handleBusinessNameChange(e.target.value)}
                                    placeholder={t('becomeVendorPage.businessNamePlaceholder')}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="businessRegistrationType" value="Business Registration Type" />
                                    <select
                                        id="businessRegistrationType"
                                        value={form.businessRegistrationType}
                                        onChange={(e) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                businessRegistrationType: e.target.value as BusinessRegistrationType,
                                            }))
                                        }
                                        className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-blue-500"
                                    >
                                        <option value="dti">DTI</option>
                                        <option value="sec">SEC</option>
                                    </select>
                                </div>
                                <div>
                                    <Label htmlFor="businessRegistrationNumber" value="Business Registration Number" />
                                    <TextInput
                                        id="businessRegistrationNumber"
                                        required={form.vendorType === 'registered_business'}
                                        value={form.businessRegistrationNumber}
                                        onChange={(e) =>
                                            setForm((prev) => ({ ...prev, businessRegistrationNumber: e.target.value }))
                                        }
                                        placeholder="DTI/SEC Number"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="birTin" value="BIR TIN (Optional)" />
                                <TextInput
                                    id="birTin"
                                    value={form.birTin}
                                    onChange={(e) => setForm((prev) => ({ ...prev, birTin: e.target.value }))}
                                    placeholder="000-000-000"
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <Label htmlFor="ownerFullName" value="Owner Full Name" />
                        <TextInput
                            id="ownerFullName"
                            required
                            value={form.ownerFullName}
                            onChange={(e) => handleOwnerFullNameChange(e.target.value)}
                            placeholder="Juan Dela Cruz"
                        />
                    </div>

                    <div>
                        <Label htmlFor="governmentIdNumber" value="Government ID Number" />
                        <TextInput
                            id="governmentIdNumber"
                            required
                            value={form.governmentIdNumber}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, governmentIdNumber: e.target.value }))
                            }
                            placeholder="ID Number"
                        />
                    </div>

                    <div>
                        <Label htmlFor="subdomainSlug" value="Your Store Web Address" />
                        <div className="flex items-center gap-0 mt-1 rounded-lg border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-500">
                            <span className="px-3 py-2.5 bg-gray-50 text-gray-500 text-sm border-r border-gray-300 whitespace-nowrap select-none">
                                https://
                            </span>
                            <input
                                id="subdomainSlug"
                                type="text"
                                value={form.subdomainSlug}
                                onChange={(e) => {
                                    setSlugTouched(true);
                                    const val = normalizeSlugInput(e.target.value);
                                    setForm((prev) => ({ ...prev, subdomainSlug: val }));
                                    scheduleSlugCheck(val);
                                }}
                                placeholder="your-store-name"
                                className="flex-1 px-3 py-2.5 text-sm outline-none bg-white"
                                spellCheck={false}
                                autoComplete="off"
                            />
                            <span className="px-3 py-2.5 bg-gray-50 text-gray-500 text-sm border-l border-gray-300 whitespace-nowrap select-none">
                                .{VENDOR_DOMAIN}
                            </span>
                        </div>
                        {form.subdomainSlug && (
                            <p className={`mt-1 text-xs font-medium ${slugStatus === 'available' ? 'text-green-600' :
                                slugStatus === 'taken' ? 'text-red-600' : 'text-gray-400'
                                }`}>
                                {slugStatus === 'available' && `${form.subdomainSlug}.${VENDOR_DOMAIN} is available`}
                                {slugStatus === 'taken' && `${form.subdomainSlug}.${VENDOR_DOMAIN} is already taken`}
                                {slugStatus === 'checking' && 'Checking availability...'}
                            </p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                            This will be your store's web address. Only letters, numbers, and hyphens are allowed.
                        </p>
                    </div>

                    <div>
                        <Label htmlFor="address" value={t('becomeVendorPage.businessAddress')} />
                        <TextInput
                            id="address"
                            required
                            value={form.address}
                            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                            placeholder={t('becomeVendorPage.businessAddressPlaceholder')}
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <Label value={t('becomeVendorPage.locationPicker')} />
                                <p className="mt-1 text-sm text-gray-600">
                                    {t('becomeVendorPage.locationPickerHint')}
                                </p>
                            </div>
                            <Button
                                type="button"
                                color="light"
                                isProcessing={locating}
                                disabled={locating}
                                onClick={handleUseCurrentLocation}
                            >
                                {t('becomeVendorPage.useCurrentLocation')}
                            </Button>
                        </div>

                        <div className="h-[240px] overflow-hidden rounded-xl border border-gray-200 sm:h-[320px]">
                            <MapContainer center={mapCenter} zoom={15} className="h-full w-full">
                                <VendorMapCenterController center={mapCenter} />
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution="&copy; OpenStreetMap contributors"
                                />
                                <VendorLocationPin
                                    position={selectedLocation}
                                    onPositionChange={updateLocation}
                                />
                            </MapContainer>
                        </div>

                        <p className="text-sm font-medium text-gray-700">
                            {t('becomeVendorPage.locationSelected', {
                                coordinates: formatCoordinates(selectedLocation),
                            })}
                        </p>
                    </div>

                    <div>
                        <Label htmlFor="phone" value={t('becomeVendorPage.contactNumber')} />
                        <TextInput
                            id="phone"
                            required
                            value={form.phone}
                            onChange={(e) => {
                                setForm((prev) => ({ ...prev, phone: e.target.value }));
                            }}
                            placeholder={t('becomeVendorPage.contactNumberPlaceholder')}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="bankName" value="Payout Method" />
                            <TextInput
                                id="bankName"
                                required
                                value={form.bankName}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, bankName: e.target.value }))
                                }
                                placeholder="GCash / BDO / BPI"
                            />
                        </div>
                        <div>
                            <Label htmlFor="bankAccountName" value="Payout Account Name" />
                            <TextInput
                                id="bankAccountName"
                                required
                                value={form.bankAccountName}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, bankAccountName: e.target.value }))
                                }
                                placeholder="Account holder name"
                            />
                        </div>
                        <div>
                            <Label htmlFor="bankAccountNumber" value="Payout Account Number" />
                            <TextInput
                                id="bankAccountNumber"
                                required
                                value={form.bankAccountNumber}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, bankAccountNumber: e.target.value }))
                                }
                                placeholder="0917... or bank account no."
                            />
                        </div>
                    </div>

                    {kycSettings.requireOtpBeforeVendorRegistration ? (
                        <>
                            <div>
                                <Label value="Email Verification" />
                                <p className="mt-1 text-sm text-gray-600">
                                    OTP will be sent to <span className="font-semibold text-gray-800">{user.email}</span>.
                                </p>
                                <Button
                                    type="button"
                                    color="light"
                                    className="mt-3"
                                    isProcessing={otpBusy}
                                    disabled={otpBusy || !user.email}
                                    onClick={handleRequestOtp}
                                >
                                    Send Email OTP
                                </Button>
                            </div>

                            <div>
                                <Label htmlFor="otpCode" value="Email OTP Code" />
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <TextInput
                                        id="otpCode"
                                        value={otpCode}
                                        onChange={(e) => setOtpCode(e.target.value)}
                                        placeholder="6-digit OTP"
                                    />
                                    <Button
                                        type="button"
                                        color={otpVerified ? 'success' : 'light'}
                                        isProcessing={otpBusy}
                                        disabled={otpBusy || !otpCode.trim()}
                                        onClick={handleVerifyOtp}
                                    >
                                        {otpVerified ? 'Verified' : 'Verify OTP'}
                                    </Button>
                                </div>
                                {!otpRequested && (
                                    <p className="text-xs text-gray-500 mt-1">Request email OTP before verification.</p>
                                )}
                                {otpVerified && (
                                    <p className="text-xs text-green-700 mt-1">Email is OTP verified.</p>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                            Email OTP verification is currently optional. You can submit registration directly.
                        </div>
                    )}

                    <div>
                        <Label htmlFor="governmentIdFile" value="Government ID Upload" />
                        <input
                            id="governmentIdFile"
                            type="file"
                            required
                            accept="image/*,.pdf"
                            onChange={handleFileChange('governmentIdFile')}
                            className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                        />
                        <p className="mt-1 text-xs text-gray-500">Upload a clear image or PDF of your government ID.</p>
                    </div>

                    <div>
                        <Label htmlFor="selfieFile" value="Selfie Verification Upload" />
                        <input
                            id="selfieFile"
                            type="file"
                            required
                            accept="image/*"
                            onChange={handleFileChange('selfieFile')}
                            className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                        />
                        <p className="mt-1 text-xs text-gray-500">Upload a selfie holding or matching your submitted government ID.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="mayorsPermitFile" value="Mayor's Permit Upload (Optional)" />
                            <input
                                id="mayorsPermitFile"
                                type="file"
                                accept="image/*,.pdf"
                                onChange={handleFileChange('mayorsPermitFile')}
                                className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                            />
                        </div>
                        <div>
                            <Label htmlFor="barangayPermitFile" value="Barangay Permit Upload (Optional)" />
                            <input
                                id="barangayPermitFile"
                                type="file"
                                accept="image/*,.pdf"
                                onChange={handleFileChange('barangayPermitFile')}
                                className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="logoFile" value="Business Logo Upload (Optional)" />
                            <input
                                id="logoFile"
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange('logoFile')}
                                className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                            />
                        </div>
                        <div>
                            <Label htmlFor="socialMediaLink" value="Social Media Link (Optional)" />
                            <TextInput
                                id="socialMediaLink"
                                type="url"
                                value={form.socialMediaLink}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, socialMediaLink: e.target.value }))
                                }
                                placeholder="https://facebook.com/..."
                            />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="description" value={t('becomeVendorPage.businessDescription')} />
                        <textarea
                            id="description"
                            rows={4}
                            value={form.description}
                            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                            className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-blue-500"
                            placeholder={t('becomeVendorPage.businessDescriptionPlaceholder')}
                        />
                    </div>

                    <div className="pt-2 flex flex-wrap gap-3">
                        <Button
                            type="submit"
                            isProcessing={saving}
                            disabled={
                                saving ||
                                (kycSettings.requireOtpBeforeVendorRegistration && !otpVerified)
                            }
                        >
                            {t('becomeVendorPage.submitForReview')}
                        </Button>
                        <Button color="light" type="button" onClick={() => navigate('/')}>
                            {t('common.cancel')}
                        </Button>
                    </div>
                </form>
            </div>
        </CustomerLayout>
    );
}
