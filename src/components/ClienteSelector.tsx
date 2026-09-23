import { useState, useEffect, useRef } from "react";

export interface ClienteOption {
  id: string;
  nombre: string;
}

interface Props {
  clientes: ClienteOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  inputClass?: string;
}

export default function ClienteSelector({ clientes, value, onChange, placeholder = "Buscar cliente por nombre o apellido...", inputClass }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = clientes.find((c) => c.id === value) || null;
  const q = query.trim().toLowerCase();
  const filtered = q ? clientes.filter((c) => c.nombre.toLowerCase().includes(q)) : clientes;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function seleccionar(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  function limpiar() {
    onChange("");
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={open ? query : selected ? selected.nombre : ""}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder={selected ? selected.nombre : placeholder}
        className={(inputClass || "") + (selected && !open ? " pr-[28px]" : "")}
      />
      {selected && !open && (
        <button
          type="button"
          onClick={limpiar}
          title="Quitar cliente"
          className="absolute right-[8px] top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#ef4444] transition-colors text-[16px] leading-none px-[2px]"
        >
          ×
        </button>
      )}
      {open && (
        <div className="absolute z-[60] mt-[4px] w-full bg-white rounded-[8px] border border-[#e2e8f0] shadow-lg max-h-[220px] overflow-y-auto">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              limpiar();
            }}
            className="w-full text-left px-[12px] py-[9px] font-['Geist:Regular',sans-serif] text-[14px] text-[#94a3b8] hover:bg-[#f8fafc] transition-colors"
          >
            Sin cliente
          </button>
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                seleccionar(c.id);
              }}
              className={`w-full text-left px-[12px] py-[9px] font-['Geist:Regular',sans-serif] text-[14px] transition-colors hover:bg-[#f1f5f9] ${
                c.id === value ? "text-[#0ea5e9] font-semibold" : "text-[#0f172a]"
              }`}
            >
              {c.nombre}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-[12px] py-[9px] font-['Geist:Regular',sans-serif] text-[13px] text-[#94a3b8]">Sin resultados para "{query}"</p>
          )}
        </div>
      )}
    </div>
  );
}
