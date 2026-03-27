export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  slug: string;
  title: string;
  summary: string;
  updatedAt: string;
  sections: LegalSection[];
};

export const defaultLegalDocumentSlug = 'terms-of-service';

export const legalDocuments: LegalDocument[] = [
  {
    slug: 'terms-of-service',
    title: 'Terms of Service',
    summary:
      'These terms define how customers, rental partners, and platform operators use the marketplace, book rentals, process payments, and handle disputes.',
    updatedAt: 'March 15, 2026',
    sections: [
      {
        heading: 'Operator',
        paragraphs: [
          'This platform is operated by Kim Cyriel Samaniego Avillanosa, an individual or sole proprietor doing business as RentalBasic.',
          'Replace all bracketed placeholders before publishing these terms in production.',
        ],
      },
      {
        heading: 'Marketplace Scope',
        paragraphs: [
          'The platform connects customers with independent rental partners offering chairs, tables, tents, audiovisual equipment, decor, and related event rentals.',
          'Unless stated otherwise in writing, the platform does not own, store, transport, install, or insure listed inventory.',
        ],
      },
      {
        heading: 'Account and Usage Rules',
        bullets: [
          'Users must be at least 18 years old and legally capable of entering contracts.',
          'Account information must be accurate and kept current.',
          'Users must keep login credentials secure and avoid unlawful or abusive activity.',
          'Platform-generated leads and transactions must not be diverted to avoid platform fees without written approval.',
        ],
      },
      {
        heading: 'Bookings and Payments',
        paragraphs: [
          'Booking totals can include item charges, delivery, service fees, taxes if applicable, and other disclosed charges.',
          'Where checkout is enabled, payments may be processed by third parties such as PayMongo and remain subject to the payment processor\'s rules.',
        ],
        bullets: [
          'The platform may delay, reverse, or hold settlement for fraud review, chargebacks, duplicate payments, legal claims, or safety issues.',
          'Cancellation and refund outcomes follow the booking details, configured cancellation settings, and applicable law.',
        ],
      },
      {
        heading: 'Suspension and Termination',
        paragraphs: [
          'The platform may suspend access, remove listings, cancel incomplete bookings, or freeze payouts when reasonably necessary to enforce policy, protect users, investigate fraud, or comply with law.',
        ],
      },
      {
        heading: 'Disclaimers and Liability Limits',
        paragraphs: [
          'The platform is provided on an as-is and as-available basis to the maximum extent allowed by law.',
          'The operator does not guarantee rental partner performance, uninterrupted service, error-free operation, or the quality and legality of any listing.',
        ],
        bullets: [
          'Indirect, incidental, consequential, or punitive damages are excluded where legally permitted.',
          'Aggregate platform liability should be capped in the published terms using a specific peso amount or fee-based formula.',
        ],
      },
      {
        heading: 'Governing Law and Contact',
        paragraphs: [
          'Set the governing law, court venue, legal notice address, support email, and support phone before launch.',
        ],
      },
    ],
  },
  {
    slug: 'vendor-agreement',
    title: 'Rental Partner Agreement',
    summary:
      'This agreement sets the rules for rental partner onboarding, listings, fulfillment, payout handling, commission deductions, and rental partner compliance responsibilities.',
    updatedAt: 'March 15, 2026',
    sections: [
      {
        heading: 'Parties and Purpose',
        paragraphs: [
          'This agreement is between Kim Cyriel Samaniego Avillanosa, doing business as RentalBasic, and the rental partner using the platform.',
          'The rental partner appoints the platform on a non-exclusive basis to host listings, accept booking requests, and facilitate payment flows where supported.',
        ],
      },
      {
        heading: 'Rental Partner Eligibility',
        bullets: [
          'The rental partner must be legally authorized to operate the business it presents on the platform.',
          'The rental partner must hold required permits, registrations, tax records, and payout details.',
          'Listed inventory must be lawfully owned, leased, or controlled by the rental partner.',
          'The platform may request KYC documents, merchant onboarding information, and business records at any time.',
        ],
      },
      {
        heading: 'Listings and Fulfillment',
        paragraphs: [
          'Rental partners are responsible for keeping listings accurate, including price, quantity, condition, availability, business location, and delivery scope.',
        ],
        bullets: [
          'Rental partners remain responsible for transport, setup, retrieval, maintenance, replacements, and event-day execution.',
          'Rental partners must not misrepresent stock, overbook, submit false permits, or route platform leads off-platform to avoid fees.',
        ],
      },
      {
        heading: 'Commission, Payouts, and Holds',
        paragraphs: [
          'Rental partner charges may be subject to the Platform Commission Policy and any rental partner-specific written commercial terms.',
          'The platform may deduct commission automatically before settlement when payout splitting or processor routing is enabled.',
        ],
        bullets: [
          'Payouts may be delayed or offset for refunds, chargebacks, fraud checks, customer claims, or outstanding rental partner balances.',
          'You should state the standard payout schedule explicitly before publishing this agreement.',
        ],
      },
      {
        heading: 'Taxes, Insurance, and Risk',
        paragraphs: [
          'Rental partners are responsible for their own taxes, invoices, labor obligations, permits, insurance, and operating risks unless a written agreement says otherwise.',
        ],
      },
      {
        heading: 'Termination and Indemnity',
        paragraphs: [
          'The platform may suspend or remove rental partners for fraud, unsafe conduct, repeated complaints, fulfillment failures, or material policy breaches.',
          'Rental partners should indemnify the platform and operator for claims arising from their inventory, personnel, deliveries, setup work, or legal non-compliance.',
        ],
      },
    ],
  },
  {
    slug: 'platform-commission-policy',
    title: 'Platform Commission Policy',
    summary:
      'This policy explains how the platform calculates commission, what parts of a booking are commissionable, and how deductions or adjustments are handled.',
    updatedAt: 'March 15, 2026',
    sections: [
      {
        heading: 'Default Commission Structure',
        paragraphs: [
          'The platform currently supports a default commission driven by platform settings, with a default starting point of 10% of the item rental subtotal.',
        ],
      },
      {
        heading: 'Commission Base',
        paragraphs: [
          'Under the current implementation, commission is calculated on the item rental subtotal only.',
        ],
        bullets: [
          'Delivery charges are excluded by default.',
          'Service charges are excluded by default.',
          'Processor penalties, chargeback fees, and other pass-through costs can be handled separately.',
        ],
      },
      {
        heading: 'Rental Partner-Specific Rates and Promotions',
        paragraphs: [
          'A rental partner-specific rate may override the default rate where stored in rental partner settings or agreed in writing.',
          'The platform also supports an admin-controlled no-commission mode with an optional end date.',
        ],
      },
      {
        heading: 'When Commission Is Calculated',
        paragraphs: [
          'Commission is normally locked at booking creation using the rate active at that time, unless adjustment is required for fraud, refunds, pricing errors, or chargebacks.',
        ],
      },
      {
        heading: 'Collection and Offsets',
        bullets: [
          'Commission may be collected through split payments, payout deduction, future payout offsets, or direct invoicing.',
          'Refunded, disputed, reversed, or partially fulfilled bookings may trigger commission recalculation or offset.',
          'Processor fees are separate from platform commission unless you explicitly include them in a published commercial term.',
        ],
      },
      {
        heading: 'Notice of Changes',
        paragraphs: [
          'The operator may revise commission settings or policy text with reasonable notice through the platform, rental partner communications, or admin controls.',
        ],
      },
    ],
  },
  {
    slug: 'liability-disclaimer',
    title: 'Liability Disclaimer',
    summary:
      'This disclaimer clarifies that the platform is a marketplace, not the direct provider of rental partner inventory or event execution services.',
    updatedAt: 'March 15, 2026',
    sections: [
      {
        heading: 'Marketplace Position',
        paragraphs: [
          'The platform helps connect customers and independent rental partners. It does not, by default, manufacture, own, warehouse, transport, install, inspect, or insure rental partner inventory.',
        ],
      },
      {
        heading: 'No Guarantee of Performance',
        bullets: [
          'The platform does not guarantee rental partner acceptance, inventory availability, or on-time fulfillment.',
          'The platform does not guarantee that rented items are defect-free or fit for a specific event.',
          'The platform does not guarantee that rental partner permits, licenses, or insurance remain valid at all times.',
        ],
      },
      {
        heading: 'Customer and Rental Partner Responsibility',
        paragraphs: [
          'Customers remain responsible for confirming event details, reviewing listings, inspecting delivered items when possible, and obtaining any venue approval or insurance they need.',
          'Rental partners remain responsible for inventory condition, setup, retrieval, safety, transport, personnel, taxes, permits, and insurance.',
        ],
      },
      {
        heading: 'Third-Party Services and Downtime',
        paragraphs: [
          'The platform may depend on payment processors, maps, geocoding, authentication providers, hosting, messaging, and analytics rental partners.',
        ],
        bullets: [
          'The operator is not responsible for outages, rate limits, data delays, or service interruptions caused by those third parties.',
          'Downtime caused by maintenance, ISP issues, force majeure, security events, or processor outages should be excluded from liability where legally permitted.',
        ],
      },
      {
        heading: 'Individual Operator Protection',
        paragraphs: [
          'If the platform is run by an individual or sole proprietor, the published disclaimer should make clear that operational assistance by staff or contractors does not create separate personal liability for them.',
        ],
      },
      {
        heading: 'Professional Advice',
        paragraphs: [
          'Platform settings, fee logic, and policy notes are not legal, tax, insurance, or accounting advice. Users remain responsible for obtaining professional advice suited to their situation.',
        ],
      },
    ],
  },
];

export function getLegalDocumentBySlug(slug: string) {
  return legalDocuments.find((document) => document.slug === slug);
}
