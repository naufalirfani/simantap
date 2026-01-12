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
import { loadKotakConfig, computeQuadrantDynamic } from "../services/kotakConfigService";

const Dashboard = () => {
  const { t } = useSettings();

  const [isDark, setIsDark] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [modalState, setModalState] = useState({
    isOpen: false,
    quadrant: null,
    employees: [],
    title: "",
    description: "",
    color: "",
    kotakConfig: null,
  });

  // Load kotak configuration from localStorage
  const [kotakConfig, setKotakConfig] = useState(null);

  useEffect(() => {
    const config = loadKotakConfig();
    setKotakConfig(config);
    const onConfigChanged = () => setKotakConfig(loadKotakConfig());
    if (typeof window !== 'undefined') {
      window.addEventListener('kotakConfigChanged', onConfigChanged);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('kotakConfigChanged', onConfigChanged);
      }
    };
  }, []);

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
  // Build quadrant centers from kotakConfig intervals (fallback to defaults)
  const computeCentersFromConfig = () => {
    const cfg = kotakConfig || loadKotakConfig();
    const p = cfg?.intervals?.potensial || [{ min: 0, max: 50 }, { min: 50, max: 75 }, { min: 75, max: 100 }];
    const k = cfg?.intervals?.kinerja || [{ min: 0, max: 50 }, { min: 50, max: 75 }, { min: 75, max: 100 }];
    const mapping = [
      [0, 0],
      [0, 1],
      [1, 0],
      [0, 2],
      [1, 1],
      [2, 0],
      [1, 2],
      [2, 1],
      [2, 2],
    ];
    return mapping.map((m, idx) => {
      const pc = p[m[0]];
      const kc = k[m[1]];
      const potensial = ((pc?.min ?? 0) + (pc?.max ?? 100)) / 2;
      const kinerja = ((kc?.min ?? 0) + (kc?.max ?? 100)) / 2;
      return { potensial, kinerja, label: String(idx + 1) };
    });
  };
  const quadrantCenters = computeCentersFromConfig();

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
        { name: "Jabatan Fungsional Utama", count: stats.total_fungsional_utama || 0, filterKey: "fungsional_utama" },
        { name: "Jabatan Fungsional Madya", count: stats.total_fungsional_madya || 0, filterKey: "fungsional_madya" },
        { name: "Jabatan Fungsional Muda", count: stats.total_fungsional_muda || 0, filterKey: "fungsional_muda" },
        { name: "Jabatan Fungsional Pertama", count: stats.total_fungsional_pertama || 0, filterKey: "fungsional_pertama" },
        { name: "Jabatan Fungsional Penyelia", count: stats.total_fungsional_penyelia || 0, filterKey: "fungsional_penyelia" },
        { name: "Jabatan Fungsional Mahir", count: stats.total_fungsional_mahir || 0, filterKey: "fungsional_mahir" },
        { name: "Jabatan Fungsional Terampil", count: stats.total_fungsional_terampil || 0, filterKey: "fungsional_terampil" },
        { name: "Jabatan Pelaksana", count: stats.total_pelaksana || 0, filterKey: "pelaksana" },
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
    const filter = item.name || null;
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

  // Tentukan Kotak secara dinamis berdasarkan konfigurasi
  const computeQuadrant = (potensial, kinerja) => {
    return computeQuadrantDynamic(potensial, kinerja);
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

    const kotak = kotakConfig?.kotak.find(k => k.id === quadrantNumber);

    setModalState({
      isOpen: true,
      quadrant: quadrantNumber,
      employees: employees,
      title: `Kotak ${quadrantNumber}`,
      description: kotak?.kategori || "",
      color: kotak?.warna || "#3B82F6",
      kotakConfig: kotak,
    });
  };

  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      quadrant: null,
      employees: [],
      title: "",
      color: "",
      kotakConfig: null,
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
        <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg shadow-lg p-6 text-white transform transition hover:scale-105">
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
              <i className="fas fa-users text-4xl text-slate-500"></i>
            </div>
          </div>
        </div>

        {/* Struktural */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-lg shadow-lg p-6 text-white transform transition hover:scale-105">
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
              <i className="fas fa-building text-4xl text-indigo-500"></i>
            </div>
          </div>
        </div>

        {/* Fungsional */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-lg shadow-lg p-6 text-white transform transition hover:scale-105">
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
              <i className="fas fa-award text-4xl text-[#2fa84f]"></i>
            </div>
          </div>
        </div>

        {/* Pelaksana */}
        <div className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-lg shadow-lg p-6 text-white transform transition hover:scale-105">
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
              <i className="fas fa-user-circle text-4xl text-amber-500"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Pie Chart - Gender */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
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
              const kotak = kotakConfig?.kotak.find(k => k.id === q);
              const warna = kotak?.warna || "#3B82F6";
              const nama = `Kotak ${q}`;
              return (
                <div key={q} className="w-full sm:w-1/2 md:w-1/3 lg:flex-1 min-w-0">
                  <EmployeeCountBox
                    title={nama}
                    count={quadrantCounts[q] || 0}
                    color={warna}
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
                    ticks={(() => {
                      const p = kotakConfig?.intervals?.potensial || [{ max: 50 }, { max: 75 }, { max: 100 }];
                      return [0, p[0].max, p[1].max, 100];
                    })()}
                    stroke="#6B7280"
                  />
                  <YAxis
                    type="number"
                    dataKey="kinerja"
                    name="Kinerja"
                    domain={[0, 100]}
                    ticks={(() => {
                      const k = kotakConfig?.intervals?.kinerja || [{ max: 50 }, { max: 75 }, { max: 100 }];
                      return [0, k[0].max, k[1].max, 100];
                    })()}
                    stroke="#6B7280"
                  />
                  <ZAxis range={[100, 100]} />
                  <Tooltip content={<CustomTooltip />} />

                  {/* Background areas for each kotak using configured ranges */}
                  {(() => {
                    const cfg = kotakConfig || loadKotakConfig();
                    return (cfg.kotak || []).map((kotak) => (
                      <ReferenceArea
                        key={`ra-${kotak.id}`}
                        x1={kotak.potensialRange.min}
                        x2={kotak.potensialRange.max}
                        y1={kotak.kinerjaRange.min}
                        y2={kotak.kinerjaRange.max}
                        fill={kotak.warna || '#3B82F6'}
                        fillOpacity={0.12}
                      />
                    ));
                  })()}

                  {/* Boundary lines based on interval maxima */}
                  {(() => {
                    const cfg = kotakConfig || loadKotakConfig();
                    const p = cfg?.intervals?.potensial || [{ max: 50 }, { max: 75 }, { max: 100 }];
                    const k = cfg?.intervals?.kinerja || [{ max: 50 }, { max: 75 }, { max: 100 }];
                    return (
                      <>
                        <ReferenceLine x={p[0].max} stroke="#9CA3AF" strokeWidth={2} strokeDasharray="5 5" />
                        <ReferenceLine x={p[1].max} stroke="#9CA3AF" strokeWidth={2} strokeDasharray="5 5" />
                        <ReferenceLine y={k[0].max} stroke="#9CA3AF" strokeWidth={2} strokeDasharray="5 5" />
                        <ReferenceLine y={k[1].max} stroke="#9CA3AF" strokeWidth={2} strokeDasharray="5 5" />
                      </>
                    );
                  })()}

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
                  <b>
                    {((kotakConfig && kotakConfig.intervals && kotakConfig.intervals.potensial) || [{ min: 0, max: 50 }, { min: 50, max: 75 }, { min: 75, max: 100 }])
                      .map((it) => `${it.min}-${it.max}`)
                      .join(' | ')}
                  </b>
                </div>
                <div>
                  Sumbu Y (Kinerja):
                  <br />
                  <b>
                    {((kotakConfig && kotakConfig.intervals && kotakConfig.intervals.kinerja) || [{ min: 0, max: 50 }, { min: 50, max: 75 }, { min: 75, max: 100 }])
                      .map((it) => `${it.min}-${it.max}`)
                      .join(' | ')}
                  </b>
                </div>
              </div>

              {/* Legend items arranged column-major to match counts: [1,6,2,7,3,8,4,9,5] */}
              <div className="mt-6">
                <h3 className="font-semibold text-gray-800 dark:text-white mb-2 text-md">
                  Keterangan Warna Kotak
                </h3>
                <div className="grid grid-cols-1 gap-2 text-md">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((q) => {
                    const kotak = kotakConfig?.kotak.find(k => k.id === q);
                    const warna = kotak?.warna || "#3B82F6";
                    const kategori = kotak?.kategori;
                    return (
                      <div key={q} className="flex items-start gap-2">
                        <div
                          className="flex-shrink-0 w-4 h-4 rounded mt-0.5"
                          style={{ backgroundColor: warna, opacity: 0.5 }}
                        ></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-gray-700 dark:text-gray-300 font-medium">
                            Kotak {q}
                          </div>
                          {kategori && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              {kategori}
                            </div>
                          )}
                        </div>
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
        description={modalState.description}
        color={modalState.color || POINT_COLOR}
        serverSearch={true}
        loading={empLoading}
        meta={empMeta}
        onSearch={handleModalSearch}
        skipInitialSearch={true}
        kotakConfig={modalState.kotakConfig}
      />
    </div>
  );
};

export default Dashboard;
