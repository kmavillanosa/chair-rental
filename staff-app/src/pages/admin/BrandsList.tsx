import { useEffect, useState } from 'react';
import { Button, Table, Modal, TextInput, Select } from 'flowbite-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import { getBrands, createBrand, deleteBrand, getItemTypes, updateBrand } from '../../api/items';
import type { ProductBrand, ItemType } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function BrandsList() {
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
      toast.error('Brand name and item type are required.');
      return;
    }

    if (editingBrandId) {
      await updateBrand(editingBrandId, form);
      toast.success('Brand updated!');
    } else {
      await createBrand(form);
      toast.success('Brand created!');
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
        <h1 className="text-4xl font-bold text-slate-900">Brands</h1>
        <Button
          size="xl"
          className="!bg-slate-800 hover:!bg-slate-900"
          onClick={() => {
            setEditingBrandId(null);
            setForm({ name: '', description: '', itemTypeId: '' });
            setShowModal(true);
          }}
        >
          + Add Brand
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl shadow">
        <Table striped className="mobile-friendly-table">
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
                      Edit
                    </Button>
                    <Button color="light" size="sm" className="!border-rose-200 !bg-rose-50 !text-rose-700 hover:!bg-rose-100" onClick={() => deleteBrand(b.id).then(() => { toast.success('Deleted!'); load(); })}>Delete</Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
      <Modal show={showModal} onClose={() => setShowModal(false)}>
        <Modal.Header>{editingBrandId ? 'Edit Brand' : 'Add Brand'}</Modal.Header>
        <Modal.Body className="space-y-4">
          <TextInput placeholder="Brand Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} sizing="lg" />
          <TextInput placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} sizing="lg" />
          <Select value={form.itemTypeId} onChange={e => setForm(f => ({ ...f, itemTypeId: e.target.value }))}>
            <option value="">Select Item Type</option>
            {itemTypes.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
          </Select>
        </Modal.Body>
        <Modal.Footer>
          <Button size="xl" className="!bg-slate-800 hover:!bg-slate-900" onClick={handleSubmit}>Save</Button>
          <Button color="gray" size="xl" onClick={() => setShowModal(false)}>Cancel</Button>
        </Modal.Footer>
      </Modal>
    </AdminLayout>
  );
}
