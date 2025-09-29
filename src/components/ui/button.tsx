import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        "gradient-primary":
          "relative bg-stone-800 text-white shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 transition-all duration-500",
        "gradient-secondary":
          "relative bg-amber-900 text-white shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 transition-all duration-500",
        "gradient-muted":
          "relative bg-gray-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 transition-all duration-500",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        xl: "h-12 rounded-lg px-8 py-3",
        icon: "h-9 w-9",
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
    
    // Gradient configuration for gradient variants
    const isGradient = variant?.toString().startsWith('gradient-')
    const gradientStyles = React.useMemo(() => {
      if (!isGradient) return {}
      
      const gradientMap = {
        'gradient-primary': 'linear-gradient(to right, #F64040 0%, #F87171 51%, #F64040 100%)',
        'gradient-secondary': 'linear-gradient(to right, #EA580C 0%, #FB923C 51%, #EA580C 100%)',
        'gradient-muted': 'linear-gradient(to right, #6B7280 0%, #9CA3AF 51%, #6B7280 100%)',
      }
      
      return {
        backgroundImage: gradientMap[variant as keyof typeof gradientMap],
        backgroundSize: '200% auto',
        backgroundPosition: 'left center',
      }
    }, [variant, isGradient])
    
    const handleMouseEnter = React.useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      if (isGradient) {
        e.currentTarget.style.backgroundPosition = 'right center'
      }
      props.onMouseEnter?.(e)
    }, [isGradient, props])
    
    const handleMouseLeave = React.useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      if (isGradient) {
        e.currentTarget.style.backgroundPosition = 'left center'
      }
      props.onMouseLeave?.(e)
    }, [isGradient, props])
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        style={isGradient ? { ...gradientStyles, ...props.style } : props.style}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
