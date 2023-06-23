import PageLayout from '../../components/largecomponents/pageLayout';
import { ModelPageFilter } from '../../components/smallcomponents/headers';

export default function EventTrees() {
    return (
        <> 
            <PageLayout pageName='Event Trees' contentType={
                <>
                    <ModelPageFilter/>
                    <div/>
                </>
            }/>
        </>
    )
}