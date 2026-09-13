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
  fetchPetaJabatanById,
} from "../../services/apiService";
import Swal from "sweetalert2";
import { PRIMARY_COLORS, DARK_COLORS } from "../../config/colors";

const PANGKAT_GOLONGAN_OPTIONS = [
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
];

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
  const [gunakanKompetensiTeknis, setGunakanKompetensiTeknis] = useState(false);
  const [sesuaiRumpunJabatan, setSesuaiRumpunJabatan] = useState(false);
  const [minimalUsia, setMinimalUsia] = useState("");
  const [maksimalUsia, setMaksimalUsia] = useState("");
  const [pangkatGolongan, setPangkatGolongan] = useState("");

  useEffect(() => {
    document.title = `Syarat Suksesi | SIMANTAP`;
    
    // Get jabatan info from location state or fetch by ID
    if (location.state && location.state.jabatan) {
      setJabatan(location.state.jabatan);
    } else if (jabatanId) {
      fetchPetaJabatanById(jabatanId)
        .then((j) => {
          if (j) setJabatan(j);
        })
        .catch((err) => console.error("Error fetching jabatan:", err));
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
            setGunakanKompetensiTeknis(Boolean(existingData.gunakan_kompetensi_teknis));
            setSesuaiRumpunJabatan(Boolean(existingData.sesuai_rumpun_jabatan));
            setMinimalUsia(
              existingData.minimal_usia !== null && existingData.minimal_usia !== undefined
                ? String(existingData.minimal_usia)
                : ""
            );
            setMaksimalUsia(
              existingData.maksimal_usia !== null && existingData.maksimal_usia !== undefined
                ? String(existingData.maksimal_usia)
                : ""
            );
            setPangkatGolongan(existingData.pangkat_golongan || "");
            
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
    if (location.state && location.state.from) {
      navigate(location.state.from);
    } else {
      navigate("/masterdata/jabatan");
    }
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

    // Validate usia
    if (
      minimalUsia !== "" &&
      maksimalUsia !== "" &&
      parseInt(minimalUsia, 10) > parseInt(maksimalUsia, 10)
    ) {
      Swal.fire({
        icon: "warning",
        title: "Validasi Usia",
        text: "Usia minimal tidak boleh lebih besar dari usia maksimal",
        confirmButtonColor: PRIMARY_COLORS.blue,
      });
      return;
    }

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
        gunakan_kompetensi_teknis: gunakanKompetensiTeknis,
        sesuai_rumpun_jabatan: sesuaiRumpunJabatan,
        minimal_usia: minimalUsia !== "" ? parseInt(minimalUsia, 10) : null,
        maksimal_usia: maksimalUsia !== "" ? parseInt(maksimalUsia, 10) : null,
        pangkat_golongan: pangkatGolongan || null,
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

      if (location.state && location.state.from) {
        navigate(location.state.from);
      } else {
        navigate("/masterdata/jabatan");
      }
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
              {/* Pengaturan Tambahan Suksesi */}
              <div className="mb-8 bg-slate-50 dark:bg-gray-750/60 rounded-xl p-5 border border-slate-200 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: PRIMARY_COLORS.teal }}
                  >
                    <i className="fas fa-sliders-h text-sm"></i>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      Pengaturan Tambahan Suksesi
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Konfigurasi parameter penilaian dan penyaringan calon suksesor untuk jabatan ini
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Toggle 1: Menggunakan Nilai Kompetensi Teknis */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col justify-between hover:border-teal-300 dark:hover:border-teal-700 transition-colors">
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <label
                          htmlFor="toggle-komp-teknis"
                          className="text-sm font-semibold text-gray-900 dark:text-white cursor-pointer select-none"
                        >
                          Menggunakan Nilai Kompetensi Teknis
                        </label>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={gunakanKompetensiTeknis}
                          id="toggle-komp-teknis"
                          onClick={() => setGunakanKompetensiTeknis(!gunakanKompetensiTeknis)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                            gunakanKompetensiTeknis ? "bg-teal-600" : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                              gunakanKompetensiTeknis ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        Jika aktif, perhitungan Nilai Akhir Talenta menggunakan pembobotan Nilai Talenta dan Nilai Kompetensi Teknis. Jika tidak aktif, maka murni menggunakan Nilai Talenta.
                      </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Status:</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          gunakanKompetensiTeknis
                            ? "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {gunakanKompetensiTeknis ? "Aktif" : "Tidak Aktif"}
                      </span>
                    </div>
                  </div>

                  {/* Toggle 2: Sesuai Rumpun Jabatan */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col justify-between hover:border-teal-300 dark:hover:border-teal-700 transition-colors">
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <label
                          htmlFor="toggle-rumpun"
                          className="text-sm font-semibold text-gray-900 dark:text-white cursor-pointer select-none"
                        >
                          Sesuai Rumpun Jabatan
                        </label>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={sesuaiRumpunJabatan}
                          id="toggle-rumpun"
                          onClick={() => setSesuaiRumpunJabatan(!sesuaiRumpunJabatan)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                            sesuaiRumpunJabatan ? "bg-teal-600" : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                              sesuaiRumpunJabatan ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        Jika aktif, suksesor hanya diambil dari rumpun Eselon I / JPT Madya yang sama (berlaku khusus jabatan kosong di bawah Deputi Bidang Administrasi dan Deputi Bidang Persidangan).
                      </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Status:</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          sesuaiRumpunJabatan
                            ? "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {sesuaiRumpunJabatan ? "Aktif" : "Tidak Aktif"}
                      </span>
                    </div>
                  </div>

                  {/* Option 3: Syarat Pangkat / Golongan Minimal */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col justify-between hover:border-teal-300 dark:hover:border-teal-700 transition-colors">
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <label
                          htmlFor="select-pangkat-golongan"
                          className="text-sm font-semibold text-gray-900 dark:text-white cursor-pointer select-none flex items-center gap-1.5"
                        >
                          <i className="fas fa-id-badge text-blue-600 dark:text-blue-400"></i>
                          Pangkat / Golongan Minimal
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
                        Pegawai dengan pangkat/golongan di bawah standar ini tidak akan dimasukkan dalam bursa suksesor.
                      </p>
                      <div>
                        <select
                          id="select-pangkat-golongan"
                          value={pangkatGolongan}
                          onChange={(e) => setPangkatGolongan(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors cursor-pointer"
                        >
                          <option value="">-- Semua Pangkat / Golongan (Tanpa Batasan) --</option>
                          {PANGKAT_GOLONGAN_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Syarat Minimal:</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          pangkatGolongan
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {pangkatGolongan
                          ? PANGKAT_GOLONGAN_OPTIONS.find((p) => p.value === pangkatGolongan)?.label || pangkatGolongan
                          : "Semua Golongan"}
                      </span>
                    </div>
                  </div>

                  {/* Option 4: Syarat Usia Calon Suksesor */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col justify-between hover:border-teal-300 dark:hover:border-teal-700 transition-colors">
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <label
                          className="text-sm font-semibold text-gray-900 dark:text-white cursor-pointer select-none flex items-center gap-1.5"
                        >
                          <i className="fas fa-calendar-alt text-amber-600 dark:text-amber-400"></i>
                          Syarat Usia Calon Suksesor
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
                        Tentukan batas usia calon suksesor (dalam tahun). Kosongkan jika tidak ada batas minimal atau maksimal.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor="input-minimal-usia"
                            className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
                          >
                            Usia Minimal (Tahun)
                          </label>
                          <input
                            type="number"
                            id="input-minimal-usia"
                            min="18"
                            max="70"
                            placeholder="Cth: 25"
                            value={minimalUsia}
                            onChange={(e) => setMinimalUsia(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="input-maksimal-usia"
                            className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
                          >
                            Usia Maksimal (Tahun)
                          </label>
                          <input
                            type="number"
                            id="input-maksimal-usia"
                            min="18"
                            max="70"
                            placeholder="Cth: 56"
                            value={maksimalUsia}
                            onChange={(e) => setMaksimalUsia(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Rentang Usia:</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          minimalUsia || maksimalUsia
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {minimalUsia && maksimalUsia
                          ? `${minimalUsia} - ${maksimalUsia} Tahun`
                          : minimalUsia
                          ? `Min. ${minimalUsia} Tahun`
                          : maksimalUsia
                          ? `Maks. ${maksimalUsia} Tahun`
                          : "Semua Usia"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

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
