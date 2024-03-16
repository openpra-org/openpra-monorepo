import { Outlet, useLocation } from "react-router-dom";
import ApiManager from "shared-types/src/lib/api/ApiManager";
import { ReactElement, useEffect, useRef, useState } from "react";
import {
  EuiPage,
  EuiResizableContainer,
  // EuiPageSection,
  useIsWithinBreakpoints,
  // EuiButton,
  EuiButtonGroup,
} from "@elastic/eui";
import {RootHeader} from "../components/headers/rootHeader";
import PinnableScopedNav from "../components/sidenavs/PinnableScopedNav";
import HomeSideNav from "../components/sidenavs/HomeSideNav";

/**
 * A React functional component that renders the application layout with a header and outlet for nested routes.
 * It checks if the user is logged in and updates the login status at a regular interval.
 * If the user is not logged in and is on the root path, it renders only the outlet without the header.
 *
 * @returns {@link ReactElement} The component structure to be rendered.
 */
const RootContainer = (): ReactElement => {
  /**
   * State to track if the user is logged in.
   */
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(
    ApiManager.isLoggedIn(),
  );

  /**
   * A ref to store the token timer returned by the ApiManager.
   */
  const timer: React.MutableRefObject<number> = useRef(
    ApiManager.getTokenTimer(),
  );

  /**
   * The current location object, which represents where the app is now.
   */
  const location = useLocation();

  useEffect(() => {
    // toggle the menu to collapsed state
    isMobile && onChange("1");
    // Update login status and token timer on mount and when the pathname changes.
    setIsLoggedIn(ApiManager.isLoggedIn());

    // get the token time
    timer.current = ApiManager.getTokenTimer();

    // Set an interval to refresh the login status and token timer every 30 seconds.
    setInterval(() => {
      setIsLoggedIn(ApiManager.isLoggedIn());
      timer.current = ApiManager.getTokenTimer();
    }, 30000);

    // Clear the interval when the component unmounts or the dependency changes.
    return (): void => {
      if (timer.current) {
        clearInterval(timer.current);
      }
    };
  }, [location.pathname]);

  const isMobile = useIsWithinBreakpoints(["xs", "s"]);

  // Checks if the current page is one of the workspace pages
  const isHomePage: boolean =
    location.pathname === "/internal-events" ||
    location.pathname === "/internal-hazards" ||
    location.pathname === "/external-hazards" ||
    location.pathname === "/full-scope";

  const toggleButtons = [
    {
      id: "1",
      label: "Menu",
      iconType: "menu",
    },
  ];
  // eslint-disable-next-line @typescript-eslint/ban-types,@typescript-eslint/no-empty-function
  const collapseFn = useRef<Function>(() => {});

  const [toggleIdToSelectedMap, setToggleIdToSelectedMap] = useState<
    Record<string, boolean>
  >({});

  const onCollapse = (optionId: string) => {
    const newToggleIdToSelectedMap = {
      ...toggleIdToSelectedMap,
      [optionId]: !toggleIdToSelectedMap[optionId],
    };
    setToggleIdToSelectedMap(newToggleIdToSelectedMap);
  };

  const onChange = (optionId: string) => {
    onCollapse(optionId);
    collapseFn.current(`panel${optionId}`, optionId === "3" ? "right" : "left");
  };

  // Render only the outlet if not logged in and on the root path.
  if (!isLoggedIn && location.pathname === "/") {
    return <Outlet />;
  } else {
    // Render the header and the outlet when logged in or not on the root path.
    return (
      <EuiPage paddingSize={"none"}>
        {isMobile && (
          <EuiButtonGroup
            isFullWidth
            legend="Collapsible panels"
            options={toggleButtons}
            idToSelectedMap={toggleIdToSelectedMap}
            onChange={onChange}
            color="primary"
            type="multi"
            // isIconOnly
          />
        )}
        <EuiResizableContainer
          onToggleCollapsed={onCollapse}
          direction={isMobile ? "vertical" : "horizontal"}
        >
          {(EuiResizablePanel, EuiResizableButton, { togglePanel }) => {
            collapseFn.current = (
              id: string,
              direction: "left" | "right" = "left",
            ) => togglePanel?.(id, { direction });
            return (
              <>
                <EuiResizablePanel
                  id={"panel1"}
                  paddingSize={"none"}
                  initialSize={20}
                  minSize="20%"
                  mode={"collapsible"}
                >
                  {isHomePage ? <HomeSideNav /> : <PinnableScopedNav />}
                </EuiResizablePanel>

                {/*<EuiResizableButton alignIndicator={"start"} />*/}
                <EuiResizablePanel
                  id={"panel2"}
                  paddingSize={"none"}
                  initialSize={80}
                  mode={"main"}
                >
                  <RootHeader />
                  <Outlet />
                </EuiResizablePanel>
              </>
            );
          }}
        </EuiResizableContainer>
      </EuiPage>
    );
  }
};

export default RootContainer;
