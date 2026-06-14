# Verseatile × Phonolith — Full Design & Architecture Specification

This document is the single source of truth for the combined rewrite. It merges
Verseatile (lyrics explorer, Genius integration, galaxy visualization) with
Phonolith (local library intelligence, audio analysis, metadata enrichment) into
one unified product. The target stack is Next.js — Verseatile's foundation —
with Docker Compose for all services.

---

## 1. Product Vision

**"The Command Centre for the Music Obsessive."**

A single self-hosted application that knows everything about your music: where
the files are, what the lyrics mean, who made them, how they connect, and how
your relationship with them has evolved over time. Local library + streaming
metadata + lyrics + visualization, unified under one interface.

### Guiding principles (inherited from Phonolith, applied to the new stack)

| Principle | What it means in practice |
|---|---|
| **Hash-first identity** | Songs are identified by their Genius ID + BLAKE3 file hash, not file path |
| **Metadata integrity** | User annotations and tags take precedence over any external source |
| **Bit-perfect transparency** | The full signal chain is observable — what file, what format, what enrichment source |
| **Zero external telemetry** | No analytics, no beacons, no external calls except the APIs you configure |

---

## 2. Feature Catalog

### From Verseatile (keep and extend)
- Artist search via Genius API
- Full discography browsing, grouped by album
- Lyrics viewer with copy + download
- Batch lyrics download (all songs → single `.txt`)
- Galaxy visualization of an artist's discography
- Darktrace-inspired dark UI

### New on top of Verseatile
- **Song page tabs**: Lyrics / About / Credits / Annotations
- **Visualization v2**: Zoom + pan, force layout, spider web mode, focus mode
- **Spider web filters**: Connect songs by shared collaborator, producer, era
- **Timeline view**: Alternative to galaxy — X axis = year, swim-lane albums

### From Phonolith (ported to Next.js)
- **Library watcher** (Tremor): Watch a local music directory, index new files automatically
- **Metadata enrichment** (Lexicon): Resolve artist/album/song data from MusicBrainz and Discogs in addition to Genius
- **Audio analysis** (Prism/Crest): Spectral quality check, dynamic range, format info — run via a Python sidecar
- **Listening history** (EchoGraph): Track which songs/albums have been played or read, surface trends
- **Personal tags** (Engram): User-defined labels on any song or album, with history
- **Waveform rendering**: Pre-render waveform images for files in the library
- **S3 backup** (Aegis): Optional encrypted backup of library metadata to S3
- **Acoustic fingerprinting**: Match untagged files to MusicBrainz via Chromaprint/AcoustID

### Explicitly dropped from Phonolith
- ALSA/AirPlay playback (out of scope — use your existing player)
- Peer mesh networking (Polyphony) — too complex for v1
- SNMP/S.M.A.R.T. hardware monitoring — separate concern
- Tailscale integration — user's own responsibility

---

## 3. Technical Architecture

### 3.1 Stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 14, App Router, TypeScript |
| Styling | Tailwind CSS + custom CSS variables |
| Database | PostgreSQL 16 (via Docker) |
| Cache / pub-sub | Redis 7 |
| Audio analysis sidecar | Python 3.12, FastAPI, librosa, mutagen, pyacoustid |
| File watcher | Python watchdog (part of sidecar) |
| External APIs | Genius, MusicBrainz, Discogs, AcoustID |
| Containerisation | Docker Compose v2 — single file |

### 3.2 Docker Compose services

```
services:
  app          # Next.js — port 3000
  db           # PostgreSQL — port 5432 (internal only)
  redis        # Redis — port 6379 (internal only)
  analyst      # Python FastAPI sidecar — port 8000 (internal only)
```

Four services. No more than four. The `analyst` sidecar handles everything that
can't run cleanly in Node: audio decoding, spectral analysis, fingerprinting,
file watching. It communicates with the Next.js app via HTTP and Redis pub-sub.

### 3.3 Environment variables

