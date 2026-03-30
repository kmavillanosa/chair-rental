import { useEffect, useMemo, useState } from 'react';
import { Button, Modal, Table, TextInput, Textarea } from 'flowbite-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { getAdminItemTypes } from '../../api/items';
import {
    createAdminPackageTemplate,
    deleteAdminPackageTemplate,
    getAdminPackageTemplates,
    updateAdminPackageTemplate,
    type UpsertAdminPackageTemplatePayload,
} from '../../api/packages';
import type { AdminPackageTemplate, ItemType } from '../../types';

type PackageItemFormRow = {
    itemTypeId: string;
    itemTypeSearch: string;
    requiredQty: string;
    suggestedUnitPrice: string;
};

type PackageFormState = {
    code: string;
    name: string;
    description: string;
    isActive: boolean;
    items: PackageItemFormRow[];
};

const EMPTY_FORM: PackageFormState = {
    code: '',
    name: '',
    description: '',
    isActive: true,
    items: [{ itemTypeId: '', itemTypeSearch: '', requiredQty: '1', suggestedUnitPrice: '' }],
};

export default function PackagesList() {
    const [templates, setTemplates] = useState<AdminPackageTemplate[]>([]);
    const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<AdminPackageTemplate | null>(null);
    const [form, setForm] = useState<PackageFormState>(EMPTY_FORM);

    const itemTypeById = useMemo(
        () => new Map(itemTypes.map((itemType) => [itemType.id, itemType.name])),
        [itemTypes],
    );

    const load = async () => {
        setLoadError(null);

        try {
            const [packageTemplates, adminItemTypes] = await Promise.all([
                getAdminPackageTemplates(true),
                getAdminItemTypes(),
            ]);

            setTemplates(packageTemplates);
            setItemTypes(adminItemTypes);
        } catch (error: any) {
            const message =
                error?.response?.data?.message ||
                'Unable to load packages. Please check API deployment, migrations, and auth.';
            setLoadError(message);
            setTemplates([]);
            setItemTypes([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const openCreate = () => {
        setEditingTemplate(null);
        setForm(EMPTY_FORM);
        setShowModal(true);
    };

    const openEdit = (template: AdminPackageTemplate) => {
        setEditingTemplate(template);
        setForm({
            code: template.code,
            name: template.name,
            description: template.description || '',
            isActive: template.isActive,
            items: template.items.length
                ? template.items.map((item) => ({
                    itemTypeId: item.itemTypeId,
                    itemTypeSearch: item.itemType?.name || itemTypeById.get(item.itemTypeId) || '',
                    requiredQty: String(item.requiredQty),
                    suggestedUnitPrice:
                        item.suggestedUnitPrice == null ? '' : String(item.suggestedUnitPrice),
                }))
                : [{ itemTypeId: '', itemTypeSearch: '', requiredQty: '1', suggestedUnitPrice: '' }],
        });
        setShowModal(true);
    };

    const updateItemRow = (
        rowIndex: number,
        field: keyof PackageItemFormRow,
        value: string,
    ) => {
        setForm((current) => {
            const nextRows = [...current.items];
            nextRows[rowIndex] = { ...nextRows[rowIndex], [field]: value };
            return { ...current, items: nextRows };
        });
    };

    const addItemRow = () => {
        setForm((current) => ({
            ...current,
            items: [...current.items, { itemTypeId: '', itemTypeSearch: '', requiredQty: '1', suggestedUnitPrice: '' }],
        }));
    };

    const updateItemTypeSearch = (rowIndex: number, value: string) => {
        const normalizedValue = value.trim().toLowerCase();
        const matchedItemType = itemTypes.find(
            (itemType) => itemType.name.trim().toLowerCase() === normalizedValue,
        );

        setForm((current) => {
            const nextRows = [...current.items];
            const row = nextRows[rowIndex];
            nextRows[rowIndex] = {
                ...row,
                itemTypeSearch: value,
                itemTypeId: matchedItemType ? matchedItemType.id : '',
            };
            return { ...current, items: nextRows };
        });
    };

    const removeItemRow = (rowIndex: number) => {
        setForm((current) => ({
            ...current,
            items:
                current.items.length <= 1
                    ? current.items
                    : current.items.filter((_, index) => index !== rowIndex),
        }));
    };

    const buildPayload = (): UpsertAdminPackageTemplatePayload | null => {
        const code = form.code.trim();
        const name = form.name.trim();
        const description = form.description.trim();

        if (!code || !name) {
            toast.error('Package code and name are required.');
            return null;
        }

        const normalizedItems = form.items
            .map((item) => ({
                itemTypeId: item.itemTypeId,
                requiredQty: Math.round(Number(item.requiredQty) || 0),
                suggestedUnitPrice:
                    item.suggestedUnitPrice.trim() === ''
                        ? null
                        : Number(item.suggestedUnitPrice),
            }))
            .filter((item) => item.itemTypeId);

        if (!normalizedItems.length) {
            toast.error('At least one package item is required.');
            return null;
        }

        const duplicateCheck = new Set<string>();
        for (const item of normalizedItems) {
            if (duplicateCheck.has(item.itemTypeId)) {
                toast.error('Duplicate item types are not allowed.');
                return null;
            }

            if (item.requiredQty < 1) {
                toast.error('Required quantity must be at least 1.');
                return null;
            }

            if (item.suggestedUnitPrice != null && item.suggestedUnitPrice < 0) {
                toast.error('Suggested unit price cannot be negative.');
                return null;
            }

            duplicateCheck.add(item.itemTypeId);
        }

        return {
            code,
            name,
            description: description || null,
            isActive: form.isActive,
            items: normalizedItems,
        };
    };

    const handleSave = async () => {
        const payload = buildPayload();
        if (!payload) return;

        setSaving(true);
        try {
            if (editingTemplate) {
                await updateAdminPackageTemplate(editingTemplate.id, payload);
                toast.success('Package template updated.');
            } else {
                await createAdminPackageTemplate(payload);
                toast.success('Package template created.');
            }

            setShowModal(false);
            setEditingTemplate(null);
            setForm(EMPTY_FORM);
            setLoading(true);
            await load();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to save package template.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (template: AdminPackageTemplate) => {
        if (!window.confirm(`Delete package template "${template.name}"?`)) return;

        try {
            await deleteAdminPackageTemplate(template.id);
            toast.success('Package template deleted.');
            setLoading(true);
            await load();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to delete package template.');
        }
    };

    const handleToggleStatus = async (template: AdminPackageTemplate) => {
        try {
            await updateAdminPackageTemplate(template.id, {
                code: template.code,
                name: template.name,
                description: template.description || null,
                isActive: !template.isActive,
                items: template.items.map((item) => ({
                    itemTypeId: item.itemTypeId,
                    requiredQty: Number(item.requiredQty),
                    suggestedUnitPrice:
                        item.suggestedUnitPrice == null ? null : Number(item.suggestedUnitPrice),
                })),
            });
            toast.success(`Package template ${template.isActive ? 'disabled' : 'enabled'}.`);
            setLoading(true);
            await load();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to update package status.');
        }
    };

    if (loading) return <AdminLayout><LoadingSpinner /></AdminLayout>;

    return (
        <AdminLayout>
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-4xl font-bold text-slate-900">Packages</h1>
                <Button size="xl" className="!bg-slate-800 hover:!bg-slate-900" onClick={openCreate}>
                    + Add Package
                </Button>
            </div>

            {loadError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
                    <p className="text-sm font-semibold">Packages failed to load</p>
                    <p className="mt-1 text-sm">{loadError}</p>
                    <div className="mt-3">
                        <Button color="light" onClick={() => { setLoading(true); void load(); }}>
                            Retry
                        </Button>
                    </div>
                </div>
            ) : templates.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">
                    <p className="text-base font-semibold">No package templates found.</p>
                    <p className="mt-1 text-sm text-slate-600">
                        Add your first package here, or run API seed command.
                    </p>
                    <p className="mt-1 rounded-md bg-slate-100 px-3 py-2 font-mono text-xs text-slate-700">
                        npm run seed:packages
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl shadow">
                    <Table striped className="mobile-friendly-table">
                        <Table.Head>
                            <Table.HeadCell className="text-lg">Code</Table.HeadCell>
                            <Table.HeadCell className="text-lg">Package</Table.HeadCell>
                            <Table.HeadCell className="text-lg">Items</Table.HeadCell>
                            <Table.HeadCell className="text-lg">Status</Table.HeadCell>
                            <Table.HeadCell className="text-lg">Actions</Table.HeadCell>
                        </Table.Head>
                        <Table.Body>
                            {templates.map((template) => (
                                <Table.Row key={template.id} className="text-lg">
                                    <Table.Cell className="font-mono text-sm text-slate-600">{template.code}</Table.Cell>
                                    <Table.Cell>
                                        <p className="font-semibold text-slate-900">{template.name}</p>
                                        <p className="line-clamp-2 text-sm text-slate-600">{template.description || 'No description'}</p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <ul className="space-y-1 text-sm text-slate-700">
                                            {template.items.map((item) => (
                                                <li key={item.id}>
                                                    {itemTypeById.get(item.itemTypeId) || item.itemType?.name || 'Unknown item'} x{item.requiredQty}
                                                    {item.suggestedUnitPrice != null
                                                        ? ` (PHP ${Number(item.suggestedUnitPrice).toFixed(2)})`
                                                        : ''}
                                                </li>
                                            ))}
                                        </ul>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${template.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                                            {template.isActive ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                color="light"
                                                size="sm"
                                                className={template.isActive ? '!border-amber-200 !bg-amber-50 !text-amber-800 hover:!bg-amber-100' : '!border-emerald-200 !bg-emerald-50 !text-emerald-800 hover:!bg-emerald-100'}
                                                onClick={() => void handleToggleStatus(template)}
                                            >
                                                {template.isActive ? 'Disable' : 'Enable'}
                                            </Button>
                                            <Button color="gray" size="sm" onClick={() => openEdit(template)}>Edit</Button>
                                            <Button
                                                color="light"
                                                size="sm"
                                                className="!border-rose-200 !bg-rose-50 !text-rose-700 hover:!bg-rose-100"
                                                onClick={() => void handleDelete(template)}
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

            <Modal className="fullscreen-modal" show={showModal} onClose={() => setShowModal(false)}>
                <Modal.Header>{editingTemplate ? 'Edit Package' : 'Add Package'}</Modal.Header>
                <Modal.Body className="space-y-4 overflow-y-auto">
                    <datalist id="package-item-type-options">
                        {itemTypes.map((itemType) => (
                            <option key={itemType.id} value={itemType.name} />
                        ))}
                    </datalist>

                    <div className="grid gap-3 md:grid-cols-2">
                        <TextInput
                            placeholder="Code (e.g. wedding_standard)"
                            value={form.code}
                            onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                            sizing="lg"
                        />
                        <TextInput
                            placeholder="Name"
                            value={form.name}
                            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                            sizing="lg"
                        />
                    </div>

                    <Textarea
                        placeholder="Description"
                        rows={3}
                        value={form.description}
                        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    />

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={form.isActive}
                            onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                            className="h-4 w-4"
                        />
                        Enabled
                    </label>

                    <div className="rounded-xl border border-slate-200 p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-900">Package Items</h3>
                            <Button size="sm" color="light" onClick={addItemRow}>+ Add Item</Button>
                        </div>

                        <div className="space-y-3">
                            {form.items.map((item, index) => (
                                <div key={`row-${index}`} className="grid gap-2 md:grid-cols-12">
                                    <div className="md:col-span-6">
                                        <TextInput
                                            list="package-item-type-options"
                                            value={item.itemTypeSearch}
                                            onChange={(event) => updateItemTypeSearch(index, event.target.value)}
                                            placeholder="Search item type"
                                        />
                                        {item.itemTypeSearch.trim() !== '' && !item.itemTypeId ? (
                                            <p className="mt-1 text-xs text-amber-700">
                                                Select a matching item type from suggestions.
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="md:col-span-2">
                                        <TextInput
                                            type="number"
                                            min={1}
                                            value={item.requiredQty}
                                            onChange={(event) => updateItemRow(index, 'requiredQty', event.target.value)}
                                            placeholder="Qty"
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <TextInput
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={item.suggestedUnitPrice}
                                            onChange={(event) => updateItemRow(index, 'suggestedUnitPrice', event.target.value)}
                                            placeholder="Suggested price"
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <Button
                                            color="light"
                                            className="w-full !border-rose-200 !bg-rose-50 !text-rose-700 hover:!bg-rose-100"
                                            onClick={() => removeItemRow(index)}
                                            disabled={form.items.length <= 1}
                                        >
                                            X
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button size="xl" className="!bg-slate-800 hover:!bg-slate-900" onClick={() => void handleSave()} isProcessing={saving} disabled={saving}>
                        Save
                    </Button>
                    <Button color="gray" size="xl" onClick={() => setShowModal(false)}>
                        Cancel
                    </Button>
                </Modal.Footer>
            </Modal>
        </AdminLayout>
    );
}