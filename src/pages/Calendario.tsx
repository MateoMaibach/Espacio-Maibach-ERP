import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

type InstState = "Confirmada" | "Pendiente" | "En Proceso";

interface Instalacion {
  cliente: string;
  producto: string;
  estado: InstState;
}

interface VeradaSlot {
  cliente?: string;
  direccion?: string;
}

const instalaciones: (Instalacion | null)[][] = [
  [{ cliente: "García, Roberto", producto: "Roma 6x3", estado: "Confirmada" }, { cliente: "Pérez, Estela", producto: "Venecia 5x2.5", estado: "Pendiente" }],
  [{ cliente: "Albornoz, Lucía", producto: "Ibiza 7x3.5", estado: "Confirmada" }, null],
  [{ cliente: "Rodríguez, Juan", producto: "Roma 6x3", estado: "En Proceso" }, null],
  [{ cliente: "Sánchez, Fernando", producto: "Venecia 5x2.5", estado: "Confirmada" }, null],
  [{ cliente: "Busto, Alejandro", producto: "Ibiza 7x3.5", estado: "Confirmada" }, { cliente: "Gómez, María", producto: "Modelo 4x2", estado: "Pendiente" }],
];

const veredas: (VeradaSlot | null)[][] = [
  [{ cliente: "Sánchez F.", direccion: "Oro Verde 240" }, null],
  [{ cliente: "García R.", direccion: "Calle 12 nro 431" }, { cliente: "Fernández H.", direccion: "San Martín 921" }],
  [null, null],
  [{ cliente: "Albornoz L.", direccion: "Paraná 105" }, null],
  [null, null],
];

const weekDays = ["Lunes 17", "Martes 18", "Miércoles 19", "Jueves 20", "Viernes 21"];

const estadoConfig: Record<InstState, { bg: string; border: string; badgeBg: string; badgeColor: string }> = {
  Confirmada: { bg: "#d1fae5", border: "#10b981", badgeBg: "white", badgeColor: "#10b981" },
  Pendiente: { bg: "#fef3c7", border: "#f59e0b", badgeBg: "white", badgeColor: "#f59e0b" },
  "En Proceso": { bg: "#e0f2fe", border: "#0ea5e9", badgeBg: "white", badgeColor: "#0ea5e9" },
};

