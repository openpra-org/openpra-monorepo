import ModelOptionsMenu from '../../components/largecomponents/stylingaids/modelOptionsMenu';
import PageLayout from '../../components/largecomponents/stylingaids/pageLayout';

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