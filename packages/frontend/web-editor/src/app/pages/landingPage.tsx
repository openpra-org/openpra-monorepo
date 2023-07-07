import { EuiPage, EuiText, EuiHideFor, EuiPageBody, EuiFlexGroup, EuiFlexItem, useEuiPaddingCSS} from '@elastic/eui';
import AuthCard from "../components/cards/authCard";
export default function LandingPage() {
    const paddingStyles = useEuiPaddingCSS();
    const cssStyles = [paddingStyles["xl"]];
    return (
        <EuiPage restrictWidth>
            <EuiPageBody>
                <EuiFlexGroup justifyContent="spaceAround" alignItems="center" gutterSize="none">
                    <EuiHideFor sizes={['xs', 's']}>
                        <EuiFlexItem grow={7} css={cssStyles}>
                            <EuiText grow={true}>
                                <h1>Welcome to OpenPRA</h1>
                                <p>
                                    Far out in the uncharted backwaters of the unfashionable {' '}
                                    end of the western spiral arm of the Galaxy lies a small unregarded
                                    yellow sun. When suddenly some wild JavaScript code appeared!{' '}
                                    <code>const whoa = &quot;!&quot;</code>
                                    Far out in the uncharted backwaters of the unfashionable {' '}
                                    end of the western spiral arm of the Galaxy lies a small unregarded
                                    yellow sun. When suddenly some wild JavaScript code appeared!{' '}
                                    <code>const whoa = &quot;!&quot;</code>
                                    Far out in the uncharted backwaters of the unfashionable {' '}
                                    end of the western spiral arm of the Galaxy lies a small unregarded
                                    yellow sun. When suddenly some wild JavaScript code appeared!{' '}
                                    <code>const whoa = &quot;!&quot;</code>
                                </p>
                                <p>
                                    Far out in the uncharted backwaters of the unfashionable {' '}
                                    end of the western spiral arm of the Galaxy lies a small unregarded
                                    yellow sun. When suddenly some wild JavaScript code appeared!{' '}
                                    <code>const whoa = &quot;!&quot;</code>
                                </p>
                                <p>
                                    Far out in the uncharted backwaters of the unfashionable {' '}
                                    end of the western spiral arm of the Galaxy lies a small unregarded
                                    yellow sun. When suddenly some wild JavaScript code appeared!{' '}
                                    <code>const whoa = &quot;!&quot;</code>
                                    Far out in the uncharted backwaters of the unfashionable {' '}
                                    end of the western spiral arm of the Galaxy lies a small unregarded
                                    yellow sun. When suddenly some wild JavaScript code appeared!{' '}
                                    <code>const whoa = &quot;!&quot;</code>
                                    Far out in the uncharted backwaters of the unfashionable {' '}
                                    end of the western spiral arm of the Galaxy lies a small unregarded
                                    yellow sun. When suddenly some wild JavaScript code appeared!{' '}
                                    <code>const whoa = &quot;!&quot;</code>
                                </p>
                            </EuiText>
                        </EuiFlexItem>
                    </EuiHideFor>
                    <EuiFlexItem grow={false}>
                        <AuthCard />
                    </EuiFlexItem>
                </EuiFlexGroup>
            </EuiPageBody>
        </EuiPage>
    );
}
