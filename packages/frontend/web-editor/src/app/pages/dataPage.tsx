import { EuiCollapsibleNav, EuiCollapsibleNavGroup, EuiIcon, EuiListGroup } from '@elastic/eui';
import {PageHeader} from "../components/smallcomponents/headers";
import DataSidenav from "../components/smallcomponents/dataSidenav";

export default function DataPage() {
  return (
      <>
        <PageHeader />
        <DataSidenav />
      </>
  )
}
