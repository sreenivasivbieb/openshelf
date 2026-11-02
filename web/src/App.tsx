import { Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { UploadPage } from "./pages/UploadPage";
import { MappingReviewPage } from "./pages/MappingReviewPage";
import { StoreReadyPage } from "./pages/StoreReadyPage";
import { DashboardPage } from "./pages/DashboardPage";

/** Merchant journey: upload -> review mapping -> store ready (MCP URL) -> dashboard. */
export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<UploadPage />} />
        <Route path="/stores/:merchantId/mapping" element={<MappingReviewPage />} />
        <Route path="/stores/:merchantId/ready" element={<StoreReadyPage />} />
        <Route path="/stores/:merchantId/dashboard" element={<DashboardPage />} />
      </Route>
    </Routes>
  );
}
