import { useEffect, useState } from 'react';
import { Button, Table, Badge } from 'flowbite-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import { getAllVendors, verifyVendor, warnVendor, setVendorActive, createVendor } from '../../api/vendors';
import type { Vendor } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function VendorsList() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => getAllVendors().then(setVendors).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleVerify = async (v: Vendor) => {
    await verifyVendor(v.id, !v.isVerified);
    toast.success(`Vendor ${v.isVerified ? 'unverified' : 'verified'}!`);
    load();
  };

  const handleWarn = async (v: Vendor) => {
    await warnVendor(v.id);
    toast(`Warning issued to ${v.businessName}`);
    load();
  };

  const handleToggleActive = async (v: Vendor) => {
    await setVendorActive(v.id, !v.isActive);
    toast.success(`Vendor ${v.isActive ? 'suspended' : 'activated'}!`);
    load();
  };

  if (loading) return <AdminLayout><LoadingSpinner /></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="text-4xl font-bold text-gray-900 mb-6">🏪 Vendors</h1>
      <div className="overflow-x-auto rounded-xl shadow">
        <Table striped>
          <Table.Head>
            <Table.HeadCell className="text-lg">Business</Table.HeadCell>
            <Table.HeadCell className="text-lg">Owner</Table.HeadCell>
            <Table.HeadCell className="text-lg">Status</Table.HeadCell>
            <Table.HeadCell className="text-lg">Warnings</Table.HeadCell>
            <Table.HeadCell className="text-lg">Actions</Table.HeadCell>
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
                  <Badge color={v.isActive ? 'success' : 'failure'}>{v.isActive ? 'Active' : 'Inactive'}</Badge>
                  {v.isVerified && <Badge color="indigo">Verified</Badge>}
                </Table.Cell>
                <Table.Cell className="text-center">{v.warningCount}/3</Table.Cell>
                <Table.Cell>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" color={v.isVerified ? 'gray' : 'success'} onClick={() => handleVerify(v)}>
                      {v.isVerified ? '✓ Verified' : 'Verify'}
                    </Button>
                    <Button size="sm" color="warning" onClick={() => handleWarn(v)}>⚠️ Warn</Button>
                    <Button size="sm" color={v.isActive ? 'failure' : 'success'} onClick={() => handleToggleActive(v)}>
                      {v.isActive ? 'Suspend' : 'Activate'}
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
