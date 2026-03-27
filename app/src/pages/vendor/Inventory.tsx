import { useEffect, useState } from 'react';
import { Button, Modal, TextInput, Select } from 'flowbite-react';
import toast from 'react-hot-toast';
import VendorLayout from '../../components/layout/VendorLayout';
import { getInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem } from '../../api/items';
import { getItemTypes, getBrands } from '../../api/items';
import { getMyVendor } from '../../api/vendors';
import type { InventoryItem, ItemType, ProductBrand } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency } from '../../utils/format';
import { useTranslation } from 'react-i18next';

export default function Inventory() {
  const { t } = useTranslation();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [brands, setBrands] = useState<ProductBrand[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState({ itemTypeId: '', brandId: '', color: '', quantity: '', ratePerDay: '', condition: '' });
  const [editForm, setEditForm] = useState({ itemTypeId: '', brandId: '', color: '', quantity: '', ratePerDay: '', condition: '' });
  const selectedItemType = itemTypes.find((itemType) => itemType.id === form.itemTypeId);
  const selectedEditItemType = itemTypes.find((itemType) => itemType.id === editForm.itemTypeId);

  const load = async () => {
    const v = await getMyVendor();
    setVendorId(v.id);
    const [inv, it, b] = await Promise.all([getInventory(v.id), getItemTypes(), getBrands()]);
    setItems(inv); setItemTypes(it); setBrands(b);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    await createInventoryItem({
      ...form,
      vendorId,
      color: form.color.trim() || undefined,
      quantity: Number(form.quantity),
      ratePerDay: form.ratePerDay.trim() ? Number(form.ratePerDay) : undefined,
    });
    toast.success(t('inventoryPage.toastItemAdded'));
    setShowModal(false);
    load();
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
    setEditForm({ itemTypeId: '', brandId: '', color: '', quantity: '', ratePerDay: '', condition: '' });
  };

  const handleUpdate = async () => {
    if (!editingItem) return;

    await updateInventoryItem(editingItem.id, {
      itemTypeId: editForm.itemTypeId,
      brandId: editForm.brandId || undefined,
      color: editForm.color.trim() || undefined,
      quantity: Number(editForm.quantity),
      ratePerDay: editForm.ratePerDay.trim() ? Number(editForm.ratePerDay) : undefined,
      condition: editForm.condition.trim() || undefined,
    });

    toast.success(t('inventoryPage.toastItemUpdated'));
    closeEditModal();
    load();
  };

  if (loading) return <VendorLayout><LoadingSpinner /></VendorLayout>;

  return (
    <VendorLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-gray-900">📦 {t('inventoryPage.title')}</h1>
        <Button size="lg" onClick={() => setShowModal(true)}>+ {t('inventoryPage.addItem')}</Button>
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
                {item.color && <p>🎨 {t('inventoryPage.color')}: <strong>{item.color}</strong></p>}
                <p>📦 {t('inventoryPage.total')}: <strong>{item.quantity}</strong></p>
                <p>✅ {t('inventoryPage.available')}: <strong className="text-green-600">{item.availableQuantity}</strong></p>
                <p>💵 {t('inventoryPage.rate')}: <strong>{formatCurrency(item.ratePerDay)}/day</strong></p>
                {item.condition && <p>🔧 {t('inventoryPage.condition')}: {item.condition}</p>}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button color="light" size="sm" onClick={() => openEditModal(item)}>{t('common.edit')}</Button>
                <Button color="failure" size="sm" onClick={() => deleteInventoryItem(item.id).then(() => { toast.success(t('inventoryPage.toastRemoved')); load(); })}>{t('common.remove')}</Button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <p className="col-span-full py-12 text-center text-xl text-gray-400">{t('inventoryPage.noItems')}</p>}
      </div>
      <Modal className="mobile-fullscreen-modal" show={showModal} onClose={() => setShowModal(false)} size="lg">
        <Modal.Header>{t('inventoryPage.modalTitle')}</Modal.Header>
        <Modal.Body className="space-y-4">
          <Select
            value={form.itemTypeId}
            onChange={(e) => {
              const nextItemTypeId = e.target.value;
              const nextItemType = itemTypes.find((itemType) => itemType.id === nextItemTypeId);
              setForm((current) => ({
                ...current,
                itemTypeId: nextItemTypeId,
                brandId: '',
                ratePerDay: nextItemType ? String(nextItemType.defaultRatePerDay ?? '') : current.ratePerDay,
              }));
            }}
          >
            <option value="">{t('inventoryPage.selectItemType')}</option>
            {itemTypes.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
          </Select>
          {selectedItemType && (
            <p className="text-sm text-gray-600">
              {t('inventoryPage.basePriceHint', {
                price: formatCurrency(selectedItemType.defaultRatePerDay),
              })}
            </p>
          )}
          {selectedItemType?.pictureUrl && (
            <img src={selectedItemType.pictureUrl} alt={selectedItemType.name} className="h-36 w-full rounded-xl bg-slate-50 p-1 object-contain" />
          )}
          <Select value={form.brandId} onChange={e => setForm(f => ({ ...f, brandId: e.target.value }))}>
            <option value="">{t('inventoryPage.selectBrandOptional')}</option>
            {brands.filter(b => !form.itemTypeId || b.itemTypeId === form.itemTypeId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <TextInput placeholder={t('inventoryPage.colorPlaceholder')} value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} sizing="lg" />
          <TextInput type="number" placeholder={t('inventoryPage.quantityPlaceholder')} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} sizing="lg" />
          <TextInput
            type="number"
            placeholder={t('inventoryPage.ratePerDayPlaceholder')}
            value={form.ratePerDay}
            onChange={e => setForm(f => ({ ...f, ratePerDay: e.target.value }))}
            sizing="lg"
          />
          <TextInput placeholder={t('inventoryPage.conditionPlaceholder')} value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} sizing="lg" />
        </Modal.Body>
        <Modal.Footer>
          <Button size="xl" onClick={handleSubmit}>{t('inventoryPage.addItemButton')}</Button>
          <Button color="gray" size="xl" onClick={() => setShowModal(false)}>{t('common.cancel')}</Button>
        </Modal.Footer>
      </Modal>

      <Modal className="mobile-fullscreen-modal" show={Boolean(editingItem)} onClose={closeEditModal} size="lg">
        <Modal.Header>{t('inventoryPage.editModalTitle')}</Modal.Header>
        <Modal.Body className="space-y-4">
          <Select
            value={editForm.itemTypeId}
            onChange={(e) => {
              const nextItemTypeId = e.target.value;
              const nextItemType = itemTypes.find((itemType) => itemType.id === nextItemTypeId);
              setEditForm((current) => ({
                ...current,
                itemTypeId: nextItemTypeId,
                brandId: '',
                ratePerDay: nextItemType ? String(nextItemType.defaultRatePerDay ?? '') : current.ratePerDay,
              }));
            }}
          >
            <option value="">{t('inventoryPage.selectItemType')}</option>
            {itemTypes.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
          </Select>
          {selectedEditItemType && (
            <p className="text-sm text-gray-600">
              {t('inventoryPage.basePriceHint', {
                price: formatCurrency(selectedEditItemType.defaultRatePerDay),
              })}
            </p>
          )}
          {selectedEditItemType?.pictureUrl && (
            <img src={selectedEditItemType.pictureUrl} alt={selectedEditItemType.name} className="h-36 w-full rounded-xl bg-slate-50 p-1 object-contain" />
          )}
          <Select value={editForm.brandId} onChange={e => setEditForm(f => ({ ...f, brandId: e.target.value }))}>
            <option value="">{t('inventoryPage.selectBrandOptional')}</option>
            {brands.filter(b => !editForm.itemTypeId || b.itemTypeId === editForm.itemTypeId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <TextInput placeholder={t('inventoryPage.colorPlaceholder')} value={editForm.color} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))} sizing="lg" />
          <TextInput type="number" placeholder={t('inventoryPage.quantityPlaceholder')} value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} sizing="lg" />
          <TextInput
            type="number"
            placeholder={t('inventoryPage.ratePerDayPlaceholder')}
            value={editForm.ratePerDay}
            onChange={e => setEditForm(f => ({ ...f, ratePerDay: e.target.value }))}
            sizing="lg"
          />
          <TextInput placeholder={t('inventoryPage.conditionPlaceholder')} value={editForm.condition} onChange={e => setEditForm(f => ({ ...f, condition: e.target.value }))} sizing="lg" />
        </Modal.Body>
        <Modal.Footer>
          <Button size="xl" onClick={handleUpdate}>{t('inventoryPage.saveItemButton')}</Button>
          <Button color="gray" size="xl" onClick={closeEditModal}>{t('common.cancel')}</Button>
        </Modal.Footer>
      </Modal>
    </VendorLayout>
  );
}
