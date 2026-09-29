import { useState } from "react";
import { createArticulo, updateArticulo, type Articulo } from "@/services/api";

interface Props {
  articulo?: Articulo;
  onClose: () => void;
  onSaved: () => void;
}

const labelClass =
  "font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block";
const baseInput =
  "w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white border border-[#e2e8f0] focus:border-[#0ea5e9]";

function parseMonto(valor: string): number {
  const limpio = valor.replace(/\./g, "").replace(",", ".").trim();
  return Number(limpio);
}

export default function ArticuloFormModal({ articulo, onClose, onSaved }: Props) {
  const [codigo, setCodigo] = useState(articulo?.codigo ?? "");
  const [nombre, setNombre] = useState(articulo?.nombre ?? "");
  const [unidad, setUnidad] = useState(articulo?.unidad ?? "un");
  const [costo, setCosto] = useState(articulo ? String(articulo.costoUnitario) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const editando = Boolean(articulo);

  async function handleGuardar() {
    const e: Record<string, string> = {};
    if (!nombre.trim()) e.nombre = "El nombre es obligatorio";
    const costoNum = costo.trim() ? parseMonto(costo) : 0;
    if (!Number.isFinite(costoNum) || costoNum < 0)
      e.costoUnitario = "El costo de referencia no es válido";
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    try {
      if (articulo) {
        await updateArticulo(articulo.id, {
          codigo: codigo.trim() || null,
          nombre: nombre.trim(),
          unidad: unidad.trim() || "un",
          costoUnitario: Math.round(costoNum),
        });
      } else {
        await createArticulo({
          codigo: codigo.trim() || undefined,
          nombre: nombre.trim(),
          unidad: unidad.trim() || "un",
          costoUnitario: Math.round(costoNum),
        });
      }
      onSaved();
    } catch (err) {
      setErrors({
        global: err instanceof Error ? err.message : "Error al guardar el artículo",
      });
    } finally {
      setSaving(false);
    }
  }

  const inputClass = (field: string) =>
    `${baseInput} ${errors[field] ? "!border-[#ef4444] focus:!border-[#ef4444]" : ""}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative bg-white rounded-[16px] w-[520px] max-h-[90vh] overflow-y-auto"
        style={{ border: "1px solid #e2e8f0" }}
      >
        <div
          className="flex items-center justify-between px-[24px] py-[20px]"
          style={{ borderBottom: "1px solid #e2e8f0" }}
        >
          <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">
            {editando ? "Editar Artículo" : "Nuevo Artículo"}
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
              <label className={labelClass}>Código</label>
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ej: CEM-50"
                className={inputClass("codigo")}
              />
              {errors.codigo && (
                <p className="text-[#ef4444] text-[12px] mt-[4px]">{errors.codigo}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Unidad</label>
              <input
                type="text"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                placeholder="Ej: bolsa, m2, un"
                className={baseInput}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Nombre *</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setErrors((p) => ({ ...p, nombre: "" }));
              }}
              placeholder="Ej: Cemento Portland 50kg"
              className={inputClass("nombre")}
            />
            {errors.nombre && (
              <p className="text-[#ef4444] text-[12px] mt-[4px]">{errors.nombre}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Costo de referencia ($)</label>
            <input
              type="text"
              value={costo}
              onChange={(e) => {
                setCosto(e.target.value);
                setErrors((p) => ({ ...p, costoUnitario: "" }));
              }}
              placeholder="Ej: 8500"
              className={inputClass("costoUnitario")}
            />
            <p className="text-[#94a3b8] text-[12px] mt-[4px]">
              Se actualiza solo cuando se recibe mercadería o se cambia acá. Queda registrado en el
              histórico de costos.
            </p>
            {errors.costoUnitario && (
              <p className="text-[#ef4444] text-[12px] mt-[4px]">{errors.costoUnitario}</p>
            )}
          </div>

          {errors.global && <p className="text-[#ef4444] text-[13px]">{errors.global}</p>}
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
            {saving ? "Guardando..." : editando ? "Guardar Cambios" : "Crear Artículo"}
          </button>
        </div>
      </div>
    </div>
  );
}
