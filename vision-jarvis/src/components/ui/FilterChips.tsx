interface FilterChipsProps {
  items: { id: string; label: string }[];
  selected: string | null;
  onChange: (id: string | null) => void;
  className?: string;
}

export default function FilterChips({
  items,
  selected,
  onChange,
  className = ''
}: FilterChipsProps) {
  return (
    <div className={`flex gap-2 flex-wrap ${className}`}>
      {items.map((item) => {
        const isSelected = selected === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(isSelected ? null : item.id)}
            className={`px-3 py-1.5 rounded-full text-sm transition-all ${
              isSelected
                ? 'bg-white/10 text-primary border border-white/20'
                : 'bg-white/5 text-muted border border-transparent hover:bg-white/8'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
