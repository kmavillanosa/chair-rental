import { useEffect, useState } from 'react';
import { Button, Modal, TextInput, Textarea } from 'flowbite-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import {
  getAdminItemTypes,
  createItemType,
  deleteItemType,
  updateItemType,
} from '../../api/items';
import type { ItemType } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useTranslation } from 'react-i18next';

interface ItemTypeForm {
  name: string;
  description: string;
  defaultRatePerDay: string;
  isActive: boolean;
}

const EMPTY_FORM: ItemTypeForm = {
  name: '',
  description: '',
  defaultRatePerDay: '0',
  isActive: true,
};

export default function ItemTypesList() {
  const { t } = useTranslation();
  const [items, setItems] = useState<ItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemType | null>(null);
  const [form, setForm] = useState<ItemTypeForm>(EMPTY_FORM);
  const [picture, setPicture] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => getAdminItemTypes().then(setItems).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setPicture(null);
    setShowModal(true);
  };

  const openEdit = (item: ItemType) => {
    setEditingItem(item);
    setForm({
      name: item.name || '',
      description: item.description || '',
      defaultRatePerDay: String(item.defaultRatePerDay ?? 0),
      isActive: item.isActive,
    });
    setPicture(null);
    setShowModal(true);
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    description: form.description.trim(),
    defaultRatePerDay: Number(form.defaultRatePerDay) || 0,
    isActive: form.isActive,
  });

  const buildFormData = (payload: ReturnType<typeof buildPayload>, image?: File | null) => {
    const fd = new FormData();
    fd.append('name', payload.name);
    fd.append('description', payload.description);
    fd.append('defaultRatePerDay', String(payload.defaultRatePerDay));
    fd.append('isActive', payload.isActive ? '1' : '0');
    if (image) fd.append('picture', image);
    return fd;
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t('itemTypesList.itemTypeNameRequired'));
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();

      if (editingItem) {
        if (picture) {
          await updateItemType(editingItem.id, buildFormData(payload, picture));
        } else {
          await updateItemType(editingItem.id, payload);
        }
        toast.success(t('itemTypesList.toastUpdated'));
      } else {
        await createItemType(buildFormData(payload, picture));
        toast.success(t('itemTypesList.toastCreated'));
      }

      setShowModal(false);
      setEditingItem(null);
      setForm(EMPTY_FORM);
      setPicture(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: ItemType) => {
    await updateItemType(item.id, { isActive: !item.isActive });
    toast.success(t('itemTypesList.toastToggled', {
      name: item.name,
      state: item.isActive ? t('itemTypesList.stateDisabled') : t('itemTypesList.stateEnabled'),
    }));
    load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('itemTypesList.deleteConfirm'))) return;
    await deleteItemType(id);
    toast.success(t('itemTypesList.toastDeleted'));
    load();
  };

  if (loading) return <AdminLayout><LoadingSpinner /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-gray-900">📦 {t('itemTypesList.title')}</h1>
        <Button size="xl" onClick={openCreate}>+ {t('itemTypesList.addItemType')}</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map(item => (
          <div key={item.id} className="bg-white rounded-2xl shadow p-6">
            {item.pictureUrl && (
              <img src={item.pictureUrl} alt={item.name} className="w-full h-40 object-cover rounded-xl mb-4" />
            )}
            <h3 className="text-xl font-bold">{item.name}</h3>
            <p className="text-gray-500">{item.description}</p>
            <p className="text-blue-600 font-semibold mt-2">PHP {item.defaultRatePerDay}/day</p>
            <p className="text-xs text-gray-500 mt-1">{t('itemTypesList.basePriceHint')}</p>
            <div className="mt-3">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                }`}>
                {item.isActive ? t('status.toggle.enabled') : t('status.toggle.disabled')}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                color={item.isActive ? 'warning' : 'success'}
                size="sm"
                onClick={() => handleToggleActive(item)}
              >
                {item.isActive ? t('itemTypesList.disable') : t('itemTypesList.enable')}
              </Button>
              <Button color="light" size="sm" onClick={() => openEdit(item)}>{t('common.edit')}</Button>
              <Button color="failure" size="sm" onClick={() => handleDelete(item.id)}>{t('common.delete')}</Button>
            </div>
          </div>
        ))}
      </div>

      <Modal show={showModal} onClose={() => setShowModal(false)} size="lg">
        <Modal.Header>{editingItem ? t('itemTypesList.modalEditItemType') : t('itemTypesList.modalAddItemType')}</Modal.Header>
        <Modal.Body className="space-y-4">
          <TextInput placeholder={t('itemTypesList.namePlaceholder')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} sizing="lg" />
          <Textarea placeholder={t('itemTypesList.descriptionPlaceholder')} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
          <TextInput type="number" placeholder={t('itemTypesList.defaultRatePlaceholder')} value={form.defaultRatePerDay} onChange={e => setForm(f => ({ ...f, defaultRatePerDay: e.target.value }))} sizing="lg" />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="h-4 w-4"
            />
            {t('itemTypesList.activeToggleLabel')}
          </label>
          {editingItem?.pictureUrl && !picture && (
            <img src={editingItem.pictureUrl} alt={editingItem.name} className="h-36 w-full rounded-xl object-cover" />
          )}
          <input type="file" accept="image/*" onChange={e => setPicture(e.target.files?.[0] || null)} className="text-lg" />
          {picture && <p className="text-sm text-gray-500">{picture.name}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button size="xl" onClick={handleSave} isProcessing={saving} disabled={saving}>{t('common.save')}</Button>
          <Button color="gray" size="xl" onClick={() => setShowModal(false)}>{t('common.cancel')}</Button>
        </Modal.Footer>
      </Modal>
    </AdminLayout>
  );
}
