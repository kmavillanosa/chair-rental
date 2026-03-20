import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Textarea } from 'flowbite-react';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
    getVendorKycSubmission,
    reviewVendorRegistration,
} from '../../api/vendors';
import type { Vendor } from '../../types';

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
    government_id: 'Government ID',
    selfie_verification: 'Selfie Verification',
    mayors_permit: `Mayor's Permit`,
    barangay_permit: 'Barangay Permit',
    business_logo: 'Business Logo',
};

function getDocumentLabel(documentType?: string) {
    const normalized = String(documentType || '').trim().toLowerCase();
    if (!normalized) return 'Uploaded File';

    return (
        DOCUMENT_TYPE_LABELS[normalized] ||
        normalized
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ')
    );
}

function isImageFile(url?: string | null) {
    const normalized = String(url || '').trim().toLowerCase();
    return (
        normalized.startsWith('data:image/') ||
        /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(normalized)
    );
}

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

export default function VendorApplicantReview() {
    const navigate = useNavigate();
    const { vendorId } = useParams<{ vendorId: string }>();
    const [loading, setLoading] = useState(true);
    const [applicant, setApplicant] = useState<Vendor | null>(null);
    const [loadError, setLoadError] = useState('');
    const [notes, setNotes] = useState('');
    const [pendingDecision, setPendingDecision] = useState<'approve' | 'reject' | null>(null);

    const previewDocuments = useMemo(() => {
        if (!applicant) return [];

        const items = [
            ...(applicant.documents || [])
                .filter((document) => Boolean(document.fileUrl))
                .map((document) => ({
                    key: document.id,
                    label: getDocumentLabel(document.documentType),
                    url: document.fileUrl,
                })),
        ];

        if (
            applicant.kycDocumentUrl &&
            !items.some((document) => document.url === applicant.kycDocumentUrl)
        ) {
            items.unshift({
                key: `${applicant.id}-kyc-document`,
                label: 'Government ID',
                url: applicant.kycDocumentUrl,
            });
        }

        return items;
    }, [applicant]);

    const canReview =
        applicant?.registrationStatus !== 'approved' &&
        applicant?.registrationStatus !== 'rejected';

    useEffect(() => {
        if (!vendorId) {
            setLoadError('Missing applicant ID.');
            setLoading(false);
            return;
        }

        const loadApplicant = async () => {
            setLoading(true);
            setLoadError('');

            try {
                const data = await getVendorKycSubmission(vendorId);
                setApplicant(data);
                setNotes(data.kycNotes || '');
            } catch (error: any) {
                setLoadError(
                    error?.response?.data?.message || 'Unable to load applicant details.',
                );
            } finally {
                setLoading(false);
            }
        };

        void loadApplicant();
    }, [vendorId]);

    const handleDecision = async (decision: 'approve' | 'reject') => {
        if (!applicant) return;

        const normalizedNotes = notes.trim();

        if (decision === 'reject' && !normalizedNotes) {
            toast.error('Please provide notes before declining this application.');
            return;
        }

        setPendingDecision(decision);
        try {
            await reviewVendorRegistration(
                applicant.id,
                decision,
                normalizedNotes || undefined,
            );
            toast.success(
                decision === 'approve'
                    ? 'Applicant approved successfully.'
                    : 'Applicant declined successfully.',
            );
            navigate('/admin/vendors/applicants', { replace: true });
        } catch (error: any) {
            toast.error(
                error?.response?.data?.message ||
                `Failed to ${decision === 'approve' ? 'approve' : 'decline'} applicant.`,
            );
        } finally {
            setPendingDecision(null);
        }
    };

    if (loading) {
        return (
            <AdminLayout>
                <LoadingSpinner />
            </AdminLayout>
        );
    }

    if (!applicant) {
        return (
            <AdminLayout>
                <div className="mx-auto w-full max-w-[1240px] space-y-4">
                    <Button
                        size="sm"
                        color="light"
                        onClick={() => navigate('/admin/vendors/applicants')}
                        className="!border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-100"
                    >
                        Back to Applicants
                    </Button>

                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        {loadError || 'Applicant not found.'}
                    </div>
                </div>
            </AdminLayout>
        );
    }

    const ownerName = applicant.ownerFullName || applicant.user?.name || 'Unknown owner';
    const vendorTypeLabel = (applicant.vendorType || 'registered_business').replace('_', ' ');

    return (
        <AdminLayout>
            <div className="mx-auto w-full max-w-[1240px] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button
                        size="sm"
                        color="light"
                        onClick={() => navigate('/admin/vendors/applicants')}
                        className="!border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-100"
                    >
                        Back to Applicants
                    </Button>

                    <div className="flex flex-wrap gap-2">
                        <Badge color={getStatusColor(applicant.registrationStatus)}>
                            Registration: {applicant.registrationStatus || 'pending'}
                        </Badge>
                        <Badge color={getStatusColor(applicant.verificationStatus)}>
                            Verification: {applicant.verificationStatus || 'pending_verification'}
                        </Badge>
                        <Badge color={getStatusColor(applicant.kycStatus)}>
                            KYC: {applicant.kycStatus || 'pending'}
                        </Badge>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h1 className="text-2xl font-semibold text-slate-900">Applicant Review</h1>
                    <p className="mt-1 text-sm text-slate-600">
                        Review documents and details, then approve or decline this vendor application.
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Business</p>
                            <p className="mt-1 text-sm font-medium text-slate-900">{applicant.businessName}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</p>
                            <p className="mt-1 text-sm font-medium text-slate-900">{ownerName}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vendor Type</p>
                            <p className="mt-1 text-sm font-medium capitalize text-slate-900">{vendorTypeLabel}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Duplicate Risk</p>
                            <p className="mt-1 text-sm font-medium text-slate-900">{applicant.duplicateRiskScore || 0}</p>
                        </div>
                    </div>

                    <div className="mt-4 space-y-1 text-sm text-slate-700">
                        <p><span className="font-semibold">Email:</span> {applicant.user?.email || '-'}</p>
                        <p><span className="font-semibold">Address:</span> {applicant.address || '-'}</p>
                        <p><span className="font-semibold">Phone:</span> {applicant.phone || '-'}</p>
                    </div>

                    {applicant.rejectionReason && (
                        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                            <span className="font-semibold">Previous rejection reason:</span> {applicant.rejectionReason}
                        </div>
                    )}
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Uploaded Documents</h2>
                            <Badge color="gray">{previewDocuments.length} file{previewDocuments.length === 1 ? '' : 's'}</Badge>
                        </div>

                        {previewDocuments.length ? (
                            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                                {previewDocuments.map((document) => (
                                    <a
                                        key={document.key}
                                        href={document.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                    >
                                        <div className="flex h-36 items-center justify-center bg-slate-100 p-2">
                                            {isImageFile(document.url) ? (
                                                <img
                                                    src={document.url}
                                                    alt={document.label}
                                                    className="h-full w-full rounded-lg bg-white object-contain"
                                                />
                                            ) : (
                                                <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm font-medium text-slate-500">
                                                    Preview unavailable
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1 px-3 py-2.5">
                                            <p className="text-sm font-semibold text-slate-900">{document.label}</p>
                                            <p className="text-xs text-slate-500 group-hover:text-slate-700">Open full image</p>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                                No uploaded documents found for this applicant.
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Approval Decision</h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Add optional admin notes. Notes are required when declining.
                        </p>

                        <div className="mt-3">
                            <label className="mb-1 block text-sm font-medium text-slate-700">Admin Notes</label>
                            <Textarea
                                rows={5}
                                value={notes}
                                onChange={(event) => setNotes(event.target.value)}
                                placeholder="Write review notes for this application"
                                disabled={pendingDecision !== null || !canReview}
                            />
                        </div>

                        {!canReview && (
                            <p className="mt-3 text-xs text-slate-500">
                                This application already has a final decision and can no longer be reviewed.
                            </p>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                                size="sm"
                                color="light"
                                className="!border-emerald-200 !bg-emerald-50 !text-emerald-800 hover:!bg-emerald-100"
                                onClick={() => handleDecision('approve')}
                                isProcessing={pendingDecision === 'approve'}
                                disabled={pendingDecision !== null || !canReview}
                            >
                                Approve
                            </Button>
                            <Button
                                size="sm"
                                color="light"
                                className="!border-rose-200 !bg-rose-50 !text-rose-700 hover:!bg-rose-100"
                                onClick={() => handleDecision('reject')}
                                isProcessing={pendingDecision === 'reject'}
                                disabled={pendingDecision !== null || !canReview}
                            >
                                Decline
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
