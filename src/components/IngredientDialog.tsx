import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

interface IngredientDialogProps {
  open: boolean;
  onClose: () => void;
  ingredient?: any;
}

export function IngredientDialog({ open, onClose, ingredient }: IngredientDialogProps) {
  const [formData, setFormData] = useState({
    ingredient_name: "",
    function_in_formula: "",
    specification_notes: "",
    sourceability: "",
    additional_notes: "",
  });
  const [allergens, setAllergens] = useState<string[]>([]);
  const [certifications, setCertifications] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const allergenOptions = ["Milk", "Egg", "Wheat", "Soy", "Tree Nuts", "Peanuts", "Sesame"];
  const certificationOptions = ["Organic", "Non-GMO", "Gluten-Free", "Vegan", "Kosher"];
  const sourceabilityOptions = ["Wholesale", "Specialty", "MOQ concern", "Unknown"];

  useEffect(() => {
    if (ingredient) {
      setFormData({
        ingredient_name: ingredient.ingredient_name || "",
        function_in_formula: ingredient.function_in_formula || "",
        specification_notes: ingredient.specification_notes || "",
        sourceability: ingredient.sourceability || "",
        additional_notes: ingredient.additional_notes || ingredient.notes || "",
      });
      setAllergens(ingredient.allergens || []);
      setCertifications(ingredient.certifications || []);
    } else {
      setFormData({
        ingredient_name: "",
        function_in_formula: "",
        specification_notes: "",
        sourceability: "",
        additional_notes: "",
      });
      setAllergens([]);
      setCertifications([]);
    }
  }, [ingredient, open]);

  const handleSave = async () => {
    if (!formData.ingredient_name.trim()) {
      toast({ title: "Ingredient name is required", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast({ title: "You must be logged in", variant: "destructive" });
      setIsSaving(false);
      return;
    }

    const dataToSave = {
      ...formData,
      allergens,
      certifications,
      user_id: user.id,
    };

    let error;
    if (ingredient) {
      ({ error } = await supabase
        .from("ingredients")
        .update(dataToSave)
        .eq("id", ingredient.id));
    } else {
      ({ error } = await supabase
        .from("ingredients")
        .insert([dataToSave as any]));
    }

    setIsSaving(false);

    if (error) {
      toast({ title: "Error saving ingredient", variant: "destructive" });
    } else {
      toast({ title: `Ingredient ${ingredient ? "updated" : "created"} successfully` });
      onClose();
    }
  };

  const toggleAllergen = (allergen: string) => {
    setAllergens(prev =>
      prev.includes(allergen)
        ? prev.filter(a => a !== allergen)
        : [...prev, allergen]
    );
  };

  const toggleCertification = (cert: string) => {
    setCertifications(prev =>
      prev.includes(cert)
        ? prev.filter(c => c !== cert)
        : [...prev, cert]
    );
  };

  const fetchSuggestions = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const { data, error } = await supabase
      .from("ingredients")
      .select("*")
      .ilike("ingredient_name", `%${query}%`)
      .limit(5);

    if (!error && data) {
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
    }
  };

  const handleIngredientNameChange = (value: string) => {
    setFormData({ ...formData, ingredient_name: value });
    fetchSuggestions(value);
  };

  const selectSuggestion = (suggestion: any) => {
    setFormData({
      ingredient_name: suggestion.ingredient_name,
      function_in_formula: suggestion.function_in_formula || "",
      specification_notes: suggestion.specification_notes || "",
      sourceability: suggestion.sourceability || "",
      additional_notes: suggestion.additional_notes || suggestion.notes || "",
    });
    setAllergens(suggestion.allergens || []);
    setCertifications(suggestion.certifications || []);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{ingredient ? "Edit Ingredient" : "New Ingredient"}</DialogTitle>
          <DialogDescription>
            Track ingredient details, suppliers, and allergen information
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Label htmlFor="ingredient_name">Ingredient Name *</Label>
            <Input
              id="ingredient_name"
              value={formData.ingredient_name}
              onChange={(e) => handleIngredientNameChange(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onBlur={() => {
                // Delay to allow click on suggestion
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              placeholder="e.g., All-Purpose Flour"
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    onClick={() => selectSuggestion(suggestion)}
                    className="px-4 py-2 hover:bg-accent cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{suggestion.ingredient_name}</span>
                      {suggestion.function_in_formula && (
                        <span className="text-xs text-muted-foreground">
                          {suggestion.function_in_formula}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="function_in_formula">Function in Formula</Label>
            <Input
              id="function_in_formula"
              value={formData.function_in_formula}
              onChange={(e) => setFormData({ ...formData, function_in_formula: e.target.value })}
              placeholder="e.g., Structure, Sweetener, Emulsifier"
            />
          </div>
          <div>
            <Label htmlFor="specification_notes">Specification / Notes</Label>
            <Textarea
              id="specification_notes"
              value={formData.specification_notes}
              onChange={(e) => setFormData({ ...formData, specification_notes: e.target.value })}
              placeholder="Detailed specifications"
              rows={2}
            />
          </div>
          <div>
            <Label>Allergens</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {allergenOptions.map((allergen) => (
                <div key={allergen} className="flex items-center space-x-2">
                  <Checkbox
                    id={`allergen-${allergen}`}
                    checked={allergens.includes(allergen)}
                    onCheckedChange={() => toggleAllergen(allergen)}
                  />
                  <Label htmlFor={`allergen-${allergen}`} className="font-normal cursor-pointer">
                    {allergen}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label>Certifications</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {certificationOptions.map((cert) => (
                <div key={cert} className="flex items-center space-x-2">
                  <Checkbox
                    id={`cert-${cert}`}
                    checked={certifications.includes(cert)}
                    onCheckedChange={() => toggleCertification(cert)}
                  />
                  <Label htmlFor={`cert-${cert}`} className="font-normal cursor-pointer">
                    {cert}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="sourceability">Sourceability</Label>
            <select
              id="sourceability"
              value={formData.sourceability}
              onChange={(e) => setFormData({ ...formData, sourceability: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Select sourceability</option>
              {sourceabilityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="additional_notes">Additional Notes</Label>
            <Textarea
              id="additional_notes"
              value={formData.additional_notes}
              onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
              placeholder="Additional notes"
              rows={3}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : ingredient ? "Update" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}