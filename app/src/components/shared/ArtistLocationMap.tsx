import { useState, useEffect, memo } from "react"
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps"

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

const PALETTE = [
  "#c44536", "#5bc0eb", "#d5e68d", "#2d6a8f",
  "#f4a6d7", "#4a7c59", "#e8a87c", "#7a4988",
  "#95dab6", "#8b5e3c", "#b5e3f0", "#8f3b4a",
]

type Props = {
  city: string
  colorIndex?: number
}

function ArtistLocationMap({ city, colorIndex = 0 }: Props) {
  const [coords, setCoords] = useState<[number, number] | null>(null)

  useEffect(() => {
    if (!city) return

    let cancelled = false

    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
      { headers: { "User-Agent": "EncoreAtlas/1.0" } },
    )
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.[0]) {
          setCoords([parseFloat(data[0].lon), parseFloat(data[0].lat)])
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [city])

  if (!coords) return null

  const markerColor = PALETTE[colorIndex % PALETTE.length]

  return (
    <div className="overflow-hidden border border-stone-200">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          center: coords,
          scale: 200,
        }}
        width={400}
        height={280}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#e8e0d0"
                stroke="#d4c9b8"
                strokeWidth={0.5}
                style={{
                  default: { outline: "none" },
                  hover: { outline: "none" },
                  pressed: { outline: "none" },
                }}
              />
            ))
          }
        </Geographies>
        <Marker coordinates={coords}>
          <circle r={6} fill={markerColor} stroke="#fff" strokeWidth={2} />
          <circle r={12} fill={markerColor} fillOpacity={0.2} />
        </Marker>
      </ComposableMap>
    </div>
  )
}

export default memo(ArtistLocationMap)
