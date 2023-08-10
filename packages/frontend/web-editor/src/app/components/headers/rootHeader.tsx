import {useEffect, useState} from 'react';
import {
  EuiAvatar,
  EuiFlexGroup,
  EuiFlexItem,
  EuiHeader,
  EuiHeaderBreadcrumbs,
  EuiHeaderSection,
  EuiHeaderSectionItem,
  EuiHeaderSectionItemButton,
  EuiIcon,
  EuiKeyPadMenu,
  EuiKeyPadMenuItem,
  EuiLink,
  EuiPopover,
  EuiSelectableMessage,
  EuiSelectableTemplateSitewide,
  EuiSpacer,
  EuiText,
  useGeneratedHtmlId,
} from '@elastic/eui';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import { toTitleCase, tokenizePath } from "../../../utils/StringUtils";
import WorkspaceSelectorMenu from "./WorkspaceSelectorMenu";
import ApiManager from 'packages/shared-types/src/lib/api/ApiManager';
import ContextAddButton from '../buttons/contextAddButton';

export default () => {

  const navigate = useNavigate();

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

  //redirects to the auth page if the user is not logged in
  useEffect(() => {
    if (!ApiManager.isLoggedIn() && location.pathname != '/') {
      navigate('/')
    }
  }, []);

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

    return (
        <EuiHeader position="fixed">
          <EuiHeaderSection grow={false}>
            <EuiHeaderSectionItem border="right">
              <WorkspaceSelectorMenu/>
            </EuiHeaderSectionItem>
          </EuiHeaderSection>
          {renderBreadcrumbs()}
          <EuiHeaderSection side="right">
            <EuiHeaderSectionItem>
              <ContextAddButton/>
            </EuiHeaderSectionItem>
            <EuiHeaderSectionItem>{search}</EuiHeaderSectionItem>
            <EuiHeaderSectionItem>
              <HeaderUserMenu/>
            </EuiHeaderSectionItem>
            <EuiHeaderSectionItem>
              <HeaderAppMenu/>
            </EuiHeaderSectionItem>
          </EuiHeaderSection>
        </EuiHeader>
    );

};
const HeaderUserMenu = () => {

  const navigate = useNavigate();

  const headerUserPopoverId = useGeneratedHtmlId({
    prefix: 'headerUserPopover',
  });

  const [isOpen, setIsOpen] = useState(false);

  const onMenuButtonClick = () => {
    setIsOpen(!isOpen);
  };

  //thewse two lines grab the username so that it can be used throughout the page. Needs this because for some reason user can be undefined
  const currentUser = ApiManager.getCurrentUser();
  const nameString = currentUser && currentUser.username ? currentUser.username : "Unknown User";
  
  const closeMenu = () => {
    setIsOpen(false);
  };

  const logoutFunction = () => {
    ApiManager.logout()
    navigate("")
  }

  const button = (
    <EuiHeaderSectionItemButton
      aria-controls={headerUserPopoverId}
      aria-expanded={isOpen}
      aria-haspopup="true"
      aria-label="Account menu"
      onClick={onMenuButtonClick}
    >
      <EuiAvatar name={nameString} size="s" />
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
            <EuiAvatar name={nameString} size="xl" />
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiText>
              <p>{nameString}</p>
            </EuiText>
            <EuiSpacer size="m" />
              <EuiFlexGroup justifyContent="spaceBetween">
                <EuiFlexItem grow={false}>
                  <EuiLink>Edit profile</EuiLink>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiLink onClick={logoutFunction}>Log out</EuiLink>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiFlexItem>
        </EuiFlexGroup>
      </div>
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
