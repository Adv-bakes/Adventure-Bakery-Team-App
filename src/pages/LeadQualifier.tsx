import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, XCircle, AlertTriangle, CheckCircle } from "lucide-react";
import logo from "@/assets/logo.png";

type OutcomeType = "not_a_match" | "conditional_match" | "good_match" | null;

const TOTAL_STEPS = 4;

const companyStageOptions = [
  { value: "established", label: "Established Brand" },
  { value: "emerging", label: "Emerging Brand" },
  { value: "startup", label: "Start-Up (limited distribution, under 1 year)" },
  { value: "new", label: "New Brand (pre-launch / pre-revenue)" },
];

const processRequirementOptions = [
  { value: "sheeting", label: "Sheeting (dough stretching)" },
  { value: "proofing", label: "Proofing" },
  { value: "rotary_cutters", label: "Rotary cutters / stamped cookies" },
  { value: "enrobing", label: "Enrobing (chocolate coating)" },
  { value: "frying", label: "Frying, grilling, stovetop cooking" },
  { value: "meat_fish_poultry", label: "Contains meat, fish, or poultry" },
  { value: "none", label: "None of the above" },
];

const DISQUALIFYING_PROCESSES = ["sheeting", "proofing", "rotary_cutters", "enrobing", "frying", "meat_fish_poultry"];

const productionVolumeOptions = [
  { value: "under_200", label: "Less than 200 lbs" },
  { value: "200_500", label: "200–500 lbs" },
  { value: "500_10000", label: "500–10,000 lbs" },
  { value: "over_10000", label: "10,000+ lbs" },
];

const formulaOwnershipOptions = [
  { value: "own_formula", label: "I have my own formula" },
  { value: "private_label", label: "I need a private label product" },
];

interface LeadQualifierProps {
  leadData?: {
    fullName: string;
    companyName: string;
    email: string;
    phone: string;
  };
}

