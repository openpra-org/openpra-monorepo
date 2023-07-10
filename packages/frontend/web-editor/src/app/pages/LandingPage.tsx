import {
    EuiPage,
    EuiText,
    EuiHideFor,
    EuiPageBody,
    EuiFlexGroup,
    EuiFlexItem,
    useEuiPaddingCSS,
} from "@elastic/eui";
import AuthCard from "../components/cards/authCard";
export default function LandingPage() {
    const textPadding = useEuiPaddingCSS("horizontal");
    const containerPadding = useEuiPaddingCSS();
    const textCss = [textPadding["m"]];
    const containterCss = [containerPadding["m"]];
    return (
        <EuiPage restrictWidth>
            <EuiPageBody>
                <EuiFlexGroup justifyContent="spaceAround" alignItems="center" gutterSize="none">
                    <EuiHideFor sizes={['xs', 's', 'm']}>
                        <EuiFlexItem css={textCss}>
                            <EuiText>
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
                    <EuiFlexItem css={containterCss}>
                        <AuthCard />
                    </EuiFlexItem>
                </EuiFlexGroup>
            </EuiPageBody>
        </EuiPage>
    );
}
