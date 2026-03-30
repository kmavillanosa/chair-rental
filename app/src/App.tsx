import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { TourProvider } from '@reactour/tour'
import { useAuthStore } from './store/authStore'
import { getFeatureFlagsSettings } from './api/settings'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import AdminDashboard from './pages/admin/AdminDashboard'
import VendorsList from './pages/admin/VendorsList'
import ItemTypesList from './pages/admin/ItemTypesList'
import BrandsList from './pages/admin/BrandsList'
import AdminPayments from './pages/admin/AdminPayments'
import VendorDashboard from './pages/vendor/VendorDashboard'
import Inventory from './pages/vendor/Inventory'
import VendorBookings from './pages/vendor/VendorBookings'
import Pricing from './pages/vendor/Pricing'
import MyShop from './pages/vendor/MyShop'
import VendorPayments from './pages/vendor/VendorPayments'
import CustomerHome from './pages/customer/CustomerHome.tsx'
import CustomerResults from './pages/customer/CustomerResults.tsx'
import RentalPartners from './pages/customer/RentalPartners'
import VendorLanding from './pages/customer/VendorLanding'
import BookingFlow from './pages/customer/BookingFlow'
import MyBookings from './pages/customer/MyBookings'
import MyBookingDetails from './pages/customer/MyBookingDetails'
import BecomeVendor from './pages/customer/BecomeVendor'
import LegalDocumentPage from './pages/LegalDocumentPage'
import FaqPage from './pages/FaqPage'
import LoadingSpinner from './components/common/LoadingSpinner'
import LegalFooter from './components/common/LegalFooter'
import { savePostLoginRedirect } from './utils/postLoginRedirect'
import { useTranslation } from 'react-i18next'
import { getCustomerTourSteps } from './tour/customerTour'
import { enableMobileTableEnhancer } from './utils/mobileTableEnhancer'

const VENDOR_DOMAIN = import.meta.env.VITE_VENDOR_DOMAIN || 'rentalbasic.com';
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'vendors', 'api', 'mail', 'phpmyadmin']);

function getVendorSlugFromSubdomain(): string | null {
  const h = window.location.hostname;
  if (!h.endsWith(`.${VENDOR_DOMAIN}`)) return null;
  const sub = h.slice(0, h.length - VENDOR_DOMAIN.length - 1);
  if (!sub || sub.includes('.') || RESERVED_SUBDOMAINS.has(sub)) return null;
  return sub;
}

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const location = useLocation()
  const { token, user } = useAuthStore()
  if (!token) {
    savePostLoginRedirect(`${location.pathname}${location.search}${location.hash}`)
    return <Navigate to="/login" replace />
  }
  if (role && user?.role !== role) return <Navigate to="/" replace />
  return <>{children}</>
}

function MaintenanceModeScreen() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-2xl backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">
          {t('maintenanceMode.badge')}
        </p>
        <h1 className="mt-4 text-4xl font-bold text-white">
          {t('maintenanceMode.title')}
        </h1>
        <p className="mt-4 text-lg leading-8 text-slate-300">
          {t('maintenanceMode.message')}
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-400">
          {t('maintenanceMode.submessage')}
        </p>
        <LegalFooter variant="dark" className="mt-8 text-left" />
      </div>
    </div>
  )
}

