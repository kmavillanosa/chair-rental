import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import AdminDashboard from './pages/admin/AdminDashboard'
import VendorsList from './pages/admin/VendorsList'
import VendorApplicantReview from './pages/admin/VendorApplicantReview'
import ItemTypesList from './pages/admin/ItemTypesList'
import BrandsList from './pages/admin/BrandsList'
import AdminPayments from './pages/admin/AdminPayments'
import KycSettingsPage from './pages/admin/KycSettings'
import VendorDashboard from './pages/vendor/VendorDashboard'
import Inventory from './pages/vendor/Inventory'
import VendorBookings from './pages/vendor/VendorBookings'
import Pricing from './pages/vendor/Pricing'
import MyShop from './pages/vendor/MyShop'
import VendorPayments from './pages/vendor/VendorPayments'

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
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/vendors" element={<ProtectedRoute role="admin"><VendorsList /></ProtectedRoute>} />
        <Route path="/admin/vendors/applicants/:vendorId" element={<ProtectedRoute role="admin"><VendorApplicantReview /></ProtectedRoute>} />
        <Route path="/admin/item-types" element={<ProtectedRoute role="admin"><ItemTypesList /></ProtectedRoute>} />
        <Route path="/admin/brands" element={<ProtectedRoute role="admin"><BrandsList /></ProtectedRoute>} />
        <Route path="/admin/payments" element={<ProtectedRoute role="admin"><AdminPayments /></ProtectedRoute>} />
        <Route path="/admin/settings/feature-flags" element={<ProtectedRoute role="admin"><KycSettingsPage /></ProtectedRoute>} />
        <Route path="/admin/settings/kyc" element={<ProtectedRoute role="admin"><KycSettingsPage /></ProtectedRoute>} />
        <Route path="/vendor" element={<ProtectedRoute role="vendor"><VendorDashboard /></ProtectedRoute>} />
        <Route path="/vendor/inventory" element={<ProtectedRoute role="vendor"><Inventory /></ProtectedRoute>} />
        <Route path="/vendor/bookings" element={<ProtectedRoute role="vendor"><VendorBookings /></ProtectedRoute>} />
        <Route path="/vendor/pricing" element={<ProtectedRoute role="vendor"><Pricing /></ProtectedRoute>} />
        <Route path="/vendor/shop" element={<ProtectedRoute role="vendor"><MyShop /></ProtectedRoute>} />
        <Route path="/vendor/payments" element={<ProtectedRoute role="vendor"><VendorPayments /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><StaffHome /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
