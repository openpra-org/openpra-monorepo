import { EuiButton, EuiPageTemplate } from "@elastic/eui";
import ModelList from "../components/lists/ModelList";
import { Link } from "react-router-dom";
export default function ModelsPage() {
    return (
        <>
            <EuiPageTemplate.Header
              restrictWidth
              pageTitle="Models"
              responsive={false}
              bottomBorder={true}
              iconType="logoKibana"
              rightSideItems={[
                <Link to="/models/new">
                  <EuiButton fill>Create</EuiButton>
                </Link>
              ]}
            />
            <EuiPageTemplate.Section restrictWidth>
              <ModelList/>
            </EuiPageTemplate.Section>
       </>
    )
}
