import { Link } from 'react-router-dom';
import LegalFooter from '../components/common/LegalFooter';

const faqSections = [
    {
        title: 'Money and Payments',
        items: [
            {
                question: 'When is a customer charged?',
                answer:
                    'Customers are charged during checkout. Depending on the rental partner settings, that can be the full amount immediately or a downpayment first with the remaining balance collected before delivery.',
            },
            {
                question: 'When does a rental partner receive money?',
                answer:
                    'Rental partner earnings are released only after delivery is confirmed and the booking has met the platform payout rules. Early orders may be held briefly for marketplace safety.',
            },
            {
                question: 'What happens if a booking is cancelled?',
                answer:
                    'Refund amount depends on timing and the platform cancellation rules. Customers should review the cancellation terms shown on the booking before confirming cancellation.',
            },
            {
                question: 'What should users watch closely in money-related steps?',
                answer:
                    'Customers should verify the total amount, payment stage, and cancellation terms. Rental partners should monitor booking payment status, payout readiness, and any disputes that can delay release.',
            },
        ],
    },
    {
        title: 'Booking Process',
        items: [
            {
                question: 'What is the usual booking flow?',
                answer:
                    'The normal flow is: customer selects items, chooses dates and delivery details, pays, rental partner confirms, delivery happens, customer confirms delivery, then payout is released.',
            },
            {
                question: 'Why does a booking stay pending?',
                answer:
                    'A booking may stay pending because payment is incomplete, the rental partner has not confirmed it yet, or additional action is needed before fulfillment.',
            },
            {
                question: 'When is a booking considered complete?',
                answer:
                    'A booking is considered complete after delivery has been successfully fulfilled and the customer confirms receipt, or after the platform otherwise marks the booking closed under policy rules.',
            },
        ],
    },
    {
        title: 'Rental Partner Controls',
        items: [
            {
                question: 'What can a rental partner control?',
                answer:
                    'Rental partners control their listings, quantities, pricing, delivery-related settings, booking acceptance, payout visibility, and supporting evidence for disputes.',
            },
            {
                question: 'Can rental partners choose how customers pay?',
                answer:
                    'Yes. Rental partners can configure whether bookings require full payment or a downpayment flow, based on the controls available in their account.',
            },
            {
                question: 'How should rental partners reduce payout issues?',
                answer:
                    'Keep pricing current, confirm only bookings you can fulfill, upload delivery proof promptly, and respond quickly to disputes or verification requests.',
            },
        ],
    },
    {
        title: 'Customer Controls',
        items: [
            {
                question: 'What can a customer control before paying?',
                answer:
                    'Customers can choose items, rental dates, delivery details, and review the total amount before proceeding to checkout.',
            },
            {
                question: 'What can a customer control after booking?',
                answer:
                    'Customers can track booking progress, review cancellation terms, raise disputes when needed, confirm delivery, and leave reviews after completion.',
            },
            {
                question: 'What should customers avoid?',
                answer:
                    'Customers should avoid confirming delivery before receiving the items in acceptable condition, and should avoid waiting too long before raising a dispute if something goes wrong.',
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
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#b7e92f]">RentalBasic Help</p>
                        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Frequently Asked Questions</h1>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
                            Quick answers about payments, booking flow, rental partner controls, and customer actions.
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