import { useEffect, useState } from 'react';
import { Button, TextInput, Table, Modal } from 'flowbite-react';
import toast from 'react-hot-toast';
import VendorLayout from '../../components/layout/VendorLayout';
import { getDeliveryRates, addDeliveryRate, updateDeliveryRate, deleteDeliveryRate } from '../../api/payments';
import type { DeliveryRate } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency } from '../../utils/format';
import { useTranslation } from 'react-i18next';

export default function Pricing() {
  const { t } = useTranslation();
  const [rates, setRates] = useState<DeliveryRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ distanceKm: '', chargeAmount: '', helpersCount: '1' });
  const [editingRate, setEditingRate] = useState<DeliveryRate | null>(null);
  const [editForm, setEditForm] = useState({ distanceKm: '', chargeAmount: '', helpersCount: '1' });

  const load = () => getDeliveryRates().then(setRates).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    await addDeliveryRate({ distanceKm: Number(form.distanceKm), chargeAmount: Number(form.chargeAmount), helpersCount: Number(form.helpersCount) });
    toast.success(t('pricingPage.toastRateAdded'));
    setForm({ distanceKm: '', chargeAmount: '', helpersCount: '1' });
    load();
  };

  const openEditModal = (rate: DeliveryRate) => {
    setEditingRate(rate);
    setEditForm({
      distanceKm: String(rate.distanceKm),
      chargeAmount: String(rate.chargeAmount),
      helpersCount: String(rate.helpersCount),
    });
  };

  const closeEditModal = () => {
    setEditingRate(null);
    setEditForm({ distanceKm: '', chargeAmount: '', helpersCount: '1' });
  };

  const handleUpdate = async () => {
    if (!editingRate) return;

    await updateDeliveryRate(editingRate.id, {
      distanceKm: Number(editForm.distanceKm),
      chargeAmount: Number(editForm.chargeAmount),
      helpersCount: Number(editForm.helpersCount),
    });

    toast.success(t('pricingPage.toastUpdated'));
    closeEditModal();
    load();
  };

  if (loading) return <VendorLayout><LoadingSpinner /></VendorLayout>;

  return (
    <VendorLayout>
      <h1 className="text-4xl font-bold text-gray-900 mb-6">💵 {t('pricingPage.title')}</h1>
      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">{t('pricingPage.addDeliveryRate')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <TextInput type="number" placeholder={t('pricingPage.distancePlaceholder')} value={form.distanceKm} onChange={e => setForm(f => ({ ...f, distanceKm: e.target.value }))} sizing="lg" />
          <TextInput type="number" placeholder={t('pricingPage.chargePlaceholder')} value={form.chargeAmount} onChange={e => setForm(f => ({ ...f, chargeAmount: e.target.value }))} sizing="lg" />
          <TextInput type="number" placeholder={t('pricingPage.helpersPlaceholder')} value={form.helpersCount} onChange={e => setForm(f => ({ ...f, helpersCount: e.target.value }))} sizing="lg" />
        </div>
        <Button size="xl" onClick={handleAdd}>+ {t('pricingPage.addRate')}</Button>
      </div>
      <div className="overflow-x-auto rounded-xl shadow">
        <Table striped>
          <Table.Head>
            <Table.HeadCell className="text-lg">{t('pricingPage.distance')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('pricingPage.charge')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('pricingPage.helpers')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('common.actions')}</Table.HeadCell>
          </Table.Head>
          <Table.Body>
            {rates.map(r => (
              <Table.Row key={r.id} className="text-lg">
                <Table.Cell>{t('pricingPage.upToKm', { km: r.distanceKm })}</Table.Cell>
                <Table.Cell className="font-semibold">{formatCurrency(r.chargeAmount)}</Table.Cell>
                <Table.Cell>{t('pricingPage.helpersCount', { count: r.helpersCount })}</Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <Button color="light" size="sm" onClick={() => openEditModal(r)}>{t('common.edit')}</Button>
                    <Button color="failure" size="sm" onClick={() => deleteDeliveryRate(r.id).then(() => { toast.success(t('pricingPage.toastDeleted')); load(); })}>{t('common.delete')}</Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>

      <Modal show={Boolean(editingRate)} onClose={closeEditModal} size="lg">
        <Modal.Header>{t('pricingPage.editRate')}</Modal.Header>
        <Modal.Body>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TextInput type="number" placeholder={t('pricingPage.distancePlaceholder')} value={editForm.distanceKm} onChange={e => setEditForm(f => ({ ...f, distanceKm: e.target.value }))} sizing="lg" />
            <TextInput type="number" placeholder={t('pricingPage.chargePlaceholder')} value={editForm.chargeAmount} onChange={e => setEditForm(f => ({ ...f, chargeAmount: e.target.value }))} sizing="lg" />
            <TextInput type="number" placeholder={t('pricingPage.helpersPlaceholder')} value={editForm.helpersCount} onChange={e => setEditForm(f => ({ ...f, helpersCount: e.target.value }))} sizing="lg" />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button size="xl" onClick={handleUpdate}>{t('common.save')}</Button>
          <Button color="gray" size="xl" onClick={closeEditModal}>{t('common.cancel')}</Button>
        </Modal.Footer>
      </Modal>
    </VendorLayout>
  );
}
