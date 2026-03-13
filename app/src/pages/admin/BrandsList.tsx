import { useEffect, useState } from 'react';
import { Button, Table, Modal, TextInput, Select } from 'flowbite-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import { getBrands, createBrand, deleteBrand, getItemTypes } from '../../api/items';
import type { ProductBrand, ItemType } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useTranslation } from 'react-i18next';

export default function BrandsList() {
  const { t } = useTranslation();
  const [brands, setBrands] = useState<ProductBrand[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', itemTypeId: '' });

  const load = () => Promise.all([getBrands(), getItemTypes()])
    .then(([b, it]) => { setBrands(b); setItemTypes(it); })
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    await createBrand(form);
    toast.success(t('brandsList.toastBrandCreated'));
    setShowModal(false);
    load();
  };

  if (loading) return <AdminLayout><LoadingSpinner /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-gray-900">🏷️ {t('brandsList.title')}</h1>
        <Button size="xl" onClick={() => setShowModal(true)}>+ {t('brandsList.addBrand')}</Button>
      </div>
      <div className="overflow-x-auto rounded-xl shadow">
        <Table striped>
          <Table.Head>
            <Table.HeadCell className="text-lg">{t('brandsList.brand')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('brandsList.itemType')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('common.actions')}</Table.HeadCell>
          </Table.Head>
          <Table.Body>
            {brands.map(b => (
              <Table.Row key={b.id} className="text-lg">
                <Table.Cell className="font-semibold">{b.name}</Table.Cell>
                <Table.Cell>{b.itemType?.name}</Table.Cell>
                <Table.Cell>
                  <Button color="failure" size="sm" onClick={() => deleteBrand(b.id).then(() => { toast.success(t('brandsList.toastDeleted')); load(); })}>{t('common.delete')}</Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
      <Modal show={showModal} onClose={() => setShowModal(false)}>
        <Modal.Header>{t('brandsList.modalTitle')}</Modal.Header>
        <Modal.Body className="space-y-4">
          <TextInput placeholder={t('brandsList.brandNamePlaceholder')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} sizing="lg" />
          <TextInput placeholder={t('brandsList.descriptionPlaceholder')} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} sizing="lg" />
          <Select value={form.itemTypeId} onChange={e => setForm(f => ({ ...f, itemTypeId: e.target.value }))}>
            <option value="">{t('brandsList.selectItemType')}</option>
            {itemTypes.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
          </Select>
        </Modal.Body>
        <Modal.Footer>
          <Button size="xl" onClick={handleSubmit}>{t('common.save')}</Button>
          <Button color="gray" size="xl" onClick={() => setShowModal(false)}>{t('common.cancel')}</Button>
        </Modal.Footer>
      </Modal>
    </AdminLayout>
  );
}
