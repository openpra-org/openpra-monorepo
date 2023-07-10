import PageLayout from '../../components/largecomponents/stylingaids/pageLayout';
import { ModelPageFilter } from '../../components/largecomponents/headers/headers';
import FaultTreeList from '../../components/largecomponents/lists/faultTreeList';

export default function FaultTrees() {
    return (
        <>
            <PageLayout isModel={true} pageName='Fault Trees' contentType={
                <>
                    <ModelPageFilter title="Fault Tree" page="model/1/faulttrees"/>
                    {/*<FaultTreeList/>*/}
                    <div/>
                </>
            }/>
        </>
    )
}
