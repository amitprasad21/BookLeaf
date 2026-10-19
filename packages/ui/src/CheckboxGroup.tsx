// A labelled set of checkboxes for multi-choice filters (native inputs, so
// keyboard and screen-reader support come for free).
export interface CheckboxOption<T extends string> {
  value: T;
  label: string;
}

export interface CheckboxGroupProps<T extends string> {
  legend: string;
  options: readonly CheckboxOption<T>[];
  values: readonly T[];
  onChange: (values: T[]) => void;
  disabled?: boolean;
}

export function CheckboxGroup<T extends string>({
  legend,
  options,
  values,
  onChange,
  disabled,
}: CheckboxGroupProps<T>) {
  return (
    <fieldset className="bl-checks" disabled={disabled}>
      <legend className="bl-field__label">{legend}</legend>
      <div className="bl-checks__list">
        {options.map((option) => (
          <label key={option.value} className="bl-check">
            <input
              type="checkbox"
              checked={values.includes(option.value)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...values, option.value]
                    : values.filter((value) => value !== option.value),
                )
              }
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
