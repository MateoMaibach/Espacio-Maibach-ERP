import { useState } from "react";
import {
  createCompra,
  updateCompra,
  type Compra,
  type CompraEstado,
  type CompraInput,
  type CompraItem,
} from "@/services/api";

const ESTADOS: CompraEstado[] = ["Pendiente", "En Tránsito", "Recibido"];

interface FormState {
  fecha: string;
  descripcion: string;
  moneda: string;
  estado: CompraEstado;
  observaciones: string;
}

interface Props {
  proveedorId: string;
  compra?: Compra;
  monedas: string[];
  onClose: () => void;
  onSaved: () => void;
}

const labelClass =
  "font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block";
const inputClass =
  "w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white border border-[#e2e8f0] focus:border-[#0ea5e9]";

function hoy(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function parseItems(raw: Compra["items"]): CompraItem[] {
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function CompraFormModal({ proveedorId, compra, monedas, onClose, onSaved }: Props) {
  const itemsIniciales = compra ? parseItems(compra.items) : [];
  const [form, setForm] = useState<FormState>({
    fecha: compra?.fecha ?? hoy(),
    descripcion: compra?.descripcion ?? "",
    moneda: compra?.moneda ?? (monedas[0] || "ARS"),
    estado: compra?.estado ?? "Pendiente",
    observaciones: compra?.observaciones ?? "",
  });
  const [items, setItems] = useState<CompraItem[]>(
    itemsIniciales.length > 0 ? itemsIniciales : [{ detalle: "", cantidad: 1, precioUnitario: 0 }],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const editando = Boolean(compra);

  function change(field: keyof FormState, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: "" }));
  }

  function changeItem(index: number, campo: keyof CompraItem, valor: string) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (campo === "detalle") return { ...item, detalle: valor };
        const num = valor === "" ? 0 : Number(valor);
        return { ...item, [campo]: Number.isFinite(num) ? num : 0 };
      }),
    );
    if (errors.items) setErrors((p) => ({ ...p, items: "" }));
  }

  function addItem() {
    setItems((prev) => [...prev, { detalle: "", cantidad: 1, precioUnitario: 0 }]);
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const total = items.reduce(
    (acc, item) => acc + (item.cantidad || 0) * (item.precioUnitario || 0),
    0,
  );

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.fecha) e.fecha = "La fecha es obligatoria";
    if (items.length === 0) e.items = "Debe agregar al menos un item";
    else if (items.some((i) => !i.detalle.trim())) e.items = "Todos los items necesitan un detalle";
    else if (items.some((i) => !(i.cantidad > 0)))
      e.items = "La cantidad de cada item debe ser mayor a 0";
    else if (items.some((i) => i.precioUnitario < 0))
      e.items = "El precio unitario no puede ser negativo";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleGuardar() {
    if (!validate()) return;
    setSaving(true);
    try {
      const data: CompraInput = {
        fecha: form.fecha,
        descripcion: form.descripcion.trim(),
        moneda: form.moneda,
        items: items.map((i) => ({
          detalle: i.detalle.trim(),
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
        })),
        estado: form.estado,
        observaciones: form.observaciones.trim(),
      };
      if (compra) await updateCompra(compra.id, data);
      else await createCompra(proveedorId, data);
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar la compra");
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
            {editando ? "Editar Compra" : "Nueva Compra"}
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
          <div className="grid grid-cols-3 gap-[12px]">
            <div>
              <label className={labelClass}>Fecha *</label>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => change("fecha", e.target.value)}
                className={inputClass + (errors.fecha ? " !border-[#ef4444]" : "")}
              />
              {errors.fecha && (
                <p className="text-[#ef4444] text-[12px] mt-[4px]">{errors.fecha}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Moneda *</label>
              <select
                value={form.moneda}
                onChange={(e) => change("moneda", e.target.value)}
                className={inputClass + " cursor-pointer"}
              >
                {monedas.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Estado *</label>
              <select
                value={form.estado}
                onChange={(e) => change("estado", e.target.value)}
                className={inputClass + " cursor-pointer"}
              >
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Descripción</label>
            <input
              type="text"
              value={form.descripcion}
              onChange={(e) => change("descripcion", e.target.value)}
              placeholder="Ej: Reposición de bombas Vulcano"
              className={inputClass}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-[8px]">
              <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px]">
                Items *
              </label>
              <button
                onClick={addItem}
                className="font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] text-[#0ea5e9] hover:text-[#0284c7] transition-colors"
              >
                + Agregar item
              </button>
            </div>

            <div className="flex flex-col gap-[8px]">
              <div className="grid grid-cols-[1fr_90px_130px_90px_32px] gap-[8px]">
                <span className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[12px]">
                  Detalle
                </span>
                <span className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[12px] text-right">
                  Cant.
                </span>
                <span className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[12px] text-right">
                  P. Unitario
                </span>
                <span className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[12px] text-right">
                  Subtotal
                </span>
                <span />
              </div>

              {items.map((item, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_90px_130px_90px_32px] gap-[8px] items-center"
                >
                  <input
                    type="text"
                    value={item.detalle}
                    onChange={(e) => changeItem(i, "detalle", e.target.value)}
                    placeholder="Descripción del artículo"
                    className={inputClass}
                  />
                  <input
                    type="number"
                    value={item.cantidad === 0 ? "" : item.cantidad}
                    onChange={(e) => changeItem(i, "cantidad", e.target.value)}
                    min="1"
                    className={inputClass + " text-right"}
                  />
                  <input
                    type="number"
                    value={item.precioUnitario === 0 ? "" : item.precioUnitario}
                    onChange={(e) => changeItem(i, "precioUnitario", e.target.value)}
                    min="0"
                    step="0.01"
                    className={inputClass + " text-right"}
                  />
                  <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px] text-right">
                    {(item.cantidad || 0) * (item.precioUnitario || 0) > 0
                      ? `${form.moneda} ${(item.cantidad * item.precioUnitario).toLocaleString("es-AR")}`
                      : "—"}
                  </span>
                  <button
                    onClick={() => removeItem(i)}
                    disabled={items.length === 1}
                    className="size-[28px] flex items-center justify-center rounded-[6px] hover:bg-[#fee2e2] transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Quitar item"
                  >
                    <svg fill="none" height="14" viewBox="0 0 16 16" width="14">
                      <path
                        d="M12 4L4 12M4 4L12 12"
                        stroke="#ef4444"
                        strokeLinecap="round"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            {errors.items && <p className="text-[#ef4444] text-[12px] mt-[6px]">{errors.items}</p>}

            <div
              className="flex items-center justify-end gap-[8px] mt-[12px] p-[12px] rounded-[8px] bg-[#f8fafc]"
              style={{ border: "1px solid #e2e8f0" }}
            >
              <span className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                Total
              </span>
              <span className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">
                {form.moneda} {total.toLocaleString("es-AR")}
              </span>
            </div>
          </div>

          <div>
            <label className={labelClass}>Observaciones</label>
            <textarea
              value={form.observaciones}
              onChange={(e) => change("observaciones", e.target.value)}
              rows={2}
              placeholder="Notas (opcional)"
              className={inputClass + " resize-none"}
            />
          </div>
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
            {saving ? "Guardando..." : editando ? "Guardar Cambios" : "Crear Compra"}
          </button>
        </div>
      </div>
    </div>
  );
}
