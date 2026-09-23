import { createContext, useContext, useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import type { IsoDate } from '../domain/types';

/** Lets a control inside <Field> pick up the label's `for` target and the hint's id. */
const FieldContext = createContext<{ id: string; hintId?: string } | null>(null);

function useFieldProps() {
  const field = useContext(FieldContext);
  return field ? { id: field.id, 'aria-describedby': field.hintId } : {};
}

export function Field({ label, hint, required, wide, children }: {
  label: string; hint?: ReactNode; required?: boolean; wide?: boolean; children: ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={wide ? 'field field-wide' : 'field'}>
      <label className="field-label" htmlFor={id}>{label}{required && <span className="req" aria-hidden="true"> *</span>}</label>
      <FieldContext.Provider value={{ id, hintId }}>{children}</FieldContext.Provider>
      {hint && <span className="field-hint" id={hintId}>{hint}</span>}
    </div>
  );
}

export function TextInput({ value, onChange, ref, ...rest }: { value: string; onChange(value: string): void; ref?: Ref<HTMLInputElement> } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return <input ref={ref} className="input" {...useFieldProps()} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

export function TextArea({ value, onChange, rows = 2 }: { value: string; onChange(value: string): void; rows?: number }) {
  return <textarea className="input" {...useFieldProps()} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function DateInput({ value, onChange }: { value: IsoDate; onChange(value: IsoDate): void }) {
  return <input className="input" type="date" {...useFieldProps()} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />;
}

/**
 * Numeric input that keeps what the user typed (e.g. "12.") while reporting a
 * clean number, and resyncs when the value is changed from outside.
 */
export function NumberInput({ value, onChange, placeholder, ariaLabel }: {
  value: number; onChange(value: number): void; placeholder?: string; ariaLabel?: string;
}) {
  const fieldProps = useFieldProps();
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);
  return (
    <input
      className="input num"
      inputMode="decimal"
      {...fieldProps}
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onFocus={(e) => { focused.current = true; e.target.select(); }}
      onBlur={() => { focused.current = false; setText(String(value)); }}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^0-9.,]/g, '');
        setText(cleaned);
        const parsed = Number(cleaned.replace(/,/g, ''));
        onChange(Number.isFinite(parsed) ? parsed : 0);
      }}
    />
  );
}

export function Select<T extends string>({ value, onChange, options, placeholder, ariaLabel }: {
  value: T | ''; onChange(value: T): void; options: readonly (T | { value: T; label: string })[]; placeholder?: string; ariaLabel?: string;
}) {
  return (
    <select className="input" {...useFieldProps()} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => {
        const { value: v, label } = typeof option === 'string' ? { value: option, label: option } : option;
        return <option key={v} value={v}>{label}</option>;
      })}
    </select>
  );
}

export function Segmented<T extends string>({ label, value, onChange, options }: {
  label: string; value: T | string; onChange(value: T): void; options: readonly T[];
}) {
  const id = useId();
  return (
    <div className="field">
      <span className="field-label" id={id}>{label}</span>
      <div className="segmented" role="radiogroup" aria-labelledby={id}>
        {options.map((option) => (
          <button key={option} type="button" role="radio" aria-checked={value === option}
            className={value === option ? 'on' : ''} onClick={() => onChange(option)}>
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
