import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import IconButton from "./IconButton";
import { PRIMARY_COLORS, BG_COLORS, DARK_COLORS } from "../config/colors";

function PenilaianDetailModal({
  isOpen,
  onClose,
  pegawai,
  penilaianData,
  subIndikators,
  loading = false,
  onEditPenilaian,
  onViewProfil,
}) {
  // Close on Escape key
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

  // Parse penilaian data and match with subindikator names
  const penilaianList = [];
  let potensialSum = 0; // sum of hasil for indikator.penilaian === 'Potensial'
  let kinerjaSum = 0; // sum of hasil for indikator.penilaian === 'Kinerja'
  let countNonZero = 0;

  if (penilaianData && typeof penilaianData === "object") {
    Object.entries(penilaianData).forEach(([subIndikatorId, values]) => {
      const subIndikator = subIndikators.find((si) => si.id === subIndikatorId);

      const nilai = Number(values.nilai || 0);
      const hasil = Number(values.hasil || 0);

      if (nilai > 0 || hasil > 0) {
        const indikatorPenilaian = (subIndikator?.indikator?.penilaian || "")
          .toString()
          .toLowerCase();

        // accumulate sums based on indikator.penilaian type
        if (indikatorPenilaian === "potensial") {
          potensialSum += hasil;
        } else if (indikatorPenilaian === "kinerja") {
          kinerjaSum += hasil;
        }

        penilaianList.push({
          id: subIndikatorId,
          subIndikatorName: subIndikator?.subindikator || "-",
          indikatorName:
            (subIndikator?.indikator?.indikator || "") +
            " (" +
            (subIndikator?.indikator?.penilaian || "-") +
            ")",
          nilai: nilai,
          hasil: hasil,
          bobot: subIndikator?.bobot || 0,
        });
        countNonZero++;
      }
    });
  }

  const nilaiPotensial = potensialSum;
  const nilaiKinerja = kinerjaSum;
  const nilaiTalenta = countNonZero > 0 ? (potensialSum + kinerjaSum) / 2 : 0;

  return (
    <>
      {/* Backdrop with fade animation */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ease-out"
        onClick={onClose}
        style={{
          animation: "fadeIn 0.3s ease-out",
        }}
      />

      {/* Modal with slide-up + scale animation */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="modal-resizable w-full max-w-5xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-lg pointer-events-auto overflow-hidden flex flex-col"
          style={{
            "--modal-default-width": "64rem",
            "--modal-min-height": "320px",
            animation: "modalSlideUp 0.3s ease-out",
          }}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {pegawai?.avatar ? (
                  <img
                    src={pegawai.avatar}
                    alt={pegawai.nama}
                    className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-xl"
                  style={{ display: pegawai?.avatar ? "none" : "flex" }}
                >
                  {pegawai?.nama?.charAt(0)?.toUpperCase() || "?"}
                </div>
              </div>

              {/* Pegawai Info */}
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                  Detail Penilaian
                </h2>
                <p className="text-md font-semibold text-gray-700 dark:text-gray-300 mt-1">
                  {pegawai?.nama}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  NIP: {pegawai?.nip}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onViewProfil && (
                <IconButton
                  onClick={() => {
                    onViewProfil(pegawai?.nip);
                    onClose();
                  }}
                  variant="blue"
                  size="lg"
                  title="Lihat Profil Pegawai"
                >
                  <i className="fas fa-eye"></i>
                  <span className="hidden sm:inline ml-2">Lihat Profil</span>
                </IconButton>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 hover:scale-110 cursor-pointer"
                aria-label="Close"
              >
                <i className="fas fa-times text-xl text-gray-600 dark:text-gray-300"></i>
              </button>
            </div>
          </div>

          {/* Employee Info Section */}
          <div className="px-6 pt-6 pb-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Jabatan
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {pegawai?.jabatan || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Unit Kerja
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {pegawai?.unit_kerja || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Jenis Jabatan
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {pegawai?.jenis_jabatan || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Golongan
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {pegawai?.golongan || "-"}
                </p>
              </div>
            </div>
          </div>

          {/* Penilaian Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <i className="fas fa-spinner fa-spin text-3xl text-blue-500 mr-3"></i>
                <span className="text-gray-600 dark:text-gray-400">
                  Memuat data penilaian...
                </span>
              </div>
            ) : penilaianList.length > 0 ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div
                    className="p-4 rounded-lg border-2 bg-gradient-to-br from-teal-50 to-teal-100"
                    style={{
                      borderColor: PRIMARY_COLORS.teal,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-teal-500 dark:text-teal-300">
                          Nilai Potensial
                        </p>
                        <p
                          className="text-3xl font-bold mt-1"
                          style={{ color: PRIMARY_COLORS.teal }}
                        >
                          {Number.isFinite(nilaiPotensial)
                            ? nilaiPotensial.toFixed(2)
                            : "0.00"}
                        </p>
                      </div>
                      <i
                        className="fas fa-trophy text-3xl"
                        style={{ color: PRIMARY_COLORS.teal }}
                      ></i>
                    </div>
                  </div>

                  <div
                    className="p-4 rounded-lg border-2 bg-gradient-to-br from-blue-50 to-blue-100"
                    style={{
                      borderColor: PRIMARY_COLORS.blue,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#3085d6] dark:text-blue-300">
                          Nilai Kinerja
                        </p>
                        <p
                          className="text-3xl font-bold mt-1"
                          style={{ color: PRIMARY_COLORS.blue }}
                        >
                          {Number.isFinite(nilaiKinerja)
                            ? nilaiKinerja.toFixed(2)
                            : "0.00"}
                        </p>
                      </div>
                      <i
                        className="fas fa-chart-line text-3xl"
                        style={{ color: PRIMARY_COLORS.blue }}
                      ></i>
                    </div>
                  </div>

                  <div
                    className="p-4 rounded-lg border-2 bg-gradient-to-br from-purple-50 to-purple-100"
                    style={{
                      borderColor: PRIMARY_COLORS.purple,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium dark:text-purple-300" style={{ color: PRIMARY_COLORS.purple }}>
                          Nilai Talenta
                        </p>
                        <p
                          className="text-3xl font-bold mt-1"
                          style={{ color: PRIMARY_COLORS.purple }}
                        >
                          {Number.isFinite(nilaiTalenta)
                            ? nilaiTalenta.toFixed(2)
                            : "0.00"}
                        </p>
                      </div>
                      <i
                        className="fas fa-list-check text-3xl"
                        style={{ color: PRIMARY_COLORS.purple }}
                      ></i>
                    </div>
                  </div>
                </div>

                {/* Penilaian Table */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                          >
                            No
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                          >
                            Indikator
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                          >
                            Sub Indikator
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                          >
                            Nilai
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                          >
                            Hasil
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                          >
                            Bobot
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {penilaianList.map((item, index) => (
                          <tr
                            key={item.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {index + 1}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                              {item.indikatorName || "-"}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                              {item.subIndikatorName}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span
                                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
                                style={{
                                  backgroundColor: BG_COLORS.blue.light,
                                  color: DARK_COLORS.blue,
                                }}
                              >
                                {item.nilai}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span
                                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
                                style={{
                                  backgroundColor: BG_COLORS.teal.light,
                                  color: DARK_COLORS.teal,
                                }}
                              >
                                {item.hasil.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center text-sm text-gray-600 dark:text-gray-400">
                              {item.bobot}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <i className="fas fa-inbox text-5xl text-gray-300 dark:text-gray-600 mb-4"></i>
                <p className="text-lg text-gray-500 dark:text-gray-400 font-medium">
                  Belum ada data penilaian
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  Silakan tambahkan penilaian untuk pegawai ini
                </p>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
            <IconButton
              onClick={onClose}
              variant="default"
              size="lg"
              title="Tutup"
            >
              <i className="far fa-times-circle mr-2" />
              Tutup
            </IconButton>
            {onEditPenilaian && (
              <IconButton
                onClick={() => {
                  onEditPenilaian(pegawai?.nip);
                  onClose();
                }}
                variant="primary"
                size="lg"
                title="Ubah Penilaian"
              >
                <i className="fas fa-edit mr-2" />
                Ubah Penilaian
              </IconButton>
            )}
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
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
}

PenilaianDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  pegawai: PropTypes.shape({
    nip: PropTypes.string,
    nama: PropTypes.string,
    email: PropTypes.string,
    avatar: PropTypes.string,
    jabatan: PropTypes.string,
    unit_kerja: PropTypes.string,
    jenis_jabatan: PropTypes.string,
    golongan: PropTypes.string,
  }),
  penilaianData: PropTypes.object,
  subIndikators: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      indikator_name: PropTypes.string,
      bobot: PropTypes.number,
    }),
  ),
  loading: PropTypes.bool,
  onEditPenilaian: PropTypes.func,
  onViewProfil: PropTypes.func,
};

export default PenilaianDetailModal;