```env
# Required
GENIUS_ACCESS_TOKEN=

# Database (set automatically in Docker Compose)
DATABASE_URL=postgresql://verseatile:verseatile@db:5432/verseatile

# Redis (set automatically)
REDIS_URL=redis://redis:6379

# Optional enrichment
MUSICBRAINZ_APP_NAME=Verseatile
MUSICBRAINZ_APP_VERSION=1.0
MUSICBRAINZ_CONTACT=your@email.com
DISCOGS_USER_TOKEN=
ACOUSTID_API_KEY=

# Optional S3 backup
S3_BUCKET=
S3_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Library path (mounted into analyst container)
LIBRARY_PATH=/music
```

### 3.4 Data models (PostgreSQL)

#### artists
```sql
id          SERIAL PRIMARY KEY
genius_id   INTEGER UNIQUE
mb_id       UUID              -- MusicBrainz artist MBID
name        TEXT NOT NULL
image_url   TEXT
description TEXT
followers   INTEGER
fetched_at  TIMESTAMPTZ
```

#### albums
```sql
id            SERIAL PRIMARY KEY
genius_id     INTEGER UNIQUE
mb_id         UUID
artist_id     INTEGER REFERENCES artists(id)
name          TEXT NOT NULL
cover_art_url TEXT
release_date  DATE
fetched_at    TIMESTAMPTZ
```

#### songs
```sql
id                    SERIAL PRIMARY KEY
genius_id             INTEGER UNIQUE
mb_id                 UUID
artist_id             INTEGER REFERENCES artists(id)
album_id              INTEGER REFERENCES albums(id)
title                 TEXT NOT NULL
full_title            TEXT
path                  TEXT              -- Genius URL path for scraping
release_date          DATE
song_art_image_url    TEXT
description           TEXT              -- Genius song description / about
pageviews             INTEGER
fetched_at            TIMESTAMPTZ
```

#### lyrics
```sql
song_id     INTEGER PRIMARY KEY REFERENCES songs(id)
content     TEXT
scraped_at  TIMESTAMPTZ
```

#### credits
```sql
id       SERIAL PRIMARY KEY
song_id  INTEGER REFERENCES songs(id)
role     TEXT    -- 'producer', 'writer', 'featured', 'engineer', 'mixer' …
name     TEXT
genius_id INTEGER
```

#### annotations
```sql
id          SERIAL PRIMARY KEY
song_id     INTEGER REFERENCES songs(id)
fragment    TEXT    -- the lyric fragment being annotated
body        TEXT    -- the annotation text (from Genius or user)
source      TEXT    -- 'genius' | 'user'
created_at  TIMESTAMPTZ
```

#### library_files
```sql
id            SERIAL PRIMARY KEY
blake3_hash   TEXT UNIQUE NOT NULL
file_path     TEXT NOT NULL
song_id       INTEGER REFERENCES songs(id)  -- null until matched
format        TEXT    -- 'flac', 'mp3', 'aac' …
bitrate       INTEGER
sample_rate   INTEGER
bit_depth     INTEGER
duration_ms   INTEGER
dr_score      REAL    -- dynamic range (Crest)
spectral_ok   BOOLEAN -- no upscale detected (Prism)
waveform_path TEXT    -- path to rendered waveform PNG
fingerprint   TEXT    -- AcoustID fingerprint
indexed_at    TIMESTAMPTZ
```

#### tags
```sql
id         SERIAL PRIMARY KEY
name       TEXT UNIQUE NOT NULL
color      TEXT DEFAULT '#a78bfa'
created_at TIMESTAMPTZ
```

#### song_tags
```sql
song_id INTEGER REFERENCES songs(id)
tag_id  INTEGER REFERENCES tags(id)
PRIMARY KEY (song_id, tag_id)
```

#### history
```sql
id         SERIAL PRIMARY KEY
song_id    INTEGER REFERENCES songs(id)
event      TEXT  -- 'play', 'lyrics_read', 'lyrics_download'
created_at TIMESTAMPTZ
```

---

## 4. API Routes (Next.js App Router)

All routes under `/api/`.

