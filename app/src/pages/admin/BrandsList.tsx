import { useEffect, useState } from 'react';
import { Button, Table, Modal, TextInput, Select } from 'flowbite-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import { getBrands, createBrand, deleteBrand, getItemTypes, updateBrand } from '../../api/items';
import type { ProductBrand, ItemType } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useTranslation } from 'react-i18next';

export default function BrandsList() {
  const { t } = useTranslation();
  const [brands, setBrands] = useState<ProductBrand[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', itemTypeId: '' });

  const load = () => Promise.all([getBrands(), getItemTypes()])
    .then(([b, it]) => { setBrands(b); setItemTypes(it); })
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.itemTypeId) {
      toast.error(t('brandsList.toastRequiredFields'));
      return;
    }

    if (editingBrandId) {
      await updateBrand(editingBrandId, form);
      toast.success(t('brandsList.toastUpdated'));
    } else {
      await createBrand(form);
      toast.success(t('brandsList.toastBrandCreated'));
    }

    setEditingBrandId(null);
    setForm({ name: '', description: '', itemTypeId: '' });
    setShowModal(false);
    load();
  };

  if (loading) return <AdminLayout><LoadingSpinner /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-gray-900">🏷️ {t('brandsList.title')}</h1>
        <Button
          size="xl"
          onClick={() => {
            setEditingBrandId(null);
            setForm({ name: '', description: '', itemTypeId: '' });
            setShowModal(true);
          }}
        >
          + {t('brandsList.addBrand')}
        </Button>
      </div>

      <div className="space-y-3 md:hidden">
        {brands.map((brand) => (
          <article key={brand.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{brand.name}</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('brandsList.itemType')}</dt>
                <dd className="text-right text-slate-700">{brand.itemType?.name || t('common.na')}</dd>
              </div>
              {brand.description ? (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('brandsList.descriptionPlaceholder')}</dt>
                  <dd className="text-right text-slate-700">{brand.description}</dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                color="gray"
                size="sm"
                onClick={() => {
                  setEditingBrandId(brand.id);
                  setForm({
                    name: brand.name || '',
                    description: brand.description || '',
                    itemTypeId: brand.itemTypeId || '',
                  });
                  setShowModal(true);
                }}
              >
                {t('common.edit')}
              </Button>
              <Button
                color="failure"
                size="sm"
                onClick={() => deleteBrand(brand.id).then(() => { toast.success(t('brandsList.toastDeleted')); load(); })}
              >
                {t('common.delete')}
              </Button>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl shadow md:block">
        <Table striped className="mobile-friendly-table">
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
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      color="gray"
                      size="sm"
                      onClick={() => {
                        setEditingBrandId(b.id);
                        setForm({
                          name: b.name || '',
                          description: b.description || '',
                          itemTypeId: b.itemTypeId || '',
                        });
                        setShowModal(true);
                      }}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button color="failure" size="sm" onClick={() => deleteBrand(b.id).then(() => { toast.success(t('brandsList.toastDeleted')); load(); })}>{t('common.delete')}</Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
      <Modal className="mobile-fullscreen-modal" show={showModal} onClose={() => setShowModal(false)}>
        <Modal.Header>{editingBrandId ? t('brandsList.modalEditTitle') : t('brandsList.modalTitle')}</Modal.Header>
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
