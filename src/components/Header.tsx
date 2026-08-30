import { IconSearch, IconBell } from "./Icons";

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface HeaderProps {
  breadcrumbs: BreadcrumbItem[];
}

export default function Header({ breadcrumbs }: HeaderProps) {
  return (
    <div className="bg-white flex h-[72px] items-center justify-between px-[32px] py-[16px] w-full shrink-0" style={{ borderBottom: "1px solid #e2e8f0" }}>
      <div className="flex gap-[8px] items-center">
        {breadcrumbs.map((crumb, i) => (
          <div key={i} className="flex gap-[8px] items-center">
            {i < breadcrumbs.length - 1 ? (
              <>
                <button
                  onClick={crumb.onClick}
                  className="font-['Geist:Regular',sans-serif] font-normal text-[#94a3b8] text-[14px] whitespace-nowrap hover:text-[#475569] transition-colors"
                >
                  {crumb.label}
                </button>
                <span className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">/</span>
              </>
            ) : (
              <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px] whitespace-nowrap">
                {crumb.label}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-[24px] items-center">
        <div className="bg-[#f8fafc] flex gap-[8px] items-center px-[16px] py-[8px] rounded-[8px] w-[280px]" style={{ border: "1px solid #e2e8f0" }}>
          <IconSearch />
          <p className="font-['Geist:Regular',sans-serif] font-normal text-[#94a3b8] text-[14px] truncate flex-1">
            Buscar cliente, orden, cheque...
          </p>
        </div>
        <div className="relative flex items-center justify-center size-[32px]">
          <IconBell />
          <div className="absolute top-[2px] right-[2px] bg-[#ef4444] flex items-center justify-center rounded-full size-[14px]">
            <span className="font-['Geist:Bold',sans-serif] font-bold text-white text-[9px]">3</span>
          </div>
        </div>
        <div className="bg-[#e2e8f0] rounded-full size-[32px] flex items-center justify-center">
          <span className="font-['Geist:Bold',sans-serif] font-bold text-[#475569] text-[12px]">MM</span>
        </div>
      </div>
    </div>
  );
}
