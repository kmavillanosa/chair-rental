import { useEffect, useState } from 'react';
import { Button, Table, Modal, TextInput, Select } from 'flowbite-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import { getBrands, createBrand, deleteBrand, getItemTypes } from '../../api/items';
import type { ProductBrand, ItemType } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function BrandsList() {
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
    toast.success('Brand created!');
    setShowModal(false);
    load();
  };

  if (loading) return <AdminLayout><LoadingSpinner /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-gray-900">🏷️ Brands</h1>
        <Button size="xl" onClick={() => setShowModal(true)}>+ Add Brand</Button>
      </div>
      <div className="overflow-x-auto rounded-xl shadow">
        <Table striped>
          <Table.Head>
            <Table.HeadCell className="text-lg">Brand</Table.HeadCell>
            <Table.HeadCell className="text-lg">Item Type</Table.HeadCell>
            <Table.HeadCell className="text-lg">Actions</Table.HeadCell>
          </Table.Head>
          <Table.Body>
            {brands.map(b => (
              <Table.Row key={b.id} className="text-lg">
                <Table.Cell className="font-semibold">{b.name}</Table.Cell>
                <Table.Cell>{b.itemType?.name}</Table.Cell>
                <Table.Cell>
                  <Button color="failure" size="sm" onClick={() => deleteBrand(b.id).then(() => { toast.success('Deleted!'); load(); })}>Delete</Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
      <Modal show={showModal} onClose={() => setShowModal(false)}>
        <Modal.Header>Add Brand</Modal.Header>
        <Modal.Body className="space-y-4">
          <TextInput placeholder="Brand Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} sizing="lg" />
          <TextInput placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} sizing="lg" />
          <Select value={form.itemTypeId} onChange={e => setForm(f => ({ ...f, itemTypeId: e.target.value }))}>
            <option value="">Select Item Type</option>
            {itemTypes.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
          </Select>
        </Modal.Body>
        <Modal.Footer>
          <Button size="xl" onClick={handleSubmit}>Save</Button>
          <Button color="gray" size="xl" onClick={() => setShowModal(false)}>Cancel</Button>
        </Modal.Footer>
      </Modal>
    </AdminLayout>
  );
}
