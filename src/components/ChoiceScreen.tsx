import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, Wrench } from "lucide-react";
import logo from "@/assets/logo.png";
import LeadQualifier from "@/pages/LeadQualifier";

interface ChoiceScreenProps {
  leadData: {
    fullName: string;
    companyName: string;
    email: string;
    phone: string;
  };
}

const ChoiceScreen = ({ leadData }: ChoiceScreenProps) => {
  const navigate = useNavigate();
  const [showQualifier, setShowQualifier] = useState(false);

  const handleQualifierOption = () => {
    // Show the Lead Qualifier wizard immediately
    setShowQualifier(true);
  };

  const handleCoachOption = () => {
    // Navigate to pricing/checkout for Kitchen-to-Factory Coach
    navigate("/pricing");
  };

  // If user chose Option A, show the Lead Qualifier wizard
  if (showQualifier) {
    return <LeadQualifier leadData={leadData} />;
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: 'linear-gradient(135deg, #2C1810 0%, #4A3728 50%, #2C1810 100%)',
      }}
    >
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <img src={logo} alt="Adventure Bakery Logo" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#F5F1E6' }}>
            How would you like to move forward?
          </h1>
          <p className="text-base" style={{ color: 'rgba(245, 241, 230, 0.8)' }}>
            Choose the path that fits your needs, {leadData.fullName.split(' ')[0]}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Option A - Lead Qualifier (Free) */}
          <Card 
            className="border-0 cursor-pointer transition-all duration-200 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, rgba(245, 241, 230, 0.98) 0%, rgba(255, 253, 250, 0.98) 100%)',
              boxShadow: '0 8px 32px rgba(200, 155, 60, 0.2)'
            }}
            onClick={handleQualifierOption}
          >
            <CardHeader className="text-center pb-2">
              <div 
                className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #4A7C59 0%, #6B9B7A 100%)' }}
              >
                <ClipboardCheck className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl" style={{ color: '#2C1810' }}>
                See if my product is a fit
              </CardTitle>
              <CardDescription style={{ color: '#8B7355' }}>
                Free assessment
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center pt-0">
              <p className="text-sm mb-4" style={{ color: '#6B5B4F' }}>
                Answer a few questions to see if your product is ready for manufacturing scale-up.
              </p>
              <Button 
                variant="outline" 
                className="w-full border-2"
                style={{ 
                  borderColor: '#4A7C59', 
                  color: '#4A7C59',
                }}
              >
                Start Free Assessment
              </Button>
            </CardContent>
          </Card>

          {/* Option B - Kitchen-to-Factory Coach (Paid) */}
          <Card 
            className="border-0 cursor-pointer transition-all duration-200 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, rgba(245, 241, 230, 0.98) 0%, rgba(255, 253, 250, 0.98) 100%)',
              boxShadow: '0 8px 32px rgba(200, 155, 60, 0.2)'
            }}
            onClick={handleCoachOption}
          >
            <CardHeader className="text-center pb-2">
              <div 
                className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #C89B3C 0%, #D4A855 100%)' }}
              >
                <Wrench className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl" style={{ color: '#2C1810' }}>
                Kitchen-to-Factory Coach
              </CardTitle>
              <CardDescription style={{ color: '#8B7355' }}>
                DIY guided program
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center pt-0">
              <p className="text-sm mb-4" style={{ color: '#6B5B4F' }}>
                Get step-by-step guidance to turn your kitchen recipe into a professional product.
              </p>
              <Button 
                className="w-full bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white"
              >
                View Pricing
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-sm mt-8" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
          Not sure? The free assessment will help you decide.
        </p>
      </div>
    </div>
  );
};

export default ChoiceScreen;
