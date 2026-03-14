import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
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
import VendorLanding from './pages/customer/VendorLanding'
import BookingFlow from './pages/customer/BookingFlow'
import MyBookings from './pages/customer/MyBookings'
import BecomeVendor from './pages/customer/BecomeVendor'
import { savePostLoginRedirect } from './utils/postLoginRedirect'

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

export default function App() {
  const { user } = useAuthStore()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/shop/:slug" element={<VendorLanding />} />
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/vendors" element={<ProtectedRoute role="admin"><VendorsList /></ProtectedRoute>} />
        <Route path="/admin/item-types" element={<ProtectedRoute role="admin"><ItemTypesList /></ProtectedRoute>} />
        <Route path="/admin/brands" element={<ProtectedRoute role="admin"><BrandsList /></ProtectedRoute>} />
        <Route path="/admin/payments" element={<ProtectedRoute role="admin"><AdminPayments /></ProtectedRoute>} />
        <Route path="/vendor" element={<ProtectedRoute role="vendor"><VendorDashboard /></ProtectedRoute>} />
        <Route path="/vendor/inventory" element={<ProtectedRoute role="vendor"><Inventory /></ProtectedRoute>} />
        <Route path="/vendor/bookings" element={<ProtectedRoute role="vendor"><VendorBookings /></ProtectedRoute>} />
        <Route path="/vendor/pricing" element={<ProtectedRoute role="vendor"><Pricing /></ProtectedRoute>} />
        <Route path="/vendor/shop" element={<ProtectedRoute role="vendor"><MyShop /></ProtectedRoute>} />
        <Route path="/vendor/payments" element={<ProtectedRoute role="vendor"><VendorPayments /></ProtectedRoute>} />
        <Route path="/" element={<CustomerHome />} />
        <Route path="/results" element={<CustomerResults />} />
        <Route path="/book/:slug" element={<BookingFlow />} />
        <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
        <Route path="/become-vendor" element={<ProtectedRoute role="customer"><BecomeVendor /></ProtectedRoute>} />
        <Route path="*" element={
          user?.role === 'admin' ? <Navigate to="/admin" replace /> :
            user?.role === 'vendor' ? <Navigate to="/vendor" replace /> :
              <Navigate to="/" replace />
        } />
      </Routes>
    </BrowserRouter>
  )
}
