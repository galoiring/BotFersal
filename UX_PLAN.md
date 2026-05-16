# BotFersal UX Plan

Living plan for UX improvements on the `feature/grocery-list` branch. Items are ordered by impact-per-effort so we can ship the top of the list first and keep going.

The driving principle: **the app is used in supermarket aisles with one hand on the trolley.** Optimize for that. Speed > prettiness, fewer taps > more controls, no waiting on animations.

---

## Already shipped on this branch

- **Voucher "Used" no longer blocks the next scan.** Removed the 3s fullscreen success modal in `handleVoucherUse`; haptic + a 1.2s inline banner is the new feedback. ([App.tsx:225-263](frontend/src/App.tsx:225))
- **Smart default tab.** App re-opens to whichever tab (`vouchers` / `grocery`) you used last, via `localStorage`. ([App.tsx:71-78](frontend/src/App.tsx:71))
- **"Clean autocomplete history" UI.** Subtle text-button at the bottom of the grocery list — calls `/api/grocery/clean-history`, with a confirm dialog and a "removed N items" toast. ([GroceryView.tsx](frontend/src/components/GroceryView.tsx))

---

## Next — Quick wins (a few minutes each)

1. **Trim the new-vouchers scan success modal too.** Same blocking pattern as the voucher-use one we just fixed. 3000ms is too long. Drop to ~1200ms and consider making it a corner toast (`pointer-events: none`) instead of fullscreen. [App.tsx:309-313](frontend/src/App.tsx:309)
2. **Optimistic voucher count.** After "mark used", decrement the local count immediately instead of waiting on `loadVouchers()`. Snap-back on API failure. Currently the count visibly lags by ~300ms.
3. **Pull-to-refresh on vouchers tab.** Grocery has `PullToRefresh`, vouchers don't. Same component, drop-in.
4. **Loading skeletons for vouchers/grocery list.** Cards with shimmer instead of a center spinner — feels twice as fast even when it's the same.
5. **Larger touch targets on voucher count cards.** Min 48×48px hit area, even if the card is small.
6. **Persist dark mode preference.** Verify it survives reload — if it doesn't, add `localStorage` like we did for `activeTab`.

## Phase 2 — Rapid-scan ergonomics (the supermarket flow)

7. **Multi-voucher mode.** A "next voucher" button that comes up after marking used, pre-selected at the same denomination — for those weeks where you burn 5×50₪ in a row. No need to re-tap the card.
8. **One-tap denomination from barcode screen.** Long-press a voucher count to jump straight to the barcode view (skip the "Show barcode" intermediate step).
9. **Undo recent action.** Toast: "Marked 50₪ as used" with a 4-second UNDO button — survives the toast being briefer because the action is recoverable.
10. **Camera scan: hold-to-scan-multiple.** When adding new vouchers via 10bis scan, allow staying in the camera until user dismisses, batching results.

## Phase 3 — Grocery flow polish

11. **Grocery search bar.** At ~30+ items the category sections still get long. A search field above the input that filters in-place.
12. **Voice-add for items.** Web Speech API on the AutocompleteInput — hold a mic button, dictate, item gets added. Hebrew + English.
13. **Reorder items by drag.** Within a category. Useful for shopping in a fixed aisle order.
14. **Long-press item → bulk-select mode.** Then check-multiple / delete-multiple in one action.
15. **"Frequently bought" suggestions on empty list.** When list is empty, show the top 10 historical items as one-tap add chips.

## Phase 4 — Foundational

16. **Replace ad-hoc `setError("...")` + `setTimeout` everywhere with a real toast library** (sonner or react-hot-toast). Right now we have multiple inline banners with different durations across `App.tsx` and `GroceryView.tsx` — one toast queue gives consistent placement and animation. Also non-blocking by default.
17. **Hebrew RTL fixes.** Mixed `dir="ltr"` / Hebrew strings creates awkward punctuation. Wrap Hebrew labels in `<span dir="rtl">` or set `dir="auto"` on text containers.
18. **Offline-first verification.** PWA service worker should cache the last voucher list. Test airplane mode: does the app open with stale-but-usable data, or a blank screen?
19. **Empty states.** Vouchers tab when count is 0 ("No vouchers — scan 10bis to add some"). Match the grocery empty state pattern.
20. **Smaller success/error pings.** Replace the "✅ Used" banner with a 600ms checkmark that overlays the voucher card itself for milliseconds — closer to where the user was looking.

---

## Out of scope (worth saying so)

- Major redesigns. The Liquid Glass system is working; we're polishing flow, not visuals.
- Adding more tabs/screens. The 2-tab layout is correct for one-handed use.
- Auth overhaul. The `?user=jewbaca1` default is consistent across the app and fine for a 2-person household.

## How to pick the next item

For each item above, the cost is "minutes-to-hours" — none are days. When picking what to do next, ask:
1. Does it remove a wait the user feels? → do it.
2. Does it remove a tap from a hot path (scan, mark used, add item)? → do it.
3. Anything else → defer.
