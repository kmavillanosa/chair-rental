import { Link, useLocation } from 'react-router-dom';

const legalLinks = [
    { to: '/legal/terms-of-service', label: 'Terms of Service' },
    { to: '/legal/vendor-agreement', label: 'Rental Partner Agreement' },
    { to: '/legal/platform-commission-policy', label: 'Commission Policy' },
    { to: '/legal/liability-disclaimer', label: 'Liability Disclaimer' },
];

type LegalFooterProps = {
    variant?: 'light' | 'dark';
    className?: string;
};

export default function LegalFooter({ variant = 'light', className = '' }: LegalFooterProps) {
    const location = useLocation();
    const isDark = variant === 'dark';

    return (
        <footer
            className={`rounded-2xl border px-4 py-4 sm:px-5 ${isDark
                ? 'border-white/12 bg-white/6 text-slate-200'
                : 'border-slate-200 bg-white text-slate-600 shadow-sm'} ${className}`.trim()}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${isDark ? 'text-amber-200' : 'text-slate-500'}`}>
                        Legal
                    </p>
                    <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                        Review the policies covering bookings, rental partners, commissions, and liability.
                    </p>
                </div>

                <nav aria-label="Legal documents" className="flex flex-wrap gap-2">
                    {legalLinks.map((link) => {
                        const isActive = location.pathname === link.to;

                        return (
                            <Link
                                key={link.to}
                                to={link.to}
                                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${isDark
                                    ? isActive
                                        ? 'border-amber-300/70 bg-amber-300/15 text-amber-100'
                                        : 'border-white/15 text-slate-200 hover:border-white/30 hover:bg-white/8 hover:text-white'
                                    : isActive
                                        ? 'border-[#2d3f63] bg-[#1f2944] text-white'
                                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'}`}
                            >
                                {link.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </footer>
    );
}