import { EuiPageTemplate, EuiSkeletonRectangle } from "@elastic/eui";
import { MechanisticSourceTermModelViewTable } from "../../components/tables/mechanisticSourceTermModelViewTable";

function MechanisticSourceTermModelView(): JSX.Element {
  return (
    <EuiPageTemplate
      panelled={false}
      offset={48}
      grow={true}
      restrictWidth={true}
    >
      <EuiPageTemplate.Section>
        <EuiSkeletonRectangle
          width="100%"
          height={490}
          borderRadius="m"
          isLoading={false}
          contentAriaLabel="Example description"
        >
          <MechanisticSourceTermModelViewTable />
        </EuiSkeletonRectangle>
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}

export { MechanisticSourceTermModelView };
