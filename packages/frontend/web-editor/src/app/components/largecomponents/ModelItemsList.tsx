import { useState } from "react";
import { EuiFlexGrid, EuiFlexItem, EuiPagination} from "@elastic/eui";
import ModelItem from "../listitems/ModelItem";


export default function() {
  const [currentPage, setCurrentPage] = useState(-1);
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
    { title: 'Item 8', description: 'Description 3' },
    { title: 'Item 9', description: 'Description 3' },
    { title: 'Item 10', description: 'Description 3' },
    { title: 'Item 11', description: 'Description 3' },
    { title: 'Item 12', description: 'Description 3' },
    { title: 'Item 13', description: 'Description 3' },
    { title: 'Item 14', description: 'Description 3' },
    { title: 'Item 15', description: 'Description 3' },
  ];

  const totalItems = itemData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const startIndex = currentPage * itemsPerPage + 5;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = itemData.slice(startIndex, endIndex);

  const onPageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber - 1);
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
        pageCount={totalPages}
        activePage={currentPage + 1}
        onPageClick={onPageChange}
      />
    </>
  );
}