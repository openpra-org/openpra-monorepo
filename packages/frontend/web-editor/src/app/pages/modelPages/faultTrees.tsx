import PageLayout from '../../components/largecomponents/pageLayout';
import { ModelPageFilter } from '../../components/smallcomponents/headers';

export default function FaultTrees() {
    return (
        <> 
            <PageLayout isModel={true} pageName='Fault Trees' contentType={
                <>
                    <ModelPageFilter title="Fault Tree" page="model/1/faulttrees"/>
                    <div/>
                </>
            }/>
        </>
    )
}