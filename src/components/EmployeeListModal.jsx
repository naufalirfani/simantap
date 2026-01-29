import { useEffect, useState, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import QuadrantRecommendation from "./QuadrantRecommendation";

function EmployeeListModal({
  isOpen,
  onClose,
  employees,
  title,
  description,
  color,
  serverSearch = false,
  loading = false,
  meta = null,
  onSearch = null,
  skipInitialSearch = false,
  kotakConfig = null,
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
        <div className="w-full max-w-5xl max-h-full bg-white dark:bg-gray-800 rounded-lg pointer-events-auto overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 rounded-t-2xl bg-white dark:bg-gray-800 sticky top-0 z-10">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                {title}
              </h2>
              {kotakConfig && <span>{description}</span>}
              <p className="text-md text-gray-600 dark:text-gray-400 mt-1">
                {serverSearch
                  ? meta?.total != null
                    ? `${meta.total} pegawai`
                    : "Memuat..."
                  : `${employees.length} pegawai`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 hover:scale-120 cursor-pointer"
              aria-label="Close"
            >
              <i className="fas fa-times text-xl text-gray-600 dark:text-gray-300"></i>
            </button>
          </div>

          {/* Employee List - Scrollable with search + table */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Show QuadrantRecommendation if kotakConfig is provided */}
            {kotakConfig && <QuadrantRecommendation kotak={kotakConfig} />}

            <EmployeeTableView
              employees={employees}
              color={color}
              onClose={onClose}
              serverSearch={serverSearch}
              loading={loading}
              onSearch={onSearch}
              meta={meta}
              skipInitialSearch={skipInitialSearch}
            />
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

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Search input focus animation */
        .employee-search-input {
          transition: transform 150ms ease, box-shadow 180ms ease;
        }

        .employee-search-input:focus {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 10px 30px rgba(2,6,23,0.08);
          outline: none;
        }
      `}</style>
    </>
  );
}

EmployeeListModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  employees: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      nip: PropTypes.string,
      jabatan: PropTypes.string,
      unitKerja: PropTypes.string,
      potensial: PropTypes.number,
      kinerja: PropTypes.number,
    })
  ).isRequired,
  title: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
};

// extend propTypes for server props (optional)
EmployeeListModal.defaultProps = {
  serverSearch: false,
  loading: false,
  total: null,
  onSearch: null,
};

export default EmployeeListModal;

// Sub-component: searchable table view for employees
function EmployeeTableView({
  employees,
  color,
  serverSearch = false,
  loading = false,
  onSearch = null,
  meta = null,
  skipInitialSearch = false,
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(meta?.current_page || 1);
  const [itemsPerPage, setItemsPerPage] = useState(meta?.per_page || 10);

  // Sync current page / per_page when meta changes
  useEffect(() => {
    if (meta) {
      setCurrentPage(meta.current_page || 1);
      setItemsPerPage(meta.per_page || itemsPerPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  // Debounce query and trigger server search when needed
  const firstRun = useRef(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      if (serverSearch && typeof onSearch === "function") {
        if (skipInitialSearch && firstRun.current) {
          // skip the initial automatic search because parent already fetched
          firstRun.current = false;
        } else {
          onSearch(query || "", 1, itemsPerPage);
        }
      }
      setCurrentPage(1);
      firstRun.current = false;
    }, 800);
    return () => clearTimeout(timer);
  }, [query, serverSearch, onSearch, itemsPerPage, skipInitialSearch]);

  // Local filtering when not serverSearch
  const filtered = useMemo(() => {
    if (serverSearch) return employees;
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      return (
        (e.name && e.name.toLowerCase().includes(q)) ||
        (e.nip && e.nip.toLowerCase().includes(q)) ||
        (e.jabatan && e.jabatan.toLowerCase().includes(q)) ||
        (e.unitKerja && e.unitKerja.toLowerCase().includes(q))
      );
    });
  }, [employees, query, serverSearch]);

  const startIndex =
    ((meta?.current_page || currentPage) - 1) *
    (meta?.per_page || itemsPerPage);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    const totalPages = meta?.last_page || 1;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const goToPage = (page) => {
    const safe = Math.max(1, Math.min(page, meta?.last_page || 1));
    setCurrentPage(safe);
    if (serverSearch && typeof onSearch === "function")
      onSearch(query || "", safe, itemsPerPage);
  };

  const handleItemsPerPageChange = (e) => {
    const v = Number(e.target.value);
    setItemsPerPage(v);
    setCurrentPage(1);
    if (serverSearch && typeof onSearch === "function")
      onSearch(query || "", 1, v);
  };

  const renderPageButton = (page, index) => {
    const isCurrent = page === (meta?.current_page || currentPage);
    const base =
      "min-w-[2.5rem] px-3 py-2 rounded-lg text-md font-semibold transition-all shadow-sm";
    const cls = isCurrent
      ? `${base} bg-gradient-to-r from-[#3085d6] to-[#3085d6] text-white shadow-md scale-105 cursor-pointer`
      : page === "..."
      ? `${base} cursor-default text-gray-500 dark:text-gray-400 bg-transparent border-0 shadow-none`
      : `${base} text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-[#3085d6]/10 dark:hover:bg-gray-600 hover:border-[#3085d6]/50 dark:hover:border-[#3085d6] cursor-pointer`;

    return (
      <button
        key={index}
        onClick={() => typeof page === "number" && goToPage(page)}
        disabled={page === "..."}
        className={cls}
      >
        {page}
      </button>
    );
  };

  return (
    <div>
      <div className="mb-6 flex flex-col-reverse md:flex-row justify-between space-y-4 gap-4 md:space-y-0">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Cari nama, NIP, jabatan, unit kerja..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#3085d6] focus:border-[#3085d6] dark:text-white transition-all shadow-sm"
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
        <div className="sm:ml-auto flex items-center gap-3">
          {serverSearch && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Tampilkan:
              </label>
              <div className="relative">
                <select
                  value={itemsPerPage}
                  onChange={handleItemsPerPageChange}
                  className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg pl-4 pr-10 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-[#3085d6] focus:border-[#3085d6] cursor-pointer transition-all shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 [&>option]:bg-white [&>option]:dark:bg-gray-700 [&>option]:py-2 [&>option]:px-4 [&>option]:text-gray-900 [&>option]:dark:text-gray-100"
                >
                  {[10, 25, 50, 100].map((option) => (
                    <option
                      key={option}
                      value={option}
                      className="py-2 px-4 hover:bg-[#3085d6]/10 dark:hover:bg-gray-600"
                    >
                      {option}
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
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                data
              </span>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 dark:border-gray-700 border-t-[#3085d6] mx-auto mb-4"></div>
          Memuat data...
        </div>
      ) : serverSearch ? (
        !employees || employees.length === 0 ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">
            <i className="fas fa-user text-5xl mx-auto mb-3 opacity-50"></i>
            Tidak ada hasil
          </div>
        ) : (
          <div className="w-full">
            <div className="overflow-x-auto max-h-[55vh]">
              <table className="w-full text-md table-auto border-collapse min-w-0">
                <thead className="bg-gray-200 dark:bg-gray-700 sticky top-0">
                  <tr className="text-center">
                    <th
                      className="pb-2 px-3 text-gray-500 dark:text-gray-300 w-12 whitespace-nowrap top-0 z-10"
                      aria-label="Foto"
                    ></th>
                    <th className="py-2 px-3 text-gray-500 dark:text-gray-300 font-semibold w-[180px] whitespace-nowrap top-0 z-10">
                      Nama
                    </th>
                    <th className="py-2 px-3 text-gray-500 dark:text-gray-300 font-semibold w-36 whitespace-nowrap top-0 z-10">
                      NIP
                    </th>
                    <th className="py-2 px-3 text-gray-500 dark:text-gray-300 font-semibold w-[200px] whitespace-nowrap top-0 z-10">
                      Jabatan
                    </th>
                    <th className="py-2 px-3 text-gray-500 dark:text-gray-300 font-semibold w-[160px] whitespace-nowrap top-0 z-10">
                      Unit Kerja
                    </th>
                    {meta?.tabel === "jabatan" && (
                      <th className="py-2 px-3 text-gray-500 dark:text-gray-300 font-semibold w-28 whitespace-nowrap top-0 z-10">
                        Golongan
                      </th>
                    )}
                    {meta?.tabel === "kuadran" && (
                      <th className="py-2 px-3 text-gray-500 dark:text-gray-300 font-semibold w-28 whitespace-nowrap top-0 z-10">
                        Nilai Potensial
                      </th>
                    )}
                    {meta?.tabel === "kuadran" && (
                      <th className="py-2 px-3 text-gray-500 dark:text-gray-300 font-semibold w-28 whitespace-nowrap top-0 z-10">
                        Nilai Kinerja
                      </th>
                    )}
                    {meta?.tabel === "kuadran" && (
                      <th className="py-2 px-3 text-gray-500 dark:text-gray-300 font-semibold w-28 whitespace-nowrap top-0 z-10">
                        Nilai Talenta
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e, idx) => (
                    <tr
                      key={idx}
                      className={`${
                        idx % 2 === 0 ? "bg-gray-50 dark:bg-gray-700/50" : ""
                      } align-top border-t border-gray-100 dark:border-gray-700 dark:hover:bg-gray-800`}
                    >
                      <td className="py-2 px-3 align-top w-12">
                        <div
                          className="flex items-center justify-start"
                          style={{ minWidth: 48 }}
                        >
                          <img
                            src={e.avatar}
                            alt={e.name}
                            className="w-10 h-10 flex-none rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                            onError={(ev) => {
                              ev.target.style.display = "none";
                              if (ev.target.nextSibling)
                                ev.target.nextSibling.style.display = "flex";
                            }}
                            style={{ display: e.avatar ? "block" : "none" }}
                          />
                          <div
                            className="w-10 h-10 flex-none rounded-full flex items-center justify-center text-white font-semibold text-sm"
                            style={{
                              display: e.avatar ? "none" : "flex",
                              backgroundColor: color,
                            }}
                          >
                            {String(e.name || "?")
                              .split(" ")
                              .map((n) => n?.[0] || "")
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 align-top">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-800 dark:text-white truncate">
                            {e.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {e.email || "-"}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300 text-md">
                        {e.nip || "-"}
                      </td>
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300 truncate text-md">
                        {e.jabatan || "-"}
                      </td>
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300 truncate text-md">
                        {e.unitKerja || "-"}
                      </td>
                      {meta?.tabel === "jabatan" && (
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-300 text-md text-center">
                          {e.golongan || "-"}
                        </td>
                      )}
                      {meta?.tabel === "kuadran" && (
                        <td className="py-2 px-3 text-gray-800 dark:text-white font-semibold text-md text-center">
                          {e.potensial ?? "-"}
                        </td>
                      )}
                      {meta?.tabel === "kuadran" && (
                        <td className="py-2 px-3 text-gray-800 dark:text-white font-semibold text-md text-center">
                          {e.kinerja ?? "-"}
                        </td>
                      )}
                      {meta?.tabel === "kuadran" && (
                        <td className="py-2 px-3 text-gray-800 dark:text-white font-semibold text-md text-center">
                          {(e.potensial ? e.potensial*50/100 : 0) + (e.kinerja ? e.kinerja*50/100 : 0)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : !filtered || filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">
          <i className="fas fa-user text-5xl mx-auto mb-3 opacity-50"></i>
          Tidak ada hasil untuk pencarian
        </div>
      ) : (
        <div className="w-full">
          <div className="overflow-x-auto max-h-[55vh]">
            <table className="w-full text-md table-auto border-collapse min-w-0">
              <thead className="bg-gray-200 dark:bg-gray-700 sticky top-0">
                <tr className="text-center">
                  <th className="py-2 px-3 text-gray-500 dark:text-gray-300 font-semibold w-[240px] whitespace-nowrap top-0 z-10">
                    Nama
                  </th>
                  <th className="py-2 px-3 text-gray-500 dark:text-gray-300 font-semibold w-36 whitespace-nowrap top-0 z-10">
                    NIP
                  </th>
                  <th className="py-2 px-3 text-gray-500 dark:text-gray-300 font-semibold w-[160px] whitespace-nowrap top-0 z-10">
                    Jabatan
                  </th>
                  <th className="py-2 px-3 text-gray-500 dark:text-gray-300 font-semibold w-[160px] whitespace-nowrap top-0 z-10">
                    Unit Kerja
                  </th>
                  <th className="py-2 px-3 text-right text-gray-500 dark:text-gray-300 font-semibold w-20 whitespace-nowrap top-0 z-10">
                    Potensial
                  </th>
                  <th className="py-2 px-3 text-right text-gray-500 dark:text-gray-300 font-semibold w-20 whitespace-nowrap top-0 z-10">
                    Kinerja
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, idx) => (
                  <tr
                    key={idx}
                    className={`${
                      idx % 2 === 0 ? "bg-gray-50 dark:bg-gray-700/50" : ""
                    } align-top border-t border-gray-100 dark:border-gray-700 dark:hover:bg-gray-800`}
                  >
                    <td className="py-2 px-3 align-top">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold"
                          style={{ backgroundColor: color }}
                        >
                          {e.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-800 dark:text-white whitespace-normal break-words truncate">
                            {e.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {e.email || "-"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300 text-md">
                      {e.nip || "-"}
                    </td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300 truncate text-md">
                      {e.jabatan || "-"}
                    </td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300 truncate text-md">
                      {e.unitKerja || "-"}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-800 dark:text-white font-semibold text-md text-center">
                      {e.potensial ?? "-"}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-800 dark:text-white font-semibold text-md text-center">
                      {e.kinerja ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination controls for server-side results (rich UI) */}
      {serverSearch && meta && (
        <div className="mt-4 px-1">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(1)}
                disabled={(meta.current_page || 1) === 1}
                className="p-2 rounded-lg text-md font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-[#3085d6]/10 dark:hover:bg-gray-600 hover:border-[#3085d6]/50 dark:hover:border-[#3085d6] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                  />
                </svg>
              </button>

              <button
                onClick={() => goToPage((meta.current_page || 1) - 1)}
                disabled={(meta.current_page || 1) === 1}
                className="p-2 rounded-lg text-md font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-[#3085d6]/10 dark:hover:bg-gray-600 hover:border-[#3085d6]/50 dark:hover:border-[#3085d6] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              <div className="hidden sm:flex items-center gap-1">
                {getPageNumbers().map((page, index) =>
                  renderPageButton(page, index)
                )}
              </div>

              <button
                onClick={() => goToPage((meta.current_page || 1) + 1)}
                disabled={(meta.current_page || 1) >= (meta.last_page || 1)}
                className="p-2 rounded-lg text-md font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-[#3085d6]/10 dark:hover:bg-gray-600 hover:border-[#3085d6]/50 dark:hover:border-[#3085d6] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>

              <button
                onClick={() => goToPage(meta.last_page)}
                disabled={(meta.current_page || 1) === (meta.last_page || 1)}
                className="p-2 rounded-lg text-md font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-[#3085d6]/10 dark:hover:bg-gray-600 hover:border-[#3085d6]/50 dark:hover:border-[#3085d6] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 5l7 7-7 7M5 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>

            <div className="text-md font-medium text-gray-600 dark:text-gray-400">
              Menampilkan{" "}
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {startIndex + 1}
              </span>{" "}
              sampai{" "}
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {Math.min(
                  startIndex + (meta?.per_page || itemsPerPage),
                  meta?.total || 0
                )}
              </span>{" "}
              dari{" "}
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {meta?.total || 0}
              </span>{" "}
              pegawai
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// propTypes for subcomponent not strictly necessary
