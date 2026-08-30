import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";

interface Compra {
  fecha: string;
  descripcion: string;
  monto: string;
  estado: "Recibido" | "En Tránsito" | "Pendiente";
}

interface ProveedorDetalle {
  id: string;
  razonSocial: string;
  cuit: string;
  contacto: string;
  email: string;
  telefono: string;
  direccion: string;
  localidad: string;
  rubro: string;
  estado: "Activo" | "Inactivo" | "Suspendido" | "Pendiente";
  cbu: string;
  alias: string;
  ultimoPedido: string;
  notas: string;
  historial: Compra[];
}

const proveedoresData: Record<string, ProveedorDetalle> = {
  "1": {
    id: "1", razonSocial: "Distribuidora Técnica SRL", cuit: "30-71234567-9", contacto: "Carlos Méndez",
    email: "carlos@distribuidoratecnica.com", telefono: "343-4551234", direccion: "Av. 25 de Mayo 1230",
    localidad: "Paraná", rubro: "Bombas", estado: "Activo", cbu: "0150017801000012345678", alias: "DISTECNICA",
    ultimoPedido: "20/07/2026", notas: "Proveedor principal de bombas Vulcano. Entregas en 48-72hs hábiles. Garantía de 12 meses.",
    historial: [
      { fecha: "20/07/2026", descripcion: "Bomba Vulcano 1HP × 3 unidades", monto: "$1.350.000", estado: "Recibido" },
      { fecha: "05/06/2026", descripcion: "Bomba Vulcano 1/2 HP × 2 unidades", monto: "$680.000", estado: "Recibido" },
      { fecha: "15/05/2026", descripcion: "Kit de accesorios para bomba × 5", monto: "$225.000", estado: "Recibido" },
    ],
  },
  "2": {
    id: "2", razonSocial: "Piletecno SA", cuit: "30-72345678-0", contacto: "Laura Giménez",
    email: "lgimenez@piletecno.com.ar", telefono: "341-4567890", direccion: "Calle Entre Ríos 456",
    localidad: "Santa Fe", rubro: "Piletas", estado: "Activo", cbu: "0150017801000023456789", alias: "PILETECNO",
    ultimoPedido: "15/07/2026", notas: "Fabricante de piletas de fibra de vidrio. Plazos de entrega: 15-20 días hábiles según modelo.",
    historial: [
      { fecha: "15/07/2026", descripcion: "Pileta Roma 6×3 × 1 unidad", monto: "$1.950.000", estado: "Recibido" },
      { fecha: "20/06/2026", descripcion: "Pileta Venecia 5×2.5 × 2 unidades", monto: "$3.200.000", estado: "Recibido" },
      { fecha: "01/05/2026", descripcion: "Pileta Ibiza 7×3.5 × 1 unidad", monto: "$2.800.000", estado: "Recibido" },
    ],
  },
  "3": {
    id: "3", razonSocial: "Químicos del Litoral", cuit: "30-73456789-1", contacto: "Roberto Álvarez",
    email: "ralvarez@quimicoslitoral.com", telefono: "343-5678901", direccion: "Ruta 11 km 5",
    localidad: "Paraná", rubro: "Químicos", estado: "Activo", cbu: "0150017801000034567890", alias: "QUIMLITORAL",
    ultimoPedido: "10/08/2026", notas: "Proveedores de cloro, pH, algicidas y productos de mantenimiento. Entregas semanales.",
    historial: [
      { fecha: "10/08/2026", descripcion: "Cloro granulado 50kg × 4 sacos", monto: "$180.000", estado: "En Tránsito" },
      { fecha: "27/07/2026", descripcion: "Kit mantenimiento químico completo", monto: "$95.000", estado: "Recibido" },
      { fecha: "13/07/2026", descripcion: "pH Down 25kg × 6 sacos", monto: "$120.000", estado: "Recibido" },
    ],
  },
  "4": {
    id: "4", razonSocial: "Accesorios Pool SA", cuit: "30-74567890-2", contacto: "María López",
    email: "mlopez@accesoriospool.com", telefono: "341-6789012", direccion: "San Martín 789",
    localidad: "Rosario", rubro: "Accesorios", estado: "Suspendido", cbu: "0150017801000045678901", alias: "ACCPPOOL",
    ultimoPedido: "01/06/2026", notas: "Proveedor suspendido por problemas de calidad en últimas entregas. Evaluar reactivación en septiembre.",
    historial: [
      { fecha: "01/06/2026", descripcion: "Skimmer plástico × 10 unidades", monto: "$350.000", estado: "Recibido" },
      { fecha: "15/05/2026", descripcion: "Boquillas de hidromasaje × 20", monto: "$180.000", estado: "Recibido" },
      { fecha: "01/05/2026", descripcion: "Escalera inoxidable × 5 unidades", monto: "$425.000", estado: "Recibido" },
    ],
  },
  "5": {
    id: "5", razonSocial: "Herramientas Maibach", cuit: "30-75678901-3", contacto: "Jorge Maibach",
    email: "jmaibach@herramientasmaibach.com", telefono: "343-7890123", direccion: "Belgrano 1024",
    localidad: "Paraná", rubro: "Herramientas", estado: "Activo", cbu: "0150017801000056789012", alias: "HERRMAIBACH",
    ultimoPedido: "25/07/2026", notas: "Sucursal de herramientas propias. Stock permanente. Descuento del 15% por volume.",
    historial: [
      { fecha: "25/07/2026", descripcion: "LlaveStillson 18\" × 4 unidades", monto: "$120.000", estado: "Recibido" },
      { fecha: "10/07/2026", descripcion: "Taladro percutor + brocas × 2 kits", monto: "$280.000", estado: "Recibido" },
      { fecha: "20/06/2026", descripcion: "Manguera industrial 25m × 6", monto: "$150.000", estado: "Recibido" },
    ],
  },
  "6": {
    id: "6", razonSocial: "Fibras Industriales SR", cuit: "30-76789012-4", contacto: "Pedro Suárez",
    email: "psuarez@fibrasindustriales.com", telefono: "341-8901234", direccion: "Mitre 2048",
    localidad: "Santa Fe", rubro: "Piletas", estado: "Pendiente", cbu: "0150017801000067890123", alias: "FIBRAIND",
    ultimoPedido: "—", notas: "Proveedor nuevo en proceso de verificación. Pendiente de revisar muestras y condiciones comerciales.",
    historial: [],
  },
  "7": {
    id: "7", razonSocial: "Sistemas de Filtrado SA", cuit: "30-77890123-5", contacto: "Ana Martínez",
    email: "amartinez@sistemasfiltrado.com", telefono: "343-9012345", direccion: "San Lorenzo 333",
    localidad: "Paraná", rubro: "Accesorios", estado: "Activo", cbu: "0150017801000078901234", alias: "SISTFILTRADO",
    ultimoPedido: "05/08/2026", notas: "Filtros de arena, cartuchos y sistemas de depuración. Garantía de 24 meses en equipos.",
    historial: [
      { fecha: "05/08/2026", descripcion: "Filtro de arena 600mm × 2 unidades", monto: "$860.000", estado: "Pendiente" },
      { fecha: "18/07/2026", descripcion: "Cartuchos de repuesto × 12", monto: "$144.000", estado: "Recibido" },
      { fecha: "01/07/2026", descripcion: "Bomba de circulación 1/2 HP × 4", monto: "$520.000", estado: "Recibido" },
    ],
  },
  "8": {
    id: "8", razonSocial: "Electricidad y Bombas SRL", cuit: "30-78901234-6", contacto: "Fernando Gómez",
    email: "fgomez@electricidadybombas.com", telefono: "341-0123456", direccion: "Corrientes 567",
    localidad: "Rosario", rubro: "Bombas", estado: "Inactivo", cbu: "0150017801000089012345", alias: "ELECBOMBAS",
    ultimoPedido: "12/04/2026", notas: "Proveedor inactivo. Cerró operaciones en la zona. Buscar alternativa para bombas eléctricas.",
    historial: [
      { fecha: "12/04/2026", descripcion: "Bomba eléctrica 2HP × 1 unidad", monto: "$480.000", estado: "Recibido" },
      { fecha: "01/03/2026", descripcion: "Tablero eléctrico para bomba × 3", monto: "$270.000", estado: "Recibido" },
    ],
  },
};

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

