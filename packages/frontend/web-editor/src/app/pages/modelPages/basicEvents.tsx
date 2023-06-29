import BasicEventsTable from '../../components/largecomponents/tables/basicEventsTable';
import PageLayout from '../../components/largecomponents/stylingaids/pageLayout';

//documenting how this works here, basically it just uses pagelayout and passes it content, so go there for more!
export default function BasicEvents() {
    return (
        <> 
            <PageLayout isModel={true} pageName='Basic Events' contentType={
            <>
                <BasicEventsTable/>
                <div/>
            </>
            }/>
        </>
    )
}