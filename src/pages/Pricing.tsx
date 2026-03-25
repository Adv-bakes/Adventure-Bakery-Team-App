import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import logo from "@/assets/logo.png";

const Pricing = () => {
  const navigate = useNavigate();

  const handlePurchase = () => {
    // TODO: Integrate with payment system
    // After successful payment, redirect to /k2f-login
    navigate("/k2f-login");
  };

  return (
    <div 
      className="min-h-screen p-6"
      style={{
        background: 'linear-gradient(135deg, #2C1810 0%, #4A3728 50%, #2C1810 100%)',
      }}
    >
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          className="mb-6 text-white/80 hover:text-white hover:bg-white/10"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="text-center mb-8">
          <img src={logo} alt="Adventure Bakery Logo" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#F5F1E6' }}>
            Kitchen-to-Factory Coach
          </h1>
          <p className="text-base" style={{ color: 'rgba(245, 241, 230, 0.8)' }}>
            Everything you need to turn your kitchen recipe into a professional product
          </p>
        </div>

        <div className="grid md:grid-cols-1 gap-6 max-w-lg mx-auto">
          <Card 
            className="border-0"
            style={{
              background: 'linear-gradient(135deg, rgba(245, 241, 230, 0.98) 0%, rgba(255, 253, 250, 0.98) 100%)',
              boxShadow: '0 8px 32px rgba(200, 155, 60, 0.25)'
            }}
          >
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl" style={{ color: '#2C1810' }}>
                DIY Guided Program
              </CardTitle>
              <CardDescription style={{ color: '#8B7355' }}>
                Self-paced with AI coaching support
              </CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold" style={{ color: '#C89B3C' }}>$297</span>
                <span className="text-muted-foreground ml-2">one-time</span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-3 mb-6">
                {[
                  "Complete product development workflow",
                  "Formula scaling tools",
                  "Shelf-life testing guides",
                  "Costing calculators",
                  "Packaging guidance",
                  "AI Manufacturing Coach",
                  "Lifetime access to resources",
                ].map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#4A7C59' }} />
                    <span style={{ color: '#6B5B4F' }}>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button 
                className="w-full bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white text-lg py-6"
                onClick={handlePurchase}
              >
                Get Started Now
              </Button>
              <p className="text-center text-sm mt-4" style={{ color: '#8B7355' }}>
                30-day money-back guarantee
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
