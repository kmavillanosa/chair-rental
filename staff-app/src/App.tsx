import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TourProvider } from '@reactour/tour'
import { useAuthStore } from './store/authStore'
import { getFeatureFlagsSettings, type FeatureFlagsSettings } from './api/settings'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import AdminDashboard from './pages/admin/AdminDashboard'
import VendorsList from './pages/admin/VendorsList'
import VendorApplicantsList from './pages/admin/VendorApplicantsList'
import VendorApplicantReview from './pages/admin/VendorApplicantReview'
import ItemTypesList from './pages/admin/ItemTypesList'
import BrandsList from './pages/admin/BrandsList'
import AdminPayments from './pages/admin/AdminPayments'
import FraudAlertsPage from './pages/admin/FraudAlerts'
import DisputesPage from './pages/admin/DisputesPage'
import KycSettingsPage from './pages/admin/KycSettings'
import CustomersList from './pages/admin/CustomersList'
import VendorDashboard from './pages/vendor/VendorDashboard'
import Inventory from './pages/vendor/Inventory'
import VendorBookings from './pages/vendor/VendorBookings'
import VendorBookingsCalendar from './pages/vendor/VendorBookingsCalendar'
import VendorBookingDetails from './pages/vendor/VendorBookingDetails'
import DistancePricing from './pages/vendor/DistancePricing'
import HelperPricing from './pages/vendor/HelperPricing'
import VendorDeliveryVehicles from './pages/vendor/VendorDeliveryVehicles'
import MyShop from './pages/vendor/MyShop'
import VendorPayments from './pages/vendor/VendorPayments'
import MyBookings from './pages/customer/MyBookings'
import LegalDocumentPage from './pages/LegalDocumentPage'
import { getStaffTourSteps } from './tour/staffTour'

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (role && user?.role !== role) return <Navigate to="/login" replace />
  return <>{children}</>
}

function StaffHome() {
  const { user } = useAuthStore()
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  if (user?.role === 'vendor') return <Navigate to="/vendor" replace />
  if (user?.role === 'customer') return <Navigate to="/customer" replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  const [maintenanceModeEnabled, setMaintenanceModeEnabled] = useState(false)
  const { user } = useAuthStore()
  const tourSteps = getStaffTourSteps(user?.role)

  useEffect(() => {
    let isMounted = true

    const applyFeatureFlags = (flags?: Partial<FeatureFlagsSettings>) => {
      if (!isMounted) return
      setMaintenanceModeEnabled(Boolean(flags?.maintenanceModeEnabled))
    }

    getFeatureFlagsSettings()
      .then(applyFeatureFlags)
      .catch(() => {
        applyFeatureFlags({ maintenanceModeEnabled: false })
      })

    const handleFeatureFlagsUpdated = (event: Event) => {
      const nextFlags = (event as CustomEvent<Partial<FeatureFlagsSettings>>).detail
      applyFeatureFlags(nextFlags)
    }

    window.addEventListener('staff-feature-flags-updated', handleFeatureFlagsUpdated as EventListener)

    return () => {
      isMounted = false
      window.removeEventListener('staff-feature-flags-updated', handleFeatureFlagsUpdated as EventListener)
    }
  }, [])

  return (
    <TourProvider
      steps={tourSteps}
      showNavigation
      showBadge={false}
      showDots
      padding={{ mask: 8, popover: [12, 16] }}
      styles={{
        popover: (base) => ({
          ...base,
          borderRadius: 16,
          backgroundColor: '#0f172a',
          color: '#e2e8f0',
          boxShadow: '0 18px 50px rgba(2, 6, 23, 0.45)',
          maxWidth: 460,
        }),
        maskArea: (base) => ({
          ...base,
          rx: 10,
        }),
        close: (base) => ({
          ...base,
          color: '#e2e8f0',
        }),
      }}
    >
      <BrowserRouter>
        {maintenanceModeEnabled && (
          <div className="pointer-events-none fixed right-4 top-4 z-[70] rounded-full border border-amber-300 bg-amber-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-900 shadow-lg">
            Maintenance Mode
          </div>
        )}
        <Routes>
          <Route path="/legal/:documentSlug" element={<LegalDocumentPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/customers" element={<ProtectedRoute role="admin"><CustomersList /></ProtectedRoute>} />
          <Route path="/admin/vendors" element={<ProtectedRoute role="admin"><VendorsList /></ProtectedRoute>} />
          <Route path="/admin/vendors/applicants" element={<ProtectedRoute role="admin"><VendorApplicantsList /></ProtectedRoute>} />
          <Route path="/admin/vendors/applicants/:vendorId" element={<ProtectedRoute role="admin"><VendorApplicantReview /></ProtectedRoute>} />
          <Route path="/admin/item-types" element={<ProtectedRoute role="admin"><ItemTypesList /></ProtectedRoute>} />
          <Route path="/admin/brands" element={<ProtectedRoute role="admin"><BrandsList /></ProtectedRoute>} />
          <Route path="/admin/payments/*" element={<ProtectedRoute role="admin"><AdminPayments /></ProtectedRoute>} />
          <Route path="/admin/fraud-alerts" element={<ProtectedRoute role="admin"><FraudAlertsPage /></ProtectedRoute>} />
          <Route path="/admin/disputes" element={<ProtectedRoute role="admin"><DisputesPage /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<Navigate to="/admin/settings/feature-flags" replace />} />
          <Route path="/admin/settings/feature-flags" element={<ProtectedRoute role="admin"><KycSettingsPage /></ProtectedRoute>} />
          <Route path="/admin/settings/cancellation" element={<ProtectedRoute role="admin"><KycSettingsPage /></ProtectedRoute>} />
          <Route path="/admin/settings/kyc" element={<ProtectedRoute role="admin"><KycSettingsPage /></ProtectedRoute>} />
          <Route path="/vendor" element={<ProtectedRoute role="vendor"><VendorDashboard /></ProtectedRoute>} />
          <Route path="/vendor/inventory" element={<ProtectedRoute role="vendor"><Inventory /></ProtectedRoute>} />
          <Route path="/vendor/bookings" element={<ProtectedRoute role="vendor"><VendorBookings /></ProtectedRoute>} />
          <Route path="/vendor/bookings/calendar" element={<ProtectedRoute role="vendor"><VendorBookingsCalendar /></ProtectedRoute>} />
          <Route path="/vendor/bookings/:bookingId" element={<ProtectedRoute role="vendor"><VendorBookingDetails /></ProtectedRoute>} />
          <Route path="/vendor/pricing/distance" element={<ProtectedRoute role="vendor"><DistancePricing /></ProtectedRoute>} />
          <Route path="/vendor/pricing/helpers" element={<ProtectedRoute role="vendor"><HelperPricing /></ProtectedRoute>} />
          <Route path="/vendor/vehicles" element={<ProtectedRoute role="vendor"><VendorDeliveryVehicles /></ProtectedRoute>} />
          <Route path="/vendor/shop" element={<ProtectedRoute role="vendor"><MyShop /></ProtectedRoute>} />
          <Route path="/vendor/payments" element={<ProtectedRoute role="vendor"><VendorPayments /></ProtectedRoute>} />
          <Route path="/customer" element={<ProtectedRoute role="customer"><MyBookings /></ProtectedRoute>} />
          <Route path="/my-bookings" element={<ProtectedRoute role="customer"><MyBookings /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><StaffHome /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </TourProvider>
  )
}
