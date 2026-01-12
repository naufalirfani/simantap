import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import IconButton from "../../components/IconButton";
import SearchableSelect from "../../components/SearchableSelect";
import {
  fetchIndikators,
  fetchInstrumens,
  fetchPenilaianByNip,
  submitPenilaian,
  updatePenilaian,
  fetchPegawaiByNip,
  fetchStandarKompetensiMSK,
} from "../../services/apiService";
import Swal from "sweetalert2";

const InputPenilaian = () => {
  const { nip } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [indikators, setIndikators] = useState([]);
  const [instrumens, setInstrumens] = useState([]);
  const [standarMSK, setStandarMSK] = useState([]);
  const [pegawai, setPegawai] = useState(null);
  const [penilaianData, setPenilaianData] = useState({});
  const [existingPenilaian, setExistingPenilaian] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    document.title = `Input Penilaian | SIMANTAP`;
    loadData();
  }, [nip]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load indikators with subindikators
      const indikatorResult = await fetchIndikators();
      setIndikators(indikatorResult);

      // Load instrumens
      const instrumenResult = await fetchInstrumens();
      setInstrumens(instrumenResult);

      // Load standar kompetensi MSK
      try {
        const standarResult = await fetchStandarKompetensiMSK();
        setStandarMSK(standarResult || []);
      } catch (err) {
        console.error("Could not load standar MSK:", err);
        setStandarMSK([]);
      }

      // Try to load existing penilaian
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
                  kStr
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
                  storedVal && typeof storedVal === "object" &&
                  storedVal.nilai !== undefined
                    ? storedVal.nilai
                    : storedVal;

                // Attempt to match an instrumen that belongs to this subindikator and has the same skor
                const matchedInstrumen = instrumenResult.find((instr) => {
                  const instrSubId = String(
                    instr.subindikator_id || instr.subindikator?.id || instr.subindikator_id
                  );
                  return (
                    ((matchedSub && instrSubId === String(matchedSub.id)) ||
                      instrSubId === String(storedKey)) &&
                    parseFloat(instr.skor) === parseFloat(scalarNilai)
                  );
                });

                initialData[canonicalId] = {
                  instrumen_id: matchedInstrumen ? String(matchedInstrumen.id) : null,
                  nilai:
                    scalarNilai !== undefined && scalarNilai !== null && scalarNilai !== ""
                      ? parseFloat(scalarNilai)
                      : "",
                };
              }
            );
          }
          setPenilaianData(initialData);
        }
      } catch (error) {
        // No existing penilaian, that's okay
        console.log("No existing penilaian found");
      }

      // Load pegawai profile
      try {
        const peg = await fetchPegawaiByNip(nip);
        if (peg) setPegawai(peg);
      } catch (err) {
        console.log("Could not load pegawai profile:", err);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "Gagal memuat data",
        confirmButtonColor: "#3B82F6",
      });
    } finally {
      setLoading(false);
    }
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
        s.subindikator_id == subindikatorId
    );
    if (!found) return null;
    const v =
      found.standar !== undefined && found.standar !== null
        ? Number(found.standar)
        : null;
    return Number.isNaN(v) ? null : v;
  };

  // Calculate result for a subindikator
  const calculateResult = (subindikator, nilai, indikatorName) => {
    if (nilai === undefined || nilai === null || nilai === "" || isNaN(nilai))
      return (0).toFixed(2);
    const bobot = parseFloat(subindikator.bobot) || 0;
    const nilaiNum = parseFloat(nilai);

    // Check if this is MSK indicator (case-insensitive)
    const isMSK =
      indikatorName?.toLowerCase() ===
      "penilaian kompetensi manajerial dan sosial kultural";

    if (isMSK) {
      // For MSK: hasil = (skor / standar) * 100, then apply bobot percent
      const standar = getStandarForSub(subindikator.id) || 0;
      if (standar === 0) return (0).toFixed(2);
      const pct = (nilaiNum / standar) * 100;
      const result = pct * (bobot / 100);
      return result.toFixed(2);
    }

    // For other indicators: bobot is stored as percent (e.g., 15 => 15%), so divide by 100
    const result = nilaiNum * (bobot / 100);
    return result.toFixed(2);
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
      (i) => i.id === idNum || String(i.id) === String(instrumenId)
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

        if (!data || !data.nilai) {
          return {
            valid: false,
            message: `Penilaian untuk "${subindikator.subindikator}" wajib diisi`,
          };
        }

        if (hasInstrumens && !data.instrumen_id) {
          return {
            valid: false,
            message: `Instrumen untuk "${subindikator.subindikator}" wajib dipilih`,
          };
        }
      }
    }
    return { valid: true };
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
        confirmButtonColor: "#3B82F6",
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
      confirmButtonColor: "#3B82F6",
      cancelButtonColor: "#d33",
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
            const hasilStr = calculateResult(sub, nilaiNum, indikator.indikator);
            const hasilNum = parseFloat(hasilStr);
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
        confirmButtonColor: "#3B82F6",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
            Input Penilaian Pegawai
          </h1>
          <p className="mt-2 text-sm md:text-base text-gray-600 dark:text-gray-300">
            Masukkan penilaian berdasarkan indikator dan subindikator yang telah
            ditentukan
          </p>
        </div>
      </div>
      {/* Back Button */}
      <div className="mb-4">
        <IconButton
          onClick={handleBack}
          variant="secondary"
          size="lg"
          title="Kembali"
        >
          <i className="fas fa-arrow-left mr-2" /> Kembali
        </IconButton>
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-6 border border-gray-100 dark:border-gray-700">
        {/* Header with gradient */}
        <div className="bg-[#3B82F6] px-6 py-4">
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-user"></i>
            Profil Pegawai
          </h1>
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
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#3B82F6]/10 text-[#3B82F6] dark:bg-[#3B82F6] dark:text-white">
                    <i className="fas fa-id-card mr-1.5 text-sm"></i>
                    {nip}
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#7a5cd6]/10 text-[#7a5cd6] dark:bg-[#7a5cd6] dark:text-white">
                    <i className="fas fa-envelope mr-1.5 text-sm"></i>
                    {pegawai.email || pegawai.email_address || "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-[#fbf8ff] to-[#f5f0ff] dark:from-[#0f0820]/5 dark:to-[#1b1530]/5 rounded-lg p-4 border border-[#efe7ff] dark:border-[#3b2b66]">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#7a5cd6] rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-briefcase text-white text-sm"></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#7a5cd6] dark:text-[#bfaef5] mb-1">
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
              <div className="bg-gradient-to-br from-[#eef8ff] to-[#eaf4ff] dark:from-[#07102a]/5 dark:to-[#15203a]/5 rounded-lg p-4 border border-[#dbeeff] dark:border-[#2b4a7a]">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#3B82F6] rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-building text-white text-sm"></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#3B82F6] dark:text-[#9ecaf9] mb-1">
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
              <div className="bg-gradient-to-br from-[#fffaf4] to-[#fff6ee] dark:from-[#2b1505]/5 dark:to-[#381f07]/5 rounded-lg p-4 border border-[#fff0d9] dark:border-[#5a3d12]">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#f39c12] rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-user-tie text-white text-sm"></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#f39c12] dark:text-[#ffd9a8] mb-1">
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
              <div className="bg-gradient-to-br from-[#f7fff6] to-[#f1fff0] dark:from-[#07140a]/5 dark:to-[#0f2814]/5 rounded-lg p-4 border border-[#e7ffea] dark:border-[#11421d]">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#2fa84f] rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-award text-white text-sm"></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#2fa84f] dark:text-[#9ef0b6] mb-1">
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
                <div className="animate-spin rounded-full h-6 w-6 border-3 border-t-[#3B82F6] border-r-transparent border-b-transparent border-l-transparent absolute top-0 left-0"></div>
              </div>
              <span className="text-sm">Memuat profil pegawai...</span>
            </div>
          </div>
        )}
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-100 dark:border-gray-700">
        {/* Header with gradient */}
        <div className="bg-[#3B82F6] px-6 py-4">
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
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-[#3B82F6] border-r-transparent border-b-transparent border-l-transparent absolute top-0 left-0"></div>
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
                        ? "border-[#3B82F6] text-[#3B82F6] bg-white dark:bg-gray-800"
                        : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          activeTab === idx ? "bg-[#3B82F6]" : "bg-gray-400"
                        }`}
                      ></span>
                      {indikator.indikator}
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

              return (
                <div key={indikator.id}>
                  {/* Indikator Header */}
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-gray-700 dark:to-gray-750 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <span
                            className="w-1.5 h-6 rounded-full"
                            style={{ background: "#3B82F6" }}
                          ></span>
                          {indikator.indikator}
                        </h2>
                        <div className="flex items-center gap-3 mt-2">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-sm font-semibold"
                            style={{
                              background: "rgba(48,133,214,0.12)",
                              color: "#3B82F6",
                            }}
                          >
                            {indikator.penilaian}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Bobot: {indikator.bobot}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Subindikators */}
                  <div className="p-6 space-y-5">
                    {activeSubindikators.map((subindikator, sidx) => {
                      const subInstrumens = getInstrumensForSubindikator(
                        subindikator.id
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
                        indikator.indikator
                      );

                      return (
                        <div
                          key={subindikator.id}
                          className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800/50 rounded-lg p-5 border border-gray-200 dark:border-gray-600 hover:border-[#3B82F6] dark:hover:border-[#7a5cd6] transition-colors"
                        >
                          <div className="flex items-start gap-3 mb-4">
                            <div
                              className="flex items-center justify-center w-8 h-8 rounded-lg text-white text-sm font-bold flex-shrink-0"
                              style={{ background: "#3B82F6" }}
                            >
                              {sidx + 1}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                                {subindikator.subindikator}
                              </h3>
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                Bobot: {subindikator.bobot}%
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Input Column */}
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                {hasInstrumens
                                  ? "Pilih Penilaian"
                                  : "Input Skor"}{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <div className="flex items-start gap-3">
                                <div className="flex-1">
                                  {hasInstrumens ? (
                                    <SearchableSelect
                                      value={currentData.instrumen_id || ""}
                                      onChange={(value) =>
                                        handleInstrumenChange(
                                          subindikator.id,
                                          value
                                        )
                                      }
                                      options={subInstrumens.map((instr) => ({
                                        value: String(instr.id),
                                        label: `${instr.instrumen} (Skor: ${instr.skor})`,
                                      }))}
                                      placeholder="-- Pilih Penilaian --"
                                    />
                                  ) : (
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max={
                                        indikator.indikator?.toLowerCase() ===
                                        "Penilaian Kompetensi Manajerial dan Sosial Kultural".toLowerCase()
                                          ? "5"
                                          : "100"
                                      }
                                      value={currentNilai}
                                      onChange={(e) =>
                                        handleInputChange(
                                          subindikator.id,
                                          "nilai",
                                          e.target.value
                                        )
                                      }
                                      className="block w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium transition-all"
                                      placeholder="0.00"
                                      required
                                    />
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
                                    className="block w-full px-4 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg shadow-sm bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white font-semibold cursor-not-allowed"
                                    placeholder="0.00"
                                  />
                                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                    <i className="fas fa-lock text-gray-400 text-sm"></i>
                                  </div>
                                </div>
                              </div>
                            )}

                            {indikator.indikator?.toLowerCase() ===
                              "penilaian kompetensi manajerial dan sosial kultural" && (
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                  Standar
                                </label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={
                                      getStandarForSub(subindikator.id) !== null
                                        ? getStandarForSub(subindikator.id)
                                        : "-"
                                    }
                                    readOnly
                                    className="block w-full px-4 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg shadow-sm bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white font-semibold cursor-not-allowed"
                                  />
                                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                    <i className="fas fa-lock text-gray-400 text-sm"></i>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Result Column */}
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                {indikator.indikator?.toLowerCase() ===
                                "penilaian kompetensi manajerial dan sosial kultural"
                                  ? "Hasil (Skor ÷ Standar × 100 × Bobot)"
                                  : "Hasil (Skor × Bobot)"}
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={currentResult}
                                  readOnly
                                  className="block w-full px-4 py-2.5 rounded-lg shadow-sm font-bold cursor-not-allowed text-lg"
                                  style={{
                                    border: "2px solid rgba(48,133,214,0.18)",
                                    background: "#eaf4ff",
                                    color: "#3B82F6",
                                  }}
                                  placeholder="0.00"
                                />
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                  <i
                                    className="fas fa-calculator text-sm"
                                    style={{ color: "#3B82F6" }}
                                  ></i>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
