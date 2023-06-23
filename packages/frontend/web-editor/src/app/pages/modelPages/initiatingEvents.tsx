import PageLayout from '../../components/largecomponents/pageLayout';
import { ModelPageFilter } from '../../components/smallcomponents/headers';

export default function InitiatingEvents() {
    return (
        <> 
            <PageLayout isModel={true} pageName='Initiating Events' contentType={
                <>
                <ModelPageFilter/>
                <div/>
                </>
            }/>
        </>
    )
}