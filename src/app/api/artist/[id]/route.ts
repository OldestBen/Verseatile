import { NextRequest, NextResponse } from 'next/server'
import { getArtist } from '@/lib/genius'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid artist id' }, { status: 400 })
  }

  try {
    const artist = await getArtist(id)
    return NextResponse.json({ artist })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('GENIUS_ACCESS_TOKEN') ? 500 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
