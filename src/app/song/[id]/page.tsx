'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface Song {
  id: number
  title: string
  full_title: string
  url: string
  path: string
  song_art_image_url: string | null
  header_image_url: string | null
  primary_artist: { id: number; name: string; image_url: string | null }
  album?: { id: number; name: string; cover_art_url: string | null } | null
  release_date_for_display?: string | null
}

function LyricsBlock({ lyrics }: { lyrics: string }) {
  const sections = lyrics.split(/\n{2,}/)

  return (
    <div className="space-y-6 font-serif text-[1.05rem] leading-[1.9] text-text-primary">
      {sections.map((section, i) => {
        const isHeader = section.trim().startsWith('[') && section.trim().endsWith(']')
        if (isHeader) {
          return (
            <p key={i} className="text-accent font-sans text-xs font-semibold uppercase tracking-widest not-italic">
              {section.trim().slice(1, -1)}
            </p>
          )
        }
        return (
          <div key={i} className="space-y-0.5">
            {section.split('\n').map((line, j) => (
              <p key={j} className={line === '' ? 'h-3' : ''}>
                {line || ' '}
              </p>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export default function SongPage() {
  const { id } = useParams<{ id: string }>()
  const [song, setSong] = useState<Song | null>(null)
  const [lyrics, setLyrics] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/lyrics/${id}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load lyrics')
        setSong(data.song)
        setLyrics(data.lyrics)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load lyrics')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const copyToClipboard = useCallback(async () => {
    if (!lyrics || !song) return
    await navigator.clipboard.writeText(`${song.full_title}\n\n${lyrics}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [lyrics, song])

  const downloadLyrics = useCallback(() => {
    if (!lyrics || !song) return
    const content = `${song.full_title}\n${'─'.repeat(40)}\n\n${lyrics}`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${song.title.replace(/[^a-z0-9]/gi, '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [lyrics, song])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-text-muted">
          <svg className="animate-spin w-6 h-6 text-accent" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span className="text-sm">Fetching lyrics…</span>
        </div>
      </div>
    )
  }

  if (error || !song) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-400">{error || 'Song not found'}</p>
        <Link href="/" className="text-accent hover:underline text-sm">← Back to search</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Top nav */}
      <nav className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border px-4 md:px-8 py-3 flex items-center gap-3">
        <Link
          href={`/artist/${song.primary_artist.id}`}
          className="flex items-center gap-1.5 text-text-muted hover:text-text-primary text-sm transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          {song.primary_artist.name}
        </Link>
        <span className="text-border">/</span>
        <span className="text-text-muted text-sm truncate">{song.title}</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface text-text-muted hover:text-text-primary hover:border-accent transition-all text-xs"
          >
            {copied ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                Copy
              </>
            )}
          </button>
          <button
            onClick={downloadLyrics}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface text-text-muted hover:text-text-primary hover:border-accent transition-all text-xs"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download
          </button>
        </div>
      </nav>

      {/* Song header */}
      <div className="relative">
        {/* Background art */}
        {(song.header_image_url || song.song_art_image_url) && (
          <div className="absolute inset-0 h-64 overflow-hidden">
            <Image
              src={song.header_image_url || song.song_art_image_url!}
              alt={song.title}
              fill
              className="object-cover opacity-20 blur-2xl scale-110"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/60 to-background" />
          </div>
        )}

        <div className="relative px-4 md:px-8 pt-10 pb-8 max-w-3xl mx-auto flex gap-6 items-end">
          {song.song_art_image_url && (
            <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-xl overflow-hidden shadow-2xl flex-shrink-0">
              <Image
                src={song.song_art_image_url}
                alt={song.title}
                fill
                className="object-cover"
                sizes="144px"
                priority
              />
            </div>
          )}
          <div className="pb-1 min-w-0">
            <p className="text-accent text-xs font-semibold uppercase tracking-widest mb-2">Song</p>
            <h1 className="text-2xl md:text-4xl font-bold text-text-primary leading-tight mb-2 truncate">
              {song.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
              <span className="font-medium text-text-primary">{song.primary_artist.name}</span>
              {song.album && (
                <>
                  <span className="text-border">·</span>
                  <span>{song.album.name}</span>
                </>
              )}
              {song.release_date_for_display && (
                <>
                  <span className="text-border">·</span>
                  <span>{song.release_date_for_display}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="max-w-3xl mx-auto px-4 md:px-8">
        <div className="border-t border-border" />
      </div>

      {/* Lyrics */}
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-10">
        {lyrics ? (
          <LyricsBlock lyrics={lyrics} />
        ) : (
          <div className="text-center py-16 text-text-muted">
            <p className="text-lg">Lyrics not available</p>
            <p className="text-sm mt-2">
              <a
                href={song.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                View on Genius →
              </a>
            </p>
          </div>
        )}

        {/* Source link */}
        {lyrics && (
          <div className="mt-12 pt-6 border-t border-border text-center">
            <a
              href={song.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted text-xs hover:text-text-primary transition-colors"
            >
              Source: Genius →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
