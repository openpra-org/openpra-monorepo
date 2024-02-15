import { EuiPageBodyProps } from "@elastic/eui/src/components/page/page_body/page_body";
import {
  EuiPageBody,
  EuiPageHeaderProps,
  useEuiTheme,
  EuiPageTemplate,
} from "@elastic/eui";
import { EuiPageSectionProps } from "@elastic/eui/src/components/page/page_section/page_section";

export type TemplatedPageBodyProps = {
  headerProps?: EuiPageHeaderProps;
  sectionProps?: EuiPageSectionProps;
} & EuiPageBodyProps;
function TemplatedPageBody({
  panelled,
  children,
  restrictWidth,
  sectionProps,
  headerProps,
  ...rest
}: TemplatedPageBodyProps) {
  const largeScreenBreakpoint = useEuiTheme().euiTheme.breakpoint.l;
  const isPanelled = panelled === undefined ? true : panelled;
  const width =
    restrictWidth === undefined ? largeScreenBreakpoint : restrictWidth;
  return (
    <EuiPageBody {...rest} panelled={isPanelled} restrictWidth={false}>
      {/** <TemplatedPageHeader {...headerProps} restrictWidth={width}/> */}
      <EuiPageTemplate.Section {...sectionProps} restrictWidth={width}>
        {children}
      </EuiPageTemplate.Section>
    </EuiPageBody>
  );
}
export { TemplatedPageBody };
