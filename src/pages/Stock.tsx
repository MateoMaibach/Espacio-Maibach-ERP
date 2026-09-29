import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import { IconSearch, IconPlus } from "@/components/Icons";
import {
  getArticulos,
  getDepositos,
  getExistencias,
  getMovimientosStock,
  getReporteCostos,
  getReporteStockNegativo,
  getReporteValorizacion,
  deleteArticulo,
  deleteDeposito,
  type Articulo,
  type Deposito,
  type Existencia,
  type MovimientoStock,
} from "@/services/api";
import DepositoFormModal from "@/components/DepositoFormModal";
import ArticuloFormModal from "@/components/ArticuloFormModal";
import HistorialCostosModal from "@/components/HistorialCostosModal";
import MovimientoStockModal from "@/components/MovimientoStockModal";

type Tab = "existencias" | "articulos" | "depositos" | "movimientos" | "reportes";

const tabs: { id: Tab; label: string }[] = [
  { id: "existencias", label: "Existencias" },
  { id: "articulos", label: "Artículos" },
  { id: "depositos", label: "Depósitos" },
  { id: "movimientos", label: "Movimientos" },
  { id: "reportes", label: "Reportes" },
];

const tipoStyle: Record<string, { bg: string; color: string }> = {
  ingreso: { bg: "#d1fae5", color: "#10b981" },
  egreso: { bg: "#fee2e2", color: "#ef4444" },
  transferencia: { bg: "#e0f2fe", color: "#0284c7" },
  ajuste: { bg: "#fef3c7", color: "#f59e0b" },
};

const depEstadoStyle: Record<string, { bg: string; color: string }> = {
  activo: { bg: "#d1fae5", color: "#10b981" },
  inactivo: { bg: "#e2e8f0", color: "#64748b" },
};

const negativoStyle: Record<string, { bg: string; color: string }> = {
  alerta: { bg: "#fee2e2", color: "#ef4444" },
  ok: { bg: "#d1fae5", color: "#10b981" },
};

function formatMonto(valor: number) {
  return `$${valor.toLocaleString("es-AR")}`;
}

function formatFecha(fecha: string) {
  if (!fecha) return "—";
  const [a, m, d] = fecha.split("-");
  return `${d}/${m}/${a}`;
}

