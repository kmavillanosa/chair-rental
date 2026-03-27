import { Link, Navigate, useParams } from 'react-router-dom';
import LegalFooter from '../components/common/LegalFooter';
import {
    defaultLegalDocumentSlug,
    getLegalDocumentBySlug,
    legalDocuments,
} from '../legal/legalDocuments';

export default function LegalDocumentPage() {
    const { documentSlug } = useParams();
    const activeDocument = documentSlug ? getLegalDocumentBySlug(documentSlug) : undefined;

    if (!activeDocument) {
        return <Navigate to={`/legal/${defaultLegalDocumentSlug}`} replace />;
    }

    return (
        <div className="min-h-screen bg-[#eef2f8] text-[#1f2944]">
            <div className="border-b border-[#d7dfec] bg-[#1f2944] text-white">
                <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#b7e92f]">
                            RentalBasic Policies
                        </p>
                        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Legal and Commercial Documents</h1>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
                            These pages surface the platform rules for customer bookings, rental partner participation, commission handling, and liability boundaries.
                        </p>
                    </div>

                    <Link
                        to="/"
                        className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                        Back to app
                    </Link>
                </div>
            </div>

            <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
                    <aside className="rounded-3xl border border-[#d7dfec] bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                            Documents
                        </p>
                        <div className="mt-4 space-y-2">
                            {legalDocuments.map((document) => {
                                const isActive = document.slug === activeDocument.slug;

                                return (
                                    <Link
                                        key={document.slug}
                                        to={`/legal/${document.slug}`}
                                        className={`block rounded-2xl border px-4 py-3 transition ${isActive
                                            ? 'border-[#2d3f63] bg-[#1f2944] text-white shadow-sm'
                                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'}`}
                                    >
                                        <p className="font-semibold">{document.title}</p>
                                        <p className={`mt-1 text-sm leading-6 ${isActive ? 'text-slate-200' : 'text-slate-500'}`}>
                                            {document.summary}
                                        </p>
                                    </Link>
                                );
                            })}
                        </div>
                    </aside>

                    <article className="rounded-[2rem] border border-[#d7dfec] bg-white p-6 shadow-sm sm:p-8 lg:p-10">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                            Last updated {activeDocument.updatedAt}
                        </p>
                        <h2 className="mt-3 text-3xl font-bold text-[#1f2944] sm:text-4xl">
                            {activeDocument.title}
                        </h2>
                        <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">
                            {activeDocument.summary}
                        </p>

                        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-900">
                            Replace all bracketed placeholders before publishing. This draft is meant to be reviewed and finalized with legal counsel for your jurisdiction.
                        </div>

                        <div className="mt-8 space-y-8">
                            {activeDocument.sections.map((section) => (
                                <section key={section.heading} className="border-t border-slate-100 pt-8 first:border-t-0 first:pt-0">
                                    <h3 className="text-xl font-semibold text-[#1f2944]">{section.heading}</h3>

                                    {section.paragraphs?.map((paragraph) => (
                                        <p key={paragraph} className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                                            {paragraph}
                                        </p>
                                    ))}

                                    {section.bullets && (
                                        <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600 sm:text-base">
                                            {section.bullets.map((bullet) => (
                                                <li key={bullet} className="flex gap-3">
                                                    <span className="mt-2 h-2.5 w-2.5 flex-none rounded-full bg-[#0d4ea8]" aria-hidden="true" />
                                                    <span>{bullet}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </section>
                            ))}
                        </div>
                    </article>
                </div>

                <LegalFooter className="mt-6" />
            </div>
        </div>
    );
}