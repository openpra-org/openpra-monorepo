import {useEuiTheme, EuiButton, EuiButtonProps} from '@elastic/eui'

//takes in an onclick because it didnt like me sennding it innately
//and also style overrides so that we can set any style we want to
interface SettingsButtonProps extends EuiButtonProps {
    onClick?: React.MouseEventHandler
    styleOverrides?: React.CSSProperties
};

export default function SettingsButton(props: SettingsButtonProps) {

    //list of props passed
    const { onClick, styleOverrides, ...buttonProps} = props;

    //uses theme to grab the color we want
    const {euiTheme} = useEuiTheme();

    //sets the settings button style to what we want when we reuse it, this could even be used as a standard button to be honest
    const settingsButtonStyle = {
        borderRadius: '5px', 
        backgroundColor: euiTheme.colors.mediumShade, 
        color: euiTheme.colors.darkestShade,
        ...styleOverrides
    }

    //just returns an eui button with our styling
    return(
        <EuiButton {...buttonProps} color='text' onClick={onClick} style={settingsButtonStyle} />
    )
}