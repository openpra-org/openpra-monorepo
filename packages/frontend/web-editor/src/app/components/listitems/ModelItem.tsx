import { EuiCard, EuiSpacer, EuiFlexItem, EuiFlexGroup, EuiAvatar} from "@elastic/eui";

export interface ModelItemProps {
  title: string,
  description?: string;
}

/**
 *
 * @param props
 */
export default function(props: ModelItemProps) {
  const { title, description } = props;
  return (
    <>
      <EuiFlexItem grow={false}>
        <EuiCard
          layout="horizontal"
          icon={
            <EuiFlexGroup alignItems="center" gutterSize="m">
              <EuiFlexItem grow={false}>
                <EuiAvatar name={title} size="l" />
              </EuiFlexItem>
              <EuiFlexItem>
                <span>Card Title</span>
              </EuiFlexItem>
            </EuiFlexGroup>
          }
          title={title}
          description={description}
          key={title}
        />
      </EuiFlexItem>
    </>
  );
}
