import React, { createContext, useContext, useState, ReactNode } from "react";
interface CategoryContextType {
  categories: {
    value: string;
    text: string;
  }[];
  addCategory: (newCategory: string) => void;
  deleteCategory: (newCategory: string) => void;
}
const CategoryContext = createContext<CategoryContextType | undefined>(undefined);
export const CategoryProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const [categories, setCategories] = useState([
    { value: "Category A", text: "Category A" },
    { value: "Category B", text: "Category B" },
  ]);
  const addCategory = (newCategory: string): void => {
    setCategories((prevCategories) => [...prevCategories, { value: newCategory, text: newCategory }]);
  };
  const deleteCategory = (categoryToDelete: string): void => {
    setCategories((prevCategories) => prevCategories.filter((cat) => cat.value !== categoryToDelete));
  };
  return (
    <CategoryContext.Provider value={{ categories, addCategory, deleteCategory }}>{children}</CategoryContext.Provider>
  );
};
export const useCategoryContext = (): CategoryContextType => {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error("useCategoryContext must be used within a CategoryProvider");
  }
  return context;
};
