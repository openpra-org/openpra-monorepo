import { EuiCard, EuiIcon, EuiSpacer, EuiFlexItem, EuiFlexGroup } from "@elastic/eui";

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
      {/* flex item is here to prevent the box from being too big and limits its size */}
        <EuiFlexItem grow={false} style={{ height: '90px' }}>
          {/** cards are the easiest, each option should eb self explanitory, the icon is a placeholder for the Letter in a circle i */}
          <EuiCard
            layout="horizontal"
            icon={<EuiIcon size="l" type={'logoBeats'} />}
            title={title}
            description={description}
            key={title}
          />
        </EuiFlexItem>
      <EuiSpacer size="xs" />
    </>
  )
}
