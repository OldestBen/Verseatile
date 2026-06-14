import axios from 'axios'
import * as cheerio from 'cheerio'

const GENIUS_API_BASE = 'https://api.genius.com'
const GENIUS_BASE = 'https://genius.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function getClient() {
  const token = process.env.GENIUS_ACCESS_TOKEN
  if (!token) {
    throw new Error('GENIUS_ACCESS_TOKEN environment variable is not set')
  }
  return axios.create({
    baseURL: GENIUS_API_BASE,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export interface Artist {
  id: number
  name: string
  image_url: string | null
  header_image_url: string | null
  url: string
  followers_count?: number
  description?: string
}

export interface Song {
  id: number
  title: string
  full_title: string
  url: string
  path: string
  song_art_image_url: string | null
  header_image_url: string | null
  primary_artist: {
    id: number
    name: string
    image_url: string | null
  }
  album?: {
    id: number
    name: string
    cover_art_url: string | null
  } | null
  release_date_for_display?: string | null
  stats?: {
    pageviews?: number
  }
}

export interface SearchResult {
  artists: Artist[]
}

export async function searchArtists(query: string): Promise<Artist[]> {
  const client = getClient()
  const response = await client.get('/search', {
    params: { q: query, per_page: 20 },
  })

  const hits = response.data.response.hits as Array<{
    type: string
    result: {
      primary_artist: {
        id: number
        name: string
        image_url: string | null
        header_image_url: string | null
        url: string
      }
    }
  }>

  // Deduplicate artists by id
  const artistMap = new Map<number, Artist>()
  for (const hit of hits) {
    if (hit.type === 'song') {
      const a = hit.result.primary_artist
      if (!artistMap.has(a.id)) {
        artistMap.set(a.id, {
          id: a.id,
          name: a.name,
          image_url: a.image_url,
          header_image_url: a.header_image_url,
          url: a.url,
        })
      }
    }
  }

  return Array.from(artistMap.values())
}

export async function getArtist(id: number): Promise<Artist> {
  const client = getClient()
  const response = await client.get(`/artists/${id}`)
  const a = response.data.response.artist
  return {
    id: a.id,
    name: a.name,
    image_url: a.image_url,
    header_image_url: a.header_image_url,
    url: a.url,
    followers_count: a.followers_count,
    description: a.description?.plain ?? undefined,
  }
}

export async function getAllSongs(artistId: number): Promise<Song[]> {
  const client = getClient()
  const allSongs: Song[] = []
  let page: number | null = 1

  while (page !== null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: { data: any } = await client.get(`/artists/${artistId}/songs`, {
      params: { per_page: 50, page, sort: 'release_date' },
    })

    const songs: Song[] = response.data.response.songs.map((s: Record<string, unknown>) => ({
      id: s.id,
      title: s.title,
      full_title: s.full_title,
      url: s.url,
      path: s.path,
      song_art_image_url: s.song_art_image_url,
      header_image_url: s.header_image_url,
      primary_artist: s.primary_artist,
      album: s.album ?? null,
      release_date_for_display: s.release_date_for_display ?? null,
      stats: s.stats,
    }))

    allSongs.push(...songs)
    page = response.data.response.next_page ?? null
  }

  return allSongs
}

export async function getSong(id: number): Promise<Song> {
  const client = getClient()
  const response = await client.get(`/songs/${id}`)
  const s = response.data.response.song
  return {
    id: s.id,
    title: s.title,
    full_title: s.full_title,
    url: s.url,
    path: s.path,
    song_art_image_url: s.song_art_image_url,
    header_image_url: s.header_image_url,
    primary_artist: s.primary_artist,
    album: s.album ?? null,
    release_date_for_display: s.release_date_for_display ?? null,
    stats: s.stats,
  }
}

export async function scrapeLyrics(path: string): Promise<string> {
  const url = `${GENIUS_BASE}${path}`
  const response = await axios.get(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  })

  const $ = cheerio.load(response.data as string)

  const containers = $('[data-lyrics-container="true"]')
  if (containers.length === 0) {
    // Fallback: try other known selectors
    const fallback = $('.lyrics')
    if (fallback.length > 0) {
      return fallback.text().trim()
    }
    return ''
  }

  const lyricParts: string[] = []

  containers.each((_, el) => {
    // Replace <br> tags with newlines
    $(el)
      .find('br')
      .replaceWith('\n')

    // Get the text content
    const text = $(el).text()
    lyricParts.push(text)
  })

  return lyricParts.join('\n\n').trim()
}
