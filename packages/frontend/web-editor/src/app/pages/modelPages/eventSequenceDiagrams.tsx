import PageLayout from '../../components/largecomponents/pageLayout';
import { ModelPageFilter } from '../../components/smallcomponents/headers';

export default function EventSequenceDiagrams() {
    return (
        <> 
            <PageLayout isModel={true} pageName='Event Sequence Diagrams' contentType={
                <>
                    <ModelPageFilter title="Event Sequence Diagram" page="model/1/eventsequencediagrams"/>
                    <div/>
                </>
            }/>
        </>
    )
}