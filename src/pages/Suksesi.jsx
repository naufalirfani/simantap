import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";
import { PRIMARY_COLORS, BG_COLORS, TEXT_ON_BG_COLORS } from "../config/colors";
import Breadcrumb from "../components/Breadcrumb";
import IconButton from "../components/IconButton";
import Swal from "sweetalert2";
import {
  fetchPetaJabatanKosong,
  fetchRekomendasiPegawai,
  exportRekomendasiPegawaiExcel,
  assignSuksesor,
  cancelSuksesor,
  fetchSyaratSuksesi,
  fetchIndikators,
  fetchInstrumens,
} from "../services/apiService";
import ExcelJS from "exceljs";

const KATEGORI_JABATAN_OPTIONS = [
  {
    value: "sudah_kosong",
    label: "Sudah kosong",
    badgeColor: "rose",
    icon: "fa-exclamation-circle",
    dotClass: "bg-rose-500",
  },
  {
    value: "6_bulan",
    label: "Akan kosong dalam 6 bulan",
    badgeColor: "amber",
    icon: "fa-clock",
    dotClass: "bg-amber-500",
  },
  {
    value: "1_tahun",
    label: "Akan kosong dalam 1 tahun",
    badgeColor: "blue",
    icon: "fa-hourglass-half",
    dotClass: "bg-blue-500",
  },
  {
    value: "2_tahun",
    label: "Akan kosong dalam 2 tahun",
    badgeColor: "purple",
    icon: "fa-calendar-alt",
    dotClass: "bg-purple-500",
  },
];

const PANGKAT_GOLONGAN_OPTIONS = [
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
];

const getPangkatLabel = (val) => {
  if (!val) return "-";
  const found = PANGKAT_GOLONGAN_OPTIONS.find((p) => p.value === val);
  return found ? found.label : val;
};

