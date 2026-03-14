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

export default function App() {
  const { user } = useAuthStore()
  const vendorSlug = getVendorSlugFromSubdomain();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/shop/:slug" element={<VendorLanding />} />
        {/* Admin and vendor routes are hidden on vendor subdomains */}
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
        <Route path="/" element={vendorSlug ? <Navigate to={`/shop/${vendorSlug}`} replace /> : <CustomerHome />} />
        <Route path="/results" element={<CustomerResults />} />
        <Route path="/book/:slug" element={<BookingFlow />} />
        <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
        <Route path="/become-vendor" element={<ProtectedRoute role="customer"><BecomeVendor /></ProtectedRoute>} />
        <Route path="*" element={
          vendorSlug ? <Navigate to={`/shop/${vendorSlug}`} replace /> :
            user?.role === 'admin' ? <Navigate to="/admin" replace /> :
              user?.role === 'vendor' ? <Navigate to="/vendor" replace /> :
                <Navigate to="/" replace />
        } />
      </Routes>
    </BrowserRouter>
  )
}
