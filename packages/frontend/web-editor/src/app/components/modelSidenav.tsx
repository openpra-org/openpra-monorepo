import {EuiFlexGroup, EuiIcon, EuiSideNav, htmlIdGenerator, useEuiTheme} from "@elastic/eui";

export default function Sidenav() {
    const {euiTheme} = useEuiTheme();

    const color = {
        color: euiTheme.colors.darkestShade,
    };

    const navItems = [
        {
            name: '',
            id: htmlIdGenerator('modelNav')(),
            items: [
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
        <EuiFlexGroup>
            <EuiSideNav
                items={navItems}
                style={{backgroundColor: euiTheme.colors.mediumShade, width: '220px', paddingLeft: '20px'}}
            />
        </EuiFlexGroup>
    )
}