import { useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../../context/SettingsContext";
import {
  fetchPegawaiList,
  fetchPetaJabatan,
  syncPegawai,
  syncPenilaian,
  fetchSyncPenilaianStatus,
  fetchSubIndikators,
  bulkUploadPenilaian,
  fetchStatistik,
  fetchPenilaianByNip,
} from "../../services/apiService";
import Swal from "sweetalert2";
import ServerDataTable from "../../components/ServerDataTable";
import IconButton from "../../components/IconButton";
import Breadcrumb from "../../components/Breadcrumb";
import BulkUploadModal from "../../components/BulkUploadModal";
import PenilaianDetailModal from "../../components/PenilaianDetailModal";
import { PRIMARY_COLORS, BG_COLORS, DARK_COLORS } from "../../config/colors";

// Poll sync job progress, resolves when queue is empty or user closes the dialog
const pollSyncProgress = (nips = null) =>
  new Promise((resolve) => {
    let timerId = null;
    let settled = false;

    const finish = (completed, data) => {
      if (settled) return;
      settled = true;
      clearInterval(timerId);
      resolve({ completed, data });
    };

    const tick = async () => {
      try {
        const status = await fetchSyncPenilaianStatus(nips);
        const total = status.session_total_nips ?? status.total ?? 0;
        const synced = status.session_synced ?? 0;
        const pending = status.session_pending ?? null;
        const pct = total > 0 ? Math.round((synced / total) * 100) : 0;

        const bar = document.getElementById("swal-sync-bar");
        const stats = document.getElementById("swal-sync-stats");
        const queue = document.getElementById("swal-sync-queue");
        if (bar) bar.style.width = `${pct}%`;
        if (stats)
          stats.textContent = `${synced} dari ${total} pegawai terproses (${pct}%)`;
        if (queue) {
          const parts = [];
          if (status.queue_pending !== null && status.queue_pending !== undefined)
            parts.push(`Antrian tersisa: ${status.queue_pending}`);
          if (status.queue_completed !== null && status.queue_completed !== undefined)
            parts.push(`Batch selesai: ${status.queue_completed}`);
          if (pending !== null)
            parts.push(`Pending sesi: ${pending}`);
          queue.textContent = parts.join(" · ");
        }
        if (status.queue_pending !== null && status.queue_pending !== undefined && status.queue_pending === 0
          && status.session_pending !== null && status.session_pending !== undefined && status.session_pending === 0) {
          finish(true, status);
          Swal.close();
        }
      } catch (_) {
        /* keep polling */
      }
    };

    Swal.fire({
      title: "Sinkronisasi Berjalan...",
      html: `
        <p style="font-size:14px;color:#4b5563;margin-bottom:12px;">
          Job sinkronisasi penilaian sedang diproses di latar belakang.
        </p>
        <div style="background:#e5e7eb;border-radius:9999px;height:10px;overflow:hidden;margin-bottom:10px;">
          <div id="swal-sync-bar" style="height:100%;background:#3b82f6;border-radius:9999px;width:0%;transition:width 0.4s;"></div>
        </div>
        <div id="swal-sync-stats" style="font-size:13px;font-weight:600;color:#374151;margin-bottom:4px;">Memuat status...</div>
        <div id="swal-sync-queue" style="font-size:12px;color:#6b7280;"></div>
      `,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: "Tutup (lanjutkan di latar)",
      cancelButtonColor: "#6b7280",
      didOpen: () => {
        tick();
        timerId = setInterval(tick, 2500);
      },
      willClose: () => {
        finish(false, null);
      },
    });
  });

const PenilaianPegawai = () => {
  const { t } = useSettings();
  const navigate = useNavigate();
  const [filterOptions, setFilterOptions] = useState({
    organisasi: [],
    jabatan: [],
    jenis: [],
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingPenilaian, setIsSyncingPenilaian] = useState(false);
  const [syncingNips, setSyncingNips] = useState(new Set());
  const [subIndikators, setSubIndikators] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPegawai, setSelectedPegawai] = useState(null);
  const [penilaianDetail, setPenilaianDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  useEffect(() => {
    document.title = `Penilaian Pegawai | SIMANTAP`;
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

      setFilterOptions({
        organisasi: uniqueOrganisasi,
        jabatan: uniqueJabatan,
        jenis: jenisOptions,
      });
    } catch (error) {
      console.error("Error loading filter options:", error);
    }
  };

  useEffect(() => {
    loadFilterOptions();
    // load subindikators for template
    const loadSub = async () => {
      try {
        const subs = await fetchSubIndikators();
        setSubIndikators(subs || []);
      } catch (err) {
        console.error("Failed to load subindikators", err);
      }
    };
    loadSub();
  }, []);

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

  const handleSyncPenilaian = async () => {
    const { value: formValues, isConfirmed } = await Swal.fire({
      icon: "question",
      title: "Sinkronisasi Penilaian",
      html: `
        <p style="margin-bottom:14px;color:#4b5563;font-size:14px;">
          Pilih cakupan sinkronisasi data penilaian dari layanan.
        </p>
        <div style="text-align:left;margin-bottom:14px;">
          <label style="display:flex;align-items:center;gap:8px;margin-bottom:10px;cursor:pointer;font-size:14px;">
            <input type="radio" name="syncType" value="all" checked /> Semua pegawai
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;">
            <input type="radio" name="syncType" value="specific" /> Pegawai tertentu (berdasarkan NIP)
          </label>
        </div>
        <div id="nipInputContainer" style="display:none;">
          <label style="display:block;margin-bottom:6px;font-size:13px;font-weight:600;color:#374151;text-align:left;">NIP Pegawai</label>
          <textarea id="nipInput"
            placeholder="Masukkan NIP, pisahkan dengan koma atau enter untuk beberapa pegawai..."
            style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px;font-size:13px;min-height:90px;resize:vertical;box-sizing:border-box;"
          ></textarea>
          <p style="font-size:12px;color:#6b7280;margin-top:4px;text-align:left;">
            Contoh: <em>199001012020011001</em> atau beberapa NIP dipisahkan koma/enter
          </p>
        </div>
      `,
      didOpen: () => {
        const radios = document.querySelectorAll('input[name="syncType"]');
        const nipContainer = document.getElementById("nipInputContainer");
        radios.forEach((radio) => {
          radio.addEventListener("change", () => {
            nipContainer.style.display =
              radio.value === "specific" ? "block" : "none";
          });
        });
      },
      showCancelButton: true,
      confirmButtonText: "Sinkronisasi",
      cancelButtonText: "Batal",
      confirmButtonColor: PRIMARY_COLORS.blue,
      cancelButtonColor: PRIMARY_COLORS.red,
      reverseButtons: true,
      preConfirm: () => {
        const syncType = document.querySelector(
          'input[name="syncType"]:checked'
        )?.value;
        if (syncType === "specific") {
          const nipRaw = document
            .getElementById("nipInput")
            ?.value?.trim();
          if (!nipRaw) {
            Swal.showValidationMessage(
              "Masukkan minimal satu NIP pegawai"
            );
            return false;
          }
          const nips = nipRaw
            .split(/[\n,]+/)
            .map((n) => n.trim())
            .filter(Boolean);
          return { syncType: "specific", nips };
        }
        return { syncType: "all", nips: null };
      },
    });

    if (!isConfirmed || !formValues) return;

    try {
      setIsSyncingPenilaian(true);
      await syncPenilaian(formValues.nips);
      // Job dispatched — poll progress
      const { completed } = await pollSyncProgress(formValues.nips);
      setRefreshKey((k) => k + 1);
      const nipInfo =
        formValues.syncType === "specific"
          ? ` untuk ${formValues.nips.length} pegawai`
          : "";
      if (completed) {
        Swal.fire({
          icon: "success",
          title: "Sukses",
          text: `Sinkronisasi penilaian${nipInfo} selesai`,
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        Swal.fire({
          icon: "info",
          title: "Job Masih Berjalan",
          text: `Sinkronisasi penilaian${nipInfo} masih diproses di latar belakang.`,
          timer: 3000,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: err.message || "Sinkronisasi penilaian gagal",
        confirmButtonColor: PRIMARY_COLORS.blue,
      });
    } finally {
      setIsSyncingPenilaian(false);
    }
  };

  const handleSyncPenilaianSingle = async (nip, nama) => {
    const result = await Swal.fire({
      icon: "question",
      title: "Sinkronisasi Penilaian",
      html: `Sinkronisasi penilaian untuk <strong>${nama}</strong> (${nip})?`,
      showCancelButton: true,
      confirmButtonText: "Ya, Sinkronisasi",
      cancelButtonText: "Batal",
      confirmButtonColor: PRIMARY_COLORS.blue,
      cancelButtonColor: PRIMARY_COLORS.red,
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    setSyncingNips((prev) => new Set(prev).add(nip));
    try {
      await syncPenilaian([nip]);
      // Job dispatched — poll progress
      const { completed } = await pollSyncProgress([nip]);
      setRefreshKey((k) => k + 1);
      if (completed) {
        Swal.fire({
          icon: "success",
          title: "Sukses",
          text: `Sinkronisasi penilaian untuk ${nama} selesai`,
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        Swal.fire({
          icon: "info",
          title: "Job Masih Berjalan",
          text: `Sinkronisasi penilaian untuk ${nama} masih diproses di latar belakang.`,
          timer: 3000,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: err.message || "Sinkronisasi penilaian gagal",
        confirmButtonColor: PRIMARY_COLORS.blue,
      });
    } finally {
      setSyncingNips((prev) => {
        const next = new Set(prev);
        next.delete(nip);
        return next;
      });
    }
  };

  // Memoize fetch function to prevent unnecessary re-renders
  const fetchData = useCallback(async (params) => {
    return await fetchPegawaiList({ ...params, withPenilaian: true });
  }, []);

  const handlePenilaian = (nip) => {
    navigate(`/masterdata/penilaian-pegawai/input-penilaian/${nip}`);
  };

  const handleBulkUpload = async (dataRows) => {
    setIsUploading(true);
    try {
      const result = await bulkUploadPenilaian(dataRows);
      setRefreshKey((k) => k + 1);
      return result;
    } catch (error) {
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewDetail = async (pegawai) => {
    setSelectedPegawai(pegawai);
    setShowDetailModal(true);
    setIsLoadingDetail(true);
    setPenilaianDetail(null);

    try {
      const data = await fetchPenilaianByNip(pegawai.nip);
      // Extract penilaian data from response
      // Assuming the API returns { data: { penilaian: {...} } } or similar structure
      const penilaianData = data?.data?.penilaian || data?.penilaian || data?.data || null;
      setPenilaianDetail(penilaianData);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: error.message || "Gagal mengambil detail penilaian",
        confirmButtonColor: PRIMARY_COLORS.blue,
      });
      setPenilaianDetail(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const columns = [
    {
      key: "no",
      label: "No",
      render: (_, index) => (
        <span className="font-semibold text-gray-500 dark:text-gray-400">
          {index + 1}
        </span>
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
          <div className="font-medium text-gray-900 dark:text-gray-100">
            {item.nama}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {item.email}
          </div>
        </div>
      ),
    },
    {
      key: "nip",
      label: "NIP",
      noWrap: true,
      render: (item) => (
        <span className="text-md text-gray-700 dark:text-gray-300">
          {item.nip}
        </span>
      ),
    },
    {
      key: "jabatan",
      label: "Jabatan",
      render: (item) => (
        <div>
          <div className="text-md font-medium text-gray-900 dark:text-gray-100">
            {item.jabatan || "-"}
          </div>
          <div className="flex gap-2 mt-1">
            {item.jenis_jabatan && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-md font-medium dark:bg-teal-900 dark:text-teal-200 text-teal-600 bg-teal-100">
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
      label: "Unit Kerja",
      render: (item) => (
        <div>
          <div className="text-md text-gray-900 dark:text-gray-100">
            {item.unit_kerja || "-"}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {item.lokasi_kerja || ""}
          </div>
        </div>
      ),
    },
    {
      key: "penilaian_status",
      label: "Penilaian",
      render: (item) => {
        const hasPenilaian =
          Boolean(item.penilaian) ||
          Boolean(item.has_penilaian) ||
          (Array.isArray(item.penilaian_list) &&
            item.penilaian_list.length > 0) ||
          (Array.isArray(item.penilaian_entries) &&
            item.penilaian_entries.length > 0) ||
          (item.penilaian_count && item.penilaian_count > 0);
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-medium ${
              hasPenilaian
                ? "dark:bg-teal-900 dark:text-teal-200"
                : "dark:bg-red-900 dark:text-red-200"
            }`}
            style={hasPenilaian ? { backgroundColor: BG_COLORS.teal.light, color: DARK_COLORS.teal } : { backgroundColor: BG_COLORS.red.light, color: DARK_COLORS.red }}
          >
            {hasPenilaian ? "Sudah" : "Belum"}
          </span>
        );
      },
    },
    {
      key: "aksi",
      label: "",
      render: (item) => {
        const hasPenilaian =
          Boolean(item.penilaian) ||
          Boolean(item.has_penilaian) ||
          (Array.isArray(item.penilaian_list) &&
            item.penilaian_list.length > 0) ||
          (Array.isArray(item.penilaian_entries) &&
            item.penilaian_entries.length > 0) ||
          (item.penilaian_count && item.penilaian_count > 0);
        
        const isSyncingThis = syncingNips.has(item.nip);
        return (
          <div className="flex items-center justify-center gap-2">
            {hasPenilaian && (
              <IconButton
                onClick={() => handleViewDetail(item)}
                variant="info"
                size="lg"
                title="Lihat Detail Penilaian"
              >
                <i className="fas fa-eye mr-2" />
                Lihat
              </IconButton>
            )}
            <IconButton
              onClick={() => handleSyncPenilaianSingle(item.nip, item.nama)}
              variant="blue"
              size="lg"
              disabled={isSyncingThis}
              title="Sinkronisasi Penilaian Pegawai Ini"
            >
              {isSyncingThis ? (
                <i className="fas fa-spinner fa-spin mr-2" />
              ) : (
                <i className="fas fa-sync mr-2" />
              )}
              Sync
            </IconButton>
            <IconButton
              onClick={() => handlePenilaian(item.nip)}
              variant="primary"
              size="lg"
              title="Input/Ubah Penilaian"
            >
              <i className="fas fa-edit mr-2" />
              {hasPenilaian ? "Ubah" : "Input"}
            </IconButton>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Breadcrumb */}
      <Breadcrumb />
      
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
          Penilaian Pegawai
        </h1>
        <p className="mt-2 text-md md:text-base text-gray-600 dark:text-gray-300">
          Kelola penilaian kinerja dan potensi pegawai
        </p>
      </div>

      {/* Action Buttons */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3 justify-end">
        <IconButton
          onClick={() => setShowBulkUploadModal(true)}
          variant="blue"
          size="lg"
          disabled={isUploading}
          title="Impor Data Penilaian"
        >
          {isUploading ? (
            <i className="fas fa-spinner fa-spin mr-2" />
          ) : (
            <i className="fas fa-file-import mr-2" />
          )}
          Impor Data
        </IconButton>
        <IconButton
          onClick={handleSyncPenilaian}
          variant="primary"
          size="lg"
          disabled={isSyncingPenilaian}
          title="Sinkronisasi Penilaian"
        >
          {isSyncingPenilaian ? (
            <i className="fas fa-spinner fa-spin mr-2" />
          ) : (
            <i className="fas fa-sync mr-2" />
          )}
          Sinkronisasi Penilaian
        </IconButton>
        <IconButton
          onClick={handleSync}
          variant="primary"
          size="lg"
          disabled={isSyncing}
          title="Sinkronisasi Pegawai"
        >
          {isSyncing ? (
            <i className="fas fa-spinner fa-spin mr-2" />
          ) : (
            <i className="fas fa-sync mr-2" />
          )}
          Sinkronisasi Pegawai
        </IconButton>
      </div>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={showBulkUploadModal}
        onClose={() => setShowBulkUploadModal(false)}
        subIndikators={subIndikators}
        onUploadSuccess={handleBulkUpload}
      />

      {/* Detail Penilaian Modal */}
      <PenilaianDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        pegawai={selectedPegawai}
        penilaianData={penilaianDetail}
        subIndikators={subIndikators}
        loading={isLoadingDetail}
        onEditPenilaian={handlePenilaian}
      />

      {/* Data Table */}
      <ServerDataTable
        key={refreshKey}
        columns={columns}
        fetchData={fetchData}
        itemsPerPageOptions={[10, 25, 50, 100]}
        defaultFilters={{
          unit_organisasi: "",
          jabatan: "",
          filter: "",
          golongan: "",
        }}
        filterConfigs={[
          {
            key: "unit_organisasi_name",
            label: "Unit Kerja",
            placeholder: "Semua Unit Kerja",
            options: filterOptions.organisasi,
          },
          {
            key: "jabatan_name",
            label: "Jabatan",
            placeholder: "Semua Jabatan",
            options: filterOptions.jabatan,
          },
          {
            key: "filter",
            label: "Jenis Jabatan",
            placeholder: "Semua Jenis",
            options: filterOptions.jenis,
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

export default PenilaianPegawai;
