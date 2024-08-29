import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { ReactElement } from "react";

function ErrorPage(): ReactElement {
  const error = useRouteError();
  let statusText = "";

  if (error && isRouteErrorResponse(error)) {
    statusText = error.statusText;
  }

  return (
    <div id="error-page">
      <h1>Oops!</h1>
      <p>Sorry, an unexpected error has occurred.</p>
      <p>
        <i>{statusText}</i>
      </p>
    </div>
  );
}

export { ErrorPage };
