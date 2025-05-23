import { EuiPageTemplate, EuiSkeletonRectangle } from "@elastic/eui";

import { InitiatingEventModelViewTable } from "../../components/tables/initiatingEventModelViewTable";

const InitiatingEventModelView = (): JSX.Element => {
  return (
    <EuiPageTemplate
      panelled={false}
      offset={48}
      grow
      restrictWidth
    >
      <EuiPageTemplate.Section>
        <EuiSkeletonRectangle
          width="100%"
          height={490}
          borderRadius="m"
          isLoading={false}
          contentAriaLabel="Example description"
        >
          <InitiatingEventModelViewTable />
        </EuiSkeletonRectangle>
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
};

export { InitiatingEventModelView };
