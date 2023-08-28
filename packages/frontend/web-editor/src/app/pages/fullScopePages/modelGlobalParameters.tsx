import GlobalParametersList from "../../components/lists/globalParametersList";
import TemplatedPageHeader from "../../components/headers/TemplatedPageHeader";
import { CreateBayesianNetworkButton } from "../../components/buttons/CreateItemButton";
import GenericItemList from "../../components/lists/GenericItemList";
import TemplatedPageBody from "../../components/headers/TemplatedPageBody";
export default function BasicEvents() {
    return (
      <TemplatedPageBody
        headerProps={{
          pageTitle: "Global Parameters",
          iconType: "beta",
        }}>
        <GlobalParametersList/>
      </TemplatedPageBody>
    )
}
