import { useTranslation } from 'react-i18next';

interface LanguageSwitcherProps {
    className?: string;
    compact?: boolean;
}

export default function LanguageSwitcher({ className = '', compact = false }: LanguageSwitcherProps) {
    const { t, i18n } = useTranslation();
    const activeLanguage = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'tl';

    const baseButtonClass = compact
        ? 'px-2 py-1 text-xs font-semibold'
        : 'px-3 py-1.5 text-sm font-semibold';

    return (
        <div className={`inline-flex items-center rounded-lg border border-slate-300 bg-white/95 p-0.5 shadow-sm ${className}`.trim()}>
            <button
                type="button"
                onClick={() => void i18n.changeLanguage('tl')}
                className={`${baseButtonClass} rounded-md transition ${activeLanguage === 'tl' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                aria-label={t('language.tagalog')}
            >
                {compact ? t('language.shortTagalog') : t('language.tagalog')}
            </button>
            <button
                type="button"
                onClick={() => void i18n.changeLanguage('en')}
                className={`${baseButtonClass} rounded-md transition ${activeLanguage === 'en' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                aria-label={t('language.english')}
            >
                {compact ? t('language.shortEnglish') : t('language.english')}
            </button>
        </div>
    );
}
