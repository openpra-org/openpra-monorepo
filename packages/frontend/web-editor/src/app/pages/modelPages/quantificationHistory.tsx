import PageLayout from '../../components/largecomponents/pageLayout';
import { ModelPageFilter } from '../../components/smallcomponents/headers';

export default function QuantificationHistory() {
    return (
        <> 
            <PageLayout pageName='Quantification History' contentType={
                <>
                    <ModelPageFilter/>
                    <div/>
                </>
            }/>
        </>
    )
}