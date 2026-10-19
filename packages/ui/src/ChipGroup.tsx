import { CheckIcon } from "./icons.js";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

export interface ChipGroupProps<T extends string> {
  /** Names the group for assistive technology, e.g. "Filter by status". */
  label: string;
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Single-choice toggle chips; the chosen one is pressed, filled and ticked. */
export function ChipGroup<T extends string>({ label, options, value, onChange }: ChipGroupProps<T>) {
  return (
    <div role="group" aria-label={label} className="bl-chips">
      {options.map((option) => {
        const pressed = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className="bl-chip"
            aria-pressed={pressed}
            onClick={() => onChange(option.value)}
          >
            {pressed ? <CheckIcon size={14} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
