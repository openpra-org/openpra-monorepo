import { useState } from "react";
import { EuiFlexGrid, EuiFlexGroup, EuiFlexItem, EuiTablePagination} from "@elastic/eui";
import ModelItem from "../listitems/modelItem";


// temporary item data that is prepulated
const itemData = [
  { title: 'Item 1', description: 'Description 1' },
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
export const addItemDataToList = (object: {title:string, description: string, users?: string[]}) => {
  itemData.push(object)
};

export default function() {

  //used to set the current page, starts at negative one so things start on the first page
  //gonna be honest I dont really get why this is, I tried to change logic elsewhere to no avail
  const [currentPage, setCurrentPage] = useState(-1);

  //Amount of items per page, this will be able to be changed later with a drop down ideally
  //but that seems low priority
  const [rowSize, setRowSize] = useState(5);

  //this whole section uses some math to be able to use pagination through cards rather than a table, 
  //additional functionality is needed later perhaps, but right now everything looks crisp

  //Gets the total amount of items
  const totalItems = itemData.length;

  //gets the total amount of pages
  const [totalPages, setTotalPages] = useState(Math.ceil(totalItems / rowSize));

  //gets the start index of the items, itemsPerPage is added because arrays start at 0
  const startIndex = currentPage * rowSize + rowSize;

  //end index of the current span of items
  const endIndex = startIndex + rowSize;

  //slices the objects in the array we want, or the data rather to be displayed
  const currentItems = itemData.slice(startIndex, endIndex);

  //used to change the page number, subtracts 1 because of how arrays work
  const onPageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber - 1);
  };

  //used to change the items in each page
  const changeItemsPerPage = (pageSize: number) => {
    setTotalPages(Math.ceil(totalItems/pageSize));
    setRowSize(pageSize);
    setCurrentPage(-1)
  }
 
  //change items per page
  //const changeItemsPerPage = (pageSize: number) => {
  //  itemsPerPage = number;
  //};

  //what is actually output
  return (
    <>
      {/** Used to add a bit of space */}
      <EuiFlexGrid gutterSize="s">
        {/** maps the data that has been gotten in the current slice, to a ModelItem */}
        {currentItems.map((item, index) => (
          //flex items are just what are in flex grids to exist there
          <EuiFlexItem key={index}>
            <ModelItem
              title={item.title}
              description={item.description}
              key={index}
            />
          </EuiFlexItem>
        ))}
        <EuiFlexItem>
              {/** pagination tool that appears at the bottom of the page, does a page change on click
           * active page is current page + 1 because of array offset, unsure if there is a fix
           */}
          <EuiFlexGroup justifyContent='flexEnd'>
            <EuiFlexItem grow={false}>
              <EuiTablePagination
                pageCount={totalPages}
                activePage={currentPage + 1}
                onChangePage={onPageChange}
                itemsPerPage={rowSize}
                onChangeItemsPerPage={changeItemsPerPage}
                itemsPerPageOptions={[5, 10, 20]}
              />
            </EuiFlexItem>
          </EuiFlexGroup>
            {/** If we want to add the ability to make a certain amount of rows but that around here */}
        </EuiFlexItem>
      </EuiFlexGrid>
    </>
  );
}