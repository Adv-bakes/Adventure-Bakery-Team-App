import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

type CompanyStage = "startup" | "new" | "emerging" | "established";

interface WizardData {
  // Project Basics
  projectType: string;
  customerName: string;
  productName: string;
  developmentApproach: string;
  
  // Product Type / Status
  finishedForm: string[];
  isNutraceutical: boolean;
  flavorType: string;
  intendedApplication: string[];
  
  // Claims / Certifications
  additionalRequirements: string[];
  
  // Packaging
  packagingReadiness: string;
  primaryPackagingVessel: string;
  unitsPerVessel: string;
  artworkReadiness: string;
  labelResponsibility: string;
  shipCaseRequirements: string;
  palletsRequired: string;
  
  // Volumes / Timing / Ops
  targetDate: string;
  priceTargetPerUnit: string;
  annualVolume: string;
  orderQuantity: string;
  orderFrequency: string;
  warehousingNeeds: string[];
  
  // Contact
  technicalContactName: string;
  technicalContactEmail: string;
  technicalContactPhone: string;
  additionalProjectInfo: string;
}

const initialData: WizardData = {
  projectType: "",
  customerName: "",
  productName: "",
  developmentApproach: "",
  finishedForm: [],
  isNutraceutical: false,
  flavorType: "",
  intendedApplication: [],
  additionalRequirements: [],
  packagingReadiness: "",
  primaryPackagingVessel: "",
  unitsPerVessel: "",
  artworkReadiness: "",
  labelResponsibility: "",
  shipCaseRequirements: "",
  palletsRequired: "",
  targetDate: "",
  priceTargetPerUnit: "",
  annualVolume: "",
  orderQuantity: "",
  orderFrequency: "",
  warehousingNeeds: [],
  technicalContactName: "",
  technicalContactEmail: "",
  technicalContactPhone: "",
  additionalProjectInfo: "",
};

// Step definitions
const STEPS = [
  { id: 1, title: "Project Type", section: "Project Basics" },
  { id: 2, title: "Customer & Product Name", section: "Project Basics" },
  { id: 3, title: "Development Approach", section: "Project Basics" },
  { id: 4, title: "Finished Form", section: "Product Type / Status" },
  { id: 5, title: "Nutraceutical", section: "Product Type / Status" },
  { id: 6, title: "Flavor Type", section: "Product Type / Status" },
  { id: 7, title: "Intended Application", section: "Product Type / Status" },
  { id: 8, title: "Additional Requirements", section: "Claims / Certifications" },
  { id: 9, title: "Packaging Readiness", section: "Packaging" },
  { id: 10, title: "Packaging Details", section: "Packaging" },
  { id: 11, title: "Artwork & Labels", section: "Packaging" },
  { id: 12, title: "Shipping", section: "Packaging" },
  { id: 13, title: "Target Date & Pricing", section: "Volumes / Timing / Ops" },
  { id: 14, title: "Volume & Frequency", section: "Volumes / Timing / Ops" },
  { id: 15, title: "Warehousing", section: "Volumes / Timing / Ops" },
  { id: 16, title: "Technical Contact", section: "Contact" },
  { id: 17, title: "Additional Info", section: "Contact" },
];

const TOTAL_STEPS = STEPS.length;

