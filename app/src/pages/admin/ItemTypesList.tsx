import { useEffect, useState } from 'react';
import { Button, Table, Modal, TextInput, Textarea } from 'flowbite-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import { getItemTypes, createItemType, deleteItemType } from '../../api/items';
import type { ItemType } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function ItemTypesList() {
  const [items, setItems] = useState<ItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', defaultRatePerDay: '' });
  const [picture, setPicture] = useState<File | null>(null);

  const load = () => getItemTypes().then(setItems).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    const fd = new FormData();
    fd.append('name', form.name);
    fd.append('description', form.description);
    fd.append('defaultRatePerDay', form.defaultRatePerDay);
    if (picture) fd.append('picture', picture);
    await createItemType(fd);
    toast.success('Item type created!');
    setShowModal(false);
    setForm({ name: '', description: '', defaultRatePerDay: '' });
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteItemType(id);
    toast.success('Deleted!');
    load();
  };

  if (loading) return <AdminLayout><LoadingSpinner /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-gray-900">📦 Item Types</h1>
        <Button size="xl" onClick={() => setShowModal(true)}>+ Add Item Type</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map(item => (
          <div key={item.id} className="bg-white rounded-2xl shadow p-6">
            {item.pictureUrl && (
              <img src={item.pictureUrl} alt={item.name} className="w-full h-40 object-cover rounded-xl mb-4" />
            )}
            <h3 className="text-xl font-bold">{item.name}</h3>
            <p className="text-gray-500">{item.description}</p>
            <p className="text-blue-600 font-semibold mt-2">₱{item.defaultRatePerDay}/day</p>
            <Button color="failure" size="sm" className="mt-3" onClick={() => handleDelete(item.id)}>Delete</Button>
          </div>
        ))}
      </div>
      <Modal show={showModal} onClose={() => setShowModal(false)} size="lg">
        <Modal.Header>Add Item Type</Modal.Header>
        <Modal.Body className="space-y-4">
          <TextInput placeholder="Name (e.g. Monobloc Chair)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} sizing="lg" />
          <Textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
          <TextInput type="number" placeholder="Default Rate per Day (₱)" value={form.defaultRatePerDay} onChange={e => setForm(f => ({ ...f, defaultRatePerDay: e.target.value }))} sizing="lg" />
          <input type="file" accept="image/*" onChange={e => setPicture(e.target.files?.[0] || null)} className="text-lg" />
        </Modal.Body>
        <Modal.Footer>
          <Button size="xl" onClick={handleSubmit}>Save</Button>
          <Button color="gray" size="xl" onClick={() => setShowModal(false)}>Cancel</Button>
        </Modal.Footer>
      </Modal>
    </AdminLayout>
  );
}
