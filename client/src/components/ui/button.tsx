import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-primary to-accent text-primary-foreground hover:shadow-glow hover:brightness-110",
        destructive:
          "bg-destructive/90 text-destructive-foreground border border-destructive hover:bg-destructive hover:shadow-glow-red",
        outline:
          "border border-primary/50 bg-transparent text-primary hover:bg-primary/10 hover:border-primary hover:shadow-glow-sm",
        secondary:
          "bg-secondary/20 text-secondary border border-secondary/50 hover:bg-secondary/30 hover:border-secondary hover:shadow-glow-magenta",
        ghost: "text-foreground hover:bg-muted hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80",
        // 新增 Cyberpunk 特殊變體
        neon: "bg-transparent border-2 border-primary text-primary hover:bg-primary/10 hover:shadow-glow animate-border-glow",
        cyber: "bg-gradient-cyber text-primary-foreground font-semibold hover:shadow-glow-lg hover:brightness-110",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
