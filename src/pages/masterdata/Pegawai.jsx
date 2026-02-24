import { useEffect, useCallback, useState } from "react";
import { useSettings } from "../../context/SettingsContext";
import {
  fetchPegawai,
  fetchPetaJabatan,
  syncPegawai,
} from "../../services/apiService";
import ServerDataTable from "../../components/ServerDataTable";
import IconButton from "../../components/IconButton";
import Breadcrumb from "../../components/Breadcrumb";
import Swal from "sweetalert2";
import { PRIMARY_COLORS, BG_COLORS, DARK_COLORS } from "../../config/colors";

const Pegawai = () => {
  const { t } = useSettings();
  const [filterOptions, setFilterOptions] = useState({
    organisasi: [],
    jabatan: [],
  });

  useEffect(() => {
    document.title = `${t("pegawai")} | SIMANTAP`;
  }, [t]);

  // Fetch unique values for filters from ANJAB API
  const loadFilterOptions = async () => {
    try {
      const petaJabatanData = await fetchPetaJabatan();

      // Get unique organisasi (unit_kerja) and sort by kelas_jabatan
      const orgMap = new Map();
      petaJabatanData.forEach((item) => {
        if (!item.unit_kerja) return;
        const kelas = Number.parseInt(item.kelas_jabatan, 10) || 0;
        if (
          !orgMap.has(item.unit_kerja) ||
          kelas < orgMap.get(item.unit_kerja).kelas
        ) {
          orgMap.set(item.unit_kerja, { name: item.unit_kerja, kelas });
        }
      });
      const uniqueOrganisasi = Array.from(orgMap.values())
        .sort((a, b) => b.kelas - a.kelas)
        .map((o) => ({ value: o.name, label: o.name }));

      // Get unique jabatan and sort by kelas_jabatan
      const jabMap = new Map();
      petaJabatanData.forEach((item) => {
        if (!item.nama_jabatan) return;
        const kelas = Number.parseInt(item.kelas_jabatan, 10) || 0;
        if (
          !jabMap.has(item.nama_jabatan) ||
          kelas < jabMap.get(item.nama_jabatan).kelas
        ) {
          jabMap.set(item.nama_jabatan, { name: item.nama_jabatan, kelas });
        }
      });
      const uniqueJabatan = Array.from(jabMap.values())
        .sort((a, b) => b.kelas - a.kelas)
        .map((j) => ({ value: j.name, label: j.name }));

      setFilterOptions({
        organisasi: uniqueOrganisasi,
        jabatan: uniqueJabatan,
      });
    } catch (error) {
      console.error("Error loading filter options:", error);
    }
  };

  useEffect(() => {
    loadFilterOptions();
  }, []);

  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSync = async () => {
    const result = await Swal.fire({
      icon: "question",
      title: "Sinkronisasi Pegawai",
      text: "Sinkronisasi akan mengambil data pegawai terbaru dari layanan. Lanjutkan?",
      showCancelButton: true,
      confirmButtonText: "Ya",
      cancelButtonText: "Batal",
      confirmButtonColor: PRIMARY_COLORS.blue,
      cancelButtonColor: PRIMARY_COLORS.red,
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      setIsSyncing(true);
      await syncPegawai();
      await loadFilterOptions();
      setRefreshKey((k) => k + 1);
      Swal.fire({
        icon: "success",
        title: "Sukses",
        text: "Sinkronisasi pegawai selesai",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: err.message || "Sinkronisasi gagal",
        confirmButtonColor: PRIMARY_COLORS.blue,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Memoize fetch function to prevent unnecessary re-renders
  const fetchData = useCallback(async (params) => {
    return await fetchPegawai(params);
  }, []);

  const columns = [
    {
      key: "no",
      label: "No",
      width: "w-16",
      render: (_, index) => (
        <span className="font-semibold text-gray-500 dark:text-gray-400">
          {index + 1}
        </span>
      ),
    },
    {
      key: "foto",
      label: "",
      width: "w-20",
      render: (item) => (
        <div className="flex items-center justify-center">
          {item.avatar ? (
            <img
              src={item.avatar}
              alt={item.name}
              className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm"
            style={{ display: item.avatar ? "none" : "flex" }}
          >
            {item.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
        </div>
      ),
    },
    {
      key: "nama",
      label: t("nama"),
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">
            {item.name}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {item.email}
          </div>
        </div>
      ),
    },
    {
      key: "nip",
      label: t("nip"),
      width: "w-48",
      render: (item) => (
        <span className="text-md text-gray-700 dark:text-gray-300">
          {item.nip}
        </span>
      ),
    },
    {
      key: "jabatan",
      label: t("jabatan"),
      render: (item) => (
        <div>
          <div className="text-md font-medium text-gray-900 dark:text-gray-100">
            {item.jabatan_name || "-"}
          </div>
          <div className="flex gap-2 mt-1">
            {item.jenis_jabatan && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-md font-medium dark:bg-blue-900 dark:text-blue-200" style={{ backgroundColor: BG_COLORS.blue.light, color: DARK_COLORS.blue }}>
                {item.jenis_jabatan}
              </span>
            )}
            {item.golongan && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-md font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                {item.golongan}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "unit_kerja",
      label: t("unitKerja"),
      render: (item) => (
        <div>
          <div className="text-md text-gray-900 dark:text-gray-100">
            {item.unit_organisasi_name || "-"}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {item.json?.lokasiKerja || ""}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Breadcrumb */}
      <Breadcrumb />
      
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
          {t("pegawai")}
        </h1>
        <p className="mt-2 text-md md:text-base text-gray-600 dark:text-gray-300">
          {t("pegawaiDesc")}
        </p>
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

      {/* Data Table */}
      <ServerDataTable
        key={refreshKey}
        columns={columns}
        fetchData={fetchData}
        itemsPerPageOptions={[10, 25, 50, 100]}
        defaultFilters={{
          unit_organisasi: "",
          jabatan: "",
          jenis_jabatan: "",
          golongan: "",
        }}
        filterConfigs={[
          {
            key: "unit_organisasi",
            label: "Organisasi",
            placeholder: "Semua Organisasi",
            options: filterOptions.organisasi,
          },
          {
            key: "jabatan",
            label: "Jabatan",
            placeholder: "Semua Jabatan",
            options: filterOptions.jabatan,
          },
          {
            key: "jenis_jabatan",
            label: "Jenis Jabatan",
            placeholder: "Semua Jenis",
            options: [
              { value: "Struktural", label: "Struktural" },
              { value: "Fungsional", label: "Fungsional" },
              { value: "Pelaksana", label: "Pelaksana" },
            ],
          },
          {
            key: "golongan",
            label: "Golongan",
            placeholder: "Semua Golongan",
            options: [
              { value: "I/a", label: "Juru Muda (I/a)" },
              { value: "I/b", label: "Juru Muda Tk. I (I/b)" },
              { value: "I/c", label: "Juru (I/c)" },
              { value: "I/d", label: "Juru Tk. I (I/d)" },
              { value: "II/a", label: "Pengatur Muda (II/a)" },
              { value: "II/b", label: "Pengatur Muda Tk. I (II/b)" },
              { value: "II/c", label: "Pengatur (II/c)" },
              { value: "II/d", label: "Pengatur Tk. I (II/d)" },
              { value: "III/a", label: "Penata Muda (III/a)" },
              { value: "III/b", label: "Penata Muda Tk. I (III/b)" },
              { value: "III/c", label: "Penata (III/c)" },
              { value: "III/d", label: "Penata Tk. I (III/d)" },
              { value: "IV/a", label: "Pembina (IV/a)" },
              { value: "IV/b", label: "Pembina Tk. I (IV/b)" },
              { value: "IV/c", label: "Pembina Madya (IV/c)" },
              { value: "IV/d", label: "Pembina Utama Muda (IV/d)" },
              { value: "IV/e", label: "Pembina Utama (IV/e)" },
            ],
          },
        ]}
      />
    </div>
  );
};

export default Pegawai;
