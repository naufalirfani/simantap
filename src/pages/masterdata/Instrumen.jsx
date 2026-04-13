import { useEffect, useState } from "react";
import { useSettings } from "../../context/SettingsContext";
import {
  fetchInstrumens,
  createInstrumen,
  updateInstrumen,
  deleteInstrumen,
  fetchIndikators,
} from "../../services/apiService";
import { PRIMARY_COLORS } from "../../config/colors";
import Swal from "sweetalert2";
import IconButton from "../../components/IconButton";
import SearchableSelect from "../../components/SearchableSelect";
import Breadcrumb from "../../components/Breadcrumb";

const Instrumen = () => {
  const { t } = useSettings();
  const [data, setData] = useState([]);
  const [subindikators, setSubindikators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // 'add' | 'edit'
  const [currentInstrumen, setCurrentInstrumen] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    instrumen: "",
    skor: "",
    subindikator_id: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [skorWarning, setSkorWarning] = useState(null);

  useEffect(() => {
    document.title = `Instrumen | SIMANTAP`;
  }, [t]);

  useEffect(() => {
    loadData();
    loadSubindikators();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchInstrumens();
      setData(result);
    } catch (err) {
      setError(err.message || "Gagal memuat data instrumen");
      console.error("Error loading instrumens:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadSubindikators = async () => {
    try {
      const result = await fetchIndikators();
      // Flatten all subindikators from all indikators
      const allSubs = [];
      result.forEach((ind) => {
        if (ind.sub_indikators && ind.sub_indikators.length > 0) {
          ind.sub_indikators.forEach((sub) => {
            allSubs.push({
              ...sub,
              indikator_name: ind.indikator,
              penilaian: ind.penilaian,
            });
          });
        }
      });
      setSubindikators(allSubs);
    } catch (err) {
      console.error("Error loading subindikators:", err);
    }
  };

  // Filter data based on search term
  const filteredList = data.filter((item) => {
    if (!searchTerm) return true;
    const q = searchTerm.toString().toLowerCase();
    if (item.instrumen && item.instrumen.toLowerCase().includes(q)) return true;
    if (item.skor && item.skor.toString().toLowerCase().includes(q))
      return true;
    if (
      item.subindikator?.subindikator &&
      item.subindikator.subindikator.toLowerCase().includes(q)
    )
      return true;
    return false;
  });

  // Sort instrumens alphabetically by name, then group by subindikator (for rowspan rendering)
  const sortedList = filteredList
    .slice()
    .sort((a, b) => (a.instrumen || "").localeCompare(b.instrumen || ""));

  const groupedBySub = sortedList.reduce((acc, item) => {
    const key = item.subindikator?.id || "__none";
    if (!acc[key]) acc[key] = { sub: item.subindikator || null, items: [] };
    acc[key].items.push(item);
    return acc;
  }, {});

  const handleOpenModal = (mode, instrumen = null) => {
    setModalMode(mode);
    setCurrentInstrumen(instrumen);

    if (mode === "edit" && instrumen) {
      setFormData({
        instrumen: instrumen.instrumen || "",
        skor: instrumen.skor || "",
        subindikator_id: instrumen.subindikator_id || "",
      });
    } else {
      setFormData({
        instrumen: "",
        skor: "",
        subindikator_id: "",
      });
    }

    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setCurrentInstrumen(null);
    setFormData({
      instrumen: "",
      skor: "",
      subindikator_id: "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const num = parseFloat(formData.skor);
    if (Number.isNaN(num) || num < 0 || num > 100) {
      setSkorWarning("Skor minimoal 0 dan maksimal 100");
      return;
    }
    setSubmitting(true);

    try {
      if (modalMode === "add") {
        await createInstrumen(formData);
        Swal.fire({
          icon: "success",
          title: "Berhasil!",
          text: "Instrumen berhasil ditambahkan",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        await updateInstrumen(currentInstrumen.id, formData);
        Swal.fire({
          icon: "success",
          title: "Berhasil!",
          text: "Instrumen berhasil diperbarui",
          timer: 2000,
          showConfirmButton: false,
        });
      }

      handleCloseModal();
      await loadData();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Gagal!",
        text: err.message || "Terjadi kesalahan saat menyimpan instrumen",
        confirmButtonColor: PRIMARY_COLORS.blue,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, instrumenName) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Konfirmasi Hapus",
      text: `Apakah Anda yakin ingin menghapus instrumen "${instrumenName}"?`,
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: "Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: PRIMARY_COLORS.blue,
      cancelButtonColor: PRIMARY_COLORS.red,
    });

    if (result.isConfirmed) {
      try {
        await deleteInstrumen(id);
        Swal.fire({
          icon: "success",
          title: "Berhasil!",
          text: "Instrumen berhasil dihapus",
          timer: 2000,
          showConfirmButton: false,
        });
        await loadData();
      } catch (err) {
        Swal.fire({
          icon: "error",
          title: "Gagal!",
          text: err.message || "Gagal menghapus instrumen",
          confirmButtonColor: PRIMARY_COLORS.blue,
        });
      }
    }
  };

  // Live validation for skor field
  useEffect(() => {
    const num = parseFloat(formData.skor);
    if (
      formData.skor === "" ||
      formData.skor === null ||
      formData.skor === undefined
    ) {
      setSkorWarning(null);
      return;
    }
    if (Number.isNaN(num) || num < 0 || num > 100) {
      setSkorWarning("Skor harus antara 0 dan 100");
    } else {
      setSkorWarning(null);
    }
  }, [formData.skor]);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Breadcrumb */}
      <Breadcrumb />
      
      {/* Page Title */}
      <div className="mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
            Instrumen
          </h1>
          <p className="mt-2 text-sm md:text-base text-gray-600 dark:text-gray-300">
            Kelola data instrumen penilaian
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-end">
        <IconButton
          onClick={() => handleOpenModal("add")}
          variant="primary"
          size="lg"
          className="gap-2"
        >
          <i className="fas fa-plus mr-2" />
          Tambah Instrumen
        </IconButton>
      </div>

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <svg
              className="h-5 w-5 mt-0.5 flex-shrink-0"
              style={{ color: PRIMARY_COLORS.red }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Terjadi Kesalahan
              </h3>
              <p className="mt-1 text-sm" style={{ color: PRIMARY_COLORS.red }}>
                {error}
              </p>
              <button
                onClick={loadData}
                className="mt-2 text-sm font-medium cursor-pointer"
                style={{ color: PRIMARY_COLORS.red }}
              >
                Muat Ulang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      {!error && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Cari instrumen, subindikator, skor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 dark:text-white transition-all shadow-sm"
                  style={{ '--tw-ring-color': PRIMARY_COLORS.teal }}
                  onFocus={(e) => e.target.style.borderColor = PRIMARY_COLORS.teal}
                  onBlur={(e) => e.target.style.borderColor = ''}
                />
                <svg
                  className="absolute left-3.5 top-3 h-5 w-5 text-gray-400 dark:text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-200 dark:bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-3 py-3 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider w-16">
                    No
                  </th>
                  <th className="px-3 py-3 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider">
                    Subindikator
                  </th>
                  <th className="px-3 py-3 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider">
                    Instrumen
                  </th>
                  <th className="px-3 py-3 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider">
                    Skor
                  </th>
                  <th className="px-3 py-3 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="relative">
                          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700"></div>
                          <div className="animate-spin rounded-full h-12 w-12 border-4 border-r-transparent border-b-transparent border-l-transparent absolute top-0 left-0" style={{ borderTopColor: PRIMARY_COLORS.teal }}></div>
                        </div>
                        <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                          Memuat data...
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : filteredList.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-3 py-12 text-center">
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                        />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                        Tidak ada data
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Mulai dengan menambahkan instrumen baru
                      </p>
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const keys = Object.keys(groupedBySub);
                    return keys.map((key, gIdx) => {
                      const group = groupedBySub[key];
                      return group.items.map((item, idx) => (
                        <tr
                          key={item.id}
                          className={`${
                            gIdx % 2 === 0
                              ? "bg-gray-50 dark:bg-gray-700/50"
                              : ""
                          } hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors`}
                        >
                          {idx === 0 && (
                            <td
                              rowSpan={group.items.length}
                              className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center align-middle"
                            >
                              {gIdx + 1}
                            </td>
                          )}

                          {idx === 0 && (
                            <td
                              rowSpan={group.items.length}
                              className="px-3 py-4 text-sm text-gray-900 dark:text-white align-middle"
                            >
                              <div>
                                <div className="font-medium">
                                  {group.sub?.subindikator || "-"}
                                </div>
                                {group.sub?.indikator && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {group.sub.indikator.indikator} (
                                    {group.sub.indikator.penilaian})
                                  </div>
                                )}
                              </div>
                            </td>
                          )}

                          <td className="px-3 py-4 text-sm text-gray-900 dark:text-white">
                            {item.instrumen}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                            {item.skor}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-center text-sm font-medium">
                            <div className="flex items-center justify-center gap-2">
                              <IconButton
                                onClick={() => handleOpenModal("edit", item)}
                                variant="primary"
                                size="lg"
                                title="Edit"
                              >
                                <i className="fas fa-edit" />
                              </IconButton>
                              <IconButton
                                onClick={() =>
                                  handleDelete(item.id, item.instrumen)
                                }
                                variant="danger"
                                size="lg"
                                title="Hapus"
                              >
                                <i className="fas fa-trash" />
                              </IconButton>
                            </div>
                          </td>
                        </tr>
                      ));
                    });
                  })()
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <>
          {/* Backdrop with fade animation */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ease-out"
            onClick={handleCloseModal}
          />

          {/* Modal with slide-up + scale animation */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="modal-resizable overflow-auto bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg pointer-events-auto"
              style={{
                "--modal-default-width": "32rem",
                "--modal-min-height": "260px",
                animation: "modalSlideUp 0.3s ease-out",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleSubmit}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 rounded-t-2xl">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {modalMode === "add"
                      ? "Tambah Instrumen"
                      : "Edit Instrumen"}
                  </h3>
                  <button
                    onClick={handleCloseModal}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 hover:scale-120 cursor-pointer"
                    aria-label="Close"
                  >
                    <i className="fas fa-times text-xl text-gray-600 dark:text-gray-300"></i>
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                  <div>
                    <label
                      htmlFor="subindikator_id"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Subindikator
                    </label>
                    <div>
                      <SearchableSelect
                        value={formData.subindikator_id || ""}
                        onChange={(val) =>
                          setFormData({ ...formData, subindikator_id: val })
                        }
                        options={subindikators.map((sub) => ({
                          value: sub.id,
                          label: `${sub.subindikator} - ${sub.indikator_name} (${sub.penilaian})`,
                        }))}
                        placeholder="-- Pilih Subindikator --"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="instrumen"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Instrumen
                    </label>
                    <input
                      type="text"
                      id="instrumen"
                      required
                      maxLength={255}
                      value={formData.instrumen}
                      onChange={(e) =>
                        setFormData({ ...formData, instrumen: e.target.value })
                      }
                      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                      style={{ '--tw-ring-color': PRIMARY_COLORS.teal }}
                      onFocus={(e) => e.target.style.borderColor = PRIMARY_COLORS.teal}
                      onBlur={(e) => e.target.style.borderColor = ''}
                      placeholder="Masukkan instrumen"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="skor"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Skor
                    </label>
                    <input
                      type="number"
                      id="skor"
                      required
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.skor}
                      onChange={(e) =>
                        setFormData({ ...formData, skor: e.target.value })
                      }
                      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                      style={{ '--tw-ring-color': PRIMARY_COLORS.teal }}
                      onFocus={(e) => e.target.style.borderColor = PRIMARY_COLORS.teal}
                      onBlur={(e) => e.target.style.borderColor = ''}
                      placeholder="0.00"
                    />
                    {skorWarning && (
                      <div className="mt-2 text-sm rounded-lg p-2" style={{ color: PRIMARY_COLORS.orange, backgroundColor: `${PRIMARY_COLORS.yellow}1A`, border: `1px solid ${PRIMARY_COLORS.yellow}4D` }}>
                        {skorWarning}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl bg-gray-50 dark:bg-gray-700/50">
                  <IconButton
                    type="button"
                    onClick={handleCloseModal}
                    variant="secondary"
                    size="lg"
                    disabled={submitting}
                  >
                    <i className="far fa-times-circle mr-2" />
                    Batal
                  </IconButton>
                  <IconButton
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={submitting || Boolean(skorWarning)}
                    aria-busy={submitting}
                  >
                    {submitting ? (
                      <i className="fas fa-spinner fa-spin mr-2" />
                    ) : modalMode === "add" ? (
                      <i className="fas fa-plus mr-2" />
                    ) : (
                      <i className="fas fa-save mr-2" />
                    )}
                    {modalMode === "add" ? "Tambah" : "Simpan"}
                  </IconButton>
                </div>
              </form>
            </div>
          </div>

          {/* Animations */}
          <style>{`
            @keyframes modalSlideUp {
              from {
                opacity: 0;
                transform: translateY(30px) scale(0.95);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `}</style>
        </>
      )}
    </div>
  );
};

export default Instrumen;
