import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import logo from "@/assets/logo.png";

// Validation schemas
const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters long");

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);
  const [resendEmail, setResendEmail] = useState("");

  const redirectByRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    const role = data?.role || "user";
    if (role === "admin") navigate("/team/admin");
    else if (role === "staff") navigate("/team/operations-hub");
    else navigate("/brand-portal");
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        redirectByRole(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        redirectByRole(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const validateEmail = (value: string) => {
    try {
      emailSchema.parse(value);
      setEmailError("");
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setEmailError(error.errors[0].message);
      }
      return false;
    }
  };

  const validatePassword = (value: string) => {
    try {
      passwordSchema.parse(value);
      setPasswordError("");
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setPasswordError(error.errors[0].message);
      }
      return false;
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (value) validateEmail(value);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (value) validatePassword(value);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate before submission
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      toast.error("Please fix the validation errors before submitting.");
      return;
    }

    if (!agreedToTerms) {
      toast.error("Please agree to the Terms of Service and Privacy Policy.");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/account`,
        },
      });

      if (error) {
        // Check for specific error codes
        if (error.message.includes("already registered") || error.status === 422) {
          toast.error("You already have an account. Please sign in instead.");
        } else if (error.message.includes("Password")) {
          toast.error("Password must be at least 6 characters long.");
        } else if (error.message.includes("valid email")) {
          toast.error("Please enter a valid email address.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Check if user already exists: Supabase returns user data but no session for existing users
      // This prevents email enumeration attacks
      if (data?.user && !data?.session) {
        // Check if this is a new signup by comparing timestamps
        const userCreatedAt = new Date(data.user.created_at || '');
        const now = new Date();
        const timeDiffSeconds = (now.getTime() - userCreatedAt.getTime()) / 1000;
        
        // If user was created more than 10 seconds ago, it's an existing user
        if (timeDiffSeconds > 10) {
          toast.error("You already have an account. Please sign in instead.");
          return;
        }
        
        // New user, confirmation email sent
        toast.success("Account created! Please check your email to confirm your account.");
        return;
      }

      // User created with session (confirmations disabled or auto-confirmed)
      if (data?.user?.id && data?.session) {
        toast.success("Account created successfully! Please complete your profile.");
        navigate("/account");
      } else if (!data?.user) {
        toast.error("Something went wrong during signup. Please try again.");
      }
    } catch (error) {
      console.error("Signup error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or password. Please try again.");
        } else if (error.message.includes("Email not confirmed")) {
          setResendEmail(email);
          setShowResendConfirmation(true);
          toast.error("Please confirm your email address before signing in.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data?.user) {
        toast.success("Welcome back!");
        // Role-based redirect handled by onAuthStateChange
      }
    } catch (error) {
      console.error("Sign in error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/`,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password reset email sent! Check your inbox.");
        setShowResetModal(false);
        setResetEmail("");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: resendEmail,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Confirmation email sent! Check your inbox.");
        setShowResendConfirmation(false);
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Sign in form (1/3) */}
      <div className="w-full lg:w-1/3 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-6">
          <Card 
            className="w-full border-0"
            style={{
              background: 'linear-gradient(135deg, rgba(245, 241, 230, 0.98) 0%, rgba(255, 253, 250, 0.98) 100%)',
              boxShadow: '0 8px 32px rgba(200, 155, 60, 0.15)'
            }}
          >
            <CardHeader className="space-y-3 text-center">
              <div className="mx-auto">
                <img src={logo} alt="Adventure Bakery Logo" className="w-24 h-24 mx-auto" />
              </div>
              <CardTitle className="text-3xl" style={{ color: '#2C1810' }}>
                Kitchen-to-Factory Coach
              </CardTitle>
              <CardDescription className="text-base" style={{ color: '#8B7355' }}>
                Turn your kitchen recipe into a professional product
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="signin" className="w-full" onValueChange={() => {
                setEmailError("");
                setPasswordError("");
                setEmail("");
                setPassword("");
              }}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="signin-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white" 
                      disabled={isLoading}
                    >
                      {isLoading ? "Signing in..." : "Sign In"}
                    </Button>
                    <div className="text-center mt-3">
                      <button
                        type="button"
                        onClick={() => setShowResetModal(true)}
                        className="text-sm hover:underline"
                        style={{ color: '#C89B3C' }}
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        required
                        className={emailError ? "border-destructive" : ""}
                      />
                      {emailError && (
                        <p className="text-sm text-destructive">{emailError}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => handlePasswordChange(e.target.value)}
                          required
                          className={passwordError ? "border-destructive pr-10" : "pr-10"}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {passwordError && (
                        <p className="text-sm text-destructive">{passwordError}</p>
                      )}
                    </div>
                    <div className="flex items-start space-x-2">
                      <Checkbox 
                        id="terms" 
                        checked={agreedToTerms}
                        onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                        required
                      />
                      <Label 
                        htmlFor="terms" 
                        className="text-sm leading-relaxed cursor-pointer"
                      >
                        I agree to the{" "}
                        <a 
                          href="/terms" 
                          className="hover:underline font-medium"
                          style={{ color: '#C89B3C' }}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Terms of Service
                        </a>{" "}
                        and{" "}
                        <a 
                          href="/privacy" 
                          className="hover:underline font-medium"
                          style={{ color: '#C89B3C' }}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Privacy Policy
                        </a>
                      </Label>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white" 
                      disabled={isLoading || !agreedToTerms}
                    >
                      {isLoading ? "Creating account..." : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Small tagline below sign-in */}
          <p className="text-center text-sm font-medium" style={{ color: '#FFFFFF' }}>
            Built for food entrepreneurs ready to scale beyond the kitchen.
          </p>
        </div>

        <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
          <DialogContent 
            className="border-0"
            style={{
              background: 'linear-gradient(135deg, rgba(245, 241, 230, 0.98) 0%, rgba(255, 253, 250, 0.98) 100%)',
              boxShadow: '0 8px 32px rgba(200, 155, 60, 0.15)'
            }}
          >
            <DialogHeader>
              <DialogTitle style={{ color: '#2C1810' }}>Reset Password</DialogTitle>
              <DialogDescription style={{ color: '#8B7355' }}>
                Enter your email address and we&apos;ll send you a link to reset your password.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="your@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowResetModal(false)}
                  style={{ borderColor: '#C89B3C', color: '#C89B3C' }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white" 
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showResendConfirmation} onOpenChange={setShowResendConfirmation}>
          <DialogContent 
            className="border-0"
            style={{
              background: 'linear-gradient(135deg, rgba(245, 241, 230, 0.98) 0%, rgba(255, 253, 250, 0.98) 100%)',
              boxShadow: '0 8px 32px rgba(200, 155, 60, 0.15)'
            }}
          >
            <DialogHeader>
              <DialogTitle style={{ color: '#2C1810' }}>Email Not Confirmed</DialogTitle>
              <DialogDescription style={{ color: '#8B7355' }}>
                Please confirm your email address to continue. We can send you another confirmation email.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm" style={{ color: '#8B7355' }}>
                Email: <span className="font-medium" style={{ color: '#2C1810' }}>{resendEmail}</span>
              </p>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowResendConfirmation(false)}
                  style={{ borderColor: '#C89B3C', color: '#C89B3C' }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleResendConfirmation}
                  className="flex-1 bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white" 
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Resend Confirmation"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Right side - Inspirational image (2/3) */}
      <div className="hidden lg:block lg:w-2/3 relative">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/auth-bakery-hero.jpg)' }}
        />
        {/* Stronger vignette overlay for better text readability */}
        <div 
          className="absolute inset-0" 
          style={{
            background: 'radial-gradient(ellipse at center, rgba(44, 24, 16, 0.55) 0%, rgba(44, 24, 16, 0.85) 100%)'
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div 
            className="p-10 max-w-2xl rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(245, 241, 230, 0.95) 0%, rgba(255, 253, 250, 0.92) 100%)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 100px rgba(200, 155, 60, 0.2)',
              border: '1px solid rgba(200, 155, 60, 0.3)'
            }}
          >
            <h2 
              className="text-5xl font-bold mb-4 leading-tight"
              style={{ color: '#2C1810' }}
            >
              From Recipe Creator to Confident Founder
            </h2>
            <p className="text-xl mb-6 leading-relaxed" style={{ color: '#5A4A3A' }}>
              Turn your kitchen recipe into a professional, factory-ready product.
            </p>
            <p className="text-lg leading-relaxed" style={{ color: '#8B7355' }}>
              Learn what manufacturers need — and organize your formulas, specs, and packaging 
              details to scale with confidence.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
