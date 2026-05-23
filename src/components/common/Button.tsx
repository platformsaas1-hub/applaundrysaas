import React, { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

/**
 * Reusable layout button styled strictly with modern Tailwind CSS.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  // Styles depending on variant
  const baseStyles = 'inline-flex items-center justify-center font-bold transition-all rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none';
  
  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white border border-transparent focus:ring-blue-500',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 focus:ring-slate-400',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white border border-transparent focus:ring-rose-500',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white border border-transparent focus:ring-emerald-500',
    outline: 'bg-transparent hover:bg-slate-50 text-slate-700 border border-slate-350 focus:ring-blue-500'
  };

  const sizeStyles = {
    sm: 'text-[11px] px-3 py-1.5 gap-1.5 tracking-wide uppercase',
    md: 'text-xs px-4 py-2 gap-2 tracking-wide uppercase',
    lg: 'text-sm px-5 py-2.5 gap-2.5'
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
      {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
}
