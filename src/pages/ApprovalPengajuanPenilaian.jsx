import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import IconButton from "../components/IconButton";
import ServerDataTable from "../components/ServerDataTable";
import {
  fetchPengajuanPenilaianList,
  fetchSubIndikators,
  fetchInstrumens,
} from "../services/apiService";

const STATUS_OPTIONS = [
  { value: "Diajukan", label: "Diajukan" },
  { value: "Diterima", label: "Diterima" },
  { value: "Ditolak", label: "Ditolak" },
];

const statusClass = (status) => {
  switch ((status || "").toLowerCase()) {
    case "diajukan":
      return "bg-blue-50 text-blue-500 border border-blue-200";
    case "diterima":
      return "bg-teal-50 text-teal-500 border border-teal-200";
    case "ditolak":
      return "bg-red-50 text-red-500 border border-red-200";
    default:
      return "bg-gray-100 text-gray-500 border border-gray-200";
  }
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const ApprovalPengajuanPenilaian = () => {
  const navigate = useNavigate();
  const [refreshKey] = useState(0);
  const [pegawaiOptions, setPegawaiOptions] = useState([]);
  const [subindikatorOptions, setSubindikatorOptions] = useState([]);
  const [instrumenOptions, setInstrumenOptions] = useState([]);

  useEffect(() => {
    document.title = "Approval Pengajuan Penilaian | SIMANTAP";
  }, []);

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [subs, instrumens, pegawaiPengajuan] = await Promise.all([
          fetchSubIndikators(),
          fetchInstrumens(),
          fetchPengajuanPenilaianList({
            with_join: true,
            with_pagination: false,
          }),
        ]);

        const pegawaiMap = new Map();
        (pegawaiPengajuan?.data || []).forEach((item) => {
          const pegawai = item?.pegawai;
          if (!pegawai?.id) return;

          const labelParts = [pegawai.name || "Tanpa Nama", pegawai.nip || "-"];
          pegawaiMap.set(pegawai.id, {
            value: pegawai.id,
            label: `${labelParts[0]} (${labelParts[1]})`,
          });
        });

        setPegawaiOptions(Array.from(pegawaiMap.values()));
        setSubindikatorOptions(
          (subs || []).map((item) => ({
            value: item.id,
            label: item.subindikator || item.nama || item.name,
          })),
        );
        setInstrumenOptions(
          (instrumens || []).map((item) => ({
            value: item.id,
            label: item.instrumen || item.nama || item.name,
          })),
        );
      } catch (error) {
        console.error("loadFilterOptions error:", error);
      }
    };

    loadFilterOptions();
  }, []);

  const fetchData = useCallback(async (params) => {
    const payload = {
      ...params,
      with_join: true,
      status: params.status,
    };

    return fetchPengajuanPenilaianList(payload);
  }, []);

  const columns = useMemo(
    () => [
      {
        key: "no",
        label: "No",
        render: (_, index) => (
          <span className="font-semibold text-gray-500">{index + 1}</span>
        ),
      },
      {
        key: "pegawai",
        label: "Pegawai",
        render: (item) => (
          <div className="min-w-[220px]">
            <div className="font-semibold text-gray-900">
              {item?.pegawai?.name || "-"}
            </div>
            <div className="text-sm text-gray-500">
              {item?.pegawai?.jabatan_name || "-"}
            </div>
            <div className="text-sm text-gray-500">
              NIP. {item?.pegawai?.nip || "-"}
            </div>
          </div>
        ),
      },
      {
        key: "subindikator",
        label: "Subindikator",
        render: (item) => (
          <span className="text-gray-700">
            {item?.subindikator?.subindikator || "-"}
          </span>
        ),
      },
      {
        key: "instrumen",
        label: "Instrumen",
        render: (item) => (
          <span className="text-gray-700">
            {(item?.instrumen?.instrumen ? item?.instrumen?.instrumen + " (Skor: " + item?.instrumen?.skor + ")" : "-")}
          </span>
        ),
      },
      {
        key: "tanggal_sk",
        label: "Tanggal SK",
        noWrap: true,
        render: (item) => (
          <span className="text-gray-700">{formatDate(item?.tanggal_sk)}</span>
        ),
      },
      {
        key: "status",
        label: "Status",
        align: "center",
        render: (item) => (
          <span
            className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${statusClass(item?.status)}`}
          >
            {item?.status || "-"}
          </span>
        ),
      },
      {
        key: "aksi",
        label: "",
        render: (item) => (
          <IconButton
            onClick={() => navigate(`/approval-pengajuan-penilaian/${item.id}`)}
            variant="primary"
            size="lg"
            title="Detail"
          >
            <i className="fas fa-eye text-lg mr-2" />
            Detail
          </IconButton>
        ),
      },
    ],
    [navigate],
  );

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <Breadcrumb />

      <div className="mb-6 rounded-2xl border border-gray-200 bg-gradient-to-r from-cyan-50 via-white to-teal-50 p-5 shadow-sm">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          Approval Pengajuan Penilaian
        </h1>
        <p className="mt-2 text-gray-600">
          Verifikasi pengajuan penilaian pegawai, cek dokumen pendukung, lalu
          lanjutkan proses persetujuan.
        </p>
      </div>

      <div className="overflow-x-auto">
        <ServerDataTable
          key={refreshKey}
          columns={columns}
          fetchData={fetchData}
          itemsPerPageOptions={[10, 25, 50, 100]}
          defaultFilters={{
            status: "Diajukan",
            pegawai_id: "",
            subindikator_id: "",
            instrumen_id: "",
          }}
          filterConfigs={[
            {
              key: "status",
              label: "Status",
              placeholder: "Pilih status",
              options: STATUS_OPTIONS,
            },
            {
              key: "pegawai_id",
              label: "Pegawai",
              placeholder: "Semua pegawai",
              options: pegawaiOptions,
            },
            {
              key: "subindikator_id",
              label: "Subindikator",
              placeholder: "Semua subindikator",
              options: subindikatorOptions,
            },
            {
              key: "instrumen_id",
              label: "Instrumen",
              placeholder: "Semua instrumen",
              options: instrumenOptions,
            },
          ]}
        />
      </div>
    </div>
  );
};

export default ApprovalPengajuanPenilaian;
