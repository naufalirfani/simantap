import { useEffect, useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import {
  fetchIndikators,
  createIndikator,
  updateIndikator,
  deleteIndikator,
  createSubIndikator,
  updateSubIndikator,
  deleteSubIndikator,
} from '../../services/apiService';
import Swal from 'sweetalert2';
import IconButton from '../../components/IconButton';

const Indikator = () => {
  const { t } = useSettings();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [subModalMode, setSubModalMode] = useState('add'); // 'add' | 'edit'
  const [currentIndikator, setCurrentIndikator] = useState(null);
  const [currentSubIndikator, setCurrentSubIndikator] = useState(null);
  const [selectedIndikator, setSelectedIndikator] = useState(null);
  const [subSearchTerm, setSubSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    indikator: '',
    bobot: '',
    penilaian: '',
  });

  const [subFormData, setSubFormData] = useState({
    subindikator: '',
    bobot: '',
    isactive: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submittingSub, setSubmittingSub] = useState(false);
  const [indikatorWarning, setIndikatorWarning] = useState(null);
  const [subWarning, setSubWarning] = useState(null);

  useEffect(() => {
    document.title = `${t('indikator')} | SIMANTAP`;
  }, [t]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchIndikators();
      setData(result);
    } catch (err) {
      setError(err.message || 'Gagal memuat data indikator');
      console.error('Error loading indikators:', err);
    } finally {
      setLoading(false);
    }
  };

  // Search + Pagination state (mimic DataTable controls)
  const [searchTerm, setSearchTerm] = useState('');

  // Filter data based on search term
  const filteredList = data.filter((item) => {
    if (!searchTerm) return true;
    const q = searchTerm.toString().toLowerCase();
    if (item.indikator && item.indikator.toLowerCase().includes(q)) return true;
    if (item.penilaian && item.penilaian.toLowerCase().includes(q)) return true;
    if (item.bobot && item.bobot.toString().toLowerCase().includes(q)) return true;
    if (item.sub_indikators && item.sub_indikators.some((s) => s.subindikator && s.subindikator.toLowerCase().includes(q))) return true;
    return false;
  });

  // Show full list (no pagination)
  const totalItems = filteredList.length;
  const pagedList = filteredList;
  const startIndex = 0;

  // no pagination helpers needed when showing all items

  // Group the paged list by penilaian for rowspan rendering
  const groupedData = pagedList.reduce((acc, item) => {
    const penilaian = item.penilaian || 'Lainnya';
    if (!acc[penilaian]) acc[penilaian] = [];
    acc[penilaian].push(item);
    return acc;
  }, {});

  // Helper: sum of active subindikator bobot for an indikator
  const sumActiveSub = (indikator) => {
    if (!indikator || !Array.isArray(indikator.sub_indikators)) return 0;
    return indikator.sub_indikators.reduce((sum, s) => {
      if (!s || !s.isactive) return sum; // only active
      return sum + (parseFloat(s.bobot) || 0);
    }, 0);
  };

  // Helper: whether there's a mismatch (only for Kinerja+Potensial)
  const isSubMismatch = (indikator) => {
    if (!indikator) return false;
    const pool = ['Kinerja', 'Potensial'];
    if (!pool.includes(indikator.penilaian)) return false;
    const parent = parseFloat(indikator.bobot) || 0;
    const subSum = sumActiveSub(indikator);
    return Math.abs(parent - subSum) > 0.001; // small epsilon
  };

  const handleOpenModal = (mode, indikator = null) => {
    setModalMode(mode);
    setCurrentIndikator(indikator);
    
    if (mode === 'edit' && indikator) {
      setFormData({
        indikator: indikator.indikator,
        bobot: indikator.bobot,
        penilaian: indikator.penilaian,
      });
    } else {
      setFormData({
        indikator: '',
        bobot: '',
        penilaian: '',
      });
    }
    
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setCurrentIndikator(null);
    setFormData({
      indikator: '',
      bobot: '',
      penilaian: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (modalMode === 'add') {
        await createIndikator(formData);
        Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Indikator berhasil ditambahkan',
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        // Check if bobot is being changed
        if (currentIndikator && currentIndikator.bobot !== formData.bobot) {
          const result = await Swal.fire({
            icon: 'warning',
            title: 'Perhatian!',
            text: 'Mengubah bobot indikator akan mereset bobot semua subindikator menjadi 0. Lanjutkan?',
            showCancelButton: true,
            reverseButtons: true,
            confirmButtonText: 'Ya, Lanjutkan',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
          });

          if (!result.isConfirmed) {
            return;
          }
        }

        await updateIndikator(currentIndikator.id, formData);
        Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Indikator berhasil diperbarui',
          timer: 2000,
          showConfirmButton: false,
        });
      }

      handleCloseModal();
      loadData();
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal!',
        text: err.message || 'Terjadi kesalahan saat menyimpan data',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Live validation: total indikator bobot per penilaian (Kinerja/Potensial) should not exceed 100%
  useEffect(() => {
    const pen = formData.penilaian;
    const pool = ['Kinerja', 'Potensial'];
    if (!pen || !pool.includes(pen)) {
      setIndikatorWarning(null);
      return;
    }

    const currentVal = parseFloat(formData.bobot) || 0;

    // Sum all existing indikator bobot that belong to Kinerja OR Potensial
    const sumExisting = data.reduce((sum, it) => {
      if (!pool.includes(it.penilaian)) return sum;
      // If editing, exclude the current indikator's existing bobot
      if (modalMode === 'edit' && currentIndikator && it.id === currentIndikator.id) return sum;
      return sum + (parseFloat(it.bobot) || 0);
    }, 0);

    const total = sumExisting + currentVal;
    if (total > 100) {
      setIndikatorWarning(`Total bobot Kinerja dan Potensial sekarang ${total}% (melebihi 100%)`);
    } else {
      setIndikatorWarning(null);
    }
  }, [formData.bobot, formData.penilaian, data, modalMode, currentIndikator]);

  const handleDelete = async (id, indikatorName) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Konfirmasi Hapus',
      text: `Apakah Anda yakin ingin menghapus indikator "${indikatorName}"?`,
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
    });

    if (result.isConfirmed) {
      try {
        await deleteIndikator(id);
        Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Indikator berhasil dihapus',
          timer: 2000,
          showConfirmButton: false,
        });
        loadData();
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Gagal!',
          text: err.message || 'Terjadi kesalahan saat menghapus data',
        });
      }
    }
  };

  // Detail Modal Functions
  const handleOpenDetailModal = (indikator) => {
    setSelectedIndikator(indikator);
    setSubSearchTerm('');
    setShowDetailModal(true);
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedIndikator(null);
  };

  // Subindikator Modal Functions
  const handleOpenSubModal = (mode, subIndikator = null) => {
    setSubModalMode(mode);
    setCurrentSubIndikator(subIndikator);
    
    if (mode === 'edit' && subIndikator) {
      setSubFormData({
        subindikator: subIndikator.subindikator,
        bobot: subIndikator.bobot,
        isactive: subIndikator.isactive,
      });
    } else {
      setSubFormData({
        subindikator: '',
        bobot: '',
        isactive: true,
      });
    }
    
    setShowSubModal(true);
  };

  const handleCloseSubModal = () => {
    setShowSubModal(false);
    setCurrentSubIndikator(null);
    setSubFormData({
      subindikator: '',
      bobot: '',
      isactive: true,
    });
  };

  const handleSubmitSub = async (e) => {
    e.preventDefault();
    setSubmittingSub(true);

    try {
      if (subModalMode === 'add') {
        await createSubIndikator({
          ...subFormData,
          indikator_id: selectedIndikator.id,
        });
        Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Subindikator berhasil ditambahkan',
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        await updateSubIndikator(currentSubIndikator.id, subFormData);
        Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Subindikator berhasil diperbarui',
          timer: 2000,
          showConfirmButton: false,
        });
      }

      handleCloseSubModal();
      loadData();

      // Update selected indikator
      const updatedData = await fetchIndikators();
      const updated = updatedData.find(item => item.id === selectedIndikator.id);
      if (updated) {
        setSelectedIndikator(updated);
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal!',
        text: err.message || 'Terjadi kesalahan saat menyimpan data',
      });
    } finally {
      setSubmittingSub(false);
    }
  };

  // Live validation: total subindikator tidak boleh melebihi bobot indikator (untuk Kinerja/Potensial)
  useEffect(() => {
    if (!selectedIndikator) {
      setSubWarning(null);
      return;
    }

    const pen = selectedIndikator.penilaian;
    if (!(pen === 'Kinerja' || pen === 'Potensial')) {
      setSubWarning(null);
      return;
    }

    // Only count subindikators that are active
    const currentVal = (subFormData.isactive) ? (parseFloat(subFormData.bobot) || 0) : 0;

    const sumExisting = (selectedIndikator.sub_indikators || []).reduce((sum, s) => {
      if (!s.isactive) return sum; // ignore inactive subindikator
      if (subModalMode === 'edit' && currentSubIndikator && s.id === currentSubIndikator.id) return sum;
      return sum + (parseFloat(s.bobot) || 0);
    }, 0);

    const total = sumExisting + currentVal;
    const parentBobot = parseFloat(selectedIndikator.bobot) || 0;

    if (total > parentBobot) {
      setSubWarning(`Total bobot subindikator: ${total}% (melebihi bobot indikator ${parentBobot}%)`);
    } else {
      setSubWarning(null);
    }
  }, [subFormData.bobot, subFormData.isactive, selectedIndikator, subModalMode, currentSubIndikator]);

  const handleDeleteSub = async (id, subIndikatorName) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Konfirmasi Hapus',
      text: `Apakah Anda yakin ingin menghapus subindikator "${subIndikatorName}"?`,
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
    });

    if (result.isConfirmed) {
      try {
        await deleteSubIndikator(id);
        Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Subindikator berhasil dihapus',
          timer: 2000,
          showConfirmButton: false,
        });
        
        loadData();
        
        // Update selected indikator
        const updatedData = await fetchIndikators();
        const updated = updatedData.find(item => item.id === selectedIndikator.id);
        if (updated) {
          setSelectedIndikator(updated);
        }
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Gagal!',
          text: err.message || 'Terjadi kesalahan saat menghapus data',
        });
      }
    }
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
            {t('indikator')}
          </h1>
          <p className="mt-2 text-sm md:text-base text-gray-600 dark:text-gray-300">
            Kelola data indikator dan subindikator penilaian
          </p>
        </div>
      </div>

      <div className="mb-4 flex justify-end">
        <IconButton onClick={() => handleOpenModal('add')} variant="primary" size="lg" className="gap-2">
          <i className="fas fa-plus mr-2" />
          Tambah Indikator
        </IconButton>
      </div>

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <svg
              className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0"
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
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              <button
                onClick={loadData}
                className="mt-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-500 cursor-pointer"
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
                  placeholder={t('search') || 'Cari indikator, penilaian, sub...'}
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-all shadow-sm"
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
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-3 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider">
                    Penilaian
                  </th>
                  <th className="px-3 py-3 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider">
                    Indikator
                  </th>
                  <th className="px-3 py-3 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider">
                    Bobot
                  </th>
                  <th className="px-3 py-3 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider">
                    Subindikator
                  </th>
                  <th className="px-3 py-3 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="relative">
                          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700"></div>
                          <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent absolute top-0 left-0"></div>
                        </div>
                        <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-300">{t('loadingData')}</p>
                      </div>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
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
                        Mulai dengan menambahkan indikator baru
                      </p>
                    </td>
                  </tr>
                ) : (
                  (() => {
                    return Object.keys(groupedData).map((penilaian) => {
                      const items = groupedData[penilaian];
                      return items.map((indikator, idx) => {
                        return (
                          <tr
                            key={indikator.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            
                            {idx === 0 && (
                              <td
                                rowSpan={items.length}
                                className="px-3 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-center align-middle"
                              >
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-md font-medium bg-blue-600 text-white">
                                  {penilaian}
                                </span>
                              </td>
                            )}
                            <td className="px-3 py-4 text-sm text-gray-900 dark:text-white">
                              {indikator.indikator}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-md font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                {indikator.bobot}%
                              </span>
                              {isSubMismatch(indikator) && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-md font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                                  <i className="fas fa-exclamation-triangle mr-1" /> Bobot sub: {sumActiveSub(indikator)}%
                                </span>
                              )}
                            </td>
                            <td
                              className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center"
                              onClick={() => handleOpenDetailModal(indikator)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenDetailModal(indikator); }}
                            >
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-md font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 cursor-pointer hover:opacity-90">
                                {indikator.sub_indikators?.length || 0} Subindikator
                              </span>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-center text-sm font-medium">
                              <div className="flex items-center justify-center gap-2">
                                <IconButton onClick={() => handleOpenDetailModal(indikator)} variant="default" size="lg" title="Detail">
                                  <i className="fas fa-eye" />
                                </IconButton>
                                <IconButton onClick={() => handleOpenModal('edit', indikator)} variant="primary" size="lg" title="Edit">
                                  <i className="fas fa-edit" />
                                </IconButton>
                                <IconButton onClick={() => handleDelete(indikator.id, indikator.indikator)} variant="danger" size="lg" title="Hapus">
                                  <i className="fas fa-trash" />
                                </IconButton>
                              </div>
                            </td>
                          </tr>
                        );
                      });
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
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto"
              style={{
                animation: 'modalSlideUp 0.3s ease-out',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleSubmit}>
                {/* Header */}
                <div
                  className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 rounded-t-2xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)',
                  }}
                >
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {modalMode === 'add' ? 'Tambah Indikator' : 'Edit Indikator'}
                  </h3>
                  <IconButton onClick={handleCloseModal} variant="ghost" size="lg" title="Tutup" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all duration-200 hover:scale-110 hover:rotate-90">
                    <i className="fas fa-times text-2xl text-gray-600 dark:text-gray-300" />
                  </IconButton>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                  <div>
                    <label htmlFor="indikator" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nama Indikator
                    </label>
                    <input
                      type="text"
                      id="indikator"
                      required
                      value={formData.indikator}
                      onChange={(e) => setFormData({ ...formData, indikator: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                      placeholder="Masukkan nama indikator"
                    />
                  </div>
                  <div>
                    <label htmlFor="bobot" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bobot (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        id="bobot"
                        required
                        step="0.01"
                        value={formData.bobot}
                        onChange={(e) => setFormData({ ...formData, bobot: e.target.value })}
                        className="block w-full pr-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                        placeholder="0.00"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600 dark:text-gray-300">%</span>
                    </div>
                    {indikatorWarning && (
                      <div className="mt-2 text-sm text-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-2">
                        {indikatorWarning}
                      </div>
                    )}
                  </div>
                  <div>
                    <label htmlFor="penilaian" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Penilaian
                    </label>
                    <div className="relative">
                      <select
                        name="penilaian"
                        value={formData.penilaian}
                        onChange={(e) => setFormData({ ...formData, penilaian: e.target.value })}
                        className="appearance-none block w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg pl-4 pr-10 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer transition-all shadow-sm"
                      >
                        <option value="">-- Pilih Penilaian --</option>
                        <option value="Kinerja">Kinerja</option>
                        <option value="Potensial">Potensial</option>
                        <option value="Tambahan">Tambahan</option>
                      </select>
                      <svg
                        className="absolute right-3 top-3 h-5 w-5 text-gray-400 pointer-events-none"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl bg-gray-50 dark:bg-gray-700/50">
                  <IconButton type="button" onClick={handleCloseModal} variant="secondary" size="lg" disabled={submitting}>
                    <i className="fas fa-times-circle mr-2" />
                    Batal
                  </IconButton>
                  <IconButton type="submit" variant="primary" size="lg" disabled={submitting || Boolean(indikatorWarning)} aria-busy={submitting}>
                    {submitting ? <i className="fas fa-spinner fa-spin mr-2" /> : (modalMode === 'add' ? <i className="fas fa-plus mr-2" /> : <i className="fas fa-save mr-2" />)}
                    {modalMode === 'add' ? 'Tambah' : 'Simpan'}
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

      {/* Detail Modal */}
      {showDetailModal && selectedIndikator && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ease-out"
            onClick={handleCloseDetailModal}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col min-h-0 pointer-events-auto"
              style={{
                animation: 'modalSlideUp 0.3s ease-out',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 rounded-t-2xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)',
                }}
              >
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Detail Indikator
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {selectedIndikator.sub_indikators?.length || 0} Subindikator
                  </p>
                </div>
                <IconButton onClick={handleCloseDetailModal} variant="ghost" size="lg" title="Tutup" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all duration-200 hover:scale-110 hover:rotate-90">
                  <i className="fas fa-times text-2xl text-gray-600 dark:text-gray-300" />
                </IconButton>
              </div>

              {/* Content: simplified to a scrollable table only */}
              <div className="flex-1 p-6 flex flex-col min-h-0">
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {selectedIndikator.indikator}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-600 text-white">
                      Bobot: {selectedIndikator.bobot}%
                    </span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-600 text-white">
                      Penilaian: {selectedIndikator.penilaian}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Daftar Subindikator</h4>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Cari subindikator..."
                        value={subSearchTerm}
                        onChange={(e) => setSubSearchTerm(e.target.value)}
                        className="w-56 pl-10 pr-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <svg className="absolute left-3 top-3 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <IconButton onClick={() => handleOpenSubModal('add')} variant="primary" size="lg" className="gap-2">
                      <i className="fas fa-plus mr-2" />
                      Tambah
                    </IconButton>
                  </div>
                </div>

                {/* Warning if sub total mismatch */}
                {isSubMismatch(selectedIndikator) && (
                  <div className="mb-4 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200 flex-shrink-0">
                        <i className="fas fa-exclamation-triangle" />
                      </div>
                      <div>
                        <div className="font-medium">Peringatan: Total bobot subindikator aktif tidak sama dengan bobot indikator</div>
                        <div className="text-sm">Total bobot subindikator aktif: {sumActiveSub(selectedIndikator)}% — Bobot indikator: {selectedIndikator.bobot}%</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="h-0 flex-1 overflow-auto min-h-0 rounded-lg border border-gray-200 dark:border-gray-700">
                  {(() => {
                    const allSubs = selectedIndikator?.sub_indikators || [];
                    const filteredSubs = allSubs.filter((s) => {
                      if (!subSearchTerm) return true;
                      return (s.subindikator || '').toString().toLowerCase().includes(subSearchTerm.toLowerCase());
                    });

                    if (allSubs.length === 0) {
                      return (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                          <p className="font-medium">Belum ada subindikator</p>
                          <p className="text-sm mt-1">Klik tombol "Tambah" untuk menambah subindikator baru</p>
                        </div>
                      );
                    }

                    if (filteredSubs.length === 0) {
                      return (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                          <p className="font-medium">Tidak ada subindikator yang cocok</p>
                          <p className="text-sm mt-1">Coba kata kunci lain</p>
                        </div>
                      );
                    }

                    return (
                      <div className="w-full min-w-0">
                        <table className="w-full text-sm table-auto min-w-full sm:table-fixed">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-3 py-2 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider w-12">No</th>
                            <th className="px-3 py-2 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider min-w-0 w-100">Subindikator</th>
                            <th className="px-3 py-2 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider w-30">Bobot</th>
                            <th className="px-3 py-2 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider w-30">Status</th>
                            <th className="px-3 py-2 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {filteredSubs.map((sub, idx) => (
                            <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center w-12">{idx + 1}</td>
                              <td className="px-3 py-2 text-sm text-gray-900 dark:text-white min-w-0 w-full truncate">{sub.subindikator}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs w-20 text-center">
                                <span className="inline-flex items-center px-1 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{sub.bobot}%</span>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs w-20 text-center">
                                <span className={`inline-flex items-center px-1 py-0.5 rounded-full text-xs font-medium ${
                                  sub.isactive
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                }`}>{sub.isactive ? 'Aktif' : 'Tidak'}</span>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-center text-sm font-medium">
                                <div className="flex items-center justify-center gap-2">
                                  <IconButton onClick={() => handleOpenSubModal('edit', sub)} variant="primary" size="lg" title="Edit">
                                    <i className="fas fa-edit" />
                                  </IconButton>
                                  <IconButton onClick={() => handleDeleteSub(sub.id, sub.subindikator)} variant="danger" size="lg" title="Hapus">
                                    <i className="fas fa-trash" />
                                  </IconButton>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end p-6 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl bg-gray-50 dark:bg-gray-700/50">
                <IconButton onClick={handleCloseDetailModal} variant="default" size="lg">
                  <i className="fas fa-times-circle mr-2" />
                  Tutup
                </IconButton>
              </div>
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

      {/* Subindikator Add/Edit Modal */}
      {showSubModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] transition-opacity duration-300 ease-out"
            onClick={handleCloseSubModal}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto"
              style={{
                animation: 'modalSlideUp 0.3s ease-out',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleSubmitSub}>
                {/* Header */}
                <div
                  className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 rounded-t-2xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)',
                  }}
                >
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {subModalMode === 'add' ? 'Tambah Subindikator' : 'Edit Subindikator'}
                  </h3>
                  <IconButton onClick={handleCloseSubModal} variant="ghost" size="lg" title="Tutup" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all duration-200 hover:scale-110 hover:rotate-90">
                    <i className="fas fa-times text-2xl text-gray-600 dark:text-gray-300" />
                  </IconButton>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                  <div>
                    <label htmlFor="subindikator" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nama Subindikator
                    </label>
                    <input
                      type="text"
                      id="subindikator"
                      required
                      value={subFormData.subindikator}
                      onChange={(e) => setSubFormData({ ...subFormData, subindikator: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                      placeholder="Masukkan nama subindikator"
                    />
                  </div>
                  <div>
                    <label htmlFor="sub-bobot" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bobot (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        id="sub-bobot"
                        required
                        step="0.01"
                        value={subFormData.bobot}
                        onChange={(e) => setSubFormData({ ...subFormData, bobot: e.target.value })}
                        className="block w-full pr-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                        placeholder="0.00"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600 dark:text-gray-300">%</span>
                    </div>
                    {subWarning && (
                      <div className="mt-2 text-sm text-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-2">
                        {subWarning}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setSubFormData({ ...subFormData, isactive: !subFormData.isactive })}
                      aria-pressed={subFormData.isactive}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${subFormData.isactive ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                      title={subFormData.isactive ? 'Aktif' : 'Tidak Aktif'}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${subFormData.isactive ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{subFormData.isactive ? 'Aktif' : 'Tidak Aktif'}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl bg-gray-50 dark:bg-gray-700/50">
                  <IconButton type="button" onClick={handleCloseSubModal} variant="secondary" size="lg" disabled={submittingSub}>
                    <i className="fas fa-times-circle mr-2" />
                    Batal
                  </IconButton>
                  <IconButton type="submit" variant="primary" size="lg" disabled={submittingSub || Boolean(subWarning)} aria-busy={submittingSub}>
                    {submittingSub ? <i className="fas fa-spinner fa-spin mr-2" /> : (subModalMode === 'add' ? <i className="fas fa-plus mr-2" /> : <i className="fas fa-save mr-2" />)}
                    {subModalMode === 'add' ? 'Tambah' : 'Simpan'}
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

export default Indikator;
