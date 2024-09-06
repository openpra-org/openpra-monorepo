import React, { ReactElement } from "react";
import { EuiLink, EuiText, EuiTitle } from "@elastic/eui";
import { AuthCard } from "../auth/AuthCard";
import { VerticalAlign } from "../layout/VerticalAlign";
import { ResponsiveSplitPanel } from "../layout/ResponsiveSplitPanel";

const LandingPage = (): ReactElement => {
  return (
    <VerticalAlign>
      <ResponsiveSplitPanel
        contentLeft={<EuiText>Left Content</EuiText>}
        hideLeftForSizes={["xs", "s"]}
        contentRight={<AuthCard />}
        footer={
          <>
            <EuiTitle size="xxs">
              <span>Want to learn more?</span>
            </EuiTitle>{" "}
            <EuiLink
              href="#"
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
