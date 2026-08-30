import { useNavigate, useLocation } from "react-router-dom";
import { IconDroplets, IconDashboard, IconUsers, IconWallet, IconCreditCard, IconCalendar, IconTruck, IconPackage, IconTrendingUp, IconSettings } from "./Icons";

const navItems = [
  { label: "Dashboard", path: "/", icon: IconDashboard },
  { label: "Clientes", path: "/clientes", icon: IconUsers },
  { label: "Caja", path: "/caja", icon: IconWallet },
  { label: "Cheques", path: "/cheques", icon: IconCreditCard },
  { label: "Calendario", path: "/calendario", icon: IconCalendar },
  { label: "Logística", path: "/logistica", icon: IconTruck },
  { label: "Proveedores", path: "/proveedores", icon: IconPackage },
  { label: "Finanzas", path: "/finanzas", icon: IconTrendingUp },
  { label: "Configuración", path: "/configuracion", icon: IconSettings },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="bg-white flex flex-col items-start justify-between self-stretch shrink-0 w-[280px] relative">
      <div className="absolute border-r border-[#e2e8f0] inset-0 pointer-events-none" />
      <div className="flex flex-col items-start w-full">
        {/* Logo */}
        <div className="flex gap-[12px] items-center px-[24px] pt-[24px] pb-[20px] w-full">
          <div className="bg-[#e0f2fe] flex items-center justify-center rounded-[8px] size-[36px]">
            <IconDroplets />
          </div>
          <div className="flex flex-col gap-[2px]">
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">Espacio Maibach</p>
            <p className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[11px] tracking-[1px] uppercase">Piletas de Fibra</p>
          </div>
        </div>
        <div className="h-px bg-[#e2e8f0] w-full" />
        {/* Nav */}
        <div className="flex flex-col gap-[4px] px-[16px] pt-[20px] w-full">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex gap-[12px] items-center px-[16px] py-[10px] rounded-[8px] w-full text-left transition-colors ${
                  isActive ? "bg-[#e0f2fe]" : "hover:bg-[#f8fafc]"
                }`}
              >
                <Icon color={isActive ? "#0EA5E9" : "#475569"} />
                <p className={`font-['Geist:Medium',sans-serif] font-medium text-[14px] ${
                  isActive ? "font-['Geist:SemiBold',sans-serif] font-semibold text-[#0ea5e9]" : "text-[#475569]"
                }`}>
                  {item.label}
                </p>
              </button>
            );
          })}
        </div>
      </div>
      {/* Bottom */}
      <div className="flex flex-col items-start w-full">
        <div className="h-px bg-[#e2e8f0] w-full" />
        <div className="flex items-center justify-between px-[24px] py-[16px] w-full">
          <p className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px]">Modo Claro</p>
          <div className="h-[20px] w-[38px] relative">
            <svg className="block size-full" fill="none" height="20" viewBox="0 0 38 20" width="38">
              <rect fill="#E0F2FE" height="20" rx="10" width="38" />
              <circle cx="10" cy="10" fill="#0EA5E9" r="8" />
            </svg>
          </div>
        </div>
        <div className="flex gap-[12px] items-center bg-[#f8fafc] px-[24px] py-[20px] w-full">
          <div className="bg-[#e2e8f0] rounded-full size-[40px] flex items-center justify-center">
            <span className="font-['Geist:Bold',sans-serif] font-bold text-[#475569] text-[14px]">MM</span>
          </div>
          <div className="flex flex-col gap-[2px] flex-1 min-w-0">
            <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px] truncate">Martín Maibach</p>
            <p className="font-['Geist:Regular',sans-serif] font-normal text-[#94a3b8] text-[12px]">Administrador</p>
          </div>
        </div>
      </div>
    </div>
  );
}
