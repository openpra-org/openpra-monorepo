import {useState} from 'react';
import {
  EuiAvatar,
  EuiButton,
  EuiButtonGroup,
  EuiFlexGroup,
  EuiFlexItem,
  EuiHeader,
  EuiHeaderBreadcrumbs,
  EuiHeaderLogo,
  EuiHeaderSection,
  EuiHeaderSectionItem,
  EuiHeaderSectionItemButton,
  EuiIcon,
  EuiKeyPadMenu,
  EuiKeyPadMenuItem,
  EuiLink,
  EuiPopover,
  EuiPopoverFooter,
  EuiPopoverTitle,
  EuiSelectable,
  EuiSelectableMessage,
  EuiSelectableOption,
  EuiSelectableProps,
  EuiSelectableTemplateSitewide,
  EuiSpacer,
  EuiText,
  useGeneratedHtmlId,
} from '@elastic/eui';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import { toTitleCase, tokenizePath } from "../../../utils/StringUtils";

export default () => {

  const navigate = useNavigate();
  const renderLogo = () => (
    <EuiHeaderLogo
      iconType="home"
      href="#"
      onClick={
        (e) => {
          e.preventDefault()
          navigate("/models")
        }
    }
      aria-label="Go to home page"
    />
  );

  const createBreadcrumbs = (path: string) => {
    const tokens = tokenizePath(path);
    return tokens.map((item, i) => {
      return (
        {
          text: toTitleCase(item),
          style: {fontWeight: 500},
          onClick: (e: any) => {
            e.preventDefault();
            navigate(tokens.slice(0, i+1).join("/"));
          },
        }
      )
    });
  }

  //Initiates using location
  const location = useLocation();

  const renderBreadcrumbs = () => {
    return (
      <EuiHeaderBreadcrumbs
        aria-label="Navigation Breadcrumbs"
        breadcrumbs={createBreadcrumbs(location.pathname)}
        max={10}
        truncate={false}
        type="application"
        lastBreadcrumbIsCurrentPage={true}
      />
    );
  };
  const search = (
    <EuiSelectableTemplateSitewide
      options={[]}
      searchProps={{
        compressed: true,
      }}
      popoverButton={
        <EuiHeaderSectionItemButton aria-label="Sitewide search">
          <EuiIcon type="search" size="m" />
        </EuiHeaderSectionItemButton>
      }
      emptyMessage={
        <EuiSelectableMessage style={{ minHeight: 300 }}>
          <p>
            Please see the component page for{' '}
            <Link to="/forms/selectable">
              <strong>EuiSelectableTemplateSitewide</strong>
            </Link>{' '}
            on how to configure your sitewide search.
          </p>
        </EuiSelectableMessage>
      }
    />
  );

  //group of buttons that work to toggle between the data and model sections of the app, easy to add other buttons to this tab as well
  const navButtons = (
      <>
        <EuiButtonGroup
            options={[
              {
                id: 'models',
                label: 'Models',
              },
              {
                id: 'data',
                label: 'Data',
              },
            ]}
            onChange={((id: string, value?: any) => navigate("/" + id))}
            idSelected={window.location.pathname.split('/')[1]}
            color="primary"
            legend="Button group"
        />
      </>
  )
  return (
    <EuiHeader position="fixed">
      <EuiHeaderSection grow={false}>
        <EuiHeaderSectionItem border="right">
          {renderLogo()}
        </EuiHeaderSectionItem>
        <EuiHeaderSectionItem border="right">
          <HeaderSpacesMenu />
        </EuiHeaderSectionItem>
      </EuiHeaderSection>
      {renderBreadcrumbs()}
      <EuiHeaderSection side="right">
        <EuiHeaderSectionItem>{search}</EuiHeaderSectionItem>
        <EuiHeaderSectionItem>{navButtons}</EuiHeaderSectionItem>
        <EuiHeaderSectionItem>
          <HeaderUserMenu />
        </EuiHeaderSectionItem>
        <EuiHeaderSectionItem>
          <HeaderAppMenu />
        </EuiHeaderSectionItem>
      </EuiHeaderSection>
    </EuiHeader>
  );
};
const HeaderUserMenu = () => {
  const headerUserPopoverId = useGeneratedHtmlId({
    prefix: 'headerUserPopover',
  });
  const [isOpen, setIsOpen] = useState(false);
  const onMenuButtonClick = () => {
    setIsOpen(!isOpen);
  };
  const closeMenu = () => {
    setIsOpen(false);
  };
  const button = (
    <EuiHeaderSectionItemButton
      aria-controls={headerUserPopoverId}
      aria-expanded={isOpen}
      aria-haspopup="true"
      aria-label="Account menu"
      onClick={onMenuButtonClick}
    >
      <EuiAvatar name="John Username" size="s" />
    </EuiHeaderSectionItemButton>
  );
  return (
    <EuiPopover
      id={headerUserPopoverId}
      button={button}
      isOpen={isOpen}
      anchorPosition="downRight"
      closePopover={closeMenu}
      panelPaddingSize="none"
    >
      <div style={{ width: 320 }}>
        <EuiFlexGroup
          gutterSize="m"
          className="euiHeaderProfile"
          responsive={false}
        >
          <EuiFlexItem grow={false}>
            <EuiAvatar name="John Username" size="xl" />
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiText>
              <p>John Username</p>
            </EuiText>
            <EuiSpacer size="m" />
              <EuiFlexGroup justifyContent="spaceBetween">
                <EuiFlexItem grow={false}>
                  <EuiLink>Edit profile</EuiLink>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiLink>Log out</EuiLink>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiFlexItem>
        </EuiFlexGroup>
      </div>
    </EuiPopover>
  );
};
const HeaderSpacesMenu = () => {
  const headerSpacesPopoverId = useGeneratedHtmlId({
    prefix: 'headerSpacesPopover',
  });
  const spacesValues: EuiSelectableOption[] = [
    {
      label: 'Sales team',
      prepend: <EuiAvatar type="space" name="Sales Team" size="s" />,
      checked: 'on',
    },
    {
      label: 'Engineering',
      prepend: <EuiAvatar type="space" name="Engineering" size="s" />,
    },
    {
      label: 'Security',
      prepend: <EuiAvatar type="space" name="Security" size="s" />,
    },
    {
      label: 'Default',
      prepend: <EuiAvatar type="space" name="Default" size="s" />,
    },
  ];
  const additionalSpaces = [
    {
      label: 'Sales team 2',
      prepend: <EuiAvatar type="space" name="Sales Team 2" size="s" />,
    },
    {
      label: 'Engineering 2',
      prepend: <EuiAvatar type="space" name="Engineering 2" size="s" />,
    },
    {
      label: 'Security 2',
      prepend: <EuiAvatar type="space" name="Security 2" size="s" />,
    },
    {
      label: 'Default 2',
      prepend: <EuiAvatar type="space" name="Default 2" size="s" />,
    },
  ];
  const [spaces, setSpaces] = useState<EuiSelectableOption[]>(spacesValues);
  const [selectedSpace, setSelectedSpace] = useState(
    spaces.filter((option) => option.checked)[0]
  );
  const [isOpen, setIsOpen] = useState(false);
  const isListExtended = () => {
    return spaces.length > 4;
  };
  const onMenuButtonClick = () => {
    setIsOpen(!isOpen);
  };
  const closePopover = () => {
    setIsOpen(false);
  };
  const onChange: EuiSelectableProps['onChange'] = (options) => {
    setSpaces(options);
    setSelectedSpace(options.filter((option) => option.checked)[0]);
    setIsOpen(false);
  };
  const addMoreSpaces = () => {
    setSpaces(spaces.concat(additionalSpaces));
  };
  const button = (
    <EuiHeaderSectionItemButton
      aria-controls={headerSpacesPopoverId}
      aria-expanded={isOpen}
      aria-haspopup="true"
      aria-label="Spaces menu"
      onClick={onMenuButtonClick}
    >
      {selectedSpace.prepend}
    </EuiHeaderSectionItemButton>
  );
  return (
    <EuiPopover
      id={headerSpacesPopoverId}
      button={button}
      isOpen={isOpen}
      anchorPosition="downLeft"
      closePopover={closePopover}
      panelPaddingSize="none"
    >
      <EuiSelectable
        {...({
          searchable: isListExtended(),
          searchProps: {
            placeholder: 'Find a space',
            compressed: true,
          },
        } as Partial<EuiSelectableProps>)}
        options={spaces}
        singleSelection="always"
        style={{ width: 300 }}
        onChange={onChange}
        listProps={{
          rowHeight: 40,
          showIcons: false,
        }}
      >
        {(list, search) => (
          <>
            <EuiPopoverTitle paddingSize="s">
              {search || 'Your spaces'}
            </EuiPopoverTitle>
            {list}
            <EuiPopoverFooter paddingSize="s">
              <EuiButton
                size="s"
                fullWidth
                onClick={addMoreSpaces}
                disabled={isListExtended()}
              >
                Add more spaces
              </EuiButton>
            </EuiPopoverFooter>
          </>
        )}
      </EuiSelectable>
    </EuiPopover>
  );
};
const HeaderAppMenu = () => {
  const headerAppPopoverId = useGeneratedHtmlId({ prefix: 'headerAppPopover' });
  const headerAppKeyPadMenuId = useGeneratedHtmlId({
    prefix: 'headerAppKeyPadMenu',
  });
  const [isOpen, setIsOpen] = useState(false);
  const onMenuButtonClick = () => {
    setIsOpen(!isOpen);
  };
  const closeMenu = () => {
    setIsOpen(false);
  };
  const button = (
    <EuiHeaderSectionItemButton
      aria-controls={headerAppKeyPadMenuId}
      aria-expanded={isOpen}
      aria-haspopup="true"
      aria-label="Apps menu with 1 new app"
      notification="1"
      onClick={onMenuButtonClick}
    >
      <EuiIcon type="apps" size="m" />
    </EuiHeaderSectionItemButton>
  );
  return (
    <EuiPopover
      id={headerAppPopoverId}
      button={button}
      isOpen={isOpen}
      anchorPosition="downRight"
      closePopover={closeMenu}
    >
      <EuiKeyPadMenu id={headerAppKeyPadMenuId} style={{ width: 288 }}>
        <EuiKeyPadMenuItem label="Discover">
          <EuiIcon type="discoverApp" size="l" />
        </EuiKeyPadMenuItem>
        <EuiKeyPadMenuItem label="Dashboard">
          <EuiIcon type="dashboardApp" size="l" />
        </EuiKeyPadMenuItem>
        <EuiKeyPadMenuItem label="Dev Tools">
          <EuiIcon type="devToolsApp" size="l" />
        </EuiKeyPadMenuItem>
        <EuiKeyPadMenuItem label="Machine Learning">
          <EuiIcon type="machineLearningApp" size="l" />
        </EuiKeyPadMenuItem>
        <EuiKeyPadMenuItem label="Graph">
          <EuiIcon type="graphApp" size="l" />
        </EuiKeyPadMenuItem>
        <EuiKeyPadMenuItem label="Visualize">
          <EuiIcon type="visualizeApp" size="l" />
        </EuiKeyPadMenuItem>
        <EuiKeyPadMenuItem label="Timelion" betaBadgeLabel="Beta">
          <EuiIcon type="timelionApp" size="l" />
        </EuiKeyPadMenuItem>
      </EuiKeyPadMenu>
    </EuiPopover>
  );
};