export default function ProveedorDetalle() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const proveedor = proveedoresData[id ?? "1"] ?? proveedoresData["1"]!;

  const totalCompras = proveedor.historial.reduce((acc, c) => {
    const num = Number(c.monto.replace(/[$.]/g, "").replace(",", "."));
    return acc + num;
  }, 0);

  return (
    <AppLayout breadcrumbs={[
      { label: "Inicio", onClick: () => navigate("/") },
      { label: "Proveedores", onClick: () => navigate("/proveedores") },
      { label: proveedor.razonSocial },
    ]}>
      <div className="p-[32px] flex flex-col gap-[24px]">
        {/* Title */}
        <div className="flex items-center gap-[16px]">
          <button onClick={() => navigate("/proveedores")} className="flex items-center justify-center size-[32px] rounded-[8px] hover:bg-[#e2e8f0] transition-colors">
            <svg fill="none" height="20" viewBox="0 0 20 20" width="20">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="#475569" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </button>
          <div>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[24px]">{proveedor.razonSocial}</p>
            <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[14px] mt-[2px]">Ficha de proveedor, datos bancarios e historial de compras</p>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_340px] gap-[24px]">
          {/* Left */}
          <div className="flex flex-col gap-[24px]">
            {/* Información General */}
            <div className="bg-white p-[24px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
              <div className="flex items-center justify-between mb-[20px]">
                <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px]">Información General</p>
                <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[10px] py-[4px] rounded-[6px]" style={estadoStyle[proveedor.estado]}>
                  {proveedor.estado}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-[16px]">
                {[
                  { label: "Dirección", value: proveedor.direccion },
                  { label: "Localidad", value: proveedor.localidad },
                  { label: "Teléfono", value: proveedor.telefono },
                  { label: "Email", value: proveedor.email },
                  { label: "CUIT", value: proveedor.cuit },
                  { label: "Rubro", value: proveedor.rubro },
                ].map((f) => (
                  <div key={f.label}>
                    <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">{f.label}</p>
                    <p className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[14px] mt-[2px]">{f.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Datos Bancarios */}
            <div className="bg-white p-[24px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px] mb-[16px]">Datos Bancarios</p>
              <div className="grid grid-cols-2 gap-[16px]">
                <div>
                  <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">CBU</p>
                  <p className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[14px] mt-[2px] font-mono">{proveedor.cbu}</p>
                </div>
                <div>
                  <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">Alias</p>
                  <p className="font-['Geist:Medium',sans-serif] font-medium text-[#0ea5e9] text-[14px] mt-[2px] font-mono">{proveedor.alias}</p>
                </div>
              </div>
            </div>

            {/* Observaciones */}
            <div className="bg-white p-[24px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px] mb-[12px]">Observaciones</p>
              <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px] leading-[1.6]">{proveedor.notas}</p>
            </div>

            {/* Historial de Compras */}
            <div className="bg-white p-[24px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px] mb-[16px]">Historial de Compras</p>
              {proveedor.historial.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {["Fecha", "Descripción", "Monto", "Estado"].map((h) => (
                        <th key={h} className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] py-[8px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {proveedor.historial.map((compra, i) => (
                      <tr key={i} style={{ borderBottom: i < proveedor.historial.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                        <td className="py-[14px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{compra.fecha}</td>
                        <td className="py-[14px] font-['Geist:Regular',sans-serif] text-[#0f172a] text-[14px]">{compra.descripcion}</td>
                        <td className="py-[14px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">{compra.monto}</td>
                        <td className="py-[14px]">
                          <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[8px] py-[3px] rounded-[6px]" style={compraEstadoStyle[compra.estado]}>
                            {compra.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px] text-center py-[20px]">Sin historial de compras</p>
              )}
            </div>
          </div>

          {/* Right: Resumen */}
          <div className="bg-white p-[24px] rounded-[12px] self-start" style={{ border: "1px solid #e2e8f0" }}>
            <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px] mb-[20px]">Resumen</p>
            <div className="flex flex-col gap-[12px]">
              {[
                { label: "Estado", value: proveedor.estado, color: estadoStyle[proveedor.estado]?.color ?? "#64748b" },
                { label: "Rubro", value: proveedor.rubro, color: "#0f172a" },
                { label: "Último Pedido", value: proveedor.ultimoPedido, color: "#0f172a" },
                { label: "Compras Totales", value: proveedor.historial.length.toString(), color: "#0ea5e9" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-[8px]" style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px]">{row.label}</p>
                  <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[13px]" style={{ color: row.color }}>{row.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-[20px] p-[16px] rounded-[10px] bg-[#f0fdf4]">
              <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px] uppercase tracking-wide mb-[4px]">Monto Total Compras</p>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#10b981] text-[22px]">
                ${totalCompras.toLocaleString("es-AR")}
              </p>
            </div>

            <div className="mt-[20px] flex flex-col gap-[8px]">
              <button className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] px-[16px] py-[10px] rounded-[8px]">
                Editar Proveedor
              </button>
              <button className="w-full bg-white hover:bg-[#f8fafc] transition-colors text-[#ef4444] font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] px-[16px] py-[10px] rounded-[8px]" style={{ border: "1px solid #e2e8f0" }}>
                Eliminar Proveedor
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
