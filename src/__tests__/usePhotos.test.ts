import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePhotos } from "../hooks/usePhotos";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

describe("usePhotos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads photos when volumePath is provided", async () => {
    const mockPhotos = [
      { name: "IMG_0001.JPG", path: "/Volumes/SD/DCIM/IMG_0001.JPG", size: 5000000, date: "2026-03-28T10:00:00Z" },
      { name: "IMG_0002.JPG", path: "/Volumes/SD/DCIM/IMG_0002.JPG", size: 6000000, date: "2026-03-28T10:05:00Z" },
    ];
    mockInvoke.mockResolvedValueOnce(mockPhotos);

    const { result } = renderHook(() => usePhotos("/Volumes/SD"));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.photos).toEqual(mockPhotos);
    expect(result.current.photos.length).toBe(2);
  });

  it("returns empty array when no volumePath", () => {
    const { result } = renderHook(() => usePhotos(null));
    expect(result.current.photos).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
