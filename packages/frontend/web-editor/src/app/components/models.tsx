import '../../styles.css'
import '../app.module.css'
import ModelItem from "./listitems/ModelItem";

export function Models(): JSX.Element {
    return (
      <>
        <ModelItem title="Title1" description="description" />
        <ModelItem title="Title1" description="description" />
        <ModelItem title="Title1" description="description" />
      </>
    )
}
