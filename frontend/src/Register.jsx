import { useState } from "react";

const AUTH_API = "http://localhost:5000/api/auth";

function Register({ onBack }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "buyer",
    verificationMethod: "email",
  });
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState("details");
  const [maskedDestination, setMaskedDestination] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event) => {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  };

  const sendCode = async (event) => {
    event.preventDefault();
    setMessage("");
    if (form.password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${AUTH_API}/register/send-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not send the verification code.");
      setMaskedDestination(data.maskedDestination || "your selected contact");
      setStep("verification");
      setMessage(data.message || "Verification code sent.");
    } catch (error) {
      setMessage(error.message === "Failed to fetch" ? "Cannot connect to server. Please try again." : error.message);
    } finally {
      setLoading(false);
    }
  };

  const createAccount = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!/^\d{6}$/.test(verificationCode)) {
      setMessage("Enter the six-digit code.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${AUTH_API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, verificationCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Registration failed.");
      setStep("complete");
      setMessage("Account created and contact verified. You can now log in.");
    } catch (error) {
      setMessage(error.message === "Failed to fetch" ? "Cannot connect to server. Please try again." : error.message);
    } finally {
      setLoading(false);
    }
  };

  const changeDetails = () => {
    setStep("details");
    setVerificationCode("");
    setMessage("");
  };

  return (
    <div className="register-page">
      <form className="register-form" onSubmit={step === "details" ? sendCode : createAccount}>
        <h2>{step === "verification" ? "Verify Your Contact" : step === "complete" ? "Account Created" : "Create Your SourceBD Account"}</h2>
        <p>{step === "verification" ? `Enter the code sent to ${maskedDestination}.` : "Join Bangladesh's business sourcing community."}</p>

        {step === "details" && <>
          <label htmlFor="name">Full Name</label>
          <input id="name" name="name" value={form.name} onChange={handleChange} placeholder="Enter your full name" autoComplete="name" required />

          <label htmlFor="email">Email Address</label>
          <input id="email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="Enter your email" autoComplete="email" required />

          <label htmlFor="phone">Phone Number</label>
          <input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="01XXXXXXXXX or +8801XXXXXXXXX" autoComplete="tel" required />

          <label htmlFor="verificationMethod">Verify using</label>
          <select id="verificationMethod" name="verificationMethod" value={form.verificationMethod} onChange={handleChange}>
            <option value="email">Email</option>
            <option value="phone">Phone number (SMS)</option>
          </select>

          <label htmlFor="password">Password</label>
          <div className="password-input-wrapper">
            <input id="password" name="password" type={showPassword ? "text" : "password"} value={form.password} onChange={handleChange} placeholder="Minimum 8 characters" minLength={8} autoComplete="new-password" required />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          <label htmlFor="role">Account Type</label>
          <select id="role" name="role" value={form.role} onChange={handleChange}>
            <option value="buyer">Buyer</option>
            <option value="supplier">Supplier</option>
          </select>
          <button type="submit" disabled={loading}>{loading ? "Sending Code..." : "Send Verification Code"}</button>
        </>}

        {step === "verification" && <>
          <label htmlFor="verificationCode">6-digit verification code</label>
          <input id="verificationCode" name="verificationCode" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Enter code" required />
          <button type="submit" disabled={loading}>{loading ? "Verifying..." : "Verify & Create Account"}</button>
          <button type="button" onClick={sendCode} disabled={loading}>Resend Code</button>
          <button type="button" onClick={changeDetails} disabled={loading}>Change Details</button>
        </>}

        {step === "complete" && <button type="button" onClick={onBack}>Go to Login</button>}
        {message && <p role="status">{message}</p>}
        {step !== "complete" && onBack && <button type="button" onClick={onBack} disabled={loading}>Back to Login</button>}
      </form>
    </div>
  );
}

export default Register;
