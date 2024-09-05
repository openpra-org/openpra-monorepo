import { isRouteErrorResponse, useRouteError, useNavigate, ErrorResponse } from "react-router-dom";
import React, { ReactElement } from "react";
import {
  EuiButton,
  EuiText,
  EuiTextAlign,
  EuiButtonEmpty,
  EuiCodeBlock,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPageTemplate,
} from "@elastic/eui";

/**
 * Interface defining the structure for the content of the error message displayed on the error page.
 */
export interface ErrorPageMessageContent {
  title: string;
  console: string | undefined;
  text: string;
}

/**
 * Formats the error response into a more user-friendly message content.
 *
 * @param error - The error response object, potentially partial, from the routing system.
 * @returns ErrorPageMessageContent - An object containing the formatted title, console, and text for the error page.
 */
const formatErrorResponse = (error: Partial<ErrorResponse>): ErrorPageMessageContent => {
  const response: ErrorPageMessageContent = {
    title: "Page Not Found",
    console: undefined,
    text: "We can't find the page you're looking for. It might have been removed, renamed, or it didn't exist in the first place.",
  };
  if (isRouteErrorResponse(error)) {
    response.title =
      (error.status ? String(error.status) : "") + " " + (error.statusText ? error.statusText : response.title);
    response.console = String(error.data) ? String(error.data) : undefined;
  }
  return response;
};

/**
 * Component that renders an error page based on routing errors.
 * It uses the `useRouteError` hook from `react-router-dom` to get the error details
 * and displays a user-friendly message and options to navigate back or go to the homepage.
 *
 * @returns ReactElement - The error page component.
 */
function ErrorPage(): ReactElement {
  const error: ErrorResponse = useRouteError() as ErrorResponse;
  const message: ErrorPageMessageContent = formatErrorResponse(error);
  const navigate = useNavigate();

  return (
    <EuiPageTemplate minHeight="0">
      <EuiPageTemplate.EmptyPrompt
        color="plain"
        hasBorder
        hasShadow
        iconType="error"
        iconColor="accent"
        title={<h1>{message.title}</h1>}
        titleSize="m"
        layout="vertical"
        body={
          <EuiFlexGroup
            justifyContent="spaceEvenly"
            direction="column"
          >
            {message.console && (
              <EuiFlexItem>
                <EuiTextAlign textAlign="left">
                  <EuiCodeBlock
                    isCopyable
                    language="js"
                    fontSize="m"
                    paddingSize="m"
                  >
                    {message.console}
                  </EuiCodeBlock>
                </EuiTextAlign>
              </EuiFlexItem>
            )}
            <EuiFlexItem>
              <EuiText>{message.text}</EuiText>
            </EuiFlexItem>
          </EuiFlexGroup>
        }
        actions={
          <EuiFlexGroup justifyContent="spaceEvenly">
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty
                iconType="arrowLeft"
                flush="both"
                onClick={() => {
                  navigate(-1);
                }}
              >
                Go back
              </EuiButtonEmpty>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton
                href="/"
                color="primary"
                fill
              >
                Home
              </EuiButton>
            </EuiFlexItem>
          </EuiFlexGroup>
        }
      />
    </EuiPageTemplate>
  );
}

export { ErrorPage };
