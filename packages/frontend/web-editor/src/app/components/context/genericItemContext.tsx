import { LabelJSON } from 'packages/shared-types/src/lib/types/Label';
import { createContext, useContext, useState } from 'react';

type Item = {
    id: number,
    label?: LabelJSON,
    endpoint: string,
    deleteTypedEndpoint?: (id: number) => {};
    deleteNestedEndpoint?: (id: number) => {};
    path: string,
    itemName: string;
};

type ItemContextType = {
  items: Item[];
  updateItems: (items: Item[]) => boolean;
  removeItems: (itemIds_or_Keys: (number | string)[]) => boolean;
};

const ItemContext = createContext<ItemContextType | undefined>(undefined);

export const useItemContext = () => {
  const context = useContext(ItemContext);
  if (!context) {
    throw new Error('useItemContext must be used within an ItemProvider');
  }
  return context;
};

export const ListItemProvider: React.FC = ({ children }) => {
  const [items, setItems] = useState<Item[]>([]);

  const updateItems = (newItems: Item[]): boolean => {
    // Implement your update logic here
    setItems(newItems);
    return true; // Return true or false based on your implementation
  };

  const removeItems = (itemIds_or_Keys: (number | string)[]): boolean => {
    // Implement your remove logic here
    setItems((prevItems) =>
      prevItems.filter(
        (item) =>
          !itemIds_or_Keys.includes(item.id)
      )
    );
    return true; // Return true or false based on your implementation
  };

  return (
    <ItemContext.Provider value={{ items, updateItems, removeItems }}>
      {children}
    </ItemContext.Provider>
  );
};
