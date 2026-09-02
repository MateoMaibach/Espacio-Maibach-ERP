import { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import { proveedores } from "@/data/proveedores";
import {
  clientesDataInit, estadoStyle, vendedores, metodosPago, metodoColor,
  formatCurrency, parseCurrencyInput, getCurrentDate, getFicheroResumen,
  type FicheroItem, type FicheroForm, type Pago, type FicheroGuardado, type HistorialEntry,
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
  ultimoPedido: string;
}

export default function ClienteDetalle() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const stateCliente = (location.state as { cliente?: ClienteState } | null)?.cliente;

  const clienteData = clientesDataInit[id ?? "1"];
  const tieneDatosCompletos = !!clienteData;

  const cliente = tieneDatosCompletos
    ? clienteData
    : stateCliente
      ? {
          nombre: stateCliente.nombre,
          direccion: stateCliente.direccion || "-",
          localidad: stateCliente.localidad,
          telefono: stateCliente.telefono,
          email: stateCliente.email || "-",
          dni: stateCliente.dni,
          fechaAlta: stateCliente.fechaAlta,
          estado: stateCliente.estado,
          ficheroActual: null,
          historial: [],
        }
      : clientesDataInit["1"]!;

  const sinFichero = !cliente.ficheroActual;

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
  });
  const [ficheroErrors, setFicheroErrors] = useState<Record<string, string>>({});

  // Pago modal states
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

  // Pago calculated values
  const ficheroTotal = cliente.ficheroActual ? parseCurrencyInput(cliente.ficheroActual.total) : 0;
  const totalPagado = cliente.ficheroActual?.pagos.reduce((sum, p) => sum + p.monto, 0) ?? 0;
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

    const nuevoFichero: FicheroGuardado = {
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
    };

    const now = new Date();
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const fechaDisplay = `${String(now.getDate()).padStart(2, "0")} ${meses[now.getMonth()]}, ${now.getFullYear()}`;

    const nuevoHistorialEntry: HistorialEntry = {
      fecha: fechaDisplay,
      vendedor: ficheroForm.vendedor.split(" ")[0] + " " + ficheroForm.vendedor.split(" ")[1]?.[0] + ".",
      articulos: `Fichero Actual: ${getFicheroResumen(ficheroForm.items)}`,
      importe: formatCurrency(importeTotal),
      isCurrent: true,
    };

    if (tieneDatosCompletos) {
      clientesDataInit[id ?? "1"]!.historial = clientesDataInit[id ?? "1"]!.historial.map((h) => ({
        ...h,
        isCurrent: false,
      }));
      clientesDataInit[id ?? "1"]!.ficheroActual = nuevoFichero;
      clientesDataInit[id ?? "1"]!.historial.push(nuevoHistorialEntry);
    }

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
    });
    setFicheroErrors({});
  }

  function handleCloseFicheroModal() {
    setShowFicheroModal(false);
    setFicheroErrors({});
  }

  // --- Pago handlers ---
  function handleOpenPagoModal(pago?: Pago) {
    if (pago) {
      setEditingPago(pago);
      setPagoForm({
        fecha: pago.fecha,
        monto: String(pago.monto),
        metodo: pago.metodo,
        comprobante: pago.comprobante,
        observaciones: pago.observaciones,
      });
    } else {
      setEditingPago(null);
      setPagoForm({
        fecha: getCurrentDate(),
        monto: "",
        metodo: "Transferencia",
        comprobante: "",
        observaciones: "",
      });
    }
    setPagoErrors({});
    setShowPagoModal(true);
  }

  function handleClosePagoModal() {
    setShowPagoModal(false);
    setEditingPago(null);
    setPagoErrors({});
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
    if (!tieneDatosCompletos || !cliente.ficheroActual) return;

    const monto = parseCurrencyInput(pagoForm.monto);

    if (editingPago) {
      const pagosActualizados = cliente.ficheroActual.pagos.map((p) =>
        p.id === editingPago.id
          ? { ...p, fecha: pagoForm.fecha, monto, metodo: pagoForm.metodo, comprobante: pagoForm.comprobante, observaciones: pagoForm.observaciones }
          : p
      );
      clientesDataInit[id ?? "1"]!.ficheroActual = { ...cliente.ficheroActual, pagos: pagosActualizados };
    } else {
      const nuevoPago: Pago = {
        id: Date.now(),
        fecha: pagoForm.fecha,
        monto,
        metodo: pagoForm.metodo,
        comprobante: pagoForm.comprobante,
        observaciones: pagoForm.observaciones,
      };
      clientesDataInit[id ?? "1"]!.ficheroActual = {
        ...cliente.ficheroActual,
        pagos: [...cliente.ficheroActual.pagos, nuevoPago],
      };
    }

    setShowPagoModal(false);
    setEditingPago(null);
    setPagoForm({ fecha: getCurrentDate(), monto: "", metodo: "Transferencia", comprobante: "", observaciones: "" });
    setPagoErrors({});
  }

  function handleRemovePago(pagoId: number) {
    if (!tieneDatosCompletos || !cliente.ficheroActual) return;
    clientesDataInit[id ?? "1"]!.ficheroActual = {
      ...cliente.ficheroActual,
      pagos: cliente.ficheroActual.pagos.filter((p) => p.id !== pagoId),
    };
  }

  const ficheroInputClass = (field: string) =>
    `w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white ${
      ficheroErrors[field] ? "border-[#ef4444] focus:border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"
    }`;

  const pagoInputClass = (field: string) =>
    `w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white ${
      pagoErrors[field] ? "border-[#ef4444] focus:border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"
    }`;

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
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[24px]">{cliente.nombre}</p>
            <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[14px] mt-[2px]">Ficha de cliente y desglose de cuenta activa</p>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_340px] gap-[24px]">
          {/* Left */}
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

            {/* Historial */}
            <div className="bg-white p-[24px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px] mb-[16px]">Historial de Ficheros / Pedidos</p>
              {cliente.historial.length > 0 ? (
                <>
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        {["Fecha", "Vendedor", "Artículos", "Importe Total"].map((h) => (
                          <th key={h} className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] py-[8px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cliente.historial.map((row, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td className={`py-[14px] font-['Geist:Regular',sans-serif] text-[14px] ${row.isCurrent ? "text-[#0ea5e9] font-semibold" : "text-[#475569]"}`}>{row.fecha}</td>
                          <td className="py-[14px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{row.vendedor}</td>
                          <td className={`py-[14px] font-['Geist:Regular',sans-serif] text-[14px] ${row.isCurrent ? "text-[#0f172a] font-semibold" : "text-[#475569]"}`}>{row.articulos}</td>
                          <td className="py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px] text-right">{row.importe}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {cliente.ficheroActual && (
                    <div className="mt-[12px] flex gap-[16px] bg-[#f8fafc] p-[12px] rounded-[8px]">
                      <div>
                        <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px] uppercase tracking-wide">VENTA TOTAL</p>
                        <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[14px] mt-[2px]">{cliente.ficheroActual.costos.venta}</p>
                      </div>
                      <div>
                        <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px] uppercase tracking-wide">COSTOS TOTALES</p>
                        <p className="font-['Geist:Bold',sans-serif] font-bold text-[#ef4444] text-[14px] mt-[2px]">{cliente.ficheroActual.costos.totalCostos}</p>
                      </div>
                      <div>
                        <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px] uppercase tracking-wide">MARGEN NETO</p>
                        <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0ea5e9] text-[14px] mt-[2px]">{cliente.ficheroActual.costos.margenNeto} <span className="text-[#475569] text-[12px]">{cliente.ficheroActual.costos.margenPct}</span></p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-[32px] flex flex-col items-center justify-center">
                  <svg fill="none" height="40" viewBox="0 0 40 40" width="40" className="mb-[12px]">
                    <rect x="4" y="6" width="32" height="28" rx="4" stroke="#cbd5e1" strokeWidth="2" />
                    <path d="M12 20H28M12 26H20" stroke="#cbd5e1" strokeLinecap="round" strokeWidth="2" />
                  </svg>
                  <p className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[14px]">Sin historial de pedidos</p>
                  <p className="font-['Geist:Regular',sans-serif] text-[#cbd5e1] text-[13px] mt-[4px]">Los ficheros y pedidos aparecerán aquí</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Tabs Fichero / Pagos */}
          <div className="self-start">
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
                Pagos
                {!sinFichero && cliente.ficheroActual!.pagos.length > 0 && (
                  <span className="ml-[6px] inline-flex items-center justify-center size-[18px] rounded-full bg-[#0ea5e9] text-white text-[10px] font-bold">
                    {cliente.ficheroActual!.pagos.length}
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
                        { label: "Fecha de Pedido", value: cliente.ficheroActual!.fecha },
                        { label: "Vendedor", value: cliente.ficheroActual!.vendedor },
                        { label: "Comisión Venta", value: cliente.ficheroActual!.comision, green: true },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between">
                          <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">{row.label}</p>
                          <p className={`font-['Geist:Medium',sans-serif] font-medium text-[13px] ${row.green ? "text-[#0ea5e9]" : "text-[#0f172a]"}`}>{row.value}</p>
                        </div>
                      ))}
                    </div>
                    <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px] mb-[12px]">Artículos</p>
                    <div className="flex flex-col gap-[10px] mb-[20px]">
                      {cliente.ficheroActual!.items.map((item, i) => (
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
                      <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0ea5e9] text-[22px]">{cliente.ficheroActual!.total}</p>
                    </div>
                    <div className="bg-[#f8fafc] p-[14px] rounded-[8px] mt-[8px]">
                      <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#475569] text-[11px] uppercase tracking-wide mb-[10px]">DESGLOSE DE COSTOS DE OBRA</p>
                      {[
                        { label: "Proveedor Piscina", value: cliente.ficheroActual!.costos.proveedor, color: "#0f172a" },
                        { label: "Costo Piscina", value: cliente.ficheroActual!.costos.costoPiscina, color: "#ef4444" },
                        { label: "Instalación", value: cliente.ficheroActual!.costos.instalacion, color: "#ef4444" },
                        { label: "Equipo de Filtrado", value: cliente.ficheroActual!.costos.equipoFiltrado, color: "#ef4444" },
                        { label: "Mano de Obra Vereda", value: cliente.ficheroActual!.costos.manoObraVereda, color: cliente.ficheroActual!.costos.manoObraVereda === "No aplica" ? "#94a3b8" : "#ef4444" },
                        { label: "Comisión Vendedor", value: cliente.ficheroActual!.costos.comision, color: "#ef4444" },
                      ].map((r) => (
                        <div key={r.label} className="flex items-center justify-between mb-[6px]">
                          <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">{r.label}</p>
                          <p className="font-['Geist:Medium',sans-serif] font-medium text-[13px]" style={{ color: r.color }}>{r.value}</p>
                        </div>
                      ))}
                      <div className="flex items-center justify-between mb-[6px] pt-[6px]" style={{ borderTop: "1px solid #e2e8f0" }}>
                        <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px]">Total Costos</p>
                        <p className="font-['Geist:Bold',sans-serif] font-bold text-[#ef4444] text-[14px]">{cliente.ficheroActual!.costos.totalCostos}</p>
                      </div>
                      <div className="flex items-center justify-between pt-[8px]" style={{ borderTop: "1px solid #e2e8f0" }}>
                        <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px]">Margen Neto</p>
                        <div className="flex items-center gap-[8px]">
                          <p className="font-['Geist:Bold',sans-serif] font-bold text-[#10b981] text-[15px]">{cliente.ficheroActual!.costos.margenNeto}</p>
                          <span className="bg-[#d1fae5] text-[#10b981] font-['Geist:SemiBold',sans-serif] font-semibold text-[11px] px-[6px] py-[2px] rounded-[4px]">{cliente.ficheroActual!.costos.margenPct}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )
              ) : (
                /* ---- TAB PAGOS ---- */
                sinFichero ? (
                  <div className="py-[32px] flex flex-col items-center justify-center">
                    <svg fill="none" height="40" viewBox="0 0 40 40" width="40" className="mb-[12px]">
                      <rect x="4" y="10" width="32" height="20" rx="4" stroke="#cbd5e1" strokeWidth="2" />
                      <path d="M4 18H36" stroke="#cbd5e1" strokeWidth="2" />
                    </svg>
                    <p className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[14px]">Sin fichero activo</p>
                    <p className="font-['Geist:Regular',sans-serif] text-[#cbd5e1] text-[13px] mt-[4px]">Creá un fichero primero para gestionar pagos</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-[16px]">
                    {/* Resumen de pagos */}
                    <div className="bg-[#f8fafc] p-[16px] rounded-[8px]">
                      <div className="grid grid-cols-3 gap-[12px] mb-[12px]">
                        <div>
                          <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px] uppercase tracking-wide">Total Venta</p>
                          <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px] mt-[2px]">{cliente.ficheroActual!.total}</p>
                        </div>
                        <div>
                          <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px] uppercase tracking-wide">Pagado</p>
                          <p className="font-['Geist:Bold',sans-serif] font-bold text-[#10b981] text-[16px] mt-[2px]">{formatCurrency(totalPagado)}</p>
                        </div>
                        <div>
                          <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px] uppercase tracking-wide">Pendiente</p>
                          <p className={`font-['Geist:Bold',sans-serif] font-bold text-[16px] mt-[2px] ${estaPagado ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                            {estaPagado ? "$0" : formatCurrency(saldoPendiente)}
                          </p>
                        </div>
                      </div>
                      {/* Barra de progreso */}
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

                    {/* Botón Registrar Pago */}
                    {!estaPagado && (
                      <button
                        onClick={() => handleOpenPagoModal()}
                        className="w-full flex items-center justify-center gap-[8px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] px-[14px] py-[10px] rounded-[8px]"
                      >
                        <svg fill="none" height="14" viewBox="0 0 16 16" width="14">
                          <path d="M8 3.3328V12.6672M3.3328 8H12.6672" stroke="white" strokeLinecap="round" strokeWidth="2" />
                        </svg>
                        Registrar Pago
                      </button>
                    )}

                    {/* Tabla de pagos */}
                    {cliente.ficheroActual!.pagos.length > 0 ? (
                      <div>
                        <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px] mb-[10px]">Pagos registrados</p>
                        <div className="flex flex-col gap-[6px]">
                          {cliente.ficheroActual!.pagos.map((pago, i) => (
                            <div
                              key={pago.id}
                              className="flex items-center gap-[10px] p-[12px] rounded-[8px] bg-[#f8fafc] group hover:bg-[#f1f5f9] transition-colors"
                            >
                              <div className="size-[32px] rounded-[6px] flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ backgroundColor: metodoColor[pago.metodo] ?? "#64748b" }}>
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-[8px]">
                                  <p className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[13px]">{formatCurrency(pago.monto)}</p>
                                  <span className="font-['Geist:Regular',sans-serif] text-[11px] px-[6px] py-[1px] rounded-[4px]" style={{ backgroundColor: `${metodoColor[pago.metodo]}20`, color: metodoColor[pago.metodo] }}>
                                    {pago.metodo}
                                  </span>
                                </div>
                                <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px] mt-[2px]">{pago.fecha}{pago.comprobante ? ` · ${pago.comprobante}` : ""}{pago.observaciones ? ` · ${pago.observaciones}` : ""}</p>
                              </div>
                              <div className="flex items-center gap-[4px] opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleOpenPagoModal(pago)}
                                  className="size-[28px] flex items-center justify-center rounded-[6px] hover:bg-white transition-colors"
                                >
                                  <svg fill="none" height="14" viewBox="0 0 16 16" width="14">
                                    <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="#64748b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleRemovePago(pago.id)}
                                  className="size-[28px] flex items-center justify-center rounded-[6px] hover:bg-[#fee2e2] transition-colors"
                                >
                                  <svg fill="none" height="14" viewBox="0 0 16 16" width="14">
                                    <path d="M2 4H14M5 4V2H11V4M6 7V12M10 7V12M3 4L4 14H12L13 4" stroke="#ef4444" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="py-[24px] flex flex-col items-center justify-center">
                        <svg fill="none" height="36" viewBox="0 0 40 40" width="36" className="mb-[10px]">
                          <rect x="4" y="10" width="32" height="20" rx="4" stroke="#cbd5e1" strokeWidth="2" />
                          <path d="M4 18H36" stroke="#cbd5e1" strokeWidth="2" />
                        </svg>
                        <p className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[13px]">Sin pagos registrados</p>
                        <p className="font-['Geist:Regular',sans-serif] text-[#cbd5e1] text-[12px] mt-[2px]">Registrá el primer pago del cliente</p>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Nuevo Fichero */}
      {showFicheroModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleCloseFicheroModal} />
          <div className="relative bg-white rounded-[16px] w-[680px] max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between px-[24px] py-[20px]" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">Nuevo Fichero</p>
              <button onClick={handleCloseFicheroModal} className="flex items-center justify-center size-[32px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
                <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
                  <path d="M12 4L4 12M4 4L12 12" stroke="#64748b" strokeLinecap="round" strokeWidth="2" />
                </svg>
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

      {/* Modal Registrar Pago */}
      {showPagoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleClosePagoModal} />
          <div className="relative bg-white rounded-[16px] w-[480px] max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between px-[24px] py-[20px]" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">{editingPago ? "Editar Pago" : "Registrar Pago"}</p>
              <button onClick={handleClosePagoModal} className="flex items-center justify-center size-[32px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
                <svg fill="none" height="16" viewBox="0 0 16 16" width="16"><path d="M12 4L4 12M4 4L12 12" stroke="#64748b" strokeLinecap="round" strokeWidth="2" /></svg>
              </button>
            </div>
            <div className="px-[24px] py-[20px] flex flex-col gap-[16px]">
              <div className="grid grid-cols-2 gap-[12px]">
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Fecha de Pago *</label>
                  <input type="text" value={pagoForm.fecha} onChange={(e) => handlePagoChange("fecha", e.target.value)} placeholder="dd/mm/aaaa" className={pagoInputClass("fecha")} style={{ border: `1px solid ${pagoErrors.fecha ? "#ef4444" : "#e2e8f0"}` }} />
                  {pagoErrors.fecha && <p className="text-[#ef4444] text-[12px] mt-[4px]">{pagoErrors.fecha}</p>}
                </div>
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Monto *</label>
                  <input type="text" value={pagoForm.monto} onChange={(e) => handlePagoChange("monto", e.target.value)} placeholder="$ 0" className={pagoInputClass("monto")} style={{ border: `1px solid ${pagoErrors.monto ? "#ef4444" : "#e2e8f0"}` }} />
                  {pagoErrors.monto && <p className="text-[#ef4444] text-[12px] mt-[4px]">{pagoErrors.monto}</p>}
                </div>
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Método de Pago *</label>
                <select value={pagoForm.metodo} onChange={(e) => handlePagoChange("metodo", e.target.value)} className={pagoInputClass("metodo")} style={{ border: `1px solid ${pagoErrors.metodo ? "#ef4444" : "#e2e8f0"}` }}>
                  {metodosPago.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                {pagoErrors.metodo && <p className="text-[#ef4444] text-[12px] mt-[4px]">{pagoErrors.metodo}</p>}
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Nro. Comprobante (opcional)</label>
                <input type="text" value={pagoForm.comprobante} onChange={(e) => handlePagoChange("comprobante", e.target.value)} placeholder="Ej: TR-12345" className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
              </div>
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Observaciones (opcional)</label>
                <input type="text" value={pagoForm.observaciones} onChange={(e) => handlePagoChange("observaciones", e.target.value)} placeholder="Nota adicional..." className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
              </div>
              {/* Saldo después del pago */}
              {pagoForm.monto && parseCurrencyInput(pagoForm.monto) > 0 && (
                <div className="bg-[#f8fafc] p-[12px] rounded-[8px]">
                  <div className="flex items-center justify-between">
                    <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">Saldo después del pago</p>
                    <p className={`font-['Geist:Bold',sans-serif] font-bold text-[15px] ${saldoDespuesPago <= 0 ? "text-[#10b981]" : "text-[#0f172a]"}`}>
                      {saldoDespuesPago <= 0 ? "$0" : formatCurrency(saldoDespuesPago)}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={handleClosePagoModal} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handleAddPago} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px]">{editingPago ? "Guardar Cambios" : "Registrar Pago"}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
