import { useEffect, useState } from 'react';
import { Badge, Button, Table } from 'flowbite-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/layout/AdminLayout';
import {
  flagVendorSuspicious,
  getAllVendors,
  getVendorRequests,
  reviewVendorRegistration,
  setVendorActive,
  suspendVendor,
  verifyVendor,
  warnVendor,
} from '../../api/vendors';
import type { Vendor } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function VendorsList() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [requests, setRequests] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    Promise.all([
      getAllVendors().then(setVendors),
      getVendorRequests('pending').then(setRequests),
    ]).finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const handleVerify = async (vendor: Vendor) => {
    await verifyVendor(vendor.id, !vendor.isVerified);
    toast.success(`Vendor ${vendor.isVerified ? 'unverified' : 'verified'}!`);
    load();
  };

  const handleWarn = async (vendor: Vendor) => {
    await warnVendor(vendor.id);
    toast(`Warning issued to ${vendor.businessName}`);
    load();
  };

  const handleToggleActive = async (vendor: Vendor) => {
    await setVendorActive(vendor.id, !vendor.isActive);
    toast.success(`Vendor ${vendor.isActive ? 'suspended' : 'activated'}!`);
    load();
  };

  const handleSuspend = async (vendor: Vendor) => {
    const reason = window.prompt(
      'Suspension reason (required):',
      vendor.kycNotes || 'Suspicious behavior under review',
    ) || '';

    if (!reason.trim()) {
      toast.error('Suspension reason is required.');
      return;
    }

    await suspendVendor(vendor.id, reason.trim());
    toast.success(`${vendor.businessName} suspended.`);
    load();
  };

  const handleFlagSuspicious = async (vendor: Vendor) => {
    const nextFlagState = !vendor.isSuspicious;
    const reason = window.prompt(
      nextFlagState
        ? 'Reason for flagging as suspicious:'
        : 'Optional note for removing suspicious flag:',
      vendor.suspiciousReason || '',
    ) || '';

    if (nextFlagState && !reason.trim()) {
      toast.error('Please provide a reason before flagging a vendor.');
      return;
    }

    await flagVendorSuspicious(vendor.id, nextFlagState, reason.trim() || undefined);
    toast.success(
      nextFlagState
        ? `${vendor.businessName} flagged as suspicious.`
        : `${vendor.businessName} unflagged.`,
    );
    load();
  };

  const handleReviewRequest = async (
    vendor: Vendor,
    decision: 'approve' | 'reject',
  ) => {
    const notes =
      window.prompt(
        decision === 'approve'
          ? 'Optional admin notes for approval:'
          : 'Reason for rejection (required):',
        vendor.kycNotes || '',
      ) || '';

    if (decision === 'reject' && !notes.trim()) {
      toast.error('Please provide rejection notes before rejecting a KYC request.');
      return;
    }

    await reviewVendorRegistration(vendor.id, decision, notes.trim() || undefined);
    toast.success(
      `Vendor request ${decision === 'approve' ? 'approved' : 'rejected'}.`,
    );
    load();
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'warning';

    if (
      status === 'approved' ||
      status === 'verified_business' ||
      status === 'verified_owner'
    ) {
      return 'success';
    }
    if (status === 'rejected') return 'failure';
    if (status === 'pending' || status === 'pending_verification') return 'warning';
    return 'gray';
  };

  if (loading) {
    return (
      <AdminLayout>
        <LoadingSpinner />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <h1 className="mb-6 text-4xl font-bold text-slate-900">Vendors</h1>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">KYC Registration Requests</h2>
          <Badge color="info">{requests.length} pending</Badge>
        </div>

        {requests.length === 0 ? (
          <p className="text-slate-500">No pending vendor registrations right now.</p>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{request.businessName}</p>
                    <p className="text-sm text-slate-600">
                      {request.ownerFullName || request.user?.name} • {request.user?.email}
                    </p>
                    <p className="text-sm text-slate-600">{request.address}</p>
                    <p className="text-sm text-slate-600 capitalize">
                      Type: {(request.vendorType || 'registered_business').replace('_', ' ')}
                    </p>
                  </div>
                  <div className="flex gap-2 items-center flex-wrap justify-end">
                    <Badge color={getStatusColor(request.verificationStatus)}>
                      Verification: {request.verificationStatus || 'pending_verification'}
                    </Badge>
                    <Badge color={getStatusColor(request.registrationStatus)}>
                      Registration: {request.registrationStatus || 'pending'}
                    </Badge>
                    <Badge color={getStatusColor(request.kycStatus)}>
                      KYC: {request.kycStatus || 'pending'}
                    </Badge>
                  </div>
                </div>

                {request.kycDocumentUrl && (
                  <p className="text-sm mt-2">
                    Gov ID Doc:{' '}
                    <a
                      href={request.kycDocumentUrl}
                      className="text-slate-700 underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {request.kycDocumentUrl}
                    </a>
                  </p>
                )}

                {request.documents && request.documents.length > 0 && (
                  <div className="text-sm mt-2 space-y-1">
                    {request.documents.map((document) => (
                      <p key={document.id}>
                        {document.documentType}:{' '}
                        <a
                          href={document.fileUrl}
                          className="text-slate-700 underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {document.fileUrl}
                        </a>
                      </p>
                    ))}
                  </div>
                )}

                {request.duplicateRiskScore != null && request.duplicateRiskScore > 0 && (
                  <p className="text-sm text-amber-700 mt-1">
                    Duplicate risk score: {request.duplicateRiskScore}
                  </p>
                )}

                {request.rejectionReason && (
                  <p className="text-sm text-red-700 mt-1">
                    Rejection reason: {request.rejectionReason}
                  </p>
                )}

                {request.kycNotes && (
                  <p className="mt-1 text-sm text-slate-600">Notes: {request.kycNotes}</p>
                )}

                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    color="light"
                    className="!border-emerald-200 !bg-emerald-50 !text-emerald-800 hover:!bg-emerald-100"
                    onClick={() => handleReviewRequest(request, 'approve')}
                  >
                    Approve KYC
                  </Button>
                  <Button
                    size="sm"
                    color="light"
                    className="!border-rose-200 !bg-rose-50 !text-rose-700 hover:!bg-rose-100"
                    onClick={() => handleReviewRequest(request, 'reject')}
                  >
                    Reject KYC
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl shadow">
        <Table striped>
          <Table.Head>
            <Table.HeadCell className="text-lg">Business</Table.HeadCell>
            <Table.HeadCell className="text-lg">Owner</Table.HeadCell>
            <Table.HeadCell className="text-lg">Status</Table.HeadCell>
            <Table.HeadCell className="text-lg">Verification</Table.HeadCell>
            <Table.HeadCell className="text-lg">Warnings</Table.HeadCell>
            <Table.HeadCell className="text-lg">Actions</Table.HeadCell>
          </Table.Head>
          <Table.Body>
            {vendors.map((vendor) => (
              <Table.Row key={vendor.id} className="text-lg">
                <Table.Cell>
                  <p className="font-semibold">{vendor.businessName}</p>
                  <p className="text-gray-500 text-sm">{vendor.address}</p>
                </Table.Cell>
                <Table.Cell>{vendor.ownerFullName || vendor.user?.name}</Table.Cell>
                <Table.Cell className="flex gap-2 flex-wrap">
                  <Badge color={vendor.isActive ? 'success' : 'failure'}>
                    {vendor.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {vendor.isVerified && <Badge color="indigo">Verified</Badge>}
                  {vendor.isSuspicious && <Badge color="warning">Suspicious</Badge>}
                </Table.Cell>
                <Table.Cell>
                  <div className="flex gap-2 flex-wrap">
                    <Badge color={getStatusColor(vendor.registrationStatus)}>
                      Reg: {vendor.registrationStatus || (vendor.isVerified ? 'approved' : 'pending')}
                    </Badge>
                    <Badge color={getStatusColor(vendor.verificationStatus)}>
                      Verification: {vendor.verificationStatus || 'pending_verification'}
                    </Badge>
                    {vendor.verificationBadge && (
                      <Badge color="success">{vendor.verificationBadge}</Badge>
                    )}
                  </div>
                </Table.Cell>
                <Table.Cell className="text-center">{vendor.warningCount}/3</Table.Cell>
                <Table.Cell>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      color="light"
                      className={vendor.isVerified ? '!border-slate-300 !bg-slate-100 !text-slate-700 hover:!bg-slate-200' : '!border-emerald-200 !bg-emerald-50 !text-emerald-800 hover:!bg-emerald-100'}
                      onClick={() => handleVerify(vendor)}
                    >
                      {vendor.isVerified ? 'Verified' : 'Verify'}
                    </Button>
                    <Button size="sm" color="light" className="!border-amber-200 !bg-amber-50 !text-amber-800 hover:!bg-amber-100" onClick={() => handleWarn(vendor)}>
                      Warn
                    </Button>
                    <Button
                      size="sm"
                      color="light"
                      className={vendor.isSuspicious ? '!border-slate-300 !bg-slate-100 !text-slate-700 hover:!bg-slate-200' : '!border-amber-200 !bg-amber-50 !text-amber-800 hover:!bg-amber-100'}
                      onClick={() => handleFlagSuspicious(vendor)}
                    >
                      {vendor.isSuspicious ? 'Unflag' : 'Flag'}
                    </Button>
                    <Button
                      size="sm"
                      color="light"
                      className="!border-rose-200 !bg-rose-50 !text-rose-700 hover:!bg-rose-100"
                      onClick={() => handleSuspend(vendor)}
                    >
                      Suspend
                    </Button>
                    <Button
                      size="sm"
                      color="light"
                      className={vendor.isActive ? '!border-rose-200 !bg-rose-50 !text-rose-700 hover:!bg-rose-100' : '!border-emerald-200 !bg-emerald-50 !text-emerald-800 hover:!bg-emerald-100'}
                      onClick={() => handleToggleActive(vendor)}
                    >
                      {vendor.isActive ? 'Deactivate' : 'Activate'}
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
