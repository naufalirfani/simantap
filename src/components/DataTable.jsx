import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSettings } from '../context/SettingsContext';

const DataTable = ({ data, columns, itemsPerPageOptions = [10, 25, 50, 100], loading = false, initialSort = null }) => {
  const { t } = useSettings();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(itemsPerPageOptions[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState(initialSort ?? { key: null, direction: 'asc' });

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;

    return data.filter((item) =>
      columns.some((column) => {
        const value = item[column.key];
        return value?.toString().toLowerCase().includes(searchTerm.toLowerCase());
      })
    );
  }, [data, searchTerm, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;

    const sorted = [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === bValue) return 0;
      
      const comparison = aValue < bValue ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredData, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = sortedData.slice(startIndex, endIndex);

  // Handle sort
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Handle page change
  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Reset to page 1 when search or items per page changes
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Header with search and items per page */}
      <div className="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col-reverse md:flex-row justify-between space-y-4 gap-4 md:space-y-0">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder={t('search')}
              value={searchTerm}
              onChange={handleSearchChange}
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

          {/* Items per page */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              {t('show')}:
            </label>
            <div className="relative">
              <select
                value={itemsPerPage}
                onChange={handleItemsPerPageChange}
                className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg pl-4 pr-10 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-[#3085d6] focus:border-[#3085d6] cursor-pointer transition-all shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 [&>option]:bg-white [&>option]:dark:bg-gray-700 [&>option]:py-2 [&>option]:px-4 [&>option]:text-gray-900 [&>option]:dark:text-gray-100"
              >
                {itemsPerPageOptions.map((option) => (
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
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('entries')}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-200 dark:bg-gray-700 sticky top-0">
            <tr>
              {columns.map((column) => {
                const align = column.align || 'left';
                return (
                <th
                  key={column.key}
                  onClick={() => column.sortable !== false && handleSort(column.key)}
                  className={`${
                    column.key === 'no' ? 'w-20' : ''
                  } px-3 py-4 text-center text-sm font-semibold text-gray-500 dark:text-gray-300 tracking-wider ${
                    column.sortable !== false
                      ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors select-none'
                      : ''
                  }`}
                >
                  <div className={`flex items-center gap-2 justify-center`}>
                    {column.label}
                    {column.sortable !== false && (
                      <div className="flex flex-col">
                        {sortConfig.key === column.key ? (
                          sortConfig.direction === 'asc' ? (
                            <svg className="w-4 h-4 text-[#3085d6]" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M5 10l5-5 5 5H5z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-[#3085d6]" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M15 10l-5 5-5-5h10z" />
                            </svg>
                          )
                        ) : (
                          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M5 10l5-5 5 5H5z M15 10l-5 5-5-5h10z" fillRule="evenodd" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    )}
                  </div>
                </th>
              )})}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-12">
                  <div className="flex flex-col items-center justify-center">
                    <div className="relative">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700"></div>
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-[#3085d6] border-r-transparent border-b-transparent border-l-transparent absolute top-0 left-0"></div>
                    </div>
                    <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                      {t('loadingData')}
                    </p>
                  </div>
                </td>
              </tr>
            ) : currentData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-12 text-center"
                >
                  <div className="flex flex-col items-center justify-center">
                    <svg
                      className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                      />
                    </svg>
                    <p className="text-base font-medium text-gray-500 dark:text-gray-400">
                      {searchTerm ? t('noDataFound') : t('noData')}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              currentData.map((item, index) => (
                <tr
                  key={item.id || index}
                  className={`${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700/50' : ''} dark:hover:bg-gray-700 transition-colors`}
                >
                  {columns.map((column) => {
                    const align = column.align || 'left';
                    const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
                    return (
                    <td
                      key={column.key}
                      className={`${
                        column.key === 'no' ? 'w-20 font-semibold text-gray-500 dark:text-gray-400' : ''
                      } px-3 py-4 text-sm ${alignClass} text-gray-900 dark:text-gray-100`}
                    >
                      {column.render
                        ? column.render(item, startIndex + index)
                        : item[column.key]}
                    </td>
                  )})}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 0 && (
        <div className="px-3 py-4 bg-gradient-to-r from-white to-white dark:from-gray-800 dark:to-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Pagination buttons */}
            <div className="flex items-center gap-2">
              {/* First page */}
              <button
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-[#3085d6]/10 dark:hover:bg-gray-600 hover:border-[#3085d6]/50 dark:hover:border-[#3085d6] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                title={t('page') + ' pertama'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>

              {/* Previous page */}
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-[#3085d6]/10 dark:hover:bg-gray-600 hover:border-[#3085d6]/50 dark:hover:border-[#3085d6] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                title={t('page') + ' sebelumnya'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Page numbers */}
              <div className="hidden sm:flex items-center gap-1">
                {getPageNumbers().map((page, index) => (
                  <button
                    key={index}
                    onClick={() => typeof page === 'number' && goToPage(page)}
                    disabled={page === '...'}
                    className={`min-w-[2.5rem] px-3 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                      page === currentPage
                        ? 'bg-gradient-to-r from-[#3085d6] to-[#3085d6] text-white shadow-md scale-105 cursor-pointer'
                        : page === '...'
                        ? 'cursor-default text-gray-500 dark:text-gray-400 bg-transparent border-0 shadow-none'
                        : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-[#3085d6]/10 dark:hover:bg-gray-600 hover:border-[#3085d6]/50 dark:hover:border-[#3085d6] cursor-pointer'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              {/* Next page */}
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-[#3085d6]/10 dark:hover:bg-gray-600 hover:border-[#3085d6]/50 dark:hover:border-[#3085d6] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                title={t('page') + ' berikutnya'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Last page */}
              <button
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-[#3085d6]/10 dark:hover:bg-gray-600 hover:border-[#3085d6]/50 dark:hover:border-[#3085d6] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                title={t('page') + ' terakhir'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Results info - moved to bottom */}
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {t('showing')} <span className="font-bold text-gray-900 dark:text-gray-100">{startIndex + 1}</span> {t('to')}{' '}
              <span className="font-bold text-gray-900 dark:text-gray-100">{Math.min(endIndex, sortedData.length)}</span> {t('of')}{' '}
              <span className="font-bold text-gray-900 dark:text-gray-100">{sortedData.length}</span> {t('entries')}
              {searchTerm && (
                <span className="text-gray-500 dark:text-gray-500">
                  {' '}({t('filteredFrom')} {data.length} {t('totalEntries')})
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

DataTable.propTypes = {
  data: PropTypes.array.isRequired,
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      sortable: PropTypes.bool,
      render: PropTypes.func,
      align: PropTypes.oneOf(['left', 'center', 'right']),
    })
  ).isRequired,
  itemsPerPageOptions: PropTypes.arrayOf(PropTypes.number),
  loading: PropTypes.bool,
  initialSort: PropTypes.shape({
    key: PropTypes.string.isRequired,
    direction: PropTypes.oneOf(['asc', 'desc']).isRequired,
  }),
};

export default DataTable;
