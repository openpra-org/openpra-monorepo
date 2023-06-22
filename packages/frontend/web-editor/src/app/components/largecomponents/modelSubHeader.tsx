import { EuiButton, EuiContextMenuPanel, EuiFieldSearch, useEuiTheme, EuiHeaderSection, EuiPageHeader, EuiPopover, EuiTextColor, EuiFlexGroup, EuiFlexItem } from "@elastic/eui";
import ModelSidenav from "../smallcomponents/modelSidenav";


export function ModelSubHeader() {
    
    const {euiTheme} = useEuiTheme();

    return (
        
        //general main header, not the filter header
        <EuiPageHeader id='mainHeader' css={{background: euiTheme.colors.lightestShade}}>
            <EuiHeaderSection>
                <EuiFlexGroup>
                    <EuiFlexItem>
                        <ModelSidenav></ModelSidenav>
                    </EuiFlexItem>
                </EuiFlexGroup>
            </EuiHeaderSection>
        </EuiPageHeader>
    )
}