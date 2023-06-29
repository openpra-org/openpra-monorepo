import {useEuiTheme, EuiHeaderSection, EuiPageHeader, EuiFlexGroup, EuiFlexItem, EuiText, EuiTitle } from "@elastic/eui";
import ModelSidenav from "../../smallcomponents/sidenavs/modelSidenav";
import DataSidenav from "../../smallcomponents/sidenavs/dataSidenav";

interface IntermediateComponentProps {
    isModel: boolean;
    isNavOpen: boolean;
    pageName: string;
    onNavToggle: (isOpen: boolean) => void;
  }

export function PageSubHeader({ isModel, pageName, isNavOpen, onNavToggle }: IntermediateComponentProps) {
    
    const {euiTheme} = useEuiTheme();

    return (
        
        //Header for one of the types of pages
        //56 pixels is to match the nav bar so it looks seamless and doesnt move down
        //z index makes it pop over other items!
        <EuiPageHeader id='mainHeader' style={{maxHeight: "56px", background: euiTheme.colors.lightShade}}>
            <EuiHeaderSection>
                {isModel ? (
                    <ModelSidenav isNavOpen={isNavOpen} onNavToggle={onNavToggle} ></ModelSidenav>
                ) : (
                    <DataSidenav isNavOpen={isNavOpen} onNavToggle={onNavToggle} ></DataSidenav>
                )}
                {/**
                 * Margin top needed to have the message be in the center of the header while not randomly moving
                 * which was happening when using alignItems center
                 */}
                <EuiFlexGroup style={{marginTop: "12px", marginLeft: "10px", flexShrink: 0}} gutterSize="none">
                    <EuiFlexItem grow={false}>
                        <EuiTitle size="m" >
                            {isModel ? (
                                <EuiText>[Model Name]: {pageName}</EuiText>
                            ) : (
                                <EuiText> Data: {pageName}</EuiText>
                            )}
                            
                        </EuiTitle>
                    </EuiFlexItem>
                </EuiFlexGroup>
            </EuiHeaderSection>
        </EuiPageHeader>
    )
}