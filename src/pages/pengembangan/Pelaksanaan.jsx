import { useEffect } from "react";
import Breadcrumb from "../../components/Breadcrumb";

const Pelaksanaan = () => {
  useEffect(() => {
    document.title = "Pelaksanaan Pengembangan | SIMANTAP";
  }, []);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Breadcrumb */}
      <Breadcrumb />

      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
          Pelaksanaan Pengembangan
        </h1>
        <p className="mt-2 text-md md:text-base text-gray-600 dark:text-gray-300">
          Pelaksanaan program pengembangan kompetensi dan potensi pegawai
        </p>
      </div>

      {/* Placeholder Content */}
      <div className="flex items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="text-center text-gray-400 dark:text-gray-500">
          <i className="fas fa-tasks text-5xl mb-4"></i>
          <p className="text-lg font-medium">Halaman Pelaksanaan Pengembangan</p>
          <p className="text-sm mt-1">Fitur ini sedang dalam pengembangan</p>
        </div>
      </div>
    </div>
  );
};

export default Pelaksanaan;
