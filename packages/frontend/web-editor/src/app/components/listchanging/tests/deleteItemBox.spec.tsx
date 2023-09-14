import DeleteItemBox from "../deleteItemBox";
import {fireEvent, render, screen} from "@testing-library/react";
import '@testing-library/jest-dom';
import {BrowserRouter} from "react-router-dom";


describe(DeleteItemBox, () => {
    //test for initial rendering of text delete {item_name}
    it("renders delete {list_item} as title", () => {
        render(<BrowserRouter><DeleteItemBox id={1} itemName={"Test"} typeOfModel={""} /></BrowserRouter>);
        const itemTitle = screen.getByTestId("delete-item-title").innerHTML;
        expect(itemTitle).toMatch("Delete Test")
    })

    //test for initial rendering of input box
    it("renders input box for item name", () => {
        render(<BrowserRouter><DeleteItemBox id={1} itemName={"Test"} typeOfModel={""} /></BrowserRouter>);
        const inputBox = screen.getByTestId("delete-item-input")
        expect(inputBox).toBeInTheDocument();
    })

    //test for changing input box content after typing into it
    it("changes value of input box on input", () => {
        render(<BrowserRouter><DeleteItemBox id={1} itemName={"Test"} typeOfModel={""} /></BrowserRouter>);
        const inputBox = screen.getByTestId("delete-item-input");
        fireEvent.change(inputBox, {target: {value: "yes"}});
        expect(inputBox).toHaveValue("yes");
    })

    //test for initial rendering of delete button
    it("renders disabled delete button", () => {
        render(<BrowserRouter><DeleteItemBox id={1} itemName={"Test"} typeOfModel={""} /></BrowserRouter>);
        const deleteItemButton = screen.getByTestId("delete-item-button");
        expect(deleteItemButton).toHaveAttribute('disabled')
    })

    //test for enabled delete button after getting input in input box
    it("renders enabled delete button after entering text in input box", () => {
        render(<BrowserRouter><DeleteItemBox id={1} itemName={"Test"} typeOfModel={""} /></BrowserRouter>);
        const deleteItemButton = screen.getByTestId("delete-item-button");
        const inputBox = screen.getByTestId("delete-item-input");
        fireEvent.change(inputBox, {target: {value: "yes"}});
        expect(deleteItemButton).not.toHaveAttribute('disabled');
    })
})