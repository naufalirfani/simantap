import { useEffect, useState, useCallback } from "react";
import { useSettings } from "../context/SettingsContext";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  Layer,
  XAxis,
  YAxis,
  CartesianGrid,
  ZAxis,
  ReferenceLine,
  ReferenceArea,
  LabelList,
} from "recharts";
import EmployeeCountBox from "../components/EmployeeCountBox";
import EmployeeListModal from "../components/EmployeeListModal";
import { fetchStatistik, fetchPegawaiList } from "../services/apiService";

const Dashboard = () => {
  const { t } = useSettings();

  const [isDark, setIsDark] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [modalState, setModalState] = useState({
    isOpen: false,
    quadrant: null,
    employees: [],
    title: "",
    color: "",
  });

  useEffect(() => {
    document.title = `${t("dashboard")} | SIMANTAP`;
    setIsDark(
      typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark")
    );
    const checkMobile = () =>
      setIsMobile(typeof window !== "undefined" && window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    // Inject small scoped CSS to suppress focus outline on Recharts SVG elements
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-dashboard-focus-fix", "true");
    styleEl.innerHTML = `
      /* Remove focus outline / ring produced when clicking SVG scatter points */
      .recharts-wrapper .recharts-scatter-symbol:focus,
      .recharts-wrapper .recharts-scatter-symbol:focus-visible,
      .recharts-wrapper svg:focus,
      .recharts-wrapper :focus {
        outline: none !important;
        box-shadow: none !important;
      }
      /* Tooltip wrapper focus (if any) */
      .recharts-wrapper .recharts-tooltip-wrapper:focus { outline: none !important; box-shadow: none !important; }
    `;
    document.head.appendChild(styleEl);

    return () => {
      window.removeEventListener("resize", checkMobile);
      if (styleEl && styleEl.parentNode)
        styleEl.parentNode.removeChild(styleEl);
    };
  }, [t]);

  const pieContainerProps = isMobile
    ? { width: "100%", aspect: 1 }
    : { width: "100%", height: 300 };
  const scatterContainerProps = isMobile
    ? { width: "100%", aspect: 1 }
    : { width: "100%", height: 600 };

  // Statistik dari API (fallback ke data dummy saat belum ada)
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState(null);

  const employeeStats = {
    total: 1250,
    structural: 85,
    functional: 720,
    implementer: 445,
  };

  // Fetch statistik dari API melalui service
  useEffect(() => {
    let mounted = true;
    setLoadingStats(true);
    setStatsError(null);
    fetchStatistik()
      .then((data) => {
        if (!mounted) return;
        setStats(data || null);
      })
      .catch((err) => {
        if (!mounted) return;
        setStatsError(err.message || "Fetch error");
      })
      .finally(() => {
        if (mounted) setLoadingStats(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Data komposisi gender (dari API jika ada)
  const genderData = stats
    ? [
        {
          name: "Laki-laki",
          value: stats.total_laki_laki || 0,
          percentage:
            stats.total_pegawai > 0
              ? ((stats.total_laki_laki / stats.total_pegawai) * 100).toFixed(1)
              : 0,
        },
        {
          name: "Perempuan",
          value: stats.total_perempuan || 0,
          percentage:
            stats.total_pegawai > 0
              ? ((stats.total_perempuan / stats.total_pegawai) * 100).toFixed(1)
              : 0,
        },
      ]
    : [
        { name: "Laki-laki", value: 680, percentage: 54.4 },
        { name: "Perempuan", value: 570, percentage: 45.6 },
      ];

  // Titik tengah untuk label Kotak (koordinat data 0-100)
  const quadrantCenters = [
    { potensial: 25, kinerja: 25, label: "1" },
    { potensial: 25, kinerja: 62.5, label: "2" },
    { potensial: 62.5, kinerja: 25, label: "3" },
    { potensial: 25, kinerja: 87.5, label: "4" },
    { potensial: 62.5, kinerja: 62.5, label: "5" },
    { potensial: 87.5, kinerja: 25, label: "6" },
    { potensial: 62.5, kinerja: 87.5, label: "7" },
    { potensial: 87.5, kinerja: 62.5, label: "8" },
    { potensial: 87.5, kinerja: 87.5, label: "9" },
  ];

  // Data jenis jabatan (dari API jika ada)
  const jobTypeData = stats
    ? [
        {
          name: "Jabatan Pimpinan Tinggi Madya",
          count: stats.total_jabatan_pimpinan_tinggi_madya || 0,
          filterKey: "jabatan_pimpinan_tinggi_madya",
        },
        {
          name: "Jabatan Pimpinan Tinggi Pratama",
          count: stats.total_jabatan_pimpinan_tinggi_pratama || 0,
          filterKey: "jabatan_pimpinan_tinggi_pratama",
        },
        {
          name: "Jabatan Administrator",
          count: stats.total_jabatan_administrator || 0,
          filterKey: "jabatan_administrator",
        },
        {
          name: "Jabatan Pengawas",
          count: stats.total_jabatan_pengawas || 0,
          filterKey: "jabatan_pengawas",
        },
        { name: "Fungsional Utama", count: stats.total_fungsional_utama || 0, filterKey: "fungsional_utama" },
        { name: "Fungsional Madya", count: stats.total_fungsional_madya || 0, filterKey: "fungsional_madya" },
        { name: "Fungsional Muda", count: stats.total_fungsional_muda || 0, filterKey: "fungsional_muda" },
        { name: "Fungsional Pertama", count: stats.total_fungsional_pertama || 0, filterKey: "fungsional_pertama" },
        { name: "Fungsional Penyelia", count: stats.total_fungsional_penyelia || 0, filterKey: "fungsional_penyelia" },
        { name: "Fungsional Mahir", count: stats.total_fungsional_mahir || 0, filterKey: "fungsional_mahir" },
        { name: "Fungsional Terampil", count: stats.total_fungsional_terampil || 0, filterKey: "fungsional_terampil" },
        { name: "Pelaksana", count: stats.total_pelaksana || 0, filterKey: "pelaksana" },
      ]
    : [
        { name: "Jabatan Pimpinan Tinggi Madya", count: 3, filterKey: null },
        { name: "Jabatan Pimpinan Tinggi Pratama", count: 12, filterKey: null },
        { name: "Jabatan Administrator", count: 45, filterKey: null },
        { name: "Jabatan Pengawas", count: 125, filterKey: null },
        { name: "Jabatan Fungsional Ahli Utama", count: 15, filterKey: null },
        { name: "Jabatan Fungsional Ahli Madya", count: 85, filterKey: null },
        { name: "Jabatan Fungsional Ahli Muda", count: 180, filterKey: null },
        { name: "Jabatan Fungsional Ahli Pertama", count: 220, filterKey: null },
        { name: "Jabatan Fungsional Penyelia", count: 45, filterKey: null },
        { name: "Jabatan Fungsional Mahir", count: 95, filterKey: null },
        { name: "Jabatan Fungsional Terampil", count: 140, filterKey: null },
        { name: "Jabatan Pelaksana", count: 220, filterKey: null },
      ];

  // Employee modal & server-side list state
  const [empEmployees, setEmpEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empMeta, setEmpMeta] = useState(null);
  const [empFilter, setEmpFilter] = useState(null);

  const loadEmployees = useCallback(async ({ filter, q = "", page = 1, per_page = 20 } = {}) => {
    try {
      setEmpLoading(true);
      setEmpEmployees([]);
      setEmpMeta(null);
      const res = await fetchPegawaiList({ filter, page, per_page, q });
      const mapped = (res.data || []).map((it) => ({
        name: (it.nama || it.name || "").toString().replace(/^\-\s*/, ""),
        nip: it.nip || it.NIP || "",
        jabatan: it.jabatan || it.nama_jabatan || "",
        unitKerja: it.unit_kerja || it.unitKerja || "",
        email: it.email || it.email_pegawai || it.email_personal || "",
        jenisJabatan: it.jenis_jabatan || it.jenisJabatan || it.jenis || "",
        golongan: it.golongan || it.gol || it.pangkat || "",
        potensial: it.potensial ?? null,
        kinerja: it.kinerja ?? null,
        avatar: it.avatar || null,
      }));
      setEmpEmployees(mapped);
      setEmpMeta(res.meta || null);
    } catch (err) {
      console.error("loadEmployees error:", err);
      setEmpEmployees([]);
      setEmpMeta(null);
    } finally {
      setEmpLoading(false);
    }
  }, []);

  const handleJobTypeClick = (item) => {
    // only fetch if filterKey present
    const filter = item.filterKey || null;
    setModalState({ isOpen: true, quadrant: null, employees: [], title: item.name, color: POINT_COLOR });
    setEmpEmployees([]);
    setEmpMeta(null);
    setEmpFilter(filter);
    if (filter) loadEmployees({ filter, q: "", page: 1 });
  };

  const handleModalSearch = useCallback((q, page = 1, per_page = 20) => {
    if (!empFilter) return;
    loadEmployees({ filter: empFilter, q: q || "", page, per_page });
  }, [empFilter, loadEmployees]);

  // Data dummy untuk 9 Kotak (dengan data lengkap pegawai)
  const quadrantData = [
    {
      name: "Budi Santoso",
      nip: "198501012010011001",
      jabatan: "Analis Data",
      unitKerja: "Bagian Kepegawaian",
      potensial: 35,
      kinerja: 45,
      quadrant: 1,
    },
    {
      name: "Siti Rahayu",
      nip: "198702152011012002",
      jabatan: "Sekretaris",
      unitKerja: "Bagian Umum",
      potensial: 45,
      kinerja: 85,
      quadrant: 2,
    },
    {
      name: "Ahmad Hidayat",
      nip: "199001012015011003",
      jabatan: "Staf Administrasi",
      unitKerja: "Bagian Keuangan",
      potensial: 30,
      kinerja: 92,
      quadrant: 4,
    },
    {
      name: "Dewi Lestari",
      nip: "198803202012012004",
      jabatan: "Kepala Seksi",
      unitKerja: "Bagian Perencanaan",
      potensial: 65,
      kinerja: 55,
      quadrant: 3,
    },
    {
      name: "Eko Prasetyo",
      nip: "198512152013011005",
      jabatan: "Analis Kebijakan",
      unitKerja: "Bagian Hukum",
      potensial: 75,
      kinerja: 75,
      quadrant: 5,
    },
    {
      name: "Rina Wijaya",
      nip: "199105102016012006",
      jabatan: "Koordinator Program",
      unitKerja: "Bagian Program",
      potensial: 88,
      kinerja: 48,
      quadrant: 6,
    },
    {
      name: "Dian Permata",
      nip: "198909252014012007",
      jabatan: "Kepala Subbagian",
      unitKerja: "Bagian SDM",
      potensial: 55,
      kinerja: 88,
      quadrant: 7,
    },
    {
      name: "Agus Setiawan",
      nip: "198406182011011008",
      jabatan: "Kepala Bagian",
      unitKerja: "Bagian Operasional",
      potensial: 87.5,
      kinerja: 87.5,
      quadrant: 9,
    },
    {
      name: "Fitri Handayani",
      nip: "199203152017012009",
      jabatan: "Supervisor",
      unitKerja: "Bagian Pelayanan",
      potensial: 85,
      kinerja: 78,
      quadrant: 8,
    },
    {
      name: "Joko Widodo",
      nip: "198708202013011010",
      jabatan: "Analis Senior",
      unitKerja: "Bagian Riset",
      potensial: 72,
      kinerja: 65,
      quadrant: 5,
    },
    {
      name: "Maya Sari",
      nip: "199006122015012011",
      jabatan: "Staf Keuangan",
      unitKerja: "Bagian Keuangan",
      potensial: 42,
      kinerja: 38,
      quadrant: 1,
    },
    {
      name: "Bambang Sutrisno",
      nip: "198804052012011012",
      jabatan: "Teknisi",
      unitKerja: "Bagian IT",
      potensial: 68,
      kinerja: 92,
      quadrant: 7,
    },
    {
      name: "Lina Marlina",
      nip: "199104202016012013",
      jabatan: "Administrator",
      unitKerja: "Bagian Umum",
      potensial: 38,
      kinerja: 68,
      quadrant: 2,
    },
    {
      name: "Hendra Gunawan",
      nip: "198602102010011014",
      jabatan: "Manajer",
      unitKerja: "Bagian Operasional",
      potensial: 92,
      kinerja: 85,
      quadrant: 9,
    },
    {
      name: "Sri Mulyani",
      nip: "199208152017012015",
      jabatan: "Auditor",
      unitKerja: "Bagian Pengawasan",
      potensial: 78,
      kinerja: 42,
      quadrant: 6,
    },
  ];

  // Tentukan Kotak secara dinamis berdasarkan interval sumbu
  const computeQuadrant = (potensial, kinerja) => {
    if (potensial < 50 && kinerja < 50) return 1;
    if (potensial < 50 && kinerja >= 50 && kinerja < 75) return 2;
    if (potensial >= 50 && potensial < 75 && kinerja < 50) return 3;
    if (potensial < 50 && kinerja >= 75) return 4;
    if (potensial >= 50 && potensial < 75 && kinerja >= 50 && kinerja < 75)
      return 5;
    if (potensial >= 75 && kinerja < 50) return 6;
    if (potensial >= 50 && potensial < 75 && kinerja >= 75) return 7;
    if (potensial >= 75 && kinerja >= 50 && kinerja < 75) return 8;
    if (potensial >= 75 && kinerja >= 75) return 9;
    return 0;
  };

  // Buat data baru dengan Kotak yang dihitung
  const computedQuadrantData = quadrantData.map((item) => ({
    ...item,
    quadrant: computeQuadrant(item.potensial, item.kinerja),
  }));

  // Hitung jumlah data per Kotak (1..9) berdasarkan data yang dihitung
  const quadrantCounts = computedQuadrantData.reduce((acc, item) => {
    const q = Number(item.quadrant) || 0;
    acc[q] = (acc[q] || 0) + 1;
    return acc;
  }, {});

  // Fungsi untuk membuka modal dengan data pegawai per kotak
  const handleBoxClick = (quadrantNumber) => {
    const employees = computedQuadrantData.filter(
      (emp) => emp.quadrant === quadrantNumber
    );

    const colorMap = {
      1: "#EF4444",
      2: "#F97316",
      3: "#F59E0B",
      4: "#F59E0B",
      5: "#EAB308",
      6: "#84CC16",
      7: "#84CC16",
      8: "#22C55E",
      9: "#10B981",
    };

    setModalState({
      isOpen: true,
      quadrant: quadrantNumber,
      employees: employees,
      title: `Pegawai Kotak ${quadrantNumber}`,
      color: colorMap[quadrantNumber],
    });
  };

  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      quadrant: null,
      employees: [],
      title: "",
      color: "",
    });
    // clear server-side employee state
    setEmpEmployees([]);
    setEmpMeta(null);
    setEmpFilter(null);
  };

  const GENDER_COLORS = ["#3B82F6", "#EC4899"];
  // Warna titik yang kontras dengan warna area; menyesuaikan dark mode
  const POINT_COLOR = isDark ? "#F3F4F6" : "#3B82F6";

  // Custom tooltip untuk scatter chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-800 dark:text-white">
            {payload[0].payload.name}
          </p>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-md text-gray-600 dark:text-gray-300">
              <span>Potensial</span>
              <span
                style={{
                  fontVariantNumeric: "tabular-nums",
                  minWidth: 40,
                  textAlign: "right",
                }}
                className="font-medium"
              >
                {payload[0].payload.potensial}
              </span>
            </div>
            <div className="flex justify-between text-md text-gray-600 dark:text-gray-300">
              <span>Kinerja</span>
              <span
                style={{
                  fontVariantNumeric: "tabular-nums",
                  minWidth: 40,
                  textAlign: "right",
                }}
                className="font-medium"
              >
                {payload[0].payload.kinerja}
              </span>
            </div>
            <div className="flex justify-between text-md text-gray-600 dark:text-gray-300">
              <span>Kotak</span>
              <span className="font-medium" style={{ color: POINT_COLOR }}>
                {payload[0].payload.quadrant}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Render label persentase di dalam setiap slice pie
  const RADIAN = Math.PI / 180;
  const renderPieLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }) => {
    const radius =
      (innerRadius || 0) + (outerRadius - (innerRadius || 0)) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const textColor = isDark ? "#E5E7EB" : "#111827";
    return (
      <text
        x={x}
        y={y}
        fill={textColor}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontSize: 20,
          fontWeight: 700,
          fill: "#E5E7EB",
        }}
      >
        {`${Math.round(percent * 100)}%`}
      </text>
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
          {t("dashboard")}
        </h1>
        <p className="mt-2 text-md md:text-base text-gray-600 dark:text-gray-300">
          Ringkasan Data Pegawai dan Statistik
        </p>
      </div>

      {/* Statistik Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        {/* Total Pegawai */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white transform transition hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-md opacity-90 font-medium">Total Pegawai</p>
              <h3 className="text-3xl md:text-4xl font-bold mt-2">
                {loadingStats ? (
                  <div className="h-8 w-32 rounded bg-white bg-opacity-20 animate-pulse" />
                ) : (
                  (stats?.total_pegawai ?? employeeStats.total).toLocaleString()
                )}
              </h3>
            </div>
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <i className="fas fa-users text-4xl text-blue-500"></i>
            </div>
          </div>
        </div>

        {/* Struktural */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white transform transition hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-md opacity-90 font-medium">Struktural</p>
              <h3 className="text-3xl md:text-4xl font-bold mt-2">
                {loadingStats ? (
                  <div className="h-8 w-20 rounded bg-white bg-opacity-20 animate-pulse" />
                ) : (
                  (stats?.total_struktural ?? employeeStats.structural).toLocaleString()
                )}
              </h3>
            </div>
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <i className="fas fa-building text-4xl text-purple-500"></i>
            </div>
          </div>
        </div>

        {/* Fungsional */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white transform transition hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-md opacity-90 font-medium">Fungsional</p>
              <h3 className="text-3xl md:text-4xl font-bold mt-2">
                {loadingStats ? (
                  <div className="h-8 w-20 rounded bg-white bg-opacity-20 animate-pulse" />
                ) : (
                  (stats?.total_fungsional ?? employeeStats.functional).toLocaleString()
                )}
              </h3>
            </div>
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <i className="fas fa-award text-4xl text-green-500"></i>
            </div>
          </div>
        </div>

        {/* Pelaksana */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white transform transition hover:scale-105">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-md opacity-90 font-medium">Pelaksana</p>
              <h3 className="text-3xl md:text-4xl font-bold mt-2">
                {loadingStats ? (
                  <div className="h-8 w-20 rounded bg-white bg-opacity-20 animate-pulse" />
                ) : (
                  (stats?.total_pelaksana ?? employeeStats.implementer).toLocaleString()
                )}
              </h3>
            </div>
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <i className="fas fa-user-circle text-4xl text-orange-500"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Pie Chart - Gender */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <h2 className="text-lg md:text-xl font-bold text-gray-800 dark:text-white mb-4">
            Komposisi Pegawai Berdasarkan Jenis Kelamin
          </h2>
          <ResponsiveContainer
            {...pieContainerProps}
            tabIndex={-1}
            style={{ outline: "none" }}
          >
            <PieChart
              tabIndex={-1}
              style={{ outline: "none" }}
              onFocus={(e) => e.target.blur()}
            >
              <Pie
                data={genderData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderPieLabel}
                fill="#8884d8"
                dataKey="value"
              >
                {genderData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={GENDER_COLORS[index % GENDER_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* List - Job Types */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <h2 className="text-lg md:text-xl font-bold text-gray-800 dark:text-white mb-4">
            Komposisi Pegawai Berdasarkan Jenis Jabatan
          </h2>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {loadingStats ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-2/3 animate-pulse" />
                  <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-12 animate-pulse" />
                </div>
              ))
            ) : (
              jobTypeData.map((item, index) => (
                <div
                  key={index}
                  onClick={() => handleJobTypeClick(item)}
                  role={item.filterKey ? "button" : undefined}
                  tabIndex={item.filterKey ? 0 : undefined}
                  onKeyDown={(e) => { if (item.filterKey && (e.key === 'Enter' || e.key === ' ')) handleJobTypeClick(item); }}
                  className={`flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition ${item.filterKey ? 'cursor-pointer' : ''}`}
                >
                  <span className="text-md text-gray-700 dark:text-gray-300">
                    {item.name}
                  </span>
                  <span className="font-semibold" style={{ color: POINT_COLOR }}>
                    {item.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 9 Quadrant Scatter Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <h2 className="text-lg md:text-xl font-bold text-gray-800 dark:text-white mb-2">
          Matriks 9 Kotak - Potensial vs Kinerja
        </h2>
        <p className="text-md text-gray-600 dark:text-gray-400 mb-4">
          Pemetaan posisi pegawai berdasarkan nilai potensial dan kinerja
        </p>
        {/* Jumlah data per Kotak - single row above chart */}
        <div className="mb-0">
          {/* responsive: wrap on small screens, single-row on large */}
          <div className="flex flex-wrap gap-3 py-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((q) => {
              const colorMap = {
                1: "#EF4444",
                2: "#F97316",
                3: "#F59E0B",
                4: "#F59E0B",
                5: "#EAB308",
                6: "#84CC16",
                7: "#84CC16",
                8: "#22C55E",
                9: "#10B981",
              };
              return (
                <div key={q} className="w-full sm:w-1/2 md:w-1/3 lg:flex-1 min-w-0">
                  <EmployeeCountBox
                    title={`Kotak ${q}`}
                    count={quadrantCounts[q] || 0}
                    color={colorMap[q]}
                    onClick={() => handleBoxClick(q)}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-start">
          <div className="lg:col-span-3">
            <div className="relative">
              {/* Label Sumbu Y (Kinerja) - di luar chart */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-8">
                <div className="-rotate-90 whitespace-nowrap">
                  <span className="text-md font-medium text-gray-600 dark:text-gray-400">
                    Kinerja
                  </span>
                </div>
              </div>

              <ResponsiveContainer
                {...scatterContainerProps}
                tabIndex={-1}
                style={{ outline: "none" }}
              >
                <ScatterChart
                  tabIndex={-1}
                  style={{ outline: "none" }}
                  onFocus={(e) => e.target.blur()}
                  margin={{ top: 20, right: 20, bottom: 0, left: -25 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                    opacity={0.3}
                  />
                  <XAxis
                    type="number"
                    dataKey="potensial"
                    name="Potensial"
                    domain={[0, 100]}
                    ticks={[0, 50, 75, 100]}
                    stroke="#6B7280"
                  />
                  <YAxis
                    type="number"
                    dataKey="kinerja"
                    name="Kinerja"
                    domain={[0, 100]}
                    ticks={[0, 50, 75, 100]}
                    stroke="#6B7280"
                  />
                  <ZAxis range={[100, 100]} />
                  <Tooltip content={<CustomTooltip />} />

                  {/* Background areas untuk Kotak - menggunakan koordinat data aktual */}
                  {/* Row 1 (bottom): Kotak 1, 3, 6 */}
                  <ReferenceArea
                    x1={0}
                    x2={50}
                    y1={0}
                    y2={50}
                    fill="#EF4444"
                    fillOpacity={0.15}
                  />
                  <ReferenceArea
                    x1={50}
                    x2={75}
                    y1={0}
                    y2={50}
                    fill="#F59E0B"
                    fillOpacity={0.15}
                  />
                  <ReferenceArea
                    x1={75}
                    x2={100}
                    y1={0}
                    y2={50}
                    fill="#84CC16"
                    fillOpacity={0.15}
                  />
                  {/* Row 2 (middle): Kotak 2, 5, 8 */}
                  <ReferenceArea
                    x1={0}
                    x2={50}
                    y1={50}
                    y2={75}
                    fill="#F97316"
                    fillOpacity={0.15}
                  />
                  <ReferenceArea
                    x1={50}
                    x2={75}
                    y1={50}
                    y2={75}
                    fill="#EAB308"
                    fillOpacity={0.15}
                  />
                  <ReferenceArea
                    x1={75}
                    x2={100}
                    y1={50}
                    y2={75}
                    fill="#22C55E"
                    fillOpacity={0.15}
                  />
                  {/* Row 3 (top): Kotak 4, 7, 9 */}
                  <ReferenceArea
                    x1={0}
                    x2={50}
                    y1={75}
                    y2={100}
                    fill="#F59E0B"
                    fillOpacity={0.15}
                  />
                  <ReferenceArea
                    x1={50}
                    x2={75}
                    y1={75}
                    y2={100}
                    fill="#84CC16"
                    fillOpacity={0.15}
                  />
                  <ReferenceArea
                    x1={75}
                    x2={100}
                    y1={75}
                    y2={100}
                    fill="#10B981"
                    fillOpacity={0.15}
                  />

                  {/* Garis pembatas vertikal */}
                  <ReferenceLine
                    x={50}
                    stroke="#9CA3AF"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                  <ReferenceLine
                    x={75}
                    stroke="#9CA3AF"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />

                  {/* Garis pembatas horizontal */}
                  <ReferenceLine
                    y={50}
                    stroke="#9CA3AF"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                  <ReferenceLine
                    y={75}
                    stroke="#9CA3AF"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />

                  {/* Label Kotak di tengah setiap area - render sebagai Scatter + LabelList sehingga menggunakan koordinat data */}
                  <Layer key="labels-layer">
                    <Scatter
                      data={quadrantCenters}
                      fill="transparent"
                      shape={() => null}
                    >
                      <LabelList
                        dataKey="label"
                        position="middle"
                        style={{
                          fontSize: 24,
                          fontWeight: 700,
                          fill: isDark ? "#E5E7EB" : "#374151",
                          opacity: 0.3,
                          pointerEvents: "none",
                        }}
                      />
                    </Scatter>
                  </Layer>

                  <Layer key="points-layer">
                    <Scatter
                      name="Pegawai"
                      data={computedQuadrantData}
                      fill={POINT_COLOR}
                      stroke={isDark ? "#0F172A" : "#FFFFFF"}
                      shape="circle"
                      className="cursor-pointer"
                      size={40}
                    />
                  </Layer>
                </ScatterChart>
              </ResponsiveContainer>

              {/* Label Sumbu X (Potensial) - di luar chart */}
              <div className="text-center mt-2">
                <span className="text-md font-medium text-gray-600 dark:text-gray-400">
                  Potensial
                </span>
              </div>
            </div>
          </div>

          {/* Legend untuk interval Kotak + jumlah data per Kotak (kanan) */}
          <div className="lg:col-span-1 lg:mt-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg sticky top-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-2 text-md">
                Batas Interval Kotak
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-1 gap-2 text-md text-gray-600 dark:text-gray-300">
                <div>
                  Sumbu X (Potensial):
                  <br />
                  <b> 0-50 | 50-75 | 75-100</b>
                </div>
                <div>
                  Sumbu Y (Kinerja):
                  <br />
                  <b>0-50 | 50-75 | 75-100</b>
                </div>
              </div>

              {/* Legend items arranged column-major to match counts: [1,6,2,7,3,8,4,9,5] */}
              <div className="mt-6">
                <h3 className="font-semibold text-gray-800 dark:text-white mb-2 text-md">
                  Keterangan Warna Kotak
                </h3>
                <div className="grid grid-cols-1 gap-2 text-md">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((q) => {
                    const colorMap = {
                      1: "#EF4444",
                      2: "#F97316",
                      3: "#F59E0B",
                      4: "#F59E0B",
                      5: "#EAB308",
                      6: "#84CC16",
                      7: "#84CC16",
                      8: "#22C55E",
                      9: "#10B981",
                    };
                    return (
                      <div key={q} className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: colorMap[q], opacity: 0.5 }}
                        ></div>
                        <span className="text-gray-700 dark:text-gray-300">
                          Kotak {q}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* removed: Jumlah data per Kotak - moved above chart for single-row layout */}
            </div>
          </div>
        </div>
      </div>

      {/* Employee List Modal */}
      <EmployeeListModal
        isOpen={modalState.isOpen}
        onClose={handleCloseModal}
        employees={empEmployees}
        title={modalState.title}
        color={modalState.color || POINT_COLOR}
        serverSearch={true}
        loading={empLoading}
        meta={empMeta}
        onSearch={handleModalSearch}
        skipInitialSearch={true}
      />
    </div>
  );
};

export default Dashboard;
