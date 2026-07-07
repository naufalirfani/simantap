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
        const isClickable = item.clickable !== false;
        
        return (
          <div key={index} className="flex items-center space-x-2 flex-shrink-0">
            {index > 0 && (
              <i className="fas fa-chevron-right w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" aria-hidden="true" />
            )}
            {isLast || !isClickable ? (
              <span className={`${isLast ? 'text-teal-500 dark:text-blue-400 font-semibold' : 'text-gray-600 dark:text-gray-400'} flex items-center gap-2 whitespace-nowrap`}>
                {item.icon && <i className={item.icon}></i>}
                {item.label}
              </span>
            ) : (
              <Link
                to={item.path}
                className="text-gray-600 dark:text-gray-400 hover:text-teal-500 dark:hover:text-blue-400 transition-colors duration-200 flex items-center gap-2 whitespace-nowrap group"
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
      "akuisisi": "Akuisisi Talenta",
      "daftar-talenta": "Daftar Talenta",
      "kelompok-rencana-suksesi": "Kelompok Rencana Suksesi",
      "approval-pengajuan-penilaian": "Approval Pengajuan",
      "approval-pengajuan": "Approval Pengajuan",
      "detail": "Detail Pegawai",
      "suksesi": "Kelompok Rencana Suksesi",
      "pengembangan-talenta": "Pengembangan Talenta",
      "pengembangan": "Pengembangan Talenta",
      "indeks-kesenjangan": "Indeks Kesenjangan Kompetensi",
      "rencana-pengembangan": "Rencana Pengembangan",
      "rencana": "Rencana Pengembangan",
      "pelaksanaan-pengembangan": "Pelaksanaan Pengembangan",
      "pelaksanaan": "Pelaksanaan Pengembangan",
      "evaluasi-pengembangan": "Evaluasi Pengembangan",
      "evaluasi": "Evaluasi Pengembangan",
      "retensi-talenta": "Retensi Talenta",
      "penempatan": "Penempatan Talenta",
      "penempatan-talenta": "Penempatan Talenta",
      "rencana-suksesi": "Rencana Suksesi",
      "approval-suksesor": "Approval Suksesor",
      "penetapan-talenta": "Penetapan Talenta",
      "pemantauan-evaluasi": "Pemantauan dan Evaluasi",
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
      "akuisisi": "fas fa-user-plus",
      "daftar-talenta": "fas fa-users",
      "kelompok-rencana-suksesi": "fas fa-sitemap",
      "approval-pengajuan-penilaian": "fas fa-file-signature",
      "approval-pengajuan": "fas fa-file-signature",
      "detail": "fas fa-user",
      "suksesi": "fas fa-sitemap",
      "pengembangan-talenta": "fas fa-graduation-cap",
      "pengembangan": "fas fa-graduation-cap",
      "indeks-kesenjangan": "fas fa-chart-bar",
      "rencana-pengembangan": "fas fa-calendar-alt",
      "rencana": "fas fa-calendar-alt",
      "pelaksanaan-pengembangan": "fas fa-tasks",
      "pelaksanaan": "fas fa-tasks",
      "evaluasi-pengembangan": "fas fa-clipboard-check",
      "evaluasi": "fas fa-clipboard-check",
      "retensi-talenta": "fas fa-user-shield",
      "penempatan": "fas fa-user-tie",
      "penempatan-talenta": "fas fa-user-tie",
      "rencana-suksesi": "fas fa-map-signs",
      "approval-suksesor": "fas fa-user-check",
      "penetapan-talenta": "fas fa-user-tag",
      "pemantauan-evaluasi": "fas fa-desktop",
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

    // Skip numeric segments as separate breadcrumb items (like NIP)
    if (!/^\d+$/.test(path)) {
      // Check if next path segment is numeric (like NIP)
      // If yes, include it in the path for this breadcrumb item
      let itemPath = currentPath;
      if (
        path !== "penilaian-pegawai" &&
        index < paths.length - 1 &&
        /^\d+$/.test(paths[index + 1])
      ) {
        itemPath += `/${paths[index + 1]}`;
      }
      
      // Paths that are parent/category only (not clickable destinations)
      const nonClickablePaths = [
        'masterdata',
        'pengembangan',
        'pengembangan-talenta',
        'akuisisi',
        'penempatan',
        'penempatan-talenta'
      ];
      const isClickable = !nonClickablePaths.includes(path);
      
      items.push({
        label: labelMap[path] || path.charAt(0).toUpperCase() + path.slice(1),
        path: itemPath,
        icon: iconMap[path],
        clickable: isClickable,
      });
    }
  });

  return items;
};

export default Breadcrumb;
