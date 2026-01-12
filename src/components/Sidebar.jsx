import { NavLink, useLocation } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect, useRef } from "react";
import logo from "../assets/logo.png";

const Sidebar = () => {
  const { sidebarExpanded, setSidebarExpanded, t } = useSettings();
  const { user, logout } = useAuth();
  const [masterdataOpen, setMasterdataOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navRef = useRef(null);
  const [navScrollable, setNavScrollable] = useState(false);
  const location = useLocation();

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
    // Auto-open masterdata dropdown when current route is a child of /masterdata
    if (location && location.pathname) {
      setMasterdataOpen(location.pathname.startsWith("/masterdata"));
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
  }, [sidebarExpanded, isMobile, masterdataOpen]);

  const menuItems = [
    { path: "/", label: t("dashboard"), icon: "fas fa-chart-line" },
    {
      path: "/daftar-talenta",
      label: t("daftarTalenta"),
      icon: "fas fa-users",
    },
    { path: "/suksesi", label: t("suksesi"), icon: "fas fa-arrow-trend-up" },
    {
      path: "/pengembangan",
      label: t("pengembangan"),
      icon: "fas fa-graduation-cap",
    },
    {
      path: "/masterdata",
      label: t("masterdata"),
      icon: "fas fa-database",
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
        // { path: '/masterdata/pegawai', label: t('pegawai'), icon: 'fas fa-user-circle' },
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
          icon: "fas fa-clipboard-check",
        },
      ],
    },
  ];

  // Mobile menu toggle button (floating button on mobile)
  const MobileMenuButton = () => (
    <button
      onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-[#3B82F6] hover:bg-[#296eb8] text-white rounded-lg shadow-lg transition-all duration-300 cursor-pointer"
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
          <div className="flex items-center justify-between mb-4">
            {sidebarExpanded ? (
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className="w-11 h-11 bg-[#3B82F6] rounded-lg flex items-center justify-center shadow-lg overflow-hidden">
                  <img
                    src={logo}
                    alt="Logo"
                    className="w-full h-full object-contain p-1"
                  />
                </div>
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
              <div className="w-11 h-11 bg-[#3B82F6] rounded-lg flex items-center justify-center shadow-lg mx-auto overflow-hidden">
                <img
                  src={logo}
                  alt="Logo"
                  className="w-full h-full object-contain p-1"
                />
              </div>
            )}
          </div>

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
            <div className="bg-gray-100 rounded-lg p-3 hover:bg-gray-100 transition-all duration-300">
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
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#2fa84f] rounded-full border-2 border-white"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate text-gray-800">
                    {user?.name || "User"}
                  </p>
                  <p className="text-xs text-[#3B82F6] truncate">
                    {user?.role || "Pegawai"}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {user?.role === "Super Admin" || user?.role === "Admin"
                      ? ""
                      : "NIP: "}
                    {user?.nip || user?.email}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative cursor-pointer">
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
              <div className="absolute bottom-0 right-1/2 translate-x-1/2 translate-y-1 w-3 h-3 bg-[#2fa84f] rounded-full border-2 border-white"></div>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav
          ref={navRef}
          className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-4 space-y-1"
        >
          {menuItems.map((item) => (
            <div key={item.path}>
              {item.children ? (
                <>
                  {sidebarExpanded ? (
                    <>
                      <button
                        onClick={() => setMasterdataOpen(!masterdataOpen)}
                        className="w-full flex items-center cursor-pointer px-4 py-3 hover:bg-[#3B82F6] hover:text-white transition-all duration-200 group rounded-lg text-gray-700"
                      >
                        <i
                          className={`${item.icon} text-xl flex-shrink-0 group-hover:scale-110 transition-transform text-[#3B82F6] group-hover:text-white`}
                        ></i>
                        <span className="ml-3 flex-1 text-left">
                          {item.label}
                        </span>
                        <i
                          className={`fas fa-chevron-right transition-all duration-300 ${
                            masterdataOpen ? "rotate-90" : ""
                          }`}
                        ></i>
                      </button>
                      <div
                        className={`overflow-hidden transition-all duration-500 ease-in-out ${
                          masterdataOpen
                            ? "max-h-96 opacity-100"
                            : "max-h-0 opacity-0"
                        }`}
                      >
                        <div className="space-y-1 py-1">
                          {item.children.map((child) => (
                            <NavLink
                              key={child.path}
                              to={child.path}
                            >
                              {({ isActive }) => (
                                <div
                                  className={`flex items-center px-4 py-3 pl-12 hover:bg-[#3B82F6] hover:text-white transition-all duration-200 group rounded-lg mx-2 ${
                                    isActive
                                      ? "bg-[#3B82F6] text-white"
                                      : "text-gray-700"
                                  }`}
                                >
                                  <i
                                    className={`${child.icon} flex-shrink-0 group-hover:scale-110 transition-transform ${isActive ? 'text-white' : 'text-[#3B82F6]'} group-hover:text-white`}
                                  ></i>
                                  <span className="ml-3">{child.label}</span>
                                </div>
                              )}
                            </NavLink>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    // Minimized sidebar - show icons vertically below parent
                    <div className="relative">
                      <button
                        onClick={() => setMasterdataOpen(!masterdataOpen)}
                        title={item.label}
                        className={`masterdata-button w-full flex items-center cursor-pointer px-4 py-3 justify-center hover:bg-[#3B82F6] hover:text-white transition-all duration-200 rounded-lg relative group/tooltip text-gray-700 ${
                          masterdataOpen ? "bg-gray-100" : ""
                        }`}
                      >
                        <i
                          className={`${item.icon} text-xl flex-shrink-0 transition-transform text-[#3B82F6] group-hover:text-white`}
                        ></i>
                        {/* Tooltip */}
                        <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                          {item.label}
                        </span>
                      </button>
                      {/* Child icons vertically below parent */}
                      <div
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${
                          masterdataOpen
                            ? "max-h-96 opacity-100"
                            : "max-h-0 opacity-0"
                        }`}
                      >
                        <div className="bg-gray-50 space-y-1 py-1">
                          {item.children.map((child) => (
                            <NavLink
                              key={child.path}
                              to={child.path}
                              onClick={() => setMasterdataOpen(false)}
                              title={child.label}
                            >
                              {({ isActive }) => (
                                <div
                                  className={`flex items-center justify-center px-4 py-3 hover:bg-[#3B82F6] hover:text-white transition-all duration-200 group relative group/tooltip ${
                                    isActive
                                      ? "bg-[#3B82F6] text-white"
                                      : "text-gray-700"
                                  }`}
                                >
                                  <i
                                    className={`${child.icon} flex-shrink-0 group-hover:scale-110 transition-transform ${isActive ? 'text-white' : 'text-[#3B82F6]'} group-hover:text-white`}
                                  ></i>
                                  {/* Tooltip */}
                                  <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                                    {child.label}
                                  </span>
                                </div>
                              )}
                            </NavLink>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <NavLink
                  to={item.path}
                  title={!sidebarExpanded ? item.label : ""}
                >
                  {({ isActive }) => (
                    <div
                      className={`flex items-center relative group/tooltip rounded-lg ${
                        sidebarExpanded ? "px-4 py-3" : "px-4 py-3 justify-center"
                      } hover:bg-[#3B82F6] hover:text-white transition-all duration-200 group ${
                        isActive ? "bg-[#3B82F6] text-white" : "text-gray-700"
                      }`}
                    >
                      <i
                        className={`${item.icon} text-xl flex-shrink-0 group-hover:scale-110 transition-transform ${isActive ? 'text-white' : 'text-[#3B82F6]'} group-hover:text-white`}
                      ></i>
                      {sidebarExpanded && (
                        <span className="ml-3">{item.label}</span>
                      )}
                      {/* Tooltip for minimized mode */}
                      {!sidebarExpanded && (
                        <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                          {item.label}
                        </span>
                      )}
                    </div>
                  )}
                </NavLink>
              )}
            </div>
          ))}
          {/* Footer: render inside nav when nav is scrollable so it scrolls with content */}
          {navScrollable && (
            <div className="mt-4 border-t border-gray-200 pt-3 px-0">
              {/* Logout Button */}
              <button
                onClick={logout}
                title={!sidebarExpanded ? "Logout" : ""}
                className={`w-full flex items-center relative group/tooltip ${
                  sidebarExpanded ? "px-4 py-3" : "px-4 py-3 justify-center"
                } mb-4 bg-red-600 hover:bg-red-700 rounded-lg transition-all duration-200 group cursor-pointer text-white`}
              >
                <i className="fas fa-sign-out-alt text-xl flex-shrink-0 group-hover:scale-110 transition-transform text-white"></i>
                {sidebarExpanded && (
                  <span className="ml-3 font-medium">Logout</span>
                )}
                {/* Tooltip for minimized mode */}
                {!sidebarExpanded && (
                  <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                    Logout
                  </span>
                )}
              </button>

              {/* Settings Link */}
              <NavLink
                to="/pengaturan"
                title={!sidebarExpanded ? t("pengaturan") : ""}
              >
                {({ isActive }) => (
                  <div
                    className={`flex items-center relative group/tooltip ${
                      sidebarExpanded ? "px-4 py-3" : "px-4 py-3 justify-center"
                    } rounded-lg hover:bg-[#3B82F6] hover:text-white transition-all duration-200 group ${
                      isActive ? "bg-[#3B82F6] text-white" : "text-gray-700"
                    }`}
                  >
                    <i className={`fas fa-cog text-xl flex-shrink-0 group-hover:scale-110 group-hover:rotate-90 transition-all duration-300 ${isActive ? 'text-white' : 'text-[#3B82F6]'} group-hover:text-white`}></i>
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
                )}
              </NavLink>
            </div>
          )}
        </nav>

        {/* When nav is NOT scrollable, render footer below nav so it's positioned at the bottom */}
        {!navScrollable && (
          <div className="border-t border-gray-200 pt-3 px-4">
            <button
              onClick={logout}
              title={!sidebarExpanded ? "Logout" : ""}
              className={`w-full flex items-center relative group/tooltip ${
                sidebarExpanded ? "px-4 py-3" : "px-4 py-3 justify-center"
              } mb-3 bg-red-600 hover:bg-red-700 rounded-lg transition-all duration-200 group cursor-pointer text-white`}
            >
              <i className="fas fa-sign-out-alt text-xl flex-shrink-0 group-hover:scale-110 transition-transform text-white"></i>
              {sidebarExpanded && (
                <span className="ml-3 font-medium">Logout</span>
              )}
              {!sidebarExpanded && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                  Logout
                </span>
              )}
            </button>

            <NavLink
              to="/pengaturan"
              title={!sidebarExpanded ? t("pengaturan") : ""}
            >
              {({ isActive }) => (
                <div
                  className={`flex items-center relative group/tooltip ${
                    sidebarExpanded ? "px-4 py-3" : "px-4 py-3 justify-center"
                  } rounded-lg hover:bg-[#3B82F6] hover:text-white transition-all duration-200 group ${
                    isActive ? "bg-[#3B82F6] text-white" : "text-gray-700"
                  }`}
                >
                  <i className={`fas fa-cog text-xl flex-shrink-0 group-hover:scale-110 group-hover:rotate-90 transition-all duration-300 ${isActive ? 'text-white' : 'text-[#3B82F6]'} group-hover:text-white`}></i>
                  {sidebarExpanded && (
                    <span className="ml-3">{t("pengaturan")}</span>
                  )}
                  {!sidebarExpanded && (
                    <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                      {t("pengaturan")}
                    </span>
                  )}
                </div>
              )}
            </NavLink>
          </div>
        )}

        {/* Copyright stays fixed at bottom of sidebar */}
        <div className="sticky bottom-0 px-4 py-2 text-sm text-gray-400 text-center bg-transparent z-20">
          © 2026 BPSDM. All rights reserved
        </div>
      </div>
    </>
  );
};

export default Sidebar;
