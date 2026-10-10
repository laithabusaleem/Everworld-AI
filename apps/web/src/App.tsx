import { Navigate, Route, Routes } from "react-router-dom";
import { CreatePage } from "./pages/CreatePage";
import { ExperimentPage } from "./pages/ExperimentPage";
import { HomePage } from "./pages/HomePage";
import { WorldPage } from "./pages/WorldPage";

export function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <h1 className="brand">
          Ever<span>world</span> AI
        </h1>
        <span className="badge">society sandbox</span>
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/world/:id" element={<WorldPage />} />
        <Route path="/world/:id/experiment" element={<ExperimentPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
