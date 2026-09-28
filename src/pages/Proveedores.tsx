import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import { IconSearch, IconPlus } from "@/components/Icons";
import { getProveedores, deleteProveedor, type Proveedor } from "@/services/api";
import ProveedorFormModal from "@/components/ProveedorFormModal";

const estadoStyle: Record<string, { bg: string; color: string }> = {
  Activo: { bg: "#d1fae5", color: "#10b981" },
  Inactivo: { bg: "#e2e8f0", color: "#64748b" },
  Suspendido: { bg: "#fee2e2", color: "#ef4444" },
  Pendiente: { bg: "#fef3c7", color: "#f59e0b" },
};

function formatMonto(value: number, moneda: string): string {
  if (moneda === "ARS") return `$${value.toLocaleString("es-AR")}`;
  return `${moneda} ${value.toLocaleString("es-AR")}`;
}

function formatearSaldos(proveedor: Proveedor): string {
  const claves = Object.keys(proveedor.saldos ?? {});
  if (claves.length === 0) return "$0";
  return claves
    .sort((a, b) => (a === "ARS" ? -1 : b === "ARS" ? 1 : a.localeCompare(b)))
    .map((m) => formatMonto(proveedor.saldos[m]?.saldo ?? 0, m))
    .join(" · ");
}

