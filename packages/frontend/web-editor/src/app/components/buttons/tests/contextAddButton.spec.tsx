import { render } from "@testing-library/react";
import {
  BrowserRouter,
  MemoryRouter,
  Route,
  Router,
  Routes,
} from "react-router-dom";
import ContextAddButton from "../contextAddButton";
import App from "../../../app";

/**
 * tests all of the create item button types
 * this also does tests for create item button because of this
 * as this function creates those, just with different parameters
 */

describe(ContextAddButton, () => {
  it("Renders the internal events button", () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={["/internal-events"]}>
        <ContextAddButton />
      </MemoryRouter>,
    );
    const buttonText = getByText("Create Internal Events");
    expect(buttonText).toBeTruthy();
  });

  it("Renders the internal hazards button", () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={["/internal-hazards"]}>
        <ContextAddButton />
      </MemoryRouter>,
    );
    const buttonText = getByText("Create Internal Hazards");
    expect(buttonText).toBeTruthy();
  });

  it("Renders the internal hazards button", () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={["/external-hazards"]}>
        <ContextAddButton />
      </MemoryRouter>,
    );
    const buttonText = getByText("Create External Hazards");
    expect(buttonText).toBeTruthy();
  });

  it("Renders the internal hazards button", () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={["/full-scope"]}>
        <ContextAddButton />
      </MemoryRouter>,
    );
    const buttonText = getByText("Create Full Scope");
    expect(buttonText).toBeTruthy();
  });

  it("Renders the internal hazards button", () => {
    const { getByText } = render(
      <MemoryRouter
        initialEntries={["/internal-events/event-sequence-diagrams"]}
      >
        <ContextAddButton />
      </MemoryRouter>,
    );
    const buttonText = getByText("Create Event Sequence Diagram");
    expect(buttonText).toBeTruthy();
  });

  it("Renders the internal hazards button", () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={["/internal-events/functional-events"]}>
        <ContextAddButton />
      </MemoryRouter>,
    );
    const buttonText = getByText("Create Functional Event");
    expect(buttonText).toBeTruthy();
  });

  it("Renders the internal hazards button", () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={["/internal-events/initiating-events"]}>
        <ContextAddButton />
      </MemoryRouter>,
    );
    const buttonText = getByText("Create Initiating Event");
    expect(buttonText).toBeTruthy();
  });

  it("Renders the internal hazards button", () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={["/internal-events/event-trees"]}>
        <ContextAddButton />
      </MemoryRouter>,
    );
    const buttonText = getByText("Create Event Tree");
    expect(buttonText).toBeTruthy();
  });

  it("Renders the internal hazards button", () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={["/internal-events/bayesian-networks"]}>
        <ContextAddButton />
      </MemoryRouter>,
    );
    const buttonText = getByText("Create Bayesian Network");
    expect(buttonText).toBeTruthy();
  });

  it("Renders the internal hazards button", () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={["/internal-events/bayesian-estimations"]}>
        <ContextAddButton />
      </MemoryRouter>,
    );
    const buttonText = getByText("Create Bayesian Estimation");
    expect(buttonText).toBeTruthy();
  });

  it("Renders the internal hazards button", () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={["/internal-events/fault-trees"]}>
        <ContextAddButton />
      </MemoryRouter>,
    );
    const buttonText = getByText("Create Fault Tree");
    expect(buttonText).toBeTruthy();
  });

  it("Renders the internal hazards button", () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={["/internal-events/weibull-analysis"]}>
        <ContextAddButton />
      </MemoryRouter>,
    );
    const buttonText = getByText("Create Weibull Analysis");
    expect(buttonText).toBeTruthy();
  });
});
