import PageLayout from '../../components/largecomponents/pageLayout';
import { ModelPageFilter } from '../../components/smallcomponents/headers';

export default function FaultTrees() {
    return (
        <> 
            <PageLayout pageName='Fault Trees' contentType={
                <>
                    <ModelPageFilter/>
                    <div/>
                </>
            }/>
        </>
    )
}