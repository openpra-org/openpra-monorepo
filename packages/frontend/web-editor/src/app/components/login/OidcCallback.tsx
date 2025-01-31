import React, { useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ApiManager } from "shared-types/src/lib/api/ApiManager"; // Adjust the path as needed
import { AuthService } from "shared-types/src/lib/api/AuthService";
import { UseToastContext } from "../../providers/toastProvider";
import { GetESToast } from "../../../utils/treeUtils";

function OidcCallback(): JSX.Element {
  const navigate = useNavigate();
  const { addToast } = UseToastContext();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  useEffect(() => {
    const handleCallback = async () => {
      console.log("Current URL:", location.pathname);
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      if (code) {
        try {
          await ApiManager.handleCallback(code);
          if (state === "signup") {
            await ApiManager.fetchUserInfo();
          }
          // navigate("/internal-events"); // Redirect after successful login
        } catch (error) {
          console.error("Error during OIDC callback handling", error);
          addToast(GetESToast("danger", "Failed to handle OIDC callback"));
          // navigate("/"); // Redirect back to login on error
        }
      } else {
        // const accessToken = AuthService.getAccessToken();
        const accessToken = sessionStorage.getItem("access_token");
        console.log("accessToken", accessToken, AuthService.hasTokenExpired(accessToken));
        if (accessToken && !AuthService.hasTokenExpired(accessToken)) {
          // If there's a valid token, redirect to internal-events
          // navigate("/internal-events");
        } else {
          addToast(GetESToast("danger", "Authorization code not found."));
          // navigate("/"); // Redirect back to login if no valid token
        }
      }
    };

    void handleCallback();
  }, [navigate, addToast]);

  return <div>Processing login...</div>;
}

export { OidcCallback };