### Search & discovery
| Method | Route | Description |
|---|---|---|
| GET | `/api/search?q=` | Search artists via Genius, cache in DB |
| GET | `/api/artist/[id]` | Artist info (DB-first, Genius fallback) |
| GET | `/api/artist/[id]/songs` | Paginated song list |
| GET | `/api/artist/[id]/songs/all` | All songs, loops Genius pages |

### Song data
| Method | Route | Description |
|---|---|---|
| GET | `/api/song/[id]` | Song metadata |
| GET | `/api/song/[id]/lyrics` | Lyrics (DB cache → scrape on miss) |
| GET | `/api/song/[id]/credits` | Producers, writers, featured artists |
| GET | `/api/song/[id]/annotations` | Per-line annotations |
| GET | `/api/song/[id]/about` | Description / background text |

### Library (analyst sidecar proxy)
| Method | Route | Description |
|---|---|---|
| GET | `/api/library` | All indexed files with match status |
| GET | `/api/library/[hash]` | Single file detail + analysis |
| POST | `/api/library/scan` | Trigger a library rescan |
| GET | `/api/library/status` | Watcher status, last scan time |

### Tags
| Method | Route | Description |
|---|---|---|
| GET | `/api/tags` | All tags |
| POST | `/api/tags` | Create tag |
| POST | `/api/song/[id]/tags` | Add tag to song |
| DELETE | `/api/song/[id]/tags/[tagId]` | Remove tag from song |

### History
| Method | Route | Description |
|---|---|---|
| GET | `/api/history` | Recent events |
| POST | `/api/history` | Record event |
| GET | `/api/history/artist/[id]` | Events for an artist |

### Visualization data
| Method | Route | Description |
|---|---|---|
| GET | `/api/visualize/[artistId]` | All songs with credits for web building |
| GET | `/api/visualize/[artistId]/connections` | Pre-computed connection graph |

---

## 5. Page Architecture

### Routes

| Route | Page | Notes |
|---|---|---|
| `/` | Home / Search | Artist search, recent history |
| `/artist/[id]` | Artist | Discography, grouped by album |
| `/artist/[id]/library` | Artist Library | Files in local library matched to this artist |
| `/song/[id]` | Song | Tabbed: Lyrics / About / Credits / Annotations |
| `/visualize/[id]` | Galaxy | Interactive visualization v2 |
| `/library` | Library | All indexed files, analysis results |
| `/library/[hash]` | File Detail | Single file: format, waveform, analysis, match |
| `/history` | History | EchoGraph — listening and reading timeline |
| `/tags` | Tags | All user tags, songs per tag |
| `/settings` | Settings | API keys, library path, backup config |

### Layout

All pages share a common shell:

