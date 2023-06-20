import {EuiFlexGroup, EuiIcon, EuiSideNav, EuiButton, htmlIdGenerator, useEuiTheme} from "@elastic/eui";
import {useState} from 'react'

export default function Sidenav() {
    const {euiTheme} = useEuiTheme();

    const color = {
        color: euiTheme.colors.darkestShade,
        marginTop: '10px',
        marginBottom: '10px',
        marginLeft: '10px'
    };

    const [isCollapsed, setIsCollapsed] = useState(true);
    const toggleNav= () => {
        setIsCollapsed(!isCollapsed);
    }

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
        <>
        {!isCollapsed && (
        <EuiFlexGroup direction='column' style={{backgroundColor: euiTheme.colors.mediumShade, maxWidth: '220px'}}>
            <EuiSideNav
                items={navItems}
                style={{width: '220px', paddingLeft: '10px'}}
                isOpenOnMobile={!isCollapsed}
            />
        </EuiFlexGroup>
        )}
            {isCollapsed && (
                //<EuiButton iconType='arrowRight' style={{backgroundColor: euiTheme.colors.lightShade, width: '50px'}} onClick={toggleNav} />
                <EuiFlexGroup direction='column' style={{backgroundColor: euiTheme.colors.mediumShade, maxWidth: '54px'}}>
                    <EuiSideNav
                        items={navItems}
                        style={{width: '54px', paddingLeft: '10px'}}
                        isOpenOnMobile={!isCollapsed}
                    />
                </EuiFlexGroup>
            )}
        </>
)
}