import { useEffect, useState } from 'react';
import { Button, TextInput, Table, Modal, Select } from 'flowbite-react';
import toast from 'react-hot-toast';
import VendorLayout from '../../components/layout/VendorLayout';
import { getMyVendor, updateMyVendor } from '../../api/vendors';
import type { Vendor } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { HiTruck } from 'react-icons/hi';

const vehicleTypeOptions = [
    { value: 'van', label: 'Van' },
    { value: 'truck', label: 'Truck' },
    { value: 'pickup', label: 'Pickup Truck' },
    { value: 'car', label: 'Car' },
    { value: 'motorcycle', label: 'Motorcycle' },
    { value: 'bicycle', label: 'Bicycle' },
    { value: 'walking', label: 'Walking Service' },
    { value: 'other', label: 'Other' },
];

interface Vehicle {
    type: string;
    description?: string;
}

export default function VendorDeliveryVehicles() {
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [loading, setLoading] = useState(true);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [form, setForm] = useState({ type: 'van', description: '' });
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({ type: 'van', description: '' });

    const loadVendor = async () => {
        try {
            const data = await getMyVendor();
            setVendor(data);
            setVehicles(data.deliveryVehicles || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadVendor();
    }, []);

    const handleAdd = async () => {
        if (!vendor) return;
        const newVehicles = [...vehicles, { type: form.type, description: form.description || undefined }];
        try {
            await updateMyVendor({ deliveryVehicles: newVehicles });
            toast.success('Delivery vehicle added!');
            setVehicles(newVehicles);
            setVendor((current) =>
                current
                    ? { ...current, deliveryVehicles: newVehicles }
                    : current,
            );
            setForm({ type: 'van', description: '' });
        } catch (err) {
            toast.error('Failed to add vehicle');
        }
    };

    const handleDelete = async (index: number) => {
        if (!vendor) return;
        const newVehicles = vehicles.filter((_, i) => i !== index);
        try {
            await updateMyVendor({ deliveryVehicles: newVehicles });
            toast.success('Vehicle removed!');
            setVehicles(newVehicles);
            setVendor((current) =>
                current
                    ? { ...current, deliveryVehicles: newVehicles }
                    : current,
            );
        } catch (err) {
            toast.error('Failed to remove vehicle');
        }
    };

    const openEditModal = (vehicle: Vehicle, index: number) => {
        setEditingIndex(index);
        setEditForm({ type: vehicle.type, description: vehicle.description || '' });
    };

    const closeEditModal = () => {
        setEditingIndex(null);
        setEditForm({ type: 'van', description: '' });
    };

    const handleUpdate = async () => {
        if (!vendor || editingIndex === null) return;

        const newVehicles = vehicles.map((v, i) =>
            i === editingIndex
                ? { type: editForm.type, description: editForm.description || undefined }
                : v
        );

        try {
            await updateMyVendor({ deliveryVehicles: newVehicles });
            toast.success('Vehicle updated!');
            setVehicles(newVehicles);
            setVendor((current) =>
                current
                    ? { ...current, deliveryVehicles: newVehicles }
                    : current,
            );
            closeEditModal();
        } catch (err) {
            toast.error('Failed to update vehicle');
        }
    };

    if (loading) return <VendorLayout><LoadingSpinner /></VendorLayout>;

    const getVehicleLabel = (type: string) => {
        return vehicleTypeOptions.find((opt) => opt.value === type)?.label || type;
    };

    return (
        <VendorLayout>
            <h1 className="mb-6 inline-flex items-center gap-2 text-4xl font-bold text-gray-900">
                <HiTruck className="h-9 w-9 text-slate-700" aria-hidden="true" />
                Delivery Vehicles
            </h1>
            <p className="text-gray-600 mb-6">Manage the vehicles you use for deliveries. This helps customers understand your delivery capabilities.</p>

            <div className="bg-white rounded-2xl shadow p-6 mb-6">
                <h2 className="text-2xl font-bold mb-4">Add Delivery Vehicle</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} sizing="lg">
                        {vehicleTypeOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </Select>
                    <TextInput
                        type="text"
                        placeholder="Optional description (e.g., '2-ton capacity')"
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        sizing="lg"
                    />
                    <Button size="lg" onClick={handleAdd}>
                        + Add Vehicle
                    </Button>
                </div>
            </div>

            {vehicles.length === 0 ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                    <p className="text-gray-600">No delivery vehicles added yet. Add your first vehicle to help customers understand your delivery capabilities.</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl shadow">
                    <Table striped className="mobile-friendly-table">
                        <Table.Head>
                            <Table.HeadCell className="text-lg">Vehicle Type</Table.HeadCell>
                            <Table.HeadCell className="text-lg">Description</Table.HeadCell>
                            <Table.HeadCell className="text-lg">Actions</Table.HeadCell>
                        </Table.Head>
                        <Table.Body>
                            {vehicles.map((vehicle, index) => (
                                <Table.Row key={index} className="text-lg">
                                    <Table.Cell className="font-semibold">{getVehicleLabel(vehicle.type)}</Table.Cell>
                                    <Table.Cell>{vehicle.description || '-'}</Table.Cell>
                                    <Table.Cell>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                color="light"
                                                size="sm"
                                                onClick={() => openEditModal(vehicle, index)}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                color="failure"
                                                size="sm"
                                                onClick={() => handleDelete(index)}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </div>
            )}

            <Modal className="mobile-fullscreen-modal" show={editingIndex !== null} onClose={closeEditModal} size="lg">
                <Modal.Header>Edit Delivery Vehicle</Modal.Header>
                <Modal.Body>
                    <div className="grid grid-cols-1 gap-4">
                        <Select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} sizing="lg">
                            {vehicleTypeOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </Select>
                        <TextInput
                            type="text"
                            placeholder="Optional description"
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            sizing="lg"
                        />
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button size="lg" onClick={handleUpdate}>
                        Save
                    </Button>
                    <Button color="gray" size="lg" onClick={closeEditModal}>
                        Cancel
                    </Button>
                </Modal.Footer>
            </Modal>
        </VendorLayout>
    );
}