```
┌─────────────────────────────────────────────┐
│ SIDEBAR (64px wide, icon-only)              │
│  🔍 Search                                  │
│  🎵 Library                                 │
│  🕸 Visualize (last artist)                 │
│  📜 History                                 │
│  🏷 Tags                                    │
│  ⚙️ Settings                               │
├─────────────────────────────────────────────┤
│ MAIN CONTENT AREA                           │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

No top navbar. Left sidebar icon-only (expands on hover to show labels).
Full bleed content area. The sidebar collapses completely on mobile.

---

## 6. Page Specifications

### 6.1 Home (`/`)

- Full-height hero when no results: "Verseatile" title (gradient text, violet→indigo), large search bar
- On type: artist grid appears below (2-col mobile, 4-col desktop)
- Artist card: square image, name, "View discography →"
- Below the fold (always visible): "Recently explored" — last 5 artists from history

### 6.2 Artist page (`/artist/[id]`)

**Hero:**
- Full-bleed header image (blurred, darkened)
- Artist name (large, white, overlaid)
- Follower count, Genius link
- Action buttons: `Visualize`, `Download All Lyrics`, `View in Library`

**Discography:**
- Songs grouped by album, albums sorted by release date descending
- Album section header: cover art thumbnail, album name, year, song count
- Song row: track number, title, release date, tags, "Lyrics" link
- "Singles & Other" group at bottom for unalbummed songs

**Sidebar (right, on wide screens):**
- Artist description
- Tags applied to this artist's songs (with counts)

### 6.3 Song page (`/song/[id]`)

Four tabs:

**Lyrics tab:**
- Song art (square, left) + title, artist, album, date (right)
- Lyrics in Playfair Display, large, generous line-height
- Copy button, Download `.txt` button
- "Mark as read" button → records history event

**About tab:**
- `song.description` rendered as rich text
- Any community-sourced background information from Genius

**Credits tab:**
Table layout:

| Role | Name |
|---|---|
| Primary Artist | … |
| Featured | … |
| Produced by | … |
| Written by | … |
| Mixed by | … |
| Engineered by | … |

Click any name → search for that person as an artist.

**Annotations tab:**
- Lyrics displayed again, but click any line to expand its annotation
- Genius annotations shown inline below the line
- User can add their own annotation (stored in DB, `source: 'user'`)

### 6.4 Visualization v2 (`/visualize/[id]`)

See section 7 for full specification.

### 6.5 Library (`/library`)

Table of all indexed files:

| File | Format | DR | Quality | Matched Song | Tags |
|---|---|---|---|---|---|
| artist/album/song.flac | FLAC 24/96 | DR12 | ✓ | Nick Drake — Poor Boy | folk |
| … | … | … | … | … | … |

Filters: format, DR range, matched/unmatched, tag.
Top bar: "Scan Library" button, last scan time, file count.

### 6.6 History / EchoGraph (`/history`)

- Line graph: lyrics reads per week over time
- Bar chart: top artists by play + reads combined
- List: chronological event log (play / lyrics_read / download)
- Filter by: artist, event type, date range

### 6.7 Settings (`/settings`)

Sections:
- **API Keys**: Genius, Discogs, AcoustID (show/hide, test button)
- **Library**: Path to music directory, watcher status, rescan button
- **Backup**: S3 bucket, region, access key, last backup time, manual trigger
- **Appearance**: (future) theme variants

---

## 7. Visualization v2 — Full Specification

### 7.1 Problems with v1
- Static ring layout clusters on large discographies
- No zoom or pan
- No way to filter or focus
- Connections only show album membership, not creative relationships

### 7.2 Layout engine

Replace the static circular layout with a **force-directed simulation**:
- Album nodes: charge repulsion from all other nodes
- Song nodes: spring attraction to their album node, repulsion from other songs
- Run simulation for 200 ticks on load, then freeze positions
- Smooth interpolation when filter changes alter visible nodes

### 7.3 Navigation

- **Scroll wheel**: zoom in/out (canvas scale transform)
- **Click + drag on background**: pan
- **Double-click album**: focus mode (see 7.4)
- **Click song**: select → bottom panel updates
- **Escape**: deselect / exit focus mode

### 7.4 Focus mode

Double-click an album node:
- All other albums and their songs fade to 5% opacity
- Selected album's songs spread into a wide radial fan (radius 200px)
- Song labels appear (artist, title truncated)
- Bottom panel shows album info + track list
- "Exit focus" button top-left

### 7.5 Spider web mode

A sidebar panel (left side, toggleable) with connection filter toggles:

```
─────────────────
  CONNECTIONS
─────────────────
☑  Album           violet lines (always on)
☐  Collaborators   blue lines
☐  Producer        amber lines
☐  Era (±2 yr)     green lines
─────────────────
  FILTER
─────────────────
  Albums ▾  [All]
  Decade ▾  [All]
  Tag    ▾  [All]
