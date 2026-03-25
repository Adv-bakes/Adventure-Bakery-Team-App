import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FunctionalIngredientsShelfLife() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Functional Ingredients for Shelf Life</h1>
        <p className="text-muted-foreground mt-2">
          Natural and synthetic additives that preserve freshness, moisture, and safety
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Humectants (Moisture Retention)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Humectants bind water and help maintain soft texture while controlling water activity.
            </p>
            
            <div>
              <p className="font-semibold mb-2">Common options:</p>
              <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                <li><span className="font-semibold">Glycerin:</span> Clean label, highly effective, 0.5–2%</li>
                <li><span className="font-semibold">Honey:</span> Natural, adds flavor, 5–10%</li>
                <li><span className="font-semibold">Invert sugar / glucose syrup:</span> Common in commercial bakery, 3–8%</li>
                <li><span className="font-semibold">Sorbitol:</span> Synthetic, very hygroscopic, 1–3%</li>
              </ul>
              <p className="text-muted-foreground mt-2">Best for: soft cookies, brownies, bars</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mold Inhibitors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Extend shelf life by preventing mold growth in products with aw &gt; 0.70.
            </p>
            
            <div>
              <p className="font-semibold mb-2">Natural options:</p>
              <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                <li><span className="font-semibold">Cultured wheat / vinegar:</span> Clean label, fermented ingredients</li>
                <li><span className="font-semibold">Raisin juice concentrate:</span> Natural acids</li>
              </ul>
            </div>
            
            <div>
              <p className="font-semibold mb-2">Synthetic options:</p>
              <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                <li><span className="font-semibold">Calcium propionate:</span> Most common, bread industry standard, 0.1–0.3%</li>
                <li><span className="font-semibold">Potassium sorbate:</span> Effective in lower pH products, 0.05–0.2%</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Antioxidants (Prevent Rancidity)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Slow oxidation of fats and oils to prevent off-flavors.
            </p>
            
            <div>
              <p className="font-semibold mb-2">Natural options:</p>
              <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                <li><span className="font-semibold">Rosemary extract:</span> Highly effective, clean label, 0.02–0.1%</li>
                <li><span className="font-semibold">Mixed tocopherols (Vitamin E):</span> Protects polyunsaturated fats, 0.01–0.05%</li>
                <li><span className="font-semibold">Green tea extract:</span> Polyphenol-based, emerging option</li>
              </ul>
            </div>
            
            <div>
              <p className="font-semibold mb-2">Synthetic options:</p>
              <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
                <li><span className="font-semibold">BHT / BHA:</span> Very effective but not clean label</li>
              </ul>
              <p className="text-muted-foreground mt-2">Best for: high-fat products (nuts, granola, whole grain baked goods)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enzymes (Texture & Freshness)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Enzymes can improve dough handling and extend softness.
            </p>
            
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
              <li><span className="font-semibold">Amylases:</span> Break down starch, slow staling</li>
              <li><span className="font-semibold">Lipases:</span> Improve dough strength and volume</li>
              <li><span className="font-semibold">Xylanases:</span> Soften whole grain products</li>
            </ul>
            
            <p className="text-muted-foreground mt-2">Common in commercial bread and buns; less common in artisan baking</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Emulsifiers (Moisture Distribution)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Help distribute moisture evenly and prevent staling.
            </p>
            
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
              <li><span className="font-semibold">Lecithin (soy, sunflower):</span> Natural, widely used, 0.2–0.5%</li>
              <li><span className="font-semibold">Mono- and diglycerides:</span> Improve crumb softness, delay staling</li>
              <li><span className="font-semibold">DATEM:</span> Dough conditioner, commercial bread staple</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acidulants (pH Control)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Lower pH to inhibit microbial growth.
            </p>
            
            <ul className="list-disc ml-6 space-y-1 text-muted-foreground">
              <li><span className="font-semibold">Citric acid:</span> Clean label, adds tartness, 0.1–0.3%</li>
              <li><span className="font-semibold">Lactic acid:</span> Mild flavor impact</li>
              <li><span className="font-semibold">Acetic acid (vinegar):</span> Effective in savory products</li>
            </ul>
            
            <p className="text-muted-foreground mt-2">Best for: fruit-based bars, muffins with berries, certain savory baked goods</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
