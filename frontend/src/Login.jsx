
import { useState } from "react";

function Login({ onLoginSuccess, onBack }) {
  const [form, setForm] = useState({
    identifier: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed.");
      }

      if (!data.token) {
        throw new Error("Login token was not received.");
      }

      const user = data.user;

      if (!user || !user.role) {
        throw new Error("User information was not received from the server.");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(user));

      setForm({
        identifier: "",
        password: "",
      });

      if (onLoginSuccess) {
        onLoginSuccess(user);
      } else {
        setMessage("Login successful! Please refresh the application.");
      }
    } catch (error) {
      setMessage(
        error.message === "Failed to fetch"
          ? "Cannot connect to server. Please try again."
          : error.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <form className="register-form" onSubmit={handleSubmit}>
        <h2>Welcome Back to SourceBD</h2>
        <p>Log in to your account.</p>

        <label htmlFor="login-identifier">Email or Phone Number</label>
        <input
          id="login-identifier"
          type="text"
          name="identifier"
          value={form.identifier}
          onChange={handleChange}
          placeholder="Enter email or verified phone number"
          autoComplete="username"
          required
        />

        <label htmlFor="login-password">Password</label>

        <div className="password-input-wrapper">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={
              showPassword ? "Hide password" : "Show password"
            }
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>

        {message && <p role="status">{message}</p>}

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
          >
            Back to Home
          </button>
        )}
      </form>
    </div>
  );
}

export default Login;
