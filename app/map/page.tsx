import MapPage from "@/components/MapPage";

export const metadata = { title: "Map — Roman Martyrology" };

export default async function MapRoute({ searchParams }: { searchParams: Promise<{ edition?: string | string[] }> }) {
  const { edition } = await searchParams;
  return <MapPage initialEdition={typeof edition === "string" ? edition : null} />;
}
