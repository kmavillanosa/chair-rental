import { Link } from 'react-router-dom';
import LegalFooter from '../components/common/LegalFooter';

const faqSections = [
    {
        title: 'Money and Settlement Visibility',
        items: [
            {
                question: 'What money-related items should staff watch first?',
                answer:
                    'Watch booking payment stage, payout readiness, cancellations, refund-sensitive bookings, and disputes that can block or delay release.',
            },
            {
                question: 'Why might payout release be delayed?',
                answer:
                    'Release can be delayed by incomplete delivery confirmation, unresolved disputes, risk review, early-order hold policies, or other marketplace safety checks.',
            },
            {
                question: 'Can staff see whether a booking is fully paid or still in stages?',
                answer:
                    'Yes. Staff should use the payment-related booking indicators to confirm whether a booking is unpaid, partially paid, fully secured, refunded, or under dispute review.',
            },
        ],
    },
    {
        title: 'Operational Process',
        items: [
            {
                question: 'What is the standard operations flow?',
                answer:
                    'The normal sequence is booking creation, payment completion, rental partner confirmation, delivery fulfillment, customer confirmation, then payout release when eligible.',
            },
            {
                question: 'What causes operational blockers?',
                answer:
                    'Common blockers are missing confirmation, stale inventory, incomplete proof of delivery, pending disputes, or a required customer action that has not happened yet.',
            },
            {
                question: 'What should staff do when a booking looks stuck?',
                answer:
                    'Check the payment stage, booking status, fulfillment notes, dispute state, and whether either party still needs to act before escalating further.',
            },
        ],
    },
    {
        title: 'Rental Partner Controls',
        items: [
            {
                question: 'What can rental partners directly control?',
                answer:
                    'Rental partners control listings, inventory, pricing, delivery settings, booking acceptance, payout monitoring, and the submission of operational proof or dispute evidence.',
            },
            {
                question: 'What controls most affect money flow?',
                answer:
                    'Payment mode, accurate pricing, timely booking confirmation, delivery proof, and fast dispute response have the biggest effect on payout timing and exception handling.',
            },
            {
                question: 'What should rental partners do before marking a job complete?',
                answer:
                    'They should make sure delivery really happened, supporting proof is available, and the booking record reflects the actual fulfillment stage.',
            },
        ],
    },
    {
        title: 'Customer Controls',
        items: [
            {
                question: 'What can customers still control after booking?',
                answer:
                    'Customers can track progress, complete pending payment steps, review cancellation impact, raise disputes, confirm delivery, and leave reviews where available.',
            },
            {
                question: 'What customer action most affects payout release?',
                answer:
                    'Delivery confirmation is the most important customer-controlled step because it signals successful fulfillment and allows the payout workflow to progress.',
            },
            {
                question: 'When should staff guide customers to use support or disputes?',
                answer:
                    'Customers should be guided to dispute or support flows when delivery quality, non-fulfillment, missing items, or refund disagreements cannot be resolved directly.',
            },
        ],
    },
];

export default function FaqPage() {
    return (
        <div className="min-h-screen bg-[#eef2f8] text-[#1f2944]">
            <div className="border-b border-[#d7dfec] bg-[#1f2944] text-white">
                <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#b7e92f]">RentalBasic Operations Help</p>
                        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Operations FAQ</h1>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
                            Reference answers for payment-sensitive workflows, fulfillment process, rental partner controls, and customer-controlled actions.
                        </p>
                    </div>

                    <Link
                        to="/"
                        className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                        Back to portal
                    </Link>
                </div>
            </div>

            <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="space-y-6">
                    {faqSections.map((section) => (
                        <section key={section.title} className="rounded-[2rem] border border-[#d7dfec] bg-white p-6 shadow-sm sm:p-8">
                            <h2 className="text-2xl font-bold text-[#1f2944]">{section.title}</h2>
                            <div className="mt-6 space-y-4">
                                {section.items.map((item) => (
                                    <details key={item.question} className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                                        <summary className="cursor-pointer list-none text-base font-semibold text-[#1f2944]">
                                            {item.question}
                                        </summary>
                                        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">{item.answer}</p>
                                    </details>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                <LegalFooter className="mt-6" />
            </div>
        </div>
    );
}