─────────────────
```

When "Collaborators" is toggled on, a dashed line of the corresponding colour
draws between every pair of songs that share a featured artist. The density of
these lines reveals creative clusters instantly.

Connection data is pre-computed by `/api/visualize/[id]/connections` at load
time — no per-interaction API calls needed.

### 7.6 Timeline view

Toggle button (top-right: `Galaxy | Timeline`).

In timeline view:
- X axis: year (auto-range from earliest to latest release)
- Y axis: albums as horizontal swim-lanes
- Each song is a dot on its album's lane at the correct year
- Dot size = pageviews (popularity proxy)
- Click dot → same bottom panel as galaxy

### 7.7 Bottom threat tray (retained from v1, expanded)

```
┌──────────────────────────────────────────────────────┐
│ [ALBUM BADGE] Bryter Layter · 1971 · 11 tracks       │  ← when album selected
│                                         [View Album]  │
├──────────────────────────────────────────────────────┤
│ [TRACK BADGE] Poor Boy · Nick Drake · Bryter Layter  │  ← when song selected
│                              [Lyrics] [Annotate] [♥]  │
└──────────────────────────────────────────────────────┘
```

Fixed to bottom. 120px tall. Shows artist name → album name → song name
as a breadcrumb when a song is selected.

---

## 8. Design System

### 8.1 Colour tokens

These are defined as CSS custom properties and mirrored as Tailwind colours.

```css
:root {
  --background:   #08080a;  /* page background — near black */
  --surface:      #111113;  /* cards, panels */
  --surface-2:    #1a1a1e;  /* hover states, nested surfaces */
  --border:       #27272a;  /* all borders */
  --accent:       #a78bfa;  /* violet — primary interactive colour */
  --accent-dim:   #7c3aed;  /* darker violet — pressed states */
  --accent-glow:  rgba(167, 139, 250, 0.15); /* glow halos */
  --text-primary: #fafafa;
  --text-muted:   #71717a;
  --success:      #34d399;  /* green — matched files, healthy status */
  --warning:      #f59e0b;  /* amber — warnings, producers in viz */
  --danger:       #f87171;  /* red — errors */
}
```

### 8.2 Visualization colour palette

Assigned per album in order. Wrap if > 10 albums.

```typescript
const PALETTE = [
  '#a78bfa', // violet  (accent)
  '#60a5fa', // blue
  '#34d399', // green
  '#f59e0b', // amber
  '#f472b6', // pink
  '#818cf8', // indigo
  '#22d3ee', // cyan
  '#fb923c', // orange
  '#a3e635', // lime
  '#e879f9', // fuchsia
]
```

Connection line colours:

```typescript
const CONNECTION_COLOURS = {
  album:         'rgba(167, 139, 250, 0.25)',  // violet
  collaborator:  'rgba(96,  165, 250, 0.35)',  // blue
  producer:      'rgba(245, 158, 11,  0.35)',  // amber
  era:           'rgba(52,  211, 153, 0.25)',  // green
}
```

### 8.3 Typography

```typescript
// layout.tsx
import { Inter }           from 'next/font/google'
import { Playfair_Display } from 'next/font/google'

const inter = Inter({
  variable: '--font-geist-sans',  // keep this var name — used throughout
  subsets: ['latin'],
})

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  style: ['normal', 'italic'],
})
```

**Usage:**
- `font-sans` (Inter) — all UI chrome, labels, navigation, metadata
- `font-serif` (Playfair Display, italic) — lyrics display only
- Never use serif outside of lyrics

**Scale:**
| Token | Size | Weight | Use |
|---|---|---|---|
| `text-xs` | 11px | 400 | badges, timestamps |
| `text-sm` | 13px | 400/500 | body, table rows |
| `text-base` | 15px | 400 | default |
| `text-lg` | 18px | 500 | section headers |
| `text-xl` | 22px | 600 | page subtitles |
| `text-3xl` | 30px | 700 | page titles |
| `text-5xl` | 48px | 700 | hero titles |

### 8.4 Component patterns

**Card**
```tsx
<div className="rounded-xl border border-border bg-surface
                hover:border-accent/30 hover:bg-surface-2
                transition-all duration-150 p-4">
```

**Badge**
```tsx
// accent (default)
<span className="text-xs font-mono px-2 py-0.5 rounded
                 bg-accent/10 text-accent border border-accent/20">
  ALBUM
</span>

// muted
<span className="text-xs font-mono px-2 py-0.5 rounded
                 bg-surface-2 text-text-muted border border-border">
  SINGLES
</span>
```

**Tab bar**
```tsx
<div className="flex border-b border-border gap-1">
  <button className="px-4 py-2 text-sm text-text-muted
                     border-b-2 border-transparent
                     data-[active=true]:border-accent
                     data-[active=true]:text-text-primary
                     hover:text-text-primary transition-colors">
    Lyrics
  </button>
  …
