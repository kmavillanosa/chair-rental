import { useCallback, useEffect, useState } from 'react';
import { Button, TextInput, Textarea } from 'flowbite-react';
import toast from 'react-hot-toast';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import VendorLayout from '../../components/layout/VendorLayout';
import { getMyVendor, updateMyVendor } from '../../api/vendors';
import type { Vendor } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';

type VendorForm = {
  businessName: string;
  address: string;
  description: string;
  phone: string;
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
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<VendorForm>({
    businessName: '',
    address: '',
    description: '',
    phone: '',
    latitude: null,
    longitude: null,
  });
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const customerAppUrl = (import.meta.env.VITE_CUSTOMER_APP_URL || 'http://127.0.0.1:43171').replace(/\/$/, '');
  const publicShopUrl = `${customerAppUrl}/shop/${vendor?.slug || ''}`;

  const setLocation = useCallback((latitude: number, longitude: number) => {
    const normalizedLat = Number(latitude.toFixed(6));
    const normalizedLng = Number(longitude.toFixed(6));
    setForm((current) => ({ ...current, latitude: normalizedLat, longitude: normalizedLng }));
    setMapCenter([normalizedLat, normalizedLng]);
  }, []);

  useEffect(() => {
    getMyVendor()
      .then((v) => {
        setVendor(v);
        setForm({
          businessName: v.businessName,
          address: v.address,
          description: v.description || '',
          phone: v.phone || '',
          latitude: v.latitude != null ? Number(v.latitude) : null,
          longitude: v.longitude != null ? Number(v.longitude) : null,
        });

        if (v.latitude != null && v.longitude != null) {
          setMapCenter([Number(v.latitude), Number(v.longitude)]);
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
        latitude: form.latitude ?? undefined,
        longitude: form.longitude ?? undefined,
      });
      toast.success('Shop updated! ✅');
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
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (loading) return <VendorLayout><LoadingSpinner /></VendorLayout>;

  return (
    <VendorLayout>
      <h1 className="text-4xl font-bold text-gray-900 mb-6">🏪 My Shop</h1>
      <div className="bg-white rounded-2xl shadow p-8 max-w-2xl space-y-5">
        <div>
          <label className="block text-xl font-semibold mb-2">Business Name</label>
          <TextInput value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} sizing="lg" />
        </div>
        <div>
          <label className="block text-xl font-semibold mb-2">Address</label>
          <TextInput value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} sizing="lg" />
        </div>
        <div>
          <label className="block text-xl font-semibold mb-2">Phone Number</label>
          <TextInput value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} sizing="lg" />
        </div>
        <div>
          <label className="block text-xl font-semibold mb-2">Description</label>
          <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2 gap-4">
            <label className="block text-xl font-semibold">Pin Shop Location</label>
            <Button color="light" onClick={handleUseCurrentLocation} disabled={locating} isProcessing={locating}>
              Use Current Location
            </Button>
          </div>
          <p className="text-sm text-gray-500 mb-3">Click anywhere on the map to drop your pin. Drag the pin to refine your exact spot.</p>
          <div className="h-80 rounded-xl overflow-hidden border border-gray-200">
            <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              <MapViewport center={mapCenter} />
              <LocationPicker onPick={setLocation} />
              {form.latitude != null && form.longitude != null && (
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
              )}
            </MapContainer>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <TextInput
              readOnly
              value={form.latitude != null ? form.latitude.toFixed(6) : ''}
              placeholder="Latitude"
              sizing="md"
            />
            <TextInput
              readOnly
              value={form.longitude != null ? form.longitude.toFixed(6) : ''}
              placeholder="Longitude"
              sizing="md"
            />
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-lg font-semibold text-blue-800">🔗 Your Shop URL:</p>
          <a href={publicShopUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xl hover:underline">
            {publicShopUrl}
          </a>
        </div>
        <Button size="xl" onClick={handleSave} disabled={saving} isProcessing={saving}>
          💾 Save Changes
        </Button>
      </div>
    </VendorLayout>
  );
}
