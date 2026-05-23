import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Reusable container box with flexible header-body-footer slots.
 */
export function Card({ children, className = '', onClick, hoverable = false }: CardProps) {
  const baseStyle = 'bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs';
  const hoverStyle = hoverable ? 'hover:shadow-md hover:border-slate-300 transition-all cursor-pointer' : '';

  return (
    <div 
      className={`${baseStyle} ${hoverStyle} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', subtitle, action }: CardHeaderProps) {
  return (
    <div className={`p-4 border-b border-slate-150 flex items-center justify-between bg-slate-50/50 ${className}`}>
      <div className="space-y-0.5 min-w-0">
        <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider truncate">
          {children}
        </h3>
        {subtitle && (
          <p className="text-[10px] text-slate-400 font-medium truncate">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return (
    <div className={`p-5 text-xs text-slate-650 leading-relaxed ${className}`}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`p-4 border-t border-slate-150 bg-slate-50/50 flex items-center justify-end ${className}`}>
      {children}
    </div>
  );
}
