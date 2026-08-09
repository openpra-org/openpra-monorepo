import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

const LIVE_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "search",
  "submit",
]);

function inputValue(value: InputHTMLAttributes<HTMLInputElement>["value"]): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join(",");
  return String(value);
}

/**
 * A controlled workbook input that keeps keystrokes local and reports the final
 * value only when the field loses focus. Non-editor input types remain live.
 */
const WorkbookInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function WorkbookInput({ type = "text", value, onChange, onFocus, onBlur, ...props }, ref): JSX.Element {
    const shouldCommitOnDeactivate = value !== undefined && onChange !== undefined && onBlur === undefined && !LIVE_INPUT_TYPES.has(type);
    const [draft, setDraft] = useState(() => inputValue(value));
    const focused = useRef(false);
    const dirty = useRef(false);

    useEffect(() => {
      if (!focused.current || !dirty.current) {
        setDraft(inputValue(value));
        dirty.current = false;
      }
    }, [value]);

    if (!shouldCommitOnDeactivate) {
      return <input ref={ref} type={type} value={value} onChange={onChange} onFocus={onFocus} onBlur={onBlur} {...props} />;
    }

    const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
      dirty.current = true;
      setDraft(event.currentTarget.value);
    };

    const handleFocus = (event: FocusEvent<HTMLInputElement>): void => {
      focused.current = true;
      onFocus?.(event);
    };

    const handleBlur = (event: FocusEvent<HTMLInputElement>): void => {
      focused.current = false;
      if (dirty.current && event.currentTarget.value !== inputValue(value)) {
        onChange(event as unknown as ChangeEvent<HTMLInputElement>);
      }
      dirty.current = false;
    };

    return <input ref={ref} type={type} value={draft} onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur} {...props} />;
  },
);

/** A textarea counterpart to WorkbookInput. */
const WorkbookTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function WorkbookTextarea({ value, onChange, onFocus, onBlur, ...props }, ref): JSX.Element {
    const shouldCommitOnDeactivate = value !== undefined && onChange !== undefined && onBlur === undefined;
    const [draft, setDraft] = useState(() => String(value ?? ""));
    const focused = useRef(false);
    const dirty = useRef(false);

    useEffect(() => {
      if (!focused.current || !dirty.current) {
        setDraft(String(value ?? ""));
        dirty.current = false;
      }
    }, [value]);

    if (!shouldCommitOnDeactivate) {
      return <textarea ref={ref} value={value} onChange={onChange} onFocus={onFocus} onBlur={onBlur} {...props} />;
    }

    const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
      dirty.current = true;
      setDraft(event.currentTarget.value);
    };

    const handleFocus = (event: FocusEvent<HTMLTextAreaElement>): void => {
      focused.current = true;
      onFocus?.(event);
    };

    const handleBlur = (event: FocusEvent<HTMLTextAreaElement>): void => {
      focused.current = false;
      if (dirty.current && event.currentTarget.value !== String(value ?? "")) {
        onChange(event as unknown as ChangeEvent<HTMLTextAreaElement>);
      }
      dirty.current = false;
    };

    return <textarea ref={ref} value={draft} onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur} {...props} />;
  },
);

export { WorkbookInput, WorkbookTextarea };
