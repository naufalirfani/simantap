import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { PRIMARY_COLORS, BG_COLORS, TEXT_ON_BG_COLORS } from "../config/colors";
import Breadcrumb from "../components/Breadcrumb";
import IconButton from "../components/IconButton";
import {
  fetchPetaJabatanKosong,
  fetchRekomendasiPegawai,
} from "../services/apiService";
import ExcelJS from "exceljs";

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
  const [tableSearch, setTableSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 5;

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

  const filteredJabatan = jabatanKosong.filter((j) => {
    const q = tableSearch.toLowerCase();
    return (
      (j.nama_jabatan || "").toLowerCase().includes(q) ||
      (j.unit_kerja || "").toLowerCase().includes(q) ||
      (j.jenis_jabatan || "").toLowerCase().includes(q)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filteredJabatan.length / PAGE_SIZE));
  const pagedJabatan = filteredJabatan.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Jabatan Akan Kosong");

    sheet.columns = [
      { header: "No", key: "no", width: 6 },
      { header: "Nama Jabatan", key: "nama_jabatan", width: 35 },
      { header: "Unit Kerja", key: "unit_kerja", width: 35 },
      { header: "Jenis Jabatan", key: "jenis_jabatan", width: 25 },
      { header: "Kelas Jabatan", key: "kelas_jabatan", width: 16 },
      { header: "Kebutuhan Pegawai", key: "kebutuhan_pegawai", width: 20 },
      { header: "Bezetting", key: "bezetting", width: 14 },
      { header: "Pejabat Saat Ini", key: "pejabat", width: 30 },
      { header: "Tanggal Pensiun", key: "tanggal_pensiun", width: 20 },
      { header: "Sisa Masa Kerja", key: "sisa_masa_kerja", width: 22 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D9488" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        top: { style: "thin" }, left: { style: "thin" },
        bottom: { style: "thin" }, right: { style: "thin" },
      };
    });
    headerRow.height = 24;

    jabatanKosong.forEach((j, idx) => {
      const pejabatNames = (j.pejabat || [])
        .map((p) => `${p.name} (${p.nip})`)
        .join(", ");
      const tanggalPensiun = (j.pejabat || [])
        .map((p) => formatDateIndo(p.tanggal_pensiun || p.tglPensiun))
        .join(", ");
      const sisaMasaKerja = (j.pejabat || [])
        .map((p) => p.sisa_masa_kerja || computeRemaining(p))
        .join(", ");

      const row = sheet.addRow({
        no: idx + 1,
        nama_jabatan: j.nama_jabatan || "-",
        unit_kerja: j.unit_kerja || "-",
        jenis_jabatan: j.jenis_jabatan || "-",
        kelas_jabatan: j.kelas_jabatan || "-",
        kebutuhan_pegawai: j.kebutuhan_pegawai ?? "-",
        bezetting: j.bezetting ?? "-",
        pejabat: pejabatNames || "-",
        tanggal_pensiun: tanggalPensiun || "-",
        sisa_masa_kerja: sisaMasaKerja || "-",
      });
      row.eachCell((cell) => {
        cell.alignment = { vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "thin" }, left: { style: "thin" },
          bottom: { style: "thin" }, right: { style: "thin" },
        };
        if (idx % 2 === 1) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDFA" } };
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Jabatan_Akan_Kosong.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  };

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
          {/* Header row: title + export button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-md font-semibold text-gray-700 dark:text-gray-300">
                Pilih Jabatan yang Akan Kosong
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Klik baris jabatan untuk melihat rekomendasi pegawai
              </p>
            </div>
            <IconButton
              onClick={handleExportExcel}
              disabled={jabatanKosong.length === 0}
              variant="primary"
              size="lg"
              title="Ekspor Excel"
            >
              <i className="fas fa-file-excel text-lg" aria-hidden="true" />
              <span>Ekspor Excel</span>
            </IconButton>
          </div>

          {/* Search input */}
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <i className="fas fa-search text-gray-400" aria-hidden="true"></i>
            </div>
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => { setTableSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Cari nama jabatan, unit kerja, atau jenis jabatan..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 dark:focus:ring-teal-600"
            />
            {tableSearch && (
              <button
                onClick={() => { setTableSearch(""); setCurrentPage(1); }}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 dark:border-gray-700 border-t-teal-500"></div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead>
                  <tr style={{ backgroundColor: PRIMARY_COLORS.teal }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider w-8">No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Nama Jabatan</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Unit Kerja</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Jenis Jabatan</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">Kelas</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">Kebutuhan</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">Bezetting</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">Pejabat Saat Ini</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredJabatan.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                        {tableSearch ? "Tidak ada jabatan yang cocok dengan pencarian." : "Tidak ada data jabatan."}
                      </td>
                    </tr>
                  ) : (
                    pagedJabatan.map((jabatan, idx) => {
                      const isSelected = selectedJabatan === jabatan.id;
                      const rowNum = (currentPage - 1) * PAGE_SIZE + idx + 1;
                      return (
                        <tr
                          key={jabatan.id}
                          onClick={() => handleJabatanChange(jabatan.id)}
                          className={`cursor-pointer transition-colors duration-150 ${
                            isSelected
                              ? "bg-teal-50 dark:bg-teal-900/30 border-l-4"
                              : idx % 2 === 0
                              ? "bg-white dark:bg-gray-800 hover:bg-teal-50/50 dark:hover:bg-teal-900/10"
                              : "bg-gray-50 dark:bg-gray-750 hover:bg-teal-50/50 dark:hover:bg-teal-900/10"
                          }`}
                          style={isSelected ? { borderLeftColor: PRIMARY_COLORS.teal } : {}}
                        >
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">{rowNum}</td>
                          <td className="px-4 py-3">
                            <span className={`font-semibold ${
                              isSelected
                                ? "dark:text-teal-300"
                                : "text-gray-800 dark:text-white"
                            }`} style={isSelected ? { color: PRIMARY_COLORS.teal } : {}}>
                              {jabatan.nama_jabatan}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{jabatan.unit_kerja || "-"}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: BG_COLORS.teal.light, color: TEXT_ON_BG_COLORS.teal }}>
                              {jabatan.jenis_jabatan?.replace("Jabatan Pimpinan Tinggi", "JPT").replace("Jabatan Fungsional", "JF") || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{jabatan.kelas_jabatan || "-"}</td>
                          <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{jabatan.kebutuhan_pegawai ?? "-"}</td>
                          <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{jabatan.bezetting ?? "-"}</td>
                          <td className="px-4 py-3 text-center">
                            {jabatan.pejabat && jabatan.pejabat.length > 0 ? (
                              <div className="text-sm text-gray-700 dark:text-gray-300">
                                {jabatan.pejabat.map((p, pi) => (
                                  <div key={pi} className="font-medium">{p.name}</div>
                                ))}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                                style={{ backgroundColor: BG_COLORS.yellow.light, color: TEXT_ON_BG_COLORS.yellow }}>
                                <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
                                Kosong
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && filteredJabatan.length > 0 && (
            <div className="px-3 py-4 bg-gradient-to-r from-white to-white dark:from-gray-800 dark:to-gray-800 border-t border-gray-200 dark:border-gray-700 mt-2 -mx-6 -mb-6 rounded-b-xl">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Pagination buttons */}
                <div className="flex items-center gap-2">
                  {/* First page */}
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-teal-500/10 dark:hover:bg-gray-600 hover:border-teal-500/50 dark:hover:border-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                  >
                    <i className="fas fa-angle-double-left w-4 h-4" aria-hidden="true" />
                  </button>

                  {/* Previous page */}
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-teal-500/10 dark:hover:bg-gray-600 hover:border-teal-500/50 dark:hover:border-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                  >
                    <i className="fas fa-angle-left w-4 h-4" aria-hidden="true" />
                  </button>

                  {/* Page numbers */}
                  <div className="hidden sm:flex items-center gap-1">
                    {getPageNumbers().map((page, index) => (
                      <button
                        key={index}
                        onClick={() => typeof page === "number" && setCurrentPage(page)}
                        disabled={page === "..."}
                        className={`min-w-[2.5rem] px-3 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                          page === currentPage
                            ? "bg-gradient-to-r from-teal-500 to-teal-500 text-white shadow-md scale-105 cursor-pointer"
                            : page === "..."
                            ? "cursor-default text-gray-500 dark:text-gray-400 bg-transparent border-0 shadow-none"
                            : "text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-teal-500/10 dark:hover:bg-gray-600 hover:border-teal-500/50 dark:hover:border-teal-500 cursor-pointer"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  {/* Next page */}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-teal-500/10 dark:hover:bg-gray-600 hover:border-teal-500/50 dark:hover:border-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                  >
                    <i className="fas fa-angle-right w-4 h-4" aria-hidden="true" />
                  </button>

                  {/* Last page */}
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-teal-500/10 dark:hover:bg-gray-600 hover:border-teal-500/50 dark:hover:border-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                  >
                    <i className="fas fa-angle-double-right w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                {/* Results info */}
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Menampilkan{" "}
                  <span className="font-bold text-gray-900 dark:text-gray-100">
                    {(currentPage - 1) * PAGE_SIZE + 1}
                  </span>{" "}
                  sampai{" "}
                  <span className="font-bold text-gray-900 dark:text-gray-100">
                    {Math.min(currentPage * PAGE_SIZE, filteredJabatan.length)}
                  </span>{" "}
                  dari{" "}
                  <span className="font-bold text-gray-900 dark:text-gray-100">
                    {filteredJabatan.length}
                  </span>{" "}
                  jabatan
                </div>
              </div>
            </div>
          )}

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
