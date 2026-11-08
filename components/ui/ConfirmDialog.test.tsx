import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ConfirmDialog from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("asocia la descripción con aria-describedby", () => {
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={() => {}}
        title="Eliminar producto"
        description="Esta acción no se puede deshacer."
      />
    );

    const dialog = screen.getByRole("dialog");
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();

    const description = document.getElementById(describedBy as string);
    expect(description?.textContent).toContain("no se puede deshacer");
  });
});
