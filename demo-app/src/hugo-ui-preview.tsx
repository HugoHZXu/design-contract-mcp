import type { ReactNode } from "react";

export type ButtonProps = {
  children: ReactNode;
  level?: "primary" | "secondary" | "tertiary";
  colorTheme?: "purple" | "white" | "grey" | "red";
  size?: "small" | "medium" | "large";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
};

export function Button({
  children,
  level = "primary",
  colorTheme = "purple",
  size = "medium"
}: ButtonProps) {
  return (
    <button
      className={`ds-button ds-button-${level} ds-button-${colorTheme} ds-button-${size}`}
      type="button"
    >
      {children}
    </button>
  );
}

export type InputProps = {
  id?: string;
  label?: ReactNode;
  value?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: ReactNode;
  type?: string;
  onChange?: (event: unknown) => void;
};

export function Input({ id, label, value = "", helperText }: InputProps) {
  return (
    <label className="ds-field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} defaultValue={value} />
      {helperText ? <small>{helperText}</small> : null}
    </label>
  );
}

export type ModalProps = {
  open: boolean;
  title?: ReactNode;
  subTitle?: ReactNode;
  type?: "error" | "warning" | "transactional" | "destructive" | "informational" | "feedback";
  children?: ReactNode;
  footerComponent?: ReactNode;
  onClose?: () => void;
};

export function Modal({ open, title, subTitle, children, footerComponent }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <section className="ds-modal" role="dialog" aria-modal="true" aria-label={String(title ?? "Modal")}>
      <header>
        <h2>{title}</h2>
        {subTitle ? <p>{subTitle}</p> : null}
      </header>
      <div className="ds-modal-body">{children}</div>
      {footerComponent ? <footer>{footerComponent}</footer> : null}
    </section>
  );
}
