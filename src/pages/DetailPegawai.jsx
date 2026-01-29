import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { useParams, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { PRIMARY_COLORS } from "../config/colors";
import Breadcrumb from "../components/Breadcrumb";
import IconButton from "../components/IconButton";
import {
  fetchPegawaiByNip,
  fetchIndikators,
  fetchStandarKompetensiMSK,
} from "../services/apiService";
import {
  loadKotakConfig,
  computeQuadrantDynamic,
} from "../services/kotakConfigService";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
} from "chart.js";
import { Doughnut, Radar, Scatter } from "react-chartjs-2";
// Use Poppins as default font for charts
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
);
ChartJS.defaults.font.family =
  'Poppins, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
const DetailPegawai = () => {
  const { nip } = useParams();
  const navigate = useNavigate();
  const { t } = useSettings();
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingCompetency, setLoadingCompetency] = useState(true);
  const [loadingIndicators, setLoadingIndicators] = useState(true);
  const [pegawaiData, setPegawaiData] = useState(null);
  const [standarMSK, setStandarMSK] = useState(null);
  const [indikators, setIndikators] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [showPersonalModal, setShowPersonalModal] = useState(false);
  const [showEmploymentModal, setShowEmploymentModal] = useState(false);

  // Track mobile viewport for responsive chart sizing
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(typeof window !== "undefined" && window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Calculate masa kerja from tglSkCpns
  const calculateMasaKerja = (tglSkCpns) => {
    if (!tglSkCpns) return "-";

    // Parse date from format DD-MM-YYYY
    const [day, month, year] = tglSkCpns.split("-");
    const startDate = new Date(year, month - 1, day);
    const currentDate = new Date();

    let years = currentDate.getFullYear() - startDate.getFullYear();
    let months = currentDate.getMonth() - startDate.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    return `${years} tahun ${months} bulan`;
  };

  // Calculate age from tglLahir
  const calculateAge = (tglLahir) => {
    if (!tglLahir) return "-";

    const [day, month, year] = tglLahir.split("-");
    const birthDate = new Date(year, month - 1, day);
    const currentDate = new Date();

    let age = currentDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = currentDate.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && currentDate.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return `${age} tahun`;
  };

  // Calculate Satyalancana Karya Satya awards based on masa kerja
  const calculateSatyalancana = (tglSkCpns) => {
    if (!tglSkCpns) return [];

    const [day, month, year] = tglSkCpns.split("-");
    const startDate = new Date(year, month - 1, day);
    const currentDate = new Date();

    let years = currentDate.getFullYear() - startDate.getFullYear();
    const monthDiff = currentDate.getMonth() - startDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && currentDate.getDate() < startDate.getDate())
    ) {
      years--;
    }

    const awards = [];
    if (years >= 30) {
      awards.push({ name: "Satyalancana Karya Satya XXX", years: 30 });
    }
    if (years >= 20) {
      awards.push({ name: "Satyalancana Karya Satya XX", years: 20 });
    }
    if (years >= 10) {
      awards.push({ name: "Satyalancana Karya Satya X", years: 10 });
    }

    return awards;
  };

  useEffect(() => {
    document.title = `Detail Pegawai | SIMANTAP`;
    fetchDetailPegawai();
    // Ensure Poppins font is available for chart tooltips and labels
    const fontLinkHref =
      "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap";
    let fontLink = Array.from(
      document.head.querySelectorAll('link[rel="stylesheet"]'),
    ).find(
      (l) =>
        l.href &&
        l.href.includes("fonts.googleapis.com") &&
        l.href.includes("Poppins"),
    );
    if (!fontLink) {
      fontLink = document.createElement("link");
      fontLink.rel = "stylesheet";
      fontLink.href = fontLinkHref;
      fontLink.setAttribute("data-poppins", "true");
      document.head.appendChild(fontLink);
    }
    return () => {
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
  }, [nip]);

  const fetchDetailPegawai = async () => {
    try {
      // Fetch pegawai data via apiService helper
      const pegawai = await fetchPegawaiByNip(nip, true);
      if (!pegawai) throw new Error("Data tidak tersedia");
      setPegawaiData(pegawai);
      setLoadingProfile(false);

      // Load indikator definitions (used to compute per-indikator sums)
      fetchIndikators()
        .then((inds) => {
          setIndikators(inds || []);
          setLoadingIndicators(false);
        })
        .catch((err) => {
          console.error("Could not load indikators:", err);
          setIndikators([]);
          setLoadingIndicators(false);
        });

      // Fetch standar MSK based on jenis jabatan (use apiService helper)
      if (pegawai.jenis_jabatan_id) {
        fetchStandarKompetensiMSK(pegawai.jenis_jabatan_id)
          .then((msk) => {
            setStandarMSK(msk || []);
            setLoadingCompetency(false);
          })
          .catch((err) => {
            console.error("Could not load standar MSK:", err);
            setStandarMSK([]);
            setLoadingCompetency(false);
          });
      } else {
        setLoadingCompetency(false);
      }
    } catch (error) {
      console.error("Error fetching pegawai detail:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "Gagal mengambil data pegawai",
      });
      navigate("/daftar-talenta");
    }
  };

  // Process MSK data for radar chart
  const processCompetencyData = () => {
    if (!pegawaiData?.penilaian) return null;

    // Helper: get standar value for a subindikator id from standarMSK which
    // may be an object keyed by id or an array of entries { subindikator_id, standar }
    const getStandarForSub = (subId) => {
      if (!standarMSK) return 0;
      // If standarMSK is an array (as in InputPenilaian), find by subindikator_id
      if (Array.isArray(standarMSK)) {
        const found = standarMSK.find(
          (s) =>
            s.subindikator_id === subId ||
            String(s.subindikator_id) === String(subId),
        );
        return (
          (found &&
            (found.standar || found.standar === 0
              ? Number(found.standar)
              : 0)) ||
          0
        );
      }
      // If it's an object, try keyed access
      if (typeof standarMSK === "object") {
        return Number(standarMSK[subId] ?? standarMSK[String(subId)] ?? 0) || 0;
      }
      return 0;
    };

    // Find the indikator entry that represents MSK competencies from fetched indikator list
    const mskIndikator = indikators.find((it) => {
      const name = (it.indikator || it.penilaian || "")
        .toString()
        .toLowerCase();
      return (
        name.includes("kompetensi manajerial") ||
        name.includes("msk") ||
        name.includes("manajerial")
      );
    });

    const subs =
      mskIndikator && Array.isArray(mskIndikator.sub_indikators)
        ? mskIndikator.sub_indikators
        : [];

    // Fallback: if no fetched MSK, try to use existing standarMSK keys if structured differently
    if (subs.length === 0) {
      // Try to derive labels from standarMSK if it's an object with keys
      if (
        standarMSK &&
        typeof standarMSK === "object" &&
        !Array.isArray(standarMSK)
      ) {
        const keys = Object.keys(standarMSK).slice(0, 50);
        const labels = [];
        const standardValues = [];
        const actualValues = [];
        keys.forEach((k) => {
          if (pegawaiData.penilaian[k]) {
            labels.push(k);
            actualValues.push(pegawaiData.penilaian[k]?.nilai || 0);
            standardValues.push(Number(standarMSK[k] || 0));
          }
        });
        const codes = labels.map((l, i) => `MSK-${i + 1}`);
        const legend = labels.map((l, i) => ({ code: codes[i], label: l }));
        return { labels, codes, standardValues, actualValues, legend };
      }
      return null;
    }

    const labels = [];
    const standardValues = [];
    const actualValues = [];

    subs.forEach((s) => {
      const subId = s.id;
      // Only include if there's a penilaian entry for this subindikator
      if (pegawaiData.penilaian && pegawaiData.penilaian[subId] !== undefined) {
        labels.push(s.subindikator || s.nama || s.name || String(subId));
        const actual =
          pegawaiData.penilaian[subId]?.nilai ??
          pegawaiData.penilaian[subId]?.hasil ??
          0;
        actualValues.push(Number(actual) || 0);
        standardValues.push(getStandarForSub(subId) || 0);
      }
    });

    const codes = labels.map((l, i) => `MSK-${i + 1}`);
    const legend = labels.map((l, i) => ({ code: codes[i], label: l }));
    return { labels, codes, standardValues, actualValues, legend };
  };

  // Process Potensi Talenta data for radar chart
  const processPotensiTalentaData = () => {
    if (!pegawaiData?.penilaian) return null;

    // Find the indikator entry for Potensi Talenta
    const potensiIndikator = indikators.find((it) => {
      const name = (it.indikator || it.penilaian || "")
        .toString()
        .toLowerCase();
      return (
        name.includes("potensi talenta") ||
        name.includes("penilaian potensi talenta")
      );
    });

    if (!potensiIndikator) return null;

    const subs =
      potensiIndikator && Array.isArray(potensiIndikator.sub_indikators)
        ? potensiIndikator.sub_indikators
        : [];

    if (subs.length === 0) return null;

    const labels = [];
    const actualValues = [];

    subs.forEach((s) => {
      const subId = s.id;
      // Only include if there's a penilaian entry for this subindikator
      if (pegawaiData.penilaian && pegawaiData.penilaian[subId] !== undefined) {
        labels.push(s.subindikator || s.nama || s.name || String(subId));
        const actual =
          pegawaiData.penilaian[subId]?.nilai ??
          pegawaiData.penilaian[subId]?.hasil ??
          0;
        actualValues.push(Number(actual) || 0);
      }
    });

    if (labels.length === 0) return null;

    const codes = labels.map((l, i) => `PT-${i + 1}`);
    const legend = labels.map((l, i) => ({ code: codes[i], label: l }));
    return { labels, codes, actualValues, legend };
  };

  // Calculate indicator scores (sum of sub-indicators)
  const calculateIndicatorScores = () => {
    if (!pegawaiData?.penilaian) return { potensial: [], kinerja: [] };

    // Use fetched indikators to compute sums per indikator
    const potensialList = indikators
      .filter((it) => (it.penilaian || "").toLowerCase() === "potensial")
      .map((indikator) => {
        const subs = Array.isArray(indikator.sub_indikators)
          ? indikator.sub_indikators
          : [];
        const nilaiSum = subs.reduce((s, sub) => {
          const v = pegawaiData.penilaian?.[sub.id]?.nilai;
          return s + (parseFloat(v) || 0);
        }, 0);
        const hasilSum = subs.reduce((s, sub) => {
          const v = pegawaiData.penilaian?.[sub.id]?.hasil;
          return s + (parseFloat(v) || 0);
        }, 0);
        return {
          name: indikator.indikator || indikator.penilaian || "-",
          nilai: nilaiSum,
          hasil: hasilSum,
        };
      });

    const kinerjaList = indikators
      .filter((it) => (it.penilaian || "").toLowerCase() === "kinerja")
      .map((indikator) => {
        const subs = Array.isArray(indikator.sub_indikators)
          ? indikator.sub_indikators
          : [];
        const nilaiSum = subs.reduce((s, sub) => {
          const v = pegawaiData.penilaian?.[sub.id]?.nilai;
          return s + (parseFloat(v) || 0);
        }, 0);
        const hasilSum = subs.reduce((s, sub) => {
          const v = pegawaiData.penilaian?.[sub.id]?.hasil;
          return s + (parseFloat(v) || 0);
        }, 0);
        return {
          name: indikator.indikator || indikator.penilaian || "-",
          nilai: nilaiSum,
          hasil: hasilSum,
        };
      });

    return { potensial: potensialList, kinerja: kinerjaList };
  };

  // Accordion state for indicators
  const [expandedPotensial, setExpandedPotensial] = useState({});
  const [expandedKinerja, setExpandedKinerja] = useState({});
  const [activeRadarTab, setActiveRadarTab] = useState("msk"); // 'msk' or 'potensi'

  const togglePotensial = (name) => {
    setExpandedPotensial((p) => ({ ...p, [name]: !p[name] }));
  };

  const toggleKinerja = (name) => {
    setExpandedKinerja((p) => ({ ...p, [name]: !p[name] }));
  };

  const getSubValue = (subId) => {
    const stored = pegawaiData.penilaian?.[subId];
    if (stored === undefined || stored === null)
      return { nilai: null, hasil: null };
    if (typeof stored === "object") {
      return { nilai: stored.nilai ?? null, hasil: stored.hasil ?? null };
    }
    // legacy scalar
    return { nilai: Number(stored) || null, hasil: Number(stored) || null };
  };

  // Get quadrant data
  const getQuadrantData = () => {
    if (!pegawaiData) return null;

    const nilaiPotensial = pegawaiData.nilai_potensial || 0;
    const nilaiKinerja = pegawaiData.nilai_kinerja || 0;
    // Determine quadrant using kotak config logic (same as Dashboard)
    const cfg = loadKotakConfig();
    const kotakId = computeQuadrantDynamic(nilaiPotensial, nilaiKinerja);
    const kotak =
      cfg && Array.isArray(cfg.kotak)
        ? cfg.kotak.find((k) => Number(k.id) === Number(kotakId))
        : null;

    const quadrantLabel = kotak ? `Kotak ${kotak.id}` : `Kotak ${kotakId}`;
    const color = kotak?.warna || PRIMARY_COLORS.blue;
    const kategori = kotak?.kategori || "";

    return {
      quadrant: quadrantLabel,
      color,
      kategori,
      nilaiPotensial,
      nilaiKinerja,
    };
  };

  // Format date to Indonesian long form, e.g. "1 Januari 2025"
  const formatDateIndo = (dateStr) => {
    if (!dateStr) return "-";
    const monthNames = [
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

    // Try split by common delimiters
    const parts = String(dateStr)
      .trim()
      .split(/[-/\\sT:]+/);
    let day, month, year;

    if (parts.length >= 3) {
      // detect ISO-like YYYY-MM-DD
      if (parts[0].length === 4) {
        year = parts[0];
        month = parts[1];
        day = parts[2];
      } else {
        // assume DD-MM-YYYY or DD/MM/YYYY
        day = parts[0];
        month = parts[1];
        year = parts[2];
      }
    } else {
      // fallback to Date parse
      const d = new Date(dateStr);
      if (isNaN(d)) return dateStr;
      day = d.getDate();
      month = d.getMonth() + 1;
      year = d.getFullYear();
    }

    const dNum = Number(day);
    const mNum = Number(month);
    const yNum = Number(year);
    if (!dNum || !mNum || !yNum) return dateStr;

    return `${dNum} ${monthNames[mNum - 1]} ${yNum}`;
  };

  const handleBack = () => {
    navigate("/daftar-talenta");
  };

  const jsonData = pegawaiData?.json || {};
  const quadrantData = pegawaiData ? getQuadrantData() : null;
  const competencyData = pegawaiData ? processCompetencyData() : null;
  const kotakConfig = loadKotakConfig();
  const potensiTalentaData = pegawaiData ? processPotensiTalentaData() : null;
  const activeChartData =
    activeRadarTab === "msk" ? competencyData : potensiTalentaData;
  const totalLegend = activeChartData ? activeChartData.legend.length : 0;
  const splitIndex = Math.ceil(totalLegend / 2);
  const legendLeft = activeChartData
    ? activeChartData.legend.slice(0, splitIndex)
    : [];
  const legendRight = activeChartData
    ? activeChartData.legend.slice(splitIndex)
    : [];
  const indicatorScores = pegawaiData
    ? calculateIndicatorScores()
    : { potensial: [], kinerja: [] };
  const satyalancanaAwards = jsonData?.tglSkCpns
    ? calculateSatyalancana(jsonData.tglSkCpns)
    : [];

  // Chart configurations
  const radarChartData = activeChartData
    ? {
        labels: activeChartData.codes || activeChartData.labels,
        datasets:
          activeRadarTab === "msk"
            ? [
                {
                  label: "Kompetensi Pegawai",
                  data: activeChartData.actualValues,
                  fill: true,
                  backgroundColor: "rgba(255, 99, 132, 0.2)",
                  borderColor: "rgb(255, 99, 132)",
                  pointBackgroundColor: "rgb(255, 99, 132)",
                  pointBorderColor: "#fff",
                  pointHoverBackgroundColor: "#fff",
                  pointHoverBorderColor: "rgb(255, 99, 132)",
                },
                {
                  label: "Standar Kompetensi",
                  data: activeChartData.standardValues,
                  fill: true,
                  backgroundColor: "rgba(54, 162, 235, 0.2)",
                  borderColor: "rgba(59, 130, 246, 1)",
                  pointBackgroundColor: "rgba(59, 130, 246, 1)",
                  pointBorderColor: "#fff",
                  pointHoverBackgroundColor: "#fff",
                  pointHoverBorderColor: "rgba(59, 130, 246, 1)",
                },
              ]
            : [
                {
                  label: "Nilai Potensi Pegawai",
                  data: activeChartData.actualValues,
                  fill: true,
                  backgroundColor: "rgba(34, 197, 94, 0.2)",
                  borderColor: "rgb(34, 197, 94)",
                  pointBackgroundColor: "rgb(34, 197, 94)",
                  pointBorderColor: "#fff",
                  pointHoverBackgroundColor: "#fff",
                  pointHoverBorderColor: "rgb(34, 197, 94)",
                },
              ],
      }
    : null;

  // Calculate dynamic max value for radar chart
  const getRadarMaxValue = () => {
    if (activeRadarTab === "msk" && competencyData?.standardValues) {
      const maxStandard = Math.max(...competencyData.standardValues, 0);
      return Math.ceil(maxStandard) + 1;
    }
    // For potensi talenta, use hardcoded 6
    return 6;
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.5, // 1 = square; increase to 1.2 for taller chart
    // add symmetric horizontal padding so long point labels don't shift the chart
    layout: {
      padding: { top: 0, bottom: 0, left: 0, right: 48 },
    },
    scales: {
      r: {
        beginAtZero: true,
        max: getRadarMaxValue(),
        ticks: {
          stepSize: 1,
          color: "#6B7280",
        },
        grid: {
          color: "#E5E7EB",
        },
        pointLabels: {
          color: "#374151",
          font: {
            size: 13,
            weight: "bold",
          },
          padding: 8,
        },
      },
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          padding: 16,
          font: {
            size: 13,
          },
        },
      },
    },
  };

  // Calculate doughnut percentage based on kotak number (e.g., Kotak 9 = 100%, Kotak 8 = 88.89%, etc.)
  const kotakNumber =
    parseInt(quadrantData?.quadrant?.replace(/\D/g, "") || "0") || 0;
  const kotakPercentage = (kotakNumber / 9) * 100;

  const doughnutData = {
    labels: ["Posisi Kotak", "Gap"],
    datasets: [
      {
        data: [kotakPercentage, 100 - kotakPercentage],
        backgroundColor: [
          quadrantData?.color || PRIMARY_COLORS.blue,
          "#E5E7EB",
        ],
        borderWidth: 0,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
    },
  };

  // Settings for 9-box scatter (reuse kotak config)
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  const computeCentersFromConfig = () => {
    const cfg = loadKotakConfig();
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

  const backgroundPlugin = {
    id: "detailBackgroundPlugin",
    beforeDatasetsDraw: (chart) => {
      const {
        ctx,
        chartArea: { left, right, top, bottom },
        scales: { x, y },
      } = chart;
      const cfg = loadKotakConfig();
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

      (cfg.kotak || []).forEach((kotak) => {
        const x1 = x.getPixelForValue(kotak.potensialRange.min === 0 ? kotak.potensialRange.min : kotak.potensialRange.min-1);
        const x2 = x.getPixelForValue(kotak.potensialRange.max);
        const y1 = y.getPixelForValue(kotak.kinerjaRange.min === 0 ? kotak.kinerjaRange.min : kotak.kinerjaRange.min-1);
        const y2 = y.getPixelForValue(kotak.kinerjaRange.max);

        ctx.fillStyle = kotak.warna;
        ctx.globalAlpha = 0.12;
        ctx.fillRect(x1, y2, x2 - x1, y1 - y2);
      });

      ctx.globalAlpha = 1;

      // Draw grid lines
      ctx.strokeStyle = "#9CA3AF";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      [p[0].max, p[1].max].forEach((val) => {
        const xPos = x.getPixelForValue(val);
        ctx.beginPath();
        ctx.moveTo(xPos, top);
        ctx.lineTo(xPos, bottom);
        ctx.stroke();
      });
      [k[0].max, k[1].max].forEach((val) => {
        const yPos = y.getPixelForValue(val);
        ctx.beginPath();
        ctx.moveTo(left, yPos);
        ctx.lineTo(right, yPos);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // labels
      ctx.font = "bold 18px 'Poppins', sans-serif";
      ctx.fillStyle = isDark ? "#E5E7EB" : "#374151";
      ctx.globalAlpha = 0.28;
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

  const scatterData = {
    datasets: [
      {
        label: "Pegawai",
        data: [
          {
            x: quadrantData?.nilaiPotensial ?? 0,
            y: quadrantData?.nilaiKinerja ?? 0,
            name: pegawaiData?.nama,
          },
        ],
        backgroundColor: "#3085d6",
        borderColor: "#FFFFFF",
        borderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
      },
    ],
  };

  const scatterOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
        titleColor: isDark ? "#F3F4F6" : "#1F2937",
        bodyColor: isDark ? "#F3F4F6" : "#1F2937",
        borderColor: isDark ? "#374151" : "#E5E7EB",
        borderWidth: 1,
        padding: 12,
        displayColors: false,
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
        callbacks: {
          title: () => "",
          label: (ctx) => {
            const d = ctx.raw || ctx;
            return `${d.name || "Pegawai"}`;
          },
          afterLabel: (ctx) => {
            const d = ctx.raw || ctx;
            const kotak = computeQuadrantDynamic(d.x, d.y);
            return [`Potensial: ${d.x}`, `Kinerja: ${d.y}`, `Kotak: ${kotak}`];
          },
        },
      },
    },
    scales: {
      x: { type: "linear", min: 0, max: 100, ticks: { color: "#6B7280" } },
      y: { type: "linear", min: 0, max: 100, ticks: { color: "#6B7280" } },
    },
  };

  return (
    <div className="mx-auto p-4 md:p-6 lg:p-8">
      {/* Breadcrumb */}
      <Breadcrumb />

      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
          Detail Pegawai
        </h1>
        <p className="mt-2 text-sm md:text-base text-gray-600 dark:text-gray-300">
          Informasi lengkap profil dan penilaian pegawai
        </p>
      </div>

      {/* Back Button */}
      {/* <div className="mb-4">
          <IconButton
            onClick={handleBack}
            variant="secondary"
            size="lg"
            title="Kembali"
          >
            <i className="fas fa-arrow-left mr-2" /> Kembali
          </IconButton>
        </div> */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="md:col-span-2">
          {/* Profile Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden h-full">
            {/* Header with gradient */}
            <div
              className="px-6 py-4"
              style={{ backgroundColor: PRIMARY_COLORS.blue }}
            >
              <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                <i className="fas fa-user"></i>
                Profil Pegawai
              </h1>
            </div>
            {loadingProfile ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                  <p className="mt-3 text-gray-600 dark:text-gray-300">
                    Memuat profil...
                  </p>
                </div>
              </div>
            ) : !pegawaiData ? (
              <div className="flex items-center justify-center py-20">
                <p className="text-gray-500 dark:text-gray-400">
                  Data tidak tersedia
                </p>
              </div>
            ) : (
              <div className="px-4 md:px-8 pb-8">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mt-4 md:mt-6">
                  {/* Avatar */}
                  <div className="relative">
                    {pegawaiData.avatar ? (
                      <img
                        src={pegawaiData.avatar}
                        alt={pegawaiData.nama}
                        className="w-28 h-28 md:w-32 md:h-32 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-md"
                      />
                    ) : (
                      <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-4xl border-4 border-white dark:border-gray-800 shadow-md">
                        {pegawaiData.nama?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                    )}
                  </div>

                  {/* Basic Info */}
                  <div className="flex-1 text-center md:text-left">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                      {pegawaiData.nama}
                    </h2>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
                      <span className="px-3 py-1 bg-[#E7F3FF] dark:bg-blue-900 text-[#1e40af] dark:text-blue-200 rounded-full text-sm font-medium">
                        <i className="fas fa-id-card mr-1"></i>
                        {pegawaiData.nip}
                      </span>
                      <span className="px-3 py-1 bg-[#E9F7EF] dark:bg-green-900 text-[#166534] dark:text-green-200 rounded-full text-sm font-medium">
                        <i className="fas fa-briefcase mr-1"></i>
                        {pegawaiData.golongan}
                      </span>
                    </div>
                    <div className="space-y-2 text-gray-600 dark:text-gray-300">
                      <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        {pegawaiData.jabatan}
                      </p>
                      <p className="text-sm">
                        <i className="fas fa-building mr-2 text-gray-400"></i>
                        {pegawaiData.unit_kerja}
                      </p>
                      {pegawaiData.email && (
                        <p className="text-sm">
                          <i className="fas fa-envelope mr-2 text-gray-400"></i>
                          {pegawaiData.email}
                        </p>
                      )}
                      {/* Modal buttons */}
                      <div className="flex gap-2 mt-3">
                        <IconButton
                          onClick={() => setShowPersonalModal(true)}
                          variant="primary"
                          size="lg"
                          title="Lihat Informasi Personal"
                        >
                          <i className="fas fa-user mr-2"></i>
                          Info Personal
                        </IconButton>
                        <IconButton
                          onClick={() => setShowEmploymentModal(true)}
                          variant="success"
                          size="lg"
                          title="Lihat Informasi Kepegawaian"
                        >
                          <i className="fas fa-briefcase mr-2"></i>
                          Info Kepegawaian
                        </IconButton>
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="flex md:flex-col gap-4 mt-4 md:mt-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg p-4 text-center min-w-[120px]">
                      <div className="text-md text-blue-700 dark:text-blue-400 mt-1 font-medium">
                        Nilai Potensial
                      </div>
                      <div
                        className="text-3xl font-bold dark:text-blue-300"
                        style={{ color: PRIMARY_COLORS.blue }}
                      >
                        {quadrantData?.nilaiPotensial?.toFixed(1) || "0.0"}
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 rounded-lg p-4 text-center min-w-[120px]">
                      <div className="text-md text-green-700 dark:text-green-400 mt-1 font-medium">
                        Nilai Kinerja
                      </div>
                      <div className="text-3xl font-bold text-green-600 dark:text-green-300">
                        {quadrantData?.nilaiKinerja?.toFixed(1) || "0.0"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quadrant Position */}
        <div className="md:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-full">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <i
                className="fas fa-chart-pie"
                style={{ color: PRIMARY_COLORS.blue }}
              ></i>
              Posisi Kotak Talenta
            </h3>
            {loadingProfile ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                  <p className="mt-3 text-gray-600 dark:text-gray-300">
                    Memuat data kotak...
                  </p>
                </div>
              </div>
            ) : !pegawaiData || !quadrantData ? (
              <div className="flex items-center justify-center py-20">
                <p className="text-gray-500 dark:text-gray-400">
                  Data tidak tersedia
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="relative w-48 h-48 mb-4">
                  <Doughnut data={doughnutData} options={doughnutOptions} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div
                      className="text-3xl font-bold"
                      style={{
                        color: quadrantData?.color || PRIMARY_COLORS.blue,
                      }}
                    >
                      {quadrantData?.quadrant || "-"}
                    </div>
                  </div>
                </div>
                <div className="w-full space-y-2">
                  <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <span className="text-md font-medium text-gray-700 dark:text-gray-300">
                      {quadrantData?.kategori || "-"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Competency Radar Chart with Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-full">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <i
              className="fas fa-chart-bar"
              style={{ color: PRIMARY_COLORS.blue }}
            ></i>
            Penilaian Kompetensi dan Potensi
          </h3>
          {loadingCompetency ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                <p className="mt-3 text-gray-600 dark:text-gray-300">
                  Memuat data kompetensi...
                </p>
              </div>
            </div>
          ) : !(competencyData || potensiTalentaData) ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-gray-500 dark:text-gray-400">
                Data kompetensi tidak tersedia
              </p>
            </div>
          ) : (
            <>
              {/* Tab Navigation */}
              <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
                {competencyData && (
                  <button
                    onClick={() => setActiveRadarTab("msk")}
                    className={`cursor-pointer px-4 py-2 font-medium text-sm transition-colors relative ${
                      activeRadarTab === "msk"
                        ? "dark:text-blue-400"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    }`}
                    style={
                      activeRadarTab === "msk"
                        ? { color: PRIMARY_COLORS.blue }
                        : {}
                    }
                  >
                    Kompetensi MSK
                    {activeRadarTab === "msk" && (
                      <div
                        className="absolute bottom-0 left-0 right-0 h-0.5"
                        style={{ backgroundColor: PRIMARY_COLORS.blue }}
                      ></div>
                    )}
                  </button>
                )}
                {potensiTalentaData && (
                  <button
                    onClick={() => setActiveRadarTab("potensi")}
                    className={`cursor-pointer px-4 py-2 font-medium text-sm transition-colors relative ${
                      activeRadarTab === "potensi"
                        ? "dark:text-blue-400"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    }`}
                    style={
                      activeRadarTab === "potensi"
                        ? { color: PRIMARY_COLORS.blue }
                        : {}
                    }
                  >
                    Potensi Talenta
                    {activeRadarTab === "potensi" && (
                      <div
                        className="absolute bottom-0 left-0 right-0 h-0.5"
                        style={{ backgroundColor: PRIMARY_COLORS.blue }}
                      ></div>
                    )}
                  </button>
                )}
              </div>

              {/* Chart */}
              {radarChartData && (
                <div className="flex items-center justify-center">
                  <Radar data={radarChartData} options={radarOptions} />
                </div>
              )}

              {/* Keterangan Subindikator */}
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg top-2 shadow-sm">
                <h3 className="font-semibold text-gray-800 dark:text-white mb-2 text-md">
                  {activeRadarTab === "msk"
                    ? "Keterangan Subindikator Kompetensi"
                    : "Keterangan Subindikator Potensi Talenta"}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-md">
                  <div className="space-y-2">
                    {legendLeft.map((it) => (
                      <div key={it.code} className="flex items-start gap-3">
                        <div className="text-gray-800 dark:text-gray-200 w-16 font-bold">
                          {it.code}
                        </div>
                        <div className="flex-1 text-gray-500 dark:text-gray-400">
                          {it.label}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {legendRight.map((it) => (
                      <div key={it.code} className="flex items-start gap-3">
                        <div className="text-gray-800 dark:text-gray-200 w-16 font-bold">
                          {it.code}
                        </div>
                        <div className="flex-1 text-gray-500 dark:text-gray-400">
                          {it.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        {/* Competency Radar Chart (right column) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-full">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <i className="fas fa-th" style={{ color: PRIMARY_COLORS.blue }}></i>
            Matriks 9 Kotak - Potensial vs Kinerja
          </h3>
          {loadingProfile ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                <p className="mt-3 text-gray-600 dark:text-gray-300">
                  Memuat matriks...
                </p>
              </div>
            </div>
          ) : !competencyData ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-gray-500 dark:text-gray-400">
                Data matriks tidak tersedia
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center">
                {/* Y-axis label (outside chart) */}
                <div className="flex items-center pr-3" style={{ width: 28 }}>
                  <div className="transform -rotate-90 origin-center text-sm font-semibold text-gray-600 dark:text-gray-300">
                    Kinerja
                  </div>
                </div>

                {/* Chart area + X-axis label */}
                <div className="flex-1 flex flex-col">
                  <div
                    style={
                      isMobile
                        ? { width: "100%", aspectRatio: "1" }
                        : { height: "325px", width: "100%" }
                    }
                  >
                    <Scatter
                      data={scatterData}
                      options={scatterOptions}
                      plugins={[backgroundPlugin]}
                    />
                  </div>
                  <div className="text-center mt-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
                    Potensial
                  </div>
                </div>
              </div>

              {/* Keterangan Warna Kotak */}
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg top-2 shadow-sm">
                <h3 className="font-semibold text-gray-800 dark:text-white mb-2 text-md">
                  Keterangan Warna Kotak
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-md">
                  {(!isMobile
                    ? [1, 6, 2, 7, 3, 8, 4, 9, 5]
                    : [1, 2, 3, 4, 5, 6, 7, 8, 9]
                  ).map((q) => {
                    const kotak = kotakConfig?.kotak.find((k) => k.id === q);
                    const warna = kotak?.warna || PRIMARY_COLORS.blue;
                    const kategori = kotak?.kategori;
                    return (
                      <div key={q} className="flex items-start gap-2">
                        <div
                          className="flex-shrink-0 w-4 h-4 rounded mt-0.5"
                          style={{ backgroundColor: warna, opacity: 0.5 }}
                        ></div>
                        <div className="flex-1 min-w-0">
                          {kategori && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {kategori}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Indicator Scores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Potensial Indicators */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <i
              className="fas fa-star"
              style={{ color: PRIMARY_COLORS.blue }}
            ></i>
            Nilai Potensial per Indikator
          </h3>
          {loadingIndicators ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                <p className="mt-3 text-gray-600 dark:text-gray-300">
                  Memuat indikator...
                </p>
              </div>
            </div>
          ) : indicatorScores.potensial.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-gray-500 dark:text-gray-400">
                Data indikator tidak tersedia
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {indicatorScores.potensial.map((ind, idx) => {
                const isOpen = !!expandedPotensial[ind.name];
                const indikatorObj = indikators.find(
                  (it) =>
                    (it.indikator || it.penilaian || "").toLowerCase() ===
                    (ind.name || "").toLowerCase(),
                );
                const subs = indikatorObj?.sub_indikators || [];
                return (
                  <div
                    key={idx}
                    className="bg-blue-50 dark:bg-blue-900/10 rounded"
                  >
                    <button
                      type="button"
                      onClick={() => togglePotensial(ind.name)}
                      className="w-full text-left flex items-center justify-between p-2 px-3 hover:bg-[#E7F3FF] dark:hover:bg-blue-900/20 rounded cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <i
                          className={`fas fa-chevron-right transform transition-transform duration-200 ${
                            isOpen ? "rotate-90" : ""
                          }`}
                          style={{ color: PRIMARY_COLORS.blue }}
                        ></i>
                        <span className="text-md text-gray-700 dark:text-gray-300">
                          {ind.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div
                            className="text-md font-bold dark:text-blue-400"
                            style={{ color: PRIMARY_COLORS.blue }}
                          >
                            {(Number(ind.hasil) || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </button>

                    <div
                      className={`overflow-hidden transition-[max-height,opacity] duration-300 ${
                        isOpen ? "max-h-128 opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="p-2 pl-8 space-y-1">
                        {subs.length > 0 ? (
                          subs.map((s) => {
                            const val = getSubValue(s.id);
                            const display = val.hasil ?? val.nilai ?? 0;
                            return (
                              <div
                                key={s.id}
                                className="flex justify-between items-center p-1 rounded"
                              >
                                <div className="flex flex-col">
                                  <div className="text-md text-gray-700 dark:text-gray-300">
                                    {s.subindikator}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    Bobot: {s.bobot ?? "-"}%
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Nilai:{" "}
                                    {val.nilai !== null
                                      ? Number(val.nilai).toFixed(2)
                                      : "-"}
                                  </div>
                                  <div
                                    className="text-md font-medium dark:text-blue-400"
                                    style={{ color: PRIMARY_COLORS.blue }}
                                  >
                                    {val.hasil !== null
                                      ? Number(val.hasil).toFixed(2)
                                      : "-"}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-md text-gray-500 italic">
                            Tidak ada subindikator
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Kinerja Indicators */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <i className="fas fa-chart-line text-green-600"></i>
            Nilai Kinerja per Indikator
          </h3>
          {loadingIndicators ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                <p className="mt-3 text-gray-600 dark:text-gray-300">
                  Memuat indikator...
                </p>
              </div>
            </div>
          ) : indicatorScores.kinerja.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-gray-500 dark:text-gray-400">
                Data indikator tidak tersedia
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {indicatorScores.kinerja.map((ind, idx) => {
                const isOpen = !!expandedKinerja[ind.name];
                const indikatorObj = indikators.find(
                  (it) =>
                    (it.indikator || it.penilaian || "").toLowerCase() ===
                    (ind.name || "").toLowerCase(),
                );
                const subs = indikatorObj?.sub_indikators || [];
                return (
                  <div
                    key={idx}
                    className="bg-green-50 dark:bg-green-900/10 rounded"
                  >
                    <button
                      type="button"
                      onClick={() => toggleKinerja(ind.name)}
                      className="w-full text-left flex items-center justify-between p-2 px-3 hover:bg-[#E9F7EF] dark:hover:bg-green-900/20 rounded cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <i
                          className={`fas fa-chevron-right text-green-600 transform transition-transform duration-200 ${
                            isOpen ? "rotate-90" : ""
                          }`}
                        ></i>
                        <span className="text-md text-gray-700 dark:text-gray-300">
                          {ind.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-md font-bold text-green-600 dark:text-green-400">
                            {(Number(ind.hasil) || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </button>

                    <div
                      className={`overflow-hidden transition-[max-height,opacity] duration-300 ${
                        isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="p-2 pl-8 space-y-1">
                        {subs.length > 0 ? (
                          subs.map((s) => {
                            const val = getSubValue(s.id);
                            const display = val.hasil ?? val.nilai ?? 0;
                            return (
                              <div
                                key={s.id}
                                className="flex justify-between items-center p-1 rounded"
                              >
                                <div className="flex flex-col">
                                  <div className="text-md text-gray-700 dark:text-gray-300">
                                    {s.subindikator}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    Bobot: {s.bobot ?? "-"}%
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Nilai:{" "}
                                    {val.nilai !== null
                                      ? Number(val.nilai).toFixed(2)
                                      : "-"}
                                  </div>
                                  <div className="text-md font-medium text-green-600 dark:text-green-400">
                                    {val.hasil !== null
                                      ? Number(val.hasil).toFixed(2)
                                      : "-"}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-md text-gray-500 italic">
                            Tidak ada subindikator
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Personal Information Modal */}
      {showPersonalModal && (
        <PersonalInfoModal
          isOpen={showPersonalModal}
          onClose={() => setShowPersonalModal(false)}
          jsonData={jsonData}
          pegawaiData={pegawaiData}
          calculateAge={calculateAge}
          formatDateIndo={formatDateIndo}
        />
      )}

      {/* Employment Information Modal */}
      {showEmploymentModal && (
        <EmploymentInfoModal
          isOpen={showEmploymentModal}
          onClose={() => setShowEmploymentModal(false)}
          jsonData={jsonData}
          calculateMasaKerja={calculateMasaKerja}
          formatDateIndo={formatDateIndo}
        />
      )}

      {/* History Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pendidikan Formal */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <i className="fas fa-graduation-cap text-purple-600"></i>
            Riwayat Pendidikan Formal
          </h3>
          {loadingProfile ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                <p className="mt-3 text-gray-600 dark:text-gray-300 text-sm">
                  Memuat riwayat...
                </p>
              </div>
            </div>
          ) : !pegawaiData || !jsonData ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-gray-500 dark:text-gray-400">
                Data tidak tersedia
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <HistoryCard
                title={jsonData.pendidikanTerakhirNama}
                subtitle={`Lulus: ${
                  jsonData.tahunLulus
                    ? formatDateIndo(jsonData.tahunLulus)
                    : "-"
                }`}
                icon="graduation-cap"
                color="purple"
              />
            </div>
          )}
        </div>

        {/* Penghargaan */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <i className="fas fa-trophy text-yellow-600"></i>
            Riwayat Penghargaan
          </h3>
          {loadingProfile ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
                <p className="mt-3 text-gray-600 dark:text-gray-300 text-sm">
                  Memuat penghargaan...
                </p>
              </div>
            </div>
          ) : !pegawaiData || !jsonData ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-gray-500 dark:text-gray-400">
                Data tidak tersedia
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {satyalancanaAwards.length > 0 ? (
                satyalancanaAwards.map((award, idx) => {
                  let c = "yellow";
                  if (award.name && award.name.includes("XXX")) c = "gold";
                  else if (award.name && award.name.includes("XX"))
                    c = "silver";
                  else if (award.name && award.name.includes("X")) c = "bronze";

                  return (
                    <HistoryCard
                      key={idx}
                      title={award.name}
                      subtitle={`${award.years} tahun masa kerja`}
                      icon="medal"
                      color={c}
                    />
                  );
                })
              ) : (
                <p className="text-md text-gray-500 dark:text-gray-400 italic">
                  Belum memenuhi syarat penghargaan
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Modal Components
const PersonalInfoModal = ({
  isOpen,
  onClose,
  jsonData,
  pegawaiData,
  calculateAge,
  formatDateIndo,
}) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ease-out"
        onClick={onClose}
        style={{ animation: "fadeIn 0.3s ease-out" }}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-lg pointer-events-auto overflow-y-auto shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <i
                  className="fas fa-user"
                  style={{ color: PRIMARY_COLORS.blue }}
                ></i>
                Informasi Personal
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Data pribadi pegawai
              </p>
            </div>
            <button
              onClick={onClose}
              className="cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 hover:scale-110"
              aria-label="Close"
            >
              <i className="fas fa-times text-xl text-gray-600 dark:text-gray-300"></i>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow
                label="Jenis Jabatan"
                value={pegawaiData.jenis_jabatan}
              />
              <InfoRow
                label="Jenis Kelamin"
                value={
                  jsonData.jenisKelamin === "M" ? "Laki-laki" : "Perempuan"
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow
                label="Tempat, Tanggal Lahir"
                value={`${jsonData.tempatLahir}, ${formatDateIndo(jsonData.tglLahir)}`}
              />
              <InfoRow label="Usia" value={calculateAge(jsonData.tglLahir)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow label="Agama" value={jsonData.agama} />
              <InfoRow
                label="Status Perkawinan"
                value={jsonData.statusPerkawinan}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow label="No. Telepon" value={jsonData.noTelp} />
              <InfoRow label="No. HP" value={jsonData.noHp} />
            </div>
            <InfoRow label="Alamat" value={jsonData.alamat} />
          </div>
        </div>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
};

const EmploymentInfoModal = ({
  isOpen,
  onClose,
  jsonData,
  calculateMasaKerja,
  formatDateIndo,
}) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ease-out"
        onClick={onClose}
        style={{ animation: "fadeIn 0.3s ease-out" }}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-lg pointer-events-auto overflow-y-auto shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <i
                  className="fas fa-briefcase"
                  style={{ color: PRIMARY_COLORS.blue }}
                ></i>
                Informasi Kepegawaian
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Data kepegawaian
              </p>
            </div>
            <button
              onClick={onClose}
              className=" cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 hover:scale-110"
              aria-label="Close"
            >
              <i className="fas fa-times text-xl text-gray-600 dark:text-gray-300"></i>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow label="NIP Lama" value={jsonData.nipLama} />
              <InfoRow label="NIP Baru" value={jsonData.nipBaru} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow
                label="Kedudukan PNS"
                value={jsonData.kedudukanPnsNama}
              />
              <InfoRow
                label="Masa Kerja"
                value={calculateMasaKerja(jsonData.tglSkCpns)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow
                label="TMT CPNS"
                value={formatDateIndo(jsonData.tmtCpns)}
              />
              <InfoRow
                label="TMT PNS"
                value={formatDateIndo(jsonData.tmtPns)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow
                label="TMT Jabatan"
                value={formatDateIndo(jsonData.tmtJabatan)}
              />
              <InfoRow
                label="TMT Golongan"
                value={formatDateIndo(jsonData.tmtGolAkhir)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow label="Lokasi Kerja" value={jsonData.lokasiKerja} />
              <InfoRow
                label="Pendidikan Terakhir"
                value={jsonData.pendidikanTerakhirNama}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
};

// Helper Components
const InfoRow = ({ label, value }) => (
  <div className="flex flex-col items-start gap-1 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
    <span className="text-md text-gray-600 dark:text-gray-400 font-bold">
      {label}
    </span>
    <span className="text-md text-gray-900 dark:text-gray-100">
      {value || "-"}
    </span>
    <hr className="w-full border-t border-gray-200 dark:border-gray-700" />
  </div>
);

const HistoryCard = ({ title, subtitle, icon, color }) => {
  const colorClasses = {
    purple:
      "bg-[#F3E8FF] dark:bg-purple-900/30 text-[#6b21a8] dark:text-purple-400",
    yellow:
      "bg-[#FFF8E1] dark:bg-yellow-900/30 text-[#854d0e] dark:text-yellow-400",
    blue: "bg-[#E7F3FF] dark:bg-blue-900/30 dark:text-blue-400",
    green:
      "bg-[#E9F7EF] dark:bg-green-900/30 text-[#166534] dark:text-green-400",
    gold: "bg-yellow-200 dark:bg-yellow-800/30 text-yellow-800 dark:text-yellow-300",
    silver: "bg-gray-200 dark:bg-gray-800/30 text-gray-800 dark:text-gray-300",
    bronze:
      "bg-orange-200 dark:bg-orange-800/30 text-orange-800 dark:text-orange-300",
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:shadow-md transition-shadow">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses[color]}`}
      >
        <i className={`fas fa-${icon}`}></i>
      </div>
      <div className="flex-1">
        <p className="text-md font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </p>
        <p className="text-md text-gray-600 dark:text-gray-400">{subtitle}</p>
      </div>
    </div>
  );
};

export default DetailPegawai;
