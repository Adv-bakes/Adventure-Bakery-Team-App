import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, CalendarIcon, Upload, FileText, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ConceptDialogProps {
  open: boolean;
  onClose: (newConceptId?: number | null) => void;
  concept?: any;
}

export function ConceptDialog({ open, onClose, concept }: ConceptDialogProps) {
  const [formData, setFormData] = useState({
    product_name: "",
    product_code: "",
    product_type: "",
    version_number: "",
    date_of_issue: undefined as Date | undefined,
    last_review_date: undefined as Date | undefined,
    next_review_date: undefined as Date | undefined,
    product_description: "",
    intended_use: "",
    target_market: "",
    key_qualities: "",
    notes: "",
    net_weight: "",
    net_weight_unit: "g",
    unit_length: "",
    unit_width: "",
    unit_height: "",
    shape: "",
  });
  const [claims, setClaims] = useState<string[]>([]);
  const [claimInput, setClaimInput] = useState("");
  const [dietaryCategories, setDietaryCategories] = useState<string[]>([]);
  const [dietaryCategoryInput, setDietaryCategoryInput] = useState("");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImageName, setProductImageName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    if (concept) {
      setFormData({
        product_name: concept.product_name || "",
        product_code: concept.product_code || "",
        product_type: concept.product_type || "",
        version_number: concept.version_number || "",
        date_of_issue: concept.date_of_issue ? new Date(concept.date_of_issue) : undefined,
        last_review_date: concept.last_review_date ? new Date(concept.last_review_date) : undefined,
        next_review_date: concept.next_review_date ? new Date(concept.next_review_date) : undefined,
        product_description: concept.product_description || "",
        intended_use: concept.intended_use || "",
        target_market: concept.target_market || "",
        key_qualities: concept.key_qualities || "",
        notes: concept.notes || "",
        net_weight: concept.net_weight || "",
        net_weight_unit: concept.net_weight_unit || "g",
        unit_length: concept.unit_length || "",
        unit_width: concept.unit_width || "",
        unit_height: concept.unit_height || "",
        shape: concept.shape || "",
      });
      setClaims(concept.desired_claims || []);
      setDietaryCategories(concept.dietary_category || []);
      setProductImageName(concept.product_image_name || "");
    } else {
      setFormData({
        product_name: "",
        product_code: "",
        product_type: "",
        version_number: "",
        date_of_issue: undefined,
        last_review_date: undefined,
        next_review_date: undefined,
        product_description: "",
        intended_use: "",
        target_market: "",
        key_qualities: "",
        notes: "",
        net_weight: "",
        net_weight_unit: "g",
        unit_length: "",
        unit_width: "",
        unit_height: "",
        shape: "",
      });
      setClaims([]);
      setDietaryCategories([]);
      setProductImage(null);
      setProductImageName("");
    }
  }, [concept, open]);

  const handleImageUpload = async (conceptId: number) => {
    if (!productImage) return null;

    setImageUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const fileExt = productImage.name.split('.').pop();
    const fileName = `${user.id}/${conceptId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-spec-sheets')
      .upload(fileName, productImage);

    setImageUploading(false);

    if (uploadError) {
      toast({ title: "Error uploading image", variant: "destructive" });
      return null;
    }

    return {
      product_image_path: fileName,
      product_image_name: productImage.name,
      product_image_uploaded_at: new Date().toISOString(),
    };
  };

  const handleSave = async () => {
    if (!formData.product_name.trim()) {
      toast({ title: "Product name is required", variant: "destructive" });
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
      date_of_issue: formData.date_of_issue?.toISOString().split('T')[0],
      last_review_date: formData.last_review_date?.toISOString().split('T')[0],
      next_review_date: formData.next_review_date?.toISOString().split('T')[0],
      net_weight: formData.net_weight ? String(formData.net_weight) : null,
      unit_length: formData.unit_length ? String(formData.unit_length) : null,
      unit_width: formData.unit_width ? String(formData.unit_width) : null,
      unit_height: formData.unit_height ? String(formData.unit_height) : null,
      desired_claims: claims,
      dietary_category: dietaryCategories,
      user_id: user.id,
    };

    let error, data;
    if (concept) {
      ({ error } = await supabase
        .from("concepts")
        .update(dataToSave)
        .eq("id", concept.id));
      
      if (!error && productImage) {
        const imageData = await handleImageUpload(concept.id);
        if (imageData) {
          await supabase
            .from("concepts")
            .update(imageData)
            .eq("id", concept.id);
        }
      }
    } else {
      ({ data, error } = await supabase
        .from("concepts")
        .insert([dataToSave as any])
        .select()
        .single());
      
      if (!error && data && productImage) {
        const imageData = await handleImageUpload(data.id);
        if (imageData) {
          await supabase
            .from("concepts")
            .update(imageData)
            .eq("id", data.id);
        }
      }
    }

    setIsSaving(false);

    if (error) {
      toast({ title: "Error saving concept", variant: "destructive" });
    } else {
      toast({ title: `Concept ${concept ? "updated" : "created"} successfully` });
      onClose(concept ? null : data?.id);
    }
  };

  const addClaim = () => {
    if (claimInput.trim() && !claims.includes(claimInput.trim())) {
      setClaims([...claims, claimInput.trim()]);
      setClaimInput("");
    }
  };

  const removeClaim = (claim: string) => {
    setClaims(claims.filter(c => c !== claim));
  };

  const addDietaryCategory = () => {
    if (dietaryCategoryInput.trim() && !dietaryCategories.includes(dietaryCategoryInput.trim())) {
      setDietaryCategories([...dietaryCategories, dietaryCategoryInput.trim()]);
      setDietaryCategoryInput("");
    }
  };

  const removeDietaryCategory = (category: string) => {
    setDietaryCategories(dietaryCategories.filter(c => c !== category));
  };

  const handleProductImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast({ title: "Please upload an image file (JPG, PNG, or WEBP)", variant: "destructive" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Image must be less than 5MB", variant: "destructive" });
        return;
      }
      setProductImage(file);
      setProductImageName(file.name);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{concept ? "Edit Concept" : "New Concept"}</DialogTitle>
          <DialogDescription>
            Define your product concept and market opportunity
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* Product Identity Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Product Identity</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="product_name">Product Name *</Label>
                <Input
                  id="product_name"
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  placeholder="e.g., Artisan Sourdough Bread"
                />
              </div>
              <div>
                <Label htmlFor="product_code">Product Code</Label>
                <Input
                  id="product_code"
                  value={formData.product_code}
                  onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                  placeholder="e.g., ASB-001"
                />
              </div>
              <div>
                <Label htmlFor="product_type">Product Type</Label>
                <Input
                  id="product_type"
                  value={formData.product_type}
                  onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                  placeholder="e.g., Bread, Cookie, Cake"
                />
              </div>
              <div>
                <Label htmlFor="version_number">Version Number</Label>
                <Input
                  id="version_number"
                  value={formData.version_number}
                  onChange={(e) => setFormData({ ...formData, version_number: e.target.value })}
                  placeholder="e.g., 1.0"
                />
              </div>
              <div>
                <Label>Date of Issue</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.date_of_issue && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.date_of_issue ? format(formData.date_of_issue, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.date_of_issue}
                      onSelect={(date) => setFormData({ ...formData, date_of_issue: date })}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Last Review Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.last_review_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.last_review_date ? format(formData.last_review_date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.last_review_date}
                      onSelect={(date) => setFormData({ ...formData, last_review_date: date })}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Next Review Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.next_review_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.next_review_date ? format(formData.next_review_date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.next_review_date}
                      onSelect={(date) => setFormData({ ...formData, next_review_date: date })}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="col-span-2">
                <Label htmlFor="product_description">Product Description</Label>
                <Textarea
                  id="product_description"
                  value={formData.product_description}
                  onChange={(e) => setFormData({ ...formData, product_description: e.target.value })}
                  placeholder="Detailed description of your product"
                  rows={3}
                />
              </div>
              
              {/* Net Weight */}
              <div>
                <Label htmlFor="net_weight">Net Weight</Label>
                <div className="flex gap-2">
                  <Input
                    id="net_weight"
                    type="number"
                    step="0.01"
                    value={formData.net_weight}
                    onChange={(e) => setFormData({ ...formData, net_weight: e.target.value })}
                    placeholder="0.00"
                    className="flex-1"
                  />
                  <Select
                    value={formData.net_weight_unit}
                    onValueChange={(value) => setFormData({ ...formData, net_weight_unit: value })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="oz">oz</SelectItem>
                      <SelectItem value="lb">lb</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Shape */}
              <div>
                <Label htmlFor="shape">Shape</Label>
                <Input
                  id="shape"
                  value={formData.shape}
                  onChange={(e) => setFormData({ ...formData, shape: e.target.value })}
                  placeholder="e.g., Round, Square, Rectangular"
                />
              </div>
              
              {/* Unit Dimensions */}
              <div className="col-span-2">
                <Label>Unit Dimensions (Length × Width × Height)</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.unit_length}
                    onChange={(e) => setFormData({ ...formData, unit_length: e.target.value })}
                    placeholder="Length"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.unit_width}
                    onChange={(e) => setFormData({ ...formData, unit_width: e.target.value })}
                    placeholder="Width"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.unit_height}
                    onChange={(e) => setFormData({ ...formData, unit_height: e.target.value })}
                    placeholder="Height"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Market & Positioning Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Market & Positioning</h3>
            <div>
              <Label htmlFor="intended_use">Intended Use / Application</Label>
              <Textarea
                id="intended_use"
                value={formData.intended_use}
                onChange={(e) => setFormData({ ...formData, intended_use: e.target.value })}
                placeholder="e.g., Perfect for breakfast toast, sandwiches, or as an accompaniment to soups"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="target_market">Target Market</Label>
              <Input
                id="target_market"
                value={formData.target_market}
                onChange={(e) => setFormData({ ...formData, target_market: e.target.value })}
                placeholder="e.g., Health-conscious millennials"
              />
            </div>
            <div>
              <Label htmlFor="dietary_category">Dietary Category</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  id="dietary_category"
                  value={dietaryCategoryInput}
                  onChange={(e) => setDietaryCategoryInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addDietaryCategory())}
                  placeholder="e.g., Vegan, Gluten-free, Keto, Organic"
                />
                <Button type="button" onClick={addDietaryCategory}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {dietaryCategories.map((category) => (
                  <Badge key={category} variant="secondary" className="gap-1">
                    {category}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeDietaryCategory(category)} />
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="desired_claims">Regulatory/Marketing Claims</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  id="desired_claims"
                  value={claimInput}
                  onChange={(e) => setClaimInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addClaim())}
                  placeholder="e.g., Non-GMO, No artificial preservatives"
                />
                <Button type="button" onClick={addClaim}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {claims.map((claim) => (
                  <Badge key={claim} variant="secondary" className="gap-1">
                    {claim}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeClaim(claim)} />
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="key_qualities">Key Qualities or Benefits</Label>
              <p className="text-xs text-muted-foreground mb-1">
                What are the standout qualities, features, or experiences this product delivers?
              </p>
              <Textarea
                id="key_qualities"
                value={formData.key_qualities}
                onChange={(e) => setFormData({ ...formData, key_qualities: e.target.value })}
                placeholder='e.g., "Rich buttery flavor, moist crumb, authentic island aroma, perfect for gifting."'
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes or ideas"
                rows={3}
              />
            </div>
          </div>

          {/* Uploads Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Uploads</h3>
            <div>
              <Label>Product Image (Optional)</Label>
              <div className="mt-2">
                <input
                  type="file"
                  id="product-image-upload"
                  accept="image/jpeg,image/png,image/jpg,image/webp"
                  onChange={handleProductImageSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('product-image-upload')?.click()}
                  disabled={imageUploading}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  {productImageName || "Upload Product Image"}
                </Button>
                {productImageName && (
                  <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {productImageName}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => onClose()}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || imageUploading}>
            {isSaving || imageUploading ? "Saving..." : concept ? "Update" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}