function AppRoutes({
  maintenanceModeEnabled,
  userRole,
  vendorSlug,
}: {
  maintenanceModeEnabled: boolean
  userRole?: string
  vendorSlug: string | null
}) {
  const location = useLocation()
  const isLegalRoute = location.pathname.startsWith('/legal/')

  if (maintenanceModeEnabled && !isLegalRoute) {
    return <MaintenanceModeScreen />
  }

  return (
    <Routes>
      <Route path="/legal/:documentSlug" element={<LegalDocumentPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/shop/:slug"
        element={vendorSlug ? <Navigate to="/" replace /> : <VendorLanding />}
      />
      {!vendorSlug && <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />}
      {!vendorSlug && <Route path="/admin/vendors" element={<ProtectedRoute role="admin"><VendorsList /></ProtectedRoute>} />}
      {!vendorSlug && <Route path="/admin/item-types" element={<ProtectedRoute role="admin"><ItemTypesList /></ProtectedRoute>} />}
      {!vendorSlug && <Route path="/admin/brands" element={<ProtectedRoute role="admin"><BrandsList /></ProtectedRoute>} />}
      {!vendorSlug && <Route path="/admin/payments" element={<ProtectedRoute role="admin"><AdminPayments /></ProtectedRoute>} />}
      {!vendorSlug && <Route path="/vendor" element={<ProtectedRoute role="vendor"><VendorDashboard /></ProtectedRoute>} />}
      {!vendorSlug && <Route path="/vendor/inventory" element={<ProtectedRoute role="vendor"><Inventory /></ProtectedRoute>} />}
      {!vendorSlug && <Route path="/vendor/bookings" element={<ProtectedRoute role="vendor"><VendorBookings /></ProtectedRoute>} />}
      {!vendorSlug && <Route path="/vendor/pricing" element={<ProtectedRoute role="vendor"><Pricing /></ProtectedRoute>} />}
      {!vendorSlug && <Route path="/vendor/shop" element={<ProtectedRoute role="vendor"><MyShop /></ProtectedRoute>} />}
      {!vendorSlug && <Route path="/vendor/payments" element={<ProtectedRoute role="vendor"><VendorPayments /></ProtectedRoute>} />}
      <Route path="/" element={vendorSlug ? <VendorLanding slugOverride={vendorSlug} /> : <CustomerHome />} />
      <Route path="/rental-partners" element={<RentalPartners />} />
      <Route path="/results" element={<CustomerResults />} />
      <Route path="/book/:slug" element={<BookingFlow />} />
      <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
      <Route path="/my-bookings/:bookingId" element={<ProtectedRoute><MyBookingDetails /></ProtectedRoute>} />
      <Route path="/become-vendor" element={<ProtectedRoute role="customer"><BecomeVendor /></ProtectedRoute>} />
      <Route path="*" element={
        vendorSlug ? <Navigate to="/" replace /> :
          userRole === 'admin' ? <Navigate to="/admin" replace /> :
            userRole === 'vendor' ? <Navigate to="/vendor" replace /> :
              <Navigate to="/" replace />
      } />
    </Routes>
  )
}

export default function App() {
  const [featureFlagsLoading, setFeatureFlagsLoading] = useState(true)
  const [maintenanceModeEnabled, setMaintenanceModeEnabled] = useState(false)
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const vendorSlug = getVendorSlugFromSubdomain();

  useEffect(() => {
    let isMounted = true

    getFeatureFlagsSettings()
      .then((flags) => {
        if (!isMounted) return
        setMaintenanceModeEnabled(Boolean(flags.maintenanceModeEnabled))
      })
      .catch(() => {
        if (!isMounted) return
        setMaintenanceModeEnabled(false)
      })
      .finally(() => {
        if (!isMounted) return
        setFeatureFlagsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    return enableMobileTableEnhancer()
  }, [])

  if (featureFlagsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    )
  }

  return (
    <TourProvider
      steps={getCustomerTourSteps(t, user)}
      showNavigation
      showBadge={false}
      showDots
      padding={{ mask: 8, popover: [12, 16] }}
      nextButton={({ Button, currentStep, stepsLength, setIsOpen, setCurrentStep }) => {
        if (currentStep === stepsLength - 1) {
          return (
            <button
              onClick={() => setIsOpen(false)}
              style={{
                display: 'block',
                padding: '6px 16px',
                border: 0,
                background: '#3b82f6',
                color: '#fff',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {t('tour.complete', { defaultValue: 'Complete' })}
            </button>
          )
        }
        return <Button onClick={() => setCurrentStep(currentStep + 1)} kind="next" />
      }}
      styles={{
        popover: (base) => ({
          ...base,
          borderRadius: 16,
          backgroundColor: '#0f172a',
          color: '#e2e8f0',
          boxShadow: '0 18px 50px rgba(2, 6, 23, 0.45)',
          maxWidth: 440,
        }),
        maskArea: (base) => ({
          ...base,
          rx: 10,
        }),
        close: (base) => ({
          ...base,
          color: '#e2e8f0',
        }),
        button: (base) => ({
          ...base,
          padding: 8,
          color: '#e2e8f0',
        }),
        arrow: ({ disabled }: { disabled?: boolean }) => ({
          color: disabled ? '#475569' : '#e2e8f0',
          width: 22,
          height: 16,
          flex: '0 0 22px',
        }),
      }}
    >
      <BrowserRouter>
        <AppRoutes
          maintenanceModeEnabled={maintenanceModeEnabled}
          userRole={user?.role}
          vendorSlug={vendorSlug}
        />
      </BrowserRouter>
    </TourProvider>
  )
}
