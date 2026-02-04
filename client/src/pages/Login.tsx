import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="font-display font-bold text-2xl text-lbx-white mb-2 tracking-tight">Log in</h1>
      <p className="text-lbx-muted text-sm mb-6">Sign in to check in and save places to lists.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-lbx-muted mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            className="w-full px-4 py-2.5 bg-lbx-card border border-lbx-border rounded-md text-lbx-white placeholder-lbx-muted focus:border-lbx-green focus:ring-1 focus:ring-lbx-green focus:outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-lbx-muted mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-lbx-card border border-lbx-border rounded-md text-lbx-white placeholder-lbx-muted focus:border-lbx-green focus:ring-1 focus:ring-lbx-green focus:outline-none text-sm"
          />
        </div>
        {error && <p className="text-lbx-red text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-lbx-green text-lbx-dark rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity text-sm"
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
      <p className="mt-6 text-center text-lbx-muted text-sm">
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="text-lbx-green hover:text-lbx-white transition-colors">Sign up</Link>
      </p>
    </div>
  );
}
