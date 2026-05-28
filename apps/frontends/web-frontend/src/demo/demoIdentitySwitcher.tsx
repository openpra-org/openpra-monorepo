import { JSX, useEffect, useRef, useState } from "react";
import { useDemoIdentity } from "./demoIdentity";
import "./css/demoIdentitySwitcher.css";

function DemoIdentitySwitcher(): JSX.Element {
  const { current, identities, setCurrent } = useDemoIdentity();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent): void {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("mousedown", onClick); };
  }, [open]);

  return (
    <div className="demoid" ref={wrapRef}>
      <button
        type="button"
        className={`demoid__btn demoid__btn--${current.persona}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); }}
        title="Demo identity — stand-in for auth"
      >
        <span className="demoid__demo-tag">Demo</span>
        <span className="demoid__avatar">{current.initials}</span>
        <span className="demoid__name">{current.name.split(" ").slice(-1)[0]}</span>
        <span className={`demoid__persona demoid__persona--${current.persona}`}>{current.persona}</span>
      </button>
      {open && (
        <div className="demoid__menu" role="menu">
          <div className="demoid__menu-eyebrow">Switch demo identity</div>
          {identities.map((id) => (
            <button
              key={id.id}
              type="button"
              className={`demoid__menu-item${id.id === current.id ? " demoid__menu-item--active" : ""}`}
              role="menuitem"
              onClick={() => { setCurrent(id.id); setOpen(false); }}
            >
              <span className={`demoid__avatar demoid__avatar--${id.persona}`}>{id.initials}</span>
              <span className="demoid__menu-item-main">
                <span className="demoid__menu-item-name">{id.name}</span>
                <span className="demoid__menu-item-title">{id.title}</span>
              </span>
              <span className={`demoid__persona demoid__persona--${id.persona}`}>{id.persona}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { DemoIdentitySwitcher };
