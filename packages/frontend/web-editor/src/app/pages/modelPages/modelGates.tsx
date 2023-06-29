import GatesTable from '../../components/largecomponents/tables/gatesTable';
import PageLayout from '../../components/largecomponents/stylingaids/pageLayout';

export default function ModelGates() {
    return (
        <> 
            <PageLayout isModel={true} pageName='Model Gates' contentType={
                <>
                    <GatesTable/>
                    <div/>
                </>
            }/>
        </>
    )
}