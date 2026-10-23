import { useState } from "react";
import { IconChevronRight } from "@/components/Icons";

/**
 * Configuracion: placeholder.
 *
 * El item existía en el Sidebar sin ruta en `App.tsx`, asi que `navigate()`
 * no encontraba nada y React Router renderizaba `null`: pagina en blanco sin
 * error ni forma de volver.
 *
 * No hay contenido que mostrar todavia, pero un lugar que diga eso es mejor
 * que un link que te deja colgado.
 */
const PENDIENTES: { titulo: string; detalle: string }[] = [
  {
    titulo: "Datos del negocio",
    detalle: "Nombre, CUIT, logo y datos de facturación.",
  },
  {
    titulo: "Categorías de caja",
    detalle:
      "Hoy se siembran 20 categorías fijas al crear la base y no hay forma de editarlas desde la app.",
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
  const [abierto, setAbierto] = useState<string | null>(PENDIENTES[0]?.titulo ?? null);

  return (
    <div className="p-6">
      <h1 className="text-[20px] font-semibold text-[#0f172a]">Configuración</h1>

      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
        Esta sección todavía no está implementada. La navegación ya funciona,
        pero no hay nada que configurar por acá.
      </div>

      <div className="mt-6 space-y-2">
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
    </div>
  );
}