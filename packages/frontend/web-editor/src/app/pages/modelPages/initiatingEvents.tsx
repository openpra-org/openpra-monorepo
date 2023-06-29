import PageLayout from '../../components/largecomponents/stylingaids/pageLayout';
import { ModelPageFilter } from '../../components/largecomponents/headers/headers';

export default function InitiatingEvents() {
    return (
        <> 
            <PageLayout isModel={true} pageName='Initiating Events' contentType={
                <>
                <ModelPageFilter title="Initiating Event" page="model/1/initiatingevents" />
                <div/>
                </>
            }/>
        </>
    )
}