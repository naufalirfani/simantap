import { useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";
import { fetchPegawaiList, fetchPetaJabatan } from "../services/apiService";
import { computeQuadrantDynamic } from "../services/kotakConfigService";
import Swal from "sweetalert2";
import ServerDataTable from "../components/ServerDataTable";
import IconButton from "../components/IconButton";

const DaftarTalenta = () => {
  const { t } = useSettings();
  const navigate = useNavigate();

  const [filterOptions, setFilterOptions] = useState({ organisasi: [], jabatan: [], jenis: [] });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    document.title = `${t('daftarTalenta')} | SIMANTAP`;
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
        if (!orgMap.has(item.unit_kerja) || kelas < orgMap.get(item.unit_kerja).kelas) {
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
        if (!jabMap.has(item.nama_jabatan) || kelas < jabMap.get(item.nama_jabatan).kelas) {
          jabMap.set(item.nama_jabatan, { name: item.nama_jabatan, kelas });
        }
      });
      const uniqueJabatan = Array.from(jabMap.values())
        .sort((a, b) => b.kelas - a.kelas)
        .map((j) => ({ value: j.name, label: j.name }));

      const jenisOptions = [
        "Jabatan Pimpinan Tinggi Madya",
        "Jabatan Pimpinan Tinggi Pratama",
        "Jabatan Administrator",
        "Jabatan Pengawas",
        "Jabatan Fungsional Utama",
        "Jabatan Fungsional Madya",
        "Jabatan Fungsional Muda",
        "Jabatan Fungsional Pertama",
        "Jabatan Fungsional Penyelia",
        "Jabatan Fungsional Mahir",
        "Jabatan Fungsional Terampil",
        "Jabatan Pelaksana",
      ].map((name) => ({ value: name, label: name }));

      setFilterOptions({ organisasi: uniqueOrganisasi, jabatan: uniqueJabatan, jenis: jenisOptions });
    } catch (error) {
      console.error("Error loading filter options:", error);
    }
  };

  useEffect(() => {
    loadFilterOptions();

    // no subindikator loading needed for Daftar Talenta
  }, []);

  // Memoize fetch function to prevent unnecessary re-renders
  const fetchData = useCallback(async (params) => {
    return await fetchPegawaiList({ ...params, with_penilaian: true });
  }, []);

  const handlePenilaian = (nip) => {
    navigate(`/masterdata/penilaian-pegawai/input/${nip}`);
  };

  const columns = [
    {
      key: "no",
      label: "No",
      render: (_, index) => (
        <span className="font-semibold text-gray-500 dark:text-gray-400">{index + 1}</span>
      ),
    },
    {
      key: "foto",
      label: "",
      compact: true,
      render: (item) => (
        <div className="flex items-center justify-center flex-shrink-0">
          {item.avatar ? (
            <img
              src={item.avatar}
              alt={item.nama}
              className="w-8 h-8 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "flex";
              }}
            />
          ) : null}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm" style={{ display: item.avatar ? "none" : "flex" }}>
            {item.nama?.charAt(0)?.toUpperCase() || "?"}
          </div>
        </div>
      ),
    },
    {
      key: "nama",
      label: "Nama",
      noWrap: true,
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{item.nama}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{item.email}</div>
        </div>
      ),
    },
    {
      key: "nip",
      label: "NIP",
      noWrap: true,
      render: (item) => <span className="text-md text-gray-700 dark:text-gray-300">{item.nip}</span>,
    },
    {
      key: "jabatan",
      label: "Jabatan",
      render: (item) => (
        <div>
          <div className="text-md font-medium text-gray-900 dark:text-gray-100">{item.jabatan || "-"}</div>
          <div className="flex gap-2 mt-1">
            {item.jenis_jabatan && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-md font-medium bg-blue-100 text-[#3B82F6] dark:bg-blue-900 dark:text-blue-200">{item.jenis_jabatan}</span>
            )}
            {item.golongan && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-md font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">{item.golongan}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "unit_kerja",
      label: "Unit Kerja",
      render: (item) => (
        <div>
          <div className="text-md text-gray-900 dark:text-gray-100">{item.unit_kerja || "-"}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{item.lokasi_kerja || ""}</div>
        </div>
      ),
    },
    {
      key: "nilai_potensial",
      label: "Nilai Potensial",
      align: "center",
      render: (item) => {
        const val =
          item.potensial_score ?? item.nilai_potensial ?? item.potensial ?? item.potensi ?? item.nilaiPotensial ?? (item.penilaian_summary && item.penilaian_summary.potensial) ?? null;
        return (
          <span className="font-semibold text-gray-700 dark:text-gray-200">{val !== null && val !== undefined && val !== "" ? String(val) : '-'}</span>
        );
      },
    },
    {
      key: "nilai_kinerja",
      label: "Nilai Kinerja",
      align: "center",
      render: (item) => {
        const val =
          item.kinerja_score ?? item.nilai_kinerja ?? item.kinerja ?? item.nilaiKinerja ?? (item.penilaian_summary && item.penilaian_summary.kinerja) ?? null;
        return (
          <span className="font-semibold text-gray-700 dark:text-gray-200">{val !== null && val !== undefined && val !== "" ? String(val) : '-'}</span>
        );
      },
    },
    {
      key: "kuadran",
      label: "Kuadran",
      align: "center",
      render: (item) => {
        const p = parseFloat(item.potensial_score ?? item.nilai_potensial ?? item.potensial ?? item.nilaiPotensial ?? (item.penilaian_summary && item.penilaian_summary.potensial));
        const k = parseFloat(item.kinerja_score ?? item.nilai_kinerja ?? item.kinerja ?? item.nilaiKinerja ?? (item.penilaian_summary && item.penilaian_summary.kinerja));
        if (!Number.isFinite(p) || !Number.isFinite(k)) return <span>-</span>;
        try {
          const q = computeQuadrantDynamic(p, k);
          return <span className="font-semibold text-gray-700 dark:text-gray-200">{q || '-'}</span>;
        } catch (e) {
          return <span>-</span>;
        }
      },
    },
    {
      key: "aksi",
      label: "",
      render: (item) => (
        <div className="flex items-center justify-center">
          <IconButton onClick={() => handlePenilaian(item.nip)} variant="primary" size="lg" title="Detail">
            <i className="fas fa-info-circle mr-2" />
            Detail
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">Daftar Talenta</h1>
        <p className="mt-2 text-md md:text-base text-gray-600 dark:text-gray-300">Daftar talenta organisasi — lihat dan buka penilaian pegawai</p>
      </div>

      {/* Data Table (wrap to allow horizontal scrolling when columns wide) */}
      <div className="overflow-x-auto">
        <ServerDataTable
          key={refreshKey}
          columns={columns}
          fetchData={fetchData}
          itemsPerPageOptions={[10, 25, 50, 100]}
          defaultFilters={{ unit_organisasi: "", jabatan: "", filter: "", golongan: "" }}
          filterConfigs={[
            { key: "unit_organisasi_name", label: "Organisasi", placeholder: "Semua Organisasi", options: filterOptions.organisasi },
            { key: "jabatan_name", label: "Jabatan", placeholder: "Semua Jabatan", options: filterOptions.jabatan },
            { key: "filter", label: "Jenis Jabatan", placeholder: "Semua Jenis", options: filterOptions.jenis },
            { key: "golongan", label: "Golongan", placeholder: "Semua Golongan", options: [
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
              ] },
          ]}
        />
      </div>
    </div>
  );
};

export default DaftarTalenta;
