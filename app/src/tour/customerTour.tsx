import type { StepType } from '@reactour/tour';
import type { TFunction } from 'i18next';

export function getCustomerTourSteps(t: TFunction): StepType[] {
    return [
        {
            selector: '[data-tour="guide-button"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{t('tour.customer.step1.title')}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-200">{t('tour.customer.step1.body')}</p>
                </div>
            ),
        },
        {
            selector: '[data-tour="header-brand"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{t('tour.customer.step2.title')}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-200">{t('tour.customer.step2.body')}</p>
                </div>
            ),
        },
        {
            selector: '[data-tour="main-content"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{t('tour.customer.step3.title')}</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-200">
                        <li>{t('tour.customer.step3.bullet1')}</li>
                        <li>{t('tour.customer.step3.bullet2')}</li>
                        <li>{t('tour.customer.step3.bullet3')}</li>
                    </ul>
                </div>
            ),
        },
        {
            selector: '[data-tour="main-content"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{t('tour.customer.step4.title')}</h3>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-200">
                        <li>{t('tour.customer.step4.bullet1')}</li>
                        <li>{t('tour.customer.step4.bullet2')}</li>
                        <li>{t('tour.customer.step4.bullet3')}</li>
                        <li>{t('tour.customer.step4.bullet4')}</li>
                    </ol>
                </div>
            ),
        },
        {
            selector: '[data-tour="header-nav"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{t('tour.customer.step5.title')}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-200">{t('tour.customer.step5.body')}</p>
                </div>
            ),
        },
        {
            selector: '[data-tour="main-content"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{t('tour.customer.step6.title')}</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-200">
                        <li>{t('tour.customer.step6.bullet1')}</li>
                        <li>{t('tour.customer.step6.bullet2')}</li>
                        <li>{t('tour.customer.step6.bullet3')}</li>
                        <li>{t('tour.customer.step6.bullet4')}</li>
                        <li>{t('tour.customer.step6.bullet5')}</li>
                    </ul>
                </div>
            ),
        },
        {
            selector: '[data-tour="header-nav"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{t('tour.customer.step7.title')}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-200">{t('tour.customer.step7.body')}</p>
                </div>
            ),
        },
        {
            selector: '[data-tour="footer-legal"]',
            content: (
                <div>
                    <h3 className="text-base font-semibold text-white">{t('tour.customer.step8.title')}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-200">{t('tour.customer.step8.body')}</p>
                </div>
            ),
        },
    ];
}
