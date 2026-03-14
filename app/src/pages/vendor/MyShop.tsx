import { useCallback, useEffect, useState } from 'react';
import { Button, TextInput, Textarea } from 'flowbite-react';
import toast from 'react-hot-toast';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import VendorLayout from '../../components/layout/VendorLayout';
import { getMyVendor, updateMyVendor } from '../../api/vendors';
import type { Vendor } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useTranslation } from 'react-i18next';

type VendorForm = {
    businessName: string;
    address: string;
    description: string;
    phone: string;
    paymongoMerchantId: string;
    latitude: number | null;
    longitude: number | null;
};

const DEFAULT_CENTER: [number, number] = [14.5995, 120.9842];

const vendorPinIcon = L.icon({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

function LocationPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(event) {
            onPick(event.latlng.lat, event.latlng.lng);
        },
    });

    return null;
}

function MapViewport({ center }: { center: [number, number] }) {
    const map = useMap();

    useEffect(() => {
        map.setView(center);
    }, [center, map]);

    return null;
}

export default function MyShop() {
    const { t } = useTranslation();
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [locating, setLocating] = useState(false);
    const [form, setForm] = useState<VendorForm>({
        businessName: '',
        address: '',
        description: '',
        phone: '',
        paymongoMerchantId: '',
        latitude: null,
        longitude: null,
    });
    const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);

    const setLocation = useCallback((latitude: number, longitude: number) => {
        const normalizedLat = Number(latitude.toFixed(6));
        const normalizedLng = Number(longitude.toFixed(6));
        setForm((current) => ({ ...current, latitude: normalizedLat, longitude: normalizedLng }));
        setMapCenter([normalizedLat, normalizedLng]);
    }, []);

    useEffect(() => {
        getMyVendor()
            .then((vendorData) => {
                setVendor(vendorData);
                setForm({
                    businessName: vendorData.businessName,
                    address: vendorData.address,
                    description: vendorData.description || '',
                    phone: vendorData.phone || '',
                    paymongoMerchantId: vendorData.paymongoMerchantId || '',
                    latitude: vendorData.latitude != null ? Number(vendorData.latitude) : null,
                    longitude: vendorData.longitude != null ? Number(vendorData.longitude) : null,
                });

                if (vendorData.latitude != null && vendorData.longitude != null) {
                    setMapCenter([Number(vendorData.latitude), Number(vendorData.longitude)]);
                }
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateMyVendor({
                businessName: form.businessName,
                address: form.address,
                description: form.description,
                phone: form.phone,
                paymongoMerchantId: form.paymongoMerchantId.trim() || undefined,
                latitude: form.latitude ?? undefined,
                longitude: form.longitude ?? undefined,
            });
            toast.success(t('myShopPage.toastUpdated'));
        } catch {
            toast.error('Could not save shop details. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported on this browser.');
            return;
        }

        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation(position.coords.latitude, position.coords.longitude);
                toast.success('Map pin set from your current location.');
                setLocating(false);
            },
            () => {
                toast.error('Could not get your location. Allow permission or click the map manually.');
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000 },
        );
    };

    if (loading) {
        return (
            <VendorLayout>
                <LoadingSpinner />
            </VendorLayout>
        );
    }

    return (
        <VendorLayout>
            <h1 className="mb-4 text-2xl font-bold text-gray-900 sm:mb-6 sm:text-4xl">🏪 {t('myShopPage.title')}</h1>
            <div className="mx-auto max-w-3xl space-y-5 rounded-2xl bg-white p-4 shadow sm:p-8">
                <div>
                    <label className="block text-xl font-semibold mb-2">{t('common.businessName')}</label>
                    <TextInput value={form.businessName} onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))} sizing="lg" />
                </div>

                <div>
                    <label className="block text-xl font-semibold mb-2">{t('common.address')}</label>
                    <TextInput value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} sizing="lg" />
                </div>

                <div>
                    <label className="block text-xl font-semibold mb-2">{t('common.phoneNumber')}</label>
                    <TextInput value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} sizing="lg" />
                </div>

                <div>
                    <label className="block text-xl font-semibold mb-2">PayMongo Merchant ID</label>
                    <TextInput
                        value={form.paymongoMerchantId}
                        onChange={(event) => setForm((current) => ({ ...current, paymongoMerchantId: event.target.value }))}
                        placeholder="org_xxxxxxxxxxxxxxxxxx"
                        sizing="lg"
                    />
                </div>

                <div>
                    <label className="block text-xl font-semibold mb-2">{t('common.description')}</label>
                    <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={4} />
                </div>

                <div>
                    <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <label className="block text-xl font-semibold">Pin Shop Location</label>
                        <Button color="light" onClick={handleUseCurrentLocation} disabled={locating} isProcessing={locating} className="w-full sm:w-auto">
                            Use Current Location
                        </Button>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">Click anywhere on the map to drop your pin. Drag the pin to refine your exact spot.</p>

                    <div className="h-64 overflow-hidden rounded-xl border border-gray-200 sm:h-80">
                        <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution="&copy; OpenStreetMap contributors"
                            />
                            <MapViewport center={mapCenter} />
                            <LocationPicker onPick={setLocation} />
                            {form.latitude != null && form.longitude != null ? (
                                <Marker
                                    position={[form.latitude, form.longitude]}
                                    draggable
                                    icon={vendorPinIcon}
                                    eventHandlers={{
                                        dragend: (event) => {
                                            const marker = event.target as L.Marker;
                                            const { lat, lng } = marker.getLatLng();
                                            setLocation(lat, lng);
                                        },
                                    }}
                                />
                            ) : null}
                        </MapContainer>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        <TextInput readOnly value={form.latitude != null ? form.latitude.toFixed(6) : ''} placeholder="Latitude" sizing="md" />
                        <TextInput readOnly value={form.longitude != null ? form.longitude.toFixed(6) : ''} placeholder="Longitude" sizing="md" />
                    </div>
                </div>

                <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-lg font-semibold text-blue-800">🔗 {t('myShopPage.shopUrl')}</p>
                    <a href={`/shop/${vendor?.slug}`} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-blue-600 hover:underline sm:text-xl">
                        {window.location.origin}/shop/{vendor?.slug}
                    </a>
                </div>

                <Button size="lg" onClick={handleSave} disabled={saving} isProcessing={saving} className="w-full sm:w-auto">
                    💾 {t('myShopPage.saveChanges')}
                </Button>
            </div>
        </VendorLayout>
    );
}