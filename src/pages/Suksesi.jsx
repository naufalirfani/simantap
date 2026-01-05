import { useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';

const Suksesi = () => {
  const { t } = useSettings();

  useEffect(() => {
    document.title = `${t('suksesi')} | SIMANTAP`;
  }, [t]);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
        {t('suksesi')}
      </h1>
      <p className="mt-4 text-gray-600 dark:text-gray-300">
        Halaman Suksesi - Konten akan ditambahkan di sini
      </p>
    </div>
  );
};

export default Suksesi;
