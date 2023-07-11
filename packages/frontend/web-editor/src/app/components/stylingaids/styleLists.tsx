import { EuiFlexGroup, EuiFlexItem, EuiSpacer } from "@elastic/eui";

type Item = {
  id: number;
    title: string;
    description: string;
  };

  type ItemListProps = {
    itemData: Item[];
    typeString: string;
};

//general styling for lists, takes the item data prop so that I can pass it to the actual lists. this is just a bit of helpful formatting so I dont need to paste it everywhere
//in theory this could work by passing a react node instead, which might be worth looking into but I didnt wanna do it like that just yet.
//it also takes a type string to pass so that the proper links and such are set eventually as well
const StyleLists: React.FC<ItemListProps> = ({ itemData, typeString }) => {
    return (
        <div>
        <EuiFlexGroup gutterSize="none">
            <EuiFlexItem grow={true}>
                {/*<GenericItemList itemData={itemData} typeString={typeString} />*/}
            </EuiFlexItem>
        </EuiFlexGroup>
        </div>
    );
}
export default StyleLists
