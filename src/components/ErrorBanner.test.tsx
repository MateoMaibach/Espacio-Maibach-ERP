import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ErrorBanner from "./ErrorBanner";

describe("ErrorBanner", () => {
  afterEach(cleanup);

  it("muestra el mensaje", () => {
    render(<ErrorBanner mensaje="No se pudo guardar" />);

    expect(screen.getByRole("alert").textContent).toContain("No se pudo guardar");
  });

  it("dispara reintentar y cerrar", () => {
    const onReintentar = vi.fn();

    const onCerrar = vi.fn();

    render(
      <ErrorBanner
        mensaje="Error"
        onReintentar={onReintentar}
        onCerrar={onCerrar}
      />,
    );

    fireEvent.click(screen.getByText("Reintentar"));

    fireEvent.click(screen.getByText("Cerrar"));

    expect(onReintentar).toHaveBeenCalledOnce();

    expect(onCerrar).toHaveBeenCalledOnce();
  });

  it("no muestra acciones que no recibe", () => {
    render(<ErrorBanner mensaje="Error" />);

    expect(screen.queryByText("Reintentar")).toBeNull();

    expect(screen.queryByText("Cerrar")).toBeNull();
  });
});
