import { useState } from "react";
import { LoginForm } from "./loginForm";
import { SignUpForm } from "./signUpForm";
import "./css/authPage.css";

type AuthView = "login" | "signup";

function AuthPage(): JSX.Element {
  const [view, setView] = useState<AuthView>(() => new URLSearchParams(window.location.search).get("signup") === "1" ? "signup" : "login");
  return (
    <div className="auth-page">
      <div className="auth-page__bg" />
      <div className="auth-page__card">
        {view === "login" ? (
          <LoginForm onSwitchToSignup={() => { setView("signup"); }} />
        ) : (
          <SignUpForm onSwitchToLogin={() => { setView("login"); }} />
        )}
      </div>
    </div>
  );
}

export { AuthPage };
