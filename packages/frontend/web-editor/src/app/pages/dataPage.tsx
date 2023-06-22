import { EuiCollapsibleNav, EuiCollapsibleNavGroup, EuiIcon, EuiListGroup } from '@elastic/eui';
import {PageHeader} from "../components/smallcomponents/headers";
import DataSidenav from "../components/smallcomponents/dataSidenav";
import { DataSubHeader } from '../components/largecomponents/dataSubHeader';

export default function DataPage() {
  return (
      <>
        <PageHeader />
        <DataSubHeader />
      </>
  )
}
