import {useEuiTheme, EuiButton, EuiButtonProps} from '@elastic/eui'

interface SettingsButtonProps extends EuiButtonProps {
    onClick?: React.MouseEventHandler
};

export default function SettingsButton(props: SettingsButtonProps) {

    const { onClick, ...buttonProps} = props;

    const {euiTheme} = useEuiTheme();

    const settingsButtonStyle = {
        borderRadius: '5px', 
        backgroundColor: euiTheme.colors.mediumShade, 
        color: euiTheme.colors.darkestShade,
    }

    return(
        <EuiButton color='text' onClick={onClick} style={settingsButtonStyle} {...buttonProps}/>
    )
}