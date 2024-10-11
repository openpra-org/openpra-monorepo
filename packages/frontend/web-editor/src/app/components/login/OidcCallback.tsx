import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ApiManager } from "shared-types/src/lib/api/ApiManager"; // Adjust the path as needed
import { UseToastContext } from "../../providers/toastProvider";
import { GetESToast } from "../../../utils/treeUtils";

function OidcCallback(): JSX.Element {
  const navigate = useNavigate();
  const { addToast } = UseToastContext();

  useEffect(() => {
    const handleCallback = async () => {
      // eslint-disable-next-line no-console
      console.log("Current URL:", window.location.href);
      const params = new URLSearchParams(window.location.search);
      // eslint-disable-next-line no-console
      console.log(params);
      const code = params.get("code");
      // eslint-disable-next-line no-console
      console.log(code);

      if (code) {
        try {
          await ApiManager.handleCallback(code); // Exchange code for tokens
          navigate("/internal-events"); // Redirect after successful login
        } catch (error) {
          console.error("Error during OIDC callback handling", error);
          addToast(GetESToast("danger", "Failed to handle OIDC callback"));
          navigate("/"); // Redirect back to login on error
        }
      } else {
        addToast(GetESToast("danger", "Authorization code not found."));
        navigate("/"); // Redirect back to login if no code
      }
    };

    void handleCallback();
  }, [navigate, addToast]);

  return <div>Processing login...</div>; // Optionally add a loading spinner here
}

export { OidcCallback };
