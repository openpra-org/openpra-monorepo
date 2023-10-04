import { BrowserRouter } from "react-router-dom";
import AdvancedSettings from "../advancedSettings";
import {fireEvent, render, screen} from "@testing-library/react";
import '@testing-library/jest-dom';
import EditCurrentModel from "../editCurrentModel";

describe(EditCurrentModel, () => {

    //test for settings menu
    it("Renders the accordian", async() => {
        render(<BrowserRouter><EditCurrentModel/></BrowserRouter>)
        const settingsAccordian = screen.getByTestId("settingsAccordian")
        expect(settingsAccordian).toBeInTheDocument();
    })

    //test for settings menu
    it("Renders the edit box", async() => {
        render(<BrowserRouter><EditCurrentModel/></BrowserRouter>)
        const settingsAccordian = screen.getByTestId("settingsAccordian")
        fireEvent.click(settingsAccordian)
        const editBox = await screen.getByTestId("editBox")
        expect(editBox).toBeInTheDocument();
    })

})