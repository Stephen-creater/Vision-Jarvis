interface SkeletonProps {
  width?: string;
  height?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  count?: number;
  className?: string;
}

export default function Skeleton({
  width,
  height,
  variant = 'rectangular',
  count = 1,
  className = ''
}: SkeletonProps) {
  const baseClass = 'animate-shimmer bg-gradient-to-r from-white/5 via-white/10 to-white/5 bg-[length:200%_100%]';

  const variantClass = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md'
  }[variant];

  const style = {
    width: width || (variant === 'circular' ? '40px' : '100%'),
    height: height || (variant === 'text' ? '1rem' : variant === 'circular' ? '40px' : '80px')
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${baseClass} ${variantClass} ${className}`}
          style={style}
        />
      ))}
    </>
  );
}
