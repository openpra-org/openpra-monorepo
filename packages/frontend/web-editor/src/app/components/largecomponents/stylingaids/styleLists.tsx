import { EuiFlexGroup, EuiFlexItem, EuiSpacer } from "@elastic/eui";
import ItemList from "../lists/itemlisttemplate/itemList";

type Item = {
    title: string;
    description: string;
  };
  
  type ItemListProps = {
    itemData: Item[];
};

const StyleLists: React.FC<ItemListProps> = ({ itemData }) => {
    return (
        <div>
        <EuiFlexGroup gutterSize="s">
            <EuiSpacer size="s" />
            <EuiFlexItem grow={true}>
                {/**this is the spacer that divides filter from the cards for items*/}
                <EuiSpacer size="s" />
                <ItemList itemData={itemData} />
            </EuiFlexItem>
            <EuiSpacer size="s" />
        </EuiFlexGroup>
        </div>
    );
}
export default StyleLists
