import React, { createContext, useContext, useState, ReactNode } from "react";

// Define the shape of the context
interface CategoryContextType {
  categories: { value: string; text: string }[];
  addCategory: (newCategory: string) => void;
  deleteCategory: (newCategory: string) => void;
}

// Create the context
const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

// Provider component
export const CategoryProvider = ({ children }: { children: ReactNode }) => {
  // Store categories in state
  const [categories, setCategories] = useState([
    { value: "Category A", text: "Category A" },
    { value: "Category B", text: "Category B" },
  ]);

  // Function to add a new category
  const addCategory = (newCategory: string) => {
    setCategories((prevCategories) => [...prevCategories, { value: newCategory, text: newCategory }]);
  };

  const deleteCategory = (categoryToDelete: string) => {
    setCategories((prevCategories) => prevCategories.filter((cat) => cat.value !== categoryToDelete));
  };

  return (
    <CategoryContext.Provider value={{ categories, addCategory, deleteCategory }}>{children}</CategoryContext.Provider>
  );
};

// Hook to use the context
export const useCategoryContext = () => {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error("useCategoryContext must be used within a CategoryProvider");
  }
  return context;
};
