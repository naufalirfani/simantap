import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import IconButton from "./IconButton";
import SearchableSelect from "./SearchableSelect";
import { fetchNamaAsesmenOptions } from "../services/apiService";

const AsesmenAttachmentModal = ({
  isOpen,
  onClose,
  pegawai,
  onSubmit,
  isSubmitting = false,
}) => {
  const [asesmenOptions, setAsesmenOptions] = useState([]);
  const [isLoadingAsesmenOptions, setIsLoadingAsesmenOptions] = useState(false);
  const [selectedAsesmenName, setSelectedAsesmenName] = useState("");
  const [manualAsesmenName, setManualAsesmenName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedAsesmenName("");
      setManualAsesmenName("");
      setSelectedFile(null);
      setAsesmenOptions([]);
      setIsLoadingAsesmenOptions(false);
      return;
    }

    const loadNamaAsesmen = async () => {
      try {
        setIsLoadingAsesmenOptions(true);
        const names = await fetchNamaAsesmenOptions();
        setAsesmenOptions(
          names.map((name) => ({
            value: name,
            label: name,
          })),
        );
      } catch (error) {
        console.error("Failed to load nama asesmen options:", error);
        setAsesmenOptions([]);
      } finally {
        setIsLoadingAsesmenOptions(false);
      }
    };

    loadNamaAsesmen();
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const finalNamaAsesmen = manualAsesmenName.trim() || selectedAsesmenName.trim();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const handleSubmit = async () => {
    await onSubmit({
      pegawaiId: pegawai?.id,
      namaAsesmen: finalNamaAsesmen,
      file: selectedFile,
    });
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ease-out"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
        style={{ animation: "fadeIn 0.3s ease-out" }}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="modal-resizable w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg pointer-events-auto overflow-hidden shadow-2xl"
          style={{ "--modal-default-width": "42rem", "--modal-min-height": "260px" }}
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                Upload Lampiran Asesmen
              </h2>
              <p className="text-md text-gray-600 dark:text-gray-400 mt-1">
                {pegawai?.nama} ({pegawai?.nip || "-"})
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 hover:scale-110 cursor-pointer"
              aria-label="Close"
              disabled={isSubmitting}
            >
              <i className="fas fa-times text-xl text-gray-600 dark:text-gray-300"></i>
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nama Asesmen <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={selectedAsesmenName}
                onChange={(value) => setSelectedAsesmenName(value)}
                options={asesmenOptions}
                placeholder={
                  isLoadingAsesmenOptions
                    ? "Memuat nama asesmen..."
                    : "-- Pilih nama asesmen --"
                }
                disabled={isLoadingAsesmenOptions || isSubmitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                File Lampiran <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                onChange={handleFileChange}
                disabled={isSubmitting}
                className="cursor-pointer w-full px-3 py-2.5 border rounded-lg text-sm dark:text-white bg-white dark:bg-gray-600 border-gray-300 dark:border-gray-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Ukuran maksimum file 10MB.
              </p>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
            <IconButton
              onClick={onClose}
              disabled={isSubmitting}
              variant="default"
              size="lg"
            >
              <i className="far fa-times-circle mr-2" /> Batal
            </IconButton>
            <IconButton
              onClick={handleSubmit}
              disabled={isSubmitting || !finalNamaAsesmen || !selectedFile}
              variant="primary"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2" />
                  Mengupload...
                </>
              ) : (
                <>
                  <i className="fas fa-paperclip mr-2" />
                  Upload Lampiran
                </>
              )}
            </IconButton>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};

AsesmenAttachmentModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  pegawai: PropTypes.shape({
    id: PropTypes.string,
    nip: PropTypes.string,
    nama: PropTypes.string,
  }),
  onSubmit: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool,
};

export default AsesmenAttachmentModal;