</div>
```

**Button — primary**
```tsx
<button className="px-4 py-2 rounded-lg bg-accent text-[#08080a]
                   font-semibold text-sm hover:bg-accent-dim
                   transition-colors">
```

**Button — ghost**
```tsx
<button className="px-4 py-2 rounded-lg border border-border
                   text-text-muted hover:border-accent/40
                   hover:text-text-primary text-sm transition-colors">
```

**Input**
```tsx
<input className="w-full bg-surface border border-border rounded-xl
                  px-4 py-3 text-text-primary placeholder:text-text-muted
                  focus:outline-none focus:border-accent focus:ring-1
                  focus:ring-accent/30 transition-colors">
```

**Canvas glow effect (standard pattern)**
```typescript
// album node
ctx.shadowBlur = 38
ctx.shadowColor = color
ctx.beginPath()
ctx.arc(x, y, radius, 0, Math.PI * 2)
ctx.fill()

// tight core over the top
ctx.shadowBlur = 16
ctx.shadowColor = '#ffffff'
ctx.beginPath()
ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2)
ctx.fill()

ctx.shadowBlur = 0
```

**Sidebar navigation**
```tsx
<nav className="fixed left-0 top-0 h-screen w-16 border-r border-border
                bg-surface flex flex-col items-center py-4 gap-2 z-50">
  <NavIcon href="/"         icon={<SearchIcon />} label="Search"  />
  <NavIcon href="/library"  icon={<LibraryIcon />} label="Library" />
  …
