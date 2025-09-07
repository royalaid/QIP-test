import { cn } from "@/lib/utils"
import { type ButtonHTMLAttributes, forwardRef } from "react"
import React from "react"

interface GradientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "muted"
}

const GradientButton = forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ className, variant = "primary", children, ...props }, ref) => {
    const getGradient = () => {
      switch(variant) {
        case "primary":
          return "linear-gradient(to right, #F64040 0%, #F87171 51%, #F64040 100%)"
        case "secondary":
          return "linear-gradient(to right, #EA580C 0%, #FB923C 51%, #EA580C 100%)"
        case "muted":
          return "linear-gradient(to right, #6B7280 0%, #9CA3AF 51%, #6B7280 100%)"
        default:
          return "linear-gradient(to right, #F64040 0%, #F87171 51%, #F64040 100%)"
      }
    }

    const getBaseColor = () => {
      switch(variant) {
        case "primary":
          return "bg-stone-800"
        case "secondary":
          return "bg-amber-900"
        case "muted":
          return "bg-gray-600"
        default:
          return "bg-stone-800"
      }
    }

    return (
      <button
        ref={ref}
        className={cn(
          "relative px-8 py-3 rounded-lg font-semibold text-white tracking-wide",
          "transition-all duration-500 ease-in-out",
          "transform hover:scale-105 active:scale-95",
          "shadow-lg hover:shadow-xl",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
          getBaseColor(),
          className,
        )}
        style={{
          backgroundImage: getGradient(),
          backgroundSize: "200% auto",
          backgroundPosition: "left center",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundPosition = "right center"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundPosition = "left center"
        }}
        {...props}
      >
        <span className="relative z-10">{children}</span>
      </button>
    )
  },
)

GradientButton.displayName = "GradientButton"

export { GradientButton }
