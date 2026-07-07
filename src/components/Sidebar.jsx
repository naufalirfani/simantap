import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect, useRef } from "react";
import { fetchPengajuanPenilaianList } from "../services/apiService";
import logo from "../assets/logo.png";

const Sidebar = () => {
  const { sidebarExpanded, setSidebarExpanded, t } = useSettings();
  const { user, logout } = useAuth();
  const [akuisisiOpen, setAkuisisiOpen] = useState(false);
  const [pengembanganOpen, setPengembanganOpen] = useState(false);
  const [penempatanOpen, setPenempatanOpen] = useState(false);
  const [masterdataOpen, setMasterdataOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navRef = useRef(null);
  const [navScrollable, setNavScrollable] = useState(false);
  const [pendingPath, setPendingPath] = useState(null);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === "Super Admin" || user?.role === "Admin";
  const canViewDetail = user && user.nip && !isAdmin;

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close mobile menu when route changes and auto-open parent dropdowns
  useEffect(() => {
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
    // Auto-open parent dropdowns when current route matches a child prefix
    if (location && location.pathname) {
      setAkuisisiOpen(location.pathname.startsWith("/akuisisi"));
      setPengembanganOpen(location.pathname.startsWith("/pengembangan") || location.pathname.startsWith("/pengembangan-talenta"));
      setPenempatanOpen(location.pathname.startsWith("/penempatan"));
      setMasterdataOpen(location.pathname.startsWith("/masterdata"));
      // Clear pending path when location actually changes
      setPendingPath(null);
    }
  }, [location.pathname, isMobile]);

  // Detect if the navigation area is scrollable (content overflows)
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const check = () => {
      setNavScrollable(el.scrollHeight > el.clientHeight);
    };
    check();
    let ro;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(check);
      ro.observe(el);
    } else {
      window.addEventListener("resize", check);
    }
    const mo = new MutationObserver(check);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", check);
      mo.disconnect();
    };
  }, [sidebarExpanded, isMobile, akuisisiOpen, pengembanganOpen, penempatanOpen, masterdataOpen]);

  useEffect(() => {
    if (!isAdmin) {
      setPendingApprovalCount(0);
      return;
    }

    const loadPendingApprovalCount = async () => {
      try {
        const result = await fetchPengajuanPenilaianList({
          status: "Diajukan",
          with_pagination: false,
        });
        setPendingApprovalCount(result?.meta?.total || 0);
      } catch (error) {
        console.error("loadPendingApprovalCount error:", error);
      }
    };

    loadPendingApprovalCount();
    const timer = window.setInterval(loadPendingApprovalCount, 60000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isAdmin, location.pathname]);

  const menuSections = [
    {
      title: null,
      items: [
        { path: "/", label: t("dashboard"), icon: "fas fa-chart-line" }
      ]
    },
    {
      title: "MANAJEMEN TALENTA ASN",
      items: [
        {
          path: "/akuisisi",
          label: "Akuisisi Talenta",
          icon: "fas fa-user-plus",
          isOpen: akuisisiOpen,
          toggleOpen: () => setAkuisisiOpen((v) => !v),
          children: [
            {
              path: "/akuisisi/daftar-talenta",
              label: "Daftar Talenta",
              icon: "fas fa-users",
            },
            {
              path: "/akuisisi/kelompok-rencana-suksesi",
              label: "Kelompok Rencana Suksesi",
              icon: "fas fa-sitemap",
            }
          ]
        },
        {
          path: "/pengembangan",
          label: "Pengembangan Talenta",
          icon: "fas fa-graduation-cap",
          isOpen: pengembanganOpen,
          toggleOpen: () => setPengembanganOpen((v) => !v),
          children: [
            {
              path: "/pengembangan-talenta/indeks-kesenjangan",
              label: "Indeks Kesenjangan Kompetensi",
              icon: "fas fa-chart-bar",
            },
            {
              path: "/pengembangan-talenta/rencana-pengembangan",
              label: "Rencana Pengembangan",
              icon: "fas fa-calendar-alt",
            },
            {
              path: "/pengembangan-talenta/pelaksanaan-pengembangan",
              label: "Pelaksanaan Pengembangan",
              icon: "fas fa-tasks",
            },
            {
              path: "/pengembangan-talenta/evaluasi-pengembangan",
              label: "Evaluasi Pengembangan",
              icon: "fas fa-clipboard-check",
            }
          ]
        },
        {
          path: "/retensi-talenta",
          label: "Retensi Talenta",
          icon: "fas fa-user-shield",
        },
        {
          path: "/penempatan",
          label: "Penempatan Talenta",
          icon: "fas fa-user-tie",
          isOpen: penempatanOpen,
          toggleOpen: () => setPenempatanOpen((v) => !v),
          children: [
            {
              path: "/penempatan/rencana-suksesi",
              label: "Rencana Suksesi",
              icon: "fas fa-map-signs",
            },
            {
              path: "/penempatan/approval-suksesor",
              label: "Approval Suksesor",
              icon: "fas fa-user-check",
            },
            {
              path: "/penempatan/penetapan-talenta",
              label: "Penetapan Talenta",
              icon: "fas fa-user-tag",
            }
          ]
        },
        {
          path: "/pemantauan-evaluasi",
          label: "Pemantauan dan Evaluasi",
          icon: "fas fa-desktop",
        }
      ]
    },
    {
      title: "PENGATURAN",
      items: [
        {
          path: "/approval-pengajuan",
          label: "Approval Pengajuan",
          icon: "fas fa-file-signature",
          badge: pendingApprovalCount,
        },
        {
          path: "/masterdata",
          label: t("masterdata"),
          icon: "fas fa-database",
          isOpen: masterdataOpen,
          toggleOpen: () => setMasterdataOpen((v) => !v),
          children: [
            {
              path: "/masterdata/unit-kerja",
              label: t("unitKerja"),
              icon: "fas fa-building",
            },
            {
              path: "/masterdata/jabatan",
              label: t("jabatan"),
              icon: "fas fa-briefcase",
            },
            {
              path: "/masterdata/kotak-interval",
              label: "Kotak Interval",
              icon: "fas fa-th",
            },
            {
              path: "/masterdata/indikator",
              label: t("indikator"),
              icon: "fas fa-chart-bar",
            },
            {
              path: "/masterdata/instrumen",
              label: "Instrumen",
              icon: "fas fa-clipboard-list",
            },
            {
              path: "/masterdata/standar-kompetensi-msk",
              label: "Standar Kompetensi MSK",
              icon: "fas fa-certificate",
            },
            {
              path: "/masterdata/penilaian-pegawai",
              label: "Penilaian Pegawai",
              icon: "fas fa-star",
            },
          ]
        }
      ]
    }
  ];

  // Mobile menu toggle button (floating button on mobile)
  const MobileMenuButton = () => (
    <button
      onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-teal-500 hover:bg-teal-600 text-white rounded-lg shadow-lg transition-all duration-300 cursor-pointer"
    >
      <i
        className={`${
          isMobileMenuOpen ? "fas fa-times" : "fas fa-bars"
        } text-2xl`}
      ></i>
    </button>
  );

  return (
    <>
      <MobileMenuButton />

      {/* Overlay for mobile */}
      {isMobile && isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div
        className={`${
          sidebarExpanded ? "w-90" : "w-20"
        } transition-all duration-500 ease-in-out flex flex-col h-screen shadow-lg overflow-x-hidden bg-white text-gray-700
        ${isMobile ? "fixed left-0 top-0 z-40" : "sticky top-0"}
        ${isMobile && !isMobileMenuOpen ? "-translate-x-full" : "translate-x-0"}
        `}
      >
        {/* Header with Logo */}
        <div className="p-5 border-b border-gray-200">
          <NavLink
            to="/"
            onClick={() => setPendingPath("/")}
            className="flex items-center justify-between mb-4 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            title="Dashboard"
          >
            {sidebarExpanded ? (
              <div className="flex items-center space-x-3 overflow-hidden">
                <img
                  src={logo}
                  alt="Logo"
                  className="w-10 h-10 object-contain"
                />
                <div className="overflow-hidden min-w-0 flex-1">
                  <h1 className="font-bold text-xl tracking-tight whitespace-nowrap text-gray-800">
                    SIMANTAP
                  </h1>
                  <p className="text-xs text-gray-500 truncate">
                    Sistem Manajemen Talenta Pegawai
                  </p>
                </div>
              </div>
            ) : (
              <img src={logo} alt="Logo" className="w-12 h-12 object-contain" />
            )}
          </NavLink>

          {/* Toggle Button */}
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className={`w-full ${
              sidebarExpanded ? "" : "px-2"
            } py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all duration-300 flex items-center justify-center group cursor-pointer`}
          >
            {sidebarExpanded ? (
              <>
                <i className="fas fa-chevron-left text-lg transition-transform"></i>
                <span className="ml-2 text-sm font-medium">Collapse</span>
              </>
            ) : (
              <i className="fas fa-chevron-right text-lg transition-transform"></i>
            )}
          </button>
        </div>

        {/* User Info Card */}
        <div className="p-4 border-b border-gray-200">
          {sidebarExpanded ? (
            <button
              type="button"
              onClick={() =>
                canViewDetail && navigate(`/detail-pegawai/${user?.nip}`)
              }
              title={canViewDetail ? "Lihat detail pegawai" : "Profil pengguna"}
              className={`w-full text-left bg-gray-100 rounded-lg p-3 transition-all duration-300 ${
                canViewDetail
                  ? "hover:bg-blue-50 cursor-pointer"
                  : "cursor-default"
              }`}
              disabled={!canViewDetail}
            >
              <div className="flex items-center space-x-3">
                <div className="relative flex-shrink-0">
                  <div className="flex items-center justify-center">
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.nama}
                        className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm"
                      style={{ display: user?.avatar ? "none" : "flex" }}
                    >
                      {user?.nama?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#3085d6] rounded-full border-2 border-white"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-md truncate text-gray-800">
                    {user?.name || "User"}
                  </p>
                  <p className="text-sm text-teal-500 truncate">
                    {user?.role || "Pegawai"}{" "}
                    {user?.jenis_jabatan ? `(${user.jenis_jabatan})` : ""}
                  </p>
                  <p className="text-sm text-gray-500 truncate mt-0.5">
                    {user?.role === "Super Admin" || user?.role === "Admin"
                      ? ""
                      : "NIP. "}
                    {user?.nip || user?.email}
                  </p>
                </div>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                canViewDetail && navigate(`/detail-pegawai/${user?.nip}`)
              }
              title={canViewDetail ? "Lihat detail pegawai" : "Profil pengguna"}
              className={`relative flex items-center justify-center w-full bg-transparent rounded-md p-2 transition-colors duration-200 ${
                canViewDetail
                  ? "hover:bg-blue-50 cursor-pointer"
                  : "cursor-default"
              }`}
              disabled={!canViewDetail}
            >
              <div className="flex items-center justify-center">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.nama}
                    className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm"
                  style={{ display: user?.avatar ? "none" : "flex" }}
                >
                  {user?.nama?.charAt(0)?.toUpperCase() || "?"}
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Navigation Menu */}
        <nav
          ref={navRef}
          className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-4 space-y-1"
        >
          {/* Only show menu items for admin users */}
          {isAdmin &&
            menuSections.map((section, secIdx) => (
              <div key={secIdx} className="space-y-1">
                {section.title && sidebarExpanded && (
                  <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-4 pt-4 pb-2 border-t border-gray-100 first:border-t-0">
                    {section.title}
                  </div>
                )}
                {section.items.map((item) => (
                  <div key={item.path}>
                    {item.children ? (
                      <>
                        {sidebarExpanded ? (
                          <>
                            <button
                              onClick={() => item.toggleOpen()}
                              className="w-full flex items-center cursor-pointer px-4 py-3 hover:bg-teal-500 hover:text-white group rounded-lg text-gray-700 font-medium"
                            >
                              <i
                                className={`${item.icon} text-xl flex-shrink-0 group-hover:scale-110 transition-transform text-teal-500 group-hover:text-white`}
                              ></i>
                              <span className="ml-3 flex-1 text-left text-sm">
                                {item.label}
                              </span>
                              <i
                                className={`fas fa-chevron-right text-teal-500 group-hover:text-white transition-all duration-300 ${
                                  item.isOpen ? "rotate-90" : ""
                                }`}
                              ></i>
                            </button>
                            <div
                              className={`overflow-hidden transition-all duration-500 ease-in-out ${
                                item.isOpen
                                  ? "max-h-[500px] opacity-100"
                                  : "max-h-0 opacity-0"
                              }`}
                            >
                              <div className="space-y-1 py-1">
                                {item.children.map((child) => {
                                  const currentPath =
                                    pendingPath || location.pathname;
                                  const isActive =
                                    currentPath === child.path ||
                                    currentPath.startsWith(child.path + "/");
                                  return (
                                    <NavLink
                                      key={child.path}
                                      to={child.path}
                                      onClick={() => setPendingPath(child.path)}
                                    >
                                      <div
                                        className={`flex items-center px-4 py-3 pl-12 hover:bg-teal-500 hover:text-white group rounded-lg mx-2 ${
                                          isActive
                                            ? "bg-teal-500 text-white"
                                            : "text-gray-700"
                                        }`}
                                      >
                                        <i
                                          className={`${child.icon} flex-shrink-0 group-hover:scale-110 transition-transform ${isActive ? "text-white" : "text-teal-500"} group-hover:text-white`}
                                        ></i>
                                        <span className="ml-3 text-sm">{child.label}</span>
                                      </div>
                                    </NavLink>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        ) : (
                          // Minimized sidebar - show icons vertically below parent
                          <div className="relative">
                            <button
                              onClick={() => item.toggleOpen()}
                              title={item.label}
                              className={`w-full flex items-center cursor-pointer px-4 py-3 justify-center hover:bg-teal-500 hover:text-white transition-all duration-200 rounded-lg relative group/tooltip text-gray-700 ${
                                item.isOpen ? "bg-gray-100" : ""
                              }`}
                            >
                              <i
                                className={`${item.icon} text-xl flex-shrink-0 transition-transform text-teal-500 group-hover:text-white`}
                              ></i>
                              {/* Tooltip */}
                              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                                {item.label}
                              </span>
                            </button>
                            {/* Child icons vertically below parent */}
                            <div
                              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                                item.isOpen
                                  ? "max-h-[500px] opacity-100"
                                  : "max-h-0 opacity-0"
                              }`}
                            >
                              <div className="bg-gray-50 space-y-1 py-1">
                                {item.children.map((child) => {
                                  const currentPath =
                                    pendingPath || location.pathname;
                                  const isActive =
                                    currentPath === child.path ||
                                    currentPath.startsWith(child.path + "/");
                                  return (
                                    <NavLink
                                      key={child.path}
                                      to={child.path}
                                      onClick={() => {
                                        if (item.isOpen) item.toggleOpen();
                                        setPendingPath(child.path);
                                      }}
                                      title={child.label}
                                    >
                                      <div
                                        className={`flex items-center justify-center px-4 py-3 hover:bg-teal-500 hover:text-white group relative group/tooltip ${
                                          isActive
                                            ? "bg-teal-500 text-white"
                                            : "text-gray-700"
                                        }`}
                                      >
                                        <i
                                          className={`${child.icon} flex-shrink-0 group-hover:scale-110 transition-transform ${isActive ? "text-white" : "text-teal-500"} group-hover:text-white`}
                                        ></i>
                                        {/* Tooltip */}
                                        <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                                          {child.label}
                                        </span>
                                      </div>
                                    </NavLink>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <NavLink
                        to={item.path}
                        title={!sidebarExpanded ? item.label : ""}
                        onClick={() => setPendingPath(item.path)}
                      >
                        {() => {
                          const currentPath = pendingPath || location.pathname;
                          const isActive =
                            currentPath === item.path ||
                            (item.path !== "/" &&
                              currentPath.startsWith(item.path + "/"));
                          return (
                            <div
                              className={`flex items-center relative group/tooltip rounded-lg ${
                                sidebarExpanded
                                  ? "px-4 py-3"
                                  : "px-4 py-3 justify-center"
                              } hover:bg-teal-500 hover:text-white group ${
                                isActive
                                  ? "bg-teal-500 text-white"
                                  : "text-gray-700"
                              }`}
                            >
                              <i
                                className={`${item.icon} text-xl flex-shrink-0 group-hover:scale-110 transition-transform ${isActive ? "text-white" : "text-teal-500"} group-hover:text-white`}
                              ></i>
                              {sidebarExpanded && (
                                <span className="ml-3 flex-1 text-sm font-medium">{item.label}</span>
                              )}
                              {sidebarExpanded && item.badge > 0 && (
                                <span
                                  className={`ml-2 inline-flex min-w-[22px] h-[22px] items-center justify-center rounded-full px-1 text-xs font-bold bg-red-600 text-white`}
                                >
                                  {item.badge > 99 ? "99+" : item.badge}
                                </span>
                              )}
                              {/* Tooltip for minimized mode */}
                              {!sidebarExpanded && (
                                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                                  {item.label}
                                </span>
                              )}
                              {!sidebarExpanded && item.badge > 0 && (
                                <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                                  {item.badge > 99 ? "99+" : item.badge}
                                </span>
                              )}
                            </div>
                          );
                        }}
                      </NavLink>
                    )}
                  </div>
                ))}
              </div>
            ))}

          {/* Non-admin users: show message or keep empty */}
          {!isAdmin && (
            <div className="px-4 py-3 text-center text-gray-500 text-sm">
              {sidebarExpanded && (
                <p>
                  Anda dapat melihat profil Anda dengan mengklik kartu pengguna
                  di atas.
                </p>
              )}
            </div>
          )}

          {/* Footer: render inside nav when nav is scrollable so it scrolls with content */}
          {navScrollable && (
            <div className="mt-4 border-t border-gray-200 pt-3 px-0">
              {/* Logout Button */}
              <button
                onClick={logout}
                title={!sidebarExpanded ? "Keluar" : ""}
                className={`w-full flex items-center relative group/tooltip ${
                  sidebarExpanded ? "px-4 py-3" : "px-4 py-3 justify-center"
                } mb-4 bg-red-600 hover:bg-red-700 rounded-lg transition-all duration-200 group cursor-pointer text-white`}
              >
                <i className="fas fa-sign-out-alt text-xl flex-shrink-0 group-hover:scale-110 transition-transform text-white"></i>
                {sidebarExpanded && (
                  <span className="ml-3 font-medium">Keluar</span>
                )}
                {/* Tooltip for minimized mode */}
                {!sidebarExpanded && (
                  <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                    Keluar
                  </span>
                )}
              </button>

              {/* Settings Link */}
              <NavLink
                to="/pengaturan"
                title={!sidebarExpanded ? t("pengaturan") : ""}
                onClick={() => setPendingPath("/pengaturan")}
              >
                {() => {
                  const isActive =
                    (pendingPath || location.pathname) === "/pengaturan";
                  return (
                    <div
                      className={`flex items-center relative group/tooltip ${
                        sidebarExpanded
                          ? "px-4 py-3"
                          : "px-4 py-3 justify-center"
                      } rounded-lg hover:bg-teal-500 hover:text-white group ${
                        isActive ? "bg-teal-500 text-white" : "text-gray-700"
                      }`}
                    >
                      <i
                        className={`fas fa-cog text-xl flex-shrink-0 group-hover:scale-110 group-hover:rotate-90 transition-all duration-300 ${isActive ? "text-white" : "text-teal-500"} group-hover:text-white`}
                      ></i>
                      {sidebarExpanded && (
                        <span className="ml-3">{t("pengaturan")}</span>
                      )}
                      {/* Tooltip for minimized mode */}
                      {!sidebarExpanded && (
                        <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                          {t("pengaturan")}
                        </span>
                      )}
                    </div>
                  );
                }}
              </NavLink>
            </div>
          )}
        </nav>

        {/* When nav is NOT scrollable, render footer below nav so it's positioned at the bottom */}
        {!navScrollable && (
          <div className="border-t border-gray-200 pt-3 px-4">
            <button
              onClick={logout}
              title={!sidebarExpanded ? "Keluar" : ""}
              className={`w-full flex items-center relative group/tooltip ${
                sidebarExpanded ? "px-4 py-3" : "px-4 py-3 justify-center"
              } mb-3 bg-red-600 hover:bg-red-700 rounded-lg transition-all duration-200 group cursor-pointer text-white`}
            >
              <i className="fas fa-sign-out-alt text-xl flex-shrink-0 group-hover:scale-110 transition-transform text-white"></i>
              {sidebarExpanded && (
                <span className="ml-3 font-medium">Keluar</span>
              )}
              {!sidebarExpanded && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                  Keluar
                </span>
              )}
            </button>

            <NavLink
              to="/pengaturan"
              title={!sidebarExpanded ? t("pengaturan") : ""}
              onClick={() => setPendingPath("/pengaturan")}
            >
              {() => {
                const isActive =
                  (pendingPath || location.pathname) === "/pengaturan";
                return (
                  <div
                    className={`flex items-center relative group/tooltip ${
                      sidebarExpanded ? "px-4 py-3" : "px-4 py-3 justify-center"
                    } rounded-lg hover:bg-teal-500 hover:text-white group ${
                      isActive ? "bg-teal-500 text-white" : "text-gray-700"
                    }`}
                  >
                    <i
                      className={`fas fa-cog text-xl flex-shrink-0 group-hover:scale-110 group-hover:rotate-90 transition-all duration-300 ${isActive ? "text-white" : "text-teal-500"} group-hover:text-white`}
                    ></i>
                    {sidebarExpanded && (
                      <span className="ml-3">{t("pengaturan")}</span>
                    )}
                    {!sidebarExpanded && (
                      <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                        {t("pengaturan")}
                      </span>
                    )}
                  </div>
                );
              }}
            </NavLink>
          </div>
        )}

        {/* Copyright stays fixed at bottom of sidebar */}
        <div className="sticky bottom-0 px-4 py-2 text-sm text-gray-400 text-center bg-transparent z-20">
          &copy; 2026 BPSDM - SETJEN DPD RI
        </div>
      </div>
    </>
  );
};

export default Sidebar;
