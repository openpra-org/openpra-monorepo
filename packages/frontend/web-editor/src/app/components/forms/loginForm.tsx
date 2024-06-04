import React, { useContext } from "react";
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { EuiFieldText, EuiForm, EuiButton, EuiFormRow, EuiFieldPassword } from "@elastic/eui";
import { LoginProps, LoginErrorProps } from "shared-types/src/lib/api/AuthTypes";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import { AuthService } from "shared-types/src/lib/api/AuthService";
import { UpdateAbility } from "../../casl/ability";
import { AbilityContext } from "../../providers/abilityProvider";
import { UseToastContext } from "../../providers/toastProvider";
import { GetESToast } from "../../../utils/treeUtils";

function LoginForm(): JSX.Element {
  const DefaultProps: LoginProps = {
    username: "",
    password: "",
  };
  const DefaultErrorProps: LoginErrorProps = {
    username: false,
    password: false,
  };

  const [login, setLogin] = useState(DefaultProps);
  const [error, setError] = useState(DefaultErrorProps);
  const [invalid, setInvalid] = useState(false);
  const [redirectToHomepage, setRedirectToHomepage] = useState(false);
  const ability = useContext(AbilityContext);
  const { addToast } = UseToastContext();

  async function handleLogin(): Promise<void> {
    setInvalid(false);
    const { username, password } = login;
    try {
      await ApiManager.signInWithUsernameAndPassword(username, password).then(() => {
        if (ApiManager.isLoggedIn()) {
          UpdateAbility(ability, AuthService.getRole())
            .then((res) => {
              setRedirectToHomepage(true);
            })
            .catch((error) => {
              addToast(GetESToast("danger", "Something went wrong while getting abilities"));
              setInvalid(true);
            });
        } else {
          setInvalid(true);
        }
      });
    } catch (error) {
      //console.error(error);
    }
  }

  //Corrects the isInvalid when a user types something in a blank input field
  useEffect(() => {
    if (login.username && error.username) {
      setError({
        ...error,
        username: false,
      });
    }
    if (login.password && error.password) {
      setError({
        ...error,
        password: false,
      });
    }
  }, [login, error]);

  function validateLogin(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();

    //need errorCheck in the later if statement due to how states and renders work
    const errorCheck = {
      username: !login.username,
      password: !login.password,
    };

    setError({
      username: !login.username,
      password: !login.password,
    });

    //makes sure all input fields are not empty
    if (!errorCheck.username && !errorCheck.password) {
      handleLogin()
        .then(() => {
          // Handle successful login
          if (redirectToHomepage) {
            // Redirect to the homepage
            return (
              <Navigate
                to="internal-events"
                replace={true}
              />
            );
          }
        })
        .catch((error) => {
          // Handle login error
          //console.error("Login failed:", error);
          // Optionally, you can also set an error state to display to the user
        });
    }
  }

  if (redirectToHomepage) {
    return (
      <Navigate
        to="menu"
        replace={true}
      />
    );
  } else {
    return (
      <EuiForm
        component="form"
        onSubmit={validateLogin}
      >
        <br />
        <EuiFormRow
          isInvalid={error.username}
          error="Invalid Username"
        >
          <EuiFieldText
            placeholder="Username"
            isInvalid={error.username}
            value={login.username}
            onChange={(e): void => {
              setLogin({
                ...login,
                username: e.target.value,
              });
            }}
          />
        </EuiFormRow>
        <EuiFormRow
          isInvalid={error.password}
          error="Invalid Password"
        >
          <EuiFieldPassword
            type="dual"
            placeholder="Password"
            value={login.password}
            isInvalid={error.password}
            onChange={(e): void => {
              setLogin({
                ...login,
                password: e.target.value,
              });
            }}
          />
        </EuiFormRow>
        <EuiFormRow
          isInvalid={invalid}
          error="Invalid username or password"
        >
          <EuiButton
            fullWidth
            type="submit"
          >
            Login
          </EuiButton>
        </EuiFormRow>
      </EuiForm>
    );
  }
}

export { LoginForm };
