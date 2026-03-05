import { Navigate, Route, Routes } from "react-router-dom";
import PubsPage from "../pages/PubsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PubsPage />} />
      <Route path="/pubs" element={<PubsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
