import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

import { RootHeader } from "../rootHeader";

describe("RootHeader", () => {
  //test for workspace selector

  //test for initial render of breadcrumbs
  it("renders header breadcrumbs", () => {
    render(
      <BrowserRouter>
        <RootHeader />
      </BrowserRouter>,
    );
    const headerBreadcrumbs = screen.getByTestId("breadcrumbs");
    expect(headerBreadcrumbs).toBeInTheDocument();
  });

  //test for initial render of search icon
  it("renders header search icon", () => {
    render(
      <BrowserRouter>
        <RootHeader />
      </BrowserRouter>,
    );
    const searchIcon = screen.getByTestId("search-icon");
    expect(searchIcon).toBeInTheDocument();
  });

  //test for displaying search menu on clicking search icon
  it("renders search menu on clicking search icon", () => {
    render(
      <BrowserRouter>
        <RootHeader />
      </BrowserRouter>,
    );
    const searchIcon = screen.getByTestId("search-icon");
    fireEvent.click(searchIcon);
    const searchMenuMessage = screen.getAllByTestId("search-menu")[0];
    expect(searchMenuMessage).toBeInTheDocument();
  });

  //test for initial render of user menu
  it("renders header user menu", () => {
    render(
      <BrowserRouter>
        <RootHeader />
      </BrowserRouter>,
    );
    const userMenu = screen.getByTestId("user-menu");
    expect(userMenu).toBeInTheDocument();
  });

  //test for rendering user menu contents on clicking search menu
  it("renders user menu contents on clicking user menu", () => {
    render(
      <BrowserRouter>
        <RootHeader />
      </BrowserRouter>,
    );
    const userMenu = screen.getByTestId("user-menu");
    fireEvent.click(userMenu);
    const userMenuContents = screen.getByTestId("user-menu-content");
    expect(userMenuContents).toBeInTheDocument();
  });

  //test for initial render of header app menu
  it("renders header app menu", () => {
    render(
      <BrowserRouter>
        <RootHeader />
      </BrowserRouter>,
    );
    const appMenu = screen.getByTestId("app-menu");
    expect(appMenu).toBeInTheDocument();
  });

  //test for rendering header app menu contents after clicking header app icon
  it("renders header app menu content on clicking header user app icon", () => {
    render(
      <BrowserRouter>
        <RootHeader />
      </BrowserRouter>,
    );
    const appMenu = screen.getByTestId("app-menu");
    fireEvent.click(appMenu);
    const appMenuContents = screen.getByTestId("app-menu-content");
    expect(appMenuContents).toBeInTheDocument();
  });
});
