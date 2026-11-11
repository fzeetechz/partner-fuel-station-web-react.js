import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Fuel,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Truck,
  UserRound,
  Zap,
} from "lucide-react";
import { liveAuth } from "../../services/api/liveAuth";
import "./auth.css";

export type AuthMode = "login" | "register" | "forgot" | "reset" | "otp";
export function AuthScreen({
  mode,
  portal,
}: {
  mode: AuthMode;
  portal: "corporate" | "partner";
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [email, setEmail] = useState(String(location.state?.email || ""));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [step, setStep] = useState<"form" | "sent" | "done">("form");
  const [resendAt, setResendAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [developmentOtp, setDevelopmentOtp] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [expiresRemaining, setExpiresRemaining] = useState(0);
  const recovery = mode === "forgot" || mode === "reset";
  const resetting = recovery && step === "sent";
  const needsPassword = mode === "register" || resetting;
  const isCorporate = portal === "corporate";
  const otpPath = isCorporate ? "/auth/verify" : "/auth/otp";
  useEffect(() => {
    if (step !== "form") heading.current?.focus();
  }, [step]);
  useEffect(() => {
    if (!resendAt && !expiresAt) return;
    const update = () => {
      setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
      setExpiresRemaining(
        Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)),
      );
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [resendAt, expiresAt]);

  async function requestResetOtp() {
    setBusy(true);
    setError("");
    try {
      const result = await liveAuth.requestOtp(phone, "RESET");
      setPhone(phone.trim());
      setCode("");
      setDevelopmentOtp(result.developmentOtp || "");
      setResendAt(Date.now() + result.resendAfter * 1000);
      setExpiresAt(Date.now() + result.expiresIn * 1000);
      setStep("sent");
      setErrors({});
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to request a code. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || (mode === "otp" && remaining > 0)) return;
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) || "");
    const next: Record<string, string> = {};
    if (
      ["login", "register"].includes(mode) &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    )
      next.email = "Enter a valid email address.";
    if (mode === "login" && !password) next.password = "Enter your password.";
    if (needsPassword && password.length < 10)
      next.password = "Use at least 10 characters.";
    if (needsPassword && password !== confirm)
      next.confirm = "Your passwords do not match.";
    if (
      (mode === "register" || mode === "otp" || recovery) &&
      !/^\+[1-9]\d{6,14}$/.test(phone.trim())
    )
      next.phone = "Include your country code, for example +6737123456.";
    if (mode === "register" && value("name").trim().length < 2)
      next.name = "Enter your full name.";
    if (resetting && !/^\d{6}$/.test(code.trim()))
      next.code = "Enter the 6-digit verification code.";
    if (resetting && Date.now() >= expiresAt)
      next.code = "Your code has expired. Request a new code.";
    setErrors(next);
    setError("");
    if (Object.keys(next).length) {
      form.current
        ?.querySelector<HTMLInputElement>(`[name="${Object.keys(next)[0]}"]`)
        ?.focus();
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        await liveAuth.login(email, password);
        navigate("/dashboard", { replace: true });
      } else if (recovery) {
        if (!resetting) {
          await requestResetOtp();
        } else {
          await liveAuth.resetPassword(phone, code, password);
          setPassword("");
          setConfirm("");
          setCode("");
          setDevelopmentOtp("");
          setStep("done");
        }
      } else if (mode === "register") {
        await liveAuth.register({
          name: value("name"),
          email,
          phone,
          password,
        });
        setPassword("");
        setConfirm("");
        setStep("done");
      } else {
        const result = await liveAuth.requestOtp(phone);
        setDevelopmentOtp(result.developmentOtp || "");
        setResendAt(Date.now() + result.resendAfter * 1000);
        setNotice(
          `Code requested. It expires in ${Math.ceil(result.expiresIn / 60)} minutes. Code verification is not available yet; use your password to sign in.`,
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const title =
    step === "sent"
      ? "Set a new password."
      : step === "done"
        ? mode === "register"
          ? "Your account is created."
          : "You're all set."
        : {
            login: "Welcome back.",
            register: "Start your journey.",
            forgot: "Forgot your password?",
            reset: "Set a new password.",
            otp: "Sign in with your phone.",
          }[mode];
  const description =
    step === "sent"
      ? "Enter the verification code and choose your new password."
      : step === "done"
        ? mode === "register"
          ? "Your driver account is ready. Complete your profile for approval."
          : "Password changed. Please log in again."
        : {
            login: isCorporate
              ? "Your fleet, your team, your next move. All in one place."
              : "Your station, your team, your next move. All in one place.",
            register: "Create a NeyFuel driver account to get started.",
            forgot:
              "Enter your registered phone number to request a verification code.",
            reset:
              "Enter your registered phone number to request a verification code.",
            otp: "Enter your registered mobile number, including the country code.",
          }[mode];
  const strength = [
    password.length >= 10,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length;
  const fieldError = (name: string) =>
    errors[name] ? (
      <span id={`${name}-error`} className="nf-field-error">
        {errors[name]}
      </span>
    ) : null;
  const passwordField = (confirmation = false) => {
    const name = confirmation ? "confirm" : "password";
    const shown = confirmation ? confirmVisible : visible;
    return (
      <div className="nf-field">
        <div className="nf-label-row">
          <label htmlFor={name}>
            {confirmation
              ? "Confirm password"
              : resetting
                ? "New password"
                : "Password"}
          </label>
          {mode === "login" && !confirmation && (
            <Link to="/auth/forgot">Forgot password?</Link>
          )}
        </div>
        <div className="nf-input">
          <LockKeyhole size={18} />
          <input
            id={name}
            name={name}
            type={shown ? "text" : "password"}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            value={confirmation ? confirm : password}
            onChange={(e) =>
              confirmation
                ? setConfirm(e.target.value)
                : setPassword(e.target.value)
            }
            placeholder={
              confirmation
                ? "Re-enter your password"
                : mode === "login"
                  ? "Enter your password"
                  : "Create a strong password"
            }
            aria-invalid={Boolean(errors[name])}
            aria-describedby={errors[name] ? `${name}-error` : undefined}
            required
          />
          <button
            type="button"
            aria-label={`${shown ? "Hide" : "Show"} ${confirmation ? "confirm " : ""}password`}
            aria-pressed={shown}
            onClick={() =>
              confirmation ? setConfirmVisible(!shown) : setVisible(!shown)
            }
          >
            {shown ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {fieldError(name)}
      </div>
    );
  };
  return (
    <div className={`nf-auth nf-auth-${portal}`}>
      <aside className="nf-story">
        <Link
          className="nf-brand"
          to="/auth/login"
          aria-label="NeyFuel sign in"
        >
          <img src={`${import.meta.env.BASE_URL}logo/logo.png`} alt="NeyFuel" />
          <span>
            NEYFUEL
            <small>{isCorporate ? "CORPORATE PORTAL" : "PARTNER PORTAL"}</small>
          </span>
        </Link>
        <div className="nf-story-content">
          <span className="nf-eyebrow">
            {isCorporate
              ? "BUILT FOR THE ROAD AHEAD"
              : "BETTER TOGETHER, EVERY MILE"}
          </span>
          <h1>
            {isCorporate ? "Your fleet." : "Your station."}
            <br />
            Connected.
            <br />
            <em>In your control.</em>
          </h1>
          <p>
            {isCorporate
              ? "Bring your people, vehicles and fuel together. Keep your business moving with NeyFuel."
              : "Less complexity. More possibility. A connected workspace for your fuel business."}
          </p>
          <div className="nf-benefits">
            <span>
              <ShieldCheck size={17} /> Secure access
            </span>
            <span>
              {isCorporate ? <Truck size={17} /> : <Zap size={17} />} Connected
              operations
            </span>
          </div>
          <div className="nf-story-card">
            <div className="nf-story-card-icon">
              <Fuel size={23} />
            </div>
            <div>
              <strong>Every journey starts here.</strong>
              <p>One account. A smoother road ahead.</p>
            </div>
            <span className="nf-live-dot" />
          </div>
        </div>
        <div className="nf-story-bottom">
          <span>Powering the next mile, together.</span>
          <span>© {new Date().getFullYear()} NeyFuel</span>
        </div>
      </aside>
      <main className="nf-main">
        <div className="nf-mobile-brand">
          <img src={`${import.meta.env.BASE_URL}logo/logo.png`} alt="NeyFuel" />
          <span>{isCorporate ? "Corporate" : "Partner"} portal</span>
        </div>
        <section className="nf-panel" aria-labelledby="auth-title">
          {mode !== "login" && (
            <Link className="nf-back" to="/auth/login">
              <ArrowLeft size={16} /> Back to sign in
            </Link>
          )}
          <div
            className={`nf-form-icon ${step !== "form" ? "nf-form-icon-success" : ""}`}
          >
            {step === "done" ? (
              <CheckCircle2 size={25} />
            ) : resetting ? (
              <KeyRound size={25} />
            ) : mode === "otp" || recovery ? (
              <Phone size={25} />
            ) : (
              <LockKeyhole size={25} />
            )}
          </div>
          <span className="nf-portal-label">
            NEYFUEL {isCorporate ? "CORPORATE" : "PARTNER"}
          </span>
          <h2 id="auth-title" ref={heading} tabIndex={-1}>
            {title}
          </h2>
          <p className="nf-description">{description}</p>
          {recovery && (
            <ol className="nf-steps" aria-label="Password recovery progress">
              <li className={step === "form" ? "current" : "complete"}>
                <span>{step === "form" ? "1" : <Check size={12} />}</span>
                Phone
              </li>
              <li
                className={
                  step === "sent"
                    ? "current"
                    : step === "done"
                      ? "complete"
                      : ""
                }
              >
                <span>{step === "done" ? <Check size={12} /> : "2"}</span>OTP
              </li>
              <li
                className={
                  step === "done" ? "complete" : resetting ? "current" : ""
                }
              >
                <span>3</span>New password
              </li>
            </ol>
          )}
          {step === "done" ? (
            <div className="nf-result">
              {mode === "register" && (
                <div className="nf-tip">
                  <ShieldCheck size={18} />
                  <p>
                    {isCorporate ? "Corporate" : "Station"} access is provided
                    by your administrator. Driver registration does not grant
                    portal access.
                  </p>
                </div>
              )}
              <Link className="nf-primary" to="/auth/login">
                Back to sign in <ArrowRight size={17} />
              </Link>
            </div>
          ) : (
            <form
              ref={form}
              onSubmit={submit}
              noValidate
              aria-busy={busy}
              className="nf-form"
            >
              <fieldset disabled={busy}>
                {mode === "register" && (
                  <div className="nf-field">
                    <label htmlFor="name">Full name</label>
                    <div className="nf-input">
                      <UserRound size={18} />
                      <input
                        id="name"
                        name="name"
                        autoComplete="name"
                        placeholder="Enter your full name"
                        required
                        aria-invalid={Boolean(errors.name)}
                        aria-describedby={
                          errors.name ? "name-error" : undefined
                        }
                      />
                    </div>
                    {fieldError("name")}
                  </div>
                )}
                {["login", "register"].includes(mode) && (
                  <div className="nf-field">
                    <label htmlFor="email">Email address</label>
                    <div className="nf-input">
                      <Mail size={18} />
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        required
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={
                          errors.email ? "email-error" : undefined
                        }
                      />
                    </div>
                    {fieldError("email")}
                  </div>
                )}
                {(mode === "register" ||
                  mode === "otp" ||
                  (recovery && !resetting)) && (
                  <div className="nf-field">
                    <label htmlFor="phone">Phone number</label>
                    <div className="nf-input">
                      <Phone size={18} />
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+673 7123456"
                        required
                        aria-invalid={Boolean(errors.phone)}
                        aria-describedby={
                          errors.phone ? "phone-error" : undefined
                        }
                      />
                    </div>
                    {fieldError("phone")}
                    <span className="nf-hint">
                      Include your country code without spaces.
                    </span>
                  </div>
                )}
                {resetting && (
                  <>
                    <div className="nf-notice" role="status">
                      Verification code requested for <strong>{phone}</strong>.
                      {developmentOtp && (
                        <div>
                          OTP: <strong>{developmentOtp}</strong>
                        </div>
                      )}
                      <div>
                        {expiresRemaining > 0
                          ? `Code expires in ${expiresRemaining}s.`
                          : "Your code has expired. Request a new code."}
                      </div>
                    </div>
                    <div className="nf-field">
                      <label htmlFor="code">Verification code</label>
                      <div className="nf-input">
                        <KeyRound size={18} />
                        <input
                          id="code"
                          name="code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={code}
                          onChange={(e) =>
                            setCode(e.target.value.replace(/\D/g, ""))
                          }
                          placeholder="Enter 6-digit code"
                          required
                          aria-invalid={Boolean(errors.code)}
                          aria-describedby={
                            errors.code ? "code-error" : undefined
                          }
                        />
                      </div>
                      {fieldError("code")}
                    </div>
                    <button
                      className="nf-text-button"
                      type="button"
                      disabled={busy || remaining > 0}
                      onClick={() => {
                        if (!busy && remaining === 0) void requestResetOtp();
                      }}
                    >
                      {remaining > 0
                        ? `Resend code in ${remaining}s`
                        : "Resend code"}
                    </button>
                    <button
                      className="nf-text-button"
                      type="button"
                      onClick={() => {
                        setStep("form");
                        setCode("");
                        setDevelopmentOtp("");
                        setPassword("");
                        setConfirm("");
                        setErrors({});
                        setError("");
                      }}
                    >
                      Use a different phone number
                    </button>
                  </>
                )}
                {(mode === "login" || needsPassword) && passwordField()}
                {needsPassword && (
                  <>
                    <div className="nf-password-guide">
                      <div
                        className="nf-strength"
                        aria-label={`Password strength: ${["Not entered", "Weak", "Fair", "Good", "Strong"][password ? strength || 1 : 0]}`}
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <i
                            key={n}
                            className={
                              password && strength >= n ? "filled" : ""
                            }
                          />
                        ))}
                      </div>
                      <span>
                        {password.length >= 10 ? (
                          <Check size={13} />
                        ) : (
                          <LockKeyhole size={13} />
                        )}{" "}
                        At least 10 characters
                      </span>
                    </div>
                    {passwordField(true)}
                  </>
                )}
                {error && (
                  <div className="nf-alert" role="alert">
                    {error}
                  </div>
                )}
                {notice && (
                  <div className="nf-notice" role="status">
                    {notice}
                    {mode === "otp" && developmentOtp && (
                      <div>OTP: <strong>{developmentOtp}</strong></div>
                    )}
                  </div>
                )}
                <button
                  type="submit"
                  className="nf-primary"
                  disabled={busy || (mode === "otp" && remaining > 0)}
                >
                  {busy ? (
                    <>
                      <LoaderCircle size={18} className="nf-spin" /> Please
                      wait…
                    </>
                  ) : (
                    <>
                      {mode === "login"
                        ? "Sign in to your workspace"
                        : mode === "register"
                          ? "Create driver account"
                          : recovery
                            ? resetting
                              ? "Reset password"
                              : "Request verification code"
                            : remaining
                              ? `Request again in ${remaining}s`
                              : "Request verification code"}
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </fieldset>
            </form>
          )}
          {mode === "login" && (
            <>
              <div className="nf-divider">
                <span>or</span>
              </div>
              <Link className="nf-secondary" to={otpPath}>
                <Phone size={17} /> Request a sign-in code
              </Link>
              <p className="nf-switch">
                New to NeyFuel?{" "}
                <Link to="/auth/register">
                  Create a driver account <ArrowRight size={14} />
                </Link>
              </p>
            </>
          )}
          {mode === "register" && step === "form" && (
            <p className="nf-switch">
              Already have an account? <Link to="/auth/login">Sign in</Link>
            </p>
          )}
          <div className="nf-secure">
            <ShieldCheck size={14} />
            <span>Your account. Your secure workspace.</span>
          </div>
        </section>
        <footer className="nf-mobile-footer">
          © {new Date().getFullYear()} NeyFuel. Every mile, connected.
        </footer>
      </main>
    </div>
  );
}
