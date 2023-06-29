import PageLayout from '../../components/largecomponents/stylingaids/pageLayout';
import { ModelPageFilter } from '../../components/largecomponents/headers/headers';

export default function EventTrees() {
    return (
        <> 
            <PageLayout isModel={true} pageName='Event Trees' contentType={
                <>
                    <ModelPageFilter title="Event Tree" page="model/1/eventtrees"/>
                    <div/>
                </>
            }/>
        </>
    )
}