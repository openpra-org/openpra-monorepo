import {EuiFlexGroup, EuiIcon, EuiSideNav, EuiButton, htmlIdGenerator, useEuiTheme} from "@elastic/eui";
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

    //sets the collapsed state, and toggles the nav bar
    const [isCollapsed, setIsCollapsed] = useState(true);
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
                    name: <span style={color}>Overview</span>,
                    id: htmlIdGenerator('modelNav')(),
                    icon: <EuiIcon style={color} type="grid" />,
                },
                {
                    name: <span style={color}>Event Sequence</span>,
                    id: htmlIdGenerator('modelNav')(),
                    icon: <EuiIcon style={color} type="cluster" />,
                },
                {
                    name: <span style={color}>Fault Trees</span>,
                    id: htmlIdGenerator('modelNav')(),
                    icon: <EuiIcon style={color} type="logstashIf" />,
                },
                {
                    name: <span style={color}>Bayesian Network</span>,
                    id: htmlIdGenerator('modelNav')(),
                    icon: <EuiIcon style={color} type="cluster" />,
                },
                {
                    name: <span style={color}>Global Parameters</span>,
                    id: htmlIdGenerator('modelNav')(),
                    icon: <EuiIcon style={color} type="tableDensityExpanded" />,
                },
                {
                    name: <span style={color}>Quantification History</span>,
                    id: htmlIdGenerator('modelNav')(),
                    icon: <EuiIcon style={color} type="visBarVertical" />,
                },
                {
                    name: <span style={color}>Settings</span>,
                    id: htmlIdGenerator('modelNav')(),
                    icon: <EuiIcon style={color} type="gear" />,
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
        <EuiFlexGroup direction='column' style={{backgroundColor: euiTheme.colors.mediumShade, maxWidth: '220px'}}>
            <EuiSideNav
                items={navItems}
                style={{width: '220px', paddingLeft: '10px'}}
            />
        </EuiFlexGroup>
        )}
        {isCollapsed && (
                <EuiFlexGroup direction='column' style={{backgroundColor: euiTheme.colors.mediumShade, maxWidth: '54px'}}>
                    <EuiSideNav
                        items={navItems}
                        style={{width: '54px', paddingLeft: '10px'}}
                    />
                </EuiFlexGroup>
        )}
        </>
)
}