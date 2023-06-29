//this is all placeholder so that I can test hrefs and stuff

import {useEffect, useState} from 'react';
import { PageSubHeader } from '../headers/pageSubHeader'
import {PageHeader} from '../headers/headers'
import {EuiFlexGroup, EuiFlexItem} from '@elastic/eui'

//props that are passed, it takes both a string for the name of the page, and then an amount of content of react nodes
interface PageLayoutProps {
    isModel: boolean
    pageName: string;
    contentType: React.ReactNode;
}

export default function PageLayout({isModel, pageName, contentType}: PageLayoutProps) {

    //checks if the nav is open so we can dynamically change how much space is taken up by content when the nav bar is clicked
    const [isNavOpen, setIsNavOpen] = useState(false);

    //changes the page width
    const [pageWidth, setPageWidth] = useState(window.innerWidth);

    //this changes the page width when the page width is changed
    useEffect(() => {
        // Update the window size whenever the window is resized
        const handleResize = () => {
            setPageWidth(window.innerWidth)
        };

        window.addEventListener('resize', handleResize);

        // Clean up the event listener on component unmount
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    //boolean used to toggle the nav bar
    const handleNavToggle = (isOpen: boolean) => {
        setIsNavOpen(isOpen);
      };

    //this outputs a flexgroup in column style with the page header, then the modelSubHeader, then it takes
    //a group of content and puts it in another flex item that scales with wheteher the nav from the model sub header is open or not, so it all looks clean
    return (
        <> 
            <PageHeader />

            <EuiFlexGroup direction='column'>
                <EuiFlexItem grow={false}>
                {isModel ? (
                    <PageSubHeader isModel={true} isNavOpen={isNavOpen} onNavToggle={handleNavToggle} pageName={pageName} />
                ) : (
                    <PageSubHeader isModel={false} isNavOpen={isNavOpen} onNavToggle={handleNavToggle} pageName={pageName} />
                )}
                </EuiFlexItem>
                {/** This is here to make its width toggle based on whether the menu is down or not, the 335 roughly deals with the amount of space with the menu, and because
                 * this is uniform it should stay steady throughout. This section is where page specific content should go
                 * uses the content type
                 */}
                <EuiFlexItem grow={10} style={{ marginLeft: "auto", width: isNavOpen ? window.innerWidth : window.innerWidth - 335}}>
                    {contentType}
                </EuiFlexItem>
            </EuiFlexGroup>
        </>
    )
}