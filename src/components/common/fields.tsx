import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Switch } from '@/components/ui/switch'

const inputCls =
  'h-12 w-full rounded-control border border-line-strong bg-surface-2 px-4 text-[16px] text-ink placeholder:text-ink-3 ' +
  'transition-colors duration-200 focus:border-accent focus:outline-none aria-[invalid=true]:border-crit'

function FieldShell({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string
  label: ReactNode
  help?: ReactNode
  error?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="flex items-center gap-1.5 text-label text-crit" role="alert">
          <AlertCircle size={16} aria-hidden />
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="text-label text-ink-3">
          {help}
        </p>
      ) : null}
    </div>
  )
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode
  help?: ReactNode
  error?: ReactNode
  /** show/hide eye for passwords */
  reveal?: boolean
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, help, error, reveal, type = 'text', className, id: idProp, ...props },
  ref,
) {
  const auto = useId()
  const id = idProp ?? auto
  const [shown, setShown] = useState(false)
  const realType = reveal ? (shown ? 'text' : 'password') : type
  return (
    <FieldShell id={id} label={label} help={help} error={error}>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={realType}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : help ? `${id}-help` : undefined}
          className={cn(inputCls, reveal && 'pr-12', className)}
          {...props}
        />
        {reveal && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? 'Hide password' : 'Show password'}
            className="absolute top-0 right-0 flex size-12 items-center justify-center text-ink-2 hover:text-ink"
          >
            {shown ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
    </FieldShell>
  )
})

interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  help?: ReactNode
  error?: ReactNode
  unit?: ReactNode
  /** optional unit switch, e.g. ft ⇄ cm */
  unitSwitch?: { options: string[]; value: string; onChange: (u: string) => void }
}

export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  { label, help, error, unit, unitSwitch, className, id: idProp, ...props },
  ref,
) {
  const auto = useId()
  const id = idProp ?? auto
  return (
    <FieldShell id={id} label={label} help={help} error={error}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={ref}
            id={id}
            type="number"
            inputMode="decimal"
            step="any"
            aria-invalid={Boolean(error)}
            className={cn(inputCls, 'tabular', unit && 'pr-16', className)}
            {...props}
          />
          {unit && (
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-2">{unit}</span>
          )}
        </div>
        {unitSwitch && (
          <div className="flex rounded-control border border-line-strong bg-surface-2 p-1">
            {unitSwitch.options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => unitSwitch.onChange(o)}
                aria-pressed={unitSwitch.value === o}
                className={cn(
                  'h-10 min-w-12 rounded-[10px] px-2 text-[15px] font-semibold',
                  unitSwitch.value === o ? 'bg-accent text-accent-ink' : 'text-ink-2',
                )}
              >
                {o}
              </button>
            ))}
          </div>
        )}
      </div>
    </FieldShell>
  )
})

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: ReactNode
  help?: ReactNode
  error?: ReactNode
  options: { value: string; label: string }[]
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, help, error, options, className, id: idProp, ...props },
  ref,
) {
  const auto = useId()
  const id = idProp ?? auto
  return (
    <FieldShell id={id} label={label} help={help} error={error}>
      <select ref={ref} id={id} aria-invalid={Boolean(error)} className={cn(inputCls, 'appearance-none', className)} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
})

/** Switch with a label and one line of help. */
export function SwitchField({
  label,
  help,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: ReactNode
  help?: ReactNode
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex min-h-12 items-center justify-between gap-4">
      <label htmlFor={id} className="min-w-0">
        <span className="block font-medium">{label}</span>
        {help && <span className="block text-label text-ink-3">{help}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}
