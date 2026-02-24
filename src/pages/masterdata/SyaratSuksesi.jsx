import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import IconButton from "../../components/IconButton";
import SearchableSelect from "../../components/SearchableSelect";
import Breadcrumb from "../../components/Breadcrumb";
import {
  fetchIndikators,
  fetchInstrumens,
  fetchSyaratSuksesi,
  createSyaratSuksesi,
  updateSyaratSuksesi,
} from "../../services/apiService";
import Swal from "sweetalert2";
import { PRIMARY_COLORS, DARK_COLORS } from "../../config/colors";

const SyaratSuksesi = () => {
  const { jabatanId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [indikators, setIndikators] = useState([]);
  const [instrumens, setInstrumens] = useState([]);
  const [syaratData, setSyaratData] = useState({});
  const [existingSyarat, setExistingSyarat] = useState(null);
  const [jabatan, setJabatan] = useState(null);

  useEffect(() => {
    document.title = `Syarat Suksesi | SIMANTAP`;
    
    // Get jabatan info from location state
    if (location.state && location.state.jabatan) {
      setJabatan(location.state.jabatan);
    }
    
    loadData();
  }, [jabatanId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load indikators with subindikators
      const indikatorResult = await fetchIndikators();
      setIndikators(indikatorResult);

      // Load instrumens
      const instrumenResult = await fetchInstrumens();
      setInstrumens(instrumenResult);

      // Try to load existing syarat suksesi
      try {
        const existingData = await fetchSyaratSuksesi(jabatanId);
        
        if (existingData && existingData.id) {
            setExistingSyarat(existingData);
            
            // Initialize syaratData with existing values
            const initialData = {};
            if (existingData.syarat && typeof existingData.syarat === "object") {
              // Build flat list of all subindikators
              const allSubs = [];
              indikatorResult.forEach((ind) => {
                if (ind.sub_indikators && ind.sub_indikators.length > 0) {
                  ind.sub_indikators.forEach((s) => allSubs.push(s));
                }
              });

              const findMatchingSub = (key) => {
                if (!key) return null;
                const kStr = key;
                let found = allSubs.find((s) => s.id === kStr);
                if (found) return found;
                found = allSubs.find(
                  (s) =>
                    String(s.uuid || s.uuid_id || s.kode || s.slug || s.id) === kStr
                );
                if (found) return found;
                const kNum = Number(key);
                if (!Number.isNaN(kNum)) {
                  found = allSubs.find((s) => Number(s.id) === kNum);
                  if (found) return found;
                }
                return null;
              };

              Object.entries(existingData.syarat).forEach(
                ([storedKey, storedVal]) => {
                  const matchedSub = findMatchingSub(storedKey);
                  const canonicalId = matchedSub
                    ? String(matchedSub.id)
                    : storedKey;

                  const scalarNilai =
                    storedVal &&
                    typeof storedVal === "object" &&
                    storedVal.nilai !== undefined
                      ? storedVal.nilai
                      : storedVal;

                  // Attempt to match an instrumen
                  const matchedInstrumen = instrumenResult.find((instr) => {
                    const instrSubId = String(
                      instr.subindikator_id ||
                        instr.subindikator?.id ||
                        instr.subindikator_id
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
                }
              );
            }
            setSyaratData(initialData);
          }
      } catch (error) {
        console.log("No existing syarat suksesi found");
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
  };

  const handleBack = () => {
    navigate("/masterdata/jabatan");
  };

  // Get instrumens for a specific subindikator
  const getInstrumensForSubindikator = (subindikatorId) => {
    return instrumens
      .filter((instr) => instr.subindikator_id === subindikatorId)
      .sort((a, b) => a.instrumen.localeCompare(b.instrumen));
  };

  // Handle instrumen selection change
  const handleInstrumenChange = (subindikatorId, instrumenId) => {
    if (!instrumenId) {
      setSyaratData((prev) => ({
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
      setSyaratData((prev) => ({
        ...prev,
        [subindikatorId]: {
          ...(prev[subindikatorId] || {}),
          instrumen_id: String(instrumenId),
          nilai: instrumen.skor,
        },
      }));
    }
  };

  // Handle input change for subindikator
  const handleInputChange = (subindikatorId, field, value) => {
    setSyaratData((prev) => ({
      ...prev,
      [subindikatorId]: {
        ...prev[subindikatorId],
        [field]: value,
      },
    }));
  };

  // Helper to safely read syarat data
  const getSyaratEntry = (subindikatorId) => {
    if (!syaratData) return {};
    if (syaratData[subindikatorId]) return syaratData[subindikatorId];
    const sidStr = String(subindikatorId);
    if (syaratData[sidStr]) return syaratData[sidStr];
    const sidNum = Number(subindikatorId);
    if (!Number.isNaN(sidNum) && syaratData[sidNum])
      return syaratData[sidNum];
    return {};
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Confirm submit
    const confirm = await Swal.fire({
      icon: "question",
      title: "Konfirmasi",
      text: "Apakah Anda yakin ingin menyimpan syarat suksesi ini?",
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

      // Prepare submission data
      const syaratObj = {};
      for (const indikator of indikators) {
        if (!indikator.sub_indikators) continue;
        for (const sub of indikator.sub_indikators) {
          if (!sub.isactive) continue;
          const entry = getSyaratEntry(sub.id);
          if (
            entry &&
            entry.nilai !== null &&
            entry.nilai !== undefined &&
            entry.nilai !== ""
          ) {
            const nilaiNum = parseFloat(entry.nilai);
            syaratObj[sub.id] = nilaiNum;
          }
        }
      }

      const payload = {
        jabatan_id: jabatanId,
        syarat: syaratObj,
      };

      if (existingSyarat) {
        await updateSyaratSuksesi(existingSyarat.id, payload);
      } else {
        await createSyaratSuksesi(payload);
      }

      await Swal.fire({
        icon: "success",
        title: "Berhasil!",
        text: "Syarat suksesi berhasil disimpan",
        timer: 2000,
        showConfirmButton: false,
      });

      navigate("/masterdata/jabatan");
    } catch (error) {
      console.error("Error submitting syarat suksesi:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "Gagal menyimpan syarat suksesi",
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
            label: "Jabatan",
            path: "/masterdata/jabatan",
            icon: "fas fa-briefcase",
          },
          {
            label: "Syarat Suksesi",
            path: `/masterdata/jabatan/${jabatanId}/syarat-suksesi`,
            icon: "fas fa-clipboard-check",
          },
        ]}
      />

      {/* Page Title */}
      <div className="mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
            Syarat Suksesi
          </h1>
          <p className="mt-2 text-sm md:text-base text-gray-600 dark:text-gray-300">
            Tentukan standar minimal untuk setiap subindikator jabatan
          </p>
        </div>
      </div>

      {/* Jabatan Info Card */}
      {jabatan && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-6 border border-gray-100 dark:border-gray-700">
          <div className="px-6 py-4" style={{ background: `linear-gradient(to right, ${PRIMARY_COLORS.teal}, ${DARK_COLORS.teal})` }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <i className="fas fa-briefcase text-white text-xl"></i>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-white">
                  Informasi Jabatan
                </h2>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br rounded-lg p-4 border" style={{ backgroundImage: 'linear-gradient(to bottom right, #f0fdfa, #ccfbf1)', borderColor: '#b2f5ea' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: PRIMARY_COLORS.teal }}>
                    <i className="fas fa-briefcase text-white text-sm"></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium mb-1" style={{ color: PRIMARY_COLORS.teal }}>
                      Nama Jabatan
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white break-words">
                      {jabatan.nama_jabatan || "-"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br rounded-lg p-4 border" style={{ backgroundImage: 'linear-gradient(to bottom right, #eef8ff, #eaf4ff)', borderColor: '#dbeeff' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: PRIMARY_COLORS.blue }}>
                    <i className="fas fa-building text-white text-sm"></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium mb-1" style={{ color: PRIMARY_COLORS.blue }}>
                      Unit Kerja
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white break-words">
                      {jabatan.unit_kerja || "-"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br rounded-lg p-4 border" style={{ backgroundImage: 'linear-gradient(to bottom right, #fbf8ff, #f5f0ff)', borderColor: '#efe7ff' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: PRIMARY_COLORS.purple }}>
                    <i className="fas fa-layer-group text-white text-sm"></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium mb-1" style={{ color: PRIMARY_COLORS.purple }}>
                      Jenis Jabatan
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white break-words">
                      {jabatan.jenis_jabatan || "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="px-6 py-4" style={{ background: `linear-gradient(to right, ${PRIMARY_COLORS.teal}, ${DARK_COLORS.teal})` }}>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-clipboard-list"></i>
            Form Syarat Suksesi
          </h1>
        </div>

        {loading ? (
          <div className="p-6">
            <div className="flex flex-col items-center justify-center py-6">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700"></div>
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-r-transparent border-b-transparent border-l-transparent absolute top-0 left-0" style={{ borderTopColor: PRIMARY_COLORS.teal }}></div>
              </div>
              <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                Memuat form...
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="p-6">
              {indikators.map((indikator) => {
                const activeSubindikators = (
                  indikator.sub_indikators || []
                ).filter((sub) => sub.isactive);
                
                if (activeSubindikators.length === 0) return null;

                return (
                  <div key={indikator.id} className="mb-8 last:mb-0">
                    {/* Indikator Header */}
                    <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-gray-700 dark:to-gray-750 px-6 py-4 rounded-lg mb-4">
                      <div className="flex items-center justify-start gap-4">
                        <div>
                          <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span
                              className="w-1.5 h-6 rounded-full"
                              style={{ background: PRIMARY_COLORS.teal }}
                            ></span>
                            {indikator.indikator}
                          </h2>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-sm font-semibold"
                            style={{
                              background: `${PRIMARY_COLORS.teal}12`,
                              color: PRIMARY_COLORS.teal,
                            }}
                          >
                            {indikator.penilaian}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Subindikators in 2 columns on desktop */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {activeSubindikators.map((subindikator, sidx) => {
                        const subInstrumens = getInstrumensForSubindikator(
                          subindikator.id
                        );
                        const hasInstrumens = subInstrumens.length > 0;
                        const currentData =
                          getSyaratEntry(subindikator.id) || {};
                        const currentNilai =
                          currentData.nilai !== undefined &&
                          currentData.nilai !== null
                            ? currentData.nilai
                            : "";

                        return (
                          <div
                            key={subindikator.id}
                            className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800/50 rounded-lg p-5 border border-gray-200 dark:border-gray-600 transition-colors"
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = PRIMARY_COLORS.teal}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
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
                              </div>
                            </div>

                            <div className={hasInstrumens ? "grid grid-cols-4 gap-3" : ""}>
                              {/* Input */}
                              <div className={hasInstrumens ? "col-span-3" : ""}>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                  {hasInstrumens
                                    ? "Pilih Penilaian"
                                    : "Input Standar Minimal"}{" "}
                                </label>
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
                                    step="1"
                                    min="0"
                                    max="5"
                                    value={currentNilai}
                                    onChange={(e) =>
                                      handleInputChange(
                                        subindikator.id,
                                        "nilai",
                                        e.target.value
                                      )
                                    }
                                    className="block w-full px-3 py-1.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium transition-all"
                                    style={{ '--tw-ring-color': PRIMARY_COLORS.teal }}
                                    onFocus={(e) => e.target.style.borderColor = PRIMARY_COLORS.teal}
                                    onBlur={(e) => e.target.style.borderColor = ''}
                                    placeholder="0"
                                  />
                                )}
                              </div>

                              {/* Nilai/Skor (if using instrumen) */}
                              {hasInstrumens && (
                                <div className="col-span-1">
                                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    Standar Minimal
                                  </label>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      value={currentNilai}
                                      readOnly
                                      className="block w-full px-3 py-1.5 rounded-lg shadow-sm font-bold text-lg cursor-not-allowed"
                                      style={{
                                        border: `2px solid ${PRIMARY_COLORS.teal}30`,
                                        background: `${PRIMARY_COLORS.teal}15`,
                                        color: PRIMARY_COLORS.teal,
                                      }}
                                      placeholder="0.00"
                                    />
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                      <i
                                        className="fas fa-lock text-sm"
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
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Submit Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 px-6 pb-6">
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
                title="Simpan Syarat Suksesi"
              >
                {submitting ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save mr-2" />
                    Simpan Syarat Suksesi
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

export default SyaratSuksesi;
