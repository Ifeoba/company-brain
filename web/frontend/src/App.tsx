import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useMe } from "./api/hooks";
import BrainAuthor from "./pages/BrainAuthor";
import BrainsList from "./pages/BrainsList";
import ExpertAnswer from "./pages/ExpertAnswer";
import Login from "./pages/Login";
import Settings from "./pages/Settings";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useMe();
  if (isLoading) return <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Loading…</div>;
  if (isError || !user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/q/:token" element={<ExpertAnswer />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <BrainsList />
            </RequireAuth>
          }
        />
        <Route
          path="/brains/:slug"
          element={
            <RequireAuth>
              <BrainAuthor />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <Settings />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
