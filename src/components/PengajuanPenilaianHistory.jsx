import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { PRIMARY_COLORS } from "../config/colors";
import {
  fetchPengajuanPenilaianByPegawai,
  deletePengajuanPenilaian,
  encryptTokenForHeader,
} from "../services/apiService";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

const PengajuanPenilaianHistory = ({
  pegawaiId,
  refreshTrigger,
  onDeleteSuccess,
}) => {
  const [pengajuanList, setPengajuanList] = useState([]);
  const [allPengajuanList, setAllPengajuanList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("Diajukan");

  useEffect(() => {
    loadAllPengajuan();
  }, [pegawaiId, refreshTrigger]);

  useEffect(() => {
    loadFilteredPengajuan();
  }, [pegawaiId, refreshTrigger, statusFilter, allPengajuanList]);

  const loadAllPengajuan = async () => {
    try {
      setIsLoading(true);
      const data = await fetchPengajuanPenilaianByPegawai(pegawaiId);
      setAllPengajuanList(data);

      if (statusFilter === "all") {
        setPengajuanList(data);
      }
    } catch (error) {
      console.error("Error loading pengajuan penilaian:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Gagal memuat data pengajuan penilaian",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadFilteredPengajuan = async () => {
    try {
      setIsLoading(true);
      const data = await fetchPengajuanPenilaianByPegawai(pegawaiId, {
        status: statusFilter,
        with_join: true,
      });
      setPengajuanList(data);
    } catch (error) {
      console.error("Error loading pengajuan penilaian:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Gagal memuat data pengajuan penilaian",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "diajukan":
        return {
          bg: "bg-blue-50 dark:bg-blue-900",
          text: "text-[#3085d6] dark:text-blue-200",
          border: "border-blue-300 dark:border-blue-600",
          icon: "fas fa-paper-plane",
        };
      case "diterima":
        return {
          bg: "bg-green-50 dark:bg-green-900",
          text: "text-teal-500 dark:text-green-200",
          border: "border-green-300 dark:border-green-600",
          icon: "fas fa-check-circle",
        };
      case "ditolak":
        return {
          bg: "bg-red-50 dark:bg-red-900",
          text: "text-[#f44336] dark:text-red-200",
          border: "border-red-300 dark:border-red-600",
          icon: "fas fa-times-circle",
        };
      default:
        return {
          bg: "bg-gray-50 dark:bg-gray-900",
          text: "text-[#6b7280] dark:text-gray-200",
          border: "border-gray-300 dark:border-gray-600",
          icon: "fas fa-circle",
        };
    }
  };

  const formatDateIndo = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (isNaN(date)) return dateStr;

    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatMasaBerlaku = (mulai, selesai) => {
    if (!mulai) return "N/A";
    const mulaiFormatted = formatDateIndo(mulai);
    if (!selesai) return mulaiFormatted;
    return `${mulaiFormatted} s/d ${formatDateIndo(selesai)}`;
  };

  const resolveBerkasUrl = (pengajuan, type = "preview") => {
    const rawUrl =
      type === "download" ? pengajuan?.download_url : pengajuan?.preview_url;

    if (!rawUrl) return "";
    if (
      /^https?:\/\//i.test(rawUrl) ||
      /^blob:/i.test(rawUrl) ||
      /^data:/i.test(rawUrl)
    ) {
      return rawUrl;
    }

    if (!API_BASE_URL) return rawUrl;

    return new URL(rawUrl, API_BASE_URL).href;
  };

  const getBerkasFilename = (pengajuan) => {
    const candidateName =
      pengajuan?.original_filename ||
      pengajuan?.bukti_dukung?.split("/").pop() ||
      "";

    if (candidateName) return candidateName;

    const extension =
      pengajuan?.file_type === "application/pdf"
        ? "pdf"
        : pengajuan?.file_type === "application/msword"
          ? "doc"
          : pengajuan?.file_type ===
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ? "docx"
            : "bin";

    return `pengajuan-penilaian-${pengajuan?.id || "berkas"}.${extension}`;
  };

  const handlePreviewBerkas = (pengajuan) => {
    const berkasUrl = resolveBerkasUrl(pengajuan, "preview");
    if (!berkasUrl) return;

    window.open(berkasUrl, "_blank", "noopener,noreferrer");
  };

  const handleDeletePengajuan = async (pengajuan) => {
    if (pengajuan.status?.toLowerCase() !== "diajukan") return;

    const subindikatorName =
      pengajuan.subindikator?.subindikator ||
      pengajuan.subindikator?.nama ||
      "pengajuan ini";

    const result = await Swal.fire({
      icon: "warning",
      title: "Hapus Pengajuan?",
      html: `Pengajuan penilaian untuk <strong>${subindikatorName}</strong> akan dihapus permanen.`,
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: "Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: PRIMARY_COLORS.red,
      cancelButtonColor: "#6b7280",
    });

    if (!result.isConfirmed) return;

    try {
      setDeletingId(pengajuan.id);
      await deletePengajuanPenilaian(pengajuan.id);

      setAllPengajuanList((prev) => prev.filter((p) => p.id !== pengajuan.id));
      setPengajuanList((prev) => prev.filter((p) => p.id !== pengajuan.id));

      await Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Pengajuan penilaian berhasil dihapus",
        timer: 2000,
        showConfirmButton: false,
      });

      onDeleteSuccess?.();
    } catch (error) {
      console.error("Delete pengajuan error:", error);
      Swal.fire({
        icon: "error",
        title: "Gagal Menghapus",
        text: error.message || "Terjadi kesalahan saat menghapus pengajuan",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadBerkas = async (pengajuan) => {
    const berkasUrl = resolveBerkasUrl(pengajuan, "download");
    if (!berkasUrl) return;

    try {
      const encryptedToken = await encryptTokenForHeader(API_TOKEN, {
        salt: API_TOKEN,
      });
      const response = await fetch(berkasUrl, {
        method: "GET",
        headers: {
          "X-API-TOKEN": encryptedToken,
        },
      });

      if (!response.ok) {
        throw new Error(`Download gagal: ${response.statusText}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = getBerkasFilename(pengajuan);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Download error:", error);
      Swal.fire({
        icon: "error",
        title: "Download Gagal",
        text: error.message || "Terjadi kesalahan saat mengunduh berkas",
      });
    }
  };

  const filteredPengajuan = pengajuanList;
  const safeAllPengajuanList = Array.isArray(allPengajuanList)
    ? allPengajuanList
    : [];

  const stats = {
    diajukan: safeAllPengajuanList.filter(
      (p) => p.status?.toLowerCase() === "diajukan",
    ).length,
    diterima: safeAllPengajuanList.filter(
      (p) => p.status?.toLowerCase() === "diterima",
    ).length,
    ditolak: safeAllPengajuanList.filter(
      (p) => p.status?.toLowerCase() === "ditolak",
    ).length,
  };

  const hasBerkas = (pengajuan) =>
    Boolean(
      resolveBerkasUrl(pengajuan, "preview") ||
      resolveBerkasUrl(pengajuan, "download"),
    );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div
        className="px-6 py-4"
        style={{ backgroundColor: PRIMARY_COLORS.teal }}
      >
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <i className="fas fa-history"></i>
          Riwayat Pengajuan Penilaian
        </h2>
      </div>

      {/* Stats */}
      <div className="px-6 py-4 grid grid-cols-3 gap-4 border-b border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <div className="text-2xl font-bold text-[#3085d6] dark:text-blue-400">
            {stats.diajukan}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Diajukan
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-teal-500 dark:text-green-400">
            {stats.diterima}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Diterima
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-[#f44336] dark:text-red-400">
            {stats.ditolak}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Ditolak
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter("Diajukan")}
            className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === "Diajukan"
                ? "bg-[#3085d6] text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            Diajukan ({stats.diajukan})
          </button>
          <button
            onClick={() => setStatusFilter("Diterima")}
            className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === "Diterima"
                ? "bg-teal-500 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            Diterima ({stats.diterima})
          </button>
          <button
            onClick={() => setStatusFilter("Ditolak")}
            className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === "Ditolak"
                ? "bg-[#f44336] text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            Ditolak ({stats.ditolak})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 dark:border-gray-700 border-t-teal-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">
              Memuat riwayat pengajuan...
            </p>
          </div>
        ) : filteredPengajuan.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-inbox text-4xl text-gray-300 dark:text-gray-600 mb-3 block"></i>
            <p className="text-gray-600 dark:text-gray-400">
              Tidak ada pengajuan penilaian
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPengajuan.map((pengajuan, index) => {
              const statusColor = getStatusColor(pengajuan.status);
              return (
                <div
                  key={pengajuan.id || index}
                  className={`border-2 ${statusColor.border} rounded-lg p-4 transition-all hover:shadow-md`}
                >
                  {/* Status Badge */}
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <i
                          className={`${statusColor.icon} ${statusColor.text}`}
                        ></i>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor.bg} ${statusColor.text}`}
                        >
                          {pengajuan.status || "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateIndo(pengajuan.created_at)}
                      </span>
                      {pengajuan.status?.toLowerCase() === "diajukan" && (
                        <button
                          type="button"
                          onClick={() => handleDeletePengajuan(pengajuan)}
                          disabled={deletingId === pengajuan.id}
                          title="Hapus pengajuan"
                          className="cursor-pointer px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors bg-red-50 text-[#f44336] hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-900/40 dark:text-red-200 dark:hover:bg-red-900/60"
                        >
                          {deletingId === pengajuan.id ? (
                            <i className="fas fa-spinner fa-spin"></i>
                          ) : (
                            <>
                              <i className="fas fa-trash-alt mr-1"></i>
                              Hapus
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-600 dark:text-gray-400 font-medium font-semibold">
                        Subindikator
                      </p>
                      <p className="text-gray-900 dark:text-white">
                        {pengajuan.subindikator?.subindikator ||
                          pengajuan.subindikator?.nama ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400 font-medium font-semibold">
                        Instrumen
                      </p>
                      <p className="text-gray-900 dark:text-white">
                        {pengajuan.instrumen?.instrumen ||
                          pengajuan.instrumen?.nama ||
                          "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400 font-medium font-semibold">
                        Tanggal SK
                      </p>
                      <p className="text-gray-900 dark:text-white">
                        {pengajuan.tanggal_sk
                          ? formatDateIndo(pengajuan.tanggal_sk)
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400 font-medium font-semibold">
                        Masa Berlaku
                      </p>
                      <p className="text-gray-900 dark:text-white">
                        {formatMasaBerlaku(
                          pengajuan.masa_berlaku_mulai,
                          pengajuan.masa_berlaku_selesai,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400 font-medium font-semibold">
                        Bukti Dukung
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handlePreviewBerkas(pengajuan)}
                          disabled={!hasBerkas(pengajuan)}
                          className="cursor-pointer px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-blue-50 text-[#3085d6] hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60"
                        >
                          <i className="fas fa-eye mr-2"></i>
                          Lihat
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadBerkas(pengajuan)}
                          disabled={!hasBerkas(pengajuan)}
                          className="cursor-pointer px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        >
                          <i className="fas fa-download mr-2"></i>
                          Unduh
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Catatan if exists */}
                  {pengajuan.catatan && (
                    <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                      <p className="text-gray-600 dark:text-gray-400 font-medium text-sm font-semibold">
                        Catatan
                      </p>
                      <p className="text-gray-900 dark:text-white text-sm">
                        {pengajuan.catatan}
                      </p>
                    </div>
                  )}

                  {/* Alasan Penolakan if status is Ditolak */}
                  {pengajuan.status?.toLowerCase() === "ditolak" &&
                    pengajuan.alasan_penolakan && (
                      <div className="mt-3 pt-3 border-t border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/30 p-3 rounded">
                        <p className="text-red-700 dark:text-red-200 font-medium text-sm">
                          Alasan Penolakan
                        </p>
                        <p className="text-red-900 dark:text-red-100 text-sm">
                          {pengajuan.alasan_penolakan}
                        </p>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PengajuanPenilaianHistory;
