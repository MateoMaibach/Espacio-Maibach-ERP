import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Configuracion from "./Configuracion";

import {
  createCategoria,
  deleteCategoria,
  getCategorias,
  updateCategoria,
  type Categoria,
} from "@/services/api";

vi.mock("@/layouts/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/services/api", () => ({
  getCategorias: vi.fn(),
  createCategoria: vi.fn(),
  updateCategoria: vi.fn(),
  deleteCategoria: vi.fn(),
}));

const CATEGORIAS: Categoria[] = [
  {
    id: "cat_ing",
    nombre: "Cobro cliente",
    tipo: "ingreso",
    activa: 1,
    color: "#10b981",
    orden: 0,
    createdAt: new Date(),
  },
  {
    id: "cat_egr",
    nombre: "Combustible",
    tipo: "egreso",
    activa: 1,
    color: "#f97316",
    orden: 1,
    createdAt: new Date(),
  },
  {
    id: "cat_off",
    nombre: "Vieja",
    tipo: "egreso",
    activa: 0,
    color: "#64748b",
    orden: 2,
    createdAt: new Date(),
  },
  {
    id: "cat_sys",
    nombre: "Pago proveedor",
    tipo: "egreso",
    activa: 1,
    color: "#ef4444",
    orden: 3,
    createdAt: new Date(),
  },
];

describe("Configuracion", () => {
  beforeEach(() => {
    (getCategorias as Mock).mockResolvedValue(CATEGORIAS);
    (updateCategoria as Mock).mockResolvedValue({ ok: true });
    (deleteCategoria as Mock).mockResolvedValue({ ok: true });
    (createCategoria as Mock).mockResolvedValue({ ok: true, id: "cat_new" });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("pide las categorias incluyendo las inactivas", async () => {
    render(<Configuracion />);

    expect(await screen.findByText("Vieja")).toBeTruthy();
    expect(getCategorias).toHaveBeenCalledWith({ incluirInactivas: true });
  });

  it("reactiva una categoria desactivada", async () => {
    render(<Configuracion />);

    fireEvent.click(await screen.findByText("Activar"));

    expect(updateCategoria).toHaveBeenCalledWith("cat_off", { activa: 1 });
  });

  it("renombra una categoria existente", async () => {
    render(<Configuracion />);

    fireEvent.click((await screen.findAllByText("Renombrar"))[0]!);

    const input = screen.getByDisplayValue("Cobro cliente");

    fireEvent.change(input, { target: { value: "Cobro" } });

    fireEvent.keyDown(input, { key: "Enter" });

    expect(updateCategoria).toHaveBeenCalledWith("cat_ing", { nombre: "Cobro" });
  });

  it("no ofrece renombrar ni borrar las categorias del sistema", async () => {
    render(<Configuracion />);

    await screen.findByText("Pago proveedor");

    expect(screen.getByText("sistema")).toBeTruthy();

    expect(screen.getAllByText("Renombrar")).toHaveLength(3);

    expect(screen.getAllByTitle("Eliminar")).toHaveLength(3);
  });

  it("muestra el motivo cuando no se puede borrar", async () => {
    (deleteCategoria as Mock).mockRejectedValue(
      new Error("No se puede eliminar: hay 2 movimiento(s) con esta categoría."),
    );

    render(<Configuracion />);

    fireEvent.click((await screen.findAllByTitle("Eliminar"))[0]!);

    fireEvent.click(screen.getByText("Sí"));

    expect(
      await screen.findByText(/hay 2 movimiento\(s\)/),
    ).toBeTruthy();
  });
});
