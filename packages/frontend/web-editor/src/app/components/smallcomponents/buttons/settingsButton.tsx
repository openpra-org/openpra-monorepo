import {useEuiTheme, EuiButton, EuiButtonProps} from '@elastic/eui'

interface SettingsButtonProps extends EuiButtonProps {
    onClick?: React.MouseEventHandler
    styleOverrides?: React.CSSProperties
};

export default function SettingsButton(props: SettingsButtonProps) {

    const { onClick, styleOverrides, ...buttonProps} = props;

    const {euiTheme} = useEuiTheme();

    const settingsButtonStyle = {
        borderRadius: '5px', 
        backgroundColor: euiTheme.colors.mediumShade, 
        color: euiTheme.colors.darkestShade,
        ...styleOverrides
    }

    return(
        <EuiButton {...buttonProps} color='text' onClick={onClick} style={settingsButtonStyle} />
    )
}