import ModelOptionsMenu from '../../components/stylingaids/modelOptionsMenu';
import PageLayout from '../../components/stylingaids/pageLayout';

export default function ModelSettings() {
    return (
        <> 
            <PageLayout isModel={true} pageName='Model Settings' contentType={
                <>
                <ModelOptionsMenu/>
                </>
            }/>
        </>
    )
}