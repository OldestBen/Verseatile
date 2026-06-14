import { NextRequest, NextResponse } from 'next/server'
import { getSong } from '@/lib/genius'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid song id' }, { status: 400 })
  }

  try {
    const song = await getSong(id)
    return NextResponse.json({ song })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('GENIUS_ACCESS_TOKEN') ? 500 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
