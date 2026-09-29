import { useState } from "react";
import { createAjuste, createIngresoInicial, type Articulo, type Deposito } from "@/services/api";

interface Props {
  tipo: "ingreso" | "ajuste";
  depositos: Deposito[];
  articulos: Articulo[];
  onClose: () => void;
  onSaved: () => void;
}

interface Linea {
  articuloId: string;
  cantidad: string;
  costo: string;
}

const labelClass =
  "font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block";
const baseInput =
  "w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white border border-[#e2e8f0] focus:border-[#0ea5e9]";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default function MovimientoStockModal({
  tipo,
  depositos,
  articulos,
  onClose,
  onSaved,
}: Props) {
  const esIngreso = tipo === "ingreso";
  const [depositoId, setDepositoId] = useState(depositos[0]?.id ?? "");
  const [fecha, setFecha] = useState(hoy());
  const [motivo, setMotivo] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([{ articuloId: "", cantidad: "", costo: "" }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function changeLinea(i: number, patch: Partial<Linea>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function handleGuardar() {
    setError("");
    if (!depositoId) {
      setError("Debe seleccionar un depósito");
      return;
    }
    if (!esIngreso && !motivo.trim()) {
      setError("El motivo del ajuste es obligatorio");
      return;
    }

    const limpias: { articuloId: string; cantidad: number; costoUnitario?: number }[] = [];
    for (const [i, linea] of lineas.entries()) {
      if (!linea.articuloId) {
        setError(`Línea ${i + 1}: seleccione un artículo`);
        return;
      }
      const cantidad = Math.trunc(Number(linea.cantidad.replace(",", ".")));
      if (!Number.isFinite(cantidad) || (esIngreso ? cantidad <= 0 : cantidad === 0)) {
        setError(
          `Línea ${i + 1}: la cantidad debe ser ${esIngreso ? "mayor a cero" : "distinta de cero"}`,
        );
        return;
      }
      const item: { articuloId: string; cantidad: number; costoUnitario?: number } = {
        articuloId: linea.articuloId,
        cantidad,
      };
      if (esIngreso && linea.costo.trim()) {
        const costo = Number(linea.costo.replace(/\./g, "").replace(",", "."));
        if (!Number.isFinite(costo) || costo < 0) {
          setError(`Línea ${i + 1}: el costo no es válido`);
          return;
        }
        item.costoUnitario = Math.round(costo);
      }
      limpias.push(item);
    }

    if (limpias.length === 0) {
      setError("Debe indicar al menos un artículo");
      return;
    }

    setSaving(true);
    try {
      if (esIngreso) {
        await createIngresoInicial({ depositoId, fecha, lineas: limpias });
      } else {
        await createAjuste({ depositoId, fecha, motivo: motivo.trim(), lineas: limpias });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar el movimiento");
    } finally {
      setSaving(false);
    }
  }

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
          <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">
            {esIngreso ? "Registrar Ingreso Inicial" : "Registrar Ajuste de Inventario"}
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
              <label className={labelClass}>Depósito *</label>
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
              <label className={labelClass}>Fecha *</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={baseInput}
              />
            </div>
          </div>

          {!esIngreso && (
            <div>
              <label className={labelClass}>Motivo *</label>
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Conteo cíclico de septiembre"
                className={baseInput}
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-[6px]">
              <label className={labelClass + " mb-0"}>Artículos</label>
              <button
                onClick={() =>
                  setLineas((p) => [...p, { articuloId: "", cantidad: "", costo: "" }])
                }
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
                  {esIngreso ? "Costo unit. ($)" : "Actual"}
                </span>
                <span />
              </div>

              {lineas.map((linea, i) => {
                const art = articulos.find((a) => a.id === linea.articuloId);
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_120px_140px_32px] gap-[8px] items-center"
                  >
                    <select
                      value={linea.articuloId}
                      onChange={(e) => {
                        const seleccionado = articulos.find((a) => a.id === e.target.value);
                        changeLinea(i, {
                          articuloId: e.target.value,
                          costo:
                            esIngreso && seleccionado
                              ? String(seleccionado.costoUnitario)
                              : linea.costo,
                        });
                      }}
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
                    {esIngreso ? (
                      <input
                        type="number"
                        value={linea.costo}
                        onChange={(e) => changeLinea(i, { costo: e.target.value })}
                        placeholder={art ? String(art.costoUnitario) : "0"}
                        className={baseInput}
                      />
                    ) : (
                      <span className="font-['Geist:Regular',sans-serif] text-[14px] text-[#475569]">
                        {art ? `$${art.costoUnitario.toLocaleString("es-AR")}` : "—"}
                      </span>
                    )}
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

            {!esIngreso && (
              <p className="text-[#94a3b8] text-[12px] mt-[8px]">
                Use cantidad negativa para descontar y positiva para sumar.
              </p>
            )}
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
            {saving ? "Guardando..." : esIngreso ? "Registrar Ingreso" : "Registrar Ajuste"}
          </button>
        </div>
      </div>
    </div>
  );
}