const LeadQualifier = ({ leadData }: LeadQualifierProps) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [outcome, setOutcome] = useState<OutcomeType>(null);
  const [answers, setAnswers] = useState({
    companyStage: "",
    processRequirements: [] as string[],
    productionVolume: "",
    formulaOwnership: "",
  });
  
  // Conditional match acknowledgement state
  const [acknowledged, setAcknowledged] = useState(false);
  const [typedName, setTypedName] = useState("");

  const progressPercent = outcome ? 100 : (currentStep / (TOTAL_STEPS + 1)) * 100;

  const handleNext = () => {
    // Step 2: Check for disqualifying process requirements
    if (currentStep === 2) {
      const hasDisqualifyingProcess = answers.processRequirements.some(r => 
        DISQUALIFYING_PROCESSES.includes(r)
      );
      if (hasDisqualifyingProcess) {
        setOutcome("not_a_match");
        return;
      }
    }

    // Step 3: Check volume logic
    if (currentStep === 3) {
      if (answers.productionVolume === "under_200") {
        setOutcome("not_a_match");
        return;
      }
      if (answers.productionVolume === "200_500") {
        setOutcome("conditional_match");
        return;
      }
      // 500+ lbs continues to Step 4
    }

    // Step 4: Navigate forward based on formula ownership
    if (currentStep === 4) {
      // Store company stage for Stage 2 wizard
      localStorage.setItem("qualifierCompanyStage", answers.companyStage);
      
      if (answers.formulaOwnership === "private_label") {
        navigate("/private-label");
      } else {
        // Show Good Match outcome for own formula
        setOutcome("good_match");
      }
      return;
    }

    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleRadioChange = (field: string, value: string) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (value: string, checked: boolean) => {
    setAnswers(prev => {
      let newRequirements = [...prev.processRequirements];
      
      if (value === "none") {
        newRequirements = checked ? ["none"] : [];
      } else {
        newRequirements = newRequirements.filter(r => r !== "none");
        
        if (checked) {
          newRequirements.push(value);
        } else {
          newRequirements = newRequirements.filter(r => r !== value);
        }
      }
      
      return { ...prev, processRequirements: newRequirements };
    });
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return answers.companyStage !== "";
      case 2:
        return answers.processRequirements.length > 0;
      case 3:
        return answers.productionVolume !== "";
      case 4:
        return answers.formulaOwnership !== "";
      default:
        return true;
    }
  };

  const handleConditionalContinue = () => {
    // Store company stage for Stage 2 wizard
    localStorage.setItem("qualifierCompanyStage", answers.companyStage);
    // Store lead data for PRF auto-population
    if (leadData) {
      localStorage.setItem("prfLeadData", JSON.stringify(leadData));
    }
    
    // Step 4 wasn't answered yet (skipped from Step 3), go to Step 4 first
    if (answers.formulaOwnership === "") {
      setOutcome(null);
      setCurrentStep(4);
      return;
    }
    // Step 4 was answered, route based on selection
    if (answers.formulaOwnership === "private_label") {
      navigate("/private-label");
    } else {
      // Own formula - route based on brand stage
      if (answers.companyStage === "startup" || answers.companyStage === "new") {
        navigate("/prf-startup");
      } else {
        navigate("/prf-established");
      }
    }
  };

  const handleGoodMatchContinue = () => {
    // Store company stage for Stage 2 wizard
    localStorage.setItem("qualifierCompanyStage", answers.companyStage);
    // Store lead data for PRF auto-population
    if (leadData) {
      localStorage.setItem("prfLeadData", JSON.stringify(leadData));
    }
    
    // Route based on brand stage
    if (answers.companyStage === "startup" || answers.companyStage === "new") {
      navigate("/prf-startup");
    } else {
      navigate("/prf-established");
    }
  };

  // Outcome: NOT A MATCH
  const renderNotAMatch = () => (
    <div className="space-y-6 py-4">
      <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)' }}>
        <XCircle className="w-8 h-8 text-red-600" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-4" style={{ color: '#2C1810' }}>
          Based on your current needs, we're not the right manufacturing fit at this time.
        </h2>
      </div>
      <div className="space-y-3 text-sm" style={{ color: '#8B7355' }}>
        <p>Thank you for answering our initial questions.</p>
        <p>Based on the information you provided, your product requires processes or volumes that fall outside our current manufacturing capabilities.</p>
        <p>This does not mean your product can't be manufactured — it means it may not be the right time or the right facility yet.</p>
      </div>
      
      <div className="mt-8 pt-6 border-t" style={{ borderColor: 'rgba(200, 155, 60, 0.2)' }}>
        <h3 className="text-lg font-semibold mb-3" style={{ color: '#2C1810' }}>
          Be ready for the right manufacturer
        </h3>
        <div className="space-y-3 text-sm" style={{ color: '#8B7355' }}>
          <p>Many brands reach manufacturing too early.</p>
          <p>Kitchen-to-Factory Coach helps you prepare your recipe, formula, and business decisions so you're ready when the timing is right.</p>
        </div>
        <Button
          onClick={() => navigate("/pricing")}
          className="w-full mt-6 bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white"
        >
          Explore Kitchen-to-Factory Coach
        </Button>
      </div>
    </div>
  );

  // Outcome: CONDITIONAL MATCH
  const renderConditionalMatch = () => (
    <div className="space-y-6 py-4">
      <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
        <AlertTriangle className="w-8 h-8 text-amber-600" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-4" style={{ color: '#2C1810' }}>
          Let's discuss your manufacturing project.
        </h2>
      </div>
      <div className="space-y-3 text-sm" style={{ color: '#8B7355' }}>
        <p>Based on your initial production volume, we may be able to work together under specific conditions.</p>
        <p>Initial runs between 200 and 500 pounds require a surcharge to cover change-over time and production setup.</p>
      </div>
      
      <div className="mt-6 space-y-4">
        <div 
          className="flex items-start space-x-3 p-4 rounded-lg border-2"
          style={{
            borderColor: acknowledged ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
            backgroundColor: acknowledged ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
          }}
        >
          <Checkbox
            id="acknowledge"
            checked={acknowledged}
            onCheckedChange={(checked) => setAcknowledged(checked as boolean)}
          />
          <Label htmlFor="acknowledge" className="cursor-pointer text-sm" style={{ color: '#2C1810' }}>
            I understand and agree to these conditions.
          </Label>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="typedName" className="text-sm font-medium" style={{ color: '#2C1810' }}>
            Type your full name to acknowledge.
          </Label>
          <Input
            id="typedName"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Your full name"
            className="border-2"
            style={{ borderColor: 'rgba(200, 155, 60, 0.3)' }}
          />
        </div>
      </div>
      
      <Button
        onClick={handleConditionalContinue}
        disabled={!acknowledged || typedName.trim().length === 0}
        className="w-full mt-6 bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white disabled:opacity-50"
      >
        Continue
      </Button>
    </div>
  );

  // Outcome: GOOD MATCH
  const renderGoodMatch = () => {
    return (
      <div className="space-y-6 py-4">
        <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4" style={{ color: '#2C1810' }}>
            You appear to be a good fit for our facility.
          </h2>
        </div>
        <div className="space-y-3 text-sm" style={{ color: '#8B7355' }}>
          <p>Based on your responses, your product and production volume align with our manufacturing capabilities.</p>
          <p>The next step is to provide detailed product information so we can evaluate your project accurately.</p>
        </div>
        
        <Button
          onClick={handleGoodMatchContinue}
          className="w-full mt-6 bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white"
        >
          Continue to Product Request Form
        </Button>
      </div>
    );
  };

  const renderStep = () => {
    // Show outcome screens
    if (outcome === "not_a_match") return renderNotAMatch();
    if (outcome === "conditional_match") return renderConditionalMatch();
    if (outcome === "good_match") return renderGoodMatch();

    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Company Stage
              </h2>
              <p className="text-sm" style={{ color: '#8B7355' }}>
                Select the option that best describes your company
              </p>
            </div>
            <RadioGroup
              value={answers.companyStage}
              onValueChange={(value) => handleRadioChange("companyStage", value)}
              className="space-y-3"
            >
              {companyStageOptions.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-[#C89B3C]/50"
                  style={{
                    borderColor: answers.companyStage === option.value ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                    backgroundColor: answers.companyStage === option.value ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                  }}
                  onClick={() => handleRadioChange("companyStage", option.value)}
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

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Process Requirements
              </h2>
              <p className="text-sm" style={{ color: '#8B7355' }}>
                Select all that apply to your product
              </p>
            </div>
            <div className="space-y-3">
              {processRequirementOptions.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-[#C89B3C]/50"
                  style={{
                    borderColor: answers.processRequirements.includes(option.value) ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                    backgroundColor: answers.processRequirements.includes(option.value) ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                  }}
                  onClick={() => handleCheckboxChange(option.value, !answers.processRequirements.includes(option.value))}
                >
                  <Checkbox
                    id={option.value}
                    checked={answers.processRequirements.includes(option.value)}
                    onCheckedChange={(checked) => handleCheckboxChange(option.value, checked as boolean)}
                  />
                  <Label htmlFor={option.value} className="flex-1 cursor-pointer font-medium" style={{ color: '#2C1810' }}>
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Initial Production Volume
              </h2>
              <p className="text-sm" style={{ color: '#8B7355' }}>
                What is your expected initial production volume per batch?
              </p>
            </div>
            <RadioGroup
              value={answers.productionVolume}
              onValueChange={(value) => handleRadioChange("productionVolume", value)}
              className="space-y-3"
            >
              {productionVolumeOptions.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-[#C89B3C]/50"
                  style={{
                    borderColor: answers.productionVolume === option.value ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                    backgroundColor: answers.productionVolume === option.value ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                  }}
                  onClick={() => handleRadioChange("productionVolume", option.value)}
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

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#2C1810' }}>
                Formula Ownership
              </h2>
              <p className="text-sm" style={{ color: '#8B7355' }}>
                Do you have your own formula or need a private label solution?
              </p>
            </div>
            <RadioGroup
              value={answers.formulaOwnership}
              onValueChange={(value) => handleRadioChange("formulaOwnership", value)}
              className="space-y-3"
            >
              {formulaOwnershipOptions.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-[#C89B3C]/50"
                  style={{
                    borderColor: answers.formulaOwnership === option.value ? '#C89B3C' : 'rgba(200, 155, 60, 0.2)',
                    backgroundColor: answers.formulaOwnership === option.value ? 'rgba(200, 155, 60, 0.08)' : 'transparent',
                  }}
                  onClick={() => handleRadioChange("formulaOwnership", option.value)}
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

      default:
        return null;
    }
  };

  return (
    <div 
      className="min-h-screen p-6"
      style={{
        background: 'linear-gradient(135deg, #2C1810 0%, #4A3728 50%, #2C1810 100%)',
      }}
    >
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <img src={logo} alt="Adventure Bakery Logo" className="w-14 h-14 mx-auto mb-3" />
          <h1 className="text-xl font-bold" style={{ color: '#F5F1E6' }}>
            Product Fit Assessment
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(245, 241, 230, 0.7)' }}>
            Let's see if your product is ready for manufacturing
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex justify-between text-xs mb-2" style={{ color: 'rgba(245, 241, 230, 0.7)' }}>
            <span>{outcome ? "Complete" : `Step ${Math.min(currentStep, TOTAL_STEPS)} of ${TOTAL_STEPS}`}</span>
            <span>{Math.round(progressPercent)}% complete</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        <Card 
          className="border-0"
          style={{
            background: 'linear-gradient(135deg, rgba(245, 241, 230, 0.98) 0%, rgba(255, 253, 250, 0.98) 100%)',
            boxShadow: '0 8px 32px rgba(200, 155, 60, 0.25)'
          }}
        >
          <CardContent className="p-6">
            {renderStep()}

            {/* Navigation buttons - only show during steps, not outcomes */}
            {!outcome && currentStep <= TOTAL_STEPS && (
              <div className="flex justify-between mt-8 pt-6 border-t" style={{ borderColor: 'rgba(200, 155, 60, 0.2)' }}>
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  disabled={currentStep === 1}
                  className="gap-2"
                  style={{ color: currentStep === 1 ? 'rgba(139, 115, 85, 0.5)' : '#8B7355' }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="gap-2 bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white"
                >
                  {currentStep === TOTAL_STEPS ? "See Results" : "Next"}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LeadQualifier;
