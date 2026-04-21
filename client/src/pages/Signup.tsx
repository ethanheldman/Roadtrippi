import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmedUsername = username.trim();
    // Quick client-side checks — the server enforces the same rules too.
    if (trimmedUsername.length < 2) {
      setError("Username must be at least 2 characters.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await register(trimmedUsername, email, password);
      navigate("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="font-display font-bold text-2xl text-lbx-white mb-2 tracking-tight">Sign up</h1>
      <p className="text-lbx-muted text-sm mb-6">Create an account to check in and save places to lists.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="signup-username" className="block text-sm font-medium text-lbx-muted mb-1">Username</label>
          <input
            id="signup-username"
            name="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={2}
            maxLength={50}
            autoComplete="username"
            className="w-full px-4 py-2.5 bg-lbx-card border border-lbx-border rounded-md text-lbx-white placeholder-lbx-muted focus:border-lbx-green focus:ring-1 focus:ring-lbx-green focus:outline-none text-sm"
          />
        </div>
        <div>
          <label htmlFor="signup-email" className="block text-sm font-medium text-lbx-muted mb-1">Email</label>
          <input
            id="signup-email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full px-4 py-2.5 bg-lbx-card border border-lbx-border rounded-md text-lbx-white placeholder-lbx-muted focus:border-lbx-green focus:ring-1 focus:ring-lbx-green focus:outline-none text-sm"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="signup-password" className="block text-sm font-medium text-lbx-muted">Password (min 8 characters)</label>
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="text-xs text-lbx-muted hover:text-lbx-green transition-colors"
              aria-pressed={showPassword}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <input
            id="signup-password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full px-4 py-2.5 bg-lbx-card border border-lbx-border rounded-md text-lbx-white placeholder-lbx-muted focus:border-lbx-green focus:ring-1 focus:ring-lbx-green focus:outline-none text-sm"
          />
        </div>
        <div>
          <label htmlFor="signup-confirm" className="block text-sm font-medium text-lbx-muted mb-1">Confirm password</label>
          <input
            id="signup-confirm"
            name="confirm"
            type={showPassword ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className={`w-full px-4 py-2.5 bg-lbx-card border rounded-md text-lbx-white placeholder-lbx-muted focus:ring-1 focus:outline-none text-sm transition-colors ${
              confirm && password !== confirm
                ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/50"
                : "border-lbx-border focus:border-lbx-green focus:ring-lbx-green"
            }`}
          />
          {confirm && password !== confirm && (
            <p className="mt-1 text-xs text-red-400">Passwords don't match</p>
          )}
        </div>
        {error && <p className="text-lbx-red text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-lbx-green text-lbx-dark rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity text-sm"
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>
      <p className="mt-6 text-center text-lbx-muted text-sm">
        Already have an account?{" "}
        <Link to="/login" className="text-lbx-green hover:text-lbx-white transition-colors">Log in</Link>
      </p>
    </div>
  );
}
