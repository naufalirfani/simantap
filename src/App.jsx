import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SettingsProvider } from './context/SettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import DaftarTalenta from './pages/DaftarTalenta';
import DetailPegawai from './pages/DetailPegawai';
import Suksesi from './pages/Suksesi';
import Pengembangan from './pages/Pengembangan';
import UnitKerja from './pages/masterdata/UnitKerja';
import Jabatan from './pages/masterdata/Jabatan';
import Pegawai from './pages/masterdata/Pegawai';
import Indikator from './pages/masterdata/Indikator';
import Instrumen from './pages/masterdata/Instrumen';
import KotakInterval from './pages/masterdata/KotakInterval';
import PenilaianPegawai from './pages/masterdata/PenilaianPegawai';
import InputPenilaian from './pages/masterdata/InputPenilaian';
import StandarKompetensiMSK from './pages/masterdata/StandarKompetensiMSK';
import SyaratSuksesi from './pages/masterdata/SyaratSuksesi';
import Settings from './pages/Settings';
import SSOLogin from './pages/SSOLogin';
import AdminLogin from './pages/AdminLogin';

// Component to handle role-based routing
const RoleBasedRoutes = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';
  
  // If user is not admin, redirect to their detail page
  if (!isAdmin && user?.nip) {
    return (
      <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
        <Sidebar />
        <main className="flex-1 overflow-auto w-full lg:w-auto">
          <Routes>
            <Route path="/detail-pegawai/:nip" element={<DetailPegawai />} />
            <Route path="*" element={<Navigate to={`/detail-pegawai/${user.nip}`} replace />} />
          </Routes>
        </main>
      </div>
    );
  }
  
  // Admin users can access all routes
  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar />
      <main className="flex-1 overflow-auto w-full lg:w-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
                        <Route path="/daftar-talenta" element={<DaftarTalenta />} />
                        <Route path="/daftar-talenta/detail/:nip" element={<DetailPegawai />} />
                        <Route path="/suksesi" element={<Suksesi />} />
                        <Route path="/suksesi/detail/:nip" element={<DetailPegawai />} />
                        <Route path="/pengembangan" element={<Pengembangan />} />
                        <Route path="/masterdata/unit-kerja" element={<UnitKerja />} />
                        <Route path="/masterdata/jabatan" element={<Jabatan />} />
                        <Route path="/masterdata/pegawai" element={<Pegawai />} />
                        <Route path="/masterdata/indikator" element={<Indikator />} />
                        <Route path="/masterdata/instrumen" element={<Instrumen />} />
                        <Route path="/masterdata/kotak-interval" element={<KotakInterval />} />
                        <Route path="/masterdata/penilaian-pegawai" element={<PenilaianPegawai />} />
                        <Route path="/masterdata/penilaian-pegawai/input-penilaian/:nip" element={<InputPenilaian />} />
                        <Route path="/masterdata/penilaian-pegawai/input-penilaian/:nip/detail" element={<DetailPegawai />} />
                        <Route path="/masterdata/jabatan/:jabatanId/syarat-suksesi" element={<SyaratSuksesi />} />
                        <Route path="/pengaturan" element={<Settings />} />
                        <Route path="/masterdata/standar-kompetensi-msk" element={<StandarKompetensiMSK />} />
                        <Route path="/detail-pegawai/:nip" element={<DetailPegawai />} />
                      </Routes>
                    </main>
                  </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Router>
          <Routes>
            {/* Public route for admin login */}
            <Route path="/admin" element={<AdminLogin />} />
            
            {/* Public route for SSO login */}
            <Route path="/sso/:token" element={<SSOLogin />} />
            
            {/* Protected routes */}
            <Route
              path="*"
              element={
                <ProtectedRoute>
                  <RoleBasedRoutes />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;

