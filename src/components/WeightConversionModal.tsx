import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WeightConversionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredientName: string;
  unit: string;
  onSave: (gramsPerUnit: number) => void;
}

const WeightConversionModal = ({ open, onOpenChange, ingredientName, unit, onSave }: WeightConversionModalProps) => {
  const [grams, setGrams] = useState("");

  const handleSave = () => {
    const gramsPerUnit = parseFloat(grams);
    if (!isNaN(gramsPerUnit) && gramsPerUnit > 0) {
      onSave(gramsPerUnit);
      setGrams("");
      onOpenChange(false);
    }
  };

  const measurementGuide: Record<string, string> = {
    cup: "1 cup",
    tbsp: "1 tablespoon",
    tsp: "1 teaspoon",
    "fl oz": "1 fluid ounce",
    pint: "1 pint",
    quart: "1 quart"
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Weight Conversion Needed</DialogTitle>
          <DialogDescription>
            We don't have a weight conversion for <strong>{ingredientName}</strong> in <strong>{unit}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Please measure <strong>{measurementGuide[unit] || `1 ${unit}`}</strong> of {ingredientName} and weigh it in grams.
          </p>
          <div className="space-y-2">
            <Label htmlFor="grams">Weight in Grams</Label>
            <Input
              id="grams"
              type="number"
              step="0.1"
              placeholder="Enter grams"
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!grams || parseFloat(grams) <= 0}>
            Save Conversion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WeightConversionModal;
