import { BrowserRouter } from "react-router-dom";
import AdvancedSettings from "../advancedSettings";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SettingsOverview from "../settingsOverview";

describe(SettingsOverview, () => {
  //test for accordian
  it("Renders the accordian", () => {
    render(
      <BrowserRouter>
        <SettingsOverview />
      </BrowserRouter>,
    );
    const settingsAccordian = screen.getByTestId("settingsAccordian");
    expect(settingsAccordian).toBeInTheDocument();
  });

  //test for settings menu
  it("Renders the save button", () => {
    render(
      <BrowserRouter>
        <SettingsOverview />
      </BrowserRouter>,
    );
    const settingsAccordian = screen.getByTestId("settingsAccordian");
    fireEvent.click(settingsAccordian);
    const saveButton = screen.getByTestId("saveButton");
    expect(saveButton).toBeInTheDocument();
  });

  //test for settings menu
  it("Renders the title", () => {
    render(
      <BrowserRouter>
        <SettingsOverview />
      </BrowserRouter>,
    );
    const settingsAccordian = screen.getByTestId("settingsAccordian");
    fireEvent.click(settingsAccordian);
    const title = screen.getByTestId("title");
    expect(title).toBeInTheDocument();
  });

  //test for settings menu
  it("Renders the text", () => {
    render(
      <BrowserRouter>
        <SettingsOverview />
      </BrowserRouter>,
    );
    const settingsAccordian = screen.getByTestId("settingsAccordian");
    fireEvent.click(settingsAccordian);
    const text = screen.getByTestId("text");
    expect(text).toBeInTheDocument();
  });

  //test for settings menu
  it("Renders the diagram select", () => {
    render(
      <BrowserRouter>
        <SettingsOverview />
      </BrowserRouter>,
    );
    const settingsAccordian = screen.getByTestId("settingsAccordian");
    fireEvent.click(settingsAccordian);
    const selectDiagram = screen.getByTestId("selectDiagram");
    expect(selectDiagram).toBeInTheDocument();
  });

  //test for settings menu
  it("Renders the diagram number", () => {
    render(
      <BrowserRouter>
        <SettingsOverview />
      </BrowserRouter>,
    );
    const settingsAccordian = screen.getByTestId("settingsAccordian");
    fireEvent.click(settingsAccordian);
    const diagramNumber = screen.getByTestId("diagramNumber");
    expect(diagramNumber).toBeInTheDocument();
  });
});
