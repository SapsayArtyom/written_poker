export interface TabItem<T extends string> {
  id: T;
  label: string;
  badge?: string;
}

/** Переключатель разделов — виден только на телефоне (на десктопе оба видны сразу). */
export default function Tabs<T extends string>({
  items,
  active,
  onChange,
}: {
  items: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          className="tab"
          aria-selected={item.id === active}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.badge ? ` · ${item.badge}` : ''}
        </button>
      ))}
    </div>
  );
}
