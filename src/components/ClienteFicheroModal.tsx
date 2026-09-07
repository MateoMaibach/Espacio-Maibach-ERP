import { useState } from "react";
import { proveedores } from "@/data/proveedores";
import {
  clientesDataInit, estadoStyle, vendedores, metodosPago, metodoColor,
  formatCurrency, parseCurrencyInput, getCurrentDate, getFicheroResumen,
  type FicheroItem, type FicheroForm, type Pago, type Cuota,
} from "@/data/clienteDetalleData";

interface ClienteState {
  id: number;
  nombre: string;
  direccion: string;
  localidad: string;
  telefono: string;
  email: string;
  dni: string;
  fechaAlta: string;
  estado: string;
}

interface Props {
  clienteId: string;
  clienteState?: ClienteState;
  onClose: () => void;
}

export default function ClienteFicheroModal({ clienteId, clienteState, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"fichero" | "pagos">("fichero");
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
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [editingPago, setEditingPago] = useState<Pago | null>(null);
  const [pagoForm, setPagoForm] = useState({
    fecha: getCurrentDate(),
    monto: "",
    metodo: "Transferencia",
    comprobante: "",
    observaciones: "",
  });
  const [pagoErrors, setPagoErrors] = useState<Record<string, string>>({});

  // Cuotas state
  const [pagoMode, setPagoMode] = useState<"libres" | "cuotas">("libres");
  const [cantCuotas, setCantCuotas] = useState(3);
  const [editingCuota, setEditingCuota] = useState<Cuota | null>(null);
  const [showCuotaForm, setShowCuotaForm] = useState(false);
  const [cuotaForm, setCuotaForm] = useState({ fechaVencimiento: "", montoPlanificado: "" });
  const [cuotaFormErrors, setCuotaFormErrors] = useState<Record<string, string>>({});

  const fromDb = clientesDataInit[clienteId];
  const cliente = fromDb ?? (clienteState ? {
    nombre: clienteState.nombre,
    direccion: clienteState.direccion || "-",
    localidad: clienteState.localidad,
    telefono: clienteState.telefono,
    email: clienteState.email || "-",
    dni: clienteState.dni,
    fechaAlta: clienteState.fechaAlta,
    estado: clienteState.estado,
    ficheroActual: null as null,
    historial: [] as { fecha: string; vendedor: string; articulos: string; importe: string; isCurrent?: boolean }[],
  } : null);

  if (!cliente) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-[16px] p-[32px]" style={{ border: "1px solid #e2e8f0" }}>
          <p className="text-[#0f172a] font-semibold">Cliente no encontrado</p>
          <button onClick={onClose} className="mt-[12px] text-[#0ea5e9] text-[14px]">Cerrar</button>
        </div>
      </div>
    );
  }

  const c = cliente;

  const sinFichero = !c.ficheroActual;

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

  // Pago calculated values
  const ficheroTotal = c.ficheroActual ? parseCurrencyInput(c.ficheroActual.total) : 0;
  const totalPagado = c.ficheroActual?.pagos.reduce((sum, p) => sum + p.monto, 0) ?? 0;
  const saldoPendiente = ficheroTotal - totalPagado;
  const porcentajePagado = ficheroTotal > 0 ? (totalPagado / ficheroTotal) * 100 : 0;
  const estaPagado = saldoPendiente <= 0;
  const saldoDespuesPago = saldoPendiente - parseCurrencyInput(pagoForm.monto);

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

  function handleGuardarFichero() {
    if (!validateFichero()) return;

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

    clientesDataInit[clienteId] = {
      ...(clientesDataInit[clienteId] ?? {
        nombre: c.nombre, direccion: c.direccion, localidad: c.localidad,
        telefono: c.telefono, email: c.email, dni: c.dni,
        fechaAlta: c.fechaAlta, estado: c.estado, historial: [],
      }),
      ficheroActual: {
        fecha: ficheroForm.fecha,
        vendedor: ficheroForm.vendedor,
        comision: comisionStr,
        items: itemsGuardados,
        total: formatCurrency(importeTotal),
        costos: {
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
        },
        pagos: [],
        cuotas: [],
      },
    };

    const now = new Date();
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const fechaDisplay = `${String(now.getDate()).padStart(2, "0")} ${meses[now.getMonth()]}, ${now.getFullYear()}`;

    clientesDataInit[clienteId].historial = [
      ...(clientesDataInit[clienteId].historial ?? []).map((h) => ({ ...h, isCurrent: false })),
      {
        fecha: fechaDisplay,
        vendedor: ficheroForm.vendedor.split(" ")[0] + " " + ficheroForm.vendedor.split(" ")[1]?.[0] + ".",
        articulos: `Fichero Actual: ${getFicheroResumen(ficheroForm.items)}`,
        importe: formatCurrency(importeTotal),
        isCurrent: true,
      },
    ];

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
  }

  // --- Pago handlers ---
  function handleOpenPagoModal(pago?: Pago) {
    if (pago) {
      setEditingPago(pago);
      setPagoForm({ fecha: pago.fecha, monto: String(pago.monto), metodo: pago.metodo, comprobante: pago.comprobante, observaciones: pago.observaciones });
    } else {
      setEditingPago(null);
      setPagoForm({ fecha: getCurrentDate(), monto: "", metodo: "Transferencia", comprobante: "", observaciones: "" });
    }
    setPagoErrors({});
    setShowPagoModal(true);
  }

  function handlePagoChange(field: string, value: string) {
    setPagoForm((prev) => ({ ...prev, [field]: value }));
    if (pagoErrors[field]) setPagoErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validatePago(): boolean {
    const errors: Record<string, string> = {};
    if (!pagoForm.fecha.trim()) errors.fecha = "Requerido";
    const monto = parseCurrencyInput(pagoForm.monto);
    if (monto <= 0) errors.monto = "Monto inválido";
    else if (!editingPago && monto > saldoPendiente) errors.monto = `No puede superar el saldo (${formatCurrency(saldoPendiente)})`;
    else if (editingPago && monto > saldoPendiente + editingPago.monto) errors.monto = `No puede superar el saldo (${formatCurrency(saldoPendiente + editingPago.monto)})`;
    if (!pagoForm.metodo) errors.metodo = "Requerido";
    setPagoErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleAddPago() {
    if (!validatePago()) return;
    if (!c.ficheroActual) return;

    const monto = parseCurrencyInput(pagoForm.monto);
    const pagosActualizados = editingPago
      ? c.ficheroActual.pagos.map((p) => p.id === editingPago.id ? { ...p, fecha: pagoForm.fecha, monto, metodo: pagoForm.metodo, comprobante: pagoForm.comprobante, observaciones: pagoForm.observaciones } : p)
      : [...c.ficheroActual.pagos, { id: Date.now(), fecha: pagoForm.fecha, monto, metodo: pagoForm.metodo, comprobante: pagoForm.comprobante, observaciones: pagoForm.observaciones }];

    clientesDataInit[clienteId]!.ficheroActual = { ...c.ficheroActual!, pagos: pagosActualizados };

    setShowPagoModal(false);
    setEditingPago(null);
    setPagoForm({ fecha: getCurrentDate(), monto: "", metodo: "Transferencia", comprobante: "", observaciones: "" });
    setPagoErrors({});
  }

  function handleRemovePago(pagoId: number) {
    if (!c.ficheroActual) return;
    clientesDataInit[clienteId]!.ficheroActual = {
      ...c.ficheroActual,
      pagos: c.ficheroActual.pagos.filter((p) => p.id !== pagoId),
    };
  }

  // --- Cuotas handlers ---
  const tieneCuotas = (c.ficheroActual?.cuotas.length ?? 0) > 0;

  function handleCreateCuotasPlan() {
    if (!c.ficheroActual) return;
    const total = parseCurrencyInput(c.ficheroActual.total);
    const montoPorCuota = Math.floor(total / cantCuotas);
    const montoUltima = total - montoPorCuota * (cantCuotas - 1);
    const cuotas: Cuota[] = [];
    const now = new Date();
    for (let i = 0; i < cantCuotas; i++) {
      const fecha = new Date(now);
      fecha.setMonth(fecha.getMonth() + i);
      const day = String(fecha.getDate()).padStart(2, "0");
      const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const fechaStr = `${day} ${months[fecha.getMonth()]}, ${fecha.getFullYear()}`;
      cuotas.push({
        id: Date.now() + i,
        nro: i + 1,
        fechaVencimiento: fechaStr,
        montoPlanificado: i === cantCuotas - 1 ? montoUltima : montoPorCuota,
        montoPagado: 0,
        fechaPago: null,
        metodo: null,
        comprobante: "",
        observaciones: "",
        estado: "Pendiente",
      });
    }
    clientesDataInit[clienteId]!.ficheroActual = { ...c.ficheroActual, cuotas, pagos: [] };
    setPagoMode("cuotas");
  }

  function handleRemoveCuotaPlan() {
    if (!c.ficheroActual) return;
    clientesDataInit[clienteId]!.ficheroActual = { ...c.ficheroActual, cuotas: [] };
    setPagoMode("libres");
  }

  function handleOpenEditCuota(cuota: Cuota) {
    setEditingCuota(cuota);
    setCuotaForm({ fechaVencimiento: cuota.fechaVencimiento, montoPlanificado: String(cuota.montoPlanificado) });
    setCuotaFormErrors({});
    setShowCuotaForm(true);
  }

  function handleSaveCuotaEdit() {
    if (!c.ficheroActual || !editingCuota) return;
    const errors: Record<string, string> = {};
    if (!cuotaForm.fechaVencimiento.trim()) errors.fechaVencimiento = "Requerido";
    const monto = parseCurrencyInput(cuotaForm.montoPlanificado);
    if (monto <= 0) errors.montoPlanificado = "Monto inválido";
    setCuotaFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const cuotas = c.ficheroActual.cuotas.map((cu) =>
      cu.id === editingCuota.id ? { ...cu, fechaVencimiento: cuotaForm.fechaVencimiento, montoPlanificado: monto } : cu
    );
    clientesDataInit[clienteId]!.ficheroActual = { ...c.ficheroActual, cuotas };
    setShowCuotaForm(false);
    setEditingCuota(null);
  }

  function handlePayCuota(cuotaId: number) {
    const cuota = c.ficheroActual?.cuotas.find((cu) => cu.id === cuotaId);
    if (!cuota) return;
    const saldoCuota = cuota.montoPlanificado - cuota.montoPagado;
    setEditingCuota(cuota);
    setPagoForm({ fecha: getCurrentDate(), monto: String(saldoCuota), metodo: "Transferencia", comprobante: "", observaciones: "" });
    setPagoErrors({});
    setShowPagoModal(true);
  }

  function handleAddPagoForCuota() {
    if (!validatePago() || !c.ficheroActual || !editingCuota) return;
    const monto = parseCurrencyInput(pagoForm.monto);
    const nuevoPagado = editingCuota.montoPagado + monto;
    const estado: "Pagada" | "Parcial" = nuevoPagado >= editingCuota.montoPlanificado ? "Pagada" : "Parcial";
    const cuotas = c.ficheroActual.cuotas.map((cu) =>
      cu.id === editingCuota.id
        ? { ...cu, montoPagado: nuevoPagado, fechaPago: pagoForm.fecha, metodo: pagoForm.metodo, comprobante: pagoForm.comprobante, observaciones: pagoForm.observaciones, estado }
        : cu
    );
    clientesDataInit[clienteId]!.ficheroActual = { ...c.ficheroActual, cuotas };
    setShowPagoModal(false);
    setEditingCuota(null);
    setPagoForm({ fecha: getCurrentDate(), monto: "", metodo: "Transferencia", comprobante: "", observaciones: "" });
    setPagoErrors({});
  }

  const totalCuotasPagado = c.ficheroActual?.cuotas.reduce((sum, cu) => sum + cu.montoPagado, 0) ?? 0;
  const totalCuotasPlanificado = c.ficheroActual?.cuotas.reduce((sum, cu) => sum + cu.montoPlanificado, 0) ?? 0;
  const saldoPendienteCuotas = ficheroTotal - totalCuotasPagado;
  const porcentajeCuotas = ficheroTotal > 0 ? (totalCuotasPagado / ficheroTotal) * 100 : 0;
  const estaPagadoCuotas = saldoPendienteCuotas <= 0;

  const ficheroInputClass = (field: string) =>
    `w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white ${ficheroErrors[field] ? "border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"}`;

  const pagoInputClass = (field: string) =>
    `w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white ${pagoErrors[field] ? "border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-[16px] w-[1400px] max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #e2e8f0" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-[24px] py-[20px] sticky top-0 bg-white z-10" style={{ borderBottom: "1px solid #e2e8f0" }}>
          <div>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">{c.nombre}</p>
            <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px] mt-[2px]">Ficha de cliente y desglose de cuenta activa</p>
          </div>
          <button onClick={onClose} className="flex items-center justify-center size-[32px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
            <svg fill="none" height="16" viewBox="0 0 16 16" width="16"><path d="M12 4L4 12M4 4L12 12" stroke="#64748b" strokeLinecap="round" strokeWidth="2" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-[24px]">
          <div className="bg-white rounded-t-[12px] flex" style={{ border: "1px solid #e2e8f0", borderBottom: "none" }}>
            <button onClick={() => setActiveTab("fichero")} className={`flex-1 py-[10px] text-center font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] transition-colors rounded-t-[12px] ${activeTab === "fichero" ? "text-[#0ea5e9] bg-white" : "text-[#94a3b8] bg-[#f8fafc] hover:text-[#64748b]"}`}>Fichero</button>
            <button onClick={() => setActiveTab("pagos")} className={`flex-1 py-[10px] text-center font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] transition-colors rounded-t-[12px] relative ${activeTab === "pagos" ? "text-[#0ea5e9] bg-white" : "text-[#94a3b8] bg-[#f8fafc] hover:text-[#64748b]"}`}>
              Pagos
              {!sinFichero && c.ficheroActual!.pagos.length > 0 && (
                <span className="ml-[4px] inline-flex items-center justify-center size-[16px] rounded-full bg-[#0ea5e9] text-white text-[9px] font-bold">{c.ficheroActual!.pagos.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-[24px] pt-0">
          <div className="bg-white p-[20px] rounded-b-[12px]" style={{ border: "1px solid #e2e8f0", borderTop: "none" }}>
            {activeTab === "fichero" ? (
              <div className="grid grid-cols-[1fr_340px] gap-[24px]">
                {/* Left: Info + Historial */}
                <div className="flex flex-col gap-[24px]">
                  {/* Info de Contacto */}
                  <div className="bg-[#f8fafc] p-[20px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
                    <div className="flex items-center justify-between mb-[16px]">
                      <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[15px]">Información de Contacto</p>
                      <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[11px] px-[8px] py-[3px] rounded-[6px]" style={estadoStyle[c.estado] ?? { bg: "#f1f5f9", color: "#64748b" }}>{c.estado}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-[14px]">
                      {[
                        { label: "Dirección", value: c.direccion },
                        { label: "Localidad", value: c.localidad },
                        { label: "Teléfono", value: c.telefono },
                        { label: "Email", value: c.email },
                        { label: "DNI/CUIT", value: c.dni },
                        { label: "Fecha Alta", value: c.fechaAlta },
                      ].map((f) => (
                        <div key={f.label}>
                          <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px]">{f.label}</p>
                          <p className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[13px] mt-[1px]">{f.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Historial */}
                  <div className="bg-[#f8fafc] p-[20px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
                    <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[15px] mb-[12px]">Historial de Ficheros / Pedidos</p>
                    {c.historial.length > 0 ? (
                      <>
                        <table className="w-full">
                          <thead>
                            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                              {["Fecha", "Vendedor", "Artículos", "Importe"].map((h) => (
                                <th key={h} className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[12px] py-[6px]">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {c.historial.map((row, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td className={`py-[10px] font-['Geist:Regular',sans-serif] text-[13px] ${row.isCurrent ? "text-[#0ea5e9] font-semibold" : "text-[#475569]"}`}>{row.fecha}</td>
                                <td className="py-[10px] font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">{row.vendedor}</td>
                                <td className={`py-[10px] font-['Geist:Regular',sans-serif] text-[13px] ${row.isCurrent ? "text-[#0f172a] font-semibold" : "text-[#475569]"}`}>{row.articulos}</td>
                                <td className="py-[10px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px] text-right">{row.importe}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {c.ficheroActual && (
                          <div className="mt-[10px] flex gap-[16px] bg-white p-[10px] rounded-[8px]">
                            <div>
                              <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[10px] uppercase tracking-wide">VENTA TOTAL</p>
                              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[13px] mt-[1px]">{c.ficheroActual.costos.venta}</p>
                            </div>
                            <div>
                              <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[10px] uppercase tracking-wide">COSTOS</p>
                              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#ef4444] text-[13px] mt-[1px]">{c.ficheroActual.costos.totalCostos}</p>
                            </div>
                            <div>
                              <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[10px] uppercase tracking-wide">MARGEN</p>
                              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0ea5e9] text-[13px] mt-[1px]">{c.ficheroActual.costos.margenNeto} <span className="text-[#475569] text-[11px]">{c.ficheroActual.costos.margenPct}</span></p>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="py-[24px] flex flex-col items-center justify-center">
                        <p className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[13px]">Sin historial de pedidos</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Fichero detail */}
                <div className="self-start">
                  {sinFichero ? (
                    <div className="py-[24px] flex flex-col items-center justify-center">
                      <p className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[13px]">Sin fichero activo</p>
                      <p className="font-['Geist:Regular',sans-serif] text-[#cbd5e1] text-[12px] mt-[2px] text-center mb-[12px]">Cargá el primer fichero</p>
                      <button onClick={() => setShowFicheroModal(true)} className="flex items-center gap-[6px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[12px] py-[7px] rounded-[8px]">
                        <svg fill="none" height="12" viewBox="0 0 16 16" width="12"><path d="M8 3.3328V12.6672M3.3328 8H12.6672" stroke="white" strokeLinecap="round" strokeWidth="2" /></svg>
                        Cargar Fichero
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-[6px] mb-[16px]">
                        {[
                          { label: "Fecha Pedido", value: c.ficheroActual!.fecha },
                          { label: "Vendedor", value: c.ficheroActual!.vendedor },
                          { label: "Comisión", value: c.ficheroActual!.comision, green: true },
                        ].map((row) => (
                          <div key={row.label} className="flex items-center justify-between">
                            <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">{row.label}</p>
                            <p className={`font-['Geist:Medium',sans-serif] font-medium text-[12px] ${row.green ? "text-[#0ea5e9]" : "text-[#0f172a]"}`}>{row.value}</p>
                          </div>
                        ))}
                      </div>
                      <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[12px] mb-[8px]">Artículos</p>
                      <div className="flex flex-col gap-[8px] mb-[14px]">
                        {c.ficheroActual!.items.map((item, i) => (
                          <div key={i} className="flex items-start justify-between">
                            <div>
                              <p className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[12px]">{item.desc}</p>
                              <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[10px] mt-[1px]">{item.cant}</p>
                            </div>
                            <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[12px]">{item.precio}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between py-[10px]" style={{ borderTop: "1px solid #e2e8f0" }}>
                        <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[13px]">Importe Total</p>
                        <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0ea5e9] text-[18px]">{c.ficheroActual!.total}</p>
                      </div>
                      <div className="bg-[#f8fafc] p-[12px] rounded-[8px] mt-[6px]">
                        <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#475569] text-[10px] uppercase tracking-wide mb-[8px]">Costos de Obra</p>
                        {[
                          { label: "Proveedor", value: c.ficheroActual!.costos.proveedor, color: "#0f172a" },
                          { label: "Piscina", value: c.ficheroActual!.costos.costoPiscina, color: "#ef4444" },
                          { label: "Instalación", value: c.ficheroActual!.costos.instalacion, color: "#ef4444" },
                          { label: "Equipo Filtrado", value: c.ficheroActual!.costos.equipoFiltrado, color: "#ef4444" },
                          { label: "M.O. Vereda", value: c.ficheroActual!.costos.manoObraVereda, color: c.ficheroActual!.costos.manoObraVereda === "No aplica" ? "#94a3b8" : "#ef4444" },
                          { label: "Comisión", value: c.ficheroActual!.costos.comision, color: "#ef4444" },
                        ].map((r) => (
                          <div key={r.label} className="flex items-center justify-between mb-[4px]">
                            <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">{r.label}</p>
                            <p className="font-['Geist:Medium',sans-serif] font-medium text-[12px]" style={{ color: r.color }}>{r.value}</p>
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-[6px] mt-[4px]" style={{ borderTop: "1px solid #e2e8f0" }}>
                          <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[12px]">Margen Neto</p>
                          <div className="flex items-center gap-[6px]">
                            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#10b981] text-[13px]">{c.ficheroActual!.costos.margenNeto}</p>
                            <span className="bg-[#d1fae5] text-[#10b981] font-['Geist:SemiBold',sans-serif] font-semibold text-[10px] px-[5px] py-[1px] rounded-[4px]">{c.ficheroActual!.costos.margenPct}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* TAB PAGOS */
              sinFichero ? (
                <div className="py-[24px] flex flex-col items-center justify-center">
                  <p className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[13px]">Sin fichero activo</p>
                  <p className="font-['Geist:Regular',sans-serif] text-[#cbd5e1] text-[12px] mt-[2px]">Creá un fichero primero</p>
                </div>
              ) : (
                <div className="flex flex-col gap-[20px]">
                  {/* Resumen */}
                  <div className="bg-[#f8fafc] p-[20px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
                    <div className="grid grid-cols-3 gap-[10px] mb-[12px]">
                      <div>
                        <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[10px] uppercase tracking-wide">Total Venta</p>
                        <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px] mt-[2px]">{c.ficheroActual!.total}</p>
                      </div>
                      <div>
                        <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[10px] uppercase tracking-wide">Pagado</p>
                        <p className="font-['Geist:Bold',sans-serif] font-bold text-[#10b981] text-[18px] mt-[2px]">{formatCurrency(pagoMode === "cuotas" ? totalCuotasPagado : totalPagado)}</p>
                      </div>
                      <div>
                        <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[10px] uppercase tracking-wide">Pendiente</p>
                        <p className={`font-['Geist:Bold',sans-serif] font-bold text-[18px] mt-[2px] ${(pagoMode === "cuotas" ? estaPagadoCuotas : estaPagado) ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                          {(pagoMode === "cuotas" ? estaPagadoCuotas : estaPagado) ? "$0" : formatCurrency(pagoMode === "cuotas" ? saldoPendienteCuotas : saldoPendiente)}
                        </p>
                      </div>
                    </div>
                    <div className="w-full h-[8px] bg-[#e2e8f0] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pagoMode === "cuotas" ? porcentajeCuotas : porcentajePagado, 100)}%`, backgroundColor: (pagoMode === "cuotas" ? estaPagadoCuotas : estaPagado) ? "#10b981" : "#0ea5e9" }} />
                    </div>
                    <div className="flex items-center justify-between mt-[6px]">
                      <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">{(pagoMode === "cuotas" ? porcentajeCuotas : porcentajePagado).toFixed(1)}% pagado</p>
                      {(pagoMode === "cuotas" ? estaPagadoCuotas : estaPagado) && <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[11px] px-[8px] py-[2px] rounded-[4px] bg-[#d1fae5] text-[#10b981]">Totalmente pagado</span>}
                    </div>
                  </div>

                  {/* Toggle Modo */}
                  <div className="flex items-center gap-[10px]">
                    <button onClick={() => !tieneCuotas && setPagoMode("libres")} className={`px-[14px] py-[8px] rounded-[8px] font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] transition-colors ${pagoMode === "libres" ? "bg-[#0ea5e9] text-white" : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"}`}>Pagos Libres</button>
                    <button onClick={() => !tieneCuotas && setPagoMode("cuotas")} className={`px-[14px] py-[8px] rounded-[8px] font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] transition-colors ${pagoMode === "cuotas" ? "bg-[#0ea5e9] text-white" : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"}`}>Plan de Cuotas</button>
                  </div>

                  {/* === MODO PAGOS LIBRES === */}
                  {pagoMode === "libres" && (
                    <>
                      {!estaPagado && (
                        <button onClick={() => { setEditingCuota(null); handleOpenPagoModal(); }} className="w-full flex items-center justify-center gap-[6px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] px-[14px] py-[10px] rounded-[8px]">
                          <svg fill="none" height="12" viewBox="0 0 16 16" width="12"><path d="M8 3.3328V12.6672M3.3328 8H12.6672" stroke="white" strokeLinecap="round" strokeWidth="2" /></svg>
                          Registrar Pago
                        </button>
                      )}
                      {c.ficheroActual!.pagos.length > 0 ? (
                        <div className="rounded-[10px] overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
                          <table className="w-full">
                            <thead>
                              <tr className="bg-[#f8fafc]" style={{ borderBottom: "1px solid #e2e8f0" }}>
                                <th className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[11px] uppercase tracking-wide px-[14px] py-[10px]">#</th>
                                <th className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[11px] uppercase tracking-wide px-[14px] py-[10px]">Fecha</th>
                                <th className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[11px] uppercase tracking-wide px-[14px] py-[10px]">Concepto</th>
                                <th className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[11px] uppercase tracking-wide px-[14px] py-[10px]">Método</th>
                                <th className="text-right font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[11px] uppercase tracking-wide px-[14px] py-[10px]">Monto Pagado</th>
                                <th className="text-right font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[11px] uppercase tracking-wide px-[14px] py-[10px]">Saldo</th>
                                <th className="w-[70px]"></th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td className="px-[14px] py-[10px] font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]"></td>
                                <td className="px-[14px] py-[10px] font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">{c.ficheroActual!.fecha}</td>
                                <td className="px-[14px] py-[10px] font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[12px]">Saldo inicial</td>
                                <td className="px-[14px] py-[10px]"></td>
                                <td className="px-[14px] py-[10px] text-right"></td>
                                <td className="px-[14px] py-[10px] font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[13px] text-right">{c.ficheroActual!.total}</td>
                                <td></td>
                              </tr>
                              {(() => {
                                let saldo = ficheroTotal;
                                return c.ficheroActual!.pagos.map((pago, i) => {
                                  saldo -= pago.monto;
                                  return (
                                    <tr key={pago.id} className="group hover:bg-[#f8fafc] transition-colors" style={{ borderBottom: "1px solid #f1f5f9" }}>
                                      <td className="px-[14px] py-[10px] font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[12px]">{i + 1}</td>
                                      <td className="px-[14px] py-[10px] font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">{pago.fecha}</td>
                                      <td className="px-[14px] py-[10px] font-['Geist:Regular',sans-serif] text-[#0f172a] text-[12px]">{pago.observaciones || "—"}</td>
                                      <td className="px-[14px] py-[10px]">
                                        <span className="font-['Geist:Regular',sans-serif] text-[10px] px-[6px] py-[2px] rounded-[4px]" style={{ backgroundColor: `${metodoColor[pago.metodo]}20`, color: metodoColor[pago.metodo] }}>{pago.metodo}</span>
                                      </td>
                                      <td className="px-[14px] py-[10px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#10b981] text-[13px] text-right">{formatCurrency(pago.monto)}</td>
                                      <td className="px-[14px] py-[10px] font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[13px] text-right">{formatCurrency(saldo)}</td>
                                      <td className="px-[14px] py-[10px]">
                                        <div className="flex items-center gap-[2px] opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                          <button onClick={() => handleOpenPagoModal(pago)} className="size-[24px] flex items-center justify-center rounded-[6px] hover:bg-white transition-colors">
                                            <svg fill="none" height="11" viewBox="0 0 16 16" width="11"><path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="#64748b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
                                          </button>
                                          <button onClick={() => handleRemovePago(pago.id)} className="size-[24px] flex items-center justify-center rounded-[6px] hover:bg-[#fee2e2] transition-colors">
                                            <svg fill="none" height="11" viewBox="0 0 16 16" width="11"><path d="M2 4H14M5 4V2H11V4M6 7V12M10 7V12M3 4L4 14H12L13 4" stroke="#ef4444" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                });
                              })()}
                              <tr className="bg-[#f8fafc]" style={{ borderTop: "2px solid #e2e8f0" }}>
                                <td colSpan={4} className="px-[14px] py-[12px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[12px] uppercase">Total Pagado</td>
                                <td className="px-[14px] py-[12px] font-['Geist:Bold',sans-serif] font-bold text-[#10b981] text-[14px] text-right">{formatCurrency(totalPagado)}</td>
                                <td className="px-[14px] py-[12px] font-['Geist:Bold',sans-serif] font-bold text-[14px] text-right" style={{ color: estaPagado ? "#10b981" : "#ef4444" }}>{estaPagado ? "$0" : formatCurrency(saldoPendiente)}</td>
                                <td></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-[20px] flex flex-col items-center justify-center">
                          <p className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[13px]">Sin pagos registrados</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* === MODO CUOTAS === */}
                  {pagoMode === "cuotas" && (
                    <>
                      {!tieneCuotas ? (
                        <div className="py-[16px] flex flex-col items-center justify-center gap-[12px]">
                          <p className="font-['Geist:Medium',sans-serif] font-medium text-[#64748b] text-[13px]">No hay plan de cuotas activo</p>
                          <div className="flex items-center gap-[10px]">
                            <select value={cantCuotas} onChange={(e) => setCantCuotas(Number(e.target.value))} className="font-['Geist:Regular',sans-serif] text-[13px] text-[#0f172a] px-[12px] py-[8px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] bg-white">
                              {[1,2,3,4,5,6,7,8,9,10,11,12].map((n) => <option key={n} value={n}>{n} cuota{n > 1 ? "s" : ""}</option>)}
                            </select>
                            <button onClick={handleCreateCuotasPlan} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[14px] py-[8px] rounded-[8px]">Crear Plan</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">Plan de Cuotas ({c.ficheroActual!.cuotas.length} cuotas)</p>
                            <button onClick={handleRemoveCuotaPlan} className="font-['Geist:Medium',sans-serif] font-medium text-[12px] text-[#ef4444] hover:text-[#dc2626] transition-colors px-[10px] py-[6px] rounded-[6px] hover:bg-[#fee2e2]">Eliminar Plan</button>
                          </div>
                          <div className="rounded-[10px] overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
                            <table className="w-full">
                              <thead>
                                <tr className="bg-[#f8fafc]" style={{ borderBottom: "1px solid #e2e8f0" }}>
                                  <th className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[11px] uppercase tracking-wide px-[14px] py-[10px]">Cuota</th>
                                  <th className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[11px] uppercase tracking-wide px-[14px] py-[10px]">Vence</th>
                                  <th className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[11px] uppercase tracking-wide px-[14px] py-[10px]">Monto Planificado</th>
                                  <th className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[11px] uppercase tracking-wide px-[14px] py-[10px]">Monto Pagado</th>
                                  <th className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[11px] uppercase tracking-wide px-[14px] py-[10px]">Estado</th>
                                  <th className="w-[110px]"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {c.ficheroActual!.cuotas.map((cuota) => (
                                  <tr key={cuota.id} className="group hover:bg-[#f8fafc] transition-colors" style={{ borderBottom: "1px solid #f1f5f9" }}>
                                    <td className="px-[14px] py-[10px] font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[13px]">{cuota.nro}</td>
                                    <td className="px-[14px] py-[10px] font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">{cuota.fechaVencimiento}</td>
                                    <td className="px-[14px] py-[10px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px]">{formatCurrency(cuota.montoPlanificado)}</td>
                                    <td className="px-[14px] py-[10px]">
                                      <span className={`font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] ${cuota.montoPagado > 0 ? "text-[#10b981]" : "text-[#94a3b8]"}`}>{cuota.montoPagado > 0 ? formatCurrency(cuota.montoPagado) : "—"}</span>
                                    </td>
                                    <td className="px-[14px] py-[10px]">
                                      <span className={`font-['Geist:SemiBold',sans-serif] font-semibold text-[10px] px-[8px] py-[2px] rounded-[4px] ${cuota.estado === "Pagada" ? "bg-[#d1fae5] text-[#10b981]" : cuota.estado === "Parcial" ? "bg-[#fef3c7] text-[#f59e0b]" : "bg-[#f1f5f9] text-[#94a3b8]"}`}>
                                        {cuota.estado === "Pagada" ? "Pagada" : cuota.estado === "Parcial" ? "Parcial" : "Pendiente"}
                                      </span>
                                    </td>
                                    <td className="px-[14px] py-[10px]">
                                      <div className="flex items-center gap-[4px] opacity-0 group-hover:opacity-100 transition-opacity">
                                        {cuota.estado !== "Pagada" && (
                                          <button onClick={() => handlePayCuota(cuota.id)} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[10px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[8px] py-[4px] rounded-[6px]">Pagar</button>
                                        )}
                                        <button onClick={() => handleOpenEditCuota(cuota)} className="size-[24px] flex items-center justify-center rounded-[6px] hover:bg-[#f1f5f9] transition-colors">
                                          <svg fill="none" height="11" viewBox="0 0 16 16" width="11"><path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="#64748b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-[#f8fafc]" style={{ borderTop: "2px solid #e2e8f0" }}>
                                  <td colSpan={2} className="px-[14px] py-[12px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[12px] uppercase">Totales</td>
                                  <td className="px-[14px] py-[12px] font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[14px]">{formatCurrency(totalCuotasPlanificado)}</td>
                                  <td className="px-[14px] py-[12px] font-['Geist:Bold',sans-serif] font-bold text-[#10b981] text-[14px]">{formatCurrency(totalCuotasPagado)}</td>
                                  <td colSpan={2} className="px-[14px] py-[12px] font-['Geist:Bold',sans-serif] font-bold text-[14px]" style={{ color: estaPagadoCuotas ? "#10b981" : "#ef4444" }}>{estaPagadoCuotas ? "SALDO CANCELADO" : `Pendiente: ${formatCurrency(saldoPendienteCuotas)}`}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Modal Registrar Pago (superpuesto) */}
      {showPagoModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPagoModal(false)} />
          <div className="relative bg-white rounded-[16px] w-[480px] max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between px-[24px] py-[18px]" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">{editingPago ? "Editar Pago" : "Registrar Pago"}</p>
              <button onClick={() => setShowPagoModal(false)} className="flex items-center justify-center size-[28px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
                <svg fill="none" height="14" viewBox="0 0 16 16" width="14"><path d="M12 4L4 12M4 4L12 12" stroke="#64748b" strokeLinecap="round" strokeWidth="2" /></svg>
              </button>
            </div>
            <div className="px-[24px] py-[18px] flex flex-col gap-[14px]">
              <div className="grid grid-cols-2 gap-[10px]">
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[12px] mb-[4px] block">Fecha *</label>
                  <input type="text" value={pagoForm.fecha} onChange={(e) => handlePagoChange("fecha", e.target.value)} className={pagoInputClass("fecha")} style={{ border: `1px solid ${pagoErrors.fecha ? "#ef4444" : "#e2e8f0"}` }} />
                  {pagoErrors.fecha && <p className="text-[#ef4444] text-[11px] mt-[3px]">{pagoErrors.fecha}</p>}
                </div>
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[12px] mb-[4px] block">Monto *</label>
                  <input type="text" value={pagoForm.monto} onChange={(e) => handlePagoChange("monto", e.target.value)} placeholder="$ 0" className={pagoInputClass("monto")} style={{ border: `1px solid ${pagoErrors.monto ? "#ef4444" : "#e2e8f0"}` }} />
                  {pagoErrors.monto && <p className="text-[#ef4444] text-[11px] mt-[3px]">{pagoErrors.monto}</p>}
                </div>
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[12px] mb-[4px] block">Método de Pago *</label>
                <select value={pagoForm.metodo} onChange={(e) => handlePagoChange("metodo", e.target.value)} className={pagoInputClass("metodo")} style={{ border: `1px solid ${pagoErrors.metodo ? "#ef4444" : "#e2e8f0"}` }}>
                  {metodosPago.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[12px] mb-[4px] block">Nro. Comprobante</label>
                <input type="text" value={pagoForm.comprobante} onChange={(e) => handlePagoChange("comprobante", e.target.value)} placeholder="Opcional" className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[12px] mb-[4px] block">Observaciones</label>
                <input type="text" value={pagoForm.observaciones} onChange={(e) => handlePagoChange("observaciones", e.target.value)} placeholder="Opcional" className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
              </div>
              {pagoForm.monto && parseCurrencyInput(pagoForm.monto) > 0 && (
                <div className="bg-[#f8fafc] p-[10px] rounded-[8px]">
                  <div className="flex items-center justify-between">
                    <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">Saldo después del pago</p>
                    <p className={`font-['Geist:Bold',sans-serif] font-bold text-[14px] ${saldoDespuesPago <= 0 ? "text-[#10b981]" : "text-[#0f172a]"}`}>{saldoDespuesPago <= 0 ? "$0" : formatCurrency(saldoDespuesPago)}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-[10px] px-[24px] py-[18px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setShowPagoModal(false)} className="font-['Geist:Medium',sans-serif] font-medium text-[13px] text-[#475569] px-[14px] py-[9px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={editingCuota && !editingPago ? handleAddPagoForCuota : handleAddPago} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[14px] py-[9px] rounded-[8px]">{editingPago ? "Guardar" : "Registrar Pago"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Cuota (superpuesto) */}
      {showCuotaForm && editingCuota && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCuotaForm(false)} />
          <div className="relative bg-white rounded-[16px] w-[420px]" style={{ border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between px-[24px] py-[18px]" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">Editar Cuota {editingCuota.nro}</p>
              <button onClick={() => setShowCuotaForm(false)} className="flex items-center justify-center size-[28px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
                <svg fill="none" height="14" viewBox="0 0 16 16" width="14"><path d="M12 4L4 12M4 4L12 12" stroke="#64748b" strokeLinecap="round" strokeWidth="2" /></svg>
              </button>
            </div>
            <div className="px-[24px] py-[18px] flex flex-col gap-[14px]">
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[12px] mb-[4px] block">Fecha de Vencimiento *</label>
                <input type="text" value={cuotaForm.fechaVencimiento} onChange={(e) => setCuotaForm((prev) => ({ ...prev, fechaVencimiento: e.target.value }))} className={`w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white ${cuotaFormErrors.fechaVencimiento ? "border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"}`} style={{ border: `1px solid ${cuotaFormErrors.fechaVencimiento ? "#ef4444" : "#e2e8f0"}` }} />
                {cuotaFormErrors.fechaVencimiento && <p className="text-[#ef4444] text-[11px] mt-[3px]">{cuotaFormErrors.fechaVencimiento}</p>}
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[12px] mb-[4px] block">Monto Planificado *</label>
                <input type="text" value={cuotaForm.montoPlanificado} onChange={(e) => setCuotaForm((prev) => ({ ...prev, montoPlanificado: e.target.value }))} placeholder="$ 0" className={`w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white ${cuotaFormErrors.montoPlanificado ? "border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"}`} style={{ border: `1px solid ${cuotaFormErrors.montoPlanificado ? "#ef4444" : "#e2e8f0"}` }} />
                {cuotaFormErrors.montoPlanificado && <p className="text-[#ef4444] text-[11px] mt-[3px]">{cuotaFormErrors.montoPlanificado}</p>}
              </div>
              <div className="bg-[#f8fafc] p-[10px] rounded-[8px]">
                <div className="flex items-center justify-between">
                  <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">Pagado hasta ahora</p>
                  <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#10b981] text-[13px]">{formatCurrency(editingCuota.montoPagado)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-[10px] px-[24px] py-[18px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setShowCuotaForm(false)} className="font-['Geist:Medium',sans-serif] font-medium text-[13px] text-[#475569] px-[14px] py-[9px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handleSaveCuotaEdit} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[14px] py-[9px] rounded-[8px]">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cargar Fichero (superpuesto) */}
      {showFicheroModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowFicheroModal(false)} />
          <div className="relative bg-white rounded-[16px] w-[680px] max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between px-[24px] py-[18px]" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">Cargar Nuevo Fichero</p>
              <button onClick={() => setShowFicheroModal(false)} className="flex items-center justify-center size-[28px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
                <svg fill="none" height="14" viewBox="0 0 16 16" width="14"><path d="M12 4L4 12M4 4L12 12" stroke="#64748b" strokeLinecap="round" strokeWidth="2" /></svg>
              </button>
            </div>
            <div className="px-[24px] py-[18px] flex flex-col gap-[16px]">
              <div className="grid grid-cols-3 gap-[10px]">
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[12px] mb-[4px] block">Fecha *</label>
                  <input type="text" value={ficheroForm.fecha} onChange={(e) => handleFicheroChange("fecha", e.target.value)} className={ficheroInputClass("fecha")} style={{ border: `1px solid ${ficheroErrors.fecha ? "#ef4444" : "#e2e8f0"}` }} />
                </div>
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[12px] mb-[4px] block">Vendedor *</label>
                  <select value={ficheroForm.vendedor} onChange={(e) => handleFicheroChange("vendedor", e.target.value)} className={ficheroInputClass("vendedor")} style={{ border: `1px solid ${ficheroErrors.vendedor ? "#ef4444" : "#e2e8f0"}` }}>
                    {vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[12px] mb-[4px] block">Comisión (%)</label>
                  <input type="text" value={ficheroForm.comisionPct} onChange={(e) => handleFicheroChange("comisionPct", e.target.value)} className={ficheroInputClass("comisionPct")} style={{ border: "1px solid #e2e8f0" }} />
                </div>
              </div>

              <div>
                <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px] mb-[8px]">Artículos *</p>
                {ficheroErrors.items && <p className="text-[#ef4444] text-[11px] mb-[6px]">{ficheroErrors.items}</p>}
                <div className="flex flex-col gap-[8px]">
                  {ficheroForm.items.map((item, i) => (
                    <div key={i} className="grid grid-cols-[1fr_80px_120px_32px] gap-[6px] items-start">
                      <div>
                        <input type="text" value={item.desc} onChange={(e) => handleItemChange(i, "desc", e.target.value)} placeholder="Descripción" className={ficheroInputClass(`item_${i}_desc`)} style={{ border: `1px solid ${ficheroErrors[`item_${i}_desc`] ? "#ef4444" : "#e2e8f0"}` }} />
                      </div>
                      <div>
                        <input type="text" value={item.cant} onChange={(e) => handleItemChange(i, "cant", e.target.value)} placeholder="Cant." className={ficheroInputClass(`item_${i}_cant`)} style={{ border: "1px solid #e2e8f0" }} />
                      </div>
                      <div>
                        <input type="text" value={item.precioUnitario} onChange={(e) => handleItemChange(i, "precioUnitario", e.target.value)} placeholder="$ Precio" className={ficheroInputClass(`item_${i}_precioUnitario`)} style={{ border: `1px solid ${ficheroErrors[`item_${i}_precioUnitario`] ? "#ef4444" : "#e2e8f0"}` }} />
                      </div>
                      <div className="flex items-center justify-center pt-[2px]">
                        {ficheroForm.items.length > 1 && (
                          <button onClick={() => handleRemoveItem(i)} className="size-[28px] flex items-center justify-center rounded-[6px] hover:bg-[#fee2e2] transition-colors">
                            <svg fill="none" height="12" viewBox="0 0 16 16" width="12"><path d="M2 4H14M5 4V2H11V4M6 7V12M10 7V12M3 4L4 14H12L13 4" stroke="#ef4444" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={handleAddItem} className="mt-[6px] flex items-center gap-[4px] text-[#0ea5e9] text-[12px] font-['Geist:Medium',sans-serif] font-medium hover:text-[#0284c7]">
                  <svg fill="none" height="10" viewBox="0 0 16 16" width="10"><path d="M8 3.3328V12.6672M3.3328 8H12.6672" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>
                  Agregar artículo
                </button>
              </div>

              {/* Costos */}
              <div className="bg-[#f8fafc] p-[14px] rounded-[8px]">
                <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#475569] text-[12px] uppercase tracking-wide mb-[10px]">Costos de Obra</p>
                <div className="grid grid-cols-2 gap-[10px]">
                  <div>
                    <label className="font-['Geist:Regular',sans-serif] text-[#475569] text-[11px] mb-[2px] block">Proveedor Piscina</label>
                    <select value={ficheroForm.proveedorPiscina} onChange={(e) => handleFicheroChange("proveedorPiscina", e.target.value)} className="w-full font-['Geist:Regular',sans-serif] text-[13px] text-[#0f172a] px-[10px] py-[7px] rounded-[6px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] bg-white">
                      {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razonSocial}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-['Geist:Regular',sans-serif] text-[#475569] text-[11px] mb-[2px] block">Costo Piscina</label>
                    <input type="text" value={ficheroForm.costoPiscina} onChange={(e) => handleFicheroChange("costoPiscina", e.target.value)} placeholder="$ 0" className="w-full font-['Geist:Regular',sans-serif] text-[13px] text-[#0f172a] px-[10px] py-[7px] rounded-[6px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] bg-white" />
                  </div>
                  <div>
                    <label className="font-['Geist:Regular',sans-serif] text-[#475569] text-[11px] mb-[2px] block">Instalación</label>
                    <input type="text" value={ficheroForm.costoInstalacion} onChange={(e) => handleFicheroChange("costoInstalacion", e.target.value)} placeholder="$ 0" className="w-full font-['Geist:Regular',sans-serif] text-[13px] text-[#0f172a] px-[10px] py-[7px] rounded-[6px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] bg-white" />
                  </div>
                  <div>
                    <label className="font-['Geist:Regular',sans-serif] text-[#475569] text-[11px] mb-[2px] block">Equipo de Filtrado</label>
                    <input type="text" value={ficheroForm.equipoFiltrado} onChange={(e) => handleFicheroChange("equipoFiltrado", e.target.value)} placeholder="$ 0" className="w-full font-['Geist:Regular',sans-serif] text-[13px] text-[#0f172a] px-[10px] py-[7px] rounded-[6px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] bg-white" />
                  </div>
                </div>
                <div className="mt-[10px] flex items-center gap-[8px]">
                  <input type="checkbox" checked={ficheroForm.manoObraVereda} onChange={(e) => handleFicheroChange("manoObraVereda", e.target.checked)} className="size-[14px] accent-[#0ea5e9]" />
                  <label className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">Incluir Mano de Obra Vereda</label>
                </div>
                {ficheroForm.manoObraVereda && (
                  <div className="mt-[6px]">
                    <label className="font-['Geist:Regular',sans-serif] text-[#475569] text-[11px] mb-[2px] block">Costo M.O. Vereda</label>
                    <input type="text" value={ficheroForm.costoManoObra} onChange={(e) => handleFicheroChange("costoManoObra", e.target.value)} placeholder="$ 0" className="w-full font-['Geist:Regular',sans-serif] text-[13px] text-[#0f172a] px-[10px] py-[7px] rounded-[6px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] bg-white" />
                  </div>
                )}
              </div>

              {/* Resumen */}
              <div className="bg-[#f0f9ff] p-[12px] rounded-[8px]">
                <div className="grid grid-cols-2 gap-[6px]">
                  <div className="flex items-center justify-between">
                    <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">Importe Total</p>
                    <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[13px]">{formatCurrency(importeTotal)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">Total Costos</p>
                    <p className="font-['Geist:Bold',sans-serif] font-bold text-[#ef4444] text-[13px]">{formatCurrency(totalCostos)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">Comisión Vendedor</p>
                    <p className="font-['Geist:Medium',sans-serif] font-medium text-[#ef4444] text-[12px]">{formatCurrency(comisionDolar)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">Margen Neto</p>
                    <p className="font-['Geist:Bold',sans-serif] font-bold text-[#10b981] text-[13px]">{formatCurrency(margenNeto)} <span className="text-[11px] text-[#475569]">({margenPct.toFixed(1)}%)</span></p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-[10px] px-[24px] py-[18px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setShowFicheroModal(false)} className="font-['Geist:Medium',sans-serif] font-medium text-[13px] text-[#475569] px-[14px] py-[9px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handleGuardarFichero} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[14px] py-[9px] rounded-[8px]">Guardar Fichero</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