const Stage2Wizard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<WizardData>(initialData);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Get company stage from location state or localStorage
  const companyStage: CompanyStage = location.state?.companyStage || 
    (localStorage.getItem("qualifierCompanyStage") as CompanyStage) || "startup";
  
  const isStartup = companyStage === "startup" || companyStage === "new";

  const progressPercent = (currentStep / TOTAL_STEPS) * 100;

  const getOrCreateDraftToken = () => {
    let token = localStorage.getItem("stage2DraftToken");
    if (!token) {
      token = crypto.randomUUID() + crypto.randomUUID();
      localStorage.setItem("stage2DraftToken", token);
    }
    return token;
  };

  // Load existing draft on mount
  useEffect(() => {
    const savedId = localStorage.getItem("stage2SubmissionId");
    if (savedId) {
      loadDraft(savedId);
    } else {
      createNewSubmission();
    }
  }, []);

  const createNewSubmission = async () => {
    const token = getOrCreateDraftToken();
    const { data, error } = await supabase
      .from("stage2_prf_submissions")
      .insert([{
        company_stage: companyStage,
        status: "draft" as const,
        data_json: JSON.parse(JSON.stringify(initialData)),
        draft_token: token,
      } as any])
      .select()
      .single();

    if (error) {
      console.error("Error creating submission:", error);
      return;
    }

    if (data) {
      setSubmissionId(data.id);
      localStorage.setItem("stage2SubmissionId", data.id);
    }
  };

  const loadDraft = async (id: string) => {
    const token = getOrCreateDraftToken();
    const { data, error } = await supabase
      .rpc("get_stage2_draft", { _id: id, _token: token } as any)
      .maybeSingle();

    if (error || !data) {
      // Draft not found or already submitted — create new
      localStorage.removeItem("stage2SubmissionId");
      createNewSubmission();
      return;
    }

    setSubmissionId(data.id);
    if (data.data_json && typeof data.data_json === "object") {
      setFormData({ ...initialData, ...(data.data_json as Record<string, any>) });
    }
  };

  const autoSave = async (updatedData: WizardData) => {
    if (!submissionId) return;
    const token = getOrCreateDraftToken();

    setIsSaving(true);
    const { error } = await supabase.rpc("save_stage2_draft" as any, {
      _id: submissionId,
      _token: token,
      _data: JSON.parse(JSON.stringify(updatedData)),
    });

    if (error) {
      console.error("Auto-save error:", error);
    }
    setIsSaving(false);
  };

  const updateFormData = (updates: Partial<WizardData>) => {
    const newData = { ...formData, ...updates };
    setFormData(newData);
    autoSave(newData);
  };

  const handleCheckboxChange = (field: keyof WizardData, value: string, checked: boolean) => {
    const currentValues = formData[field] as string[];
    let newValues: string[];
    
    if (checked) {
      newValues = [...currentValues, value];
    } else {
      newValues = currentValues.filter(v => v !== value);
    }
    
    updateFormData({ [field]: newValues });
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!submissionId) return;
    const token = getOrCreateDraftToken();

    const { data: ok, error } = await supabase.rpc("submit_stage2_draft" as any, {
      _id: submissionId,
      _token: token,
      _data: JSON.parse(JSON.stringify(formData)),
    });

    if (error || !ok) {
      toast({
        title: "Submission failed",
        description: error?.message || "Could not submit draft",
        variant: "destructive",
      });
      return;
    }

    localStorage.removeItem("stage2SubmissionId");
    setIsSubmitted(true);
    toast({
      title: "PRF Submitted Successfully",
      description: "Our team will review and follow up with you.",
    });
  };

  // Render submission confirmation
  if (isSubmitted) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#FDF8F3' }}>
        <header className="px-6 py-4 border-b" style={{ borderColor: 'rgba(200, 155, 60, 0.2)', backgroundColor: 'rgba(255, 255, 255, 0.8)' }}>
          <div className="max-w-2xl mx-auto flex items-center justify-center">
            <img src={logo} alt="Logo" className="h-10" />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <Card className="w-full max-w-lg">
            <CardContent className="pt-8 pb-8">
              <div className="text-center space-y-6">
                <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-semibold" style={{ color: '#2C1810' }}>
                  Submitted Successfully
                </h2>
                <p className="text-sm" style={{ color: '#8B7355' }}>
                  Thank you for completing the Product Request Form. Our team will review your submission and follow up with you shortly.
                </p>
                <Button
                  onClick={() => navigate("/")}
                  className="mt-4 bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white"
                >
                  Return to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const renderStep = () => {
    const currentStepInfo = STEPS[currentStep - 1];

    switch (currentStep) {
      case 1: // Project Type
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#C89B3C' }}>{currentStepInfo.section}</p>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                What type of project is this?
              </h2>
            </div>
            <RadioGroup
              value={formData.projectType}
              onValueChange={(value) => updateFormData({ projectType: value })}
              className="space-y-3"
            >
              {["New Project", "Project Change / Revision"].map((option) => (
                <div
                  key={option}
                  className="flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-[#C89B3C]/50"
                  style={{
                    borderColor: formData.projectType === option ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                    backgroundColor: formData.projectType === option ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                  }}
                  onClick={() => updateFormData({ projectType: option })}
                >
                  <RadioGroupItem value={option} id={option} />
                  <Label htmlFor={option} className="flex-1 cursor-pointer font-medium" style={{ color: '#2C1810' }}>
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 2: // Customer & Product Name
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#C89B3C' }}>{currentStepInfo.section}</p>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Customer & Product Information
              </h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="customerName" style={{ color: '#2C1810' }}>Customer Name</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => updateFormData({ customerName: e.target.value })}
                  placeholder="Your company name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="productName" style={{ color: '#2C1810' }}>Product Name</Label>
                <Input
                  id="productName"
                  value={formData.productName}
                  onChange={(e) => updateFormData({ productName: e.target.value })}
                  placeholder="Name of the product"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        );

      case 3: // Development Approach
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#C89B3C' }}>{currentStepInfo.section}</p>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Development Approach
              </h2>
              {isStartup && (
                <p className="text-sm" style={{ color: '#8B7355' }}>
                  This helps us understand your starting point.
                </p>
              )}
            </div>
            <RadioGroup
              value={formData.developmentApproach}
              onValueChange={(value) => updateFormData({ developmentApproach: value })}
              className="space-y-3"
            >
              {[
                "Match Existing Product",
                "Match & Improve Existing Product",
                "Develop from Scratch"
              ].map((option) => (
                <div
                  key={option}
                  className="flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-[#C89B3C]/50"
                  style={{
                    borderColor: formData.developmentApproach === option ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                    backgroundColor: formData.developmentApproach === option ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                  }}
                  onClick={() => updateFormData({ developmentApproach: option })}
                >
                  <RadioGroupItem value={option} id={option} />
                  <Label htmlFor={option} className="flex-1 cursor-pointer font-medium" style={{ color: '#2C1810' }}>
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 4: // Finished Form
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#C89B3C' }}>{currentStepInfo.section}</p>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Finished Form
              </h2>
              <p className="text-sm" style={{ color: '#8B7355' }}>
                Select all that apply
              </p>
            </div>
            <div className="space-y-3">
              {[
                "Baked / Ready to Eat",
                "Frozen (Par-baked, Raw, etc.)",
                "Bulk Pack",
                "Retail Pack",
                "Foodservice Pack"
              ].map((option) => (
                <div
                  key={option}
                  className="flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-[#C89B3C]/50"
                  style={{
                    borderColor: formData.finishedForm.includes(option) ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                    backgroundColor: formData.finishedForm.includes(option) ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                  }}
                  onClick={() => handleCheckboxChange("finishedForm", option, !formData.finishedForm.includes(option))}
                >
                  <Checkbox
                    id={option}
                    checked={formData.finishedForm.includes(option)}
                    onCheckedChange={(checked) => handleCheckboxChange("finishedForm", option, checked as boolean)}
                  />
                  <Label htmlFor={option} className="flex-1 cursor-pointer font-medium" style={{ color: '#2C1810' }}>
                    {option}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 5: // Nutraceutical
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#C89B3C' }}>{currentStepInfo.section}</p>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Is this product a nutraceutical?
              </h2>
              <p className="text-sm" style={{ color: '#8B7355' }}>
                Products with added vitamins, supplements, or functional health claims
              </p>
            </div>
            <RadioGroup
              value={formData.isNutraceutical ? "yes" : "no"}
              onValueChange={(value) => updateFormData({ isNutraceutical: value === "yes" })}
              className="space-y-3"
            >
              {[
                { value: "no", label: "No" },
                { value: "yes", label: "Yes" }
              ].map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-[#C89B3C]/50"
                  style={{
                    borderColor: (formData.isNutraceutical ? "yes" : "no") === option.value ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                    backgroundColor: (formData.isNutraceutical ? "yes" : "no") === option.value ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                  }}
                  onClick={() => updateFormData({ isNutraceutical: option.value === "yes" })}
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="flex-1 cursor-pointer font-medium" style={{ color: '#2C1810' }}>
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 6: // Flavor Type
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#C89B3C' }}>{currentStepInfo.section}</p>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Flavor Type
              </h2>
            </div>
            <RadioGroup
              value={formData.flavorType}
              onValueChange={(value) => updateFormData({ flavorType: value })}
              className="space-y-3"
            >
              {[
                "Natural",
                "Artificial",
                "Natural + Artificial"
              ].map((option) => (
                <div
                  key={option}
                  className="flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-[#C89B3C]/50"
                  style={{
                    borderColor: formData.flavorType === option ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                    backgroundColor: formData.flavorType === option ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                  }}
                  onClick={() => updateFormData({ flavorType: option })}
                >
                  <RadioGroupItem value={option} id={option} />
                  <Label htmlFor={option} className="flex-1 cursor-pointer font-medium" style={{ color: '#2C1810' }}>
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 7: // Intended Application
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#C89B3C' }}>{currentStepInfo.section}</p>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Intended Application
              </h2>
              <p className="text-sm" style={{ color: '#8B7355' }}>
                Select all that apply
              </p>
            </div>
            <div className="space-y-3">
              {[
                "Retail",
                "Foodservice",
                "Other"
              ].map((option) => (
                <div
                  key={option}
                  className="flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-[#C89B3C]/50"
                  style={{
                    borderColor: formData.intendedApplication.includes(option) ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                    backgroundColor: formData.intendedApplication.includes(option) ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                  }}
                  onClick={() => handleCheckboxChange("intendedApplication", option, !formData.intendedApplication.includes(option))}
                >
                  <Checkbox
                    id={option}
                    checked={formData.intendedApplication.includes(option)}
                    onCheckedChange={(checked) => handleCheckboxChange("intendedApplication", option, checked as boolean)}
                  />
                  <Label htmlFor={option} className="flex-1 cursor-pointer font-medium" style={{ color: '#2C1810' }}>
                    {option}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 8: // Additional Requirements (Claims/Certifications)
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#C89B3C' }}>{currentStepInfo.section}</p>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Additional Requirements
              </h2>
              <p className="text-sm" style={{ color: '#8B7355' }}>
                Select all certifications or restrictions that apply
              </p>
            </div>
            <div className="space-y-3">
              {[
                "Kosher",
                "Allergen Restrictions",
                "Organic",
                "Gluten Free",
                "Non-GMO",
                "Export Requirements",
                "None"
              ].map((option) => (
                <div
                  key={option}
                  className="flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-[#C89B3C]/50"
                  style={{
                    borderColor: formData.additionalRequirements.includes(option) ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                    backgroundColor: formData.additionalRequirements.includes(option) ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                  }}
                  onClick={() => handleCheckboxChange("additionalRequirements", option, !formData.additionalRequirements.includes(option))}
                >
                  <Checkbox
                    id={option}
                    checked={formData.additionalRequirements.includes(option)}
                    onCheckedChange={(checked) => handleCheckboxChange("additionalRequirements", option, checked as boolean)}
                  />
                  <Label htmlFor={option} className="flex-1 cursor-pointer font-medium" style={{ color: '#2C1810' }}>
                    {option}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 9: // Packaging Readiness
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#C89B3C' }}>{currentStepInfo.section}</p>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Packaging Readiness
              </h2>
              {isStartup && (
                <p className="text-sm" style={{ color: '#8B7355' }}>
                  It's okay if you're still figuring this out!
                </p>
              )}
            </div>
            <RadioGroup
              value={formData.packagingReadiness}
              onValueChange={(value) => updateFormData({ packagingReadiness: value })}
              className="space-y-3"
            >
              {[
                "Ready / Packaging Secured",
                "In Process",
                "Need Assistance"
              ].map((option) => (
                <div
                  key={option}
                  className="flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-[#C89B3C]/50"
                  style={{
                    borderColor: formData.packagingReadiness === option ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                    backgroundColor: formData.packagingReadiness === option ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                  }}
                  onClick={() => updateFormData({ packagingReadiness: option })}
                >
                  <RadioGroupItem value={option} id={option} />
                  <Label htmlFor={option} className="flex-1 cursor-pointer font-medium" style={{ color: '#2C1810' }}>
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 10: // Packaging Details
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#C89B3C' }}>{currentStepInfo.section}</p>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Packaging Details
              </h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="primaryPackagingVessel" style={{ color: '#2C1810' }}>Primary Packaging Vessel Type</Label>
                <Input
                  id="primaryPackagingVessel"
                  value={formData.primaryPackagingVessel}
                  onChange={(e) => updateFormData({ primaryPackagingVessel: e.target.value })}
                  placeholder="e.g., Bag, Box, Clamshell, Tray"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="unitsPerVessel" style={{ color: '#2C1810' }}>Units Per Vessel</Label>
                <Input
                  id="unitsPerVessel"
                  value={formData.unitsPerVessel}
                  onChange={(e) => updateFormData({ unitsPerVessel: e.target.value })}
                  placeholder="e.g., 6, 12, 24"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        );

      case 11: // Artwork & Labels
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#C89B3C' }}>{currentStepInfo.section}</p>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Artwork & Labels
              </h2>
            </div>
            <div className="space-y-6">
              <div>
                <Label className="mb-3 block" style={{ color: '#2C1810' }}>Artwork Readiness</Label>
                <RadioGroup
                  value={formData.artworkReadiness}
                  onValueChange={(value) => updateFormData({ artworkReadiness: value })}
                  className="space-y-3"
                >
                  {["Ready", "In Process", "Need Assistance"].map((option) => (
                    <div
                      key={option}
                      className="flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-[#C89B3C]/50"
                      style={{
                        borderColor: formData.artworkReadiness === option ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                        backgroundColor: formData.artworkReadiness === option ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                      }}
                      onClick={() => updateFormData({ artworkReadiness: option })}
                    >
                      <RadioGroupItem value={option} id={`artwork-${option}`} />
                      <Label htmlFor={`artwork-${option}`} className="flex-1 cursor-pointer font-medium" style={{ color: '#2C1810' }}>
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div>
                <Label className="mb-3 block" style={{ color: '#2C1810' }}>Who is responsible for labels?</Label>
                <RadioGroup
                  value={formData.labelResponsibility}
                  onValueChange={(value) => updateFormData({ labelResponsibility: value })}
                  className="space-y-3"
                >
                  {["Customer Provided", "Manufacturer Provided", "TBD"].map((option) => (
                    <div
                      key={option}
                      className="flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-[#C89B3C]/50"
                      style={{
                        borderColor: formData.labelResponsibility === option ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                        backgroundColor: formData.labelResponsibility === option ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                      }}
                      onClick={() => updateFormData({ labelResponsibility: option })}
                    >
                      <RadioGroupItem value={option} id={`label-${option}`} />
                      <Label htmlFor={`label-${option}`} className="flex-1 cursor-pointer font-medium" style={{ color: '#2C1810' }}>
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
          </div>
        );

      case 12: // Shipping
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#C89B3C' }}>{currentStepInfo.section}</p>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Shipping Requirements
              </h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="shipCaseRequirements" style={{ color: '#2C1810' }}>Ship Case Requirements</Label>
                <Input
                  id="shipCaseRequirements"
                  value={formData.shipCaseRequirements}
                  onChange={(e) => updateFormData({ shipCaseRequirements: e.target.value })}
                  placeholder="e.g., Units per case, case dimensions"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="palletsRequired" style={{ color: '#2C1810' }}>Pallets Required</Label>
                <Input
                  id="palletsRequired"
                  value={formData.palletsRequired}
                  onChange={(e) => updateFormData({ palletsRequired: e.target.value })}
                  placeholder="e.g., Standard 48x40, Euro pallet"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        );

      case 13: // Target Date & Pricing
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#C89B3C' }}>{currentStepInfo.section}</p>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Target Date & Pricing
              </h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="targetDate" style={{ color: '#2C1810' }}>Target Launch Date</Label>
                <Input
                  id="targetDate"
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) => updateFormData({ targetDate: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="priceTargetPerUnit" style={{ color: '#2C1810' }}>Price Target Per Unit</Label>
                <Input
                  id="priceTargetPerUnit"
                  value={formData.priceTargetPerUnit}
                  onChange={(e) => updateFormData({ priceTargetPerUnit: e.target.value })}
                  placeholder="e.g., $2.50"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        );

      case 14: // Volume & Frequency
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#C89B3C' }}>{currentStepInfo.section}</p>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Volume & Frequency
              </h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="annualVolume" style={{ color: '#2C1810' }}>Estimated Annual Volume</Label>
                <Input
                  id="annualVolume"
                  value={formData.annualVolume}
                  onChange={(e) => updateFormData({ annualVolume: e.target.value })}
                  placeholder="e.g., 50,000 units"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="orderQuantity" style={{ color: '#2C1810' }}>Order Quantity</Label>
                <Input
                  id="orderQuantity"
                  value={formData.orderQuantity}
                  onChange={(e) => updateFormData({ orderQuantity: e.target.value })}
                  placeholder="e.g., 5,000 units per order"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="orderFrequency" style={{ color: '#2C1810' }}>Order Frequency</Label>
                <Input
                  id="orderFrequency"
                  value={formData.orderFrequency}
                  onChange={(e) => updateFormData({ orderFrequency: e.target.value })}
                  placeholder="e.g., Monthly, Quarterly"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        );

      case 15: // Warehousing
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#C89B3C' }}>{currentStepInfo.section}</p>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Warehousing Needs
              </h2>
              <p className="text-sm" style={{ color: '#8B7355' }}>
                Select all that apply
              </p>
            </div>
            <div className="space-y-3">
              {[
                "Dry Storage",
                "Cold Storage (Refrigerated)",
                "Freezer Storage",
                "No Warehousing Needed"
              ].map((option) => (
                <div
                  key={option}
                  className="flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-[#C89B3C]/50"
                  style={{
                    borderColor: formData.warehousingNeeds.includes(option) ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                    backgroundColor: formData.warehousingNeeds.includes(option) ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                  }}
                  onClick={() => handleCheckboxChange("warehousingNeeds", option, !formData.warehousingNeeds.includes(option))}
                >
                  <Checkbox
                    id={option}
                    checked={formData.warehousingNeeds.includes(option)}
                    onCheckedChange={(checked) => handleCheckboxChange("warehousingNeeds", option, checked as boolean)}
                  />
                  <Label htmlFor={option} className="flex-1 cursor-pointer font-medium" style={{ color: '#2C1810' }}>
                    {option}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 16: // Technical Contact
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#C89B3C' }}>{currentStepInfo.section}</p>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Technical / R&D Contact
              </h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="technicalContactName" style={{ color: '#2C1810' }}>Contact Name</Label>
                <Input
                  id="technicalContactName"
                  value={formData.technicalContactName}
                  onChange={(e) => updateFormData({ technicalContactName: e.target.value })}
                  placeholder="Full name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="technicalContactEmail" style={{ color: '#2C1810' }}>Email</Label>
                <Input
                  id="technicalContactEmail"
                  type="email"
                  value={formData.technicalContactEmail}
                  onChange={(e) => updateFormData({ technicalContactEmail: e.target.value })}
                  placeholder="email@company.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="technicalContactPhone" style={{ color: '#2C1810' }}>Phone</Label>
                <Input
                  id="technicalContactPhone"
                  type="tel"
                  value={formData.technicalContactPhone}
                  onChange={(e) => updateFormData({ technicalContactPhone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        );

      case 17: // Additional Info
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#C89B3C' }}>{currentStepInfo.section}</p>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Additional Project Information
              </h2>
              <p className="text-sm" style={{ color: '#8B7355' }}>
                Anything else we should know about your project?
              </p>
            </div>
            <Textarea
              value={formData.additionalProjectInfo}
              onChange={(e) => updateFormData({ additionalProjectInfo: e.target.value })}
              placeholder="Share any additional details, special requirements, or questions..."
              className="min-h-[150px]"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#FDF8F3' }}>
      {/* Header */}
      <header className="px-6 py-4 border-b" style={{ borderColor: 'rgba(200, 155, 60, 0.2)', backgroundColor: 'rgba(255, 255, 255, 0.8)' }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <img src={logo} alt="Logo" className="h-10" />
          {isSaving && (
            <span className="text-xs" style={{ color: '#8B7355' }}>Saving...</span>
          )}
        </div>
      </header>

      {/* Progress Bar */}
      <div className="px-6 py-4" style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: '#8B7355' }}>
              Step {currentStep} of {TOTAL_STEPS}
            </span>
            <span className="text-xs font-medium" style={{ color: '#C89B3C' }}>
              {Math.round(progressPercent)}% Complete
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-6 pb-8">
            {renderStep()}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t" style={{ borderColor: 'rgba(200, 155, 60, 0.2)' }}>
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>

              {currentStep === TOTAL_STEPS ? (
                <Button
                  onClick={handleSubmit}
                  className="flex items-center gap-2 bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white"
                >
                  Submit PRF
                  <CheckCircle className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  className="flex items-center gap-2 bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Stage2Wizard;
