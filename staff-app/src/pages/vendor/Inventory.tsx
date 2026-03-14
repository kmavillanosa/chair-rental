import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal, TextInput, Select } from 'flowbite-react';
import { HiCheck, HiChevronDown, HiSearch, HiX } from 'react-icons/hi';
import toast from 'react-hot-toast';
import VendorLayout from '../../components/layout/VendorLayout';
import { getInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem } from '../../api/items';
import { getItemTypes, getBrands } from '../../api/items';
import { getMyVendor } from '../../api/vendors';
import type { InventoryItem, ItemType, ProductBrand } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency } from '../../utils/format';

type InventoryFormState = {
  itemTypeId: string;
  brandId: string;
  color: string;
  quantity: string;
  ratePerDay: string;
  condition: string;
};

const EMPTY_FORM: InventoryFormState = {
  itemTypeId: '',
  brandId: '',
  color: '',
  quantity: '',
  ratePerDay: '',
  condition: '',
};

function SearchableItemTypeField({
  itemTypes,
  value,
  onChange,
}: {
  itemTypes: ItemType[];
  value: string;
  onChange: (nextItemTypeId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedItemType = useMemo(
    () => itemTypes.find((itemType) => itemType.id === value) || null,
    [itemTypes, value],
  );
  const [query, setQuery] = useState(selectedItemType?.name || '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedItemType?.name || '');
  }, [selectedItemType]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const filteredItemTypes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return itemTypes.filter((itemType) => {
      if (!normalizedQuery) return true;

      const haystack = [
        itemType.name,
        itemType.description || '',
        ...(itemType.eventTags || []),
        ...(itemType.setTags || []),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [itemTypes, query]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-800">Item Type</label>
      <div ref={containerRef} className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
          <HiSearch className="h-5 w-5" />
        </div>

        <input
          type="text"
          value={query}
          placeholder="Search item type by name"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setOpen(true);

            if (value && nextQuery !== (selectedItemType?.name || '')) {
              onChange('');
            }
          }}
          className="block w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-20 text-base text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
        />

        <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-3">
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                onChange('');
                setOpen(true);
              }}
              className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Clear item type search"
            >
              <HiX className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Toggle item type options"
          >
            <HiChevronDown className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {open && (
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {filteredItemTypes.length
                ? `${filteredItemTypes.length} item type${filteredItemTypes.length === 1 ? '' : 's'} found`
                : 'No matching item types'}
            </div>

            <div className="max-h-80 overflow-y-auto py-2">
              {filteredItemTypes.length ? (
                filteredItemTypes.map((itemType) => {
                  const isSelected = itemType.id === value;

                  return (
                    <button
                      key={itemType.id}
                      type="button"
                      onClick={() => {
                        onChange(itemType.id);
                        setQuery(itemType.name);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition ${isSelected ? 'bg-cyan-50 text-cyan-900' : 'hover:bg-slate-50'
                        }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        {itemType.pictureUrl ? (
                          <img
                            src={itemType.pictureUrl}
                            alt={itemType.name}
                            className="h-10 w-10 rounded-lg bg-slate-50 object-contain p-1"
                          />
                        ) : (
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-500">
                            {itemType.name.charAt(0).toUpperCase()}
                          </span>
                        )}

                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {itemType.name}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            Default: {formatCurrency(itemType.defaultRatePerDay)}/day
                            {itemType.description ? ` • ${itemType.description}` : ''}
                          </span>
                        </span>
                      </span>

                      {isSelected && <HiCheck className="h-5 w-5 shrink-0 text-cyan-600" />}
                    </button>
                  );
                })
              ) : (
                <p className="px-4 py-6 text-sm text-slate-500">
                  Try a different search term to find the item type faster.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Search by name instead of scrolling through the full catalog.
      </p>
    </div>
  );
}

function InventoryFormFields({
  form,
  onFieldChange,
  onItemTypeChange,
  itemTypes,
  brands,
  selectedItemType,
}: {
  form: InventoryFormState;
  onFieldChange: (field: keyof InventoryFormState, value: string) => void;
  onItemTypeChange: (nextItemTypeId: string) => void;
  itemTypes: ItemType[];
  brands: ProductBrand[];
  selectedItemType?: ItemType;
}) {
  const filteredBrands = useMemo(
    () => brands.filter((brand) => !form.itemTypeId || brand.itemTypeId === form.itemTypeId),
    [brands, form.itemTypeId],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <SearchableItemTypeField
          itemTypes={itemTypes}
          value={form.itemTypeId}
          onChange={onItemTypeChange}
        />
      </div>

      {selectedItemType && (
        <div className="grid gap-4 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4 md:grid-cols-[140px,1fr]">
          {selectedItemType.pictureUrl ? (
            <img
              src={selectedItemType.pictureUrl}
              alt={selectedItemType.name}
              className="h-32 w-full rounded-xl bg-white object-contain p-2 shadow-sm"
            />
          ) : (
            <div className="flex h-32 items-center justify-center rounded-xl bg-white text-4xl shadow-sm">
              📦
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
              Selected Item Type
            </p>
            <h3 className="text-xl font-bold text-slate-900">{selectedItemType.name}</h3>
            {selectedItemType.description && (
              <p className="text-sm text-slate-600">{selectedItemType.description}</p>
            )}
            <p className="text-sm text-slate-700">
              Base price: <strong>{formatCurrency(selectedItemType.defaultRatePerDay)}</strong>/day.
              Leave the custom rate blank below if you want to keep this default.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-800">Brand</label>
          <Select
            value={form.brandId}
            disabled={!form.itemTypeId}
            onChange={(event) => onFieldChange('brandId', event.target.value)}
          >
            <option value="">{form.itemTypeId ? 'Select Brand (optional)' : 'Select an item type first'}</option>
            {filteredBrands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </Select>
          <p className="text-xs text-slate-500">
            Brand options are filtered to match the chosen item type.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-800">Quantity</label>
          <TextInput
            type="number"
            min={1}
            placeholder="e.g. 50"
            value={form.quantity}
            onChange={(event) => onFieldChange('quantity', event.target.value)}
            sizing="lg"
          />
          <p className="text-xs text-slate-500">Enter the total stock you currently have for this variant.</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-800">Custom Daily Rate</label>
          <TextInput
            type="number"
            min={0}
            step="0.01"
            placeholder="Leave blank to use base rate"
            value={form.ratePerDay}
            onChange={(event) => onFieldChange('ratePerDay', event.target.value)}
            sizing="lg"
          />
          <p className="text-xs text-slate-500">Optional override when this vendor-specific rate differs from the base price.</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-800">Color</label>
          <TextInput
            placeholder="e.g. Brown, White, Black"
            value={form.color}
            onChange={(event) => onFieldChange('color', event.target.value)}
            sizing="lg"
          />
          <p className="text-xs text-slate-500">Use this for variants that should be tracked separately.</p>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="block text-sm font-semibold text-slate-800">Condition</label>
          <TextInput
            placeholder="e.g. Good, Excellent, Like New"
            value={form.condition}
            onChange={(event) => onFieldChange('condition', event.target.value)}
            sizing="lg"
          />
          <p className="text-xs text-slate-500">Optional internal note that appears in your inventory card.</p>
        </div>
      </div>
    </div>
  );
}

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [brands, setBrands] = useState<ProductBrand[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<InventoryFormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<InventoryFormState>(EMPTY_FORM);
  const selectedItemType = itemTypes.find((itemType) => itemType.id === form.itemTypeId);
  const selectedEditItemType = itemTypes.find((itemType) => itemType.id === editForm.itemTypeId);
  const createSubmitDisabled = !form.itemTypeId || Number(form.quantity) <= 0;
  const editSubmitDisabled = !editForm.itemTypeId || Number(editForm.quantity) <= 0;

  const load = async () => {
    setLoading(true);
    try {
      const v = await getMyVendor();
      setVendorId(v.id);
      const [inv, it, b] = await Promise.all([
        getInventory(v.id),
        getItemTypes(),
        getBrands(),
      ]);
      setItems(inv);
      setItemTypes(it);
      setBrands(b);
    } catch {
      toast.error('Failed to load inventory data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const closeCreateModal = () => {
    setShowModal(false);
    setForm(EMPTY_FORM);
  };

  const applyItemTypeChange = (
    current: InventoryFormState,
    nextItemTypeId: string,
  ): InventoryFormState => {
    const nextItemType = itemTypes.find((itemType) => itemType.id === nextItemTypeId);
    return {
      ...current,
      itemTypeId: nextItemTypeId,
      brandId: '',
      ratePerDay: nextItemType ? String(nextItemType.defaultRatePerDay ?? '') : '',
    };
  };

  const validateForm = (draft: InventoryFormState) => {
    if (!draft.itemTypeId) {
      toast.error('Select an item type first.');
      return false;
    }

    const quantity = Number(draft.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Quantity must be greater than zero.');
      return false;
    }

    if (draft.ratePerDay.trim()) {
      const rate = Number(draft.ratePerDay);
      if (!Number.isFinite(rate) || rate <= 0) {
        toast.error('Custom daily rate must be greater than zero when provided.');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm(form)) return;

    await createInventoryItem({
      ...form,
      vendorId,
      color: form.color.trim() || undefined,
      quantity: Number(form.quantity),
      ratePerDay: form.ratePerDay.trim() ? Number(form.ratePerDay) : undefined,
      condition: form.condition.trim() || undefined,
    });
    toast.success('Item added!');
    closeCreateModal();
    void load();
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
    setEditForm(EMPTY_FORM);
  };

  const handleUpdate = async () => {
    if (!editingItem) return;
    if (!validateForm(editForm)) return;

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
    void load();
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
                <Button color="failure" size="sm" onClick={() => deleteInventoryItem(item.id).then(() => { toast.success('Removed!'); void load(); })}>Remove</Button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <p className="col-span-full py-12 text-center text-xl text-gray-400">No items yet. Add your first item!</p>}
      </div>
      <Modal show={showModal} onClose={closeCreateModal} size="xl">
        <Modal.Header>Add Inventory Item</Modal.Header>
        <Modal.Body className="space-y-6">
          <InventoryFormFields
            form={form}
            onFieldChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
            onItemTypeChange={(nextItemTypeId) => setForm((current) => applyItemTypeChange(current, nextItemTypeId))}
            itemTypes={itemTypes}
            brands={brands}
            selectedItemType={selectedItemType}
          />
        </Modal.Body>
        <Modal.Footer className="justify-end gap-3">
          <Button color="gray" size="lg" onClick={closeCreateModal}>Cancel</Button>
          <Button size="lg" onClick={handleSubmit} disabled={createSubmitDisabled}>Add Item</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(editingItem)} onClose={closeEditModal} size="xl">
        <Modal.Header>Edit Inventory Item</Modal.Header>
        <Modal.Body className="space-y-6">
          <InventoryFormFields
            form={editForm}
            onFieldChange={(field, value) => setEditForm((current) => ({ ...current, [field]: value }))}
            onItemTypeChange={(nextItemTypeId) => setEditForm((current) => applyItemTypeChange(current, nextItemTypeId))}
            itemTypes={itemTypes}
            brands={brands}
            selectedItemType={selectedEditItemType}
          />
        </Modal.Body>
        <Modal.Footer className="justify-end gap-3">
          <Button color="gray" size="lg" onClick={closeEditModal}>Cancel</Button>
          <Button size="lg" onClick={handleUpdate} disabled={editSubmitDisabled}>Save Item</Button>
        </Modal.Footer>
      </Modal>
    </VendorLayout>
  );
}
