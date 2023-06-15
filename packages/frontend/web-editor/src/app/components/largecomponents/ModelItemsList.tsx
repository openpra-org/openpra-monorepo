import { useState } from "react";
import { EuiFlexGrid, EuiFlexItem, EuiPagination} from "@elastic/eui";
import ModelItem from "../listitems/ModelItem";


export default function() {
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 5;

  // temporary item data that is prepulated
  const itemData = [
    { title: 'Item 1', description: 'Description 1' },
    { title: 'Item 2', description: 'Description 2' },
    { title: 'Item 3', description: 'Description 3' },
    { title: 'Item 4', description: 'Description 2' },
    { title: 'Item 5', description: 'Description 3' },
    { title: 'Item 6', description: 'Description 2' },
    { title: 'Item 7', description: 'Description 3' },
  ];

  // Calculate pagination indices
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = itemData.slice(indexOfFirstItem, indexOfLastItem);

  // Handle page change
const onPageChange = (pageNumber: number) => {
  setCurrentPage(pageNumber);
};

  return (
    <>
      <EuiFlexGrid gutterSize="s">
        {currentItems.map((item, index) => (
          <EuiFlexItem key={index}>
            <ModelItem
              title={item.title}
              description={item.description}
              key={index}
            />
          </EuiFlexItem>
        ))}
      </EuiFlexGrid>

      <EuiPagination
        pageCount={Math.ceil(itemData.length / itemsPerPage)}
        activePage={currentPage}
        onPageClick={onPageChange}
      />
    </>
  );
}