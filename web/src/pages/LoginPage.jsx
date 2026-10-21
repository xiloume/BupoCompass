import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../stores/useAuth';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, register, error, loading, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    let success;
    if (mode === 'login') {
      success = await login(email, password);
    } else {
      success = await register(email, username, password);
    }
    if (success) navigate('/');
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    clearError();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-emerald-400 text-4xl">&#x2B21;</span>
          <h1 className="text-2xl font-bold text-white mt-2">BupoCompass</h1>
          <p className="text-white/40 text-sm mt-1">Game Completion Tracker</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-white/50 text-xs block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-dark-800 text-white rounded-lg px-4 py-3 border border-white/10 outline-none focus:border-emerald-400/50 text-sm"
              placeholder="email@exemple.com"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="text-white/50 text-xs block mb-1">Pseudo</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-dark-800 text-white rounded-lg px-4 py-3 border border-white/10 outline-none focus:border-emerald-400/50 text-sm"
                placeholder="MonPseudo"
              />
            </div>
          )}

          <div>
            <label className="text-white/50 text-xs block mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full bg-dark-800 text-white rounded-lg px-4 py-3 border border-white/10 outline-none focus:border-emerald-400/50 text-sm"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading
              ? '...'
              : mode === 'login'
                ? 'Se connecter'
                : "S'inscrire"}
          </button>
        </form>

        <p className="text-center text-white/40 text-sm mt-4">
          {mode === 'login' ? 'Pas de compte ?' : 'D\u00e9j\u00e0 un compte ?'}{' '}
          <button onClick={switchMode} className="text-emerald-400 hover:underline">
            {mode === 'login' ? "S'inscrire" : 'Se connecter'}
          </button>
        </p>
      </div>
    </div>
  );
}
