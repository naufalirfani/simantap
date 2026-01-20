import { Link, useLocation } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";

const Breadcrumb = ({ items }) => {
  const location = useLocation();
  const { t } = useSettings();

  // Auto-generate breadcrumb items if not provided
  const breadcrumbItems = items || generateBreadcrumbItems(location.pathname, t);

  return (
    <nav className="flex items-center space-x-2 mb-4 overflow-x-auto py-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1;
        
        return (
          <div key={index} className="flex items-center space-x-2 flex-shrink-0">
            {index > 0 && (
              <svg
                className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0"
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
            )}
            {isLast ? (
              <span className="text-[#3B82F6] dark:text-blue-400 font-semibold flex items-center gap-2 whitespace-nowrap">
                {item.icon && <i className={item.icon}></i>}
                {item.label}
              </span>
            ) : (
              <Link
                to={item.path}
                className="text-gray-600 dark:text-gray-400 hover:text-[#3B82F6] dark:hover:text-blue-400 transition-colors duration-200 flex items-center gap-2 whitespace-nowrap group"
              >
                {item.icon && (
                  <i className={`${item.icon} group-hover:scale-110 transition-transform duration-200`}></i>
                )}
                <span className="group-hover:underline">{item.label}</span>
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
};

// Helper function to generate breadcrumb items from pathname
const generateBreadcrumbItems = (pathname, t) => {
  const paths = pathname.split("/").filter(Boolean);
  const items = [
    { label: "Dashboard", path: "/", icon: "fas fa-home" }
  ];

  let currentPath = "";
  
  paths.forEach((path, index) => {
    currentPath += `/${path}`;
    
    // Map path segments to readable labels
    const labelMap = {
      "daftar-talenta": "Daftar Talenta",
      "detail": "Detail Pegawai",
      "suksesi": "Suksesi",
      "pengembangan": "Pengembangan",
      "masterdata": "Masterdata",
      "unit-kerja": "Unit Kerja",
      "jabatan": "Jabatan",
      "pegawai": "Pegawai",
      "indikator": "Indikator",
      "instrumen": "Instrumen",
      "input-penilaian": "Input Penilaian",
      "penilaian-pegawai": "Penilaian Pegawai",
      "standar-kompetensi-msk": "Standar Kompetensi MSK",
      "kotak-interval": "Kotak Interval",
      "pengaturan": "Pengaturan",
    };

    const iconMap = {
      "daftar-talenta": "fas fa-users",
      "detail": "fas fa-user",
      "suksesi": "fas fa-arrow-trend-up",
      "pengembangan": "fas fa-chart-line",
      "masterdata": "fas fa-database",
      "unit-kerja": "fas fa-building",
      "jabatan": "fas fa-briefcase",
      "pegawai": "fas fa-id-card",
      "indikator": "fas fa-chart-bar",
      "instrumen": "fas fa-clipboard-list",
      "input-penilaian": "fas fa-edit",
      "penilaian-pegawai": "fas fa-star",
      "standar-kompetensi-msk": "fas fa-certificate",
      "kotak-interval": "fas fa-th",
      "pengaturan": "fas fa-cog",
    };

    // Skip numeric segments (like NIP in detail pages)
    if (!/^\d+$/.test(path)) {
      items.push({
        label: labelMap[path] || path.charAt(0).toUpperCase() + path.slice(1),
        path: currentPath,
        icon: iconMap[path],
      });
    }
  });

  return items;
};

export default Breadcrumb;
