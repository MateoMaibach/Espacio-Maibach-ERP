import { useState } from "react";
import { createDeposito, updateDeposito, type Deposito } from "@/services/api";

interface Props {
  deposito?: Deposito;
  onClose: () => void;
  onSaved: () => void;
}

const labelClass =
  "font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block";
const baseInput =
  "w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white border border-[#e2e8f0] focus:border-[#0ea5e9]";

export default function DepositoFormModal({ deposito, onClose, onSaved }: Props) {
  const [nombre, setNombre] = useState(deposito?.nombre ?? "");
  const [direccion, setDireccion] = useState(deposito?.direccion ?? "");
  const [activo, setActivo] = useState(deposito?.activo ?? 1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const editando = Boolean(deposito);

  async function handleGuardar() {
    if (!nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const data = { nombre: nombre.trim(), direccion: direccion.trim(), activo };
      if (deposito) await updateDeposito(deposito.id, data);
      else await createDeposito(data);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el depósito");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative bg-white rounded-[16px] w-[480px] max-h-[90vh] overflow-y-auto"
        style={{ border: "1px solid #e2e8f0" }}
      >
        <div
          className="flex items-center justify-between px-[24px] py-[20px]"
          style={{ borderBottom: "1px solid #e2e8f0" }}
        >
          <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">
            {editando ? "Editar Depósito" : "Nuevo Depósito"}
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
          <div>
            <label className={labelClass}>Nombre *</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setError("");
              }}
              placeholder="Ej: Depósito Central"
              className={`${baseInput} ${error ? "!border-[#ef4444] focus:!border-[#ef4444]" : ""}`}
            />
            {error && <p className="text-[#ef4444] text-[12px] mt-[4px]">{error}</p>}
          </div>

          <div>
            <label className={labelClass}>Dirección</label>
            <input
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Ej: Av. Siempreviva 742"
              className={baseInput}
            />
          </div>

          {editando && (
            <div>
              <label className={labelClass}>Estado</label>
              <select
                value={String(activo)}
                onChange={(e) => setActivo(Number(e.target.value))}
                className={baseInput + " cursor-pointer"}
              >
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </div>
          )}
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
            {saving ? "Guardando..." : editando ? "Guardar Cambios" : "Crear Depósito"}
          </button>
        </div>
      </div>
    </div>
  );
}
