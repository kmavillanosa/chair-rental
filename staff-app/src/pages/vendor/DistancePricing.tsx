import { useEffect, useState } from 'react';
import { Button, TextInput, Table, Modal } from 'flowbite-react';
import toast from 'react-hot-toast';
import VendorLayout from '../../components/layout/VendorLayout';
import { getDeliveryRates, addDeliveryRate, updateDeliveryRate, deleteDeliveryRate } from '../../api/payments';
import type { DeliveryRate } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency } from '../../utils/format';

export default function DistancePricing() {
    const [rates, setRates] = useState<DeliveryRate[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ distanceKm: '', chargeAmount: '' });
    const [editingRate, setEditingRate] = useState<DeliveryRate | null>(null);
    const [editForm, setEditForm] = useState({ distanceKm: '', chargeAmount: '' });

    const load = () => getDeliveryRates().then(setRates).finally(() => setLoading(false));
    useEffect(() => { load(); }, []);

    const handleAdd = async () => {
        await addDeliveryRate({ distanceKm: Number(form.distanceKm), chargeAmount: Number(form.chargeAmount), helpersCount: 0 });
        toast.success('Distance pricing added!');
        setForm({ distanceKm: '', chargeAmount: '' });
        load();
    };

    const openEditModal = (rate: DeliveryRate) => {
        setEditingRate(rate);
        setEditForm({
            distanceKm: String(rate.distanceKm),
            chargeAmount: String(rate.chargeAmount),
        });
    };

    const closeEditModal = () => {
        setEditingRate(null);
        setEditForm({ distanceKm: '', chargeAmount: '' });
    };

    const handleUpdate = async () => {
        if (!editingRate) return;

        await updateDeliveryRate(editingRate.id, {
            distanceKm: Number(editForm.distanceKm),
            chargeAmount: Number(editForm.chargeAmount),
            helpersCount: 0,
        });

        toast.success('Distance pricing updated!');
        closeEditModal();
        load();
    };

    if (loading) return <VendorLayout><LoadingSpinner /></VendorLayout>;

    return (
        <VendorLayout>
            <h1 className="text-4xl font-bold text-gray-900 mb-6">📍 Distance Pricing</h1>
            <p className="text-gray-600 mb-6">Set your delivery charges based on distance. Customers will be quoted based on the distance to their delivery location.</p>

            <div className="bg-white rounded-2xl shadow p-6 mb-6">
                <h2 className="text-2xl font-bold mb-4">Add Distance Tier</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <TextInput type="number" placeholder="Distance (km)" value={form.distanceKm} onChange={e => setForm(f => ({ ...f, distanceKm: e.target.value }))} sizing="lg" />
                    <TextInput type="number" placeholder="Charge (₱)" value={form.chargeAmount} onChange={e => setForm(f => ({ ...f, chargeAmount: e.target.value }))} sizing="lg" />
                    <div className="flex gap-2">
                        <Button size="lg" onClick={handleAdd} className="flex-1">+ Add Tier</Button>
                    </div>
                </div>
            </div>

            {rates.filter(r => r.helpersCount === 0).length === 0 ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                    <p className="text-gray-600">No distance pricing tiers added yet. Add your first tier to enable booking.</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl shadow">
                    <Table striped>
                        <Table.Head>
                            <Table.HeadCell className="text-lg">Distance (km)</Table.HeadCell>
                            <Table.HeadCell className="text-lg">Delivery Charge</Table.HeadCell>
                            <Table.HeadCell className="text-lg">Actions</Table.HeadCell>
                        </Table.Head>
                        <Table.Body>
                            {rates.filter(r => r.helpersCount === 0).map(r => (
                                <Table.Row key={r.id} className="text-lg">
                                    <Table.Cell>Up to {r.distanceKm} km</Table.Cell>
                                    <Table.Cell className="font-semibold">{formatCurrency(r.chargeAmount)}</Table.Cell>
                                    <Table.Cell>
                                        <div className="flex items-center gap-2">
                                            <Button color="light" size="sm" onClick={() => openEditModal(r)}>Edit</Button>
                                            <Button color="failure" size="sm" onClick={() => deleteDeliveryRate(r.id).then(() => { toast.success('Deleted!'); load(); })}>Delete</Button>
                                        </div>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </div>
            )}

            <Modal show={Boolean(editingRate)} onClose={closeEditModal} size="lg">
                <Modal.Header>Edit Distance Tier</Modal.Header>
                <Modal.Body>
                    <div className="grid grid-cols-1 gap-4">
                        <TextInput type="number" placeholder="Distance (km)" value={editForm.distanceKm} onChange={e => setEditForm(f => ({ ...f, distanceKm: e.target.value }))} sizing="lg" />
                        <TextInput type="number" placeholder="Charge (₱)" value={editForm.chargeAmount} onChange={e => setEditForm(f => ({ ...f, chargeAmount: e.target.value }))} sizing="lg" />
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button size="lg" onClick={handleUpdate}>Save</Button>
                    <Button color="gray" size="lg" onClick={closeEditModal}>Cancel</Button>
                </Modal.Footer>
            </Modal>
        </VendorLayout>
    );
}
