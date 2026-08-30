import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface AppLayoutProps {
  children: React.ReactNode;
  breadcrumbs: BreadcrumbItem[];
}

export default function AppLayout({ children, breadcrumbs }: AppLayoutProps) {
  return (
    <div className="bg-[#f8fafc] flex items-start size-full min-h-screen">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 self-stretch">
        <Header breadcrumbs={breadcrumbs} />
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
