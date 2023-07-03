import PageLayout from '../../components/largecomponents/stylingaids/pageLayout';
import { ModelPageFilter } from '../../components/largecomponents/headers/headers';
import BayesianList from '../../components/largecomponents/lists/bayesianList';

//passes in the model page filer and then the list of the objects to display
export default function BayesianNetworks() {
    return (
        <> 
            <PageLayout isModel={true} pageName='Bayesian Networks' contentType={
                <>
                    <ModelPageFilter title="Bayesian Network" page="model/1/bayesiannetworks" />
                    <BayesianList/>
                </>
            }/>
        </>
    )
}