import { useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';

const Settings = () => {
  const {
    theme,
    setTheme,
    fontSize,
    setFontSize,
    sidebarColor,
    setSidebarColor,
    language,
    setLanguage,
    t,
  } = useSettings();

  useEffect(() => {
    document.title = `${t('pengaturan')} | SIMANTAP`;
  }, [t]);

  const predefinedColors = [
    { name: 'Slate Dark', value: '#1e293b' },
    { name: 'Gray Dark', value: '#1f2937' },
    { name: 'Zinc Dark', value: '#27272a' },
    { name: 'Blue Dark', value: '#1e3a8a' },
    { name: 'Indigo Dark', value: '#312e81' },
    { name: 'Purple Dark', value: '#581c87' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-6 sm:mb-8">
        {t('pengaturan')}
      </h1>

      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Theme */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mb-4">
            {t('tema')}
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={() => setTheme('light')}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all cursor-pointer ${
                theme === 'light'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <span className="text-gray-800 dark:text-white font-medium">
                {t('terang')}
              </span>
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <span className="text-gray-800 dark:text-white font-medium">
                {t('gelap')}
              </span>
            </button>
          </div>
        </div>

        {/* Font Size */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mb-4">
            {t('ukuranFont')}
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={() => setFontSize('small')}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all cursor-pointer ${
                fontSize === 'small'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <span className="text-gray-800 dark:text-white font-medium">
                {t('kecil')}
              </span>
            </button>
            <button
              onClick={() => setFontSize('medium')}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all cursor-pointer ${
                fontSize === 'medium'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <span className="text-gray-800 dark:text-white font-medium">
                {t('sedang')}
              </span>
            </button>
            <button
              onClick={() => setFontSize('large')}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all cursor-pointer ${
                fontSize === 'large'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <span className="text-gray-800 dark:text-white font-medium">
                {t('besar')}
              </span>
            </button>
          </div>
        </div>

        {/* Sidebar Color */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mb-4">
            {t('warnaSidebar')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {predefinedColors.map((color) => (
              <button
                key={color.value}
                onClick={() => setSidebarColor(color.value)}
                className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                  sidebarColor === color.value
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                <div
                  className="w-full h-12 rounded mb-2"
                  style={{ backgroundColor: color.value }}
                ></div>
                <span className="text-sm text-gray-800 dark:text-white">
                  {color.name}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Custom Color
            </label>
            <input
              type="color"
              value={sidebarColor}
              onChange={(e) => setSidebarColor(e.target.value)}
              className="w-full h-12 rounded-lg cursor-pointer border-2 border-gray-300 dark:border-gray-600"
            />
          </div>
        </div>

        {/* Language */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mb-4">
            {t('bahasa')}
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={() => setLanguage('id')}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all cursor-pointer ${
                language === 'id'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <span className="text-gray-800 dark:text-white font-medium">
                {t('indonesia')}
              </span>
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all cursor-pointer ${
                language === 'en'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <span className="text-gray-800 dark:text-white font-medium">
                {t('inggris')}
              </span>
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Info:</strong> Semua pengaturan disimpan secara otomatis dan akan tetap tersimpan saat Anda membuka aplikasi kembali.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
