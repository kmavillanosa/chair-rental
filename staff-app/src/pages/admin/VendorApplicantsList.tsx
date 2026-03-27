import { useEffect, useState } from 'react';
import { Badge, Button } from 'flowbite-react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { getVendorRequests } from '../../api/vendors';
import type { Vendor } from '../../types';

function getStatusColor(status?: string) {
    if (!status) return 'gray';

    if (
        status === 'approved' ||
        status === 'verified_business' ||
        status === 'verified_owner'
    ) {
        return 'success';
    }
    if (status === 'rejected') return 'failure';
    return 'gray';
}

export default function VendorApplicantsList() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState<Vendor[]>([]);

    useEffect(() => {
        getVendorRequests('pending')
            .then(setRequests)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <AdminLayout>
                <LoadingSpinner />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="mx-auto w-full max-w-[1240px] space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Rental Partner Applicants</h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Review pending KYC submissions before they enter the managed rental partner list.
                        </p>
                    </div>

                    <Button
                        size="sm"
                        color="light"
                        className="!border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-100"
                        onClick={() => navigate('/admin/vendors')}
                    >
                        Back to Rental Partners
                    </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Badge color="gray">{requests.length} pending</Badge>
                </div>

                {requests.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                        No pending rental partner registrations right now.
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        {requests.map((request, index) => {
                            const ownerName = request.ownerFullName || request.user?.name || 'Unknown owner';
                            const documentCount =
                                (request.documents?.filter((document) => Boolean(document.fileUrl)).length || 0) +
                                (request.kycDocumentUrl ? 1 : 0);

                            return (
                                <button
                                    key={request.id}
                                    type="button"
                                    onClick={() => navigate(`/admin/vendors/applicants/${request.id}`)}
                                    className={`group flex w-full items-start justify-between gap-4 bg-white px-4 py-4 text-left hover:bg-slate-50 ${index !== requests.length - 1 ? 'border-b border-slate-200' : ''
                                        }`}
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-slate-900">{request.businessName}</p>
                                        <p className="truncate text-xs text-slate-600">
                                            {ownerName} • {request.user?.email}
                                        </p>
                                        <p className="mt-0.5 truncate text-xs text-slate-500">{request.address}</p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {documentCount} file{documentCount === 1 ? '' : 's'} • Duplicate risk:{' '}
                                            {request.duplicateRiskScore || 0}
                                        </p>
                                    </div>

                                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                                        <Badge color={getStatusColor(request.registrationStatus)}>
                                            Reg: {request.registrationStatus || 'pending'}
                                        </Badge>
                                        <Badge color={getStatusColor(request.kycStatus)}>
                                            KYC: {request.kycStatus || 'pending'}
                                        </Badge>
                                        <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900">
                                            Review
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
