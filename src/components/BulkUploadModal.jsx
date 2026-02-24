import { useState, useEffect } from "react";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import Swal from "sweetalert2";
import IconButton from "./IconButton";

const BulkUploadModal = ({
  isOpen,
  onClose,
  subIndikators,
  onUploadSuccess,
}) => {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: Upload, 2: Preview

  useEffect(() => {
    // Reset state when modal closes
    if (!isOpen) {
      setFile(null);
      setPreviewData([]);
      setHeaders([]);
      setCurrentStep(1);
    }
  }, [isOpen]);

  const handleDownloadTemplate = async () => {
    const headers = [
      "nip",
      ...subIndikators.map((s, idx) => {
        const raw =
          s &&
          (s.nama ||
            s.name ||
            s.label ||
            s.title ||
            s.nama_subindikator ||
            s.subindikator ||
            s.kode ||
            s.code ||
            s.id ||
            s.uuid);
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!raw) return `subindikator_${idx + 1}`;
        if (typeof raw === "string" && uuidRegex.test(raw))
          return `subindikator_${idx + 1}`;
        return String(raw).trim();
      }),
    ];

    // Create example data row with empty values for subindikators
    const exampleRow = headers.map((h, i) =>
      i === 0 ? "198001012000011001" : i === 1 ? "John Doe" : ""
    );

    // Create workbook using exceljs
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Template Penilaian");

      // Set columns
      sheet.columns = headers.map((h, i) => ({
        header: h,
        key: h,
        width: i === 0 ? 20 : i === 1 ? 30 : 18,
      }));

      // Ensure NIP and Nama columns are formatted as text (prevent Excel numeric auto-format)
      try {
        const nipCol = sheet.getColumn(1);
        nipCol.numFmt = "@";
        const namaCol = sheet.getColumn(2);
        namaCol.numFmt = "@";
      } catch (e) {
        console.warn("Could not set column numFmt", e);
      }

      // Add only example data row; column headers are taken from sheet.columns
      sheet.addRow(exampleRow);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date().toISOString().split("T")[0];
      a.download = `template-penilaian-${timestamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      Swal.fire({
        icon: "success",
        title: "Template Downloaded",
        text: "Template berhasil diunduh.",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("generate template error:", err);
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: "Tidak dapat membuat template. Coba lagi.",
        confirmButtonColor: "#14B8A6",
      });
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];

    if (
      !validTypes.includes(selectedFile.type) &&
      !selectedFile.name.match(/\.(xlsx|xls|csv)$/i)
    ) {
      Swal.fire({
        icon: "error",
        title: "File Tidak Valid",
        text: "Hanya file Excel (.xlsx, .xls) atau CSV (.csv) yang diperbolehkan.",
        confirmButtonColor: "#14B8A6",
      });
      return;
    }

    setFile(selectedFile);
    parseFile(selectedFile);
  };

  const parseFile = (file) => {
    setIsProcessing(true);

    const processRows = (rows) => {
      if (!rows || rows.length < 2) {
        Swal.fire({
          icon: "error",
          title: "File Kosong",
          text: "File tidak mengandung data yang valid.",
          confirmButtonColor: "#14B8A6",
        });
        setFile(null);
        setIsProcessing(false);
        return;
      }

      const fileHeaders = rows[0].map((h) =>
        h === null || h === undefined ? "" : String(h).trim()
      );
      const dataRows = rows
        .slice(1)
        .filter(
          (row) =>
            row &&
            row.some(
              (cell) => cell !== null && cell !== undefined && cell !== ""
            )
        );

      if (dataRows.length === 0) {
        Swal.fire({
          icon: "warning",
          title: "Tidak Ada Data",
          text: "File tidak mengandung data untuk diimpor.",
          confirmButtonColor: "#14B8A6",
        });
        setFile(null);
        setIsProcessing(false);
        return;
      }

      const parsedData = dataRows.map((row, index) => {
        const obj = { _rowIndex: index + 2 };
        fileHeaders.forEach((header, i) => {
          obj[header] =
            row[i] !== undefined && row[i] !== null
              ? String(row[i]).trim()
              : "";
        });
        return obj;
      });

      setHeaders(fileHeaders);
      setPreviewData(parsedData);
      setCurrentStep(2);
      setIsProcessing(false);
    };

    const name = file.name || "";
    const isCSV = name.match(/\.csv$/i) || file.type === "text/csv";

    if (isCSV) {
      // Use PapaParse for CSV
      Papa.parse(file, {
        skipEmptyLines: true,
        complete: function (results) {
          processRows(
            results.data.map((r) => (Array.isArray(r) ? r : Object.values(r)))
          );
        },
        error: function (err) {
          console.error("Papa parse error:", err);
          Swal.fire({
            icon: "error",
            title: "Parsing Error",
            text: "Gagal membaca CSV.",
            confirmButtonColor: "#14B8A6",
          });
          setFile(null);
          setIsProcessing(false);
        },
      });
      return;
    }

    // For XLSX/XLS use exceljs
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target.result;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];

        const rows = [];
        worksheet.eachRow((row) => {
          // row.values is 1-based: [ , col1, col2...]
          const vals = row.values
            .slice(1)
            .map((v) => (v === undefined ? "" : v));
          rows.push(vals);
        });

        processRows(rows);
      } catch (err) {
        console.error("Error parsing xlsx:", err);
        Swal.fire({
          icon: "error",
          title: "Parsing Error",
          text: "Gagal membaca file. Pastikan format file benar.",
          confirmButtonColor: "#14B8A6",
        });
        setFile(null);
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Gagal membaca file.",
        confirmButtonColor: "#14B8A6",
      });
      setFile(null);
      setIsProcessing(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleUpload = async () => {
    if (previewData.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Tidak Ada Data",
        text: "Tidak ada data untuk diunggah.",
        confirmButtonColor: "#14B8A6",
      });
      return;
    }

    // Validate NIP column exists
    if (!headers.includes("nip")) {
      Swal.fire({
        icon: "error",
        title: "Kolom NIP Tidak Ditemukan",
        text: 'File harus memiliki kolom "nip".',
        confirmButtonColor: "#14B8A6",
      });
      return;
    }

    const confirm = await Swal.fire({
      icon: "question",
      title: "Konfirmasi upload",
      html: `
        <div class="text-center">
          <p class="mb-2">Anda akan mengupload <strong>${previewData.length}</strong> data penilaian.</p>
          <p class="text-sm text-gray-600">Data yang sudah ada akan diperbarui.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Upload",
      cancelButtonText: "Batal",
      confirmButtonColor: "#14B8A6",
      cancelButtonColor: "#d33333",
      reverseButtons: true,
    });

    if (!confirm.isConfirmed) return;

    setIsProcessing(true);
    try {
      // send both data rows and headers to backend for validation
      const payload = {
        penilaians: previewData,
        headers: headers.filter((h) => h && String(h).trim() !== ""),
      };

      const result = await onUploadSuccess(payload);

      // If backend returned failed rows, show details
      if (result && Array.isArray(result.failed) && result.failed.length > 0) {
        const createdCount =
          typeof result.created === "number"
            ? result.created
            : result.success
            ? previewData.length - result.failed.length
            : 0;
        const failedHtml = `
          <div style="text-align:left">
            <p><strong>${createdCount}</strong> baris berhasil disimpan.</p>
            <p><strong>${
              result.failed.length
            }</strong> baris gagal disimpan:</p>
            <div style="max-height:260px; overflow:auto; margin-top:8px;">
              <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <thead>
                  <tr>
                    <th style="text-align:center; padding:6px; border-bottom:1px solid #e5e7eb">Row</th>
                    <th style="text-align:center; padding:6px; border-bottom:1px solid #e5e7eb">NIP</th>
                    <th style="text-align:center; padding:6px; border-bottom:1px solid #e5e7eb">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  ${result.failed
                    .map(
                      (f) => `
                    <tr>
                      <td style="padding:6px; border-bottom:1px solid #f3f4f6; text-align:center;">${
                        f.row ?? "-"
                      }</td>
                      <td style="padding:6px; border-bottom:1px solid #f3f4f6; text-align:center;">${
                        f.nip ?? "-"
                      }</td>
                      <td style="padding:6px; border-bottom:1px solid #f3f4f6;">${
                        f.reason ?? "-"
                      }</td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>
        `;

        Swal.fire({
          icon: "warning",
          title: "Upload Selesai (Sebagian)",
          html: failedHtml,
          width: "640px",
          confirmButtonColor: "#14B8A6",
        });
      } else {
        Swal.fire({
          icon: "success",
          title: "Berhasil!",
          text: `${previewData.length} data penilaian berhasil diunggah.`,
          timer: 2000,
          showConfirmButton: false,
        });
      }

      // Reset and close modal
      setFile(null);
      setPreviewData([]);
      setHeaders([]);
      setCurrentStep(1);
      onClose();
    } catch (error) {
      console.error("Upload error:", error);
      Swal.fire({
        icon: "error",
        title: "Upload Gagal",
        text: error.message || "Terjadi kesalahan saat mengupload data.",
        confirmButtonColor: "#14B8A6",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBackToUpload = () => {
    setFile(null);
    setPreviewData([]);
    setHeaders([]);
    setCurrentStep(1);
  };

  if (!isOpen) return null;

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
        <div className="w-full max-w-6xl bg-white dark:bg-gray-800 rounded-lg pointer-events-auto overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                Impor Data Penilaian
              </h2>
              <p className="text-md text-gray-600 dark:text-gray-400 mt-1">
                Ungggah berkas Excel atau CSV
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 hover:scale-110 cursor-pointer"
              aria-label="Close"
              disabled={isProcessing}
            >
              <i className="fas fa-times text-xl text-gray-600 dark:text-gray-300"></i>
            </button>
          </div>

          {/* Progress Steps */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-center space-x-4">
              <div className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold transition-colors ${
                    currentStep === 1 ? "text-white" : "text-white"
                  }`}
                  style={{
                    backgroundColor: currentStep === 1 ? "#3085d6" : "#14B8A6",
                  }}
                >
                  {currentStep === 1 ? "1" : <i className="fas fa-check" />}
                </div>
                <span
                  className={`ml-2 font-medium ${
                    currentStep === 1
                      ? "text-gray-900 dark:text-white"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  Unggah Berkas
                </span>
              </div>

              <div className="flex-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full max-w-[100px]">
                <div
                  className={`h-full rounded-full transition-all duration-500`}
                  style={{
                    backgroundColor:
                      currentStep === 2 ? "#14B8A6" : "transparent",
                    width: currentStep === 2 ? "100%" : "0",
                  }}
                />
              </div>

              <div className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold transition-colors ${
                    currentStep === 2
                      ? "text-white"
                      : "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400"
                  }`}
                  style={{
                    backgroundColor: currentStep === 2 ? "#3085d6" : undefined,
                  }}
                >
                  2
                </div>
                <span
                  className={`ml-2 font-medium ${
                    currentStep === 2
                      ? "text-gray-900 dark:text-white"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  Pratinjau & Konfirmasi
                </span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div
            className="p-6 overflow-y-auto"
            style={{ maxHeight: "calc(90vh - 250px)" }}
          >
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* Download Template Section */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-start space-x-4">
                    <div
                      className="rounded-lg p-3"
                      style={{ backgroundColor: "#14B8A6" }}
                    >
                      <i className="fas fa-download text-white text-2xl" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Langkah 1: Unduh Template
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 mb-4">
                        Unduh template Excel untuk memudahkan pengisian data.
                        Template sudah berisi kolom yang sesuai dengan
                        subindikator yang tersedia.
                      </p>
                      <IconButton
                        onClick={handleDownloadTemplate}
                        variant="primary"
                        size="lg"
                      >
                        <i className="fas fa-download mr-2" />
                        Unduh Template Excel
                      </IconButton>
                    </div>
                  </div>
                </div>

                {/* Upload Section */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-start space-x-4">
                    <div
                      className="rounded-lg p-3"
                      style={{ backgroundColor: "#14B8A6" }}
                    >
                      <i className="fas fa-upload text-white text-2xl" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Langkah 2: Unggah Berkas
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 mb-4">
                        Setelah mengisi data di template, unggah berkas Excel atau
                        CSV untuk diimpor.
                      </p>

                      {/* File Upload Area */}
                      <div className="relative">
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleFileChange}
                          disabled={isProcessing}
                          className="hidden"
                          id="bulk-upload-file"
                        />
                        <label
                          htmlFor="bulk-upload-file"
                          className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                            isProcessing
                              ? "border-gray-300 bg-gray-50 cursor-not-allowed"
                              : "border-gray-400 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-500"
                          }`}
                        >
                          {isProcessing ? (
                            <div className="text-center">
                              <i
                                className="fas fa-spinner fa-spin text-4xl mb-3"
                                style={{ color: "#14B8A6" }}
                              />
                              <p className="text-gray-600 dark:text-gray-300 font-medium">
                                Memproses file...
                              </p>
                            </div>
                          ) : file ? (
                            <div className="text-center">
                              <i
                                className="fas fa-file-excel text-5xl mb-3"
                                style={{ color: "#2fa84f" }}
                              />
                              <p className="text-gray-900 dark:text-white font-semibold mb-1">
                                {file.name}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {(file.size / 1024).toFixed(2)} KB
                              </p>
                              <p
                                className="text-xs mt-2"
                                style={{ color: "#14B8A6" }}
                              >
                                Klik untuk mengganti file
                              </p>
                            </div>
                          ) : (
                            <div className="text-center">
                              <i
                                className="fas fa-cloud-upload-alt text-5xl mb-3"
                                style={{ color: "#14B8A6" }}
                              />
                              <p className="text-gray-900 dark:text-white font-semibold mb-1">
                                Klik untuk unggah berkas
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                atau tarik & letakkan berkas di sini
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                                Format: Excel (.xlsx, .xls) atau CSV (.csv)
                              </p>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Section */}
                <div className="bg-amber-50 dark:bg-amber-900 dark:bg-opacity-20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start space-x-3">
                    <i
                      className="fas fa-info-circle text-xl mt-0.5"
                      style={{ color: "#f39c12" }}
                    />
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-900 dark:text-amber-300 mb-2">
                        Catatan Penting:
                      </h4>
                      <ul className="text-sm text-amber-800 dark:text-amber-400 space-y-1 list-disc list-inside">
                        <li>
                          Pastikan kolom <strong>NIP</strong> terisi dengan
                          benar
                        </li>
                        <li>
                          Kolom <strong>Nama</strong> bersifat opsional (untuk
                          referensi)
                        </li>
                        <li>
                          Isi nilai penilaian pada kolom subindikator yang
                          sesuai
                        </li>
                        <li>
                          Data yang sudah ada akan diperbarui jika NIP sama
                        </li>
                        <li>Maksimal ukuran file: 5 MB</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                {/* Summary Card */}
                <div
                  className="bg-white dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-600"
                  style={{ borderColor: "#2fa84f" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className="rounded-lg p-2"
                        style={{ backgroundColor: "#2fa84f" }}
                      >
                        <i className="fas fa-check-circle text-white text-xl" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Data siap diunggah
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {previewData.length} baris data ditemukan •{" "}
                          {
                            headers.filter((h) => h && String(h).trim() !== "")
                              .length
                          }{" "}
                          kolom
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className="text-3xl font-bold"
                        style={{ color: "#2fa84f" }}
                      >
                        {previewData.length}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Total Data
                      </p>
                    </div>
                  </div>
                </div>

                {/* Preview Table */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      Pratinjau Data
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Periksa data sebelum melanjutkan
                    </p>
                  </div>
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-200 dark:bg-gray-700 sticky top-0 text-center">
                        <tr>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
                            No
                          </th>
                          {headers.map((header, index) => (
                            <th
                              key={index}
                              className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 whitespace-nowrap"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {previewData.slice(0, 50).map((row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            className={`${
                              rowIndex % 2 === 0
                                ? "bg-gray-50 dark:bg-gray-700/50"
                                : ""
                            } hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
                          >
                            <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400 font-medium">
                              {rowIndex + 1}
                            </td>
                            {headers.map((header, colIndex) => (
                              <td
                                key={colIndex}
                                className={`px-4 py-3 ${
                                  header !== "nama" ? "text-center" : ""
                                } text-gray-900 dark:text-gray-100`}
                              >
                                {row[header] || "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previewData.length > 50 && (
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                        Menampilkan 50 dari {previewData.length} baris • Semua
                        data akan diunggah
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              {currentStep === 2 && (
                <IconButton
                  onClick={handleBackToUpload}
                  disabled={isProcessing}
                  variant="ghost"
                  size="lg"
                >
                  <i className="fas fa-arrow-left mr-2" />
                  Kembali
                </IconButton>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <IconButton
                onClick={onClose}
                disabled={isProcessing}
                variant="default"
                size="lg"
              >
                <i className="far fa-times-circle mr-2" /> Batal
              </IconButton>
              {currentStep === 2 && (
                <IconButton
                  onClick={handleUpload}
                  disabled={isProcessing || previewData.length === 0}
                  variant="primary"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2" />
                      Mengupload...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-cloud-upload-alt mr-2" />
                      Upload {previewData.length} data
                    </>
                  )}
                </IconButton>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Animations injected as style */}
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

export default BulkUploadModal;
