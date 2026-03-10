import { useEffect, useState } from 'react';
import { Button, TextInput, Textarea } from 'flowbite-react';
import toast from 'react-hot-toast';
import VendorLayout from '../../components/layout/VendorLayout';
import { getMyVendor, updateMyVendor } from '../../api/vendors';
import type { Vendor } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function MyShop() {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ businessName: '', address: '', description: '', phone: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyVendor().then(v => {
      setVendor(v);
      setForm({ businessName: v.businessName, address: v.address, description: v.description || '', phone: v.phone || '' });
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await updateMyVendor(form);
    toast.success('Shop updated! ✅');
    setSaving(false);
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
          <TextInput value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} sizing="lg" />
        </div>
        <div>
          <label className="block text-xl font-semibold mb-2">Phone Number</label>
          <TextInput value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} sizing="lg" />
        </div>
        <div>
          <label className="block text-xl font-semibold mb-2">Description</label>
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} />
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-lg font-semibold text-blue-800">🔗 Your Shop URL:</p>
          <a href={`/shop/${vendor?.slug}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xl hover:underline">
            {window.location.origin}/shop/{vendor?.slug}
          </a>
        </div>
        <Button size="xl" onClick={handleSave} disabled={saving} isProcessing={saving}>
          💾 Save Changes
        </Button>
      </div>
    </VendorLayout>
  );
}
