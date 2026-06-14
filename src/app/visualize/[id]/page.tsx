import ArtistViz from '@/components/ArtistViz'

export default async function VisualizePage({ params }: { params: { id: string } }) {
  return <ArtistViz artistId={params.id} />
}
