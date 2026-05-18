1. Make the sales dropdown render inside the Team Portal layer instead of the default body-level portal.
   - Update `src/components/ui/dropdown-menu.tsx` to support a custom portal container (or optional non-portal rendering for this menu family).
   - Use the `.team-portal` element as the container for these sales dropdowns so they inherit the same theme variables and stacking context as the page.

2. Raise the dropdown above any dimmed/blurred overlays.
   - Give the sales dropdown content an explicit z-index above the page overlays and floating UI.
   - Ensure the menu itself is fully opaque, with no transparency or backdrop blur, so it cannot visually blend with the page behind it.

3. Add a dedicated sales/team dropdown class instead of repeating inline styles.
   - Define a reusable class in `src/index.css` for the noir/gold dropdown surface.
   - Include explicit menu background, border, text, icon, hover, focus, and disabled styles.
   - Do the same for the trigger button so label + chevron contrast is stronger at rest.

4. Apply that shared class to the affected menus only.
   - `src/pages/sales/SalesProjectWorkspace.tsx`
   - `src/pages/sales/SalesDashboard.tsx`
   - Keep scope limited to the Upload Form and Download Templates dropdowns.

5. Verify the exact failure mode in preview after implementation.
   - Confirm the menu is visually in front of the page content.
   - Confirm no semi-transparent veil shows through the dropdown.
   - Confirm disabled items are still readable, just subdued.
   - Confirm dashboard and client workspace match.

Technical details
- The likely root cause is twofold:
  1. Radix `DropdownMenuContent` is portaled out of the `.team-portal` subtree, so the sales-specific `--tp-*` variables are unreliable there.
  2. The menu is using a very dark surface and is close enough in tone to the underlying dimmed content that it reads like it is “behind” a translucent layer.
- The fix is not just “lighter colors”; it is to put the dropdown in the correct portal/container layer and give it a solid, high-contrast surface with stronger foreground styling.
- No backend or workflow changes.