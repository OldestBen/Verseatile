'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface Artist {
  id: number
  name: string
  image_url: string | null
  header_image_url: string | null
  url: string
  followers_count?: number
  description?: string
}

interface Song {
  id: number
  title: string
  full_title: string
  url: string
  path: string
  song_art_image_url: string | null
  primary_artist: { id: number; name: string }
  album?: { id: number; name: string; cover_art_url: string | null } | null
  release_date_for_display?: string | null
}

function groupByAlbum(songs: Song[]): { label: string; songs: Song[] }[] {
  const groups = new Map<string, Song[]>()
  for (const song of songs) {
    const label = song.album?.name ?? 'Singles & Other'
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(song)
  }
  return Array.from(groups.entries()).map(([label, songs]) => ({ label, songs }))
}

function SongRow({ song, index }: { song: Song; index: number }) {
  return (
    <Link
      href={`/song/${song.id}`}
      className="group flex items-center gap-4 px-4 py-3 rounded-xl border border-transparent hover:border-border hover:bg-surface card-hover transition-all"
    >
      <span className="w-6 text-right text-text-muted text-sm flex-shrink-0 group-hover:hidden">
        {index + 1}
      </span>
      <span className="w-6 text-right flex-shrink-0 hidden group-hover:block">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-accent ml-auto">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </span>
      {song.song_art_image_url ? (
        <div className="relative w-10 h-10 rounded-md overflow-hidden flex-shrink-0 bg-border">
          <Image src={song.song_art_image_url} alt={song.title} fill className="object-cover" sizes="40px" />
        </div>
      ) : (
        <div className="w-10 h-10 rounded-md bg-border flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-text-primary text-sm font-medium truncate group-hover:text-accent transition-colors">
          {song.title}
        </p>
        {song.release_date_for_display && (
          <p className="text-text-muted text-xs mt-0.5">{song.release_date_for_display}</p>
        )}
      </div>
      <svg
        width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2"
        className="text-text-muted group-hover:text-accent transition-colors flex-shrink-0"
      >
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </Link>
  )
}

export default function ArtistPage() {
  const { id } = useParams<{ id: string }>()
  const [artist, setArtist] = useState<Artist | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [songsLoading, setSongsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [view, setView] = useState<'grouped' | 'list'>('grouped')

  useEffect(() => {
    async function loadArtist() {
      try {
        const res = await fetch(`/api/artist/${id}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load artist')
        setArtist(data.artist)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load artist')
      } finally {
        setLoading(false)
      }
    }
    loadArtist()
  }, [id])

  useEffect(() => {
    async function loadSongs() {
      try {
        const res = await fetch(`/api/artist/${id}/songs`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load songs')
        setSongs(data.songs)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load songs')
      } finally {
        setSongsLoading(false)
      }
    }
    loadSongs()
  }, [id])

  const downloadAllLyrics = useCallback(async () => {
    if (!artist || songs.length === 0) return
    setDownloading(true)

    const lines: string[] = [`# ${artist.name} — Complete Lyrics\n`]

    for (const song of songs) {
      try {
        const res = await fetch(`/api/lyrics/${song.id}`)
        const data = await res.json()
        lines.push(`## ${song.title}`)
        if (song.album?.name) lines.push(`Album: ${song.album.name}`)
        if (song.release_date_for_display) lines.push(`Released: ${song.release_date_for_display}`)
        lines.push('')
        lines.push(data.lyrics || '(lyrics not available)')
        lines.push('\n---\n')
      } catch {
        lines.push(`## ${song.title}\n(could not fetch lyrics)\n\n---\n`)
      }
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${artist.name.replace(/[^a-z0-9]/gi, '_')}_lyrics.txt`
    a.click()
    URL.revokeObjectURL(url)
    setDownloading(false)
  }, [artist, songs])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-text-muted">
          <svg className="animate-spin w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading artist…
        </div>
      </div>
    )
  }

  if (error || !artist) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-400">{error || 'Artist not found'}</p>
        <Link href="/" className="text-accent hover:underline text-sm">← Back to search</Link>
      </div>
    )
  }

  const groups = groupByAlbum(songs)

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative h-64 md:h-80 overflow-hidden">
        {artist.header_image_url ? (
          <>
            <Image
              src={artist.header_image_url}
              alt={artist.name}
              fill
              className="object-cover scale-105"
              sizes="100vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-background" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-accent-dim/20 to-background" />
        )}

        {/* Back link */}
        <Link
          href="/"
          className="absolute top-5 left-5 flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors z-10"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Search
        </Link>

        {/* Artist info */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 flex items-end gap-5">
          {artist.image_url && (
            <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-white/20 flex-shrink-0 shadow-xl">
              <Image src={artist.image_url} alt={artist.name} fill className="object-cover" sizes="112px" />
            </div>
          )}
          <div className="pb-1">
            <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight leading-none">
              {artist.name}
            </h1>
            {!songsLoading && (
              <p className="text-white/60 text-sm mt-2">
                {songs.length} song{songs.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 md:px-8 py-5 flex items-center justify-between gap-4 border-b border-border">
        <div className="flex gap-1 bg-surface rounded-lg p-1">
          <button
            onClick={() => setView('grouped')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'grouped' ? 'bg-accent text-background' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            By Album
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'list' ? 'bg-accent text-background' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            All Songs
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/visualize/${id}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all"
            style={{
              borderColor: 'rgba(167,139,250,0.4)',
              color: '#a78bfa',
              background: 'rgba(167,139,250,0.07)',
              boxShadow: '0 0 12px rgba(167,139,250,0.12)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="5" cy="12" r="2.5"/>
              <circle cx="19" cy="5" r="2.5"/>
              <circle cx="19" cy="19" r="2.5"/>
              <line x1="7.5" y1="11" x2="16.5" y2="6.5"/>
              <line x1="7.5" y1="13" x2="16.5" y2="17.5"/>
            </svg>
            Visualize
          </Link>

        <button
          onClick={downloadAllLyrics}
          disabled={downloading || songsLoading || songs.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface text-text-muted hover:text-text-primary hover:border-accent transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {downloading ? (
            <>
              <svg className="animate-spin w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Downloading…
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download All Lyrics
            </>
          )}
        </button>
        </div>
      </div>

      {/* Song list */}
      <div className="px-4 md:px-8 py-6 max-w-4xl">
        {songsLoading ? (
          <div className="flex items-center gap-3 text-text-muted py-8">
            <svg className="animate-spin w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Loading songs…
          </div>
        ) : songs.length === 0 ? (
          <p className="text-text-muted py-8">No songs found for this artist.</p>
        ) : view === 'list' ? (
          <div className="space-y-1">
            {songs.map((song, i) => (
              <SongRow key={song.id} song={song} index={i} />
            ))}
          </div>
        ) : (
          <div className="space-y-10">
            {groups.map(({ label, songs: groupSongs }) => (
              <div key={label}>
                <h2 className="text-text-muted text-xs font-semibold uppercase tracking-widest mb-3 px-4">
                  {label}
                </h2>
                <div className="space-y-1">
                  {groupSongs.map((song, i) => (
                    <SongRow key={song.id} song={song} index={i} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
