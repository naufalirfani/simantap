import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { PRIMARY_COLORS, BG_COLORS, TEXT_ON_BG_COLORS } from "../config/colors";
import Breadcrumb from "../components/Breadcrumb";
import SearchableSelect from "../components/SearchableSelect";
import IconButton from "../components/IconButton";
import {
  fetchPetaJabatanKosong,
  fetchRekomendasiPegawai,
} from "../services/apiService";

const Suksesi = () => {
  const { t } = useSettings();
  const [jabatanKosong, setJabatanKosong] = useState([]);
  const [selectedJabatan, setSelectedJabatan] = useState("");
  const [selectedJabatanData, setSelectedJabatanData] = useState(null);
  const [rekomendasiPegawai, setRekomendasiPegawai] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRekomendasi, setLoadingRekomendasi] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("promosi"); // "promosi" or "rotasi"

  // Simple date formatter (accepts YYYY-MM-DD or DD-MM-YYYY)
  const formatDateIndo = (dateStr) => {
    if (!dateStr) return "-";
    const months = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    const parts = String(dateStr).split(/[-/T\s]+/);
    let d, m, y;
    if (parts.length >= 3) {
      if (parts[0].length === 4) {
        y = parts[0];
        m = Number(parts[1]) - 1;
        d = parts[2];
      } else {
        d = parts[0];
        m = Number(parts[1]) - 1;
        y = parts[2];
      }
      if (!y || m < 0 || !d) return dateStr;
      return `${Number(d)} ${months[m]} ${y}`;
    }
    return dateStr;
  };

  const computeRemaining = (pejabat) => {
    // use provided sisa_masa_kerja if available
    if (pejabat.sisa_masa_kerja) return pejabat.sisa_masa_kerja;
    // try tanggal_pensiun or tglLahir
    const now = new Date();
    let retireDate = null;
    if (pejabat.tanggal_pensiun) retireDate = new Date(pejabat.tanggal_pensiun);
    else if (pejabat.tglPensiun) retireDate = new Date(pejabat.tglPensiun);
    else if (pejabat.tglLahir) {
      const b = new Date(pejabat.tglLahir);
      if (!isNaN(b))
        retireDate = new Date(b.getFullYear() + 58, b.getMonth(), b.getDate());
    }
    if (!retireDate || isNaN(retireDate)) return "-";
    const diffMs = retireDate.getTime() - now.getTime();
    if (diffMs <= 0) return "Telah Pensiun";
    const totalMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.4375));
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    return `${years} tahun${months ? ` ${months} bulan` : ""}`;
  };
  useEffect(() => {
    document.title = `${t("suksesi")} | SIMANTAP`;
    loadJabatanKosong();
  }, [t]);

  const loadJabatanKosong = async () => {
    try {
      setLoading(true);
      const data = await fetchPetaJabatanKosong();
      setJabatanKosong(data);
      setError(null);
    } catch (err) {
      console.error("Error loading jabatan kosong:", err);
      setError("Gagal memuat data jabatan kosong");
    } finally {
      setLoading(false);
    }
  };

  const handleDetailPegawai = (nip) => {
    window.open(`/suksesi/detail/${nip}`, "_blank", "noopener,noreferrer");
  };

  const loadRekomendasi = async (jabatanId, isRotasi = false) => {
    if (!jabatanId) {
      setRekomendasiPegawai([]);
      return;
    }
    try {
      setLoadingRekomendasi(true);
      const rekomendasi = await fetchRekomendasiPegawai(jabatanId, isRotasi);
      setRekomendasiPegawai(rekomendasi);
    } catch (err) {
      console.error("Error loading rekomendasi:", err);
      setRekomendasiPegawai([]);
    } finally {
      setLoadingRekomendasi(false);
    }
  };

  const handleJabatanChange = async (jabatanId) => {
    setSelectedJabatan(jabatanId);
    const jabatan = jabatanKosong.find((j) => j.id === jabatanId);
    setSelectedJabatanData(jabatan);
    await loadRekomendasi(jabatanId, activeTab === "rotasi");
  };

  const handleTabChange = async (tab) => {
    setActiveTab(tab);
    if (selectedJabatan) {
      await loadRekomendasi(selectedJabatan, tab === "rotasi");
    }
  };

  const jabatanOptions = jabatanKosong.map((jabatan) => ({
    value: jabatan.id,
    label: `${jabatan.nama_jabatan} - ${jabatan.unit_kerja}`,
  }));

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Breadcrumb */}
      <Breadcrumb />

      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
          {t("suksesi")}
        </h1>
        <p className="mt-2 text-md md:text-base text-gray-600 dark:text-gray-300">
          Rekomendasi pengisian jabatan strategis yang akan kosong
        </p>
      </div>

      {/* Alert/Info Section */}
      <div
        className="mb-6 dark:bg-blue-900/20 border rounded-lg p-4"
        style={{
          backgroundColor: BG_COLORS.blue.light,
          borderColor: PRIMARY_COLORS.blue,
        }}
      >
        <div className="flex items-start">
          <i
            className="fas fa-info-circle dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0"
            style={{ color: TEXT_ON_BG_COLORS.blue }}
            aria-hidden="true"
          ></i>
          <div>
            <h3
              className="text-md font-semibold dark:text-blue-300 mb-1"
              style={{ color: TEXT_ON_BG_COLORS.blue }}
            >
              Informasi
            </h3>
            <p
              className="text-md dark:text-blue-400"
              style={{ color: TEXT_ON_BG_COLORS.blue }}
            >
              Silakan pilih jabatan terlebih dahulu untuk melihat rekomendasi
              pegawai yang sesuai untuk mengisi posisi tersebut.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            <i
              className="fas fa-exclamation-circle text-red-600 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0"
              aria-hidden="true"
            ></i>
            <p className="text-md text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Selection Section */}
      <div className="mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <label className="block text-md font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Pilih Jabatan yang Akan Kosong
          </label>
          <SearchableSelect
            value={selectedJabatan}
            onChange={handleJabatanChange}
            options={jabatanOptions}
            placeholder={loading ? "Memuat data..." : "Pilih jabatan..."}
            label="Pilih Jabatan"
          />

          {/* Selected Jabatan Details */}
          {selectedJabatanData && (
            <div className="mt-6 p-5 bg-gradient-to-br from-teal-50 to-teal-50 dark:from-gray-700 dark:to-gray-750 rounded-lg border border-teal-100 dark:border-gray-600">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center">
                <i
                  className="fas fa-briefcase mr-2 text-lg"
                  style={{ color: PRIMARY_COLORS.teal }}
                  aria-hidden="true"
                ></i>
                Detail Jabatan
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Nama Jabatan
                    </p>
                    <p className="text-md font-semibold text-gray-800 dark:text-white">
                      {selectedJabatanData.nama_jabatan}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Unit Kerja
                    </p>
                    <p className="text-md text-gray-700 dark:text-gray-200">
                      {selectedJabatanData.unit_kerja}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Jenis Jabatan
                    </p>
                    <p className="text-md text-gray-700 dark:text-gray-200">
                      {selectedJabatanData.jenis_jabatan}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Kelas Jabatan
                    </p>
                    <p className="text-md text-gray-700 dark:text-gray-200">
                      {selectedJabatanData.kelas_jabatan}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Kebutuhan Pegawai
                    </p>
                    <p className="text-md text-gray-700 dark:text-gray-200">
                      {selectedJabatanData.kebutuhan_pegawai}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Bezetting
                    </p>
                    <p className="text-md text-gray-700 dark:text-gray-200">
                      {selectedJabatanData.bezetting}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Pejabat Saat Ini
                    </p>
                    {selectedJabatanData.pejabat &&
                    selectedJabatanData.pejabat.length > 0 ? (
                      selectedJabatanData.pejabat.map((pejabat, idx) => (
                        <div key={idx} className="mb-3">
                          <div className="text-md font-semibold text-gray-800 dark:text-white">
                            {pejabat.name}{" "}
                            <span className="text-md text-gray-500">
                              ({pejabat.nip})
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <div className="text-sm text-gray-500">
                                Tanggal Lahir
                              </div>
                              <div className="font-medium text-gray-700 dark:text-gray-200">
                                {formatDateIndo(
                                  pejabat.tglLahir || pejabat.tanggal_lahir,
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500">
                                Tanggal Pensiun
                              </div>
                              <div className="font-medium text-gray-700 dark:text-gray-200">
                                {formatDateIndo(
                                  pejabat.tanggal_pensiun || pejabat.tglPensiun,
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500">
                                Sisa Masa Kerja
                              </div>
                              <div className="font-medium text-gray-700 dark:text-gray-200">
                                {pejabat.sisa_masa_kerja ||
                                  computeRemaining(pejabat)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div
                        className="flex items-center gap-2 mt-2 text-sm rounded-lg p-2"
                        style={{
                          color: TEXT_ON_BG_COLORS.yellow,
                          backgroundColor: BG_COLORS.yellow.light,
                          borderColor: `${PRIMARY_COLORS.yellow}30`,
                          border: "1px solid",
                        }}
                      >
                        <i
                          className="fas fa-info-circle"
                          aria-hidden="true"
                        ></i>
                        <p className="text-md text-yellow-600 dark:text-yellow-400">Belum ada pejabat saat ini</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recommendations Section */}
      {selectedJabatan ? (
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center">
              <i
                className="fas fa-users mr-2 text-lg"
                aria-hidden="true"
                style={{ color: PRIMARY_COLORS.teal }}
              ></i>
              Rekomendasi Pegawai
            </h2>
            <p className="text-md text-gray-600 dark:text-gray-400 mt-1">
              Berikut adalah 3 pegawai yang direkomendasikan untuk mengisi
              posisi ini
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-center space-x-1">
              <button
                onClick={() => handleTabChange("promosi")}
                className={`cursor-pointer px-6 py-3 text-md font-semibold transition-all duration-200 border-b-2 ${
                  activeTab === "promosi"
                    ? "bg-teal-50 dark:bg-teal-900/20"
                    : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
                style={
                  activeTab === "promosi"
                    ? {
                        color: PRIMARY_COLORS.teal,
                        borderColor: PRIMARY_COLORS.teal,
                      }
                    : {}
                }
              >
                <i className="fas fa-level-up mr-2" aria-hidden="true"></i>
                Promosi
              </button>
              <button
                onClick={() => handleTabChange("rotasi")}
                className={`cursor-pointer px-6 py-3 text-md font-semibold transition-all duration-200 border-b-2 ${
                  activeTab === "rotasi"
                    ? "bg-teal-50 dark:bg-teal-900/20"
                    : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
                style={
                  activeTab === "rotasi"
                    ? {
                        color: PRIMARY_COLORS.teal,
                        borderColor: PRIMARY_COLORS.teal,
                      }
                    : {}
                }
              >
                <i className="fas fa-sync-alt mr-2" aria-hidden="true"></i>
                Rotasi
              </button>
            </div>
          </div>

          {loadingRekomendasi ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700 border-t-teal-500 mx-auto mb-4"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, index) => {
                const pegawai = rekomendasiPegawai[index];

                if (pegawai) {
                  return (
                    <div
                      key={pegawai.nip}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 overflow-hidden group hover:-translate-y-1 flex flex-col h-full"
                    >
                      {/* Ranking Badge */}
                      <div
                        className="text-white px-6 py-3 flex items-center justify-between"
                        style={{ backgroundColor: PRIMARY_COLORS.teal }}
                      >
                        <span className="text-md font-semibold">
                          Rekomendasi #{index + 1}
                        </span>
                        <div className="flex items-center space-x-1">
                          <i
                            className="fas fa-star text-yellow-300 w-4 h-4"
                            aria-hidden="true"
                          ></i>
                          <span className="text-sm font-medium">
                            Top {index + 1}
                          </span>
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="p-6 flex flex-col flex-1">
                        <div className="flex-grow">
                          {/* Avatar & Basic Info */}
                          <div className="flex items-start space-x-4 mb-4">
                            <div className="flex-shrink-0">
                              {pegawai.avatar ? (
                                <img
                                  src={pegawai.avatar}
                                  alt={pegawai.nama}
                                  className="w-20 h-20 rounded-full border-4 object-cover"
                                  style={{
                                    borderColor: `${PRIMARY_COLORS.teal}20`,
                                  }}
                                />
                              ) : (
                                <div
                                  className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center border-4"
                                  style={{
                                    borderColor: `${PRIMARY_COLORS.teal}20`,
                                  }}
                                >
                                  <span className="text-2xl font-bold text-white">
                                    {pegawai.nama.charAt(0)}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3
                                className="text-lg font-bold text-gray-800 dark:text-white mb-1 line-clamp-2 transition-colors"
                                onMouseEnter={(e) =>
                                  (e.target.style.color = PRIMARY_COLORS.teal)
                                }
                                onMouseLeave={(e) =>
                                  (e.target.style.color = "")
                                }
                              >
                                {pegawai.nama}
                              </h3>
                              <p className="text-md text-gray-500 dark:text-gray-400">
                                NIP. {pegawai.nip}
                              </p>
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded text-md font-medium dark:bg-teal-900 dark:text-teal-200 mt-1 whitespace-nowrap"
                                style={{
                                  backgroundColor: BG_COLORS.teal.light,
                                  color: TEXT_ON_BG_COLORS.teal,
                                }}
                              >
                                {pegawai.jenis_jabatan
                                  ?.replace("Jabatan Pimpinan Tinggi", "JPT")
                                  .replace("Jabatan Fungsional", "JF") ||
                                  pegawai.jenis_jabatan ||
                                  "-"}
                              </span>
                            </div>
                          </div>

                          {/* Details */}
                          <div className="space-y-3 mb-4">
                            <div className="flex items-start">
                              <i
                                className="fas fa-briefcase w-4 h-4 text-teal-500 dark:text-gray-500 mt-0.5 mr-2 flex-shrink-0"
                                aria-hidden="true"
                              ></i>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">
                                  Jabatan
                                </p>
                                <p className="text-md text-gray-700 dark:text-gray-200 font-medium">
                                  {pegawai.jabatan}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start">
                              <i
                                className="fas fa-building w-4 h-4 text-teal-500 dark:text-gray-500 mt-0.5 mr-2 flex-shrink-0"
                                aria-hidden="true"
                              ></i>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">
                                  Unit Kerja
                                </p>
                                <p className="text-md text-gray-700 dark:text-gray-200 font-medium line-clamp-2">
                                  {pegawai.unit_kerja}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center">
                              <i
                                className="fas fa-id-badge w-4 h-4 text-teal-500 dark:text-gray-500 mr-2 flex-shrink-0"
                                aria-hidden="true"
                              ></i>
                              <div className="flex-1">
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">
                                  Golongan
                                </p>
                                <p className="text-md text-gray-700 dark:text-gray-200 font-medium">
                                  {pegawai.golongan}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Performance Metrics (2 kolom) + Nilai Talenta di bawahnya */}
                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900 dark:to-teal-800 rounded-lg p-2 text-center">
                              <div className="text-md text-teal-500 dark:text-teal-400 mt-1 font-medium">
                                Nilai Potensial
                              </div>
                              <div
                                className="text-2xl font-bold dark:text-teal-500"
                                style={{ color: PRIMARY_COLORS.teal }}
                              >
                                {pegawai.nilai_potensial?.toFixed(2) || "0.0"}
                              </div>
                            </div>
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg p-2 text-center">
                              <div className="text-md text-[#3085d6] dark:text-blue-400 mt-1 font-medium">
                                Nilai Kinerja
                              </div>
                              <div className="text-2xl font-bold text-[#3085d6] dark:text-blue-300">
                                {pegawai.nilai_kinerja?.toFixed(2) || "0.0"}
                              </div>
                            </div>
                          </div>

                          {/* Nilai Talenta - tampil sebagai kotak metrik yang seragam di bawah dua metrik */}
                          <div className="mt-3 flex justify-center">
                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 rounded-lg p-2 text-center w-full md:w-1/2">
                              <div className="text-md text-purple-600 dark:text-purple-400 mt-1 font-medium">
                                Nilai Talenta
                              </div>
                              <div className="text-2xl font-bold text-purple-600 dark:text-purple-300">
                                {(() => {
                                  const k =
                                    pegawai.kinerja_score ??
                                    pegawai.nilai_kinerja ??
                                    pegawai.kinerja ??
                                    pegawai.nilaiKinerja ??
                                    (pegawai.penilaian_summary &&
                                      pegawai.penilaian_summary.kinerja) ??
                                    0;
                                  const p =
                                    pegawai.potensial_score ??
                                    pegawai.nilai_potensial ??
                                    pegawai.potensial ??
                                    pegawai.nilaiPotensial ??
                                    (pegawai.penilaian_summary &&
                                      pegawai.penilaian_summary.potensial) ??
                                    0;
                                  const talent =
                                    (Number(k) || 0) * 0.5 +
                                    (Number(p) || 0) * 0.5;
                                  return isNaN(talent)
                                    ? "-"
                                    : talent.toFixed(2);
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="px-6 pb-4 border-t border-gray-100 dark:border-gray-800 mt-auto flex justify-center">
                        <IconButton
                          onClick={() => handleDetailPegawai(pegawai.nip)}
                          variant="primary"
                          size="lg"
                          title="Detail Pegawai"
                        >
                          <i className="fas fa-info-circle mr-2" />
                          Lihat Profil
                        </IconButton>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="bg-gray-50 dark:bg-gray-800/50 rounded-xl shadow-md border-2 border-dashed border-gray-300 dark:border-gray-600 overflow-hidden flex flex-col h-full"
                    >
                      {/* Header Badge */}
                      <div className="bg-gray-200 dark:bg-gray-700 px-6 py-3 flex items-center justify-center border-b-2 border-dashed border-gray-300 dark:border-gray-600">
                        <span className="text-sm font-semibold text-gray-400 dark:text-gray-500">
                          Rekomendasi #{index + 1}
                        </span>
                      </div>

                      {/* Card Content */}
                      <div className="p-8 flex flex-col flex-1 items-center justify-center text-center">
                        <div className="flex-grow flex flex-col items-center justify-center">
                          {/* Icon */}
                          <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-4">
                            <i
                              className="fas fa-user-slash text-4xl text-gray-400 dark:text-gray-500"
                              aria-hidden="true"
                            ></i>
                          </div>

                          {/* Text */}
                          <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2">
                            Tidak Ada Rekomendasi
                          </h3>
                          <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">
                            Tidak ada pegawai yang direkomendasikan untuk posisi
                            ini
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center">
              <i
                className="fas fa-users mr-2 text-lg"
                aria-hidden="true"
                style={{ color: PRIMARY_COLORS.teal }}
              ></i>
              Rekomendasi Pegawai
            </h2>
            <p className="text-md text-gray-600 dark:text-gray-400 mt-1">
              Pilih jabatan untuk melihat rekomendasi pegawai terbaik
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-750 rounded-xl shadow-md border-2 border-dashed border-gray-300 dark:border-gray-600 overflow-hidden flex flex-col h-full"
              >
                {/* Header Badge */}
                <div className="bg-gray-200 dark:bg-gray-700 px-6 py-3 flex items-center justify-center border-b-2 border-dashed border-gray-300 dark:border-gray-600">
                  <span className="text-sm font-semibold text-gray-400 dark:text-gray-500">
                    Rekomendasi #{i + 1}
                  </span>
                </div>

                {/* Card Content */}
                <div className="p-8 flex flex-col flex-1 items-center justify-center text-center">
                  <div className="flex-grow flex flex-col items-center justify-center">
                    {/* Icon */}
                    <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-4">
                      <i
                        className="fas fa-user-tie text-4xl text-gray-400 dark:text-gray-500"
                        aria-hidden="true"
                      ></i>
                    </div>

                    {/* Text */}
                    <h3 className="text-lg font-semibold text-gray-400 dark:text-gray-500 mb-2">
                      Menunggu Pemilihan
                    </h3>
                    <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">
                      Pilih jabatan di atas untuk melihat rekomendasi pegawai
                    </p>
                  </div>

                  {/* Empty Metrics */}
                  <div className="pt-4 w-full">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/50 dark:bg-gray-750/50 rounded-lg p-3 border border-gray-300 dark:border-gray-600">
                        <div className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                          Nilai Kinerja
                        </div>
                        <div className="text-xl font-bold text-gray-300 dark:text-gray-600 mt-1">
                          -
                        </div>
                      </div>
                      <div className="bg-white/50 dark:bg-gray-750/50 rounded-lg p-3 border border-gray-300 dark:border-gray-600">
                        <div className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                          Nilai Potensial
                        </div>
                        <div className="text-xl font-bold text-gray-300 dark:text-gray-600 mt-1">
                          -
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Info Message */}
          <div className="mt-8 text-center">
            <div
              className="inline-flex items-center px-6 py-3 dark:bg-blue-900/20 border rounded-full"
              style={{
                backgroundColor: BG_COLORS.blue.light,
                borderColor: PRIMARY_COLORS.teal,
              }}
            >
              <i
                className="fas fa-info-circle dark:text-blue-400 mr-2"
                style={{ color: TEXT_ON_BG_COLORS.blue }}
                aria-hidden="true"
              ></i>
              <span
                className="text-sm dark:text-blue-400 font-medium"
                style={{ color: TEXT_ON_BG_COLORS.blue }}
              >
                Pilih jabatan di atas untuk melihat 3 rekomendasi terbaik
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suksesi;
