import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import IconButton from "./IconButton";
import SearchableSelect from "./SearchableSelect";
import { PRIMARY_COLORS } from "../config/colors";
import {
  fetchSubIndikators,
  fetchInstrumens,
  createPengajuanPenilaian,
} from "../services/apiService";

const PengajuanPenilaianModal = ({
  isOpen,
  onClose,
  pegawaiId,
  onSubmitSuccess,
  tutorialHighlightRef,
  tipeNilai = "potensial", // "potensial" or "kinerja"
}) => {
  const [subIndikators, setSubIndikators] = useState([]);
  const [instrumens, setInstrumens] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [selectedSubindikator, setSelectedSubindikator] = useState(null);
  const [selectedInstrumen, setSelectedInstrumen] = useState(null);
  const [tanggalSK, setTanggalSK] = useState("");
  const [buktiDukung, setBuktiDukung] = useState(null);
  const [buktiDukungName, setBuktiDukungName] = useState("");
  const [catatan, setCatatan] = useState("");

  // Load subindikators and instrumens on mount
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [subs, insts] = await Promise.all([
        fetchSubIndikators(),
        fetchInstrumens(),
      ]);

      // Filter subindikators to only show "Penugasan Dalam Jabatan Nondefinitif" and "Penugasan dalam Tim Kerja"
      const filteredSubs = subs.filter((sub) => {
        const nama = (sub.subindikator || sub.nama || "").toLowerCase();
        return (
          nama.includes("penugasan dalam jabatan nondefinitif") ||
          nama.includes("penugasan dalam tim kerja")
        );
      });

      setSubIndikators(filteredSubs);
      setInstrumens(insts || []);
    } catch (error) {
      console.error("Error loading data:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Gagal memuat data subindikator dan instrumen",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get instrumens for selected subindikator
  const getInstrumensForSub = () => {
    if (!selectedSubindikator) return [];
    return instrumens.filter(
      (inst) =>
        inst.subindikator_id === selectedSubindikator.id ||
        String(inst.subindikator_id) === String(selectedSubindikator.id)
    );
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedExtensions = ["pdf", "doc", "docx"];
      const fileExtension = file.name.split(".").pop()?.toLowerCase();

      if (!allowedExtensions.includes(fileExtension)) {
        Swal.fire({
          icon: "warning",
          title: "Format Tidak Didukung",
          text: "File harus berformat PDF, DOC, atau DOCX",
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire({
          icon: "warning",
          title: "File Terlalu Besar",
          text: "Ukuran file maksimal 5 MB",
        });
        return;
      }
      setBuktiDukung(file);
      setBuktiDukungName(file.name);
    }
  };

  const validateForm = () => {
    if (!selectedSubindikator) {
      Swal.fire({
        icon: "warning",
        title: "Validasi",
        text: "Silakan pilih subindikator",
      });
      return false;
    }

    if (!selectedInstrumen) {
      Swal.fire({
        icon: "warning",
        title: "Validasi",
        text: "Silakan pilih instrumen",
      });
      return false;
    }

    if (!tanggalSK) {
      Swal.fire({
        icon: "warning",
        title: "Validasi",
        text: "Silakan masukkan tanggal SK",
      });
      return false;
    }

    if (!buktiDukung) {
      Swal.fire({
        icon: "warning",
        title: "Validasi",
        text: "Silakan upload bukti dukung",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);

      const response = await createPengajuanPenilaian({
        pegawai_id: pegawaiId,
        subindikator_id: selectedSubindikator.id,
        instrumen_id: selectedInstrumen.id,
        tanggal_sk: tanggalSK,
        file: buktiDukung,
        catatan: catatan || null,
      });

      Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Pengajuan penilaian berhasil diajukan",
        confirmButtonColor: PRIMARY_COLORS.blue,
      });

      // Reset form
      resetForm();
      onClose();

      // Call callback
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (error) {
      console.error("Submit error:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "Gagal mengajukan penilaian",
        confirmButtonColor: PRIMARY_COLORS.blue,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedSubindikator(null);
    setSelectedInstrumen(null);
    setTanggalSK("");
    setBuktiDukung(null);
    setBuktiDukungName("");
    setCatatan("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const availableInstrumens = getInstrumensForSub();
  const subindikatorOptions = subIndikators.map((sub) => ({
    value: sub.id,
    label: sub.subindikator || sub.nama || sub.name,
  }));
  const instrumenOptions = availableInstrumens.map((inst) => ({
    value: inst.id,
    label: inst.instrumen || inst.nama || inst.name,
  }));

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ease-out"
        onClick={handleClose}
        style={{ animation: "fadeIn 0.3s ease-out" }}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={tutorialHighlightRef}
          className="modal-resizable w-full max-w-2xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-lg pointer-events-auto overflow-y-auto shadow-2xl flex flex-col"
        >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 rounded-t-2xl bg-white dark:bg-gray-800 sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
              Ajukan Penilaian Potensial atau Kinerja
            </h2>
            <p className="text-md text-gray-600 dark:text-gray-400 mt-1">
              per Indikator - Bukti Dukung & Instrumen
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 hover:scale-110 cursor-pointer"
            aria-label="Close"
          >
            <i className="fas fa-times text-xl text-gray-600 dark:text-gray-300"></i>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-200">
            <i className="fas fa-circle-info mt-0.5 text-blue-500" />
            <p>
              Penilaian yang akan digunakan untuk setiap subindikator adalah penilaian terakhir yang sudah diterima.
            </p>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 dark:border-gray-700 border-t-teal-500 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">
                Memuat data...
              </p>
            </div>
          ) : (
            <>
              {/* Subindikator */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subindikator <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={selectedSubindikator?.id}
                  onChange={(value) => {
                    const selected = subIndikators.find((s) => s.id === value);
                    setSelectedSubindikator(selected);
                    // Reset instrumen when subindikator changes
                    setSelectedInstrumen(null);
                  }}
                  options={subindikatorOptions}
                  placeholder="Pilih subindikator"
                  isDisabled={subIndikators.length === 0}
                />
              </div>

              {/* Instrumen */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Instrumen <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={selectedInstrumen?.id}
                  onChange={(value) => {
                    const selected = availableInstrumens.find(
                      (i) => i.id === value
                    );
                    setSelectedInstrumen(selected);
                  }}
                  options={instrumenOptions}
                  placeholder={
                    !selectedSubindikator
                      ? "Pilih subindikator terlebih dahulu"
                      : "Pilih instrumen"
                  }
                  isDisabled={!selectedSubindikator || availableInstrumens.length === 0}
                />
                {selectedSubindikator && availableInstrumens.length === 0 && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                    Tidak ada instrumen untuk subindikator yang dipilih
                  </p>
                )}
              </div>

              {/* Tanggal SK */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tanggal SK <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={tanggalSK}
                  onChange={(e) => setTanggalSK(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Bukti Dukung */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bukti Dukung (Upload File) <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    id="bukti-dukung"
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                  />
                  <label
                    htmlFor="bukti-dukung"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900 text-[#3085d6] dark:text-blue-300 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
                  >
                    <i className="fas fa-cloud-arrow-up"></i>
                    Pilih File
                  </label>
                  {buktiDukungName && (
                    <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                      <i className="fas fa-check-circle text-teal-500"></i>
                      {buktiDukungName}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Format: PDF, DOC, DOCX (Maks. 5 MB)
                </p>
              </div>

              {/* Catatan (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Catatan (Opsional)
                </label>
                <textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Tambahkan catatan jika diperlukan"
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                ></textarea>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
          <IconButton onClick={handleClose} variant="default" size="lg" disabled={isSubmitting}>
            <i className="far fa-times-circle mr-2" />
            Batal
          </IconButton>
          <IconButton onClick={handleSubmit} variant="primary" size="lg" disabled={isLoading || isSubmitting}>
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Mengirim...
              </>
            ) : (
              <>
                <i className="fas fa-paper-plane mr-2"></i>
                Ajukan Penilaian
              </>
            )}
          </IconButton>
        </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

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
  );
};

export default PengajuanPenilaianModal;
