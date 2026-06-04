import { useEffect, useState } from "react";
import { EuiFlexGrid, EuiFlexItem, EuiListGroup, EuiTablePagination } from "@elastic/eui";
interface ItemListProps {
  children: JSX.Element[];
}
const GenericItemList: React.FC<ItemListProps> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState(-1);
  const [rowSize, setRowSize] = useState(10);
  const totalItems = children.length;
  const [totalPages, setTotalPages] = useState(Math.ceil(totalItems / rowSize));
  useEffect(() => {
    setTotalPages(Math.ceil(children.length / rowSize));
  }, [children.length, rowSize]);
  const startIndex = currentPage * rowSize + rowSize;
  const endIndex = startIndex + rowSize;
  const currentItems = children.slice(startIndex, endIndex);
  const onPageChange = (pageNumber: number): void => {
    setCurrentPage(pageNumber - 1);
  };
  const changeItemsPerPage = (pageSize: number): void => {
    setTotalPages(Math.ceil(totalItems / pageSize));
    setRowSize(pageSize);
    setCurrentPage(-1);
  };
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
export { GenericItemList };
