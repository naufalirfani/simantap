import { useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";
import { BG_COLORS, TEXT_ON_BG_COLORS } from "../config/colors";
import { fetchPegawaiList, fetchPetaJabatan, fetchIndikators, fetchStandarKompetensiMSK } from "../services/apiService";
import Swal from "sweetalert2";
import ServerDataTable from "../components/ServerDataTable";
import IconButton from "../components/IconButton";
import Breadcrumb from "../components/Breadcrumb";
import ExcelJS from "exceljs";

const Pengembangan = () => {
  const { t } = useSettings();
  const navigate = useNavigate();
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);

  const [filterOptions, setFilterOptions] = useState({
    organisasi: [],
    jabatan: [],
    jenis: [],
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [analytics, setAnalytics] = useState({
    totalPegawai: 0,
    rataRataKompetensi: 0,
    rataRataPotensi: 0,
    kategoriKompetensi: {
      memenuhiStandar: 0,
      diBawahStandar: 0,
    },
    kategoriPotensi: {
      tinggi: 0,
      sedang: 0,
      rendah: 0,
    },
  });
  const [subIndikatorKompetensi, setSubIndikatorKompetensi] = useState([]);
  const [subIndikatorPotensi, setSubIndikatorPotensi] = useState([]);
  const [loadingSubIndikators, setLoadingSubIndikators] = useState(true);
  const [standarKompetensi, setStandarKompetensi] = useState([]);

  useEffect(() => {
    document.title = `${t("pengembangan")} | SIMANTAP`;
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
    loadAnalytics();
    loadSubIndikators();
    loadStandarKompetensi();
  }, []);

  // Reload analytics when standar or subindikators are loaded
  useEffect(() => {
    if (subIndikatorKompetensi.length > 0 || subIndikatorPotensi.length > 0) {
      loadAnalytics();
    }
  }, [standarKompetensi, subIndikatorKompetensi, subIndikatorPotensi]);

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

      const kompetensiSubs =
        kompetensiIndikator && Array.isArray(kompetensiIndikator.sub_indikators)
          ? kompetensiIndikator.sub_indikators.filter((s) => s.isactive)
          : [];

      const potensiSubs =
        potensiIndikator && Array.isArray(potensiIndikator.sub_indikators)
          ? potensiIndikator.sub_indikators.filter((s) => s.isactive)
          : [];

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
      // If no pegawai data, return default
      return 5;
    }
    
    // Try to find standar matching both subindikator and jenis_jabatan
    const jenisJabatanId = pegawai.jenis_jabatan_id;
    const jenisJabatanName = pegawai.jenis_jabatan?.name || pegawai.jenis_jabatan_name || pegawai.jenis_jabatan;
    
    const standar = standarKompetensi.find((s) => {
      const matchSubindikator = s.subindikator_id === subIndikatorId;
      
      // Match by jenis_jabatan_id first (more accurate)
      if (jenisJabatanId && s.jenis_jabatan_id) {
        return matchSubindikator && s.jenis_jabatan_id === jenisJabatanId;
      }
      
      // Fallback: match by jenis_jabatan name
      if (jenisJabatanName && s.jenis_jabatan?.name) {
        return matchSubindikator && s.jenis_jabatan.name === jenisJabatanName;
      }
      
      // Last resort: just match subindikator
      return matchSubindikator;
    });
    
    return standar?.standar || 5; // Default to 5 if not found
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

  // Load analytics data
  const loadAnalytics = async () => {
    try {
      const data = await fetchPegawaiList({ with_penilaian: true, limit: 1000 });
      const pegawaiList = data.data || [];

      let totalKompetensi = 0;
      let totalPotensi = 0;
      let countKompetensi = 0;
      let countPotensi = 0;
      let memenuhiStandar = 0;
      let diBawahStandar = 0;
      let tinggiPotensi = 0;
      let sedangPotensi = 0;
      let rendahPotensi = 0;

      pegawaiList.forEach((pegawai) => {
        // Calculate kompetensi scores from subindikators
        if (subIndikatorKompetensi.length > 0) {
          let pegawaiKompetensiTotal = 0;
          let pegawaiKompetensiCount = 0;
          let pegawaiMemenuhiStandar = true;

          subIndikatorKompetensi.forEach((sub) => {
            const nilai = getNilaiSubIndikator(pegawai, sub.id);
            if (nilai !== null && nilai !== undefined) {
              pegawaiKompetensiTotal += parseFloat(nilai);
              pegawaiKompetensiCount++;
              
              const category = getKompetensiCategory(nilai, sub.id, pegawai);
              if (category === "Di Bawah Standar") {
                pegawaiMemenuhiStandar = false;
              }
            }
          });

          if (pegawaiKompetensiCount > 0) {
            totalKompetensi += pegawaiKompetensiTotal / pegawaiKompetensiCount;
            countKompetensi++;
            
            if (pegawaiMemenuhiStandar) {
              memenuhiStandar++;
            } else {
              diBawahStandar++;
            }
          }
        }

        // Calculate potensi scores from subindikators
        if (subIndikatorPotensi.length > 0) {
          let pegawaiPotensiTotal = 0;
          let pegawaiPotensiCount = 0;
          let pegawaiPotensiCategories = [];

          subIndikatorPotensi.forEach((sub) => {
            const nilai = getNilaiSubIndikator(pegawai, sub.id);
            if (nilai !== null && nilai !== undefined) {
              pegawaiPotensiTotal += parseFloat(nilai);
              pegawaiPotensiCount++;
              
              const category = getPotensiCategory(nilai);
              if (category) {
                pegawaiPotensiCategories.push(category);
              }
            }
          });

          if (pegawaiPotensiCount > 0) {
            const avgPotensi = pegawaiPotensiTotal / pegawaiPotensiCount;
            totalPotensi += avgPotensi;
            countPotensi++;
            
            // Categorize based on average potensi
            const overallCategory = getPotensiCategory(avgPotensi);
            if (overallCategory === "Tinggi") tinggiPotensi++;
            else if (overallCategory === "Sedang") sedangPotensi++;
            else if (overallCategory === "Rendah") rendahPotensi++;
          }
        }
      });

      setAnalytics({
        totalPegawai: pegawaiList.length,
        rataRataKompetensi:
          countKompetensi > 0 ? (totalKompetensi / countKompetensi).toFixed(2) : 0,
        rataRataPotensi:
          countPotensi > 0 ? (totalPotensi / countPotensi).toFixed(2) : 0,
        kategoriKompetensi: {
          memenuhiStandar: memenuhiStandar,
          diBawahStandar: diBawahStandar,
        },
        kategoriPotensi: {
          tinggi: tinggiPotensi,
          sedang: sedangPotensi,
          rendah: rendahPotensi,
        },
      });
    } catch (error) {
      console.error("Error loading analytics:", error);
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
    return "text-red-600 dark:text-red-400";
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

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Breadcrumb */}
      <Breadcrumb />

      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
          Pengembangan
        </h1>
        <p className="mt-2 text-md md:text-base text-gray-600 dark:text-gray-300">
          Analisis dan penilaian kompetensi manajerial, sosial kultural, serta
          potensi talenta pegawai
        </p>
      </div>

      {/* Data Table */}
      {loadingSubIndikators ? (
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
                                          {standar ? (
                                            <span className="inline-flex items-center justify-center w-10 h-10 bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 rounded-lg text-sm font-semibold">
                                              {standar.standar}
                                            </span>
                                          ) : (
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
          }}
          filterConfigs={[
            {
              key: "unit_organisasi_name",
              label: "Organisasi",
              placeholder: "Semua Organisasi",
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
        </>
      )}
    </div>
  );
};

export default Pengembangan;
