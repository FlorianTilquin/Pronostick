"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = {
  autoComplete?: string;
  minLength?: number;
  name: string;
  placeholder: string;
  required?: boolean;
};

export function PasswordInput({ autoComplete, minLength, name, placeholder, required }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input
        autoComplete={autoComplete}
        className="compact-input"
        minLength={minLength}
        name={name}
        placeholder={placeholder}
        required={required}
        type={visible ? "text" : "password"}
      />
      <button
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        className="password-toggle"
        onClick={() => setVisible((value) => !value)}
        title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        type="button"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
