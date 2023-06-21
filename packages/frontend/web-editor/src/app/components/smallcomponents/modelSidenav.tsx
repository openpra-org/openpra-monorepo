import {EuiFlexGroup, EuiIcon, EuiSideNav, htmlIdGenerator, useEuiTheme} from "@elastic/eui";
import {useState} from 'react'

export default function Sidenav() {

    //uses the theme as always
    const {euiTheme} = useEuiTheme();

    //this is to color the side nav bar consistently, we have to do this elastic ui hates colors, and doesnt like letting anything be 
    //the dynamic light and darkmode shades that are super nice to use
    const color = {
        color: euiTheme.colors.darkestShade,
        marginTop: '10px',
        marginBottom: '10px',
        marginLeft: '10px'
    };

    const colorInactive = {
        color: euiTheme.colors.darkShade,
        marginTop: '10px',
        marginBottom: '10px',
        marginLeft: '10px'
    };

    //sets the collapsed state, and toggles the nav bar
    const [isCollapsed, setIsCollapsed] = useState(false);
    const toggleNav= () => {
        setIsCollapsed(!isCollapsed);
    }

    //list of the navigation icons, each will have thier own icon, text, and eventually onclick to display the correct type of content
    const navItems = [
        {
            name: '',
            id: htmlIdGenerator('modelNav')(),
            items: [
                {
                    name:  <span style={color}>Collapse</span>,
                    id: htmlIdGenerator('modelNav')(),
                    icon: <EuiIcon style={color} type="arrowDown" />,
                    onClick: toggleNav
                },
                {
                    name: <span style={colorInactive}>Open State Analysis</span>,
                    id: htmlIdGenerator('modelNav')(),
                },
                {
                    name: <span style={color}>Initiating Event Analysis</span>,
                    id: htmlIdGenerator('modelNav')(),
                    items: [
                        {
                            name: <span style={color}>Initiating Events</span>,
                            id: htmlIdGenerator('modelNav')(),
                            icon: <EuiIcon style={color} type="cluster" />,
                            href: '/model/1/bayesianNetworks'
                        },
                    ]
                },
                {
                    name: <span style={color}>Event Sequence Analysis</span>,
                    id: htmlIdGenerator('modelNav')(),
                    items: [
                        {
                            name: <span style={color}>Event Sequence Diagrams</span>,
                            id: htmlIdGenerator('modelNav')(),
                            icon: <EuiIcon style={color} type="cluster" />,
                            href: '/model/1/eventSequenceDiagrams'
                        },
                        {
                            name: <span style={color}>Event Trees</span>,
                            id: htmlIdGenerator('modelNav')(),
                            icon: <EuiIcon style={color} type="cluster" />,
                            href: '/model/1/eventSequence'
                        },
                    ]
                },
                {
                    name: <span style={color}>Systems Analysis</span>,
                    id: htmlIdGenerator('modelNav')(),
                    items: [
                        {
                            name: <span style={color}>Fault Trees</span>,
                            id: htmlIdGenerator('modelNav')(),
                            icon: <EuiIcon style={color} type="logstashIf" />,
                            href: '/model/1/faultTrees'
                        },
                        {
                            name: <span style={color}>Bayesian Network</span>,
                            id: htmlIdGenerator('modelNav')(),
                            icon: <EuiIcon style={color} type="cluster" />,
                            href: '/model/1/bayesianNetworks'
                        },
                    ]
                },
                {
                    name: <span style={colorInactive}>Human Realiability Analysis</span>,
                    id: htmlIdGenerator('modelNav')(),
                },
                {
                    name: <span style={color}>Data Analysis</span>,
                    id: htmlIdGenerator('modelNav')(),
                    items: [
                        {
                            name: <span style={color}>Gates</span>,
                            id: htmlIdGenerator('modelNav')(),
                            icon: <EuiIcon style={color} type="grid" />,
                            href: '/model/1/faultTrees'
                        },
                        {
                            name: <span style={color}>Basic Events</span>,
                            id: htmlIdGenerator('modelNav')(),
                            icon: <EuiIcon style={color} type="visBarVertical" />,
                            href: '/model/1/bayesianNetworks'
                        },
                        {
                            name: <span style={colorInactive}>CCF Groups</span>,
                            id: htmlIdGenerator('modelNav')(),
                            icon: <EuiIcon style={colorInactive} type="visBarVertical" />,
                        },
                    ]
                },
                {
                    name: <span style={colorInactive}>Event Sequence Qualification</span>,
                    id: htmlIdGenerator('modelNav')(),
                },
                {
                    name: <span style={colorInactive}>Consequence Analysis</span>,
                    id: htmlIdGenerator('modelNav')(),
                },
                {
                    name: <span style={colorInactive}>Risk Integration</span>,
                    id: htmlIdGenerator('modelNav')(),
                },
                {
                    name: <span style={color}>Overview</span>,
                    id: htmlIdGenerator('modelNav')(),
                    icon: <EuiIcon style={color} type="grid" />,
                    href: '/model/1/overview'
                },
                {
                    name: <span style={color}>Global Parameters</span>,
                    id: htmlIdGenerator('modelNav')(),
                    icon: <EuiIcon style={color} type="tableDensityExpanded" />,
                    href: '/model/1/globalParameters'
                },
                {
                    name: <span style={color}>Quantification History</span>,
                    id: htmlIdGenerator('modelNav')(),
                    icon: <EuiIcon style={color} type="visBarVertical" />,
                    href: '/model/1/quantificationHistory'
                },
                {
                    name: <span style={color}>Settings</span>,
                    id: htmlIdGenerator('modelNav')(),
                    icon: <EuiIcon style={color} type="gear" />,
                    href: '/model/1/settings'
                }
            ],
        },
    ];
    return (
        //this structure is surrounded by an isCollapsed to see if the menu is collapsed or not, and adjusts some of the css accordingly
        //if we want to go back there is probably a way to set these dynamically, but they use the same objects so it should be okay to do it like this
        //weird pixel measures can be subject to change, but in general should look fine and there isnt any alternative besides css, even in their own design
        //they used css to adjust the width in the documentation
        <>
        {!isCollapsed && (
        <EuiFlexGroup direction='column' style={{backgroundColor: euiTheme.colors.lightShade, maxWidth: '250px'}}>
            <EuiSideNav
                items={navItems}
            />
        </EuiFlexGroup>
        )}
        {isCollapsed && (
                <EuiFlexGroup direction='column' style={{backgroundColor: euiTheme.colors.lightShade, maxWidth: '50px'}}>
                    <EuiSideNav
                        items={navItems}
                        style={{width: '50px'}}
                    />
                </EuiFlexGroup>
        )}
        </>
)
}