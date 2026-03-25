import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ShelfLifeScience() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Shelf-Life Science</h1>
        <p className="text-muted-foreground mt-2">
          Understanding the Core Scientific Drivers Behind Product Stability
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Water Activity (aw)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Water activity (aw) is one of the most important determinants of shelf life. It measures the amount of unbound water available for microbial growth and chemical reactions. Foods with higher aw values support faster spoilage, mold development, and microbial growth. Low aw foods (below 0.60) generally resist microbial proliferation, while values between 0.60 and 0.85 require careful formulation, packaging, or preservatives.
            </p>
            
            <div>
              <p className="font-semibold mb-2">Typical aw targets by category:</p>
              <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                <li>Baked goods: 0.45–0.60</li>
                <li>Soft cookies / brownies: 0.50–0.70</li>
                <li>Bars: 0.60–0.75</li>
                <li>Nuts/trail mix: 0.30–0.50</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>pH & Acidity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              pH significantly influences microbial stability. Lower pH reduces microbial risk by limiting the growth of pathogens and spoilage organisms. Acidified or naturally acidic products benefit from extended shelf life due to inhibited microbial growth.
            </p>
            
            <div>
              <p className="font-semibold mb-2">Typical ranges:</p>
              <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                <li>High acid foods: pH &lt; 4.6</li>
                <li>Low acid shelf-stable foods: pH &gt; 4.6 but require formulation, packaging, or processing controls.</li>
              </ul>
            </div>
            
            <p className="text-muted-foreground mt-4">
              pH interacts with preservatives and water activity to create a multi-hurdle system that provides comprehensive protection against spoilage.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Moisture Content & Moisture Migration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Moisture content refers to total water in the product, but this differs from water activity. A product may have high moisture but low aw if water is tightly bound by humectants. Moisture migration is a key source of textural change: soft components lose moisture and become dry, while dry components absorb moisture and become soggy.
            </p>
            
            <p className="text-muted-foreground">
              Balancing humectants and barrier properties helps maintain texture throughout shelf life.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fat Type & Oxidation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Fat oxidation (rancidity) is one of the most common causes of off-flavors in shelf-stable products. Different fats oxidize at different rates.
            </p>
            
            <div>
              <p className="font-semibold mb-2">Examples:</p>
              <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                <li>Polyunsaturated oils oxidize fastest (e.g., flaxseed, sunflower).</li>
                <li>Saturated fats are more stable (palm, coconut, shortening).</li>
                <li>Antioxidants like rosemary extract or mixed tocopherols help delay rancidity.</li>
              </ul>
            </div>
            
            <p className="text-muted-foreground mt-4">
              Oxygen exposure, light, and metal ions all play critical roles in accelerating oxidative rancidity.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Temperature Sensitivity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Shelf life decreases as storage temperature increases. Chemical reactions, microbial growth, and oxidative processes accelerate exponentially at higher temperatures.
            </p>
            
            <div>
              <p className="font-semibold mb-2">General guidance:</p>
              <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                <li>Room temperature (20–25°C) is standard for shelf-life studies.</li>
                <li>Accelerated testing often uses 35–45°C to simulate long-term storage.</li>
                <li>Refrigeration slows reactions but may cause textural changes in baked goods.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Microbial Growth & Spoilage Mechanisms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Microbial spoilage can occur through mold, yeast, and bacteria depending on product type and aw. Mold typically appears first in baked goods with aw &gt; 0.60.
            </p>
            
            <div>
              <p className="font-semibold mb-2">Common spoilage indicators:</p>
              <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                <li>Visual mold</li>
                <li>Yeast activity (fermentation)</li>
                <li>Off-odors</li>
                <li>Slime formation in higher moisture foods</li>
                <li>Color changes</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key Interactions (Multi-Hurdle Approach)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Proper shelf-life formulation requires balancing multiple factors simultaneously. Combining lower aw, reduced pH, antioxidants, proper packaging, and controlled processing forms an effective multi-hurdle preservation system.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
