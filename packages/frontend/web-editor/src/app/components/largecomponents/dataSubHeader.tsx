import { EuiFlexGroup, EuiFlexItem, EuiHeaderSection, EuiPageHeader, EuiText, EuiTitle, useEuiTheme } from "@elastic/eui";
import DataSidenav from "../smallcomponents/dataSidenav";


//different from the data subheader because it uses different text and sideNav, and I am unsure how to pass it a different type of nav bar
export function DataSubHeader() {
    const {euiTheme} = useEuiTheme();
    return (
        
        //Header for one of the types of pages
        //56 pixels is to match the nav bar so it looks seamless and doesnt move down
        //z index moves it to the front over pages
        <EuiPageHeader id='mainHeader' style={{zIndex: 1, maxHeight: "56px", background: euiTheme.colors.lightShade}}>
            <EuiHeaderSection>
                <DataSidenav></DataSidenav>
                {/**
                 * Margin top needed to have the message be in the center of the header while not randomly moving
                 * which was happening when using alignItems center
                 */}
                <EuiFlexGroup style={{marginTop: "12px", marginLeft: "10px", flexShrink: 0}} gutterSize="l">
                    <EuiFlexItem grow={false}>
                        <EuiTitle size="m" >
                            <EuiText>Data</EuiText>
                        </EuiTitle>
                    </EuiFlexItem>
                </EuiFlexGroup>
            </EuiHeaderSection>
        </EuiPageHeader>
    )
}