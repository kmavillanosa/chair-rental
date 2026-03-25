export interface StaffTourText {
  common: {
    infoButton: string;
    openVendorGuideAriaLabel: string;
    openAdminGuideAriaLabel: string;
    openVendorGuideTitle: string;
    openAdminGuideTitle: string;
    openGuideAfterSignIn: string;
  };
  vendor: {
    panelLabel: string;
    step1Title: string;
    step1Body: string;
    step2Title: string;
    step2Body: string;
    step3Title: string;
    step3Item1: string;
    step3Item2: string;
    step3Item3: string;
    step3Item4: string;
    step4Title: string;
    step4Item1: string;
    step4Item2: string;
    step4Item3: string;
    step5Title: string;
    step5Body: string;
    step6Title: string;
    step6Body: string;
  };
  admin: {
    panelLabel: string;
    step1Title: string;
    step1Body: string;
    step2Title: string;
    step2Body: string;
    step3Title: string;
    step3Item1: string;
    step3Item2: string;
    step3Item3: string;
    step4Title: string;
    step4Item1: string;
    step4Item2: string;
    step4Item3: string;
    step5Title: string;
    step5Item1: string;
    step5Item2: string;
    step5Item3: string;
    step6Title: string;
    step6Body: string;
  };
}

const EN_TEXT: StaffTourText = {
  common: {
    infoButton: 'Info',
    openVendorGuideAriaLabel: 'Open vendor guide',
    openAdminGuideAriaLabel: 'Open admin guide',
    openVendorGuideTitle: 'How to use vendor portal',
    openAdminGuideTitle: 'How to use admin portal',
    openGuideAfterSignIn: 'Open this guide after signing in as vendor or admin for role-specific instructions.',
  },
  vendor: {
    panelLabel: 'Vendor Panel',
    step1Title: 'Vendor Guide',
    step1Body: 'Use this guide for day-to-day vendor operations: setup shop, manage inventory, process bookings, and monitor payouts.',
    step2Title: 'Vendor Navigation',
    step2Body: 'Use Overview, Inventory, Bookings, Pricing, Vehicles, My Shop, and Payments to run your rental operations from one panel.',
    step3Title: 'Setup Workflow',
    step3Item1: 'Complete your shop profile and map location.',
    step3Item2: 'Add inventory with quantity, rate, and color variants.',
    step3Item3: 'Upload item gallery photos and list delivery vehicles.',
    step3Item4: 'Set distance and helper pricing tiers.',
    step4Title: 'Booking Lifecycle',
    step4Item1: 'Review booking list or calendar, then confirm or cancel pending requests.',
    step4Item2: 'Mark confirmed jobs as complete when service is done.',
    step4Item3: 'Use booking details to chat, upload proof, review customers, and open disputes.',
    step5Title: 'Payments and Payout Queue',
    step5Body: 'Track billing obligations and payout releases. New vendors have payout hold windows until they pass the completed-orders threshold configured by admin.',
    step6Title: 'Terms and Policies',
    step6Body: 'Review legal links for cancellation, disputes, and payout policy references that affect customer communication and operations.',
  },
  admin: {
    panelLabel: 'Admin Panel',
    step1Title: 'Admin Guide',
    step1Body: 'Use this guide to quickly review moderation, operations, finance, risk, and platform settings from your admin workspace.',
    step2Title: 'Navigation and Control Areas',
    step2Body: 'The sidebar gives access to Customers, Applicants, Vendors, Item Types, Brands, Payments, Fraud Alerts, Disputes, and Feature Flags.',
    step3Title: 'Core Admin Use Cases',
    step3Item1: 'Review and approve/decline vendor KYC applications.',
    step3Item2: 'Moderate vendors with verify, warn, suspend, and suspicious-flag actions.',
    step3Item3: 'Manage customers and perform account impersonation for support.',
    step4Title: 'Payments and Payout Operations',
    step4Item1: 'Create and track vendor billing records.',
    step4Item2: 'Mark billing records as overdue or paid.',
    step4Item3: 'Release ready vendor payouts after delivery confirmation.',
    step5Title: 'Risk, Disputes, and Policy Controls',
    step5Item1: 'Triage fraud alerts by status and type.',
    step5Item2: 'Resolve disputes with full refund, partial refund, or release-to-vendor outcomes.',
    step5Item3: 'Update feature flags, cancellation policy, and KYC onboarding toggles.',
    step6Title: 'Compliance and Legal',
    step6Body: 'Keep legal links handy for terms and policy references while resolving disputes, moderation actions, and payout decisions.',
  },
};

