import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

interface IngredientFamily {
  name: string;
  keywords: string[];
  fields: FieldConfig[];
}

interface FieldConfig {
  name: string;
  label: string;
  type: "select" | "text" | "number";
  options?: string[];
  suffix?: string;
}

const INGREDIENT_FAMILIES: IngredientFamily[] = [
  {
    name: "Flour",
    keywords: ["flour", "wheat", "almond flour", "coconut flour"],
    fields: [
      { name: "type", label: "Type", type: "select", options: ["Bleached", "Unbleached", "Whole Wheat", "Almond", "Coconut", "All-Purpose"] },
      { name: "protein", label: "Protein %", type: "number", suffix: "%" },
      { name: "grain_source", label: "Grain Source", type: "text" },
      { name: "brand", label: "Brand", type: "text" },
    ],
  },
  {
    name: "Sugar",
    keywords: ["sugar", "sweetener", "sucrose"],
    fields: [
      { name: "type", label: "Type", type: "select", options: ["Cane", "Beet", "Coconut", "Brown"] },
      { name: "granulation", label: "Granulation", type: "select", options: ["Fine", "Regular", "Extra Fine", "Coarse"] },
      { name: "color", label: "Color", type: "text" },
    ],
  },
  {
    name: "Salt",
    keywords: ["salt", "sodium"],
    fields: [
      { name: "grain_size", label: "Grain Size", type: "select", options: ["Fine", "Kosher", "Flake", "Coarse"] },
      { name: "source", label: "Source", type: "select", options: ["Sea", "Rock", "Iodized", "Himalayan"] },
    ],
  },
  {
    name: "Oil",
    keywords: ["oil", "fat", "shortening"],
    fields: [
      { name: "source", label: "Source", type: "select", options: ["Soybean", "Canola", "Coconut", "MCT", "Olive", "Avocado"] },
      { name: "refinement", label: "Refinement", type: "select", options: ["Crude", "Refined", "Expeller-Pressed", "Cold-Pressed"] },
    ],
  },
  {
    name: "Cocoa",
    keywords: ["cocoa", "cacao", "chocolate"],
    fields: [
      { name: "type", label: "Type", type: "select", options: ["Natural", "Dutched", "Dark", "Milk"] },
      { name: "fat_pct", label: "Fat %", type: "number", suffix: "%" },
      { name: "mesh_size", label: "Mesh Size", type: "text" },
    ],
  },
  {
    name: "Protein",
    keywords: ["protein", "whey", "pea protein", "soy protein"],
    fields: [
      { name: "source", label: "Source", type: "select", options: ["Pea", "Whey", "Soy", "Rice", "Hemp"] },
      { name: "concentration", label: "Concentration %", type: "number", suffix: "%" },
      { name: "flavor", label: "Flavor", type: "text" },
    ],
  },
  {
    name: "Fiber",
    keywords: ["fiber", "inulin", "oat fiber"],
    fields: [
      { name: "source", label: "Source", type: "select", options: ["Inulin", "Oat", "Apple", "Bamboo", "Psyllium"] },
      { name: "solubility", label: "Solubility", type: "select", options: ["Soluble", "Insoluble", "Mixed"] },
    ],
  },
];

interface IngredientSpecDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseIngredient: string;
  onSpecComplete: (formattedName: string, specData?: any) => void;
  conceptId?: number;
  formulaId?: number;
}

