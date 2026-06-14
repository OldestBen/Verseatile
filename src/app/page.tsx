'use client'

import { useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface Artist {
  id: number
  name: string
  image_url: string | null
  header_image_url: string | null
  url: string
}

function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <Link
      href={`/artist/${artist.id}`}
      className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-surface card-hover cursor-pointer"
    >
      <div className="relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-border">
        {artist.image_url ? (
          <Image
            src={artist.image_url}
            alt={artist.name}
            fill
            className="object-cover"
            sizes="56px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted text-xl font-bold">
            {artist.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text-primary truncate group-hover:text-accent transition-colors">
          {artist.name}
        </p>
        <p className="text-sm text-text-muted mt-0.5">View discography →</p>
      </div>
    </Link>
  )
}

export default function HomePage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Artist[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setSearched(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setResults(data.artists)
      setSearched(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 400)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    search(query)
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero section */}
      <section className="flex flex-col items-center justify-center flex-1 px-4 pt-24 pb-12">
        {/* Logo / title */}
        <div className="mb-3 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 12 L8 3 L14 12" stroke="#08080a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4.5 8.5 L11.5 8.5" stroke="#08080a" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        <h1 className="text-6xl md:text-7xl font-bold tracking-tight text-gradient mb-4 text-center">
          Verseatile
        </h1>
        <p className="text-text-muted text-lg md:text-xl text-center mb-10 max-w-md">
          Search any artist, explore their full discography, and read every lyric.
        </p>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="w-full max-w-xl relative">
          <div className="relative group">
            <div className="absolute inset-0 rounded-2xl bg-accent opacity-0 group-focus-within:opacity-10 transition-opacity blur-xl" />
            <div className="relative flex items-center border border-border rounded-2xl bg-surface overflow-hidden group-focus-within:border-accent group-focus-within:glow-accent-strong transition-all">
              <div className="pl-5 text-text-muted flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
              <input
                type="text"
                value={query}
                onChange={handleChange}
                placeholder="Search artists..."
                className="flex-1 bg-transparent px-4 py-4 text-lg text-text-primary placeholder-text-muted outline-none"
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
              {loading && (
                <div className="pr-5 text-accent">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                </div>
              )}
              {!loading && query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setResults([]); setSearched(false) }}
                  className="pr-5 text-text-muted hover:text-text-primary transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Keyboard hint */}
          <p className="text-center text-text-muted text-xs mt-3">
            Press <kbd className="px-1.5 py-0.5 rounded border border-border bg-surface text-text-muted text-xs">Enter</kbd> to search
          </p>
        </form>
      </section>

      {/* Results */}
      {(results.length > 0 || (searched && !loading)) && (
        <section className="px-4 pb-16 max-w-xl mx-auto w-full">
          {error ? (
            <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-red-400 text-sm">
              {error}
            </div>
          ) : results.length === 0 ? (
            <div className="text-center text-text-muted py-8">
              <p className="text-lg">No artists found</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-text-muted text-sm mb-4">
                Found {results.length} artist{results.length !== 1 ? 's' : ''}
              </p>
              {results.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Footer */}
      <footer className="text-center text-text-muted text-xs py-6 border-t border-border">
        Powered by the Genius API
      </footer>
    </main>
  )
}
