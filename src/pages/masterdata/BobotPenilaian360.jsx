import { useEffect, useState } from "react";
import { useSettings } from "../../context/SettingsContext";
import { fetchBobot360, storeBobot360, syncUmpanBalik360 } from "../../services/apiService";
import Breadcrumb from "../../components/Breadcrumb";
import Swal from "sweetalert2";
import { PRIMARY_COLORS } from "../../config/colors";
import IconButton from "../../components/IconButton";

const DEFAULT_WEIGHTS = {
  sekjen: {
    atasan_langsung: 0,
    penerima_manfaat: 0,
    rekan_kerja: 0,
    bawahan: 50,
    penilaian_diri: 50,
  },
  deputi: {
    atasan_langsung: 40,
    penerima_manfaat: 0,
    rekan_kerja: 30,
    bawahan: 25,
    penilaian_diri: 5,
  },
  jpt_pratama: {
    atasan_langsung: 40,
    penerima_manfaat: 0,
    rekan_kerja: 30,
    bawahan: 25,
    penilaian_diri: 5,
  },
  administrator: {
    atasan_langsung: 40,
    penerima_manfaat: 0,
    rekan_kerja: 30,
    bawahan: 25,
    penilaian_diri: 5,
  },
  pengawas: {
    atasan_langsung: 40,
    penerima_manfaat: 0,
    rekan_kerja: 30,
    bawahan: 25,
    penilaian_diri: 5,
  },
  pelaksana: {
    atasan_langsung: 50,
    penerima_manfaat: 0,
    rekan_kerja: 45,
    bawahan: 0,
    penilaian_diri: 5,
  },
  jf: {
    atasan_langsung: 30,
    penerima_manfaat: 30,
    rekan_kerja: 35,
    bawahan: 0,
    penilaian_diri: 5,
  },
  kepala_kantor: {
    atasan_langsung: 50,
    penerima_manfaat: 0,
    rekan_kerja: 0,
    bawahan: 45,
    penilaian_diri: 5,
  },
};

