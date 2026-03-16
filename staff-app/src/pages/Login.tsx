import { loginWithGoogle } from '../api/auth';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function Login() {
  const [searchParams] = useSearchParams();
  const authError = useMemo(() => searchParams.get('error')?.trim() || '', [searchParams]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eef2f4] text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(17,126,131,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(255,133,27,0.14),_transparent_34%)]" />
      <div className="absolute -left-20 top-14 h-64 w-64 rounded-full bg-[#0b7679]/10 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-[#ff8a1f]/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="relative overflow-hidden rounded-[2rem] bg-[#0d6f73] px-6 py-8 text-white shadow-[0_30px_80px_rgba(13,111,115,0.22)] sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),transparent_42%,rgba(255,255,255,0.04))]" />
            <div className="absolute right-[-3.5rem] top-[-3rem] h-40 w-40 rounded-full border border-white/15" />
            <div className="absolute bottom-[-4rem] left-[-1.5rem] h-52 w-52 rounded-full border border-white/10" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/90">
                RentalBasic Ops
              </div>

              <h1 className="mt-6 max-w-2xl font-display text-4xl font-semibold leading-[0.95] text-white sm:text-5xl lg:text-6xl">
                Staff portal for bookings, payouts, KYC, and inventory control.
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-6 text-white/78 sm:text-base">
                Use one Google sign-in to access the admin and vendor workspace for daily operations,
                approvals, disputes, pricing, and storefront management.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ffcf9f]">Admin</p>
                  <p className="mt-2 text-lg font-semibold text-white">Review vendors</p>
                  <p className="mt-1 text-sm text-white/70">KYC decisions, payouts, disputes, fraud alerts.</p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c9f1ef]">Vendor</p>
                  <p className="mt-2 text-lg font-semibold text-white">Run the shop</p>
                  <p className="mt-1 text-sm text-white/70">Inventory, pricing, bookings, location, and chat.</p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ffe7c6]">Live ops</p>
                  <p className="mt-2 text-lg font-semibold text-white">Track activity</p>
                  <p className="mt-1 text-sm text-white/70">See what needs action without jumping between tools.</p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-2 text-xs font-medium text-white/80 sm:text-sm">
                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5">Vendor onboarding</span>
                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5">Payment operations</span>
                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5">Catalog and pricing</span>
                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5">Booking support</span>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.10)] backdrop-blur sm:p-8 lg:p-10">
            <div className="flex h-full flex-col justify-between">
              <div>
                <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Secure Access
                </div>

                <h2 className="mt-5 font-display text-3xl font-semibold text-slate-900 sm:text-4xl">
                  Staff Portal
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">
                  Sign in with the Google account linked to your approved admin or vendor profile.
                </p>

                {authError && (
                  <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {authError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={loginWithGoogle}
                  className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                >
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </button>

                <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  <p className="font-semibold text-slate-700">Before you sign in</p>
                  <p className="mt-1 leading-6">
                    Only approved vendor accounts and admins can access this workspace. If your Google account
                    was just approved, sign out and retry once to refresh your role.
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-2 border-t border-slate-100 pt-5 text-xs font-medium text-slate-400">
                <span className="rounded-full bg-slate-100 px-3 py-1.5">Google SSO</span>
                <span className="rounded-full bg-slate-100 px-3 py-1.5">Role-aware routing</span>
                <span className="rounded-full bg-slate-100 px-3 py-1.5">Admin + Vendor access</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
