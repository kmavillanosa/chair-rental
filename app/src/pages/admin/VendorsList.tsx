import { useEffect, useState } from 'react';
import { Badge, Button, Modal, Select, Table, TextInput } from 'flowbite-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import { getAllVendors, verifyVendor, warnVendor, setVendorActive, createVendor } from '../../api/vendors';
import type { Vendor } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useTranslation } from 'react-i18next';

export default function VendorsList() {
  const { t } = useTranslation();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    userEmail: '',
    businessName: '',
    ownerFullName: '',
    address: '',
    phone: '',
    paymongoMerchantId: '',
    vendorType: 'registered_business',
  });

  const load = () => getAllVendors().then(setVendors).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleVerify = async (v: Vendor) => {
    await verifyVendor(v.id, !v.isVerified);
    toast.success(v.isVerified ? t('vendorsList.toastUnverified') : t('vendorsList.toastVerified'));
    load();
  };

  const handleWarn = async (v: Vendor) => {
    await warnVendor(v.id);
    toast(t('vendorsList.toastWarningIssued', { name: v.businessName }));
    load();
  };

  const handleToggleActive = async (v: Vendor) => {
    await setVendorActive(v.id, !v.isActive);
    toast.success(v.isActive ? t('vendorsList.toastSuspended') : t('vendorsList.toastActivated'));
    load();
  };

  const handleCreate = async () => {
    const payload = {
      userEmail: form.userEmail.trim(),
      businessName: form.businessName.trim(),
      ownerFullName: form.ownerFullName.trim() || undefined,
      address: form.address.trim(),
      phone: form.phone.trim() || undefined,
      paymongoMerchantId: form.paymongoMerchantId.trim() || undefined,
      vendorType: form.vendorType as Vendor['vendorType'],
      isVerified: true,
      isActive: true,
    };

    if (!payload.userEmail || !payload.businessName || !payload.address) {
      toast.error(t('vendorsList.toastCreateRequiredFields'));
      return;
    }

    setSubmitting(true);
    try {
      await createVendor(payload);
      toast.success(t('vendorsList.toastCreated'));
      setShowCreateModal(false);
      setForm({
        userEmail: '',
        businessName: '',
        ownerFullName: '',
        address: '',
        phone: '',
        paymongoMerchantId: '',
        vendorType: 'registered_business',
      });
      load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t('vendorsList.toastCreateFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <AdminLayout><LoadingSpinner /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-4xl font-bold text-gray-900">🏪 {t('vendorsList.title')}</h1>
        <Button size="xl" onClick={() => setShowCreateModal(true)}>+ {t('vendorsList.addVendor')}</Button>
      </div>
      <div className="overflow-x-auto rounded-xl shadow">
        <Table striped>
          <Table.Head>
            <Table.HeadCell className="text-lg">{t('vendorsList.business')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('vendorsList.owner')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('common.status')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('vendorsList.warnings')}</Table.HeadCell>
            <Table.HeadCell className="text-lg">{t('common.actions')}</Table.HeadCell>
          </Table.Head>
          <Table.Body>
            {vendors.map(v => (
              <Table.Row key={v.id} className="text-lg">
                <Table.Cell>
                  <p className="font-semibold">{v.businessName}</p>
                  <p className="text-gray-500 text-sm">{v.address}</p>
                </Table.Cell>
                <Table.Cell>{v.user?.name}</Table.Cell>
                <Table.Cell className="flex gap-2">
                  <Badge color={v.isActive ? 'success' : 'failure'}>{v.isActive ? t('status.toggle.active') : t('status.toggle.inactive')}</Badge>
                  {v.isVerified && <Badge color="indigo">{t('status.toggle.verified')}</Badge>}
                </Table.Cell>
                <Table.Cell className="text-center">{v.warningCount}/3</Table.Cell>
                <Table.Cell>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" color={v.isVerified ? 'gray' : 'success'} onClick={() => handleVerify(v)}>
                      {v.isVerified ? `✓ ${t('vendorsList.verified')}` : t('vendorsList.verify')}
                    </Button>
                    <Button size="sm" color="warning" onClick={() => handleWarn(v)}>⚠️ {t('vendorsList.warn')}</Button>
                    <Button size="sm" color={v.isActive ? 'failure' : 'success'} onClick={() => handleToggleActive(v)}>
                      {v.isActive ? t('vendorsList.suspend') : t('vendorsList.activate')}
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>

      <Modal show={showCreateModal} onClose={() => !submitting && setShowCreateModal(false)}>
        <Modal.Header>{t('vendorsList.addVendor')}</Modal.Header>
        <Modal.Body className="space-y-4">
          <TextInput
            placeholder={t('vendorsList.userEmailPlaceholder')}
            value={form.userEmail}
            onChange={(event) => setForm((current) => ({ ...current, userEmail: event.target.value }))}
            sizing="lg"
          />
          <TextInput
            placeholder={t('vendorsList.businessNamePlaceholder')}
            value={form.businessName}
            onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
            sizing="lg"
          />
          <TextInput
            placeholder={t('vendorsList.ownerNamePlaceholder')}
            value={form.ownerFullName}
            onChange={(event) => setForm((current) => ({ ...current, ownerFullName: event.target.value }))}
            sizing="lg"
          />
          <TextInput
            placeholder={t('vendorsList.addressPlaceholder')}
            value={form.address}
            onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
            sizing="lg"
          />
          <TextInput
            placeholder={t('vendorsList.phonePlaceholder')}
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            sizing="lg"
          />
          <TextInput
            placeholder="PayMongo Merchant ID (optional)"
            value={form.paymongoMerchantId}
            onChange={(event) => setForm((current) => ({ ...current, paymongoMerchantId: event.target.value }))}
            sizing="lg"
          />
          <Select
            value={form.vendorType}
            onChange={(event) => setForm((current) => ({ ...current, vendorType: event.target.value }))}
          >
            <option value="registered_business">{t('vendorsList.typeRegisteredBusiness')}</option>
            <option value="individual_owner">{t('vendorsList.typeIndividualOwner')}</option>
          </Select>
        </Modal.Body>
        <Modal.Footer>
          <Button size="xl" onClick={handleCreate} disabled={submitting} isProcessing={submitting}>
            {t('common.save')}
          </Button>
          <Button color="gray" size="xl" onClick={() => setShowCreateModal(false)} disabled={submitting}>
            {t('common.cancel')}
          </Button>
        </Modal.Footer>
      </Modal>
    </AdminLayout>
  );
}
