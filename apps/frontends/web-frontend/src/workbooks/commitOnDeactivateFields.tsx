import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
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

function fitTextareaHeight(element: HTMLTextAreaElement): void {
  if (element.getClientRects().length === 0) return;
  const scrolled: [Element, number][] = [];
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    if (node.scrollTop > 0) scrolled.push([node, node.scrollTop]);
  }
  const style = window.getComputedStyle(element);
  const edges = style.boxSizing === "border-box"
    ? Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth)
    : -(Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom));
  element.style.overflowY = "hidden";
  element.style.resize = "none";
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight + edges}px`;
  for (const [node, top] of scrolled) node.scrollTop = top;
}

type WorkbookTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { fitContent?: boolean };

/** A textarea counterpart to WorkbookInput. */
const WorkbookTextarea = forwardRef<HTMLTextAreaElement, WorkbookTextareaProps>(
  function WorkbookTextarea({ value, onChange, onFocus, onBlur, fitContent = false, ...props }, ref): JSX.Element {
    const shouldCommitOnDeactivate = value !== undefined && onChange !== undefined && onBlur === undefined;
    const [draft, setDraft] = useState(() => String(value ?? ""));
    const focused = useRef(false);
    const dirty = useRef(false);
    const element = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
      if (!focused.current || !dirty.current) {
        setDraft(String(value ?? ""));
        dirty.current = false;
      }
    }, [value]);

    const attach = useCallback((node: HTMLTextAreaElement | null): void => {
      element.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref !== null) ref.current = node;
    }, [ref]);

    useLayoutEffect(() => {
      if (fitContent && element.current !== null) fitTextareaHeight(element.current);
    }, [fitContent, draft, value]);

    useEffect(() => {
      const node = element.current;
      if (!fitContent || node === null) return undefined;
      let width = node.clientWidth;
      let frame = 0;
      const refit = (): void => {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => fitTextareaHeight(node));
      };
      const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
        if (node.clientWidth === width) return;
        width = node.clientWidth;
        refit();
      });
      observer?.observe(node);
      void document.fonts?.ready.then(refit);
      return () => {
        observer?.disconnect();
        window.cancelAnimationFrame(frame);
      };
    }, [fitContent]);

    if (!shouldCommitOnDeactivate) {
      return <textarea ref={attach} value={value} onChange={onChange} onFocus={onFocus} onBlur={onBlur} {...props} />;
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

    return <textarea ref={attach} value={draft} onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur} {...props} />;
  },
);

export { WorkbookInput, WorkbookTextarea };
