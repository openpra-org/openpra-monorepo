import {useEuiTheme, EuiButton} from '@elastic/eui'

interface NewItemProps {
    content: string
}

export default function SettingsButton(props: NewItemProps) {

    const {content} = props;

    const {euiTheme} = useEuiTheme();

    return(
        <EuiButton color='text' style={{borderRadius: '5px', backgroundColor: euiTheme.colors.mediumShade, color: euiTheme.colors.darkestShade}}>
            {content}
        </EuiButton>
    )
}