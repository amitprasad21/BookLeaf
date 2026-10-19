"use client";
// WAI-ARIA tabs with automatic activation: arrow keys, Home and End move
// between tabs. Inactive panels stay mounted (hidden), so their state is kept.
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  label: string;
  items: readonly TabItem[];
  defaultTab?: string;
}

export function Tabs({ label, items, defaultTab }: TabsProps) {
  const base = useId();
  const [selected, setSelected] = useState(defaultTab ?? items[0]?.id);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = items.length - 1;
    const target =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (target === null) return;
    event.preventDefault();
    const item = items[target];
    if (!item) return;
    setSelected(item.id);
    tabs.current[target]?.focus();
  }

  return (
    <div className="bl-tabs">
      <div role="tablist" aria-label={label} className="bl-tabs__list">
        {items.map((item, index) => {
          const active = item.id === selected;
          return (
            <button
              key={item.id}
              ref={(element) => {
                tabs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${item.id}`}
              aria-selected={active}
              aria-controls={`${base}-panel-${item.id}`}
              tabIndex={active ? 0 : -1}
              className="bl-tabs__tab"
              onClick={() => setSelected(item.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${base}-panel-${item.id}`}
          aria-labelledby={`${base}-tab-${item.id}`}
          hidden={item.id !== selected}
          tabIndex={0}
          className="bl-tabs__panel"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
