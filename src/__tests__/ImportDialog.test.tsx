import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ImportDialog } from "../components/ImportDialog";

describe("ImportDialog", () => {
  it("shows progress during import", () => {
    render(
      <ImportDialog
        stage="importing"
        photoCount={10}
        onConfirm={() => {}}
        onCancel={() => {}}
        progress={{ current: 3, total: 10, currentFile: "IMG_0003.JPG" }}
      />
    );
    expect(screen.getByText(/IMG_0003.JPG/)).toBeTruthy();
    expect(screen.getByText(/3 of 10/)).toBeTruthy();
  });

  it("shows delete confirmation when stage is confirm-delete", () => {
    render(
      <ImportDialog
        stage="confirm-delete"
        photoCount={5}
        onConfirm={() => {}}
        onCancel={() => {}}
        progress={null}
      />
    );
    expect(screen.getByText(/Delete 5 imported photos from SD card/)).toBeTruthy();
    expect(screen.getByText(/cannot be undone/)).toBeTruthy();
  });
});
