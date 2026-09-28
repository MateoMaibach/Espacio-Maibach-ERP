import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import {
  getProveedor,
  getCompras,
  getOrdenesPago,
  getMonedasCaja,
  deleteProveedor,
  anularOrdenPago,
  deleteCompra,
  type Proveedor,
  type Compra,
  type OrdenPago,
} from "@/services/api";
import ProveedorFormModal from "@/components/ProveedorFormModal";
import CompraFormModal from "@/components/CompraFormModal";
import OrdenPagoModal from "@/components/OrdenPagoModal";

const estadoStyle: Record<string, { bg: string; color: string }> = {
  Activo: { bg: "#d1fae5", color: "#10b981" },
  Inactivo: { bg: "#e2e8f0", color: "#64748b" },
  Suspendido: { bg: "#fee2e2", color: "#ef4444" },
  Pendiente: { bg: "#fef3c7", color: "#f59e0b" },
};

const compraEstadoStyle: Record<string, { bg: string; color: string }> = {
  Recibido: { bg: "#d1fae5", color: "#10b981" },
  "En Tránsito": { bg: "#e0f2fe", color: "#0ea5e9" },
  Pendiente: { bg: "#fef3c7", color: "#f59e0b" },
};

function formatMonto(value: number, moneda: string): string {
  if (moneda === "ARS") return `$${value.toLocaleString("es-AR")}`;
  return `${moneda} ${value.toLocaleString("es-AR")}`;
}

function formatFecha(iso: string): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  if (!a || !m || !d) return iso;
  return `${d}/${m}/${a}`;
}

