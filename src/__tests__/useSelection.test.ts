import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSelection } from "../hooks/useSelection";

describe("useSelection", () => {
  it("starts with empty selection", () => {
    const { result } = renderHook(() => useSelection());
    expect(result.current.selected.size).toBe(0);
    expect(result.current.count).toBe(0);
  });

  it("toggles a photo in and out", () => {
    const { result } = renderHook(() => useSelection());

    act(() => result.current.toggle("/path/a.jpg"));
    expect(result.current.isSelected("/path/a.jpg")).toBe(true);
    expect(result.current.count).toBe(1);

    act(() => result.current.toggle("/path/a.jpg"));
    expect(result.current.isSelected("/path/a.jpg")).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it("selects all and deselects all", () => {
    const paths = ["/a.jpg", "/b.jpg", "/c.jpg"];
    const { result } = renderHook(() => useSelection());

    act(() => result.current.selectAll(paths));
    expect(result.current.count).toBe(3);

    act(() => result.current.deselectAll());
    expect(result.current.count).toBe(0);
  });
});
