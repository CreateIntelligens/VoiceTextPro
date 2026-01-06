import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 hover:shadow-glow-sm",
        secondary:
          "border-secondary/50 bg-secondary/10 text-secondary hover:bg-secondary/20",
        destructive:
          "border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20",
        outline: "border-border text-foreground hover:border-primary/50",
        // Cyberpunk 狀態變體
        success:
          "border-neon-green/50 bg-neon-green/10 text-neon-green",
        warning:
          "border-neon-yellow/50 bg-neon-yellow/10 text-neon-yellow",
        error:
          "border-neon-red/50 bg-neon-red/10 text-neon-red",
        processing:
          "border-primary/50 bg-primary/10 text-primary animate-glow-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
