# Burst Navigation Two-Level Drill-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current always-focused burst filmstrip with a two-level enter/exit navigation model where Left/Right skip entire bursts by default, and Down/Up enters/exits filmstrip navigation.

**Architecture:** Add a `burstFocused` boolean state alongside existing `burstViewIndex`. Rewrite `handlePreviewNavigate` in App.tsx to branch on `burstFocused`. Pass `burstFocused` to Preview so it gates the `.active` CSS class and handles Down/Up keys.

**Tech Stack:** React, TypeScript, Vitest

---

### Task 1: Add `burstFocused` state to App.tsx

**Files:**
- Modify: `src/App.tsx:68` (state declarations)
- Modify: `src/App.tsx:664-695` (`handlePreviewNavigate`)
- Modify: `src/App.tsx:941-973` (Preview JSX props)

- [ ] **Step 1: Add `burstFocused` state**

At `src/App.tsx:68`, after `burstViewIndex` state, add:

```tsx
const [burstFocused, setBurstFocused] = useState(false);
```

- [ ] **Step 2: Rewrite `handlePreviewNavigate`**

Replace `src/App.tsx:664-695` with:

```tsx
  const handlePreviewNavigate = useCallback(
    (delta: number) => {
      if (previewIndex === null) return;

      if (groupBursts && burstFocused) {
        const members = burstLookup.displayToBurstMembers.get(previewIndex);
        if (members && members.length > 1) {
          const newIdx = burstViewIndex + delta;
          if (newIdx >= 0 && newIdx < members.length) {
            setBurstViewIndex(newIdx);
            return;
          }
          // At edge of burst — exit burst and move to adjacent display photo
          setBurstFocused(false);
        }
      }

      // Move to next/prev display photo
      setPreviewDirection(delta > 0 ? 1 : -1);
      setBurstViewIndex(0);
      setBurstFocused(false);
      setPreviewIndex((prev) => {
        if (prev === null) return null;
        const next = prev + delta;
        let resolved: number;
        if (next < 0) resolved = 0;
        else if (next >= displayPhotos.length) resolved = displayPhotos.length - 1;
        else resolved = next;
        setFocusedIndex(resolved);
        return resolved;
      });
    },
    [displayPhotos.length, previewIndex, groupBursts, burstFocused, burstViewIndex, burstLookup]
  );
```

- [ ] **Step 3: Add `handleBurstEnter` and `handleBurstExit` callbacks**

After `handlePreviewNavigate`, add:

```tsx
  const handleBurstEnter = useCallback(() => {
    if (previewIndex === null || !groupBursts) return;
    const members = burstLookup.displayToBurstMembers.get(previewIndex);
    if (members && members.length > 1) {
      setBurstFocused(true);
    }
  }, [previewIndex, groupBursts, burstLookup]);

  const handleBurstExit = useCallback(() => {
    setBurstFocused(false);
  }, []);
```

- [ ] **Step 4: Update `onBurstNavigate` click handler**

In the Preview JSX at `src/App.tsx:969`, change the `onBurstNavigate` prop from `setBurstViewIndex` to a handler that also sets `burstFocused`:

```tsx
            onBurstNavigate={(index: number) => {
              setBurstViewIndex(index);
              setBurstFocused(true);
            }}
```

- [ ] **Step 5: Pass new props to Preview**

In the Preview JSX block (around line 967-969), add the new props:

```tsx
            burstFocused={burstFocused}
            onBurstEnter={handleBurstEnter}
            onBurstExit={handleBurstExit}
```

- [ ] **Step 6: Verify build**

Run: `cd /Users/andy/Developer/photo-import && npx vite build 2>&1 | tail -20`
Expected: Build will fail because Preview doesn't accept new props yet. That's fine — proceed to Task 2.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add burstFocused state and two-level navigation logic"
```

---

### Task 2: Update Preview component for two-level navigation

**Files:**
- Modify: `src/components/Preview.tsx:7-25` (props interface)
- Modify: `src/components/Preview.tsx:189-233` (key handler)
- Modify: `src/components/Preview.tsx:330-347` (filmstrip JSX)
- Modify: `src/components/Preview.tsx:357` (shortcut hints)

- [ ] **Step 1: Add new props to interface**

In `src/components/Preview.tsx`, update the `PreviewProps` interface. Add after `onBurstNavigate`:

```tsx
  burstFocused: boolean;
  onBurstEnter: () => void;
  onBurstExit: () => void;
