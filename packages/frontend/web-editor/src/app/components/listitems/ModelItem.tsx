import { EuiCard, EuiSpacer, EuiFlexItem, EuiFlexGroup, EuiAvatar} from "@elastic/eui";

//title is required, description isnt required but is typically present
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
      {/** Is all set up as flex items so that spacing and such works correctly */}
      <EuiFlexItem grow={false}>
        <EuiCard
          layout="horizontal"
          icon={
            <EuiFlexGroup alignItems="center" gutterSize="m">
              <EuiFlexItem grow={false}>
                {/** avatar is there to give the circle with the title, does all initials, but I believe can be changed if needed */}
                <EuiAvatar name={title} size="l" />
              </EuiFlexItem>
              <EuiFlexItem>
                <span>Card Title</span>
              </EuiFlexItem>
            </EuiFlexGroup>
          }
          //has a key that sets to the title, the rest is passed in as expected as props
          title={title}
          description={description}
          key={title}
        />
      </EuiFlexItem>
    </>
  );
}
