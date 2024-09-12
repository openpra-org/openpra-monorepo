import React, { ReactElement } from "react";
import { EuiLink, EuiText, EuiTitle } from "@elastic/eui";
import { AuthCard } from "../auth/AuthCard";
import { VerticalAlign } from "../layout/VerticalAlign";
import { ResponsiveSplitPanel } from "../layout/ResponsiveSplitPanel";

/**
 * Represents the landing page component of the application.
 * This component is responsible for rendering the main view that users see upon visiting the application.
 * It utilizes various components to lay out the page including `VerticalAlign` for vertical alignment,
 * `ResponsiveSplitPanel` for responsive layout, `EuiText`, `EuiTitle`, and `EuiLink` from Elastic UI for text and link
 * styling, and `AuthCard` for authentication related actions.
 *
 * @returns - ReactElement The React element for the landing page.
 */
const LandingPage = (): ReactElement => {
  return (
    <VerticalAlign>
      <ResponsiveSplitPanel
        contentLeft={<EuiText></EuiText>}
        hideLeftForSizes={["xs", "s"]}
        contentRight={<AuthCard />}
        footer={
          <>
            <EuiTitle size="xxs">
              <span>Want to learn more?</span>
            </EuiTitle>{" "}
            <EuiLink
              href="https://docs.openpra.org"
              target="_blank"
            >
              Read the docs
            </EuiLink>
          </>
        }
      />
    </VerticalAlign>
  );
};

export { LandingPage };
