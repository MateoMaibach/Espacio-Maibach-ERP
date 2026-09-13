import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import { IconPlus, IconSearch } from "@/components/Icons";
import {
  getMovimientos, createMovimiento, updateMovimiento, deleteMovimiento,
  getResumenCaja, getCierres, getCierresPreview, realizarCierre,
  getCajas, createCaja, updateCaja, deleteCaja,
  type Movimiento, type ResumenCaja, type Cierre, type CajaItem,
} from "@/services/api";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DONUT_COLORS = ["#0ea5e9", "#f59e0b", "#10b981", "#7c3aed", "#ef4444", "#ec4899"];
const CATEGORIAS_POR_TIPO: Record<string, string[]> = {
  ingreso: ["Cobro cliente", "Seña", "Cobro cuota", "Devolución", "Transferencia recibida", "Otro"],
  egreso: ["Pago proveedor", "Logística", "Insumos", "Sueldos", "Alquiler", "Servicios", "Impuestos", "Otro"],
};

function formatCurrency(value: number): string {
  return `$${value.toLocaleString("es-AR")}`;
}

const SHORT_MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatFecha(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  const [y, mo, d] = [parts[0] || "", parts[1] || "", parts[2] || ""];
  return `${d} ${SHORT_MONTHS[parseInt(mo) - 1] || mo}, ${y}`;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getCurrentMonthYear() {
  const now = new Date();
  return { mes: now.getMonth() + 1, anio: now.getFullYear() };
}

interface MovimientoForm {
  fecha: string;
  concepto: string;
  monto: string;
  tipo: "ingreso" | "egreso";
  subCaja: string;
  moneda: string;
  tipoCambio: string;
  categoria: string;
  comprobante: string;
  observaciones: string;
}

const movimientoInicial: MovimientoForm = {
  fecha: "",
  concepto: "",
  monto: "",
  tipo: "ingreso",
  subCaja: "",
  moneda: "ARS",
  tipoCambio: "",
  categoria: "",
  comprobante: "",
  observaciones: "",
};

interface CierreForm {
  subCaja: string;
  saldoReal: string;
  observaciones: string;
  fecha: string;
}

interface CajaForm {
  nombre: string;
  color: string;
  orden: string;
}

const cajaInicial: CajaForm = { nombre: "", color: "#3b82f6", orden: "" };

interface ColFiltros {
  fecha: string;
  concepto: string;
  ingresoMin: string;
  ingresoMax: string;
  egresoMin: string;
  egresoMax: string;
}

const colFiltrosInit: ColFiltros = { fecha: "", concepto: "", ingresoMin: "", ingresoMax: "", egresoMin: "", egresoMax: "" };

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  if (total === 0) return <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px] text-center py-[20px]">Sin datos</p>;

  let cumulative = 0;
  const radius = 60;
  const cx = 80;
  const cy = 80;
  const strokeWidth = 22;

  const arcs = data.map((d) => {
    const pct = (d.value / total) * 100;
    const start = (cumulative / 100) * 2 * Math.PI - Math.PI / 2;
    cumulative += pct;
    const end = (cumulative / 100) * 2 * Math.PI - Math.PI / 2;
    const largeArc = pct > 50 ? 1 : 0;
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    return { ...d, pct, d: `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}` };
  });

  return (
    <div className="flex flex-col items-center gap-[16px]">
      <div className="relative">
        <svg width="160" height="160">
          {arcs.map((arc, i) => (
            <path key={i} d={arc.d} fill="none" stroke={arc.color} strokeWidth={strokeWidth} />
          ))}
          <text x={cx} y={cy - 6} textAnchor="middle" className="font-['Geist:Bold']" style={{ fontSize: 16, fontWeight: 700, fill: "#0f172a" }}>{formatCurrency(total)}</text>
        </svg>
      </div>
      <div className="flex flex-col gap-[6px]">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-[8px]">
            <div className="size-[10px] rounded-full" style={{ background: d.color }} />
            <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">{d.label} ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Caja() {
  const navigate = useNavigate();
  const { mes: currentMes, anio: currentAnio } = getCurrentMonthYear();
  const [mes, setMes] = useState(currentMes);
  const [anio, setAnio] = useState(currentAnio);

  const [cajas, setCajas] = useState<CajaItem[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [resumen, setResumen] = useState<ResumenCaja | null>(null);
  const [cierres, setCierres] = useState<Cierre[]>([]);
  const [loading, setLoading] = useState(true);

  const [filtroSubCaja, setFiltroSubCaja] = useState("Todas");
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [colFiltros, setColFiltros] = useState<ColFiltros>(colFiltrosInit);

  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [editingMovimiento, setEditingMovimiento] = useState<Movimiento | null>(null);
  const [form, setForm] = useState<MovimientoForm>(movimientoInicial);

  const [showCierreModal, setShowCierreModal] = useState(false);
  const [cierreForm, setCierreForm] = useState<CierreForm>({ subCaja: "", saldoReal: "", observaciones: "", fecha: toISODate(new Date()) });
  const [cierreLoading, setCierreLoading] = useState(false);
  const [cierrePreview, setCierrePreview] = useState<{ saldoInicial: number; saldoFinal: number; saldoEsperado: number } | null>(null);

  const [showCajasAdmin, setShowCajasAdmin] = useState(false);
  const [showCajaModal, setShowCajaModal] = useState(false);
  const [editingCaja, setEditingCaja] = useState<CajaItem | null>(null);
  const [cajaForm, setCajaForm] = useState<CajaForm>(cajaInicial);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteCajaConfirm, setDeleteCajaConfirm] = useState<string | null>(null);

  const cargarCajas = useCallback(async () => {
    try {
      const data = await getCajas();
      setCajas(data);
      return data;
    } catch (err) {
      console.error(err);
      return [];
    }
  }, []);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [movs, res, cie] = await Promise.all([
        getMovimientos(mes, anio, filtroSubCaja),
        getResumenCaja(mes, anio),
        getCierres(mes, anio),
      ]);
      setMovimientos(movs);
      setResumen(res);
      setCierres(cie);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [mes, anio, filtroSubCaja]);

  useEffect(() => { cargarCajas(); }, [cargarCajas]);
  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  useEffect(() => {
    if (showCierreModal && cierreForm.subCaja) {
      getCierresPreview(mes, anio, cierreForm.subCaja).then(setCierrePreview).catch(() => setCierrePreview(null));
    }
  }, [showCierreModal, cierreForm.subCaja, mes, anio]);

  const cajasActivas = cajas.filter((c) => c.activa === 1);
  const cajaNombres = cajasActivas.map((c) => c.nombre);
  const cajaGeneralMap: Record<string, number> = {};
  for (const c of cajasActivas) { cajaGeneralMap[c.nombre] = c.afectaGeneral; }
  const cajaColorMap: Record<string, string> = {};
  for (const c of cajasActivas) { cajaColorMap[c.nombre] = c.color; }

  function getColStyle(nombre: string): { bg: string; color: string } {
    const hex = cajaColorMap[nombre];
    if (!hex) return { bg: "#f1f5f9", color: "#475569" };
    return { bg: hex + "20", color: hex };
  }

  const movimientosFiltrados = movimientos.filter((m) => {
    const matchTipo = filtroTipo === "Todos" || m.tipo === (filtroTipo === "Ingresos" ? "ingreso" : "egreso");
    const matchColFecha = !colFiltros.fecha || m.fecha.toLowerCase().includes(colFiltros.fecha.toLowerCase());
    const matchColConcepto = !colFiltros.concepto || m.concepto.toLowerCase().includes(colFiltros.concepto.toLowerCase()) || m.categoria?.toLowerCase().includes(colFiltros.concepto.toLowerCase());
    const ingMin = Number(colFiltros.ingresoMin);
    const ingMax = Number(colFiltros.ingresoMax);
    const egrMin = Number(colFiltros.egresoMin);
    const egrMax = Number(colFiltros.egresoMax);
    const matchIngresoMin = isNaN(ingMin) || !colFiltros.ingresoMin || (m.tipo === "ingreso" && m.monto >= ingMin);
    const matchIngresoMax = isNaN(ingMax) || !colFiltros.ingresoMax || (m.tipo === "ingreso" && m.monto <= ingMax);
    const matchEgresoMin = isNaN(egrMin) || !colFiltros.egresoMin || (m.tipo === "egreso" && m.monto >= egrMin);
    const matchEgresoMax = isNaN(egrMax) || !colFiltros.egresoMax || (m.tipo === "egreso" && m.monto <= egrMax);
    return matchTipo && matchColFecha && matchColConcepto && matchIngresoMin && matchIngresoMax && matchEgresoMin && matchEgresoMax;
  });

  const subCajasData = (() => {
    if (filtroSubCaja !== "Todas") {
      const sc = resumen?.subCajas[filtroSubCaja];
      if (sc) {
        const col = cajaColorMap[filtroSubCaja] || "#0ea5e9";
        return [{ label: filtroSubCaja, value: sc.total, color: col }];
      }
      return [];
    }
    return Object.entries(resumen?.subCajas || {})
      .filter(([key]) => cajaGeneralMap[key] !== 0)
      .map(([key, val], i) => ({
        label: key,
        value: val.total,
        color: cajaColorMap[key] || (DONUT_COLORS[i % DONUT_COLORS.length] || "#94a3b8"),
      }));
  })();

  function handleNuevoMovimiento() {
    setEditingMovimiento(null);
    setForm({ ...movimientoInicial, subCaja: cajaNombres[0] || "Efectivo", fecha: toISODate(new Date()) });
    setShowMovimientoModal(true);
  }

  function handleEditarMovimiento(m: Movimiento) {
    setEditingMovimiento(m);
    setForm({
      fecha: m.fecha,
      concepto: m.concepto,
      monto: String(m.monto),
      tipo: m.tipo,
      subCaja: m.subCaja,
      moneda: m.moneda,
      tipoCambio: m.tipoCambio ? String(m.tipoCambio) : "",
      categoria: m.categoria || "",
      comprobante: m.comprobante || "",
      observaciones: m.observaciones || "",
    });
    setShowMovimientoModal(true);
  }

  async function handleGuardarMovimiento() {
    if (!form.concepto.trim()) { alert("El concepto es obligatorio"); return; }
    if (!form.monto || Number(form.monto) <= 0) { alert("El monto debe ser mayor a 0"); return; }
    const data = {
      fecha: form.fecha,
      concepto: form.concepto.trim(),
      monto: Math.round(Number(form.monto)),
      tipo: form.tipo,
      subCaja: form.subCaja,
      moneda: form.moneda,
      tipoCambio: form.tipoCambio ? Number(form.tipoCambio) : undefined,
      categoria: form.categoria || undefined,
      comprobante: form.comprobante || undefined,
      observaciones: form.observaciones || undefined,
    };
    try {
      if (editingMovimiento) { await updateMovimiento(editingMovimiento.id, data); }
      else { await createMovimiento(data); }
      setShowMovimientoModal(false);
      cargarDatos();
    } catch (err: any) { alert(err.message || "Error al guardar"); }
  }

  async function handleEliminarMovimiento(id: string) {
    try { await deleteMovimiento(id); setDeleteConfirm(null); cargarDatos(); }
    catch (err) { console.error(err); }
  }

  async function handleCerrarMes() {
    if (!cierreForm.saldoReal || Number(cierreForm.saldoReal) < 0) { alert("Ingresá un saldo real válido"); return; }
    setCierreLoading(true);
    try {
      await realizarCierre({ mes, anio, subCaja: cierreForm.subCaja, saldoReal: Math.round(Number(cierreForm.saldoReal)), observaciones: cierreForm.observaciones || undefined, fecha: cierreForm.fecha || undefined });
      setShowCierreModal(false);
      setCierreForm({ subCaja: cajaNombres[0] || "Efectivo", saldoReal: "", observaciones: "", fecha: toISODate(new Date()) });
      setCierrePreview(null);
      cargarDatos();
    } catch (err: any) { alert(err.message || "Error al cerrar"); }
    finally { setCierreLoading(false); }
  }

  function handleCrearCaja() {
    setEditingCaja(null);
    setCajaForm({ nombre: "", color: "#3b82f6", orden: String(cajas.length + 1) });
    setShowCajaModal(true);
  }

  function handleEditarCaja(c: CajaItem) {
    setEditingCaja(c);
    setCajaForm({ nombre: c.nombre, color: c.color, orden: String(c.orden) });
    setShowCajaModal(true);
  }

  async function handleGuardarCaja() {
    if (!cajaForm.nombre.trim()) { alert("El nombre es obligatorio"); return; }
    try {
      if (editingCaja) {
        await updateCaja(editingCaja.id, { nombre: cajaForm.nombre.trim(), color: cajaForm.color, orden: Number(cajaForm.orden) || 0 });
      } else {
        await createCaja({ nombre: cajaForm.nombre.trim(), color: cajaForm.color, orden: Number(cajaForm.orden) || undefined });
      }
      setShowCajaModal(false);
      const newCajas = await cargarCajas();
      if (newCajas.length > 0 && !editingMovimiento) {
        setForm((p) => ({ ...p, subCaja: p.subCaja || newCajas[0]?.nombre || "Efectivo" }));
      }
      cargarDatos();
    } catch (err: any) { alert(err.message || "Error al guardar caja"); }
  }

  async function handleEliminarCaja(id: string) {
    try { await deleteCaja(id); setDeleteCajaConfirm(null); cargarCajas(); cargarDatos(); }
    catch (err: any) { alert(err.message || "Error al eliminar caja"); }
  }

  function handleMesAnterior() {
    if (mes === 1) { setMes(12); setAnio(anio - 1); }
    else { setMes(mes - 1); }
  }

  function handleMesSiguiente() {
    if (mes === 12) { setMes(1); setAnio(anio + 1); }
    else { setMes(mes + 1); }
  }

  function limpiarColFiltros() {
    setColFiltros(colFiltrosInit);
    setFiltroTipo("Todos");
    setFiltroSubCaja("Todas");
  }

  const subCajasResumen = resumen ? Object.entries(resumen.subCajas) : [];
  const hayColFiltros = colFiltros.fecha || colFiltros.concepto || colFiltros.ingresoMin || colFiltros.ingresoMax || colFiltros.egresoMin || colFiltros.egresoMax || filtroTipo !== "Todos" || filtroSubCaja !== "Todas";

  return (
    <AppLayout breadcrumbs={[{ label: "Inicio", onClick: () => navigate("/") }, { label: "Caja" }]}>
      <div className="p-[32px] flex flex-col gap-[24px]">
        {/* Title Row */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[24px]">Caja</p>
            <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[14px] mt-[4px]">Administración de flujos de caja y libro diario</p>
          </div>
          <div className="flex items-center gap-[12px]">
            <div className="flex items-center gap-[8px] bg-white px-[12px] py-[8px] rounded-[8px]" style={{ border: "1px solid #e2e8f0" }}>
              <button onClick={handleMesAnterior} className="text-[#475569] hover:text-[#0f172a] transition-colors p-[2px]">
                <svg fill="none" height="16" viewBox="0 0 16 16" width="16"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <p className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[14px] min-w-[120px] text-center">{MESES[mes - 1]} {anio}</p>
              <button onClick={handleMesSiguiente} className="text-[#475569] hover:text-[#0f172a] transition-colors p-[2px]">
                <svg fill="none" height="16" viewBox="0 0 16 16" width="16"><path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
            <button onClick={() => setShowCajasAdmin(!showCajasAdmin)} className={`font-['Geist:Medium',sans-serif] font-medium text-[13px] px-[14px] py-[10px] rounded-[8px] transition-colors border ${showCajasAdmin ? "bg-[#0f172a] text-white border-[#0f172a]" : "bg-white text-[#475569] border-[#e2e8f0] hover:bg-[#f8fafc]"}`}>
              Gestionar Cajas
            </button>
            <button onClick={handleNuevoMovimiento} className="flex items-center gap-[8px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] px-[16px] py-[10px] rounded-[8px]">
              <IconPlus /> Nuevo Movimiento
            </button>
          </div>
        </div>

        {/* Cajas Admin Section */}
        {showCajasAdmin && (
          <div className="bg-white p-[20px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between mb-[16px]">
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">Gestionar Cajas</p>
              <button onClick={handleCrearCaja} className="flex items-center gap-[6px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] px-[12px] py-[8px] rounded-[8px]">
                <IconPlus /> Nueva Caja
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  {["Color", "Nombre", "Orden", "Estado", ""].map((h) => (
                    <th key={h} className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] py-[8px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cajas.map((c) => (
                  <tr key={c.id} className="group hover:bg-[#f8fafc] transition-colors" style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td className="py-[12px]"><div className="size-[24px] rounded-[6px]" style={{ background: c.color }} /></td>
                    <td className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[14px] py-[12px]">{c.nombre}</td>
                    <td className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px] py-[12px]">{c.orden}</td>
                    <td className="py-[12px]">
                      <span className={`font-['Geist:SemiBold',sans-serif] font-semibold text-[11px] px-[8px] py-[3px] rounded-[6px] ${c.activa ? "bg-[#d1fae5] text-[#10b981]" : "bg-[#f1f5f9] text-[#94a3b8]"}`}>
                        {c.activa ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="py-[12px]">
                      <div className="flex items-center gap-[4px]">
                        <button onClick={() => handleEditarCaja(c)} className="p-[4px] rounded-[4px] hover:bg-[#e2e8f0] transition-colors" title="Editar">
                          <svg fill="none" height="14" viewBox="0 0 14 14" width="14"><path d="M10.5 1.5L12.5 3.5L4 12H2V10L10.5 1.5Z" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                        <button onClick={() => updateCaja(c.id, { activa: c.activa ? 0 : 1 }).then(() => { cargarCajas(); cargarDatos(); })} className="p-[4px] rounded-[4px] hover:bg-[#f1f5f9] transition-colors" title={c.activa ? "Desactivar" : "Activar"}>
                          <svg fill="none" height="14" viewBox="0 0 14 14" width="14"><circle cx="7" cy="7" r="5" stroke={c.activa ? "#10b981" : "#94a3b8"} strokeWidth="1.2" /><path d={c.activa ? "M4 7L6 9L10 5" : "M4 7H10"} stroke={c.activa ? "#10b981" : "#94a3b8"} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                        <button onClick={() => setDeleteCajaConfirm(c.id)} className="p-[4px] rounded-[4px] hover:bg-[#fee2e2] transition-colors" title="Eliminar">
                          <svg fill="none" height="14" viewBox="0 0 14 14" width="14"><path d="M2 4H12M5 4V2H9V4M6 6.5V10.5M8 6.5V10.5M3 4L4 12H10L11 4" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-[20px]">
          {subCajasResumen.map(([key, val]) => {
            const isSelected = filtroSubCaja === key;
            const col = cajaColorMap[key] || "#475569";
            return (
              <div
                key={key}
                onClick={() => setFiltroSubCaja(isSelected ? "Todas" : key)}
                className="bg-white flex items-center justify-between p-[20px] rounded-[12px] cursor-pointer transition-all hover:shadow-md"
                style={{ border: isSelected ? `2px solid ${col}` : "1px solid #e2e8f0" }}
              >
                <div>
                  <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">{key}</p>
                  <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[22px] mt-[4px]">{formatCurrency(val.total)}</p>
                </div>
                <div className="flex items-center justify-center size-[40px] rounded-[8px]" style={{ background: getColStyle(key).bg }}>
                  <div className="size-[20px]" style={{ color: getColStyle(key).color }}>
                    <svg fill="none" height="20" viewBox="0 0 20 20" width="20"><rect x="2" y="4" width="16" height="13" rx="2" stroke={getColStyle(key).color} strokeWidth="1.5" /><path d="M2 8H18" stroke={getColStyle(key).color} strokeWidth="1.5" /></svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-[12px]">
          <div className="flex-1 flex items-center gap-[8px] bg-white px-[12px] py-[9px] rounded-[8px]" style={{ border: "1px solid #e2e8f0" }}>
            <IconSearch color="#94a3b8" />
            <input type="text" placeholder="Buscar..." value={colFiltros.concepto} onChange={(e) => setColFiltros((p) => ({ ...p, concepto: e.target.value }))} className="flex-1 font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] outline-none placeholder:text-[#94a3b8] bg-transparent" />
          </div>
          <select value={filtroSubCaja} onChange={(e) => setFiltroSubCaja(e.target.value)} className="bg-white font-['Geist:Regular',sans-serif] text-[14px] text-[#475569] px-[12px] py-[9px] rounded-[8px] outline-none cursor-pointer" style={{ border: "1px solid #e2e8f0" }}>
            {["Todas", ...cajaNombres].map((sc) => <option key={sc} value={sc}>Sub-Caja: {sc}</option>)}
          </select>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="bg-white font-['Geist:Regular',sans-serif] text-[14px] text-[#475569] px-[12px] py-[9px] rounded-[8px] outline-none cursor-pointer" style={{ border: "1px solid #e2e8f0" }}>
            {["Todos", "Ingresos", "Egresos"].map((t) => <option key={t} value={t}>Tipo: {t}</option>)}
          </select>
          {hayColFiltros && (
            <button onClick={limpiarColFiltros} className="font-['Geist:Medium',sans-serif] font-medium text-[13px] text-[#ef4444] hover:bg-[#fef2f2] px-[12px] py-[9px] rounded-[8px] border border-[#ef4444] transition-colors">Limpiar filtros</button>
          )}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-[1fr_300px] gap-[24px]">
          {/* Libro Diario */}
          <div className="bg-white p-[20px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between mb-[12px]">
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">Libro Diario</p>
              <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">{movimientosFiltrados.length} movimiento{movimientosFiltrados.length !== 1 ? "s" : ""}</p>
            </div>
            {loading ? (
              <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px] py-[20px] text-center">Cargando...</p>
            ) : movimientosFiltrados.length === 0 ? (
              <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px] py-[20px] text-center">No hay movimientos para este período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <th className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] py-[8px]">
                        <div className="flex flex-col gap-[4px]">
                          <span>Fecha</span>
                          <input type="date" value={colFiltros.fecha} onChange={(e) => setColFiltros((p) => ({ ...p, fecha: e.target.value }))} className="font-['Geist:Regular',sans-serif] text-[11px] text-[#0f172a] px-[6px] py-[3px] rounded-[4px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] bg-white w-[130px]" />
                        </div>
                      </th>
                      <th className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] py-[8px]">
                        <div className="flex flex-col gap-[4px]">
                          <span>Concepto</span>
                          <input type="text" placeholder="Filtrar..." value={colFiltros.concepto} onChange={(e) => setColFiltros((p) => ({ ...p, concepto: e.target.value }))} className="font-['Geist:Regular',sans-serif] text-[11px] text-[#0f172a] px-[6px] py-[3px] rounded-[4px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] bg-white w-[120px]" />
                        </div>
                      </th>
                      <th className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] py-[8px]">
                        <div className="flex flex-col gap-[4px]">
                          <span>Ingreso</span>
                          <div className="flex gap-[2px]">
                            <input type="number" placeholder="Min" value={colFiltros.ingresoMin} onChange={(e) => setColFiltros((p) => ({ ...p, ingresoMin: e.target.value }))} className="font-['Geist:Regular',sans-serif] text-[10px] text-[#0f172a] px-[4px] py-[2px] rounded-[4px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] bg-white w-[50px]" />
                            <input type="number" placeholder="Max" value={colFiltros.ingresoMax} onChange={(e) => setColFiltros((p) => ({ ...p, ingresoMax: e.target.value }))} className="font-['Geist:Regular',sans-serif] text-[10px] text-[#0f172a] px-[4px] py-[2px] rounded-[4px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] bg-white w-[50px]" />
                          </div>
                        </div>
                      </th>
                      <th className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] py-[8px]">
                        <div className="flex flex-col gap-[4px]">
                          <span>Egreso</span>
                          <div className="flex gap-[2px]">
                            <input type="number" placeholder="Min" value={colFiltros.egresoMin} onChange={(e) => setColFiltros((p) => ({ ...p, egresoMin: e.target.value }))} className="font-['Geist:Regular',sans-serif] text-[10px] text-[#0f172a] px-[4px] py-[2px] rounded-[4px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] bg-white w-[50px]" />
                            <input type="number" placeholder="Max" value={colFiltros.egresoMax} onChange={(e) => setColFiltros((p) => ({ ...p, egresoMax: e.target.value }))} className="font-['Geist:Regular',sans-serif] text-[10px] text-[#0f172a] px-[4px] py-[2px] rounded-[4px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] bg-white w-[50px]" />
                          </div>
                        </div>
                      </th>
                      <th className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] py-[8px]">Saldo</th>
                      <th className="py-[8px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientosFiltrados.map((m) => {
                      const scStyle = getColStyle(m.subCaja);
                      return (
                        <tr key={m.id} className="group hover:bg-[#f8fafc] transition-colors" style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px] py-[12px]">{formatFecha(m.fecha)}</td>
                          <td className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[13px] py-[12px]">
                            <div className="flex flex-col">
                              <span>{m.concepto}</span>
                              {m.categoria && <span className="font-['Geist:Regular',sans-serif] font-normal text-[#94a3b8] text-[11px]">{m.categoria}</span>}
                            </div>
                          </td>
                          <td className="py-[12px]">
                            <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[11px] px-[8px] py-[3px] rounded-[6px]" style={{ background: scStyle.bg, color: scStyle.color }}>{m.subCaja}</span>
                          </td>
                          <td className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#10b981] text-[13px] py-[12px]">
                            {m.tipo === "ingreso" ? formatCurrency(m.monto) : <span className="text-[#94a3b8]">-</span>}
                          </td>
                          <td className={`font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] py-[12px] ${m.tipo === "egreso" ? "text-[#ef4444]" : "text-[#94a3b8]"}`}>
                            {m.tipo === "egreso" ? formatCurrency(m.monto) : "-"}
                          </td>
                          <td className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[13px] py-[12px]">
                            {m.moneda === "USD" && m.tipoCambio ? <span className="text-[#94a3b8] text-[11px]">USD @{m.tipoCambio.toFixed(2)}</span> : ""}
                          </td>
                          <td className="py-[12px]">
                            <div className="flex items-center gap-[4px] opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEditarMovimiento(m)} className="p-[4px] rounded-[4px] hover:bg-[#e2e8f0] transition-colors" title="Editar">
                                <svg fill="none" height="14" viewBox="0 0 14 14" width="14"><path d="M10.5 1.5L12.5 3.5L4 12H2V10L10.5 1.5Z" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              </button>
                              <button onClick={() => setDeleteConfirm(m.id)} className="p-[4px] rounded-[4px] hover:bg-[#fee2e2] transition-colors" title="Eliminar">
                                <svg fill="none" height="14" viewBox="0 0 14 14" width="14"><path d="M2 4H12M5 4V2H9V4M6 6.5V10.5M8 6.5V10.5M3 4L4 12H10L11 4" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <button onClick={handleNuevoMovimiento} className="flex items-center justify-center gap-[8px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] px-[16px] py-[10px] rounded-[8px] w-full">
              <IconPlus /> Nuevo Movimiento
            </button>
          </div>

          {/* Right Panel */}
          <div className="flex flex-col gap-[20px]">
            {/* Resumen Ganancias */}
            <div className="bg-white p-[20px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[15px] mb-[12px]">Resumen Ganancias</p>
              {(() => {
                const sc = filtroSubCaja !== "Todas" ? resumen?.subCajas[filtroSubCaja] : null;
                const ingresos = sc ? sc.ingresos : (resumen?.totalIngresos || 0);
                const egresos = sc ? sc.egresos : (resumen?.totalEgresos || 0);
                const neta = sc ? sc.total : (resumen?.gananciaNeta || 0);
                return (
                  <>
                    {[
                      { label: "Total Ingresos", value: ingresos, color: "#10b981" },
                      { label: "Total Egresos", value: egresos, color: "#ef4444" },
                        { label: "Total", value: neta, color: "#10b981", highlight: true },
                    ].map((r) => (
                      <div key={r.label} className={`flex items-center justify-between py-[10px] px-[12px] rounded-[8px] mb-[6px] ${r.highlight ? "bg-[#d1fae5]" : ""}`}>
                        <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{r.label}</p>
                        <p className="font-['Geist:Bold',sans-serif] font-bold text-[14px]" style={{ color: r.color }}>{formatCurrency(r.value)}</p>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>

            {/* Distribución */}
            <div className="bg-white p-[20px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[15px] mb-[16px]">Distribución por Caja</p>
              <DonutChart data={subCajasData} />
            </div>

            {/* Cierre Mensual */}
            <div className="bg-white p-[20px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
              <div className="flex items-center justify-between mb-[12px]">
                <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[15px]">Cierres</p>
                <button onClick={() => { setCierreForm((p) => ({ ...p, subCaja: p.subCaja || cajaNombres[0] || "Efectivo", fecha: toISODate(new Date()) })); setShowCierreModal(true); }} className="flex items-center gap-[6px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[10px] py-[6px] rounded-[6px]">
                  <IconPlus /> Nuevo Cierre
                </button>
              </div>
              {cierres.length > 0 ? (
                <div className="flex flex-col gap-[6px] max-h-[250px] overflow-y-auto">
                  {cierres.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-[10px] py-[8px] rounded-[6px] bg-[#f8fafc]" style={{ border: "1px solid #f1f5f9" }}>
                      <div className="flex flex-col">
                        <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px]">{c.subCaja}</span>
                        <span className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px]">{formatFecha(c.fecha || c.fechaCierre)}</span>
                      </div>
                      <div className="flex items-center gap-[8px]">
                        <span className={`font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[6px] py-[2px] rounded-[4px] ${c.diferencia === 0 ? "bg-[#d1fae5] text-[#10b981]" : "bg-[#fee2e2] text-[#ef4444]"}`}>
                          {c.diferencia === 0 ? "$0" : `${c.diferencia > 0 ? "+" : ""}${formatCurrency(c.diferencia)}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px] text-center py-[12px]">Sin cierres registrados</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Nuevo/Editar Movimiento */}
      {showMovimientoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowMovimientoModal(false)}>
          <div className="bg-white rounded-[12px] w-[600px] max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #e2e8f0" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-[24px] py-[20px]" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">{editingMovimiento ? "Editar Movimiento" : "Nuevo Movimiento"}</p>
            </div>
            <div className="px-[24px] py-[20px] flex flex-col gap-[16px]">
              <div className="grid grid-cols-2 gap-[12px]">
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Fecha</label>
                  <input type="date" value={form.fecha} onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))} className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
                </div>
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Tipo</label>
                  <div className="flex gap-[8px]">
                    {(["ingreso", "egreso"] as const).map((t) => (
                      <button key={t} onClick={() => setForm((p) => ({ ...p, tipo: t, categoria: "" }))} className={`flex-1 font-['Geist:Medium',sans-serif] font-medium text-[13px] py-[9px] rounded-[8px] transition-colors ${form.tipo === t ? (t === "ingreso" ? "bg-[#d1fae5] text-[#10b981] border border-[#10b981]" : "bg-[#fee2e2] text-[#ef4444] border border-[#ef4444]") : "bg-white text-[#475569] border border-[#e2e8f0] hover:bg-[#f8fafc]"}`}>
                        {t === "ingreso" ? "Ingreso" : "Egreso"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Concepto</label>
                <input type="text" value={form.concepto} onChange={(e) => setForm((p) => ({ ...p, concepto: e.target.value }))} placeholder="Descripción del movimiento" className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
              </div>
              <div className="grid grid-cols-3 gap-[12px]">
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Monto</label>
                  <input type="number" value={form.monto} onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))} placeholder="0" min="0" className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
                </div>
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Moneda</label>
                  <select value={form.moneda} onChange={(e) => setForm((p) => ({ ...p, moneda: e.target.value }))} className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] bg-white cursor-pointer">
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                {form.moneda === "USD" && (
                  <div>
                    <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Tipo de Cambio</label>
                    <input type="number" value={form.tipoCambio} onChange={(e) => setForm((p) => ({ ...p, tipoCambio: e.target.value }))} placeholder="1200" step="0.01" min="0" className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-[12px]">
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Caja</label>
                  <select value={form.subCaja} onChange={(e) => setForm((p) => ({ ...p, subCaja: e.target.value }))} className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] bg-white cursor-pointer">
                    {cajaNombres.map((sc) => <option key={sc} value={sc}>{sc}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Categoría</label>
                  <select value={form.categoria} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))} className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] bg-white cursor-pointer">
                    <option value="">Sin categoría</option>
                    {(CATEGORIAS_POR_TIPO[form.tipo] || []).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-[12px]">
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Comprobante</label>
                  <input type="text" value={form.comprobante} onChange={(e) => setForm((p) => ({ ...p, comprobante: e.target.value }))} placeholder="Nro comprobante (opcional)" className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
                </div>
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Observaciones</label>
                  <input type="text" value={form.observaciones} onChange={(e) => setForm((p) => ({ ...p, observaciones: e.target.value }))} placeholder="Notas (opcional)" className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setShowMovimientoModal(false)} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handleGuardarMovimiento} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px]">{editingMovimiento ? "Guardar Cambios" : "Crear Movimiento"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cierre */}
      {showCierreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCierreModal(false)}>
          <div className="bg-white rounded-[12px] w-[500px]" style={{ border: "1px solid #e2e8f0" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-[24px] py-[20px]" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">Nuevo Cierre</p>
              <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px] mt-[4px]">Registrá el saldo real para detectar diferencias</p>
            </div>
            <div className="px-[24px] py-[20px] flex flex-col gap-[16px]">
              <div className="grid grid-cols-2 gap-[12px]">
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Caja</label>
                  <select value={cierreForm.subCaja} onChange={(e) => setCierreForm((p) => ({ ...p, subCaja: e.target.value }))} className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] bg-white cursor-pointer">
                    {cajaNombres.map((sc) => <option key={sc} value={sc}>{sc}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Fecha de cierre</label>
                  <input type="date" value={cierreForm.fecha} onChange={(e) => setCierreForm((p) => ({ ...p, fecha: e.target.value }))} className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
                </div>
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Saldo Real (lo que realmente hay)</label>
                <input type="number" value={cierreForm.saldoReal} onChange={(e) => setCierreForm((p) => ({ ...p, saldoReal: e.target.value }))} placeholder="0" min="0" className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
              </div>

              {/* Desglose */}
              {cierrePreview && cierreForm.saldoReal && (() => {
                const saldoInicial = cierrePreview.saldoInicial;
                const saldoFinal = cierrePreview.saldoFinal;
                const saldoEsperado = saldoInicial + saldoFinal;
                const saldoReal = Math.round(Number(cierreForm.saldoReal));
                const diff = saldoReal - saldoEsperado;
                return (
                  <div className="flex flex-col gap-[8px] p-[12px] rounded-[8px] bg-[#f8fafc]" style={{ border: "1px solid #e2e8f0" }}>
                    <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[13px] mb-[4px]">Desglose</p>
                    <div className="flex items-center justify-between">
                      <span className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">Saldo inicial (último cierre)</span>
                      <span className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[13px]">{formatCurrency(saldoInicial)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">Saldo final (ingresos - egresos)</span>
                      <span className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[13px]">{formatCurrency(saldoFinal)}</span>
                    </div>
                    <div className="h-[1px] bg-[#e2e8f0]" />
                    <div className="flex items-center justify-between">
                      <span className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px]">Saldo esperado</span>
                      <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px]">{formatCurrency(saldoEsperado)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px]">Saldo real</span>
                      <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px]">{formatCurrency(saldoReal)}</span>
                    </div>
                    <div className="h-[1px] bg-[#e2e8f0]" />
                    <div className={`flex items-center justify-between px-[10px] py-[6px] rounded-[6px] ${diff === 0 ? "bg-[#d1fae5]" : "bg-[#fee2e2]"}`}>
                      <span className="font-['Geist:Bold',sans-serif] font-bold text-[13px] text-[#0f172a]">Diferencia</span>
                      <span className={`font-['Geist:Bold',sans-serif] font-bold text-[14px] ${diff === 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>{diff === 0 ? "$0" : `${diff > 0 ? "+" : ""}${formatCurrency(diff)}`}</span>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Observaciones</label>
                <input type="text" value={cierreForm.observaciones} onChange={(e) => setCierreForm((p) => ({ ...p, observaciones: e.target.value }))} placeholder="Notas del cierre (opcional)" className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => { setShowCierreModal(false); setCierrePreview(null); }} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handleCerrarMes} disabled={cierreLoading || !cierreForm.saldoReal} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px] disabled:opacity-50 disabled:cursor-not-allowed">{cierreLoading ? "Cerrando..." : "Confirmar Cierre"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Caja */}
      {showCajaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCajaModal(false)}>
          <div className="bg-white rounded-[12px] w-[400px]" style={{ border: "1px solid #e2e8f0" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-[24px] py-[20px]" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">{editingCaja ? "Editar Caja" : "Nueva Caja"}</p>
            </div>
            <div className="px-[24px] py-[20px] flex flex-col gap-[16px]">
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Nombre</label>
                <input type="text" value={cajaForm.nombre} onChange={(e) => setCajaForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Nombre de la caja" className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-[12px]">
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Color</label>
                  <div className="flex items-center gap-[8px]">
                    <input type="color" value={cajaForm.color} onChange={(e) => setCajaForm((p) => ({ ...p, color: e.target.value }))} className="size-[36px] rounded-[6px] border border-[#e2e8f0] cursor-pointer" />
                    <span className="font-['Geist:Regular',sans-serif] text-[13px] text-[#475569]">{cajaForm.color}</span>
                  </div>
                </div>
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Orden</label>
                  <input type="number" value={cajaForm.orden} onChange={(e) => setCajaForm((p) => ({ ...p, orden: e.target.value }))} placeholder="1" min="1" className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
                </div>
              </div>
              <div className="flex items-center gap-[8px] p-[10px] rounded-[8px] bg-[#f8fafc]">
                <div className="size-[24px] rounded-[6px]" style={{ background: cajaForm.color }} />
                <span className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[14px]">{cajaForm.nombre || "Vista previa"}</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setShowCajaModal(false)} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handleGuardarCaja} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px]">{editingCaja ? "Guardar Cambios" : "Crear Caja"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación Movimiento */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-[12px] w-[400px] p-[24px]" style={{ border: "1px solid #e2e8f0" }} onClick={(e) => e.stopPropagation()}>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px] mb-[8px]">Eliminar Movimiento</p>
            <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px] mb-[20px]">¿Estás seguro? Esta acción no se puede deshacer.</p>
            <div className="flex items-center justify-end gap-[12px]">
              <button onClick={() => setDeleteConfirm(null)} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={() => handleEliminarMovimiento(deleteConfirm)} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#ef4444] hover:bg-[#dc2626] transition-colors px-[16px] py-[10px] rounded-[8px]">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación Caja */}
      {deleteCajaConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteCajaConfirm(null)}>
          <div className="bg-white rounded-[12px] w-[400px] p-[24px]" style={{ border: "1px solid #e2e8f0" }} onClick={(e) => e.stopPropagation()}>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px] mb-[8px]">Eliminar Caja</p>
            <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px] mb-[20px]">¿Estás seguro? Si la caja tiene movimientos, no se podrá eliminar (podés desactivarla en su lugar).</p>
            <div className="flex items-center justify-end gap-[12px]">
              <button onClick={() => setDeleteCajaConfirm(null)} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={() => handleEliminarCaja(deleteCajaConfirm)} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#ef4444] hover:bg-[#dc2626] transition-colors px-[16px] py-[10px] rounded-[8px]">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
