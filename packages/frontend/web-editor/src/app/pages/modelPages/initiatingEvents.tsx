//this is all placeholder so that I can test hrefs and stuff

import { useState } from 'react';
import { ModelSubHeader } from '../../components/largecomponents/modelSubHeader'
import {PageHeader, ModelPageFilter} from '../../components/smallcomponents/headers'
import {EuiFlexGroup, EuiFlexItem} from '@elastic/eui'

interface ModelSidenavProps {
    isNavOpen: boolean;
    onNavToggle: (isOpen: boolean) => void;
  }  

export default function InitiatingEvents() {
    const [isNavOpen, setIsNavOpen] = useState(false);

    const handleNavToggle = (isOpen: boolean) => {
        setIsNavOpen(isOpen);
      };

    return (
        <> 
            <PageHeader />

            <EuiFlexGroup direction='column'>
                <EuiFlexItem>
                    <ModelSubHeader isNavOpen={isNavOpen} onNavToggle={handleNavToggle} pageName='Initiating Events'/>
                </EuiFlexItem>
                {/** This is here to make its width toggle based on whether the menu is down or not, the 335 roughly deals with the amount of space with the menu, and because
                 * this is uniform it should stay steady throughout. This section is where page specific content should go
                 */}
                <EuiFlexItem grow={10} style={{ marginLeft: "auto", width: isNavOpen ? window.innerWidth : window.innerWidth - 335 }} >
                    <ModelPageFilter/>
                </EuiFlexItem>
            </EuiFlexGroup>
        </>
    )
}