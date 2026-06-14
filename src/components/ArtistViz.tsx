'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

const PALETTE = [
  '#a78bfa', '#60a5fa', '#34d399', '#f59e0b',
  '#f472b6', '#818cf8', '#22d3ee', '#fb923c',
  '#a3e635', '#e879f9',
]

interface Song {
  id: number
  title: string
  url: string
  path: string
  primary_artist: { id: number; name: string }
  album?: { id: number; name: string; cover_art_url?: string; release_date_for_display?: string } | null
  release_date_for_display?: string
  release_date_components?: { year?: number }
}

interface AlbumGroup {
  name: string
  songs: Song[]
  color: string
  year?: string
}

interface NodeData {
  type: 'album' | 'song'
  id: number | string
  label: string
  albumName?: string
  year?: string
  color: string
  songCount?: number
  songId?: number
  songPath?: string
  baseX: number
  baseY: number
  x: number
  y: number
  radius: number
  phaseX: number
  phaseY: number
  speedX: number
  speedY: number
}

interface TooltipState {
  x: number
  y: number
  label: string
  visible: boolean
}

interface SelectedNode {
  type: 'album' | 'song'
  label: string
  albumName?: string
  year?: string
  songCount?: number
  songId?: number
  songPath?: string
  color: string
}

interface StarParticle {
  x: number
  y: number
  r: number
  baseA: number
  twinklePhase: number
  twinkleSpeed: number
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 167, g: 139, b: 250 }
}

function drawGlowingCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
  isLarge: boolean
) {
  const { r, g, b } = hexToRgb(color)

  ctx.shadowColor = color
  ctx.shadowBlur = isLarge ? 38 : 20
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${r},${g},${b},${isLarge ? 0.18 : 0.12})`
  ctx.fill()

  ctx.shadowBlur = isLarge ? 16 : 9
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  const gradient = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius)
  gradient.addColorStop(0, `rgba(${r},${g},${b},${Math.min(1, alpha * 1.3)})`)
  gradient.addColorStop(0.6, `rgba(${r},${g},${b},${alpha})`)
  gradient.addColorStop(1, `rgba(${r},${g},${b},${alpha * 0.45})`)
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  color: string,
  alpha: number
) {
  const { r, g, b } = hexToRgb(color)
  ctx.save()
  ctx.setLineDash([4, 6])
  ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.restore()
}

interface ArtistVizProps {
  artistId: string
  artistName?: string
}

export default function ArtistViz({ artistId, artistName }: ArtistVizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const nodesRef = useRef<NodeData[]>([])
  const albumNodesRef = useRef<NodeData[]>([])
  const hoveredIdRef = useRef<string | number | null>(null)
  const selectedIdRef = useRef<string | number | null>(null)
  const loadingRef = useRef(true)

  const [artist, setArtist] = useState<{ name: string } | null>(artistName ? { name: artistName } : null)
  const [albums, setAlbums] = useState<AlbumGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<TooltipState>({ x: 0, y: 0, label: '', visible: false })
  const [selected, setSelected] = useState<SelectedNode | null>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })

  const buildLayout = useCallback((albumGroups: AlbumGroup[], w: number, h: number) => {
    const cx = w / 2
    const cy = h / 2
    const albumOrbitR = Math.min(w, h) * 0.28
    const allNodes: NodeData[] = []
    const albumNodes: NodeData[] = []

    albumGroups.forEach((album, ai) => {
      const albumAngle = (ai / albumGroups.length) * Math.PI * 2 - Math.PI / 2
      const ax = cx + Math.cos(albumAngle) * albumOrbitR
      const ay = cy + Math.sin(albumAngle) * albumOrbitR
      const songCount = album.songs.length
      const albumRadius = Math.min(36, 28 + songCount * 0.5)

      const albumNode: NodeData = {
        type: 'album',
        id: `album-${ai}`,
        label: album.name,
        year: album.year,
        color: album.color,
        songCount,
        baseX: ax,
        baseY: ay,
        x: ax,
        y: ay,
        radius: albumRadius,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        speedX: 0.3 + Math.random() * 0.3,
        speedY: 0.25 + Math.random() * 0.3,
      }
      allNodes.push(albumNode)
      albumNodes.push(albumNode)

      const songOrbitR = Math.min(120, 60 + songCount * 3)
      album.songs.forEach((song, si) => {
        const songAngle = (si / album.songs.length) * Math.PI * 2 + albumAngle + 0.2
        const sx = ax + Math.cos(songAngle) * songOrbitR
        const sy = ay + Math.sin(songAngle) * songOrbitR

        allNodes.push({
          type: 'song',
          id: `song-${song.id}`,
          label: song.title,
          albumName: album.name,
          year: album.year ?? song.release_date_for_display ?? undefined,
          color: album.color,
          songId: song.id,
          songPath: song.path,
          baseX: sx,
          baseY: sy,
          x: sx,
          y: sy,
          radius: Math.min(7, 5 + Math.random() * 2),
          phaseX: Math.random() * Math.PI * 2,
          phaseY: Math.random() * Math.PI * 2,
          speedX: 0.4 + Math.random() * 0.4,
          speedY: 0.35 + Math.random() * 0.4,
        })
      })
    })

    nodesRef.current = allNodes
    albumNodesRef.current = albumNodes
  }, [])

  // Data fetching with pagination
  useEffect(() => {
    async function load() {
      try {
        if (!artistName) {
          const artistRes = await fetch(`/api/artist/${artistId}`)
          const artistData = await artistRes.json()
          setArtist({ name: artistData.artist?.name ?? 'Artist' })
        }

        const allSongs: Song[] = []
        let page = 1
        let hasMore = true
        while (hasMore) {
          const songsRes = await fetch(`/api/artist/${artistId}/songs?page=${page}`)
          const songsData = await songsRes.json()
          const pageSongs: Song[] = songsData.songs ?? []
          allSongs.push(...pageSongs)
          hasMore = !!songsData.next_page
          page++
          if (page > 30) break
        }

        const groupMap = new Map<string, Song[]>()
        for (const song of allSongs) {
          const key = song.album?.name ?? 'Singles'
          if (!groupMap.has(key)) groupMap.set(key, [])
          groupMap.get(key)!.push(song)
        }

        const groups: AlbumGroup[] = Array.from(groupMap.entries()).map(([name, sgs], i) => ({
          name,
          songs: sgs,
          color: PALETTE[i % PALETTE.length],
          year: sgs[0]?.album?.release_date_for_display
            ?? sgs[0]?.release_date_for_display
            ?? undefined,
        }))

        setAlbums(groups)
      } catch {
        // silent fail
      } finally {
        setLoading(false)
        loadingRef.current = false
      }
    }
    load()
  }, [artistId, artistName])

  // Canvas sizing with DPR support
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function measure() {
      if (!canvas) return
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      const dpr = window.devicePixelRatio || 1
      canvas.width = w * dpr
      canvas.height = h * dpr
      setCanvasSize({ w, h })
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    if (albums.length > 0 && canvasSize.w > 0) {
      buildLayout(albums, canvasSize.w, canvasSize.h)
    }
  }, [albums, canvasSize, buildLayout])

  // 150 star particles with twinkling
  const starsRef = useRef<StarParticle[]>([])
  useEffect(() => {
    if (canvasSize.w > 0) {
      starsRef.current = Array.from({ length: 150 }, () => ({
        x: Math.random() * canvasSize.w,
        y: Math.random() * canvasSize.h,
        r: Math.random() * 1.0 + 0.5,
        baseA: Math.random() * 0.3 + 0.3,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.5 + Math.random() * 1.5,
      }))
    }
  }, [canvasSize.w, canvasSize.h])

  useEffect(() => {
    loadingRef.current = loading
  }, [loading])

  // Animation loop using performance.now() via rAF timestamp
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let stopped = false
    let startTime: number | null = null

    function draw(timestamp: number) {
      if (stopped) return
      if (startTime === null) startTime = timestamp
      const elapsed = timestamp - startTime

      const ctx = canvas!.getContext('2d')
      if (!ctx) return

      const w = canvas!.offsetWidth
      const h = canvas!.offsetHeight
      const dpr = window.devicePixelRatio || 1

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#08080a'
      ctx.fillRect(0, 0, w, h)

      // Twinkling stars
      const stars = starsRef.current
      for (const s of stars) {
        const twinkle = Math.sin(elapsed * 0.001 * s.twinkleSpeed + s.twinklePhase) * 0.15
        const alpha = Math.max(0.05, s.baseA + twinkle)
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${alpha})`
        ctx.fill()
      }

      const isLoading = loadingRef.current

      if (isLoading) {
        const cx = w / 2
        const cy = h / 2
        const t = elapsed * 0.001

        ctx.save()
        ctx.strokeStyle = 'rgba(167,139,250,0.12)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, cy, 100, 0, Math.PI * 2)
        ctx.stroke()

        ctx.strokeStyle = 'rgba(167,139,250,0.08)'
        ctx.beginPath()
        ctx.arc(cx, cy, 60, 0, Math.PI * 2)
        ctx.stroke()

        ctx.strokeStyle = 'rgba(167,139,250,0.9)'
        ctx.lineWidth = 2
        ctx.shadowBlur = 14
        ctx.shadowColor = '#a78bfa'
        ctx.beginPath()
        ctx.arc(cx, cy, 100, t * 2, t * 2 + 1.4)
        ctx.stroke()

        ctx.strokeStyle = 'rgba(167,139,250,0.45)'
        ctx.shadowBlur = 7
        ctx.beginPath()
        ctx.arc(cx, cy, 60, t * 2 + 0.5, t * 2 + 1.9)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.restore()

        animFrameRef.current = requestAnimationFrame(draw)
        return
      }

      const nodes = nodesRef.current
      const albumNodes = albumNodesRef.current
      const t = elapsed * 0.001
      const hoveredId = hoveredIdRef.current
      const selectedId = selectedIdRef.current

      // Floating animation: sin/cos with per-node phase
      nodes.forEach(node => {
        node.x = node.baseX + Math.sin(t * 0.0008 * 1000 * node.speedX + node.phaseX) * 3
        node.y = node.baseY + Math.cos(t * 0.0008 * 1000 * node.speedY + node.phaseY) * 2
      })

      // Dashed connection lines from songs to album nodes
      nodes.forEach(node => {
        if (node.type !== 'song') return
        const albumNode = albumNodes.find(a => a.label === node.albumName)
        if (!albumNode) return
        const isHighlighted = hoveredId === node.id || hoveredId === albumNode.id
          || selectedId === node.id || selectedId === albumNode.id
        drawDashedLine(ctx, node.x, node.y, albumNode.x, albumNode.y, node.color, isHighlighted ? 0.4 : 0.25)
      })

      // Song nodes (drawn under albums)
      const songNodes = nodes.filter(n => n.type === 'song')
      songNodes.forEach(node => {
        const isHovered = hoveredId === node.id
        const isSelected = selectedId === node.id
        const alpha = isHovered || isSelected ? 1.0 : 0.7
        drawGlowingCircle(ctx, node.x, node.y, node.radius, node.color, alpha, false)

        if (isSelected) {
          ctx.beginPath()
          ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(255,255,255,0.9)'
          ctx.lineWidth = 2
          ctx.shadowBlur = 8
          ctx.shadowColor = node.color
          ctx.stroke()
          ctx.shadowBlur = 0
        }
      })

      // Album nodes drawn on top
      albumNodes.forEach(node => {
        const isHovered = hoveredId === node.id
        const isSelected = selectedId === node.id
        const alpha = isHovered || isSelected ? 1 : 0.85
        drawGlowingCircle(ctx, node.x, node.y, node.radius, node.color, alpha, true)

        ctx.font = `${isHovered || isSelected ? '600' : '500'} 11px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.shadowBlur = 8
        ctx.shadowColor = 'rgba(0,0,0,0.9)'
        ctx.fillStyle = `rgba(250,250,250,${isHovered || isSelected ? 1 : 0.75})`
        const labelY = node.y + node.radius + 16
        const maxChars = 18
        const displayLabel = node.label.length > maxChars ? node.label.slice(0, maxChars - 1) + '…' : node.label
        ctx.fillText(displayLabel, node.x, labelY)
        ctx.shadowBlur = 0

        if (isSelected) {
          ctx.beginPath()
          ctx.arc(node.x, node.y, node.radius + 5, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(255,255,255,0.9)'
          ctx.lineWidth = 2
          ctx.shadowBlur = 12
          ctx.shadowColor = node.color
          ctx.stroke()
          ctx.shadowBlur = 0
        }
      })

      animFrameRef.current = requestAnimationFrame(draw)
    }

    animFrameRef.current = requestAnimationFrame(draw)
    return () => {
      stopped = true
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [canvasSize])

  const getHitNode = useCallback((ex: number, ey: number): NodeData | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const mx = ex - rect.left
    const my = ey - rect.top

    for (const node of [...albumNodesRef.current].reverse()) {
      const dx = mx - node.x
      const dy = my - node.y
      if (dx * dx + dy * dy <= (node.radius + 8) ** 2) return node
    }
    for (const node of nodesRef.current) {
      if (node.type !== 'song') continue
      const dx = mx - node.x
      const dy = my - node.y
      if (dx * dx + dy * dy <= (node.radius + 6) ** 2) return node
    }
    return null
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = getHitNode(e.clientX, e.clientY)
    hoveredIdRef.current = hit?.id ?? null

    if (hit) {
      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 16,
        label: hit.label,
        visible: true,
      })
      canvas.style.cursor = 'pointer'
    } else {
      setTooltip(t => ({ ...t, visible: false }))
      if (canvasRef.current) canvasRef.current.style.cursor = 'default'
    }
  }, [getHitNode])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = getHitNode(e.clientX, e.clientY)
    if (hit) {
      selectedIdRef.current = hit.id
      setSelected({
        type: hit.type,
        label: hit.label,
        albumName: hit.albumName,
        year: hit.year,
        songCount: hit.songCount,
        songId: hit.songId,
        songPath: hit.songPath,
        color: hit.color,
      })
    } else {
      selectedIdRef.current = null
      setSelected(null)
    }
  }, [getHitNode])

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#08080a' }}>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 pt-4 pb-3 pointer-events-none">
        <Link
          href={`/artist/${artistId}`}
          className="pointer-events-auto flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          <span className="font-medium tracking-wide">{artist?.name ?? '…'}</span>
        </Link>

        {/* Color legend, max 8 albums */}
        {albums.length > 0 && (
          <div className="pointer-events-auto max-w-xs bg-black/50 backdrop-blur-sm border border-white/[0.08] rounded-xl px-3 py-2.5">
            <p className="text-white/30 text-[10px] uppercase tracking-widest mb-1.5 font-semibold">Albums</p>
            <div className="flex flex-col gap-1">
              {albums.slice(0, 8).map((album) => (
                <div key={album.name} className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: album.color, boxShadow: `0 0 6px ${album.color}` }}
                  />
                  <span className="text-white/55 text-[10px] truncate max-w-[160px]">{album.name}</span>
                </div>
              ))}
              {albums.length > 8 && (
                <span className="text-white/25 text-[9px] mt-0.5">+{albums.length - 8} more</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main canvas */}
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ display: 'block', height: 'calc(100vh - 140px)' }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={() => {
          hoveredIdRef.current = null
          setTooltip(t => ({ ...t, visible: false }))
        }}
      />

      {/* Hover tooltip */}
      {tooltip.visible && (
        <div
          className="absolute z-30 pointer-events-none px-2.5 py-1.5 rounded-lg text-xs text-white font-medium"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            background: 'rgba(10,10,14,0.92)',
            border: '1px solid rgba(167,139,250,0.28)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.6), 0 0 12px rgba(167,139,250,0.1)',
          }}
        >
          {tooltip.label}
        </div>
      )}

      {/* Loading text */}
      {loading && (
        <div
          className="absolute pointer-events-none z-10 flex items-end justify-center"
          style={{ top: 0, left: 0, right: 0, bottom: 140 }}
        >
          <p className="text-white/25 text-[11px] mb-8 tracking-widest uppercase">Scanning discography…</p>
        </div>
      )}

      {/* Threat tray */}
      <div
        className="relative z-20 flex-shrink-0"
        style={{
          height: '140px',
          background: '#0d0d10',
          borderTop: '1px solid #27272a',
        }}
      >
        <div className="flex items-center h-full px-6 gap-6">
          {/* Left: node info */}
          <div className="flex-1 min-w-0">
            {selected ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="bg-violet-950 text-violet-300 border border-violet-700 px-2 py-0.5 text-xs rounded font-bold tracking-widest">
                    {selected.type === 'album' ? 'ALBUM' : 'TRACK'}
                  </span>
                  {selected.year && (
                    <span className="text-zinc-400 text-[11px]">{selected.year}</span>
                  )}
                </div>
                <p className="text-white font-semibold text-lg leading-tight truncate">{selected.label}</p>
                {selected.type === 'song' && selected.albumName && (
                  <p className="text-zinc-400 text-sm truncate">{selected.albumName}</p>
                )}
                {selected.type === 'album' && selected.songCount !== undefined && (
                  <p className="text-zinc-400 text-sm">{selected.songCount} track{selected.songCount !== 1 ? 's' : ''}</p>
                )}
              </div>
            ) : (
              <p className="text-zinc-500 text-sm tracking-wide">Select a node to explore</p>
            )}
          </div>

          {/* Vertical divider */}
          <div className="w-px h-16 bg-white/[0.07] flex-shrink-0" />

          {/* Right: actions + LIVE indicator */}
          <div className="flex flex-col items-end gap-3">
            {selected?.type === 'song' && selected.songId && (
              <a
                href={selected.songPath ?? `/song/${selected.songId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border border-violet-500/40 text-violet-300 hover:border-violet-400 hover:text-violet-200 hover:shadow-[0_0_14px_rgba(167,139,250,0.25)]"
                style={{ background: 'rgba(167,139,250,0.08)' }}
              >
                View Lyrics →
              </a>
            )}
            {selected?.type === 'album' && (
              <Link
                href={`/artist/${artistId}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border border-violet-500/40 text-violet-300 hover:border-violet-400 hover:text-violet-200 hover:shadow-[0_0_14px_rgba(167,139,250,0.25)]"
                style={{ background: 'rgba(167,139,250,0.08)' }}
              >
                View All Songs →
              </Link>
            )}

            {/* LIVE pulsing indicator */}
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{
                  background: '#34d399',
                  boxShadow: '0 0 6px #34d399',
                }}
              />
              <span className="text-[10px] text-white/25 font-semibold tracking-widest">LIVE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
