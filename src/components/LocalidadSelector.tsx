import { useState, useEffect } from "react";
import { provinciasArgentina, getCiudadesPorProvincia } from "@/data/localidades";

interface LocalidadSelectorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function parseLocalidad(value: string): { provincia: string; ciudad: string } {
  if (!value) return { provincia: "", ciudad: "" };
  const parts = value.split(", ");
  if (parts.length >= 2) {
    return { ciudad: parts[0] || "", provincia: parts.slice(1).join(", ") };
  }
  return { provincia: "", ciudad: value };
}

export default function LocalidadSelector({ value, onChange, error }: LocalidadSelectorProps) {
  const parsed = parseLocalidad(value);
  const [provincia, setProvincia] = useState(parsed.provincia);
  const [ciudad, setCiudad] = useState(parsed.ciudad);

  const ciudades = provincia ? getCiudadesPorProvincia(provincia) : [];

  useEffect(() => {
    if (provincia && ciudad) {
      const match = ciudades.includes(ciudad);
      if (!match) setCiudad("");
    }
  }, [provincia]);

  function handleProvinciaChange(newProvincia: string) {
    setProvincia(newProvincia);
    setCiudad("");
    if (newProvincia) {
      onChange(`, ${newProvincia}`);
    } else {
      onChange("");
    }
  }

  function handleCiudadChange(newCiudad: string) {
    setCiudad(newCiudad);
    if (newCiudad && provincia) {
      onChange(`${newCiudad}, ${provincia}`);
    } else if (provincia) {
      onChange(`, ${provincia}`);
    } else {
      onChange("");
    }
  }

  const selectClass = (hasError?: boolean) =>
    `w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border bg-white cursor-pointer transition-colors ${
      hasError ? "border-[#ef4444] focus:border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"
    }`;

  return (
    <div className="grid grid-cols-2 gap-[12px]">
      <div>
        <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Provincia</label>
        <select value={provincia} onChange={(e) => handleProvinciaChange(e.target.value)} className={selectClass(!!error)}>
          <option value="">Seleccionar provincia...</option>
          {provinciasArgentina.map((p) => (
            <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Ciudad</label>
        <select value={ciudad} onChange={(e) => handleCiudadChange(e.target.value)} disabled={!provincia} className={selectClass(!!error)}>
          <option value="">{provincia ? "Seleccionar ciudad..." : "Elegí una provincia"}</option>
          {ciudades.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
