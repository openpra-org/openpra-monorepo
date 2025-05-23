import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

import { EditCurrentModel } from "../editCurrentModel";

describe("EditCurrentModel", () => {
  //test for settings menu
  it("Renders the accordian", () => {
    render(
      <BrowserRouter>
        <EditCurrentModel />
      </BrowserRouter>,
    );
    const settingsAccordian = screen.getByTestId("settingsAccordian");
    expect(settingsAccordian).toBeInTheDocument();
  });

  //test for settings menu
  it("Renders the edit box", () => {
    render(
      <BrowserRouter>
        <EditCurrentModel />
      </BrowserRouter>,
    );
    const settingsAccordian = screen.getByTestId("settingsAccordian");
    fireEvent.click(settingsAccordian);
    const editBox = screen.getByTestId("editBox");
    expect(editBox).toBeInTheDocument();
  });
});
