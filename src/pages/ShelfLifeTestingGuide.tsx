import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ShelfLifeTestingGuide() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Shelf-Life Testing Guide</h1>
        <p className="text-muted-foreground mt-2">
          Understand water activity, pH testing, and preservation strategies for product safety
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Water Activity (Aw) Testing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
              <li><span className="font-semibold">Equipment:</span> Water activity meter (Aqualab, Novasina)</li>
              <li><span className="font-semibold">Frequency:</span> Every batch or at least monthly</li>
              <li>
                <span className="font-semibold">Target:</span>
                <ul className="list-disc ml-6 mt-1 space-y-1">
                  <li>&lt;0.85 for mold prevention (room temp)</li>
                  <li>&lt;0.60 for long-term stability</li>
                </ul>
              </li>
              <li><span className="font-semibold">Notes:</span> Aw determines microbial risk and staling rate.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>pH Testing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
              <li><span className="font-semibold">Equipment:</span> pH meter or strips</li>
              <li><span className="font-semibold">Method:</span> Mix sample with distilled water (1:10 ratio), measure</li>
              <li>
                <span className="font-semibold">Target:</span>
                <ul className="list-disc ml-6 mt-1 space-y-1">
                  <li>&lt;4.6 for high-acid preservation</li>
                  <li>Monitor consistency batch-to-batch</li>
                </ul>
              </li>
              <li><span className="font-semibold">Notes:</span> pH affects microbial growth and preservative effectiveness.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Microbial Testing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground font-semibold mb-2">Tests:</p>
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
              <li>Total plate count (TPC)</li>
              <li>Yeast & mold count</li>
              <li>Coliform and pathogen screening</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              <span className="font-semibold">Notes:</span> Typically done at product launch and quarterly or after formulation changes.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sensory Evaluation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground mb-2">Panel testing evaluates:</p>
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
              <li>Appearance (mold, color changes)</li>
              <li>Aroma (off-odors, rancidity)</li>
              <li>Texture (staleness, sogginess)</li>
              <li>Flavor (off-flavors, loss of freshness)</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              <span className="font-semibold">Notes:</span> Define acceptable limits for each attribute.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommended Testing Labs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
              <li><span className="font-semibold">Eurofins:</span> Comprehensive shelf-life and microbial testing</li>
              <li><span className="font-semibold">Mérieux NutriSciences:</span> ASLT and validation services</li>
              <li><span className="font-semibold">Local university food science labs:</span> Often offer testing at lower cost</li>
              <li><span className="font-semibold">DIY Options:</span> In-house water activity meters (~$3,000)</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
