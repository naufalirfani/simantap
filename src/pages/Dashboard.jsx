import { useEffect, useState, useCallback, useRef } from "react";
import { useSettings } from "../context/SettingsContext";
import { PRIMARY_COLORS } from "../config/colors";
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
import Breadcrumb from "../components/Breadcrumb";
import IconButton from "../components/IconButton";
import SearchableSelect from "../components/SearchableSelect";
import {
  fetchStatistik,
  fetchPegawaiList,
  fetchPetaJabatanTree,
  syncStatistik,
} from "../services/apiService";
import {
  loadKotakConfig,
  computeQuadrantDynamic,
} from "../services/kotakConfigService";
import Swal from "sweetalert2";
import ExcelJS from "exceljs";

// Register Chart.js components
ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  ChartTooltip,
  ChartLegend,
  Filler,
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
        document.documentElement.classList.contains("dark"),
    );
    const checkMobile = () =>
      setIsMobile(typeof window !== "undefined" && window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    // Inject small scoped CSS to suppress focus outline on Recharts SVG elements
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-dashboard-focus-fix", "true");
    styleEl.textContent = `
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

  // Statistik dari API (fallback ke data dummy saat belum ada)
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [isSyncingStatistik, setIsSyncingStatistik] = useState(false);

  const employeeStats = {
    total: 1250,
    structural: 85,
    functional: 720,
    implementer: 445,
  };

  // Fetch statistik dari API melalui service
  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoadingStats(true);
      try {
        const data = await fetchStatistik();
        if (!mounted) return;
        setStats(data || null);
      } catch (err) {
        if (!mounted) return;
        console.error("fetchStatistik error:", err);
      } finally {
        if (mounted) setLoadingStats(false);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSyncStatistik = async () => {
    const result = await Swal.fire({
      icon: "question",
      title: "Sinkronisasi Statistik",
      text: "Sinkronisasi akan mengambil data statistik terbaru dari layanan. Lanjutkan?",
      showCancelButton: true,
      confirmButtonText: "Ya",
      cancelButtonText: "Batal",
      confirmButtonColor: PRIMARY_COLORS.blue,
      cancelButtonColor: PRIMARY_COLORS.red,
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      setIsSyncingStatistik(true);
      await syncStatistik();
      await fetchStatistik().then((data) => setStats(data || null));
      Swal.fire({
        icon: "success",
        title: "Sukses",
        text: "Sinkronisasi statistik selesai",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: err.message || "Sinkronisasi statistik gagal",
        confirmButtonColor: PRIMARY_COLORS.blue,
      });
    } finally {
      setIsSyncingStatistik(false);
    }
  };

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
          key: "JPT Madya",
          level: 1,
        },
        {
          name: "Jabatan Pimpinan Tinggi Pratama",
          count: stats.total_jabatan_pimpinan_tinggi_pratama || 0,
          filterKey: "jabatan_pimpinan_tinggi_pratama",
          key: "JPT Pratama",
          level: 2,
        },
        {
          name: "Jabatan Administrator",
          count: stats.total_jabatan_administrator || 0,
          filterKey: "jabatan_administrator",
          key: "Jabatan Administrator",
          level: 3,
        },
        {
          name: "Jabatan Pengawas",
          count: stats.total_jabatan_pengawas || 0,
          filterKey: "jabatan_pengawas",
          key: "Jabatan Pengawas",
          level: 4,
        },
        {
          name: "Jabatan Fungsional Ahli Utama",
          count: stats.total_fungsional_utama || 0,
          filterKey: "fungsional_utama",
          key: "JF Ahli Utama",
          level: 2,
        },
        {
          name: "Jabatan Fungsional Ahli Madya",
          count: stats.total_fungsional_madya || 0,
          filterKey: "fungsional_madya",
          key: "JF Ahli Madya",
          level: 3,
        },
        {
          name: "Jabatan Fungsional Ahli Muda",
          count: stats.total_fungsional_muda || 0,
          filterKey: "fungsional_muda",
          key: "JF Ahli Muda",
          level: 4,
        },
        {
          name: "Jabatan Fungsional Ahli Pertama",
          count: stats.total_fungsional_pertama || 0,
          filterKey: "fungsional_pertama",
          key: "JF Ahli Pertama",
          level: 5,
        },
        {
          name: "Jabatan Fungsional Penyelia",
          count: stats.total_fungsional_penyelia || 0,
          filterKey: "fungsional_penyelia",
          key: "JF Penyelia",
          level: 4,
        },
        {
          name: "Jabatan Fungsional Mahir",
          count: stats.total_fungsional_mahir || 0,
          filterKey: "fungsional_mahir",
          key: "JF Mahir",
          level: 5,
        },
        {
          name: "Jabatan Fungsional Terampil",
          count: stats.total_fungsional_terampil || 0,
          filterKey: "fungsional_terampil",
          key: "JF Terampil",
          level: 6,
        },
        {
          name: "Jabatan Pelaksana",
          count: stats.total_pelaksana || 0,
          filterKey: "pelaksana",
          key: "Jabatan Pelaksana",
          level: 5,
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

  // Filter states untuk Unit Kerja dan Jenis Jabatan
  const [selectedUnitKerja, setSelectedUnitKerja] = useState([]);
  const [selectedJenisJabatan, setSelectedJenisJabatan] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [unitOptions, setUnitOptions] = useState([]);
  const [jenisJabatanList, setJenisJabatanList] = useState([]);
  const unitMapsRef = useRef({ nameToId: {}, parentMap: {} });
  // Guard to avoid repeatedly attempting a full fetch when there is no quadrant data
  const attemptedFullFetchRef = useRef(false);

  // Load pegawai (with penilaian) dari API untuk chart 9 Kotak
  const [quadrantData, setQuadrantData] = useState([]);
  const [quadrantLoading, setQuadrantLoading] = useState(true);

  const loadEmployees = useCallback(
    async ({ filter, kuadran = null, q, page = 1, per_page = 10 } = {}) => {
      // If no explicit q provided, use the current dashboard searchQuery as baseline
      if (q === undefined) q = searchQuery || "";
      try {
        setEmpLoading(true);
        setEmpEmployees([]);
        setEmpMeta(null);

        if (kuadran != null) {
          const kotakId = Number(kuadran);
          // use quadrantData and recompute quadrant
          let sourceData = quadrantData.map((item) => ({
            ...item,
            quadrant: computeQuadrant(item.potensial, item.kinerja),
          }));

          // If local quadrantData is empty, try a single full fetch only once.
          if (
            (!sourceData || sourceData.length === 0) &&
            !attemptedFullFetchRef.current
          ) {
            attemptedFullFetchRef.current = true;
            try {
              const resAll = await fetchPegawaiList({
                with_penilaian: true,
                with_pagination: false,
              });
              sourceData = (resAll.data || []).map((it) => ({
                name: (it.nama || it.name || "")
                  .toString()
                  .replace(/^-\s*/, ""),
                nip: it.nip || it.NIP || "",
                jabatan: it.jabatan || it.nama_jabatan || "",
                unitKerja: it.unit_kerja || it.unitKerja || "",
                jenisJabatan: it.jenis_jabatan || it.jenisJabatan || "",
                potensial: it.nilai_potensial ?? null,
                kinerja: it.nilai_kinerja ?? null,
                quadrant: computeQuadrant(
                  it.nilai_potensial ?? null,
                  it.nilai_kinerja ?? null,
                ),
                avatar: it.avatar || null,
                raw: it,
              }));
              if (sourceData && sourceData.length > 0)
                setQuadrantData(sourceData);
            } catch {
              sourceData = [];
            }
          }

          // If still empty after attempting a single full fetch, bail out early
          // to avoid repeated fetches / infinite retries.
          if (!sourceData || sourceData.length === 0) {
            setEmpEmployees([]);
            setEmpMeta({
              current_page: 1,
              per_page,
              last_page: 1,
              total: 0,
              tabel: "kuadran",
              kotak: kotakId,
            });
            return;
          }

          const withUnitIds = (sourceData || []).map((it) => ({
            ...it,
            unitId: unitMapsRef.current.nameToId?.[it.unitKerja] || null,
          }));

          const filtered = withUnitIds.filter((it) => {
            // Filter by quadrant
            if (it.quadrant !== kotakId && kotakId !== -99) return false;

            // Filter by Unit Kerja (with parent-child logic)
            if (selectedUnitKerja && selectedUnitKerja.length > 0) {
              const pegawaiUKVal = it.unitId || it.unitKerja || "";
              if (!isUnitKerjaMatch(pegawaiUKVal, selectedUnitKerja))
                return false;
            }

            // Filter by Jenis Jabatan
            if (
              selectedJenisJabatan &&
              selectedJenisJabatan.length > 0 &&
              !selectedJenisJabatan.includes(it.jenisJabatan)
            ) {
              return false;
            }

            return true;
          });
          const qnorm = (q || "").toString().trim().toLowerCase();
          const searched = qnorm
            ? filtered.filter((it) => {
                const hay = `${it.name || ""} ${it.nip || ""} ${
                  it.jabatan || ""
                }`.toLowerCase();
                return hay.includes(qnorm);
              })
            : filtered;

          // Sort by potensial + kinerja total (highest first)
          searched.sort((a, b) => {
            // Jika kotakId = -99, urutkan dulu berdasarkan quadrant (descending)
            if (kotakId === -99) {
              const quadrantA = a.quadrant ?? -Infinity;
              const quadrantB = b.quadrant ?? -Infinity;

              if (quadrantA !== quadrantB) {
                return quadrantB - quadrantA; // descending
              }
            }

            // Jika quadrant sama (atau kotakId != -99), urutkan berdasarkan total nilai
            const sumA = (a.potensial ?? 0) + (a.kinerja ?? 0);
            const sumB = (b.potensial ?? 0) + (b.kinerja ?? 0);

            return sumB - sumA; // descending
          });

          const total = searched.length;
          const last_page = Math.max(1, Math.ceil(total / per_page));
          const current_page = Math.min(Math.max(1, page), last_page);
          const start = (current_page - 1) * per_page;
          const paged = searched.slice(start, start + per_page);
          const tabel = "kuadran";
          const kotak = kotakId;

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
            quadrant: it.quadrant ?? null,
          }));

          setEmpEmployees(mapped);
          setEmpMeta({
            current_page,
            per_page,
            last_page,
            total,
            tabel,
            kotak,
          });
          return;
        }

        // Fallback to server-side fetch for other filters
        const res = await fetchPegawaiList({ filter, page, per_page, q });
        const mapped = (res.data || []).map((it) => ({
          name: (it.nama || it.name || "").toString().replace(/^-\s*/, ""),
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
        setEmpMeta(res.meta ? { ...res.meta, tabel: "jabatan" } : null);
      } catch (err) {
        console.error("loadEmployees error:", err);
        setEmpEmployees([]);
        setEmpMeta(null);
      } finally {
        setEmpLoading(false);
      }
    },
    [selectedUnitKerja, selectedJenisJabatan, quadrantData, searchQuery],
  );

  const handleJobTypeClick = async (item) => {
    // only fetch if filterKey present
    const filter = item.name || null;
    setEmpEmployees([]);
    setEmpMeta(null);
    setEmpFilter(filter);
    setEmpKuadran(null);
    setModalState({
      isOpen: true,
      quadrant: null,
      employees: [],
      title: item.name,
      color: POINT_COLOR,
    });

    if (filter) {
      // await server load so modal mounts with meta/employees already present
      loadEmployees({ filter, q: searchQuery, page: 1, per_page: 10 });
    }
  };

  const handleModalSearch = useCallback(
    (q, page = 1, per_page = 10) => {
      if (!empKuadran) return;
      loadEmployees({ kuadran: empKuadran, q: q || "", page, per_page });

      if (!empFilter) return;
      loadEmployees({ filter: empFilter, q: q || "", page, per_page });
    },
    [empFilter, empKuadran, loadEmployees],
  );

  useEffect(() => {
    let mounted = true;
    setQuadrantLoading(true);
    fetchPegawaiList({ with_penilaian: true, with_pagination: false })
      .then(async (res) => {
        if (!mounted) return;
        const mapped = (res.data || []).map((it) => ({
          name: (it.nama || it.name || "").toString().replace(/^-\s*/, ""),
          nip: it.nip || it.NIP || "",
          jabatan: it.jabatan || it.nama_jabatan || "",
          unitKerja: it.unit_kerja || it.unitKerja || "",
          jenisJabatan: it.jenis_jabatan || it.jenisJabatan || "",
          potensial: it.nilai_potensial ?? null,
          kinerja: it.nilai_kinerja ?? null,
          avatar: it.avatar || null,
          raw: it,
        }));
        // Also fetch unit tree to build unit options + maps, then augment employees with unitId
        try {
          const tree = await fetchPetaJabatanTree();
          const flat = [];
          const nameToId = {};
          const parentMap = {};

          const walk = (nodes, parent = null) => {
            (nodes || []).forEach((n) => {
              flat.push(n);
              if (n.unit_kerja) nameToId[n.unit_kerja] = n.id;
              parentMap[n.id] = n.parent_id || parent || null;
              if (n.children && n.children.length) walk(n.children, n.id);
            });
          };

          walk(tree || []);

          unitMapsRef.current = { nameToId, parentMap };
          setUnitOptions(
            flat.map((n) => ({ value: n.id, label: n.unit_kerja })),
          );

          const mappedWithUnitId = mapped.map((m) => ({
            ...m,
            unitId: nameToId[m.unitKerja] || null,
          }));
          setQuadrantData(mappedWithUnitId);
        } catch (e) {
          console.error("Failed loading unit tree:", e);
          // fallback: still set quadrant data without unitId
          const mappedWithUnitId = mapped.map((m) => ({ ...m, unitId: null }));
          setQuadrantData(mappedWithUnitId);
        }

        // Extract unique jenis jabatan for filters
        const uniqueJenisJabatan = [
          ...new Set(mapped.map((p) => p.jenisJabatan).filter(Boolean)),
        ];
        setJenisJabatanList(uniqueJenisJabatan.sort());
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

  // Auto-refresh modal when searchQuery changes while modal is open
  useEffect(() => {
    if (!modalState.isOpen) return;
    if (empKuadran != null) {
      loadEmployees({
        kuadran: empKuadran,
        q: searchQuery,
        page: 1,
        per_page: 10,
      });
    } else if (empFilter) {
      loadEmployees({
        filter: empFilter,
        q: searchQuery,
        page: 1,
        per_page: 10,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Tentukan Kotak secara dinamis berdasarkan konfigurasi
  const computeQuadrant = (potensial, kinerja) => {
    return computeQuadrantDynamic(potensial, kinerja);
  };

  // Fungsi helper untuk cek parent-child unit kerja
  const isUnitKerjaMatch = (pegawaiUnitKerja, filterUnitKerjaArray) => {
    // filterUnitKerjaArray is expected to be an array of unit ids.
    if (!filterUnitKerjaArray || filterUnitKerjaArray.length === 0) return true;
    if (!pegawaiUnitKerja) return false;

    const { nameToId, parentMap } = unitMapsRef.current || {};

    // Check if pegawaiUnitKerja matches any of the filter values
    for (const filterUnitKerja of filterUnitKerjaArray) {
      // If pegawaiUnitKerja is an id, check ancestry using parentMap
      if (
        parentMap &&
        typeof pegawaiUnitKerja === "string" &&
        parentMap[pegawaiUnitKerja]
      ) {
        let cur = pegawaiUnitKerja;
        while (cur) {
          if (cur === filterUnitKerja) return true;
          cur = parentMap[cur];
        }
        continue;
      }

      // If pegawaiUnitKerja is a name (legacy), try map to id first
      const unitId = nameToId ? nameToId[pegawaiUnitKerja] : null;
      if (unitId) {
        let cur = unitId;
        while (cur) {
          if (cur === filterUnitKerja) return true;
          cur = parentMap[cur];
        }
        continue;
      }

      // Fallback to string-based parent-child detection
      if (pegawaiUnitKerja === filterUnitKerja) return true;
      if (
        pegawaiUnitKerja.startsWith(filterUnitKerja + " -") ||
        pegawaiUnitKerja.startsWith(filterUnitKerja + ",") ||
        pegawaiUnitKerja.includes(`${filterUnitKerja} -`) ||
        pegawaiUnitKerja.includes(`${filterUnitKerja},`)
      ) {
        return true;
      }
    }

    return false;
  };

  // Buat data baru dengan Kotak yang dihitung
  const computedQuadrantDataFull = quadrantData.map((item) => ({
    ...item,
    quadrant: computeQuadrant(item.potensial, item.kinerja),
  }));

  // Apply filters
  const computedQuadrantData = computedQuadrantDataFull.filter((item) => {
    // Filter by Unit Kerja (with parent-child logic)
    if (
      selectedUnitKerja &&
      selectedUnitKerja.length > 0 &&
      !isUnitKerjaMatch(item.unitId || item.unitKerja, selectedUnitKerja)
    ) {
      return false;
    }

    // Filter by Jenis Jabatan
    if (
      selectedJenisJabatan &&
      selectedJenisJabatan.length > 0 &&
      !selectedJenisJabatan.includes(item.jenisJabatan)
    ) {
      return false;
    }

    // Filter by search query (name or NIP)
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const hay = `${item.name || ""} ${item.nip || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });

  // Hitung jumlah data per Kotak (1..9) berdasarkan data yang dihitung
  const quadrantCounts = computedQuadrantData.reduce((acc, item) => {
    const q = Number(item.quadrant) || 0;
    acc[q] = (acc[q] || 0) + 1;
    return acc;
  }, {});

  // Fungsi untuk ekspor rekapitulasi pegawai per kotak berdasarkan jenis jabatan ke Excel
  const handleExportExcel = async () => {
    try {
      if (!computedQuadrantData || computedQuadrantData.length === 0) {
        Swal.fire({
          icon: "info",
          title: "Tidak Ada Data",
          text: "Tidak ada data pegawai untuk diekspor.",
          confirmButtonColor: PRIMARY_COLORS.blue,
        });
        return;
      }

      Swal.fire({
        title: "Mempersiapkan File Excel...",
        text: "Mohon tunggu sejenak",
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false,
      });

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "SIMANTAP";
      workbook.created = new Date();

      // --- SHEET 1: REKAPITULASI KOTAK PER JENIS JABATAN ---
      const sheet1 = workbook.addWorksheet("Rekapitulasi Kotak & Jabatan", {
        views: [{ showGridLines: true }],
      });

      // Daftar standar jenis jabatan sesuai urutan hirearki/tingkat
      const standardJobTypes = jobTypeData.map((j) => j.name);

      // Mapping untuk mengelompokkan pegawai: matrix[jenisJabatan][kotakId]
      const matrix = {};
      standardJobTypes.forEach((jt) => {
        matrix[jt] = {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
          6: 0,
          7: 0,
          8: 0,
          9: 0,
          total: 0,
        };
      });

      // Normalisasi string jenis jabatan
      const getNormalizedJenisJabatan = (rawJenis) => {
        if (!rawJenis) return "Lainnya / Belum Ditetapkan";
        const str = String(rawJenis).trim();
        const found = jobTypeData.find(
          (j) =>
            j.name.toLowerCase() === str.toLowerCase() ||
            j.key.toLowerCase() === str.toLowerCase() ||
            (j.filterKey && j.filterKey.toLowerCase() === str.toLowerCase()),
        );
        return found ? found.name : str;
      };

      // Hitung data per jenis jabatan dan per kotak
      computedQuadrantData.forEach((emp) => {
        const jt = getNormalizedJenisJabatan(emp.jenisJabatan);
        const q = Number(emp.quadrant);
        if (!matrix[jt]) {
          matrix[jt] = {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
            6: 0,
            7: 0,
            8: 0,
            9: 0,
            total: 0,
          };
        }
        if (q >= 1 && q <= 9) {
          matrix[jt][q] += 1;
          matrix[jt].total += 1;
        }
      });

      // Jenis jabatan aktif yang akan ditampilkan (semua standar + jika ada non-standar yang punya data)
      const activeJobTypes = [
        ...standardJobTypes,
        ...Object.keys(matrix).filter(
          (k) => !standardJobTypes.includes(k) && matrix[k].total > 0,
        ),
      ];

      // Atur lebar kolom
      sheet1.columns = [
        { width: 6 }, // A: No
        { width: 38 }, // B: Jenis Jabatan
        { width: 14 }, // C: Kotak 1
        { width: 14 }, // D: Kotak 2
        { width: 14 }, // E: Kotak 3
        { width: 14 }, // F: Kotak 4
        { width: 14 }, // G: Kotak 5
        { width: 14 }, // H: Kotak 6
        { width: 14 }, // I: Kotak 7
        { width: 14 }, // J: Kotak 8
        { width: 14 }, // K: Kotak 9
        { width: 16 }, // L: Total
      ];

      // Header Judul Utama (Row 1)
      sheet1.mergeCells("A1:L1");
      const titleCell = sheet1.getCell("A1");
      titleCell.value =
        "REKAPITULASI JUMLAH PEGAWAI PER KOTAK TALENTA BERDASARKAN JENIS JABATAN";
      titleCell.font = {
        name: "Calibri",
        size: 13,
        bold: true,
        color: { argb: "FFFFFF" },
      };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "1E3A8A" },
      };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      sheet1.getRow(1).height = 32;

      // Sub-judul Sistem (Row 2)
      sheet1.mergeCells("A2:L2");
      const subTitleCell = sheet1.getCell("A2");
      subTitleCell.value = "SISTEM MANAJEMEN TALENTA (SIMANTAP)";
      subTitleCell.font = {
        name: "Calibri",
        size: 10,
        bold: true,
        color: { argb: "475569" },
      };
      subTitleCell.alignment = { horizontal: "center", vertical: "middle" };
      sheet1.getRow(2).height = 18;

      // Filter Info & Date (Row 3)
      sheet1.mergeCells("A3:L3");
      const filterInfoCell = sheet1.getCell("A3");
      const now = new Date();
      const formattedDate = now.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      let filterDesc = [];
      if (selectedUnitKerja && selectedUnitKerja.length > 0) {
        filterDesc.push(`Unit Kerja: ${selectedUnitKerja.length} terpilih`);
      }
      if (selectedJenisJabatan && selectedJenisJabatan.length > 0) {
        filterDesc.push(
          `Jenis Jabatan: ${selectedJenisJabatan.length} terpilih`,
        );
      }
      if (searchQuery) {
        filterDesc.push(`Pencarian: "${searchQuery}"`);
      }
      const filterText =
        filterDesc.length > 0
          ? ` (Filter: ${filterDesc.join(", ")})`
          : " (Semua Data)";

      filterInfoCell.value = `Tanggal Ekspor: ${formattedDate}${filterText} | Total Pegawai: ${computedQuadrantData.length}`;
      filterInfoCell.font = {
        name: "Calibri",
        size: 9,
        italic: true,
        color: { argb: "64748B" },
      };
      filterInfoCell.alignment = { horizontal: "center", vertical: "middle" };
      sheet1.getRow(3).height = 18;

      // Baris kosong (Row 4)
      sheet1.getRow(4).height = 10;

      // Header Tabel (Row 5 & Row 6)
      sheet1.mergeCells("A5:A6");
      sheet1.getCell("A5").value = "No";

      sheet1.mergeCells("B5:B6");
      sheet1.getCell("B5").value = "Jenis Jabatan";

      sheet1.mergeCells("C5:K5");
      sheet1.getCell("C5").value =
        "Jumlah Pegawai per Kotak Talenta (9-Box Matrix)";

      sheet1.mergeCells("L5:L6");
      sheet1.getCell("L5").value = "Total Pegawai";

      // Row 6: Kotak 1 s/d 9 dengan kategori
      const cfg = kotakConfig || loadKotakConfig();
      for (let q = 1; q <= 9; q++) {
        const colLetter = String.fromCharCode(67 + q - 1); // 67 = 'C'
        const kObj = cfg?.kotak?.find((k) => k.id === q);
        const catName = kObj?.kategori ? `\n(${kObj.kategori})` : "";
        sheet1.getCell(`${colLetter}6`).value = `Kotak ${q}${catName}`;
      }

      // Styling Header (Row 5 & 6)
      [5, 6].forEach((rIndex) => {
        const row = sheet1.getRow(rIndex);
        row.height = rIndex === 5 ? 24 : 28;
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.font = {
            name: "Calibri",
            size: 10,
            bold: true,
            color: { argb: "FFFFFF" },
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "1E293B" },
          }; // Slate 800
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
          cell.border = {
            top: { style: "thin", color: { argb: "475569" } },
            left: { style: "thin", color: { argb: "475569" } },
            bottom: { style: "thin", color: { argb: "475569" } },
            right: { style: "thin", color: { argb: "475569" } },
          };
        });
      });

      // Data Rows (Mulai Row 7)
      const startRow = 7;
      activeJobTypes.forEach((jtName, idx) => {
        const rowIndex = startRow + idx;
        const row = sheet1.getRow(rowIndex);
        row.height = 22;

        const counts = matrix[jtName] || {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
          6: 0,
          7: 0,
          8: 0,
          9: 0,
          total: 0,
        };
        const isEven = idx % 2 === 0;
        const bgFill = isEven ? "FFFFFF" : "F8FAFC";

        // Col A: No
        const cellA = row.getCell(1);
        cellA.value = idx + 1;
        cellA.alignment = { horizontal: "center", vertical: "middle" };

        // Col B: Jenis Jabatan
        const cellB = row.getCell(2);
        cellB.value = jtName;
        cellB.alignment = { horizontal: "left", vertical: "middle" };

        // Col C..K: Kotak 1..9
        for (let q = 1; q <= 9; q++) {
          const cell = row.getCell(2 + q);
          cell.value = counts[q];
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.numFmt = "#,##0";
        }

        // Col L: Total (Formula)
        const cellL = row.getCell(12);
        const firstCol = "C" + rowIndex;
        const lastCol = "K" + rowIndex;
        cellL.value = {
          formula: `SUM(${firstCol}:${lastCol})`,
          result: counts.total,
        };
        cellL.font = { name: "Calibri", size: 10, bold: true };
        cellL.alignment = { horizontal: "center", vertical: "middle" };
        cellL.numFmt = "#,##0";

        // Styling data row cells
        row.eachCell({ includeEmpty: true }, (cell) => {
          if (!cell.font?.bold) {
            cell.font = { name: "Calibri", size: 10 };
          }
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: bgFill },
          };
          cell.border = {
            top: { style: "thin", color: { argb: "E2E8F0" } },
            left: { style: "thin", color: { argb: "E2E8F0" } },
            bottom: { style: "thin", color: { argb: "E2E8F0" } },
            right: { style: "thin", color: { argb: "E2E8F0" } },
          };
        });
      });

      // Total Row
      const totalRowIndex = startRow + activeJobTypes.length;
      const totalRow = sheet1.getRow(totalRowIndex);
      totalRow.height = 26;

      // Merge A & B for TOTAL label
      sheet1.mergeCells(`A${totalRowIndex}:B${totalRowIndex}`);
      const totalLabelCell = sheet1.getCell(`A${totalRowIndex}`);
      totalLabelCell.value = "JUMLAH TOTAL PEGAWAI";
      totalLabelCell.font = {
        name: "Calibri",
        size: 10,
        bold: true,
        color: { argb: "0F172A" },
      };
      totalLabelCell.alignment = { horizontal: "center", vertical: "middle" };

      // Formula total per Kotak
      const firstDataRow = startRow;
      const lastDataRow = totalRowIndex - 1;

      for (let q = 1; q <= 9; q++) {
        const colLetter = String.fromCharCode(67 + q - 1);
        const cell = totalRow.getCell(2 + q);
        cell.value = {
          formula: `SUM(${colLetter}${firstDataRow}:${colLetter}${lastDataRow})`,
        };
        cell.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: { argb: "0F172A" },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.numFmt = "#,##0";
      }

      // Formula Grand Total
      const grandTotalCell = totalRow.getCell(12);
      grandTotalCell.value = {
        formula: `SUM(C${totalRowIndex}:K${totalRowIndex})`,
      };
      grandTotalCell.font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: "1E3A8A" },
      };
      grandTotalCell.alignment = { horizontal: "center", vertical: "middle" };
      grandTotalCell.numFmt = "#,##0";

      // Styling Baris Total
      for (let c = 1; c <= 12; c++) {
        const cell = totalRow.getCell(c);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E2E8F0" },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "94A3B8" } },
          bottom: { style: "double", color: { argb: "0F172A" } },
          left: { style: "thin", color: { argb: "CBD5E1" } },
          right: { style: "thin", color: { argb: "CBD5E1" } },
        };
      }

      // --- Tabel Referensi Keterangan Kotak ---
      const legendStartRow = totalRowIndex + 3;
      sheet1.mergeCells(`A${legendStartRow}:E${legendStartRow}`);
      const legTitle = sheet1.getCell(`A${legendStartRow}`);
      legTitle.value = "KETERANGAN KOTAK TALENTA (9-BOX MATRIX)";
      legTitle.font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: "1E293B" },
      };
      legTitle.alignment = { horizontal: "left", vertical: "middle" };

      const legHeaderRow = sheet1.getRow(legendStartRow + 1);
      legHeaderRow.height = 22;
      const legHeaders = [
        { col: 1, text: "No Kotak" },
        { col: 2, text: "Kategori Talenta" },
        { col: 3, text: "Rentang Potensial (Sumbu X)" },
        { col: 4, text: "Rentang Kinerja (Sumbu Y)" },
        { col: 5, text: "Jumlah Pegawai" },
      ];
      legHeaders.forEach((h) => {
        const cell = legHeaderRow.getCell(h.col);
        cell.value = h.text;
        cell.font = {
          name: "Calibri",
          size: 9,
          bold: true,
          color: { argb: "FFFFFF" },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "334155" },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "64748B" } },
          left: { style: "thin", color: { argb: "64748B" } },
          bottom: { style: "thin", color: { argb: "64748B" } },
          right: { style: "thin", color: { argb: "64748B" } },
        };
      });

      for (let q = 1; q <= 9; q++) {
        const rIdx = legendStartRow + 1 + q;
        const row = sheet1.getRow(rIdx);
        row.height = 20;

        const kObj = cfg?.kotak?.find((k) => k.id === q);
        const potStr = kObj
          ? `${kObj.potensialRange?.min ?? 0} - ${kObj.potensialRange?.max ?? 100}`
          : "-";
        const kinStr = kObj
          ? `${kObj.kinerjaRange?.min ?? 0} - ${kObj.kinerjaRange?.max ?? 100}`
          : "-";
        const qCount = quadrantCounts[q] || 0;

        row.getCell(1).value = `Kotak ${q}`;
        row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(1).font = { name: "Calibri", size: 9, bold: true };

        row.getCell(2).value = kObj?.kategori || "-";
        row.getCell(2).alignment = { horizontal: "left", vertical: "middle" };

        row.getCell(3).value = potStr;
        row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };

        row.getCell(4).value = kinStr;
        row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };

        row.getCell(5).value = qCount;
        row.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(5).font = { name: "Calibri", size: 9, bold: true };

        row.eachCell({ includeEmpty: true }, (cell) => {
          if (!cell.font) cell.font = { name: "Calibri", size: 9 };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: q % 2 === 0 ? "FFFFFF" : "F8FAFC" },
          };
          cell.border = {
            top: { style: "thin", color: { argb: "E2E8F0" } },
            left: { style: "thin", color: { argb: "E2E8F0" } },
            bottom: { style: "thin", color: { argb: "E2E8F0" } },
            right: { style: "thin", color: { argb: "E2E8F0" } },
          };
        });
      }

      // --- SHEET 2: DATA DETAIL PEGAWAI ---
      const sheet2 = workbook.addWorksheet("Data Detail Pegawai", {
        views: [{ showGridLines: true }],
      });

      sheet2.columns = [
        { header: "No", key: "no", width: 6 },
        { header: "NIP", key: "nip", width: 20 },
        { header: "Nama Pegawai", key: "nama", width: 32 },
        { header: "Jabatan", key: "jabatan", width: 36 },
        { header: "Jenis Jabatan", key: "jenis_jabatan", width: 30 },
        { header: "Unit Kerja", key: "unit_kerja", width: 36 },
        { header: "Nilai Potensial (X)", key: "potensial", width: 20 },
        { header: "Nilai Kinerja (Y)", key: "kinerja", width: 20 },
        { header: "Nilai Talenta", key: "nilai_talenta", width: 16 },
        { header: "Kotak", key: "kotak", width: 14 },
      ];

      const headerRow2 = sheet2.getRow(1);
      headerRow2.height = 26;
      headerRow2.eachCell((cell) => {
        cell.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: { argb: "FFFFFF" },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "1E3A8A" },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "475569" } },
          left: { style: "thin", color: { argb: "475569" } },
          bottom: { style: "thin", color: { argb: "475569" } },
          right: { style: "thin", color: { argb: "475569" } },
        };
      });

      computedQuadrantData.forEach((item, idx) => {
        const p = Number(item.potensial);
        const k = Number(item.kinerja);
        const nilaiTalenta =
          isFinite(p) && isFinite(k) ? p * 0.5 + k * 0.5 : null;

        const empRow = sheet2.addRow({
          no: idx + 1,
          nip: item.nip || "-",
          nama: item.name || "-",
          jabatan: item.jabatan || "-",
          jenis_jabatan: item.jenisJabatan || "-",
          unit_kerja: item.unitKerja || "-",
          potensial: isFinite(p) ? p : "-",
          kinerja: isFinite(k) ? k : "-",
          nilai_talenta: Number.isFinite(nilaiTalenta)
            ? Number(nilaiTalenta.toFixed(2))
            : "-",
          kotak: item.quadrant ? `Kotak ${item.quadrant}` : "-",
        });

        empRow.height = 20;
        const isEven = idx % 2 === 0;
        const bgFill = isEven ? "FFFFFF" : "F8FAFC";

        empRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cell.font = { name: "Calibri", size: 9 };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: bgFill },
          };
          cell.border = {
            top: { style: "thin", color: { argb: "E2E8F0" } },
            left: { style: "thin", color: { argb: "E2E8F0" } },
            bottom: { style: "thin", color: { argb: "E2E8F0" } },
            right: { style: "thin", color: { argb: "E2E8F0" } },
          };

          if ([1, 2, 7, 8, 9, 10].includes(colNum)) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }
        });
      });

      // Simpan file dan pemicu unduh di browser
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = now.toISOString().slice(0, 10);
      a.download = `Rekap-Pegawai-Per-Kotak-Jabatan-${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      Swal.close();
      Swal.fire({
        icon: "success",
        title: "Ekspor Berhasil",
        text: "Data jumlah pegawai per kotak berdasarkan jenis jabatan berhasil diekspor ke Excel.",
        timer: 2500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Failed to export excel:", error);
      Swal.close();
      Swal.fire({
        icon: "error",
        title: "Gagal Ekspor",
        text:
          error.message || "Terjadi kesalahan saat mengekspor data ke Excel.",
        confirmButtonColor: PRIMARY_COLORS.blue,
      });
    }
  };

  // Fungsi untuk membuka modal dengan data pegawai per kotak
  const handleBoxClick = (quadrantNumber) => {
    const kotak = kotakConfig?.kotak.find((k) => k.id === quadrantNumber);
    setModalState({
      isOpen: true,
      quadrant: quadrantNumber,
      employees: [],
      title: `Kotak ${quadrantNumber}`,
      description: kotak?.kategori || "",
      color: kotak?.warna || PRIMARY_COLORS.teal,
      kotakConfig: kotak,
    });
    setEmpEmployees([]);
    setEmpMeta(null);
    // use empKuadran for frontend pagination/search
    setEmpKuadran(quadrantNumber);
    loadEmployees({
      kuadran: quadrantNumber,
      q: searchQuery,
      page: 1,
      per_page: 10,
    });
  };

  const handleAllBoxClick = () => {
    setModalState({
      isOpen: true,
      employees: [],
    });
    setEmpEmployees([]);
    setEmpMeta(null);
    loadEmployees({
      kuadran: -99,
      q: searchQuery,
      page: 1,
      per_page: 10,
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
    setEmpKuadran(null);
  };

  const GENDER_COLORS = [PRIMARY_COLORS.blue, "#EC4899"];
  // Warna titik yang kontras dengan warna area; menyesuaikan dark mode
  const POINT_COLOR = isDark ? "#F3F4F6" : PRIMARY_COLORS.blue;

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
        const x1 = x.getPixelForValue(
          kotak.potensialRange.min === 0
            ? kotak.potensialRange.min
            : kotak.potensialRange.min - 0.01,
        );
        const x2 = x.getPixelForValue(kotak.potensialRange.max);
        const y1 = y.getPixelForValue(
          kotak.kinerjaRange.min === 0
            ? kotak.kinerjaRange.min
            : kotak.kinerjaRange.min - 0.01,
        );
        const y2 = y.getPixelForValue(kotak.kinerjaRange.max);

        ctx.fillStyle = kotak.warna;
        ctx.globalAlpha = 0.15;
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
                `Nilai Potensial: ${data.x}`,
                `Nilai Kinerja: ${data.y}`,
                `Nilai Talenta: ${((data.x * 50) / 100 + (data.y * 50) / 100).toFixed(2)}`,
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
          afterBuildTicks: (axis) => {
            // Set ticks to show all interval boundaries: 0, p[0].max, p[1].max, 100
            axis.ticks = [0, p[0].max, p[1].max, 100].map((v) => ({
              value: v,
            }));
          },
        },
        y: {
          type: "linear",
          min: 0,
          max: 100,
          ticks: {
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
          afterBuildTicks: (axis) => {
            // Set ticks to show all interval boundaries: 0, k[0].max, k[1].max, 100
            axis.ticks = [0, k[0].max, k[1].max, 100].map((v) => ({
              value: v,
            }));
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
      {/* Breadcrumb */}
      <Breadcrumb />

      {/* Page Title */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
            {t("dashboard")}
          </h1>
          <p className="mt-2 text-md md:text-base text-gray-600 dark:text-gray-300">
            Ringkasan Data Pegawai dan Statistik
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <IconButton
            onClick={handleExportExcel}
            variant="success"
            size="lg"
            disabled={quadrantLoading}
            className="w-full sm:w-auto"
            title="Ekspor Rekapitulasi per Kotak & Jabatan ke Excel"
          >
            <i className="fas fa-file-excel mr-2" aria-hidden="true"></i>
            Ekspor Rekap Excel
          </IconButton>
          <IconButton
            onClick={handleSyncStatistik}
            variant="blue"
            size="lg"
            disabled={isSyncingStatistik || loadingStats}
            className="w-full sm:w-auto"
            title="Sinkronisasi Statistik Pegawai"
          >
            <i
              className={`fas fa-sync-alt mr-2 ${isSyncingStatistik ? "animate-spin" : ""}`}
              aria-hidden="true"
            ></i>
            {isSyncingStatistik ? "Sinkronisasi..." : "Sinkronisasi Data"}
          </IconButton>
        </div>
      </div>

      {/* Statistik Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        {/* Total Pegawai */}
        <div className="bg-gradient-to-br from-[#4095e6] to-[#3085d6] rounded-lg shadow-lg p-6 text-white transform transition hover:scale-105">
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
              <i className="fas fa-users text-4xl text-[#3085d6]"></i>
            </div>
          </div>
        </div>

        {/* Struktural */}
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg shadow-lg p-6 text-white transform transition hover:scale-105">
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
              <i className="fas fa-building text-4xl text-teal-500"></i>
            </div>
          </div>
        </div>

        {/* Fungsional */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg shadow-lg p-6 text-white transform transition hover:scale-105">
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
              <i className="fas fa-award text-4xl text-amber-500"></i>
            </div>
          </div>
        </div>

        {/* Pelaksana */}
        <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-lg shadow-lg p-6 text-white transform transition hover:scale-105">
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
              <i className="fas fa-user-circle text-4xl text-rose-500"></i>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 dark:text-white">
              Komposisi Pegawai Berdasarkan Jenis Jabatan
            </h2>
            <IconButton
              onClick={handleExportExcel}
              variant="success"
              size="sm"
              disabled={quadrantLoading}
              title="Ekspor Excel Rekapitulasi Per Kotak & Jabatan"
            >
              <i className="fas fa-file-excel mr-1.5" aria-hidden="true"></i>
              Ekspor Excel
            </IconButton>
          </div>
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
                      style={{ color: PRIMARY_COLORS.teal }}
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

        {/* Filter Section */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
          <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
            <i
              className="fas fa-filter mr-2"
              style={{ color: PRIMARY_COLORS.teal }}
              aria-hidden="true"
            ></i>
            Filter Data
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search Nama / NIP */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cari Nama / NIP
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <i
                    className="fas fa-search text-gray-400"
                    aria-hidden="true"
                  ></i>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari berdasarkan nama atau NIP..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label="Hapus pencarian"
                  >
                    <i className="fas fa-times" aria-hidden="true"></i>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Unit Kerja */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Unit Kerja
              </label>
              <SearchableSelect
                value={selectedUnitKerja}
                onChange={(value) => setSelectedUnitKerja(value)}
                options={[...unitOptions]}
                placeholder="Pilih Unit Kerja..."
                label="Unit Kerja"
                multiple={true}
              />
            </div>

            {/* Filter Jenis Jabatan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Jenis Jabatan
              </label>
              <SearchableSelect
                value={selectedJenisJabatan}
                onChange={(value) => setSelectedJenisJabatan(value)}
                options={[
                  ...jobTypeData.map((j) => {
                    const match = jenisJabatanList.find((jj) => j.key === jj);
                    return {
                      value: match,
                      label: j.name + ` (Level ${j.level})`,
                    };
                  }),
                ]}
                placeholder="Pilih Jenis Jabatan..."
                label="Jenis Jabatan"
                multiple={true}
              />
            </div>
          </div>

          {/* Reset Filter Button */}
          {(selectedUnitKerja.length > 0 ||
            selectedJenisJabatan.length > 0 ||
            searchQuery) && (
            <div className="mt-4">
              <IconButton
                title="Reset Filter"
                onClick={() => {
                  setSelectedUnitKerja([]);
                  setSelectedJenisJabatan([]);
                  setSearchQuery("");
                }}
                variant="default"
                size="lg"
                className="inline-flex items-center"
              >
                <i className="fas fa-sync-alt mr-2" aria-hidden="true"></i>
                Reset Filter
              </IconButton>
            </div>
          )}
        </div>

        {/* Jumlah data per Kotak - single row above chart */}
        <div className="mb-0">
          {/* responsive: wrap on small screens, single-row on large */}
          <div className="flex flex-wrap gap-3 py-2">
            {quadrantLoading
              ? // Loading skeleton
                [1, 2, 3, 4, 5, 6, 7, 8, 9].map((q) => (
                  <div
                    key={q}
                    className="w-full sm:w-1/2 md:w-1/3 lg:flex-1 min-w-0"
                  >
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border-2 border-gray-200 dark:border-gray-700">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2 animate-pulse"></div>
                      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-12 animate-pulse"></div>
                    </div>
                  </div>
                ))
              : // Actual data
                [1, 2, 3, 4, 5, 6, 7, 8, 9].map((q) => {
                  const kotak = kotakConfig?.kotak.find((k) => k.id === q);
                  const warna = kotak?.warna || PRIMARY_COLORS.teal;
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
            <div className="mb-4 flex flex-col gap-2">
              <IconButton
                onClick={handleAllBoxClick}
                variant="blue"
                size="lg"
                disabled={quadrantLoading}
                className="w-full"
                title="Lihat Daftar Pegawai"
              >
                <i className={`fas fa-users mr-2`} aria-hidden="true"></i>
                {"Lihat Daftar Pegawai"}
              </IconButton>
              <IconButton
                onClick={handleExportExcel}
                variant="success"
                size="lg"
                disabled={quadrantLoading}
                className="w-full"
                title="Ekspor Rekapitulasi per Kotak & Jabatan ke Excel"
              >
                <i className="fas fa-file-excel mr-2" aria-hidden="true"></i>
                {"Ekspor Rekap Excel"}
              </IconButton>
            </div>
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
                    const warna = kotak?.warna || PRIMARY_COLORS.teal;
                    const kategori = kotak?.kategori;
                    return (
                      <div key={q} className="flex items-start gap-2">
                        <div
                          className="flex-shrink-0 w-4 h-4 rounded mt-1"
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
