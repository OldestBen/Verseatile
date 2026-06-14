import { NextRequest, NextResponse } from 'next/server'
import { searchArtists } from '@/lib/genius'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')

  if (!q || q.trim().length === 0) {
    return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 })
  }

  try {
    const artists = await searchArtists(q.trim())
    return NextResponse.json({ artists })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('GENIUS_ACCESS_TOKEN') ? 500 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
