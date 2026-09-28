import { useState } from "react";
import {
  createProveedor,
  updateProveedor,
  type Proveedor,
  type ProveedorEstado,
  type ProveedorInput,
} from "@/services/api";

const ESTADOS: ProveedorEstado[] = ["Activo", "Inactivo", "Suspendido", "Pendiente"];

interface FormState {
  razonSocial: string;
  cuit: string;
  contacto: string;
  email: string;
  telefono: string;
  direccion: string;
  localidad: string;
  rubro: string;
  estado: ProveedorEstado;
  cbu: string;
  alias: string;
  notas: string;
}

const vacio: FormState = {
  razonSocial: "",
  cuit: "",
  contacto: "",
  email: "",
  telefono: "",
  direccion: "",
  localidad: "",
  rubro: "",
  estado: "Activo",
  cbu: "",
  alias: "",
  notas: "",
};

function desdeProveedor(p: Proveedor): FormState {
  return {
    razonSocial: p.razonSocial,
    cuit: p.cuit ?? "",
    contacto: p.contacto ?? "",
    email: p.email ?? "",
    telefono: p.telefono ?? "",
    direccion: p.direccion ?? "",
    localidad: p.localidad ?? "",
    rubro: p.rubro ?? "",
    estado: p.estado,
    cbu: p.cbu ?? "",
    alias: p.alias ?? "",
    notas: p.notas ?? "",
  };
}

interface Props {
  proveedor?: Proveedor;
  onClose: () => void;
  onSaved: () => void;
}

const labelClass =
  "font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block";
const baseInput =
  "w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white border border-[#e2e8f0] focus:border-[#0ea5e9]";

export default function ProveedorFormModal({ proveedor, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(proveedor ? desdeProveedor(proveedor) : vacio);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const editando = Boolean(proveedor);

  function change(field: keyof FormState, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: "" }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.razonSocial.trim()) e.razonSocial = "La razón social es obligatoria";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleGuardar() {
    if (!validate()) return;
    setSaving(true);
    try {
      const data: ProveedorInput = {
        razonSocial: form.razonSocial.trim(),
        cuit: form.cuit.trim(),
        contacto: form.contacto.trim(),
        email: form.email.trim(),
        telefono: form.telefono.trim(),
        direccion: form.direccion.trim(),
        localidad: form.localidad.trim(),
        rubro: form.rubro.trim(),
        estado: form.estado,
        cbu: form.cbu.trim(),
        alias: form.alias.trim(),
        notas: form.notas.trim(),
      };
      if (proveedor) await updateProveedor(proveedor.id, data);
      else await createProveedor(data);
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar el proveedor");
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
        className="relative bg-white rounded-[16px] w-[560px] max-h-[90vh] overflow-y-auto"
        style={{ border: "1px solid #e2e8f0" }}
      >
        <div
          className="flex items-center justify-between px-[24px] py-[20px]"
          style={{ borderBottom: "1px solid #e2e8f0" }}
        >
          <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">
            {editando ? "Editar Proveedor" : "Nuevo Proveedor"}
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
            <label className={labelClass}>Razón social *</label>
            <input
              type="text"
              value={form.razonSocial}
              onChange={(e) => change("razonSocial", e.target.value)}
              placeholder="Ej: Distribuidora Técnica SRL"
              className={inputClass("razonSocial")}
            />
            {errors.razonSocial && (
              <p className="text-[#ef4444] text-[12px] mt-[4px]">{errors.razonSocial}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-[12px]">
            <div>
              <label className={labelClass}>CUIT</label>
              <input
                type="text"
                value={form.cuit}
                onChange={(e) => change("cuit", e.target.value)}
                placeholder="Ej: 30-71234567-9"
                className={baseInput}
              />
            </div>
            <div>
              <label className={labelClass}>Rubro</label>
              <input
                type="text"
                value={form.rubro}
                onChange={(e) => change("rubro", e.target.value)}
                placeholder="Ej: Bombas"
                className={baseInput}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-[12px]">
            <div>
              <label className={labelClass}>Contacto</label>
              <input
                type="text"
                value={form.contacto}
                onChange={(e) => change("contacto", e.target.value)}
                placeholder="Nombre del contacto"
                className={baseInput}
              />
            </div>
            <div>
              <label className={labelClass}>Teléfono</label>
              <input
                type="text"
                value={form.telefono}
                onChange={(e) => change("telefono", e.target.value)}
                placeholder="Ej: 343-4551234"
                className={baseInput}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => change("email", e.target.value)}
              placeholder="Ej: contacto@proveedor.com"
              className={baseInput}
            />
          </div>

          <div className="grid grid-cols-2 gap-[12px]">
            <div>
              <label className={labelClass}>Dirección</label>
              <input
                type="text"
                value={form.direccion}
                onChange={(e) => change("direccion", e.target.value)}
                placeholder="Ej: Av. 25 de Mayo 1230"
                className={baseInput}
              />
            </div>
            <div>
              <label className={labelClass}>Localidad</label>
              <input
                type="text"
                value={form.localidad}
                onChange={(e) => change("localidad", e.target.value)}
                placeholder="Ej: Paraná"
                className={baseInput}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-[12px]">
            <div>
              <label className={labelClass}>CBU</label>
              <input
                type="text"
                value={form.cbu}
                onChange={(e) => change("cbu", e.target.value)}
                placeholder="22 dígitos"
                className={baseInput}
              />
            </div>
            <div>
              <label className={labelClass}>Alias</label>
              <input
                type="text"
                value={form.alias}
                onChange={(e) => change("alias", e.target.value)}
                placeholder="Ej: DISTECNICA"
                className={baseInput}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Estado</label>
            <select
              value={form.estado}
              onChange={(e) => change("estado", e.target.value)}
              className={baseInput + " cursor-pointer"}
            >
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Observaciones</label>
            <textarea
              value={form.notas}
              onChange={(e) => change("notas", e.target.value)}
              rows={3}
              placeholder="Notas sobre el proveedor (opcional)"
              className={baseInput + " resize-none"}
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
            {saving ? "Guardando..." : editando ? "Guardar Cambios" : "Crear Proveedor"}
          </button>
        </div>
      </div>
    </div>
  );
}
