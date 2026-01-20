import { useEffect } from "react";
import { useSettings } from "../context/SettingsContext";
import Breadcrumb from "../components/Breadcrumb";

const Settings = () => {
  const { theme, setTheme, fontSize, setFontSize, language, setLanguage, t } =
    useSettings();

  useEffect(() => {
    document.title = `${t("pengaturan")} | SIMANTAP`;
  }, [t]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Breadcrumb />
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
          {t("pengaturan")}
        </h1>
        <p className="mt-2 text-md md:text-base text-gray-600 dark:text-gray-300">
          Atur preferensi Anda untuk tema, ukuran font, dan bahasa aplikasi sesuai
          keinginan
        </p>
      </div>

      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Theme */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mb-4">
            {t("tema")}
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={() => setTheme("light")}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all cursor-pointer ${
                theme === "light"
                  ? "border-[#3B82F6] bg-blue-50 dark:bg-blue-900"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            >
              <span className="text-gray-800 dark:text-white font-medium">
                {t("terang")}
              </span>
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all cursor-pointer ${
                theme === "dark"
                  ? "border-[#3B82F6] bg-blue-50 dark:bg-blue-900"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            >
              <span className="text-gray-800 dark:text-white font-medium">
                {t("gelap")}
              </span>
            </button>
          </div>
        </div>

        {/* Font Size */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mb-4">
            {t("ukuranFont")}
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={() => setFontSize("small")}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all cursor-pointer ${
                fontSize === "small"
                  ? "border-[#3B82F6] bg-blue-50 dark:bg-blue-900"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            >
              <span className="text-gray-800 dark:text-white font-medium">
                {t("kecil")}
              </span>
            </button>
            <button
              onClick={() => setFontSize("medium")}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all cursor-pointer ${
                fontSize === "medium"
                  ? "border-[#3B82F6] bg-blue-50 dark:bg-blue-900"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            >
              <span className="text-gray-800 dark:text-white font-medium">
                {t("sedang")}
              </span>
            </button>
            <button
              onClick={() => setFontSize("large")}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all cursor-pointer ${
                fontSize === "large"
                  ? "border-[#3B82F6] bg-blue-50 dark:bg-blue-900"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            >
              <span className="text-gray-800 dark:text-white font-medium">
                {t("besar")}
              </span>
            </button>
          </div>
        </div>

        {/* Language */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mb-4">
            {t("bahasa")}
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={() => setLanguage("id")}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all cursor-pointer ${
                language === "id"
                  ? "border-[#3B82F6] bg-blue-50 dark:bg-blue-900"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            >
              <span className="text-gray-800 dark:text-white font-medium">
                {t("indonesia")}
              </span>
            </button>
            <button
              onClick={() => setLanguage("en")}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all cursor-pointer ${
                language === "en"
                  ? "border-[#3B82F6] bg-blue-50 dark:bg-blue-900"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            >
              <span className="text-gray-800 dark:text-white font-medium">
                {t("inggris")}
              </span>
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-[#3B82F6] dark:text-blue-200">
            <strong>Info:</strong> Semua pengaturan disimpan secara otomatis dan
            akan tetap tersimpan saat Anda membuka aplikasi kembali.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
