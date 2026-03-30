import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'flowbite-react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import { getVendorBySlug } from '../../api/vendors';
import { getInventory } from '../../api/items';
import type { Vendor, InventoryItem } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency } from '../../utils/format';
import { HiCheckCircle, HiLocationMarker, HiPhone, HiShoppingCart } from 'react-icons/hi';

export default function VendorLanding() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    getVendorBySlug(slug)
      .then(v => {
        setVendor(v);
        return getInventory(v.id);
      })
      .then(setInventory)
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <CustomerLayout><LoadingSpinner size="lg" /></CustomerLayout>;
  if (!vendor) return <CustomerLayout><div className="text-center py-20 text-2xl">Shop not found</div></CustomerLayout>;

  return (
    <CustomerLayout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Shop Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-3xl p-8 mb-8">
          <h1 className="text-5xl font-bold mb-2">{vendor.businessName}</h1>
          <p className="inline-flex items-center gap-2 text-xl text-blue-100">
            <HiLocationMarker className="h-5 w-5" />
            {vendor.address}
          </p>
          {vendor.phone && (
            <p className="mt-1 inline-flex items-center gap-2 text-xl text-blue-100">
              <HiPhone className="h-5 w-5" />
              {vendor.phone}
            </p>
          )}
          {vendor.description && <p className="text-xl mt-4">{vendor.description}</p>}
          {vendor.isVerified && (
            <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-green-400 px-4 py-1 font-semibold text-green-900">
              <HiCheckCircle className="h-5 w-5" />
              Verified Rental Partner
            </span>
          )}
        </div>

        {/* Book Button */}
        <div className="text-center mb-8">
          <Button size="xl" onClick={() => navigate(`/book/${slug}`)}
            className="text-2xl px-12 py-4 !bg-emerald-500 hover:!bg-emerald-600 focus:!ring-emerald-300 !text-white shadow-lg">
            <span className="inline-flex items-center gap-2">
              <HiShoppingCart className="h-6 w-6" />
              Book Now
            </span>
          </Button>
        </div>

        {/* Inventory */}
        <h2 className="mb-6 text-3xl font-bold text-gray-900">Available Equipment</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {inventory.map(item => (
            <div key={item.id} className="bg-white rounded-2xl shadow p-5">
              {item.pictureUrl && <img src={item.pictureUrl} alt="" className="w-full h-40 object-cover rounded-xl mb-4" />}
              <h3 className="text-2xl font-bold">{item.itemType?.name}</h3>
              {item.brand && <p className="text-gray-500 text-lg">{item.brand.name}</p>}
              <div className="mt-3 space-y-1 text-xl">
                <p>Available: <strong className="text-green-600">{item.availableQuantity}</strong> units</p>
                <p><strong>{formatCurrency(item.ratePerDay)}</strong>/day per unit</p>
                {item.condition && <p>{item.condition}</p>}
              </div>
            </div>
          ))}
          {inventory.length === 0 && (
            <div className="col-span-3 text-center py-10 text-2xl text-gray-400">
              No items listed yet.
            </div>
          )}
        </div>
      </div>
    </CustomerLayout>
  );
}