const Suksesi = () => {
  const { t } = useSettings();
  const navigate = useNavigate();
  const [jabatanKosong, setJabatanKosong] = useState([]);
  const [selectedJabatan, setSelectedJabatan] = useState("");
  const [selectedJabatanData, setSelectedJabatanData] = useState(null);
  const [rekomendasiPegawai, setRekomendasiPegawai] = useState([]);
  const [showAllRekomendasi, setShowAllRekomendasi] = useState(false);
  const [rekomendasiPengaturan, setRekomendasiPengaturan] = useState(null);
  const [selectedJenisJabatan, setSelectedJenisJabatan] = useState("keduanya"); // "keduanya" | "struktural" | "fungsional"
  const [loading, setLoading] = useState(true);
  const [loadingRekomendasi, setLoadingRekomendasi] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("promosi"); // "promosi" or "rotasi"
  const [tableSearch, setTableSearch] = useState("");
  const [selectedKategoriJabatan, setSelectedKategoriJabatan] = useState([]);
  const [isKategoriDropdownOpen, setIsKategoriDropdownOpen] = useState(false);
  const kategoriDropdownRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 5;

  const getKategoriLabel = (kategori) => {
    switch (kategori) {
      case "sudah_kosong":
        return "Sudah kosong";
      case "6_bulan":
        return "Akan kosong dalam 6 bulan";
      case "1_tahun":
        return "Akan kosong dalam 1 tahun";
      case "2_tahun":
        return "Akan kosong dalam 2 tahun";
      default:
        return "-";
    }
  };

  const getKategoriJabatan = (j) => {
    if (j?.kategori_jabatan_kosong) return j.kategori_jabatan_kosong;
    const bezetting = Number(j?.bezetting ?? 0);
    const kebutuhan = Number(j?.kebutuhan_pegawai ?? 0);
    const pej = j?.pejabat || [];
    if (bezetting === 0 || kebutuhan - bezetting > 0 || pej.length === 0) {
      return "sudah_kosong";
    }
    const p = pej[0];
    if (!p) return "sudah_kosong";
    const now = new Date();
    let retireDate = null;
    if (p.tanggal_pensiun) retireDate = new Date(p.tanggal_pensiun);
    else if (p.tglPensiun) retireDate = new Date(p.tglPensiun);
    else if (p.tglLahir) {
      const b = new Date(p.tglLahir);
      if (!isNaN(b)) {
        const retirementAge =
          (j.jenis_jabatan || "").toUpperCase().includes("ESELON I") ||
          (j.jenis_jabatan || "").toUpperCase().includes("ESELON II")
            ? 60
            : 58;
        retireDate = new Date(
          b.getFullYear() + retirementAge,
          b.getMonth(),
          b.getDate()
        );
      }
    }
    if (!retireDate || isNaN(retireDate)) return "sudah_kosong";
    const diffMs = retireDate.getTime() - now.getTime();
    if (diffMs <= 0) return "sudah_kosong";
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays <= 183) return "6_bulan";
    if (diffDays <= 365) return "1_tahun";
    if (diffDays <= 730) return "2_tahun";
    return "";
  };

  const renderKategoriBadge = (kategori, label) => {
    const effectiveLabel = label || getKategoriLabel(kategori);
    switch (kategori) {
      case "sudah_kosong":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-300 dark:border-rose-700 whitespace-nowrap">
            <i className="fas fa-exclamation-circle text-rose-500" aria-hidden="true"></i>
            <span>{effectiveLabel}</span>
          </span>
        );
      case "6_bulan":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700 whitespace-nowrap">
            <i className="fas fa-clock text-amber-500" aria-hidden="true"></i>
            <span>{effectiveLabel}</span>
          </span>
        );
      case "1_tahun":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300 dark:border-blue-700 whitespace-nowrap">
            <i className="fas fa-hourglass-half text-blue-500" aria-hidden="true"></i>
            <span>{effectiveLabel}</span>
          </span>
        );
      case "2_tahun":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-300 dark:border-purple-700 whitespace-nowrap">
            <i className="fas fa-calendar-alt text-purple-500" aria-hidden="true"></i>
            <span>{effectiveLabel}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {effectiveLabel || "-"}
          </span>
        );
    }
  };

  // States for Modal Syarat Suksesi
  const [modalSyaratOpen, setModalSyaratOpen] = useState(false);
  const [modalJabatan, setModalJabatan] = useState(null);
  const [modalSyaratLoading, setModalSyaratLoading] = useState(false);
  const [modalSyaratData, setModalSyaratData] = useState(null);
  const [allIndikators, setAllIndikators] = useState([]);
  const [allInstrumens, setAllInstrumens] = useState([]);

  const handleNavigateSyarat = (jabatan) => {
    if (!jabatan) return;
    navigate(`/masterdata/jabatan/${jabatan.id}/syarat-suksesi`, {
      state: { jabatan, from: "/suksesi" },
    });
  };

  const handleOpenSyaratModal = async (jabatan) => {
    if (!jabatan) return;
    setModalJabatan(jabatan);
    setModalSyaratOpen(true);
    setModalSyaratLoading(true);
    try {
      const promises = [fetchSyaratSuksesi(jabatan.id)];
      if (allIndikators.length === 0) promises.push(fetchIndikators());
      if (allInstrumens.length === 0) promises.push(fetchInstrumens());

      const results = await Promise.all(promises);
      setModalSyaratData(results[0] || null);

      let pIdx = 1;
      if (allIndikators.length === 0 && results[pIdx]) {
        setAllIndikators(results[pIdx]);
        pIdx++;
      }
      if (allInstrumens.length === 0 && results[pIdx]) {
        setAllInstrumens(results[pIdx]);
      }
    } catch (err) {
      console.error("Error loading syarat suksesi detail:", err);
      setModalSyaratData(null);
    } finally {
      setModalSyaratLoading(false);
    }
  };

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

  // Close kategori dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        kategoriDropdownRef.current &&
        !kategoriDropdownRef.current.contains(event.target)
      ) {
        setIsKategoriDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadJabatanKosong = async (preserveSelectedId = null, kategori = selectedKategoriJabatan) => {
    try {
      setLoading(true);
      const data = await fetchPetaJabatanKosong(kategori);
      setJabatanKosong(data);
      const targetId = preserveSelectedId !== null ? preserveSelectedId : selectedJabatan;
      if (targetId) {
        const found = data.find((j) => j.id === targetId);
        if (found) {
          setSelectedJabatan(targetId);
          setSelectedJabatanData(found);
        } else {
          setSelectedJabatan("");
          setSelectedJabatanData(null);
          setRekomendasiPegawai([]);
        }
      }
      setError(null);
      return data;
    } catch (err) {
      console.error("Error loading jabatan kosong:", err);
      setError("Gagal memuat data jabatan kosong");
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleKategoriJabatanChange = async (kategori) => {
    const nextList = Array.isArray(kategori)
      ? kategori
      : kategori
        ? [kategori]
        : [];
    setSelectedKategoriJabatan(nextList);
    setCurrentPage(1);
    await loadJabatanKosong(selectedJabatan, nextList);
  };

  const toggleKategoriItem = (val) => {
    const current = Array.isArray(selectedKategoriJabatan)
      ? selectedKategoriJabatan
      : [];
    const next = current.includes(val)
      ? current.filter((k) => k !== val)
      : [...current, val];
    handleKategoriJabatanChange(next);
  };

  const handleSelectAllKategori = () => {
    const all = KATEGORI_JABATAN_OPTIONS.map((o) => o.value);
    handleKategoriJabatanChange(all);
  };

  const handleClearAllKategori = () => {
    handleKategoriJabatanChange([]);
  };

  const reloadAllData = async (jabatanId) => {
    try {
      const data = await fetchPetaJabatanKosong(selectedKategoriJabatan);
      setJabatanKosong(data);
      const targetId = jabatanId || selectedJabatan;
      if (targetId) {
        const found = data.find((j) => j.id === targetId);
        setSelectedJabatanData(found || null);
        await loadRekomendasi(targetId, activeTab === "rotasi", selectedJenisJabatan);
      }
    } catch (err) {
      console.error("Error reloading data:", err);
    }
  };

  const handleAssignSuksesor = async (pegawai) => {
    if (!selectedJabatan || !pegawai) return;

    const currentSuksesorName = selectedJabatanData?.suksesor?.pegawai?.name;
    let confirmHtml = `Tetapkan <strong>${pegawai.nama}</strong> sebagai suksesor untuk jabatan <strong>${selectedJabatanData?.nama_jabatan || "ini"}</strong>?`;
    if (currentSuksesorName) {
      confirmHtml = `Jabatan ini saat ini memiliki suksesor <strong>${currentSuksesorName}</strong>.<br/><br/>Apakah Anda yakin ingin menggantinya dengan <strong>${pegawai.nama}</strong>?`;
    }

    const result = await Swal.fire({
      title: "Konfirmasi Pilihan Suksesor",
      html: confirmHtml,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: PRIMARY_COLORS.teal,
      cancelButtonColor: "#d33",
      confirmButtonText: "Ya, Tetapkan",
      cancelButtonText: "Batal",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      setActionLoading(true);
      await assignSuksesor({
        peta_jabatan_id: selectedJabatan,
        pegawai_id: pegawai.id,
      });

      await Swal.fire({
        icon: "success",
        title: "Sukses",
        text: `${pegawai.nama} berhasil ditetapkan sebagai suksesor.`,
        confirmButtonColor: PRIMARY_COLORS.teal,
        timer: 2000,
      });

      await reloadAllData(selectedJabatan);
    } catch (err) {
      console.error("Error assigning suksesor:", err);
      Swal.fire({
        icon: "error",
        title: "Gagal Menetapkan Suksesor",
        text: err.message || "Terjadi kesalahan saat menetapkan suksesor.",
        confirmButtonColor: PRIMARY_COLORS.teal,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSuksesor = async (petaJabatanId, pegawaiName) => {
    const targetId = petaJabatanId || selectedJabatan;
    if (!targetId) return;

    const targetName = pegawaiName || selectedJabatanData?.suksesor?.pegawai?.name || "suksesor terpilih";

    const result = await Swal.fire({
      title: "Batalkan Suksesor?",
      html: `Apakah Anda yakin ingin membatalkan <strong>${targetName}</strong> sebagai suksesor untuk jabatan ini?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Ya, Batalkan",
      cancelButtonText: "Kembali",
    });

    if (!result.isConfirmed) return;

    try {
      setActionLoading(true);
      await cancelSuksesor(targetId);

      await Swal.fire({
        icon: "success",
        title: "Pilihan Dibatalkan",
        text: "Pilihan suksesor berhasil dibatalkan. Pegawai kembali tersedia dalam bursa suksesi.",
        confirmButtonColor: PRIMARY_COLORS.teal,
        timer: 2000,
      });

      await reloadAllData(targetId);
    } catch (err) {
      console.error("Error canceling suksesor:", err);
      Swal.fire({
        icon: "error",
        title: "Gagal Membatalkan Suksesor",
        text: err.message || "Terjadi kesalahan saat membatalkan suksesor.",
        confirmButtonColor: PRIMARY_COLORS.teal,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDetailPegawai = (nip) => {
    window.open(`/suksesi/detail/${nip}`, "_blank", "noopener,noreferrer");
  };

  const loadRekomendasi = async (
    jabatanId,
    isRotasi = false,
    jenisJabatan = selectedJenisJabatan
  ) => {
    if (!jabatanId) {
      setRekomendasiPegawai([]);
      setRekomendasiPengaturan(null);
      return;
    }
    try {
      setLoadingRekomendasi(true);
      const rekomendasi = await fetchRekomendasiPegawai(
        jabatanId,
        isRotasi,
        jenisJabatan
      );
      setRekomendasiPegawai(rekomendasi);
      setRekomendasiPengaturan(rekomendasi?.pengaturan || null);
    } catch (err) {
      console.error("Error loading rekomendasi:", err);
      setRekomendasiPegawai([]);
      setRekomendasiPengaturan(null);
    } finally {
      setLoadingRekomendasi(false);
    }
  };

  const handleJabatanChange = async (jabatanId) => {
    setSelectedJabatan(jabatanId);
    const jabatan = jabatanKosong.find((j) => j.id === jabatanId);
    setSelectedJabatanData(jabatan);
    await loadRekomendasi(jabatanId, activeTab === "rotasi", selectedJenisJabatan);
  };

  const handleTabChange = async (tab) => {
    setActiveTab(tab);
    if (selectedJabatan) {
      await loadRekomendasi(selectedJabatan, tab === "rotasi", selectedJenisJabatan);
    }
  };

  const handleJenisJabatanChange = async (jenis) => {
    setSelectedJenisJabatan(jenis);
    if (selectedJabatan) {
      await loadRekomendasi(selectedJabatan, activeTab === "rotasi", jenis);
    }
  };

  const filteredJabatan = jabatanKosong.filter((j) => {
    if (
      Array.isArray(selectedKategoriJabatan) &&
      selectedKategoriJabatan.length > 0 &&
      selectedKategoriJabatan.length < KATEGORI_JABATAN_OPTIONS.length
    ) {
      const kat = j.kategori_jabatan_kosong || getKategoriJabatan(j);
      if (!selectedKategoriJabatan.includes(kat)) return false;
    }
    const q = tableSearch.toLowerCase();
    const katLabel = (
      j.kategori_jabatan_kosong_label ||
      getKategoriLabel(j.kategori_jabatan_kosong || getKategoriJabatan(j))
    ).toLowerCase();
    return (
      (j.nama_jabatan || "").toLowerCase().includes(q) ||
      (j.unit_kerja || "").toLowerCase().includes(q) ||
      (j.jenis_jabatan || "").toLowerCase().includes(q) ||
      katLabel.includes(q)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filteredJabatan.length / PAGE_SIZE));
  const pagedJabatan = filteredJabatan.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
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
      { header: "Kategori Kosong", key: "kategori_kosong", width: 26 },
      { header: "Pejabat Saat Ini", key: "pejabat", width: 30 },
      { header: "Suksesor Terpilih", key: "suksesor", width: 30 },
      { header: "Tanggal Pensiun", key: "tanggal_pensiun", width: 20 },
      { header: "Sisa Masa Kerja", key: "sisa_masa_kerja", width: 22 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0D9488" },
      };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
    headerRow.height = 24;

    jabatanKosong.forEach((j, idx) => {
      const pejabatNames = (j.pejabat || [])
        .map((p) => `${p.name} (${p.nip})`)
        .join(", ");
      const suksesorInfo = j.suksesor?.pegawai
        ? `${j.suksesor.pegawai.name} (${j.suksesor.pegawai.nip})`
        : "Belum Ada";
      const tanggalPensiun = (j.pejabat || [])
        .map((p) => formatDateIndo(p.tanggal_pensiun || p.tglPensiun))
        .join(", ");
      const sisaMasaKerja = (j.pejabat || [])
        .map((p) => p.sisa_masa_kerja || computeRemaining(p))
        .join(", ");
      const katLabel =
        j.kategori_jabatan_kosong_label ||
        getKategoriLabel(j.kategori_jabatan_kosong || getKategoriJabatan(j));

      const row = sheet.addRow({
        no: idx + 1,
        nama_jabatan: j.nama_jabatan || "-",
        unit_kerja: j.unit_kerja || "-",
        jenis_jabatan: j.jenis_jabatan || "-",
        kelas_jabatan: j.kelas_jabatan || "-",
        kategori_kosong: katLabel || "-",
        pejabat: pejabatNames || "-",
        suksesor: suksesorInfo,
        tanggal_pensiun: tanggalPensiun || "-",
        sisa_masa_kerja: sisaMasaKerja || "-",
      });
      row.eachCell((cell) => {
        cell.alignment = { vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        if (idx % 2 === 1) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF0FDFA" },
          };
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

  const [exportingExcel, setExportingExcel] = useState(false);

  const handleExportRekomendasiExcel = async () => {
    if (!selectedJabatan) {
      Swal.fire({
        icon: "warning",
        title: "Pilih Jabatan",
        text: "Silakan pilih jabatan yang akan kosong terlebih dahulu.",
        confirmButtonColor: PRIMARY_COLORS.teal,
      });
      return;
    }

    try {
      setExportingExcel(true);
      Swal.fire({
        title: "Mempersiapkan File Excel...",
        text: "Sedang mengunduh data rekomendasi pegawai...",
        didOpen: () => {
          Swal.showLoading();
        },
        allowOutsideClick: false,
      });

      await exportRekomendasiPegawaiExcel(
        selectedJabatan,
        activeTab === "rotasi",
        selectedJenisJabatan
      );

      Swal.fire({
        icon: "success",
        title: "Ekspor Berhasil",
        text: "Data rekomendasi suksesor berhasil diekspor ke Excel.",
        confirmButtonColor: PRIMARY_COLORS.teal,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      console.warn("Backend excel export failed, falling back to client-side ExcelJS:", err);
      try {
        await handleExportRekomendasiClientExcel();
        Swal.fire({
          icon: "success",
          title: "Ekspor Berhasil",
          text: "Data rekomendasi suksesor berhasil diekspor ke Excel.",
          confirmButtonColor: PRIMARY_COLORS.teal,
          timer: 2000,
          showConfirmButton: false,
        });
      } catch (fallbackErr) {
        Swal.fire({
          icon: "error",
          title: "Gagal Ekspor Excel",
          text: err.message || "Terjadi kesalahan saat mengekspor data ke Excel.",
          confirmButtonColor: PRIMARY_COLORS.teal,
        });
      }
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportRekomendasiClientExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Rekomendasi Suksesor");

    const namaJabatan = selectedJabatanData?.nama_jabatan || "Jabatan";
    const unitKerja = selectedJabatanData?.unit_kerja || "-";
    const jenisJabatan = selectedJabatanData?.jenis_jabatan || "-";
    const kelasJabatan = selectedJabatanData?.kelas_jabatan || "-";
    const isRotasi = activeTab === "rotasi";

    sheet.mergeCells("A1:P1");
    sheet.getCell("A1").value = "DAFTAR REKOMENDASI SUKSESOR PEGAWAI";
    sheet.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF0D9488" } };

    sheet.mergeCells("A2:P2");
    sheet.getCell("A2").value = "SISTEM MANAJEMEN TALENTA (SIMANTAP)";
    sheet.getCell("A2").font = { italic: true, size: 10, color: { argb: "FF64748B" } };

    sheet.getCell("A4").value = "Jabatan Target";
    sheet.getCell("B4").value = `: ${namaJabatan}`;
    sheet.getCell("G4").value = "Jenis Seleksi";
    sheet.getCell("H4").value = `: ${isRotasi ? "Rotasi" : "Promosi"}`;

    sheet.getCell("A5").value = "Unit Kerja";
    sheet.getCell("B5").value = `: ${unitKerja}`;
    sheet.getCell("G5").value = "Filter Jenis Jabatan";
    sheet.getCell("H5").value = `: ${selectedJenisJabatan === "keduanya" ? "Semua" : selectedJenisJabatan === "struktural" ? "Struktural" : "Fungsional"}`;

    sheet.getCell("A6").value = "Jenis / Kelas";
    sheet.getCell("B6").value = `: ${jenisJabatan} / Kelas ${kelasJabatan}`;
    sheet.getCell("G6").value = "Komp. Teknis";
    sheet.getCell("H6").value = `: ${rekomendasiPengaturan?.gunakan_kompetensi_teknis ? "Digunakan (Berbobot)" : "Murni Nilai Talenta"}`;

    sheet.getCell("A7").value = "Syarat Golongan";
    sheet.getCell("B7").value = `: ${rekomendasiPengaturan?.pangkat_golongan ? "Minimal " + rekomendasiPengaturan.pangkat_golongan : "Semua Golongan"}`;
    sheet.getCell("G7").value = "Rumpun Jabatan";
    sheet.getCell("H7").value = `: ${rekomendasiPengaturan?.sesuai_rumpun_jabatan && rekomendasiPengaturan?.target_rumpun ? "Sesuai (" + (rekomendasiPengaturan.target_rumpun === "administrasi" ? "Deputi Administrasi" : "Deputi Persidangan") + ")" : "Semua Rumpun"}`;

    let usiaInfo = "Semua Usia";
    if (rekomendasiPengaturan?.minimal_usia && rekomendasiPengaturan?.maksimal_usia) {
      usiaInfo = `${rekomendasiPengaturan.minimal_usia} - ${rekomendasiPengaturan.maksimal_usia} th`;
    } else if (rekomendasiPengaturan?.minimal_usia) {
      usiaInfo = `Min. ${rekomendasiPengaturan.minimal_usia} th`;
    } else if (rekomendasiPengaturan?.maksimal_usia) {
      usiaInfo = `Maks. ${rekomendasiPengaturan.maksimal_usia} th`;
    }

    sheet.getCell("A8").value = "Syarat Usia";
    sheet.getCell("B8").value = `: ${usiaInfo}`;
    sheet.getCell("G8").value = "Tanggal Unduh";
    sheet.getCell("H8").value = `: ${new Date().toLocaleDateString("id-ID")}`;

    ["A4", "A5", "A6", "A7", "A8", "G4", "G5", "G6", "G7", "G8"].forEach((c) => {
      sheet.getCell(c).font = { bold: true };
    });

    const columns = [
      { key: "no", header: "No", width: 6 },
      { key: "ranking", header: "Peringkat", width: 12 },
      { key: "nip", header: "NIP", width: 22 },
      { key: "nama", header: "Nama Pegawai", width: 30 },
      { key: "golongan", header: "Golongan", width: 12 },
      { key: "usia", header: "Usia (Th)", width: 10 },
      { key: "jabatan", header: "Jabatan Saat Ini", width: 30 },
      { key: "unit_kerja", header: "Unit Kerja", width: 30 },
      { key: "jenis_jabatan", header: "Jenis Jabatan", width: 20 },
      { key: "kotak_rank", header: "Kotak Talenta", width: 14 },
      { key: "nilai_potensial", header: "Nilai Potensial", width: 14 },
      { key: "nilai_kinerja", header: "Nilai Kinerja", width: 14 },
      { key: "nilai_talenta", header: "Nilai Talenta", width: 14 },
    ];

    if (rekomendasiPengaturan?.gunakan_kompetensi_teknis) {
      columns.push({ key: "nilai_kompetensi_teknis", header: "Nilai Komp. Teknis", width: 18 });
      columns.push({ key: "nilai_akhir_talenta", header: "Nilai Akhir Talenta", width: 18 });
      columns.push({ key: "status_suksesor", header: "Status Suksesor", width: 18 });
    } else {
      columns.push({ key: "nilai_akhir_talenta", header: "Nilai Akhir Talenta", width: 18 });
      columns.push({ key: "status_suksesor", header: "Status Suksesor", width: 18 });
    }

    const headerRow = sheet.getRow(10);
    columns.forEach((col, idx) => {
      sheet.getColumn(idx + 1).width = col.width;
      const cell = headerRow.getCell(idx + 1);
      cell.value = col.header;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0D9488" },
      };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
    headerRow.height = 26;

    rekomendasiPegawai.forEach((p, idx) => {
      const isSuksesor =
        Boolean(p.is_suksesor) ||
        selectedJabatanData?.suksesor?.pegawai_id === p.id ||
        selectedJabatanData?.suksesor?.pegawai?.nip === p.nip;

      const rowValues = {
        no: idx + 1,
        ranking: `#${idx + 1}`,
        nip: p.nip ? `'${p.nip}` : "-",
        nama: p.nama || "-",
        golongan: p.golongan || "-",
        usia: p.usia ?? "-",
        jabatan: p.jabatan || "-",
        unit_kerja: p.unit_kerja || "-",
        jenis_jabatan: p.jenis_jabatan || "-",
        kotak_rank: p.kotak_rank ? `Kotak ${p.kotak_rank}` : "-",
        nilai_potensial: p.nilai_potensial?.toFixed(2) ?? "-",
        nilai_kinerja: p.nilai_kinerja?.toFixed(2) ?? "-",
        nilai_talenta: p.nilai_talenta?.toFixed(2) ?? "-",
        nilai_kompetensi_teknis: p.nilai_kompetensi_teknis?.toFixed(2) ?? "-",
        nilai_akhir_talenta: p.nilai_akhir_talenta?.toFixed(2) ?? "-",
        status_suksesor: isSuksesor ? "Suksesor Terpilih" : "Kandidat",
      };

      const row = sheet.addRow(columns.map((c) => rowValues[c.key]));
      row.eachCell((cell, colIdx) => {
        cell.alignment = {
          vertical: "middle",
          horizontal: [1, 2, 5, 6, 10, columns.length].includes(colIdx)
            ? "center"
            : colIdx >= 11 && colIdx < columns.length
            ? "right"
            : "left",
          wrapText: true,
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
        if (isSuksesor) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD1FAE5" },
          };
          cell.font = { bold: true };
        } else if (idx % 2 === 1) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF0FDFA" },
          };
        }
      });
      row.height = 22;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const cleanTitle = (namaJabatan || "Jabatan").replace(/[^a-zA-Z0-9_-]/g, "_");
    link.download = `Rekomendasi_Suksesor_${cleanTitle}_${isRotasi ? "Rotasi" : "Promosi"}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderCandidateCard = (pegawai, index) => {
    const isCurrentSuksesor =
      Boolean(pegawai.is_suksesor) ||
      selectedJabatanData?.suksesor?.pegawai_id === pegawai.id ||
      selectedJabatanData?.suksesor?.pegawai?.nip === pegawai.nip;

    const isTopThree = index < 3;

    return (
      <div
        key={pegawai.nip || index}
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group hover:-translate-y-1 flex flex-col h-full ${
          isCurrentSuksesor
            ? "border-2 border-emerald-500 ring-2 ring-emerald-500/20"
            : "border border-gray-200 dark:border-gray-700"
        }`}
      >
        {/* Ranking Badge */}
        <div
          className={`text-white px-6 py-3 flex items-center justify-between ${
            isCurrentSuksesor
              ? "bg-gradient-to-r from-emerald-600 to-teal-600"
              : isTopThree
              ? ""
              : "bg-gradient-to-r from-slate-600 to-slate-700 dark:from-gray-700 dark:to-gray-800"
          }`}
          style={
            !isCurrentSuksesor && isTopThree
              ? { backgroundColor: PRIMARY_COLORS.teal }
              : {}
          }
        >
          <div className="flex items-center gap-2">
            <span className="text-md font-semibold">
              {isTopThree
                ? `Rekomendasi #${index + 1}`
                : `Peringkat #${index + 1}`}
            </span>
            {isCurrentSuksesor && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-bold bg-white text-emerald-700 shadow-xs">
                <i
                  className="fas fa-check-circle"
                  aria-hidden="true"
                ></i>
                Suksesor Terpilih
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1">
            {isTopThree ? (
              <>
                <i
                  className="fas fa-star text-yellow-300 w-4 h-4"
                  aria-hidden="true"
                ></i>
                <span className="text-sm font-medium">
                  Top {index + 1}
                </span>
              </>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded bg-white/20 font-medium">
                #{index + 1}
              </span>
            )}
          </div>
        </div>

        {/* Card Content */}
        <div className="p-6 flex flex-col flex-1">
          <div className="flex-grow">
            {/* Avatar & Basic Info */}
            <div className="flex items-start space-x-4 mb-4">
              <div className="flex-shrink-0 relative">
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
                      {pegawai.nama?.charAt(0) || "U"}
                    </span>
                  </div>
                )}
                {pegawai.kotak_rank != null && (
                  <span
                    className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-white text-sm font-semibold px-2 py-1 rounded-full shadow-sm border-2 border-white dark:border-gray-800 whitespace-nowrap"
                    style={{
                      backgroundColor: PRIMARY_COLORS.teal,
                    }}
                  >
                    Kotak {pegawai.kotak_rank}
                  </span>
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
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center">
                  <i
                    className="fas fa-id-badge w-4 h-4 text-teal-500 dark:text-gray-500 mr-2 flex-shrink-0"
                    aria-hidden="true"
                  ></i>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">
                      Golongan
                    </p>
                    <p className="text-md text-gray-700 dark:text-gray-200 font-medium truncate">
                      {pegawai.golongan || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <i
                    className="fas fa-birthday-cake w-4 h-4 text-teal-500 dark:text-gray-500 mr-2 flex-shrink-0"
                    aria-hidden="true"
                  ></i>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">
                      Usia
                    </p>
                    <p className="text-md text-gray-700 dark:text-gray-200 font-medium truncate">
                      {pegawai.usia ? `${pegawai.usia} th` : "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            {pegawai.gunakan_kompetensi_teknis ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900 dark:to-teal-800 rounded-lg p-2 text-center">
                    <div className="text-sm text-teal-500 dark:text-teal-400 mt-1 font-medium">
                      Nilai Potensial
                    </div>
                    <div
                      className="text-2xl font-bold dark:text-teal-500"
                      style={{ color: PRIMARY_COLORS.teal }}
                    >
                      {pegawai.nilai_potensial?.toFixed(2) ?? "-"}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg p-2 text-center">
                    <div className="text-sm text-[#3085d6] dark:text-blue-400 mt-1 font-medium">
                      Nilai Kinerja
                    </div>
                    <div className="text-2xl font-bold text-[#3085d6] dark:text-blue-300">
                      {pegawai.nilai_kinerja?.toFixed(2) ?? "-"}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 rounded-lg p-2 text-center">
                    <div className="text-sm text-purple-600 dark:text-purple-400 mt-1 font-medium">
                      Nilai Talenta
                    </div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-300">
                      {pegawai.nilai_talenta?.toFixed(2) ?? "-"}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900 dark:to-orange-800 rounded-lg p-2 text-center">
                    <div className="text-sm text-orange-600 dark:text-orange-400 mt-1 font-medium">
                      Nilai Komp. Teknis
                    </div>
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-300">
                      {pegawai.nilai_kompetensi_teknis?.toFixed(2) ?? "-"}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 rounded-lg p-2 text-center">
                    <div className="text-sm text-green-700 dark:text-green-400 mt-1 font-medium flex items-center justify-center gap-1">
                      <span>Nilai Akhir Talenta</span>
                    </div>
                    <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {pegawai.nilai_akhir_talenta?.toFixed(2) ?? "-"}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900 dark:to-teal-800 rounded-lg p-2 text-center">
                    <div className="text-sm text-teal-500 dark:text-teal-400 mt-1 font-medium">
                      Nilai Potensial
                    </div>
                    <div
                      className="text-2xl font-bold dark:text-teal-500"
                      style={{ color: PRIMARY_COLORS.teal }}
                    >
                      {pegawai.nilai_potensial?.toFixed(2) ?? "-"}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg p-2 text-center">
                    <div className="text-sm text-[#3085d6] dark:text-blue-400 mt-1 font-medium">
                      Nilai Kinerja
                    </div>
                    <div className="text-2xl font-bold text-[#3085d6] dark:text-blue-300">
                      {pegawai.nilai_kinerja?.toFixed(2) ?? "-"}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 rounded-lg p-2 text-center">
                    <div className="text-sm text-green-700 dark:text-green-400 mt-1 font-medium flex items-center justify-center gap-1">
                      <span>Nilai Akhir Talenta</span>
                    </div>
                    <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {pegawai.nilai_akhir_talenta?.toFixed(2) ?? "-"}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Card Footer / Actions */}
        <div className="px-6 pb-4 border-t border-gray-100 dark:border-gray-800 mt-auto flex flex-col sm:flex-row items-center justify-center gap-2 pt-4">
          <IconButton
            onClick={() => handleDetailPegawai(pegawai.nip)}
            variant="secondary"
            size="md"
            title="Detail Pegawai"
          >
            <i className="fas fa-info-circle mr-1.5" />
            Lihat Profil
          </IconButton>

          {isCurrentSuksesor ? (
            <button
              type="button"
              onClick={() =>
                handleCancelSuksesor(selectedJabatan, pegawai.nama)
              }
              disabled={actionLoading}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              title="Batalkan penetapan suksesor"
            >
              <i
                className="fas fa-times-circle"
                aria-hidden="true"
              />
              Batalkan Pilihan
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleAssignSuksesor(pegawai)}
              disabled={actionLoading}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg text-white bg-teal-500 hover:bg-teal-700 active:bg-emerald-800 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              title="Pilih sebagai suksesor"
            >
              <i
                className="fas fa-user-check"
                aria-hidden="true"
              />
              Pilih sebagai Suksesor
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderEmptySlotCard = (index) => (
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
            Tidak ada pegawai yang direkomendasikan untuk posisi ini
          </p>
        </div>
      </div>
    </div>
  );

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

          {/* Controls: Search input & Dropdown Filter Kategori Jabatan Kosong */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <i className="fas fa-search text-gray-400" aria-hidden="true"></i>
              </div>
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari nama jabatan, unit kerja, atau jenis jabatan..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 dark:focus:ring-teal-600"
              />
              {tableSearch && (
                <button
                  onClick={() => {
                    setTableSearch("");
                    setCurrentPage(1);
                  }}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <i className="fas fa-times" aria-hidden="true"></i>
                </button>
              )}
            </div>

            {/* Dropdown Kategori Jabatan Kosong (Multi-Select) */}
            <div className="w-full sm:w-80 relative" ref={kategoriDropdownRef}>
              {/* Trigger Button */}
              <button
                type="button"
                onClick={() => setIsKategoriDropdownOpen((prev) => !prev)}
                className={`w-full min-h-[38px] px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 dark:focus:ring-teal-600 transition-colors flex items-center justify-between gap-2 cursor-pointer shadow-xs ${
                  isKategoriDropdownOpen
                    ? "border-teal-500 ring-2 ring-teal-400/30"
                    : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <i
                    className="fas fa-filter text-xs text-teal-600 dark:text-teal-400 flex-shrink-0"
                    aria-hidden="true"
                  ></i>
                  {selectedKategoriJabatan.length === 0 ? (
                    <span className="text-gray-500 dark:text-gray-400 truncate">
                      Semua Kategori Jabatan Kosong
                    </span>
                  ) : selectedKategoriJabatan.length === 1 ? (
                    <span className="font-medium text-gray-800 dark:text-gray-100 truncate">
                      {getKategoriLabel(selectedKategoriJabatan[0])}
                    </span>
                  ) : selectedKategoriJabatan.length === KATEGORI_JABATAN_OPTIONS.length ? (
                    <span className="font-medium text-gray-800 dark:text-gray-100 truncate">
                      Semua Kategori ({selectedKategoriJabatan.length})
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300 flex-shrink-0">
                        {selectedKategoriJabatan.length} Terpilih
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-300 truncate">
                        {selectedKategoriJabatan.map((k) => getKategoriLabel(k)).join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {selectedKategoriJabatan.length > 0 && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearAllKategori();
                      }}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                      title="Reset filter kategori"
                      role="button"
                    >
                      <i className="fas fa-times text-xs" aria-hidden="true"></i>
                    </span>
                  )}
                  <i
                    className={`fas fa-chevron-down text-xs text-gray-400 transition-transform duration-200 ${
                      isKategoriDropdownOpen ? "rotate-180 text-teal-600" : ""
                    }`}
                    aria-hidden="true"
                  ></i>
                </div>
              </button>

              {/* Dropdown Menu Panel */}
              {isKategoriDropdownOpen && (
                <div className="absolute right-0 sm:left-0 z-50 mt-1.5 w-full sm:w-88 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 overflow-hidden">
                  {/* Panel Header */}
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Pilih Kategori Kosong
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllKategori}
                        className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      <button
                        type="button"
                        onClick={handleClearAllKategori}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:underline cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Options List */}
                  <div className="p-1 space-y-0.5 max-h-60 overflow-y-auto">
                    {KATEGORI_JABATAN_OPTIONS.map((opt) => {
                      const isChecked = selectedKategoriJabatan.includes(opt.value);
                      return (
                        <div
                          key={opt.value}
                          onClick={() => toggleKategoriItem(opt.value)}
                          className={`w-full px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isChecked
                              ? "bg-teal-50/70 dark:bg-teal-900/30 text-teal-950 dark:text-teal-100 font-medium"
                              : "hover:bg-gray-50 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // handled by parent onClick
                              className="rounded border-gray-300 dark:border-gray-600 text-teal-600 focus:ring-teal-500 h-4 w-4 pointer-events-none"
                            />
                            <span className="flex items-center gap-2 truncate">
                              <span className={`w-2 h-2 rounded-full ${opt.dotClass} flex-shrink-0`}></span>
                              <span className="truncate">{opt.label}</span>
                            </span>
                          </div>
                          {isChecked && (
                            <i className="fas fa-check text-xs text-teal-600 dark:text-teal-400 flex-shrink-0"></i>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Panel Footer */}
                  <div className="px-3 pt-2 pb-1 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      {selectedKategoriJabatan.length === 0
                        ? "Menampilkan semua kategori"
                        : `${selectedKategoriJabatan.length} dari ${KATEGORI_JABATAN_OPTIONS.length} dipilih`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsKategoriDropdownOpen(false)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-md bg-teal-600 text-white hover:bg-teal-700 transition-colors cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )}
            </div>
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
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white uppercase tracking-wider w-8">
                      No
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white uppercase tracking-wider">
                      Nama Jabatan
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white uppercase tracking-wider">
                      Unit Kerja
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white uppercase tracking-wider">
                      Jenis Jabatan
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-white uppercase tracking-wider">
                      Kelas Jabatan
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-white uppercase tracking-wider">
                      Kategori Kosong
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-white uppercase tracking-wider">
                      Pejabat Saat Ini
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-white uppercase tracking-wider">
                      Suksesor Terpilih
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-white uppercase tracking-wider">
                      Syarat Suksesi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredJabatan.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-8 text-center text-gray-400 dark:text-gray-500"
                      >
                        {tableSearch ||
                        (Array.isArray(selectedKategoriJabatan)
                          ? selectedKategoriJabatan.length > 0
                          : selectedKategoriJabatan)
                          ? "Tidak ada jabatan yang cocok dengan kriteria filter."
                          : "Tidak ada data jabatan."}
                      </td>
                    </tr>
                  ) : (
                    pagedJabatan.map((jabatan, idx) => {
                      const isSelected = selectedJabatan === jabatan.id;
                      const rowNum = (currentPage - 1) * PAGE_SIZE + idx + 1;
                      const syarat = jabatan.syarat_suksesi || jabatan.syaratSuksesi;
                      const isConfigured = Boolean(
                        syarat &&
                          (syarat.id ||
                            (syarat.syarat && Object.keys(syarat.syarat).length > 0) ||
                            syarat.gunakan_kompetensi_teknis ||
                            syarat.sesuai_rumpun_jabatan)
                      );

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
                          style={
                            isSelected
                              ? { borderLeftColor: PRIMARY_COLORS.teal }
                              : {}
                          }
                        >
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">
                            {rowNum}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`font-semibold ${
                                isSelected
                                  ? "dark:text-teal-300"
                                  : "text-gray-800 dark:text-white"
                              }`}
                              style={
                                isSelected ? { color: PRIMARY_COLORS.teal } : {}
                              }
                            >
                              {jabatan.nama_jabatan}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                            {jabatan.unit_kerja || "-"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-sm font-medium"
                              style={{
                                backgroundColor: BG_COLORS.teal.light,
                                color: TEXT_ON_BG_COLORS.teal,
                              }}
                            >
                              {jabatan.jenis_jabatan
                                ?.replace("Jabatan Pimpinan Tinggi", "JPT")
                                .replace("Jabatan Fungsional", "JF") || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">
                            {jabatan.kelas_jabatan || "-"}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {renderKategoriBadge(
                              jabatan.kategori_jabatan_kosong || getKategoriJabatan(jabatan),
                              jabatan.kategori_jabatan_kosong_label
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {jabatan.pejabat && jabatan.pejabat.length > 0 ? (
                              <div className="text-sm text-gray-700 dark:text-gray-300">
                                {jabatan.pejabat.map((p, pi) => (
                                  <div key={pi} className="font-medium">
                                    {p.name}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm font-medium"
                                style={{
                                  backgroundColor: BG_COLORS.yellow.light,
                                  color: TEXT_ON_BG_COLORS.yellow,
                                }}
                              >
                                <i
                                  className="fas fa-exclamation-circle"
                                  aria-hidden="true"
                                ></i>
                                Kosong
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {jabatan.suksesor?.pegawai ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                  <i
                                    className="fas fa-check-circle text-emerald-600 dark:text-emerald-400"
                                    aria-hidden="true"
                                  ></i>
                                  <span>{jabatan.suksesor.pegawai.name}</span>
                                </span>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                  NIP. {jabatan.suksesor.pegawai.nip}
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700">
                                Belum Ada
                              </span>
                            )}
                          </td>
                          <td
                            className="px-4 py-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isConfigured ? (
                              <div className="inline-flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-semibold bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700">
                                  <i className="fas fa-check-circle text-teal-600 dark:text-teal-400 text-[10px]"></i>
                                  Sudah Diatur
                                </span>
                                <div className="inline-flex items-center gap-1 mt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSyaratModal(jabatan)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium rounded text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors cursor-pointer"
                                    title="Lihat Detail Syarat Suksesi"
                                  >
                                    <i className="fas fa-eye text-sm"></i>
                                    <span>Lihat</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleNavigateSyarat(jabatan)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium rounded text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                                    title="Ubah Syarat Suksesi"
                                  >
                                    <i className="fas fa-edit text-sm"></i>
                                    <span>Ubah</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleNavigateSyarat(jabatan)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-sm font-medium rounded-lg text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 border border-teal-200 dark:border-teal-700 transition-colors shadow-2xs cursor-pointer"
                                title="Atur Syarat Suksesi"
                              >
                                <i className="fas fa-sliders-h text-sm"></i>
                                <span>Atur Syarat</span>
                              </button>
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

                {/* Pagination buttons */}
                <div className="flex items-center gap-2">
                  {/* First page */}
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-teal-500/10 dark:hover:bg-gray-600 hover:border-teal-500/50 dark:hover:border-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                  >
                    <i
                      className="fas fa-angle-double-left w-4 h-4"
                      aria-hidden="true"
                    />
                  </button>

                  {/* Previous page */}
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-teal-500/10 dark:hover:bg-gray-600 hover:border-teal-500/50 dark:hover:border-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                  >
                    <i
                      className="fas fa-angle-left w-4 h-4"
                      aria-hidden="true"
                    />
                  </button>

                  {/* Page numbers */}
                  <div className="hidden sm:flex items-center gap-1">
                    {getPageNumbers().map((page, index) => (
                      <button
                        key={index}
                        onClick={() =>
                          typeof page === "number" && setCurrentPage(page)
                        }
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
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-teal-500/10 dark:hover:bg-gray-600 hover:border-teal-500/50 dark:hover:border-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                  >
                    <i
                      className="fas fa-angle-right w-4 h-4"
                      aria-hidden="true"
                    />
                  </button>

                  {/* Last page */}
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-teal-500/10 dark:hover:bg-gray-600 hover:border-teal-500/50 dark:hover:border-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                  >
                    <i
                      className="fas fa-angle-double-right w-4 h-4"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Selected Jabatan Details */}
          {selectedJabatanData && (
            <div className="mt-6 p-5 bg-gradient-to-br from-teal-50 to-teal-50 dark:from-gray-700 dark:to-gray-750 rounded-lg border border-teal-100 dark:border-gray-600">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-teal-200/60 dark:border-gray-600/60">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center">
                  <i
                    className="fas fa-briefcase mr-2 text-lg"
                    style={{ color: PRIMARY_COLORS.teal }}
                    aria-hidden="true"
                  ></i>
                  Detail Jabatan
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenSyaratModal(selectedJabatanData)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg text-teal-800 dark:text-teal-200 bg-white dark:bg-gray-800 hover:bg-teal-100/60 dark:hover:bg-gray-700 border border-teal-300 dark:border-teal-700 transition-colors shadow-2xs cursor-pointer"
                  >
                    <i className="fas fa-clipboard-list text-teal-600 dark:text-teal-400"></i>
                    <span>Lihat Syarat Suksesi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigateSyarat(selectedJabatanData)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-2xs cursor-pointer"
                  >
                    <i className="fas fa-sliders-h"></i>
                    <span>Atur / Ubah Syarat</span>
                  </button>
                </div>
              </div>

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
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Kelas Jabatan
                    </p>
                    <p className="text-md text-gray-700 dark:text-gray-200">
                      {selectedJabatanData.kelas_jabatan}
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
                            <p className="text-md text-gray-500">
                              {pejabat.nip}
                            </p>
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
                        <p className="text-md text-yellow-600 dark:text-yellow-400">
                          Belum ada pejabat saat ini
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Syarat Suksesi Status Summary */}
              <div className="mt-4 pt-3 border-t border-teal-200/60 dark:border-gray-600/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <i className="fas fa-clipboard-check text-teal-600 dark:text-teal-400"></i>
                    Status Syarat Suksesi:
                  </span>
                  {(() => {
                    const syarat =
                      selectedJabatanData.syarat_suksesi ||
                      selectedJabatanData.syaratSuksesi;
                    const isConfigured = Boolean(
                      syarat &&
                        (syarat.id ||
                          (syarat.syarat &&
                            Object.keys(syarat.syarat).length > 0) ||
                          syarat.gunakan_kompetensi_teknis ||
                          syarat.sesuai_rumpun_jabatan)
                    );
                    if (!isConfigured) {
                      return (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
                          <i className="fas fa-exclamation-triangle text-[10px]"></i>
                          Belum Dikonfigurasi
                        </span>
                      );
                    }
                    const countSyarat = syarat?.syarat
                      ? Object.keys(syarat.syarat).length
                      : 0;
                    return (
                      <>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700">
                          <i className="fas fa-check-circle text-[10px]"></i>
                          Telah Dikonfigurasi ({countSyarat} Subindikator)
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          • Teknis:{" "}
                          <strong className="text-gray-700 dark:text-gray-200">
                            {syarat?.gunakan_kompetensi_teknis
                              ? "Digunakan"
                              : "Murni Talenta"}
                          </strong>
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          • Rumpun:{" "}
                          <strong className="text-gray-700 dark:text-gray-200">
                            {syarat?.sesuai_rumpun_jabatan ? "Sesuai" : "Bebas"}
                          </strong>
                        </span>
                      </>
                    );
                  })()}
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

          {/* Banner Suksesor Terpilih */}
          {selectedJabatanData?.suksesor?.pegawai && (
            <div className="mb-6 p-4 sm:p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-emerald-950/40 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 text-xl sm:text-2xl font-bold shadow-md">
                    <i className="fas fa-user-check" aria-hidden="true"></i>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-sm font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100">
                        <i className="fas fa-award text-sm" aria-hidden="true"></i>
                        Suksesor Terpilih
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mt-1">
                      {selectedJabatanData.suksesor.pegawai.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                      <span>NIP. {selectedJabatanData.suksesor.pegawai.nip}</span>
                      {selectedJabatanData.suksesor.pegawai.jabatan_name && (
                        <span>• {selectedJabatanData.suksesor.pegawai.jabatan_name}</span>
                      )}
                      {selectedJabatanData.suksesor.pegawai.unit_organisasi_name && (
                        <span>• {selectedJabatanData.suksesor.pegawai.unit_organisasi_name}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => handleDetailPegawai(selectedJabatanData.suksesor.pegawai.nip)}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg text-emerald-800 dark:text-emerald-200 bg-white dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-gray-750 border border-emerald-300 dark:border-emerald-700 transition-colors cursor-pointer shadow-xs"
                  >
                    <i className="fas fa-id-card" aria-hidden="true"></i>
                    Lihat Profil
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCancelSuksesor(selectedJabatanData.id, selectedJabatanData.suksesor.pegawai.name)}
                    disabled={actionLoading}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <i className="fas fa-times-circle" aria-hidden="true"></i>
                    Batalkan Pilihan
                  </button>
                </div>
              </div>
            </div>
          )}

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

          {/* Controls: Filter Jenis Jabatan & Tampilan Rekomendasi */}
          <div className="mb-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-gray-50 dark:bg-gray-800/60 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700">
            {/* Filter Jenis Jabatan Pegawai */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 font-medium mr-1">
                <i
                  className="fas fa-filter text-teal-600 dark:text-teal-400"
                  aria-hidden="true"
                ></i>
                <span>Jenis Jabatan:</span>
              </div>
              <div className="inline-flex p-1 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 shadow-xs">
                <button
                  type="button"
                  onClick={() => handleJenisJabatanChange("keduanya")}
                  className={`cursor-pointer px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-all duration-200 flex items-center space-x-1.5 ${
                    selectedJenisJabatan === "keduanya"
                      ? "text-white shadow-xs"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  }`}
                  style={
                    selectedJenisJabatan === "keduanya"
                      ? { backgroundColor: PRIMARY_COLORS.teal }
                      : {}
                  }
                >
                  <i className="fas fa-layer-group text-xs sm:text-sm" aria-hidden="true"></i>
                  <span>Semua</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleJenisJabatanChange("struktural")}
                  className={`cursor-pointer px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-all duration-200 flex items-center space-x-1.5 ${
                    selectedJenisJabatan === "struktural"
                      ? "text-white shadow-xs"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  }`}
                  style={
                    selectedJenisJabatan === "struktural"
                      ? { backgroundColor: PRIMARY_COLORS.teal }
                      : {}
                  }
                >
                  <i className="fas fa-sitemap text-xs sm:text-sm" aria-hidden="true"></i>
                  <span>Struktural</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleJenisJabatanChange("fungsional")}
                  className={`cursor-pointer px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-all duration-200 flex items-center space-x-1.5 ${
                    selectedJenisJabatan === "fungsional"
                      ? "text-white shadow-xs"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  }`}
                  style={
                    selectedJenisJabatan === "fungsional"
                      ? { backgroundColor: PRIMARY_COLORS.teal }
                      : {}
                  }
                >
                  <i className="fas fa-user-cog text-xs sm:text-sm" aria-hidden="true"></i>
                  <span>Jabatan Fungsional</span>
                </button>
              </div>
            </div>

            {/* Toggle Tampilan Rekomendasi: 3 Teratas vs Semua Pegawai */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 font-medium mr-1">
                <i
                  className="fas fa-users text-teal-600 dark:text-teal-400"
                  aria-hidden="true"
                ></i>
                <span>Tampilan:</span>
              </div>
              <div className="inline-flex p-1 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 shadow-xs">
                <button
                  type="button"
                  onClick={() => setShowAllRekomendasi(false)}
                  className={`cursor-pointer px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-all duration-200 flex items-center space-x-1.5 ${
                    !showAllRekomendasi
                      ? "text-white shadow-xs"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  }`}
                  style={
                    !showAllRekomendasi
                      ? { backgroundColor: PRIMARY_COLORS.teal }
                      : {}
                  }
                >
                  <i className="fas fa-trophy text-xs sm:text-sm text-yellow-300" aria-hidden="true"></i>
                  <span>3 Teratas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAllRekomendasi(true)}
                  className={`cursor-pointer px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-all duration-200 flex items-center space-x-1.5 ${
                    showAllRekomendasi
                      ? "text-white shadow-xs"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  }`}
                  style={
                    showAllRekomendasi
                      ? { backgroundColor: PRIMARY_COLORS.teal }
                      : {}
                  }
                >
                  <i className="fas fa-list-ol text-xs sm:text-sm" aria-hidden="true"></i>
                  <span>
                    Semua Pegawai Memenuhi Syarat
                    <span className={`ml-1.5 px-2 py-0.5 text-xs rounded-full font-bold ${
                      showAllRekomendasi
                        ? "bg-white/25 text-white"
                        : "bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300"
                    }`}>
                      {rekomendasiPegawai?.length || 0}
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Status Pengaturan Suksesi Jabatan */}
          {selectedJabatan && rekomendasiPengaturan && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-gray-800/50 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 mr-1">
                  <i className="fas fa-sliders-h text-teal-600 dark:text-teal-400"></i>
                  <span className="font-semibold text-gray-700 dark:text-gray-200">
                    Parameter Suksesi:
                  </span>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${
                    rekomendasiPengaturan.gunakan_kompetensi_teknis
                      ? "bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700"
                      : "bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                  }`}
                >
                  <i
                    className={`fas fa-circle text-[7px] ${
                      rekomendasiPengaturan.gunakan_kompetensi_teknis
                        ? "text-teal-500"
                        : "text-gray-400"
                    }`}
                  ></i>
                  Kompetensi Teknis:{" "}
                  {rekomendasiPengaturan.gunakan_kompetensi_teknis
                    ? "Digunakan"
                    : "Murni Nilai Talenta"}
                </span>

                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${
                    rekomendasiPengaturan.sesuai_rumpun_jabatan &&
                    rekomendasiPengaturan.target_rumpun
                      ? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700"
                      : "bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                  }`}
                >
                  <i
                    className={`fas fa-circle text-[7px] ${
                      rekomendasiPengaturan.sesuai_rumpun_jabatan &&
                      rekomendasiPengaturan.target_rumpun
                        ? "text-purple-500"
                        : "text-gray-400"
                    }`}
                  ></i>
                  Rumpun Jabatan:{" "}
                  {rekomendasiPengaturan.sesuai_rumpun_jabatan &&
                  rekomendasiPengaturan.target_rumpun
                    ? `Sesuai (${
                        rekomendasiPengaturan.target_rumpun === "administrasi"
                          ? "Deputi Administrasi"
                          : "Deputi Persidangan"
                      })`
                    : "Semua Rumpun"}
                </span>

                {/* Golongan Minimal */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${
                    rekomendasiPengaturan.pangkat_golongan
                      ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700"
                      : "bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                  }`}
                >
                  <i
                    className={`fas fa-circle text-[7px] ${
                      rekomendasiPengaturan.pangkat_golongan
                        ? "text-blue-500"
                        : "text-gray-400"
                    }`}
                  ></i>
                  Golongan:{" "}
                  {rekomendasiPengaturan.pangkat_golongan
                    ? `Min. ${rekomendasiPengaturan.pangkat_golongan}`
                    : "Semua Golongan"}
                </span>

                {/* Batas Usia */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${
                    rekomendasiPengaturan.minimal_usia || rekomendasiPengaturan.maksimal_usia
                      ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700"
                      : "bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                  }`}
                >
                  <i
                    className={`fas fa-circle text-[7px] ${
                      rekomendasiPengaturan.minimal_usia || rekomendasiPengaturan.maksimal_usia
                        ? "text-amber-500"
                        : "text-gray-400"
                    }`}
                  ></i>
                  Usia:{" "}
                  {rekomendasiPengaturan.minimal_usia && rekomendasiPengaturan.maksimal_usia
                    ? `${rekomendasiPengaturan.minimal_usia} - ${rekomendasiPengaturan.maksimal_usia} th`
                    : rekomendasiPengaturan.minimal_usia
                    ? `Min. ${rekomendasiPengaturan.minimal_usia} th`
                    : rekomendasiPengaturan.maksimal_usia
                    ? `Maks. ${rekomendasiPengaturan.maksimal_usia} th`
                    : "Semua Usia"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportRekomendasiExcel()}
                  disabled={exportingExcel || !selectedJabatan}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium rounded-lg text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                  title="Ekspor Rekomendasi Suksesor ke Excel"
                >
                  <i className="fas fa-file-excel text-emerald-600 dark:text-emerald-400"></i>
                  <span>Ekspor Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenSyaratModal(selectedJabatanData)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-sm font-medium rounded-lg text-teal-700 dark:text-teal-300 bg-white dark:bg-gray-700 hover:bg-teal-50 dark:hover:bg-gray-650 border border-teal-200 dark:border-gray-600 transition-colors cursor-pointer"
                  title="Lihat Rincian Syarat Suksesi"
                >
                  <i className="fas fa-eye text-sm"></i>
                  <span>Detail Syarat</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigateSyarat(selectedJabatanData)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-sm font-medium rounded-lg text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-2xs cursor-pointer"
                  title="Ubah Syarat Suksesi"
                >
                  <i className="fas fa-edit text-sm"></i>
                  <span>Ubah Syarat</span>
                </button>
              </div>
            </div>
          )}

          {/* Banner if chosen successor is not in Top 3 and user is viewing Top 3 */}
          {!showAllRekomendasi &&
            selectedJabatanData?.suksesor?.pegawai_id &&
            !rekomendasiPegawai.slice(0, 3).some((p) => p.id === selectedJabatanData.suksesor.pegawai_id) && (
              <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2.5">
                  <i className="fas fa-info-circle text-amber-600 dark:text-amber-400 text-base"></i>
                  <span>
                    Suksesor terpilih saat ini <strong>{selectedJabatanData.suksesor?.pegawai?.name || "Pegawai"}</strong> berada di luar peringkat 3 teratas.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllRekomendasi(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-xs transition-colors shrink-0 cursor-pointer shadow-xs"
                >
                  <i className="fas fa-eye text-xs"></i>
                  <span>Buka Semua Pegawai ({rekomendasiPegawai.length})</span>
                </button>
              </div>
            )}

          {loadingRekomendasi ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700 border-t-teal-500 mx-auto mb-4"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {!showAllRekomendasi ? (
                Array.from({ length: 3 }).map((_, index) => {
                  const pegawai = rekomendasiPegawai[index];
                  if (pegawai) {
                    return renderCandidateCard(pegawai, index);
                  }
                  return renderEmptySlotCard(index);
                })
              ) : rekomendasiPegawai.length > 0 ? (
                rekomendasiPegawai.map((pegawai, index) =>
                  renderCandidateCard(pegawai, index)
                )
              ) : (
                <div className="col-span-full bg-white dark:bg-gray-800 rounded-xl p-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-700">
                  <div className="w-20 h-20 mx-auto rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                    <i className="fas fa-users-slash text-3xl text-gray-400 dark:text-gray-500"></i>
                  </div>
                  <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-1">
                    Tidak Ada Pegawai yang Memenuhi Syarat
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                    Tidak ada pegawai yang memenuhi kriteria (pangkat/golongan, usia, rumpun jabatan, atau kualifikasi) untuk jabatan ini.
                  </p>
                </div>
              )}
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

          {/* Toggle Jenis Jabatan Pegawai */}
          <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 font-medium">
              <i
                className="fas fa-filter text-teal-600 dark:text-teal-400"
                aria-hidden="true"
              ></i>
              <span>Pilih Jenis Jabatan Pegawai:</span>
            </div>
            <div className="inline-flex p-1 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 shadow-xs">
              <button
                type="button"
                onClick={() => handleJenisJabatanChange("keduanya")}
                className={`cursor-pointer px-3 sm:px-4 py-1.5 text-sm sm:text-sm font-semibold rounded-md transition-all duration-200 flex items-center space-x-1.5 ${
                  selectedJenisJabatan === "keduanya"
                    ? "text-white shadow-xs"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                }`}
                style={
                  selectedJenisJabatan === "keduanya"
                    ? { backgroundColor: PRIMARY_COLORS.teal }
                    : {}
                }
              >
                <i className="fas fa-layer-group text-sm" aria-hidden="true"></i>
                <span>Semua</span>
              </button>
              <button
                type="button"
                onClick={() => handleJenisJabatanChange("struktural")}
                className={`cursor-pointer px-3 sm:px-4 py-1.5 text-sm sm:text-sm font-semibold rounded-md transition-all duration-200 flex items-center space-x-1.5 ${
                  selectedJenisJabatan === "struktural"
                    ? "text-white shadow-xs"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                }`}
                style={
                  selectedJenisJabatan === "struktural"
                    ? { backgroundColor: PRIMARY_COLORS.teal }
                    : {}
                }
              >
                <i className="fas fa-sitemap text-sm" aria-hidden="true"></i>
                <span>Struktural</span>
              </button>
              <button
                type="button"
                onClick={() => handleJenisJabatanChange("fungsional")}
                className={`cursor-pointer px-3 sm:px-4 py-1.5 text-sm sm:text-sm font-semibold rounded-md transition-all duration-200 flex items-center space-x-1.5 ${
                  selectedJenisJabatan === "fungsional"
                    ? "text-white shadow-xs"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                }`}
                style={
                  selectedJenisJabatan === "fungsional"
                    ? { backgroundColor: PRIMARY_COLORS.teal }
                    : {}
                }
              >
                <i className="fas fa-user-cog text-sm" aria-hidden="true"></i>
                <span>Jabatan Fungsional</span>
              </button>
            </div>
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
                        <div className="text-sm text-gray-400 dark:text-gray-500 font-medium">
                          Nilai Kinerja
                        </div>
                        <div className="text-xl font-bold text-gray-300 dark:text-gray-600 mt-1">
                          -
                        </div>
                      </div>
                      <div className="bg-white/50 dark:bg-gray-750/50 rounded-lg p-3 border border-gray-300 dark:border-gray-600">
                        <div className="text-sm text-gray-400 dark:text-gray-500 font-medium">
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

      {/* Modal Detail Syarat Suksesi */}
      {modalSyaratOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setModalSyaratOpen(false)}
            aria-hidden="true"
          />

          {/* Modal Card */}
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 z-10 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div
              className="p-5 sm:p-6 text-white flex items-start justify-between gap-4"
              style={{
                background: `linear-gradient(135deg, ${PRIMARY_COLORS.teal}, #0f766e)`,
              }}
            >
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-semibold bg-white/20 text-white mb-2">
                  <i className="fas fa-clipboard-check text-sm"></i>
                  <span>Syarat Suksesi Jabatan</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold leading-snug">
                  {modalJabatan?.nama_jabatan || "Detail Jabatan"}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:text-sm text-teal-100 mt-1">
                  <span>{modalJabatan?.unit_kerja || "-"}</span>
                  {modalJabatan?.jenis_jabatan && (
                    <span>• {modalJabatan.jenis_jabatan}</span>
                  )}
                  {modalJabatan?.kelas_jabatan && (
                    <span>• Kelas {modalJabatan.kelas_jabatan}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalSyaratOpen(false)}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Tutup"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {modalSyaratLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700 border-t-teal-500 mb-4"></div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Memuat data syarat suksesi...
                  </p>
                </div>
              ) : !modalSyaratData ||
                (!modalSyaratData.id &&
                  (!modalSyaratData.syarat ||
                    Object.keys(modalSyaratData.syarat).length === 0)) ? (
                <div className="text-center py-12 px-4">
                  <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-500 mx-auto flex items-center justify-center text-2xl mb-4 border border-amber-200 dark:border-amber-700">
                    <i className="fas fa-clipboard-list"></i>
                  </div>
                  <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
                    Belum Ada Syarat Suksesi
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
                    Jabatan ini belum memiliki aturan ambang batas kompetensi atau
                    pengaturan suksesi khusus. Secara default rekomendasi akan
                    menggunakan nilai talenta standar tanpa batasan rumpun.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setModalSyaratOpen(false);
                      handleNavigateSyarat(modalJabatan);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-sm cursor-pointer"
                  >
                    <i className="fas fa-sliders-h"></i>
                    <span>Atur Syarat Suksesi Sekarang</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Parameter Toggles Display */}
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                      <i className="fas fa-sliders-h text-teal-600 dark:text-teal-400"></i>
                      Parameter Penilaian & Rumpun
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Nilai Kompetensi Teknis Card */}
                      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750/50">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                            <i className="fas fa-award text-teal-600 dark:text-teal-400"></i>
                            Nilai Kompetensi Teknis
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm font-semibold ${
                              modalSyaratData.gunakan_kompetensi_teknis
                                ? "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-300 dark:border-teal-700"
                                : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {modalSyaratData.gunakan_kompetensi_teknis
                              ? "Aktif"
                              : "Tidak Aktif"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                          {modalSyaratData.gunakan_kompetensi_teknis
                            ? "Perhitungan Nilai Akhir Talenta membobotkan Nilai Talenta dan Nilai Kompetensi Teknis pegawai."
                            : "Perhitungan rekomendasi suksesi murni menggunakan Nilai Talenta."}
                        </p>
                      </div>

                      {/* Kesesuaian Rumpun Card */}
                      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750/50">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                            <i className="fas fa-sitemap text-purple-600 dark:text-purple-400"></i>
                            Sesuai Rumpun Jabatan
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm font-semibold ${
                              modalSyaratData.sesuai_rumpun_jabatan
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-300 dark:border-purple-700"
                                : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {modalSyaratData.sesuai_rumpun_jabatan
                              ? "Aktif"
                              : "Tidak Aktif"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                          {modalSyaratData.sesuai_rumpun_jabatan
                            ? "Suksesor hanya diambil dari rumpun Eselon I / JPT Madya yang sama (berlaku untuk jabatan di bawah Deputi Administrasi dan Persidangan)."
                            : "Rekomendasi suksesor dapat berasal dari seluruh rumpun jabatan."}
                        </p>
                      </div>

                      {/* Pangkat / Golongan Minimal Card */}
                      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750/50">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                            <i className="fas fa-id-badge text-blue-600 dark:text-blue-400"></i>
                            Pangkat / Golongan Minimal
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm font-semibold ${
                              modalSyaratData.pangkat_golongan
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300 dark:border-blue-700"
                                : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {modalSyaratData.pangkat_golongan
                              ? modalSyaratData.pangkat_golongan
                              : "Semua Golongan"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                          {modalSyaratData.pangkat_golongan
                            ? `Calon suksesor harus memiliki pangkat/golongan minimal ${getPangkatLabel(modalSyaratData.pangkat_golongan)} (${modalSyaratData.pangkat_golongan}) ke atas.`
                            : "Tidak ada batasan pangkat/golongan minimal untuk calon suksesor pada jabatan ini."}
                        </p>
                      </div>

                      {/* Batas Usia Calon Suksesor Card */}
                      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750/50">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                            <i className="fas fa-calendar-alt text-amber-600 dark:text-amber-400"></i>
                            Batas Usia Calon Suksesor
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm font-semibold ${
                              modalSyaratData.minimal_usia || modalSyaratData.maksimal_usia
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                                : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {modalSyaratData.minimal_usia && modalSyaratData.maksimal_usia
                              ? `${modalSyaratData.minimal_usia} - ${modalSyaratData.maksimal_usia} Th`
                              : modalSyaratData.minimal_usia
                              ? `Min. ${modalSyaratData.minimal_usia} Th`
                              : modalSyaratData.maksimal_usia
                              ? `Maks. ${modalSyaratData.maksimal_usia} Th`
                              : "Semua Usia"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                          {modalSyaratData.minimal_usia && modalSyaratData.maksimal_usia
                            ? `Calon suksesor dibatasi pada rentang usia ${modalSyaratData.minimal_usia} sampai dengan ${modalSyaratData.maksimal_usia} tahun.`
                            : modalSyaratData.minimal_usia
                            ? `Calon suksesor harus berusia minimal ${modalSyaratData.minimal_usia} tahun.`
                            : modalSyaratData.maksimal_usia
                            ? `Calon suksesor dibatasi berusia maksimal ${modalSyaratData.maksimal_usia} tahun.`
                            : "Tidak ada batasan usia calon suksesor untuk jabatan ini."}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Daftar Ambang Batas Subindikator */}
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                      <i className="fas fa-list-check text-teal-600 dark:text-teal-400"></i>
                      Standar Ambang Batas Subindikator
                    </h4>
                    <div className="space-y-4">
                      {allIndikators.map((indikator) => {
                        const activeSubs = (
                          indikator.sub_indikators || []
                        ).filter((s) => s.isactive);
                        if (activeSubs.length === 0) return null;

                        return (
                          <div
                            key={indikator.id}
                            className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800"
                          >
                            <div className="bg-slate-100/70 dark:bg-gray-750 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                              <span className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <span className="w-1.5 h-3.5 rounded-full bg-teal-600 dark:bg-teal-400"></span>
                                {indikator.indikator}
                              </span>
                              {indikator.penilaian && (
                                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/40 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-700">
                                  {indikator.penilaian}
                                </span>
                              )}
                            </div>

                            <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                              {activeSubs.map((sub) => {
                                const syaratMap =
                                  modalSyaratData.syarat &&
                                  typeof modalSyaratData.syarat === "object"
                                    ? modalSyaratData.syarat
                                    : {};
                                const rawVal =
                                  syaratMap[sub.id] !== undefined
                                    ? syaratMap[sub.id]
                                    : syaratMap[String(sub.id)];
                                const isDisyaratkan =
                                  rawVal !== undefined &&
                                  rawVal !== null &&
                                  rawVal !== "";
                                const numericVal = isDisyaratkan
                                  ? typeof rawVal === "object"
                                    ? rawVal.nilai
                                    : rawVal
                                  : null;

                                const matchedInstrumen = isDisyaratkan
                                  ? allInstrumens.find((instr) => {
                                      const sId = String(
                                        instr.subindikator_id ||
                                          instr.subindikator?.id
                                      );
                                      return (
                                        sId === String(sub.id) &&
                                        Math.abs(
                                          Number(instr.skor ?? instr.nilai) -
                                            Number(numericVal)
                                        ) < 0.001
                                      );
                                    })
                                  : null;

                                return (
                                  <div
                                    key={sub.id}
                                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/70 dark:hover:bg-gray-750/40 transition-colors"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-gray-800 dark:text-white">
                                          {sub.subindikator}
                                        </p>
                                      </div>
                                      {matchedInstrumen && (
                                        <p className="text-sm text-teal-700 dark:text-teal-300 mt-0.5 flex items-center gap-1.5">
                                          <i className="fas fa-quote-left text-[10px] opacity-60"></i>
                                          <span>
                                            {matchedInstrumen.instrumen}
                                          </span>
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {isDisyaratkan ? (
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/40 border border-teal-200 dark:border-teal-700 text-teal-800 dark:text-teal-200 text-sm font-semibold">
                                          <i className="fas fa-check-circle text-teal-600 dark:text-teal-400"></i>
                                          <span>Minimal: {numericVal}</span>
                                        </div>
                                      ) : (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-400 text-sm font-medium">
                                          Bebas / Tanpa Syarat
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-gray-50 dark:bg-gray-750/60 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalSyaratOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              >
                Tutup
              </button>
              {modalJabatan && (
                <button
                  type="button"
                  onClick={() => {
                    setModalSyaratOpen(false);
                    handleNavigateSyarat(modalJabatan);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-sm cursor-pointer"
                >
                  <i className="fas fa-edit text-sm"></i>
                  <span>Ubah Syarat Suksesi</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suksesi;
