import GlobalParametersList from '../../components/largecomponents/lists/globalParametersList';
import PageLayout from '../../components/largecomponents/stylingaids/pageLayout';

export default function BasicEvents() {
    return (
        <> 
            <PageLayout isModel={true} pageName='Basic Events' contentType={
                <>
                    <GlobalParametersList/>
                </>
            }/>
        </>
    )
}