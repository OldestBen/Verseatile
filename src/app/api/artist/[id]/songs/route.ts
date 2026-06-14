import { NextRequest, NextResponse } from 'next/server'
import { getAllSongs } from '@/lib/genius'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid artist id' }, { status: 400 })
  }

  try {
    const songs = await getAllSongs(id)
    return NextResponse.json({ songs })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('GENIUS_ACCESS_TOKEN') ? 500 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
