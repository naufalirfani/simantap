import { useEffect, useState } from "react";
import { useSettings } from "../../context/SettingsContext";
import {
  loadKotakConfig,
  saveKotakConfig,
  resetKotakConfig,
  updateIntervals,
} from "../../services/kotakConfigService";
import { BG_COLORS, TEXT_ON_BG_COLORS } from "../../config/colors";
import Swal from "sweetalert2";
import IconButton from "../../components/IconButton";
import Breadcrumb from "../../components/Breadcrumb";

const KotakInterval = () => {
  const { t } = useSettings();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedKotak, setSelectedKotak] = useState(null);
  const [expandedKotakId, setExpandedKotakId] = useState(null);
  const [editingIntervals, setEditingIntervals] = useState(null);
  const [intervalsEditingMode, setIntervalsEditingMode] = useState(false);
  const [formData, setFormData] = useState({
    kategori: "",
    warna: "",
    rekomendasi: [""],
  });

  useEffect(() => {
    document.title = `Konfigurasi Kotak | SIMANTAP`;
    loadConfig();
  }, []);

  const loadConfig = () => {
    setLoading(true);
    try {
      const data = loadKotakConfig();
      setConfig(data);
      setEditingIntervals(JSON.parse(JSON.stringify(data.intervals)));
    } catch (error) {
      console.error("Error loading config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleIntervalFieldChange = (axis, idx, field, value) => {
    let parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    // clamp to 0..100
    parsed = Math.max(0, Math.min(100, parsed));
    setEditingIntervals((prev) => {
      if (!prev) return prev;
      const copy = {
        potensial: prev.potensial.map((i) => ({ ...i })),
        kinerja: prev.kinerja.map((i) => ({ ...i })),
      };
      const arr = copy[axis];
      if (!arr || !arr[idx]) return prev;

      const lastIdx = arr.length - 1;

      if (field === "min") {
        // Interval 1 (idx 0) lower bound is fixed
        if (idx === 0) return prev;
        // ensure min < current max
        const maxVal = arr[idx].max;
        const newMin = Math.min(parsed, maxVal - 1);
        arr[idx].min = newMin;
        // sync previous interval's max to this min - 1 (no overlap)
        arr[idx - 1].max = newMin - 1;
      } else if (field === "max") {
        // Interval 3 (last) upper bound is fixed
        if (idx === lastIdx) return prev;
        const minVal = arr[idx].min;
        const newMax = Math.max(parsed, minVal + 1);
        arr[idx].max = newMax;
        // sync next interval's min to this max + 1 (no overlap)
        arr[idx + 1].min = newMax + 1;
      } else {
        arr[idx][field] = parsed;
      }

      // Rebuild labels for both axes
      ["potensial", "kinerja"].forEach((a) => {
        copy[a] = copy[a].map((i) => ({ ...i, label: `${i.min}-${i.max}` }));
      });

      return copy;
    });
  };

  const handleStartEditIntervals = () => setIntervalsEditingMode(true);

  const handleCancelEditIntervals = () => {
    setEditingIntervals(JSON.parse(JSON.stringify(config.intervals)));
    setIntervalsEditingMode(false);
  };

  const handleSaveIntervals = async () => {
    // Basic validation: min < max for all intervals
    const validate = (arr) =>
      arr.every(
        (i) =>
          typeof i.min === "number" &&
          typeof i.max === "number" &&
          i.min < i.max
      );
    if (
      !validate(editingIntervals.potensial) ||
      !validate(editingIntervals.kinerja)
    ) {
      Swal.fire({
        icon: "error",
        title: "Validasi Gagal",
        text: "Pastikan setiap interval memiliki nilai min < max.",
        confirmButtonColor: "#3085d6",
      });
      return;
    }
    const success = updateIntervals(editingIntervals);
    if (success) {
      Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Interval disimpan",
        timer: 1500,
        showConfirmButton: false,
      });
      setIntervalsEditingMode(false);
      loadConfig();
    } else {
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: "Terjadi kesalahan saat menyimpan interval",
        confirmButtonColor: "#3085d6",
      });
    }
  };

  const handleEdit = (kotak) => {
    setSelectedKotak(kotak);
    setFormData({
      kategori: kotak.kategori,
      warna: kotak.warna,
      rekomendasi: [...kotak.rekomendasi],
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedKotak(null);
    setFormData({
      kategori: "",
      warna: "",
      rekomendasi: [""],
    });
  };

  const handleAddRekomendasi = () => {
    setFormData({
      ...formData,
      rekomendasi: [...formData.rekomendasi, ""],
    });
  };

  const handleRemoveRekomendasi = (index) => {
    const newRekomendasi = formData.rekomendasi.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      rekomendasi: newRekomendasi.length > 0 ? newRekomendasi : [""],
    });
  };

  const handleRekomendasiChange = (index, value) => {
    const newRekomendasi = [...formData.rekomendasi];
    newRekomendasi[index] = value;
    setFormData({
      ...formData,
      rekomendasi: newRekomendasi,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    try {
      const updatedConfig = { ...config };
      const kotakIndex = updatedConfig.kotak.findIndex(
        (k) => k.id === selectedKotak.id
      );

      if (kotakIndex !== -1) {
        updatedConfig.kotak[kotakIndex] = {
          ...updatedConfig.kotak[kotakIndex],
          kategori: formData.kategori,
          warna: formData.warna,
          rekomendasi: formData.rekomendasi.filter((r) => r.trim() !== ""),
        };

        if (saveKotakConfig(updatedConfig)) {
          Swal.fire({
            icon: "success",
            title: "Berhasil!",
            text: "Konfigurasi kotak berhasil diperbarui",
            timer: 2000,
            showConfirmButton: false,
          });
          handleCloseModal();
          loadConfig(); // Reload to show fresh data
        } else {
          throw new Error("Gagal menyimpan konfigurasi");
        }
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Gagal!",
        text: error.message || "Terjadi kesalahan saat menyimpan konfigurasi",
        confirmButtonColor: "#3085d6",
      });
    }
  };

  const handleReset = async () => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Reset Konfigurasi?",
      text: "Semua konfigurasi akan dikembalikan ke pengaturan default. Lanjutkan?",
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: "Reset",
      cancelButtonText: "Batal",
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
    });

    if (result.isConfirmed) {
      try {
        const defaultConfig = resetKotakConfig();
        loadConfig(); // Reload from localStorage
        Swal.fire({
          icon: "success",
          title: "Berhasil!",
          text: "Konfigurasi telah direset ke default",
          timer: 2000,
          showConfirmButton: false,
        });
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Gagal!",
          text: "Terjadi kesalahan saat mereset konfigurasi",
          confirmButtonColor: "#3085d6",
        });
      }
    }
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700 border-t-[#3085d6] mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            Memuat konfigurasi...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Breadcrumb */}
      <Breadcrumb />
      
      {/* Page Title */}
      <div className="mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
            Konfigurasi Kotak Interval
          </h1>
          <p className="mt-2 text-sm md:text-base text-gray-600 dark:text-gray-300">
            Kelola kategori, rekomendasi, dan interval untuk Matriks 9 Kotak
          </p>
        </div>
        <div className="mt-4 flex gap-3">
          <IconButton
            onClick={handleReset}
            variant="secondary"
            size="lg"
            className="gap-2"
          >
            <i className="fas fa-undo mr-2" />
            Reset ke Default
          </IconButton>
        </div>
      </div>

      {/* Interval Info Card (editable) */}
      <div className="dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6" style={{ backgroundColor: BG_COLORS.blue.light }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <i className="fas fa-ruler-combined text-[#3085d6] dark:text-[#3085d6]"></i>
            Interval Sumbu
          </h2>
          <div className="flex items-center gap-3">
            {intervalsEditingMode ? (
              <>
                <IconButton
                  onClick={handleCancelEditIntervals}
                  variant="secondary"
                  size="lg"
                >
                  <i className="far fa-times-circle mr-2" />
                  Batal
                </IconButton>
                <IconButton
                  onClick={handleSaveIntervals}
                  variant="primary"
                  size="lg"
                >
                  Simpan Interval
                </IconButton>
              </>
            ) : (
              <IconButton
                onClick={handleStartEditIntervals}
                variant="primary"
                size="lg"
              >
                Edit Interval
              </IconButton>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <i className="fas fa-arrow-right text-sm text-[#3085d6]"></i>
              Sumbu X (Potensial)
            </h3>
            <div className="space-y-2">
              {(editingIntervals?.potensial || []).map((interval, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-sm gap-3"
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-gray-600 dark:text-gray-400 w-20">
                      Interval {idx + 1}:
                    </span>
                    {intervalsEditingMode ? (
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="number"
                          value={interval.min}
                          onChange={(e) =>
                            handleIntervalFieldChange(
                              "potensial",
                              idx,
                              "min",
                              e.target.value
                            )
                          }
                          disabled={idx === 0}
                          className={`w-24 px-2 py-1 border rounded-lg ${
                            idx === 0 ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                        />
                        <span className="text-gray-500">—</span>
                        <input
                          type="number"
                          value={interval.max}
                          onChange={(e) =>
                            handleIntervalFieldChange(
                              "potensial",
                              idx,
                              "max",
                              e.target.value
                            )
                          }
                          disabled={
                            idx ===
                            (editingIntervals?.potensial || []).length - 1
                          }
                          className={`w-24 px-2 py-1 border rounded-lg ${
                            idx ===
                            (editingIntervals?.potensial || []).length - 1
                              ? "opacity-60 cursor-not-allowed"
                              : ""
                          }`}
                        />
                        <span className="ml-2 text-sm text-gray-600">
                          {interval.label}
                        </span>
                      </div>
                    ) : (
                      <span className="font-semibold text-gray-800 dark:text-white bg-[#E7F3FF] dark:bg-blue-900 px-3 py-1 rounded-full">
                        {interval.label}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <i className="fas fa-arrow-up text-sm text-[#2fa84f]"></i>
              Sumbu Y (Kinerja)
            </h3>
            <div className="space-y-2">
              {(editingIntervals?.kinerja || []).map((interval, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-sm gap-3"
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-gray-600 dark:text-gray-400 w-20">
                      Interval {idx + 1}:
                    </span>
                    {intervalsEditingMode ? (
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="number"
                          value={interval.min}
                          onChange={(e) =>
                            handleIntervalFieldChange(
                              "kinerja",
                              idx,
                              "min",
                              e.target.value
                            )
                          }
                          disabled={idx === 0}
                          className={`w-24 px-2 py-1 border rounded-lg ${
                            idx === 0 ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                        />
                        <span className="text-gray-500">—</span>
                        <input
                          type="number"
                          value={interval.max}
                          onChange={(e) =>
                            handleIntervalFieldChange(
                              "kinerja",
                              idx,
                              "max",
                              e.target.value
                            )
                          }
                          disabled={
                            idx === (editingIntervals?.kinerja || []).length - 1
                          }
                          className={`w-24 px-2 py-1 border rounded-lg ${
                            idx === (editingIntervals?.kinerja || []).length - 1
                              ? "opacity-60 cursor-not-allowed"
                              : ""
                          }`}
                        />
                        <span className="ml-2 text-sm text-gray-600">
                          {interval.label}
                        </span>
                      </div>
                    ) : (
                      <span className="font-semibold text-gray-800 dark:text-white bg-[#2fa84f]/20 dark:bg-[#2fa84f] px-3 py-1 rounded-full">
                        {interval.label}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Kotak Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <i className="fas fa-th text-[#3085d6] dark:text-[#3085d6]"></i>
          Konfigurasi 9 Kotak
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {config.kotak.map((kotak) => (
            <div
              key={kotak.id}
              className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-lg p-5 shadow-sm hover:shadow-lg transition-all duration-300 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-500 flex flex-col h-full"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md"
                    style={{ backgroundColor: kotak.warna }}
                  >
                    {kotak.id}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800 dark:text-white text-sm">
                      Kotak {kotak.id}
                    </h3>
                    <span className="inline-block mt-1 text-sm">
                      {kotak.kategori}
                    </span>
                  </div>
                </div>
              </div>

              {/* Range Info */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 mb-3 space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Potensial:
                  </span>
                  <span className="font-semibold text-gray-800 dark:text-white">
                    {kotak.potensialRange.min}-{kotak.potensialRange.max}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Kinerja:
                  </span>
                  <span className="font-semibold text-gray-800 dark:text-white">
                    {kotak.kinerjaRange.min}-{kotak.kinerjaRange.max}
                  </span>
                </div>
              </div>

              {/* Rekomendasi Preview (with animated expand/collapse) */}
              <div className="mb-3">
                <div className="flex items-center gap-1 mb-2">
                  <i className="fas fa-lightbulb text-sm text-[#f4c430]"></i>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Rekomendasi ({kotak.rekomendasi.length})
                  </span>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-sm text-gray-600 dark:text-gray-400">
                  <div
                    className="overflow-hidden transition-all duration-300 ease-in-out"
                    style={{
                      maxHeight:
                        expandedKotakId === kotak.id
                          ? Math.min(480, kotak.rekomendasi.length * 28 + 24) +
                            "px"
                          : "48px",
                    }}
                  >
                    <ul className="list-disc list-outside pl-4 space-y-0.5 p-0 m-0 text-sm text-gray-700 dark:text-gray-300">
                      {(expandedKotakId === kotak.id
                        ? kotak.rekomendasi
                        : kotak.rekomendasi.slice(0, 2)
                      ).map((rek, idx) => (
                        <li key={idx} className="leading-tight">
                          {rek}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {kotak.rekomendasi.length > 2 && (
                    <button
                      onClick={() =>
                        setExpandedKotakId(
                          expandedKotakId === kotak.id ? null : kotak.id
                        )
                      }
                      className="mt-2 text-[#3085d6] dark:text-[#3085d6] font-medium hover:underline cursor-pointer flex items-center gap-2 select-none"
                    >
                      <span
                        className={`transform transition-transform duration-300 ${
                          expandedKotakId === kotak.id
                            ? "rotate-180"
                            : "rotate-0"
                        }`}
                      >
                        <i className="fas fa-chevron-down text-sm"></i>
                      </span>
                      {expandedKotakId === kotak.id
                        ? "Sembunyikan"
                        : `+${kotak.rekomendasi.length - 2} lainnya`}
                    </button>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <IconButton
                onClick={() => handleEdit(kotak)}
                variant="primary"
                size="lg"
                className="w-full gap-2 mt-auto"
              >
                <i className="fas fa-edit" />
                Edit Konfigurasi
              </IconButton>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && selectedKotak && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300"
            onClick={handleCloseModal}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col pointer-events-auto overflow-hidden"
              style={{ animation: "modalSlideUp 0.3s ease-out" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-md"
                    style={{ backgroundColor: selectedKotak.warna }}
                  >
                    {selectedKotak.id}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      Edit Kotak {selectedKotak.id}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Sesuaikan kategori, warna, dan rekomendasi
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 hover:scale-120 cursor-pointer"
                  aria-label="Close"
                >
                  <i className="fas fa-times text-xl text-gray-600 dark:text-gray-300"></i>
                </button>
              </div>

              {/* Body - Scrollable */}
              <form
                onSubmit={handleSubmit}
                className="flex flex-col flex-1 min-h-0"
              >
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {/* Kategori */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <i className="fas fa-bookmark mr-2 text-[#2fa84f]"></i>
                      Kategori
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.kategori}
                      onChange={(e) =>
                        setFormData({ ...formData, kategori: e.target.value })
                      }
                      className="block w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#3085d6] focus:border-[#3085d6] bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                      placeholder="Contoh: Talenta Kunci"
                    />
                  </div>

                  {/* Warna */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <i className="fas fa-palette mr-2 text-[#7a5cd6]"></i>
                      Warna
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={formData.warna}
                        onChange={(e) =>
                          setFormData({ ...formData, warna: e.target.value })
                        }
                        className="h-12 w-20 rounded-lg border-2 border-gray-300 dark:border-gray-600 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.warna}
                        onChange={(e) =>
                          setFormData({ ...formData, warna: e.target.value })
                        }
                        className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#3085d6] focus:border-[#3085d6] bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                        placeholder="#2fa84f"
                        pattern="^#[0-9A-Fa-f]{6}$"
                      />
                    </div>
                  </div>

                  {/* Rekomendasi */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        <i className="fas fa-lightbulb mr-2 text-[#f4c430]"></i>
                        Rekomendasi
                      </label>
                      <IconButton
                        type="button"
                        onClick={handleAddRekomendasi}
                        variant="primary"
                        size="lg"
                        className="gap-1"
                      >
                        <i className="fas fa-plus text-sm" />
                        Tambah
                      </IconButton>
                    </div>
                    <div className="space-y-3">
                      {formData.rekomendasi.map((rek, index) => (
                        <div key={index} className="flex gap-2">
                          <div className="flex-shrink-0 w-8 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-sm font-semibold text-gray-600 dark:text-gray-400">
                            {index + 1}
                          </div>
                          <textarea
                            value={rek}
                            onChange={(e) =>
                              handleRekomendasiChange(index, e.target.value)
                            }
                            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#3085d6] focus:border-[#3085d6] bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all resize-none"
                            placeholder="Masukkan rekomendasi..."
                            rows="1"
                          />
                          {formData.rekomendasi.length > 1 && (
                            <IconButton
                              type="button"
                              onClick={() => handleRemoveRekomendasi(index)}
                              variant="danger"
                              size="lg"
                              title="Hapus"
                              className="flex-shrink-0"
                            >
                              <i className="fas fa-trash text-sm" />
                            </IconButton>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Range Info (Read-only) */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      <i className="fas fa-info-circle mr-2 text-[#3085d6]"></i>
                      Range (Otomatis berdasarkan posisi kotak)
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Potensial:
                        </span>
                        <div className="text-sm font-semibold text-gray-800 dark:text-white mt-1">
                          {selectedKotak.potensialRange.min} -{" "}
                          {selectedKotak.potensialRange.max}
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Kinerja:
                        </span>
                        <div className="text-sm font-semibold text-gray-800 dark:text-white mt-1">
                          {selectedKotak.kinerjaRange.min} -{" "}
                          {selectedKotak.kinerjaRange.max}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <IconButton
                    type="button"
                    onClick={handleCloseModal}
                    variant="secondary"
                    size="lg"
                  >
                    <i className="far fa-times-circle mr-2" />
                    Batal
                  </IconButton>
                  <IconButton type="submit" variant="primary" size="lg">
                    <i className="fas fa-save mr-2" />
                    Simpan Perubahan
                  </IconButton>
                </div>
              </form>
            </div>
          </div>

          {/* Animation */}
          <style>{`
            @keyframes modalSlideUp {
              from {
                opacity: 0;
                transform: translateY(30px) scale(0.95);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `}</style>
        </>
      )}
    </div>
  );
};

export default KotakInterval;
