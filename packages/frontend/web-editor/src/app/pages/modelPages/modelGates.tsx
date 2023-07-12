import GatesTable from '../../components/tables/gatesTable';
import ListlessPageTitleHeader from '../../components/headers/listlessPageTitleHeader';

export default function ModelGates() {
    return (
        <> 
            <ListlessPageTitleHeader title="Gates" icon="tokenRepo"/>
            <GatesTable/>
        </>
    )
}