const BobotPenilaian360 = () => {
  const { t } = useSettings();
  const [weights, setWeights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isSyncing360, setIsSyncing360] = useState(false);

  const categories = [
    { key: "sekjen", label: "Sekjen" },
    { key: "deputi", label: "Deputi" },
    { key: "jpt_pratama", label: "JPT Pratama" },
    { key: "administrator", label: "Administrator" },
    { key: "pengawas", label: "Pengawas" },
    { key: "pelaksana", label: "Pelaksana" },
    { key: "jf", label: "JF" },
    { key: "kepala_kantor", label: "Kepala Kantor" },
  ];

  const roles = [
    { key: "atasan_langsung", label: "Atasan Langsung" },
    { key: "penerima_manfaat", label: "Penerima Manfaat Kerja" },
    { key: "rekan_kerja", label: "Rekan Kerja" },
    { key: "bawahan", label: "Bawahan" },
    { key: "penilaian_diri", label: "Diri Sendiri" },
  ];

  useEffect(() => {
    document.title = "Bobot Penilaian 360 | SIMANTAP";
    loadData();
  }, []);

  const handleSync360 = async () => {
    const result = await Swal.fire({
      icon: "question",
      title: "Sinkronisasi Umpan Balik 360",
      text: "Sinkronisasi akan mengambil data umpan balik 360 terbaru dari layanan. Lanjutkan?",
      showCancelButton: true,
      confirmButtonText: "Ya",
      cancelButtonText: "Batal",
      confirmButtonColor: PRIMARY_COLORS.blue,
      cancelButtonColor: PRIMARY_COLORS.red,
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      setIsSyncing360(true);
      const res = await syncUmpanBalik360();
      Swal.fire({
        icon: "success",
        title: "Sukses",
        text: res?.message || "Sinkronisasi umpan balik 360 selesai",
        timer: 2000,
        showConfirmButton: false,
      });
      loadData();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: err.message || "Sinkronisasi umpan balik 360 gagal",
        confirmButtonColor: PRIMARY_COLORS.blue,
      });
    } finally {
      setIsSyncing360(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchBobot360();
      // Ensure all categories have a value mapping
      const initialized = {};
      categories.forEach((cat) => {
        initialized[cat.key] = {
          atasan_langsung: 0,
          penerima_manfaat: 0,
          rekan_kerja: 0,
          bawahan: 0,
          penilaian_diri: 0,
          ...(data && data[cat.key]),
        };
      });
      setWeights(initialized);
    } catch (err) {
      console.error(err);
      setError(err.message || "Gagal memuat setting bobot 360.");
    } finally {
      setLoading(false);
    }
  };

  const handleWeightChange = (categoryKey, roleKey, value) => {
    if (value === "") {
      setWeights((prev) => ({
        ...prev,
        [categoryKey]: {
          ...prev[categoryKey],
          [roleKey]: "",
        },
      }));
      return;
    }

    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      setWeights((prev) => ({
        ...prev,
        [categoryKey]: {
          ...prev[categoryKey],
          [roleKey]: num,
        },
      }));
    }
  };

  const getCategoryTotal = (categoryKey) => {
    if (!weights || !weights[categoryKey]) return 0;
    return roles.reduce((sum, role) => {
      const val = weights[categoryKey][role.key];
      return sum + (parseFloat(val) || 0);
    }, 0);
  };

  const isCategoryTotalValid = (categoryKey) => {
    const total = getCategoryTotal(categoryKey);
    // Use float precision threshold
    return Math.abs(total - 100) < 0.01;
  };

  const checkAllTotalsValid = () => {
    return categories.every((cat) => isCategoryTotalValid(cat.key));
  };

  const handleResetToDefault = async () => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Reset ke Default",
      text: "Anda akan mengembalikan seluruh bobot ke pengaturan default. Lanjutkan?",
      showCancelButton: true,
      confirmButtonText: "Ya, Reset",
      cancelButtonText: "Batal",
      confirmButtonColor: PRIMARY_COLORS.orange,
      cancelButtonColor: PRIMARY_COLORS.red,
      reverseButtons: true,
    });

    if (result.isConfirmed) {
      setWeights(JSON.parse(JSON.stringify(DEFAULT_WEIGHTS)));
      Swal.fire({
        icon: "success",
        title: "Direset",
        text: "Bobot telah dikembalikan ke pengaturan default.",
        timer: 1500,
        showConfirmButton: false,
      });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!checkAllTotalsValid()) {
      Swal.fire({
        icon: "error",
        title: "Validasi Gagal",
        text: "Total bobot untuk setiap kategori jabatan harus bernilai tepat 100%.",
        confirmButtonColor: PRIMARY_COLORS.blue,
      });
      return;
    }

    const confirm = await Swal.fire({
      icon: "question",
      title: "Konfirmasi",
      text: "Apakah Anda yakin ingin menyimpan perubahan bobot penilaian 360 ini?",
      showCancelButton: true,
      confirmButtonText: "Simpan",
      cancelButtonText: "Batal",
      confirmButtonColor: PRIMARY_COLORS.blue,
      cancelButtonColor: PRIMARY_COLORS.red,
      reverseButtons: true,
    });

    if (!confirm.isConfirmed) return;

    try {
      setSaving(true);
      // Clean data: convert empty inputs to 0
      const payload = {};
      categories.forEach((cat) => {
        payload[cat.key] = {};
        roles.forEach((role) => {
          const val = weights[cat.key][role.key];
          payload[cat.key][role.key] = val === "" ? 0 : Number(val);
        });
      });

      const response = await storeBobot360(payload);
      Swal.fire({
        icon: "success",
        title: "Sukses",
        text: response.message || "Setting bobot 360 berhasil disimpan.",
        timer: 2000,
        showConfirmButton: false,
      });
      // Reload from backend
      loadData();
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Gagal Menyimpan",
        text: err.message || "Terjadi kesalahan saat menyimpan pengaturan.",
        confirmButtonColor: PRIMARY_COLORS.blue,
      });
    } finally {
      setSaving(false);
    }
  };

  const allTotalsValid = weights ? checkAllTotalsValid() : false;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Breadcrumb */}
      <Breadcrumb />

      {/* Page Title */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
            Bobot Penilaian 360
          </h1>
          <p className="mt-2 text-sm md:text-base text-gray-600 dark:text-gray-300">
            Atur persentase bobot penilaian berdasarkan peran penilai untuk masing-masing kategori jabatan.
          </p>
        </div>
        <div>
          <IconButton
            onClick={handleSync360}
            variant="primary"
            size="lg"
            disabled={isSyncing360}
            title="Sinkronisasi Umpan Balik 360"
          >
            {isSyncing360 ? (
              <i className="fas fa-spinner fa-spin mr-2" />
            ) : (
              <i className="fas fa-sync mr-2" />
            )}
            Sinkronisasi Umpan Balik 360
          </IconButton>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <i className="fas fa-spinner fa-spin text-4xl text-teal-500 dark:text-teal-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Memuat data bobot...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <i className="fas fa-exclamation-circle text-red-500 text-xl mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Terjadi Kesalahan
              </h3>
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={loadData}
                className="mt-3 px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/50 dark:hover:bg-red-900 text-red-800 dark:text-red-200 text-xs font-semibold rounded-md transition-colors"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Table Card */}
      {!loading && !error && weights && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <i className="fas fa-table text-teal-500 dark:text-teal-400" />
              Matriks Pengaturan Bobot Penilaian
            </h2>
          </div>

          <div className="p-6">
            {/* Warning Alert if totals are not balanced */}
            {!allTotalsValid && (
              <div className="flex items-center gap-3 p-4 mb-6 text-sm text-amber-800 dark:text-amber-200 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 animate-pulse">
                <i className="fas fa-exclamation-triangle text-amber-500 text-xl flex-shrink-0" />
                <div>
                  <span className="font-semibold">Total Bobot Belum Seimbang!</span> Setiap kolom kategori jabatan wajib bernilai tepat <strong className="underline">100%</strong> sebelum Anda dapat menyimpan perubahan.
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-200 dark:border-gray-600">
                <thead>
                  {/* First Header Row */}
                  <tr>
                    <th
                      rowSpan={2}
                      className="p-4 bg-gray-50 dark:bg-gray-700 text-left font-bold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 w-1/5 shadow-[inset_-2px_0_0_0_rgba(0,0,0,0.05)]"
                    >
                      Peran Penilai
                    </th>
                    <th
                      colSpan={categories.length}
                      className="p-3 bg-gray-100 dark:bg-gray-600 text-center font-bold text-gray-800 dark:text-gray-100 tracking-wider uppercase border border-gray-200 dark:border-gray-600"
                    >
                      BOBOT
                    </th>
                  </tr>
                  {/* Second Header Row */}
                  <tr>
                    {categories.map((cat) => (
                      <th
                        key={cat.key}
                        className="p-3 bg-gray-50 dark:bg-gray-700 text-center font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 min-w-[100px]"
                      >
                        {cat.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {roles.map((role) => (
                    <tr
                      key={role.key}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      {/* Role Column */}
                      <td className="p-4 bg-gray-50/30 dark:bg-gray-700/10 font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 shadow-[inset_-2px_0_0_0_rgba(0,0,0,0.02)]">
                        {role.label}
                      </td>

                      {/* Inputs Column for Each Category */}
                      {categories.map((cat) => {
                        const val = weights[cat.key]?.[role.key];
                        return (
                          <td
                            key={cat.key}
                            className="p-4 border border-gray-200 dark:border-gray-600 text-center"
                          >
                            <div className="inline-flex items-center justify-center">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={val}
                                onChange={(e) =>
                                  handleWeightChange(cat.key, role.key, e.target.value)
                                }
                                className="w-16 md:w-20 px-2 py-1.5 text-center bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent transition-all"
                              />
                              <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500 font-semibold">%</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>

                {/* Footer Totals Row */}
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 font-bold border-t-2 border-gray-300 dark:border-gray-600">
                    <td className="p-4 text-left text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 shadow-[inset_-2px_0_0_0_rgba(0,0,0,0.05)]">
                      TOTAL
                    </td>
                    {categories.map((cat) => {
                      const total = getCategoryTotal(cat.key);
                      const isValid = isCategoryTotalValid(cat.key);
                      return (
                        <td
                          key={cat.key}
                          className="p-4 border border-gray-200 dark:border-gray-600 text-center"
                        >
                          <div className="flex flex-col items-center justify-center">
                            <span
                              className={`text-base font-bold transition-colors ${isValid
                                ? "text-teal-500 dark:text-teal-400"
                                : "text-red-600 dark:text-red-400"
                                }`}
                            >
                              {total}%
                            </span>
                            {!isValid && (
                              <span className="text-[10px] mt-0.5 text-red-500 dark:text-red-400">
                                {total > 100 ? `(Kelebihan ${total - 100}%)` : `(Kurang ${100 - total}%)`}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Actions Toolbar */}
            <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-gray-100 dark:border-gray-700">
              <IconButton
                onClick={handleResetToDefault}
                variant="default"
                size="md"
                title="Reset ke Default"
              >
                <i className="fas fa-undo mr-2" />
                Reset ke Default
              </IconButton>

              <div className="flex items-center gap-3">
                {!allTotalsValid && (
                  <span className="text-xs font-semibold text-red-500 dark:text-red-400 text-right hidden md:inline">
                    * Harap perbaiki ketidakseimbangan bobot sebelum menyimpan
                  </span>
                )}
                <IconButton
                  onClick={handleSave}
                  disabled={saving || !allTotalsValid}
                  variant="primary"
                  size="lg"
                  title="Simpan Perubahan"
                >
                  {saving ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save mr-2" />
                      Simpan Perubahan
                    </>
                  )}
                </IconButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BobotPenilaian360;
