import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import IconButton from "../../components/IconButton";
import { fetchStandarKompetensiMSK } from "../../services/apiService";
import Swal from "sweetalert2";

const StandarKompetensiMSK = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState([]); // [{ jenis_jabatan, entries: [ { id, subindikator, standar, subindikator_id, jenis_jabatan_id } ] }]
  const [activeTab, setActiveTab] = useState(0);

  // Load data from API and group by jenis_jabatan
  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchStandarKompetensiMSK();

      const map = new Map();
      data.forEach((item) => {
        const jenis = item.jenis_jabatan || {
          id: item.jenis_jabatan_id,
          name: "-",
        };
        const jid = jenis.id || item.jenis_jabatan_id;
        if (!map.has(jid)) map.set(jid, { jenis_jabatan: jenis, entries: [] });
        map.get(jid).entries.push(item);
      });

      setGroups(Array.from(map.values()));
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "Gagal memuat data",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => navigate(-1);

  const handleInputChange = (groupIdx, entryIdx, value) => {
    setGroups((prev) => {
      const copy = prev.map((g) => ({
        ...g,
        entries: g.entries.map((e) => ({ ...e })),
      }));
      const entry = copy[groupIdx].entries[entryIdx];
      entry.standar = value;
      return copy;
    });
  };

  // Save handler: send bulk payload { msk: [ { id, standar }, ... ] }
  const handleSave = async (e) => {
    e.preventDefault();

    const confirm = await Swal.fire({
      icon: "question",
      title: "Konfirmasi",
      text: "Simpan perubahan standar kompetensi?",
      showCancelButton: true,
      confirmButtonText: "Simpan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#3B82F6",
      cancelButtonColor: "#d33",
      reverseButtons: true,
    });
    if (!confirm.isConfirmed) return;

    const msk = [];
    for (const g of groups) {
      for (const entry of g.entries) {
        if (!entry.id) continue;
        const raw = entry.standar;
        if (raw === "" || raw === null || raw === undefined) {
          Swal.fire({
            icon: "warning",
            title: "Data Tidak Lengkap",
            text: `Standar untuk "${
              entry.subindikator?.subindikator ||
              entry.subindikator_name ||
              entry.id
            }" wajib diisi`,
            confirmButtonColor: "#3B82F6",
          });
          return;
        }
        const num = Number(raw);
        const intVal = Number.isNaN(num) ? NaN : Math.trunc(num);
        if (!Number.isInteger(intVal) || intVal < 0 || intVal > 5) {
          Swal.fire({
            icon: "warning",
            title: "Nilai Tidak Valid",
            text: `Standar untuk "${
              entry.subindikator?.subindikator ||
              entry.subindikator_name ||
              entry.id
            }" harus bilangan bulat antara 0 dan 5`,
            confirmButtonColor: "#3B82F6",
          });
          return;
        }
        msk.push({ id: entry.id, standar: intVal });
      }
    }

    if (msk.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Tidak ada data",
        text: "Tidak ada entri yang dapat disimpan.",
        confirmButtonColor: "#3B82F6",
      });
      return;
    }

    try {
      setSaving(true);
      const base = import.meta.env.VITE_API_BASE_URL || "";
      const res = await fetch(`${base}/api/standar-kompetensi-msk/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msk }),
      });

      if (!res.ok) {
        const rj = await res.json().catch(() => ({}));
        throw new Error(rj.message || "Gagal menyimpan data bulk");
      }

      await Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Standar berhasil disimpan",
        timer: 1500,
        showConfirmButton: false,
      });
      await loadData();
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "Gagal menyimpan",
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    document.title = `Standar Kompetensi MSK | SIMANTAP`;
    loadData();
  }, []);

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
            Standar Kompetensi MSK
          </h1>
          <p className="mt-2 text-sm md:text-base text-gray-600 dark:text-gray-300">
            Kelola data standar kompetensi manjerial dan sosial kultural
          </p>
        </div>
      </div>
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

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-6 border border-gray-100 dark:border-gray-700">
        <div className="bg-[#3B82F6] px-6 py-4">
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-edit"></i>
            Ubah Standar Kompetensi MSK
          </h1>
        </div>

        {loading ? (
          <div className="p-4">
            <div className="flex flex-col items-center justify-center py-6">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700"></div>
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-[#3B82F6] border-r-transparent border-b-transparent border-l-transparent absolute top-0 left-0"></div>
              </div>
              <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                Memuat data...
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-100 dark:border-gray-700">
              <div className="flex flex-wrap border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                {groups.map((g, idx) => (
                  <button
                    key={g.jenis_jabatan?.id || idx}
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
                      {g.jenis_jabatan?.name ||
                        g.jenis_jabatan?.nama ||
                        "Unnamed"}
                    </div>
                  </button>
                ))}
              </div>

              {groups.map((g, gIdx) => {
                if (gIdx !== activeTab) return null;
                return (
                  <div key={g.jenis_jabatan?.id || gIdx} className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {g.entries.map((entry, idx) => (
                        <div
                          key={entry.id || entry.subindikator_id || idx}
                          className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800/50 rounded-md p-3 border border-gray-200 dark:border-gray-600"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {entry.subindikator?.subindikator ||
                                  entry.subindikator_name ||
                                  "-"}
                              </h3>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Bobot: {entry.subindikator?.bobot ?? "-"}
                              </div>
                            </div>
                            <div className="w-28 flex-shrink-0">
                              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                Standar
                              </label>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                max="5"
                                value={
                                  entry.standar === null ||
                                  entry.standar === undefined
                                    ? ""
                                    : entry.standar
                                }
                                onChange={(e) =>
                                  handleInputChange(gIdx, idx, e.target.value)
                                }
                                className="block w-full px-3 py-1.5 border-2 border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4">
              <IconButton
                type="button"
                onClick={handleBack}
                variant="default"
                size="lg"
                title="Batal"
              >
                <i className="far fa-times-circle mr-2" /> Batal
              </IconButton>
              <IconButton
                type="submit"
                variant="primary"
                size="lg"
                disabled={saving}
                title="Simpan"
              >
                {saving ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2" /> Menyimpan...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save mr-2" /> Simpan Perubahan
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

export default StandarKompetensiMSK;
