import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useMe } from "./api/hooks";
import AuditPage from "./pages/AuditPage";
import BrainAuthor from "./pages/BrainAuthor";
import BrainsList from "./pages/BrainsList";
import ExpertAnswer from "./pages/ExpertAnswer";
import InsightsPage from "./pages/InsightsPage";
import Login from "./pages/Login";
import RunPage from "./pages/RunPage";
import ActivityPage from "./pages/ActivityPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import RunTrace from "./pages/RunTrace";
import Settings from "./pages/Settings";
import UpdatePage from "./pages/UpdatePage";
import WorkspaceMap from "./pages/WorkspaceMap";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useMe();
  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <span className="dim">Loading…</span>
      </div>
    );
  }
  if (isError || !user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <div className="brain-ui" style={{ height: "100%" }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/q/:token" element={<ExpertAnswer />} />
          <Route path="/update/:token" element={<UpdatePage />} />
          <Route
            path="/map"
            element={
              <RequireAuth>
                <WorkspaceMap />
              </RequireAuth>
            }
          />
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
            path="/brains/:slug/analytics"
            element={
              <RequireAuth>
                <AnalyticsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/brains/:slug/activity"
            element={
              <RequireAuth>
                <ActivityPage />
              </RequireAuth>
            }
          />
          <Route
            path="/brains/:slug/run"
            element={
              <RequireAuth>
                <RunPage />
              </RequireAuth>
            }
          />
          <Route
            path="/brains/:slug/runs/:run_id"
            element={
              <RequireAuth>
                <RunTrace />
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
          <Route
            path="/audit"
            element={
              <RequireAuth>
                <AuditPage />
              </RequireAuth>
            }
          />
          <Route
            path="/insights"
            element={
              <RequireAuth>
                <InsightsPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}
