import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCajasActivas,
  getMonedasCaja,
  getCheques,
  getCompras,
  createOrdenPago,
  type CajaItem,
  type Cheque,
  type Compra,
  type OrdenPagoCompraLink,
} from "@/services/api";

interface Linea {
  metodo: "caja" | "cheque";
  subCaja: string;
  moneda: string;
  tipoCambio: string;
  monto: string;
  chequeId: string;
}

interface CompraSeleccion {
  compraId: string;
  monto: string;
}

interface Props {
  proveedorId: string;
  proveedorNombre: string;
  onClose: () => void;
  onCreated: () => void;
}

const labelClass =
  "font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block";
const inputClass =
  "w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white border border-[#e2e8f0] focus:border-[#0ea5e9]";

function hoy(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function parseItems(raw: Compra["items"]): { detalle: string }[] {
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatMonto(value: number, moneda: string): string {
  if (moneda === "ARS") return `$${value.toLocaleString("es-AR")}`;
  return `${moneda} ${value.toLocaleString("es-AR")}`;
}

const lineaVacia = (subCaja: string, moneda: string): Linea => ({
  metodo: "caja",
  subCaja,
  moneda,
  tipoCambio: "",
  monto: "",
  chequeId: "",
});

export default function OrdenPagoModal({
  proveedorId,
  proveedorNombre,
  onClose,
  onCreated,
}: Props) {
  const [fecha, setFecha] = useState(hoy());
  const [concepto, setConcepto] = useState(`Pago a ${proveedorNombre}`);
  const [observaciones, setObservaciones] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [cajas, setCajas] = useState<CajaItem[]>([]);
  const [monedas, setMonedas] = useState<string[]>(["ARS"]);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [cargando, setCargando] = useState(true);

  const [lineas, setLineas] = useState<Linea[]>([]);
  const [comprasSel, setComprasSel] = useState<CompraSeleccion[]>([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [cajasData, monedasData, chequesData, comprasData] = await Promise.all([
        getCajasActivas(),
        getMonedasCaja(),
        getCheques(),
        getCompras(proveedorId),
      ]);
      setCajas(cajasData);
      setMonedas(monedasData.length > 0 ? monedasData : ["ARS"]);
      setCheques(chequesData);
      setCompras(comprasData);
      const primeraCaja = cajasData[0]?.nombre ?? "Efectivo";
      const primeraMoneda = monedasData[0] ?? "ARS";
      setLineas([lineaVacia(primeraCaja, primeraMoneda)]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al cargar los datos de la orden");
    } finally {
      setCargando(false);
    }
  }, [proveedorId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const chequesDisponibles = useMemo(
    () =>
      cheques.filter((c) =>
        c.tipo === "emitido" ? c.estado === "Pendiente" : c.estado === "En Cartera",
      ),
    [cheques],
  );

  const comprasPendientes = useMemo(() => compras.filter((c) => c.total > 0), [compras]);

  function changeLinea(index: number, campo: keyof Linea, valor: string) {
    setLineas((prev) =>
      prev.map((linea, i) => {
        if (i !== index) return linea;
        const nueva = { ...linea, [campo]: valor };

        if (campo === "metodo") {
          if (valor === "cheque") {
            nueva.subCaja = "Cheques";
            nueva.moneda = "ARS";
            nueva.monto = "";
            nueva.chequeId = "";
          }
        }

        if (campo === "chequeId") {
          const cheque = cheques.find((c) => c.id === valor);
          if (cheque) {
            nueva.subCaja = "Cheques";
            nueva.moneda = "ARS";
            nueva.monto = String(cheque.importe);
          }
        }

        if (campo === "moneda" && valor === "ARS") nueva.tipoCambio = "";

        return nueva;
      }),
    );
    if (errors.lineas) setErrors((p) => ({ ...p, lineas: "" }));
  }

  function addLinea() {
    setLineas((prev) => [
      ...prev,
      lineaVacia(prev[0]?.subCaja ?? "Efectivo", prev[0]?.moneda ?? "ARS"),
    ]);
  }

  function removeLinea(index: number) {
    setLineas((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function toggleCompra(compra: Compra) {
    setComprasSel((prev) => {
      const existe = prev.find((s) => s.compraId === compra.id);
      if (existe) return prev.filter((s) => s.compraId !== compra.id);
      return [...prev, { compraId: compra.id, monto: String(compra.total) }];
    });
  }

  function changeCompraMonto(compraId: string, valor: string) {
    setComprasSel((prev) =>
      prev.map((s) => (s.compraId === compraId ? { ...s, monto: valor } : s)),
    );
  }

  const totalesPorMoneda = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const linea of lineas) {
      const monto = Number(linea.monto);
      if (!Number.isFinite(monto) || monto <= 0) continue;
      const moneda = linea.metodo === "cheque" ? "ARS" : linea.moneda;
      mapa[moneda] = (mapa[moneda] ?? 0) + monto;
    }
    return mapa;
  }, [lineas]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!fecha) e.fecha = "La fecha es obligatoria";
    if (!concepto.trim()) e.concepto = "El concepto es obligatorio";

    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i];
      if (!linea) continue;
      const monto = Number(linea.monto);
      if (!Number.isFinite(monto) || monto <= 0) {
        e.lineas = `El tramo ${i + 1} necesita un monto mayor a 0`;
        break;
      }
      if (linea.metodo === "cheque") {
        if (!linea.chequeId) {
          e.lineas = `El tramo ${i + 1} debe indicar un cheque`;
          break;
        }
      } else {
        if (!linea.subCaja) {
          e.lineas = `El tramo ${i + 1} debe indicar una caja`;
          break;
        }
        if (linea.moneda !== "ARS") {
          const tc = Number(linea.tipoCambio);
          if (!Number.isFinite(tc) || tc <= 0) {
            e.lineas = `El tramo ${i + 1} (${linea.moneda}) necesita tipo de cambio`;
            break;
          }
        }
      }
    }

    for (const sel of comprasSel) {
      const compra = compras.find((c) => c.id === sel.compraId);
      const monto = Number(sel.monto);
      if (!compra) continue;
      if (!Number.isFinite(monto) || monto <= 0) {
        e.compras = "Los montos a pagar deben ser mayores a 0";
        break;
      }
      if (monto > compra.total) {
        e.compras = `El pago de "${parseItems(compra.items)[0]?.detalle ?? compra.descripcion ?? "la compra"}" supera su total`;
        break;
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleGuardar() {
    if (!validate()) return;
    setSaving(true);
    try {
      const detalles = lineas.map((linea) => {
        const esCheque = linea.metodo === "cheque";
        return {
          subCaja: esCheque ? "Cheques" : linea.subCaja,
          moneda: esCheque ? "ARS" : linea.moneda,
          tipoCambio:
            esCheque || linea.moneda === "ARS" ? null : Math.round(Number(linea.tipoCambio)),
          monto: Math.round(Number(linea.monto)),
          chequeId: esCheque ? linea.chequeId : null,
        };
      });

      const comprasPagadas: OrdenPagoCompraLink[] = comprasSel.map((s) => ({
        compraId: s.compraId,
        monto: Math.round(Number(s.monto)),
      }));

      await createOrdenPago(proveedorId, {
        fecha,
        concepto: concepto.trim(),
        detalles,
        comprasPagadas,
        observaciones: observaciones.trim(),
      });
      onCreated();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al crear la orden de pago");
    } finally {
      setSaving(false);
    }
  }

  const monedasDeCaja = useMemo(() => Array.from(new Set(monedas)), [monedas]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative bg-white rounded-[16px] w-[760px] max-h-[92vh] overflow-y-auto"
        style={{ border: "1px solid #e2e8f0" }}
      >
        <div
          className="flex items-center justify-between px-[24px] py-[20px]"
          style={{ borderBottom: "1px solid #e2e8f0" }}
        >
          <div>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">
              Nueva Orden de Pago
            </p>
            <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px] mt-[2px]">
              {proveedorNombre}
            </p>
          </div>
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

        {cargando ? (
          <div className="px-[24px] py-[40px] text-center font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
            Cargando datos...
          </div>
        ) : (
          <div className="px-[24px] py-[20px] flex flex-col gap-[20px]">
            <div className="grid grid-cols-2 gap-[12px]">
              <div>
                <label className={labelClass}>Fecha *</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className={inputClass + (errors.fecha ? " !border-[#ef4444]" : "")}
                />
                {errors.fecha && (
                  <p className="text-[#ef4444] text-[12px] mt-[4px]">{errors.fecha}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Concepto *</label>
                <input
                  type="text"
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  className={inputClass + (errors.concepto ? " !border-[#ef4444]" : "")}
                />
                {errors.concepto && (
                  <p className="text-[#ef4444] text-[12px] mt-[4px]">{errors.concepto}</p>
                )}
              </div>
            </div>

            {/* Reparto */}
            <div>
              <div className="flex items-center justify-between mb-[8px]">
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px]">
                  Reparto del pago *
                </label>
                <button
                  onClick={addLinea}
                  className="font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] text-[#0ea5e9] hover:text-[#0284c7] transition-colors"
                >
                  + Agregar tramo
                </button>
              </div>

              <div className="flex flex-col gap-[10px]">
                {lineas.map((linea, i) => (
                  <div
                    key={i}
                    className="p-[12px] rounded-[8px] bg-[#f8fafc] flex flex-col gap-[8px]"
                    style={{ border: "1px solid #e2e8f0" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-[8px]">
                        <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#94a3b8] text-[12px]">
                          Tramo {i + 1}
                        </span>
                        <div className="flex gap-[4px]">
                          {(["caja", "cheque"] as const).map((m) => (
                            <button
                              key={m}
                              onClick={() => changeLinea(i, "metodo", m)}
                              className={`font-['Geist:Medium',sans-serif] font-medium text-[12px] px-[10px] py-[4px] rounded-[6px] transition-colors ${
                                linea.metodo === m
                                  ? m === "caja"
                                    ? "bg-[#0ea5e9] text-white"
                                    : "bg-[#f59e0b] text-white"
                                  : "bg-white text-[#475569] hover:bg-[#f1f5f9]"
                              }`}
                              style={{ border: "1px solid #e2e8f0" }}
                            >
                              {m === "caja" ? "Caja" : "Cheque"}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => removeLinea(i)}
                        disabled={lineas.length === 1}
                        className="size-[26px] flex items-center justify-center rounded-[6px] hover:bg-[#fee2e2] transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Quitar tramo"
                      >
                        <svg fill="none" height="13" viewBox="0 0 16 16" width="13">
                          <path
                            d="M12 4L4 12M4 4L12 12"
                            stroke="#ef4444"
                            strokeLinecap="round"
                            strokeWidth="1.5"
                          />
                        </svg>
                      </button>
                    </div>

                    {linea.metodo === "caja" ? (
                      <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-[8px]">
                        <div>
                          <span className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[11px]">
                            Caja
                          </span>
                          <select
                            value={linea.subCaja}
                            onChange={(e) => changeLinea(i, "subCaja", e.target.value)}
                            className={inputClass + " cursor-pointer"}
                          >
                            {cajas.map((c) => (
                              <option key={c.id} value={c.nombre}>
                                {c.nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <span className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[11px]">
                            Moneda
                          </span>
                          <select
                            value={linea.moneda}
                            onChange={(e) => changeLinea(i, "moneda", e.target.value)}
                            className={inputClass + " cursor-pointer"}
                          >
                            {monedasDeCaja.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <span className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[11px]">
                            Monto
                          </span>
                          <input
                            type="number"
                            value={linea.monto}
                            onChange={(e) => changeLinea(i, "monto", e.target.value)}
                            min="0"
                            placeholder="0"
                            className={inputClass + " text-right"}
                          />
                        </div>
                        <div>
                          <span className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[11px]">
                            {linea.moneda === "ARS" ? "—" : "Tipo de cambio"}
                          </span>
                          {linea.moneda === "ARS" ? (
                            <div className="h-[38px]" />
                          ) : (
                            <input
                              type="number"
                              value={linea.tipoCambio}
                              onChange={(e) => changeLinea(i, "tipoCambio", e.target.value)}
                              min="0"
                              step="0.01"
                              placeholder="1200"
                              className={inputClass + " text-right"}
                            />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-[1.6fr_1fr] gap-[8px]">
                        <div>
                          <span className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[11px]">
                            Cheque (emitido pendiente o recibido en cartera)
                          </span>
                          <select
                            value={linea.chequeId}
                            onChange={(e) => changeLinea(i, "chequeId", e.target.value)}
                            className={inputClass + " cursor-pointer"}
                          >
                            <option value="">Seleccionar cheque...</option>
                            {chequesDisponibles.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.tipo === "emitido" ? "Emitido" : "Recibido"} · {c.banco} N°{" "}
                                {c.numero} · {c.tipo === "emitido" ? c.destinatario : c.recibidoDe}{" "}
                                · ${c.importe.toLocaleString("es-AR")}
                              </option>
                            ))}
                          </select>
                          {chequesDisponibles.length === 0 && (
                            <p className="text-[#f59e0b] text-[12px] mt-[4px]">
                              No hay cheques disponibles (emitidos pendientes ni recibidos en
                              cartera).
                            </p>
                          )}
                        </div>
                        <div>
                          <span className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[11px]">
                            Monto (ARS)
                          </span>
                          <input
                            type="number"
                            value={linea.monto}
                            onChange={(e) => changeLinea(i, "monto", e.target.value)}
                            min="0"
                            placeholder="0"
                            className={inputClass + " text-right"}
                          />
                          <p className="text-[#94a3b8] text-[11px] mt-[4px]">
                            Sale de la caja "Cheques"
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {errors.lineas && (
                <p className="text-[#ef4444] text-[12px] mt-[6px]">{errors.lineas}</p>
              )}

              <div
                className="flex items-center justify-end gap-[16px] mt-[12px] p-[12px] rounded-[8px] bg-[#f0f9ff]"
                style={{ border: "1px solid #bae6fd" }}
              >
                <span className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">
                  Total del pago
                </span>
                <div className="flex items-center gap-[12px]">
                  {Object.keys(totalesPorMoneda).length === 0 && (
                    <span className="font-['Geist:Bold',sans-serif] font-bold text-[#94a3b8] text-[16px]">
                      —
                    </span>
                  )}
                  {Object.entries(totalesPorMoneda).map(([moneda, monto]) => (
                    <span
                      key={moneda}
                      className="font-['Geist:Bold',sans-serif] font-bold text-[#0ea5e9] text-[16px]"
                    >
                      {formatMonto(monto, moneda)}
                    </span>
                  ))}
                  {Object.keys(totalesPorMoneda).length > 1 && (
                    <span className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">
                      totales por moneda (no se convierten)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Compras a pagar */}
            <div>
              <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[8px] block">
                Compras a pagar (opcional)
              </label>
              {comprasPendientes.length === 0 ? (
                <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px]">
                  Este proveedor no tiene compras registradas.
                </p>
              ) : (
                <div className="flex flex-col gap-[8px]">
                  {comprasPendientes.map((compra) => {
                    const sel = comprasSel.find((s) => s.compraId === compra.id);
                    const detalle =
                      parseItems(compra.items)[0]?.detalle ?? compra.descripcion ?? "Compra";
                    return (
                      <div
                        key={compra.id}
                        className="flex items-center gap-[12px] p-[10px] rounded-[8px] bg-white"
                        style={{ border: "1px solid #e2e8f0" }}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(sel)}
                          onChange={() => toggleCompra(compra)}
                          className="size-[16px] accent-[#0ea5e9] cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[13px] truncate">
                            {detalle}
                          </p>
                          <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">
                            {compra.fecha} · {compra.estado} · Total:{" "}
                            {formatMonto(compra.total, compra.moneda)}
                          </p>
                        </div>
                        {sel && (
                          <div className="w-[140px]">
                            <span className="font-['Geist:Medium',sans-serif] font-medium text-[#94a3b8] text-[11px]">
                              A pagar ({compra.moneda})
                            </span>
                            <input
                              type="number"
                              value={sel.monto}
                              onChange={(e) => changeCompraMonto(compra.id, e.target.value)}
                              min="0"
                              max={compra.total}
                              className={inputClass + " text-right"}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {errors.compras && <p className="text-[#ef4444] text-[12px]">{errors.compras}</p>}
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>Observaciones</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
                placeholder="Notas (opcional)"
                className={inputClass + " resize-none"}
              />
            </div>

            <div
              className="p-[12px] rounded-[8px] bg-[#f0fdf4]"
              style={{ border: "1px solid #bbf7d0" }}
            >
              <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px] leading-[1.5]">
                Al confirmar se generarán movimientos de{" "}
                <strong className="text-[#10b981]">egreso en caja</strong> por cada tramo (categoría
                "Pago proveedor") y los cheques indicados pasarán a Pagado / Entregado.
              </p>
            </div>
          </div>
        )}

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
            disabled={saving || cargando}
            className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px] disabled:opacity-60"
          >
            {saving ? "Creando..." : "Crear Orden de Pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
