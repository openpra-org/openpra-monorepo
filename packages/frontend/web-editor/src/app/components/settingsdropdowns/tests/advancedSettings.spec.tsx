import { BrowserRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import AdvancedSettings from "../advancedSettings";
import "@testing-library/jest-dom";

describe(AdvancedSettings, () => {
  //test for settings menu
  it("Renders the accordian", () => {
    render(
      <BrowserRouter>
        <AdvancedSettings />
      </BrowserRouter>,
    );
    const settingsAccordian = screen.getByTestId("settingsAccordian");
    expect(settingsAccordian).toBeInTheDocument();
  });

  //test for settings menu
  it("Renders the title", () => {
    render(
      <BrowserRouter>
        <AdvancedSettings />
      </BrowserRouter>,
    );
    const settingsAccordian = screen.getByTestId("settingsAccordian");
    expect(settingsAccordian).toBeInTheDocument();
    fireEvent.click(settingsAccordian);
    const title = screen.getByTestId("title");
    expect(title).toBeInTheDocument();
  });

  //test for settings menu
  it("Renders the text", () => {
    render(
      <BrowserRouter>
        <AdvancedSettings />
      </BrowserRouter>,
    );
    const settingsAccordian = screen.getByTestId("settingsAccordian");
    expect(settingsAccordian).toBeInTheDocument();
    fireEvent.click(settingsAccordian);
    const text = screen.getByTestId("text");
    expect(text).toBeInTheDocument();
  });

  //test for settings menu
  it("Renders the grouping panel", () => {
    render(
      <BrowserRouter>
        <AdvancedSettings />
      </BrowserRouter>,
    );
    const settingsAccordian = screen.getByTestId("settingsAccordian");
    expect(settingsAccordian).toBeInTheDocument();
    fireEvent.click(settingsAccordian);
    const selectDiagram = screen.getByTestId("grouping");
    expect(selectDiagram).toBeInTheDocument();
  });

  //test for settings menu
  it("Renders the save button", () => {
    render(
      <BrowserRouter>
        <AdvancedSettings />
      </BrowserRouter>,
    );
    const settingsAccordian = screen.getByTestId("settingsAccordian");
    expect(settingsAccordian).toBeInTheDocument();
    fireEvent.click(settingsAccordian);
    const saveButton = screen.getByTestId("saveButton");
    expect(saveButton).toBeInTheDocument();
  });

  //test for settings menu
  it("Renders the delete title", () => {
    render(
      <BrowserRouter>
        <AdvancedSettings />
      </BrowserRouter>,
    );
    const settingsAccordian = screen.getByTestId("settingsAccordian");
    expect(settingsAccordian).toBeInTheDocument();
    fireEvent.click(settingsAccordian);
    const trashTitle = screen.getByTestId("trashTitle");
    expect(trashTitle).toBeInTheDocument();
  });

  //test for settings menu
  it("Renders the delete text", () => {
    render(
      <BrowserRouter>
        <AdvancedSettings />
      </BrowserRouter>,
    );
    const settingsAccordian = screen.getByTestId("settingsAccordian");
    expect(settingsAccordian).toBeInTheDocument();
    fireEvent.click(settingsAccordian);
    const trashText = screen.getByTestId("trashText");
    expect(trashText).toBeInTheDocument();
  });

  //test for settings menu
  it("Renders the delete button", () => {
    render(
      <BrowserRouter>
        <AdvancedSettings />
      </BrowserRouter>,
    );
    const settingsAccordian = screen.getByTestId("settingsAccordian");
    expect(settingsAccordian).toBeInTheDocument();
    fireEvent.click(settingsAccordian);
    const trashButton = screen.getByTestId("trashButton");
    expect(trashButton).toBeInTheDocument();
  });
});
