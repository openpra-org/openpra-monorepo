import StyleLists from "../stylingaids/styleLists";

// temporary item data that is prepulated
const itemData = [
  { title: 'Fault Item 1', description: 'Description 1' },
  { title: 'Item 2', description: 'Description 2' },
  { title: 'Item 3', description: 'Description 3' },
  { title: 'Item 4', description: 'Description 2' },
  { title: 'Item 5', description: 'Description 3' },
  { title: 'Item 6', description: 'Description 2' },
  { title: 'Item 7', description: 'Description 3' },
  { title: 'Item 8', description: 'Description 3' },
  { title: 'Item 9', description: 'Description 3' },
  { title: 'Item 10', description: 'Description 3' },
  { title: 'Item 11', description: 'Description 3' },
  { title: 'Item 12', description: 'Description 3' },
  { title: 'Item 13', description: 'Description 3' },
  { title: 'Item 14', description: 'Description 3' },
  { title: 'Item 15', description: 'Description 3' },
];

//function to add an item to the list, will eventually be done with databases(tm)
export const addFaultTreeDataToList = (object: {title:string, description: string, users?: string[]}) => {
  itemData.push(object)
};

export default function FaultTreeList(){
  return (
    <StyleLists itemData={itemData} typeString="Fault Tree" />
  );
}