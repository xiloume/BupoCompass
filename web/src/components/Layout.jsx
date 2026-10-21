import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import useAuth from '../stores/useAuth';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/50 hover:text-white/80'
    }`;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-dark-900/95 backdrop-blur border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-emerald-400 font-bold text-lg">&#x2B21; BupoCompass</span>
            <nav className="hidden sm:flex items-center gap-1">
              <NavLink to="/" className={linkClass} end>
                Dashboard
              </NavLink>
              <NavLink to="/browse" className={linkClass}>
                Parcourir
              </NavLink>
              <NavLink to="/stats" className={linkClass}>
                Stats
              </NavLink>
              <NavLink to="/shop" className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-yellow-500/20 text-yellow-400' : 'text-yellow-400/50 hover:text-yellow-400/80'
                }`
              }>
                VIP
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/40 text-sm hidden sm:block">{user?.username}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-white/40 hover:text-red-400 transition-colors"
            >
              D&eacute;connexion
            </button>
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-dark-900/95 backdrop-blur border-t border-white/5 flex">
        <NavLink to="/" className={({ isActive }) => `flex-1 py-3 text-center text-xs ${isActive ? 'text-emerald-400' : 'text-white/40'}`} end>
          Dashboard
        </NavLink>
        <NavLink to="/browse" className={({ isActive }) => `flex-1 py-3 text-center text-xs ${isActive ? 'text-emerald-400' : 'text-white/40'}`}>
          Parcourir
        </NavLink>
        <NavLink to="/stats" className={({ isActive }) => `flex-1 py-3 text-center text-xs ${isActive ? 'text-emerald-400' : 'text-white/40'}`}>
          Stats
        </NavLink>
        <NavLink to="/shop" className={({ isActive }) => `flex-1 py-3 text-center text-xs ${isActive ? 'text-yellow-400' : 'text-yellow-400/40'}`}>
          VIP
        </NavLink>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 pb-20 sm:pb-6">
        <Outlet />
      </main>
    </div>
  );
}
