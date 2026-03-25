import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ShelfLifeTestingValidation() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Shelf-Life Testing & Validation Methods</h1>
        <p className="text-muted-foreground mt-2">
          How to scientifically determine and validate shelf life for your products
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Real-Time Shelf-Life Studies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">The gold standard for determining actual shelf life under normal storage conditions.</p>
            
            <div>
              <p className="font-semibold mb-2">Protocol:</p>
              <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                <li>Store samples at intended storage temperature (room temp, refrigerated, frozen)</li>
                <li>Test at regular intervals (weekly for short shelf life, monthly for longer)</li>
                <li>Monitor microbial growth, sensory changes, texture, and chemical markers</li>
                <li>Define failure point: mold growth, off-flavors, texture degradation, or safety limit</li>
              </ul>
              <p className="text-muted-foreground mt-2"><span className="font-semibold">Typical Duration:</span> 1-3x expected shelf life (e.g., 60-90 days for a 30-day product)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accelerated Shelf-Life Testing (ASLT)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Speeds up degradation by increasing temperature. Estimates shelf life faster but requires validation.</p>
            
            <div>
              <p className="font-semibold mb-2">Q10 Method:</p>
              <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                <li>Store samples at elevated temperatures (e.g., 35°C, 45°C)</li>
                <li>Apply Q10 factor (typically 2-3): every 10°C increase speeds reactions 2-3x</li>
                <li>Calculate estimated room-temperature shelf life from accelerated data</li>
              </ul>
              <p className="text-muted-foreground mt-2"><span className="font-semibold">Caution:</span> ASLT may not accurately predict all failure modes (e.g., moisture migration). Always confirm with real-time studies.</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Water Activity (Aw) Testing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground"><span className="font-semibold">Equipment:</span> Water activity meter (Aqualab, Novasina)</p>
              <p className="text-muted-foreground"><span className="font-semibold">Frequency:</span> Every batch or at least monthly</p>
              
              <div>
                <p className="font-semibold mb-2">Target:</p>
                <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                  <li>&lt;0.85 for mold prevention (room temp)</li>
                  <li>&lt;0.60 for long-term stability</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>pH Testing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground"><span className="font-semibold">Equipment:</span> pH meter or strips</p>
              <p className="text-muted-foreground"><span className="font-semibold">Method:</span> Mix sample with distilled water (1:10 ratio), measure</p>
              
              <div>
                <p className="font-semibold mb-2">Target:</p>
                <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                  <li>&lt;4.6 for high-acid preservation</li>
                  <li>Monitor consistency batch-to-batch</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Microbial Testing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-semibold mb-2">Tests:</p>
                <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                  <li>Total plate count (TPC)</li>
                  <li>Yeast & mold count</li>
                  <li>Coliform and pathogen screening</li>
                </ul>
                <p className="text-muted-foreground mt-2">Typically done at product launch and periodically (quarterly) or after formulation changes.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sensory Evaluation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground"><span className="font-semibold">Panel testing:</span> Trained or consumer panels evaluate:</p>
              
              <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                <li>Appearance (mold, color changes)</li>
                <li>Aroma (off-odors, rancidity)</li>
                <li>Texture (staleness, sogginess)</li>
                <li>Flavor (off-flavors, loss of freshness)</li>
              </ul>
              
              <p className="text-muted-foreground mt-2">Define acceptable limits for each attribute.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recommended Testing Lab Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-muted-foreground">
              <li><span className="font-semibold">• Eurofins:</span> Comprehensive shelf-life and microbial testing</li>
              <li><span className="font-semibold">• Mérieux NutriSciences:</span> ASLT and validation services</li>
              <li><span className="font-semibold">• Local university food science labs:</span> Often offer testing at lower cost</li>
              <li><span className="font-semibold">• DIY:</span> Water activity meters (~$3,000) for in-house monitoring</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
