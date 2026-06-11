import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import Breadcrumb from "../components/Breadcrumb";
import IconButton from "../components/IconButton";
import {
  approvePengajuanPenilaian,
  downloadPengajuanPenilaianFile,
  fetchPengajuanPenilaianDetail,
  fetchPengajuanPenilaianPreviewBlob,
  rejectPengajuanPenilaian,
} from "../services/apiService";
import { PRIMARY_COLORS, BG_COLORS, TEXT_ON_BG_COLORS, SECONDARY_COLORS } from "../config/colors";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const statusClass = (status) => {
  switch ((status || "").toLowerCase()) {
    case "diajukan":
      return "bg-blue-500 text-white border border-blue-200";
    case "diterima":
      return "bg-teal-500 text-white border border-teal-200";
    case "ditolak":
      return "bg-red-500 text-white border border-red-200";
    default:
      return "bg-gray-500 text-white border border-gray-200";
  }
};

const ApprovalPengajuanPenilaianDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pengajuan, setPengajuan] = useState(null);
  const [catatanAdmin, setCatatanAdmin] = useState("");
  const [previewObjectUrl, setPreviewObjectUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const canPreviewPdf = pengajuan?.file_type === "application/pdf";
  const canReview = (pengajuan?.status || "").toLowerCase() === "diajukan";

  useEffect(() => {
    document.title = "Detail Approval Pengajuan | SIMANTAP";
  }, []);

  useEffect(() => {
    const loadDetail = async () => {
      try {
        setLoading(true);
        const data = await fetchPengajuanPenilaianDetail(id);
        setPengajuan(data);
        setCatatanAdmin(data?.catatan_admin || "");
      } catch (error) {
        console.error("loadDetail error:", error);
        Swal.fire({
          icon: "error",
          title: "Gagal",
          text: error.message || "Detail pengajuan tidak dapat dimuat",
        });
        navigate("/approval-pengajuan-penilaian");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadDetail();
    }
  }, [id, navigate]);

  useEffect(() => {
    let isActive = true;

    const clearPreview = () => {
      setPreviewObjectUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }
        return "";
      });
    };

    const loadPreview = async () => {
      clearPreview();
      setPreviewError("");

      if (!pengajuan || !canPreviewPdf) {
        setPreviewLoading(false);
        return;
      }

      try {
        setPreviewLoading(true);
        const blob = await fetchPengajuanPenilaianPreviewBlob(pengajuan);

        if (!isActive) return;

        const objectUrl = URL.createObjectURL(blob);
        setPreviewObjectUrl(objectUrl);
      } catch (error) {
        if (!isActive) return;

        console.error("loadPreview error:", error);
        setPreviewError(error.message || "Preview tidak dapat dimuat");
      } finally {
        if (isActive) {
          setPreviewLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      isActive = false;
      clearPreview();
    };
  }, [pengajuan, canPreviewPdf]);

  const handleDownload = async () => {
    if (!pengajuan) return;

    try {
      await downloadPengajuanPenilaianFile(pengajuan);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Download Gagal",
        text: error.message || "Berkas gagal diunduh",
      });
    }
  };

  const handleApprove = async () => {
    if (!pengajuan) return;

    const confirmed = await Swal.fire({
      icon: "question",
      title: "Setujui Pengajuan?",
      text: "Status pengajuan akan berubah menjadi Diterima.",
      showCancelButton: true,
      confirmButtonText: "Ya, Setujui",
      cancelButtonText: "Batal",
      confirmButtonColor: PRIMARY_COLORS.blue,
      cancelButtonColor: PRIMARY_COLORS.red,
      reverseButtons: true,
    });

    if (!confirmed.isConfirmed) return;

    try {
      setSubmitting(true);
      const updated = await approvePengajuanPenilaian(pengajuan.id, {
        catatan_admin: catatanAdmin.trim() || null,
      });
      setPengajuan(updated);

      Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Pengajuan berhasil disetujui",
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Approve Gagal",
        text: error.message || "Terjadi kesalahan saat approve",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!pengajuan) return;

    if (!catatanAdmin.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Catatan Wajib",
        text: "Isi catatan admin untuk menolak pengajuan.",
      });
      return;
    }

    const confirmed = await Swal.fire({
      icon: "warning",
      title: "Tolak Pengajuan?",
      text: "Status pengajuan akan berubah menjadi Ditolak.",
      showCancelButton: true,
      confirmButtonText: "Ya, Tolak",
      cancelButtonText: "Batal",
      confirmButtonColor: PRIMARY_COLORS.red,
      cancelButtonColor: PRIMARY_COLORS.gray,
      reverseButtons: true,
    });

    if (!confirmed.isConfirmed) return;

    try {
      setSubmitting(true);
      const updated = await rejectPengajuanPenilaian(pengajuan.id, {
        catatan_admin: catatanAdmin.trim(),
      });
      setPengajuan(updated);

      Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Pengajuan berhasil ditolak",
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Reject Gagal",
        text: error.message || "Terjadi kesalahan saat reject",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        <div className="h-5 w-72 rounded bg-gray-200 animate-pulse" />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <section className="xl:col-span-2 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 bg-gradient-to-r from-cyan-50 via-white to-emerald-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="h-8 w-64 rounded bg-gray-200 animate-pulse" />
                <div className="h-8 w-24 rounded-full bg-gray-200 animate-pulse" />
              </div>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className={index === 4 || index === 5 ? "md:col-span-1" : ""}>
                  <div className="h-4 w-24 rounded bg-gray-200 animate-pulse mb-2" />
                  <div className="h-5 w-full rounded bg-gray-100 animate-pulse" />
                </div>
              ))}
              <div className="md:col-span-2">
                <div className="h-4 w-28 rounded bg-gray-200 animate-pulse mb-2" />
                <div className="h-24 w-full rounded-xl bg-gray-100 animate-pulse" />
              </div>
            </div>

            <div className="border-t border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="h-5 w-40 rounded bg-gray-200 animate-pulse" />
                <div className="h-10 w-32 rounded-lg bg-gray-200 animate-pulse" />
              </div>
              <div className="h-[640px] w-full rounded-xl bg-gray-100 animate-pulse" />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 h-fit space-y-4">
            <div className="h-6 w-36 rounded bg-gray-200 animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
              <div className="h-32 w-full rounded-lg bg-gray-100 animate-pulse" />
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="h-11 w-full rounded-lg bg-gray-200 animate-pulse" />
              <div className="h-11 w-full rounded-lg bg-gray-200 animate-pulse" />
            </div>
            <div className="h-11 w-full rounded-lg bg-gray-100 animate-pulse" />
          </section>
        </div>
      </div>
    );
  }

  if (!pengajuan) {
    return null;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      <Breadcrumb
        items={[
          { label: "Dashboard", path: "/", icon: "fas fa-home" },
          {
            label: "Approval Pengajuan Penilaian",
            path: "/approval-pengajuan-penilaian",
            icon: "fas fa-user-check",
          },
          { label: "Detail", path: "#", icon: "fas fa-file-signature", clickable: false },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 bg-gradient-to-r from-cyan-50 via-white to-teal-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-bold text-gray-800">Detail Pengajuan Penilaian</h1>
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${statusClass(pengajuan?.status)}`}>
                {pengajuan?.status || "-"}
              </span>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Nama Pegawai</p>
              <p className="font-semibold text-gray-800">{pengajuan?.pegawai?.name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">NIP</p>
              <p className="font-semibold text-gray-800">{pengajuan?.pegawai?.nip || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Jabatan</p>
              <p className="font-semibold text-gray-800">{pengajuan?.pegawai?.jabatan_name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tanggal SK</p>
              <p className="font-semibold text-gray-800">{formatDate(pengajuan?.tanggal_sk)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Subindikator</p>
              <p className="font-semibold text-gray-800">{pengajuan?.subindikator?.subindikator || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Instrumen</p>
              <p className="font-semibold text-gray-800">{pengajuan?.instrumen?.instrumen ? pengajuan?.instrumen?.instrumen + " (Skor: " + pengajuan?.instrumen?.skor + ")" : "-"}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-gray-500">Catatan Pengusul</p>
              <p className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-700 min-h-[72px]">
                {pengajuan?.catatan || "-"}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-800">Bukti Dukung</h2>
              <IconButton onClick={handleDownload} variant="blue" size="md">
                <i className="fas fa-download mr-2" />
                Unduh Berkas
              </IconButton>
            </div>

            {canPreviewPdf ? (
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                {previewLoading ? (
                  <div className="flex h-[640px] items-center justify-center bg-gray-50 text-gray-500">
                    Memuat preview berkas...
                  </div>
                ) : previewError ? (
                  <div className="flex h-[640px] items-center justify-center bg-red-50 px-6 text-center text-red-700">
                    {previewError}
                  </div>
                ) : (
                  <iframe
                    title="Preview Bukti Dukung"
                    src={previewObjectUrl}
                    className="h-[640px] w-full bg-gray-100"
                  />
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                Preview inline hanya tersedia untuk file PDF. Silakan unduh berkas untuk melihat dokumen.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 h-fit space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">Aksi Persetujuan</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catatan Admin {canReview ? "(wajib untuk reject)" : ""}
            </label>
            <textarea
              rows={6}
              value={catatanAdmin}
              onChange={(e) => setCatatanAdmin(e.target.value)}
              disabled={!canReview || submitting}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Tuliskan catatan untuk persetujuan atau penolakan"
            />
          </div>

          {canReview ? (
            <div className="grid grid-cols-1 gap-3">
              <IconButton
                onClick={handleApprove}
                variant="primary"
                size="lg"
                disabled={submitting}
                className="w-full"
              >
                <i className="fas fa-check mr-2" />
                Terima
              </IconButton>
              <IconButton
                onClick={handleReject}
                variant="danger"
                size="lg"
                disabled={submitting}
                className="w-full"
              >
                <i className="fas fa-times mr-2" />
                Tolak
              </IconButton>
            </div>
          ) : (
            <></>
          )}

          <IconButton
            onClick={() => navigate("/approval-pengajuan-penilaian")}
            variant="default"
            size="lg"
            className="w-full"
          >
            <i className="fas fa-arrow-left mr-2" />
            Kembali ke Daftar
          </IconButton>
        </section>
      </div>
    </div>
  );
};

export default ApprovalPengajuanPenilaianDetail;
