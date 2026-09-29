import { useEffect, useState } from "react";
import { getHistorialCostos, type Articulo, type HistorialCosto } from "@/services/api";

interface Props {
  articuloId: string;
  onClose: () => void;
}

const origenStyle: Record<string, { bg: string; color: string }> = {
  manual: { bg: "#e0f2fe", color: "#0284c7" },
  compra: { bg: "#d1fae5", color: "#10b981" },
  inicial: { bg: "#fef3c7", color: "#f59e0b" },
};

function formatMonto(valor: number) {
  return `$${valor.toLocaleString("es-AR")}`;
}

function formatFecha(fecha: string) {
  if (!fecha) return "—";
  const [a, m, d] = fecha.split("-");
  return `${d}/${m}/${a}`;
}

export default function HistorialCostosModal({ articuloId, onClose }: Props) {
  const [articulo, setArticulo] = useState<Articulo | null>(null);
  const [historial, setHistorial] = useState<HistorialCosto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    getHistorialCostos(articuloId)
      .then((res) => {
        if (!vivo) return;
        setArticulo(res.articulo);
        setHistorial(res.historial);
      })
      .catch((err) => {
        if (vivo) setError(err instanceof Error ? err.message : "Error al cargar el histórico");
      })
      .finally(() => {
        if (vivo) setLoading(false);
      });
    return () => {
      vivo = false;
    };
  }, [articuloId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative bg-white rounded-[16px] w-[640px] max-h-[90vh] overflow-y-auto"
        style={{ border: "1px solid #e2e8f0" }}
      >
        <div
          className="flex items-center justify-between px-[24px] py-[20px]"
          style={{ borderBottom: "1px solid #e2e8f0" }}
        >
          <div>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">
              Histórico de Costos
            </p>
            <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px] mt-[2px]">
              {articulo
                ? `${articulo.nombre}${articulo.codigo ? ` · ${articulo.codigo}` : ""}`
                : "…"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center size-[32px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors"
          >
            <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="#64748b"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
          </button>
        </div>

        <div className="px-[24px] py-[20px]">
          {loading ? (
            <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
              Cargando histórico...
            </p>
          ) : error ? (
            <p className="font-['Geist:Regular',sans-serif] text-[#ef4444] text-[14px]">{error}</p>
          ) : historial.length === 0 ? (
            <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
              Este artículo todavía no tiene cambios de costo registrados.
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  {["Fecha", "Costo", "Anterior", "Variación", "Origen"].map((h) => (
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
                {historial.map((h, i) => (
                  <tr
                    key={h.id}
                    style={{
                      borderBottom: i < historial.length - 1 ? "1px solid #f1f5f9" : "none",
                    }}
                  >
                    <td className="py-[12px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                      {formatFecha(h.fecha)}
                    </td>
                    <td className="py-[12px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                      {formatMonto(h.costo)}
                    </td>
                    <td className="py-[12px] font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
                      {h.costoAnterior === null ? "—" : formatMonto(h.costoAnterior)}
                    </td>
                    <td className="py-[12px] font-['Geist:SemiBold',sans-serif] font-semibold text-[14px]">
                      {h.variacion === null ? (
                        <span className="text-[#94a3b8]">—</span>
                      ) : (
                        <span
                          style={{
                            color:
                              h.variacion > 0 ? "#ef4444" : h.variacion < 0 ? "#10b981" : "#64748b",
                          }}
                        >
                          {h.variacion > 0 ? "▲" : h.variacion < 0 ? "▼" : ""} {h.variacion}%
                        </span>
                      )}
                    </td>
                    <td className="py-[12px]">
                      <span
                        className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[8px] py-[3px] rounded-[6px] capitalize"
                        style={origenStyle[h.origen] ?? { bg: "#e2e8f0", color: "#64748b" }}
                      >
                        {h.origen}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div
          className="flex items-center justify-end px-[24px] py-[20px]"
          style={{ borderTop: "1px solid #e2e8f0" }}
        >
          <button
            onClick={onClose}
            className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
