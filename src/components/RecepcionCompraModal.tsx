import { useEffect, useState } from "react";
import {
  createRecepcion,
  getArticulos,
  getDepositos,
  getRecepciones,
  type Articulo,
  type Compra,
  type Deposito,
  type PendienteItem,
} from "@/services/api";

interface Props {
  compra: Compra;
  onClose: () => void;
  onSaved: (ingresoEstado: string) => void;
}

const labelClass =
  "font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block";
const baseInput =
  "w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white border border-[#e2e8f0] focus:border-[#0ea5e9]";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default function RecepcionCompraModal({ compra, onClose, onSaved }: Props) {
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [pendientes, setPendientes] = useState<PendienteItem[]>([]);
  const [recepciones, setRecepciones] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const [depositoId, setDepositoId] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [cantidades, setCantidades] = useState<Record<number, string>>({});
  const [mapaArticulos, setMapaArticulos] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([getRecepciones(compra.id), getDepositos(), getArticulos()])
      .then(([rec, deps, arts]) => {
        if (!vivo) return;
        setPendientes(rec.pendientes);
        setRecepciones(rec.recepciones.length);
        setDepositos(deps);
        setArticulos(arts);
        const cant: Record<number, string> = {};
        const mapa: Record<number, string> = {};
        for (const p of rec.pendientes) {
          cant[p.itemIndex] = p.pendiente > 0 ? String(p.pendiente) : "0";
          mapa[p.itemIndex] = "";
        }
        setCantidades(cant);
        setMapaArticulos(mapa);
        if (deps[0]) setDepositoId(deps[0].id);
      })
      .catch((err) => {
        if (vivo) setError(err instanceof Error ? err.message : "Error al cargar");
      })
      .finally(() => {
        if (vivo) setLoading(false);
      });
    return () => {
      vivo = false;
    };
  }, [compra.id]);

  async function handleGuardar() {
    setError("");
    if (!depositoId) {
      setError("Debe seleccionar el depósito donde ingresa la mercadería");
      return;
    }

    const lineas: { itemIndex: number; articuloId: string; cantidad: number }[] = [];
    for (const p of pendientes) {
      const cant = Math.trunc(Number(cantidades[p.itemIndex] ?? "0"));
      if (!Number.isFinite(cant) || cant === 0) continue;
      if (cant < 0) {
        setError(`Item "${p.detalle ?? p.itemIndex + 1}": la cantidad no puede ser negativa`);
        return;
      }
      if (cant > p.pendiente) {
        setError(`Item "${p.detalle ?? p.itemIndex + 1}": sólo quedan ${p.pendiente} pendiente(s)`);
        return;
      }
      const articuloId = mapaArticulos[p.itemIndex];
      if (cant > 0) {
        if (!articuloId) {
          setError(`Item "${p.detalle ?? p.itemIndex + 1}": seleccione el artículo equivalente`);
          return;
        }
        lineas.push({ itemIndex: p.itemIndex, articuloId, cantidad: cant });
      }
    }

    if (lineas.length === 0) {
      setError("Indique al menos una cantidad a recibir");
      return;
    }

    setSaving(true);
    try {
      const res = await createRecepcion(compra.id, { depositoId, fecha, lineas });
      onSaved(res.ingresoEstado);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al recibir la mercadería");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative bg-white rounded-[16px] w-[760px] max-h-[90vh] overflow-y-auto"
        style={{ border: "1px solid #e2e8f0" }}
      >
        <div
          className="flex items-center justify-between px-[24px] py-[20px]"
          style={{ borderBottom: "1px solid #e2e8f0" }}
        >
          <div>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">
              Recibir Mercadería
            </p>
            <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px] mt-[2px]">
              {compra.descripcion || "Compra"} · {recepciones} recepción(es) previa(s)
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

        <div className="px-[24px] py-[20px] flex flex-col gap-[16px]">
          <div className="grid grid-cols-2 gap-[12px]">
            <div>
              <label className={labelClass}>Depósito de ingreso *</label>
              <select
                value={depositoId}
                onChange={(e) => setDepositoId(e.target.value)}
                className={baseInput + " cursor-pointer"}
              >
                <option value="">Seleccione...</option>
                {depositos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Fecha de recepción *</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={baseInput}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Items de la compra</label>
            {loading ? (
              <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
                Cargando items...
              </p>
            ) : pendientes.length === 0 ? (
              <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
                Esta compra no tiene items.
              </p>
            ) : (
              <div
                className="rounded-[8px] overflow-hidden"
                style={{ border: "1px solid #e2e8f0" }}
              >
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                      {[
                        "Item",
                        "Pedido",
                        "Recibido",
                        "Pendiente",
                        "Artículo equivalente",
                        "A recibir",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] px-[12px] py-[10px]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendientes.map((p, i) => (
                      <tr
                        key={p.itemIndex}
                        style={{
                          borderBottom: i < pendientes.length - 1 ? "1px solid #f1f5f9" : "none",
                        }}
                      >
                        <td className="px-[12px] py-[10px] font-['Geist:Regular',sans-serif] text-[#0f172a] text-[14px]">
                          {p.detalle || `Item ${p.itemIndex + 1}`}
                        </td>
                        <td className="px-[12px] py-[10px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                          {p.cantidad}
                        </td>
                        <td className="px-[12px] py-[10px] font-['Geist:Regular',sans-serif] text-[#10b981] text-[14px]">
                          {p.recibido}
                        </td>
                        <td className="px-[12px] py-[10px] font-['Geist:SemiBold',sans-serif] font-semibold text-[14px]">
                          <span style={{ color: p.pendiente > 0 ? "#f59e0b" : "#10b981" }}>
                            {p.pendiente}
                          </span>
                        </td>
                        <td className="px-[12px] py-[10px]">
                          <select
                            value={mapaArticulos[p.itemIndex] ?? ""}
                            onChange={(e) =>
                              setMapaArticulos((prev) => ({
                                ...prev,
                                [p.itemIndex]: e.target.value,
                              }))
                            }
                            className={baseInput + " cursor-pointer"}
                            disabled={p.pendiente === 0}
                          >
                            <option value="">Seleccione...</option>
                            {articulos.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.codigo ? `${a.codigo} · ` : ""}
                                {a.nombre}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-[12px] py-[10px]">
                          <input
                            type="number"
                            value={cantidades[p.itemIndex] ?? "0"}
                            onChange={(e) =>
                              setCantidades((prev) => ({
                                ...prev,
                                [p.itemIndex]: e.target.value,
                              }))
                            }
                            disabled={p.pendiente === 0}
                            className={`${baseInput} !py-[7px]`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[#94a3b8] text-[12px] mt-[8px]">
              El costo de cada artículo se actualiza con el precio de la compra y queda registrado
              en su histórico de costos.
            </p>
          </div>

          {error && <p className="text-[#ef4444] text-[13px]">{error}</p>}
        </div>

        <div
          className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]"
          style={{ borderTop: "1px solid #e2e8f0" }}
        >
          <button
            onClick={onClose}
            className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={saving || loading}
            className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px] disabled:opacity-60"
          >
            {saving ? "Registrando..." : "Registrar Recepción"}
          </button>
        </div>
      </div>
    </div>
  );
}
