import ModelItem from "./listitems/ModelItem";
import { EuiSpacer } from "@elastic/eui";


export function Models(): JSX.Element {
    return (
      <>
        <EuiSpacer size="s" />
        <ModelItem title="Title1" description="description" />
        <ModelItem title="Title1" description="description" />
        <ModelItem title="Title1" description="description" />
      </>
    )
}
