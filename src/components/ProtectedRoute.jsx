import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-teal-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Check if this is an admin logout redirect
    const isAdminLogoutRedirect = sessionStorage.getItem('admin_logout_redirect') === 'true';
    
    if (isAdminLogoutRedirect) {
      // Clear the flag and redirect to admin login
      sessionStorage.removeItem('admin_logout_redirect');
      window.location.href = '/admin';
      return null;
    }
    
    // Redirect to NUSA dashboard
    const redirectUrl = window.location.origin + location.pathname + location.search + location.hash;
    window.location.href = import.meta.env.VITE_NUSA_URL + '?app=SIMANTAP&redirect=' + encodeURIComponent(redirectUrl);
    return null;
  }

  // Check if route requires admin access
  if (adminOnly) {
    const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';
    if (!isAdmin) {
      // Non-admin trying to access admin-only route, redirect to their detail page
      return <Navigate to={`/detail-pegawai/${user?.nip}`} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
