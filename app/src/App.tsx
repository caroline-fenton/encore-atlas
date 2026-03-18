import { Route, Routes } from "react-router-dom"
import { useState } from "react"
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
  const [showLanding, setShowLanding] = useState(!hasSearched())

  if (showLanding) {
    return <LandingPage onComplete={() => setShowLanding(false)} />
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
