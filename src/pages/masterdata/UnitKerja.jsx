import { useEffect, useState } from "react";
import { useSettings } from "../../context/SettingsContext";
import {
  fetchPetaJabatan,
  getUniqueUnitKerja,
  syncPetaJabatan,
} from "../../services/apiService";
import DataTable from "../../components/DataTable";
import IconButton from "../../components/IconButton";
import Breadcrumb from "../../components/Breadcrumb";
import Swal from "sweetalert2";

const UnitKerja = () => {
  const { t } = useSettings();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = `${t("unitKerja")} | SIMANTAP`;
  }, [t]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const petaJabatanData = await fetchPetaJabatan();
      const uniqueUnits = getUniqueUnitKerja(petaJabatanData);
      setData(uniqueUnits);
    } catch (err) {
      setError(err.message || t("errorLoadingUnitKerja"));
      console.error("Error loading unit kerja:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    const result = await Swal.fire({
      icon: "question",
      title: "Sinkronisasi Peta Jabatan",
      text: "Sinkronisasi akan mengambil data terbaru dari layanan. Lanjutkan?",
      showCancelButton: true,
      confirmButtonText: "Ya",
      cancelButtonText: "Batal",
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      setIsSyncing(true);
      await syncPetaJabatan();
      await loadData();
      Swal.fire({
        icon: "success",
        title: "Sukses",
        text: "Sinkronisasi selesai",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: err.message || "Sinkronisasi gagal",
        confirmButtonColor: "#3085d6",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const columns = [
    {
      key: "no",
      label: "No",
      sortable: false,
      align: "center",
      render: (_, index) => index + 1,
    },
    {
      key: "unit_kerja",
      label: t("unitKerja"),
      sortable: true,
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Breadcrumb */}
      <Breadcrumb />
      
      {/* Page Title */}
      <div className="mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
            {t("unitKerja")}
          </h1>
          <p className="mt-2 text-sm md:text-base text-gray-600 dark:text-gray-300">
            {t("unitKerjaDesc")}
          </p>
        </div>
      </div>

      <div className="mb-4 flex justify-end">
        <IconButton
          onClick={handleSync}
          variant="primary"
          size="lg"
          disabled={isSyncing}
          title="Sinkronisasi"
        >
          {isSyncing ? (
            <i className="fas fa-spinner fa-spin mr-2" />
          ) : (
            <i className="fas fa-sync mr-2" />
          )}
          Sinkronisasi
        </IconButton>
      </div>

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <svg
              className="h-5 w-5 text-[#d33] mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                {t("errorOccurred")}
              </h3>
              <p className="mt-1 text-sm text-[#d33] dark:text-[#d33]">
                {error}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 text-sm font-medium text-[#d33] dark:text-[#d33] hover:text-[#d33] cursor-pointer"
              >
                {t("reload")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Table - always show, pass loading state */}
      {!error && (
        <DataTable
          data={data}
          columns={columns}
          itemsPerPageOptions={[10, 25, 50, 100]}
          loading={loading}
          initialSort={{ key: "kelas_jabatan", direction: "desc" }}
        />
      )}
    </div>
  );
};

export default UnitKerja;
