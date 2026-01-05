import { NavLink } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import logo from '../assets/logo.png';

const Sidebar = () => {
  const { sidebarExpanded, setSidebarExpanded, sidebarColor, t } = useSettings();
  const { user, logout } = useAuth();
  const [masterdataOpen, setMasterdataOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMasterdataPopup, setShowMasterdataPopup] = useState(false);

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  }, [window.location.pathname, isMobile]);

  const menuItems = [
    { path: '/', label: t('dashboard'), icon: 'fas fa-chart-line' },
    { path: '/daftar-talenta', label: t('daftarTalenta'), icon: 'fas fa-users' },
    { path: '/suksesi', label: t('suksesi'), icon: 'fas fa-arrow-trend-up' },
    { path: '/pengembangan', label: t('pengembangan'), icon: 'fas fa-graduation-cap' },
    {
      path: '/masterdata',
      label: t('masterdata'),
      icon: 'fas fa-database',
      children: [
        { path: '/masterdata/unit-kerja', label: t('unitKerja'), icon: 'fas fa-building' },
        { path: '/masterdata/jabatan', label: t('jabatan'), icon: 'fas fa-briefcase' },
        { path: '/masterdata/pegawai', label: t('pegawai'), icon: 'fas fa-user-circle' },
        { path: '/masterdata/indikator', label: t('indikator'), icon: 'fas fa-chart-bar' },
      ],
    },
  ];

  // Mobile menu toggle button (floating button on mobile)
  const MobileMenuButton = () => (
    <button
      onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg transition-all duration-300 cursor-pointer"
    >
      <i className={`${isMobileMenuOpen ? 'fas fa-times' : 'fas fa-bars'} text-2xl`}></i>
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
          sidebarExpanded ? 'w-80' : 'w-20'
        } transition-all duration-500 ease-in-out flex flex-col h-screen text-white shadow-2xl overflow-x-hidden
        ${isMobile ? 'fixed left-0 top-0 z-40' : 'sticky top-0'}
        ${isMobile && !isMobileMenuOpen ? '-translate-x-full' : 'translate-x-0'}
        `}
        style={{ backgroundColor: sidebarColor }}
      >
      {/* Header with Logo */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          {sidebarExpanded ? (
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-lg overflow-hidden">
                <img src={logo} alt="Logo" className="w-full h-full object-contain p-1" />
              </div>
              <div className="overflow-hidden min-w-0 flex-1">
                <h1 className="font-bold text-xl tracking-tight whitespace-nowrap">SIMANTAP</h1>
                <p className="text-xs text-blue-200 truncate">Sistem Manajemen Talenta Pegawai</p>
              </div>
            </div>
          ) : (
            <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-lg mx-auto overflow-hidden">
              <img src={logo} alt="Logo" className="w-full h-full object-contain p-1" />
            </div>
          )}
        </div>
        
        {/* Toggle Button */}
        <button
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          className={`w-full ${sidebarExpanded ? '' : 'px-2'} py-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-300 flex items-center justify-center group cursor-pointer`}
        >
          {sidebarExpanded ? (
            <>
              <i className="fas fa-chevron-left text-lg group-hover:-translate-x-1 transition-transform"></i>
              <span className="ml-2 text-sm font-medium">Collapse</span>
            </>
          ) : (
            <i className="fas fa-chevron-right text-lg group-hover:translate-x-1 transition-transform"></i>
          )}
        </button>
      </div>

      {/* User Info Card */}
      <div className="p-4 border-b border-white/10">
        {sidebarExpanded ? (
          <div className="bg-white/10 rounded-xl p-3 hover:bg-white/15 transition-all duration-300">
            <div className="flex items-center space-x-3">
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white/30">
                  <img
                    src={user?.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.nama || 'User')}&background=3b82f6&color=fff&bold=true`}
                    alt="User"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white/20"></div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-blue-200 truncate">{user?.role || 'Pegawai'}</p>
                <p className="text-xs text-white/60 truncate mt-0.5">{user?.role === 'Super Admin' || user?.role === 'Admin' ? '' : 'NIP: '}{user?.nip || user?.email}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative cursor-pointer">
            <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-white/30 mx-auto">
              <img
                src={user?.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.nama || 'User')}&background=3b82f6&color=fff&bold=true`}
                alt="User"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute bottom-0 right-1/2 translate-x-1/2 translate-y-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white/20"></div>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-1">
        {menuItems.map((item) => (
          <div key={item.path}>
            {item.children ? (
              <>
                {sidebarExpanded ? (
                  <>
                    <button
                      onClick={() => setMasterdataOpen(!masterdataOpen)}
                      className="w-full flex items-center cursor-pointer px-4 py-3 hover:bg-white/10 transition-all duration-200 group rounded-lg"
                    >
                      <i
                        className={`${item.icon} text-xl flex-shrink-0 group-hover:scale-110 transition-transform`}
                      ></i>
                      <span className="ml-3 flex-1 text-left">{item.label}</span>
                      <i
                        className={`fas fa-chevron-right transition-all duration-300 ${
                          masterdataOpen ? 'rotate-90' : ''
                        }`}
                      ></i>
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-500 ease-in-out ${
                        masterdataOpen
                          ? 'max-h-96 opacity-100'
                          : 'max-h-0 opacity-0'
                      }`}
                    >
                      <div className="bg-black/20 space-y-1 py-1">
                        {item.children.map((child) => (
                          <NavLink
                            key={child.path}
                            to={child.path}
                            className={({ isActive }) =>
                              `flex items-center px-4 py-2.5 pl-12 hover:bg-white/10 transition-all duration-200 group rounded-lg mx-2 ${
                                isActive ? 'bg-white/20 border-l-4 border-blue-500' : ''
                              }`
                            }
                          >
                            <i
                              className={`${child.icon} flex-shrink-0 group-hover:scale-110 transition-transform`}
                            ></i>
                            <span className="ml-3">{child.label}</span>
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
                      className={`masterdata-button w-full flex items-center cursor-pointer px-4 py-3 justify-center hover:bg-white/10 transition-all duration-200 rounded-lg relative group/tooltip ${
                        masterdataOpen ? 'bg-white/10' : ''
                      }`}
                    >
                      <i
                        className={`${item.icon} text-xl flex-shrink-0 transition-transform`}
                      ></i>
                      {/* Tooltip */}
                      <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                        {item.label}
                      </span>
                    </button>
                    {/* Child icons vertically below parent */}
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        masterdataOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      <div className="bg-black/20 space-y-1 py-1">
                        {item.children.map((child) => (
                          <NavLink
                            key={child.path}
                            to={child.path}
                            onClick={() => setMasterdataOpen(false)}
                            title={child.label}
                            className={({ isActive }) =>
                              `flex items-center justify-center px-4 py-2.5 hover:bg-white/10 transition-all duration-200 group relative group/tooltip ${
                                isActive ? 'bg-white/20' : ''
                              }`
                            }
                          >
                            <i
                              className={`${child.icon} flex-shrink-0 group-hover:scale-110 transition-transform`}
                            ></i>
                            {/* Tooltip */}
                            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                              {child.label}
                            </span>
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
                title={!sidebarExpanded ? item.label : ''}
                className={({ isActive }) =>
                  `flex items-center relative group/tooltip ${
                    sidebarExpanded ? 'px-4 py-3' : 'px-4 py-3 justify-center'
                  } hover:bg-white/10 transition-all duration-200 group ${
                    isActive ? 'bg-white/20 border-l-4 border-blue-500' : ''
                  }`
                }
              >
                <i
                  className={`${item.icon} text-xl flex-shrink-0 group-hover:scale-110 transition-transform`}
                ></i>
                {sidebarExpanded && <span className="ml-3">{item.label}</span>}
                {/* Tooltip for minimized mode */}
                {!sidebarExpanded && (
                  <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                    {item.label}
                  </span>
                )}
              </NavLink>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10">
        {/* Logout Button */}
        <button
          onClick={logout}
          title={!sidebarExpanded ? 'Logout' : ''}
          className={`w-full flex items-center relative group/tooltip ${
            sidebarExpanded ? 'px-4 py-3' : 'px-4 py-3 justify-center'
          } bg-red-500/10 hover:bg-red-500/30 transition-all duration-200 group cursor-pointer text-red-300 hover:text-white border-b border-red-500/20`}
        >
          <i
            className="fas fa-sign-out-alt text-xl flex-shrink-0 group-hover:scale-110 transition-transform"
          ></i>
          {sidebarExpanded && <span className="ml-3 font-medium">Logout</span>}
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
          title={!sidebarExpanded ? t('pengaturan') : ''}
          className={({ isActive }) =>
            `flex items-center relative group/tooltip ${
              sidebarExpanded ? 'px-4 py-3' : 'px-4 py-3 justify-center'
            } hover:bg-white/10 transition-all duration-200 group ${
              isActive ? 'bg-white/20 border-l-4 border-blue-500' : ''
            }`
          }
        >
          <i
            className="fas fa-cog text-xl flex-shrink-0 group-hover:scale-110 group-hover:rotate-90 transition-all duration-300"
          ></i>
          {sidebarExpanded && <span className="ml-3">{t('pengaturan')}</span>}
          {/* Tooltip for minimized mode */}
          {!sidebarExpanded && (
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
              {t('pengaturan')}
            </span>
          )}
        </NavLink>
        {sidebarExpanded && (
          <div className="px-4 py-3 text-xs text-gray-400 text-center">
            © 2026 BPSDM. All rights reserved
          </div>
        )}
      </div>
      </div>
    </>
  );
};

export default Sidebar;
