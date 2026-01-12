import { useEffect, useState, useCallback, useRef } from "react";
import { useSettings } from "../context/SettingsContext";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Scatter } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  Filler,
} from "chart.js";
import EmployeeCountBox from "../components/EmployeeCountBox";
import EmployeeListModal from "../components/EmployeeListModal";
import { fetchStatistik, fetchPegawaiList } from "../services/apiService";
import {
  loadKotakConfig,
  computeQuadrantDynamic,
} from "../services/kotakConfigService";

// Register Chart.js components
ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  ChartTooltip,
  ChartLegend,
  Filler
);

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
    if (typeof window !== "undefined") {
      window.addEventListener("kotakConfigChanged", onConfigChanged);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("kotakConfigChanged", onConfigChanged);
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

    // Ensure Poppins font is available for tooltip on hover
    const fontLinkHref =
      "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap";
    let fontLink = Array.from(
      document.head.querySelectorAll('link[rel="stylesheet"]')
    ).find(
      (l) =>
        l.href &&
        l.href.includes("fonts.googleapis.com") &&
        l.href.includes("Poppins")
    );
    if (!fontLink) {
      fontLink = document.createElement("link");
      fontLink.rel = "stylesheet";
      fontLink.href = fontLinkHref;
      fontLink.setAttribute("data-poppins", "true");
      document.head.appendChild(fontLink);
    }

    return () => {
      window.removeEventListener("resize", checkMobile);
      if (styleEl && styleEl.parentNode)
        styleEl.parentNode.removeChild(styleEl);
      // remove injected font link if we added it
      if (
        fontLink &&
        fontLink.getAttribute &&
        fontLink.getAttribute("data-poppins") === "true" &&
        fontLink.parentNode
      ) {
        fontLink.parentNode.removeChild(fontLink);
      }
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
    const p = cfg?.intervals?.potensial || [
      { min: 0, max: 50 },
      { min: 50, max: 75 },
      { min: 75, max: 100 },
    ];
    const k = cfg?.intervals?.kinerja || [
      { min: 0, max: 50 },
      { min: 50, max: 75 },
      { min: 75, max: 100 },
    ];
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
        {
          name: "Jabatan Fungsional Utama",
          count: stats.total_fungsional_utama || 0,
          filterKey: "fungsional_utama",
        },
        {
          name: "Jabatan Fungsional Madya",
          count: stats.total_fungsional_madya || 0,
          filterKey: "fungsional_madya",
        },
        {
          name: "Jabatan Fungsional Muda",
          count: stats.total_fungsional_muda || 0,
          filterKey: "fungsional_muda",
        },
        {
          name: "Jabatan Fungsional Pertama",
          count: stats.total_fungsional_pertama || 0,
          filterKey: "fungsional_pertama",
        },
        {
          name: "Jabatan Fungsional Penyelia",
          count: stats.total_fungsional_penyelia || 0,
          filterKey: "fungsional_penyelia",
        },
        {
          name: "Jabatan Fungsional Mahir",
          count: stats.total_fungsional_mahir || 0,
          filterKey: "fungsional_mahir",
        },
        {
          name: "Jabatan Fungsional Terampil",
          count: stats.total_fungsional_terampil || 0,
          filterKey: "fungsional_terampil",
        },
        {
          name: "Jabatan Pelaksana",
          count: stats.total_pelaksana || 0,
          filterKey: "pelaksana",
        },
      ]
    : [
        { name: "Jabatan Pimpinan Tinggi Madya", count: 3, filterKey: null },
        { name: "Jabatan Pimpinan Tinggi Pratama", count: 12, filterKey: null },
        { name: "Jabatan Administrator", count: 45, filterKey: null },
        { name: "Jabatan Pengawas", count: 125, filterKey: null },
        { name: "Jabatan Fungsional Ahli Utama", count: 15, filterKey: null },
        { name: "Jabatan Fungsional Ahli Madya", count: 85, filterKey: null },
        { name: "Jabatan Fungsional Ahli Muda", count: 180, filterKey: null },
        {
          name: "Jabatan Fungsional Ahli Pertama",
          count: 220,
          filterKey: null,
        },
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
  const [empKuadran, setEmpKuadran] = useState(null);

  const loadEmployees = useCallback(
    async ({
      filter,
      kuadran = null,
      q = "",
      page = 1,
      per_page = 10,
    } = {}) => {
      try {
        setEmpLoading(true);
        setEmpEmployees([]);
        setEmpMeta(null);

        if (kuadran != null) {
          const kotakId = Number(kuadran);
          // prefer computedQuadrantData; if not available yet, fetch full penilaian list
          let sourceData = computedQuadrantData;
          if (!sourceData || sourceData.length === 0) {
            try {
              const resAll = await fetchPegawaiList({ with_penilaian: true, with_pagination: false });
              sourceData = (resAll.data || []).map((it) => ({
                name: (it.nama || it.name || "").toString().replace(/^\-\s*/, ""),
                nip: it.nip || it.NIP || "",
                jabatan: it.jabatan || it.nama_jabatan || "",
                unitKerja: it.unit_kerja || it.unitKerja || "",
                potensial: it.nilai_potensial ?? null,
                kinerja: it.nilai_kinerja ?? null,
                quadrant: computeQuadrant(it.nilai_potensial ?? null, it.nilai_kinerja ?? null),
                avatar: it.avatar || null,
                raw: it,
              }));
            } catch (e) {
              sourceData = [];
            }
          }
          
          const filtered = (sourceData || []).filter((it) => it.quadrant === kotakId);
          const qnorm = (q || "").toString().trim().toLowerCase();
          const searched = qnorm
            ? filtered.filter((it) => {
                const hay = `${it.name || ""} ${it.nip || ""} ${
                  it.jabatan || ""
                }`.toLowerCase();
                return hay.includes(qnorm);
              })
            : filtered;

          const total = searched.length;
          const last_page = Math.max(1, Math.ceil(total / per_page));
          const current_page = Math.min(Math.max(1, page), last_page);
          const start = (current_page - 1) * per_page;
          const paged = searched.slice(start, start + per_page);

          const mapped = paged.map((it) => ({
            name: it.name || "",
            nip: it.nip || "",
            jabatan: it.jabatan || "",
            unitKerja: it.unitKerja || "",
            email: it.email || "",
            jenisJabatan: it.jenisJabatan || it.jenis || "",
            golongan: it.golongan || "",
            potensial: it.potensial ?? it.raw?.nilai_potensial ?? null,
            kinerja: it.kinerja ?? it.raw?.nilai_kinerja ?? null,
            avatar: it.avatar || null,
          }));

          setEmpEmployees(mapped);
          setEmpMeta({ current_page, per_page, last_page, total });
          return;
        }

        // Fallback to server-side fetch for other filters
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
    },
    []
  );

  const handleJobTypeClick = async (item) => {
    // only fetch if filterKey present
    const filter = item.name || null;
    setEmpEmployees([]);
    setEmpMeta(null);
    setEmpFilter(filter);
    setEmpKuadran(null);

    if (filter) {
      // await server load so modal mounts with meta/employees already present
      await loadEmployees({ filter, q: "", page: 1, per_page: 10 });
    }

    setModalState({
      isOpen: true,
      quadrant: null,
      employees: [],
      title: item.name,
      color: POINT_COLOR,
    });
  };

  const handleModalSearch = useCallback(
    (q, page = 1, per_page = 10) => {
      // If empKuadran is set, perform frontend search/pagination
      if (empKuadran != null) {
        loadEmployees({ kuadran: empKuadran, q: q || "", page, per_page });
        return;
      }
      if (!empFilter) return;
      loadEmployees({ filter: empFilter, q: q || "", page, per_page });
    },
    [empFilter, empKuadran, loadEmployees]
  );

  // Load pegawai (with penilaian) dari API untuk chart 9 Kotak
  const [quadrantData, setQuadrantData] = useState([]);
  const [quadrantLoading, setQuadrantLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setQuadrantLoading(true);
    fetchPegawaiList({ with_penilaian: true, with_pagination: false })
      .then((res) => {
        if (!mounted) return;
        const mapped = (res.data || []).map((it) => ({
          name: (it.nama || it.name || "").toString().replace(/^\-\s*/, ""),
          nip: it.nip || it.NIP || "",
          jabatan: it.jabatan || it.nama_jabatan || "",
          unitKerja: it.unit_kerja || it.unitKerja || "",
          potensial: it.nilai_potensial ?? null,
          kinerja: it.nilai_kinerja ?? null,
          avatar: it.avatar || null,
          raw: it,
        }));
        setQuadrantData(mapped);
      })
      .catch((err) => {
        console.error("Error loading quadrant data:", err);
        if (mounted) setQuadrantData([]);
      })
      .finally(() => {
        if (mounted) setQuadrantLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

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
    const kotak = kotakConfig?.kotak.find((k) => k.id === quadrantNumber);
    setModalState({
      isOpen: true,
      quadrant: quadrantNumber,
      employees: [],
      title: `Kotak ${quadrantNumber}`,
      description: kotak?.kategori || "",
      color: kotak?.warna || "#3B82F6",
      kotakConfig: kotak,
    });
    setEmpEmployees([]);
    setEmpMeta(null);
    // use empKuadran for frontend pagination/search
    setEmpKuadran(quadrantNumber);
    loadEmployees({ kuadran: quadrantNumber, q: "", page: 1, per_page: 10 });
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
    setEmpKuadran(null);
  };

  const GENDER_COLORS = ["#3B82F6", "#EC4899"];
  // Warna titik yang kontras dengan warna area; menyesuaikan dark mode
  const POINT_COLOR = isDark ? "#F3F4F6" : "#3B82F6";

  const chartRef = useRef(null);

  // Custom plugin untuk menggambar background areas dan label kotak
  const backgroundPlugin = {
    id: "backgroundPlugin",
    beforeDatasetsDraw: (chart) => {
      const {
        ctx,
        chartArea: { left, right, top, bottom },
        scales: { x, y },
      } = chart;
      const cfg = kotakConfig || loadKotakConfig();
      const p = cfg?.intervals?.potensial || [
        { min: 0, max: 50 },
        { min: 50, max: 75 },
        { min: 75, max: 100 },
      ];
      const k = cfg?.intervals?.kinerja || [
        { min: 0, max: 50 },
        { min: 50, max: 75 },
        { min: 75, max: 100 },
      ];

      ctx.save();

      // Draw background areas
      (cfg.kotak || []).forEach((kotak) => {
        const x1 = x.getPixelForValue(kotak.potensialRange.min);
        const x2 = x.getPixelForValue(kotak.potensialRange.max);
        const y1 = y.getPixelForValue(kotak.kinerjaRange.min);
        const y2 = y.getPixelForValue(kotak.kinerjaRange.max);

        ctx.fillStyle = kotak.warna;
        ctx.globalAlpha = 0.12;
        ctx.fillRect(x1, y2, x2 - x1, y1 - y2);
      });

      ctx.globalAlpha = 1;

      // Draw boundary lines
      ctx.strokeStyle = "#9CA3AF";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      // Vertical lines
      [p[0].max, p[1].max].forEach((val) => {
        const xPos = x.getPixelForValue(val);
        ctx.beginPath();
        ctx.moveTo(xPos, top);
        ctx.lineTo(xPos, bottom);
        ctx.stroke();
      });

      // Horizontal lines
      [k[0].max, k[1].max].forEach((val) => {
        const yPos = y.getPixelForValue(val);
        ctx.beginPath();
        ctx.moveTo(left, yPos);
        ctx.lineTo(right, yPos);
        ctx.stroke();
      });

      ctx.setLineDash([]);

      // Draw labels
      ctx.font = "bold 24px sans-serif";
      ctx.fillStyle = isDark ? "#E5E7EB" : "#374151";
      ctx.globalAlpha = 0.3;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      quadrantCenters.forEach((center) => {
        const xPos = x.getPixelForValue(center.potensial);
        const yPos = y.getPixelForValue(center.kinerja);
        ctx.fillText(center.label, xPos, yPos);
      });

      ctx.restore();
    },
  };

  // Prepare Chart.js data
  const getChartData = () => {
    return {
      datasets: [
        {
          label: "Pegawai",
          data: computedQuadrantData.map((item) => ({
            x: item.potensial,
            y: item.kinerja,
            name: item.name,
            quadrant: item.quadrant,
          })),
          backgroundColor: POINT_COLOR,
          borderColor: isDark ? "#0F172A" : "#FFFFFF",
          borderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7.5,
        },
      ],
    };
  };

  // Chart.js options
  const getChartOptions = () => {
    const cfg = kotakConfig || loadKotakConfig();
    const p = cfg?.intervals?.potensial || [
      { min: 0, max: 50 },
      { min: 50, max: 75 },
      { min: 75, max: 100 },
    ];
    const k = cfg?.intervals?.kinerja || [
      { min: 0, max: 50 },
      { min: 50, max: 75 },
      { min: 75, max: 100 },
    ];

    return {
      responsive: true,
      maintainAspectRatio: isMobile,
      aspectRatio: isMobile ? 1 : undefined,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
          titleColor: isDark ? "#F3F4F6" : "#1F2937",
          bodyColor: isDark ? "#F3F4F6" : "#1F2937",
          // use Poppins for tooltip text when hovering a point
          titleFont: {
            family:
              'Poppins, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
            weight: "600",
            size: 14,
          },
          bodyFont: {
            family:
              'Poppins, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
            weight: "500",
            size: 13,
          },
          borderColor: isDark ? "#374151" : "#E5E7EB",
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          fontSize: 14,
          callbacks: {
            // don't put names in the title (title remains empty)
            title: () => "",
            // Use label to render the employee name (will appear above the details)
            label: (context) => {
              const data = context.raw || context;
              return data.name || "";
            },
            // afterLabel returns details for the same employee; add an extra blank line for spacing
            afterLabel: (item) => {
              const data = item.raw || item;
              return [
                `Potensial: ${data.x}`,
                `Kinerja: ${data.y}`,
                `Kotak: ${data.quadrant}`,
                "",
              ];
            },
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          position: "bottom",
          min: 0,
          max: 100,
          ticks: {
            stepSize: p[0].max,
            color: "#6B7280",
          },
          grid: {
            color: "#374151",
            lineWidth: 1,
            drawTicks: true,
          },
          border: {
            color: "#6B7280",
          },
        },
        y: {
          type: "linear",
          min: 0,
          max: 100,
          ticks: {
            stepSize: k[0].max,
            color: "#6B7280",
          },
          grid: {
            color: "#374151",
            lineWidth: 1,
            drawTicks: true,
          },
          border: {
            color: "#6B7280",
          },
        },
      },
    };
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
              <i className="fas fa-users text-4xl text-slate-800"></i>
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
                  (
                    stats?.total_struktural ?? employeeStats.structural
                  ).toLocaleString()
                )}
              </h3>
            </div>
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <i className="fas fa-building text-4xl text-indigo-700"></i>
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
                  (
                    stats?.total_fungsional ?? employeeStats.functional
                  ).toLocaleString()
                )}
              </h3>
            </div>
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <i className="fas fa-award text-4xl text-emerald-700"></i>
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
                  (
                    stats?.total_pelaksana ?? employeeStats.implementer
                  ).toLocaleString()
                )}
              </h3>
            </div>
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <i className="fas fa-user-circle text-4xl text-amber-700"></i>
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
            {loadingStats
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-2/3 animate-pulse" />
                    <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-12 animate-pulse" />
                  </div>
                ))
              : jobTypeData.map((item, index) => (
                  <div
                    key={index}
                    onClick={() => handleJobTypeClick(item)}
                    role={item.filterKey ? "button" : undefined}
                    tabIndex={item.filterKey ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (
                        item.filterKey &&
                        (e.key === "Enter" || e.key === " ")
                      )
                        handleJobTypeClick(item);
                    }}
                    className={`flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition ${
                      item.filterKey ? "cursor-pointer" : ""
                    }`}
                  >
                    <span className="text-md text-gray-700 dark:text-gray-300">
                      {item.name}
                    </span>
                    <span
                      className="font-semibold"
                      style={{ color: POINT_COLOR }}
                    >
                      {item.count}
                    </span>
                  </div>
                ))}
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
              const kotak = kotakConfig?.kotak.find((k) => k.id === q);
              const warna = kotak?.warna || "#3B82F6";
              const nama = `Kotak ${q}`;
              return (
                <div
                  key={q}
                  className="w-full sm:w-1/2 md:w-1/3 lg:flex-1 min-w-0"
                >
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

              <div
                style={
                  isMobile
                    ? { width: "100%", aspectRatio: "1" }
                    : { height: "600px", width: "100%" }
                }
              >
                <Scatter
                  ref={chartRef}
                  data={getChartData()}
                  options={getChartOptions()}
                  plugins={[backgroundPlugin]}
                />
              </div>

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
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg top-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-2 text-md">
                Batas Interval Kotak
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-1 gap-2 text-md text-gray-600 dark:text-gray-300">
                <div>
                  Sumbu X (Potensial):
                  <br />
                  <b>
                    {(
                      (kotakConfig &&
                        kotakConfig.intervals &&
                        kotakConfig.intervals.potensial) || [
                        { min: 0, max: 50 },
                        { min: 50, max: 75 },
                        { min: 75, max: 100 },
                      ]
                    )
                      .map((it) => `${it.min}-${it.max}`)
                      .join(" | ")}
                  </b>
                </div>
                <div>
                  Sumbu Y (Kinerja):
                  <br />
                  <b>
                    {(
                      (kotakConfig &&
                        kotakConfig.intervals &&
                        kotakConfig.intervals.kinerja) || [
                        { min: 0, max: 50 },
                        { min: 50, max: 75 },
                        { min: 75, max: 100 },
                      ]
                    )
                      .map((it) => `${it.min}-${it.max}`)
                      .join(" | ")}
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
                    const kotak = kotakConfig?.kotak.find((k) => k.id === q);
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