```

- [ ] **Step 2: Destructure new props**

In the function signature (around line 75), add `burstFocused`, `onBurstEnter`, `onBurstExit` to the destructured props.

- [ ] **Step 3: Update key handler for Down/Up**

Replace the key handler's switch block (inside `handleKeyDown`, around lines 208-228) with:

```tsx
      switch (e.key) {
        case "Enter":
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "ArrowLeft":
          onNavigate(-1);
          break;
        case "ArrowRight":
          onNavigate(1);
          break;
        case "ArrowDown":
          e.preventDefault();
          onBurstEnter();
          break;
        case "ArrowUp":
          e.preventDefault();
          onBurstExit();
          break;
        case " ":
          e.preventDefault();
          onToggleSelect();
          break;
        case "Backspace":
          e.preventDefault();
          onDelete(e.metaKey);
          break;
      }
```

Add `onBurstEnter` and `onBurstExit` to the useEffect dependency array (line 233):

```tsx
  }, [onClose, onNavigate, onToggleSelect, onDelete, deleteConfirm, onDeleteConfirm, onDeleteCancel, onBurstEnter, onBurstExit]);
```

- [ ] **Step 4: Gate `.active` class on `burstFocused`**

In the filmstrip JSX (around line 339), change:

```tsx
                  active={i === burstViewIndex}
```

to:

```tsx
                  active={burstFocused && i === burstViewIndex}
```

- [ ] **Step 5: Update shortcut hints**

At line 357, update the shortcuts span to include the new keys:

```tsx
          ← → navigate &nbsp;&nbsp; ↓↑ burst &nbsp;&nbsp; Space select &nbsp;&nbsp; ⌫ delete &nbsp;&nbsp; ⌘I info &nbsp;&nbsp; Enter close
```

- [ ] **Step 6: Verify build**

Run: `cd /Users/andy/Developer/photo-import && npx vite build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/Preview.tsx
git commit -m "feat: two-level burst filmstrip navigation with Down/Up enter/exit"
```

---

### Task 3: Update tests

**Files:**
- Modify: `src/__tests__/Preview.test.tsx`

- [ ] **Step 1: Update `defaultProps` with new props**

In `src/__tests__/Preview.test.tsx`, add to `defaultProps` (after line 29):

```tsx
    burstFocused: false,
    onBurstEnter: () => {},
    onBurstExit: () => {},
```

- [ ] **Step 2: Add test for Down key calling `onBurstEnter`**

Add after the existing tests:

```tsx
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
```

- [ ] **Step 3: Add test for filmstrip active gating**

```tsx
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
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/andy/Developer/photo-import && npx vitest run 2>&1 | tail -30`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/Preview.test.tsx
git commit -m "test: add tests for two-level burst navigation"
```

---

### Task 4: Update ImportReview if it passes Preview-like props

**Files:**
- Check: `src/components/ImportReview.tsx` (may need new props if it renders Preview)

- [ ] **Step 1: Check ImportReview for Preview usage**

Read `src/components/ImportReview.tsx` and check if it renders `<Preview>`. If it does, add the three new props (`burstFocused={false}`, `onBurstEnter={() => {}}`, `onBurstExit={() => {}}`). If it doesn't render Preview, skip this task.

- [ ] **Step 2: Final build + test verification**

Run: `cd /Users/andy/Developer/photo-import && npx vite build 2>&1 | tail -20`
Run: `cd /Users/andy/Developer/photo-import && npx vitest run 2>&1 | tail -30`
Expected: Both pass.

- [ ] **Step 3: Commit if changes were made**

```bash
git add -A && git commit -m "fix: add burst navigation props to ImportReview"
```
