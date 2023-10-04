import { useNavigate } from "react-router-dom";
import {
  EuiHeaderSectionItemButton,
  EuiPopover, EuiPopoverTitle, EuiSelectable,
  EuiSelectableOption,
  EuiSelectableProps,
  useGeneratedHtmlId
} from "@elastic/eui";
import {useEffect, useRef, useState} from "react";
import { SelectableWorkspaceOptions } from "../../workspaces/SelectableWorkspaceOptions";

export default function WorkspaceSelectorMenu() {
  const isMountedRef = useRef(false);
  const navigate = useNavigate();
  const popoverID = useGeneratedHtmlId({
    prefix: 'WorkspaceSelectorMenu',
  });

  const [spaces, setSpaces] = useState<EuiSelectableOption[]>(SelectableWorkspaceOptions);
  const [selectedSpace, setSelectedSpace] = useState(
    spaces.filter((option) => option.checked)[0]
  );
  const [isOpen, setIsOpen] = useState(false);

  const onMenuButtonClick = () => {
    setIsOpen(!isOpen);
  };
  const closePopover = () => {
    setIsOpen(false);
  };
  const onChange: EuiSelectableProps['onChange'] = (options) => {
    setSpaces(options);
    setSelectedSpace(() => options.filter((option) => option.checked)[0]);
  };
  useEffect(() => {

    if (isMountedRef.current) {
      navigate('/' + selectedSpace.key);
    }

    return () => {
      isMountedRef.current = true;
    };
  }, [selectedSpace]);
  const addMoreSpaces = () => {
    setSpaces(spaces.concat([]));
  };
  const button = (
    <EuiHeaderSectionItemButton
      aria-controls={popoverID}
      aria-expanded={isOpen}
      aria-haspopup="true"
      aria-label="Workspace menu"
      onClick={onMenuButtonClick}
    >
      {selectedSpace}
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
        {(list, search) => {
          return (
            <>
              <EuiPopoverTitle paddingSize="s">
                {search || 'Your workspaces'}
              </EuiPopoverTitle>
              {list}
            </>
          )
        }}
      </EuiSelectable>
    </EuiPopover>
  );
}
