import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Modal, Select, Table, TextInput } from 'flowbite-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import { impersonateUser } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import {
  clearVendorWarnings,
  createVendor,
  flagVendorSuspicious,
  getAllVendors,
  getVendorRequests,
  hardDeleteVendor,
  setVendorActive,
  suspendVendor,
  verifyVendor,
  warnVendor,
} from '../../api/vendors';
import type { Vendor } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function VendorsList() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [pendingApplicantsCount, setPendingApplicantsCount] = useState(0);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingVendor, setCreatingVendor] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendTargetVendor, setSuspendTargetVendor] = useState<Vendor | null>(null);
  const [suspendingVendor, setSuspendingVendor] = useState(false);
  const [hardDeletingVendorId, setHardDeletingVendorId] = useState<string | null>(null);
  const [impersonatingVendorId, setImpersonatingVendorId] = useState<string | null>(null);
  const startImpersonation = useAuthStore((state) => state.startImpersonation);
  const [createForm, setCreateForm] = useState({
    userEmail: '',
    businessName: '',
    ownerFullName: '',
    address: '',
    phone: '',
    vendorType: 'registered_business',
  });
  const [suspendForm, setSuspendForm] = useState({
    reason: '',
    suspendedUntil: '',
  });

  const load = () =>
    Promise.all([
      getAllVendors().then(setVendors),
      getVendorRequests('pending').then((requests) => {
        setPendingApplicantsCount(requests.length);
      }),
    ]).finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const managedVendors = useMemo(
    () =>
      vendors.filter(
        (vendor) =>
          vendor.registrationStatus !== 'pending' &&
          vendor.verificationStatus !== 'pending_verification',
      ),
    [vendors],
  );

  const filteredVendors = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return managedVendors.filter((vendor) => {
      if (query) {
        const haystack = [
          vendor.businessName,
          vendor.ownerFullName,
          vendor.user?.name,
          vendor.user?.email,
          vendor.address,
          vendor.phone,
          vendor.slug,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(query)) {
          return false;
        }
      }

      if (activityFilter === 'active' && !vendor.isActive) {
        return false;
      }
      if (activityFilter === 'inactive' && vendor.isActive) {
        return false;
      }
      if (
        activityFilter === 'suspended' &&
        vendor.verificationStatus !== 'suspended' &&
        !vendor.suspendedUntil
      ) {
        return false;
      }

      if (verificationFilter === 'verified' && !vendor.isVerified) {
        return false;
      }
      if (
        verificationFilter === 'unverified' &&
        (vendor.isVerified || vendor.verificationStatus === 'rejected')
      ) {
        return false;
      }
      if (
        verificationFilter === 'rejected' &&
        vendor.verificationStatus !== 'rejected' &&
        vendor.registrationStatus !== 'rejected'
      ) {
        return false;
      }

      if (riskFilter === 'flagged' && !vendor.isSuspicious) {
        return false;
      }
      if (riskFilter === 'clean' && vendor.isSuspicious) {
        return false;
      }

      return true;
    });
  }, [managedVendors, searchTerm, activityFilter, verificationFilter, riskFilter]);

  const resetFilters = () => {
    setSearchTerm('');
    setActivityFilter('all');
    setVerificationFilter('all');
    setRiskFilter('all');
  };

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    activityFilter !== 'all' ||
    verificationFilter !== 'all' ||
    riskFilter !== 'all';

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

  const handleClearWarnings = async (vendor: Vendor) => {
    if (vendor.warningCount <= 0) {
      toast('This vendor has no warnings to clear.');
      return;
    }

    const confirmed = window.confirm(
      `Clear all warnings for ${vendor.businessName}?`,
    );
    if (!confirmed) return;

    await clearVendorWarnings(vendor.id);
    toast.success(`Warnings cleared for ${vendor.businessName}.`);
    load();
  };

  const handleToggleActive = async (vendor: Vendor) => {
    await setVendorActive(vendor.id, !vendor.isActive);
    toast.success(`Vendor ${vendor.isActive ? 'suspended' : 'activated'}!`);
    load();
  };

  const handleHardDelete = async (vendor: Vendor) => {
    const confirmation = window.prompt(
      [
        `Type DELETE to permanently remove ${vendor.businessName}.`,
        'This will hard-delete vendor-related bookings, payouts, inventory, KYC docs, and verification history.',
        'This action cannot be undone.',
      ].join('\n'),
      '',
    );

    if (confirmation !== 'DELETE') {
      if (confirmation !== null) {
        toast.error('Hard delete cancelled. Type DELETE exactly to confirm.');
      }
      return;
    }

    setHardDeletingVendorId(vendor.id);
    try {
      await hardDeleteVendor(vendor.id);
      toast.success(`${vendor.businessName} hard-deleted.`);
      load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to hard-delete vendor.');
    } finally {
      setHardDeletingVendorId(null);
    }
  };

  const handleImpersonateVendor = async (vendor: Vendor) => {
    const vendorUserId = String(vendor.user?.id || '').trim();
    if (!vendorUserId) {
      toast.error('Vendor user account is missing.');
      return;
    }

    setImpersonatingVendorId(vendor.id);
    try {
      const result = await impersonateUser(vendorUserId);
      startImpersonation(result.access_token, result.user);
      toast.success(`Now impersonating ${vendor.businessName}.`);
      window.location.href = '/vendor';
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to impersonate vendor account.');
    } finally {
      setImpersonatingVendorId(null);
    }
  };

  const handleSuspend = (vendor: Vendor) => {
    const parsedSuspendDate = vendor.suspendedUntil
      ? new Date(vendor.suspendedUntil)
      : null;
    const suspendUntilValue =
      parsedSuspendDate && !Number.isNaN(parsedSuspendDate.getTime())
        ? parsedSuspendDate.toISOString().split('T')[0]
        : '';

    setSuspendTargetVendor(vendor);
    setSuspendForm({
      reason: vendor.kycNotes || 'Suspicious behavior under review',
      suspendedUntil: suspendUntilValue,
    });
    setShowSuspendModal(true);
  };

  const submitSuspend = async () => {
    if (!suspendTargetVendor) return;

    const reason = suspendForm.reason.trim();
    if (!reason) {
      toast.error('Suspension reason is required.');
      return;
    }

    setSuspendingVendor(true);
    try {
      await suspendVendor(
        suspendTargetVendor.id,
        reason,
        suspendForm.suspendedUntil || undefined,
      );
      toast.success(`${suspendTargetVendor.businessName} suspended.`);
      setShowSuspendModal(false);
      setSuspendTargetVendor(null);
      setSuspendForm({ reason: '', suspendedUntil: '' });
      load();
    } finally {
      setSuspendingVendor(false);
    }
  };

  const handleCreateVendor = async () => {
    const payload = {
      userEmail: createForm.userEmail.trim(),
      businessName: createForm.businessName.trim(),
      ownerFullName: createForm.ownerFullName.trim() || undefined,
      address: createForm.address.trim(),
      phone: createForm.phone.trim() || undefined,
      vendorType: createForm.vendorType as Vendor['vendorType'],
      isVerified: true,
      isActive: true,
    };

    if (!payload.userEmail || !payload.businessName || !payload.address) {
      toast.error('Email, business name, and address are required.');
      return;
    }

    setCreatingVendor(true);
    try {
      await createVendor(payload);
      toast.success('Vendor created.');
      setShowCreateModal(false);
      setCreateForm({
        userEmail: '',
        businessName: '',
        ownerFullName: '',
        address: '',
        phone: '',
        vendorType: 'registered_business',
      });
      load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to create vendor.');
    } finally {
      setCreatingVendor(false);
    }
  };

  const handleFlagSuspicious = async (vendor: Vendor) => {
    const nextFlagState = !vendor.isSuspicious;
    const reason =
      window.prompt(
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

  const neutralActionClass =
    '!border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-100';
  const mutedActionClass =
    '!border-slate-300 !bg-slate-100 !text-slate-700 hover:!bg-slate-200';
  const successActionClass =
    '!border-emerald-200 !bg-emerald-50 !text-emerald-800 hover:!bg-emerald-100';
  const dangerActionClass =
    '!border-rose-200 !bg-rose-50 !text-rose-700 hover:!bg-rose-100';

  const getStatusColor = (status?: string) => {
    if (!status) return 'gray';

    if (
      status === 'approved' ||
      status === 'verified_business' ||
      status === 'verified_owner'
    ) {
      return 'success';
    }
    if (status === 'rejected') return 'failure';
    if (status === 'pending' || status === 'pending_verification') return 'gray';
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
      <div className="mx-auto w-full max-w-[1240px]">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Vendors</h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage approved, rejected, and manually created vendors separately from pending applicants.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="md"
              color="light"
              className="!border-slate-200 !bg-white !px-4 !py-2 text-sm !text-slate-700 hover:!bg-slate-100"
              onClick={() => navigate('/admin/vendors/applicants')}
            >
              Applicants{pendingApplicantsCount > 0 ? ` (${pendingApplicantsCount})` : ''}
            </Button>
            <Button
              size="md"
              className="!bg-slate-800 !px-4 !py-2 text-sm hover:!bg-slate-900"
              onClick={() => setShowCreateModal(true)}
            >
              + Create Vendor
            </Button>
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color="gray">{filteredVendors.length} shown</Badge>
            <Badge color="gray">{managedVendors.length} total vendors</Badge>
            {pendingApplicantsCount > 0 && (
              <Badge color="gray">{pendingApplicantsCount} applicants pending review</Badge>
            )}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
            <TextInput
              placeholder="Search business, owner, email, phone, or slug"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              sizing="md"
            />
            <Select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)}>
              <option value="all">All activity</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
              <option value="suspended">Suspended only</option>
            </Select>
            <Select
              value={verificationFilter}
              onChange={(event) => setVerificationFilter(event.target.value)}
            >
              <option value="all">All verification</option>
              <option value="verified">Verified only</option>
              <option value="unverified">Unverified only</option>
              <option value="rejected">Rejected only</option>
            </Select>
            <div className="flex gap-2">
              <Select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
                <option value="all">All risk states</option>
                <option value="flagged">Flagged only</option>
                <option value="clean">Clean only</option>
              </Select>
              <Button
                color="light"
                className="!border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-100"
                onClick={resetFilters}
                disabled={!hasActiveFilters}
              >
                Reset
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl shadow">
          <Table striped>
            <Table.Head>
              <Table.HeadCell className="text-xs uppercase tracking-wide">Business</Table.HeadCell>
              <Table.HeadCell className="text-xs uppercase tracking-wide">Owner</Table.HeadCell>
              <Table.HeadCell className="text-xs uppercase tracking-wide">Status</Table.HeadCell>
              <Table.HeadCell className="text-xs uppercase tracking-wide">Verification</Table.HeadCell>
              <Table.HeadCell className="text-xs uppercase tracking-wide">Warnings</Table.HeadCell>
              <Table.HeadCell className="text-xs uppercase tracking-wide">Actions</Table.HeadCell>
            </Table.Head>
            <Table.Body>
              {filteredVendors.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={6} className="py-8 text-center text-sm text-slate-500">
                    No vendors match the current filters.
                  </Table.Cell>
                </Table.Row>
              ) : (
                filteredVendors.map((vendor) => (
                  <Table.Row key={vendor.id} className="text-sm">
                    <Table.Cell>
                      <p className="font-semibold text-slate-900">{vendor.businessName}</p>
                      <p className="text-xs text-gray-500">{vendor.address}</p>
                    </Table.Cell>
                    <Table.Cell>
                      <p>{vendor.ownerFullName || vendor.user?.name}</p>
                      <p className="text-xs text-gray-500">{vendor.user?.email || '-'}</p>
                    </Table.Cell>
                    <Table.Cell className="flex gap-2 flex-wrap">
                      <Badge color={vendor.isActive ? 'success' : 'gray'}>
                        {vendor.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {vendor.isVerified && <Badge color="success">Verified</Badge>}
                      {vendor.isSuspicious && <Badge color="failure">Suspicious</Badge>}
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
                      <div className="flex gap-1.5 flex-wrap">
                        <Button
                          size="xs"
                          color="light"
                          className={vendor.isVerified ? mutedActionClass : successActionClass}
                          onClick={() => handleVerify(vendor)}
                        >
                          {vendor.isVerified ? 'Verified' : 'Verify'}
                        </Button>
                        <Button
                          size="xs"
                          color="light"
                          className={neutralActionClass}
                          onClick={() => handleWarn(vendor)}
                        >
                          Warn
                        </Button>
                        <Button
                          size="xs"
                          color="light"
                          className={`${neutralActionClass} disabled:!border-slate-200 disabled:!bg-slate-100 disabled:!text-slate-400`}
                          onClick={() => handleClearWarnings(vendor)}
                          disabled={vendor.warningCount <= 0}
                        >
                          Clear
                        </Button>
                        <Button
                          size="xs"
                          color="light"
                          className={vendor.isSuspicious ? mutedActionClass : neutralActionClass}
                          onClick={() => handleFlagSuspicious(vendor)}
                        >
                          {vendor.isSuspicious ? 'Unflag' : 'Flag'}
                        </Button>
                        <Button
                          size="xs"
                          color="light"
                          className={dangerActionClass}
                          onClick={() => handleSuspend(vendor)}
                        >
                          Suspend
                        </Button>
                        <Button
                          size="xs"
                          color="light"
                          className={vendor.isActive ? dangerActionClass : successActionClass}
                          onClick={() => handleToggleActive(vendor)}
                        >
                          {vendor.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          size="xs"
                          color="light"
                          className={dangerActionClass}
                          onClick={() => handleHardDelete(vendor)}
                          isProcessing={hardDeletingVendorId === vendor.id}
                          disabled={hardDeletingVendorId === vendor.id}
                        >
                          Hard Delete
                        </Button>
                        <Button
                          size="xs"
                          color="light"
                          className={neutralActionClass}
                          onClick={() => handleImpersonateVendor(vendor)}
                          isProcessing={impersonatingVendorId === vendor.id}
                          disabled={impersonatingVendorId === vendor.id || !vendor.isActive}
                        >
                          Impersonate
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>
        </div>
      </div>

      <Modal show={showCreateModal} onClose={() => !creatingVendor && setShowCreateModal(false)}>
        <Modal.Header>Create Vendor</Modal.Header>
        <Modal.Body className="space-y-4">
          <TextInput
            placeholder="User Email"
            value={createForm.userEmail}
            onChange={(event) => setCreateForm((current) => ({ ...current, userEmail: event.target.value }))}
            sizing="md"
          />
          <TextInput
            placeholder="Business Name"
            value={createForm.businessName}
            onChange={(event) => setCreateForm((current) => ({ ...current, businessName: event.target.value }))}
            sizing="md"
          />
          <TextInput
            placeholder="Owner Full Name (optional)"
            value={createForm.ownerFullName}
            onChange={(event) => setCreateForm((current) => ({ ...current, ownerFullName: event.target.value }))}
            sizing="md"
          />
          <TextInput
            placeholder="Business Address"
            value={createForm.address}
            onChange={(event) => setCreateForm((current) => ({ ...current, address: event.target.value }))}
            sizing="md"
          />
          <TextInput
            placeholder="Phone (optional)"
            value={createForm.phone}
            onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))}
            sizing="md"
          />
          <Select
            value={createForm.vendorType}
            onChange={(event) => setCreateForm((current) => ({ ...current, vendorType: event.target.value }))}
          >
            <option value="registered_business">Registered Business</option>
            <option value="individual_owner">Individual Owner</option>
          </Select>
        </Modal.Body>
        <Modal.Footer>
          <Button size="md" onClick={handleCreateVendor} isProcessing={creatingVendor} disabled={creatingVendor}>
            Save
          </Button>
          <Button color="gray" size="md" onClick={() => setShowCreateModal(false)} disabled={creatingVendor}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showSuspendModal} onClose={() => !suspendingVendor && setShowSuspendModal(false)}>
        <Modal.Header>
          Suspend Vendor{suspendTargetVendor ? `: ${suspendTargetVendor.businessName}` : ''}
        </Modal.Header>
        <Modal.Body className="space-y-4">
          <TextInput
            placeholder="Suspension reason"
            value={suspendForm.reason}
            onChange={(event) => setSuspendForm((current) => ({ ...current, reason: event.target.value }))}
            sizing="md"
          />
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Suspend Until (optional)</label>
            <TextInput
              type="date"
              value={suspendForm.suspendedUntil}
              onChange={(event) => setSuspendForm((current) => ({ ...current, suspendedUntil: event.target.value }))}
              sizing="md"
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button size="md" onClick={submitSuspend} isProcessing={suspendingVendor} disabled={suspendingVendor}>
            Confirm Suspension
          </Button>
          <Button color="gray" size="md" onClick={() => setShowSuspendModal(false)} disabled={suspendingVendor}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </AdminLayout>
  );
}
