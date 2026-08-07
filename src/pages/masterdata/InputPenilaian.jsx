import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  BG_COLORS,
  TEXT_ON_BG_COLORS,
  PRIMARY_COLORS,
} from "../../config/colors";
import IconButton from "../../components/IconButton";
import SearchableSelect from "../../components/SearchableSelect";
import Breadcrumb from "../../components/Breadcrumb";
import {
  fetchIndikators,
  fetchInstrumens,
  fetchPenilaianByNip,
  submitPenilaian,
  updatePenilaian,
  fetchPegawaiByNip,
  fetchStandarKompetensiMSK,
  syncPenilaian,
  fetchSyncPenilaianStatus,
} from "../../services/apiService";
import Swal from "sweetalert2";
import {
  loadKotakConfig,
  computeQuadrantDynamic,
} from "../../services/kotakConfigService";
import { pollSyncProgress } from "../../utils/syncUtils";

const InputPenilaian = () => {
  const { nip } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isSyncingPenilaian, setIsSyncingPenilaian] = useState(false);
  const [indikators, setIndikators] = useState([]);
  const [instrumens, setInstrumens] = useState([]);
  const [standarMSK, setStandarMSK] = useState([]);
  const [pegawai, setPegawai] = useState(null);
  const [penilaianData, setPenilaianData] = useState({});
  const [existingPenilaian, setExistingPenilaian] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  const hasFilledValue = (value) =>
    value !== null && value !== undefined && String(value).trim() !== "";

  const applyDefaultPenilaianValues = (
    currentData,
    indikatorList,
    instrumenList,
  ) => {
    const nextData = { ...(currentData || {}) };

    const getSubInstrumens = (subindikatorId) =>
      (instrumenList || [])
        .filter(
          (instr) =>
            String(instr.subindikator_id) === String(subindikatorId),
        )
        .sort((a, b) =>
          (a.instrumen || "").localeCompare(b.instrumen || ""),
        );

    for (const indikator of indikatorList || []) {
      if (!indikator.sub_indikators) continue;

      for (const subindikator of indikator.sub_indikators) {
        if (!subindikator.isactive) continue;

        const subInstrumens = getSubInstrumens(subindikator.id);
        if (subInstrumens.length === 0) continue;

        const sid = String(subindikator.id);
        const existingKey = Object.prototype.hasOwnProperty.call(nextData, sid)
          ? sid
          : String(subindikator.id);

        const entry = nextData[existingKey] || {};

        const selectedInstrumen = hasFilledValue(entry.instrumen_id)
          ? subInstrumens.find(
              (instr) => String(instr.id) === String(entry.instrumen_id),
            )
          : null;

        const defaultByFlag = subInstrumens.find(
          (instr) =>
            instr.is_default === true ||
            instr.is_default === 1 ||
            instr.default === true ||
            instr.default === 1 ||
            instr.isDefault === true,
        );

        const defaultByNilai = hasFilledValue(entry.nilai)
          ? subInstrumens.find(
              (instr) => Number(instr.skor) === Number(entry.nilai),
            )
          : null;

        const fallbackInstrumen =
          selectedInstrumen ||
          defaultByFlag ||
          defaultByNilai ||
          subInstrumens[0] ||
          null;

        if (!fallbackInstrumen) continue;

        const instrumenId = hasFilledValue(entry.instrumen_id)
          ? String(entry.instrumen_id)
          : String(fallbackInstrumen.id);
        const nilai = hasFilledValue(entry.nilai)
          ? entry.nilai
          : fallbackInstrumen.skor;

        nextData[existingKey] = {
          ...entry,
          instrumen_id: instrumenId,
          nilai,
        };
      }
    }

    return nextData;
  };

  useEffect(() => {
    document.title = `Input Penilaian | SIMANTAP`;
    loadData();
  }, [nip]);

  const handleSyncPenilaian = async () => {
    const result = await Swal.fire({
      icon: "question",
      title: "Sinkronisasi Penilaian",
      html: pegawai
        ? `Sinkronisasi penilaian untuk <strong>${pegawai.nama || pegawai.name}</strong> (${nip})?`
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
      // Job dispatched — poll progress
      const { completed, isError } = await pollSyncProgress([nip]);
      if (isError) return;
      const freshData = await loadData();

      // Recalculate hasil values from fresh data and save to update Profil Pegawai
      try {
        if (freshData.existingPenilaian && Object.keys(freshData.penilaianData).length > 0) {
          const getStandarFresh = (subId) => {
            if (!Array.isArray(freshData.standarMSK)) return null;
            const found = freshData.standarMSK.find(
              (s) =>
                s.subindikator_id === subId ||
                String(s.subindikator_id) === String(subId),
            );
            return found != null ? Number(found.standar) : null;
          };

          const penilaianObj = {};
          for (const indikator of freshData.indikators) {
            if (!indikator.sub_indikators) continue;
            const indNama = (indikator.indikator || "").toLowerCase();
            const isMSK =
              indNama === "penilaian kompetensi manajerial dan sosial kultural";
            const isPotensiTalenta =
              indNama === "penilaian potensi talenta";

            for (const sub of indikator.sub_indikators) {
              if (!sub.isactive) continue;
              const entry =
                freshData.penilaianData[sub.id] ||
                freshData.penilaianData[String(sub.id)];
              if (
                !entry ||
                entry.nilai === null ||
                entry.nilai === undefined ||
                entry.nilai === ""
              )
                continue;

              const nilaiNum = parseFloat(entry.nilai);
              if (isNaN(nilaiNum)) continue;

              const bobot = parseFloat(sub.bobot) || 0;
              let hasil = 0;
              if (isMSK) {
                const standar = getStandarFresh(sub.id) || 0;
                hasil = standar > 0 ? (((nilaiNum < standar) ? nilaiNum : standar)  / standar) * 100 * (bobot / 100) : 0;
              } else if (isPotensiTalenta) {
                hasil = (Math.min(nilaiNum, 5) / 5) * 100 * (bobot / 100);
              } else {
                hasil = nilaiNum * (bobot / 100);
              }

              penilaianObj[sub.id] = {
                nilai: nilaiNum,
                hasil: isNaN(hasil) ? 0 : hasil,
              };
            }
          }

          if (Object.keys(penilaianObj).length > 0) {
            await updatePenilaian(freshData.existingPenilaian.id, {
              pegawai_id: freshData.pegawai?.id || null,
              penilaian: penilaianObj,
            });
          }
        }
      } catch (recalcErr) {
        console.error("Recalculate profil pegawai values error:", recalcErr);
      }

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
          text: "Sinkronisasi masih diproses di latar belakang. Penilaian akan diperbarui setelah selesai.",
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

  const loadData = async () => {
    const freshData = {
      indikators: [],
      instrumens: [],
      penilaianData: {},
      existingPenilaian: null,
      pegawai: null,
      standarMSK: [],
    };
    try {
      setLoading(true);

      // Load indikators with subindikators
      const indikatorResult = await fetchIndikators();
      setIndikators(indikatorResult);
      freshData.indikators = indikatorResult;

      // Load instrumens
      const instrumenResult = await fetchInstrumens();
      setInstrumens(instrumenResult);
      freshData.instrumens = instrumenResult;

      // Try to load existing penilaian
      let resolvedPenilaianData = {};
      try {
        const existingData = await fetchPenilaianByNip(nip);
        if (existingData) {
          setExistingPenilaian(existingData);
          // Initialize penilaianData with existing values
          // BE returns: { id, pegawai_id, penilaian: { subindikator_id: "nilai", ... } }
          const initialData = {};
          if (
            existingData.penilaian &&
            typeof existingData.penilaian === "object"
          ) {
            // Build flat list of all subindikators for robust matching
            const allSubs = [];
            indikatorResult.forEach((ind) => {
              if (ind.sub_indikators && ind.sub_indikators.length > 0) {
                ind.sub_indikators.forEach((s) => allSubs.push(s));
              }
            });

            const findMatchingSub = (key) => {
              if (!key) return null;
              const kStr = key;
              // Try direct id match
              let found = allSubs.find((s) => s.id === kStr);
              if (found) return found;
              // Try common alternative fields
              found = allSubs.find(
                (s) =>
                  String(s.uuid || s.uuid_id || s.kode || s.slug || s.id) ===
                  kStr,
              );
              if (found) return found;
              // Try numeric match
              const kNum = Number(key);
              if (!Number.isNaN(kNum)) {
                found = allSubs.find((s) => Number(s.id) === kNum);
                if (found) return found;
              }
              return null;
            };

            Object.entries(existingData.penilaian).forEach(
              ([storedKey, storedVal]) => {
                const matchedSub = findMatchingSub(storedKey);
                const canonicalId = matchedSub
                  ? String(matchedSub.id)
                  : storedKey;

                // Support both legacy scalar format and new object format { nilai, hasil }
                const scalarNilai =
                  storedVal &&
                  typeof storedVal === "object" &&
                  storedVal.nilai !== undefined
                    ? storedVal.nilai
                    : storedVal;

                // Attempt to match an instrumen that belongs to this subindikator and has the same skor
                const matchedInstrumen = instrumenResult.find((instr) => {
                  const instrSubId = String(
                    instr.subindikator_id ||
                      instr.subindikator?.id ||
                      instr.subindikator_id,
                  );
                  return (
                    ((matchedSub && instrSubId === String(matchedSub.id)) ||
                      instrSubId === String(storedKey)) &&
                    parseFloat(instr.skor) === parseFloat(scalarNilai)
                  );
                });

                initialData[canonicalId] = {
                  instrumen_id: matchedInstrumen
                    ? String(matchedInstrumen.id)
                    : null,
                  nilai:
                    scalarNilai !== undefined &&
                    scalarNilai !== null &&
                    scalarNilai !== ""
                      ? parseFloat(scalarNilai)
                      : "",
                };
              },
            );
          }
          resolvedPenilaianData = initialData;
          freshData.existingPenilaian = existingData;
        }
      } catch (error) {
        // No existing penilaian, that's okay
        console.log("No existing penilaian found");
      }

      const normalizedPenilaianData = applyDefaultPenilaianValues(
        resolvedPenilaianData,
        indikatorResult,
        instrumenResult,
      );
      setPenilaianData(normalizedPenilaianData);
      freshData.penilaianData = normalizedPenilaianData;

      // Load pegawai profile
      try {
        const peg = await fetchPegawaiByNip(nip);
        if (peg) {
          setPegawai(peg);
          freshData.pegawai = peg;
          // Load standar kompetensi MSK
          try {
            const standarResult = await fetchStandarKompetensiMSK(
              peg?.jenis_jabatan_id,
            );
            setStandarMSK(standarResult || []);
            freshData.standarMSK = standarResult || [];
          } catch (err) {
            console.error("Could not load standar MSK:", err);
            setStandarMSK([]);
          }
        }
      } catch (err) {
        console.log("Could not load pegawai profile:", err);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "Gagal memuat data",
        confirmButtonColor: PRIMARY_COLORS.blue,
      });
    } finally {
      setLoading(false);
    }
    return freshData;
  };

  const handleBack = () => {
    navigate("/masterdata/penilaian-pegawai");
  };

  // Get instrumens for a specific subindikator
  const getInstrumensForSubindikator = (subindikatorId) => {
    return instrumens
      .filter((instr) => instr.subindikator_id === subindikatorId)
      .sort((a, b) => a.instrumen.localeCompare(b.instrumen));
  };

  // Get standar value for a subindikator from standarMSK
  const getStandarForSub = (subindikatorId) => {
    if (!standarMSK || !Array.isArray(standarMSK)) return null;
    const found = standarMSK.find(
      (s) =>
        s.subindikator_id === subindikatorId ||
        String(s.subindikator_id) === String(subindikatorId) ||
        s.subindikator_id == subindikatorId,
    );
    if (!found) return null;
    const v =
      found.standar !== undefined && found.standar !== null
        ? Number(found.standar)
        : null;
    return Number.isNaN(v) ? null : v;
  };

  // Calculate result for a subindikator
  const calculateResultNumeric = (
    subindikator,
    nilai,
    indikatorName,
    options = {},
  ) => {
    const { clampToStandar = false } = options;
    if (nilai === undefined || nilai === null || nilai === "" || isNaN(nilai))
      return 0;

    const bobot = parseFloat(subindikator.bobot) || 0;
    const nilaiNum = parseFloat(nilai);

    // Check if this is MSK indicator (case-insensitive)
    const isMSK =
      indikatorName?.toLowerCase() ===
      "penilaian kompetensi manajerial dan sosial kultural";

    const isPotensiTalenta =
      indikatorName?.toLowerCase() === "penilaian potensi talenta";

    if (isMSK) {
      // For MSK: hasil = (skor / standar) * 100, then apply bobot percent
      const standar = getStandarForSub(subindikator.id) || 0;
      if (standar === 0) return 0;
      const effectiveNilai = clampToStandar
        ? Math.min(nilaiNum, standar)
        : nilaiNum;
      const pct = (effectiveNilai / standar) * 100;
      const result = pct * (bobot / 100);
      return result;
    }

    if (isPotensiTalenta) {
      // For Potensi: hasil = (skor / standar) * 100, then apply bobot percent
      const standar = 5;
      if (standar === 0) return 0;
      const effectiveNilai = clampToStandar
        ? Math.min(nilaiNum, standar)
        : nilaiNum;
      const pct = (effectiveNilai / standar) * 100;
      const result = pct * (bobot / 100);
      return result;
    }

    // For other indicators: bobot is stored as percent (e.g., 15 => 15%), so divide by 100
    const result = nilaiNum * (bobot / 100);
    return result;
  };

  const calculateResult = (subindikator, nilai, indikatorName, clampToStandar = false) => {
    const result = calculateResultNumeric(subindikator, nilai, indikatorName, {
      clampToStandar: clampToStandar,
    });
    return result.toFixed(2);
  };

  const calculateJPMResultNumeric = (subindikator, nilai, indikatorName) => {
    if (nilai === undefined || nilai === null || nilai === "" || isNaN(nilai))
      return 0;

    const isMSK =
      indikatorName?.toLowerCase() ===
      "penilaian kompetensi manajerial dan sosial kultural";
    const isPotensiTalenta =
      indikatorName?.toLowerCase() === "penilaian potensi talenta";

    if (!isMSK && !isPotensiTalenta) return 0;

    const standar = isMSK ? getStandarForSub(subindikator.id) || 0 : 5;
    if (standar === 0) return 0;

    const nilaiNum = parseFloat(nilai);
    const effectiveNilai = Math.min(nilaiNum, standar);
    return (effectiveNilai / standar) * 100;
  };

  // Handle input change for subindikator
  const handleInputChange = (subindikatorId, field, value) => {
    setPenilaianData((prev) => ({
      ...prev,
      [subindikatorId]: {
        ...prev[subindikatorId],
        [field]: value,
      },
    }));
  };

  // Handle instrumen selection change (includes deselect)
  const handleInstrumenChange = (subindikatorId, instrumenId) => {
    // If cleared/deselected, remove instrumen_id and reset nilai
    if (!instrumenId) {
      setPenilaianData((prev) => ({
        ...prev,
        [subindikatorId]: {
          ...(prev[subindikatorId] || {}),
          instrumen_id: null,
          nilai: "",
        },
      }));
      return;
    }

    const idNum = parseInt(instrumenId);
    const instrumen = instrumens.find(
      (i) => i.id === idNum || String(i.id) === String(instrumenId),
    );
    if (instrumen) {
      setPenilaianData((prev) => ({
        ...prev,
        [subindikatorId]: {
          ...(prev[subindikatorId] || {}),
          instrumen_id: String(instrumenId),
          nilai: instrumen.skor,
        },
      }));
    }
  };

  // Helper to safely read penilaian data using various key forms
  const getPenilaianEntry = (subindikatorId) => {
    if (!penilaianData) return {};
    if (penilaianData[subindikatorId]) return penilaianData[subindikatorId];
    const sidStr = String(subindikatorId);
    if (penilaianData[sidStr]) return penilaianData[sidStr];
    const sidNum = Number(subindikatorId);
    if (!Number.isNaN(sidNum) && penilaianData[sidNum])
      return penilaianData[sidNum];
    return {};
  };

  // Validate all fields are filled
  const validateForm = () => {
    for (const indikator of indikators) {
      if (!indikator.sub_indikators) continue;

      for (const subindikator of indikator.sub_indikators) {
        if (!subindikator.isactive) continue;

        const data = getPenilaianEntry(subindikator.id);
        const hasInstrumens =
          getInstrumensForSubindikator(subindikator.id).length > 0;

        if (!data || !hasFilledValue(data.nilai)) {
          return {
            valid: false,
            message: `Penilaian untuk "${subindikator.subindikator}" wajib diisi`,
          };
        }

        if (hasInstrumens && !hasFilledValue(data.instrumen_id)) {
          return {
            valid: false,
            message: `Instrumen untuk "${subindikator.subindikator}" wajib dipilih`,
          };
        }
      }
    }
    return { valid: true };
  };

  // Calculate total nilai potensial and kinerja from current form data
  const calculateTotalNilai = () => {
    let totalPotensial = 0;
    let totalKinerja = 0;

    for (const indikator of indikators) {
      if (!indikator.sub_indikators) continue;

      const isPotensial =
        (indikator.penilaian || "").toLowerCase() === "potensial";
      const isKinerja = (indikator.penilaian || "").toLowerCase() === "kinerja";

      for (const sub of indikator.sub_indikators) {
        if (!sub.isactive) continue;
        const entry = getPenilaianEntry(sub.id);
        if (
          entry &&
          entry.nilai !== null &&
          entry.nilai !== undefined &&
          entry.nilai !== ""
        ) {
          const nilaiNum = parseFloat(entry.nilai);
          const hasilStr = calculateResult(sub, nilaiNum, indikator.indikator, true);
          const hasilNum = parseFloat(hasilStr);

          if (!Number.isNaN(hasilNum)) {
            if (isPotensial) {
              totalPotensial += hasilNum;
            } else if (isKinerja) {
              totalKinerja += hasilNum;
            }
          }
        }
      }
    }

    const nilaiTalenta = (totalPotensial + totalKinerja) / 2;

    return {
      nilaiPotensial: totalPotensial,
      nilaiKinerja: totalKinerja,
      nilaiTalenta: nilaiTalenta,
    };
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate
    const validation = validateForm();
    if (!validation.valid) {
      Swal.fire({
        icon: "warning",
        title: "Data Tidak Lengkap",
        text: validation.message,
        confirmButtonColor: PRIMARY_COLORS.blue,
      });
      return;
    }

    // Confirm submit
    const confirm = await Swal.fire({
      icon: "question",
      title: "Konfirmasi",
      text: "Apakah Anda yakin ingin menyimpan penilaian ini?",
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: "Simpan",
      cancelButtonText: "Batal",
      confirmButtonColor: PRIMARY_COLORS.blue,
      cancelButtonColor: PRIMARY_COLORS.red,
    });

    if (!confirm.isConfirmed) return;

    try {
      setSubmitting(true);

      // Prepare submission data - format: { pegawai_id, penilaian: { subindikator_id: nilai } }
      // Build submission object using indikator/subindikator structure to ensure correct keys
      const penilaianObj = {};
      for (const indikator of indikators) {
        if (!indikator.sub_indikators) continue;
        for (const sub of indikator.sub_indikators) {
          if (!sub.isactive) continue;
          const entry = getPenilaianEntry(sub.id);
          if (
            entry &&
            entry.nilai !== null &&
            entry.nilai !== undefined &&
            entry.nilai !== ""
          ) {
            // Include both nilai and computed hasil for each subindikator
            const nilaiNum = parseFloat(entry.nilai);
            const hasilNum = calculateResultNumeric(
              sub,
              nilaiNum,
              indikator.indikator,
              { clampToStandar: true },
            );
            penilaianObj[sub.id] = {
              nilai: nilaiNum,
              hasil: Number.isNaN(hasilNum) ? 0 : hasilNum,
            };
          }
        }
      }

      const payload = {
        pegawai_id: pegawai?.id || null,
        penilaian: penilaianObj,
      };

      // Submit or update
      if (existingPenilaian) {
        await updatePenilaian(existingPenilaian.id, payload);
      } else {
        await submitPenilaian(payload);
      }

      await Swal.fire({
        icon: "success",
        title: "Berhasil!",
        text: "Penilaian berhasil disimpan",
        timer: 2000,
        showConfirmButton: false,
      });

      navigate("/masterdata/penilaian-pegawai");
    } catch (error) {
      console.error("Error submitting penilaian:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "Gagal menyimpan penilaian",
        confirmButtonColor: PRIMARY_COLORS.blue,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Dashboard", path: "/", icon: "fas fa-home" },
          { label: "Masterdata", path: "/masterdata", icon: "fas fa-database" },
          {
            label: "Penilaian Pegawai",
            path: "/masterdata/penilaian-pegawai",
            icon: "fas fa-star",
          },
          {
            label: "Input Penilaian",
            path: `/masterdata/input-penilaian/${nip}`,
            icon: "fas fa-edit",
          },
        ]}
      />

      {/* Page Title */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
              Input Penilaian Pegawai
            </h1>
            <p className="mt-2 text-sm md:text-base text-gray-600 dark:text-gray-300">
              Masukkan penilaian berdasarkan indikator dan subindikator yang telah
              ditentukan
            </p>
          </div>
          <div className="flex-shrink-0">
            <IconButton
              onClick={handleSyncPenilaian}
              variant="blue"
              size="lg"
              disabled={isSyncingPenilaian}
              title="Sinkronisasi Penilaian Pegawai Ini"
            >
              {isSyncingPenilaian ? (
                <i className="fas fa-spinner fa-spin mr-2" />
              ) : (
                <i className="fas fa-sync mr-2" />
              )}
              Sinkronisasi Penilaian
            </IconButton>
          </div>
        </div>
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

      {/* Profile Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden mb-6 border border-gray-100 dark:border-gray-700">
        {/* Header with gradient */}
        <div
          className="px-6 py-4"
          style={{ backgroundColor: PRIMARY_COLORS.teal }}
        >
          <div className="flex items-center justify-between">
            <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
              <i className="fas fa-user"></i>
              Profil Pegawai
            </h1>
            <button
              onClick={() =>
                navigate(
                  `/masterdata/penilaian-pegawai/input-penilaian/${nip}/detail`,
                )
              }
              className="cursor-pointer px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-semibold"
              title="Lihat Profil Pegawai"
            >
              <i className="fas fa-eye"></i>
              <span className="hidden sm:inline">Lihat Profil</span>
            </button>
          </div>
        </div>

        {pegawai ? (
          <div className="p-6">
            {/* Profile Section */}
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center mb-6">
              <div className="relative">
                <img
                  src={
                    pegawai.avatar ||
                    pegawai.avatar_url ||
                    pegawai.photo ||
                    pegawai.foto ||
                    "https://ui-avatars.com/api/?name=" +
                      encodeURIComponent(pegawai.nama || pegawai.name || "-") +
                      "&background=3b82f6&color=fff&size=200"
                  }
                  alt={pegawai.nama || pegawai.name || "Avatar"}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover shadow-md ring-4 ring-blue-100 dark:ring-blue-900"
                />
              </div>

              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {pegawai.nama || pegawai.name || "-"}
                </h2>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                    style={{
                      backgroundColor: BG_COLORS.blue.light,
                      color: TEXT_ON_BG_COLORS.blue,
                    }}
                  >
                    <i className="fas fa-id-card mr-1.5 text-sm"></i>
                    {nip}
                  </span>
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                    style={{
                      backgroundColor: BG_COLORS.purple.light,
                      color: TEXT_ON_BG_COLORS.purple,
                    }}
                  >
                    <i className="fas fa-envelope mr-1.5 text-sm"></i>
                    {pegawai.email || pegawai.email_address || "-"}
                  </span>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="flex gap-4 mt-4 md:mt-6">
                <div className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-blue-900 dark:to-blue-800 rounded-lg p-4 text-center min-w-[120px]">
                  <div className="text-md text-teal-500 dark:text-teal-400 mt-1 font-medium">
                    Nilai Potensial
                  </div>
                  <div
                    className="text-3xl font-bold dark:text-teal-300"
                    style={{ color: PRIMARY_COLORS.teal }}
                  >
                    {calculateTotalNilai().nilaiPotensial.toFixed(2)}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg p-4 text-center min-w-[120px]">
                  <div className="text-md text-[#3085d6] dark:text-blue-400 mt-1 font-medium">
                    Nilai Kinerja
                  </div>
                  <div className="text-3xl font-bold text-[#3085d6] dark:text-blue-300">
                    {calculateTotalNilai().nilaiKinerja.toFixed(2)}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 rounded-lg p-4 text-center min-w-[120px]">
                  <div className="text-md text-purple-700 dark:text-purple-400 mt-1 font-medium">
                    Nilai Talenta
                  </div>
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-300">
                    {calculateTotalNilai().nilaiTalenta.toFixed(2)}
                  </div>
                </div>
                {(() => {
                  const { nilaiPotensial, nilaiKinerja } = calculateTotalNilai();
                  const cfg = loadKotakConfig();
                  const kotakId = computeQuadrantDynamic(nilaiPotensial, nilaiKinerja);
                  const kotak =
                    cfg && Array.isArray(cfg.kotak)
                      ? cfg.kotak.find((k) => Number(k.id) === Number(kotakId))
                      : null;
                  const warna = kotak?.warna || "#6366f1";
                  const kategori = kotak?.kategori || "";
                  return (
                    <div
                      className="rounded-lg p-4 text-center min-w-[120px] flex flex-col justify-center"
                      style={{ backgroundColor: warna + "22" }}
                    >
                      <div className="text-sm font-medium mb-1" style={{ color: warna }}>
                        Kotak Talenta
                      </div>
                      <div className="text-3xl font-bold" style={{ color: warna }}>
                        {kotakId ? `Kotak ${kotakId}` : "-"}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                className="bg-gradient-to-br rounded-lg p-4 border"
                style={{
                  backgroundImage: `linear-gradient(to bottom right, ${BG_COLORS.teal.light}, ${BG_COLORS.teal.DEFAULT})`,
                  borderColor: BG_COLORS.teal.light,
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: PRIMARY_COLORS.teal }}
                  >
                    <i className="fas fa-briefcase text-white text-sm"></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium mb-1"
                      style={{ color: PRIMARY_COLORS.teal }}
                    >
                      Jabatan
                    </p>
                    <p
                      className="text-sm font-semibold text-gray-900 dark:text-white truncate"
                      title={
                        pegawai.jabatan ||
                        pegawai.jabatan_name ||
                        pegawai.nama_jabatan ||
                        "-"
                      }
                    >
                      {pegawai.jabatan ||
                        pegawai.jabatan_name ||
                        pegawai.nama_jabatan ||
                        "-"}
                    </p>
                  </div>
                </div>
              </div>
              <div
                className="bg-gradient-to-br rounded-lg p-4 border"
                style={{
                  backgroundImage: `linear-gradient(to bottom right, ${BG_COLORS.blue.light}, ${BG_COLORS.blue.DEFAULT})`,
                  borderColor: BG_COLORS.blue.light,
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: PRIMARY_COLORS.blue }}
                  >
                    <i className="fas fa-building text-white text-sm"></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium mb-1"
                      style={{ color: PRIMARY_COLORS.blue }}
                    >
                      Unit Kerja
                    </p>
                    <p
                      className="text-sm font-semibold text-gray-900 dark:text-white truncate"
                      title={
                        pegawai.unit_kerja ||
                        pegawai.unit_organisasi_name ||
                        pegawai.unitKerja ||
                        "-"
                      }
                    >
                      {pegawai.unit_kerja ||
                        pegawai.unit_organisasi_name ||
                        pegawai.unitKerja ||
                        "-"}
                    </p>
                  </div>
                </div>
              </div>
              <div
                className="bg-gradient-to-br rounded-lg p-4 border"
                style={{
                  backgroundImage: `linear-gradient(to bottom right, ${BG_COLORS.purple.light}, ${BG_COLORS.purple.DEFAULT})`,
                  borderColor: BG_COLORS.purple.light,
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: PRIMARY_COLORS.purple }}
                  >
                    <i className="fas fa-user-tie text-white text-sm"></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium mb-1"
                      style={{ color: PRIMARY_COLORS.purple }}
                    >
                      Jenis Jabatan
                    </p>
                    <p
                      className="text-sm font-semibold text-gray-900 dark:text-white truncate"
                      title={
                        pegawai.jenis_jabatan || pegawai.jenisJabatan || "-"
                      }
                    >
                      {pegawai.jenis_jabatan || pegawai.jenisJabatan || "-"}
                    </p>
                  </div>
                </div>
              </div>
              <div
                className="bg-gradient-to-br rounded-lg p-4 border"
                style={{
                  backgroundImage: `linear-gradient(to bottom right, ${BG_COLORS.orange.light}, ${BG_COLORS.orange.DEFAULT})`,
                  borderColor: BG_COLORS.orange.light,
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: PRIMARY_COLORS.orange }}
                  >
                    <i className="fas fa-award text-white text-sm"></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium mb-1"
                      style={{ color: PRIMARY_COLORS.orange }}
                    >
                      Golongan
                    </p>
                    <p
                      className="text-sm font-semibold text-gray-900 dark:text-white truncate"
                      title={pegawai.golongan || pegawai.gol || "-"}
                    >
                      {pegawai.golongan || pegawai.gol || "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8">
            <div className="flex items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
              <div className="relative">
                <div className="animate-spin rounded-full h-6 w-6 border-3 border-gray-200 dark:border-gray-700"></div>
                <div
                  className="animate-spin rounded-full h-6 w-6 border-3 border-r-transparent border-b-transparent border-l-transparent absolute top-0 left-0"
                  style={{ borderTopColor: PRIMARY_COLORS.teal }}
                ></div>
              </div>
              <span className="text-sm">Memuat profil pegawai...</span>
            </div>
          </div>
        )}
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-100 dark:border-gray-700">
        {/* Header with gradient */}
        <div
          className="px-6 py-4"
          style={{ backgroundColor: PRIMARY_COLORS.teal }}
        >
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-clipboard-check"></i>
            Form Penilaian
          </h1>
        </div>

        {loading ? (
          <div className="p-6">
            <div className="flex flex-col items-center justify-center py-6">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700"></div>
                <div
                  className="animate-spin rounded-full h-12 w-12 border-4 border-r-transparent border-b-transparent border-l-transparent absolute top-0 left-0"
                  style={{ borderTopColor: PRIMARY_COLORS.teal }}
                ></div>
              </div>
              <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                Memuat form...
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex flex-wrap border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
              {indikators.map((indikator, idx) => {
                const activeSubindikators = (
                  indikator.sub_indikators || []
                ).filter((sub) => sub.isactive);
                if (activeSubindikators.length === 0) return null;

                return (
                  <button
                    key={indikator.id}
                    type="button"
                    onClick={() => setActiveTab(idx)}
                    className={`px-6 py-4 text-sm font-semibold transition-all border-b-2 cursor-pointer ${
                      activeTab === idx
                        ? "bg-white dark:bg-gray-800"
                        : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300"
                    }`}
                    style={
                      activeTab === idx
                        ? {
                            borderColor: PRIMARY_COLORS.teal,
                            color: PRIMARY_COLORS.teal,
                          }
                        : {}
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          activeTab === idx ? "" : "bg-gray-400"
                        }`}
                        style={
                          activeTab === idx
                            ? { backgroundColor: PRIMARY_COLORS.teal }
                            : {}
                        }
                      ></span>
                      {indikator.indikator} ({indikator.penilaian})
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            {indikators.map((indikator, idx) => {
              if (activeTab !== idx) return null;

              const activeSubindikators = (
                indikator.sub_indikators || []
              ).filter((sub) => sub.isactive);

              if (activeSubindikators.length === 0) return null;

              const isMSKIndicatorForJPM =
                indikator.indikator?.toLowerCase() ===
                "penilaian kompetensi manajerial dan sosial kultural";
              const isPotensiTalentaIndicatorForJPM =
                indikator.indikator?.toLowerCase() ===
                "penilaian potensi talenta";
              const isJPMIndicator =
                isMSKIndicatorForJPM ||
                isPotensiTalentaIndicatorForJPM;

              const totalJPM = isJPMIndicator
                ? activeSubindikators.reduce((acc, sub) => {
                    const entry = getPenilaianEntry(sub.id);
                    const hasilNum = calculateJPMResultNumeric(
                      sub,
                      entry?.nilai,
                      indikator.indikator,
                    );
                    return acc + (Number.isNaN(hasilNum) ? 0 : hasilNum);
                  }, 0)
                : 0;

              const averageJPM =
                isJPMIndicator && activeSubindikators.length > 0
                  ? totalJPM / activeSubindikators.length
                  : 0;

              return (
                <div key={indikator.id}>
                  {/* Indikator Header */}
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-gray-700 dark:to-gray-750 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <span
                            className="w-1.5 h-6 rounded-full"
                            style={{ background: PRIMARY_COLORS.teal }}
                          ></span>
                          {indikator.indikator}
                        </h2>
                        <div className="flex items-center gap-3 mt-2">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-sm font-semibold"
                            style={{
                              background: `${PRIMARY_COLORS.teal}1F`,
                              color: PRIMARY_COLORS.teal,
                            }}
                          >
                            {indikator.penilaian}
                          </span>
                          {indikator.penilaian !== "Tambahan" && (
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Bobot: {indikator.bobot}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Subindikators */}
                  <div className="p-6 space-y-5">
                    {activeSubindikators.map((subindikator, sidx) => {
                      const subInstrumens = getInstrumensForSubindikator(
                        subindikator.id,
                      );
                      const hasInstrumens = subInstrumens.length > 0;
                      const currentData =
                        getPenilaianEntry(subindikator.id) || {};
                      const currentNilai =
                        currentData.nilai !== undefined &&
                        currentData.nilai !== null
                          ? currentData.nilai
                          : "";
                      const currentResult = calculateResult(
                        subindikator,
                        currentNilai,
                        indikator.indikator,
                      );

                      // Check if this is Penilaian Tambahan
                      const isPenilaianTambahan =
                        indikator.penilaian?.toLowerCase() === "tambahan";

                      // Determine grid columns based on conditions
                      const isMSK =
                        indikator.indikator?.toLowerCase() ===
                        "penilaian kompetensi manajerial dan sosial kultural";
                      const isPotensiTalenta =
                        indikator.indikator?.toLowerCase() ===
                        "penilaian potensi talenta";
                      const hasStandar = isMSK || isPotensiTalenta;

                      let gridCols = "grid-cols-1 md:grid-cols-1";
                      if (isPenilaianTambahan) {
                        // For Penilaian Tambahan: Input + Skor (if has instrumens)
                        gridCols = "grid-cols-1 md:grid-cols-2";
                      } else {
                        // For other penilaian types
                        if (hasInstrumens && hasStandar) {
                          gridCols = "grid-cols-1 md:grid-cols-4"; // Input + Skor + Standar + Result
                        } else if (hasInstrumens || hasStandar) {
                          gridCols = "grid-cols-1 md:grid-cols-3"; // Input + (Skor or Standar) + Result
                        } else {
                          gridCols = "grid-cols-1 md:grid-cols-2"; // Input + Result
                        }
                      }

                      return (
                        <div
                          key={subindikator.id}
                          className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800/50 rounded-lg p-5 border border-gray-200 dark:border-gray-600 transition-colors"
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.borderColor =
                              PRIMARY_COLORS.teal)
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.borderColor = "")
                          }
                        >
                          <div className="flex items-start gap-3 mb-4">
                            <div
                              className="flex items-center justify-center w-8 h-8 rounded-lg text-white text-sm font-bold flex-shrink-0"
                              style={{ background: PRIMARY_COLORS.teal }}
                            >
                              {sidx + 1}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                                {subindikator.subindikator}
                              </h3>
                              {!isPenilaianTambahan && (
                                <div className="mt-1">
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    Bobot: {subindikator.bobot}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className={`grid ${gridCols} gap-4`}>
                            {/* Input Column */}
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                {hasInstrumens
                                  ? "Pilih Penilaian"
                                  : "Input Skor"}{" "}
                                {!isPenilaianTambahan && (
                                  <span className="text-red-500">*</span>
                                )}
                              </label>
                              <div className="flex items-start gap-3">
                                <div className="flex-1">
                                  {hasInstrumens ? (
                                    <SearchableSelect
                                      value={currentData.instrumen_id || ""}
                                      onChange={(value) =>
                                        handleInstrumenChange(
                                          subindikator.id,
                                          value,
                                        )
                                      }
                                      options={subInstrumens.map((instr) => ({
                                        value: String(instr.id),
                                        label: `${instr.instrumen} (Skor: ${instr.skor})`,
                                      }))}
                                      placeholder="-- Pilih Penilaian --"
                                      disabled={!!subindikator.auto_sync}
                                    />
                                  ) : (
                                    <div className="relative">
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max={
                                          indikator.indikator?.toLowerCase() ===
                                            "Penilaian Kompetensi Manajerial dan Sosial Kultural".toLowerCase() ||
                                          indikator.indikator?.toLowerCase() ===
                                            "Penilaian Potensi Talenta".toLowerCase()
                                            ? "5"
                                            : "100"
                                        }
                                        value={currentNilai}
                                        onChange={(e) =>
                                          !subindikator.auto_sync &&
                                          handleInputChange(
                                            subindikator.id,
                                            "nilai",
                                            e.target.value,
                                          )
                                        }
                                        readOnly={!!subindikator.auto_sync}
                                        className={`block w-full px-3 py-2 border-2 rounded-lg shadow-sm focus:outline-none font-medium transition-all ${
                                          subindikator.auto_sync
                                            ? "border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white cursor-not-allowed"
                                            : "border-gray-300 dark:border-gray-600 focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        }`}
                                        style={{
                                          "--tw-ring-color":
                                            PRIMARY_COLORS.teal,
                                        }}
                                        onFocus={(e) => {
                                          if (!subindikator.auto_sync)
                                            e.target.style.borderColor =
                                              PRIMARY_COLORS.teal;
                                        }}
                                        onBlur={(e) =>
                                          (e.target.style.borderColor = "")
                                        }
                                        placeholder="0.00"
                                        required={
                                          !isPenilaianTambahan &&
                                          !subindikator.auto_sync
                                        }
                                      />
                                      {subindikator.auto_sync && (
                                        <div className="absolute inset-y-0 right-3 top-3 flex items-center pointer-events-none">
                                          <i className="fas fa-lock text-sm text-gray-400"></i>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Skor/Nilai Column */}
                            {hasInstrumens && (
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                  Skor
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={currentNilai}
                                    readOnly
                                    className="block w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg shadow-sm bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white font-semibold cursor-not-allowed"
                                    placeholder="0.00"
                                  />
                                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                    <i className="fas fa-lock text-sm text-gray-400"></i>
                                  </div>
                                </div>
                              </div>
                            )}

                            {(indikator.indikator?.toLowerCase() ===
                              "penilaian kompetensi manajerial dan sosial kultural" ||
                              indikator.indikator?.toLowerCase() ===
                                "penilaian potensi talenta") && (
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                  Standar
                                </label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={
                                      indikator.indikator?.toLowerCase() ===
                                      "penilaian kompetensi manajerial dan sosial kultural"
                                        ? getStandarForSub(subindikator.id) !==
                                          null
                                          ? getStandarForSub(subindikator.id)
                                          : "-"
                                        : 5
                                    }
                                    readOnly
                                    className="block w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg shadow-sm bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white font-semibold cursor-not-allowed"
                                  />
                                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                    <i className="fas fa-lock text-sm text-gray-400"></i>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Result Column - Hidden for Penilaian Tambahan */}
                            {!isPenilaianTambahan && (
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                  {indikator.indikator?.toLowerCase() ===
                                    "penilaian kompetensi manajerial dan sosial kultural" ||
                                  indikator.indikator?.toLowerCase() ===
                                    "penilaian potensi talenta"
                                    ? "Hasil (Skor ÷ Standar × 100 × Bobot)"
                                    : "Hasil (Skor × Bobot)"}
                                </label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={currentResult}
                                    readOnly
                                    className="block w-full px-3 py-1.5 rounded-lg shadow-sm font-bold cursor-not-allowed text-lg"
                                    style={{
                                      border: `2px solid ${PRIMARY_COLORS.teal}30`,
                                      background: `${PRIMARY_COLORS.teal}15`,
                                      color: PRIMARY_COLORS.teal,
                                    }}
                                    placeholder="0.00"
                                  />
                                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                    <i
                                      className="fas fa-calculator text-sm"
                                      style={{ color: PRIMARY_COLORS.teal }}
                                    ></i>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                        </div>
                      );
                    })}

                    {isJPMIndicator && (
                      <div className="mt-1 flex justify-end">
                        <div className="px-3 py-2 rounded-lg border border-teal-200 bg-teal-50 dark:bg-teal-950/40 dark:border-teal-800">
                          <span className="text-sm font-semibold text-teal-700 dark:text-teal-300">
                            JPM: {averageJPM.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Submit Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 p-6">
              <IconButton
                type="button"
                onClick={handleBack}
                variant="default"
                size="lg"
                disabled={submitting}
                title="Batal"
              >
                <i className="far fa-times-circle mr-2" />
                Batal
              </IconButton>
              <IconButton
                type="submit"
                variant="primary"
                size="lg"
                disabled={submitting}
                title="Simpan Penilaian"
              >
                {submitting ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save mr-2" />
                    Simpan Penilaian
                  </>
                )}
              </IconButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default InputPenilaian;
