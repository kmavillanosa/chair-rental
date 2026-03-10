import { useEffect, useState } from 'react';
import { Button, Modal, TextInput, Select } from 'flowbite-react';
import toast from 'react-hot-toast';
import VendorLayout from '../../components/layout/VendorLayout';
import { getInventory, createInventoryItem, deleteInventoryItem } from '../../api/items';
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
  const [form, setForm] = useState({ itemTypeId: '', brandId: '', quantity: '', ratePerDay: '', condition: '' });

  const load = async () => {
    const v = await getMyVendor();
    setVendorId(v.id);
    const [inv, it, b] = await Promise.all([getInventory(v.id), getItemTypes(), getBrands()]);
    setItems(inv); setItemTypes(it); setBrands(b);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    await createInventoryItem({ ...form, vendorId, quantity: Number(form.quantity), ratePerDay: Number(form.ratePerDay) });
    toast.success('Item added!');
    setShowModal(false);
    load();
  };

  if (loading) return <VendorLayout><LoadingSpinner /></VendorLayout>;

  return (
    <VendorLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-gray-900">📦 My Inventory</h1>
        <Button size="xl" onClick={() => setShowModal(true)}>+ Add Item</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map(item => (
          <div key={item.id} className="bg-white rounded-2xl shadow p-6">
            <h3 className="text-xl font-bold">{item.itemType?.name}</h3>
            <p className="text-gray-500">{item.brand?.name}</p>
            <div className="mt-3 space-y-1 text-lg">
              <p>📦 Total: <strong>{item.quantity}</strong></p>
              <p>✅ Available: <strong className="text-green-600">{item.availableQuantity}</strong></p>
              <p>💵 Rate: <strong>{formatCurrency(item.ratePerDay)}/day</strong></p>
              {item.condition && <p>🔧 Condition: {item.condition}</p>}
            </div>
            <Button color="failure" size="sm" className="mt-4" onClick={() => deleteInventoryItem(item.id).then(() => { toast.success('Removed!'); load(); })}>Remove</Button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xl text-gray-400 col-span-3 text-center py-12">No items yet. Add your first item!</p>}
      </div>
      <Modal show={showModal} onClose={() => setShowModal(false)} size="lg">
        <Modal.Header>Add Inventory Item</Modal.Header>
        <Modal.Body className="space-y-4">
          <Select value={form.itemTypeId} onChange={e => setForm(f => ({ ...f, itemTypeId: e.target.value }))}>
            <option value="">Select Item Type</option>
            {itemTypes.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
          </Select>
          <Select value={form.brandId} onChange={e => setForm(f => ({ ...f, brandId: e.target.value }))}>
            <option value="">Select Brand (optional)</option>
            {brands.filter(b => !form.itemTypeId || b.itemTypeId === form.itemTypeId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <TextInput type="number" placeholder="Quantity" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} sizing="lg" />
          <TextInput type="number" placeholder="Rate per Day (₱)" value={form.ratePerDay} onChange={e => setForm(f => ({ ...f, ratePerDay: e.target.value }))} sizing="lg" />
          <TextInput placeholder="Condition (e.g. Good, Excellent)" value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} sizing="lg" />
        </Modal.Body>
        <Modal.Footer>
          <Button size="xl" onClick={handleSubmit}>Add Item</Button>
          <Button color="gray" size="xl" onClick={() => setShowModal(false)}>Cancel</Button>
        </Modal.Footer>
      </Modal>
    </VendorLayout>
  );
}
