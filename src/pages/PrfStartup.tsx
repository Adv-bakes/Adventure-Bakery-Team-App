import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import logo from "@/assets/logo.png";
import Stage2WizardContent from "@/components/Stage2WizardContent";

const PrfStartup = () => {
  const navigate = useNavigate();
  const [showWizard, setShowWizard] = useState(false);

  if (showWizard) {
    return <Stage2WizardContent companyStage="startup" isStartup={true} />;
  }

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{
        backgroundImage: 'url(/bakery-workspace-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(44, 24, 16, 0.7)' }} />

      <header className="relative z-10 px-6 py-4 border-b border-white/10 backdrop-blur-sm" style={{ backgroundColor: 'rgba(44, 24, 16, 0.3)' }}>
        <div className="max-w-2xl mx-auto flex items-center justify-center">
          <img src={logo} alt="Logo" className="h-10" />
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(200, 155, 60, 0.1)' }}>
                <ClipboardList className="w-8 h-8" style={{ color: '#C89B3C' }} />
              </div>
              
              <div>
                <h1 className="text-2xl font-semibold mb-3" style={{ color: '#2C1810' }}>
                  Technical Project Review
                </h1>
                <p className="text-sm leading-relaxed" style={{ color: '#8B7355' }}>
                  We'll now gather detailed product and manufacturing information to evaluate feasibility and scope services.
                </p>
              </div>

              <Button
                onClick={() => setShowWizard(true)}
                className="w-full mt-4 bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white"
              >
                Start Technical Review
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PrfStartup;
