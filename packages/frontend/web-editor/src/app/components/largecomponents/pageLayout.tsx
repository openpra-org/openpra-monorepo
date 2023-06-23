//this is all placeholder so that I can test hrefs and stuff

import { useState } from 'react';
import { ModelSubHeader } from '../../components/largecomponents/modelSubHeader'
import {PageHeader, ModelPageFilter} from '../../components/smallcomponents/headers'
import {EuiFlexGroup, EuiFlexItem} from '@elastic/eui'

interface ModelSidenavProps {
    isNavOpen: boolean;
    onNavToggle: (isOpen: boolean) => void;
  }  

export default function EventSequenceDiagrams() {
    const [isNavOpen, setIsNavOpen] = useState(false);

    const handleNavToggle = (isOpen: boolean) => {
        setIsNavOpen(isOpen);
      };

    return (
        <> 
            <PageHeader />

            <EuiFlexGroup direction='column'>
                <EuiFlexItem>
                    <ModelSubHeader isNavOpen={isNavOpen} onNavToggle={handleNavToggle} pageName='Event Sequence Diagrams'/>
                </EuiFlexItem>
                <EuiFlexItem grow={10} style={{ width: isNavOpen ? '200px' : '1000px' }} >
                    <ModelPageFilter/>
                </EuiFlexItem>
            </EuiFlexGroup>
        </>
    )
}