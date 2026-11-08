import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable, DataTablePagination } from "./DataTable";

describe("DataTable", () => {
  it("renderiza el contenido de la tabla", () => {
    render(
      <DataTable>
        <thead>
          <tr>
            <th>Producto</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Lomo saltado</td>
          </tr>
        </tbody>
      </DataTable>
    );

    expect(screen.getByText("Lomo saltado")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
  });
});

describe("DataTablePagination", () => {
  it("deshabilita prev en la primera página y dispara next", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    render(
      <DataTablePagination
        page={1}
        totalPages={2}
        onPrev={onPrev}
        onNext={onNext}
        info="1 de 2"
      />
    );

    const prev = screen.getByLabelText("Página anterior") as HTMLButtonElement;
    expect(prev.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText("Página siguiente"));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
