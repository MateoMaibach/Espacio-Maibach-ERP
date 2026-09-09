import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import { proveedores } from "@/data/proveedores";
import {
  vendedores, metodosPago,
  formatCurrency, parseCurrencyInput, getCurrentDate,
  type FicheroItem, type FicheroForm,
} from "@/data/clienteDetalleData";
import { getCliente, saveFichero, registrarPagoInicial, generarPlanCuotas, agregarCargo, editarCuota, registrarCobro, eliminarCuota, updateCliente, deleteCliente, deleteFichero } from "@/services/api";
import LocalidadSelector from "@/components/LocalidadSelector";

interface Cuota {
  id: string;
  nro: number;
  fechaVencimiento: string;
  montoPlanificado: number;
  montoPagado: number;
  fechaPago: string | null;
  metodo: string | null;
  comprobante: string;
  observaciones: string;
  estado: "Pendiente" | "Parcial" | "Pagada";
  descripcion?: string;
}

interface FicheroData {
  fecha: string;
  vendedor: string;
  comision: string;
  items: { desc: string; cant: string; precio: string }[];
  total: string;
  costos: {
    venta: string;
    proveedor: string;
    costoPiscina: string;
    instalacion: string;
    equipoFiltrado: string;
    manoObraVereda: string;
    comision: string;
    totalCostos: string;
    margenNeto: string;
    margenPct: string;
  };
  cuotas: Cuota[];
}

interface ClienteData {
  id: string;
  nombre: string;
  direccion: string;
  localidad: string;
  telefono: string;
  email: string;
  dni: string;
  fechaAlta: string;
  estado: string;
  fichero: FicheroData | null;
  cuotas: any[];
}

function mapCuota(c: any): Cuota {
  return {
    id: c.id,
    nro: c.nroCuota,
    fechaVencimiento: c.fechaVencimiento,
    montoPlanificado: c.montoPlanificado,
    montoPagado: c.montoPagado,
    fechaPago: c.fechaPago || null,
    metodo: c.metodo || null,
    comprobante: c.comprobante || "",
    observaciones: c.observaciones || "",
    estado: c.estado,
    descripcion: c.descripcion || undefined,
  };
}

function mapFichero(raw: any, cuotasRaw: any[]): FicheroData {
  let items: { desc: string; cant: string; precio: string }[] = [];
  let costos: FicheroData["costos"] = {
    venta: "", proveedor: "", costoPiscina: "", instalacion: "",
    equipoFiltrado: "", manoObraVereda: "", comision: "",
    totalCostos: "", margenNeto: "", margenPct: "",
  };
  try { items = JSON.parse(raw.items || "[]"); } catch { /* ok */ }
  try { costos = JSON.parse(raw.costos || "{}"); } catch { /* ok */ }
  return {
    fecha: raw.fecha,
    vendedor: raw.vendedor,
    comision: raw.comision || "",
    items,
    total: raw.total || "$0",
    costos,
    cuotas: cuotasRaw.map(mapCuota),
  };
}

const estadoStyle: Record<string, { bg: string; color: string }> = {
  Activo: { bg: "#d1fae5", color: "#10b981" },
  Moroso: { bg: "#fef3c7", color: "#f59e0b" },
  Inactivo: { bg: "#fee2e2", color: "#ef4444" },
};

