import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle } from "lucide-react";
import logo from "@/assets/logo.png";

const dietaryOptions = [
  { value: "gluten_free", label: "Gluten-free" },
  { value: "allergen_free", label: "Allergen-free (Top 9)" },
  { value: "low_no_sugar", label: "Low or no sugar" },
  { value: "clean_label", label: "Clean label (no artificial ingredients)" },
  { value: "non_gmo", label: "Non-GMO" },
  { value: "organic", label: "Organic" },
];

const PrivateLabel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    clientName: "",
    companyName: "",
    email: "",
    phone: "",
    bakedGoodType: "",
    productSpecifications: "",
    dietaryClaims: [] as string[],
    dietaryClaimsOther: "",
    packagingPlans: "",
    packagingTypes: "",
    unitsPerPack: "",
    packsPerCase: "",
    shelfLifeRequirements: "",
    samplePolicyAcknowledged: false,
    moqAcknowledged: false,
    additionalComments: "",
  });

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDietaryChange = (value: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      dietaryClaims: checked
        ? [...prev.dietaryClaims, value]
        : prev.dietaryClaims.filter(v => v !== value),
    }));
  };

  const isFormValid = () => {
    return (
      formData.clientName.trim() !== "" &&
      formData.companyName.trim() !== "" &&
      formData.email.trim() !== "" &&
      formData.phone.trim() !== "" &&
      formData.samplePolicyAcknowledged &&
      formData.moqAcknowledged
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid()) {
      toast({
        title: "Please complete all required fields",
        description: "Client info and acknowledgements are required.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Insert the private label request
      const { data: requestData, error: requestError } = await supabase
        .from("private_label_requests")
        .insert({
          client_name: formData.clientName,
          company_name: formData.companyName,
          email: formData.email,
          phone: formData.phone,
          baked_good_type: formData.bakedGoodType,
          product_specifications: formData.productSpecifications,
          dietary_claims: formData.dietaryClaims,
          dietary_claims_other: formData.dietaryClaimsOther,
          packaging_plans: formData.packagingPlans,
          packaging_types: formData.packagingTypes,
          units_per_pack: formData.unitsPerPack,
          packs_per_case: formData.packsPerCase,
          shelf_life_requirements: formData.shelfLifeRequirements,
          sample_policy_acknowledged: formData.samplePolicyAcknowledged,
          moq_acknowledged: formData.moqAcknowledged,
          additional_comments: formData.additionalComments,
        })
        .select()
        .maybeSingle();

      if (requestError) throw requestError;

      // Create internal notification for the team (optional, don't block on failure)
      if (requestData) {
        const { error: notificationError } = await supabase
          .from("internal_notifications")
          .insert({
            notification_type: "private_label_request",
            reference_id: requestData.id,
            reference_table: "private_label_requests",
            title: `New Private Label Request from ${formData.companyName}`,
            message: `${formData.clientName} from ${formData.companyName} has submitted a private label request for: ${formData.bakedGoodType || "Not specified"}`,
          });

        if (notificationError) {
          console.error("Failed to create notification:", notificationError);
        }
      }

      setIsSubmitted(true);
    } catch (error: any) {
      console.error("Submission error:", error);
      const errorMessage = error?.message || "There was an error submitting your request. Please try again.";
      toast({
        title: "Submission failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div 
        className="min-h-screen p-6"
        style={{
          background: 'linear-gradient(135deg, #2C1810 0%, #4A3728 50%, #2C1810 100%)',
        }}
      >
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <img src={logo} alt="Adventure Bakery Logo" className="w-14 h-14 mx-auto mb-3" />
          </div>
          
          <Card 
            className="border-0"
            style={{
              background: 'linear-gradient(135deg, rgba(245, 241, 230, 0.98) 0%, rgba(255, 253, 250, 0.98) 100%)',
              boxShadow: '0 8px 32px rgba(200, 155, 60, 0.25)'
            }}
          >
            <CardContent className="p-8 text-center">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-semibold mb-4" style={{ color: '#2C1810' }}>
                Submitted
              </h2>
              <p className="text-lg" style={{ color: '#8B7355' }}>
                Our team will review your request.
              </p>
              <Button
                onClick={() => navigate("/")}
                className="mt-8 bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white"
              >
                Return Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen p-6"
      style={{
        background: 'linear-gradient(135deg, #2C1810 0%, #4A3728 50%, #2C1810 100%)',
      }}
    >
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <img src={logo} alt="Adventure Bakery Logo" className="w-14 h-14 mx-auto mb-3" />
          <h1 className="text-xl font-bold" style={{ color: '#F5F1E6' }}>
            Private Label Baked Goods Request
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(245, 241, 230, 0.7)' }}>
            Adventure Bakery
          </p>
        </div>

        <Card 
          className="border-0"
          style={{
            background: 'linear-gradient(135deg, rgba(245, 241, 230, 0.98) 0%, rgba(255, 253, 250, 0.98) 100%)',
            boxShadow: '0 8px 32px rgba(200, 155, 60, 0.25)'
          }}
        >
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Client + Company Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold" style={{ color: '#2C1810' }}>
                  Client &amp; Company Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientName" style={{ color: '#2C1810' }}>Client Name *</Label>
                    <Input
                      id="clientName"
                      value={formData.clientName}
                      onChange={(e) => handleInputChange("clientName", e.target.value)}
                      required
                      style={{ borderColor: 'rgba(200, 155, 60, 0.3)' }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyName" style={{ color: '#2C1810' }}>Company Name *</Label>
                    <Input
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e) => handleInputChange("companyName", e.target.value)}
                      required
                      style={{ borderColor: 'rgba(200, 155, 60, 0.3)' }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" style={{ color: '#2C1810' }}>Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      required
                      style={{ borderColor: 'rgba(200, 155, 60, 0.3)' }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" style={{ color: '#2C1810' }}>Phone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      required
                      style={{ borderColor: 'rgba(200, 155, 60, 0.3)' }}
                    />
                  </div>
                </div>
              </div>

              {/* 1) Baked Good Type */}
              <div className="space-y-2 pt-4 border-t" style={{ borderColor: 'rgba(200, 155, 60, 0.2)' }}>
                <Label htmlFor="bakedGoodType" style={{ color: '#2C1810' }}>
                  1) Baked Good Type
                </Label>
                <p className="text-xs" style={{ color: '#8B7355' }}>
                  Describe the type of baked good you're looking to produce (e.g., cookies, brownies, bars, muffins, etc.)
                </p>
                <Textarea
                  id="bakedGoodType"
                  value={formData.bakedGoodType}
                  onChange={(e) => handleInputChange("bakedGoodType", e.target.value)}
                  rows={3}
                  style={{ borderColor: 'rgba(200, 155, 60, 0.3)' }}
                />
              </div>

              {/* 2) Product Specifications */}
              <div className="space-y-2 pt-4 border-t" style={{ borderColor: 'rgba(200, 155, 60, 0.2)' }}>
                <Label htmlFor="productSpecifications" style={{ color: '#2C1810' }}>
                  2) Product Specifications
                </Label>
                <p className="text-xs" style={{ color: '#8B7355' }}>
                  Describe your product specifications including size, weight, texture, flavor profile, inclusions, and any other relevant details.
                </p>
                <Textarea
                  id="productSpecifications"
                  value={formData.productSpecifications}
                  onChange={(e) => handleInputChange("productSpecifications", e.target.value)}
                  rows={4}
                  style={{ borderColor: 'rgba(200, 155, 60, 0.3)' }}
                />
              </div>

              {/* 3) Dietary and Labeling Claims */}
              <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'rgba(200, 155, 60, 0.2)' }}>
                <Label style={{ color: '#2C1810' }}>
                  3) Dietary and Labeling Claims
                </Label>
                <p className="text-xs" style={{ color: '#8B7355' }}>
                  Select all that apply to your product.
                </p>
                <div className="space-y-3">
                  {dietaryOptions.map((option) => {
                    const isChecked = formData.dietaryClaims.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        htmlFor={`dietary-${option.value}`}
                        className="flex items-center space-x-3 p-3 rounded-lg border-2 transition-all cursor-pointer hover:border-[#C89B3C]/50"
                        style={{
                          borderColor: isChecked ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                          backgroundColor: isChecked ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          id={`dietary-${option.value}`}
                          checked={isChecked}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFormData(prev => ({
                              ...prev,
                              dietaryClaims: checked
                                ? [...prev.dietaryClaims, option.value]
                                : prev.dietaryClaims.filter(v => v !== option.value),
                            }));
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-[#C89B3C] focus:ring-[#C89B3C]"
                        />
                        <span className="flex-1" style={{ color: '#2C1810' }}>
                          {option.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className="space-y-2 mt-4">
                  <Label htmlFor="dietaryOther" style={{ color: '#2C1810' }}>Other (please specify)</Label>
                  <Input
                    id="dietaryOther"
                    value={formData.dietaryClaimsOther}
                    onChange={(e) => handleInputChange("dietaryClaimsOther", e.target.value)}
                    placeholder="Any other dietary or labeling claims..."
                    style={{ borderColor: 'rgba(200, 155, 60, 0.3)' }}
                  />
                </div>
              </div>

              {/* 4) Packaging Preferences */}
              <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'rgba(200, 155, 60, 0.2)' }}>
                <Label style={{ color: '#2C1810' }}>
                  4) Packaging Preferences
                </Label>
                
                <div className="space-y-2">
                  <Label style={{ color: '#2C1810' }}>Do you have packaging plans?</Label>
                  <div className="space-y-2">
                    <label
                      htmlFor="have_plans"
                      className="flex items-center space-x-3 p-3 rounded-lg border-2 transition-all cursor-pointer hover:border-[#C89B3C]/50"
                      style={{
                        borderColor: formData.packagingPlans === "have_plans" ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                        backgroundColor: formData.packagingPlans === "have_plans" ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                      }}
                    >
                      <input
                        type="radio"
                        name="packagingPlans"
                        id="have_plans"
                        value="have_plans"
                        checked={formData.packagingPlans === "have_plans"}
                        onChange={(e) => handleInputChange("packagingPlans", e.target.value)}
                        className="h-4 w-4 border-gray-300 text-[#C89B3C] focus:ring-[#C89B3C]"
                      />
                      <span className="flex-1" style={{ color: '#2C1810' }}>
                        I have packaging plans
                      </span>
                    </label>
                    <label
                      htmlFor="need_assistance"
                      className="flex items-center space-x-3 p-3 rounded-lg border-2 transition-all cursor-pointer hover:border-[#C89B3C]/50"
                      style={{
                        borderColor: formData.packagingPlans === "need_assistance" ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                        backgroundColor: formData.packagingPlans === "need_assistance" ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                      }}
                    >
                      <input
                        type="radio"
                        name="packagingPlans"
                        id="need_assistance"
                        value="need_assistance"
                        checked={formData.packagingPlans === "need_assistance"}
                        onChange={(e) => handleInputChange("packagingPlans", e.target.value)}
                        className="h-4 w-4 border-gray-300 text-[#C89B3C] focus:ring-[#C89B3C]"
                      />
                      <span className="flex-1" style={{ color: '#2C1810' }}>
                        I need assistance with packaging
                      </span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="packagingTypes" style={{ color: '#2C1810' }}>Types of packaging</Label>
                  <Input
                    id="packagingTypes"
                    value={formData.packagingTypes}
                    onChange={(e) => handleInputChange("packagingTypes", e.target.value)}
                    placeholder="e.g., flow wrap, stand-up pouch, boxes..."
                    style={{ borderColor: 'rgba(200, 155, 60, 0.3)' }}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unitsPerPack" style={{ color: '#2C1810' }}>Number of units per pack</Label>
                    <Input
                      id="unitsPerPack"
                      value={formData.unitsPerPack}
                      onChange={(e) => handleInputChange("unitsPerPack", e.target.value)}
                      placeholder="e.g., 6, 12, 24"
                      style={{ borderColor: 'rgba(200, 155, 60, 0.3)' }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="packsPerCase" style={{ color: '#2C1810' }}>Number of packs per case</Label>
                    <Input
                      id="packsPerCase"
                      value={formData.packsPerCase}
                      onChange={(e) => handleInputChange("packsPerCase", e.target.value)}
                      placeholder="e.g., 8, 12"
                      style={{ borderColor: 'rgba(200, 155, 60, 0.3)' }}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(200, 155, 60, 0.08)', border: '1px solid rgba(200, 155, 60, 0.2)' }}>
                  <p className="text-sm" style={{ color: '#8B7355' }}>
                    <strong>Note:</strong> Packaging considerations are critical for shelf life and product integrity. We recommend discussing packaging options early in the development process. We can provide guidance on materials, barrier properties, and packaging formats that best suit your product.
                  </p>
                </div>
              </div>

              {/* 5) Shelf Life Requirements */}
              <div className="space-y-2 pt-4 border-t" style={{ borderColor: 'rgba(200, 155, 60, 0.2)' }}>
                <Label htmlFor="shelfLifeRequirements" style={{ color: '#2C1810' }}>
                  5) Shelf Life Requirements
                </Label>
                <Textarea
                  id="shelfLifeRequirements"
                  value={formData.shelfLifeRequirements}
                  onChange={(e) => handleInputChange("shelfLifeRequirements", e.target.value)}
                  rows={3}
                  placeholder="Describe your desired shelf life and storage conditions..."
                  style={{ borderColor: 'rgba(200, 155, 60, 0.3)' }}
                />
                <div className="p-4 rounded-lg mt-3" style={{ backgroundColor: 'rgba(200, 155, 60, 0.08)', border: '1px solid rgba(200, 155, 60, 0.2)' }}>
                  <p className="text-sm" style={{ color: '#8B7355' }}>
                    <strong>Note:</strong> Shelf life depends on many factors including water activity (Aw), pH, packaging, and storage conditions. We can use preservatives (natural or synthetic) to extend shelf life, or formulate for clean label options. Water activity testing is available to validate shelf life claims.
                  </p>
                </div>
              </div>

              {/* 6) Sample Policy */}
              <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'rgba(200, 155, 60, 0.2)' }}>
                <Label style={{ color: '#2C1810' }}>
                  6) Sample Policy
                </Label>
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(200, 155, 60, 0.08)', border: '1px solid rgba(200, 155, 60, 0.2)' }}>
                  <p className="text-sm" style={{ color: '#8B7355' }}>
                    Development samples are produced at cost to cover ingredients, labor, and packaging materials. Shipping costs are the responsibility of the client. Sample turnaround time varies based on complexity and current production schedule.
                  </p>
                </div>
                <label
                  htmlFor="samplePolicy"
                  className="flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer"
                  style={{
                    borderColor: formData.samplePolicyAcknowledged ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                    backgroundColor: formData.samplePolicyAcknowledged ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    id="samplePolicy"
                    checked={formData.samplePolicyAcknowledged}
                    onChange={(e) => handleInputChange("samplePolicyAcknowledged", e.target.checked)}
                    className="h-4 w-4 mt-0.5 rounded border-gray-300 text-[#C89B3C] focus:ring-[#C89B3C]"
                  />
                  <span className="text-sm" style={{ color: '#2C1810' }}>
                    I understand that samples are charged at cost plus shipping.
                  </span>
                </label>
              </div>

              {/* 7) MOQ Acknowledgement */}
              <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'rgba(200, 155, 60, 0.2)' }}>
                <Label style={{ color: '#2C1810' }}>
                  7) Minimum Order Quantity (MOQ)
                </Label>
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(200, 155, 60, 0.08)', border: '1px solid rgba(200, 155, 60, 0.2)' }}>
                  <p className="text-sm" style={{ color: '#8B7355' }}>
                    Our standard minimum order quantity is 500 lbs of finished product. Smaller production runs may be available with a surcharge to cover changeover time and production setup costs.
                  </p>
                </div>
                <label
                  htmlFor="moqPolicy"
                  className="flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer"
                  style={{
                    borderColor: formData.moqAcknowledged ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                    backgroundColor: formData.moqAcknowledged ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    id="moqPolicy"
                    checked={formData.moqAcknowledged}
                    onChange={(e) => handleInputChange("moqAcknowledged", e.target.checked)}
                    className="h-4 w-4 mt-0.5 rounded border-gray-300 text-[#C89B3C] focus:ring-[#C89B3C]"
                  />
                  <span className="text-sm" style={{ color: '#2C1810' }}>
                    I understand that the MOQ is 500 lbs; smaller runs may have a surcharge.
                  </span>
                </label>
              </div>

              {/* Additional Comments */}
              <div className="space-y-2 pt-4 border-t" style={{ borderColor: 'rgba(200, 155, 60, 0.2)' }}>
                <Label htmlFor="additionalComments" style={{ color: '#2C1810' }}>
                  Additional Comments
                </Label>
                <Textarea
                  id="additionalComments"
                  value={formData.additionalComments}
                  onChange={(e) => handleInputChange("additionalComments", e.target.value)}
                  rows={4}
                  placeholder="Any other information you'd like to share..."
                  style={{ borderColor: 'rgba(200, 155, 60, 0.3)' }}
                />
              </div>

              {/* Submit Button */}
              <div className="pt-6">
                <Button
                  type="submit"
                  disabled={!isFormValid() || isSubmitting}
                  className="w-full bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Submit Private Label Request"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivateLabel;
