import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useSettings } from "../context/SettingsContext";
import SearchableSelect from "./SearchableSelect";
import IconButton from "./IconButton";

const ServerDataTable = ({
  columns,
  fetchData,
  itemsPerPageOptions = [10, 25, 50, 100],
  defaultFilters = {},
  filterConfigs = [],
  onExport,
}) => {
  const { t } = useSettings();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(itemsPerPageOptions[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filters, setFilters] = useState(defaultFilters);
  const [meta, setMeta] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 0,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 800); // 800ms delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch data from server
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Filter out empty string values
        const activeFilters = Object.entries(filters).reduce(
          (acc, [key, value]) => {
            if (value && value !== "") {
              acc[key] = value;
            }
            return acc;
          },
          {},
        );

        const params = {
          page: currentPage,
          per_page: itemsPerPage,
          q: debouncedSearchTerm || undefined,
          ...activeFilters,
        };

        const response = await fetchData(params);
        setData(response.data || []);
        setMeta(
          response.meta || {
            current_page: 1,
            last_page: 1,
            per_page: itemsPerPage,
            total: 0,
          },
        );
      } catch (error) {
        console.error("Error loading data:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentPage, itemsPerPage, debouncedSearchTerm, filters, fetchData]);

  // Handle page change
  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, meta.last_page)));
  };

  // Handle search change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setCurrentPage(1);
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    const totalPages = meta.last_page;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
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

  const startIndex = (meta.current_page - 1) * meta.per_page;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Header with search, filters, and items per page */}
      <div className="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col gap-4">
          {/* Search and Items per page row */}
          <div className="flex flex-col-reverse md:flex-row justify-between space-y-4 gap-4 md:space-y-0">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder={t("search")}
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:text-white transition-all shadow-sm"
              />
              <i
                className="fas fa-search absolute left-3.5 top-3 text-gray-400 dark:text-gray-500"
                aria-hidden="true"
              />
            </div>

            {/* Filter button and Items per page */}
            <div className="flex flex-col-reverse md:flex-row justify-between space-y-4 gap-4 md:space-y-0">
              {/* Export Button */}
              {typeof onExport === "function" && (
                <IconButton
                  onClick={async () => {
                    try {
                      setExporting(true);

                      // Build active filters same as loadData
                      const activeFilters = Object.entries(filters).reduce(
                        (acc, [key, value]) => {
                          if (value && value !== "") acc[key] = value;
                          return acc;
                        },
                        {},
                      );

                      const params = {
                        page: 1,
                        per_page: meta.total || 10000,
                        q: debouncedSearchTerm || undefined,
                        ...activeFilters,
                        with_pagination: false,
                      };

                      const response = await fetchData(params);
                      const rows = response.data || [];
                      await onExport(rows, params);
                    } catch (e) {
                      console.error("Export failed:", e);
                    } finally {
                      setExporting(false);
                    }
                  }}
                  title={t("exportData")}
                  variant="primary"
                  size="lg"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm"
                >
                  <i className="fas fa-download text-lg" aria-hidden="true" />
                  <span>{exporting ? t("exporting") : t("exportData")}</span>
                </IconButton>
              )}

              {/* Filter Button */}
              {Object.keys(filters).length > 0 && (
                <IconButton
                  onClick={() => setShowFilters(!showFilters)}
                  title={t("filterBy")}
                  variant="default"
                  size="md"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm"
                >
                  <i className="fas fa-filter text-lg" aria-hidden="true" />
                  <span>{t("filterBy")}</span>
                </IconButton>
              )}

              <div className="flex items-center gap-3">
                <div className="relative">
                  <select
                    value={itemsPerPage}
                    onChange={handleItemsPerPageChange}
                    className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg pl-4 pr-10 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 cursor-pointer transition-all shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    {itemsPerPageOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <i
                    className="fas fa-chevron-down absolute right-3 top-3 text-gray-400 pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("entries")}
                </span>
              </div>
            </div>
          </div>

          {/* Filters section */}
          <div
            className={`transition-all duration-300 ease-in-out ${
              showFilters
                ? "max-h-[500px] opacity-100"
                : "max-h-0 opacity-0 overflow-hidden"
            }`}
          >
            <div className="p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                {filterConfigs.map((config) => (
                  <div key={config.key}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {config.label}
                    </label>
                    <SearchableSelect
                      value={filters[config.key] || ""}
                      onChange={(value) =>
                        handleFilterChange(config.key, value)
                      }
                      options={config.options || []}
                      placeholder={
                        config.placeholder || `Semua ${config.label}`
                      }
                      label={config.label}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-start gap-2 mt-4">
                <IconButton
                  onClick={handleResetFilters}
                  title={t("resetFilter")}
                  variant="default"
                  size="lg"
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
                >
                  <i
                    className="fas fa-sync-alt text-lg mr-2"
                    aria-hidden="true"
                  ></i>
                  {t("resetFilter")}
                </IconButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full table-auto">
          <thead className="bg-gray-200 dark:bg-gray-700 sticky top-0">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`${column.noWrap ? "whitespace-nowrap" : ""} px-3 py-4 text-center text-sm font-semibold text-gray-500 dark:text-gray-300 tracking-wider`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-12">
                  <div className="flex flex-col items-center justify-center">
                    <div className="relative">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700"></div>
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-teal-500 border-r-transparent border-b-transparent border-l-transparent absolute top-0 left-0"></div>
                    </div>
                    <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                      {t("loadingData")}
                    </p>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <i
                      className="fas fa-inbox h-16 w-16 text-gray-300 dark:text-gray-600 mb-4"
                      aria-hidden="true"
                    />
                    <p className="text-base font-medium text-gray-500 dark:text-gray-400">
                      {searchTerm ? t("noDataFound") : t("noData")}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr
                  key={item.id || index}
                  className={`${index % 2 === 0 ? "bg-gray-50 dark:bg-gray-700/50" : ""} dark:hover:bg-gray-700 transition-colors`}
                >
                  {columns.map((column) => {
                    const cellContent = column.render
                      ? column.render(item, startIndex + index)
                      : item[column.key];

                    const cellInner = column.compact ? (
                      <div className="flex items-center justify-center flex-shrink-0">
                        {cellContent}
                      </div>
                    ) : (
                      cellContent
                    );

                    return (
                      <td
                        key={column.key}
                        className={`${column.noWrap ? "whitespace-nowrap" : ""} px-3 py-4 text-sm text-gray-500 dark:text-gray-300 font-semibold ${
                          column.align === "center" || column.key === "no"
                            ? "text-center"
                            : "text-left"
                        }`}
                      >
                        {cellInner}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && meta.last_page > 0 && (
        <div className="px-3 py-4 bg-gradient-to-r from-white to-white dark:from-gray-800 dark:to-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Results info */}
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {t("showing")}{" "}
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {startIndex + 1}
              </span>{" "}
              {t("to")}{" "}
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {Math.min(startIndex + meta.per_page, meta.total)}
              </span>{" "}
              {t("of")}{" "}
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {meta.total}
              </span>{" "}
              {t("entries")}
            </div>

            {/* Pagination buttons */}
            <div className="flex items-center gap-2">
              {/* First page */}
              <button
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-teal-500/10 dark:hover:bg-gray-600 hover:border-teal-500/50 dark:hover:border-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
              >
                <i
                  className="fas fa-angle-double-left w-4 h-4"
                  aria-hidden="true"
                />
              </button>

              {/* Previous page */}
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-teal-500/10 dark:hover:bg-gray-600 hover:border-teal-500/50 dark:hover:border-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
              >
                <i className="fas fa-angle-left w-4 h-4" aria-hidden="true" />
              </button>

              {/* Page numbers */}
              <div className="hidden sm:flex items-center gap-1">
                {getPageNumbers().map((page, index) => (
                  <button
                    key={index}
                    onClick={() => typeof page === "number" && goToPage(page)}
                    disabled={page === "..."}
                    className={`min-w-[2.5rem] px-3 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                      page === currentPage
                        ? "bg-gradient-to-r from-teal-500 to-teal-500 text-white shadow-md scale-105 cursor-pointer"
                        : page === "..."
                          ? "cursor-default text-gray-500 dark:text-gray-400 bg-transparent border-0 shadow-none"
                          : "text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-teal-500/10 dark:hover:bg-gray-600 hover:border-teal-500/50 dark:hover:border-teal-500 cursor-pointer"
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              {/* Next page */}
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === meta.last_page}
                className="p-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-teal-500/10 dark:hover:bg-gray-600 hover:border-teal-500/50 dark:hover:border-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
              >
                <i className="fas fa-angle-right w-4 h-4" aria-hidden="true" />
              </button>

              {/* Last page */}
              <button
                onClick={() => goToPage(meta.last_page)}
                disabled={currentPage === meta.last_page}
                className="p-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-teal-500/10 dark:hover:bg-gray-600 hover:border-teal-500/50 dark:hover:border-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
              >
                <i
                  className="fas fa-angle-double-right w-4 h-4"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ServerDataTable.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      width: PropTypes.string,
      noWrap: PropTypes.bool,
      compact: PropTypes.bool,
      render: PropTypes.func,
    }),
  ).isRequired,
  fetchData: PropTypes.func.isRequired,
  itemsPerPageOptions: PropTypes.arrayOf(PropTypes.number),
  defaultFilters: PropTypes.object,
  filterConfigs: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      placeholder: PropTypes.string,
      options: PropTypes.arrayOf(
        PropTypes.shape({
          value: PropTypes.string.isRequired,
          label: PropTypes.string.isRequired,
        }),
      ),
    }),
  ),
  onExport: PropTypes.func,
};

export default ServerDataTable;
