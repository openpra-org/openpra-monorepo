import { EuiCard, EuiIcon, EuiSpacer } from "@elastic/eui";

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
    <EuiCard
      layout="horizontal"
      icon={<EuiIcon size="xl" type={'logoBeats'} />}
      title={title}
      description={description}
      key={title}
    />
      <EuiSpacer size="m" />
    </>
  )
}
