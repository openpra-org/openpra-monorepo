import {EuiCardProps} from "@elastic/eui/src/components/card/card";
import {EuiCard} from "@elastic/eui";


export type CardProps = EuiCardProps;

export const FlatCard = ({ ...others }: CardProps): JSX.Element => <EuiCard {...others} />;
