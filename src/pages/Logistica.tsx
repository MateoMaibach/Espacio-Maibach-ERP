import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import {
  getDepositos,
  getArticulos,
  getRemitos,
  getRemito,
  anularRemito,
  type Articulo,
  type Deposito,
  type Remito,
} from "@/services/api";
import RemitoFormModal from "@/components/RemitoFormModal";

function formatMonto(valor: number) {
  return `$${valor.toLocaleString("es-AR")}`;
}

function formatFecha(fecha: string) {
  if (!fecha) return "—";
  const [a, m, d] = fecha.split("-");
  return `${d}/${m}/${a}`;
}

const estadoStyle: Record<string, { bg: string; color: string }> = {
  Emitido: { bg: "#d1fae5", color: "#10b981" },
  Anulado: { bg: "#fee2e2", color: "#ef4444" },
};

const tipoStyle: Record<string, { bg: string; color: string }> = {
  salida: { bg: "#fef3c7", color: "#b45309" },
  transferencia: { bg: "#e0f2fe", color: "#0284c7" },
};

export default function Logistica() {
  const navigate = useNavigate();
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [loading, setLoading] = useState(true);

  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroDeposito, setFiltroDeposito] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const [modalNuevo, setModalNuevo] = useState(false);
  const [detalle, setDetalle] = useState<Remito | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [anulando, setAnulando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [remitosRes, deps] = await Promise.all([
        getRemitos({
          tipo: (filtroTipo as "salida" | "transferencia") || undefined,
          depositoId: filtroDeposito || undefined,
          desde: filtroDesde || undefined,
          hasta: filtroHasta || undefined,
        }),
        getDepositos(),
      ]);
      setRemitos(remitosRes);
      setDepositos(deps);
    } catch (err) {
      console.error(err);
      alert("Error al cargar los remitos");
    } finally {
      setLoading(false);
    }
  }, [filtroTipo, filtroDeposito, filtroDesde, filtroHasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    getArticulos()
      .then(setArticulos)
      .catch((err) => console.error(err));
  }, []);

  async function abrirDetalle(id: string) {
    setCargandoDetalle(true);
    setDetalle(null);
    try {
      setDetalle(await getRemito(id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al cargar el remito");
    } finally {
      setCargandoDetalle(false);
    }
  }

  async function confirmarAnular() {
    if (!detalle) return;
    setAnulando(true);
    try {
      await anularRemito(detalle.id);
      setDetalle(null);
      await cargar();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al anular el remito");
    } finally {
      setAnulando(false);
    }
  }

  const emitidos = remitos.filter((r) => r.estado === "Emitido");
  const anulados = remitos.filter((r) => r.estado === "Anulado");
  const valorEnCalle = emitidos
    .filter((r) => r.tipo === "salida")
    .reduce((s, r) => s + r.valorTotal, 0);
  const enTransferencia = emitidos
    .filter((r) => r.tipo === "transferencia")
    .reduce((s, r) => s + r.valorTotal, 0);

  const summary = [
    { label: "Remitos Emitidos", value: String(emitidos.length), color: "#0ea5e9" },
    { label: "Valor en la Calle (salidas)", value: formatMonto(valorEnCalle), color: "#f59e0b" },
    { label: "En Transferencia", value: formatMonto(enTransferencia), color: "#7c3aed" },
    { label: "Anulados", value: String(anulados.length), color: "#94a3b8" },
  ];

  const inputCls =
    "bg-white font-['Geist:Regular',sans-serif] text-[14px] text-[#475569] px-[12px] py-[9px] rounded-[8px] outline-none cursor-pointer";
  const thCls =
    "text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] px-[20px] py-[14px]";

  return (
    <AppLayout
      breadcrumbs={[{ label: "Inicio", onClick: () => navigate("/") }, { label: "Logística" }]}
    >
      <div className="p-[32px] flex flex-col gap-[24px]">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[24px]">
              Logística
            </p>
            <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[14px] mt-[4px]">
              Notas de remisión: salidas a obra/cliente y transferencias entre depósitos
            </p>
          </div>
          <button
            onClick={() => setModalNuevo(true)}
            disabled={depositos.length === 0}
            className="bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] px-[16px] py-[10px] rounded-[8px] disabled:opacity-60"
            title={depositos.length === 0 ? "Primero creá un depósito en Stock" : ""}
          >
            Nuevo Remito
          </button>
        </div>

        <div className="grid grid-cols-4 gap-[16px]">
          {summary.map((s, i) => (
            <div
              key={i}
              className="bg-white p-[20px] rounded-[12px]"
              style={{ border: "1px solid #e2e8f0" }}
            >
              <p className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[13px]">
                {s.label}
              </p>
              <p
                className="font-['Geist:Bold',sans-serif] font-bold text-[24px] mt-[6px]"
                style={{ color: s.color }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-[12px] flex-wrap">
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className={inputCls}
            style={{ border: "1px solid #e2e8f0" }}
          >
            <option value="">Tipo: Todos</option>
            <option value="salida">Salida</option>
            <option value="transferencia">Transferencia</option>
          </select>
          <select
            value={filtroDeposito}
            onChange={(e) => setFiltroDeposito(e.target.value)}
            className={inputCls}
            style={{ border: "1px solid #e2e8f0" }}
          >
            <option value="">Depósito: Todos</option>
            {depositos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filtroDesde}
            onChange={(e) => setFiltroDesde(e.target.value)}
            className={inputCls}
            style={{ border: "1px solid #e2e8f0" }}
          />
          <input
            type="date"
            value={filtroHasta}
            onChange={(e) => setFiltroHasta(e.target.value)}
            className={inputCls}
            style={{ border: "1px solid #e2e8f0" }}
          />
        </div>

        <div
          className="bg-white rounded-[12px] overflow-hidden"
          style={{ border: "1px solid #e2e8f0" }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                {[
                  "Número",
                  "Fecha",
                  "Tipo",
                  "Origen",
                  "Destino",
                  "Artículos",
                  "Valor",
                  "Estado",
                  "",
                ].map((h) => (
                  <th key={h} className={thCls}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading &&
                remitos.map((r, i) => (
                  <tr
                    key={r.id}
                    onClick={() => abrirDetalle(r.id)}
                    className="group hover:bg-[#f8fafc] transition-colors cursor-pointer"
                    style={{
                      borderBottom: i < remitos.length - 1 ? "1px solid #f1f5f9" : "none",
                    }}
                  >
                    <td className="px-[20px] py-[16px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                      {r.etiqueta ?? `REM-${String(r.numero).padStart(4, "0")}`}
                    </td>
                    <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                      {formatFecha(r.fecha)}
                    </td>
                    <td className="px-[20px] py-[16px]">
                      <span
                        className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[8px] py-[3px] rounded-[6px] capitalize"
                        style={tipoStyle[r.tipo] ?? tipoStyle.salida}
                      >
                        {r.tipo === "salida" ? "Salida" : "Transferencia"}
                      </span>
                    </td>
                    <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                      {r.depositoOrigen ?? "—"}
                    </td>
                    <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                      {r.tipo === "transferencia" ? (r.depositoDestino ?? "—") : (r.destino ?? "—")}
                    </td>
                    <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                      {r.articulos ?? "—"}
                    </td>
                    <td className="px-[20px] py-[16px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                      {formatMonto(r.valorTotal)}
                    </td>
                    <td className="px-[20px] py-[16px]">
                      <span
                        className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[8px] py-[3px] rounded-[6px]"
                        style={estadoStyle[r.estado] ?? estadoStyle.Emitido}
                      >
                        {r.estado}
                      </span>
                    </td>
                    <td className="px-[20px] py-[16px]">
                      <div className="flex items-center gap-[4px] opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirDetalle(r.id);
                          }}
                          className="size-[28px] flex items-center justify-center rounded-[6px] hover:bg-[#f1f5f9] transition-colors"
                          title="Ver detalle"
                        >
                          <svg fill="none" height="14" viewBox="0 0 16 16" width="14">
                            <path
                              d="M6 3L11 8L6 13"
                              stroke="#64748b"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.5"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              {!loading && remitos.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-[20px] py-[40px] text-center">
                    <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
                      No hay remitos emitidos. Cargá un depósito y artículos en Stock para empezar.
                    </p>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={9} className="px-[20px] py-[40px] text-center">
                    <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
                      Cargando remitos...
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalNuevo && depositos.length > 0 && articulos.length > 0 && (
        <RemitoFormModal
          depositos={depositos}
          articulos={articulos}
          onClose={() => setModalNuevo(false)}
          onSaved={(etiqueta) => {
            setModalNuevo(false);
            cargar();
            alert(`Remito ${etiqueta} emitido correctamente`);
          }}
        />
      )}

      {modalNuevo && (depositos.length === 0 || articulos.length === 0) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalNuevo(false)} />
          <div
            className="relative bg-white rounded-[16px] w-[440px] p-[24px]"
            style={{ border: "1px solid #e2e8f0" }}
          >
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">
              Faltan datos base
            </p>
            <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px] mt-[8px]">
              Para emitir un remito necesitás al menos un depósito y un artículo cargados. Andá a la
              pantalla de Stock para cargarlos.
            </p>
            <div className="flex items-center justify-end gap-[12px] mt-[24px]">
              <button
                onClick={() => setModalNuevo(false)}
                className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={() => navigate("/stock")}
                className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px]"
              >
                Ir a Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {(detalle || cargandoDetalle) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetalle(null)} />
          <div
            className="relative bg-white rounded-[16px] w-[680px] max-h-[90vh] overflow-y-auto"
            style={{ border: "1px solid #e2e8f0" }}
          >
            <div
              className="flex items-center justify-between px-[24px] py-[20px]"
              style={{ borderBottom: "1px solid #e2e8f0" }}
            >
              <div>
                <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">
                  {cargandoDetalle
                    ? "Cargando..."
                    : `Remito ${detalle?.etiqueta ?? `REM-${String(detalle?.numero ?? 0).padStart(4, "0")}`}`}
                </p>
                {detalle && (
                  <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px] mt-[2px]">
                    {formatFecha(detalle.fecha)} ·{" "}
                    {detalle.tipo === "salida" ? "Salida" : "Transferencia"} ·{" "}
                    {detalle.depositoOrigen}
                    {detalle.tipo === "transferencia"
                      ? ` → ${detalle.depositoDestino ?? ""}`
                      : detalle.destino
                        ? ` · ${detalle.destino}`
                        : ""}
                  </p>
                )}
              </div>
              <button
                onClick={() => setDetalle(null)}
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

            {detalle && (
              <div className="px-[24px] py-[20px]">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {["Artículo", "Cantidad", "Costo", "Subtotal"].map((h) => (
                        <th
                          key={h}
                          className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] py-[8px]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(detalle.items ?? []).map((it, i) => (
                      <tr
                        key={it.id ?? i}
                        style={{
                          borderBottom:
                            i < (detalle.items?.length ?? 0) - 1 ? "1px solid #f1f5f9" : "none",
                        }}
                      >
                        <td className="py-[12px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                          {it.articuloNombre}
                          {it.codigo ? (
                            <span className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px] ml-[6px]">
                              {it.codigo}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-[12px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                          {it.cantidad.toLocaleString("es-AR")} {it.unidad}
                        </td>
                        <td className="py-[12px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                          {formatMonto(it.costoUnitario)}
                        </td>
                        <td className="py-[12px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                          {formatMonto(it.subtotal ?? it.cantidad * it.costoUnitario)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div
                  className="flex items-center justify-between mt-[16px] pt-[16px]"
                  style={{ borderTop: "1px solid #e2e8f0" }}
                >
                  <span className="font-['Geist:Medium',sans-serif] text-[#475569] text-[14px]">
                    Valor total (costo congelado al emitir)
                  </span>
                  <span className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">
                    {formatMonto(detalle.valorTotal)}
                  </span>
                </div>

                {detalle.observaciones && (
                  <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px] mt-[12px]">
                    {detalle.observaciones}
                  </p>
                )}
              </div>
            )}

            <div
              className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]"
              style={{ borderTop: "1px solid #e2e8f0" }}
            >
              <button
                onClick={() => setDetalle(null)}
                className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors"
              >
                Cerrar
              </button>
              {detalle?.estado === "Emitido" && (
                <button
                  onClick={confirmarAnular}
                  disabled={anulando}
                  className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#ef4444] hover:bg-[#dc2626] transition-colors px-[16px] py-[10px] rounded-[8px] disabled:opacity-60"
                >
                  {anulando ? "Anulando..." : "Anular Remito"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
