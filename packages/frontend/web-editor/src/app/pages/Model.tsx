import { Outlet, useLoaderData, useRouteLoaderData } from "react-router-dom";
import { ModelProps } from "./ModelsPage";

import React, { ReactElement } from 'react';
import {
  EuiText,
  EuiPageTemplate,
  EuiPageTemplateProps,
  EuiPageHeaderProps,
  EuiPageSidebarProps,
} from '@elastic/eui';

export default () => {
  return (
    <EuiPageTemplate
    >
      <EuiPageTemplate.Sidebar>
        sidebar stuff
      </EuiPageTemplate.Sidebar>
      <EuiPageTemplate.Section grow={false} bottomBorder>
        <EuiText textAlign="center">
          <strong>
            Stack EuiPageTemplate sections and headers to create your custom
            content order.
          </strong>
        </EuiText>
        <Outlet />
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
};
