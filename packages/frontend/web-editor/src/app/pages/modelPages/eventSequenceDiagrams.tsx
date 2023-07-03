import PageLayout from '../../components/largecomponents/stylingaids/pageLayout';
import { ModelPageFilter } from '../../components/largecomponents/headers/headers';
import EventSequenceList from '../../components/largecomponents/lists/eventSequenceList';

export default function EventSequenceDiagrams() {
    return (
        <> 
            <PageLayout isModel={true} pageName='Event Sequence Diagrams' contentType={
                <>
                    <ModelPageFilter title="Event Sequence Diagram" page="model/1/eventsequencediagrams"/>
                    <EventSequenceList/>
                </>
            }/>
        </>
    )
}