import ModelItem from "./listitems/ModelItem";
import { EuiFlexGroup, EuiFlexItem, EuiSpacer } from "@elastic/eui";


export function Models(): JSX.Element {
    return (
      <>
        <EuiFlexGroup gutterSize="s">
          <EuiSpacer size="s" />
            <EuiFlexItem grow={true}>
              <EuiSpacer size="xs" />
              <ModelItem title="Title1" description="description" />
              <ModelItem title="Title1" description="description" />
              <ModelItem title="Title1" description="description" />
            </EuiFlexItem>
          <EuiSpacer size="s" />
        </EuiFlexGroup>
      </>
    )
}
