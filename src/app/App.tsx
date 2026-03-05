import { Link, Route, Routes } from "react-router-dom";
import HomePage from "../pages/HomePage";
import PubsPage from "../pages/PubsPage";

export default function App() {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 16 }}>
      <header style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Link to="/">Home</Link>
        <Link to="/pubs">Pubs</Link>
      </header>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/pubs" element={<PubsPage />} />
      </Routes>
    </div>
  );
}
