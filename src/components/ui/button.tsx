import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

// أزرار موحّدة (§هـ.3.3): رئيسي/ثانوي/خطر + outline/ghost.
type Variant = "primary" | "secondary" | "danger" | "outline" | "ghost";
type Size = "sm" | "md" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  danger: "bg-destructive text-destructive-foreground hover:opacity-90",
  outline: "border border-border bg-transparent hover:bg-accent",
  ghost: "hover:bg-accent",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1 rounded-md px-2.5 text-xs",
  md: "h-9 gap-1.5 rounded-md px-4 text-sm",
  icon: "size-9 rounded-md",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
