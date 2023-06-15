import ModelItem from "./listitems/ModelItem";
import ModelItemsList from "./largecomponents/ModelItemsList";
import {EuiFlexGroup, EuiFlexItem, EuiSpacer } from "@elastic/eui";


export function Models(): JSX.Element {
  return (
    <>
    {/** this is a EuiFlexGroup with a gutter to provide some space between objects, and it is surrounded by spacers as well
     * there are spacers location in the model items as well
     */}
      <EuiFlexGroup gutterSize="s">
        <EuiSpacer size="s" />
          <EuiFlexItem grow={true}>
            <EuiSpacer size="xs" />
            <ModelItemsList/>
            {/**<ModelItem title="title1" description="desc1"/>
            <ModelItem title="title1" description="desc1"/>
            <ModelItem title="title1" description="desc1"/>*/}
          </EuiFlexItem>
        <EuiSpacer size="s" />
      </EuiFlexGroup>
    </>
  )
}
