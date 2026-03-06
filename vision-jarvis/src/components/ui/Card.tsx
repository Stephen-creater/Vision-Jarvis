import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  interactive?: boolean;
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Card({
  children,
  interactive = false,
  padding = 'md',
  className = ''
}: CardProps) {
  const paddingClass = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  }[padding];

  const interactiveClass = interactive
    ? 'card-hover-lift cursor-pointer active:scale-[0.99]'
    : '';

  return (
    <div
      className={`bg-card border border-primary rounded-lg ${paddingClass} ${interactiveClass} ${className}`}
    >
      {children}
    </div>
  );
}
