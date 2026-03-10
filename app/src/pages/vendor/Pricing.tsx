import { useEffect, useState } from 'react';
import { Button, TextInput, Table } from 'flowbite-react';
import toast from 'react-hot-toast';
import VendorLayout from '../../components/layout/VendorLayout';
import { getDeliveryRates, addDeliveryRate, deleteDeliveryRate } from '../../api/payments';
import type { DeliveryRate } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency } from '../../utils/format';

export default function Pricing() {
  const [rates, setRates] = useState<DeliveryRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ distanceKm: '', chargeAmount: '', helpersCount: '1' });

  const load = () => getDeliveryRates().then(setRates).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    await addDeliveryRate({ distanceKm: Number(form.distanceKm), chargeAmount: Number(form.chargeAmount), helpersCount: Number(form.helpersCount) });
    toast.success('Delivery rate added!');
    setForm({ distanceKm: '', chargeAmount: '', helpersCount: '1' });
    load();
  };

  if (loading) return <VendorLayout><LoadingSpinner /></VendorLayout>;

  return (
    <VendorLayout>
      <h1 className="text-4xl font-bold text-gray-900 mb-6">💵 Delivery Pricing</h1>
      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">Add Delivery Rate</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <TextInput type="number" placeholder="Distance (km)" value={form.distanceKm} onChange={e => setForm(f => ({ ...f, distanceKm: e.target.value }))} sizing="lg" />
          <TextInput type="number" placeholder="Charge (₱)" value={form.chargeAmount} onChange={e => setForm(f => ({ ...f, chargeAmount: e.target.value }))} sizing="lg" />
          <TextInput type="number" placeholder="# Helpers" value={form.helpersCount} onChange={e => setForm(f => ({ ...f, helpersCount: e.target.value }))} sizing="lg" />
        </div>
        <Button size="xl" onClick={handleAdd}>+ Add Rate</Button>
      </div>
      <div className="overflow-x-auto rounded-xl shadow">
        <Table striped>
          <Table.Head>
            <Table.HeadCell className="text-lg">Distance (km)</Table.HeadCell>
            <Table.HeadCell className="text-lg">Charge</Table.HeadCell>
            <Table.HeadCell className="text-lg">Helpers</Table.HeadCell>
            <Table.HeadCell className="text-lg">Actions</Table.HeadCell>
          </Table.Head>
          <Table.Body>
            {rates.map(r => (
              <Table.Row key={r.id} className="text-lg">
                <Table.Cell>Up to {r.distanceKm} km</Table.Cell>
                <Table.Cell className="font-semibold">{formatCurrency(r.chargeAmount)}</Table.Cell>
                <Table.Cell>{r.helpersCount} helper(s)</Table.Cell>
                <Table.Cell>
                  <Button color="failure" size="sm" onClick={() => deleteDeliveryRate(r.id).then(() => { toast.success('Deleted!'); load(); })}>Delete</Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </VendorLayout>
  );
}
