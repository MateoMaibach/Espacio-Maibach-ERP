import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Clientes from "./Clientes";

import {
  createCliente,
  deleteCliente,
  getClientes,
  updateCliente,
} from "@/services/api";

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock("@/layouts/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/services/api", () => ({
  getClientes: vi.fn(),
  createCliente: vi.fn(),
  updateCliente: vi.fn(),
  deleteCliente: vi.fn(),
}));

const CLIENTE = {
  id: "cli_1",
  nombre: "García, Roberto",
  localidad: "Paraná",
  telefono: "343-4552912",
  dni: "30.412.552",
  email: "",
  direccion: "",
  estado: "Activo",
  fechaAlta: "1 Oct, 2026",
};

describe("Clientes", () => {
  beforeEach(() => {
    (getClientes as Mock).mockResolvedValue([CLIENTE]);
    (createCliente as Mock).mockResolvedValue({ ok: true });
    (updateCliente as Mock).mockResolvedValue({ ok: true });
    (deleteCliente as Mock).mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("muestra que esta cargando", () => {
    (getClientes as Mock).mockReturnValue(new Promise(() => {}));

    render(<Clientes />);

    expect(screen.getByText("Cargando clientes…")).toBeTruthy();
  });

  it("muestra el error de carga y permite reintentar", async () => {
    (getClientes as Mock)
      .mockRejectedValueOnce(new Error("No se pudo conectar con el servidor"))
      .mockResolvedValueOnce([CLIENTE]);

    render(<Clientes />);

    expect(
      await screen.findByText("No se pudo conectar con el servidor"),
    ).toBeTruthy();

    fireEvent.click(screen.getByText("Reintentar"));

    expect(await screen.findByText("García, Roberto")).toBeTruthy();

    expect(getClientes).toHaveBeenCalledTimes(2);
  });

  it("muestra el error al crear sin cerrar el modal", async () => {
    (createCliente as Mock).mockRejectedValue(
      new Error("Ya existe un cliente con ese ID"),
    );

    render(<Clientes />);

    fireEvent.click(screen.getByText("Nuevo Cliente"));

    fireEvent.change(screen.getByPlaceholderText("Ej: García, Roberto"), {
      target: { value: "Nuevo Cliente" },
    });

    fireEvent.change(screen.getByPlaceholderText("Ej: 30.412.552"), {
      target: { value: "20.111.222" },
    });

    fireEvent.change(screen.getByPlaceholderText("Ej: 343-4552912"), {
      target: { value: "343-0000000" },
    });

    fireEvent.click(screen.getByText("Crear Cliente"));

    expect(
      await screen.findByText("Ya existe un cliente con ese ID"),
    ).toBeTruthy();

    expect(screen.getByDisplayValue("Nuevo Cliente")).toBeTruthy();

    expect(screen.getByText("Crear Cliente")).toBeTruthy();
  });

  it("explica el bloqueo al borrar y permite forzarlo", async () => {
    (deleteCliente as Mock)
      .mockRejectedValueOnce(
        new Error(
          "No se puede eliminar: el cliente tiene 2 cuota(s) cobradas. Si realmente querés hacerlo, repetí con ?forzar=1.",
        ),
      )
      .mockResolvedValueOnce({ ok: true });

    render(<Clientes />);

    fireEvent.click((await screen.findAllByTitle("Eliminar"))[0]!);

    fireEvent.click(screen.getByText("Eliminar"));

    expect(await screen.findByText(/2 cuota\(s\) cobradas/)).toBeTruthy();

    fireEvent.click(screen.getByText("Eliminar igual (borra el historial)"));

    expect(deleteCliente).toHaveBeenLastCalledWith("cli_1", true);
  });
});
