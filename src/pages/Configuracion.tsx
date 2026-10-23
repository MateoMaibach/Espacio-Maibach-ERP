import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import ErrorBanner from "@/components/ErrorBanner";

import { IconChevronRight, IconPlus } from "@/components/Icons";
import AppLayout from "@/layouts/AppLayout";
import {
  createCategoria,
  deleteCategoria,
  getCategorias,
  updateCategoria,
  type Categoria,
} from "@/services/api";

/**
 * Las escribe la app por nombre literal (pago de proveedor, ajuste de cierre).
 * Renombrarlas o borrarlas dejaria esas escrituras huerfanas; el backend las
 * rechaza con 409. Aca se ocultan las acciones para no ofrecer algo que falla.
 */
const CATEGORIAS_SISTEMA = new Set(["Pago proveedor", "Ajuste por cierre"]);

const PENDIENTES: { titulo: string; detalle: string }[] = [
  {
    titulo: "Datos del negocio",
    detalle: "Nombre, CUIT, logo y datos de facturación.",
  },
  {
    titulo: "Series y numeración",
    detalle:
      "Remitos y órdenes de pago calculan su número con MAX(numero) + 1, sin bloqueo: pueden repetirse.",
  },
  {
    titulo: "Usuarios y permisos",
    detalle: "Hoy la base es de un solo usuario, sin autenticación.",
  },
];