export default function Calendario() {
  const navigate = useNavigate();
  const [view, setView] = useState<"Mes" | "Semana">("Semana");
  const [monthIdx, setMonthIdx] = useState(7);
  const [year] = useState(2026);

  const monthLabel = `${MONTHS[monthIdx]} ${year}`;

  return (
    <AppLayout breadcrumbs={[{ label: "Inicio", onClick: () => navigate("/") }, { label: "Calendario" }]}>
      <div className="p-[32px] flex flex-col gap-[24px]">
        {/* Title Row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[24px]">Calendario</p>
            <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[14px] mt-[4px]">Coordinación semanal de instalaciones de piletas y veredas rústicas</p>
          </div>
          <div className="flex items-center gap-[12px]">
            {/* View switch */}
            <div className="bg-[#e2e8f0] flex items-start p-[3px] rounded-[10px]">
              {(["Mes", "Semana"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-[11px] py-[5px] rounded-[8px] text-[12px] ${view === v ? "bg-white font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a]" : "font-['Geist:Medium',sans-serif] font-medium text-[#475569]"}`}
                >
                  {v}
                </button>
              ))}
            </div>
            {/* Navigation */}
            <div className="flex items-center gap-[4px]">
              <button
                onClick={() => setMonthIdx((m) => (m - 1 + 12) % 12)}
                className="bg-white flex items-center p-[8px] rounded-[6px]"
                style={{ border: "1px solid #e2e8f0" }}
              >
                <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
                  <path d="M10 12L6 8L10 4" stroke="#475569" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </button>
              <div className="bg-white px-[16px] py-[8px] rounded-[6px]" style={{ border: "1px solid #e2e8f0" }}>
                <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">{monthLabel}</p>
              </div>
              <button
                onClick={() => setMonthIdx((m) => (m + 1) % 12)}
                className="bg-white flex items-center p-[8px] rounded-[6px]"
                style={{ border: "1px solid #e2e8f0" }}
              >
                <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
                  <path d="M6 12L10 8L6 4" stroke="#475569" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex gap-[24px] items-start">
          {/* Main Calendar */}
          <div className="flex flex-col gap-[24px] flex-1 min-w-0">
            {/* Instalaciones */}
            <div className="bg-white p-[20px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
              <div className="flex items-center justify-between mb-[16px]">
                <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px]">Instalaciones (Piletas)</p>
                <div className="flex items-center gap-[12px]">
                  <div className="flex items-center gap-[4px]">
                    <div className="size-[8px] rounded-full bg-[#10B981]" />
                    <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">Confirmada</p>
                  </div>
                  <div className="flex items-center gap-[4px]">
                    <div className="size-[8px] rounded-full bg-[#F59E0B]" />
                    <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">Pendiente</p>
                  </div>
                </div>
              </div>
              {/* Week header */}
              <div className="grid gap-[12px] mb-[12px]" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
                {weekDays.map((d) => (
                  <div key={d} className="bg-[#f8fafc] flex items-center justify-center p-[12px] rounded-[8px]">
                    <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#475569] text-[13px]">{d}</p>
                  </div>
                ))}
              </div>
              {/* Grid */}
              <div className="grid gap-[12px]" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
                {instalaciones.map((col, ci) => (
                  <div key={ci} className="flex flex-col gap-[10px]">
                    {col.map((slot, ri) =>
                      slot ? (
                        <div
                          key={ri}
                          className="flex flex-col gap-[4px] p-[12px] rounded-[8px]"
                          style={{ background: estadoConfig[slot.estado].bg, border: `1px solid ${estadoConfig[slot.estado].border}` }}
                        >
                          <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px] truncate">{slot.cliente}</p>
                          <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[11px]">{slot.producto}</p>
                          <span
                            className="font-['Geist:SemiBold',sans-serif] font-semibold text-[10px] px-[6px] py-[2px] rounded-[4px] self-start"
                            style={{ background: estadoConfig[slot.estado].badgeBg, color: estadoConfig[slot.estado].badgeColor }}
                          >
                            {slot.estado}
                          </span>
                        </div>
                      ) : (
                        <div
                          key={ri}
                          className="flex items-center justify-center p-[16px] rounded-[8px]"
                          style={{ border: "1px dashed #e2e8f0" }}
                        >
                          <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">Disponible</p>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Veredas */}
            <div className="bg-white p-[20px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px] mb-[16px]">Hormigón &amp; Veredas</p>
              <div className="grid gap-[12px]" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
                {veredas.map((col, ci) => (
                  <div key={ci} className="flex flex-col gap-[10px]">
                    {col.map((slot, ri) =>
                      slot ? (
                        <div
                          key={ri}
                          className="bg-[#f8fafc] flex flex-col gap-[4px] p-[12px] rounded-[8px]"
                          style={{ border: "1px solid #e2e8f0" }}
                        >
                          <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px] truncate">{slot.cliente}</p>
                          <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[11px] truncate">{slot.direccion}</p>
                        </div>
                      ) : (
                        <div
                          key={ri}
                          className="flex items-center justify-center p-[12px] rounded-[8px]"
                          style={{ border: "1px dashed #e2e8f0" }}
                        >
                          <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px]">S/Vereda</p>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="bg-white p-[24px] rounded-[12px] shrink-0 w-[340px]" style={{ border: "1px solid #e2e8f0" }}>
            <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px] mb-[20px]">Resumen de Semana</p>
            <div className="flex flex-col gap-[12px] mb-[20px]">
              {[
                { label: "Instalaciones", value: 5, color: "#0ea5e9" },
                { label: "Veredas Rústicas", value: 3, color: "#10b981" },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between p-[16px] rounded-[10px]" style={{ border: "1px solid #e2e8f0" }}>
                  <p className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[14px]">{m.label}</p>
                  <p className="font-['Geist:Bold',sans-serif] font-bold text-[20px]" style={{ color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>
            <div className="h-px bg-[#e2e8f0] mb-[20px]" />
            <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px] mb-[12px]">Logística &amp; Equipos</p>
            <div className="flex flex-col gap-[12px]">
              {[
                { titulo: "Equipo de Excavación", desc: "Chofer: Gomez - Chasis Hidráulico" },
                { titulo: "Equipo de Veredas", desc: "Encargado: Albornoz H. + 2 Ayudantes" },
              ].map((eq) => (
                <div key={eq.titulo} className="bg-[#f8fafc] flex flex-col gap-[4px] p-[12px] rounded-[8px]">
                  <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px]">{eq.titulo}</p>
                  <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">{eq.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
