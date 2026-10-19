"use client";
// Labelled form controls (COMPONENTS.md): the hint sits above the control and
// the error below it, both linked with aria-describedby.
import { useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "./cx.js";
import { ChevronDownIcon, ErrorIcon, PaperclipIcon } from "./icons.js";

interface FieldOwnProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  /** Adds "(optional)" to the label. */
  optional?: boolean;
}

interface FieldIds {
  control: string;
  hint: string;
  error: string;
  counter: string;
}

function useFieldIds(id: string | undefined): FieldIds {
  const generated = useId();
  const base = id ?? generated;
  return { control: base, hint: `${base}-hint`, error: `${base}-error`, counter: `${base}-counter` };
}

function describedBy(...ids: (string | null)[]) {
  return ids.filter(Boolean).join(" ") || undefined;
}

function FieldFrame({
  ids,
  label,
  hint,
  error,
  optional,
  footer,
  children,
}: FieldOwnProps & { ids: FieldIds; footer?: ReactNode; children: ReactNode }) {
  return (
    <div className="bl-field">
      <label className="bl-field__label" htmlFor={ids.control}>
        {label}
        {optional ? <span className="bl-field__optional"> (optional)</span> : null}
      </label>
      {hint ? (
        <p className="bl-field__hint" id={ids.hint}>
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p className="bl-field__error" id={ids.error}>
          <ErrorIcon />
          {error}
        </p>
      ) : null}
      {footer}
    </div>
  );
}

export interface TextFieldProps extends Omit<ComponentProps<"input">, "children">, FieldOwnProps {}

export function TextField({ id, label, hint, error, optional, className, ...rest }: TextFieldProps) {
  const ids = useFieldIds(id);
  return (
    <FieldFrame ids={ids} label={label} hint={hint} error={error} optional={optional}>
      <input
        {...rest}
        id={ids.control}
        className={cx("bl-input", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint ? ids.hint : null, error ? ids.error : null)}
      />
    </FieldFrame>
  );
}

const counts = new Intl.NumberFormat("en-IN");

export interface TextAreaProps extends Omit<ComponentProps<"textarea">, "children">, FieldOwnProps {
  /** Shows "n / max" under a controlled field and announces the remaining count near the limit. */
  counterMax?: number;
}

export function TextArea({
  id,
  label,
  hint,
  error,
  optional,
  className,
  counterMax,
  ...rest
}: TextAreaProps) {
  const ids = useFieldIds(id);
  const length = typeof rest.value === "string" ? rest.value.length : 0;
  const remaining = counterMax === undefined ? 0 : counterMax - length;
  const nearLimit = counterMax !== undefined && remaining <= Math.max(50, Math.floor(counterMax * 0.1));
  const counter =
    counterMax === undefined ? null : (
      <>
        <p className="bl-field__counter" id={ids.counter}>
          {counts.format(length)} / {counts.format(counterMax)}
        </p>
        <p className="bl-sr-only" aria-live="polite">
          {nearLimit ? `${counts.format(Math.max(0, remaining))} characters left` : ""}
        </p>
      </>
    );
  return (
    <FieldFrame ids={ids} label={label} hint={hint} error={error} optional={optional} footer={counter}>
      <textarea
        {...rest}
        id={ids.control}
        className={cx("bl-input", className)}
        maxLength={rest.maxLength ?? counterMax}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(
          hint ? ids.hint : null,
          error ? ids.error : null,
          counter ? ids.counter : null,
        )}
      />
    </FieldFrame>
  );
}

export interface SelectProps extends ComponentProps<"select">, FieldOwnProps {}

/** Native select, for accessibility and mobile pickers. */
export function Select({ id, label, hint, error, optional, className, children, ...rest }: SelectProps) {
  const ids = useFieldIds(id);
  return (
    <FieldFrame ids={ids} label={label} hint={hint} error={error} optional={optional}>
      <div className="bl-select">
        <select
          {...rest}
          id={ids.control}
          className={cx("bl-input", className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hint ? ids.hint : null, error ? ids.error : null)}
        >
          {children}
        </select>
        <ChevronDownIcon className="bl-select__icon" />
      </div>
    </FieldFrame>
  );
}

export interface FileInputProps extends Omit<ComponentProps<"input">, "type" | "children">, FieldOwnProps {
  /** The chosen file's name, shown under the control. */
  selectedName?: string | null;
}

export function FileInput({
  id,
  label,
  hint,
  error,
  optional,
  className,
  selectedName,
  ...rest
}: FileInputProps) {
  const ids = useFieldIds(id);
  return (
    <FieldFrame
      ids={ids}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      footer={
        selectedName ? (
          <p className="bl-field__hint bl-inline-icon">
            <PaperclipIcon />
            <span>Selected: {selectedName}</span>
          </p>
        ) : null
      }
    >
      <input
        {...rest}
        type="file"
        id={ids.control}
        className={cx("bl-file", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint ? ids.hint : null, error ? ids.error : null)}
      />
    </FieldFrame>
  );
}
