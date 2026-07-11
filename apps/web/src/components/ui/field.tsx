"use client";

import { forwardRef, useId } from "react";

import { cn } from "./cn";

const inputClass =
  "w-full rounded-[11px] border border-hairline bg-surface-2 px-3.5 py-2.5 text-[13px] " +
  "text-ink placeholder:text-ink-3 transition-colors duration-[130ms] " +
  "focus:border-brand-3 focus:outline-none disabled:opacity-50";

export function FieldLabel({
  htmlFor,
  required,
  hint,
  children,
}: {
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between">
      <label htmlFor={htmlFor} className="block text-[12.5px] font-medium text-ink-2">
        {children}
        {required && <span className="ml-0.5 text-accent">*</span>}
      </label>
      {hint && <span className="text-[11px] text-ink-3">{hint}</span>}
    </div>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-danger">
      {children}
    </p>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  requiredMark?: boolean;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, requiredMark, error, hint, className, id: idProp, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <div>
      {label && (
        <FieldLabel htmlFor={id} required={requiredMark} hint={hint}>
          {label}
        </FieldLabel>
      )}
      <input ref={ref} id={id} className={cn(inputClass, className)} {...props} />
      <FieldError>{error}</FieldError>
    </div>
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  requiredMark?: boolean;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, requiredMark, error, hint, className, id: idProp, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <div>
      {label && (
        <FieldLabel htmlFor={id} required={requiredMark} hint={hint}>
          {label}
        </FieldLabel>
      )}
      <textarea
        ref={ref}
        id={id}
        className={cn(inputClass, "min-h-24 resize-y", className)}
        {...props}
      />
      <FieldError>{error}</FieldError>
    </div>
  );
});

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  requiredMark?: boolean;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, requiredMark, error, hint, className, id: idProp, children, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <div>
      {label && (
        <FieldLabel htmlFor={id} required={requiredMark} hint={hint}>
          {label}
        </FieldLabel>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={id}
          className={cn(inputClass, "appearance-none pr-9", className)}
          {...props}
        >
          {children}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-3"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
});
