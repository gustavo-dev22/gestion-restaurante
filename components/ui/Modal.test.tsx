import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Modal from "./Modal";

describe("Modal", () => {
  it("renderiza un diálogo accesible y cierra con Escape", () => {
    const onClose = vi.fn();

    render(
      <Modal open onClose={onClose} title="Confirmar acción" description="Descripción">
        <p>Contenido del modal</p>
      </Modal>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("Confirmar acción")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("no renderiza nada cuando está cerrado", () => {
    render(<Modal open={false} onClose={() => {}} title="Oculto" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
