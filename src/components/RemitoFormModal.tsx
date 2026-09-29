import { useEffect, useMemo, useState } from "react";
import {
  createRemito,
  getExistencias,
  type Articulo,
  type Deposito,
  type RemitoTipo,
} from "@/services/api";

interface Props {
  depositos: Deposito[];
  articulos: Articulo[];
  onClose: () => void;
  onSaved: (etiqueta: string) => void;
}

interface Linea {
  articuloId: string;
  cantidad: string;
}

const labelClass =
  "font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block";
const baseInput =
  "w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white border border-[#e2e8f0] focus:border-[#0ea5e9]";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default function RemitoFormModal({ depositos, articulos, onClose, onSaved }: Props) {
  const [tipo, setTipo] = useState<RemitoTipo>("salida");
  const [origen, setOrigen] = useState(depositos[0]?.id ?? "");
  const [destinoDep, setDestinoDep] = useState("");
  const [destinoTexto, setDestinoTexto] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [observaciones, setObservaciones] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([{ articuloId: "", cantidad: "" }]);
  const [stockDisponible, setStockDisponible] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getExistencias()
      .then((res) => {
        const mapa: Record<string, number> = {};
        for (const r of res.rows) {
          if (r.depositoId === origen) mapa[r.articuloId] = r.cantidad;
        }
        setStockDisponible(mapa);
      })
      .catch(() => setStockDisponible({}));
  }, [origen]);

  const excedeStock = useMemo(
    () =>
      lineas.some((l) => {
        const cant = Math.trunc(Number(l.cantidad));
        return Number.isFinite(cant) && cant > 0 && (stockDisponible[l.articuloId] ?? 0) < cant;
      }),
    [lineas, stockDisponible],
  );

  function changeLinea(i: number, patch: Partial<Linea>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function handleGuardar() {
    setError("");
    if (!origen) {
      setError("Debe seleccionar el depósito de origen");
      return;
    }
    if (tipo === "transferencia") {
      if (!destinoDep) {
        setError("Debe seleccionar el depósito de destino");
        return;
      }
      if (destinoDep === origen) {
        setError("El depósito de destino debe ser distinto al de origen");
        return;
      }
    } else if (!destinoTexto.trim()) {
      setError("Debe indicar el destino (cliente u obra)");
      return;
    }

    const limpias: { articuloId: string; cantidad: number }[] = [];
    for (const [i, linea] of lineas.entries()) {
      if (!linea.articuloId) {
        setError(`Línea ${i + 1}: seleccione un artículo`);
        return;
      }
      const cantidad = Math.trunc(Number(linea.cantidad));
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        setError(`Línea ${i + 1}: la cantidad debe ser mayor a cero`);
        return;
      }
      limpias.push({ articuloId: linea.articuloId, cantidad });
    }
    if (limpias.length === 0) {
      setError("Debe incluir al menos un artículo");
      return;
    }

    setSaving(true);
    try {
      const res = await createRemito({
        tipo,
        depositoOrigenId: origen,
        depositoDestinoId: tipo === "transferencia" ? destinoDep : undefined,
        destino: tipo === "salida" ? destinoTexto.trim() : undefined,
        fecha,
        observaciones: observaciones.trim() || undefined,
        lineas: limpias,
      });
      onSaved(res.etiqueta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al emitir el remito");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative bg-white rounded-[16px] w-[680px] max-h-[90vh] overflow-y-auto"
        style={{ border: "1px solid #e2e8f0" }}
      >
        <div
          className="flex items-center justify-between px-[24px] py-[20px]"
          style={{ borderBottom: "1px solid #e2e8f0" }}
        >
          <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">
            Nuevo Remito
          </p>
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
              <label className={labelClass}>Tipo de remito *</label>
              <div className="flex gap-[8px]">
                <button
                  onClick={() => setTipo("salida")}
                  className={`flex-1 font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] py-[9px] rounded-[8px] border transition-colors ${
                    tipo === "salida"
                      ? "bg-[#e0f2fe] border-[#0ea5e9] text-[#0284c7]"
                      : "bg-white border-[#e2e8f0] text-[#475569] hover:bg-[#f8fafc]"
                  }`}
                >
                  Salida
                </button>
                <button
                  onClick={() => setTipo("transferencia")}
                  className={`flex-1 font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] py-[9px] rounded-[8px] border transition-colors ${
                    tipo === "transferencia"
                      ? "bg-[#e0f2fe] border-[#0ea5e9] text-[#0284c7]"
                      : "bg-white border-[#e2e8f0] text-[#475569] hover:bg-[#f8fafc]"
                  }`}
                >
                  Transferencia
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>Fecha *</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={baseInput}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-[12px]">
            <div>
              <label className={labelClass}>Depósito de origen *</label>
              <select
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
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
            {tipo === "transferencia" ? (
              <div>
                <label className={labelClass}>Depósito de destino *</label>
                <select
                  value={destinoDep}
                  onChange={(e) => setDestinoDep(e.target.value)}
                  className={baseInput + " cursor-pointer"}
                >
                  <option value="">Seleccione...</option>
                  {depositos
                    .filter((d) => d.id !== origen)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div>
                <label className={labelClass}>Destino (cliente u obra) *</label>
                <input
                  type="text"
                  value={destinoTexto}
                  onChange={(e) => setDestinoTexto(e.target.value)}
                  placeholder="Ej: Obra Maipú / Cliente González"
                  className={baseInput}
                />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-[6px]">
              <label className={labelClass + " mb-0"}>Artículos a despachar</label>
              <button
                onClick={() => setLineas((p) => [...p, { articuloId: "", cantidad: "" }])}
                className="font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] text-[#0ea5e9] hover:text-[#0284c7] transition-colors"
              >
                + Agregar línea
              </button>
            </div>

            <div className="flex flex-col gap-[8px]">
              <div className="grid grid-cols-[1fr_120px_140px_32px] gap-[8px]">
                <span className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[12px]">
                  Artículo
                </span>
                <span className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[12px]">
                  Cantidad
                </span>
                <span className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[12px]">
                  Disponible
                </span>
                <span />
              </div>

              {lineas.map((linea, i) => {
                const disponible = stockDisponible[linea.articuloId];
                const cant = Math.trunc(Number(linea.cantidad));
                const supera = Number.isFinite(cant) && cant > 0 && (disponible ?? 0) < cant;
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_120px_140px_32px] gap-[8px] items-center"
                  >
                    <select
                      value={linea.articuloId}
                      onChange={(e) => changeLinea(i, { articuloId: e.target.value })}
                      className={baseInput + " cursor-pointer"}
                    >
                      <option value="">Seleccione...</option>
                      {articulos.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.codigo ? `${a.codigo} · ` : ""}
                          {a.nombre}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={linea.cantidad}
                      onChange={(e) => changeLinea(i, { cantidad: e.target.value })}
                      placeholder="0"
                      className={baseInput}
                    />
                    <span
                      className="font-['Geist:Medium',sans-serif] text-[14px]"
                      style={{ color: supera ? "#ef4444" : "#475569" }}
                    >
                      {disponible === undefined
                        ? "—"
                        : `${disponible.toLocaleString("es-AR")}${supera ? " ⚠" : ""}`}
                    </span>
                    <button
                      onClick={() =>
                        setLineas((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p))
                      }
                      className="size-[32px] flex items-center justify-center rounded-[6px] hover:bg-[#fee2e2] transition-colors"
                      title="Quitar línea"
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
                );
              })}
            </div>
          </div>

          {excedeStock && (
            <div
              className="p-[12px] rounded-[8px] font-['Geist:Medium',sans-serif] text-[13px]"
              style={{ background: "#fef3c7", color: "#b45309" }}
            >
              Hay líneas con más cantidad que el stock disponible. El remito se puede emitir igual
              (el sistema permite stock negativo), pero va a quedar registrado en el reporte de
              Stock Negativo.
            </div>
          )}

          <div>
            <label className={labelClass}>Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Nota interna (opcional)"
              className={baseInput + " resize-none"}
            />
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
            disabled={saving}
            className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px] disabled:opacity-60"
          >
            {saving ? "Emitiendo..." : "Emitir Remito"}
          </button>
        </div>
      </div>
    </div>
  );
}