export default function ClienteDetalle() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getCliente(id)
      .then((data) => {
        setCliente({
          id: data.id,
          nombre: data.nombre,
          direccion: data.direccion || "-",
          localidad: data.localidad || "",
          telefono: data.telefono || "",
          email: data.email || "-",
          dni: data.dni || "",
          fechaAlta: data.fechaAlta,
          estado: data.estado || "Activo",
          fichero: data.fichero ? mapFichero(data.fichero, data.cuotas || []) : null,
          cuotas: data.cuotas || [],
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const sinFichero = !cliente?.fichero;
  const tieneCobros = (cliente?.fichero?.cuotas.length ?? 0) > 0;

  // Tab state
  const [activeTab, setActiveTab] = useState<"fichero" | "pagos">("fichero");

  // Fichero modal states
  const [showFicheroModal, setShowFicheroModal] = useState(false);
  const [ficheroForm, setFicheroForm] = useState<FicheroForm>({
    fecha: getCurrentDate(),
    vendedor: vendedores[0] ?? "",
    comisionPct: "5",
    items: [{ desc: "", cant: "1", precioUnitario: "" }],
    proveedorPiscina: proveedores[0]?.id ?? "",
    costoPiscina: "",
    costoInstalacion: "",
    equipoFiltrado: "",
    manoObraVereda: false,
    costoManoObra: "",
    tipoCobro: "libre",
    cantCuotas: 3,
  });
  const [ficheroErrors, setFicheroErrors] = useState<Record<string, string>>({});
  const [showFicheroMenu, setShowFicheroMenu] = useState(false);
  const [showEliminarFicheroConfirm, setShowEliminarFicheroConfirm] = useState(false);

  // Unified cobros states
  const [editingCuota, setEditingCuota] = useState<Cuota | null>(null);
  const [showGenerarPlanModal, setShowGenerarPlanModal] = useState(false);
  const [showAgregarCargoModal, setShowAgregarCargoModal] = useState(false);
  const [showIngresarCobroModal, setShowIngresarCobroModal] = useState(false);
  const [showEditarCuotaModal, setShowEditarCuotaModal] = useState(false);
  const [showEliminarCuotaConfirm, setShowEliminarCuotaConfirm] = useState(false);
  const [showPagoInicialModal, setShowPagoInicialModal] = useState(false);

  const [cantCuotas, setCantCuotas] = useState(3);
  const [fechaPrimerVto, setFechaPrimerVto] = useState(getCurrentDate());

  const [pagoInicialForm, setPagoInicialForm] = useState({ monto: "", metodo: "Transferencia", comprobante: "", observaciones: "" });
  const [pagoInicialErrors, setPagoInicialErrors] = useState<Record<string, string>>({});

  const [cargoForm, setCargoForm] = useState({ fecha: getCurrentDate(), monto: "", descripcion: "" });
  const [cargoErrors, setCargoErrors] = useState<Record<string, string>>({});

  const [cobroForm, setCobroForm] = useState({ fecha: getCurrentDate(), monto: "", metodo: "Transferencia", comprobante: "", observaciones: "" });
  const [cobroErrors, setCobroErrors] = useState<Record<string, string>>({});

  const [cuotaForm, setCuotaForm] = useState({ fechaVencimiento: "", montoPlanificado: "" });
  const [cuotaFormErrors, setCuotaFormErrors] = useState<Record<string, string>>({});

  // Edit/Delete client states
  const [showEditClienteModal, setShowEditClienteModal] = useState(false);
  const [editClienteForm, setEditClienteForm] = useState({ nombre: "", dni: "", telefono: "", email: "", direccion: "", localidad: "Paraná", estado: "Activo" });
  const [editClienteErrors, setEditClienteErrors] = useState<Record<string, string>>({});
  const [showDeleteClienteConfirm, setShowDeleteClienteConfirm] = useState(false);

  // Fichero calculated values
  const itemsSubtotales = ficheroForm.items.map((item) => {
    const cant = parseCurrencyInput(item.cant);
    const precio = parseCurrencyInput(item.precioUnitario);
    return cant * precio;
  });

  const importeTotal = itemsSubtotales.reduce((sum, sub) => sum + sub, 0);
  const comisionDolar = importeTotal * (parseCurrencyInput(ficheroForm.comisionPct) / 100);
  const costoPiscina = parseCurrencyInput(ficheroForm.costoPiscina);
  const costoInst = parseCurrencyInput(ficheroForm.costoInstalacion);
  const costoEquipo = parseCurrencyInput(ficheroForm.equipoFiltrado);
  const costoManoObra = ficheroForm.manoObraVereda ? parseCurrencyInput(ficheroForm.costoManoObra) : 0;
  const totalCostos = costoPiscina + costoInst + costoEquipo + costoManoObra + comisionDolar;
  const margenNeto = importeTotal - totalCostos;
  const margenPct = importeTotal > 0 ? (margenNeto / importeTotal) * 100 : 0;

  // Unified cobros computed values
  const ficheroTotal = cliente?.fichero ? parseCurrencyInput(cliente.fichero.total) : 0;
  const tienePagoInicial = (cliente?.fichero?.cuotas ?? []).some((c) => c.nro === 0);
  const pagoInicialMonto = cliente?.fichero?.cuotas.find((c) => c.nro === 0)?.montoPlanificado ?? 0;
  const totalCostoCobros = cliente?.fichero?.cuotas.filter((c) => c.nro > 0).reduce((sum, cu) => sum + cu.montoPlanificado, 0) ?? 0;
  const totalIngresos = cliente?.fichero?.cuotas.reduce((sum, cu) => sum + cu.montoPagado, 0) ?? 0;
  const saldoPendienteTotal = ficheroTotal - totalIngresos;
  const saldoParaCuotas = ficheroTotal - pagoInicialMonto;
  const porcentajePagado = ficheroTotal > 0 ? (totalIngresos / ficheroTotal) * 100 : 0;
  const estaPagado = saldoPendienteTotal <= 0 && ficheroTotal > 0;

  function reloadCliente() {
    if (!id) return;
    getCliente(id).then((data) => {
      setCliente({
        id: data.id,
        nombre: data.nombre,
        direccion: data.direccion || "-",
        localidad: data.localidad || "",
        telefono: data.telefono || "",
        email: data.email || "-",
        dni: data.dni || "",
        fechaAlta: data.fechaAlta,
        estado: data.estado || "Activo",
        fichero: data.fichero ? mapFichero(data.fichero, data.cuotas || []) : null,
        cuotas: data.cuotas || [],
      });
    }).catch(console.error);
  }

  // --- Fichero handlers ---
  function handleFicheroChange(field: keyof FicheroForm, value: string | boolean) {
    setFicheroForm((prev) => ({ ...prev, [field]: value }));
    if (ficheroErrors[field as string]) setFicheroErrors((prev) => ({ ...prev, [field as string]: "" }));
  }

  function handleItemChange(index: number, field: keyof FicheroItem, value: string) {
    setFicheroForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
    if (ficheroErrors[`item_${index}_${field}`]) {
      setFicheroErrors((prev) => {
        const next = { ...prev };
        delete next[`item_${index}_${field}`];
        return next;
      });
    }
  }

  function handleAddItem() {
    setFicheroForm((prev) => ({
      ...prev,
      items: [...prev.items, { desc: "", cant: "1", precioUnitario: "" }],
    }));
  }

  function handleRemoveItem(index: number) {
    if (ficheroForm.items.length <= 1) return;
    setFicheroForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  function validateFichero(): boolean {
    const errors: Record<string, string> = {};
    if (!ficheroForm.fecha.trim()) errors.fecha = "Requerido";
    if (!ficheroForm.vendedor.trim()) errors.vendedor = "Requerido";

    let hasValidItem = false;
    ficheroForm.items.forEach((item, i) => {
      if (!item.desc.trim()) errors[`item_${i}_desc`] = "Requerido";
      const precio = parseCurrencyInput(item.precioUnitario);
      if (precio <= 0) errors[`item_${i}_precioUnitario`] = "Precio inválido";
      if (item.desc.trim() && precio > 0) hasValidItem = true;
    });

    if (!hasValidItem) errors.items = "Agregá al menos un artículo válido";

    setFicheroErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleGuardarFichero() {
    if (!validateFichero() || !id) return;

    const comisionPctVal = parseCurrencyInput(ficheroForm.comisionPct);
    const comisionStr = `${comisionPctVal}% (${formatCurrency(comisionDolar)})`;
    const proveedorNombre = proveedores.find((p) => p.id === ficheroForm.proveedorPiscina)?.razonSocial ?? "Sin proveedor";

    const itemsGuardados = ficheroForm.items
      .filter((item) => item.desc.trim() && parseCurrencyInput(item.precioUnitario) > 0)
      .map((item) => {
        const cant = parseCurrencyInput(item.cant);
        const precio = parseCurrencyInput(item.precioUnitario);
        return {
          desc: item.desc.trim(),
          cant: `Cant: ${cant} × ${formatCurrency(precio)}`,
          precio: formatCurrency(cant * precio),
        };
      });

    const costos = {
      venta: formatCurrency(importeTotal),
      proveedor: proveedorNombre,
      costoPiscina: formatCurrency(costoPiscina),
      instalacion: formatCurrency(costoInst),
      equipoFiltrado: formatCurrency(costoEquipo),
      manoObraVereda: ficheroForm.manoObraVereda ? formatCurrency(costoManoObra) : "No aplica",
      comision: formatCurrency(comisionDolar),
      totalCostos: formatCurrency(totalCostos),
      margenNeto: formatCurrency(margenNeto),
      margenPct: `${margenPct.toFixed(1)}%`,
    };

    try {
      await saveFichero(id, {
        fecha: ficheroForm.fecha,
        vendedor: ficheroForm.vendedor,
        comision: comisionStr,
        items: itemsGuardados,
        total: formatCurrency(importeTotal),
        costos,
        tipoCobro: ficheroForm.tipoCobro,
        cantCuotas: ficheroForm.cantCuotas,
      });
      reloadCliente();
      setShowFicheroModal(false);
      setFicheroForm({
        fecha: getCurrentDate(),
        vendedor: vendedores[0] ?? "",
        comisionPct: "5",
        items: [{ desc: "", cant: "1", precioUnitario: "" }],
        proveedorPiscina: proveedores[0]?.id ?? "",
        costoPiscina: "",
        costoInstalacion: "",
        equipoFiltrado: "",
        manoObraVereda: false,
        costoManoObra: "",
        tipoCobro: "libre",
        cantCuotas: 3,
      });
      setFicheroErrors({});
    } catch (e) {
      console.error(e);
    }
  }

  function handleCloseFicheroModal() {
    setShowFicheroModal(false);
    setFicheroErrors({});
  }

  // --- Pago Inicial handler ---
  async function handlePagoInicial() {
    if (!id) return;
    const errors: Record<string, string> = {};
    const monto = parseCurrencyInput(pagoInicialForm.monto);
    if (monto <= 0) errors.monto = "Monto inválido";
    if (ficheroTotal > 0 && monto > ficheroTotal) errors.monto = `No puede superar el total del fichero (${formatCurrency(ficheroTotal)})`;
    if (!pagoInicialForm.metodo) errors.metodo = "Requerido";
    setPagoInicialErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      await registrarPagoInicial(id, {
        monto,
        metodo: pagoInicialForm.metodo,
        comprobante: pagoInicialForm.comprobante,
        observaciones: pagoInicialForm.observaciones,
      });
      reloadCliente();
      setShowPagoInicialModal(false);
      setPagoInicialForm({ monto: "", metodo: "Transferencia", comprobante: "", observaciones: "" });
      setPagoInicialErrors({});
    } catch (e) {
      console.error(e);
    }
  }

  // --- Cobros handlers ---
  async function handleGenerarPlan() {
    if (!id || !cliente?.fichero) return;
    try {
      await generarPlanCuotas(id, cantCuotas, fechaPrimerVto);
      reloadCliente();
      setShowGenerarPlanModal(false);
      setCantCuotas(3);
      setFechaPrimerVto(getCurrentDate());
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAgregarCargo() {
    if (!id || !cliente?.fichero) return;
    const errors: Record<string, string> = {};
    if (!cargoForm.fecha.trim()) errors.fecha = "Requerido";
    const monto = parseCurrencyInput(cargoForm.monto);
    if (monto <= 0) errors.monto = "Monto inválido";
    setCargoErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      await agregarCargo(id, { fechaVencimiento: cargoForm.fecha, monto, descripcion: cargoForm.descripcion.trim() || undefined });
      reloadCliente();
      setShowAgregarCargoModal(false);
      setCargoForm({ fecha: getCurrentDate(), monto: "", descripcion: "" });
      setCargoErrors({});
    } catch (e) {
      console.error(e);
    }
  }

  function handleOpenIngresarCobro(cuota: Cuota) {
    setEditingCuota(cuota);
    const saldoCuota = cuota.montoPlanificado - cuota.montoPagado;
    setCobroForm({ fecha: getCurrentDate(), monto: String(saldoCuota), metodo: "Transferencia", comprobante: "", observaciones: "" });
    setCobroErrors({});
    setShowIngresarCobroModal(true);
  }

  async function handleIngresarCobro() {
    if (!id || !editingCuota) return;
    const errors: Record<string, string> = {};
    if (!cobroForm.fecha.trim()) errors.fecha = "Requerido";
    const monto = parseCurrencyInput(cobroForm.monto);
    const saldoCuota = editingCuota.montoPlanificado - editingCuota.montoPagado;
    if (monto <= 0) errors.monto = "Monto inválido";
    else if (monto > saldoCuota) errors.monto = `No puede superar el saldo (${formatCurrency(saldoCuota)})`;
    if (!cobroForm.metodo) errors.metodo = "Requerido";
    setCobroErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      await registrarCobro(id, editingCuota.id, {
        monto,
        metodo: cobroForm.metodo,
        comprobante: cobroForm.comprobante,
        observaciones: cobroForm.observaciones,
      });
      reloadCliente();
      setShowIngresarCobroModal(false);
      setEditingCuota(null);
      setCobroForm({ fecha: getCurrentDate(), monto: "", metodo: "Transferencia", comprobante: "", observaciones: "" });
      setCobroErrors({});
    } catch (e) {
      console.error(e);
    }
  }

  function handleOpenEditarCuota(cuota: Cuota) {
    setEditingCuota(cuota);
    setCuotaForm({ fechaVencimiento: cuota.fechaVencimiento, montoPlanificado: String(cuota.montoPlanificado) });
    setCuotaFormErrors({});
    setShowEditarCuotaModal(true);
  }

  async function handleGuardarEditarCuota() {
    if (!id || !editingCuota) return;
    const errors: Record<string, string> = {};
    if (!cuotaForm.fechaVencimiento.trim()) errors.fechaVencimiento = "Requerido";
    const monto = parseCurrencyInput(cuotaForm.montoPlanificado);
    if (monto <= 0) errors.montoPlanificado = "Monto inválido";
    setCuotaFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      await editarCuota(id, editingCuota.id, {
        fechaVencimiento: cuotaForm.fechaVencimiento,
        montoPlanificado: monto,
      });
      reloadCliente();
      setShowEditarCuotaModal(false);
      setEditingCuota(null);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleConfirmarEliminarCuota() {
    if (!id || !editingCuota) return;
    try {
      await eliminarCuota(id, editingCuota.id);
      reloadCliente();
      setShowEliminarCuotaConfirm(false);
      setEditingCuota(null);
    } catch (e) {
      console.error(e);
    }
  }

  // --- Edit/Delete Client handlers ---
  function handleOpenEditCliente() {
    if (!cliente) return;
    setEditClienteForm({
      nombre: cliente.nombre,
      dni: cliente.dni,
      telefono: cliente.telefono,
      email: cliente.email === "-" ? "" : cliente.email,
      direccion: cliente.direccion === "-" ? "" : cliente.direccion,
      localidad: cliente.localidad || "Paraná",
      estado: cliente.estado || "Activo",
    });
    setEditClienteErrors({});
    setShowEditClienteModal(true);
  }

  function validateEditCliente(): boolean {
    const newErrors: Record<string, string> = {};
    if (!editClienteForm.nombre.trim()) newErrors.nombre = "El nombre es obligatorio";
    if (!editClienteForm.dni.trim()) newErrors.dni = "El DNI/CUIT es obligatorio";
    if (!editClienteForm.telefono.trim()) newErrors.telefono = "El teléfono es obligatorio";
    setEditClienteErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleGuardarEditCliente() {
    if (!validateEditCliente() || !id) return;
    try {
      await updateCliente(id, {
        nombre: editClienteForm.nombre.trim(),
        dni: editClienteForm.dni.trim(),
        telefono: editClienteForm.telefono.trim(),
        email: editClienteForm.email.trim(),
        direccion: editClienteForm.direccion.trim(),
        localidad: editClienteForm.localidad,
        estado: editClienteForm.estado,
      });
      reloadCliente();
      setShowEditClienteModal(false);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleEliminarCliente() {
    if (!id) return;
    try {
      await deleteCliente(id);
      navigate("/clientes");
    } catch (e) {
      console.error(e);
    }
  }

  async function handleEliminarFichero() {
    if (!id) return;
    try {
      await deleteFichero(id);
      reloadCliente();
      setShowEliminarFicheroConfirm(false);
    } catch (e) {
      console.error(e);
    }
  }

  const ficheroInputClass = (field: string) =>
    `w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white ${
      ficheroErrors[field] ? "border-[#ef4444] focus:border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"
    }`;

  const cobroInputClass = (field: string) =>
    `w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white ${
      cobroErrors[field] ? "border-[#ef4444] focus:border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"
    }`;

  if (loading) {
    return (
      <AppLayout breadcrumbs={[{ label: "Clientes", onClick: () => navigate("/clientes") }, { label: "Cargando..." }]}>
        <div className="p-[32px] flex items-center justify-center h-[400px]">
          <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">Cargando cliente...</p>
        </div>
      </AppLayout>
    );
  }

  if (!cliente) {
    return (
      <AppLayout breadcrumbs={[{ label: "Clientes", onClick: () => navigate("/clientes") }, { label: "No encontrado" }]}>
        <div className="p-[32px] flex items-center justify-center h-[400px]">
          <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">Cliente no encontrado</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={[
      { label: "Inicio", onClick: () => navigate("/") },
      { label: "Clientes", onClick: () => navigate("/clientes") },
      { label: cliente.nombre },
    ]}>
      <div className="p-[32px] flex flex-col gap-[24px]">
        {/* Title */}
        <div className="flex items-center gap-[16px]">
          <button onClick={() => navigate("/clientes")} className="flex items-center justify-center size-[32px] rounded-[8px] hover:bg-[#e2e8f0] transition-colors">
            <svg fill="none" height="20" viewBox="0 0 20 20" width="20">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="#475569" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-[12px]">
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[24px]">{cliente.nombre}</p>
              <div className="relative">
                <button
                  onClick={() => setShowFicheroMenu(!showFicheroMenu)}
                  className="size-[32px] flex items-center justify-center rounded-[8px] hover:bg-[#f1f5f9] transition-colors"
                >
                  <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
                    <circle cx="8" cy="3" r="1.5" fill="#64748b" />
                    <circle cx="8" cy="8" r="1.5" fill="#64748b" />
                    <circle cx="8" cy="13" r="1.5" fill="#64748b" />
                  </svg>
                </button>
                {showFicheroMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowFicheroMenu(false)} />
                    <div className="absolute left-0 top-full mt-[4px] z-50 bg-white rounded-[8px] py-[4px] min-w-[180px] shadow-lg" style={{ border: "1px solid #e2e8f0" }}>
                      <button
                        onClick={() => { setShowFicheroMenu(false); handleOpenEditCliente(); }}
                        className="w-full flex items-center gap-[8px] px-[12px] py-[8px] text-left font-['Geist:Regular',sans-serif] text-[13px] text-[#0f172a] hover:bg-[#f1f5f9] transition-colors"
                      >
                        <svg fill="none" height="14" viewBox="0 0 16 16" width="14"><path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="#64748b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
                        Editar Cliente
                      </button>
                      <div className="my-[4px]" style={{ borderTop: "1px solid #e2e8f0" }} />
                      <button
                        onClick={() => { setShowFicheroMenu(false); setShowDeleteClienteConfirm(true); }}
                        className="w-full flex items-center gap-[8px] px-[12px] py-[8px] text-left font-['Geist:Regular',sans-serif] text-[13px] text-[#ef4444] hover:bg-[#fee2e2] transition-colors"
                      >
                        <svg fill="none" height="14" viewBox="0 0 16 16" width="14"><path d="M2 4H14M5 4V2H11V4M6 7V12M10 7V12M3 4L4 14H12L13 4" stroke="#ef4444" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
                        Eliminar Cliente
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[14px] mt-[2px]">Ficha de cliente y desglose de cuenta activa</p>
          </div>
        </div>

        <div className={`${activeTab === "fichero" ? "grid grid-cols-[1fr_340px]" : ""} gap-[24px]`}>
          {/* Left - solo en tab Fichero */}
          {activeTab === "fichero" && (
            <div className="flex flex-col gap-[24px]">
              {/* Info de Contacto */}
              <div className="bg-white p-[24px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
                <div className="flex items-center justify-between mb-[20px]">
                  <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px]">Información de Contacto</p>
                  <span
                    className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[10px] py-[4px] rounded-[6px]"
                    style={estadoStyle[cliente.estado] ?? { bg: "#f1f5f9", color: "#64748b" }}
                  >
                    {cliente.estado}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-[16px]">
                  {[
                    { label: "Dirección", value: cliente.direccion },
                    { label: "Localidad", value: cliente.localidad },
                    { label: "Teléfono", value: cliente.telefono },
                    { label: "Email", value: cliente.email },
                    { label: "DNI/CUIT", value: cliente.dni },
                    { label: "Fecha Alta", value: cliente.fechaAlta },
                  ].map((f) => (
                    <div key={f.label}>
                      <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">{f.label}</p>
                      <p className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[14px] mt-[2px]">{f.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Historial placeholder */}
              <div className="bg-white p-[24px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
                <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px] mb-[16px]">Historial de Ficheros / Pedidos</p>
                <div className="py-[32px] flex flex-col items-center justify-center">
                  <svg fill="none" height="40" viewBox="0 0 40 40" width="40" className="mb-[12px]">
                    <rect x="4" y="6" width="32" height="28" rx="4" stroke="#cbd5e1" strokeWidth="2" />
                    <path d="M12 20H28M12 26H20" stroke="#cbd5e1" strokeLinecap="round" strokeWidth="2" />
                  </svg>
                  <p className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[14px]">Sin historial de pedidos</p>
                  <p className="font-['Geist:Regular',sans-serif] text-[#cbd5e1] text-[13px] mt-[4px]">Los ficheros y pedidos aparecerán aquí</p>
                </div>
              </div>
            </div>
          )}

          {/* Right: Tabs Fichero / Pagos */}
          <div className={activeTab === "pagos" ? "w-full" : "self-start"}>
            {/* Tabs */}
            <div className="bg-white rounded-t-[12px] flex" style={{ border: "1px solid #e2e8f0", borderBottom: "none" }}>
              <button
                onClick={() => setActiveTab("fichero")}
                className={`flex-1 py-[12px] text-center font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] transition-colors rounded-t-[12px] ${
                  activeTab === "fichero"
                    ? "text-[#0ea5e9] bg-white"
                    : "text-[#94a3b8] bg-[#f8fafc] hover:text-[#64748b]"
                }`}
              >
                Fichero
              </button>
              <button
                onClick={() => setActiveTab("pagos")}
                className={`flex-1 py-[12px] text-center font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] transition-colors rounded-t-[12px] relative ${
                  activeTab === "pagos"
                    ? "text-[#0ea5e9] bg-white"
                    : "text-[#94a3b8] bg-[#f8fafc] hover:text-[#64748b]"
                }`}
              >
                Cobros
                {!sinFichero && tieneCobros && (
                  <span className="ml-[6px] inline-flex items-center justify-center size-[18px] rounded-full bg-[#0ea5e9] text-white text-[10px] font-bold">
                    {cliente.fichero!.cuotas.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab Content */}
            <div className="bg-white p-[24px] rounded-b-[12px]" style={{ border: "1px solid #e2e8f0", borderTop: "none" }}>
              {activeTab === "fichero" ? (
                /* ---- TAB FICHERO ---- */
                sinFichero ? (
                  <div className="py-[32px] flex flex-col items-center justify-center">
                    <svg fill="none" height="40" viewBox="0 0 40 40" width="40" className="mb-[12px]">
                      <rect x="6" y="4" width="28" height="32" rx="4" stroke="#cbd5e1" strokeWidth="2" />
                      <path d="M14 14H26M14 20H26M14 26H20" stroke="#cbd5e1" strokeLinecap="round" strokeWidth="2" />
                    </svg>
                    <p className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[14px]">Sin fichero activo</p>
                    <p className="font-['Geist:Regular',sans-serif] text-[#cbd5e1] text-[13px] mt-[4px] text-center mb-[16px]">Cargá el primer fichero de este cliente</p>
                    <button
                      onClick={() => setShowFicheroModal(true)}
                      className="flex items-center gap-[8px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] px-[14px] py-[8px] rounded-[8px]"
                    >
                      <svg fill="none" height="14" viewBox="0 0 16 16" width="14">
                        <path d="M8 3.3328V12.6672M3.3328 8H12.6672" stroke="white" strokeLinecap="round" strokeWidth="2" />
                      </svg>
                      Cargar Fichero
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-[8px] mb-[20px]">
                      {[
                        { label: "Fecha de Pedido", value: cliente.fichero!.fecha },
                        { label: "Vendedor", value: cliente.fichero!.vendedor },
                        { label: "Comisión Venta", value: cliente.fichero!.comision, green: true },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between">
                          <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">{row.label}</p>
                          <p className={`font-['Geist:Medium',sans-serif] font-medium text-[13px] ${row.green ? "text-[#0ea5e9]" : "text-[#0f172a]"}`}>{row.value}</p>
                        </div>
                      ))}
                    </div>
                    <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px] mb-[12px]">Artículos</p>
                    <div className="flex flex-col gap-[10px] mb-[20px]">
                      {cliente.fichero!.items.map((item, i) => (
                        <div key={i} className="flex items-start justify-between">
                          <div>
                            <p className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[13px]">{item.desc}</p>
                            <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px] mt-[1px]">{item.cant}</p>
                          </div>
                          <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px]">{item.precio}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between py-[12px]" style={{ borderTop: "1px solid #e2e8f0" }}>
                      <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[15px]">Importe Total</p>
                      <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0ea5e9] text-[22px]">{cliente.fichero!.total}</p>
                    </div>
                    <div className="bg-[#f8fafc] p-[14px] rounded-[8px] mt-[8px]">
                      <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#475569] text-[11px] uppercase tracking-wide mb-[10px]">DESGLOSE DE COSTOS DE OBRA</p>
                      {[
                        { label: "Proveedor Piscina", value: cliente.fichero!.costos.proveedor, color: "#0f172a" },
                        { label: "Costo Piscina", value: cliente.fichero!.costos.costoPiscina, color: "#ef4444" },
                        { label: "Instalación", value: cliente.fichero!.costos.instalacion, color: "#ef4444" },
                        { label: "Equipo de Filtrado", value: cliente.fichero!.costos.equipoFiltrado, color: "#ef4444" },
                        { label: "Mano de Obra Vereda", value: cliente.fichero!.costos.manoObraVereda, color: cliente.fichero!.costos.manoObraVereda === "No aplica" ? "#94a3b8" : "#ef4444" },
                        { label: "Comisión Vendedor", value: cliente.fichero!.costos.comision, color: "#ef4444" },
                      ].map((r) => (
                        <div key={r.label} className="flex items-center justify-between mb-[6px]">
                          <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">{r.label}</p>
                          <p className="font-['Geist:Medium',sans-serif] font-medium text-[13px]" style={{ color: r.color }}>{r.value}</p>
                        </div>
                      ))}
                      <div className="flex items-center justify-between mb-[6px] pt-[6px]" style={{ borderTop: "1px solid #e2e8f0" }}>
                        <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px]">Total Costos</p>
                        <p className="font-['Geist:Bold',sans-serif] font-bold text-[#ef4444] text-[14px]">{cliente.fichero!.costos.totalCostos}</p>
                      </div>
                      <div className="flex items-center justify-between pt-[8px]" style={{ borderTop: "1px solid #e2e8f0" }}>
                        <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px]">Margen Neto</p>
                        <div className="flex items-center gap-[8px]">
                          <p className="font-['Geist:Bold',sans-serif] font-bold text-[#10b981] text-[15px]">{cliente.fichero!.costos.margenNeto}</p>
                          <span className="bg-[#d1fae5] text-[#10b981] font-['Geist:SemiBold',sans-serif] font-semibold text-[11px] px-[6px] py-[2px] rounded-[4px]">{cliente.fichero!.costos.margenPct}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )
              ) : (
                /* ---- TAB COBROS (VISTA UNIFICADA) ---- */
                sinFichero ? (
                  <div className="py-[32px] flex flex-col items-center justify-center">
                    <svg fill="none" height="40" viewBox="0 0 40 40" width="40" className="mb-[12px]">
                      <rect x="4" y="10" width="32" height="20" rx="4" stroke="#cbd5e1" strokeWidth="2" />
                      <path d="M4 18H36" stroke="#cbd5e1" strokeWidth="2" />
                    </svg>
                    <p className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[14px]">Sin fichero activo</p>
                    <p className="font-['Geist:Regular',sans-serif] text-[#cbd5e1] text-[13px] mt-[4px]">Creá un fichero primero para gestionar cobros</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-[16px]">
                    {/* Resumen */}
                    <div className="bg-[#f8fafc] p-[16px] rounded-[8px]">
                      <div className="grid grid-cols-3 gap-[12px] mb-[12px]">
                        <div>
                          <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px] uppercase tracking-wide">Total Costo</p>
                          <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px] mt-[2px]">{formatCurrency(totalCostoCobros)}</p>
                        </div>
                        <div>
                          <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px] uppercase tracking-wide">Ingresos</p>
                          <p className="font-['Geist:Bold',sans-serif] font-bold text-[#10b981] text-[16px] mt-[2px]">{formatCurrency(totalIngresos)}</p>
                        </div>
                        <div>
                          <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px] uppercase tracking-wide">Saldo Pendiente</p>
                          <p className={`font-['Geist:Bold',sans-serif] font-bold text-[16px] mt-[2px] ${estaPagado ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                            {estaPagado ? "$0" : formatCurrency(saldoPendienteTotal)}
                          </p>
                        </div>
                      </div>
                      <div className="w-full h-[8px] bg-[#e2e8f0] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(porcentajePagado, 100)}%`,
                            backgroundColor: estaPagado ? "#10b981" : "#0ea5e9",
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-[6px]">
                        <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">{porcentajePagado.toFixed(1)}% pagado</p>
                        {estaPagado && (
                          <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[11px] px-[8px] py-[2px] rounded-[4px] bg-[#d1fae5] text-[#10b981]">Totalmente pagado</span>
                        )}
                      </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex items-center gap-[10px]">
                      {!tienePagoInicial ? (
                        <button
                          onClick={() => {
                            setPagoInicialForm({ monto: "", metodo: "Transferencia", comprobante: "", observaciones: "" });
                            setPagoInicialErrors({});
                            setShowPagoInicialModal(true);
                          }}
                          className="flex items-center gap-[6px] bg-[#10b981] hover:bg-[#059669] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[14px] py-[8px] rounded-[8px]"
                        >
                          <svg fill="none" height="12" viewBox="0 0 16 16" width="12"><path d="M2 8h12M8 2v12" stroke="white" strokeLinecap="round" strokeWidth="2" /></svg>
                          Pago Inicial
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setPagoInicialForm({ monto: String(pagoInicialMonto), metodo: "Transferencia", comprobante: "", observaciones: "" });
                            setPagoInicialErrors({});
                            setShowPagoInicialModal(true);
                          }}
                          className="flex items-center gap-[6px] bg-[#d1fae5] hover:bg-[#a7f3d0] transition-colors text-[#065f46] font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[14px] py-[8px] rounded-[8px]"
                          style={{ border: "1px solid #6ee7b7" }}
                        >
                          <svg fill="none" height="12" viewBox="0 0 16 16" width="12"><path d="M2 8h12" stroke="#065f46" strokeLinecap="round" strokeWidth="2" /></svg>
                          Pago Inicial: {formatCurrency(pagoInicialMonto)}
                        </button>
                      )}
                      <button
                        onClick={() => setShowGenerarPlanModal(true)}
                        className="flex items-center gap-[6px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[14px] py-[8px] rounded-[8px]"
                      >
                        <svg fill="none" height="12" viewBox="0 0 16 16" width="12"><path d="M2 3h12M2 8h12M2 13h8" stroke="white" strokeLinecap="round" strokeWidth="2" /></svg>
                        {tieneCobros ? "Regenerar Plan" : "Generar Plan"}
                      </button>
                      <button
                        onClick={() => setShowAgregarCargoModal(true)}
                        className="flex items-center gap-[6px] bg-white hover:bg-[#f1f5f9] transition-colors text-[#0f172a] font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[14px] py-[8px] rounded-[8px]"
                        style={{ border: "1px solid #e2e8f0" }}
                      >
                        <svg fill="none" height="12" viewBox="0 0 16 16" width="12"><path d="M8 3.3328V12.6672M3.3328 8H12.6672" stroke="#0f172a" strokeLinecap="round" strokeWidth="2" /></svg>
                        Agregar Cargo
                      </button>
                    </div>

                    {/* Tabla unificada */}
                    {tieneCobros ? (
                      <div className="rounded-[10px] overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
                        <table className="w-full">
                          <thead>
                            <tr className="bg-[#f8fafc]" style={{ borderBottom: "1px solid #e2e8f0" }}>
                              {["Fecha", "Costo", "Ingreso", "Saldo Pend."].map((h) => (
                                <th key={h} className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[11px] uppercase tracking-wide px-[14px] py-[10px]">{h}</th>
                              ))}
                              <th className="w-[160px]"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {cliente.fichero!.cuotas.map((cuota) => {
                              const saldo = cuota.montoPlanificado - cuota.montoPagado;
                              return (
                                <tr key={cuota.id} className="group hover:bg-[#f8fafc] transition-colors" style={{ borderBottom: "1px solid #f1f5f9" }}>
                                  <td className="px-[14px] py-[10px]">
                                    <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">{cuota.fechaVencimiento}</p>
                                    {cuota.descripcion && <p className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[12px] mt-[1px]">{cuota.descripcion}</p>}
                                  </td>
                                  <td className="px-[14px] py-[10px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px]">{formatCurrency(cuota.montoPlanificado)}</td>
                                  <td className="px-[14px] py-[10px]">
                                    <span className={`font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] ${cuota.montoPagado > 0 ? "text-[#10b981]" : "text-[#94a3b8]"}`}>
                                      {cuota.montoPagado > 0 ? formatCurrency(cuota.montoPagado) : "—"}
                                    </span>
                                  </td>
                                  <td className="px-[14px] py-[10px]">
                                    <span className={`font-['Geist:Bold',sans-serif] font-bold text-[13px] ${saldo <= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                                      {saldo <= 0 ? "$0" : formatCurrency(saldo)}
                                    </span>
                                  </td>
                                  <td className="px-[14px] py-[10px]">
                                    <div className="flex items-center gap-[4px] opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                      {saldo > 0 && (
                                        <button
                                          onClick={() => handleOpenIngresarCobro(cuota)}
                                          className="font-['Geist:SemiBold',sans-serif] font-semibold text-[10px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[8px] py-[4px] rounded-[6px]"
                                        >
                                          Ingresar Cobro
                                        </button>
                                      )}
                                      <button onClick={() => handleOpenEditarCuota(cuota)} className="size-[24px] flex items-center justify-center rounded-[6px] hover:bg-[#f1f5f9] transition-colors">
                                        <svg fill="none" height="11" viewBox="0 0 16 16" width="11"><path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="#64748b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
                                      </button>
                                      <button onClick={() => { setEditingCuota(cuota); setShowEliminarCuotaConfirm(true); }} className="size-[24px] flex items-center justify-center rounded-[6px] hover:bg-[#fee2e2] transition-colors">
                                        <svg fill="none" height="11" viewBox="0 0 16 16" width="11"><path d="M2 4H14M5 4V2H11V4M6 7V12M10 7V12M3 4L4 14H12L13 4" stroke="#ef4444" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-[#f8fafc]" style={{ borderTop: "2px solid #e2e8f0" }}>
                              <td className="px-[14px] py-[12px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[12px] uppercase">Totales</td>
                              <td className="px-[14px] py-[12px] font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[14px]">{formatCurrency(totalCostoCobros)}</td>
                              <td className="px-[14px] py-[12px] font-['Geist:Bold',sans-serif] font-bold text-[#10b981] text-[14px]">{formatCurrency(totalIngresos)}</td>
                              <td className="px-[14px] py-[12px] font-['Geist:Bold',sans-serif] font-bold text-[14px]" style={{ color: estaPagado ? "#10b981" : "#ef4444" }}>
                                {estaPagado ? "SALDO CANCELADO" : formatCurrency(saldoPendienteTotal)}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <div className="py-[24px] flex flex-col items-center justify-center">
                        <p className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[13px]">Sin cobros registrados</p>
                        <p className="font-['Geist:Regular',sans-serif] text-[#cbd5e1] text-[12px] mt-[2px]">Generá un plan o agregá un cargo para comenzar</p>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ==================== MODALES ==================== */}

      {/* Modal Nuevo Fichero */}
      {showFicheroModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleCloseFicheroModal} />
          <div className="relative bg-white rounded-[16px] w-[680px] max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between px-[24px] py-[20px]" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">Nuevo Fichero</p>
              <button onClick={handleCloseFicheroModal} className="flex items-center justify-center size-[32px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
                <svg fill="none" height="16" viewBox="0 0 16 16" width="16"><path d="M12 4L4 12M4 4L12 12" stroke="#64748b" strokeLinecap="round" strokeWidth="2" /></svg>
              </button>
            </div>
            <div className="px-[24px] py-[20px] flex flex-col gap-[20px]">
              <div className="grid grid-cols-3 gap-[12px]">
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Fecha *</label>
                  <input type="text" value={ficheroForm.fecha} onChange={(e) => handleFicheroChange("fecha", e.target.value)} placeholder="dd/mm/aaaa" className={ficheroInputClass("fecha")} style={{ border: `1px solid ${ficheroErrors.fecha ? "#ef4444" : "#e2e8f0"}` }} />
                  {ficheroErrors.fecha && <p className="text-[#ef4444] text-[12px] mt-[4px]">{ficheroErrors.fecha}</p>}
                </div>
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Vendedor *</label>
                  <select value={ficheroForm.vendedor} onChange={(e) => handleFicheroChange("vendedor", e.target.value)} className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] bg-white cursor-pointer">
                    {vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Comisión (%)</label>
                  <div className="flex items-center gap-[4px]">
                    <input type="text" value={ficheroForm.comisionPct} onChange={(e) => handleFicheroChange("comisionPct", e.target.value)} className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
                    <span className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">%</span>
                  </div>
                  <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px] mt-[4px]">{formatCurrency(comisionDolar)}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-[12px]">
                  <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">Artículos</p>
                  {ficheroErrors.items && <p className="text-[#ef4444] text-[12px]">{ficheroErrors.items}</p>}
                </div>
                <div className="flex flex-col gap-[8px]">
                  {ficheroForm.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-[8px]">
                      <div className="flex-1">
                        <input type="text" value={item.desc} onChange={(e) => handleItemChange(i, "desc", e.target.value)} placeholder="Descripción del artículo" className={`w-full font-['Geist:Regular',sans-serif] text-[13px] text-[#0f172a] px-[10px] py-[8px] rounded-[6px] outline-none transition-colors bg-white`} style={{ border: `1px solid ${ficheroErrors[`item_${i}_desc`] ? "#ef4444" : "#e2e8f0"}` }} />
                      </div>
                      <div className="w-[60px]">
                        <input type="text" value={item.cant} onChange={(e) => handleItemChange(i, "cant", e.target.value)} placeholder="Cant" className="w-full font-['Geist:Regular',sans-serif] text-[13px] text-[#0f172a] px-[10px] py-[8px] rounded-[6px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white text-center" />
                      </div>
                      <div className="w-[120px]">
                        <input type="text" value={item.precioUnitario} onChange={(e) => handleItemChange(i, "precioUnitario", e.target.value)} placeholder="$ Precio" className={`w-full font-['Geist:Regular',sans-serif] text-[13px] text-[#0f172a] px-[10px] py-[8px] rounded-[6px] outline-none transition-colors bg-white`} style={{ border: `1px solid ${ficheroErrors[`item_${i}_precioUnitario`] ? "#ef4444" : "#e2e8f0"}` }} />
                      </div>
                      <div className="w-[90px] text-right">
                        <span className="font-['Geist:Medium',sans-serif] font-medium text-[13px] text-[#0f172a]">{(itemsSubtotales[i] ?? 0) > 0 ? formatCurrency(itemsSubtotales[i] ?? 0) : "-"}</span>
                      </div>
                      <button onClick={() => handleRemoveItem(i)} disabled={ficheroForm.items.length <= 1} className="flex items-center justify-center size-[28px] rounded-[6px] hover:bg-[#fee2e2] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <svg fill="none" height="14" viewBox="0 0 16 16" width="14"><path d="M4 8H12" stroke="#ef4444" strokeLinecap="round" strokeWidth="2" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={handleAddItem} className="mt-[8px] flex items-center gap-[6px] font-['Geist:Medium',sans-serif] font-medium text-[13px] text-[#0ea5e9] hover:text-[#0284c7] transition-colors">
                  <svg fill="none" height="14" viewBox="0 0 16 16" width="14"><path d="M8 3.3328V12.6672M3.3328 8H12.6672" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>
                  Agregar artículo
                </button>
                <div className="flex items-center justify-between mt-[16px] pt-[12px]" style={{ borderTop: "1px solid #e2e8f0" }}>
                  <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[15px]">Importe Total</p>
                  <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0ea5e9] text-[20px]">{formatCurrency(importeTotal)}</p>
                </div>
              </div>

              <div className="bg-[#f8fafc] p-[16px] rounded-[8px]">
                <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#475569] text-[11px] uppercase tracking-wide mb-[14px]">Costos de Obra</p>
                <div className="flex flex-col gap-[12px]">
                  <div className="grid grid-cols-[1fr_140px] gap-[12px] items-end">
                    <div>
                      <label className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px] mb-[4px] block">Proveedor Piscina</label>
                      <select value={ficheroForm.proveedorPiscina} onChange={(e) => handleFicheroChange("proveedorPiscina", e.target.value)} className="w-full font-['Geist:Regular',sans-serif] text-[13px] text-[#0f172a] px-[10px] py-[8px] rounded-[6px] outline-none border border-[#e2e8f0] bg-white cursor-pointer">
                        {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razonSocial}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px] mb-[4px] block">Costo Piscina</label>
                      <input type="text" value={ficheroForm.costoPiscina} onChange={(e) => handleFicheroChange("costoPiscina", e.target.value)} placeholder="$ 0" className="w-full font-['Geist:Regular',sans-serif] text-[13px] text-[#0f172a] px-[10px] py-[8px] rounded-[6px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
                    </div>
                  </div>
                  <div>
                    <label className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px] mb-[4px] block">Instalación</label>
                    <input type="text" value={ficheroForm.costoInstalacion} onChange={(e) => handleFicheroChange("costoInstalacion", e.target.value)} placeholder="$ 0" className="w-full font-['Geist:Regular',sans-serif] text-[13px] text-[#0f172a] px-[10px] py-[8px] rounded-[6px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
                  </div>
                  <div>
                    <label className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px] mb-[4px] block">Equipo de Filtrado (filtro ± bomba)</label>
                    <input type="text" value={ficheroForm.equipoFiltrado} onChange={(e) => handleFicheroChange("equipoFiltrado", e.target.value)} placeholder="$ 0" className="w-full font-['Geist:Regular',sans-serif] text-[13px] text-[#0f172a] px-[10px] py-[8px] rounded-[6px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-[6px]">
                      <label className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">Mano de Obra Vereda</label>
                      <button type="button" onClick={() => handleFicheroChange("manoObraVereda", !ficheroForm.manoObraVereda)} className={`relative w-[40px] h-[22px] rounded-full transition-colors ${ficheroForm.manoObraVereda ? "bg-[#0ea5e9]" : "bg-[#cbd5e1]"}`}>
                        <span className={`absolute top-[2px] left-[2px] size-[18px] bg-white rounded-full shadow transition-transform ${ficheroForm.manoObraVereda ? "translate-x-[18px]" : ""}`} />
                      </button>
                    </div>
                    {ficheroForm.manoObraVereda && (
                      <input type="text" value={ficheroForm.costoManoObra} onChange={(e) => handleFicheroChange("costoManoObra", e.target.value)} placeholder="$ 0" className="w-full font-['Geist:Regular',sans-serif] text-[13px] text-[#0f172a] px-[10px] py-[8px] rounded-[6px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
                    )}
                  </div>
                  <div className="flex items-center justify-between py-[8px] pt-[8px]" style={{ borderTop: "1px solid #e2e8f0" }}>
                    <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">Comisión Vendedor ({parseCurrencyInput(ficheroForm.comisionPct)}%)</p>
                    <p className="font-['Geist:Medium',sans-serif] font-medium text-[13px] text-[#ef4444]">-{formatCurrency(comisionDolar)}</p>
                  </div>
                  <div className="flex items-center justify-between py-[8px]" style={{ borderTop: "1px solid #e2e8f0" }}>
                    <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px]">Total Costos</p>
                    <p className="font-['Geist:Bold',sans-serif] font-bold text-[#ef4444] text-[15px]">{formatCurrency(totalCostos)}</p>
                  </div>
                  <div className="flex items-center justify-between py-[8px]" style={{ borderTop: "1px solid #e2e8f0" }}>
                    <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">Margen Neto</p>
                    <div className="flex items-center gap-[8px]">
                      <p className={`font-['Geist:Bold',sans-serif] font-bold text-[16px] ${margenNeto >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>{formatCurrency(margenNeto)}</p>
                      <span className={`font-['Geist:SemiBold',sans-serif] font-semibold text-[11px] px-[6px] py-[2px] rounded-[4px] ${margenNeto >= 0 ? "bg-[#d1fae5] text-[#10b981]" : "bg-[#fee2e2] text-[#ef4444]"}`}>{margenPct.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={handleCloseFicheroModal} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handleGuardarFichero} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px]">Guardar Fichero</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Generar Plan */}
      {showGenerarPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowGenerarPlanModal(false)} />
          <div className="relative bg-white rounded-[16px] w-[420px]" style={{ border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between px-[24px] py-[20px]" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">Generar Plan de Cuotas</p>
              <button onClick={() => setShowGenerarPlanModal(false)} className="flex items-center justify-center size-[32px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
                <svg fill="none" height="16" viewBox="0 0 16 16" width="16"><path d="M12 4L4 12M4 4L12 12" stroke="#64748b" strokeLinecap="round" strokeWidth="2" /></svg>
              </button>
            </div>
            <div className="px-[24px] py-[20px] flex flex-col gap-[16px]">
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Cantidad de Cuotas</label>
                <select
                  value={cantCuotas}
                  onChange={(e) => setCantCuotas(Number(e.target.value))}
                  className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] bg-white"
                >
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map((n) => <option key={n} value={n}>{n} cuota{n > 1 ? "s" : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Fecha Primer Vencimiento</label>
                <input
                  type="text"
                  value={fechaPrimerVto}
                  onChange={(e) => setFechaPrimerVto(e.target.value)}
                  placeholder="dd/mes/aaaa"
                  className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white"
                />
              </div>
              {cliente?.fichero && (
                <div className="bg-[#f8fafc] p-[12px] rounded-[8px]">
                  <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px] uppercase tracking-wide">Vista previa</p>
                  {tienePagoInicial && (
                    <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px] mt-[2px]">
                      Total: {formatCurrency(ficheroTotal)} − Pago Inicial: {formatCurrency(pagoInicialMonto)} = Saldo: {formatCurrency(saldoParaCuotas)}
                    </p>
                  )}
                  <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px] mt-[4px]">
                    {cantCuotas} cuota{cantCuotas > 1 ? "s" : ""} de {formatCurrency(Math.floor(saldoParaCuotas / cantCuotas))}
                    {cantCuotas > 1 && (
                      <span className="text-[#94a3b8] text-[12px]"> (última: {formatCurrency(saldoParaCuotas - Math.floor(saldoParaCuotas / cantCuotas) * (cantCuotas - 1))})</span>
                    )}
                  </p>
                  {tieneCobros && (
                    <p className="font-['Geist:Medium',sans-serif] font-medium text-[#f59e0b] text-[12px] mt-[6px]">
                      Esto reemplazará las cuotas actuales (no afecta el pago inicial)
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setShowGenerarPlanModal(false)} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handleGenerarPlan} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px]">Generar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Agregar Cargo */}
      {showAgregarCargoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAgregarCargoModal(false)} />
          <div className="relative bg-white rounded-[16px] w-[420px]" style={{ border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between px-[24px] py-[20px]" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">Agregar Cargo</p>
              <button onClick={() => setShowAgregarCargoModal(false)} className="flex items-center justify-center size-[32px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
                <svg fill="none" height="16" viewBox="0 0 16 16" width="16"><path d="M12 4L4 12M4 4L12 12" stroke="#64748b" strokeLinecap="round" strokeWidth="2" /></svg>
              </button>
            </div>
            <div className="px-[24px] py-[20px] flex flex-col gap-[16px]">
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Fecha *</label>
                <input type="text" value={cargoForm.fecha} onChange={(e) => setCargoForm((p) => ({ ...p, fecha: e.target.value }))} placeholder="dd/mm/aaaa" className={cobroInputClass("cargoFecha")} style={{ border: `1px solid ${cargoErrors.fecha ? "#ef4444" : "#e2e8f0"}` }} />
                {cargoErrors.fecha && <p className="text-[#ef4444] text-[12px] mt-[4px]">{cargoErrors.fecha}</p>}
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Monto *</label>
                <input type="text" value={cargoForm.monto} onChange={(e) => setCargoForm((p) => ({ ...p, monto: e.target.value }))} placeholder="$ 0" className={cobroInputClass("cargoMonto")} style={{ border: `1px solid ${cargoErrors.monto ? "#ef4444" : "#e2e8f0"}` }} />
                {cargoErrors.monto && <p className="text-[#ef4444] text-[12px] mt-[4px]">{cargoErrors.monto}</p>}
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Descripción (opcional)</label>
                <input type="text" value={cargoForm.descripcion} onChange={(e) => setCargoForm((p) => ({ ...p, descripcion: e.target.value }))} placeholder="Ej: Seña inicial, Kit de luces..." className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setShowAgregarCargoModal(false)} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handleAgregarCargo} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px]">Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ingresar Cobro */}
      {showIngresarCobroModal && editingCuota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowIngresarCobroModal(false); setEditingCuota(null); }} />
          <div className="relative bg-white rounded-[16px] w-[480px] max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between px-[24px] py-[20px]" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">Ingresar Cobro</p>
              <button onClick={() => { setShowIngresarCobroModal(false); setEditingCuota(null); }} className="flex items-center justify-center size-[32px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
                <svg fill="none" height="16" viewBox="0 0 16 16" width="16"><path d="M12 4L4 12M4 4L12 12" stroke="#64748b" strokeLinecap="round" strokeWidth="2" /></svg>
              </button>
            </div>
            <div className="px-[24px] py-[20px] flex flex-col gap-[16px]">
              <div className="bg-[#f8fafc] p-[12px] rounded-[8px]">
                <div className="flex items-center justify-between">
                  <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">Saldo de la cuota</p>
                  <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[14px]">{formatCurrency(editingCuota.montoPlanificado - editingCuota.montoPagado)}</p>
                </div>
                {editingCuota.descripcion && (
                  <p className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[12px] mt-[4px]">{editingCuota.descripcion}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-[12px]">
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Fecha de Pago *</label>
                  <input type="text" value={cobroForm.fecha} onChange={(e) => setCobroForm((p) => ({ ...p, fecha: e.target.value }))} placeholder="dd/mm/aaaa" className={cobroInputClass("cobroFecha")} style={{ border: `1px solid ${cobroErrors.fecha ? "#ef4444" : "#e2e8f0"}` }} />
                  {cobroErrors.fecha && <p className="text-[#ef4444] text-[12px] mt-[4px]">{cobroErrors.fecha}</p>}
                </div>
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Monto *</label>
                  <input type="text" value={cobroForm.monto} onChange={(e) => setCobroForm((p) => ({ ...p, monto: e.target.value }))} placeholder="$ 0" className={cobroInputClass("cobroMonto")} style={{ border: `1px solid ${cobroErrors.monto ? "#ef4444" : "#e2e8f0"}` }} />
                  {cobroErrors.monto && <p className="text-[#ef4444] text-[12px] mt-[4px]">{cobroErrors.monto}</p>}
                </div>
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Método de Pago *</label>
                <select value={cobroForm.metodo} onChange={(e) => setCobroForm((p) => ({ ...p, metodo: e.target.value }))} className={cobroInputClass("cobroMetodo")} style={{ border: `1px solid ${cobroErrors.metodo ? "#ef4444" : "#e2e8f0"}` }}>
                  {metodosPago.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                {cobroErrors.metodo && <p className="text-[#ef4444] text-[12px] mt-[4px]">{cobroErrors.metodo}</p>}
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Nro. Comprobante (opcional)</label>
                <input type="text" value={cobroForm.comprobante} onChange={(e) => setCobroForm((p) => ({ ...p, comprobante: e.target.value }))} placeholder="Ej: TR-12345" className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Observaciones (opcional)</label>
                <input type="text" value={cobroForm.observaciones} onChange={(e) => setCobroForm((p) => ({ ...p, observaciones: e.target.value }))} placeholder="Nota adicional..." className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
              </div>
              {cobroForm.monto && parseCurrencyInput(cobroForm.monto) > 0 && (
                <div className="bg-[#f8fafc] p-[12px] rounded-[8px]">
                  <div className="flex items-center justify-between">
                    <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">Saldo después del cobro</p>
                    <p className={`font-['Geist:Bold',sans-serif] font-bold text-[15px] ${(editingCuota.montoPlanificado - editingCuota.montoPagado - parseCurrencyInput(cobroForm.monto)) <= 0 ? "text-[#10b981]" : "text-[#0f172a]"}`}>
                      {Math.max(0, editingCuota.montoPlanificado - editingCuota.montoPagado - parseCurrencyInput(cobroForm.monto)) <= 0 ? "$0" : formatCurrency(editingCuota.montoPlanificado - editingCuota.montoPagado - parseCurrencyInput(cobroForm.monto))}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => { setShowIngresarCobroModal(false); setEditingCuota(null); }} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handleIngresarCobro} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px]">Registrar Cobro</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Cuota */}
      {showEditarCuotaModal && editingCuota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEditarCuotaModal(false)} />
          <div className="relative bg-white rounded-[16px] w-[420px]" style={{ border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between px-[24px] py-[20px]" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">Editar Cargo #{editingCuota.nro}</p>
              <button onClick={() => setShowEditarCuotaModal(false)} className="flex items-center justify-center size-[32px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
                <svg fill="none" height="16" viewBox="0 0 16 16" width="16"><path d="M12 4L4 12M4 4L12 12" stroke="#64748b" strokeLinecap="round" strokeWidth="2" /></svg>
              </button>
            </div>
            <div className="px-[24px] py-[20px] flex flex-col gap-[16px]">
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Fecha de Vencimiento *</label>
                <input
                  type="text"
                  value={cuotaForm.fechaVencimiento}
                  onChange={(e) => setCuotaForm((prev) => ({ ...prev, fechaVencimiento: e.target.value }))}
                  className={`w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white ${cuotaFormErrors.fechaVencimiento ? "border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"}`}
                  style={{ border: `1px solid ${cuotaFormErrors.fechaVencimiento ? "#ef4444" : "#e2e8f0"}` }}
                />
                {cuotaFormErrors.fechaVencimiento && <p className="text-[#ef4444] text-[12px] mt-[4px]">{cuotaFormErrors.fechaVencimiento}</p>}
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Monto Planificado *</label>
                <input
                  type="text"
                  value={cuotaForm.montoPlanificado}
                  onChange={(e) => setCuotaForm((prev) => ({ ...prev, montoPlanificado: e.target.value }))}
                  placeholder="$ 0"
                  className={`w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white ${cuotaFormErrors.montoPlanificado ? "border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"}`}
                  style={{ border: `1px solid ${cuotaFormErrors.montoPlanificado ? "#ef4444" : "#e2e8f0"}` }}
                />
                {cuotaFormErrors.montoPlanificado && <p className="text-[#ef4444] text-[12px] mt-[4px]">{cuotaFormErrors.montoPlanificado}</p>}
              </div>
              <div className="bg-[#f8fafc] p-[12px] rounded-[8px]">
                <div className="flex items-center justify-between">
                  <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">Pagado hasta ahora</p>
                  <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#10b981] text-[14px]">{formatCurrency(editingCuota.montoPagado)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setShowEditarCuotaModal(false)} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handleGuardarEditarCuota} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px]">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminar Cuota */}
      {showEliminarCuotaConfirm && editingCuota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowEliminarCuotaConfirm(false); setEditingCuota(null); }} />
          <div className="relative bg-white rounded-[16px] w-[380px]" style={{ border: "1px solid #e2e8f0" }}>
            <div className="px-[24px] py-[20px] flex flex-col gap-[12px]">
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">Eliminar Cargo #{editingCuota.nro}</p>
              <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">¿Estás seguro de que querés eliminar este cargo? Esta acción no se puede deshacer.</p>
              {editingCuota.montoPagado > 0 && (
                <div className="bg-[#fef3c7] p-[10px] rounded-[8px]">
                  <p className="font-['Geist:Medium',sans-serif] font-medium text-[#92400e] text-[13px]">Este cargo tiene {formatCurrency(editingCuota.montoPagado)} en pagos registrados.</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => { setShowEliminarCuotaConfirm(false); setEditingCuota(null); }} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handleConfirmarEliminarCuota} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#ef4444] hover:bg-[#dc2626] transition-colors px-[16px] py-[10px] rounded-[8px]">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pago Inicial */}
      {showPagoInicialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPagoInicialModal(false)} />
          <div className="relative bg-white rounded-[16px] w-[480px] max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between px-[24px] py-[20px]" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">{tienePagoInicial ? "Editar Pago Inicial" : "Registrar Pago Inicial"}</p>
              <button onClick={() => setShowPagoInicialModal(false)} className="flex items-center justify-center size-[32px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
                <svg fill="none" height="16" viewBox="0 0 16 16" width="16"><path d="M12 4L4 12M4 4L12 12" stroke="#64748b" strokeLinecap="round" strokeWidth="2" /></svg>
              </button>
            </div>
            <div className="px-[24px] py-[20px] flex flex-col gap-[16px]">
              {ficheroTotal > 0 && (
                <div className="bg-[#f0fdf4] p-[12px] rounded-[8px]">
                  <p className="font-['Geist:Regular',sans-serif] text-[#166534] text-[12px]">
                    Total del fichero: <span className="font-semibold">{formatCurrency(ficheroTotal)}</span>
                    {tienePagoInicial && (
                      <> — Ya registrado: <span className="font-semibold">{formatCurrency(pagoInicialMonto)}</span></>
                    )}
                  </p>
                </div>
              )}
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Monto *</label>
                <input
                  type="text"
                  value={pagoInicialForm.monto}
                  onChange={(e) => setPagoInicialForm((p) => ({ ...p, monto: e.target.value }))}
                  placeholder="$ 0"
                  className={cobroInputClass("piMonto")}
                  style={{ border: `1px solid ${pagoInicialErrors.monto ? "#ef4444" : "#e2e8f0"}` }}
                />
                {pagoInicialErrors.monto && <p className="text-[#ef4444] text-[12px] mt-[4px]">{pagoInicialErrors.monto}</p>}
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Método de Pago *</label>
                <select
                  value={pagoInicialForm.metodo}
                  onChange={(e) => setPagoInicialForm((p) => ({ ...p, metodo: e.target.value }))}
                  className={cobroInputClass("piMetodo")}
                  style={{ border: `1px solid ${pagoInicialErrors.metodo ? "#ef4444" : "#e2e8f0"}` }}
                >
                  {metodosPago.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                {pagoInicialErrors.metodo && <p className="text-[#ef4444] text-[12px] mt-[4px]">{pagoInicialErrors.metodo}</p>}
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Nro. Comprobante (opcional)</label>
                <input
                  type="text"
                  value={pagoInicialForm.comprobante}
                  onChange={(e) => setPagoInicialForm((p) => ({ ...p, comprobante: e.target.value }))}
                  placeholder="Ej: TR-12345"
                  className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white"
                />
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Observaciones (opcional)</label>
                <input
                  type="text"
                  value={pagoInicialForm.observaciones}
                  onChange={(e) => setPagoInicialForm((p) => ({ ...p, observaciones: e.target.value }))}
                  placeholder="Nota adicional..."
                  className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setShowPagoInicialModal(false)} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handlePagoInicial} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#10b981] hover:bg-[#059669] transition-colors px-[16px] py-[10px] rounded-[8px]">{tienePagoInicial ? "Guardar Cambios" : "Registrar Pago"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Cliente */}
      {showEditClienteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEditClienteModal(false)} />
          <div className="relative bg-white rounded-[16px] w-[520px] max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between px-[24px] py-[20px]" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">Editar Cliente</p>
              <button onClick={() => setShowEditClienteModal(false)} className="flex items-center justify-center size-[32px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
                <svg fill="none" height="16" viewBox="0 0 16 16" width="16"><path d="M12 4L4 12M4 4L12 12" stroke="#64748b" strokeLinecap="round" strokeWidth="2" /></svg>
              </button>
            </div>
            <div className="px-[24px] py-[20px] flex flex-col gap-[16px]">
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Nombre completo *</label>
                <input type="text" value={editClienteForm.nombre} onChange={(e) => { setEditClienteForm((p) => ({ ...p, nombre: e.target.value })); if (editClienteErrors.nombre) setEditClienteErrors((p) => ({ ...p, nombre: "" })); }} className={`w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white ${editClienteErrors.nombre ? "border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"}`} style={{ border: `1px solid ${editClienteErrors.nombre ? "#ef4444" : "#e2e8f0"}` }} />
                {editClienteErrors.nombre && <p className="text-[#ef4444] text-[12px] mt-[4px]">{editClienteErrors.nombre}</p>}
              </div>
              <div className="grid grid-cols-2 gap-[12px]">
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">DNI / CUIT *</label>
                  <input type="text" value={editClienteForm.dni} onChange={(e) => { setEditClienteForm((p) => ({ ...p, dni: e.target.value })); if (editClienteErrors.dni) setEditClienteErrors((p) => ({ ...p, dni: "" })); }} className={`w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white ${editClienteErrors.dni ? "border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"}`} style={{ border: `1px solid ${editClienteErrors.dni ? "#ef4444" : "#e2e8f0"}` }} />
                  {editClienteErrors.dni && <p className="text-[#ef4444] text-[12px] mt-[4px]">{editClienteErrors.dni}</p>}
                </div>
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Teléfono *</label>
                  <input type="text" value={editClienteForm.telefono} onChange={(e) => { setEditClienteForm((p) => ({ ...p, telefono: e.target.value })); if (editClienteErrors.telefono) setEditClienteErrors((p) => ({ ...p, telefono: "" })); }} className={`w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white ${editClienteErrors.telefono ? "border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"}`} style={{ border: `1px solid ${editClienteErrors.telefono ? "#ef4444" : "#e2e8f0"}` }} />
                  {editClienteErrors.telefono && <p className="text-[#ef4444] text-[12px] mt-[4px]">{editClienteErrors.telefono}</p>}
                </div>
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Email</label>
                <input type="email" value={editClienteForm.email} onChange={(e) => setEditClienteForm((p) => ({ ...p, email: e.target.value }))} className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Dirección</label>
                <input type="text" value={editClienteForm.direccion} onChange={(e) => setEditClienteForm((p) => ({ ...p, direccion: e.target.value }))} className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-[12px]">
                <LocalidadSelector value={editClienteForm.localidad} onChange={(v) => setEditClienteForm((p) => ({ ...p, localidad: v }))} />
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Estado</label>
                  <select value={editClienteForm.estado} onChange={(e) => setEditClienteForm((p) => ({ ...p, estado: e.target.value }))} className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] bg-white cursor-pointer">
                    <option value="Activo">Activo</option>
                    <option value="Moroso">Moroso</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setShowEditClienteModal(false)} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handleGuardarEditCliente} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px]">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminar Cliente */}
      {showDeleteClienteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteClienteConfirm(false)} />
          <div className="relative bg-white rounded-[16px] w-[400px]" style={{ border: "1px solid #e2e8f0" }}>
            <div className="px-[24px] py-[20px] flex flex-col gap-[12px]">
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">Eliminar Cliente</p>
              <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                ¿Estás seguro de que querés eliminar a <span className="font-semibold">{cliente?.nombre}</span> y su <span className="font-semibold">fichero</span>? Se eliminarán también todas las cuotas asociadas. No se puede deshacer.
              </p>
            </div>
            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setShowDeleteClienteConfirm(false)} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handleEliminarCliente} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#ef4444] hover:bg-[#dc2626] transition-colors px-[16px] py-[10px] rounded-[8px]">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminar Fichero */}
      {showEliminarFicheroConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEliminarFicheroConfirm(false)} />
          <div className="relative bg-white rounded-[16px] w-[400px]" style={{ border: "1px solid #e2e8f0" }}>
            <div className="px-[24px] py-[20px] flex flex-col gap-[12px]">
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">Eliminar Fichero</p>
              <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                ¿Estás seguro de que querés eliminar el fichero de <span className="font-semibold">{cliente?.nombre}</span>? Se eliminarán también todas las cuotas y pagos asociados. No se puede deshacer.
              </p>
            </div>
            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setShowEliminarFicheroConfirm(false)} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handleEliminarFichero} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#ef4444] hover:bg-[#dc2626] transition-colors px-[16px] py-[10px] rounded-[8px]">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
