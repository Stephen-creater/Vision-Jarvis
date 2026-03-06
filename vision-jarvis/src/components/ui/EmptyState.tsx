interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = ''
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in ${className}`}>
      {icon && (
        <div className="text-6xl mb-4 opacity-30">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-secondary mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted max-w-sm mb-4">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
