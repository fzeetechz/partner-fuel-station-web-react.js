import { useLocation, useParams } from "react-router-dom";
import { AuthScreen, type AuthMode } from "./AuthScreen";
export function Brand({ withName = false }: { withName?: boolean }) {
  return (
    <div className="brand">
      <img
        className="brand-logo"
        src={`${import.meta.env.BASE_URL}logo/logo.png`}
        alt="NeyFuel"
        width={1254}
        height={1254}
      />
      {withName && (
        <span className="brand-name">
          Ney<span>Fuel</span>
        </span>
      )}
    </div>
  );
}
export function Auth() {
  const { mode = "login" } = useParams();
  const location = useLocation();
  const selected: AuthMode = [
    "login",
    "register",
    "forgot",
    "reset",
    "otp",
  ].includes(mode)
    ? (mode as AuthMode)
    : "login";
  return (
    <AuthScreen
      key={location.pathname + location.search}
      mode={selected}
      portal="partner"
    />
  );
}
