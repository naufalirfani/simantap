import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SettingsProvider } from './context/SettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import DaftarTalenta from './pages/DaftarTalenta';
import ApprovalPengajuanPenilaian from './pages/ApprovalPengajuanPenilaian';
import ApprovalPengajuanPenilaianDetail from './pages/ApprovalPengajuanPenilaianDetail';
import DetailPegawai from './pages/DetailPegawai';
import Suksesi from './pages/Suksesi';
import Pengembangan from './pages/Pengembangan';
import Rencana from './pages/pengembangan/Rencana';
import Pelaksanaan from './pages/pengembangan/Pelaksanaan';
import Evaluasi from './pages/pengembangan/Evaluasi';
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
import BobotPenilaian360 from './pages/masterdata/BobotPenilaian360';
import Settings from './pages/Settings';
import RetensiTalenta from './pages/RetensiTalenta';
import RencanaSuksesi from './pages/penempatan/RencanaSuksesi';
import ApprovalSuksesor from './pages/penempatan/ApprovalSuksesor';
import PenetapanTalenta from './pages/penempatan/PenetapanTalenta';
import PemantauanEvaluasi from './pages/PemantauanEvaluasi';
import SSOLogin from './pages/SSOLogin';
import AdminLogin from './pages/AdminLogin';
import NotFound from './pages/NotFound';

// Component to handle role-based routing
const RoleBasedRoutes = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';
  
  // If user is not admin, redirect to their detail page
  if (!isAdmin && user?.nip) {
    return (
      <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
        {/* <Sidebar /> */}
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
          
          {/* Akuisisi Talenta */}
          <Route path="/daftar-talenta" element={<DaftarTalenta />} />
          <Route path="/akuisisi/daftar-talenta" element={<DaftarTalenta />} />
          <Route path="/daftar-talenta/detail/:nip" element={<DetailPegawai />} />
          <Route path="/akuisisi/daftar-talenta/detail/:nip" element={<DetailPegawai />} />
          <Route path="/suksesi" element={<Suksesi />} />
          <Route path="/akuisisi/kelompok-rencana-suksesi" element={<Suksesi />} />
          <Route path="/suksesi/detail/:nip" element={<DetailPegawai />} />
          <Route path="/akuisisi/kelompok-rencana-suksesi/detail/:nip" element={<DetailPegawai />} />
          
          {/* Pengembangan Talenta */}
          <Route path="/pengembangan" element={<Navigate to="/pengembangan/indeks-kesenjangan" replace />} />
          <Route path="/pengembangan/indeks-kesenjangan" element={<Pengembangan />} />
          <Route path="/pengembangan-talenta/indeks-kesenjangan" element={<Pengembangan />} />
          <Route path="/pengembangan/rencana" element={<Rencana />} />
          <Route path="/pengembangan-talenta/rencana-pengembangan" element={<Rencana />} />
          <Route path="/pengembangan/pelaksanaan" element={<Pelaksanaan />} />
          <Route path="/pengembangan-talenta/pelaksanaan-pengembangan" element={<Pelaksanaan />} />
          <Route path="/pengembangan/evaluasi" element={<Evaluasi />} />
          <Route path="/pengembangan-talenta/evaluasi-pengembangan" element={<Evaluasi />} />
          
          {/* Retensi Talenta */}
          <Route path="/retensi-talenta" element={<RetensiTalenta />} />
          
          {/* Penempatan Talenta */}
          <Route path="/penempatan/rencana-suksesi" element={<RencanaSuksesi />} />
          <Route path="/penempatan/approval-suksesor" element={<ApprovalSuksesor />} />
          <Route path="/penempatan/penetapan-talenta" element={<PenetapanTalenta />} />
          
          {/* Pemantauan dan Evaluasi */}
          <Route path="/pemantauan-evaluasi" element={<PemantauanEvaluasi />} />

          {/* Pengaturan & Approval */}
          <Route path="/approval-pengajuan" element={<ApprovalPengajuanPenilaian />} />
          <Route path="/approval-pengajuan/:id" element={<ApprovalPengajuanPenilaianDetail />} />
          <Route path="/approval-pengajuan-penilaian" element={<ApprovalPengajuanPenilaian />} />
          <Route path="/approval-pengajuan-penilaian/:id" element={<ApprovalPengajuanPenilaianDetail />} />
          
          {/* Masterdata */}
          <Route path="/masterdata/unit-kerja" element={<UnitKerja />} />
          <Route path="/masterdata/jabatan" element={<Jabatan />} />
          <Route path="/masterdata/pegawai" element={<Pegawai />} />
          <Route path="/masterdata/indikator" element={<Indikator />} />
          <Route path="/masterdata/instrumen" element={<Instrumen />} />
          <Route path="/masterdata/kotak-interval" element={<KotakInterval />} />
          <Route path="/masterdata/penilaian-pegawai" element={<PenilaianPegawai />} />
          <Route path="/masterdata/penilaian-pegawai/:nip/detail" element={<DetailPegawai />} />
          <Route path="/masterdata/penilaian-pegawai/input-penilaian/:nip" element={<InputPenilaian />} />
          <Route path="/masterdata/penilaian-pegawai/input-penilaian/:nip/detail" element={<DetailPegawai />} />
          <Route path="/masterdata/jabatan/:jabatanId/syarat-suksesi" element={<SyaratSuksesi />} />
          <Route path="/masterdata/standar-kompetensi-msk" element={<StandarKompetensiMSK />} />
          <Route path="/masterdata/bobot-360" element={<BobotPenilaian360 />} />

          <Route path="/pengaturan" element={<Settings />} />
          <Route path="/detail-pegawai/:nip" element={<DetailPegawai />} />
          <Route path="*" element={<NotFound />} />
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