export default function Stock() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("existencias");
  const [loading, setLoading] = useState(true);

  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);

  const [existencias, setExistencias] = useState<Existencia[]>([]);
  const [valorTotal, setValorTotal] = useState(0);
  const [conNegativo, setConNegativo] = useState(0);

  const [busqueda, setBusqueda] = useState("");
  const [filtroDeposito, setFiltroDeposito] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const [movimientos, setMovimientos] = useState<MovimientoStock[]>([]);

  const [negativos, setNegativos] = useState<Existencia[]>([]);
  const [valorizacion, setValorizacion] = useState<{
    rows: Existencia[];
    resumen: {
      depositoId: string;
      depositoNombre: string;
      articulos: number;
      valor: number;
    }[];
    total: number;
  } | null>(null);
  const [costos, setCostos] = useState<
    (Articulo & {
      costoActual: number;
      costoAnterior: number | null;
      variacion: number | null;
      registros: number;
    })[]
  >([]);

  const [modalDeposito, setModalDeposito] = useState<{ open: boolean; item?: Deposito }>({
    open: false,
  });
  const [modalArticulo, setModalArticulo] = useState<{ open: boolean; item?: Articulo }>({
    open: false,
  });
  const [modalHistorial, setModalHistorial] = useState<string | null>(null);
  const [modalMovimiento, setModalMovimiento] = useState<"ingreso" | "ajuste" | null>(null);
  const [eliminando, setEliminando] = useState<{
    tipo: "articulo" | "deposito";
    item: Articulo | Deposito;
  } | null>(null);

  const cargarBase = useCallback(async () => {
    try {
      const [deps, arts] = await Promise.all([getDepositos(), getArticulos()]);
      setDepositos(deps);
      setArticulos(arts);
    } catch (err) {
      console.error(err);
      alert("Error al cargar los datos de stock");
    }
  }, []);

  const cargarExistencias = useCallback(async () => {
    try {
      const res = await getExistencias(filtroDeposito ? { depositoId: filtroDeposito } : {});
      setExistencias(res.rows);
      setValorTotal(res.valorTotal);
      setConNegativo(res.conStockNegativo);
    } catch (err) {
      console.error(err);
      alert("Error al cargar las existencias");
    }
  }, [filtroDeposito]);

  const cargarMovimientos = useCallback(async () => {
    try {
      setMovimientos(
        await getMovimientosStock({
          depositoId: filtroDeposito || undefined,
          tipo: filtroTipo || undefined,
          desde: filtroDesde || undefined,
          hasta: filtroHasta || undefined,
        }),
      );
    } catch (err) {
      console.error(err);
      alert("Error al cargar los movimientos");
    }
  }, [filtroDeposito, filtroTipo, filtroDesde, filtroHasta]);

  const cargarReportes = useCallback(async () => {
    try {
      const [neg, val, cos] = await Promise.all([
        getReporteStockNegativo(),
        getReporteValorizacion(),
        getReporteCostos(),
      ]);
      setNegativos(neg.rows);
      setValorizacion(val);
      setCostos(
        cos.map((c) => ({
          ...c,
          costoActual: c.costoActual ?? c.costoUnitario,
          costoAnterior: c.costoAnterior ?? null,
          variacion: c.variacion ?? null,
          registros: c.registros ?? 0,
        })),
      );
    } catch (err) {
      console.error(err);
      alert("Error al cargar los reportes");
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setLoading(true);
      await cargarBase();
      if (vivo) setLoading(false);
    })();
    return () => {
      vivo = false;
    };
  }, [cargarBase]);

  useEffect(() => {
    if (loading) return;
    if (tab === "existencias") cargarExistencias();
    if (tab === "movimientos") cargarMovimientos();
    if (tab === "reportes") cargarReportes();
  }, [tab, loading, cargarExistencias, cargarMovimientos, cargarReportes]);

  async function refrescarTodo() {
    await cargarBase();
    if (tab === "existencias") await cargarExistencias();
    if (tab === "movimientos") await cargarMovimientos();
    if (tab === "reportes") await cargarReportes();
  }

  async function confirmarEliminar() {
    if (!eliminando) return;
    try {
      if (eliminando.tipo === "articulo") await deleteArticulo(eliminando.item.id);
      else await deleteDeposito(eliminando.item.id);
      setEliminando(null);
      await refrescarTodo();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  const articulosFiltrados = articulos.filter((a) => {
    const q = busqueda.toLowerCase();
    return !q || a.nombre.toLowerCase().includes(q) || (a.codigo ?? "").toLowerCase().includes(q);
  });

  const summary = [
    { label: "Valor en Stock", value: formatMonto(valorTotal), color: "#0ea5e9" },
    { label: "Artículos con Stock", value: String(existencias.length), color: "#10b981" },
    { label: "Depósitos", value: String(depositos.length), color: "#7c3aed" },
    {
      label: "Con Stock Negativo",
      value: String(conNegativo),
      color: conNegativo > 0 ? "#ef4444" : "#94a3b8",
    },
  ];

  const inputCls =
    "bg-white font-['Geist:Regular',sans-serif] text-[14px] text-[#475569] px-[12px] py-[9px] rounded-[8px] outline-none cursor-pointer";
  const thCls =
    "text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] px-[20px] py-[14px]";

  return (
    <AppLayout
      breadcrumbs={[{ label: "Inicio", onClick: () => navigate("/") }, { label: "Stock" }]}
    >
      <div className="p-[32px] flex flex-col gap-[24px]">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[24px]">
              Stock
            </p>
            <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[14px] mt-[4px]">
              Artículos, depósitos, existencias valorizadas y control de inventario
            </p>
          </div>
          <div className="flex items-center gap-[12px]">
            <button
              onClick={() => setModalMovimiento("ingreso")}
              className="flex items-center gap-[8px] font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-[#0ea5e9] border border-[#0ea5e9] hover:bg-[#f0f9ff] transition-colors px-[16px] py-[10px] rounded-[8px]"
            >
              <IconPlus color="#0ea5e9" />
              Ingreso Inicial
            </button>
            <button
              onClick={() => setModalMovimiento("ajuste")}
              className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-[#475569] border border-[#e2e8f0] hover:bg-[#f8fafc] transition-colors px-[16px] py-[10px] rounded-[8px]"
            >
              Ajuste de Inventario
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-[4px] border-b border-[#e2e8f0]">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`font-['Geist:Medium',sans-serif] text-[14px] px-[16px] py-[10px] border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-[#0ea5e9] text-[#0ea5e9] font-['Geist:SemiBold',sans-serif] font-semibold"
                  : "border-transparent text-[#475569] hover:text-[#0f172a]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-[16px]">
          {summary.map((s, i) => (
            <div
              key={i}
              className="bg-white p-[20px] rounded-[12px]"
              style={{ border: "1px solid #e2e8f0" }}
            >
              <p className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[13px]">
                {s.label}
              </p>
              <p
                className="font-['Geist:Bold',sans-serif] font-bold text-[24px] mt-[6px]"
                style={{ color: s.color }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {loading ? (
          <div
            className="bg-white rounded-[12px] p-[40px] text-center"
            style={{ border: "1px solid #e2e8f0" }}
          >
            <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
              Cargando stock...
            </p>
          </div>
        ) : (
          <>
            {/* ===== EXISTENCIAS ===== */}
            {tab === "existencias" && (
              <>
                <div className="flex items-center gap-[12px]">
                  <select
                    value={filtroDeposito}
                    onChange={(e) => setFiltroDeposito(e.target.value)}
                    className={inputCls}
                    style={{ border: "1px solid #e2e8f0" }}
                  >
                    <option value="">Depósito: Todos</option>
                    {depositos.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  className="bg-white rounded-[12px] overflow-hidden"
                  style={{ border: "1px solid #e2e8f0" }}
                >
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        {[
                          "Depósito",
                          "Artículo",
                          "Código",
                          "Cantidad",
                          "Unidad",
                          "Costo Prom.",
                          "Valor",
                        ].map((h) => (
                          <th key={h} className={thCls}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {existencias.map((e, i) => (
                        <tr
                          key={e.id}
                          className="hover:bg-[#f8fafc] transition-colors"
                          style={{
                            borderBottom: i < existencias.length - 1 ? "1px solid #f1f5f9" : "none",
                          }}
                        >
                          <td className="px-[20px] py-[14px] font-['Geist:Medium',sans-serif] text-[#475569] text-[14px]">
                            {e.depositoNombre}
                          </td>
                          <td className="px-[20px] py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                            {e.articuloNombre}
                          </td>
                          <td className="px-[20px] py-[14px] font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px]">
                            {e.codigo || "—"}
                          </td>
                          <td className="px-[20px] py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[14px]">
                            <span style={{ color: e.cantidad < 0 ? "#ef4444" : "#0f172a" }}>
                              {e.cantidad.toLocaleString("es-AR")}
                            </span>
                          </td>
                          <td className="px-[20px] py-[14px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                            {e.unidad}
                          </td>
                          <td className="px-[20px] py-[14px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                            {formatMonto(e.costoPromedio)}
                          </td>
                          <td className="px-[20px] py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[14px]">
                            <span style={{ color: e.valor < 0 ? "#ef4444" : "#0f172a" }}>
                              {formatMonto(e.valor)}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {existencias.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-[20px] py-[32px] text-center">
                            <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
                              No hay existencias registradas. Cargá un ingreso inicial para empezar.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ===== ARTÍCULOS ===== */}
            {tab === "articulos" && (
              <>
                <div className="flex items-center gap-[12px]">
                  <div
                    className="flex-1 flex items-center gap-[8px] bg-white px-[12px] py-[9px] rounded-[8px]"
                    style={{ border: "1px solid #e2e8f0" }}
                  >
                    <IconSearch color="#94a3b8" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre o código..."
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      className="flex-1 font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] outline-none placeholder:text-[#94a3b8] bg-transparent"
                    />
                  </div>
                  <button
                    onClick={() => setModalArticulo({ open: true })}
                    className="flex items-center gap-[8px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] px-[16px] py-[10px] rounded-[8px]"
                  >
                    <IconPlus />
                    Nuevo Artículo
                  </button>
                </div>

                <div
                  className="bg-white rounded-[12px] overflow-hidden"
                  style={{ border: "1px solid #e2e8f0" }}
                >
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        {["Código", "Nombre", "Unidad", "Costo", "Depósitos", ""].map((h) => (
                          <th key={h} className={thCls}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {articulosFiltrados.map((a, i) => (
                        <tr
                          key={a.id}
                          className="group hover:bg-[#f8fafc] transition-colors"
                          style={{
                            borderBottom:
                              i < articulosFiltrados.length - 1 ? "1px solid #f1f5f9" : "none",
                          }}
                        >
                          <td className="px-[20px] py-[14px] font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px]">
                            {a.codigo || "—"}
                          </td>
                          <td className="px-[20px] py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                            {a.nombre}
                          </td>
                          <td className="px-[20px] py-[14px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                            {a.unidad}
                          </td>
                          <td className="px-[20px] py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                            {formatMonto(a.costoUnitario)}
                          </td>
                          <td className="px-[20px] py-[14px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                            {a.depositos ?? 0}
                          </td>
                          <td className="px-[20px] py-[14px]">
                            <div className="flex items-center gap-[4px] opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setModalHistorial(a.id)}
                                className="size-[26px] flex items-center justify-center rounded-[6px] hover:bg-[#f1f5f9] transition-colors"
                                title="Histórico de costos"
                              >
                                <svg fill="none" height="13" viewBox="0 0 16 16" width="13">
                                  <path
                                    d="M1.5 11.5L5.5 7.5L8.5 10.5L14.5 4.5M14.5 4.5H10.5M14.5 4.5V8.5"
                                    stroke="#64748b"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="1.5"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() => setModalArticulo({ open: true, item: a })}
                                className="size-[26px] flex items-center justify-center rounded-[6px] hover:bg-[#f1f5f9] transition-colors"
                                title="Editar"
                              >
                                <svg fill="none" height="13" viewBox="0 0 16 16" width="13">
                                  <path
                                    d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z"
                                    stroke="#64748b"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="1.5"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() => setEliminando({ tipo: "articulo", item: a })}
                                className="size-[26px] flex items-center justify-center rounded-[6px] hover:bg-[#fee2e2] transition-colors"
                                title="Eliminar"
                              >
                                <svg fill="none" height="13" viewBox="0 0 16 16" width="13">
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
                      {articulosFiltrados.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-[20px] py-[32px] text-center">
                            <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
                              No hay artículos. Pre-registralos para poder recibir mercadería.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ===== DEPÓSITOS ===== */}
            {tab === "depositos" && (
              <>
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => setModalDeposito({ open: true })}
                    className="flex items-center gap-[8px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] px-[16px] py-[10px] rounded-[8px]"
                  >
                    <IconPlus />
                    Nuevo Depósito
                  </button>
                </div>

                <div
                  className="bg-white rounded-[12px] overflow-hidden"
                  style={{ border: "1px solid #e2e8f0" }}
                >
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        {["Nombre", "Dirección", "Artículos", "Estado", ""].map((h) => (
                          <th key={h} className={thCls}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {depositos.map((d, i) => (
                        <tr
                          key={d.id}
                          className="group hover:bg-[#f8fafc] transition-colors"
                          style={{
                            borderBottom: i < depositos.length - 1 ? "1px solid #f1f5f9" : "none",
                          }}
                        >
                          <td className="px-[20px] py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                            {d.nombre}
                          </td>
                          <td className="px-[20px] py-[14px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                            {d.direccion || "—"}
                          </td>
                          <td className="px-[20px] py-[14px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                            {d.articulosConStock ?? 0}
                          </td>
                          <td className="px-[20px] py-[14px]">
                            <span
                              className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[8px] py-[3px] rounded-[6px]"
                              style={depEstadoStyle[d.activo ? "activo" : "inactivo"]}
                            >
                              {d.activo ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td className="px-[20px] py-[14px]">
                            <div className="flex items-center gap-[4px] opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setModalDeposito({ open: true, item: d })}
                                className="size-[26px] flex items-center justify-center rounded-[6px] hover:bg-[#f1f5f9] transition-colors"
                                title="Editar"
                              >
                                <svg fill="none" height="13" viewBox="0 0 16 16" width="13">
                                  <path
                                    d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z"
                                    stroke="#64748b"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="1.5"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() => setEliminando({ tipo: "deposito", item: d })}
                                className="size-[26px] flex items-center justify-center rounded-[6px] hover:bg-[#fee2e2] transition-colors"
                                title="Eliminar"
                              >
                                <svg fill="none" height="13" viewBox="0 0 16 16" width="13">
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
                      {depositos.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-[20px] py-[32px] text-center">
                            <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
                              Todavía no hay depósitos cargados.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ===== MOVIMIENTOS ===== */}
            {tab === "movimientos" && (
              <>
                <div className="flex items-center gap-[12px] flex-wrap">
                  <input
                    type="date"
                    value={filtroDesde}
                    onChange={(e) => setFiltroDesde(e.target.value)}
                    className={inputCls}
                    style={{ border: "1px solid #e2e8f0" }}
                  />
                  <input
                    type="date"
                    value={filtroHasta}
                    onChange={(e) => setFiltroHasta(e.target.value)}
                    className={inputCls}
                    style={{ border: "1px solid #e2e8f0" }}
                  />
                  <select
                    value={filtroDeposito}
                    onChange={(e) => setFiltroDeposito(e.target.value)}
                    className={inputCls}
                    style={{ border: "1px solid #e2e8f0" }}
                  >
                    <option value="">Depósito: Todos</option>
                    {depositos.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filtroTipo}
                    onChange={(e) => setFiltroTipo(e.target.value)}
                    className={inputCls}
                    style={{ border: "1px solid #e2e8f0" }}
                  >
                    <option value="">Tipo: Todos</option>
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="ajuste">Ajuste</option>
                  </select>
                </div>

                <div
                  className="bg-white rounded-[12px] overflow-hidden"
                  style={{ border: "1px solid #e2e8f0" }}
                >
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        {[
                          "Fecha",
                          "Tipo",
                          "Artículo",
                          "Depósitos",
                          "Cantidad",
                          "Costo",
                          "Valor",
                          "Detalle",
                        ].map((h) => (
                          <th key={h} className={thCls}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.map((m, i) => (
                        <tr
                          key={m.id}
                          className="hover:bg-[#f8fafc] transition-colors"
                          style={{
                            borderBottom: i < movimientos.length - 1 ? "1px solid #f1f5f9" : "none",
                          }}
                        >
                          <td className="px-[20px] py-[14px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                            {formatFecha(m.fecha)}
                          </td>
                          <td className="px-[20px] py-[14px]">
                            <span
                              className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[8px] py-[3px] rounded-[6px] capitalize"
                              style={tipoStyle[m.tipo] ?? { bg: "#e2e8f0", color: "#64748b" }}
                            >
                              {m.tipo}
                            </span>
                          </td>
                          <td className="px-[20px] py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                            {m.articuloNombre}
                          </td>
                          <td className="px-[20px] py-[14px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                            {m.depositoOrigen && m.depositoDestino
                              ? `${m.depositoOrigen} → ${m.depositoDestino}`
                              : (m.depositoDestino ?? m.depositoOrigen ?? "—")}
                          </td>
                          <td className="px-[20px] py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[14px]">
                            <span style={{ color: m.cantidad < 0 ? "#ef4444" : "#0f172a" }}>
                              {m.cantidad > 0 && m.tipo === "egreso" ? "-" : ""}
                              {Math.abs(m.cantidad).toLocaleString("es-AR")}
                            </span>
                          </td>
                          <td className="px-[20px] py-[14px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                            {formatMonto(m.costoUnitario)}
                          </td>
                          <td className="px-[20px] py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[14px]">
                            {formatMonto(Math.abs(m.valor))}
                          </td>
                          <td className="px-[20px] py-[14px] font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px]">
                            {m.motivo || m.referenciaTipo || "—"}
                          </td>
                        </tr>
                      ))}
                      {movimientos.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-[20px] py-[32px] text-center">
                            <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
                              No hay movimientos con los filtros seleccionados.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ===== REPORTES ===== */}
            {tab === "reportes" && (
              <div className="flex flex-col gap-[32px]">
                {/* Stock negativo */}
                <div>
                  <div className="flex items-center justify-between mb-[12px]">
                    <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px]">
                      Stock Negativo
                    </p>
                    <span
                      className="font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] px-[10px] py-[4px] rounded-[6px]"
                      style={negativoStyle[negativos.length > 0 ? "alerta" : "ok"]}
                    >
                      {negativos.length > 0
                        ? `${negativos.length} artículo(s) en negativo`
                        : "Sin faltantes"}
                    </span>
                  </div>
                  <div
                    className="bg-white rounded-[12px] overflow-hidden"
                    style={{ border: "1px solid #e2e8f0" }}
                  >
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                          {["Depósito", "Artículo", "Faltante", "Valor", "Último movimiento"].map(
                            (h) => (
                              <th key={h} className={thCls}>
                                {h}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {negativos.map((n, i) => (
                          <tr
                            key={n.id}
                            style={{
                              borderBottom: i < negativos.length - 1 ? "1px solid #f1f5f9" : "none",
                            }}
                          >
                            <td className="px-[20px] py-[14px] font-['Geist:Medium',sans-serif] text-[#475569] text-[14px]">
                              {n.depositoNombre}
                            </td>
                            <td className="px-[20px] py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                              {n.articuloNombre}
                            </td>
                            <td className="px-[20px] py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-[#ef4444]">
                              {n.cantidad.toLocaleString("es-AR")} {n.unidad}
                            </td>
                            <td className="px-[20px] py-[14px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                              {formatMonto(n.valor)}
                            </td>
                            <td className="px-[20px] py-[14px] font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px]">
                              —
                            </td>
                          </tr>
                        ))}
                        {negativos.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-[20px] py-[24px] text-center">
                              <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
                                Ningún depósito tiene stock negativo.
                              </p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Valorización */}
                <div>
                  <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px] mb-[12px]">
                    Valorización de Existencias
                  </p>
                  <div className="grid grid-cols-3 gap-[16px] mb-[16px]">
                    {(valorizacion?.resumen ?? []).map((r) => (
                      <div
                        key={r.depositoId}
                        className="bg-white p-[20px] rounded-[12px]"
                        style={{ border: "1px solid #e2e8f0" }}
                      >
                        <p className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[13px]">
                          {r.depositoNombre}
                        </p>
                        <p className="font-['Geist:Bold',sans-serif] font-bold text-[20px] text-[#0f172a] mt-[6px]">
                          {formatMonto(r.valor)}
                        </p>
                        <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px]">
                          {r.articulos} artículo(s)
                        </p>
                      </div>
                    ))}
                  </div>
                  <div
                    className="bg-white rounded-[12px] overflow-hidden"
                    style={{ border: "1px solid #e2e8f0" }}
                  >
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                          {["Depósito", "Artículo", "Cantidad", "Costo Prom.", "Valor"].map((h) => (
                            <th key={h} className={thCls}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(valorizacion?.rows ?? []).map((r, i) => (
                          <tr
                            key={`${r.depositoId}-${r.articuloId}`}
                            style={{
                              borderBottom:
                                i < (valorizacion?.rows.length ?? 0) - 1
                                  ? "1px solid #f1f5f9"
                                  : "none",
                            }}
                          >
                            <td className="px-[20px] py-[14px] font-['Geist:Medium',sans-serif] text-[#475569] text-[14px]">
                              {r.depositoNombre}
                            </td>
                            <td className="px-[20px] py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                              {r.articuloNombre}
                            </td>
                            <td className="px-[20px] py-[14px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                              {r.cantidad.toLocaleString("es-AR")} {r.unidad}
                            </td>
                            <td className="px-[20px] py-[14px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                              {formatMonto(r.costoPromedio)}
                            </td>
                            <td className="px-[20px] py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                              {formatMonto(r.valor)}
                            </td>
                          </tr>
                        ))}
                        {(valorizacion?.rows.length ?? 0) === 0 && (
                          <tr>
                            <td colSpan={5} className="px-[20px] py-[24px] text-center">
                              <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
                                Sin existencias para valorizar.
                              </p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    <div
                      className="flex items-center justify-end px-[20px] py-[14px] gap-[8px]"
                      style={{ borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}
                    >
                      <span className="font-['Geist:Medium',sans-serif] text-[#475569] text-[14px]">
                        Total
                      </span>
                      <span className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">
                        {formatMonto(valorizacion?.total ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Evolución de costos */}
                <div>
                  <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px] mb-[12px]">
                    Evolución de Costos
                  </p>
                  <div
                    className="bg-white rounded-[12px] overflow-hidden"
                    style={{ border: "1px solid #e2e8f0" }}
                  >
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                          {[
                            "Artículo",
                            "Costo Actual",
                            "Costo Anterior",
                            "Variación",
                            "Registros",
                          ].map((h) => (
                            <th key={h} className={thCls}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {costos.map((c, i) => (
                          <tr
                            key={c.id}
                            className="group hover:bg-[#f8fafc] transition-colors cursor-pointer"
                            onClick={() => setModalHistorial(c.id)}
                            style={{
                              borderBottom: i < costos.length - 1 ? "1px solid #f1f5f9" : "none",
                            }}
                          >
                            <td className="px-[20px] py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                              {c.nombre}
                            </td>
                            <td className="px-[20px] py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                              {formatMonto(c.costoActual)}
                            </td>
                            <td className="px-[20px] py-[14px] font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
                              {c.costoAnterior === null ? "—" : formatMonto(c.costoAnterior)}
                            </td>
                            <td className="px-[20px] py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[14px]">
                              {c.variacion === null ? (
                                <span className="text-[#94a3b8]">—</span>
                              ) : (
                                <span
                                  style={{
                                    color:
                                      c.variacion > 0
                                        ? "#ef4444"
                                        : c.variacion < 0
                                          ? "#10b981"
                                          : "#64748b",
                                  }}
                                >
                                  {c.variacion}%
                                </span>
                              )}
                            </td>
                            <td className="px-[20px] py-[14px] font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
                              {c.registros}
                            </td>
                          </tr>
                        ))}
                        {costos.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-[20px] py-[24px] text-center">
                              <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
                                Sin artículos cargados.
                              </p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {modalDeposito.open && (
        <DepositoFormModal
          deposito={modalDeposito.item}
          onClose={() => setModalDeposito({ open: false })}
          onSaved={() => {
            setModalDeposito({ open: false });
            refrescarTodo();
          }}
        />
      )}

      {modalArticulo.open && (
        <ArticuloFormModal
          articulo={modalArticulo.item}
          onClose={() => setModalArticulo({ open: false })}
          onSaved={() => {
            setModalArticulo({ open: false });
            refrescarTodo();
          }}
        />
      )}

      {modalHistorial && (
        <HistorialCostosModal articuloId={modalHistorial} onClose={() => setModalHistorial(null)} />
      )}

      {modalMovimiento && depositos.length > 0 && (
        <MovimientoStockModal
          tipo={modalMovimiento}
          depositos={depositos}
          articulos={articulos}
          onClose={() => setModalMovimiento(null)}
          onSaved={() => {
            setModalMovimiento(null);
            refrescarTodo();
          }}
        />
      )}

      {eliminando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEliminando(null)} />
          <div
            className="relative bg-white rounded-[16px] w-[420px] p-[24px]"
            style={{ border: "1px solid #e2e8f0" }}
          >
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">
              Eliminar {eliminando.tipo === "articulo" ? "artículo" : "depósito"}
            </p>
            <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px] mt-[8px]">
              ¿Seguro que querés eliminar{" "}
              <span className="font-['Geist:SemiBold',sans-serif] font-semibold">
                {"nombre" in eliminando.item
                  ? eliminando.item.nombre
                  : (eliminando.item as Articulo).nombre}
              </span>
              ? Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center justify-end gap-[12px] mt-[24px]">
              <button
                onClick={() => setEliminando(null)}
                className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEliminar}
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