const IngredientSpecDialog = ({
  open,
  onOpenChange,
  baseIngredient,
  onSpecComplete,
  conceptId,
  formulaId,
}: IngredientSpecDialogProps) => {
  const [detectedFamily, setDetectedFamily] = useState<IngredientFamily | null>(null);
  const [specValues, setSpecValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && baseIngredient) {
      const detected = detectIngredientFamily(baseIngredient);
      setDetectedFamily(detected);
      loadExistingSpecs();
    }
  }, [open, baseIngredient]);

  const loadExistingSpecs = async () => {
    if (!formulaId) {
      setSpecValues({});
      setNotes("");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("ingredient_specs")
      .select("*")
      .eq("formula_id", formulaId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (data && !error) {
      const fields = data.spec_fields as Record<string, string> || {};
      setSpecValues(fields);
      setNotes("");
    } else {
      setSpecValues({});
      setNotes("");
    }
  };

  const detectIngredientFamily = (ingredient: string): IngredientFamily | null => {
    const normalized = ingredient.toLowerCase().trim();
    return INGREDIENT_FAMILIES.find((family) =>
      family.keywords.some((keyword) => normalized.includes(keyword))
    ) || null;
  };

  const formatIngredientName = (): string => {
    if (!detectedFamily) return baseIngredient;

    const parts: string[] = [];
    detectedFamily.fields.forEach((field) => {
      const value = specValues[field.name];
      if (value) {
        if (field.suffix) {
          parts.push(`${value}${field.suffix}`);
        } else {
          parts.push(value);
        }
      }
    });

    if (parts.length === 0) return baseIngredient;
    return `${parts.join(" ")} ${detectedFamily.name}`;
  };

  const handleSubmit = async () => {
    setIsLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      setIsLoading(false);
      return;
    }

    const formattedName = formatIngredientName();
    const specData: any = {
      base_ingredient: detectedFamily?.name || baseIngredient,
      spec_fields: specValues,
      formatted_name: formattedName,
      user_id: user.id,
      concept_id: conceptId || null,
      formula_id: formulaId || null,
    };

    // Check if we're updating existing specs
    if (formulaId) {
      const { data: existing } = await supabase
        .from("ingredient_specs")
        .select("id")
        .eq("formula_id", formulaId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("ingredient_specs")
          .update(specData)
          .eq("id", existing.id);

        if (error) {
          toast.error("Failed to update ingredient specifications");
          console.error(error);
          setIsLoading(false);
          return;
        }
      } else {
        // Insert new
        const { error } = await supabase
          .from("ingredient_specs")
          .insert([specData]);

        if (error) {
          toast.error("Failed to save ingredient specifications");
          console.error(error);
          setIsLoading(false);
          return;
        }
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from("ingredient_specs")
        .insert([specData]);

      if (error) {
        toast.error("Failed to save ingredient specifications");
        console.error(error);
        setIsLoading(false);
        return;
      }
    }

    toast.success("Ingredient specifications saved");
    onSpecComplete(formattedName, specData);
    setIsLoading(false);
    onOpenChange(false);
  };

  const handleSkip = () => {
    onSpecComplete(baseIngredient, null);
    onOpenChange(false);
  };

  if (!detectedFamily) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Specify Ingredient Details
            </SheetTitle>
            <SheetDescription>
              We couldn't detect a specific ingredient family. You can add notes or skip this step.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label>Base Ingredient</Label>
              <Input value={baseIngredient} disabled />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional details about this ingredient..."
                rows={4}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={handleSkip}>
                Skip
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Specify {detectedFamily.name} Details
          </SheetTitle>
          <SheetDescription>
            Help us understand the exact type of {detectedFamily.name.toLowerCase()} you're using for manufacturing accuracy.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label>Base Ingredient</Label>
            <Input value={baseIngredient} disabled />
          </div>

          {detectedFamily.fields.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name}>{field.label}</Label>
              {field.type === "select" && field.options ? (
                <Select
                  value={specValues[field.name] || ""}
                  onValueChange={(value) =>
                    setSpecValues({ ...specValues, [field.name]: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === "number" ? (
                <div className="relative">
                  <Input
                    id={field.name}
                    type="number"
                    step="0.1"
                    value={specValues[field.name] || ""}
                    onChange={(e) =>
                      setSpecValues({ ...specValues, [field.name]: e.target.value })
                    }
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                  />
                  {field.suffix && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {field.suffix}
                    </span>
                  )}
                </div>
              ) : (
                <Input
                  id={field.name}
                  value={specValues[field.name] || ""}
                  onChange={(e) =>
                    setSpecValues({ ...specValues, [field.name]: e.target.value })
                  }
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                />
              )}
            </div>
          ))}

          <div className="space-y-2">
            <Label>Additional Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional details..."
              rows={3}
            />
          </div>

          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <p className="text-sm font-medium">Preview:</p>
            <p className="text-sm text-muted-foreground">
              {formatIngredientName()}
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={handleSkip}>
              Skip
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save & Apply"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default IngredientSpecDialog;
