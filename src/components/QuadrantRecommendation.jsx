import { useState } from 'react';
import PropTypes from 'prop-types';

const QuadrantRecommendation = ({ kotak }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!kotak) return null;

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-lg p-4 shadow-md border border-gray-200 dark:border-gray-600">
      {/* Range Info */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <i className="fas fa-arrow-right text-sm text-[#3085d6]"></i>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Range Potensial
            </span>
          </div>
          <div className="text-lg font-bold text-gray-800 dark:text-white">
            {kotak.potensialRange.min} - {kotak.potensialRange.max}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <i className="fas fa-arrow-up text-sm text-[#2fa84f]"></i>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Range Kinerja
            </span>
          </div>
          <div className="text-lg font-bold text-gray-800 dark:text-white">
            {kotak.kinerjaRange.min} - {kotak.kinerjaRange.max}
          </div>
        </div>
      </div>

      {/* Rekomendasi */}
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between gap-2 mb-3 p-3 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
              style={{ backgroundColor: `${kotak.warna}20` }}
            >
              <i className="fas fa-lightbulb text-sm" style={{ color: kotak.warna }}></i>
            </div>
            <h4 className="text-base font-bold text-gray-800 dark:text-white">
              Rekomendasi Tindak Lanjut
            </h4>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({kotak.rekomendasi?.length || 0})
            </span>
          </div>
          <i className={`fas fa-chevron-down text-gray-500 dark:text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}></i>
        </button>
        
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
          {kotak.rekomendasi && kotak.rekomendasi.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <ul className="space-y-3">
                {kotak.rekomendasi.map((item, index) => (
                  <li
                    key={index}
                    className="flex gap-3 items-start group hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded-lg transition-all"
                  >
                    <div
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm group-hover:scale-110 transition-transform"
                      style={{ backgroundColor: kotak.warna }}
                    >
                      {index + 1}
                    </div>
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              <i className="fas fa-info-circle mr-2"></i>
              Belum ada rekomendasi yang dikonfigurasi
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

QuadrantRecommendation.propTypes = {
  kotak: PropTypes.shape({
    id: PropTypes.number.isRequired,
    nama: PropTypes.string.isRequired,
    kategori: PropTypes.string.isRequired,
    warna: PropTypes.string.isRequired,
    potensialRange: PropTypes.shape({
      min: PropTypes.number.isRequired,
      max: PropTypes.number.isRequired,
    }).isRequired,
    kinerjaRange: PropTypes.shape({
      min: PropTypes.number.isRequired,
      max: PropTypes.number.isRequired,
    }).isRequired,
    rekomendasi: PropTypes.arrayOf(PropTypes.string),
  }),
};

export default QuadrantRecommendation;
