import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";

const NdaNext = () => {
  const navigate = useNavigate();

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
            Own Formula Path
          </h1>
        </div>

        <Card 
          className="border-0"
          style={{
            background: 'linear-gradient(135deg, rgba(245, 241, 230, 0.98) 0%, rgba(255, 253, 250, 0.98) 100%)',
            boxShadow: '0 8px 32px rgba(200, 155, 60, 0.25)'
          }}
        >
          <CardHeader>
            <CardTitle className="text-lg" style={{ color: '#2C1810' }}>
              NDA & Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm" style={{ color: '#8B7355' }}>
              This page will contain the NDA agreement and next steps for brands with their own formula.
            </p>
            <p className="text-sm italic" style={{ color: '#8B7355' }}>
              Coming soon.
            </p>
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="gap-2 mt-4"
              style={{ color: '#8B7355' }}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Start
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NdaNext;
