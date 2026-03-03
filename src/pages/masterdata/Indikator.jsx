import { useEffect, useState } from "react";
import { useSettings } from "../../context/SettingsContext";
import {
  fetchIndikators,
  createIndikator,
  updateIndikator,
  deleteIndikator,
  createSubIndikator,
  updateSubIndikator,
  deleteSubIndikator,
  bulkUpdateSubBobot,
  fetchInstrumens,
} from "../../services/apiService";
import Swal from "sweetalert2";
import IconButton from "../../components/IconButton";
import Breadcrumb from "../../components/Breadcrumb";
import { PRIMARY_COLORS, BG_COLORS, TEXT_ON_BG_COLORS, SECONDARY_COLORS } from "../../config/colors";

const Indikator = () => {
  const { t } = useSettings();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // 'add' | 'edit'
  const [subModalMode, setSubModalMode] = useState("add"); // 'add' | 'edit'
  const [currentIndikator, setCurrentIndikator] = useState(null);
  const [currentSubIndikator, setCurrentSubIndikator] = useState(null);
  const [selectedIndikator, setSelectedIndikator] = useState(null);
  const [subSearchTerm, setSubSearchTerm] = useState("");
  const [instrumens, setInstrumens] = useState([]);
  const [showInstrumenModal, setShowInstrumenModal] = useState(false);
  const [selectedSubForInstrumen, setSelectedSubForInstrumen] = useState(null);

  const [formData, setFormData] = useState({
    indikator: "",
    bobot: "",
    penilaian: "",
  });

  const [subFormData, setSubFormData] = useState({
    subindikator: "",
    bobot: "",
    isactive: true,
    auto_sync: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submittingSub, setSubmittingSub] = useState(false);
  const [indikatorWarning, setIndikatorWarning] = useState(null);
  const [subWarning, setSubWarning] = useState(null);
  // Bulk bobot editor
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSelectedIndikatorId, setBulkSelectedIndikatorId] = useState(null);
  const [bulkSubInputs, setBulkSubInputs] = useState([]); // {id, subindikator, bobot, isactive}
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkErrors, setBulkErrors] = useState(null);
  const [bulkWarning, setBulkWarning] = useState(null);

  useEffect(() => {
    document.title = `${t("indikator")} | SIMANTAP`;
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
      setError(err.message || "Gagal memuat data indikator");
      console.error("Error loading indikators:", err);
    } finally {
      setLoading(false);
    }
  };

  // Search + Pagination state (mimic DataTable controls)
  const [searchTerm, setSearchTerm] = useState("");

  // Filter data based on search term
  const filteredList = data.filter((item) => {
    if (!searchTerm) return true;
    const q = searchTerm.toString().toLowerCase();
    if (item.indikator && item.indikator.toLowerCase().includes(q)) return true;
    if (item.penilaian && item.penilaian.toLowerCase().includes(q)) return true;
    if (item.bobot && item.bobot.toString().toLowerCase().includes(q))
      return true;
    if (
      item.sub_indikators &&
      item.sub_indikators.some(
        (s) => s.subindikator && s.subindikator.toLowerCase().includes(q)
      )
    )
      return true;
    return false;
  });

  // Show full list (no pagination)
  const totalItems = filteredList.length;
  const pagedList = filteredList;
  const startIndex = 0;

  // no pagination helpers needed when showing all items

  // Group the paged list by penilaian for rowspan rendering
  const groupedData = pagedList.reduce((acc, item) => {
    const penilaian = item.penilaian || "Lainnya";
    if (!acc[penilaian]) acc[penilaian] = [];
    acc[penilaian].push(item);
    return acc;
  }, {});

  // Totals per penilaian (page-level notifications)
  // Use the currently visible list (`pagedList`) to avoid counting items
  // that may be duplicated in `data` or outside the current filtered view.
  // Exclude "Tambahan" from weight calculation
  const sumByPenilaian = (pen) =>
    pagedList.reduce(
      (sum, it) =>
        it.penilaian === pen ? sum + (parseFloat(it.bobot) || 0) : sum,
      0
    );
  const totalKinerja =
    Math.round((sumByPenilaian("Kinerja") + Number.EPSILON) * 100) / 100;
  const totalPotensial =
    Math.round((sumByPenilaian("Potensial") + Number.EPSILON) * 100) / 100;

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
    const pool = ["Kinerja", "Potensial"];
    if (!pool.includes(indikator.penilaian)) return false;
    const parent = parseFloat(indikator.bobot) || 0;
    const subSum = sumActiveSub(indikator);
    return Math.abs(parent - subSum) > 0.001; // small epsilon
  };

  const handleOpenModal = (mode, indikator = null) => {
    setModalMode(mode);
    setCurrentIndikator(indikator);

    if (mode === "edit" && indikator) {
      setFormData({
        indikator: indikator.indikator,
        bobot: indikator.bobot,
        penilaian: indikator.penilaian,
      });
    } else {
      setFormData({
        indikator: "",
        bobot: "",
        penilaian: "",
      });
    }

    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setCurrentIndikator(null);
    setFormData({
      indikator: "",
      bobot: "",
      penilaian: "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Prepare data, set bobot to 0 for Tambahan
      const submitData = {
        ...formData,
        bobot: formData.penilaian === "Tambahan" ? "0" : formData.bobot,
      };

      if (modalMode === "add") {
        await createIndikator(submitData);
        Swal.fire({
          icon: "success",
          title: "Berhasil!",
          text: "Indikator berhasil ditambahkan",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        // Check if bobot is being changed (skip for Tambahan)
        if (formData.penilaian !== "Tambahan" && currentIndikator && currentIndikator.bobot !== formData.bobot) {
          const result = await Swal.fire({
            icon: "warning",
            title: "Perhatian!",
            text: "Mengubah bobot indikator akan mereset bobot semua subindikator menjadi 0. Lanjutkan?",
            showCancelButton: true,
            reverseButtons: true,
            confirmButtonText: "Lanjutkan",
            cancelButtonText: "Batal",
            confirmButtonColor: PRIMARY_COLORS.blue,
            cancelButtonColor: PRIMARY_COLORS.red,
          });

          if (!result.isConfirmed) {
            return;
          }
        }

        await updateIndikator(currentIndikator.id, submitData);
        Swal.fire({
          icon: "success",
          title: "Berhasil!",
          text: "Indikator berhasil diperbarui",
          timer: 2000,
          showConfirmButton: false,
        });
      }

      handleCloseModal();
      loadData();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Gagal!",
        text: err.message || "Terjadi kesalahan saat menyimpan data",
        confirmButtonColor: PRIMARY_COLORS.blue,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Live validation: total indikator bobot per penilaian (Kinerja/Potensial) should not exceed 100%
  // Skip validation for Tambahan
  useEffect(() => {
    const pen = formData.penilaian;
    const pool = ["Kinerja", "Potensial"];
    if (!pen || !pool.includes(pen)) {
      setIndikatorWarning(null);
      return;
    }

    const currentVal = parseFloat(formData.bobot) || 0;

    // Sum all existing indikator bobot that belong to the same penilaian
    const sumExisting = data.reduce((sum, it) => {
      if (it.penilaian !== pen) return sum;
      // If editing, exclude the current indikator's existing bobot
      if (
        modalMode === "edit" &&
        currentIndikator &&
        it.id === currentIndikator.id
      )
        return sum;
      return sum + (parseFloat(it.bobot) || 0);
    }, 0);

    const total =
      Math.round((sumExisting + currentVal + Number.EPSILON) * 100) / 100;
    if (total > 100) {
      setIndikatorWarning(
        `Total bobot ${pen} sekarang ${total}% (melebihi 100%)`
      );
    } else {
      // allow saving when < 100; only warn on overflow
      setIndikatorWarning(null);
    }
  }, [formData.bobot, formData.penilaian, data, modalMode, currentIndikator]);

  // Auto-set bobot to 0 when Tambahan is selected
  useEffect(() => {
    if (formData.penilaian === "Tambahan" && formData.bobot !== "0") {
      setFormData(prev => ({ ...prev, bobot: "0" }));
    }
  }, [formData.penilaian]);

  const handleDelete = async (id, indikatorName) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Konfirmasi Hapus",
      text: `Apakah Anda yakin ingin menghapus indikator "${indikatorName}"?`,
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: "Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: PRIMARY_COLORS.blue,
      cancelButtonColor: PRIMARY_COLORS.red,
    });

    if (result.isConfirmed) {
      try {
        await deleteIndikator(id);
        Swal.fire({
          icon: "success",
          title: "Berhasil!",
          text: "Indikator berhasil dihapus",
          timer: 2000,
          showConfirmButton: false,
        });
        loadData();
      } catch (err) {
        Swal.fire({
          icon: "error",
          title: "Gagal!",
          text: err.message || "Terjadi kesalahan saat menghapus data",
          confirmButtonColor: PRIMARY_COLORS.blue,
        });
      }
    }
  };

  // Detail Modal Functions
  const handleOpenDetailModal = async (indikator) => {
    setSelectedIndikator(indikator);
    setSubSearchTerm("");
    setShowDetailModal(true);
    // Load instrumens data
    try {
      const result = await fetchInstrumens();
      setInstrumens(result || []);
    } catch (err) {
      console.error("Error loading instrumens:", err);
      setInstrumens([]);
    }
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedIndikator(null);
  };

  // Instrumen Modal Functions
  const handleOpenInstrumenModal = (subindikator) => {
    setSelectedSubForInstrumen(subindikator);
    setShowInstrumenModal(true);
  };

  const handleCloseInstrumenModal = () => {
    setShowInstrumenModal(false);
    setSelectedSubForInstrumen(null);
  };

  // Subindikator Modal Functions
  const handleOpenSubModal = (mode, subIndikator = null) => {
    setSubModalMode(mode);
    setCurrentSubIndikator(subIndikator);

    if (mode === "edit" && subIndikator) {
      setSubFormData({
        subindikator: subIndikator.subindikator,
        bobot: subIndikator.bobot,
        isactive: subIndikator.isactive,
        auto_sync: subIndikator.auto_sync || false,
      });
    } else {
      setSubFormData({
        subindikator: "",
        bobot: "",
        isactive: true,
        auto_sync: false,
      });
    }

    setShowSubModal(true);
  };

  const handleCloseSubModal = () => {
    setShowSubModal(false);
    setCurrentSubIndikator(null);
    setSubFormData({
      subindikator: "",
      bobot: "",
      isactive: true,
      auto_sync: false,
    });
  };

  const handleSubmitSub = async (e) => {
    e.preventDefault();
    setSubmittingSub(true);

    try {
      // Prepare data, set bobot to 0 for Tambahan parent
      const submitData = {
        ...subFormData,
        bobot: selectedIndikator && selectedIndikator.penilaian === "Tambahan" ? "0" : subFormData.bobot,
      };

      if (subModalMode === "add") {
        await createSubIndikator({
          ...submitData,
          indikator_id: selectedIndikator.id,
        });
        Swal.fire({
          icon: "success",
          title: "Berhasil!",
          text: "Subindikator berhasil ditambahkan",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        await updateSubIndikator(currentSubIndikator.id, submitData);
        Swal.fire({
          icon: "success",
          title: "Berhasil!",
          text: "Subindikator berhasil diperbarui",
          timer: 2000,
          showConfirmButton: false,
        });
      }

      handleCloseSubModal();
      loadData();

      // Update selected indikator
      const updatedData = await fetchIndikators();
      const updated = updatedData.find(
        (item) => item.id === selectedIndikator.id
      );
      if (updated) {
        setSelectedIndikator(updated);
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Gagal!",
        text: err.message || "Terjadi kesalahan saat menyimpan data",
        confirmButtonColor: PRIMARY_COLORS.blue,
      });
    } finally {
      setSubmittingSub(false);
    }
  };

  // Live validation: total subindikator tidak boleh melebihi bobot indikator (untuk Kinerja/Potensial)
  // Skip validation for Tambahan
  useEffect(() => {
    if (!selectedIndikator) {
      setSubWarning(null);
      return;
    }

    const pen = selectedIndikator.penilaian;
    if (!(pen === "Kinerja" || pen === "Potensial")) {
      setSubWarning(null);
      return;
    }

    // Only count subindikators that are active
    const currentVal = subFormData.isactive
      ? parseFloat(subFormData.bobot) || 0
      : 0;

    const sumExisting = (selectedIndikator.sub_indikators || []).reduce(
      (sum, s) => {
        if (!s.isactive) return sum; // ignore inactive subindikator
        if (
          subModalMode === "edit" &&
          currentSubIndikator &&
          s.id === currentSubIndikator.id
        )
          return sum;
        return sum + (parseFloat(s.bobot) || 0);
      },
      0
    );

    const total = sumExisting + currentVal;
    const parentBobot = parseFloat(selectedIndikator.bobot) || 0;

    if (total > parentBobot) {
      setSubWarning(
        `Total bobot subindikator: ${total}% (melebihi bobot indikator ${parentBobot}%)`
      );
    } else {
      setSubWarning(null);
    }
  }, [
    subFormData.bobot,
    subFormData.isactive,
    selectedIndikator,
    subModalMode,
    currentSubIndikator,
  ]);

  // Auto-set bobot to 0 when parent indikator is Tambahan
  useEffect(() => {
    if (selectedIndikator && selectedIndikator.penilaian === "Tambahan" && subFormData.bobot !== "0") {
      setSubFormData(prev => ({ ...prev, bobot: "0" }));
    }
  }, [selectedIndikator]);

  const handleDeleteSub = async (id, subIndikatorName) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Konfirmasi Hapus",
      text: `Apakah Anda yakin ingin menghapus subindikator "${subIndikatorName}"?`,
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: "Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: PRIMARY_COLORS.blue,
      cancelButtonColor: PRIMARY_COLORS.red,
    });

    if (result.isConfirmed) {
      try {
        await deleteSubIndikator(id);
        Swal.fire({
          icon: "success",
          title: "Berhasil!",
          text: "Subindikator berhasil dihapus",
          timer: 2000,
          showConfirmButton: false,
        });

        loadData();

        // Update selected indikator
        const updatedData = await fetchIndikators();
        const updated = updatedData.find(
          (item) => item.id === selectedIndikator.id
        );
        if (updated) {
          setSelectedIndikator(updated);
        }
      } catch (err) {
        Swal.fire({
          icon: "error",
          title: "Gagal!",
          text: err.message || "Terjadi kesalahan saat menghapus data",
          confirmButtonColor: PRIMARY_COLORS.blue,
        });
      }
    }
  };

  // Bulk bobot handlers
  const handleOpenBulkModal = () => {
    // default select first indikator if available (exclude Tambahan)
    const nonTambahanData = data.filter(d => d.penilaian !== "Tambahan");
    const first = nonTambahanData && nonTambahanData.length > 0 ? nonTambahanData[0].id : null;
    setBulkSelectedIndikatorId(first);
    if (first) {
      const ind = data.find((d) => d.id === first);
      const subs = (ind?.sub_indikators || []).map((s) => ({
        id: s.id,
        subindikator: s.subindikator,
        bobot: s.bobot,
        isactive: s.isactive,
      }));
      setBulkSubInputs(subs);
    } else {
      setBulkSubInputs([]);
    }
    setBulkErrors(null);
    setShowBulkModal(true);
  };

  const handleCloseBulkModal = () => {
    setShowBulkModal(false);
    setBulkSelectedIndikatorId(null);
    setBulkSubInputs([]);
    setBulkErrors(null);
    setBulkWarning(null);
  };

  const handleSelectBulkIndikator = (id) => {
    setBulkSelectedIndikatorId(id);
    const ind = data.find((d) => d.id === id);
    const subs = (ind?.sub_indikators || []).map((s) => ({
      id: s.id,
      subindikator: s.subindikator,
      bobot: s.bobot,
      isactive: s.isactive,
    }));
    setBulkSubInputs(subs);
    setBulkErrors(null);
  };

  const handleBulkBobotChange = (idx, value) => {
    const copy = [...bulkSubInputs];
    copy[idx] = { ...copy[idx], bobot: value };
    setBulkSubInputs(copy);
  };

  const handleSubmitBulk = async (e) => {
    e && e.preventDefault && e.preventDefault();
    if (!bulkSubInputs || bulkSubInputs.length === 0) {
      setBulkErrors("Tidak ada subindikator untuk disimpan");
      return;
    }

    // Client-side validation per validator rules
    const payload = [];
    for (const s of bulkSubInputs) {
      if (!s.id) {
        setBulkErrors("ID subindikator tidak boleh kosong");
        return;
      }
      const num = parseFloat(s.bobot);
      if (Number.isNaN(num) || num < 0 || num > 999.99) {
        setBulkErrors(
          `Nilai bobot untuk "${
            s.subindikator || s.id
          }" harus angka antara 0 dan 999.99`
        );
        return;
      }
      payload.push({ id: s.id, bobot: parseFloat(num.toFixed(2)) });
    }

    try {
      setBulkSubmitting(true);
      await bulkUpdateSubBobot(payload);
      Swal.fire({
        icon: "success",
        title: "Berhasil!",
        text: "Bobot subindikator berhasil disimpan",
        timer: 2000,
        showConfirmButton: false,
      });
      handleCloseBulkModal();
      await loadData();
      // update selected indikator in detail view if open
      if (selectedIndikator) {
        const updated = (await fetchIndikators()).find(
          (it) => it.id === selectedIndikator.id
        );
        if (updated) setSelectedIndikator(updated);
      }
    } catch (err) {
      setBulkErrors(err.message || "Gagal menyimpan bobot subindikator");
      Swal.fire({
        icon: "error",
        title: "Gagal!",
        text: err.message || "Gagal menyimpan bobot subindikator",
        confirmButtonColor: PRIMARY_COLORS.blue,
      });
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Realtime validation: compute parent indikator bobot from subindikators and ensure total per penilaian <= 100%
  useEffect(() => {
    if (!bulkSelectedIndikatorId) {
      setBulkWarning(null);
      return;
    }

    const ind = data.find((d) => d.id === bulkSelectedIndikatorId);
    if (!ind) {
      setBulkWarning(null);
      return;
    }

    const parentBobot = (bulkSubInputs || []).reduce(
      (s, x) => s + (x.isactive ? parseFloat(x.bobot) || 0 : 0),
      0
    );
    // Only enforce for Kinerja/Potensial
    if (ind.penilaian === "Kinerja" || ind.penilaian === "Potensial") {
      const sumExisting = data.reduce((sum, it) => {
        if (it.penilaian !== ind.penilaian) return sum;
        if (it.id === ind.id) return sum; // exclude current indikator
        return sum + (parseFloat(it.bobot) || 0);
      }, 0);

      const total =
        Math.round((sumExisting + parentBobot + Number.EPSILON) * 100) / 100;
      if (total > 100) {
        setBulkWarning(
          `Total bobot ${ind.penilaian} setelah perubahan: ${total}% (melebihi 100%)`
        );
        return;
      }
    }

    setBulkWarning(null);
  }, [bulkSubInputs, bulkSelectedIndikatorId, data]);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Breadcrumb */}
      <Breadcrumb />
      
      {/* Page Title */}
      <div className="mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
            {t("indikator")}
          </h1>
          <p className="mt-2 text-sm md:text-base text-gray-600 dark:text-gray-300">
            Kelola data indikator dan subindikator penilaian
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-end gap-4">
        <div>
          <IconButton
            onClick={() => handleOpenBulkModal()}
            variant="secondary"
            size="lg"
            className="gap-2"
          >
            <i className="fas fa-sliders-h text-lg mr-2" />
            Ubah Bobot Subindikator
          </IconButton>
        </div>
        <div>
          <IconButton
            onClick={() => handleOpenModal("add")}
            variant="primary"
            size="lg"
            className="gap-2"
          >
            <i className="fas fa-plus text-lg mr-2" />
            Tambah Indikator
          </IconButton>
        </div>
      </div>

      {/* Totals for Kinerja & Potensial */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {loading ? (
          <>
            {/* Loading skeleton for Total Bobot Kinerja */}
            <div className="bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 flex items-center gap-3 animate-pulse">
              <div className="flex-1">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32 mb-2"></div>
                <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
              </div>
              <div className="h-8 w-20 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
            </div>

            {/* Loading skeleton for Total Bobot Potensial */}
            <div className="bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 flex items-center gap-3 animate-pulse">
              <div className="flex-1">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32 mb-2"></div>
                <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
              </div>
              <div className="h-8 w-20 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
            </div>
          </>
        ) : (
          <>
            <div
              className={`border rounded-lg p-3 flex items-center gap-3`}
              style={{
                backgroundColor: totalKinerja === 100 ? BG_COLORS.green.light : BG_COLORS.red.light,
                borderColor: totalKinerja === 100 ? PRIMARY_COLORS.green : PRIMARY_COLORS.red,
                color: totalKinerja === 100 ? PRIMARY_COLORS.green : PRIMARY_COLORS.red
              }}
            >
              <div className="flex-1">
                <div className="text-sm font-semibold">Total Bobot Kinerja</div>
                <div className="text-lg font-bold">{totalKinerja}%</div>
              </div>
              <div className="text-sm">
                {totalKinerja === 100 ? (
                  <span className="inline-block px-2 py-1 rounded-full" style={{ backgroundColor: `${PRIMARY_COLORS.green}20`, color: PRIMARY_COLORS.green }}>
                    OK
                  </span>
                ) : (
                  <span className="inline-block px-2 py-1 rounded-full" style={{ backgroundColor: `${PRIMARY_COLORS.red}20`, color: PRIMARY_COLORS.red }}>
                    Harus 100%
                  </span>
                )}
              </div>
            </div>

            <div
              className={`border rounded-lg p-3 flex items-center gap-3`}
              style={{
                backgroundColor: totalPotensial === 100 ? BG_COLORS.green.light : BG_COLORS.red.light,
                borderColor: totalPotensial === 100 ? PRIMARY_COLORS.green : PRIMARY_COLORS.red,
                color: totalPotensial === 100 ? PRIMARY_COLORS.green : PRIMARY_COLORS.red
              }}
            >
              <div className="flex-1">
                <div className="text-sm font-semibold">Total Bobot Potensial</div>
                <div className="text-lg font-bold">{totalPotensial}%</div>
              </div>
              <div className="text-sm">
                {totalPotensial === 100 ? (
                  <span className="inline-block px-2 py-1 rounded-full" style={{ backgroundColor: `${PRIMARY_COLORS.green}20`, color: PRIMARY_COLORS.green }}>
                    OK
                  </span>
                ) : (
                  <span className="inline-block px-2 py-1 rounded-full" style={{ backgroundColor: `${PRIMARY_COLORS.red}20`, color: PRIMARY_COLORS.red }}>
                    Harus 100%
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Error State */}
      {error && !loading && (
        <div className="border rounded-lg p-4 mb-6" style={{ backgroundColor: BG_COLORS.red.light, borderColor: PRIMARY_COLORS.red }}>
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
                className="mt-2 text-sm font-medium hover:opacity-80 cursor-pointer"
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
                  placeholder={
                    t("search") || "Cari indikator, penilaian, sub..."
                  }
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:border-blue-500 dark:text-white transition-all shadow-sm"
                  style={{ '--tw-ring-color': PRIMARY_COLORS.teal }}
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
                  <th className="px-3 py-3 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider">
                    Penilaian
                  </th>
                  <th className="px-3 py-3 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider">
                    Indikator
                  </th>
                  <th className="px-3 py-3 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider">
                    Bobot (%)
                  </th>
                  <th className="px-3 py-3 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider">
                    Subindikator
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
                          {t("loadingData")}
                        </p>
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
                    return Object.keys(groupedData).map((penilaian, pidx) => {
                      const items = groupedData[penilaian];
                      return items.map((indikator, idx) => {
                        return (
                          <tr
                            key={indikator.id}
                            className={`${
                              pidx % 2 === 0
                                ? "bg-gray-50 dark:bg-gray-700/50"
                                : ""
                            } hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors`}
                          >
                            {idx === 0 && (
                              <td
                                rowSpan={items.length}
                                className="px-3 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-center align-middle"
                              >
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-md font-medium text-white" style={{ backgroundColor: PRIMARY_COLORS.teal }}>
                                  {penilaian}
                                </span>
                              </td>
                            )}
                            <td className="px-3 py-4 text-sm text-gray-900 dark:text-white">
                              {indikator.indikator}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                              {indikator.penilaian === "Tambahan" ? (
                                <span className="text-gray-500 dark:text-gray-400">-</span>
                              ) : (
                                <>
                                  {indikator.bobot}
                                  {isSubMismatch(indikator) && (
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-md font-medium" style={{ backgroundColor: BG_COLORS.yellow.light, color: TEXT_ON_BG_COLORS.yellow }}>
                                      <i className="fas fa-exclamation-triangle mr-1" />{" "}
                                      Bobot sub: {sumActiveSub(indikator)}
                                    </span>
                                  )}
                                </>
                              )}
                            </td>
                            <td
                              className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center"
                              onClick={() => handleOpenDetailModal(indikator)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ")
                                  handleOpenDetailModal(indikator);
                              }}
                            >
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-md font-medium bg-[#E7F3FF] border border-blue-500 dark:bg-blue-900/30 dark:border-blue-800 text-blue-800 dark:text-blue-200 cursor-pointer hover:bg-[#bfdbfe] dark:hover:bg-blue-900/50 transition-all duration-200">
                                {indikator.sub_indikators?.length || 0}{" "}
                                Subindikator
                              </span>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-center text-sm font-medium">
                              <div className="flex items-center justify-center gap-2">
                                <IconButton
                                  onClick={() =>
                                    handleOpenDetailModal(indikator)
                                  }
                                  variant="default"
                                  size="lg"
                                  title="Detail"
                                >
                                  <i className="fas fa-eye" />
                                </IconButton>
                                <IconButton
                                  onClick={() =>
                                    handleOpenModal("edit", indikator)
                                  }
                                  variant="primary"
                                  size="lg"
                                  title="Edit"
                                >
                                  <i className="fas fa-edit" />
                                </IconButton>
                                <IconButton
                                  onClick={() =>
                                    handleDelete(
                                      indikator.id,
                                      indikator.indikator
                                    )
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
              className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg pointer-events-auto"
              style={{
                animation: "modalSlideUp 0.3s ease-out",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleSubmit}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 rounded-t-2xl">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {modalMode === "add"
                      ? "Tambah Indikator"
                      : "Edit Indikator"}
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
                      htmlFor="indikator"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Nama Indikator
                    </label>
                    <input
                      type="text"
                      id="indikator"
                      required
                      value={formData.indikator}
                      onChange={(e) =>
                        setFormData({ ...formData, indikator: e.target.value })
                      }
                      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                      style={{ '--tw-ring-color': PRIMARY_COLORS.teal }}
                      placeholder="Masukkan nama indikator"
                    />
                  </div>
                  {formData.penilaian !== "Tambahan" && (
                    <div>
                      <label
                        htmlFor="bobot"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Bobot (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          id="bobot"
                          required
                          step="0.01"
                          value={formData.bobot}
                          onChange={(e) =>
                            setFormData({ ...formData, bobot: e.target.value })
                          }
                          className="block w-full pr-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                          style={{ '--tw-ring-color': PRIMARY_COLORS.teal }}
                          placeholder="0.00"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600 dark:text-gray-300">
                          %
                        </span>
                      </div>
                      {indikatorWarning && (
                        <div className="mt-2 text-sm rounded-lg p-2 border" style={{ color: TEXT_ON_BG_COLORS.yellow, backgroundColor: BG_COLORS.yellow.light, borderColor: `${PRIMARY_COLORS.yellow}30` }}>
                          {indikatorWarning}
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <label
                      htmlFor="penilaian"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Penilaian
                    </label>
                    <div className="relative">
                      <select
                        name="penilaian"
                        value={formData.penilaian}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            penilaian: e.target.value,
                          })
                        }
                        className="appearance-none block w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg pl-4 pr-10 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-2 cursor-pointer transition-all shadow-sm"
                        style={{ '--tw-ring-color': PRIMARY_COLORS.teal }}
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
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
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
                    disabled={submitting || Boolean(indikatorWarning)}
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

      {/* Bulk Bobot Modal */}
      {showBulkModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ease-out"
            onClick={handleCloseBulkModal}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl pointer-events-auto"
              style={{ animation: "modalSlideUp 0.3s ease-out" }}
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleSubmitBulk}>
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 rounded-t-2xl">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Ubah Bobot Subindikator
                  </h3>
                  <button
                    onClick={handleCloseBulkModal}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 hover:scale-120 cursor-pointer"
                    aria-label="Close"
                  >
                    <i className="fas fa-times text-xl text-gray-600 dark:text-gray-300"></i>
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Pilih Indikator
                    </label>
                    <div className="relative">
                      <select
                        value={bulkSelectedIndikatorId || ""}
                        onChange={(e) =>
                          handleSelectBulkIndikator(e.target.value)
                        }
                        className="appearance-none block w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg pl-4 pr-10 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 cursor-pointer transition-all shadow-sm"
                      >
                        <option value="">-- Pilih Indikator --</option>
                        {data.filter(ind => ind.penilaian !== "Tambahan").map((ind) => (
                          <option key={ind.id} value={ind.id}>
                            {ind.indikator} ({ind.penilaian})
                          </option>
                        ))}
                      </select>
                      <svg
                        className="absolute right-3 top-3 h-5 w-5 text-gray-400 pointer-events-none"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Subindikator
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        Total bobot Subindikator:{" "}
                        {Math.round(
                          ((bulkSubInputs || []).reduce(
                            (s, x) =>
                              s + (x.isactive ? parseFloat(x.bobot) || 0 : 0),
                            0
                          ) +
                            Number.EPSILON) *
                            100
                        ) / 100}
                      </div>
                    </div>

                    <div className="max-h-64 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-200 dark:bg-gray-700 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left">Nama</th>
                            <th className="px-3 py-2 text-center w-36">
                              Bobot (%)
                            </th>
                            <th className="px-3 py-2 text-center w-28">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(bulkSubInputs || []).map((s, idx) => (
                            <tr
                              key={s.id}
                              className={`${
                                idx % 2 === 0
                                  ? "bg-gray-50 dark:bg-gray-700/50"
                                  : ""
                              } hover:bg-gray-100 border-b border-gray-100 dark:border-gray-700`}
                            >
                              <td className="px-3 py-2">{s.subindikator}</td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="999.99"
                                  value={s.bobot}
                                  onChange={(e) =>
                                    handleBulkBobotChange(idx, e.target.value)
                                  }
                                  className="w-28 mx-auto px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-center bg-white dark:bg-gray-700 text-sm"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = [...bulkSubInputs];
                                    copy[idx] = {
                                      ...copy[idx],
                                      isactive: !copy[idx].isactive,
                                    };
                                    setBulkSubInputs(copy);
                                  }}
                                  className={`inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                                    s.isactive
                                      ? "bg-teal-500"
                                      : "bg-gray-300 dark:bg-gray-600"
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      s.isactive
                                        ? "translate-x-5"
                                        : "translate-x-1"
                                    }`}
                                  />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {bulkErrors && (
                      <div className="mt-2 text-sm rounded-lg p-2 border" style={{ color: TEXT_ON_BG_COLORS.yellow, backgroundColor: BG_COLORS.yellow.light, borderColor: `${PRIMARY_COLORS.yellow}30` }}>
                        {bulkErrors}
                      </div>
                    )}
                    {bulkWarning && (
                      <div className="mt-2 text-sm rounded-lg p-2 border" style={{ color: TEXT_ON_BG_COLORS.yellow, backgroundColor: BG_COLORS.yellow.light, borderColor: `${PRIMARY_COLORS.yellow}30` }}>
                        {bulkWarning}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl bg-gray-50 dark:bg-gray-700/50">
                  <IconButton
                    type="button"
                    onClick={handleCloseBulkModal}
                    variant="secondary"
                    size="lg"
                    disabled={bulkSubmitting}
                  >
                    <i className="far fa-times-circle mr-2" /> Batal
                  </IconButton>
                  <IconButton
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={bulkSubmitting || Boolean(bulkWarning)}
                  >
                    {bulkSubmitting ? (
                      <i className="fas fa-spinner fa-spin mr-2" />
                    ) : (
                      <i className="fas fa-save mr-2" />
                    )}{" "}
                    Simpan
                  </IconButton>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Animations for Bulk Modal */}
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
              className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-5xl max-h-[80vh] flex flex-col min-h-0 pointer-events-auto"
              style={{
                animation: "modalSlideUp 0.3s ease-out",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 rounded-t-2xl">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Detail Indikator
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {selectedIndikator.sub_indikators?.length || 0} Subindikator
                  </p>
                </div>
                <button
                  onClick={handleCloseDetailModal}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 hover:scale-120 cursor-pointer"
                  aria-label="Close"
                >
                  <i className="fas fa-times text-xl text-gray-600 dark:text-gray-300"></i>
                </button>
              </div>

              {/* Content: simplified to a scrollable table only */}
              <div className="flex-1 p-6 flex flex-col min-h-0">
                <div className="mb-6 p-4 rounded-lg bg-teal-50 border border-teal-500 dark:bg-blue-900/30 dark:border-blue-800">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {selectedIndikator.indikator}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedIndikator.penilaian !== "Tambahan" && (
                      <div className="text-sm font-medium mt-1">
                        Bobot: {selectedIndikator.bobot}
                      </div>
                    )}
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-teal-500 text-white">
                      Penilaian: {selectedIndikator.penilaian}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Daftar Subindikator
                  </h4>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Cari subindikator..."
                        value={subSearchTerm}
                        onChange={(e) => setSubSearchTerm(e.target.value)}
                        className="w-56 pl-10 pr-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <svg
                        className="absolute left-3 top-3 h-4 w-4 text-gray-400"
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
                    <IconButton
                      onClick={() => handleOpenSubModal("add")}
                      variant="primary"
                      size="lg"
                      className="gap-2"
                    >
                      <i className="fas fa-plus mr-2" />
                      Tambah
                    </IconButton>
                  </div>
                </div>

                {/* Warning if sub total mismatch */}
                {isSubMismatch(selectedIndikator) && (
                  <div className="mb-4 p-3 rounded-lg border" style={{ backgroundColor: BG_COLORS.yellow.light, borderColor: PRIMARY_COLORS.yellow, color: TEXT_ON_BG_COLORS.yellow }}>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full flex-shrink-0" style={{ backgroundColor: BG_COLORS.yellow.light, color: TEXT_ON_BG_COLORS.yellow }}>
                        <i className="fas fa-exclamation-triangle" />
                      </div>
                      <div>
                        <div className="font-medium">
                          Peringatan: Total bobot subindikator aktif tidak sama
                          dengan bobot indikator
                        </div>
                        <div className="text-sm">
                          Total bobot subindikator aktif:{" "}
                          {sumActiveSub(selectedIndikator)} — Bobot indikator:{" "}
                          {selectedIndikator.bobot}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="h-0 flex-1 overflow-auto min-h-0 rounded-lg border border-gray-200 dark:border-gray-700">
                  {(() => {
                    const allSubs = selectedIndikator?.sub_indikators || [];
                    const filteredSubs = allSubs.filter((s) => {
                      if (!subSearchTerm) return true;
                      return (s.subindikator || "")
                        .toString()
                        .toLowerCase()
                        .includes(subSearchTerm.toLowerCase());
                    });

                    if (allSubs.length === 0) {
                      return (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <svg
                            className="mx-auto h-12 w-12 text-gray-400 mb-3"
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
                          <p className="font-medium">Belum ada subindikator</p>
                          <p className="text-sm mt-1">
                            Klik tombol "Tambah" untuk menambah subindikator
                            baru
                          </p>
                        </div>
                      );
                    }

                    if (filteredSubs.length === 0) {
                      return (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <svg
                            className="mx-auto h-12 w-12 text-gray-400 mb-3"
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
                          <p className="font-medium">
                            Tidak ada subindikator yang cocok
                          </p>
                          <p className="text-sm mt-1">Coba kata kunci lain</p>
                        </div>
                      );
                    }

                    return (
                      <div className="w-full min-w-0">
                        <table className="w-full text-sm table-auto min-w-full sm:table-fixed">
                          <thead className="bg-gray-200 dark:bg-gray-700 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider w-12">
                                No
                              </th>
                              <th className="px-3 py-2 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider min-w-0 w-100">
                                Subindikator
                              </th>
                              <th className="px-3 py-2 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider w-30">
                                Bobot (%)
                              </th>
                              <th className="px-3 py-2 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider w-40">
                                Instrumen
                              </th>
                              <th className="px-3 py-2 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider w-30">
                                Input Data
                              </th>
                              <th className="px-3 py-2 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider w-30">
                                Status
                              </th>
                              <th className="px-3 py-2 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider w-30"></th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredSubs.map((sub, idx) => (
                              <tr
                                key={sub.id}
                                className={`${
                                  idx % 2 === 0
                                    ? "bg-gray-50 dark:bg-gray-700/50"
                                    : ""
                                } hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors`}
                              >
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center w-12">
                                  {idx + 1}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-900 dark:text-white min-w-0 w-full truncate">
                                  {sub.subindikator}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm w-20 text-center">
                                  {selectedIndikator.penilaian === "Tambahan" ? (
                                    <span className="text-gray-500 dark:text-gray-400">-</span>
                                  ) : (
                                    sub.bobot
                                  )}
                                </td>
                                <td 
                                  className="px-3 py-2 text-sm w-40 text-center"
                                  onClick={() => {
                                    const count = instrumens.filter(inst => inst.subindikator_id === sub.id).length;
                                    if (count > 0) handleOpenInstrumenModal(sub);
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      const count = instrumens.filter(inst => inst.subindikator_id === sub.id).length;
                                      if (count > 0) handleOpenInstrumenModal(sub);
                                    }
                                  }}
                                >
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                                    instrumens.filter(inst => inst.subindikator_id === sub.id).length > 0
                                      ? "bg-[#E7F3FF] border border-blue-500 dark:bg-blue-900/30 dark:border-blue-800 text-blue-800 dark:text-blue-200 cursor-pointer hover:bg-[#bfdbfe] dark:hover:bg-blue-900/50 transition-all duration-200"
                                      : "bg-gray-50 border border-gray-200 dark:bg-gray-900/30 dark:border-gray-800 text-gray-600 dark:text-gray-400"
                                  }`}>
                                    {(() => {
                                      const count = instrumens.filter(inst => inst.subindikator_id === sub.id).length;
                                      return count > 0 ? `${count} Instrumen` : "Belum ada";
                                    })()}
                                  </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm w-20 text-center">
                                  {sub.auto_sync ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium bg-purple-50 border border-purple-400 dark:bg-purple-900/30 dark:border-purple-700 text-purple-700 dark:text-purple-300">
                                      <i className="fas fa-sync-alt text-xs" />
                                      Otomatis
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-gray-50 border border-gray-300 dark:bg-gray-800 dark:border-gray-600 text-gray-500 dark:text-gray-400">
                                      Manual
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm w-20 text-center">
                                  <span
                                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                                      sub.isactive
                                        ? "bg-teal-50 border border-teal-500 dark:bg-teal-900/30 dark:border-teal-800 text-teal-800 dark:text-teal-200"
                                        : "bg-[#FDECEA] border border-[#d33333] dark:bg-red-900/30 dark:border-red-800 text-[#991b1b] dark:text-red-200"
                                    }`}
                                  >
                                    {sub.isactive ? "Aktif" : "Tidak Aktif"}
                                  </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-center text-sm font-medium">
                                  <div className="flex items-center justify-center gap-2">
                                    <IconButton
                                      onClick={() =>
                                        handleOpenSubModal("edit", sub)
                                      }
                                      variant="primary"
                                      size="lg"
                                      title="Edit"
                                    >
                                      <i className="fas fa-edit" />
                                    </IconButton>
                                    <IconButton
                                      onClick={() =>
                                        handleDeleteSub(
                                          sub.id,
                                          sub.subindikator
                                        )
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
                <IconButton
                  onClick={handleCloseDetailModal}
                  variant="default"
                  size="lg"
                >
                  <i className="far fa-times-circle mr-2" />
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
              className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg pointer-events-auto"
              style={{
                animation: "modalSlideUp 0.3s ease-out",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleSubmitSub}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 rounded-t-2xl">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {subModalMode === "add"
                      ? "Tambah Subindikator"
                      : "Edit Subindikator"}
                  </h3>
                  <button
                    onClick={handleCloseSubModal}
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
                      htmlFor="subindikator"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Nama Subindikator
                    </label>
                    <input
                      type="text"
                      id="subindikator"
                      required
                      value={subFormData.subindikator}
                      onChange={(e) =>
                        setSubFormData({
                          ...subFormData,
                          subindikator: e.target.value,
                        })
                      }
                      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                      placeholder="Masukkan nama subindikator"
                    />
                  </div>
                  {selectedIndikator && selectedIndikator.penilaian !== "Tambahan" && (
                    <div>
                      <label
                        htmlFor="sub-bobot"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Bobot (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          id="sub-bobot"
                          required
                          step="0.01"
                          value={subFormData.bobot}
                          onChange={(e) =>
                            setSubFormData({
                              ...subFormData,
                              bobot: e.target.value,
                            })
                          }
                          className="block w-full pr-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                          placeholder="0.00"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600 dark:text-gray-300">
                          %
                        </span>
                      </div>
                      {subWarning && (
                        <div className="mt-2 text-sm rounded-lg p-2 border" style={{ color: TEXT_ON_BG_COLORS.yellow, backgroundColor: BG_COLORS.yellow.light, borderColor: `${PRIMARY_COLORS.yellow}30` }}>
                          {subWarning}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        setSubFormData({
                          ...subFormData,
                          isactive: !subFormData.isactive,
                        })
                      }
                      aria-pressed={subFormData.isactive}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                        subFormData.isactive
                          ? "bg-teal-500"
                          : "bg-gray-300 dark:bg-gray-600"
                      }`}
                      title={subFormData.isactive ? "Aktif" : "Tidak Aktif"}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          subFormData.isactive
                            ? "translate-x-5"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {subFormData.isactive ? "Aktif" : "Tidak Aktif"}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl bg-gray-50 dark:bg-gray-700/50">
                  <IconButton
                    type="button"
                    onClick={handleCloseSubModal}
                    variant="secondary"
                    size="lg"
                    disabled={submittingSub}
                  >
                    <i className="far fa-times-circle mr-2" />
                    Batal
                  </IconButton>
                  <IconButton
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={submittingSub || Boolean(subWarning)}
                    aria-busy={submittingSub}
                  >
                    {submittingSub ? (
                      <i className="fas fa-spinner fa-spin mr-2" />
                    ) : subModalMode === "add" ? (
                      <i className="fas fa-plus mr-2" />
                    ) : (
                      <i className="fas fa-save mr-2" />
                    )}
                    {subModalMode === "add" ? "Tambah" : "Simpan"}
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

      {/* Instrumen List Modal */}
      {showInstrumenModal && selectedSubForInstrumen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] transition-opacity duration-300 ease-out"
            onClick={handleCloseInstrumenModal}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col min-h-0 pointer-events-auto"
              style={{
                animation: "modalSlideUp 0.3s ease-out",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 rounded-t-2xl">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Daftar Instrumen
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Subindikator: {selectedSubForInstrumen.subindikator}
                  </p>
                </div>
                <button
                  onClick={handleCloseInstrumenModal}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 hover:scale-120 cursor-pointer"
                  aria-label="Close"
                >
                  <i className="fas fa-times text-xl text-gray-600 dark:text-gray-300"></i>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 p-6 flex flex-col min-h-0">
                <div className="h-0 flex-1 overflow-auto min-h-0 rounded-lg border border-gray-200 dark:border-gray-700">
                  {(() => {
                    const subInstrumens = instrumens.filter(
                      (inst) => inst.subindikator_id === selectedSubForInstrumen.id
                    );

                    if (subInstrumens.length === 0) {
                      return (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <svg
                            className="mx-auto h-12 w-12 text-gray-400 mb-3"
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
                          <p className="font-medium">Belum ada instrumen</p>
                          <p className="text-sm mt-1">
                            Subindikator ini belum memiliki instrumen
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="w-full min-w-0">
                        <table className="w-full text-sm table-auto min-w-full">
                          <thead className="bg-gray-200 dark:bg-gray-700 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider w-12">
                                No
                              </th>
                              <th className="px-3 py-2 text-left text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider">
                                Nama Instrumen
                              </th>
                              <th className="px-3 py-2 text-center text-md font-semibold text-gray-500 dark:text-gray-300 tracking-wider w-24">
                                Skor
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {subInstrumens.map((inst, idx) => (
                              <tr
                                key={inst.id}
                                className={`${
                                  idx % 2 === 0
                                    ? "bg-gray-50 dark:bg-gray-700/50"
                                    : ""
                                } hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors`}
                              >
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                                  {idx + 1}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                                  {inst.instrumen}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-teal-50 border border-teal-500 dark:bg-teal-900/30 dark:border-teal-800 text-teal-800 dark:text-teal-200">
                                    {inst.skor}
                                  </span>
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
                <IconButton
                  onClick={handleCloseInstrumenModal}
                  variant="default"
                  size="lg"
                >
                  <i className="far fa-times-circle mr-2" />
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
    </div>
  );
};

export default Indikator;
