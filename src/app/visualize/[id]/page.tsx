import ArtistViz from '@/components/ArtistViz'

export default function VisualizePage({ params }: { params: { id: string } }) {
  return (
    <div className="w-screen h-screen overflow-hidden bg-[#08080a]">
      <ArtistViz artistId={params.id} />
    </div>
  )
}
