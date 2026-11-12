"use client";

import { useState, type ReactNode } from "react";

/** Password input with the design's Show / Hide button inside the field. */
export default function PasswordField({
  id,
  label,
  labelAside,
  autoComplete,
  value,
  onChange,
  describedBy,
  invalid,
  disabled,
}: {
  id: string;
  label: string;
  labelAside?: ReactNode;
  autoComplete: "current-password" | "new-password";
  value?: string;
  onChange?: (v: string) => void;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <div className="label-row">
        <label htmlFor={id}>{label}</label>
        {labelAside}
      </div>
      <div className="pw-wrap">
        <input
          id={id}
          name="password"
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          disabled={disabled}
        />
        <button type="button" className="pw-toggle" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} disabled={disabled}>
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
