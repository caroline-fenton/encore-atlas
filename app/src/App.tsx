import { Analytics } from '@vercel/analytics/react';
import { Route, Routes } from "react-router-dom"
import AppLayout from "./layouts/AppLayout"
import LiveShowsPage from "./pages/LiveShowsPage"
import MusicVideosPage from "./pages/MusicVideosPage"
import InterviewsPage from "./pages/InterviewsPage"
import MerchPage from "./pages/MerchPage"
import WatchHistoryPage from "./pages/WatchHistoryPage"

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<LiveShowsPage />} />
          <Route path="music-videos" element={<MusicVideosPage />} />
          <Route path="interviews" element={<InterviewsPage />} />
          <Route path="merch" element={<MerchPage />} />
          <Route path="history" element={<WatchHistoryPage />} />
        </Route>
      </Routes>

      <Analytics />
    </>
  )
}
