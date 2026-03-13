import { useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Button } from 'flowbite-react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { getNearbyVendors } from '../../api/vendors';
import type { Vendor } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function CustomerHome() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [center, setCenter] = useState<[number, number]>([14.5995, 120.9842]);
  const navigate = useNavigate();

  const findNearMe = useCallback(() => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCenter([latitude, longitude]);
        getNearbyVendors(latitude, longitude)
          .then(v => { setVendors(v); setSearched(true); })
          .finally(() => setLoading(false));
      },
      () => {
        // Fallback to Metro Manila
        getNearbyVendors(14.5995, 120.9842)
          .then(v => { setVendors(v); setSearched(true); })
          .finally(() => setLoading(false));
      }
    );
  }, []);

  return (
    <CustomerLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">🪑 Find Event Equipment Near You</h1>
          <p className="text-2xl text-gray-500 mb-8">Chairs • Tables • Videoke • Tents • More</p>
          <Button size="xl" onClick={findNearMe} disabled={loading} isProcessing={loading}
            className="text-2xl px-10 py-4">
            📍 Search Near Me
          </Button>
        </div>

        {loading && <LoadingSpinner size="lg" />}

        {searched && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Map */}
            <div className="h-96 rounded-2xl overflow-hidden shadow-lg">
              <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
                {vendors.map(v => v.latitude && v.longitude ? (
                  <Marker key={v.id} position={[Number(v.latitude), Number(v.longitude)]}>
                    <Popup>
                      <div className="text-center">
                        <p className="font-bold text-lg">{v.businessName}</p>
                        <p className="text-gray-500">{v.address}</p>
                        <button onClick={() => navigate(`/shop/${v.slug}`)} className="mt-2 bg-blue-600 text-white px-3 py-1 rounded-lg text-sm">View Shop</button>
                      </div>
                    </Popup>
                  </Marker>
                ) : null)}
              </MapContainer>
            </div>

            {/* Vendor Cards */}
            <div className="space-y-4 overflow-y-auto max-h-96">
              {vendors.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-2xl text-gray-400">😔 No vendors found nearby.</p>
                  <p className="text-xl text-gray-400 mt-2">Try searching in a different area.</p>
                </div>
              )}
              {vendors.map(v => (
                <div key={v.id} onClick={() => navigate(`/shop/${v.slug}`)}
                  className="bg-white rounded-2xl shadow-md p-5 cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-blue-300">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">{v.businessName}</h3>
                      <p className="text-gray-500 text-lg mt-1">📍 {v.address}</p>
                      {v.distanceKm && <p className="text-blue-600 font-semibold text-lg mt-1">🚗 {v.distanceKm.toFixed(1)} km away</p>}
                    </div>
                    {v.isVerified && <span className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full">✓ Verified</span>}
                  </div>
                  {v.description && <p className="text-gray-600 mt-2 text-lg line-clamp-2">{v.description}</p>}
                  <Button color="blue" size="lg" className="mt-3 w-full">View Shop →</Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
