"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "./utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "switch-control peer inline-flex shrink-0 items-center rounded-full border transition-colors outline-none disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "switch-thumb pointer-events-none block rounded-full transition-transform",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
