import { useEffect, useState } from 'react';
import { Button, Modal, TextInput, Select } from 'flowbite-react';
import toast from 'react-hot-toast';
import VendorLayout from '../../components/layout/VendorLayout';
import { getInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem } from '../../api/items';
import { getItemTypes, getBrands } from '../../api/items';
import { getMyVendor } from '../../api/vendors';
import type { InventoryItem, ItemType, ProductBrand } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency } from '../../utils/format';

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [brands, setBrands] = useState<ProductBrand[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState({ itemTypeId: '', brandId: '', color: '', quantity: '', ratePerDay: '', condition: '' });
  const [editForm, setEditForm] = useState({ itemTypeId: '', brandId: '', color: '', quantity: '', ratePerDay: '', condition: '' });
  const selectedItemType = itemTypes.find((itemType) => itemType.id === form.itemTypeId);
  const selectedEditItemType = itemTypes.find((itemType) => itemType.id === editForm.itemTypeId);

  const load = async () => {
    const v = await getMyVendor();
    setVendorId(v.id);
    const [inv, it, b] = await Promise.all([getInventory(v.id), getItemTypes(), getBrands()]);
    setItems(inv); setItemTypes(it); setBrands(b);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    await createInventoryItem({
      ...form,
      vendorId,
      color: form.color.trim() || undefined,
      quantity: Number(form.quantity),
      ratePerDay: form.ratePerDay.trim() ? Number(form.ratePerDay) : undefined,
    });
    toast.success('Item added!');
    setShowModal(false);
    load();
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setEditForm({
      itemTypeId: item.itemTypeId,
      brandId: item.brandId || '',
      color: item.color || '',
      quantity: String(item.quantity),
      ratePerDay: String(item.ratePerDay),
      condition: item.condition || '',
    });
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setEditForm({ itemTypeId: '', brandId: '', color: '', quantity: '', ratePerDay: '', condition: '' });
  };

  const handleUpdate = async () => {
    if (!editingItem) return;

    await updateInventoryItem(editingItem.id, {
      itemTypeId: editForm.itemTypeId,
      brandId: editForm.brandId || undefined,
      color: editForm.color.trim() || undefined,
      quantity: Number(editForm.quantity),
      ratePerDay: editForm.ratePerDay.trim() ? Number(editForm.ratePerDay) : undefined,
      condition: editForm.condition.trim() || undefined,
    });

    toast.success('Item updated!');
    closeEditModal();
    load();
  };

  if (loading) return <VendorLayout><LoadingSpinner /></VendorLayout>;

  return (
    <VendorLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-gray-900">📦 My Inventory</h1>
        <Button size="lg" onClick={() => setShowModal(true)}>+ Add Item</Button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        {items.map(item => {
          const itemPictureUrl = item.pictureUrl || item.itemType?.pictureUrl;

          return (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              {itemPictureUrl && <img src={itemPictureUrl} alt={item.itemType?.name || 'Item'} className="mb-3 h-28 w-full rounded-lg bg-slate-50 p-1 object-contain" />}
              <h3 className="text-lg font-bold">{item.itemType?.name}</h3>
              <p className="text-sm text-gray-500">{item.brand?.name}</p>
              <div className="mt-2 space-y-0.5 text-base">
                {item.color && <p>🎨 Color: <strong>{item.color}</strong></p>}
                <p>📦 Total: <strong>{item.quantity}</strong></p>
                <p>✅ Available: <strong className="text-green-600">{item.availableQuantity}</strong></p>
                <p>💵 Rate: <strong>{formatCurrency(item.ratePerDay)}/day</strong></p>
                {item.condition && <p>🔧 Condition: {item.condition}</p>}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button color="light" size="sm" onClick={() => openEditModal(item)}>Edit</Button>
                <Button color="failure" size="sm" onClick={() => deleteInventoryItem(item.id).then(() => { toast.success('Removed!'); load(); })}>Remove</Button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <p className="col-span-full py-12 text-center text-xl text-gray-400">No items yet. Add your first item!</p>}
      </div>
      <Modal show={showModal} onClose={() => setShowModal(false)} size="lg">
        <Modal.Header>Add Inventory Item</Modal.Header>
        <Modal.Body className="space-y-4">
          <Select
            value={form.itemTypeId}
            onChange={(e) => {
              const nextItemTypeId = e.target.value;
              const nextItemType = itemTypes.find((itemType) => itemType.id === nextItemTypeId);
              setForm((current) => ({
                ...current,
                itemTypeId: nextItemTypeId,
                brandId: '',
                ratePerDay: nextItemType ? String(nextItemType.defaultRatePerDay ?? '') : current.ratePerDay,
              }));
            }}
          >
            <option value="">Select Item Type</option>
            {itemTypes.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
          </Select>
          {selectedItemType && (
            <p className="text-sm text-gray-600">
              Base price: <strong>{formatCurrency(selectedItemType.defaultRatePerDay)}</strong>/day. You may override this below.
            </p>
          )}
          {selectedItemType?.pictureUrl && (
            <img src={selectedItemType.pictureUrl} alt={selectedItemType.name} className="h-36 w-full rounded-xl bg-slate-50 p-1 object-contain" />
          )}
          <Select value={form.brandId} onChange={e => setForm(f => ({ ...f, brandId: e.target.value }))}>
            <option value="">Select Brand (optional)</option>
            {brands.filter(b => !form.itemTypeId || b.itemTypeId === form.itemTypeId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <TextInput placeholder="Color (e.g. Brown, White, Black)" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} sizing="lg" />
          <TextInput type="number" placeholder="Quantity" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} sizing="lg" />
          <TextInput
            type="number"
            placeholder="Rate per Day (₱, optional override)"
            value={form.ratePerDay}
            onChange={e => setForm(f => ({ ...f, ratePerDay: e.target.value }))}
            sizing="lg"
          />
          <TextInput placeholder="Condition (e.g. Good, Excellent)" value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} sizing="lg" />
        </Modal.Body>
        <Modal.Footer>
          <Button size="xl" onClick={handleSubmit}>Add Item</Button>
          <Button color="gray" size="xl" onClick={() => setShowModal(false)}>Cancel</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(editingItem)} onClose={closeEditModal} size="lg">
        <Modal.Header>Edit Inventory Item</Modal.Header>
        <Modal.Body className="space-y-4">
          <Select
            value={editForm.itemTypeId}
            onChange={(e) => {
              const nextItemTypeId = e.target.value;
              const nextItemType = itemTypes.find((itemType) => itemType.id === nextItemTypeId);
              setEditForm((current) => ({
                ...current,
                itemTypeId: nextItemTypeId,
                brandId: '',
                ratePerDay: nextItemType ? String(nextItemType.defaultRatePerDay ?? '') : current.ratePerDay,
              }));
            }}
          >
            <option value="">Select Item Type</option>
            {itemTypes.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
          </Select>
          {selectedEditItemType && (
            <p className="text-sm text-gray-600">
              Base price: <strong>{formatCurrency(selectedEditItemType.defaultRatePerDay)}</strong>/day. You may override this below.
            </p>
          )}
          {selectedEditItemType?.pictureUrl && (
            <img src={selectedEditItemType.pictureUrl} alt={selectedEditItemType.name} className="h-36 w-full rounded-xl bg-slate-50 p-1 object-contain" />
          )}
          <Select value={editForm.brandId} onChange={e => setEditForm(f => ({ ...f, brandId: e.target.value }))}>
            <option value="">Select Brand (optional)</option>
            {brands.filter(b => !editForm.itemTypeId || b.itemTypeId === editForm.itemTypeId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <TextInput placeholder="Color (e.g. Brown, White, Black)" value={editForm.color} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))} sizing="lg" />
          <TextInput type="number" placeholder="Quantity" value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} sizing="lg" />
          <TextInput
            type="number"
            placeholder="Rate per Day (P, optional override)"
            value={editForm.ratePerDay}
            onChange={e => setEditForm(f => ({ ...f, ratePerDay: e.target.value }))}
            sizing="lg"
          />
          <TextInput placeholder="Condition (e.g. Good, Excellent)" value={editForm.condition} onChange={e => setEditForm(f => ({ ...f, condition: e.target.value }))} sizing="lg" />
        </Modal.Body>
        <Modal.Footer>
          <Button size="xl" onClick={handleUpdate}>Save Item</Button>
          <Button color="gray" size="xl" onClick={closeEditModal}>Cancel</Button>
        </Modal.Footer>
      </Modal>
    </VendorLayout>
  );
}
