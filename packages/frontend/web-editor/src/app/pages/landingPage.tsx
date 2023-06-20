import { EuiPage, EuiText, EuiPageBody, EuiFlexGroup, EuiFlexItem } from '@elastic/eui';
import AuthCard from '../components/cards/authCard';

export default function LandingPage() {
    return (
        <EuiPage restrictWidth>
            <EuiPageBody>
                <EuiFlexGroup justifyContent="spaceAround" alignItems="center">
                    <EuiFlexItem grow={7}>
                        <EuiText grow={true}>
                            <h1>This is Heading One</h1>
                            <p>
                                Far out in the uncharted backwaters of the unfashionable {' '}
                                end of the western spiral arm of the Galaxy lies a small unregarded
                                yellow sun. When suddenly some wild JavaScript code appeared!{' '}
                                <code>const whoa = &quot;!&quot;</code>
                            </p>
                        </EuiText>
                    </EuiFlexItem>
                    <EuiFlexItem grow={3} style={{ alignItems: "center"}}>
                        <AuthCard />
                    </EuiFlexItem>
                </EuiFlexGroup>
            </EuiPageBody>
        </EuiPage>
    );
}