const TL_TEXT: StaffTourText = {
  common: {
    infoButton: 'Info',
    openVendorGuideAriaLabel: 'Buksan ang vendor guide',
    openAdminGuideAriaLabel: 'Buksan ang admin guide',
    openVendorGuideTitle: 'Paano gamitin ang vendor portal',
    openAdminGuideTitle: 'Paano gamitin ang admin portal',
    openGuideAfterSignIn: 'Buksan ang guide na ito pagkatapos mag-sign in bilang vendor o admin para sa role-specific na instructions.',
  },
  vendor: {
    panelLabel: 'Vendor Panel',
    step1Title: 'Vendor Guide',
    step1Body: 'Gamitin ang guide na ito para sa araw-araw na vendor operations: setup ng shop, inventory management, booking processing, at payout monitoring.',
    step2Title: 'Vendor Navigation',
    step2Body: 'Gamitin ang Overview, Inventory, Bookings, Pricing, Vehicles, My Shop, at Payments para patakbuhin ang rental operations mo sa isang panel.',
    step3Title: 'Setup Workflow',
    step3Item1: 'Kumpletuhin ang shop profile at map location mo.',
    step3Item2: 'Magdagdag ng inventory na may quantity, rate, at color variants.',
    step3Item3: 'Mag-upload ng item gallery photos at ilista ang delivery vehicles.',
    step3Item4: 'I-set ang distance at helper pricing tiers.',
    step4Title: 'Booking Lifecycle',
    step4Item1: 'I-review ang booking list o calendar, tapos i-confirm o i-cancel ang pending requests.',
    step4Item2: 'I-mark na complete ang confirmed jobs kapag tapos na ang service.',
    step4Item3: 'Gamitin ang booking details para mag-chat, mag-upload ng proof, mag-review ng customers, at mag-open ng disputes.',
    step5Title: 'Payments at Payout Queue',
    step5Body: 'I-track ang billing obligations at payout releases. Ang new vendors ay may payout hold hanggang maabot nila ang completed-orders threshold na naka-configure ng admin.',
    step6Title: 'Terms at Policies',
    step6Body: 'I-review ang legal links para sa cancellation, disputes, at payout policy references na nakaapekto sa customer communication at operations.',
  },
  admin: {
    panelLabel: 'Admin Panel',
    step1Title: 'Admin Guide',
    step1Body: 'Gamitin ang guide na ito para mabilis mong ma-review ang moderation, operations, finance, risk, at platform settings sa admin workspace mo.',
    step2Title: 'Navigation at Control Areas',
    step2Body: 'Ang sidebar ay may access sa Customers, Applicants, Vendors, Item Types, Brands, Payments, Fraud Alerts, Disputes, at Feature Flags.',
    step3Title: 'Core Admin Use Cases',
    step3Item1: 'I-review at i-approve/i-decline ang vendor KYC applications.',
    step3Item2: 'I-moderate ang vendors gamit ang verify, warn, suspend, at suspicious-flag actions.',
    step3Item3: 'I-manage ang customers at gumamit ng account impersonation para sa support.',
    step4Title: 'Payments at Payout Operations',
    step4Item1: 'Gumawa at mag-track ng vendor billing records.',
    step4Item2: 'I-mark ang billing records bilang overdue o paid.',
    step4Item3: 'I-release ang ready vendor payouts pagkatapos ng delivery confirmation.',
    step5Title: 'Risk, Disputes, at Policy Controls',
    step5Item1: 'I-triage ang fraud alerts ayon sa status at type.',
    step5Item2: 'I-resolve ang disputes gamit ang full refund, partial refund, o release-to-vendor outcomes.',
    step5Item3: 'I-update ang feature flags, cancellation policy, at KYC onboarding toggles.',
    step6Title: 'Compliance at Legal',
    step6Body: 'Panatilihing accessible ang legal links para sa terms at policy references habang nagre-resolve ng disputes, moderation actions, at payout decisions.',
  },
};

function detectStaffLanguage(): 'en' | 'tl' {
  if (typeof window === 'undefined') return 'en';

  try {
    const stored = window.localStorage.getItem('chair-rental-language') || window.localStorage.getItem('i18nextLng');
    if (stored?.toLowerCase().startsWith('tl')) return 'tl';
    if (stored?.toLowerCase().startsWith('en')) return 'en';
  } catch {
    // ignore storage access issues and fall through to navigator language
  }

  return window.navigator.language.toLowerCase().startsWith('tl') ? 'tl' : 'en';
}

export function getStaffTourText(): StaffTourText {
  return detectStaffLanguage() === 'tl' ? TL_TEXT : EN_TEXT;
}
