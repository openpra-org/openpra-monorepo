import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BrowserRouter } from "react-router-dom";
import { DeleteItemBox } from "../deleteItemBox";

describe("DeleteItemBox", () => {
  //test for initial rendering of text delete {item_name}
  it("renders delete {list_item} as title", () => {
    render(
      <BrowserRouter>
        <DeleteItemBox id={1} itemName={"Test"} typeOfModel={""} />
      </BrowserRouter>,
    );
    const itemTitle = screen.getByTestId("delete-item-title").innerHTML;
    expect(itemTitle).toMatch("Delete Test");
  });

  //test for initial rendering of input box
  it("renders input box for item name", () => {
    render(
      <BrowserRouter>
        <DeleteItemBox id={1} itemName={"Test"} typeOfModel={""} />
      </BrowserRouter>,
    );
    const inputBox = screen.getByTestId("delete-item-input");
    expect(inputBox).toBeInTheDocument();
  });

  //test for changing input box content after typing into it
  it("changes value of input box on input", () => {
    render(
      <BrowserRouter>
        <DeleteItemBox id={1} itemName={"Test"} typeOfModel={""} />
      </BrowserRouter>,
    );
    const inputBox: HTMLInputElement = screen.getByTestId("delete-item-input");
    fireEvent.change(inputBox, { target: { value: "yes" } });
    const inputValue = inputBox.value;
    expect(inputValue).toBe("yes");
  });

  //test for initial rendering of delete button
  it("renders disabled delete button", () => {
    render(
      <BrowserRouter>
        <DeleteItemBox id={1} itemName={"Test"} typeOfModel={""} />
      </BrowserRouter>,
    );
    const deleteItemButton: HTMLInputElement =
      screen.getByTestId("delete-item-button");
    const buttonAttribute = deleteItemButton.getAttribute("disabled");
    expect(buttonAttribute).toBe("true");
  });

  //test for enabled delete button after getting input in input box
  it("renders enabled delete button after entering text in input box", () => {
    render(
      <BrowserRouter>
        <DeleteItemBox id={1} itemName={"Test"} typeOfModel={""} />
      </BrowserRouter>,
    );
    const deleteItemButton: HTMLInputElement =
      screen.getByTestId("delete-item-button");
    const inputBox = screen.getByTestId("delete-item-input");
    fireEvent.change(inputBox, { target: { value: "yes" } });
    const buttonAttribute = deleteItemButton.getAttribute("disabled");
    expect(buttonAttribute).toBe(null);
  });
});
