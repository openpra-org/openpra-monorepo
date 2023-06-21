import {EuiFlexGroup, EuiIcon, EuiSideNav, htmlIdGenerator, useEuiTheme} from "@elastic/eui";
import {useState} from 'react'

export default function dataSidenav() {
    const {euiTheme} = useEuiTheme();

    //this is to color the side nav bar consistently, we have to do this elastic ui hates colors, and doesnt like letting anything be
    //the dynamic light and darkmode shades that are super nice to use

    const darkShade = euiTheme.colors.darkShade
    //sets the collapsed state, and toggles the nav bar
    const [isCollapsed, setIsCollapsed] = useState(false);
    const toggleNav= () => {
        setIsCollapsed(!isCollapsed);
    }
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
}