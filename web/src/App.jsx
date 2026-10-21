import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuth from './stores/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import GamePage from './pages/GamePage';
import BrowsePage from './pages/BrowsePage';
import StatsPage from './pages/StatsPage';
import ShopPage from './pages/ShopPage';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="game/:id" element={<GamePage />} />
        <Route path="browse" element={<BrowsePage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="shop" element={<ShopPage />} />
      </Route>
    </Routes>
  );
}
