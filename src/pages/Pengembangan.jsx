import { useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";
import { fetchPegawaiList, fetchPetaJabatan, fetchIndikators, fetchStandarKompetensiMSK, fetchPengembanganStatistik } from "../services/apiService";
import Swal from "sweetalert2";
import ServerDataTable from "../components/ServerDataTable";
import IconButton from "../components/IconButton";
import SearchableSelect from "../components/SearchableSelect";
import Breadcrumb from "../components/Breadcrumb";
import EmployeeListModal from "../components/EmployeeListModal";
import ExcelJS from "exceljs";

const Pengembangan = () => {
  const { t } = useSettings();
  const navigate = useNavigate();
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("data");
  const [empModal, setEmpModal] = useState({ isOpen: false, employees: [], title: "", color: "teal", cols: null });
  const [loadingStatistik, setLoadingStatistik] = useState(false);

  // cols: null = show all extraColumns; array = show only those specific columns
  const openEmpModal = (title, employees, color = "teal", cols = null) => {
    setEmpModal({ isOpen: true, employees: employees || [], title, color, cols });
  };
  const closeEmpModal = () => setEmpModal((s) => ({ ...s, isOpen: false }));

  const [filterOptions, setFilterOptions] = useState({
    organisasi: [],
    jabatan: [],
    jenis: [],
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [statistikFilter, setStatistikFilter] = useState({
    unit_organisasi_name: "",
    jabatan_name: "",
    jenis_jabatan: "",
  });
  const [analytics, setAnalytics] = useState({
    totalPegawai: 0,
    rataRataKompetensi: 0,
    rataRataPotensi: 0,
    kategoriKompetensi: {
      memenuhiStandar: { count: 0, employees: [] },
      diBawahStandar: { count: 0, employees: [] },
    },
    kategoriPotensi: {
      tinggi: { count: 0, employees: [] },
      sedang: { count: 0, employees: [] },
      rendah: { count: 0, employees: [] },
    },
    belumDinilai: { count: 0, employees: [] },
    sudahDinilai: { count: 0, employees: [] },
    perluPengembangan: { count: 0, employees: [] },
    perSubIndikatorKompetensi: {},
    perSubIndikatorPotensi: {},
  });
  const [subIndikatorKompetensi, setSubIndikatorKompetensi] = useState([]);
  const [subIndikatorPotensi, setSubIndikatorPotensi] = useState([]);
  const [loadingSubIndikators, setLoadingSubIndikators] = useState(true);
  const [standarKompetensi, setStandarKompetensi] = useState([]);

  useEffect(() => {
    document.title = `Indeks Kesenjangan Kompetensi | SIMANTAP`;
  }, []);

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
    loadAnalytics();
    loadSubIndikators();
    loadStandarKompetensi();
  }, []);



  // Load subindikators for kompetensi and potensi
  const loadSubIndikators = async () => {
    try {
      setLoadingSubIndikators(true);
      const indikators = await fetchIndikators();

      // Find Kompetensi Manajerial & Sosial Kultural
      const kompetensiIndikator = indikators.find((ind) => {
        const name = (ind.indikator || ind.penilaian || "")
          .toString()
          .toLowerCase();
        return (
          name.includes("kompetensi manajerial") ||
          name.includes("sosial kultural") ||
          name.includes("msk")
        );
      });

      // Find Potensi Talenta
      const potensiIndikator = indikators.find((ind) => {
        const name = (ind.indikator || ind.penilaian || "")
          .toString()
          .toLowerCase();
        return name.includes("potensi talenta");
      });

      let kompetensiSubs =
        kompetensiIndikator && Array.isArray(kompetensiIndikator.sub_indikators)
          ? kompetensiIndikator.sub_indikators.filter((s) => s.isactive)
          : [];

      let potensiSubs =
        potensiIndikator && Array.isArray(potensiIndikator.sub_indikators)
          ? potensiIndikator.sub_indikators.filter((s) => s.isactive)
          : [];

      // Sort subindikators alphabetically by their display name (case-insensitive)
      const alphaSort = (a, b) => {
        const an = (a.subindikator || "").toString().toLowerCase();
        const bn = (b.subindikator || "").toString().toLowerCase();
        if (an < bn) return -1;
        if (an > bn) return 1;
        return 0;
      };

      kompetensiSubs = kompetensiSubs.sort(alphaSort);
      potensiSubs = potensiSubs.sort(alphaSort);

      setSubIndikatorKompetensi(kompetensiSubs);
      setSubIndikatorPotensi(potensiSubs);
    } catch (error) {
      console.error("Error loading subindikators:", error);
      Swal.fire("Error", "Gagal memuat data subindikator", "error");
    } finally {
      setLoadingSubIndikators(false);
    }
  };

  // Load standar kompetensi MSK
  const loadStandarKompetensi = async () => {
    try {
      const data = await fetchStandarKompetensiMSK();
      setStandarKompetensi(data || []);
    } catch (error) {
      console.error("Error loading standar kompetensi:", error);
      // Don't show error to user, just log it
      setStandarKompetensi([]);
    }
  };

  // Helper function to get standar for a specific subindikator and jenis jabatan
  const getStandarForSubIndikator = (subIndikatorId, pegawai = null) => {
    if (!pegawai) {
      return 5;
    }

    // Normalise to string for safe comparison (avoids number vs string mismatch)
    const subIdStr = String(subIndikatorId);

    const jenisJabatanId = pegawai.jenis_jabatan_id;
    const jenisJabatanName =
      pegawai.jenis_jabatan?.name ||
      pegawai.jenis_jabatan_name ||
      (typeof pegawai.jenis_jabatan === "string" ? pegawai.jenis_jabatan : null);

    // Try exact match by jenis_jabatan_id first
    if (jenisJabatanId != null) {
      const byId = standarKompetensi.find(
        (s) =>
          String(s.subindikator_id) === subIdStr &&
          s.jenis_jabatan_id != null &&
          String(s.jenis_jabatan_id) === String(jenisJabatanId)
      );
      if (byId) return byId.standar;
    }

    // Fallback: match by jenis_jabatan name
    if (jenisJabatanName) {
      const byName = standarKompetensi.find(
        (s) =>
          String(s.subindikator_id) === subIdStr &&
          (s.jenis_jabatan?.name === jenisJabatanName ||
            s.jenis_jabatan_name === jenisJabatanName)
      );
      if (byName) return byName.standar;
    }

    // Last resort: first standar entry for this subindikator (any jabatan)
    const any = standarKompetensi.find(
      (s) => String(s.subindikator_id) === subIdStr
    );
    return any?.standar ?? 5;
  };

  // Helper function to categorize kompetensi
  const getKompetensiCategory = (nilai, subIndikatorId, pegawai = null) => {
    if (nilai === null || nilai === undefined) return null;
    const standar = getStandarForSubIndikator(subIndikatorId, pegawai);
    return parseFloat(nilai) >= standar ? "Memenuhi Standar" : "Di Bawah Standar";
  };

  // Helper function to categorize potensi (max value 5)
  const getPotensiCategory = (nilai) => {
    if (nilai === null || nilai === undefined) return null;
    const nilaiFloat = parseFloat(nilai);
    if (nilaiFloat >= 4) return "Tinggi";
    if (nilaiFloat >= 2) return "Sedang";
    return "Rendah";
  };

  // Load analytics data from API
  const loadAnalytics = async (filters = {}) => {
    try {
      setLoadingStatistik(true);
      const data = await fetchPengembanganStatistik(filters);

      // Convert per_subindikator arrays → objects keyed by id
      const perSubIndikatorKompetensi = {};
      (data.per_subindikator_kompetensi || []).forEach((item) => {
        perSubIndikatorKompetensi[item.id] = {
          label: item.label,
          memenuhiStandar: item.memenuhi_standar || { count: 0, employees: [] },
          diBawahStandar: item.di_bawah_standar || { count: 0, employees: [] },
          belumDinilai: item.belum_dinilai || { count: 0, employees: [] },
        };
      });

      const perSubIndikatorPotensi = {};
      (data.per_subindikator_potensi || []).forEach((item) => {
        perSubIndikatorPotensi[item.id] = {
          label: item.label,
          tinggi: item.tinggi || { count: 0, employees: [] },
          sedang: item.sedang || { count: 0, employees: [] },
          rendah: item.rendah || { count: 0, employees: [] },
          belumDinilai: item.belum_dinilai || { count: 0, employees: [] },
        };
      });

      setAnalytics({
        totalPegawai: data.total_pegawai || 0,
        rataRataKompetensi: data.rata_rata_kompetensi ?? 0,
        rataRataPotensi: data.rata_rata_potensi ?? 0,
        kategoriKompetensi: {
          memenuhiStandar: data.kategori_kompetensi?.memenuhi_standar || { count: 0, employees: [] },
          diBawahStandar: data.kategori_kompetensi?.di_bawah_standar || { count: 0, employees: [] },
        },
        kategoriPotensi: {
          tinggi: data.kategori_potensi?.tinggi || { count: 0, employees: [] },
          sedang: data.kategori_potensi?.sedang || { count: 0, employees: [] },
          rendah: data.kategori_potensi?.rendah || { count: 0, employees: [] },
        },
        belumDinilai: data.belum_dinilai || { count: 0, employees: [] },
        sudahDinilai: data.sudah_dinilai || { count: 0, employees: [] },
        perluPengembangan: data.perlu_pengembangan || { count: 0, employees: [] },
        perSubIndikatorKompetensi,
        perSubIndikatorPotensi,
      });
    } catch (error) {
      console.error("Error loading analytics:", error);
      Swal.fire("Error", "Gagal memuat statistik pengembangan", "error");
    } finally {
      setLoadingStatistik(false);
    }
  };

  // Memoize fetch function to prevent unnecessary re-renders
  const fetchData = useCallback(async (params) => {
    return await fetchPegawaiList({ ...params, with_penilaian: true });
  }, []);

  const handleDetailPegawai = (nip) => {
    navigate(`/daftar-talenta/detail/${nip}`);
  };

  // Helper function to get nilai for a specific subindikator from pegawai data
  const getNilaiSubIndikator = (pegawai, subId) => {
    if (!pegawai.penilaian || !pegawai.penilaian[subId]) {
      return null;
    }
    const penilaian = pegawai.penilaian[subId];
    // Return nilai or hasil
    return penilaian.nilai ?? penilaian.hasil ?? penilaian ?? null;
  };

  // Helper to get color for nilai
  const getColorForNilai = (nilai, maxNilai = 5) => {
    if (nilai === null || nilai === undefined) return "text-gray-400";
    const percentage = (nilai / maxNilai) * 100;
    if (percentage >= 90) return "text-teal-500 dark:text-teal-400 font-bold";
    if (percentage >= 75) return "text-[#3085d6] dark:text-blue-400 font-semibold";
    if (percentage >= 60) return "text-yellow-500 dark:text-yellow-400 font-semibold";
    if (percentage >= 50) return "text-orange-500 dark:text-orange-400";
    return "text-red-500 dark:text-red-400";
  };

  // Build columns dynamically
  const buildColumns = () => {
    const baseColumns = [
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
        key: "nama",
        label: "Nama",
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
    ];

    // Add columns for each Kompetensi subindikator
    const kompetensiColumns = subIndikatorKompetensi.map((sub, index) => ({
      key: `kompetensi_${sub.id}`,
      label: sub.subindikator,
      align: "center",
      render: (item) => {
        const nilai = getNilaiSubIndikator(item, sub.id);
        const category = getKompetensiCategory(nilai, sub.id, item);
        const standar = getStandarForSubIndikator(sub.id, item);
        
        if (category === null) {
          return (
            <div className="flex items-center justify-center">
              <span className="text-sm text-gray-400">-</span>
            </div>
          );
        }
        
        const isMeetStandard = category === "Memenuhi Standar";
        const bgColor = isMeetStandard 
          ? "bg-teal-500 dark:bg-teal-600" 
          : "bg-red-500 dark:bg-red-600";
        const tooltipText = `${category}: ${parseFloat(nilai).toFixed(2)} / ${standar}`;
        
        return (
          <div className="flex items-center justify-center">
            <span 
              className={`${bgColor} text-white font-semibold px-3 py-1 rounded text-sm`}
              title={tooltipText}
            >
              {parseFloat(nilai).toFixed(2)}
            </span>
          </div>
        );
      },
    }));

    // Add columns for each Potensi subindikator
    const potensiColumns = subIndikatorPotensi.map((sub, index) => ({
      key: `potensi_${sub.id}`,
      label: sub.subindikator,
      align: "center",
      render: (item) => {
        const nilai = getNilaiSubIndikator(item, sub.id);
        const category = getPotensiCategory(nilai);
        
        if (category === null) {
          return (
            <div className="flex items-center justify-center">
              <span className="text-sm text-gray-400">-</span>
            </div>
          );
        }
        
        let bgColor;
        if (category === "Tinggi") {
          bgColor = "bg-teal-500 dark:bg-teal-600";
        } else if (category === "Sedang") {
          bgColor = "bg-[#3085d6] dark:bg-blue-600";
        } else {
          bgColor = "bg-red-500 dark:bg-red-600";
        }
        
        const tooltipText = `${category}: ${parseFloat(nilai).toFixed(2)} / 5`;
        
        return (
          <div className="flex items-center justify-center">
            <span 
              className={`${bgColor} text-white font-semibold px-3 py-1 rounded text-sm`}
              title={tooltipText}
            >
              {parseFloat(nilai).toFixed(2)}
            </span>
          </div>
        );
      },
    }));

    const actionColumn = {
      key: "aksi",
      label: "",
      render: (item) => (
        <div className="flex items-center justify-center">
          <IconButton
            onClick={() => handleDetailPegawai(item.nip)}
            variant="primary"
            size="lg"
            title="Detail"
          >
            <i className="fas fa-info-circle mr-2" />
            Detail
          </IconButton>
        </div>
      ),
    };

    return [
      ...baseColumns,
      ...kompetensiColumns,
      ...potensiColumns,
      // actionColumn,
    ];
  };

  const columns = buildColumns();

  const handleExport = async (rows, params) => {
    try {
      Swal.fire({
        title: "Mempersiapkan unduh data...",
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false,
      });

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Data");

      // Build columns dynamically
      const excelColumns = [
        { header: "No", key: "no", width: 8 },
        { header: "Nama", key: "nama", width: 32 },
        { header: "NIP", key: "nip", width: 20 },
      ];

      // Add kompetensi subindikator columns
      subIndikatorKompetensi.forEach((sub, index) => {
        excelColumns.push({
          header: `${sub.subindikator} (Nilai)`,
          key: `msk_nilai_${sub.id}`,
          width: 25,
        });
        excelColumns.push({
          header: `${sub.subindikator} (Status)`,
          key: `msk_status_${sub.id}`,
          width: 25,
        });
      });

      // Add potensi subindikator columns
      subIndikatorPotensi.forEach((sub, index) => {
        excelColumns.push({
          header: `${sub.subindikator} (Nilai)`,
          key: `pt_nilai_${sub.id}`,
          width: 25,
        });
        excelColumns.push({
          header: `${sub.subindikator} (Kategori)`,
          key: `pt_kategori_${sub.id}`,
          width: 25,
        });
      });

      sheet.columns = excelColumns;

      // Make header bold
      sheet.getRow(1).font = { bold: true };

      rows.forEach((item, index) => {
        const rowData = {
          no: index + 1,
          nama: item.nama || "",
          nip: item.nip || "",
        };

        // Add kompetensi values
        subIndikatorKompetensi.forEach((sub) => {
          const nilai = getNilaiSubIndikator(item, sub.id);
          rowData[`msk_nilai_${sub.id}`] =
            nilai !== null && nilai !== undefined ? parseFloat(nilai) : "";
          rowData[`msk_status_${sub.id}`] =
            nilai !== null && nilai !== undefined 
              ? getKompetensiCategory(nilai, sub.id, item) 
              : "";
        });

        // Add potensi values
        subIndikatorPotensi.forEach((sub) => {
          const nilai = getNilaiSubIndikator(item, sub.id);
          rowData[`pt_nilai_${sub.id}`] =
            nilai !== null && nilai !== undefined ? parseFloat(nilai) : "";
          rowData[`pt_kategori_${sub.id}`] =
            nilai !== null && nilai !== undefined 
              ? getPotensiCategory(nilai) 
              : "";
        });

        sheet.addRow(rowData);
      });

      // Add params sheet
      const paramsSheet = workbook.addWorksheet("Params");
      paramsSheet.addRow(["Param", "Value"]);
      Object.entries(params || {}).forEach(([k, v]) => {
        paramsSheet.addRow([k, String(v)]);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.download = `data-pengembangan-${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      Swal.close();
      Swal.fire("Selesai", "Data berhasil diunduh.", "success");
    } catch (error) {
      console.error("Export error:", error);
      Swal.close();
      Swal.fire("Gagal", "Data gagal diunduh.", "error");
    }
  };

  // Build extra columns for EmployeeListModal based on subindikators
  const buildExtraColumns = () => {
    const getNilaiEmp = (emp, subId) => {
      if (!emp.penilaian || !emp.penilaian[subId]) return null;
      const p = emp.penilaian[subId];
      return p.nilai ?? p.hasil ?? p ?? null;
    };

    const kompCols = subIndikatorKompetensi.map((sub) => ({
      label: sub.subindikator,
      render: (emp) => {
        const nilai = getNilaiEmp(emp, sub.id);
        if (nilai === null || nilai === undefined)
          return <span className="text-gray-400 text-sm">-</span>;
        const standar = getStandarForSubIndikator(sub.id, emp);
        const isMeet = parseFloat(nilai) >= standar;
        return (
          <span
            className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-sm font-semibold text-white ${
              isMeet ? "bg-teal-500" : "bg-red-500"
            }`}
            title={`${isMeet ? "Memenuhi Standar" : "Di Bawah Standar"}: ${parseFloat(nilai).toFixed(2)} / ${standar}`}
          >
            {parseFloat(nilai).toFixed(2)}
          </span>
        );
      },
    }));

    const potCols = subIndikatorPotensi.map((sub) => ({
      label: sub.subindikator,
      render: (emp) => {
        const nilai = getNilaiEmp(emp, sub.id);
        if (nilai === null || nilai === undefined)
          return <span className="text-gray-400 text-sm">-</span>;
        const fv = parseFloat(nilai);
        const cat = fv >= 4 ? "Tinggi" : fv >= 2 ? "Sedang" : "Rendah";
        const bg =
          cat === "Tinggi"
            ? "bg-teal-500"
            : cat === "Sedang"
            ? "bg-[#3085d6]"
            : "bg-red-500";
        return (
          <span
            className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-sm font-semibold text-white ${bg}`}
            title={`${cat}: ${fv.toFixed(2)} / 5`}
          >
            {fv.toFixed(2)}
          </span>
        );
      },
    }));

    return { all: [...kompCols, ...potCols], kompetensi: kompCols, potensi: potCols };
  };

  const { all: extraColumns, kompetensi: extraColumnsKompetensi, potensi: extraColumnsPotensi } = buildExtraColumns();

  // Lookup: subId → single column (for breakdown drill-down)
  const extraColsBySubId = (() => {
    const getNilaiEmp = (emp, subId) => {
      if (!emp.penilaian || !emp.penilaian[subId]) return null;
      const p = emp.penilaian[subId];
      return p.nilai ?? p.hasil ?? p ?? null;
    };
    const map = {};
    subIndikatorKompetensi.forEach((sub) => {
      map[`k_${sub.id}`] = {
        label: sub.subindikator,
        render: (emp) => {
          const nilai = getNilaiEmp(emp, sub.id);
          if (nilai === null || nilai === undefined)
            return <span className="text-gray-400 text-sm">-</span>;
          const standar = getStandarForSubIndikator(sub.id, emp);
          const isMeet = parseFloat(nilai) >= standar;
          return (
            <span
              className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-sm font-semibold text-white ${isMeet ? "bg-teal-500" : "bg-red-500"}`}
              title={`${isMeet ? "Memenuhi Standar" : "Di Bawah Standar"}: ${parseFloat(nilai).toFixed(2)} / ${standar}`}
            >
              {parseFloat(nilai).toFixed(2)}
            </span>
          );
        },
      };
    });
    subIndikatorPotensi.forEach((sub) => {
      map[`p_${sub.id}`] = {
        label: sub.subindikator,
        render: (emp) => {
          const nilai = getNilaiEmp(emp, sub.id);
          if (nilai === null || nilai === undefined)
            return <span className="text-gray-400 text-sm">-</span>;
          const fv = parseFloat(nilai);
          const cat = fv >= 4 ? "Tinggi" : fv >= 2 ? "Sedang" : "Rendah";
          const bg = cat === "Tinggi" ? "bg-teal-500" : cat === "Sedang" ? "bg-[#3085d6]" : "bg-red-500";
          return (
            <span
              className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-sm font-semibold text-white ${bg}`}
              title={`${cat}: ${fv.toFixed(2)} / 5`}
            >
              {fv.toFixed(2)}
            </span>
          );
        },
      };
    });
    return map;
  })();

  // ─── Statistics helper components (inline) ───────────────────────────────
  const StatCard = ({ icon, label, value, sub, colorClass, onClick }) => (
    <button
      onClick={onClick}
      className={`group flex items-center gap-3 w-full text-left bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 px-4 py-3 transition-all duration-200 ${
        onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : "cursor-default"
      }`}
    >
      <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${colorClass}`}>
        <i className={`${icon} text-base`}></i>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xl font-bold text-gray-800 dark:text-white leading-tight">{value}</p>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{label}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
      </div>
      {onClick && (
        <i className="fas fa-external-link-alt text-xs text-gray-300 dark:text-gray-600 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors flex-shrink-0"></i>
      )}
    </button>
  );

  const DistBar = ({ label, count, total, colorBg, colorText, onClick }) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <button
        onClick={onClick}
        className={`w-full text-left group transition-all duration-150 ${onClick ? "cursor-pointer hover:opacity-90" : "cursor-default"}`}
      >
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">{label}</span>
          <span className={`text-sm font-bold ${colorText}`}>{count} <span className="font-normal text-gray-400 dark:text-gray-500">({pct}%)</span></span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
          <div className={`h-2.5 rounded-full transition-all duration-500 ${colorBg}`} style={{ width: `${pct}%` }}></div>
        </div>
      </button>
    );
  };

  const SectionCard = ({ title, icon, children }) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <i className={`${icon} text-teal-500 dark:text-teal-400`}></i>
        <h3 className="text-base font-semibold text-gray-800 dark:text-white">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );

  const StatistikSection = () => {
    const totalWithPenilaian = analytics.sudahDinilai.count;
    const pctPerlu = totalWithPenilaian > 0 ? Math.round((analytics.perluPengembangan.count / totalWithPenilaian) * 100) : 0;
    const totalKomp = (analytics.kategoriKompetensi.memenuhiStandar.count + analytics.kategoriKompetensi.diBawahStandar.count) || 1;
    const totalPot = (analytics.kategoriPotensi.tinggi.count + analytics.kategoriPotensi.sedang.count + analytics.kategoriPotensi.rendah.count) || 1;

    const hasFilter = statistikFilter.unit_organisasi_name || statistikFilter.jabatan_name || statistikFilter.jenis_jabatan;

    const handleApplyFilter = () => loadAnalytics(statistikFilter);
    const handleResetFilter = () => {
      const empty = { unit_organisasi_name: "", jabatan_name: "", jenis_jabatan: "" };
      setStatistikFilter(empty);
      loadAnalytics({});
    };

    if (loadingStatistik) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-16 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700 border-t-teal-500 mb-4"></div>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Memuat statistik...</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* ── Filter Panel ── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <i className="fas fa-filter text-teal-500 dark:text-teal-400 text-sm"></i>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Filter Statistik</h3>
            {hasFilter && (
              <span className="ml-auto inline-flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full font-medium">
                <i className="fas fa-circle text-[6px]"></i> Filter aktif
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SearchableSelect
              label="Unit Kerja"
              placeholder="Semua Unit Kerja"
              value={statistikFilter.unit_organisasi_name}
              onChange={(val) => setStatistikFilter((s) => ({ ...s, unit_organisasi_name: val }))}
              options={filterOptions.organisasi}
            />
            <SearchableSelect
              label="Jabatan"
              placeholder="Semua Jabatan"
              value={statistikFilter.jabatan_name}
              onChange={(val) => setStatistikFilter((s) => ({ ...s, jabatan_name: val }))}
              options={filterOptions.jabatan}
            />
            <SearchableSelect
              label="Jenis Jabatan"
              placeholder="Semua Jenis Jabatan"
              value={statistikFilter.jenis_jabatan}
              onChange={(val) => setStatistikFilter((s) => ({ ...s, jenis_jabatan: val }))}
              options={filterOptions.jenis}
            />
          </div>
          <div className="flex gap-2 mt-4">
            <IconButton variant="primary" size="lg" onClick={handleApplyFilter}>
              <i className="fas fa-search mr-1.5"></i> Terapkan
            </IconButton>
            {hasFilter && (
              <IconButton variant="default" size="lg" onClick={handleResetFilter}>
                <i className="far fa-times-circle mr-1.5"></i> Reset
              </IconButton>
            )}
          </div>
        </div>
        {/* ── Row 1: Summary cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="fas fa-users" label="Total Pegawai" value={analytics.totalPegawai} colorClass="bg-teal-50 dark:bg-teal-900/40 text-teal-500 dark:text-teal-400"
            onClick={() => openEmpModal("Semua Pegawai", [...analytics.kategoriKompetensi.memenuhiStandar.employees, ...analytics.kategoriKompetensi.diBawahStandar.employees, ...analytics.belumDinilai.employees], "teal")} />
          <StatCard icon="fas fa-clipboard-check" label="Sudah Dinilai" value={analytics.sudahDinilai.count}
            sub={`${analytics.totalPegawai > 0 ? Math.round((analytics.sudahDinilai.count / analytics.totalPegawai) * 100) : 0}% dari total`}
            colorClass="bg-blue-50 dark:bg-blue-900/40 text-[#3085d6] dark:text-blue-400"
            onClick={() => openEmpModal("Pegawai Sudah Dinilai", analytics.sudahDinilai.employees, "#3085d6")} />
          <StatCard icon="fas fa-chart-line" label="Rata-Rata Kompetensi" value={analytics.rataRataKompetensi} sub="Skala 1–5"
            colorClass="bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400" />
          <StatCard icon="fas fa-star" label="Rata-Rata Potensi" value={analytics.rataRataPotensi} sub="Skala 1–5"
            colorClass="bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400" />
        </div>

        {/* ── Row 2: Need development highlight ── */}
        <div
          onClick={() => openEmpModal("Pegawai Perlu Pengembangan", analytics.perluPengembangan.employees, "#e74c3c")}
          className="cursor-pointer group bg-gradient-to-r from-red-500 to-rose-600 dark:from-red-700 dark:to-rose-700 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="fas fa-exclamation-triangle text-white text-xl"></i>
            </div>
            <div>
              <p className="text-white/80 text-sm font-medium">Perlu Pengembangan</p>
              <p className="text-white text-3xl font-bold">{analytics.perluPengembangan.count} <span className="text-white/70 text-base font-normal">pegawai</span></p>
              <p className="text-white/70 text-sm mt-0.5">Di bawah standar kompetensi dan/atau potensi rendah</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-white text-4xl font-black">{pctPerlu}%</p>
            <p className="text-white/70 text-sm">dari yg sudah dinilai</p>
            <p className="text-white/60 text-sm mt-2 group-hover:text-white/90 transition-colors"><i className="fas fa-mouse-pointer mr-1"></i>Klik untuk lihat daftar</p>
          </div>
        </div>

        {/* ── Row 3: Kompetensi + Potensi Distribution ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SectionCard title="Distribusi Kompetensi Manajerial dan Sosial Kultural" icon="fas fa-clipboard-check">
            <div className="space-y-4">
              <DistBar label="Memenuhi Standar" count={analytics.kategoriKompetensi.memenuhiStandar.count} total={totalKomp}
                colorBg="bg-teal-500" colorText="text-teal-500 dark:text-teal-400"
                onClick={() => openEmpModal("Memenuhi Standar Kompetensi", analytics.kategoriKompetensi.memenuhiStandar.employees, "teal", extraColumnsKompetensi)} />
              <DistBar label="Di Bawah Standar" count={analytics.kategoriKompetensi.diBawahStandar.count} total={totalKomp}
                colorBg="bg-red-500" colorText="text-red-500 dark:text-red-400"
                onClick={() => openEmpModal("Di Bawah Standar Kompetensi", analytics.kategoriKompetensi.diBawahStandar.employees, "#e74c3c", extraColumnsKompetensi)} />
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex gap-4">
                <div className="text-center flex-1">
                  <p className="text-xl font-bold text-teal-500 dark:text-teal-400">{analytics.kategoriKompetensi.memenuhiStandar.count}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Memenuhi</p>
                </div>
                <div className="w-px bg-gray-100 dark:bg-gray-700"></div>
                <div className="text-center flex-1">
                  <p className="text-xl font-bold text-red-500 dark:text-red-400">{analytics.kategoriKompetensi.diBawahStandar.count}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Di Bawah Standar</p>
                </div>
                <div className="w-px bg-gray-100 dark:bg-gray-700"></div>
                <div className="text-center flex-1">
                  <p className="text-xl font-bold text-gray-500 dark:text-gray-400">{analytics.belumDinilai.count}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Belum Dinilai</p>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Distribusi Potensi Talenta" icon="fas fa-star">
            <div className="space-y-4">
              <DistBar label="Potensi Tinggi (≥ 4)" count={analytics.kategoriPotensi.tinggi.count} total={totalPot}
                colorBg="bg-teal-500" colorText="text-teal-500 dark:text-teal-400"
                onClick={() => openEmpModal("Potensi Tinggi", analytics.kategoriPotensi.tinggi.employees, "teal", extraColumnsPotensi)} />
              <DistBar label="Potensi Sedang (2 – 3.99)" count={analytics.kategoriPotensi.sedang.count} total={totalPot}
                colorBg="bg-[#3085d6]" colorText="text-[#3085d6] dark:text-blue-400"
                onClick={() => openEmpModal("Potensi Sedang", analytics.kategoriPotensi.sedang.employees, "#3085d6", extraColumnsPotensi)} />
              <DistBar label="Potensi Rendah (< 2)" count={analytics.kategoriPotensi.rendah.count} total={totalPot}
                colorBg="bg-red-500" colorText="text-red-500 dark:text-red-400"
                onClick={() => openEmpModal("Potensi Rendah", analytics.kategoriPotensi.rendah.employees, "#e74c3c", extraColumnsPotensi)} />
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex gap-3">
                {[
                  { label: "Tinggi", count: analytics.kategoriPotensi.tinggi.count, color: "text-teal-500 dark:text-teal-400" },
                  { label: "Sedang", count: analytics.kategoriPotensi.sedang.count, color: "text-[#3085d6] dark:text-blue-400" },
                  { label: "Rendah", count: analytics.kategoriPotensi.rendah.count, color: "text-red-500 dark:text-red-400" },
                ].map((i) => (
                  <div key={i.label} className="text-center flex-1">
                    <p className={`text-xl font-bold ${i.color}`}>{i.count}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{i.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── Row 4: Per Sub-Indikator Kompetensi ── */}
        {Object.keys(analytics.perSubIndikatorKompetensi).length > 0 && (
          <SectionCard title="Breakdown per Sub-Indikator Kompetensi Manajerial dan Sosial Kultural" icon="fas fa-layer-group">
            <div className="space-y-5">
              {Object.entries(analytics.perSubIndikatorKompetensi).map(([id, data]) => {
                const tot = (data.memenuhiStandar.count + data.diBawahStandar.count) || 1;
                const pctMS = Math.round((data.memenuhiStandar.count / tot) * 100);
                const pctDB = Math.round((data.diBawahStandar.count / tot) * 100);
                return (
                  <div key={id}>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{data.label}</p>
                    <div className="flex gap-1 h-6 w-full rounded-lg overflow-hidden">
                      {data.memenuhiStandar.count > 0 && (
                        <button onClick={() => openEmpModal(`${data.label} — Memenuhi Standar`, data.memenuhiStandar.employees, "teal", [extraColsBySubId[`k_${id}`]])}
                          className="cursor-pointer bg-teal-500 hover:bg-teal-600 transition-colors flex items-center justify-center text-white text-sm font-semibold"
                          style={{ width: `${pctMS}%` }} title={`Memenuhi Standar: ${data.memenuhiStandar.count}`}>
                          {pctMS > 10 ? `${pctMS}%` : ""}
                        </button>
                      )}
                      {data.diBawahStandar.count > 0 && (
                        <button onClick={() => openEmpModal(`${data.label} — Di Bawah Standar`, data.diBawahStandar.employees, "#e74c3c", [extraColsBySubId[`k_${id}`]])}
                          className="cursor-pointer bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center text-white text-sm font-semibold"
                          style={{ width: `${pctDB}%` }} title={`Di Bawah Standar: ${data.diBawahStandar.count}`}>
                          {pctDB > 10 ? `${pctDB}%` : ""}
                        </button>
                      )}
                    </div>
                    <div className="flex gap-4 mt-1.5">
                      <button onClick={() => openEmpModal(`${data.label} — Memenuhi Standar`, data.memenuhiStandar.employees, "teal", [extraColsBySubId[`k_${id}`]])} className="cursor-pointer flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
                        <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span> Memenuhi: {data.memenuhiStandar.count}
                      </button>
                      <button onClick={() => openEmpModal(`${data.label} — Di Bawah Standar`, data.diBawahStandar.employees, "#e74c3c", [extraColsBySubId[`k_${id}`]])} className="cursor-pointer flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                        <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> Di Bawah: {data.diBawahStandar.count}
                      </button>
                      <button onClick={() => openEmpModal(`${data.label} — Belum Dinilai`, data.belumDinilai.employees, "gray", [extraColsBySubId[`k_${id}`]])} className="cursor-pointer flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                        <span className="w-2 h-2 rounded-full bg-gray-400 inline-block"></span> Belum: {data.belumDinilai.count}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* ── Row 5: Per Sub-Indikator Potensi ── */}
        {Object.keys(analytics.perSubIndikatorPotensi).length > 0 && (
          <SectionCard title="Breakdown per Sub-Indikator Potensi Talenta" icon="fas fa-chart-bar">
            <div className="space-y-5">
              {Object.entries(analytics.perSubIndikatorPotensi).map(([id, data]) => {
                const tot = (data.tinggi.count + data.sedang.count + data.rendah.count) || 1;
                const pctT = Math.round((data.tinggi.count / tot) * 100);
                const pctS = Math.round((data.sedang.count / tot) * 100);
                const pctR = Math.round((data.rendah.count / tot) * 100);
                return (
                  <div key={id}>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{data.label}</p>
                    <div className="flex gap-1 h-6 w-full rounded-lg overflow-hidden">
                      {data.tinggi.count > 0 && <button onClick={() => openEmpModal(`${data.label} — Tinggi`, data.tinggi.employees, "teal", [extraColsBySubId[`p_${id}`]])} className="cursor-pointer bg-teal-500 hover:bg-teal-600 transition-colors flex items-center justify-center text-white text-sm font-semibold" style={{ width: `${pctT}%` }} title={`Tinggi: ${data.tinggi.count}`}>{pctT > 10 ? `${pctT}%` : ""}</button>}
                      {data.sedang.count > 0 && <button onClick={() => openEmpModal(`${data.label} — Sedang`, data.sedang.employees, "#3085d6", [extraColsBySubId[`p_${id}`]])} className="cursor-pointer bg-[#3085d6] hover:bg-[#2075c6] transition-colors flex items-center justify-center text-white text-sm font-semibold" style={{ width: `${pctS}%` }} title={`Sedang: ${data.sedang.count}`}>{pctS > 10 ? `${pctS}%` : ""}</button>}
                      {data.rendah.count > 0 && <button onClick={() => openEmpModal(`${data.label} — Rendah`, data.rendah.employees, "#e74c3c", [extraColsBySubId[`p_${id}`]])} className="cursor-pointer bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center text-white text-sm font-semibold" style={{ width: `${pctR}%` }} title={`Rendah: ${data.rendah.count}`}>{pctR > 10 ? `${pctR}%` : ""}</button>}
                    </div>
                    <div className="flex gap-4 mt-1.5">
                      <button onClick={() => openEmpModal(`${data.label} — Tinggi`, data.tinggi.employees, "teal", [extraColsBySubId[`p_${id}`]])} className="cursor-pointer flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
                        <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span> Tinggi: {data.tinggi.count}
                      </button>
                      <button onClick={() => openEmpModal(`${data.label} — Sedang`, data.sedang.employees, "#3085d6", [extraColsBySubId[`p_${id}`]])} className="cursor-pointer flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-[#3085d6] dark:hover:text-blue-400 transition-colors">
                        <span className="w-2 h-2 rounded-full bg-[#3085d6] inline-block"></span> Sedang: {data.sedang.count}
                      </button>
                      <button onClick={() => openEmpModal(`${data.label} — Rendah`, data.rendah.employees, "#e74c3c", [extraColsBySubId[`p_${id}`]])} className="cursor-pointer flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                        <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> Rendah: {data.rendah.count}
                      </button>
                      <button onClick={() => openEmpModal(`${data.label} — Belum Dinilai`, data.belumDinilai.employees, "gray", [extraColsBySubId[`p_${id}`]])} className="cursor-pointer flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                        <span className="w-2 h-2 rounded-full bg-gray-400 inline-block"></span> Belum: {data.belumDinilai.count}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Breadcrumb */}
      <Breadcrumb />

      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
          Indeks Kesenjangan Kompetensi
        </h1>
        <p className="mt-2 text-md md:text-base text-gray-600 dark:text-gray-300">
          Analisis dan penilaian kompetensi manajerial, sosial kultural, serta
          potensi talenta pegawai
        </p>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="mb-6">
        <div className="flex bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-1 w-fit">
          {[
            { key: "data", label: "Data", icon: "fas fa-table" },
            { key: "statistik", label: "Statistik", icon: "fas fa-chart-pie" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.key
                  ? "bg-teal-500 text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              <i className={tab.icon}></i>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      {/* Data Table */}
      {activeTab === "statistik" ? (
        <StatistikSection />
      ) : loadingSubIndikators ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 dark:border-gray-700 border-t-teal-500 mx-auto mb-4"></div>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
              Memuat data subindikator...
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Mohon tunggu sebentar
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Standards Accordion */}
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <button
              onClick={() => setIsAccordionOpen(!isAccordionOpen)}
              className="cursor-pointer w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <i className={`fas fa-chevron-right text-teal-500 dark:text-teal-400 transition-transform duration-300 ${isAccordionOpen ? 'rotate-90' : ''}`}></i>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                  Standar Penilaian
                </h3>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400 transition-opacity duration-200">
                {isAccordionOpen ? 'Sembunyikan' : 'Tampilkan'}
              </span>
            </button>
            
            <div 
              className={`grid transition-all duration-300 ease-in-out ${
                isAccordionOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="space-y-6">
                    {/* Kompetensi Manajerial & Sosial Kultural Section */}
                    {subIndikatorKompetensi.length > 0 && (() => {
                      // Get all unique jenis jabatan from standar kompetensi
                      const jenisJabatanSet = new Set();
                      standarKompetensi.forEach((s) => {
                        const name = s.jenis_jabatan?.name || s.jenis_jabatan_name;
                        if (name) jenisJabatanSet.add(name);
                      });
                      const uniqueJenisJabatan = Array.from(jenisJabatanSet);

                      // Sort jenis jabatan so those with larger total standar values appear first
                      const computeTotalScore = (jenis) => {
                        let total = 0;
                        subIndikatorKompetensi.forEach((sub) => {
                          const standar = standarKompetensi.find(
                            (s) => s.subindikator_id === sub.id &&
                            (s.jenis_jabatan?.name === jenis || s.jenis_jabatan_name === jenis)
                          );
                          total += standar ? Number(standar.standar) || 0 : 0;
                        });
                        return total;
                      };

                      uniqueJenisJabatan.sort((a, b) => computeTotalScore(b) - computeTotalScore(a));
                      
                      return (
                        <div>
                          <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                            <i className="fas fa-clipboard-check text-teal-500 dark:text-teal-400"></i>
                            Kompetensi Manajerial & Sosial Kultural
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                              <thead className="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300 tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-900">
                                    Jenis Jabatan
                                  </th>
                                  {subIndikatorKompetensi.map((sub, idx) => (
                                    <th key={idx} className="px-4 py-3 text-center text-sm font-medium text-gray-600 dark:text-gray-300 tracking-wider">
                                      {sub.subindikator}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {uniqueJenisJabatan.map((jenis, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-gray-200 sticky left-0 bg-white dark:bg-gray-800">
                                      {jenis}
                                    </td>
                                    {subIndikatorKompetensi.map((sub, subIdx) => {
                                      const standar = standarKompetensi.find(
                                        (s) => s.subindikator_id === sub.id && 
                                        (s.jenis_jabatan?.name === jenis || s.jenis_jabatan_name === jenis)
                                      );
                                      return (
                                        <td key={subIdx} className="px-4 py-3 text-center">
                                          {standar ? (() => {
                                            const val = Number(standar.standar);
                                            const bgClass =
                                              val === 5 ? 'bg-teal-900 dark:bg-teal-700' :
                                              val === 4 ? 'bg-teal-600 dark:bg-teal-600' :
                                              val === 3 ? 'bg-teal-400 dark:bg-teal-500' :
                                              val === 2 ? 'bg-teal-200 dark:bg-teal-400' :
                                              'bg-teal-100 dark:bg-teal-300';
                                            const textClass = val >= 4 ? 'text-white' : 'text-teal-800 dark:text-teal-200';
                                            return (
                                              <span className={`inline-flex items-center justify-center w-10 h-10 ${bgClass} ${textClass} rounded-lg text-sm font-bold`}>
                                                {val}
                                              </span>
                                            );
                                          })() : (
                                            <span className="inline-flex items-center justify-center w-10 h-10 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-lg text-sm">
                                              -
                                            </span>
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Potensi Talenta Section */}
                    {subIndikatorPotensi.length > 0 && (
                      <div>
                        <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                          <i className="fas fa-star text-teal-500 dark:text-teal-400"></i>
                          Potensi Talenta
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                              <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                  Subindikator
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                  Kategori
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {subIndikatorPotensi.map((sub) => (
                                <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                                  <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
                                    {sub.subindikator}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-2 justify-center">
                                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 rounded-full text-sm font-medium">
                                        Tinggi: <span className="font-semibold">≥ 4</span>
                                      </span>
                                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
                                        Sedang: <span className="font-semibold">2 - 3.99</span>
                                      </span>
                                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full text-sm font-medium">
                                        Rendah: <span className="font-semibold">&lt; 2</span>
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto">
            <ServerDataTable
          key={refreshKey}
          columns={columns}
          fetchData={fetchData}
          onExport={handleExport}
          itemsPerPageOptions={[10, 25, 50, 100]}
          defaultFilters={{
            unit_organisasi: "",
            jabatan: "",
            filter: "",
            golongan: "",
            with_riwayat_asesmen: "",
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
            {
              key: "with_riwayat_asesmen",
              label: "Status Asesmen",
              placeholder: "Semua Status",
              options: [
                { value: "true", label: "Sudah Asesmen" },
                { value: "false", label: "Belum Asesmen" },
              ],
            },
          ]}
        />
          </div>
        </>
      )}

      {/* Employee List Modal */}
      <EmployeeListModal
        isOpen={empModal.isOpen}
        onClose={closeEmpModal}
        employees={empModal.employees}
        title={empModal.title}
        color={empModal.color}
        extraColumns={empModal.cols ?? extraColumns}
      />
    </div>
  );
};

export default Pengembangan;
