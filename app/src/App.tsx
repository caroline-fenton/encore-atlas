import { Route, Routes } from "react-router-dom"
import AppLayout from "./layouts/AppLayout"
import LiveShowsPage from "./pages/LiveShowsPage"
import InterviewsPage from "./pages/InterviewsPage"
import MerchPage from "./pages/MerchPage"
import LandingPage from "./pages/LandingPage"

const RECENT_SEARCHES_KEY = "encore_atlas_recent_searches"

function hasSearched(): boolean {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!raw) return false
    const searches = JSON.parse(raw)
    return Array.isArray(searches) && searches.length > 0
  } catch {
    return false
  }
}

function HomePage() {
  if (!hasSearched()) {
    return <LandingPage />
  }
  return <LiveShowsPage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="interviews" element={<InterviewsPage />} />
        <Route path="merch" element={<MerchPage />} />
      </Route>
    </Routes>
  )
}
