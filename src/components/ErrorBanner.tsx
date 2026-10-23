interface ErrorBannerProps {
  mensaje: string;

  onReintentar?: () => void;

  onCerrar?: () => void;
}

/**
 * Mensaje de error de una accion o carga. Antes cada pagina inventaba su
 * propio banner (o directamente usaba `alert`/`console.error`).
 */
export default function ErrorBanner({
  mensaje,
  onReintentar,
  onCerrar,
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-[12px] rounded-[8px] bg-[#fef2f2] px-[12px] py-[10px]"
    >
      <p className="font-['Geist:Regular',sans-serif] text-[#b91c1c] text-[13px]">
        {mensaje}
      </p>

      <div className="flex shrink-0 items-center gap-[4px]">
        {onReintentar && (
          <button
            onClick={onReintentar}
            className="font-['Geist:Medium',sans-serif] font-medium text-[13px] text-[#b91c1c] px-[10px] py-[4px] rounded-[6px] hover:bg-[#fee2e2] transition-colors"
          >
            Reintentar
          </button>
        )}

        {onCerrar && (
          <button
            onClick={onCerrar}
            className="font-['Geist:Medium',sans-serif] font-medium text-[13px] text-[#b91c1c] px-[10px] py-[4px] rounded-[6px] hover:bg-[#fee2e2] transition-colors"
          >
            Cerrar
          </button>
        )}
      </div>
    </div>
  );
}
