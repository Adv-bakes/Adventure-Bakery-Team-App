import { useEffect, useState } from "react";
import { useParams, useNavigate, Routes, Route, NavLink, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Save, Download, FileText, Lightbulb, Package, FlaskConical, TestTube, DollarSign, BoxIcon, CheckCircle2, ChevronDown, ImageIcon, Edit, X, CalendarIcon, Upload, Clock, Ruler, Cog, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { PartyPopper } from "lucide-react";
import { CoachChat } from "@/components/CoachChat";
import { format } from "date-fns";
import Ingredients from "./Ingredients";
import Formulas from "./Formulas";
import ShelfLife from "./ShelfLife";
import Costing from "./Costing";
import Packaging from "./Packaging";
import { cn } from "@/lib/utils";

// Component for concept view
const ConceptView = ({ conceptId, onSave }: { conceptId: number; onSave: () => void }) => {
  const [concept, setConcept] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [openSections, setOpenSections] = useState({
    identity: true,
    market: true,
    uploads: true,
  });
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
  const [dietaryCategories, setDietaryCategories] = useState<string[]>([]);
  const [dietaryCategoryInput, setDietaryCategoryInput] = useState("");
  const [claims, setClaims] = useState<string[]>([]);
  const [claimInput, setClaimInput] = useState("");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImageName, setProductImageName] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [lastAutosave, setLastAutosave] = useState<Date | null>(null);

  const toggleSection = (section: 'identity' | 'market' | 'uploads') => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    loadConcept();
  }, [conceptId]);

  // Autosave functionality
  useEffect(() => {
    if (!isEditing) return;

    const autosaveInterval = setInterval(() => {
      handleAutosave();
    }, 30000); // 30 seconds

    return () => clearInterval(autosaveInterval);
  }, [isEditing, formData, dietaryCategories, claims, productImage]);

  const loadConcept = async () => {
    const { data, error } = await supabase
      .from("concepts")
      .select("*")
      .eq("id", conceptId)
      .single();

    if (!error && data) {
      setConcept(data);
      // Initialize form data
      setFormData({
        product_name: data.product_name || "",
        product_code: data.product_code || "",
        product_type: data.product_type || "",
        version_number: data.version_number || "",
        date_of_issue: data.date_of_issue ? new Date(data.date_of_issue) : undefined,
        last_review_date: data.last_review_date ? new Date(data.last_review_date) : undefined,
        next_review_date: data.next_review_date ? new Date(data.next_review_date) : undefined,
        product_description: data.product_description || "",
        intended_use: data.intended_use || "",
        target_market: data.target_market || "",
        key_qualities: data.key_qualities || "",
        notes: data.notes || "",
        net_weight: data.net_weight ? String(data.net_weight) : "",
        net_weight_unit: data.net_weight_unit || "g",
        unit_length: data.unit_length ? String(data.unit_length) : "",
        unit_width: data.unit_width ? String(data.unit_width) : "",
        unit_height: data.unit_height ? String(data.unit_height) : "",
        shape: data.shape || "",
      });
      setDietaryCategories(Array.isArray(data.dietary_category) ? data.dietary_category.filter((item): item is string => typeof item === 'string') : []);
      setClaims(Array.isArray(data.desired_claims) ? data.desired_claims.filter((item): item is string => typeof item === 'string') : []);
      setProductImageName(data.product_image_name || "");
    }
    setLoading(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelClick = () => {
    setShowCancelDialog(true);
  };

  const handleConfirmCancel = () => {
    setIsEditing(false);
    setShowCancelDialog(false);
    setLastAutosave(null);
    // Reset form data to original concept values
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
        net_weight: concept.net_weight ? String(concept.net_weight) : "",
        net_weight_unit: concept.net_weight_unit || "g",
        unit_length: concept.unit_length ? String(concept.unit_length) : "",
        unit_width: concept.unit_width ? String(concept.unit_width) : "",
        unit_height: concept.unit_height ? String(concept.unit_height) : "",
        shape: concept.shape || "",
      });
      setDietaryCategories(Array.isArray(concept.dietary_category) ? concept.dietary_category.filter((item): item is string => typeof item === 'string') : []);
      setClaims(Array.isArray(concept.desired_claims) ? concept.desired_claims.filter((item): item is string => typeof item === 'string') : []);
      setProductImage(null);
    }
  };

  const handleAutosave = async () => {
    if (!formData.product_name.trim()) return;

    setIsAutosaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const updateData = {
        ...formData,
        date_of_issue: formData.date_of_issue?.toISOString().split('T')[0] || null,
        last_review_date: formData.last_review_date?.toISOString().split('T')[0] || null,
        next_review_date: formData.next_review_date?.toISOString().split('T')[0] || null,
        net_weight: formData.net_weight ? String(formData.net_weight) : null,
        unit_length: formData.unit_length ? String(formData.unit_length) : null,
        unit_width: formData.unit_width ? String(formData.unit_width) : null,
        unit_height: formData.unit_height ? String(formData.unit_height) : null,
        dietary_category: dietaryCategories,
        desired_claims: claims,
      };

      const { error } = await supabase
        .from("concepts")
        .update(updateData)
        .eq("id", conceptId);

      if (!error) {
        setLastAutosave(new Date());
        
        // Handle image upload if there's a new image
        if (productImage) {
          const fileExt = productImage.name.split('.').pop();
          const fileName = `${user.id}/${conceptId}/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('product-spec-sheets')
            .upload(fileName, productImage);

          if (!uploadError) {
            await supabase
              .from("concepts")
              .update({
                product_image_path: fileName,
                product_image_name: productImage.name,
                product_image_uploaded_at: new Date().toISOString(),
              })
              .eq("id", conceptId);
            setProductImage(null); // Clear after upload
          }
        }
      }
    } catch (error) {
      console.error('Autosave failed:', error);
    } finally {
      setIsAutosaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!formData.product_name.trim()) {
      toast.error("Product name is required");
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User not authenticated");
        return;
      }

      const updateData = {
        ...formData,
        date_of_issue: formData.date_of_issue?.toISOString().split('T')[0] || null,
        last_review_date: formData.last_review_date?.toISOString().split('T')[0] || null,
        next_review_date: formData.next_review_date?.toISOString().split('T')[0] || null,
        net_weight: formData.net_weight ? parseFloat(formData.net_weight) : null,
        unit_length: formData.unit_length ? parseFloat(formData.unit_length) : null,
        unit_width: formData.unit_width ? parseFloat(formData.unit_width) : null,
        unit_height: formData.unit_height ? parseFloat(formData.unit_height) : null,
        dietary_category: dietaryCategories,
        desired_claims: claims,
      };

      const { error } = await supabase
        .from("concepts")
        .update(updateData)
        .eq("id", conceptId);

      if (error) throw error;

      // Handle image upload if there's a new image
      if (productImage) {
        const fileExt = productImage.name.split('.').pop();
        const fileName = `${user.id}/${conceptId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('product-spec-sheets')
          .upload(fileName, productImage);

        if (!uploadError) {
          await supabase
            .from("concepts")
            .update({
              product_image_path: fileName,
              product_image_name: productImage.name,
              product_image_uploaded_at: new Date().toISOString(),
            })
            .eq("id", conceptId);
        }
      }

      toast.success("Concept updated successfully!");
      setIsEditing(false);
      setLastAutosave(null);
      loadConcept();
      onSave();
    } catch (error: any) {
      toast.error(`Failed to update concept: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
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

  const addClaim = () => {
    if (claimInput.trim() && !claims.includes(claimInput.trim())) {
      setClaims([...claims, claimInput.trim()]);
      setClaimInput("");
    }
  };

  const removeClaim = (claim: string) => {
    setClaims(claims.filter(c => c !== claim));
  };

  const handleProductImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size must be less than 5MB");
        return;
      }
      setProductImage(file);
      setProductImageName(file.name);
    }
  };

  const handleDownloadPss = async () => {
    if (!concept?.pss_file_path) return;

    setDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from('product-spec-sheets')
        .download(concept.pss_file_path);

      if (error) throw error;

      // Create a download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = concept.pss_file_name || 'product-spec-sheet';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("PSS downloaded successfully!");
    } catch (error: any) {
      toast.error(`Download failed: ${error.message}`);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-8">Loading concept...</div>;

  return (
    <div className="space-y-6">
      {/* Header with action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-bold">Product Concept</h2>
          {isEditing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {isAutosaving ? (
                <span>Autosaving...</span>
              ) : lastAutosave ? (
                <span>Autosaved at {format(lastAutosave, 'HH:mm:ss')}</span>
              ) : (
                <span>Autosave enabled</span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {concept?.pss_file_path && (
            <Button 
              variant="outline" 
              onClick={handleDownloadPss}
              disabled={downloading}
            >
              <Download className="h-4 w-4 mr-2" />
              {downloading ? "Downloading..." : "Download PSS"}
            </Button>
          )}
          {!isEditing ? (
            <>
              <Button variant="outline" onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button onClick={onSave}>
                <Save className="h-4 w-4 mr-2" />
                Save Progress
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancelClick} disabled={isSaving}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Product Identity Section */}
      <div className="rounded-[14px] border border-[#DDD2BE]" style={{ backgroundColor: '#F5F0E6' }}>
        <div className="p-5">
          <CardTitle className="font-semibold pb-3 mb-[12px]" style={{ color: '#3D2F1F', fontSize: '22px' }}>Product Identity</CardTitle>
          
          {!isEditing ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-[14px] font-semibold mb-1" style={{ color: '#4E4334' }}>Product Name</h3>
                    <p className="text-[14px]" style={{ color: '#5E5E5E' }}>{concept?.product_name}</p>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold mb-1" style={{ color: '#4E4334' }}>Product Type</h3>
                    <p className="text-[14px]" style={{ color: '#5E5E5E' }}>{concept?.product_type || "Not specified"}</p>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold mb-1" style={{ color: '#4E4334' }}>Date of Issue</h3>
                    <p className="text-[14px]" style={{ color: '#5E5E5E' }}>
                      {concept?.date_of_issue ? format(new Date(concept.date_of_issue), "PPP") : "Not specified"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold mb-1" style={{ color: '#4E4334' }}>Next Review Date</h3>
                    <p className="text-[14px]" style={{ color: '#5E5E5E' }}>
                      {concept?.next_review_date ? format(new Date(concept.next_review_date), "PPP") : "Not specified"}
                    </p>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-[14px] font-semibold mb-1" style={{ color: '#4E4334' }}>Product Code</h3>
                    <p className="text-[14px]" style={{ color: '#5E5E5E' }}>{concept?.product_code || "Not specified"}</p>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold mb-1" style={{ color: '#4E4334' }}>Version Number</h3>
                    <p className="text-[14px]" style={{ color: '#5E5E5E' }}>{concept?.version_number || "Not specified"}</p>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold mb-1" style={{ color: '#4E4334' }}>Last Review Date</h3>
                    <p className="text-[14px]" style={{ color: '#5E5E5E' }}>
                      {concept?.last_review_date ? format(new Date(concept.last_review_date), "PPP") : "Not specified"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Product Description - Full Width */}
              <div className="mt-4">
                <h3 className="text-[14px] font-semibold mb-1" style={{ color: '#4E4334' }}>Product Description</h3>
                <p className="text-[14px] whitespace-pre-wrap" style={{ color: '#5E5E5E' }}>{concept?.product_description || "Not specified"}</p>
              </div>
              
              {/* Product Specifications */}
              <div className="mt-6 pt-6 border-t border-[#DDD2BE]">
                <h3 className="text-[16px] font-semibold mb-4 flex items-center gap-2" style={{ color: '#4E4334' }}>
                  <Package className="h-5 w-5" />
                  Product Specifications
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-[14px] font-semibold mb-1" style={{ color: '#4E4334' }}>Net Weight</h3>
                    <p className="text-[14px]" style={{ color: '#5E5E5E' }}>
                      {concept?.net_weight ? `${concept.net_weight} ${concept.net_weight_unit || 'g'}` : "Not specified"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold mb-1" style={{ color: '#4E4334' }}>Shape</h3>
                    <p className="text-[14px]" style={{ color: '#5E5E5E' }}>{concept?.shape || "Not specified"}</p>
                  </div>
                  <div className="col-span-2">
                    <h3 className="text-[14px] font-semibold mb-1 flex items-center gap-2" style={{ color: '#4E4334' }}>
                      <Ruler className="h-4 w-4" />
                      Unit Dimensions (L × W × H)
                    </h3>
                    <p className="text-[14px]" style={{ color: '#5E5E5E' }}>
                      {(concept?.unit_length && concept?.unit_width && concept?.unit_height) 
                        ? `${concept.unit_length} × ${concept.unit_width} × ${concept.unit_height}`
                        : "Not specified"}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="product_name" className="text-[14px] font-semibold" style={{ color: '#4E4334' }}>Product Name *</Label>
                    <Input
                      id="product_name"
                      value={formData.product_name}
                      onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                      placeholder="Enter product name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="product_type" className="text-[14px] font-semibold" style={{ color: '#4E4334' }}>Product Type</Label>
                    <Input
                      id="product_type"
                      value={formData.product_type}
                      onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                      placeholder="Enter product type"
                    />
                  </div>
                  <div>
                    <Label className="text-[14px] font-semibold" style={{ color: '#4E4334' }}>Date of Issue</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
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
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="text-[14px] font-semibold" style={{ color: '#4E4334' }}>Next Review Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
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
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="product_code" className="text-[14px] font-semibold" style={{ color: '#4E4334' }}>Product Code</Label>
                    <Input
                      id="product_code"
                      value={formData.product_code}
                      onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                      placeholder="Enter product code"
                    />
                  </div>
                  <div>
                    <Label htmlFor="version_number" className="text-[14px] font-semibold" style={{ color: '#4E4334' }}>Version Number</Label>
                    <Input
                      id="version_number"
                      value={formData.version_number}
                      onChange={(e) => setFormData({ ...formData, version_number: e.target.value })}
                      placeholder="Enter version number"
                    />
                  </div>
                  <div>
                    <Label className="text-[14px] font-semibold" style={{ color: '#4E4334' }}>Last Review Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
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
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Product Description - Full Width */}
              <div className="mt-4">
                <Label htmlFor="product_description" className="text-[14px] font-semibold" style={{ color: '#4E4334' }}>Product Description</Label>
                <Textarea
                  id="product_description"
                  value={formData.product_description}
                  onChange={(e) => setFormData({ ...formData, product_description: e.target.value })}
                  placeholder="Enter product description"
                  rows={4}
                />
              </div>
              
              {/* Product Specifications */}
              <div className="mt-6 pt-6 border-t border-[#DDD2BE]">
                <h3 className="text-[16px] font-semibold mb-4 flex items-center gap-2" style={{ color: '#4E4334' }}>
                  <Package className="h-5 w-5" />
                  Product Specifications
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="net_weight" className="text-[14px] font-semibold" style={{ color: '#4E4334' }}>Net Weight</Label>
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
                  
                  <div>
                    <Label htmlFor="shape" className="text-[14px] font-semibold" style={{ color: '#4E4334' }}>Shape</Label>
                    <Input
                      id="shape"
                      value={formData.shape}
                      onChange={(e) => setFormData({ ...formData, shape: e.target.value })}
                      placeholder="e.g., Round, Square, Rectangular"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <Label className="text-[14px] font-semibold" style={{ color: '#4E4334' }}>
                      <span className="flex items-center gap-2">
                        <Ruler className="h-4 w-4" />
                        Unit Dimensions (Length × Width × Height)
                      </span>
                    </Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
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
            </>
          )}
        </div>
      </div>

      {/* Market & Positioning Section */}
      <div className="rounded-[14px] border border-[#DDD2BE] mt-6" style={{ backgroundColor: '#F5F0E6' }}>
        <div className="p-5">
          <CardTitle className="font-semibold pb-3 mb-[12px]" style={{ color: '#3D2F1F', fontSize: '22px' }}>Market & Positioning</CardTitle>
          
          {!isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-[14px] font-semibold mb-1" style={{ color: '#4E4334' }}>Intended Use / Application</h3>
                  <p className="text-[14px] whitespace-pre-wrap" style={{ color: '#5E5E5E' }}>{concept?.intended_use || "Not specified"}</p>
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold mb-1" style={{ color: '#4E4334' }}>Target Market</h3>
                  <p className="text-[14px]" style={{ color: '#5E5E5E' }}>{concept?.target_market || "Not specified"}</p>
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold mb-2" style={{ color: '#4E4334' }}>Dietary Category</h3>
                  {dietaryCategories.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {dietaryCategories.map((cat, idx) => (
                        <Badge key={idx} variant="secondary">{cat}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[14px]" style={{ color: '#5E5E5E' }}>Not specified</p>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-[14px] font-semibold mb-2" style={{ color: '#4E4334' }}>Regulatory / Marketing Claims</h3>
                  {claims.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {claims.map((claim, idx) => (
                        <Badge key={idx} variant="secondary">{claim}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[14px]" style={{ color: '#5E5E5E' }}>Not specified</p>
                  )}
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold mb-1" style={{ color: '#4E4334' }}>Key Qualities or Benefits</h3>
                  <p className="text-[14px] whitespace-pre-wrap" style={{ color: '#5E5E5E' }}>{concept?.key_qualities || "Not specified"}</p>
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold mb-1" style={{ color: '#4E4334' }}>Notes</h3>
                  <p className="text-[14px] whitespace-pre-wrap" style={{ color: '#5E5E5E' }}>{concept?.notes || "Not specified"}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="intended_use" className="text-[14px] font-semibold" style={{ color: '#4E4334' }}>Intended Use / Application</Label>
                  <Textarea
                    id="intended_use"
                    value={formData.intended_use}
                    onChange={(e) => setFormData({ ...formData, intended_use: e.target.value })}
                    placeholder="Enter intended use"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="target_market" className="text-[14px] font-semibold" style={{ color: '#4E4334' }}>Target Market</Label>
                  <Input
                    id="target_market"
                    value={formData.target_market}
                    onChange={(e) => setFormData({ ...formData, target_market: e.target.value })}
                    placeholder="Enter target market"
                  />
                </div>
                <div>
                  <Label className="text-[14px] font-semibold mb-2" style={{ color: '#4E4334' }}>Dietary Category</Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={dietaryCategoryInput}
                      onChange={(e) => setDietaryCategoryInput(e.target.value)}
                      placeholder="Add category"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addDietaryCategory();
                        }
                      }}
                    />
                    <Button type="button" onClick={addDietaryCategory} size="sm">Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {dietaryCategories.map((cat, idx) => (
                      <Badge key={idx} variant="secondary" className="cursor-pointer" onClick={() => removeDietaryCategory(cat)}>
                        {cat} <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <Label className="text-[14px] font-semibold mb-2" style={{ color: '#4E4334' }}>Regulatory / Marketing Claims</Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={claimInput}
                      onChange={(e) => setClaimInput(e.target.value)}
                      placeholder="Add claim"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addClaim();
                        }
                      }}
                    />
                    <Button type="button" onClick={addClaim} size="sm">Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {claims.map((claim, idx) => (
                      <Badge key={idx} variant="secondary" className="cursor-pointer" onClick={() => removeClaim(claim)}>
                        {claim} <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="key_qualities" className="text-[14px] font-semibold" style={{ color: '#4E4334' }}>Key Qualities or Benefits</Label>
                  <Textarea
                    id="key_qualities"
                    value={formData.key_qualities}
                    onChange={(e) => setFormData({ ...formData, key_qualities: e.target.value })}
                    placeholder="Enter key qualities"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="notes" className="text-[14px] font-semibold" style={{ color: '#4E4334' }}>Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Enter notes"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Uploads Section */}
      <div className="rounded-[14px] border border-[#DDD2BE] mt-6" style={{ backgroundColor: '#F5F0E6' }}>
        <div className="p-5">
          <CardTitle className="font-semibold pb-3 mb-[12px]" style={{ color: '#3D2F1F', fontSize: '22px' }}>Uploads</CardTitle>
          
          <div className="space-y-6">
            {/* Product Spec Sheet */}
            <div>
              <h3 className="text-[14px] font-semibold mb-2" style={{ color: '#4E4334' }}>Product Spec Sheet</h3>
              {concept?.pss_file_path ? (
                <div className="bg-white/50 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-6 w-6" style={{ color: '#3D2F1F' }} />
                    <div>
                      <p className="font-semibold text-[14px]" style={{ color: '#4E4334' }}>{concept.pss_file_name}</p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={handleDownloadPss}
                    disabled={downloading}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              ) : (
                <div className="border border-dashed rounded-lg p-6 text-center" style={{ borderColor: '#C7B79A' }}>
                  <FileText className="h-8 w-8 mx-auto mb-2" style={{ color: '#7A6A55' }} />
                  <p className="text-[14px]" style={{ color: '#7A6A55' }}>No Product Spec Sheet uploaded</p>
                </div>
              )}
            </div>

            {/* Product Image */}
            <div>
              <h3 className="text-[14px] font-semibold mb-2" style={{ color: '#4E4334' }}>Product Image</h3>
              {!isEditing ? (
                concept?.product_image_path ? (
                  <div className="flex justify-center">
                    <div className="w-[300px] h-[200px] border border-[#C7B79A] rounded-lg overflow-hidden bg-white/30">
                      <img 
                        src={`https://ztykjygdojeeoldjrglu.supabase.co/storage/v1/object/public/product-spec-sheets/${concept.product_image_path}`}
                        alt={concept.product_name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <div className="w-[300px] h-[200px] border border-dashed rounded-lg flex flex-col items-center justify-center" style={{ borderColor: '#C7B79A' }}>
                      <Upload className="h-8 w-8 mb-2" style={{ color: '#7A6A55' }} />
                      <p className="text-[14px]" style={{ color: '#7A6A55' }}>No product image uploaded</p>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center">
                  <Input
                    id="product_image"
                    type="file"
                    accept="image/*"
                    onChange={handleProductImageSelect}
                    className="cursor-pointer max-w-md"
                  />
                  {(productImage || concept?.product_image_path) && (
                    <div className="mt-4 w-[300px] h-[200px] border border-[#C7B79A] rounded-lg overflow-hidden bg-white/30">
                      <img 
                        src={productImage 
                          ? URL.createObjectURL(productImage)
                          : `https://ztykjygdojeeoldjrglu.supabase.co/storage/v1/object/public/product-spec-sheets/${concept.product_image_path}`
                        }
                        alt="Product preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to cancel? All your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancel}>
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Process & Equipment View
const ProcessEquipmentView = ({ conceptId, onSave }: { conceptId: number; onSave: () => void }) => {
  const [processSteps, setProcessSteps] = useState([
    { id: 1, description: "" }
  ]);
  const [equipment, setEquipment] = useState([
    { id: 1, name: "", notes: "" }
  ]);

  const addProcessStep = () => {
    const newId = processSteps.length > 0 ? Math.max(...processSteps.map(s => s.id)) + 1 : 1;
    setProcessSteps([...processSteps, { id: newId, description: "" }]);
  };

  const removeProcessStep = (id: number) => {
    if (processSteps.length > 1) {
      setProcessSteps(processSteps.filter(step => step.id !== id));
    }
  };

  const updateProcessStep = (id: number, description: string) => {
    setProcessSteps(processSteps.map(step => 
      step.id === id ? { ...step, description } : step
    ));
  };

  const addEquipment = () => {
    const newId = equipment.length > 0 ? Math.max(...equipment.map(e => e.id)) + 1 : 1;
    setEquipment([...equipment, { id: newId, name: "", notes: "" }]);
  };

  const removeEquipment = (id: number) => {
    if (equipment.length > 1) {
      setEquipment(equipment.filter(item => item.id !== id));
    }
  };

  const updateEquipment = (id: number, field: 'name' | 'notes', value: string) => {
    setEquipment(equipment.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Process & Equipment</h2>
        <Button onClick={onSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Progress
        </Button>
      </div>

      {/* Process Steps Section */}
      <Card className="elevated-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cog className="h-5 w-5" />
            Process Steps
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {processSteps.map((step, index) => (
              <div key={step.id} className="flex items-start gap-3 p-3 rounded-lg border bg-background">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm flex-shrink-0 mt-1">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="Enter process step description..."
                    value={step.description}
                    onChange={(e) => updateProcessStep(step.id, e.target.value)}
                    className="w-full"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeProcessStep(step.id)}
                  disabled={processSteps.length === 1}
                  className="flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            onClick={addProcessStep}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Step
          </Button>
        </CardContent>
      </Card>

      {/* Equipment & Utensils Section */}
      <Card className="elevated-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Equipment & Utensils
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {equipment.map((item) => (
              <div key={item.id} className="p-4 rounded-lg border bg-background space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-3">
                    <div>
                      <Label htmlFor={`equipment-name-${item.id}`} className="text-sm font-medium mb-1.5">
                        Equipment Name
                      </Label>
                      <Input
                        id={`equipment-name-${item.id}`}
                        placeholder="e.g., Stand Mixer, Oven, Baking Sheet..."
                        value={item.name}
                        onChange={(e) => updateEquipment(item.id, 'name', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`equipment-notes-${item.id}`} className="text-sm font-medium mb-1.5">
                        Notes (Optional)
                      </Label>
                      <Textarea
                        id={`equipment-notes-${item.id}`}
                        placeholder="Additional details, specifications, or requirements..."
                        value={item.notes}
                        onChange={(e) => updateEquipment(item.id, 'notes', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEquipment(item.id)}
                    disabled={equipment.length === 1}
                    className="flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            onClick={addEquipment}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Equipment
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// Market Readiness View
const ReadinessView = ({ conceptId, onSave }: { conceptId: number; onSave: () => void }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Market Readiness Checklist</h2>
        <Button onClick={onSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Progress
        </Button>
      </div>

      <div className="elevated-card rounded-lg p-6">
        <p className="text-muted-foreground">
          Review completion status for label compliance, nutrition facts, and legal readiness.
        </p>
      </div>
    </div>
  );
};

const workflowSteps = [
  { title: "Concept", url: "/concept", icon: Lightbulb },
  { title: "Ingredients & Specs", url: "/ingredients", icon: Package },
  { title: "Formulation", url: "/formulation", icon: FlaskConical },
  { title: "Process & Equipment", url: "/process-equipment", icon: Cog },
  { title: "Shelf-Life & Process", url: "/shelf-life", icon: TestTube },
  { title: "Costing & MOQ", url: "/costing", icon: DollarSign },
  { title: "Packaging", url: "/packaging", icon: BoxIcon },
  { title: "Market Readiness", url: "/readiness", icon: CheckCircle2 },
];

const ProjectWorkspace = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [concept, setConcept] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [previousProgress, setPreviousProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationType, setCelebrationType] = useState<"25" | "50" | "75" | "100">("25");
  const [currentSection, setCurrentSection] = useState<string>("Concept");

  useEffect(() => {
    if (id) {
      loadProjectData();
    }
  }, [id]);

  const loadProjectData = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    // Load concept
    const { data: conceptData, error: conceptError } = await supabase
      .from("concepts")
      .select("*")
      .eq("id", parseInt(id!))
      .eq("user_id", user.id)
      .single();

    if (conceptError) {
      toast.error("Error loading project");
      navigate("/");
      return;
    }

    setConcept(conceptData);

    // Calculate and load progress
    const { data: progressData, error: progressError } = await (supabase as any)
      .rpc('calculate_project_progress', { project_concept_id: parseInt(id!) });

    if (!progressError && progressData !== null) {
      const currentProgress = progressData;
      setProgress(currentProgress);
      setPreviousProgress(currentProgress);

      // Update readiness table with calculated progress
      await supabase
        .from("readiness")
        .update({ overall_readiness_percent: currentProgress })
        .eq("concept_id", parseInt(id!));
    }

    setIsLoading(false);
  };

  const updateProgress = async () => {
    if (!id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Call the progress calculation function
      const { data: progressData, error: progressError } = await (supabase as any)
        .rpc('calculate_project_progress', { project_concept_id: parseInt(id) });

      if (progressError) {
        console.error("Error calculating progress:", progressError);
        return;
      }

      const newProgress = progressData || 0;
      
      // Update the readiness table with new progress
      const { error: updateError } = await supabase
        .from("readiness")
        .update({ overall_readiness_percent: newProgress })
        .eq("concept_id", parseInt(id));

      if (updateError) {
        console.error("Error updating progress:", updateError);
      }

      // Check for milestone crossings
      const milestones = [25, 50, 75, 100];
      for (const milestone of milestones) {
        if (previousProgress < milestone && newProgress >= milestone) {
          setCelebrationType(milestone.toString() as "25" | "50" | "75" | "100");
          setShowCelebration(true);
          if (milestone === 100) {
            toast.success("🎉 Congratulations! Your project is 100% complete!");
          }
          break;
        }
      }

      setPreviousProgress(progress);
      setProgress(newProgress);
    } catch (error) {
      console.error("Error in updateProgress:", error);
    }

    await loadProjectData();
  };

  const handleSaveProgress = async () => {
    toast.success("Progress saved!");
    await updateProgress();
  };

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8">Loading project...</div>;
  }

  if (!concept) {
    return <div className="container mx-auto px-4 py-8">Project not found</div>;
  }

  return (
    <>
      {/* Celebration Modal */}
      <Dialog open={showCelebration} onOpenChange={setShowCelebration}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <PartyPopper className="h-6 w-6 text-accent" />
              {celebrationType === "100" ? "Manufacturing Ready! 🎉" : `${celebrationType}% Complete!`}
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              {celebrationType === "100" ? (
                <div className="space-y-4">
                  <p className="text-foreground font-semibold">
                    Congratulations! Your project is 100% complete and ready for manufacturing.
                  </p>
                  <p>
                    You've successfully documented all critical aspects of your product. 
                    You can now generate your Product Specification Sheet (PSS) to share with manufacturers.
                  </p>
                </div>
              ) : celebrationType === "75" ? (
                <p>You're almost there! Just a few more details to complete your manufacturing-ready specification.</p>
              ) : celebrationType === "50" ? (
                <p>Great progress! You're halfway through documenting your product specification.</p>
              ) : (
                <p>Nice start! Keep going to complete your product specification.</p>
              )}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen flex flex-col w-full bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--muted))] to-[hsl(var(--background))]">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-accent/20 elevated-card">
          <div className="container mx-auto">
            <div className="flex items-center justify-between px-4 h-16">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate("/")}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
                <div>
                  <h1 className="font-semibold">{concept.product_name}</h1>
                  <p className="text-xs text-muted-foreground">Project Workspace</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Progress</div>
                  <div className="flex items-center gap-2">
                    <Progress value={progress} className="w-24 h-2" />
                    <span className="text-sm font-semibold">{progress}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Navigation */}
            <nav className="border-t border-accent/10">
              <div className="flex items-center gap-1 overflow-x-auto px-4 py-2">
                {workflowSteps.map((step) => {
                  const Icon = step.icon;
                  const isActive = location.pathname.includes(step.url);
                  return (
                    <NavLink
                      key={step.title}
                      to={`/project/${id}${step.url}`}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                        isActive
                          ? "bg-accent/20 text-accent border-b-2 border-accent"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                      onClick={() => setCurrentSection(step.title)}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{step.title}</span>
                    </NavLink>
                  );
                })}
              </div>
            </nav>
          </div>
        </header>

        <main className="flex-1">
          <div className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/concept" element={<ConceptView conceptId={parseInt(id!)} onSave={handleSaveProgress} />} />
              <Route path="/ingredients" element={<Ingredients />} />
              <Route path="/formulation" element={<Formulas conceptId={parseInt(id!)} />} />
              <Route path="/process-equipment" element={<ProcessEquipmentView conceptId={parseInt(id!)} onSave={handleSaveProgress} />} />
              <Route path="/shelf-life" element={<ShelfLife />} />
              <Route path="/costing" element={<Costing />} />
              <Route path="/packaging" element={<Packaging />} />
              <Route path="/readiness" element={<ReadinessView conceptId={parseInt(id!)} onSave={handleSaveProgress} />} />
              <Route path="/" element={<ConceptView conceptId={parseInt(id!)} onSave={handleSaveProgress} />} />
            </Routes>
          </div>

          {/* AI Manufacturing Coach */}
          <CoachChat 
            currentSection={currentSection}
            progress={progress}
          />
        </main>
      </div>
    </>
  );
};

export default ProjectWorkspace;
