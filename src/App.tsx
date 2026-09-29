import { BrowserRouter, Routes, Route } from "react-router-dom";
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
      </Routes>
    </BrowserRouter>
  );
}
