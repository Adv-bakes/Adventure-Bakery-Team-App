import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-4 w-full overflow-hidden rounded-full", className)}
    style={{ background: 'rgba(200, 155, 60, 0.15)' }}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 transition-all duration-500 ease-out"
      style={{ 
        transform: `translateX(-${100 - (value || 0)}%)`,
        background: 'linear-gradient(90deg, #C89B3C 0%, #D4A855 50%, #C89B3C 100%)',
        backgroundSize: '200% 100%',
        boxShadow: '0 2px 8px rgba(200, 155, 60, 0.3)'
      }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
