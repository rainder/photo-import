# Burst Navigation Redesign: Two-Level Drill-Down

**Date:** 2026-04-07

## Problem

When burst grouping is on and you preview a burst photo, the filmstrip immediately shows the first member as focused and Left/Right navigates within the burst. This is confusing — you have to exhaust all burst members before reaching the next photo. The user wants an explicit enter/exit model.

## Design

### State

Two pieces of state replace the current single `burstViewIndex`:

- `burstViewIndex: number` — which burst member is displayed (default 0 = cover)
- `burstFocused: boolean` — whether keyboard nav is "inside" the filmstrip

### Keyboard Navigation (preview mode, burst group active)

| Key | `burstFocused=false` | `burstFocused=true` |
|-----|----------------------|---------------------|
| **Left** | prev display photo | prev burst member; if at first → exit burst + prev display photo |
| **Right** | next display photo | next burst member; if at last → exit burst + next display photo |
| **Down** | enter filmstrip (`burstFocused=true`) | no-op |
| **Up** | no-op | exit filmstrip (`burstFocused=false`), preserve `burstViewIndex` |
| **Space** | select/deselect burst cover (index 0) | select/deselect focused burst member |
| **Delete** | delete displayed photo | delete displayed photo |

### Click Behavior

Clicking a filmstrip thumbnail always sets `burstFocused=true` and `burstViewIndex` to the clicked index.

### Preview Image

Always shows `burstMembers[burstViewIndex]` regardless of `burstFocused`. Opening a burst shows the cover (index 0). Pressing Down doesn't change the image — it just activates filmstrip keyboard nav.

### Filmstrip Visual State

- `burstFocused=false`: filmstrip visible, no `.active` highlight on any thumb
- `burstFocused=true`: `.active` highlight on the focused thumb

### State Transitions

| Event | `burstViewIndex` | `burstFocused` |
|-------|------------------|----------------|
| Open preview on burst | 0 | false |
| Navigate to different display photo | 0 | false |
| Press Down | unchanged | true |
| Press Up (while focused) | unchanged | false |
| Click filmstrip thumb | clicked index | true |
| Left at index 0 (focused) | 0 → reset on next photo | false → move to prev display photo |
| Right at last index (focused) | 0 → reset on next photo | false → move to next display photo |

### "Current Photo" semantics

When `burstFocused=false`, the current photo for Space/Delete/info purposes is `burstMembers[burstViewIndex]` (which starts as the cover). This is consistent with what's displayed.

## Files to Change

- **`src/App.tsx`**: Add `burstFocused` state, rewrite `handlePreviewNavigate` to respect two-level nav, reset `burstFocused=false` on display photo change
- **`src/components/Preview.tsx`**: Accept `burstFocused` prop, only apply `.active` class when `burstFocused=true`, add Down/Up key handling, update shortcut hints
- **`src/components/Preview.test.tsx`**: Update tests for new prop

## Non-goals

- No changes to grid navigation or burst grouping logic
- No changes to selection model (remains path-based)
- No changes to filmstrip animation or styling (beyond active state gating)
