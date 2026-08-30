import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";

const clientesData: Record<string, {
  nombre: string; direccion: string; localidad: string; telefono: string; email: string; dni: string; fechaAlta: string; estado: string;
  ficheroActual: { fecha: string; vendedor: string; comision: string; items: { desc: string; cant: string; precio: string }[]; total: string; costos: { venta: string; materiales: string; instalacion: string; margenNeto: string; margenPct: string } };
  historial: { fecha: string; vendedor: string; articulos: string; importe: string; isCurrent?: boolean }[];
}> = {
  "1": {
    nombre: "García, Roberto", direccion: "Calle Los Jacarandás 451", localidad: "Paraná, Entre Ríos",
    telefono: "343-4552912", email: "rgarcia@gmail.com", dni: "30.412.552", fechaAlta: "12 Ene, 2024", estado: "Activo",
    ficheroActual: {
      fecha: "05 Ago, 2024", vendedor: "Martín Maibach", comision: "5% ($242.500)",
      items: [
        { desc: "Pileta Modelo Roma 6x3 (Instalada)", cant: "Cant: 1 × $3.900.000", precio: "$3.900.000" },
        { desc: "Bomba Vulcano 1HP + Accesorios", cant: "Cant: 1 × $450.000", precio: "$450.000" },
        { desc: "Kit de Luces Led RGB + Tablero", cant: "Cant: 1 × $500.000", precio: "$500.000" },
      ],
      total: "$4.850.000",
      costos: { venta: "$4.850.000", materiales: "-$2.150.000", instalacion: "-$800.000", margenNeto: "$1.900.000", margenPct: "39.1%" },
    },
    historial: [
      { fecha: "12 Ene, 2024", vendedor: "Martín M.", articulos: "Bomba Vulcano 1/2 HP + Accesorios", importe: "$18.500" },
      { fecha: "05 Ago, 2024", vendedor: "Martín M.", articulos: "Fichero Actual: Pileta Roma 6x3 + Kit", importe: "$4.850.000", isCurrent: true },
    ],
  },
};

export default function ClienteDetalle() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const cliente = clientesData[id ?? "1"] ?? clientesData["1"]!;

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
                <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[10px] py-[4px] rounded-[6px] bg-[#d1fae5] text-[#10b981]">{cliente.estado}</span>
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
              {/* Summary row */}
              <div className="mt-[12px] flex gap-[16px] bg-[#f8fafc] p-[12px] rounded-[8px]">
                <div>
                  <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px] uppercase tracking-wide">PRECIO DE VENTA</p>
                  <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[14px] mt-[2px]">{cliente.ficheroActual.costos.venta}</p>
                </div>
                <div>
                  <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px] uppercase tracking-wide">COSTOS TOTALES</p>
                  <p className="font-['Geist:Bold',sans-serif] font-bold text-[#ef4444] text-[14px] mt-[2px]">{cliente.ficheroActual.costos.materiales.replace("-","")}</p>
                </div>
                <div>
                  <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px] uppercase tracking-wide">MARGEN BRUTO</p>
                  <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0ea5e9] text-[14px] mt-[2px]">{cliente.ficheroActual.costos.margenNeto} <span className="text-[#475569] text-[12px]">{cliente.ficheroActual.costos.margenPct}</span></p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Fichero Actual */}
          <div className="bg-white p-[24px] rounded-[12px] self-start" style={{ border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between mb-[20px]">
              <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px]">Fichero Actual</p>
              <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[11px] px-[8px] py-[3px] rounded-[6px] bg-[#d1fae5] text-[#10b981]">Instalación Confirmada</span>
            </div>
            <div className="flex flex-col gap-[8px] mb-[20px]">
              {[
                { label: "Fecha de Pedido", value: cliente.ficheroActual.fecha },
                { label: "Vendedor", value: cliente.ficheroActual.vendedor },
                { label: "Comisión Venta", value: cliente.ficheroActual.comision, green: true },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">{row.label}</p>
                  <p className={`font-['Geist:Medium',sans-serif] font-medium text-[13px] ${row.green ? "text-[#0ea5e9]" : "text-[#0f172a]"}`}>{row.value}</p>
                </div>
              ))}
            </div>
            <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px] mb-[12px]">Artículos</p>
            <div className="flex flex-col gap-[10px] mb-[20px]">
              {cliente.ficheroActual.items.map((item, i) => (
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
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0ea5e9] text-[22px]">{cliente.ficheroActual.total}</p>
            </div>
            <div className="bg-[#f8fafc] p-[14px] rounded-[8px] mt-[8px]">
              <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#475569] text-[11px] uppercase tracking-wide mb-[10px]">DESGLOSE DE COSTOS DE OBRA (ADMIN)</p>
              {[
                { label: "Venta Total Obra", value: cliente.ficheroActual.costos.venta, color: "#0f172a" },
                { label: "Costo Materiales/Bomba", value: cliente.ficheroActual.costos.materiales, color: "#ef4444" },
                { label: "Costo Instalación/Flete", value: cliente.ficheroActual.costos.instalacion, color: "#ef4444" },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between mb-[6px]">
                  <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">{r.label}</p>
                  <p className="font-['Geist:Medium',sans-serif] font-medium text-[13px]" style={{ color: r.color }}>{r.value}</p>
                </div>
              ))}
              <div className="flex items-center justify-between pt-[8px]" style={{ borderTop: "1px solid #e2e8f0" }}>
                <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px]">Margen Neto Obra</p>
                <div className="flex items-center gap-[8px]">
                  <p className="font-['Geist:Bold',sans-serif] font-bold text-[#10b981] text-[15px]">{cliente.ficheroActual.costos.margenNeto}</p>
                  <span className="bg-[#d1fae5] text-[#10b981] font-['Geist:SemiBold',sans-serif] font-semibold text-[11px] px-[6px] py-[2px] rounded-[4px]">{cliente.ficheroActual.costos.margenPct}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
