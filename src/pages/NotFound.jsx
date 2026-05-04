import { useNavigate } from 'react-router-dom';
import IconButton from '../components/IconButton';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="text-center px-6">
        <h1 className="text-6xl font-bold text-red-600 dark:text-red-400 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
          Halaman Tidak Ditemukan
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Path yang Anda akses tidak tersedia atau tidak ada.
        </p>
        <div className="flex gap-4 justify-center">
          <IconButton
            onClick={() => navigate(-1)}
            title="Kembali ke halaman sebelumnya"
            variant="default"
            size="lg"
          >
            Kembali
          </IconButton>
          <IconButton
            onClick={() => navigate('/')}
            title="Kembali ke halaman utama"
            variant="blue"
            size="lg"
          >
            Ke Beranda
          </IconButton>
        </div>
      </div>
    </div>
  );
}
