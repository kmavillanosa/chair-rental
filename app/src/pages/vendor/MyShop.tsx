import { useEffect, useState } from 'react';
import { Button, TextInput, Textarea } from 'flowbite-react';
import toast from 'react-hot-toast';
import VendorLayout from '../../components/layout/VendorLayout';
import { getMyVendor, updateMyVendor } from '../../api/vendors';
import type { Vendor } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useTranslation } from 'react-i18next';

export default function MyShop() {
  const { t } = useTranslation();
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
    toast.success(t('myShopPage.toastUpdated'));
    setSaving(false);
  };

  if (loading) return <VendorLayout><LoadingSpinner /></VendorLayout>;

  return (
    <VendorLayout>
      <h1 className="text-4xl font-bold text-gray-900 mb-6">🏪 {t('myShopPage.title')}</h1>
      <div className="bg-white rounded-2xl shadow p-8 max-w-2xl space-y-5">
        <div>
          <label className="block text-xl font-semibold mb-2">{t('common.businessName')}</label>
          <TextInput value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} sizing="lg" />
        </div>
        <div>
          <label className="block text-xl font-semibold mb-2">{t('common.address')}</label>
          <TextInput value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} sizing="lg" />
        </div>
        <div>
          <label className="block text-xl font-semibold mb-2">{t('common.phoneNumber')}</label>
          <TextInput value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} sizing="lg" />
        </div>
        <div>
          <label className="block text-xl font-semibold mb-2">{t('common.description')}</label>
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} />
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-lg font-semibold text-blue-800">🔗 {t('myShopPage.shopUrl')}</p>
          <a href={`/shop/${vendor?.slug}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xl hover:underline">
            {window.location.origin}/shop/{vendor?.slug}
          </a>
        </div>
        <Button size="xl" onClick={handleSave} disabled={saving} isProcessing={saving}>
          💾 {t('myShopPage.saveChanges')}
        </Button>
      </div>
    </VendorLayout>
  );
}