export default function Proveedores() {
  const navigate = useNavigate();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rubro, setRubro] = useState("Todos");
  const [estado, setEstado] = useState("Todos");

  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<Proveedor | null>(null);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      setProveedores(await getProveedores());
    } catch (err) {
      console.error(err);
      alert("Error al cargar los proveedores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const rubros = [
    "Todos",
    ...Array.from(new Set(proveedores.map((p) => p.rubro).filter((r): r is string => Boolean(r)))),
  ];
  const estados = ["Todos", "Activo", "Inactivo", "Suspendido", "Pendiente"];

  const filtered = proveedores.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q || p.razonSocial.toLowerCase().includes(q) || (p.cuit ?? "").toLowerCase().includes(q);
    const matchRubro = rubro === "Todos" || p.rubro === rubro;
    const matchEstado = estado === "Todos" || p.estado === estado;
    return matchSearch && matchRubro && matchEstado;
  });

  const summaryItems = [
    {
      label: "Total Proveedores",
      value: String(proveedores.length),
      color: "#0ea5e9",
    },
    {
      label: "Activos",
      value: String(proveedores.filter((p) => p.estado === "Activo").length),
      color: "#10b981",
    },
    {
      label: "Pendientes",
      value: String(proveedores.filter((p) => p.estado === "Pendiente").length),
      color: "#f59e0b",
    },
    {
      label: "Suspendidos / Inactivos",
      value: String(
        proveedores.filter((p) => p.estado === "Suspendido" || p.estado === "Inactivo").length,
      ),
      color: "#ef4444",
    },
  ];

  async function handleConfirmarEliminar() {
    if (!deleting) return;
    try {
      await deleteProveedor(deleting.id);
      setProveedores((prev) => prev.filter((p) => p.id !== deleting.id));
      setDeleting(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al eliminar el proveedor");
    }
  }

  return (
    <AppLayout
      breadcrumbs={[{ label: "Inicio", onClick: () => navigate("/") }, { label: "Proveedores" }]}
    >
      <div className="p-[32px] flex flex-col gap-[24px]">
        {/* Title Row */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[24px]">
              Proveedores
            </p>
            <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[14px] mt-[4px]">
              Gestión de proveedores, datos bancarios y seguimiento de compras
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-[8px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] px-[16px] py-[10px] rounded-[8px]"
          >
            <IconPlus />
            Nuevo Proveedor
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-[12px]">
          <div
            className="flex-1 flex items-center gap-[8px] bg-white px-[12px] py-[9px] rounded-[8px]"
            style={{ border: "1px solid #e2e8f0" }}
          >
            <IconSearch color="#94a3b8" />
            <input
              type="text"
              placeholder="Buscar por razón social o CUIT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] outline-none placeholder:text-[#94a3b8] bg-transparent"
            />
          </div>
          <select
            value={rubro}
            onChange={(e) => setRubro(e.target.value)}
            className="bg-white font-['Geist:Regular',sans-serif] text-[14px] text-[#475569] px-[12px] py-[9px] rounded-[8px] outline-none cursor-pointer"
            style={{ border: "1px solid #e2e8f0" }}
          >
            {rubros.map((r) => (
              <option key={r} value={r}>
                Rubro: {r}
              </option>
            ))}
          </select>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="bg-white font-['Geist:Regular',sans-serif] text-[14px] text-[#475569] px-[12px] py-[9px] rounded-[8px] outline-none cursor-pointer"
            style={{ border: "1px solid #e2e8f0" }}
          >
            {estados.map((e) => (
              <option key={e} value={e}>
                Estado: {e}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div
          className="bg-white rounded-[12px] overflow-hidden"
          style={{ border: "1px solid #e2e8f0" }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                {[
                  "Razón Social",
                  "CUIT",
                  "Contacto",
                  "Rubro",
                  "Localidad",
                  "Saldo",
                  "Estado",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] px-[20px] py-[14px]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/proveedores/${p.id}`)}
                  className="group hover:bg-[#f8fafc] transition-colors cursor-pointer"
                  style={{
                    borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none",
                  }}
                >
                  <td className="px-[20px] py-[16px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                    {p.razonSocial}
                  </td>
                  <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                    {p.cuit || "—"}
                  </td>
                  <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#0f172a] text-[14px]">
                    {p.contacto || "—"}
                  </td>
                  <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                    {p.rubro || "—"}
                  </td>
                  <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                    {p.localidad || "—"}
                  </td>
                  <td className="px-[20px] py-[16px] font-['Geist:SemiBold',sans-serif] font-semibold text-[14px]">
                    <span
                      style={{
                        color: Object.values(p.saldos ?? {}).some((s) => s.saldo > 0)
                          ? "#ef4444"
                          : "#10b981",
                      }}
                    >
                      {formatearSaldos(p)}
                    </span>
                  </td>
                  <td className="px-[20px] py-[16px]">
                    <span
                      className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[8px] py-[3px] rounded-[6px]"
                      style={estadoStyle[p.estado]}
                    >
                      {p.estado}
                    </span>
                  </td>
                  <td className="px-[20px] py-[16px]">
                    <div className="flex items-center gap-[4px] opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/proveedores/${p.id}`);
                        }}
                        className="size-[28px] flex items-center justify-center rounded-[6px] hover:bg-[#f1f5f9] transition-colors"
                        title="Ver detalle"
                      >
                        <svg fill="none" height="14" viewBox="0 0 16 16" width="14">
                          <path
                            d="M6 3L11 8L6 13"
                            stroke="#64748b"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.5"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleting(p);
                        }}
                        className="size-[28px] flex items-center justify-center rounded-[6px] hover:bg-[#fee2e2] transition-colors"
                        title="Eliminar"
                      >
                        <svg fill="none" height="14" viewBox="0 0 16 16" width="14">
                          <path
                            d="M2 4H14M5 4V2H11V4M6 7V12M10 7V12M3 4L4 14H12L13 4"
                            stroke="#ef4444"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.5"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-[20px] py-[32px] text-center font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]"
                  >
                    {proveedores.length === 0
                      ? 'Sin proveedores cargados. Creá el primero con el botón "Nuevo Proveedor".'
                      : "No se encontraron proveedores con esos filtros."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div
            className="flex items-center justify-between px-[20px] py-[12px]"
            style={{ borderTop: "1px solid #e2e8f0" }}
          >
            <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px]">
              Mostrando {filtered.length} de {proveedores.length} proveedores
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-[16px]">
          {summaryItems.map((s, i) => (
            <div
              key={i}
              className="bg-white flex items-center justify-between px-[20px] py-[14px] rounded-[10px]"
              style={{ border: "1px solid #e2e8f0" }}
            >
              <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                {s.label}
              </p>
              <p
                className="font-['Geist:Bold',sans-serif] font-bold text-[16px]"
                style={{ color: s.color }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {showCreate && (
        <ProveedorFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            cargarDatos();
          }}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleting(null)} />
          <div
            className="relative bg-white rounded-[16px] w-[400px]"
            style={{ border: "1px solid #e2e8f0" }}
          >
            <div className="px-[24px] py-[20px] flex flex-col gap-[12px]">
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">
                Eliminar Proveedor
              </p>
              <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                ¿Estás seguro de que querés eliminar a{" "}
                <span className="font-semibold">{deleting.razonSocial}</span>? No se puede deshacer.
              </p>
            </div>
            <div
              className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]"
              style={{ borderTop: "1px solid #e2e8f0" }}
            >
              <button
                onClick={() => setDeleting(null)}
                className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarEliminar}
                className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#ef4444] hover:bg-[#dc2626] transition-colors px-[16px] py-[10px] rounded-[8px]"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
