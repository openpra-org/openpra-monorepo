import { useLocation, useNavigate } from "react-router-dom";
import {
  EuiHeaderSectionItemButton,
  EuiPopover,
  EuiPopoverTitle,
  EuiSelectable,
  EuiSelectableOption,
  EuiSelectableProps,
  useGeneratedHtmlId,
} from "@elastic/eui";
import { useEffect, useRef, useState } from "react";
import { SelectableWorkspaceOptions } from "../../workspaces/SelectableWorkspaceOptions";

function WorkspaceSelectorMenu(): JSX.Element {
  const didMountRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const popoverID = useGeneratedHtmlId({
    prefix: "WorkspaceSelectorMenu",
  });

  const [spaces, setSpaces] = useState<EuiSelectableOption[]>(SelectableWorkspaceOptions);
  const [selectedSpace, setSelectedSpace] = useState(() => spaces.filter((option) => option.checked)[0]);
  const [isOpen, setIsOpen] = useState(false);

  const onMenuButtonClick = (): void => {
    setIsOpen(!isOpen);
  };
  const closePopover = (): void => {
    setIsOpen(false);
  };
  const onChange: EuiSelectableProps["onChange"] = (options) => {
    setSpaces(options);
    const next = options.filter((option) => option.checked)[0];
    setSelectedSpace(next);
    // Navigate immediately on explicit user selection
    if (next && typeof next.key === "string") {
      void navigate(`/${next.key}`);
    }
  };

  // On mount, sync selected workspace with current URL, but do NOT navigate.
  useEffect(() => {
    if (!didMountRef.current) {
      const seg = location.pathname.split("/")[1] || "internal-events";
      const existing = spaces.find((o) => o.key === seg);
      if (existing && existing !== selectedSpace) {
        setSelectedSpace(existing);
        setSpaces((prev) => prev.map((o) => ({ ...o, checked: o.key === seg ? "on" : undefined })));
      }
      didMountRef.current = true;
    }
  }, [location.pathname, spaces, selectedSpace]);

  const button = (
    <EuiHeaderSectionItemButton
      aria-controls={popoverID}
      aria-expanded={isOpen}
      aria-haspopup="true"
      aria-label="Workspace menu"
      onClick={onMenuButtonClick}
    >
      {selectedSpace.prepend} {/* Render the label property */}
    </EuiHeaderSectionItemButton>
  );

  return (
    <EuiPopover
      id={popoverID}
      button={button}
      isOpen={isOpen}
      anchorPosition="downLeft"
      closePopover={closePopover}
      panelPaddingSize="none"
    >
      <EuiSelectable
        options={spaces}
        singleSelection="always"
        style={{ width: 300 }}
        onChange={onChange}
        listProps={{
          rowHeight: 40,
          showIcons: false,
          paddingSize: "s",
          bordered: false,
        }}
      >
        {(list, search): JSX.Element => (
          <>
            <EuiPopoverTitle paddingSize="s">{search ?? "Your workspaces"}</EuiPopoverTitle>
            {list}
          </>
        )}
      </EuiSelectable>
    </EuiPopover>
  );
}
export { WorkspaceSelectorMenu };
