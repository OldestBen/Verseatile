'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface Artist {
  id: number
  name: string
  image_url: string
  header_image_url: string
  url: string
}

export default function HomePage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Artist[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError(null)
    setSearched(true)

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Search failed')
      }
      const data = await res.json()
      setResults(data.artists)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [query])

  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-20 relative overflow-hidden">
        {/* Background gradient orb */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, #a78bfa 0%, #6366f1 50%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />

        <div className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-8">
          {/* Title */}
          <div className="text-center">
            <h1
              className="text-6xl font-bold tracking-tight mb-3"
              style={{
                background: 'linear-gradient(135deg, #a78bfa 0%, #818cf8 50%, #6366f1 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Verseatile
            </h1>
            <p className="text-text-muted text-lg">
              Search artists. Browse their discography. Read every lyric.
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="w-full">
            <div className="relative flex items-center">
              <div className="absolute left-5 text-text-muted pointer-events-none">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for an artist..."
                className="w-full pl-14 pr-32 py-4 rounded-full text-lg bg-surface border border-border text-text-primary placeholder-text-muted outline-none transition-all duration-200 focus:border-accent"
                style={{
                  boxShadow: query ? '0 0 0 2px rgba(167, 139, 250, 0.2)' : undefined,
                }}
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="absolute right-2 px-6 py-2.5 rounded-full font-medium text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #a78bfa, #6366f1)',
                  color: 'white',
                }}
              >
                {loading ? 'Searching…' : 'Search'}
              </button>
            </div>
          </form>

          {/* Error */}
          {error && (
            <div className="w-full px-4 py-3 rounded-xl border border-red-900/50 bg-red-950/30 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Results Section */}
      {(searched || results.length > 0) && (
        <div className="w-full max-w-5xl mx-auto px-4 pb-16">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl overflow-hidden bg-surface border border-border animate-pulse"
                  style={{ aspectRatio: '3/4' }}
                />
              ))}
            </div>
          ) : results.length === 0 && searched ? (
            <div className="text-center text-text-muted py-12">
              <p className="text-lg">No artists found for &ldquo;{query}&rdquo;</p>
              <p className="text-sm mt-2">Try a different search term</p>
            </div>
          ) : (
            <>
              <p className="text-text-muted text-sm mb-4">{results.length} artists found</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {results.map((artist) => (
                  <Link
                    key={artist.id}
                    href={`/artist/${artist.id}`}
                    className="group rounded-2xl overflow-hidden bg-surface border border-border hover:border-accent transition-all duration-200 hover:shadow-lg"
                    style={{
                      boxShadow: undefined,
                    }}
                  >
                    <div className="relative" style={{ aspectRatio: '1/1' }}>
                      {artist.image_url ? (
                        <Image
                          src={artist.image_url}
                          alt={artist.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                        />
                      ) : (
                        <div className="w-full h-full bg-surface flex items-center justify-center">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.5">
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-medium text-sm text-text-primary truncate group-hover:text-accent transition-colors duration-200">
                        {artist.name}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="text-center text-text-muted text-xs py-6 border-t border-border">
        Powered by Genius API · Verseatile
      </footer>
    </main>
  )
}
