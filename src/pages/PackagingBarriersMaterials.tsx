import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PackagingBarriersMaterials() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Packaging Barriers & Material Impact</h1>
        <p className="text-muted-foreground mt-2">
          How packaging materials protect against oxygen, moisture, and light degradation
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Oxygen Barriers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-semibold mb-2">High Barrier Materials:</p>
              <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                <li>Metallized films (aluminum laminate)</li>
                <li>EVOH (ethylene vinyl alcohol) layers</li>
                <li>Glass and metal containers</li>
              </ul>
              <p className="text-muted-foreground mt-2">Best for: fatty products, nuts, whole grain items prone to rancidity</p>
            </div>
            
            <div>
              <p className="font-semibold mb-2">Medium Barrier:</p>
              <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                <li>Multi-layer PET/PE films</li>
                <li>Coated paperboard</li>
              </ul>
              <p className="text-muted-foreground mt-2">Best for: cookies, crackers with moderate fat</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Moisture Barriers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-semibold mb-2">High Moisture Protection:</p>
              <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                <li>LDPE/HDPE films (polyethylene)</li>
                <li>Wax-coated papers</li>
                <li>Foil laminates</li>
              </ul>
              <p className="text-muted-foreground mt-2">Best for: crispy products (crackers, wafers) in humid climates</p>
            </div>
            
            <div>
              <p className="font-semibold mb-2">Breathable Options:</p>
              <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                <li>Micro-perforated films</li>
                <li>Uncoated kraft paper</li>
              </ul>
              <p className="text-muted-foreground mt-2">Best for: crusty breads that need to release steam</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Light/UV Protection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">UV exposure accelerates lipid oxidation and vitamin degradation.</p>
            
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
              <li><span className="font-semibold">Opaque packaging:</span> Metallized or pigmented films</li>
              <li><span className="font-semibold">UV-blocking additives:</span> In clear PET bottles</li>
              <li><span className="font-semibold">Secondary packaging:</span> Outer cartons for light-sensitive items</li>
            </ul>
            
            <p className="text-muted-foreground mt-2">Essential for: products with natural colors, omega-3s, or vitamin fortification</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Packaging</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Next-generation solutions that interact with the product:</p>
            
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
              <li><span className="font-semibold">Oxygen scavengers:</span> Iron-based sachets or film layers</li>
              <li><span className="font-semibold">Moisture absorbers:</span> Silica gel packets, desiccant films</li>
              <li><span className="font-semibold">Antimicrobial films:</span> Silver ion or natural extract coatings</li>
              <li><span className="font-semibold">Ethylene absorbers:</span> For baked goods with fruit</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
