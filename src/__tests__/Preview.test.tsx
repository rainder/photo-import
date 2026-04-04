import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Preview } from "../components/Preview";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}));

describe("Preview", () => {
  const mockPhotos = [
    { name: "IMG_0001.JPG", path: "/a/IMG_0001.JPG", size: 5242880, date: "2026-03-28T10:00:00Z" },
    { name: "IMG_0002.JPG", path: "/a/IMG_0002.JPG", size: 6291456, date: "2026-03-28T10:05:00Z" },
  ];

  it("shows filename and position", () => {
    render(
      <Preview
        photos={mockPhotos}
        currentIndex={0}
        isSelected={false}
        onClose={() => {}}
        onNavigate={() => {}}
        onToggleSelect={() => {}}
      />
    );
    expect(screen.getByText("IMG_0001.JPG")).toBeTruthy();
    expect(screen.getByText(/1 of 2/)).toBeTruthy();
  });

  it("calls onClose when Esc is pressed", () => {
    const onClose = vi.fn();
    render(
      <Preview
        photos={mockPhotos}
        currentIndex={0}
        isSelected={false}
        onClose={onClose}
        onNavigate={() => {}}
        onToggleSelect={() => {}}
      />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onNavigate with +1 on ArrowRight", () => {
    const onNavigate = vi.fn();
    render(
      <Preview
        photos={mockPhotos}
        currentIndex={0}
        isSelected={false}
        onClose={() => {}}
        onNavigate={onNavigate}
        onToggleSelect={() => {}}
      />
    );
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it("calls onToggleSelect on Space", () => {
    const onToggle = vi.fn();
    render(
      <Preview
        photos={mockPhotos}
        currentIndex={0}
        isSelected={false}
        onClose={() => {}}
        onNavigate={() => {}}
        onToggleSelect={onToggle}
      />
    );
    fireEvent.keyDown(document, { key: " " });
    expect(onToggle).toHaveBeenCalled();
  });
});
