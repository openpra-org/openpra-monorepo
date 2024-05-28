import { useEffect, useState } from "react";
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
} from "@elastic/eui";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import { EuiBreadcrumb } from "@elastic/eui/src/components/breadcrumbs";
import { InternalHazardsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/internalHazardsModel";
import { InternalEventsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel";
import { ToTitleCase, TokenizePath } from "../../../utils/StringUtils";
import { ContextAddButton } from "../buttons/contextAddButton";
import { ResetAllSlices, UseGlobalStore } from "../../zustand/Store";
import { WorkspaceSelectorMenu } from "./WorkspaceSelectorMenu";

const RootHeader = (): JSX.Element => {
  const navigate = useNavigate();
  const internalEvents = UseGlobalStore.use.InternalEvents();
  const internalHazards = UseGlobalStore.use.InternalHazards();

  const getModelName = (id: string): string => {
    const ieName = internalEvents.find((ie: InternalEventsModelType) => ie._id === id)?.label.name;
    if (ieName) return ieName;

    const ihName = internalHazards.find((ih: InternalHazardsModelType) => ih._id === id)?.label.name;
    if (ihName) return ihName;

    return id;
  };

  const createBreadcrumbs = (path: string): EuiBreadcrumb[] => {
    const tokens = TokenizePath(path);
    return tokens.map((token, i) => {
      if (token.length === 24) {
        token = getModelName(token);
      }
      return {
        text: ToTitleCase(token),
        style: { fontWeight: 500 },
        onClick: (e): void => {
          e.preventDefault();
          navigate(tokens.slice(0, i + 1).join("/"));
        },
      };
    });
  };

  //Initiates using location
  const location = useLocation();

  //redirects to the auth page if the user is not logged in
  useEffect(() => {
    if (!ApiManager.isLoggedIn() && location.pathname !== "/") {
      navigate("/");
    }
  }, [location.pathname, navigate]);

  const renderBreadcrumbs = (): JSX.Element => (
    <EuiHeaderBreadcrumbs
      aria-label="Navigation Breadcrumbs"
      data-testid="breadcrumbs"
      breadcrumbs={createBreadcrumbs(location.pathname)}
      max={10}
      truncate={false}
      type="application"
      lastBreadcrumbIsCurrentPage={true}
    />
  );
  const search = (
    <EuiSelectableTemplateSitewide
      options={[]}
      searchProps={{
        compressed: true,
      }}
      popoverButton={
        <EuiHeaderSectionItemButton
          data-testid="search-icon"
          aria-label="Sitewide search"
        >
          <EuiIcon
            type="search"
            size="m"
          />
        </EuiHeaderSectionItemButton>
      }
      emptyMessage={
        <EuiSelectableMessage
          data-testid="search-menu"
          style={{ minHeight: 300 }}
        >
          <p>
            Please see the component page for{" "}
            <Link to="/forms/selectable">
              <strong>EuiSelectableTemplateSitewide</strong>
            </Link>{" "}
            on how to configure your sitewide search.
          </p>
        </EuiSelectableMessage>
      }
    />
  );

  return (
    <EuiHeader position="fixed">
      <EuiHeaderSection grow={false}>
        <EuiHeaderSectionItem>
          <WorkspaceSelectorMenu />
        </EuiHeaderSectionItem>
      </EuiHeaderSection>
      {renderBreadcrumbs()}
      <EuiHeaderSection side="right">
        <EuiHeaderSectionItem>
          <ContextAddButton />
        </EuiHeaderSectionItem>
        <EuiHeaderSectionItem>{search}</EuiHeaderSectionItem>
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
export { RootHeader };
const HeaderUserMenu = (): JSX.Element => {
  const navigate = useNavigate();

  const headerUserPopoverId = useGeneratedHtmlId({
    prefix: "headerUserPopover",
  });

  const [isOpen, setIsOpen] = useState(false);

  const onMenuButtonClick = (): void => {
    setIsOpen(!isOpen);
  };

  //thewse two lines grab the username so that it can be used throughout the page. Needs this because for some reason user can be undefined
  const currentUser = ApiManager.getCurrentUser();
  const nameString = currentUser.username ? currentUser.username : "Unknown User";

  const closeMenu = (): void => {
    setIsOpen(false);
  };

  const logoutFunction = (): void => {
    ApiManager.logout();
    ResetAllSlices();
    navigate("");
  };

  const adminFunction = (): void => {
    navigate("settings");
  };

  const button = (
    <EuiHeaderSectionItemButton
      aria-controls={headerUserPopoverId}
      aria-expanded={isOpen}
      aria-haspopup="true"
      aria-label="Account menu"
      data-testid="user-menu"
      onClick={onMenuButtonClick}
    >
      <EuiAvatar
        name={nameString}
        size="s"
      />
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
      <div
        data-testid="user-menu-content"
        style={{ width: 320 }}
      >
        <EuiFlexGroup
          gutterSize="m"
          className="euiHeaderProfile"
          responsive={false}
        >
          <EuiFlexItem grow={false}>
            <EuiAvatar
              name={nameString}
              size="xl"
            />
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiText>
              <p>{nameString}</p>
            </EuiText>
            <EuiSpacer size="m" />
            <EuiFlexGroup justifyContent="spaceBetween">
              <EuiFlexItem grow={false}>
                <EuiLink
                  onClick={adminFunction}
                  data-testid="root-settings"
                >
                  Settings
                </EuiLink>
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

const HeaderAppMenu = (): JSX.Element => {
  const headerAppPopoverId = useGeneratedHtmlId({ prefix: "headerAppPopover" });
  const headerAppKeyPadMenuId = useGeneratedHtmlId({
    prefix: "headerAppKeyPadMenu",
  });
  const [isOpen, setIsOpen] = useState(false);
  const onMenuButtonClick = (): void => {
    setIsOpen(!isOpen);
  };
  const closeMenu = (): void => {
    setIsOpen(false);
  };
  const button = (
    <EuiHeaderSectionItemButton
      aria-controls={headerAppKeyPadMenuId}
      aria-expanded={isOpen}
      aria-haspopup="true"
      aria-label="Apps menu with 1 new app"
      notification="1"
      data-testid="app-menu"
      onClick={onMenuButtonClick}
    >
      <EuiIcon
        type="apps"
        size="m"
      />
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
      <EuiKeyPadMenu
        data-testid="app-menu-content"
        id={headerAppKeyPadMenuId}
        style={{ width: 288 }}
      >
        <EuiKeyPadMenuItem label="Discover">
          <EuiIcon
            type="discoverApp"
            size="l"
          />
        </EuiKeyPadMenuItem>
        <EuiKeyPadMenuItem label="Dashboard">
          <EuiIcon
            type="dashboardApp"
            size="l"
          />
        </EuiKeyPadMenuItem>
        <EuiKeyPadMenuItem label="Dev Tools">
          <EuiIcon
            type="devToolsApp"
            size="l"
          />
        </EuiKeyPadMenuItem>
        <EuiKeyPadMenuItem label="Machine Learning">
          <EuiIcon
            type="machineLearningApp"
            size="l"
          />
        </EuiKeyPadMenuItem>
        <EuiKeyPadMenuItem label="Graph">
          <EuiIcon
            type="graphApp"
            size="l"
          />
        </EuiKeyPadMenuItem>
        <EuiKeyPadMenuItem label="Visualize">
          <EuiIcon
            type="visualizeApp"
            size="l"
          />
        </EuiKeyPadMenuItem>
        <EuiKeyPadMenuItem
          label="Timelion"
          betaBadgeLabel="Beta"
        >
          <EuiIcon
            type="timelionApp"
            size="l"
          />
        </EuiKeyPadMenuItem>
      </EuiKeyPadMenu>
    </EuiPopover>
  );
};
