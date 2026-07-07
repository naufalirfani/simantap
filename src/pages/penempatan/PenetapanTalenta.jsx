import { useEffect } from "react";
import Breadcrumb from "../../components/Breadcrumb";

const PenetapanTalenta = () => {
  useEffect(() => {
    document.title = "Penetapan Talenta | SIMANTAP";
  }, []);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Breadcrumb */}
      <Breadcrumb />

      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
          Penetapan Talenta
        </h1>
        <p className="mt-2 text-md md:text-base text-gray-600 dark:text-gray-300">
          Penetapan penempatan talenta pada jabatan target suksesi
        </p>
      </div>

      {/* Placeholder Content */}
      <div className="flex items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="text-center text-gray-400 dark:text-gray-500">
          <i className="fas fa-user-tag text-5xl mb-4"></i>
          <p className="text-lg font-medium">Halaman Penetapan Talenta</p>
          <p className="text-sm mt-1">Fitur ini sedang dalam pengembangan</p>
        </div>
      </div>
    </div>
  );
};

export default PenetapanTalenta;
