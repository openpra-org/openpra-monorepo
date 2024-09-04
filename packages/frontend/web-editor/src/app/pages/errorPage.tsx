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

function ErrorPage(): ReactElement {
  const error: ErrorResponse = useRouteError() as ErrorResponse;

  let title = "Page not found";
  let consoleMessage = "";

  if (isRouteErrorResponse(error)) {
    title = "" + String(error.status) + " " + error.statusText;
    consoleMessage = String(error.data);
  }

  const navigate = useNavigate();

  return (
    <EuiPageTemplate minHeight="0">
      <EuiPageTemplate.EmptyPrompt
        color="plain"
        hasBorder
        hasShadow
        iconType="error"
        iconColor="accent"
        title={<h1>{title}</h1>}
        titleSize="m"
        layout="vertical"
        body={
          <EuiFlexGroup
            justifyContent="spaceEvenly"
            direction="column"
          >
            <EuiFlexItem>
              <EuiTextAlign textAlign="left">
                <EuiCodeBlock
                  isCopyable
                  language="js"
                  fontSize="m"
                  paddingSize="m"
                >
                  {consoleMessage}
                </EuiCodeBlock>
              </EuiTextAlign>
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiText>
                {"We can't find the page you're looking for. " +
                  "It might have been removed, renamed, or it didn't exist in the first place."}
              </EuiText>
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
