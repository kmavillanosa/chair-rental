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
      toast.error('Item type name is required.');
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
        toast.success('Item type updated.');
      } else {
        await createItemType(buildFormData(payload, picture));
        toast.success('Item type created.');
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
    toast.success(`${item.name} ${item.isActive ? 'disabled' : 'enabled'}.`);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this item type permanently?')) return;
    await deleteItemType(id);
    toast.success('Item type deleted.');
    load();
  };

  if (loading) return <AdminLayout><LoadingSpinner /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-slate-900">Item Types</h1>
        <Button size="xl" className="!bg-slate-800 hover:!bg-slate-900" onClick={openCreate}>+ Add Item Type</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map(item => (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {item.pictureUrl && (
              <img src={item.pictureUrl} alt={item.name} className="w-full h-40 object-cover rounded-xl mb-4" />
            )}
            <h3 className="text-xl font-bold">{item.name}</h3>
            <p className="text-slate-600">{item.description}</p>
            <p className="mt-2 font-semibold text-slate-800">PHP {item.defaultRatePerDay}/day</p>
            <p className="mt-1 text-xs text-slate-500">Base price only. Rental partners can override this in their inventory.</p>
            <div className="mt-3">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-700'
                }`}>
                {item.isActive ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                color="light"
                size="sm"
                className={item.isActive ? '!border-amber-200 !bg-amber-50 !text-amber-800 hover:!bg-amber-100' : '!border-emerald-200 !bg-emerald-50 !text-emerald-800 hover:!bg-emerald-100'}
                onClick={() => handleToggleActive(item)}
              >
                {item.isActive ? 'Disable' : 'Enable'}
              </Button>
              <Button color="light" size="sm" className="!border-slate-300 !text-slate-700 hover:!bg-slate-100" onClick={() => openEdit(item)}>Edit</Button>
              <Button color="light" size="sm" className="!border-rose-200 !bg-rose-50 !text-rose-700 hover:!bg-rose-100" onClick={() => handleDelete(item.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>

      <Modal className="mobile-fullscreen-modal" show={showModal} onClose={() => setShowModal(false)} size="lg">
        <Modal.Header>{editingItem ? 'Edit Item Type' : 'Add Item Type'}</Modal.Header>
        <Modal.Body className="space-y-4">
          <TextInput placeholder="Name (e.g. Monobloc Chair)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} sizing="lg" />
          <Textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
          <TextInput type="number" placeholder="Default Rate per Day (₱)" value={form.defaultRatePerDay} onChange={e => setForm(f => ({ ...f, defaultRatePerDay: e.target.value }))} sizing="lg" />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="h-4 w-4"
            />
            Enabled for rental partners and customer search
          </label>
          {editingItem?.pictureUrl && !picture && (
            <img src={editingItem.pictureUrl} alt={editingItem.name} className="h-36 w-full rounded-xl object-cover" />
          )}
          <input type="file" accept="image/*" onChange={e => setPicture(e.target.files?.[0] || null)} className="text-lg" />
          {picture && <p className="text-sm text-gray-500">{picture.name}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button size="xl" className="!bg-slate-800 hover:!bg-slate-900" onClick={handleSave} isProcessing={saving} disabled={saving}>Save</Button>
          <Button color="gray" size="xl" onClick={() => setShowModal(false)}>Cancel</Button>
        </Modal.Footer>
      </Modal>
    </AdminLayout>
  );
}