</nav>
```

NavIcon — shows tooltip on hover (right side), active state = accent colour fill.

### 8.5 Scrollbar

```css
::-webkit-scrollbar       { width: 6px; }
::-webkit-scrollbar-track { background: var(--background); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
```

### 8.6 Utility classes

```css
@layer utilities {
  .text-gradient {
    background: linear-gradient(135deg, #a78bfa 0%, #818cf8 50%, #6366f1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .card-hover {
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }
  .card-hover:hover {
    background-color: rgba(167, 139, 250, 0.05);
    border-color: rgba(167, 139, 250, 0.3);
  }

  .glow-accent {
    box-shadow: 0 0 20px rgba(167,139,250,0.15), 0 0 40px rgba(167,139,250,0.05);
  }
}
```

---

## 9. Analyst Sidecar (Python FastAPI)

This service handles everything that requires native audio tooling.

### Routes

```
GET  /health
POST /scan          body: { path: string }  → triggers full rescan
GET  /status        → { files_indexed, last_scan, watching: bool }
GET  /file/{hash}   → file analysis record
POST /fingerprint   body: { path: string }  → AcoustID lookup
```

### File indexing pipeline (per file)

1. Compute BLAKE3 hash
2. Read tags with `mutagen` (title, artist, album, year, track number)
3. Compute dynamic range score (RMS-based, Crest Factor equivalent)
4. Run spectral analysis with `librosa` — detect upscales (frequency ceiling check)
5. Render waveform PNG (1200×200px, dark background, violet waveform)
6. Generate AcoustID fingerprint with `pyacoustid`
7. POST result to Next.js app `/api/library/ingest` (internal)

### Technology

```python
# requirements.txt
fastapi
uvicorn[standard]
watchdog          # filesystem events
mutagen           # audio tag reading
librosa           # spectral analysis
numpy
pyacoustid        # fingerprinting
blake3            # hashing
httpx             # posting to Next.js
pillow            # waveform rendering
```

---

## 10. External API Integration

### Genius (existing, extend)

Already implemented. Extend `getSong()` to also return:
- `description.plain` → About tab
- `producer_artists[]` → Credits tab
- `writer_artists[]` → Credits tab
- `featured_artists[]` → Credits tab
- `custom_performances[]` → Credits tab (mixing, engineering, etc.)

### MusicBrainz (new)

Used as a fallback/enrichment layer for:
- Canonical artist MBID (used as stable identity)
- Accurate release dates
- ISRC codes
- Label information

Rate limit: 1 request/second. Use the `musicbrainzngs` Python library in the
analyst sidecar, or make direct HTTP calls from Next.js with a 1-second queue.
Always set `User-Agent` header to `AppName/version (contact@email.com)` or
MusicBrainz will block the request.

### AcoustID (new)

Used to match untagged or mis-tagged local files to MusicBrainz recordings.
Requires: `ACOUSTID_API_KEY` (free, register at acoustid.org).
Run via `pyacoustid` in the analyst sidecar.

---

## 11. Phonolith Concept → Implementation Mapping

| Phonolith service | Concept | Implementation in rewrite |
|---|---|---|
| Tremor | Filesystem watcher | `watchdog` in analyst sidecar, debounced 2s |
| Engram | Tag journaling | `tags` + `song_tags` DB tables, history log |
| Lexicon | Metadata resolver | MusicBrainz calls in analyst or Next.js API |
| Prism | Spectral analysis | `librosa` in analyst sidecar |
| Crest | Dynamic range | RMS/peak ratio in analyst sidecar |
| EchoGraph | Listening analytics | `history` DB table + `/history` page |
| Aegis | S3 backup | pg_dump + DB records upload, scheduled cron |
| Bit-Forge | BLAKE3 hashing | `blake3` Python lib in analyst sidecar |
| Lucid / Flux | Playback | Not implemented (use your player) |
| Polyphony | Peer mesh | Not implemented (v2+) |

---

## 12. Docker Compose (full)

```yaml
services:

  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - GENIUS_ACCESS_TOKEN=${GENIUS_ACCESS_TOKEN}
      - DATABASE_URL=postgresql://verseatile:verseatile@db:5432/verseatile
      - REDIS_URL=redis://redis:6379
      - ANALYST_URL=http://analyst:8000
      - DISCOGS_USER_TOKEN=${DISCOGS_USER_TOKEN:-}
      - ACOUSTID_API_KEY=${ACOUSTID_API_KEY:-}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped

  analyst:
    build:
      context: ./analyst
      dockerfile: Dockerfile
    environment:
      - APP_URL=http://app:3000
      - REDIS_URL=redis://redis:6379
      - LIBRARY_PATH=/music
      - ACOUSTID_API_KEY=${ACOUSTID_API_KEY:-}
    volumes:
      - ${LIBRARY_PATH:-/tmp/music}:/music:ro
      - waveforms:/waveforms
    depends_on:
      - redis
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: verseatile
      POSTGRES_PASSWORD: verseatile
      POSTGRES_DB: verseatile
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U verseatile"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
  waveforms:
```

---

## 13. Repository Structure

```
/
├── docker-compose.yml
├── Dockerfile                    # Next.js app
├── .env.example
├── README.md
├── DESIGN.md                     # this file
│
├── analyst/                      # Python FastAPI sidecar
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                   # FastAPI app
│   ├── scanner.py                # File indexing pipeline
│   ├── watcher.py                # watchdog integration
│   ├── fingerprint.py            # AcoustID
│   ├── analysis.py               # librosa / spectral
│   └── waveform.py               # PIL waveform rendering
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Home / search
│   │   ├── globals.css
│   │   │
│   │   ├── artist/[id]/
│   │   │   ├── page.tsx
│   │   │   └── library/page.tsx
│   │   │
│   │   ├── song/[id]/
│   │   │   └── page.tsx          # Tabbed: Lyrics/About/Credits/Annotations
│   │   │
│   │   ├── visualize/[id]/
│   │   │   └── page.tsx
│   │   │
│   │   ├── library/
│   │   │   ├── page.tsx
│   │   │   └── [hash]/page.tsx
│   │   │
│   │   ├── history/page.tsx
│   │   ├── tags/page.tsx
│   │   ├── settings/page.tsx
│   │   │
│   │   └── api/
│   │       ├── search/route.ts
│   │       ├── artist/[id]/route.ts
│   │       ├── artist/[id]/songs/route.ts
│   │       ├── song/[id]/route.ts
│   │       ├── song/[id]/lyrics/route.ts
│   │       ├── song/[id]/credits/route.ts
│   │       ├── song/[id]/annotations/route.ts
│   │       ├── song/[id]/about/route.ts
│   │       ├── library/route.ts
│   │       ├── library/scan/route.ts
│   │       ├── library/ingest/route.ts   # internal — called by analyst
│   │       ├── library/[hash]/route.ts
│   │       ├── tags/route.ts
│   │       ├── history/route.ts
│   │       └── visualize/[id]/
│   │           ├── route.ts
│   │           └── connections/route.ts
│   │
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── ArtistCard.tsx
│   │   ├── SongRow.tsx
│   │   ├── AlbumGroup.tsx
│   │   ├── SongTabs.tsx          # Lyrics/About/Credits/Annotations
│   │   ├── LyricsView.tsx
│   │   ├── CreditsTable.tsx
│   │   ├── AnnotationsView.tsx
│   │   ├── ArtistViz.tsx         # Canvas galaxy v2
│   │   ├── VizControls.tsx       # Spider web toggles, filters
│   │   ├── LibraryTable.tsx
│   │   ├── Waveform.tsx
│   │   ├── HistoryChart.tsx
│   │   └── TagBadge.tsx
│   │
│   └── lib/
│       ├── genius.ts             # Genius API (extended)
│       ├── musicbrainz.ts        # MusicBrainz API
│       ├── db.ts                 # PostgreSQL client (pg / postgres.js)
│       ├── redis.ts              # Redis client (ioredis)
│       ├── analyst.ts            # HTTP client for analyst sidecar
│       └── types.ts              # Shared TypeScript types
│
├── public/
│   └── .gitkeep
│
├── tailwind.config.ts
├── next.config.mjs
├── tsconfig.json
├── package.json
└── postcss.config.mjs
```

---

## 14. Implementation Order

Build in this sequence. Each phase is independently deployable.

### Phase 1 — Verseatile parity + quality (do this first)
- Song page tabs (Lyrics / About / Credits) — data already in API
- Fix visualization: zoom/pan + force layout
- DB caching layer (PostgreSQL) to avoid re-scraping

### Phase 2 — Spider web visualization
- `/api/visualize/[id]/connections` endpoint
- VizControls sidebar
- Connection line rendering in ArtistViz.tsx
- Timeline view toggle

### Phase 3 — Library (analyst sidecar)
- Python sidecar: Docker setup, file indexing pipeline
- Library page + file detail page
- Waveform rendering + display

### Phase 4 — Enrichment
- MusicBrainz integration (artist MBID, credits, ISRCs)
- AcoustID fingerprinting for unmatched files
- Annotations tab (Genius scrape)

### Phase 5 — History & Tags
- History recording (automatic on lyrics read)
- EchoGraph page
- Tags CRUD + tagging UI

### Phase 6 — Backup
- pg_dump to S3
- Settings page wiring

---

## 15. Key decisions for the implementer

1. **Use `postgres.js`** (not `pg`) for the DB client — better TypeScript support, no callback hell.

2. **DB migrations with raw SQL files** numbered `001_initial.sql`, `002_add_tags.sql` etc. Run on startup in a `migrate.ts` script called from `next.config.mjs`. No ORM.

3. **Genius scraping happens in Next.js API routes**, not the Python sidecar. The sidecar only handles local audio files.

4. **All canvas work stays in one file** (`ArtistViz.tsx`). When it gets too large, split into `useVizLayout.ts` (force sim), `useVizRenderer.ts` (draw loop), `useVizInteraction.ts` (mouse events).

5. **Redis for two things only**: short-lived API response cache (5-minute TTL) and pub-sub for analyst → app file-indexed events. Don't put session data in Redis.

6. **The analyst sidecar never reads the DB directly** — it only calls the Next.js internal API to write results. This keeps the boundary clean.

7. **`LIBRARY_PATH` defaults to `/tmp/music`** when not set, so the app starts without a real library and the analyst just stays idle.

8. **All Genius API calls go through the DB cache** — check DB first, only hit Genius on a miss, write result back with `fetched_at`. This avoids burning through the API rate limit on repeated page loads.
