import { useState } from "react";
import {
  EuiFlexGrid,
  EuiFlexItem,
  EuiListGroup,
  EuiTablePagination,
} from "@elastic/eui";

type ItemListProps = {
  children: JSX.Element[];
};

//formerly modelItemList, now it is a template in which all item lists will use, I will probably need to pass it another
//parameter to get the type of object grabbed
const GenericItemList: React.FC<ItemListProps> = ({ children }) => {
  //used to set the current page, starts at negative one so things start on the first page
  //gonna be honest I dont really get why this is, I tried to change logic elsewhere to no avail
  const [currentPage, setCurrentPage] = useState(-1);

  //Amount of items per page, this will be able to be changed later with a drop down ideally
  //but that seems low priority
  const [rowSize, setRowSize] = useState(10);

  //this whole section uses some math to be able to use pagination through cards rather than a table,
  //additional functionality is needed later perhaps, but right now everything looks crisp

  //Gets the total amount of items
  const totalItems = children.length;

  //gets the total amount of pages
  const [totalPages, setTotalPages] = useState(Math.ceil(totalItems / rowSize));

  //gets the start index of the items, itemsPerPage is added because arrays start at 0
  const startIndex = currentPage * rowSize + rowSize;

  //end index of the current span of items
  const endIndex = startIndex + rowSize;

  //slices the objects in the array we want, or the data rather to be displayed
  const currentItems = children.slice(startIndex, endIndex);

  //used to change the page number, subtracts 1 because of how arrays work
  const onPageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber - 1);
  };

  //used to change the items in each page
  const changeItemsPerPage = (pageSize: number) => {
    setTotalPages(Math.ceil(totalItems / pageSize));
    setRowSize(pageSize);
    setCurrentPage(-1);
  };

  //change items per page
  //const changeItemsPerPage = (pageSize: number) => {
  //  itemsPerPage = number;
  //};
  //what is actually output
  return (
    <EuiFlexGrid gutterSize="s">
      <EuiFlexItem>
        <EuiListGroup
          flush={true}
          bordered={false}
          maxWidth={false}
          gutterSize="none"
        >
          {currentItems}
        </EuiListGroup>
      </EuiFlexItem>
      <EuiFlexItem>
        <EuiTablePagination
          pageCount={totalPages}
          activePage={currentPage + 1}
          onChangePage={onPageChange}
          itemsPerPage={rowSize}
          onChangeItemsPerPage={changeItemsPerPage}
          itemsPerPageOptions={[5, 10, 20]}
        />
      </EuiFlexItem>
    </EuiFlexGrid>
  );
};

export default GenericItemList;
