import PageLayout from '../../components/largecomponents/pageLayout';
import { ModelPageFilter } from '../../components/smallcomponents/headers';

//passes in the model page filer and then the list of the objects to display
export default function BayesianNetworks() {
    return (
        <> 
            <PageLayout isModel={true} pageName='Bayesian Networks' contentType={
                <>
                    <ModelPageFilter/>
                    <div/>
                </>
            }/>
        </>
    )
}