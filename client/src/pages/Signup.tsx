import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(username, email, password);
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
          <label className="block text-sm font-medium text-lbx-muted mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={2}
            maxLength={50}
            className="w-full px-4 py-2.5 bg-lbx-card border border-lbx-border rounded-md text-lbx-white placeholder-lbx-muted focus:border-lbx-green focus:ring-1 focus:ring-lbx-green focus:outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-lbx-muted mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-lbx-card border border-lbx-border rounded-md text-lbx-white placeholder-lbx-muted focus:border-lbx-green focus:ring-1 focus:ring-lbx-green focus:outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-lbx-muted mb-1">Password (min 8 characters)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-4 py-2.5 bg-lbx-card border border-lbx-border rounded-md text-lbx-white placeholder-lbx-muted focus:border-lbx-green focus:ring-1 focus:ring-lbx-green focus:outline-none text-sm"
          />
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