export default function Configuracion() {
  const navigate = useNavigate();

  const [abierto, setAbierto] = useState<string | null>(PENDIENTES[0]?.titulo ?? null);

  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [cargando, setCargando] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [nueva, setNueva] = useState({
    nombre: "",
    tipo: "egreso" as "ingreso" | "egreso",
  });

  const [editando, setEditando] = useState<{ id: string; nombre: string } | null>(null);

  const [confirmarBorrado, setConfirmarBorrado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);

    try {
      setCategorias(await getCategorias({ incluirInactivas: true }));

      setError(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron cargar las categorías",
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const porTipo = useMemo(
    () => ({
      ingreso: categorias.filter((c) => c.tipo === "ingreso"),
      egreso: categorias.filter((c) => c.tipo === "egreso"),
    }),
    [categorias],
  );

  async function crear() {
    if (!nueva.nombre.trim()) return;

    try {
      await createCategoria(nueva);

      setNueva({ nombre: "", tipo: nueva.tipo });

      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la categoría");
    }
  }

  async function guardarNombre(c: Categoria) {
    if (!editando || editando.id !== c.id) return;

    const nombre = editando.nombre.trim();

    if (!nombre || nombre === c.nombre) {
      setEditando(null);

      return;
    }

    try {
      await updateCategoria(c.id, { nombre });

      setEditando(null);

      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo renombrar");
    }
  }

  async function alternar(c: Categoria) {
    try {
      await updateCategoria(c.id, { activa: c.activa === 1 ? 0 : 1 });

      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar");
    }
  }

  async function borrar(c: Categoria) {
    try {
      await deleteCategoria(c.id);

      setConfirmarBorrado(null);

      await cargar();
    } catch (e) {
      setConfirmarBorrado(null);

      setError(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Inicio", onClick: () => navigate("/") },
        { label: "Configuración" },
      ]}
    >
      <div className="p-6">
        <h1 className="text-[20px] font-semibold text-[#0f172a]">Configuración</h1>

        <p className="mt-1 text-[13px] text-[#64748b]">
          Ajustes generales del sistema.
        </p>

        <section
          className="mt-6 rounded-xl border border-[#e2e8f0] bg-white p-5"
          aria-labelledby="titulo-categorias"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="titulo-categorias"
                className="text-[16px] font-bold text-[#0f172a]"
              >
                Categorías de caja
              </h2>

              <p className="mt-0.5 text-[12px] text-[#94a3b8]">
                Rubros para clasificar ingresos y egresos. Se usan en el análisis
                de gastos de Finanzas. Renombrar una categoría actualiza los
                movimientos que ya la usaban.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-3">
              <ErrorBanner mensaje={error} onCerrar={() => setError(null)} />
            </div>
          )}

          <div className="mt-4 flex gap-2.5">
            <input
              value={nueva.nombre}
              onChange={(e) => setNueva((p) => ({ ...p, nombre: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") crear();
              }}
              placeholder="Nombre de la categoría"
              className="flex-1 rounded-lg border border-[#e2e8f0] px-3 py-2 text-[14px] text-[#0f172a] outline-none focus:border-[#0ea5e9]"
            />

            <select
              value={nueva.tipo}
              onChange={(e) =>
                setNueva((p) => ({
                  ...p,
                  tipo: e.target.value as "ingreso" | "egreso",
                }))
              }
              className="cursor-pointer rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-[14px] text-[#0f172a] outline-none"
            >
              <option value="egreso">Egreso</option>
              <option value="ingreso">Ingreso</option>
            </select>

            <button
              onClick={crear}
              disabled={!nueva.nombre.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-[#0ea5e9] px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#0284c7] disabled:opacity-40"
            >
              <IconPlus /> Agregar
            </button>
          </div>

          {cargando ? (
            <p className="mt-4 text-[13px] text-[#94a3b8]">Cargando…</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {(["ingreso", "egreso"] as const).map((tipo) => (
                <div key={tipo} className="flex flex-col gap-1.5">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-[#475569]">
                    {tipo === "ingreso" ? "Ingresos" : "Egresos"}
                  </p>

                  {porTipo[tipo].length === 0 && (
                    <p className="text-[12px] text-[#94a3b8]">Sin categorías.</p>
                  )}

                  {porTipo[tipo].map((c) => {
                    const esSistema = CATEGORIAS_SISTEMA.has(c.nombre);

                    const estaEditando = editando?.id === c.id;

                    const estaConfirmando = confirmarBorrado === c.id;

                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2"
                        style={{
                          border: "1px solid #f1f5f9",
                          background: c.activa === 1 ? "#f8fafc" : "#fef2f2",
                        }}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ background: c.color }}
                          />

                          {estaEditando ? (
                            <input
                              autoFocus
                              value={editando.nombre}
                              onChange={(e) =>
                                setEditando({ id: c.id, nombre: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") guardarNombre(c);

                                if (e.key === "Escape") setEditando(null);
                              }}
                              className="min-w-0 flex-1 rounded-md border border-[#0ea5e9] px-2 py-1 text-[13px] text-[#0f172a] outline-none"
                            />
                          ) : (
                            <span
                              className="truncate text-[13px]"
                              style={{
                                color: c.activa === 1 ? "#0f172a" : "#94a3b8",
                                textDecoration:
                                  c.activa === 1 ? "none" : "line-through",
                              }}
                              title={esSistema ? "La usa la app automáticamente" : c.nombre}
                            >
                              {c.nombre}
                            </span>
                          )}

                          {esSistema && (
                            <span className="shrink-0 rounded bg-[#e0f2fe] px-1.5 py-0.5 text-[10px] font-medium text-[#0369a1]">
                              sistema
                            </span>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {estaEditando ? (
                            <>
                              <button
                                onClick={() => guardarNombre(c)}
                                className="rounded px-2 py-1 text-[11px] font-medium text-[#0369a1] hover:bg-[#e0f2fe]"
                              >
                                Guardar
                              </button>

                              <button
                                onClick={() => setEditando(null)}
                                className="rounded px-2 py-1 text-[11px] font-medium text-[#475569] hover:bg-[#e2e8f0]"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : estaConfirmando ? (
                            <>
                              <span className="text-[11px] text-[#b91c1c]">¿Eliminar?</span>

                              <button
                                onClick={() => borrar(c)}
                                className="rounded px-2 py-1 text-[11px] font-medium text-[#b91c1c] hover:bg-[#fee2e2]"
                              >
                                Sí
                              </button>

                              <button
                                onClick={() => setConfirmarBorrado(null)}
                                className="rounded px-2 py-1 text-[11px] font-medium text-[#475569] hover:bg-[#e2e8f0]"
                              >
                                No
                              </button>
                            </>
                          ) : (
                            <>
                              {!esSistema && (
                                <button
                                  onClick={() =>
                                    setEditando({ id: c.id, nombre: c.nombre })
                                  }
                                  className="rounded px-2 py-1 text-[11px] font-medium text-[#475569] hover:bg-[#e2e8f0]"
                                >
                                  Renombrar
                                </button>
                              )}

                              <button
                                onClick={() => alternar(c)}
                                className="rounded px-2 py-1 text-[11px] font-medium text-[#475569] hover:bg-[#e2e8f0]"
                              >
                                {c.activa === 1 ? "Desactivar" : "Activar"}
                              </button>

                              {!esSistema && (
                                <button
                                  onClick={() => setConfirmarBorrado(c.id)}
                                  className="rounded p-1 hover:bg-[#fee2e2]"
                                  title="Eliminar"
                                >
                                  <svg
                                    fill="none"
                                    height="14"
                                    viewBox="0 0 14 14"
                                    width="14"
                                  >
                                    <path
                                      d="M2 4H12M5 4V2H9V4M6 6.5V10.5M8 6.5V10.5M3 4L4 12H10L11 4"
                                      stroke="#ef4444"
                                      strokeWidth="1.2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6">
          <h2 className="text-[14px] font-semibold text-[#0f172a]">
            Pendientes de esta sección
          </h2>

          <div className="mt-2 space-y-2">
            {PENDIENTES.map((item) => {
              const estaAbierto = abierto === item.titulo;

              return (
                <div
                  key={item.titulo}
                  className="rounded-xl border border-[#e2e8f0] bg-white"
                >
                  <button
                    type="button"
                    onClick={() => setAbierto(estaAbierto ? null : item.titulo)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`inline-block text-[#94a3b8] transition-transform ${
                          estaAbierto ? "rotate-90" : ""
                        }`}
                      >
                        <IconChevronRight />
                      </span>

                      <span className="text-[14px] font-medium text-[#0f172a]">
                        {item.titulo}
                      </span>
                    </span>
                  </button>

                  {estaAbierto && (
                    <p className="border-t border-[#f1f5f9] px-4 py-3 text-[13px] text-[#64748b]">
                      {item.detalle}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
