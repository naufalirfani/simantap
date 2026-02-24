import { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext(null);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}

const translations = {
  id: {
    dashboard: 'Dashboard',
    daftarTalenta: 'Daftar Talenta',
    suksesi: 'Suksesi',
    pengembangan: 'Pengembangan',
    masterdata: 'Masterdata',
    unitKerja: 'Unit Kerja',
    jabatan: 'Jabatan',
    pegawai: 'Pegawai',
    indikator: 'Indikator',
    pengaturan: 'Pengaturan',
    tema: 'Tema',
    terang: 'Terang',
    gelap: 'Gelap',
    ukuranFont: 'Ukuran Font',
    kecil: 'Kecil',
    sedang: 'Sedang',
    besar: 'Besar',
    warnaSidebar: 'Warna Sidebar',
    warnaTeksSidebar: 'Warna Teks Sidebar',
    bahasa: 'Bahasa',
    indonesia: 'Indonesia',
    inggris: 'Inggris',
    simpan: 'Simpan',
    // DataTable translations
    search: 'Cari data...',
    show: 'Tampilkan',
    entries: 'data',
    showing: 'Menampilkan',
    to: '-',
    of: 'dari',
    filteredFrom: 'difilter dari',
    totalEntries: 'total data',
    noData: 'Tidak ada data',
    noDataFound: 'Tidak ada data yang sesuai dengan pencarian',
    page: 'Halaman',
    loadingData: 'Memuat data...',
    errorOccurred: 'Terjadi Kesalahan',
    reload: 'Muat Ulang',
    // Page descriptions
    unitKerjaDesc: 'Daftar unit kerja di lingkungan Sekretariat Jenderal DPD RI',
    jabatanDesc: 'Daftar jabatan di lingkungan Sekretariat Jenderal DPD RI',
    errorLoadingUnitKerja: 'Gagal memuat data unit kerja',
    errorLoadingJabatan: 'Gagal memuat data jabatan',
    noUnitKerja: 'Tidak ada data unit kerja',
    noJabatan: 'Tidak ada data jabatan',
    jenisJabatan: 'Jenis Jabatan',
    kelasJabatan: 'Kelas Jabatan',
    kebutuhanPegawai: 'Kebutuhan Pegawai',
    terisi: 'Terisi',
    // Pegawai page
    pegawaiDesc: 'Daftar pegawai di lingkungan Sekretariat Jenderal DPD RI',
    errorLoadingPegawai: 'Gagal memuat data pegawai',
    noPegawai: 'Tidak ada data pegawai',
    fotoProfil: 'Foto Profil',
    nama: 'Nama',
    nip: 'NIP',
    filterBy: 'Filter berdasarkan',
    allUnitKerja: 'Semua Unit Kerja',
    allJabatan: 'Semua Jabatan',
    allJenisJabatan: 'Semua Jenis Jabatan',
    allRole: 'Semua Role',
    resetFilter: 'Reset Filter',
    applyFilter: 'Terapkan Filter',
    selisih: 'Selisih',
    exportData: 'Ekspor Data',
    exporting: 'Mengekspor...',
  },
  en: {
    dashboard: 'Dashboard',
    daftarTalenta: 'Talent List',
    suksesi: 'Succession',
    pengembangan: 'Development',
    masterdata: 'Masterdata',
    unitKerja: 'Work Unit',
    jabatan: 'Position',
    pegawai: 'Employee',
    indikator: 'Indicator',
    pengaturan: 'Settings',
    tema: 'Theme',
    terang: 'Light',
    gelap: 'Dark',
    ukuranFont: 'Font Size',
    kecil: 'Small',
    sedang: 'Medium',
    besar: 'Large',
    warnaSidebar: 'Sidebar Color',
    warnaTeksSidebar: 'Sidebar Text Color',
    bahasa: 'Language',
    indonesia: 'Indonesian',
    inggris: 'English',
    simpan: 'Save',
    // DataTable translations
    search: 'Search data...',
    show: 'Show',
    entries: 'entries',
    showing: 'Showing',
    to: 'to',
    of: 'of',
    filteredFrom: 'filtered from',
    totalEntries: 'total entries',
    noData: 'No data',
    noDataFound: 'No data matches your search',
    page: 'Page',
    loadingData: 'Loading data...',
    errorOccurred: 'An Error Occurred',
    reload: 'Reload',
    // Page descriptions
    unitKerjaDesc: 'List of work units in the Secretariat General of DPD RI',
    jabatanDesc: 'List of positions in the Secretariat General of DPD RI',
    errorLoadingUnitKerja: 'Failed to load work unit data',
    errorLoadingJabatan: 'Failed to load position data',
    noUnitKerja: 'No work unit data',
    noJabatan: 'No position data',
    jenisJabatan: 'Position Type',
    kelasJabatan: 'Position Class',
    kebutuhanPegawai: 'Employee Needs',
    terisi: 'Filled',
    // Pegawai page
    pegawaiDesc: 'List of employees in the Secretariat General of DPD RI',
    errorLoadingPegawai: 'Failed to load employee data',
    noPegawai: 'No employee data',
    fotoProfil: 'Profile Photo',
    nama: 'Name',
    nip: 'Employee ID',
    filterBy: 'Filter by',
    allUnitKerja: 'All Work Units',
    allJabatan: 'All Positions',
    allJenisJabatan: 'All Position Types',
    allRole: 'All Roles',
    resetFilter: 'Reset Filter',
    applyFilter: 'Apply Filter',
    selisih: 'Difference',
    exportData: 'Export Data',
    exporting: 'Exporting...',
  },
};

export function SettingsProvider({ children }) {
  // Initialize theme with immediate DOM update
  const [theme, setTheme] = useState(() => {
    // Check localStorage first
    const savedTheme = localStorage.getItem('theme');
    const initialTheme = savedTheme || 'light';
    
    // Remove any existing theme classes first
    document.documentElement.classList.remove('dark');
    
    // Only add dark class if theme is explicitly dark
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    }
    
    return initialTheme;
  });

  const [fontSize, setFontSize] = useState(() => {
    return localStorage.getItem('fontSize') || 'small';
  });

  const [sidebarColor, setSidebarColor] = useState(() => {
    return localStorage.getItem('sidebarColor') || '#1e293b';
  });

  const [sidebarTextColor, setSidebarTextColor] = useState(() => {
    return localStorage.getItem('sidebarTextColor') || '#ffffff';
  });

  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || 'id';
  });

  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    // Update DOM class - remove dark class first, then add only if needed
    const htmlElement = document.documentElement;
    htmlElement.classList.remove('dark');
    
    if (theme === 'dark') {
      htmlElement.classList.add('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('fontSize', fontSize);
    const sizes = { small: '14px', medium: '16px', large: '18px' };
    document.documentElement.style.fontSize = sizes[fontSize];
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('sidebarColor', sidebarColor);
  }, [sidebarColor]);

  useEffect(() => {
    localStorage.setItem('sidebarTextColor', sidebarTextColor);
  }, [sidebarTextColor]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key) => translations[language][key] || key;

  const value = {
    theme,
    setTheme,
    fontSize,
    setFontSize,
    sidebarColor,
    setSidebarColor,
    sidebarTextColor,
    setSidebarTextColor,
    language,
    setLanguage,
    sidebarExpanded,
    setSidebarExpanded,
    t,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
