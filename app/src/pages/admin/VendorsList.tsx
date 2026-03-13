import { useEffect, useState } from 'react';
import { Button, Table, Badge } from 'flowbite-react';
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

  if (loading) return <AdminLayout><LoadingSpinner /></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="text-4xl font-bold text-gray-900 mb-6">🏪 {t('vendorsList.title')}</h1>
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
    </AdminLayout>
  );
}
