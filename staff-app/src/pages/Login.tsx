import { loginWithGoogle } from '../api/auth';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function Login() {
  const [searchParams] = useSearchParams();
  const authError = useMemo(() => searchParams.get('error')?.trim() || '', [searchParams]);

  const workflowCards = [
    {
      title: 'Rental Partner Onboarding',
      subtitle: 'KYC + verification',
      description:
        'Review applicant records, validate submitted documents, and approve accounts with complete audit trail.',
    },
    {
      title: 'Booking Operations',
      subtitle: 'Calendar + disputes',
      description:
        'Track active reservations, handle escalations quickly, and keep delivery timelines visible across teams.',
    },
    {
      title: 'Payout Control',
      subtitle: 'Settlement monitoring',
      description:
        'See payout readiness, release funds, and investigate exceptions from one operations workspace.',
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#edf2f6] text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_22%,rgba(13,79,168,0.22),transparent_32%),radial-gradient(circle_at_84%_78%,rgba(42,182,232,0.14),transparent_28%)]" />
      <div className="absolute -left-16 top-12 h-72 w-72 rounded-full bg-[#1f2944]/10 blur-3xl" />
      <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-[#b7e92f]/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="order-2 hidden overflow-hidden rounded-[2rem] bg-[#1f2944] px-6 py-8 text-white shadow-[0_34px_90px_rgba(31,41,68,0.28)] lg:block sm:px-8 sm:py-10 lg:order-1 lg:px-10 lg:py-12">
            <div className="relative">
              <img src="/dark_logo.svg" alt="RentalBasic" className="h-14 w-auto sm:h-16" />


              <h1 className="mt-6 max-w-3xl font-display text-4xl font-semibold leading-[0.95] sm:text-5xl lg:text-6xl">
                One dashboard for rental partner approvals, bookings, and payout operations.
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
                Access the operations workspace where admin and rental partner teams can process KYC,
                monitor reservations, and keep marketplace workflows moving in real time.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {workflowCards.map((card) => (
                  <article
                    key={card.title}
                    className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b7e92f]">
                      {card.subtitle}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">{card.title}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-200/85">{card.description}</p>
                  </article>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-2 text-xs font-medium text-white/85 sm:text-sm">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Google SSO</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Role-aware access</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Admin + Rental Partner portal</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Actionable operations view</span>
              </div>
            </div>
          </section>

          <section className="order-1 rounded-[2rem] border border-slate-200/80 bg-white/92 p-6 shadow-[0_26px_70px_rgba(15,23,42,0.14)] backdrop-blur sm:p-8 lg:order-2 lg:p-10">
            <div className="flex h-full flex-col justify-between">
              <div>
                <img src="/dark_logo.svg" alt="RentalBasic" className="mb-6 h-10 w-auto lg:hidden sm:h-12" />

                <a
                  href="https://rentalbasic.com"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back to RentalBasic
                </a>

                <div className="mt-6 inline-flex items-center rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#1f2944]">
                  Secure Sign-in
                </div>

                <h2 className="mt-5 font-display text-3xl font-semibold text-slate-900 sm:text-4xl">
                  Welcome Back
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">
                  Continue with the Google account linked to your approved admin or rental partner profile.
                </p>

                {authError && (
                  <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {authError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={loginWithGoogle}
                  className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border border-[#1f2944]/15 bg-[#1f2944] px-5 py-4 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(31,41,68,0.22)] transition hover:-translate-y-0.5 hover:bg-[#243153]"
                >
                  <svg className="h-5 w-5 shrink-0 rounded-full bg-white p-0.5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </button>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-800">Access notes</p>
                  <ul className="mt-2 space-y-1.5 leading-6">
                    <li>Only approved admin and rental partner accounts can enter this portal.</li>
                    <li>If your role was updated recently, sign out and retry once.</li>
                    <li>Use the same Google account tied to your platform profile.</li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 border-t border-slate-100 pt-5 text-xs text-slate-400">
                Protected workspace with role-based routing and centralized operations access.
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
