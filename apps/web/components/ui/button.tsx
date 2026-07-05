import { cn } from '@/lib/utils';
import { type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary:
    // Solid bg-primary sits UNDER the gradient image so the dark label always
    // has a green fill behind it, even where background-image fails to paint.
    'bg-primary bg-primary-grad text-primary-foreground shadow-glow-sm hover:shadow-glow hover:brightness-[1.05]',
  secondary: 'bg-surface-2 text-foreground border border-border-strong/60 hover:bg-surface-3',
  outline:
    'border border-border bg-transparent text-foreground hover:bg-surface-2 hover:border-border-strong',
  ghost: 'bg-transparent text-foreground hover:bg-surface-2',
  danger: 'bg-danger text-white shadow-sm hover:bg-danger/90',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-10 w-10',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ className, variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
        'transition-all duration-200 active:scale-[0.97]',
        'focus-visible:ring-primary focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
