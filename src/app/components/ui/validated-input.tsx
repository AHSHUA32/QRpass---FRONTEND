import * as React from "react";

const personName = /^[\p{L}\p{M} .'’ʼʻ·\p{Pd}]+$/u;

export function isPersonName(value: string) {
  return personName.test(value.trim()) && /\p{L}/u.test(value);
}

export function isEmail(value: string) {
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(value.trim());
}

export type FieldRule = (value: string) => string;

export const fieldRules = {
  nonBlank: (value: string) => value.trim() ? "" : "Complete this field.",
  name: (value: string) => isPersonName(value) ? "" : "Enter a name using letters, spaces, and name punctuation.",
  email: (value: string) => isEmail(value) ? "" : "Enter a valid email address, such as name@example.com.",
  id: (value: string) => /^[0-9]+$/.test(value) ? "" : "Enter digits only.",
  mobile: (value: string) => /^09[0-9]{9}$/.test(value) ? "" : "Enter an 11-digit mobile number in 09XXXXXXXXX format.",
};

export function wholeNumber(min: number, max = Number.MAX_SAFE_INTEGER): FieldRule {
  return value => {
    if (!/^[0-9]+$/.test(value)) return "Enter digits only.";
    if (Number(value) < min || Number(value) > max) {
      return max === Number.MAX_SAFE_INTEGER && Number(value) <= max
        ? `Enter a whole number of at least ${min}.`
        : `Enter a whole number from ${min} to ${max}.`;
    }
    return "";
  };
}

// Keep the draft intact during typing, paste, and IME input. Native form
// validation blocks submission, and invalid events reveal the inline message.
export function ValidatedInput({
  rule, value, required, showError = false, inputRef, onBlur, onInvalid,
  ...props
}: Omit<React.ComponentProps<"input">, "ref" | "value"> & {
  rule?: FieldRule;
  value: string;
  showError?: boolean;
  inputRef?: React.RefCallback<HTMLInputElement>;
}) {
  const ref = React.useRef<HTMLInputElement | null>(null);
  const attachInput = React.useCallback((element: HTMLInputElement | null) => {
    ref.current = element;
    inputRef?.(element);
  }, [inputRef]);
  const errorId = React.useId();
  const [touched, setTouched] = React.useState(false);
  const [message, setMessage] = React.useState("");

  React.useLayoutEffect(() => {
    const input = ref.current;
    if (!input) return;
    const error = !value
      ? required ? "Complete this field." : ""
      : rule?.(value) ?? "";
    input.setCustomValidity(error);
    setMessage(input.validity.valid ? "" : input.validationMessage);
  }, [value, rule, required, props.min, props.max, props.disabled, props.readOnly, props.type]);

  const visibleError = (touched || showError) && message && !props.disabled && !props.readOnly;

  return (
    <>
      <input
        {...props}
        ref={attachInput}
        value={value}
        required={required}
        aria-invalid={visibleError ? true : props["aria-invalid"]}
        aria-describedby={[props["aria-describedby"], visibleError ? errorId : ""].filter(Boolean).join(" ") || undefined}
        onBlur={event => {
          setTouched(true);
          onBlur?.(event);
        }}
        onInvalid={event => {
          setTouched(true);
          setMessage(event.currentTarget.validationMessage);
          onInvalid?.(event);
        }}
      />
      {visibleError && <p id={errorId} className="mt-1 text-xs text-red-600" aria-live="polite">{message}</p>}
    </>
  );
}
