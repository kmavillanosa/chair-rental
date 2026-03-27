import { useEffect, useState } from 'react';
import { Button, TextInput, Table, Modal } from 'flowbite-react';
import toast from 'react-hot-toast';
import VendorLayout from '../../components/layout/VendorLayout';
import { getDeliveryRates, addDeliveryRate, updateDeliveryRate, deleteDeliveryRate } from '../../api/payments';
import type { DeliveryRate } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency } from '../../utils/format';

export default function HelperPricing() {
    const [rates, setRates] = useState<DeliveryRate[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ helpersCount: '1', chargeAmount: '' });
    const [editingRate, setEditingRate] = useState<DeliveryRate | null>(null);
    const [editForm, setEditForm] = useState({ helpersCount: '1', chargeAmount: '' });

    const load = () => getDeliveryRates().then(setRates).finally(() => setLoading(false));
    useEffect(() => { load(); }, []);

    const handleAdd = async () => {
        await addDeliveryRate({ distanceKm: 0, chargeAmount: Number(form.chargeAmount), helpersCount: Number(form.helpersCount) });
        toast.success('Helper pricing added!');
        setForm({ helpersCount: '1', chargeAmount: '' });
        load();
    };

    const openEditModal = (rate: DeliveryRate) => {
        setEditingRate(rate);
        setEditForm({
            helpersCount: String(rate.helpersCount),
            chargeAmount: String(rate.chargeAmount),
        });
    };

    const closeEditModal = () => {
        setEditingRate(null);
        setEditForm({ helpersCount: '1', chargeAmount: '' });
    };

    const handleUpdate = async () => {
        if (!editingRate) return;

        await updateDeliveryRate(editingRate.id, {
            distanceKm: 0,
            chargeAmount: Number(editForm.chargeAmount),
            helpersCount: Number(editForm.helpersCount),
        });

        toast.success('Helper pricing updated!');
        closeEditModal();
        load();
    };

    if (loading) return <VendorLayout><LoadingSpinner /></VendorLayout>;

    // Only show rates with helper count > 0
    const helperRates = rates.filter(r => r.helpersCount > 0);

    return (
        <VendorLayout>
            <h1 className="text-4xl font-bold text-gray-900 mb-6">👥 Helper Pricing</h1>
            <p className="text-gray-600 mb-6">Set your charges for providing additional helpers during delivery. Customers can request helpers when booking.</p>

            <div className="bg-white rounded-2xl shadow p-6 mb-6">
                <h2 className="text-2xl font-bold mb-4">Add Helper Pricing Tier</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <TextInput type="number" placeholder="# of Helpers" value={form.helpersCount} onChange={e => setForm(f => ({ ...f, helpersCount: e.target.value }))} sizing="lg" min="1" />
                    <TextInput type="number" placeholder="Charge (₱)" value={form.chargeAmount} onChange={e => setForm(f => ({ ...f, chargeAmount: e.target.value }))} sizing="lg" />
                    <div className="flex gap-2">
                        <Button size="lg" onClick={handleAdd} className="flex-1">+ Add Tier</Button>
                    </div>
                </div>
            </div>

            {helperRates.length === 0 ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                    <p className="text-gray-600">No helper pricing tiers added yet. Add tiers if you want to offer helper services to customers.</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl shadow">
                    <Table striped className="mobile-friendly-table">
                        <Table.Head>
                            <Table.HeadCell className="text-lg">Number of Helpers</Table.HeadCell>
                            <Table.HeadCell className="text-lg">Helper Charge</Table.HeadCell>
                            <Table.HeadCell className="text-lg">Actions</Table.HeadCell>
                        </Table.Head>
                        <Table.Body>
                            {helperRates.sort((a, b) => a.helpersCount - b.helpersCount).map(r => (
                                <Table.Row key={r.id} className="text-lg">
                                    <Table.Cell>{r.helpersCount} helper{r.helpersCount !== 1 ? 's' : ''}</Table.Cell>
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
                <Modal.Header>Edit Helper Pricing Tier</Modal.Header>
                <Modal.Body>
                    <div className="grid grid-cols-1 gap-4">
                        <TextInput type="number" placeholder="# of Helpers" value={editForm.helpersCount} onChange={e => setEditForm(f => ({ ...f, helpersCount: e.target.value }))} sizing="lg" min="1" />
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