function parseItems(
  raw: Compra["items"],
): { detalle?: string; cantidad?: number; precioUnitario?: number }[] {
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function ProveedorDetalle() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenPago[]>([]);
  const [monedas, setMonedas] = useState<string[]>(["ARS"]);
  const [loading, setLoading] = useState(true);
  const [noExiste, setNoExiste] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showCompra, setShowCompra] = useState(false);
  const [editingCompra, setEditingCompra] = useState<Compra | null>(null);
  const [deletingCompra, setDeletingCompra] = useState<Compra | null>(null);
  const [showOrden, setShowOrden] = useState(false);
  const [anulandoOrden, setAnulandoOrden] = useState<OrdenPago | null>(null);

  const cargar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [prov, comps, ords, mons] = await Promise.all([
        getProveedor(id),
        getCompras(id),
        getOrdenesPago(id),
        getMonedasCaja(),
      ]);
      setProveedor(prov);
      setCompras(comps);
      setOrdenes(ords);
      setMonedas(mons.length > 0 ? mons : ["ARS"]);
    } catch (err) {
      if (err instanceof Error && /no encontrado|Error 404/i.test(err.message)) setNoExiste(true);
      else alert(err instanceof Error ? err.message : "Error al cargar el proveedor");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const totales = useMemo(() => {
    const mapa: Record<
      string,
      {
        comprado: number;
        pagado: number;
        saldo: number;
      }
    > = {};
    for (const [moneda, s] of Object.entries(proveedor?.saldos ?? {})) {
      mapa[moneda] = { ...s };
    }
    return mapa;
  }, [proveedor]);

  const ordenesPagadas = ordenes.filter((o) => o.estado === "Pagada");

  async function handleEliminarProveedor() {
    if (!proveedor) return;
    try {
      await deleteProveedor(proveedor.id);
      navigate("/proveedores");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al eliminar el proveedor");
      setShowDelete(false);
    }
  }

  async function handleAnularOrden() {
    if (!anulandoOrden) return;
    try {
      await anularOrdenPago(anulandoOrden.id);
      setAnulandoOrden(null);
      cargar();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al anular la orden de pago");
    }
  }

  async function handleEliminarCompra() {
    if (!deletingCompra) return;
    try {
      await deleteCompra(deletingCompra.id);
      setDeletingCompra(null);
      cargar();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al eliminar la compra");
    }
  }

  if (noExiste) {
    return (
      <AppLayout
        breadcrumbs={[
          { label: "Proveedores", onClick: () => navigate("/proveedores") },
          { label: "No encontrado" },
        ]}
      >
        <div className="p-[32px]">
          <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">
            Proveedor no encontrado
          </p>
          <button
            onClick={() => navigate("/proveedores")}
            className="mt-[12px] text-[#0ea5e9] text-[14px] font-medium"
          >
            Volver a Proveedores
          </button>
        </div>
      </AppLayout>
    );
  }

  if (loading || !proveedor) {
    return (
      <AppLayout
        breadcrumbs={[
          { label: "Proveedores", onClick: () => navigate("/proveedores") },
          { label: "Cargando..." },
        ]}
      >
        <div className="p-[32px] font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
          Cargando proveedor...
        </div>
      </AppLayout>
    );
  }

  const campos = [
    { label: "Dirección", value: proveedor.direccion },
    { label: "Localidad", value: proveedor.localidad },
    { label: "Teléfono", value: proveedor.telefono },
    { label: "Email", value: proveedor.email },
    { label: "CUIT", value: proveedor.cuit },
    { label: "Contacto", value: proveedor.contacto },
    { label: "Rubro", value: proveedor.rubro },
    {
      label: "Última compra",
      value: proveedor.ultimaCompra ? formatFecha(proveedor.ultimaCompra) : "—",
    },
  ];

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Inicio", onClick: () => navigate("/") },
        { label: "Proveedores", onClick: () => navigate("/proveedores") },
        { label: proveedor.razonSocial },
      ]}
    >
      <div className="p-[32px] flex flex-col gap-[24px]">
        {/* Title */}
        <div className="flex items-center gap-[16px]">
          <button
            onClick={() => navigate("/proveedores")}
            className="flex items-center justify-center size-[32px] rounded-[8px] hover:bg-[#e2e8f0] transition-colors"
          >
            <svg fill="none" height="20" viewBox="0 0 20 20" width="20">
              <path
                d="M12.5 15L7.5 10L12.5 5"
                stroke="#475569"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
          </button>
          <div className="flex-1">
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[24px]">
              {proveedor.razonSocial}
            </p>
            <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[14px] mt-[2px]">
              Ficha de proveedor, datos bancarios, compras y órdenes de pago
            </p>
          </div>
          <div className="flex items-center gap-[10px]">
            <button
              onClick={() => setShowCompra(true)}
              className="flex items-center gap-[8px] bg-white hover:bg-[#f8fafc] transition-colors text-[#0f172a] font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] px-[16px] py-[10px] rounded-[8px]"
              style={{ border: "1px solid #e2e8f0" }}
            >
              Nueva Compra
            </button>
            <button
              onClick={() => setShowOrden(true)}
              className="flex items-center gap-[8px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] px-[16px] py-[10px] rounded-[8px]"
            >
              <svg fill="none" height="14" viewBox="0 0 16 16" width="14">
                <path
                  d="M8 3V13M3 8H13"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
              </svg>
              Nueva Orden de Pago
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_340px] gap-[24px]">
          {/* Left */}
          <div className="flex flex-col gap-[24px]">
            {/* Información General */}
            <div
              className="bg-white p-[24px] rounded-[12px]"
              style={{ border: "1px solid #e2e8f0" }}
            >
              <div className="flex items-center justify-between mb-[20px]">
                <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px]">
                  Información General
                </p>
                <span
                  className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[10px] py-[4px] rounded-[6px]"
                  style={estadoStyle[proveedor.estado]}
                >
                  {proveedor.estado}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-[16px]">
                {campos.map((f) => (
                  <div key={f.label}>
                    <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">
                      {f.label}
                    </p>
                    <p className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[14px] mt-[2px]">
                      {f.value || "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Datos Bancarios */}
            <div
              className="bg-white p-[24px] rounded-[12px]"
              style={{ border: "1px solid #e2e8f0" }}
            >
              <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px] mb-[16px]">
                Datos Bancarios
              </p>
              <div className="grid grid-cols-2 gap-[16px]">
                <div>
                  <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">
                    CBU
                  </p>
                  <p className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[14px] mt-[2px] font-mono">
                    {proveedor.cbu || "—"}
                  </p>
                </div>
                <div>
                  <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">
                    Alias
                  </p>
                  <p className="font-['Geist:Medium',sans-serif] font-medium text-[#0ea5e9] text-[14px] mt-[2px] font-mono">
                    {proveedor.alias || "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Observaciones */}
            <div
              className="bg-white p-[24px] rounded-[12px]"
              style={{ border: "1px solid #e2e8f0" }}
            >
              <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px] mb-[12px]">
                Observaciones
              </p>
              <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px] leading-[1.6] whitespace-pre-wrap">
                {proveedor.notas || "Sin observaciones."}
              </p>
            </div>

            {/* Historial de Compras */}
            <div
              className="bg-white p-[24px] rounded-[12px]"
              style={{ border: "1px solid #e2e8f0" }}
            >
              <div className="flex items-center justify-between mb-[16px]">
                <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px]">
                  Historial de Compras
                </p>
                <button
                  onClick={() => setShowCompra(true)}
                  className="font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] text-[#0ea5e9] hover:text-[#0284c7] transition-colors"
                >
                  + Nueva compra
                </button>
              </div>
              {compras.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {["Fecha", "Descripción", "Items", "Total", "Estado", ""].map((h) => (
                        <th
                          key={h}
                          className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] py-[8px]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {compras.map((compra, i) => {
                      const items = parseItems(compra.items);
                      const desc = compra.descripcion || items[0]?.detalle || "Compra";
                      return (
                        <tr
                          key={compra.id}
                          className="group"
                          style={{
                            borderBottom: i < compras.length - 1 ? "1px solid #f1f5f9" : "none",
                          }}
                        >
                          <td className="py-[14px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                            {formatFecha(compra.fecha)}
                          </td>
                          <td className="py-[14px] font-['Geist:Regular',sans-serif] text-[#0f172a] text-[14px]">
                            {desc}
                          </td>
                          <td className="py-[14px] font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px]">
                            {items.length}
                          </td>
                          <td className="py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                            {formatMonto(compra.total, compra.moneda)}
                          </td>
                          <td className="py-[14px]">
                            <span
                              className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[8px] py-[3px] rounded-[6px]"
                              style={
                                compraEstadoStyle[compra.estado] ?? compraEstadoStyle.Pendiente
                              }
                            >
                              {compra.estado}
                            </span>
                          </td>
                          <td className="py-[14px]">
                            <div className="flex items-center gap-[4px] opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setEditingCompra(compra)}
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
                                onClick={() => setDeletingCompra(compra)}
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
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px] text-center py-[20px]">
                  Sin compras registradas
                </p>
              )}
            </div>

            {/* Órdenes de Pago */}
            <div
              className="bg-white p-[24px] rounded-[12px]"
              style={{ border: "1px solid #e2e8f0" }}
            >
              <div className="flex items-center justify-between mb-[16px]">
                <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px]">
                  Órdenes de Pago
                </p>
                <button
                  onClick={() => setShowOrden(true)}
                  className="font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] text-[#0ea5e9] hover:text-[#0284c7] transition-colors"
                >
                  + Nueva orden
                </button>
              </div>
              {ordenes.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {["N°", "Fecha", "Concepto", "Tramos", "Total", "Estado", ""].map((h) => (
                        <th
                          key={h}
                          className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] py-[8px]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ordenes.map((orden, i) => {
                      const totalesOrden: Record<string, number> = {};
                      for (const d of orden.detalles) {
                        const m = d.monto;
                        totalesOrden[d.moneda] = (totalesOrden[d.moneda] ?? 0) + m;
                      }
                      const totalTxt =
                        Object.entries(totalesOrden)
                          .map(([moneda, monto]) => formatMonto(monto, moneda))
                          .join(" · ") || "—";
                      const chequesUsados = orden.detalles.filter((d) => d.chequeId).length;
                      const tramos = orden.detalles.map((d) => d.subCaja).join(", ");
                      return (
                        <tr
                          key={orden.id}
                          className="group"
                          style={{
                            borderBottom: i < ordenes.length - 1 ? "1px solid #f1f5f9" : "none",
                          }}
                        >
                          <td className="py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0ea5e9] text-[14px]">
                            {orden.etiqueta}
                          </td>
                          <td className="py-[14px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                            {formatFecha(orden.fecha)}
                          </td>
                          <td className="py-[14px] font-['Geist:Regular',sans-serif] text-[#0f172a] text-[14px]">
                            {orden.concepto}
                            {chequesUsados > 0 && (
                              <span className="ml-[6px] text-[#f59e0b] text-[12px]">
                                · {chequesUsados} cheque
                                {chequesUsados > 1 ? "s" : ""}
                              </span>
                            )}
                          </td>
                          <td className="py-[14px] font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px]">
                            {tramos}
                          </td>
                          <td className="py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                            {totalTxt}
                          </td>
                          <td className="py-[14px]">
                            <span
                              className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[8px] py-[3px] rounded-[6px]"
                              style={
                                orden.estado === "Pagada"
                                  ? {
                                      backgroundColor: "#d1fae5",
                                      color: "#10b981",
                                    }
                                  : {
                                      backgroundColor: "#e2e8f0",
                                      color: "#64748b",
                                    }
                              }
                            >
                              {orden.estado}
                            </span>
                          </td>
                          <td className="py-[14px]">
                            {orden.estado === "Pagada" && (
                              <button
                                onClick={() => setAnulandoOrden(orden)}
                                className="font-['Geist:Medium',sans-serif] font-medium text-[12px] text-[#ef4444] hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                Anular
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px] text-center py-[20px]">
                  Sin órdenes de pago
                </p>
              )}
            </div>
          </div>

          {/* Right: Resumen */}
          <div
            className="bg-white p-[24px] rounded-[12px] self-start"
            style={{ border: "1px solid #e2e8f0" }}
          >
            <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px] mb-[20px]">
              Resumen
            </p>
            <div className="flex flex-col gap-[12px]">
              {[
                {
                  label: "Estado",
                  value: proveedor.estado,
                  color: estadoStyle[proveedor.estado]?.color ?? "#64748b",
                },
                {
                  label: "Rubro",
                  value: proveedor.rubro || "—",
                  color: "#0f172a",
                },
                {
                  label: "Última compra",
                  value: proveedor.ultimaCompra ? formatFecha(proveedor.ultimaCompra) : "—",
                  color: "#0f172a",
                },
                {
                  label: "Compras",
                  value: String(compras.length),
                  color: "#0ea5e9",
                },
                {
                  label: "Órdenes de pago",
                  value: String(ordenesPagadas.length),
                  color: "#0ea5e9",
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between py-[8px]"
                  style={{ borderBottom: "1px solid #f1f5f9" }}
                >
                  <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px]">
                    {row.label}
                  </p>
                  <p
                    className="font-['Geist:SemiBold',sans-serif] font-semibold text-[13px]"
                    style={{ color: row.color }}
                  >
                    {row.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-[20px] flex flex-col gap-[10px]">
              {Object.keys(totales).length === 0 && (
                <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px] text-center py-[8px]">
                  Sin movimientos registrados
                </p>
              )}
              {Object.entries(totales).map(([moneda, t]) => (
                <div
                  key={moneda}
                  className="p-[14px] rounded-[10px] bg-[#f8fafc]"
                  style={{ border: "1px solid #e2e8f0" }}
                >
                  <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px] uppercase tracking-wide mb-[8px]">
                    {moneda}
                  </p>
                  <div className="flex items-center justify-between mb-[4px]">
                    <span className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">
                      Comprado
                    </span>
                    <span className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[13px]">
                      {formatMonto(t.comprado, moneda)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-[8px]">
                    <span className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">
                      Pagado
                    </span>
                    <span className="font-['Geist:Medium',sans-serif] font-medium text-[#10b981] text-[13px]">
                      {formatMonto(t.pagado, moneda)}
                    </span>
                  </div>
                  <div
                    className="flex items-center justify-between pt-[8px]"
                    style={{ borderTop: "1px solid #e2e8f0" }}
                  >
                    <span className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">
                      Saldo
                    </span>
                    <span
                      className="font-['Geist:Bold',sans-serif] font-bold text-[15px]"
                      style={{ color: t.saldo > 0 ? "#ef4444" : "#10b981" }}
                    >
                      {formatMonto(t.saldo, moneda)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-[20px] flex flex-col gap-[8px]">
              <button
                onClick={() => setShowEdit(true)}
                className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] px-[16px] py-[10px] rounded-[8px]"
              >
                Editar Proveedor
              </button>
              <button
                onClick={() => setShowDelete(true)}
                className="w-full bg-white hover:bg-[#f8fafc] transition-colors text-[#ef4444] font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] px-[16px] py-[10px] rounded-[8px]"
                style={{ border: "1px solid #e2e8f0" }}
              >
                Eliminar Proveedor
              </button>
            </div>
          </div>
        </div>
      </div>

      {showEdit && (
        <ProveedorFormModal
          proveedor={proveedor}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            cargar();
          }}
        />
      )}

      {showCompra && (
        <CompraFormModal
          proveedorId={proveedor.id}
          monedas={monedas}
          onClose={() => setShowCompra(false)}
          onSaved={() => {
            setShowCompra(false);
            cargar();
          }}
        />
      )}

      {editingCompra && (
        <CompraFormModal
          proveedorId={proveedor.id}
          compra={editingCompra}
          monedas={monedas}
          onClose={() => setEditingCompra(null)}
          onSaved={() => {
            setEditingCompra(null);
            cargar();
          }}
        />
      )}

      {showOrden && (
        <OrdenPagoModal
          proveedorId={proveedor.id}
          proveedorNombre={proveedor.razonSocial}
          onClose={() => setShowOrden(false)}
          onCreated={() => {
            setShowOrden(false);
            cargar();
          }}
        />
      )}

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDelete(false)} />
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
                <span className="font-semibold">{proveedor.razonSocial}</span>? No se puede
                deshacer.
              </p>
            </div>
            <div
              className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]"
              style={{ borderTop: "1px solid #e2e8f0" }}
            >
              <button
                onClick={() => setShowDelete(false)}
                className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminarProveedor}
                className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#ef4444] hover:bg-[#dc2626] transition-colors px-[16px] py-[10px] rounded-[8px]"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingCompra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeletingCompra(null)} />
          <div
            className="relative bg-white rounded-[16px] w-[400px]"
            style={{ border: "1px solid #e2e8f0" }}
          >
            <div className="px-[24px] py-[20px] flex flex-col gap-[12px]">
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">
                Eliminar Compra
              </p>
              <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                ¿Querés eliminar esta compra por{" "}
                <span className="font-semibold">
                  {formatMonto(deletingCompra.total, deletingCompra.moneda)}
                </span>
                ?
              </p>
            </div>
            <div
              className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]"
              style={{ borderTop: "1px solid #e2e8f0" }}
            >
              <button
                onClick={() => setDeletingCompra(null)}
                className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminarCompra}
                className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#ef4444] hover:bg-[#dc2626] transition-colors px-[16px] py-[10px] rounded-[8px]"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {anulandoOrden && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAnulandoOrden(null)} />
          <div
            className="relative bg-white rounded-[16px] w-[440px]"
            style={{ border: "1px solid #e2e8f0" }}
          >
            <div className="px-[24px] py-[20px] flex flex-col gap-[12px]">
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">
                Anular Orden de Pago
              </p>
              <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                Vas a anular <span className="font-semibold">{anulandoOrden.etiqueta}</span>. Se
                eliminarán los{" "}
                <span className="font-semibold">{anulandoOrden.movimientoIds.length}</span>{" "}
                movimiento(s) de caja generados y los cheques usados volverán a su estado anterior.
              </p>
            </div>
            <div
              className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]"
              style={{ borderTop: "1px solid #e2e8f0" }}
            >
              <button
                onClick={() => setAnulandoOrden(null)}
                className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAnularOrden}
                className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#ef4444] hover:bg-[#dc2626] transition-colors px-[16px] py-[10px] rounded-[8px]"
              >
                Anular Orden
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
