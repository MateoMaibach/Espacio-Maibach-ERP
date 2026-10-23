import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import Clientes from "@/pages/Clientes";
import ClienteDetalle from "@/pages/ClienteDetalle";
import Cheques from "@/pages/Cheques";
import Caja from "@/pages/Caja";
import Calendario from "@/pages/Calendario";
import Proveedores from "@/pages/Proveedores";
import ProveedorDetalle from "@/pages/ProveedorDetalle";
import Stock from "@/pages/Stock";
import Logistica from "@/pages/Logistica";
import Finanzas from "@/pages/Finanzas";
import Configuracion from "@/pages/Configuracion";

function NoEncontrado() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <p className="text-5xl font-bold text-slate-300">404</p>
        <p className="mt-2 text-slate-600">La página no existe</p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Volver al Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/clientes/:id" element={<ClienteDetalle />} />
        <Route path="/cheques" element={<Cheques />} />
        <Route path="/caja" element={<Caja />} />
        <Route path="/calendario" element={<Calendario />} />
        <Route path="/proveedores" element={<Proveedores />} />
        <Route path="/proveedores/:id" element={<ProveedorDetalle />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/logistica" element={<Logistica />} />
        <Route path="/finanzas" element={<Finanzas />} />
        <Route path="/configuracion" element={<Configuracion />} />
        <Route path="*" element={<NoEncontrado />} />
      </Routes>
    </BrowserRouter>
  );
}