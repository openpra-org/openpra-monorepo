import BasicEventsTable from '../../components/tables/basicEventsTable';
import PageLayout from '../../components/stylingaids/pageLayout';
import ListlessPageTitleHeader from '../../components/headers/listlessPageTitleHeader';
import { EuiSpacer } from '@elastic/eui';

//documenting how this works here, basically it just uses pagelayout and passes it content, so go there for more!
export default function BasicEvents() {
    return (
        <> 
            <ListlessPageTitleHeader title="Basic Events" icon="editorBold"/>
            <EuiSpacer></EuiSpacer>
            <BasicEventsTable/>
        </>
    )
}