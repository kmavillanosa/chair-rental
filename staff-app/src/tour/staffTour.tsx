import type { StepType } from '@reactour/tour';
import { getStaffTourText } from './staffTourText';

function adminSteps(): StepType[] {
    const text = getStaffTourText();

    return [
        {
            selector: '[data-tour="staff-guide-button"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{text.admin.step1Title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                        {text.admin.step1Body}
                    </p>
                </div>
            ),
        },
        {
            selector: '[data-tour="staff-sidebar"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{text.admin.step2Title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                        {text.admin.step2Body}
                    </p>
                </div>
            ),
        },
        {
            selector: '[data-tour="staff-main-content"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{text.admin.step3Title}</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-200">
                        <li>{text.admin.step3Item1}</li>
                        <li>{text.admin.step3Item2}</li>
                        <li>{text.admin.step3Item3}</li>
                    </ul>
                </div>
            ),
        },
        {
            selector: '[data-tour="staff-main-content"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{text.admin.step4Title}</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-200">
                        <li>{text.admin.step4Item1}</li>
                        <li>{text.admin.step4Item2}</li>
                        <li>{text.admin.step4Item3}</li>
                    </ul>
                </div>
            ),
        },
        {
            selector: '[data-tour="staff-main-content"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{text.admin.step5Title}</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-200">
                        <li>{text.admin.step5Item1}</li>
                        <li>{text.admin.step5Item2}</li>
                        <li>{text.admin.step5Item3}</li>
                    </ul>
                </div>
            ),
        },
        {
            selector: '[data-tour="staff-legal-footer"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{text.admin.step6Title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                        {text.admin.step6Body}
                    </p>
                </div>
            ),
        },
    ];
}

function vendorSteps(): StepType[] {
    const text = getStaffTourText();

    return [
        {
            selector: '[data-tour="staff-guide-button"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{text.vendor.step1Title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                        {text.vendor.step1Body}
                    </p>
                </div>
            ),
        },
        {
            selector: '[data-tour="staff-sidebar"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{text.vendor.step2Title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                        {text.vendor.step2Body}
                    </p>
                </div>
            ),
        },
        {
            selector: '[data-tour="staff-main-content"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{text.vendor.step3Title}</h3>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-200">
                        <li>{text.vendor.step3Item1}</li>
                        <li>{text.vendor.step3Item2}</li>
                        <li>{text.vendor.step3Item3}</li>
                        <li>{text.vendor.step3Item4}</li>
                    </ol>
                </div>
            ),
        },
        {
            selector: '[data-tour="staff-main-content"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{text.vendor.step4Title}</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-200">
                        <li>{text.vendor.step4Item1}</li>
                        <li>{text.vendor.step4Item2}</li>
                        <li>{text.vendor.step4Item3}</li>
                    </ul>
                </div>
            ),
        },
        {
            selector: '[data-tour="staff-main-content"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{text.vendor.step5Title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                        {text.vendor.step5Body}
                    </p>
                </div>
            ),
        },
        {
            selector: '[data-tour="staff-legal-footer"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{text.vendor.step6Title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                        {text.vendor.step6Body}
                    </p>
                </div>
            ),
        },
    ];
}

function fallbackSteps(): StepType[] {
    const text = getStaffTourText();

    return [
        {
            selector: '[data-tour="staff-guide-button"]',
            content: text.common.openGuideAfterSignIn,
        },
    ];
}

export function getStaffTourSteps(role?: string): StepType[] {
    if (role === 'admin') return adminSteps();
    if (role === 'vendor') return vendorSteps();
    return fallbackSteps();
}
