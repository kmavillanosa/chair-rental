import { useEffect, useState } from 'react';
import { Badge, Button, Modal, Select, Table, TextInput } from 'flowbite-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import {
  getAllVendors,
  verifyVendor,
  warnVendor,
  setVendorActive,
  createVendor,
  setVendorTestAccount,
} from '../../api/vendors';
import {
  getFeatureFlagsSettings,
  updateFeatureFlagsSettings,
} from '../../api/settings';
import type { Vendor } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useTranslation } from 'react-i18next';

export default function VendorsList() {
  const { t } = useTranslation();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [showTestVendorsOnCustomerMap, setShowTestVendorsOnCustomerMap] =
    useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    userEmail: '',
    businessName: '',
    ownerFullName: '',
    address: '',
    phone: '',
    vendorType: 'registered_business',
  });

  const load = () => getAllVendors().then(setVendors).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    setSettingsLoading(true);
    getFeatureFlagsSettings()
      .then((settings) => {
        setShowTestVendorsOnCustomerMap(
          Boolean(settings.showTestVendorsOnCustomerMap),
        );
      })
      .catch(() => {
        setShowTestVendorsOnCustomerMap(false);
      })
      .finally(() => {
        setSettingsLoading(false);
      });
  }, []);

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

  const handleToggleTestAccount = async (v: Vendor) => {
    await setVendorTestAccount(v.id, !Boolean(v.isTestAccount));
    toast.success(
      !Boolean(v.isTestAccount)
        ? t('vendorsList.toastTestAccountEnabled', { name: v.businessName })
        : t('vendorsList.toastTestAccountDisabled', { name: v.businessName }),
    );
    load();
  };

  const handleToggleShowTestVendorsOnMap = async () => {
    if (settingsLoading) return;

    const nextValue = !showTestVendorsOnCustomerMap;
    setSettingsLoading(true);
    try {
      const updated = await updateFeatureFlagsSettings({
        showTestVendorsOnCustomerMap: nextValue,
      });
      setShowTestVendorsOnCustomerMap(
        Boolean(updated.showTestVendorsOnCustomerMap),
      );
      toast.success(
        nextValue
          ? t('vendorsList.toastMapTestAccountsShown')
          : t('vendorsList.toastMapTestAccountsHidden'),
      );
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || t('vendorsList.toastFeatureFlagUpdateFailed'),
      );
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleCreate = async () => {
    const payload = {
      userEmail: form.userEmail.trim(),
      businessName: form.businessName.trim(),
      ownerFullName: form.ownerFullName.trim() || undefined,
      address: form.address.trim(),
      phone: form.phone.trim() || undefined,
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
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{t('vendorsList.featureFlagTitle')}</p>
            <p className="text-xs text-slate-600">{t('vendorsList.featureFlagDescription')}</p>
          </div>
          <Button
            size="sm"
            color={showTestVendorsOnCustomerMap ? 'success' : 'gray'}
            onClick={handleToggleShowTestVendorsOnMap}
            disabled={settingsLoading}
            isProcessing={settingsLoading}
          >
            {showTestVendorsOnCustomerMap
              ? t('vendorsList.featureFlagOn')
              : t('vendorsList.featureFlagOff')}
          </Button>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {vendors.map((vendor) => (
          <article key={vendor.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{vendor.businessName}</p>
                <p className="text-xs text-slate-500">{vendor.address}</p>
              </div>
              <Badge color={vendor.isActive ? 'success' : 'failure'}>
                {vendor.isActive ? t('status.toggle.active') : t('status.toggle.inactive')}
              </Badge>
            </div>

            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('vendorsList.owner')}</dt>
                <dd className="text-right text-slate-700">{vendor.user?.name || t('common.na')}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</dt>
                <dd className="text-right text-slate-700">{vendor.user?.email || t('common.na')}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('vendorsList.warnings')}</dt>
                <dd className="text-right text-slate-700">{vendor.warningCount}/3</dd>
              </div>
            </dl>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {vendor.isVerified && <Badge color="indigo">{t('status.toggle.verified')}</Badge>}
              {vendor.isTestAccount && <Badge color="warning">{t('vendorsList.testAccountBadge')}</Badge>}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button size="xs" color={vendor.isVerified ? 'gray' : 'success'} onClick={() => handleVerify(vendor)}>
                {vendor.isVerified ? `✓ ${t('vendorsList.verified')}` : t('vendorsList.verify')}
              </Button>
              <Button size="xs" color="warning" onClick={() => handleWarn(vendor)}>
                ⚠️ {t('vendorsList.warn')}
              </Button>
              <Button size="xs" color={vendor.isActive ? 'failure' : 'success'} onClick={() => handleToggleActive(vendor)}>
                {vendor.isActive ? t('vendorsList.suspend') : t('vendorsList.activate')}
              </Button>
              <Button
                size="xs"
                color={vendor.isTestAccount ? 'failure' : 'purple'}
                onClick={() => handleToggleTestAccount(vendor)}
              >
                {vendor.isTestAccount
                  ? t('vendorsList.removeTestAccount')
                  : t('vendorsList.markAsTestAccount')}
              </Button>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl shadow md:block">
        <Table striped className="mobile-friendly-table">
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
                  {v.isTestAccount && <Badge color="warning">{t('vendorsList.testAccountBadge')}</Badge>}
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
                    <Button
                      size="sm"
                      color={v.isTestAccount ? 'failure' : 'purple'}
                      onClick={() => handleToggleTestAccount(v)}
                    >
                      {v.isTestAccount
                        ? t('vendorsList.removeTestAccount')
                        : t('vendorsList.markAsTestAccount')}
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>

      <Modal className="mobile-fullscreen-modal" show={showCreateModal} onClose={() => !submitting && setShowCreateModal(false)}>
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
