import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Grid } from "../components/Grid";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(""),
}));

describe("Grid", () => {
  it("renders empty state when no photos", () => {
    render(
      <Grid
        photos={[]}
        isSelected={() => false}
        focusedIndex={-1}
        onSelect={() => {}}
        onFocus={() => {}}
        onPreview={() => {}}
        columnCount={5}
      />
    );
    expect(screen.getByText(/no photos/i)).toBeTruthy();
  });
});
