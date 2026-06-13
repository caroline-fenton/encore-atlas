import { Analytics } from '@vercel/analytics/react';
import { Route, Routes } from "react-router-dom"
import AppLayout from "./layouts/AppLayout"
import LiveShowsPage from "./pages/LiveShowsPage"
import MusicVideosPage from "./pages/MusicVideosPage"
import InterviewsPage from "./pages/InterviewsPage"
import WatchHistoryPage from "./pages/WatchHistoryPage"
import AdminContentRefreshPage from "./pages/AdminContentRefreshPage"
import SceneExplorerPage from "./pages/SceneExplorerPage"

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/admin/content-refresh" element={<AdminContentRefreshPage />} />
        <Route path="/" element={<AppLayout />}>
          <Route index element={<LiveShowsPage />} />
          <Route path="music-videos" element={<MusicVideosPage />} />
          <Route path="interviews" element={<InterviewsPage />} />
          <Route path="history" element={<WatchHistoryPage />} />
          <Route path="scenes" element={<SceneExplorerPage />} />
        </Route>
      </Routes>

      <Analytics />
    </>
  )
}
