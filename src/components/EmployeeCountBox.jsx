import PropTypes from "prop-types";

function EmployeeCountBox({ title, count, color, onClick, icon }) {
  return (
    <div
      onClick={onClick}
      className="group relative bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-transparent"
      style={{ animation: "fadeInScale 0.35s ease-out" }}
    >
      {/* Accent bar (subtle) */}
      <div
        className="absolute top-0 left-0 w-1 h-full transition-all duration-200 group-hover:w-1.5 rounded-r"
        style={{ backgroundColor: color }}
      />

      {/* Content - compact layout */}
      <div className="relative px-3 py-3 md:py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Icon */}
          {icon && (
            <div
              className="flex items-center justify-center w-10 h-10 rounded-lg"
              style={{ backgroundColor: `${color}12` }}
            >
              <i className={`${icon} text-xl`} style={{ color }}></i>
            </div>
          )}

          {/* Text */}
          <div className="min-w-0">
            <p className="text-md text-gray-600 dark:text-gray-400 font-medium truncate">
              {title}
            </p>
            <h3 className="text-2xl md:text-3xl font-semibold mt-0.5 truncate" style={{ color }}>
              {count}
            </h3>
          </div>
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

EmployeeCountBox.propTypes = {
  title: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
  color: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  icon: PropTypes.elementType,
};

export default EmployeeCountBox;
