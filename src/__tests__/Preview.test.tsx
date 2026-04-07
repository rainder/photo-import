import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Preview } from "../components/Preview";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}));

describe("Preview", () => {
  const mockPhotos = [
    { name: "IMG_0001.JPG", path: "/a/IMG_0001.JPG", size: 5242880, date: "2026-03-28T10:00:00Z", media_type: "photo" as const },
    { name: "IMG_0002.JPG", path: "/a/IMG_0002.JPG", size: 6291456, date: "2026-03-28T10:05:00Z", media_type: "photo" as const },
  ];

  const defaultProps = {
    photos: mockPhotos,
    currentIndex: 0,
    currentPhoto: mockPhotos[0],
    isSelected: false,
    onClose: () => {},
    onNavigate: () => {},
    onToggleSelect: () => {},
    onDelete: () => {},
    deleteConfirm: false,
    onDeleteConfirm: () => {},
    onDeleteCancel: () => {},
    burstViewIndex: 0,
    onBurstNavigate: () => {},
    burstFocused: false,
    onBurstEnter: () => {},
    onBurstExit: () => {},
  };

  it("shows filename and position", () => {
    render(<Preview {...defaultProps} />);
    expect(screen.getAllByText("IMG_0001.JPG").length).toBeGreaterThan(0);
    expect(screen.getByText(/1 of 2/)).toBeTruthy();
  });

  it("calls onClose when Esc is pressed", () => {
    const onClose = vi.fn();
    render(<Preview {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onNavigate with +1 on ArrowRight", () => {
    const onNavigate = vi.fn();
    render(<Preview {...defaultProps} onNavigate={onNavigate} />);
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it("calls onToggleSelect on Space", () => {
    const onToggle = vi.fn();
    render(<Preview {...defaultProps} onToggleSelect={onToggle} />);
    fireEvent.keyDown(document, { key: " " });
    expect(onToggle).toHaveBeenCalled();
  });

  it("calls onBurstEnter on ArrowDown", () => {
    const onBurstEnter = vi.fn();
    render(<Preview {...defaultProps} onBurstEnter={onBurstEnter} />);
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(onBurstEnter).toHaveBeenCalled();
  });

  it("calls onBurstExit on ArrowUp", () => {
    const onBurstExit = vi.fn();
    render(<Preview {...defaultProps} onBurstExit={onBurstExit} />);
    fireEvent.keyDown(document, { key: "ArrowUp" });
    expect(onBurstExit).toHaveBeenCalled();
  });

  it("does not highlight filmstrip thumb when burstFocused is false", () => {
    const burstMembers = [
      { name: "IMG_0001.JPG", path: "/a/IMG_0001.JPG", size: 100, date: "2026-03-28T10:00:00Z", media_type: "photo" as const },
      { name: "IMG_0002.JPG", path: "/a/IMG_0002.JPG", size: 100, date: "2026-03-28T10:00:01Z", media_type: "photo" as const },
    ];
    const { container } = render(
      <Preview {...defaultProps} burstMembers={burstMembers} burstFocused={false} burstViewIndex={0} />
    );
    const activeButtons = container.querySelectorAll(".burst-filmstrip-thumb.active");
    expect(activeButtons.length).toBe(0);
  });

  it("highlights filmstrip thumb when burstFocused is true", () => {
    const burstMembers = [
      { name: "IMG_0001.JPG", path: "/a/IMG_0001.JPG", size: 100, date: "2026-03-28T10:00:00Z", media_type: "photo" as const },
      { name: "IMG_0002.JPG", path: "/a/IMG_0002.JPG", size: 100, date: "2026-03-28T10:00:01Z", media_type: "photo" as const },
    ];
    const { container } = render(
      <Preview {...defaultProps} burstMembers={burstMembers} burstFocused={true} burstViewIndex={0} />
    );
    const activeButtons = container.querySelectorAll(".burst-filmstrip-thumb.active");
    expect(activeButtons.length).toBe(1);
  });
});
