import {useEuiTheme, EuiHeaderSection, EuiPageHeader, EuiFlexGroup, EuiFlexItem, EuiText, EuiTitle } from "@elastic/eui";
import ModelSidenav from "../smallcomponents/modelSidenav";
import {ModelItemProps} from "../listitems/modelItem";

export interface PageNameProps {
    pageName: string
}

export function ModelSubHeader(props: PageNameProps) {
    const { pageName } = props;
    
    const {euiTheme} = useEuiTheme();

    return (
        
        //Header for one of the types of pages
        //56 pixels is to match the nav bar so it looks seamless and doesnt move down
        //z index makes it pop over other items!
        <EuiPageHeader id='mainHeader' style={{zIndex: 1, maxHeight: "56px", background: euiTheme.colors.lightShade}}>
            <EuiHeaderSection>
                <ModelSidenav></ModelSidenav>
                {/**
                 * Margin top needed to have the message be in the center of the header while not randomly moving
                 * which was happening when using alignItems center
                 */}
                <EuiFlexGroup style={{marginTop: "12px", marginLeft: "10px", flexShrink: 0}} gutterSize="l">
                    <EuiFlexItem grow={false}>
                        <EuiTitle size="m" >
                            <EuiText>[Model Name]: {pageName}</EuiText>
                        </EuiTitle>
                    </EuiFlexItem>
                </EuiFlexGroup>
            </EuiHeaderSection>
        </EuiPageHeader>
    )
}