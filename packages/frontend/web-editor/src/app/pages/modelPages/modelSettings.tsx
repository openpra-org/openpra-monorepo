import ModelOptionsMenu from '../../components/largecomponents/modelOptionsMenu';
import PageLayout from '../../components/largecomponents/pageLayout';

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