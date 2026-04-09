import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { useParams, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { PRIMARY_COLORS } from "../config/colors";
import Breadcrumb from "../components/Breadcrumb";
import IconButton from "../components/IconButton";
import SearchableSelect from "../components/SearchableSelect";
import {
  fetchPegawaiByNip,
  fetchIndikators,
  fetchStandarKompetensiMSK,
  fetchInstrumens,
  syncPenilaian,
  fetchSyncPenilaianStatus,
  downloadLampiranAsesmenById,
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
          if (
            status.queue_pending !== null &&
            status.queue_pending !== undefined
          ) {
            parts.push(`Antrian tersisa: ${status.queue_pending}`);
          }
          if (
            status.queue_completed !== null &&
            status.queue_completed !== undefined
          ) {
            parts.push(`Batch selesai: ${status.queue_completed}`);
          }
          if (pending !== null) parts.push(`Pending sesi: ${pending}`);
          queue.textContent = parts.join(" · ");
        }
        if (
          status.queue_pending !== null &&
          status.queue_pending !== undefined &&
          status.queue_pending === 0 &&
          status.session_pending !== null &&
          status.session_pending !== undefined &&
          status.session_pending === 0
        ) {
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
  const [instrumens, setInstrumens] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [showPersonalModal, setShowPersonalModal] = useState(false);
  const [showEmploymentModal, setShowEmploymentModal] = useState(false);
  const [selectedRiwayatAsesmenId, setSelectedRiwayatAsesmenId] = useState("");
  const [downloadingLampiranId, setDownloadingLampiranId] = useState("");
  const [isSyncingPenilaian, setIsSyncingPenilaian] = useState(false);

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
      const pegawai = await fetchPegawaiByNip(nip, true, true);
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

      // Load instrumens data
      fetchInstrumens()
        .then((inst) => {
          setInstrumens(inst || []);
        })
        .catch((err) => {
          console.error("Could not load instrumens:", err);
          setInstrumens([]);
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

  const getRiwayatAsesmenList = () => {
    if (!Array.isArray(pegawaiData?.riwayat_asesmen)) return [];

    return [...pegawaiData.riwayat_asesmen].sort((a, b) => {
      const dateA = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  };

  const getSelectedRiwayatAsesmen = () => {
    const list = getRiwayatAsesmenList();
    if (list.length === 0) return null;

    return (
      list.find(
        (item) => String(item.id) === String(selectedRiwayatAsesmenId),
      ) || list[0]
    );
  };

  useEffect(() => {
    const list = getRiwayatAsesmenList();
    if (list.length === 0) {
      setSelectedRiwayatAsesmenId("");
      return;
    }

    const isValidSelection = list.some(
      (item) => String(item.id) === String(selectedRiwayatAsesmenId),
    );
    if (!isValidSelection) {
      setSelectedRiwayatAsesmenId(String(list[0].id));
    }
  }, [pegawaiData?.riwayat_asesmen, selectedRiwayatAsesmenId]);

  // Process MSK data for radar chart
  const processCompetencyData = () => {
    const selectedRiwayat = getSelectedRiwayatAsesmen();
    const assessmentData =
      selectedRiwayat?.data_asesmen || pegawaiData?.penilaian || null;
    if (!assessmentData) return null;

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
          if (assessmentData[k]) {
            labels.push(k);
            actualValues.push(assessmentData[k]?.nilai || 0);
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
      if (assessmentData && assessmentData[subId] !== undefined) {
        labels.push(s.subindikator || s.nama || s.name || String(subId));
        const actual =
          assessmentData[subId]?.nilai ?? assessmentData[subId]?.hasil ?? 0;
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
    const selectedRiwayat = getSelectedRiwayatAsesmen();
    const assessmentData =
      selectedRiwayat?.data_asesmen || pegawaiData?.penilaian || null;
    if (!assessmentData) return null;

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
      if (assessmentData && assessmentData[subId] !== undefined) {
        labels.push(s.subindikator || s.nama || s.name || String(subId));
        const actual =
          assessmentData[subId]?.nilai ?? assessmentData[subId]?.hasil ?? 0;
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
    const assessmentData = pegawaiData?.penilaian || null;
    if (!assessmentData) return { potensial: [], kinerja: [] };

    const getSubEntry = (subId) => {
      const direct = assessmentData?.[subId] ?? assessmentData?.[String(subId)];
      if (direct !== undefined && direct !== null) {
        if (typeof direct === "object") {
          return {
            nilai: direct.nilai ?? null,
            hasil: direct.hasil ?? null,
          };
        }
        return {
          nilai: Number(direct),
          hasil: null,
        };
      }

      return {
        nilai: null,
        hasil: null,
      };
    };

    const getStandarForSub = (subId) => {
      if (!standarMSK) return 0;
      if (Array.isArray(standarMSK)) {
        const found = standarMSK.find(
          (s) =>
            s.subindikator_id === subId ||
            String(s.subindikator_id) === String(subId),
        );
        return found && found.standar !== undefined && found.standar !== null
          ? Number(found.standar) || 0
          : 0;
      }
      if (typeof standarMSK === "object") {
        return Number(standarMSK[subId] ?? standarMSK[String(subId)] ?? 0) || 0;
      }
      return 0;
    };

    const calculateHasilSub = (indikator, sub, nilaiRaw) => {
      const nilaiNum = Number.parseFloat(nilaiRaw);
      if (!Number.isFinite(nilaiNum)) return 0;

      const bobot = Number.parseFloat(sub?.bobot) || 0;
      const indikatorName = (indikator?.indikator || "").toLowerCase();
      const isMSK =
        indikatorName === "penilaian kompetensi manajerial dan sosial kultural";
      const isPotensiTalenta = indikatorName === "penilaian potensi talenta";

      if (isMSK) {
        const standar = getStandarForSub(sub?.id);
        if (!standar) return 0;
        const effectiveNilai = Math.min(nilaiNum, standar);
        return (effectiveNilai / standar) * 100 * (bobot / 100);
      }

      if (isPotensiTalenta) {
        const standar = 5;
        const effectiveNilai = Math.min(nilaiNum, standar);
        return (effectiveNilai / standar) * 100 * (bobot / 100);
      }

      return nilaiNum * (bobot / 100);
    };

    const buildIndicatorList = (penilaianType) =>
      indikators
        .filter((it) => (it.penilaian || "").toLowerCase() === penilaianType)
        .map((indikator) => {
          const subs = Array.isArray(indikator.sub_indikators)
            ? indikator.sub_indikators
            : [];

          const totals = subs.reduce(
            (acc, sub) => {
              const entry = getSubEntry(sub.id);
              if (
                entry.nilai === null ||
                entry.nilai === undefined ||
                entry.nilai === ""
              ) {
                return acc;
              }

              const nilaiNum = Number.parseFloat(entry.nilai);
              if (!Number.isFinite(nilaiNum)) return acc;

              const hasilNum = calculateHasilSub(indikator, sub, nilaiNum);
              return {
                nilai: acc.nilai + nilaiNum,
                hasil: acc.hasil + (Number.isFinite(hasilNum) ? hasilNum : 0),
              };
            },
            { nilai: 0, hasil: 0 },
          );

          return {
            name: indikator.indikator || indikator.penilaian || "-",
            nilai: totals.nilai,
            hasil: totals.hasil,
            bobot: indikator.bobot,
          };
        });

    const potensialList = buildIndicatorList("potensial");
    const kinerjaList = buildIndicatorList("kinerja");

    return { potensial: potensialList, kinerja: kinerjaList };
  };

  // Accordion state for indicators
  const [expandedPotensial, setExpandedPotensial] = useState({});
  const [expandedKinerja, setExpandedKinerja] = useState({});
  const [activeRadarTab, setActiveRadarTab] = useState("msk"); // 'msk' or 'potensi'
  const [activeRiwayatTab, setActiveRiwayatTab] = useState("jabatan");

  const togglePotensial = (name) => {
    setExpandedPotensial((p) => ({ ...p, [name]: !p[name] }));
  };

  const toggleKinerja = (name) => {
    setExpandedKinerja((p) => ({ ...p, [name]: !p[name] }));
  };

  const getSubValue = (subId) => {
    const stored =
      getSelectedRiwayatAsesmen()?.data_asesmen?.[subId] ??
      pegawaiData?.penilaian?.[subId];
    if (stored === undefined || stored === null)
      return { nilai: null, hasil: null };
    if (typeof stored === "object") {
      return { nilai: stored.nilai ?? null, hasil: stored.hasil ?? null };
    }
    // legacy scalar
    return { nilai: Number(stored) || null, hasil: Number(stored) || null };
  };

  // Get instrumens for a subindikator with their nilai
  const getInstrumensForSub = (subId) => {
    const subInstrumens = instrumens.filter(
      (inst) => inst.subindikator_id === subId,
    );
    const val = getSubValue(subId);
    const currentNilai = val.nilai;

    // If there's a nilai, try to find matching instrumen by skor
    if (currentNilai !== null && currentNilai !== undefined) {
      const matchedInstrumen = subInstrumens.find(
        (inst) => parseFloat(inst.skor) === parseFloat(currentNilai),
      );
      if (matchedInstrumen) {
        return [{ ...matchedInstrumen, nilai: currentNilai }];
      }
    }

    // Return all instrumens with their skor as nilai
    return subInstrumens.map((inst) => ({ ...inst, nilai: inst.skor }));
  };

  // Helper function to clean instrument text by removing letter prefixes (a., b., c., etc.)
  const cleanInstrumenText = (text) => {
    if (!text) return text;
    // Remove patterns like "a. ", "b. ", "c. ", etc. from the beginning
    return text.replace(/^[a-z]\.\s*/i, "");
  };

  // Helper function to get standar for a specific subindikator
  const getStandarForSubIndikator = (subIndikatorId) => {
    if (!standarMSK) return 5;

    // If standarMSK is an array, find by subindikator_id
    if (Array.isArray(standarMSK)) {
      const standar = standarMSK.find(
        (s) =>
          s.subindikator_id === subIndikatorId ||
          String(s.subindikator_id) === String(subIndikatorId),
      );
      return standar?.standar || 5;
    }

    // If it's an object, try keyed access
    if (typeof standarMSK === "object") {
      return (
        Number(
          standarMSK[subIndikatorId] ?? standarMSK[String(subIndikatorId)] ?? 5,
        ) || 5
      );
    }

    return 5;
  };

  // Helper function to categorize kompetensi (MSK)
  const getKompetensiCategory = (nilai, subIndikatorId) => {
    if (nilai === null || nilai === undefined) return null;
    const standar = getStandarForSubIndikator(subIndikatorId);
    return parseFloat(nilai) >= standar
      ? "Memenuhi Standar"
      : "Di Bawah Standar";
  };

  // Helper function to categorize potensi (max value 5)
  const getPotensiCategory = (nilai) => {
    if (nilai === null || nilai === undefined) return null;
    const nilaiFloat = parseFloat(nilai);
    if (nilaiFloat >= 4) return "Tinggi";
    if (nilaiFloat >= 2) return "Sedang";
    return "Rendah";
  };

  // Helper function to categorize tambahan (max value 100)
  const getTambahanCategory = (nilai) => {
    if (nilai === null || nilai === undefined) return null;
    const nilaiFloat = parseFloat(nilai);
    if (nilaiFloat >= 80) return "Sangat Tinggi";
    if (nilaiFloat >= 60) return "Tinggi";
    if (nilaiFloat >= 40) return "Sedang";
    if (nilaiFloat >= 20) return "Rendah";
    return "Sangat Rendah";
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
    const color = kotak?.warna || PRIMARY_COLORS.teal;
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

  const formatDateTimeIndo = (dateStr) => {
    if (!dateStr) return "-";
    const dt = new Date(dateStr);
    if (Number.isNaN(dt.getTime())) return dateStr;

    return dt.toLocaleString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (size) => {
    const bytes = Number(size);
    if (!Number.isFinite(bytes) || bytes <= 0) return "-";

    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }

    const formatted = unitIndex === 0 ? value.toFixed(0) : value.toFixed(2);
    return `${formatted} ${units[unitIndex]}`;
  };

  const getLampiranAsesmenList = (riwayat, globalLampiranList = []) => {
    if (!riwayat || typeof riwayat !== "object") return [];

    const possibleCollections = [
      riwayat?.lampiran_asesmen,
      riwayat?.lampiran_asesmens,
      riwayat?.lampiranAsesmen,
      riwayat?.lampiranAsesmenList,
      riwayat?.attachments,
    ];

    const items = possibleCollections.flatMap((collection) => {
      if (Array.isArray(collection)) return collection;
      if (collection && typeof collection === "object") return [collection];
      return [];
    });

    const selectedNamaAsesmen = String(riwayat?.nama_asesmen || "")
      .trim()
      .toLowerCase();
    const selectedRiwayatId = String(riwayat?.id || "");

    if (Array.isArray(globalLampiranList) && globalLampiranList.length > 0) {
      const matchedGlobal = globalLampiranList.filter((item) => {
        if (!item || typeof item !== "object") return false;

        const itemRiwayatId = String(
          item.riwayat_asesmen_id || item.asesmen_id || "",
        );
        if (selectedRiwayatId && itemRiwayatId === selectedRiwayatId) {
          return true;
        }

        const itemNamaAsesmen = String(item.nama_asesmen || "")
          .trim()
          .toLowerCase();
        return Boolean(
          selectedNamaAsesmen && itemNamaAsesmen === selectedNamaAsesmen,
        );
      });

      items.push(...matchedGlobal);
    }

    if (riwayat.file_path || riwayat.original_filename || riwayat.file_type) {
      items.unshift(riwayat);
    }

    const unique = new Map();
    items.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      const key = String(
        item.id ||
          item.file_path ||
          item.original_filename ||
          `lampiran-${index}`,
      );
      if (!unique.has(key)) {
        unique.set(key, item);
      }
    });

    return Array.from(unique.values()).sort((a, b) => {
      const dateA = a?.updated_at ? new Date(a.updated_at).getTime() : 0;
      const dateB = b?.updated_at ? new Date(b.updated_at).getTime() : 0;
      return dateB - dateA;
    });
  };

  const handleDownloadLampiran = async (lampiran) => {
    if (!lampiran?.id) {
      Swal.fire({
        icon: "warning",
        title: "Lampiran Tidak Valid",
        text: "ID lampiran tidak ditemukan sehingga file belum bisa diunduh.",
      });
      return;
    }

    try {
      setDownloadingLampiranId(String(lampiran.id));
      const { blob, filename } = await downloadLampiranAsesmenById(lampiran.id);
      const finalFilename =
        lampiran.original_filename ||
        filename ||
        `lampiran-asesmen-${lampiran.id}.${
          lampiran.file_type === "application/pdf" ? "pdf" : "bin"
        }`;

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = finalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Unduh Gagal",
        text: error.message || "Terjadi kesalahan saat mengunduh lampiran.",
      });
    } finally {
      setDownloadingLampiranId("");
    }
  };

  const handleSyncPenilaian = async () => {
    const result = await Swal.fire({
      icon: "question",
      title: "Sinkronisasi Penilaian",
      html: pegawaiData
        ? `Sinkronisasi penilaian untuk <strong>${pegawaiData.nama || pegawaiData.name}</strong> (${nip})?`
        : `Sinkronisasi penilaian untuk NIP <strong>${nip}</strong>?`,
      showCancelButton: true,
      confirmButtonText: "Ya, Sinkronisasi",
      cancelButtonText: "Batal",
      confirmButtonColor: PRIMARY_COLORS.blue,
      cancelButtonColor: PRIMARY_COLORS.red,
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      setIsSyncingPenilaian(true);
      await syncPenilaian([nip]);
      const { completed } = await pollSyncProgress([nip]);
      await fetchDetailPegawai();

      if (completed) {
        Swal.fire({
          icon: "success",
          title: "Sukses",
          text: "Sinkronisasi penilaian selesai",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        Swal.fire({
          icon: "info",
          title: "Job Masih Berjalan",
          text: "Sinkronisasi masih diproses di latar belakang. Data akan diperbarui setelah selesai.",
          timer: 3000,
          showConfirmButton: false,
        });
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: error.message || "Sinkronisasi penilaian gagal",
        confirmButtonColor: PRIMARY_COLORS.blue,
      });
    } finally {
      setIsSyncingPenilaian(false);
    }
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
  const riwayatAsesmenList = getRiwayatAsesmenList();
  const selectedRiwayatAsesmen = getSelectedRiwayatAsesmen();
  const lampiranAsesmenList = getLampiranAsesmenList(
    selectedRiwayatAsesmen,
    Array.isArray(pegawaiData?.lampiran_asesmen)
      ? pegawaiData.lampiran_asesmen
      : [],
  );
  const riwayatAsesmenOptions = riwayatAsesmenList.map((item) => ({
    value: String(item.id),
    label: `${item.nama_asesmen || "Nama asesmen"}`,
  }));

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
                  backgroundColor: "rgba(20, 184, 166, 0.2)",
                  borderColor: "rgba(20, 184, 166, 1)",
                  pointBackgroundColor: "rgba(20, 184, 166, 1)",
                  pointBorderColor: "#fff",
                  pointHoverBackgroundColor: "#fff",
                  pointHoverBorderColor: "rgba(20, 184, 166, 1)",
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
                  backgroundColor: "rgba(20, 184, 166, 0.2)",
                  borderColor: "rgb(20, 184, 166)",
                  pointBackgroundColor: "rgb(20, 184, 166)",
                  pointBorderColor: "#fff",
                  pointHoverBackgroundColor: "#fff",
                  pointHoverBorderColor: "rgb(20, 184, 166)",
                },
              ],
      }
    : null;

  // Calculate dynamic max value for radar chart
  const getRadarMaxValue = () => {
    // if (activeRadarTab === "msk" && competencyData?.actualValues) {
    //   const maxActual = Math.max(...competencyData.actualValues, 0);
    //   return Math.ceil(maxActual);
    // }
    // For potensi talenta, use hardcoded 6
    return 5;
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
          quadrantData?.color || PRIMARY_COLORS.teal,
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
              style={{ backgroundColor: PRIMARY_COLORS.teal }}
            >
              <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                <i className="fas fa-user"></i>
                Profil Pegawai
              </h1>
            </div>
            {loadingProfile ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 dark:border-gray-700 border-t-teal-500 mx-auto mb-4"></div>
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
                      <span className="px-3 py-1 bg-teal-50 dark:bg-teal-900 text-teal-500 dark:text-teal-200 rounded-full text-sm font-medium">
                        <i className="fas fa-id-card mr-1"></i>
                        {pegawaiData.nip}
                      </span>
                      <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900 text-[#3085d6] dark:text-blue-200 rounded-full text-sm font-medium">
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
                          variant="blue"
                          size="lg"
                          title="Lihat Informasi Kepegawaian"
                        >
                          <i className="fas fa-briefcase mr-2"></i>
                          Info Kepegawaian
                        </IconButton>
                      </div>
                      <IconButton
                        onClick={handleSyncPenilaian}
                        variant="purple"
                        size="lg"
                        disabled={isSyncingPenilaian}
                        title="Sinkronisasi Penilaian"
                      >
                        {isSyncingPenilaian ? (
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                        ) : (
                          <i className="fas fa-sync mr-2"></i>
                        )}
                        Sinkronisasi Data
                      </IconButton>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="flex md:flex-col gap-4 mt-4 md:mt-6">
                    <div className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900 dark:to-teal-800 rounded-lg p-4 text-center min-w-[120px]">
                      <div className="text-md text-teal-500 dark:text-teal-400 mt-1 font-medium">
                        Nilai Potensial
                      </div>
                      <div
                        className="text-3xl font-bold dark:text-teal-500"
                        style={{ color: PRIMARY_COLORS.teal }}
                      >
                        {quadrantData?.nilaiPotensial?.toFixed(2) || "0.0"}
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg p-4 text-center min-w-[120px]">
                      <div className="text-md text-[#3085d6] dark:text-blue-400 mt-1 font-medium">
                        Nilai Kinerja
                      </div>
                      <div className="text-3xl font-bold text-[#3085d6] dark:text-blue-300">
                        {quadrantData?.nilaiKinerja?.toFixed(2) || "0.0"}
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
                style={{ color: PRIMARY_COLORS.teal }}
              ></i>
              Posisi Kotak Talenta
            </h3>
            {loadingProfile ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 dark:border-gray-700 border-t-teal-500 mx-auto mb-4"></div>
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
                        color: quadrantData?.color || PRIMARY_COLORS.teal,
                      }}
                    >
                      {quadrantData?.quadrant || "-"}
                    </div>
                  </div>
                </div>
                <div className="w-full space-y-2">
                  <div className="flex justify-between items-center p-3 bg-teal-50 dark:bg-teal-900/30 rounded-lg">
                    <span className="text-md font-medium text-teal-500 dark:text-teal-300">
                      {quadrantData?.kategori || "-"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Penilaian Kompetensi dan Potensi Section */}
      <div className="mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          {loadingIndicators || loadingCompetency ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 dark:border-gray-700 border-t-teal-500 mx-auto mb-4"></div>
                <p className="mt-3 text-gray-600 dark:text-gray-300">
                  Memuat data penilaian...
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Kompetensi Manajerial & Sosial Kultural */}
              {(() => {
                const mskIndikator = indikators.find((it) => {
                  const name = (it.indikator || it.penilaian || "")
                    .toString()
                    .toLowerCase();
                  return (
                    name.includes("kompetensi manajerial") ||
                    name.includes("sosial kultural") ||
                    name.includes("msk")
                  );
                });

                const mskSubs =
                  mskIndikator && Array.isArray(mskIndikator.sub_indikators)
                    ? mskIndikator.sub_indikators.filter((s) => s.isactive)
                    : [];

                if (mskSubs.length === 0) return null;

                return (
                  <div>
                    <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                      <i className="fas fa-users-cog text-teal-500 dark:text-teal-400"></i>
                      Kompetensi Manajerial & Sosial Kultural
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {mskSubs.map((sub) => {
                        const subValue = getSubValue(sub.id);
                        const nilai = subValue.nilai ?? subValue.hasil;

                        // Show loading badge if standarMSK is not yet available
                        if (!standarMSK) {
                          return (
                            <div
                              key={sub.id}
                              className="inline-flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 animate-pulse"
                            >
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                {sub.subindikator}:{" "}
                                <span className="text-gray-400 dark:text-gray-500">
                                  Memuat...
                                </span>
                              </span>
                            </div>
                          );
                        }

                        const category = getKompetensiCategory(nilai, sub.id);
                        const standar = getStandarForSubIndikator(sub.id);

                        if (category === null) {
                          return (
                            <div
                              key={sub.id}
                              className="inline-flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                            >
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                {sub.subindikator}:{" "}
                                <span className="text-gray-400 dark:text-gray-500">
                                  Belum dinilai
                                </span>
                              </span>
                            </div>
                          );
                        }

                        const isMeetStandard = category === "Memenuhi Standar";
                        const bgColor = isMeetStandard
                          ? "bg-teal-500 dark:bg-teal-600"
                          : "bg-red-500 dark:bg-red-600";

                        return (
                          <div
                            key={sub.id}
                            className={`inline-flex items-center px-3 py-2 ${bgColor} rounded-lg shadow-sm`}
                            title={`${category}: ${parseFloat(nilai).toFixed(2)} / ${standar}`}
                          >
                            <span className="text-sm font-medium text-white">
                              {sub.subindikator}: {parseFloat(nilai).toFixed(2)}
                              /{standar}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Potensi Talenta */}
              {(() => {
                const potensiIndikator = indikators.find((it) => {
                  const name = (it.indikator || it.penilaian || "")
                    .toString()
                    .toLowerCase();
                  return name.includes("potensi talenta");
                });

                const potensiSubs =
                  potensiIndikator &&
                  Array.isArray(potensiIndikator.sub_indikators)
                    ? potensiIndikator.sub_indikators.filter((s) => s.isactive)
                    : [];

                if (potensiSubs.length === 0) return null;

                return (
                  <div>
                    <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                      <i className="fas fa-star text-teal-500 dark:text-teal-400"></i>
                      Potensi Talenta
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {potensiSubs.map((sub) => {
                        const subValue = getSubValue(sub.id);
                        const nilai = subValue.nilai ?? subValue.hasil;
                        const category = getPotensiCategory(nilai);

                        if (category === null) {
                          return (
                            <div
                              key={sub.id}
                              className="inline-flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                            >
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                {sub.subindikator}:{" "}
                                <span className="text-gray-400 dark:text-gray-500">
                                  Belum dinilai
                                </span>
                              </span>
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

                        return (
                          <div
                            key={sub.id}
                            className={`inline-flex items-center px-3 py-2 ${bgColor} rounded-lg shadow-sm`}
                            title={`${category}: ${parseFloat(nilai).toFixed(2)} / 5`}
                          >
                            <span className="text-sm font-medium text-white">
                              {sub.subindikator}: {parseFloat(nilai).toFixed(2)}
                              /5
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Penilaian Tambahan */}
              {(() => {
                const tambahanIndikators = indikators.filter((it) => {
                  const penilaian = (it.penilaian || "")
                    .toString()
                    .toLowerCase();
                  return penilaian === "tambahan";
                });

                if (tambahanIndikators.length === 0) return null;

                // Check if there's any subindikator with actual nilai
                const hasAnyNilai = tambahanIndikators.some((indikator) => {
                  const subs =
                    indikator?.sub_indikators?.filter((s) => s.isactive) || [];
                  return subs.some((sub) => {
                    const subValue = getSubValue(sub.id);
                    const nilai = subValue.nilai ?? subValue.hasil;
                    return nilai !== null && nilai !== undefined;
                  });
                });

                if (!hasAnyNilai) return null;

                return (
                  <div>
                    <h4 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                      <i className="fas fa-plus-circle text-teal-500 dark:text-teal-400"></i>
                      Penilaian Tambahan
                    </h4>
                    <div className="space-y-3">
                      {tambahanIndikators.map((indikator) => {
                        const tambahanSubs =
                          indikator && Array.isArray(indikator.sub_indikators)
                            ? indikator.sub_indikators.filter((s) => s.isactive)
                            : [];

                        if (tambahanSubs.length === 0) return null;

                        // Filter only subs with nilai
                        const subsWithNilai = tambahanSubs.filter((sub) => {
                          const subValue = getSubValue(sub.id);
                          const nilai = subValue.nilai ?? subValue.hasil;
                          return nilai !== null && nilai !== undefined;
                        });

                        if (subsWithNilai.length === 0) return null;

                        return (
                          <div key={indikator.id}>
                            <div className="flex flex-wrap gap-2">
                              {subsWithNilai.map((sub) => {
                                const subValue = getSubValue(sub.id);
                                const nilai = subValue.nilai ?? subValue.hasil;
                                const category = getTambahanCategory(nilai);

                                let bgColor;
                                if (category === "Sangat Tinggi") {
                                  bgColor = "bg-teal-500 dark:bg-teal-600";
                                } else if (category === "Tinggi") {
                                  bgColor = "bg-[#3085d6] dark:bg-blue-600";
                                } else if (category === "Sedang") {
                                  bgColor = "bg-yellow-500 dark:bg-yellow-600";
                                } else if (category === "Rendah") {
                                  bgColor = "bg-orange-500 dark:bg-orange-600";
                                } else {
                                  bgColor = "bg-red-500 dark:bg-red-600";
                                }

                                return (
                                  <div
                                    key={sub.id}
                                    className={`inline-flex items-center px-3 py-2 ${bgColor} rounded-lg shadow-sm`}
                                    title={`${category}: ${parseFloat(nilai).toFixed(2)} / 100`}
                                  >
                                    <span className="text-sm font-medium text-white">
                                      {sub.subindikator}:{" "}
                                      {parseFloat(nilai).toFixed(2)}/100
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Competency Radar Chart with Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-full">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <i
              className="fas fa-chart-bar"
              style={{ color: PRIMARY_COLORS.teal }}
            ></i>
            Penilaian Kompetensi dan Potensi
          </h3>
          {loadingCompetency ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 dark:border-gray-700 border-t-teal-500 mx-auto mb-4"></div>
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
              {riwayatAsesmenList.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Riwayat Asesmen
                  </label>
                  <SearchableSelect
                    value={String(selectedRiwayatAsesmen?.id || "")}
                    onChange={(value) => setSelectedRiwayatAsesmenId(value)}
                    options={riwayatAsesmenOptions}
                    placeholder="-- Pilih nama asesmen --"
                  />
                </div>
              )}

              {lampiranAsesmenList.length > 0 && (
                <div className="mb-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-cyan-50 via-white to-blue-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900 p-4 md:p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-teal-500/10 dark:bg-teal-400/20 flex items-center justify-center">
                        <i className="fas fa-paperclip text-teal-600 dark:text-teal-300"></i>
                      </div>
                      <h4 className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-100">
                        Laporan Individu
                      </h4>
                    </div>
                    {lampiranAsesmenList.map((lampiran) => {
                      const isDownloading =
                        String(downloadingLampiranId) ===
                        String(lampiran?.id || "");
                      const hasId = Boolean(lampiran?.id);
                      const extension =
                        lampiran?.file_type === "application/pdf"
                          ? "PDF"
                          : "FILE";

                      return (
                        <IconButton
                          onClick={() => handleDownloadLampiran(lampiran)}
                          disabled={!hasId || isDownloading}
                          variant="blue"
                          size="lg"
                          title="Download Lampiran"
                        >
                          {isDownloading ? (
                            <>
                              <i className="fas fa-spinner fa-spin mr-2"></i>
                              Mengunduh...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-download mr-2"></i>
                              Download
                            </>
                          )}
                        </IconButton>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab Navigation */}
              <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
                {competencyData && (
                  <button
                    onClick={() => setActiveRadarTab("msk")}
                    className={`cursor-pointer px-4 py-2 font-medium text-sm transition-colors relative ${
                      activeRadarTab === "msk"
                        ? "dark:text-teal-400"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    }`}
                    style={
                      activeRadarTab === "msk"
                        ? { color: PRIMARY_COLORS.teal }
                        : {}
                    }
                  >
                    Kompetensi MSK
                    {activeRadarTab === "msk" && (
                      <div
                        className="absolute bottom-0 left-0 right-0 h-0.5"
                        style={{ backgroundColor: PRIMARY_COLORS.teal }}
                      ></div>
                    )}
                  </button>
                )}
                {potensiTalentaData && (
                  <button
                    onClick={() => setActiveRadarTab("potensi")}
                    className={`cursor-pointer px-4 py-2 font-medium text-sm transition-colors relative ${
                      activeRadarTab === "potensi"
                        ? "dark:text-teal-400"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    }`}
                    style={
                      activeRadarTab === "potensi"
                        ? { color: PRIMARY_COLORS.teal }
                        : {}
                    }
                  >
                    Potensi Talenta
                    {activeRadarTab === "potensi" && (
                      <div
                        className="absolute bottom-0 left-0 right-0 h-0.5"
                        style={{ backgroundColor: PRIMARY_COLORS.teal }}
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
            <i className="fas fa-th" style={{ color: PRIMARY_COLORS.teal }}></i>
            Matriks 9 Kotak - Potensial vs Kinerja
          </h3>
          {loadingProfile ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 dark:border-gray-700 border-t-teal-500 mx-auto mb-4"></div>
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
              <div className="flex items-center overflow-x-auto">
                {/* Y-axis label (outside chart) */}
                <div className="flex items-center pr-3" style={{ width: 28 }}>
                  <div className="transform -rotate-90 origin-center text-md font-semibold text-gray-600 dark:text-gray-300">
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
                  <div className="text-center mt-2 text-md font-semibold text-gray-600 dark:text-gray-300">
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
              style={{ color: PRIMARY_COLORS.teal }}
            ></i>
            Nilai Potensial per Indikator
          </h3>
          <div className="mb-4 rounded-lg border border-yellow-100 dark:border-yellow-800/60 bg-yellow-50/70 dark:bg-yellow-900/20 px-3 py-2.5">
            <p className="text-sm text-yellow-700 dark:text-yellow-300 leading-relaxed">
              <i className="fas fa-info-circle mr-2"></i>
              Untuk indikator{" "}
              <strong>
                Penilaian Kompetensi Manajerial dan Sosial Kultural
              </strong>{" "}
              serta <strong>Penilaian Potensi Talenta</strong>, jika nilai
              subindikator melebihi standar maka nilai yang digunakan dalam
              perhitungan bobot akan disesuaikan maksimal sebesar standarnya.
            </p>
          </div>
          {loadingIndicators ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 dark:border-gray-700 border-t-teal-500 mx-auto mb-4"></div>
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
                const indName = (
                  indikatorObj?.indikator ||
                  ind.name ||
                  ""
                ).toLowerCase();
                const isMSKInd =
                  indName.includes("kompetensi manajerial") ||
                  indName.includes("msk") ||
                  indName.includes("sosial kultural");
                const isPotensiTalentaInd = indName.includes("potensi talenta");
                return (
                  <div
                    key={idx}
                    className="bg-teal-50 dark:bg-teal-900/10 rounded"
                  >
                    <button
                      type="button"
                      onClick={() => togglePotensial(ind.name)}
                      className="w-full text-left flex items-center justify-between p-2 px-3 hover:bg-teal-100 dark:hover:bg-teal-900/20 rounded cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <i
                          className={`fas fa-chevron-right transform transition-transform duration-200 ${
                            isOpen ? "rotate-90" : ""
                          }`}
                          style={{ color: PRIMARY_COLORS.teal }}
                        ></i>
                        <span className="text-md text-gray-700 dark:text-gray-300">
                          {ind.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {ind.bobot !== undefined && ind.bobot !== null && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            Bobot: {ind.bobot}%
                          </div>
                        )}
                        <div className="text-right">
                          <div
                            className="text-md font-bold dark:text-teal-400"
                            style={{ color: PRIMARY_COLORS.teal }}
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
                      <div className="p-2 pl-8 space-y-1 overflow-visible">
                        {subs.length > 0 ? (
                          subs.map((s, subIdx) => {
                            const val = getSubValue(s.id);
                            const display = val.hasil ?? val.nilai ?? 0;
                            const subInstrumens = getInstrumensForSub(s.id);
                            const hasInstrumens = subInstrumens.length > 0;
                            const isFirstSub = subIdx === 0;
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
                                  <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-end gap-1">
                                    Nilai:{" "}
                                    {val.nilai !== null
                                      ? isMSKInd
                                        ? `${Number(val.nilai).toFixed(2)}/${getStandarForSubIndikator(s.id)}`
                                        : isPotensiTalentaInd
                                          ? `${Number(val.nilai).toFixed(2)}/5`
                                          : Number(val.nilai).toFixed(2)
                                      : "-"}
                                    {hasInstrumens && (
                                      <div className="group relative inline-block">
                                        <i
                                          className="fas fa-info-circle cursor-help"
                                          style={{ color: PRIMARY_COLORS.teal }}
                                        ></i>
                                        <div
                                          className={`invisible group-hover:visible absolute right-0 ${isFirstSub ? "top-full mt-2" : "bottom-full mb-2"} w-96 p-2 bg-white dark:bg-gray-100 text-gray-800 dark:text-gray-900 text-md text-left rounded shadow-lg border border-gray-200 z-50`}
                                        >
                                          {subInstrumens.map((inst) => (
                                            <div key={inst.id}>
                                              {cleanInstrumenText(
                                                inst.instrumen,
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div
                                    className="text-md font-medium dark:text-blue-400"
                                    style={{ color: PRIMARY_COLORS.teal }}
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
            <i className="fas fa-chart-line text-blue-600"></i>
            Nilai Kinerja per Indikator
          </h3>
          {loadingIndicators ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 dark:border-gray-700 border-t-teal-500 mx-auto mb-4"></div>
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
                const indName = (
                  indikatorObj?.indikator ||
                  ind.name ||
                  ""
                ).toLowerCase();
                const isMSKInd =
                  indName.includes("kompetensi manajerial") ||
                  indName.includes("msk") ||
                  indName.includes("sosial kultural");
                const isPotensiTalentaInd = indName.includes("potensi talenta");
                return (
                  <div
                    key={idx}
                    className="bg-blue-50 dark:bg-blue-900/10 rounded"
                  >
                    <button
                      type="button"
                      onClick={() => toggleKinerja(ind.name)}
                      className="w-full text-left flex items-center justify-between p-2 px-3 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <i
                          className={`fas fa-chevron-right text-blue-600 transform transition-transform duration-200 ${
                            isOpen ? "rotate-90" : ""
                          }`}
                        ></i>
                        <span className="text-md text-gray-700 dark:text-gray-300">
                          {ind.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {ind.bobot !== undefined && ind.bobot !== null && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            Bobot: {ind.bobot}%
                          </div>
                        )}
                        <div className="text-right">
                          <div className="text-md font-bold text-blue-600 dark:text-blue-400">
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
                      <div className="p-2 pl-8 space-y-1 overflow-visible">
                        {subs.length > 0 ? (
                          subs.map((s, subIdx) => {
                            const val = getSubValue(s.id);
                            const display = val.hasil ?? val.nilai ?? 0;
                            const subInstrumens = getInstrumensForSub(s.id);
                            const hasInstrumens = subInstrumens.length > 0;
                            const isFirstSub = subIdx === 0;
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
                                  <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-end gap-1">
                                    Nilai:{" "}
                                    {val.nilai !== null
                                      ? isMSKInd
                                        ? `${Number(val.nilai).toFixed(2)}/${getStandarForSubIndikator(s.id)}`
                                        : isPotensiTalentaInd
                                          ? `${Number(val.nilai).toFixed(2)}/5`
                                          : Number(val.nilai).toFixed(2)
                                      : "-"}
                                    {hasInstrumens && (
                                      <div className="group relative inline-block">
                                        <i className="fas fa-info-circle cursor-help text-blue-600"></i>
                                        <div
                                          className={`invisible text-md text-left group-hover:visible absolute right-0 ${isFirstSub ? "top-full mt-2" : "bottom-full mb-2"} w-96 p-2 bg-white dark:bg-gray-100 text-gray-800 dark:text-gray-900 rounded shadow-lg border border-gray-200 z-50`}
                                        >
                                          {subInstrumens.map((inst) => (
                                            <div key={inst.id}>
                                              {cleanInstrumenText(
                                                inst.instrumen,
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-md font-medium text-blue-600 dark:text-blue-400">
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

      {/* Riwayat Pegawai */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        {/* Header */}
        <div
          className="px-6 py-4"
          style={{ backgroundColor: PRIMARY_COLORS.teal }}
        >
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <i className="fas fa-history"></i>
            Riwayat Pegawai
          </h3>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {[
            { key: "jabatan", label: "Jabatan", icon: "briefcase" },
            { key: "skp", label: "SKP", icon: "chart-line" },
            { key: "pengembangan", label: "Pengembangan", icon: "book-open" },
            { key: "diklat", label: "Diklat", icon: "graduation-cap" },
            { key: "sertifikasi", label: "Sertifikasi", icon: "certificate" },
            { key: "pendidikan", label: "Pendidikan", icon: "university" },
            { key: "penghargaan", label: "Penghargaan", icon: "trophy" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveRiwayatTab(tab.key)}
              className={`cursor-pointer px-4 py-3 text-md font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${
                activeRiwayatTab === tab.key
                  ? "border-teal-500 bg-white dark:bg-gray-800 dark:text-teal-400"
                  : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-white/60 dark:hover:bg-gray-800/60"
              }`}
              style={
                activeRiwayatTab === tab.key
                  ? { color: PRIMARY_COLORS.teal }
                  : {}
              }
            >
              <i className={`fas fa-${tab.icon} text-sm`}></i>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 min-h-[320px]">
          {loadingProfile ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 dark:border-gray-700 border-t-teal-500 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-300">
                  Memuat data riwayat...
                </p>
              </div>
            </div>
          ) : (
            <>
              {activeRiwayatTab === "jabatan" && (
                <RiwayatJabatanPanel
                  data={pegawaiData?.riwayat_jabatan}
                  formatDateIndo={formatDateIndo}
                />
              )}
              {activeRiwayatTab === "skp" && (
                <RiwayatSKPPanel data={pegawaiData?.riwayat_skp} />
              )}
              {activeRiwayatTab === "pengembangan" && (
                <RiwayatPengembanganPanel
                  data={pegawaiData?.riwayat_pengembangan_kompetensi}
                  formatDateIndo={formatDateIndo}
                />
              )}
              {activeRiwayatTab === "diklat" && (
                <RiwayatDiklatPanel
                  data={pegawaiData?.riwayat_diklat}
                  formatDateIndo={formatDateIndo}
                />
              )}
              {activeRiwayatTab === "sertifikasi" && (
                <RiwayatSertifikasiPanel
                  data={pegawaiData?.riwayat_sertifikasi}
                  formatDateIndo={formatDateIndo}
                />
              )}
              {activeRiwayatTab === "pendidikan" && (
                <RiwayatPendidikanPanel
                  data={pegawaiData?.riwayat_pendidikan}
                  formatDateIndo={formatDateIndo}
                />
              )}
              {activeRiwayatTab === "penghargaan" && (
                <PenghargaanPanel awards={satyalancanaAwards} />
              )}
            </>
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
                  style={{ color: PRIMARY_COLORS.teal }}
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
                  style={{ color: PRIMARY_COLORS.teal }}
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
      "bg-[#F3E8FF] dark:bg-purple-900/30 text-[#7a5cd6] dark:text-purple-400",
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

// ─── Riwayat Panel Components ──────────────────────────────────────────────

const EmptyState = ({ icon, message }) => (
  <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-600">
    <i className={`fas fa-${icon} text-5xl mb-4 opacity-25`}></i>
    <p className="text-sm">{message}</p>
  </div>
);

const RiwayatJabatanPanel = ({ data, formatDateIndo }) => {
  if (!data || data.length === 0)
    return (
      <EmptyState icon="briefcase" message="Tidak ada data riwayat jabatan" />
    );

  const eselonMeta = (eselon) => {
    if (!eselon)
      return {
        dot: "border-gray-400 bg-gray-200",
        badge: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
      };
    const e = eselon.toUpperCase();
    if (e.startsWith("I.") || e === "I")
      return {
        dot: "border-purple-500 bg-purple-200 dark:bg-purple-900/40",
        badge:
          "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300",
      };
    if (e.startsWith("II.") || e === "II")
      return {
        dot: "border-[#3085d6] bg-blue-200 dark:bg-blue-900/40",
        badge:
          "bg-blue-100 text-[#3085d6] dark:bg-blue-900/30 dark:text-blue-300",
      };
    if (e.startsWith("III."))
      return {
        dot: "border-teal-500 bg-teal-200 dark:bg-teal-900/40",
        badge:
          "bg-teal-100 text-teal-500 dark:bg-teal-900/30 dark:text-teal-400",
      };
    if (e.startsWith("IV."))
      return {
        dot: "border-orange-400 bg-orange-200 dark:bg-orange-900/40",
        badge:
          "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300",
      };
    return {
      dot: "border-gray-400 bg-gray-200",
      badge: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    };
  };

  return (
    <div className="relative">
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
        {data.length} entri jabatan
      </p>
      <div className="space-y-1">
        {data.map((item, idx) => {
          const meta = eselonMeta(item.eselon);
          return (
            <div key={item.id} className="flex gap-4">
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center pt-1.5">
                <div
                  className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${meta.dot}`}
                ></div>
                {idx < data.length - 1 && (
                  <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 mt-1 min-h-[20px]"></div>
                )}
              </div>
              {/* Card */}
              <div className="flex-1 pb-3">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
                    <h4 className="text-md font-semibold text-gray-900 dark:text-white leading-tight flex-1">
                      {item.namaJabatan}
                    </h4>
                    {item.eselon && (
                      <span
                        className={`text-sm font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${meta.badge}`}
                      >
                        Eselon {item.eselon}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-0.5">
                    <i className="fas fa-building mr-1 opacity-60"></i>
                    {item.namaUnor || item.unorNama}
                  </p>
                  {item.instansiKerjaNama && (
                    <p className="text-sm text-gray-500 dark:text-gray-500 mb-2">
                      <i className="fas fa-landmark mr-1 opacity-60"></i>
                      {item.instansiKerjaNama}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-2">
                    {item.tmtJabatan && (
                      <span>
                        <i className="fas fa-calendar-check mr-1"></i>TMT:{" "}
                        {formatDateIndo(item.tmtJabatan)}
                      </span>
                    )}
                    {item.nomorSk && (
                      <span>
                        <i className="fas fa-file-alt mr-1"></i>SK:{" "}
                        {item.nomorSk}
                      </span>
                    )}
                    {item.tanggalSk && (
                      <span>
                        <i className="fas fa-calendar mr-1"></i>
                        {formatDateIndo(item.tanggalSk)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const RiwayatSKPPanel = ({ data }) => {
  if (!data || data.length === 0)
    return (
      <EmptyState icon="chart-line" message="Tidak ada data riwayat SKP" />
    );

  const sorted = [...data].sort((a, b) => Number(b.tahun) - Number(a.tahun));

  const kuadranColor = (k) => {
    if (!k)
      return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
    const v = k.toUpperCase();
    if (v.includes("SANGAT BAIK") || v.includes("ISTIMEWA"))
      return "bg-teal-100 text-teal-500 dark:bg-teal-900/30 dark:text-teal-400";
    if (v.includes("BAIK"))
      return "bg-blue-100 text-[#3085d6] dark:bg-blue-900/30 dark:text-blue-300";
    if (v.includes("CUKUP"))
      return "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-300";
    return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300";
  };

  const hasilColor = (h) => {
    if (!h) return "text-gray-500 dark:text-gray-400";
    const v = h.toUpperCase();
    if (v.includes("DIATAS") || v.includes("ATAS"))
      return "text-teal-500 dark:text-teal-400 font-semibold";
    if (v.includes("SESUAI"))
      return "text-[#3085d6] dark:text-blue-400 font-semibold";
    return "text-orange-600 dark:text-orange-400 font-semibold";
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {sorted.map((item) => (
        <div
          key={item.id}
          className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-3xl font-extrabold text-gray-800 dark:text-white">
              {item.tahun}
            </span>
            <span
              className={`text-md font-semibold px-2.5 py-1 rounded-full ${kuadranColor(item.kuadranKinerja)}`}
            >
              {item.kuadranKinerja}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 dark:text-gray-500 w-28 flex-shrink-0">
                Hasil Kinerja
              </span>
              <span className={hasilColor(item.hasilKinerja)}>
                {item.hasilKinerja}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 dark:text-gray-500 w-28 flex-shrink-0">
                Perilaku Kerja
              </span>
              <span className={hasilColor(item.perilakuKerja)}>
                {item.perilakuKerja}
              </span>
            </div>
            <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-600">
              <p className="text-gray-600 dark:text-gray-400">
                <i className="fas fa-user-tie mr-1 opacity-60"></i>
                {item.namaPenilai}
              </p>
              <p className="text-gray-400 dark:text-gray-500 mt-0.5">
                {item.penilaiJabatanNm}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const RiwayatPengembanganPanel = ({ data, formatDateIndo }) => {
  if (!data || data.length === 0)
    return (
      <EmptyState
        icon="book-open"
        message="Tidak ada data riwayat pengembangan kompetensi"
      />
    );

  const getUpdatedTime = (item) => {
    const rawDate =
      item?.updatedAt ||
      item?.updated_at ||
      item?.createdAt ||
      item?.created_at ||
      null;
    const ts = rawDate ? new Date(rawDate).getTime() : 0;
    return Number.isFinite(ts) ? ts : 0;
  };

  const uniqueMap = new Map();
  data.forEach((item, index) => {
    const rawNoSertipikat = String(item?.noSertipikat || "").trim();
    const normalizedNoSertipikat = rawNoSertipikat.replace(/\s+/g, "");
    const hasNoSertipikat = Boolean(
      normalizedNoSertipikat && normalizedNoSertipikat !== "-",
    );
    const dedupeKey = hasNoSertipikat
      ? `sertipikat:${normalizedNoSertipikat.toLowerCase()}`
      : `unique:${item?.id || "item"}-${index}`;

    const existing = uniqueMap.get(dedupeKey);
    if (!existing || getUpdatedTime(item) > getUpdatedTime(existing)) {
      uniqueMap.set(dedupeKey, item);
    }
  });

  const sorted = [...uniqueMap.values()].sort((a, b) => {
    const updatedDiff = getUpdatedTime(b) - getUpdatedTime(a);
    if (updatedDiff !== 0) return updatedDiff;
    const ya = parseInt(a.tahunKursus) || 0;
    const yb = parseInt(b.tahunKursus) || 0;
    return yb - ya;
  });

  const totalJam = sorted.reduce((s, i) => s + (parseInt(i.jumlahJam) || 0), 0);

  const jenisColor = (j) => {
    if (!j)
      return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";
    const v = j.toUpperCase();
    if (v.includes("SEMINAR") || v.includes("WORKSHOP"))
      return "bg-blue-100 text-[#3085d6] dark:bg-blue-900/30 dark:text-blue-300";
    if (v.includes("TEKNIS"))
      return "bg-teal-100 text-teal-500 dark:bg-teal-900/30 dark:text-teal-400";
    return "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300";
  };

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 text-center">
          <div className="text-3xl font-extrabold text-teal-500 dark:text-teal-400">
            {sorted.length}
          </div>
          <div className="text-sm text-teal-500 dark:text-teal-400 mt-0.5">
            Total Pelatihan
          </div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
          <div className="text-3xl font-extrabold text-[#3085d6] dark:text-blue-400">
            {totalJam}
          </div>
          <div className="text-sm text-[#3085d6] dark:text-blue-400 mt-0.5">
            Total JP
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {sorted.map((item) => (
          <div
            key={item.id}
            className="flex gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
          >
            {/* JP circle */}
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/40 flex flex-col items-center justify-center">
              <span className="text-sm font-bold text-teal-500 dark:text-teal-400 leading-none">
                {item.jumlahJam || 0}
              </span>
              <span className="text-[9px] text-teal-500 dark:text-teal-400">
                JP
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 mb-1.5">
                <h4 className="text-md font-semibold text-gray-900 dark:text-white leading-tight flex-1">
                  {item.namaKursus}
                </h4>
                {item.jenisKursusSertifikat && (
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${jenisColor(item.jenisKursusSertifikat)}`}
                  >
                    {item.jenisKursusSertifikat}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                {item.institusiPenyelenggara && (
                  <span>
                    <i className="fas fa-building mr-1 opacity-60"></i>
                    {item.institusiPenyelenggara}
                  </span>
                )}
                {item.tanggalKursus && (
                  <span>
                    <i className="fas fa-calendar mr-1 opacity-60"></i>
                    {formatDateIndo(item.tanggalKursus)}
                    {item.tanggalSelesaiKursus &&
                    item.tanggalSelesaiKursus !== item.tanggalKursus
                      ? ` – ${formatDateIndo(item.tanggalSelesaiKursus)}`
                      : ""}
                  </span>
                )}
                {item.noSertipikat &&
                  item.noSertipikat !== "-" &&
                  item.noSertipikat.trim() !== "" && (
                    <span>
                      <i className="fas fa-certificate mr-1 opacity-60"></i>
                      {item.noSertipikat}
                    </span>
                  )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const RiwayatDiklatPanel = ({ data, formatDateIndo }) => {
  if (!data || data.length === 0)
    return (
      <EmptyState
        icon="graduation-cap"
        message="Tidak ada data riwayat diklat"
      />
    );

  const getUpdatedTime = (item) => {
    const rawDate =
      item?.updatedAt ||
      item?.updated_at ||
      item?.createdAt ||
      item?.created_at ||
      null;
    const ts = rawDate ? new Date(rawDate).getTime() : 0;
    return Number.isFinite(ts) ? ts : 0;
  };

  const uniqueMap = new Map();
  data.forEach((item, index) => {
    const rawNomor = String(item?.nomor || "").trim();
    const normalizedNomor = rawNomor.replace(/\s+/g, "");
    const hasNomor = Boolean(normalizedNomor && normalizedNomor !== "-");
    const dedupeKey = hasNomor
      ? `nomor:${normalizedNomor.toLowerCase()}`
      : `unique:${item?.id || "item"}-${index}`;

    const existing = uniqueMap.get(dedupeKey);
    if (!existing || getUpdatedTime(item) > getUpdatedTime(existing)) {
      uniqueMap.set(dedupeKey, item);
    }
  });

  const sorted = [...uniqueMap.values()].sort((a, b) => {
    const updatedDiff = getUpdatedTime(b) - getUpdatedTime(a);
    if (updatedDiff !== 0) return updatedDiff;
    return Number(b.tahun) - Number(a.tahun);
  });

  return (
    <div className="space-y-4">
      {sorted.map((item) => (
        <div
          key={item.id}
          className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
        >
          <div className="flex flex-wrap items-start gap-2 mb-3">
            <div className="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-full flex items-center justify-center">
              <i className="fas fa-graduation-cap text-purple-600 dark:text-purple-400"></i>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start gap-2">
                <h4 className="text-md font-semibold text-gray-900 dark:text-white flex-1 leading-tight">
                  {item.latihanStrukturalNama}
                </h4>
                <span className="text-md font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 flex-shrink-0">
                  {item.tahun}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-gray-500 dark:text-gray-400">
            {item.institusiPenyelenggara && (
              <span>
                <i className="fas fa-building mr-1 opacity-60"></i>
                {item.institusiPenyelenggara}
              </span>
            )}
            {item.jumlahJam && (
              <span>
                <i className="fas fa-clock mr-1 opacity-60"></i>
                {item.jumlahJam} JP
              </span>
            )}
            {item.tanggal && (
              <span>
                <i className="fas fa-calendar-alt mr-1 opacity-60"></i>
                {formatDateIndo(item.tanggal)}
                {item.tanggalSelesai
                  ? ` s/d ${formatDateIndo(item.tanggalSelesai)}`
                  : ""}
              </span>
            )}
            {item.nomor && (
              <span>
                <i className="fas fa-file-alt mr-1 opacity-60"></i>No:{" "}
                {item.nomor}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const RiwayatSertifikasiPanel = ({ data, formatDateIndo }) => {
  if (!data || data.length === 0)
    return (
      <EmptyState
        icon="certificate"
        message="Tidak ada data riwayat sertifikasi"
      />
    );

  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div
          key={item.id}
          className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-xl p-5 border border-amber-100 dark:border-amber-900/30 hover:shadow-md transition-shadow"
        >
          <div className="flex gap-3 mb-3">
            <div className="flex-shrink-0 w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center">
              <i className="fas fa-certificate text-amber-600 dark:text-amber-400"></i>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-md font-semibold text-gray-900 dark:text-white leading-tight">
                {item.namaSertifikasi}
              </h4>
              <span className="text-sm text-amber-600 dark:text-amber-400">
                {item.jenisSertifikasiNama}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-gray-600 dark:text-gray-400">
            {item.lembagaSertifikasiNama && (
              <span>
                <i className="fas fa-landmark mr-1 opacity-60"></i>
                {item.lembagaSertifikasiNama}
              </span>
            )}
            {item.noSertifikat && (
              <span>
                <i className="fas fa-hashtag mr-1 opacity-60"></i>No:{" "}
                {item.noSertifikat}
              </span>
            )}
            {item.tanggalSertifikat && (
              <span>
                <i className="fas fa-calendar-check mr-1 opacity-60"></i>
                {formatDateIndo(item.tanggalSertifikat)}
              </span>
            )}
            {item.masaBerlakuSertMulai && (
              <span>
                <i className="fas fa-hourglass-half mr-1 opacity-60"></i>
                Berlaku: {formatDateIndo(item.masaBerlakuSertMulai)}
                {item.masaBerlakuSertSelesai
                  ? ` s/d ${formatDateIndo(item.masaBerlakuSertSelesai)}`
                  : ""}
              </span>
            )}
          </div>
          {item.rumpunJabatanNama && (
            <div className="mt-3 pt-3 border-t border-amber-100 dark:border-amber-900/30">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                <i className="fas fa-tag mr-1 opacity-60"></i>Rumpun:{" "}
                {item.rumpunJabatanNama}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const RiwayatPendidikanPanel = ({ data, formatDateIndo }) => {
  if (!data || data.length === 0)
    return (
      <EmptyState
        icon="university"
        message="Tidak ada data riwayat pendidikan"
      />
    );

  const sorted = [...data].sort(
    (a, b) => Number(b.tkPendidikanId || 0) - Number(a.tkPendidikanId || 0),
  );

  const levelMeta = (level) => {
    if (!level)
      return {
        bg: "bg-gray-100 dark:bg-gray-700",
        text: "text-gray-600 dark:text-gray-400",
        border: "border-gray-200 dark:border-gray-600",
        icon: "school",
      };
    const l = level.toUpperCase();
    if (l.includes("S-3") || l.includes("DOKTOR"))
      return {
        bg: "bg-purple-100 dark:bg-purple-900/30",
        text: "text-purple-500 dark:text-purple-300",
        border: "border-purple-200 dark:border-purple-700",
        icon: "user-graduate",
      };
    if (l.includes("S-2") || l.includes("MAGISTER"))
      return {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-[#3085d6] dark:text-blue-300",
        border: "border-blue-200 dark:border-blue-700",
        icon: "graduation-cap",
      };
    if (l.includes("S-1") || l.includes("D-IV"))
      return {
        bg: "bg-teal-100 dark:bg-teal-900/30",
        text: "text-teal-500 dark:text-teal-300",
        border: "border-teal-200 dark:border-teal-700",
        icon: "graduation-cap",
      };
    if (l.includes("D-"))
      return {
        bg: "bg-indigo-100 dark:bg-indigo-900/30",
        text: "text-indigo-600 dark:text-indigo-300",
        border: "border-indigo-200 dark:border-indigo-700",
        icon: "certificate",
      };
    if (l.includes("SMA") || l.includes("SLTA"))
      return {
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-600 dark:text-green-300",
        border: "border-green-200 dark:border-green-700",
        icon: "school",
      };
    if (l.includes("SMP") || l.includes("SLTP"))
      return {
        bg: "bg-lime-100 dark:bg-lime-900/30",
        text: "text-lime-600 dark:text-lime-300",
        border: "border-lime-200 dark:border-lime-700",
        icon: "school",
      };
    return {
      bg: "bg-gray-100 dark:bg-gray-700",
      text: "text-gray-600 dark:text-gray-400",
      border: "border-gray-200 dark:border-gray-600",
      icon: "school",
    };
  };

  return (
    <div className="space-y-4">
      {sorted.map((item) => {
        const meta = levelMeta(item.tkPendidikanNama);
        const gelar = [item.gelarDepan, item.gelarBelakang]
          .filter(Boolean)
          .join(" / ");
        return (
          <div
            key={item.id}
            className={`rounded-xl p-5 border ${meta.bg} ${meta.border} hover:shadow-md transition-shadow`}
          >
            <div className="flex gap-3 mb-3">
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full bg-white/60 dark:bg-gray-900/30 flex items-center justify-center`}
              >
                <i className={`fas fa-${meta.icon} ${meta.text} text-lg`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <span
                    className={`text-sm font-bold uppercase tracking-wide ${meta.text}`}
                  >
                    {item.tkPendidikanNama}
                  </span>
                  {item.tahunLulus && (
                    <span className="text-sm px-2 py-0.5 rounded-full bg-white/70 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 font-medium">
                      Lulus {item.tahunLulus}
                    </span>
                  )}
                </div>
                <p className="text-md font-semibold text-gray-900 dark:text-white leading-tight">
                  {item.pendidikanNama}
                </p>
              </div>
            </div>
            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              {item.namaSekolah && (
                <p>
                  <i className="fas fa-university mr-1 opacity-60"></i>
                  {item.namaSekolah}
                </p>
              )}
              {item.nomorIjasah && (
                <p>
                  <i className="fas fa-file-alt mr-1 opacity-60"></i>No. Ijazah:{" "}
                  {item.nomorIjasah}
                </p>
              )}
              {gelar && (
                <p>
                  <i className="fas fa-user-graduate mr-1 opacity-60"></i>Gelar:{" "}
                  {gelar}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const PenghargaanPanel = ({ awards }) => {
  if (!awards || awards.length === 0)
    return (
      <EmptyState
        icon="trophy"
        message="Belum memenuhi syarat penghargaan Satyalancana"
      />
    );

  const colorMap = {
    gold: {
      bg: "bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/20 dark:to-amber-900/20",
      text: "text-yellow-600 dark:text-yellow-300",
      border: "border-yellow-300 dark:border-yellow-700",
      icon: "bg-yellow-200 dark:bg-yellow-800/40 text-yellow-700 dark:text-yellow-300",
    },
    silver: {
      bg: "bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-700/40 dark:to-slate-700/40",
      text: "text-gray-700 dark:text-gray-300",
      border: "border-gray-300 dark:border-gray-600",
      icon: "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
    },
    bronze: {
      bg: "bg-gradient-to-r from-orange-100 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/10",
      text: "text-orange-600 dark:text-orange-300",
      border: "border-orange-300 dark:border-orange-700",
      icon: "bg-orange-200 dark:bg-orange-800/40 text-orange-700 dark:text-orange-300",
    },
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {awards.map((award, idx) => {
        let key = "bronze";
        if (award.name && award.name.includes("XXX")) key = "gold";
        else if (award.name && award.name.includes("XX")) key = "silver";
        const c = colorMap[key];
        return (
          <div
            key={idx}
            className={`flex items-center gap-4 p-5 rounded-xl border ${c.bg} ${c.border} hover:shadow-md transition-shadow`}
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${c.icon}`}
            >
              <i className="fas fa-medal text-2xl"></i>
            </div>
            <div>
              <h4 className={`font-bold text-sm leading-tight ${c.text}`}>
                {award.name}
              </h4>
              <p className={`text-sm mt-0.5 opacity-80 ${c.text}`}>
                {award.years} tahun masa kerja
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DetailPegawai;
