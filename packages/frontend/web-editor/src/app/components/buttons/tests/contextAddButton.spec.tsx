import { render, screen } from "@testing-library/react";
import { act } from "react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { ContextAddButton } from "../contextAddButton";

/**
 * tests all of the create item button types
 * this also does tests for create item button because of this
 * as this function creates those, just with different parameters
 */

describe("ContextAddButton", () => {
  it("Renders the internal events button", async () => {
    act(() => {
      render(
        <MemoryRouter initialEntries={["/internal-events"]}>
          <ContextAddButton />
        </MemoryRouter>,
      );
    });
    const button = await screen.findByTestId("button-text");
    expect(button).toHaveTextContent("Create Internal Events");
  });

  it("Renders the internal hazards button", async () => {
    act(() => {
      render(
        <MemoryRouter initialEntries={["/internal-hazards"]}>
          <ContextAddButton />
        </MemoryRouter>,
      );
    });
    const button = await screen.findByTestId("button-text");
    expect(button).toHaveTextContent("Create Internal Hazards");
  });

  it("Renders the external hazards button", async () => {
    act(() => {
      render(
        <MemoryRouter initialEntries={["/external-hazards"]}>
          <ContextAddButton />
        </MemoryRouter>,
      );
    });
    const button = await screen.findByTestId("button-text");
    expect(button).toHaveTextContent("Create External Hazards");
  });

  it("Renders the full scope button", async () => {
    act(() => {
      render(
        <MemoryRouter initialEntries={["/full-scope"]}>
          <ContextAddButton />
        </MemoryRouter>,
      );
    });
    const button = await screen.findByTestId("button-text");
    expect(button).toHaveTextContent("Create Full Scope");
  });

  it("Renders the event sequence diagram button", async () => {
    act(() => {
      render(
        <MemoryRouter initialEntries={["/internal-events/event-sequence-diagrams"]}>
          <ContextAddButton />
        </MemoryRouter>,
      );
    });
    const button = await screen.findByTestId("button-text");
    expect(button).toHaveTextContent("Create Event Sequence Diagram");
  });

  it("Renders the functional events button", async () => {
    act(() => {
      render(
        <MemoryRouter initialEntries={["/internal-events/functional-events"]}>
          <ContextAddButton />
        </MemoryRouter>,
      );
    });
    const button = await screen.findByTestId("button-text");
    expect(button).toHaveTextContent("Create Functional Event");
  });

  it("Renders the initiating events button", async () => {
    act(() => {
      render(
        <MemoryRouter initialEntries={["/internal-events/initiating-events"]}>
          <ContextAddButton />
        </MemoryRouter>,
      );
    });
    const button = await screen.findByTestId("button-text");
    expect(button).toHaveTextContent("Create Initiating Event");
  });

  it("Renders the event trees button", async () => {
    act(() => {
      render(
        <MemoryRouter initialEntries={["/internal-events/event-trees"]}>
          <ContextAddButton />
        </MemoryRouter>,
      );
    });
    const button = await screen.findByTestId("button-text");
    expect(button).toHaveTextContent("Create Event Tree");
  });

  it("Renders the bayesian networks button", async () => {
    act(() => {
      render(
        <MemoryRouter initialEntries={["/internal-events/bayesian-networks"]}>
          <ContextAddButton />
        </MemoryRouter>,
      );
    });
    const button = await screen.findByTestId("button-text");
    expect(button).toHaveTextContent("Create Bayesian Network");
  });

  it("Renders the bayesian estimations button", async () => {
    act(() => {
      render(
        <MemoryRouter initialEntries={["/internal-events/bayesian-estimation"]}>
          <ContextAddButton />
        </MemoryRouter>,
      );
    });
    const button = await screen.findByTestId("button-text");
    expect(button).toHaveTextContent("Create Bayesian Estimation");
  });

  it("Renders the fault trees button", async () => {
    act(() => {
      render(
        <MemoryRouter initialEntries={["/internal-events/fault-trees"]}>
          <ContextAddButton />
        </MemoryRouter>,
      );
    });
    const button = await screen.findByTestId("button-text");
    expect(button).toHaveTextContent("Create Fault Tree");
  });

  it("Renders the weibull analysis button", async () => {
    act(() => {
      render(
        <MemoryRouter initialEntries={["/internal-events/weibull-analysis"]}>
          <ContextAddButton />
        </MemoryRouter>,
      );
    });
    const button = await screen.findByTestId("button-text");
    expect(button).toHaveTextContent("Create Weibull Analysis");
  });
});
