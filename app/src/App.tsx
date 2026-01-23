import { Navigate, Route, Routes } from "react-router-dom"
import AppLayout from "./layouts/AppLayout"
import LiveShowsPage from "./pages/LiveShowsPage"
import InterviewsPage from "./pages/InterviewsPage"
import MerchPage from "./pages/MerchPage"

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<LiveShowsPage />} />
        <Route path="/interviews" element={<InterviewsPage />} />
        <Route path="/merch" element={<MerchPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
