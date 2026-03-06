interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'active' | 'success' | 'warning' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

export default function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className = ''
}: BadgeProps) {
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  const variantClass = {
    default: 'bg-white/5 text-muted',
    active: 'bg-accent-blue-dim text-accent-blue border border-accent-blue/30',
    success: 'bg-accent-green-dim text-accent-green border border-accent-green/30',
    warning: 'bg-accent-amber-dim text-accent-amber border border-accent-amber/30',
    info: 'bg-accent-blue-dim text-accent-blue border border-accent-blue/30'
  }[variant];

  return (
    <span className={`inline-flex items-center rounded-full ${sizeClass} ${variantClass} ${className}`}>
      {children}
    </span>
  );
}
