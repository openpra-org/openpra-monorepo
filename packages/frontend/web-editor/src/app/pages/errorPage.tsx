import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import {ReactElement} from "react";

export default function ErrorPage(): ReactElement {
    const error: Error | unknown = useRouteError();
    let statusText = "";
    if(isRouteErrorResponse(error)) {
        statusText = error.statusText;
    }
    console.error(error);
    return (
        <div id="error-page">
            <h1>Oops!</h1>
            <p>Sorry, an unexpected error has occurred.</p>
            <p><i>{statusText}</i></p>
        </div>
    );
}
