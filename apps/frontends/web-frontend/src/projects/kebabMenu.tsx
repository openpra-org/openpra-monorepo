import { JSX, MouseEvent, useEffect, useRef, useState } from "react";
import { type Project } from "interfaces-shared-types";
import {
  ArchiveIcon,
  ArrowRightIcon,
  CopyIcon,
  EditIcon,
  MoreIcon,
  PinIcon,
  ShareIcon,
  TrashIcon,
  UsersIcon,
} from "../welcome/icons";
import "./css/kebabMenu.css";

interface KebabMenuProps {
  project: Project;
  onOpen: () => void;
  onTogglePin: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onMoveToTeam: () => void;
  onMoveToPersonal: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}

function KebabMenu(props: KebabMenuProps): JSX.Element {
  const {
    project,
    onOpen,
    onTogglePin,
    onRename,
    onDuplicate,
    onShare,
    onMoveToTeam,
    onMoveToPersonal,
    onToggleArchive,
    onDelete,
  } = props;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(e: globalThis.MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("mousedown", onClick); };
  }, [open]);

  function stop(e: MouseEvent<HTMLDivElement>): void {
    e.stopPropagation();
  }

  function pick(fn: () => void): () => void {
    return () => { setOpen(false); fn(); };
  }

  const isArchived = project.state === "archived";

  return (
    <div className="kebab" ref={ref} onClick={stop}>
      <button
        type="button"
        className="kebab__btn"
        aria-label="Project actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); }}
      >
        <MoreIcon />
      </button>
      {open && (
        <div className="kebab__pop" role="menu">
          <button type="button" className="kebab__opt" role="menuitem" onClick={pick(onOpen)}>
            <ArrowRightIcon /> Open
          </button>
          <button type="button" className="kebab__opt" role="menuitem" onClick={pick(onTogglePin)}>
            <PinIcon /> {project.pinned ? "Unpin" : "Pin to top"}
          </button>
          <button type="button" className="kebab__opt" role="menuitem" onClick={pick(onRename)}>
            <EditIcon /> Rename
          </button>
          <button type="button" className="kebab__opt" role="menuitem" onClick={pick(onDuplicate)}>
            <CopyIcon /> Duplicate
          </button>
          <button type="button" className="kebab__opt" role="menuitem" onClick={pick(onShare)}>
            <ShareIcon /> Share
          </button>
          {project.ownerTeamId === null ? (
            <button type="button" className="kebab__opt" role="menuitem" onClick={pick(onMoveToTeam)}>
              <UsersIcon /> Move to team…
            </button>
          ) : (
            <button type="button" className="kebab__opt" role="menuitem" onClick={pick(onMoveToPersonal)}>
              <UsersIcon /> Move to personal
            </button>
          )}
          <div className="kebab__divider" />
          <button type="button" className="kebab__opt" role="menuitem" onClick={pick(onToggleArchive)}>
            <ArchiveIcon /> {isArchived ? "Restore" : "Archive"}
          </button>
          <button
            type="button"
            className="kebab__opt kebab__opt--danger"
            role="menuitem"
            onClick={pick(onDelete)}
          >
            <TrashIcon /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

export { KebabMenu };
