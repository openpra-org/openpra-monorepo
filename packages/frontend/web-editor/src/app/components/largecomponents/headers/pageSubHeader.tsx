import {useEuiTheme, EuiHeaderSection, EuiPageHeader, EuiFlexGroup, EuiFlexItem, EuiText, EuiTitle } from "@elastic/eui";

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
        <EuiPageHeader id='mainHeader'>
            <EuiHeaderSection>
                {/**
                 * Margin top needed to have the message be in the center of the header while not randomly moving
                 * which was happening when using alignItems center
                 */}
                <EuiFlexGroup gutterSize="none">
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