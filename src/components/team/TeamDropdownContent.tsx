import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Sales/Team dropdown content rendered WITHOUT a portal so it lives inside
 * the `.team-portal` stacking context and is unaffected by page-level overlays.
 * Uses inline styles for background/text to guarantee opacity and contrast
 * regardless of Tailwind class ordering or theme token resolution.
 */
export const TeamDropdownContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, style, children, ...props }, ref) => (
  <DropdownMenuPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    style={{
      backgroundColor: "#15140f",
      color: "#f5efe1",
      borderColor: "#c9a84c",
      boxShadow:
        "0 24px 48px -12px rgba(0,0,0,0.85), 0 0 0 1px rgba(201,168,76,0.35)",
      ...style,
    }}
    className={cn(
      "relative z-[9999] min-w-[240px] overflow-hidden rounded-md border-2 p-1 text-sm",
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      // High-contrast items
      "[&_[role=menuitem]]:flex [&_[role=menuitem]]:items-center [&_[role=menuitem]]:gap-2",
      "[&_[role=menuitem]]:px-3 [&_[role=menuitem]]:py-2 [&_[role=menuitem]]:rounded-sm",
      "[&_[role=menuitem]]:cursor-pointer [&_[role=menuitem]]:outline-none",
      "[&_[role=menuitem]]:text-[#f5efe1]",
      "[&_[role=menuitem]:focus]:bg-[#c9a84c] [&_[role=menuitem]:focus]:text-black",
      "[&_[role=menuitem][data-highlighted]]:bg-[#c9a84c] [&_[role=menuitem][data-highlighted]]:text-black",
      "[&_[role=menuitem][data-disabled]]:opacity-60 [&_[role=menuitem][data-disabled]]:cursor-not-allowed",
      className
    )}
    {...props}
  >
    {children}
  </DropdownMenuPrimitive.Content>
));
TeamDropdownContent.displayName = "TeamDropdownContent";
