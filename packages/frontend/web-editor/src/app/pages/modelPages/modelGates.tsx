import GatesTable from '../../components/tables/gatesTable';
import PageLayout from '../../components/stylingaids/pageLayout';

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