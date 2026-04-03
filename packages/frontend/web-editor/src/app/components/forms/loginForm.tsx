import React, { useContext } from "react";
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { EuiFieldText, EuiForm, EuiButton, EuiFormRow, EuiFieldPassword } from "@elastic/eui";
import { LoginProps, LoginErrorProps } from "shared-sdk/lib/api/AuthTypes";
import { AuthService } from "shared-sdk/lib/api/AuthService";
import { UpdateAbility } from "../../casl/ability";
import { AbilityContext } from "../../providers/abilityProvider";
import { UseToastContext } from "../../providers/toastProvider";
import { useAuth } from "../../api/auth/AuthContext";
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
  const { login: authLogin } = useAuth();

  async function handleLogin(): Promise<void> {
    setInvalid(false);
    const { username, password } = login;
    try {
      await authLogin(username, password);
      UpdateAbility(ability, AuthService.getRole())
        .then((_res) => {
          setRedirectToHomepage(true);
        })
        .catch((_error: unknown) => {
          addToast(GetESToast("danger", "Something went wrong while getting abilities"));
          setInvalid(true);
        });
    } catch (_error: unknown) {
      setInvalid(true);
    }
  }

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

    const errorCheck = {
      username: !login.username,
      password: !login.password,
    };

    setError({
      username: !login.username,
      password: !login.password,
    });

    if (!errorCheck.username && !errorCheck.password) {
      void handleLogin();
    }
  }

  if (redirectToHomepage) {
    return (
      <Navigate
        to="/"
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
