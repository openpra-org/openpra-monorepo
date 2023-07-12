//this is all placeholder so that I can test hrefs and stuff

import {useEffect, useState} from 'react';
import {EuiPageTemplate, EuiSpacer, EuiTitle, useEuiTheme} from '@elastic/eui'

//props that are passed, it takes both a string for the name of the page, and then an amount of content of react nodes
interface PageLayoutProps {
    isModel: boolean
    pageName: string;
    contentType: React.ReactNode;
}

export default function PageLayout({isModel, pageName, contentType}: PageLayoutProps) {

    const { euiTheme } = useEuiTheme();

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

    //Now we use a page template in eui to help make things cleaner and give the sidebar the much needed dropshadow
    return (
        <>
        {/** putting the page header at top to keep it on the top */}

            {/** section for displaying the pagename */}
            <EuiPageTemplate.Section
            restrictWidth={true}
            alignment='top'
            paddingSize='xs'
            grow={false}
            bottomBorder={true}
            >
                <EuiTitle size="l">
                    <h1>{pageName}</h1>
                </EuiTitle>
            </EuiPageTemplate.Section>
            {/** spacer to improve the flow */}
            <EuiSpacer></EuiSpacer>
            <EuiPageTemplate.Section
            restrictWidth={true}
            alignment='top'
            paddingSize='none'
            >
                {contentType}
            </EuiPageTemplate.Section>
        </>
    )
}
