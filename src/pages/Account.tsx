import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { LogOut, User, Building2, Save } from "lucide-react";

export default function Account() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    business_name: "",
    product_type: "",
    location: "",
    phone: "",
    website: "",
    bio: "",
    target_market: ""
  });

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setEmail(user.email || "");
      
      // Load profile data
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileData) {
        setProfile({
          business_name: profileData.business_name || "",
          product_type: profileData.product_type || "",
          location: profileData.location || "",
          phone: profileData.phone || "",
          website: profileData.website || "",
          bio: profileData.bio || "",
          target_market: profileData.target_market || ""
        });
      }
    } else {
      navigate("/auth");
    }
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...profile
        });

      if (error) {
        toast.error("Failed to save profile");
        console.error(error);
      } else {
        toast.success("Profile saved successfully!");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  const formatWebsite = (value: string) => {
    // Add https:// if no protocol is present
    if (value && !value.match(/^https?:\/\//i)) {
      return `https://${value}`;
    }
    return value;
  };

  const handleInputChange = (field: string, value: string) => {
    let formattedValue = value;
    
    if (field === 'phone') {
      formattedValue = formatPhoneNumber(value);
    } else if (field === 'website') {
      formattedValue = formatWebsite(value);
    }
    
    setProfile(prev => ({ ...prev, [field]: formattedValue }));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
    toast.success("Signed out successfully");
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Profile Setup</h1>
        <p className="text-muted-foreground mt-2">
          Tell us about your business to get started
        </p>
      </div>

      <Card className="elevated-card mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Business Information
          </CardTitle>
          <CardDescription>Details about your food business</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business_name">Business Name *</Label>
            <Input
              id="business_name"
              type="text"
              placeholder="Your Bakery Name"
              value={profile.business_name}
              onChange={(e) => handleInputChange("business_name", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="product_type">Product Type *</Label>
            <Input
              id="product_type"
              type="text"
              placeholder="e.g., Artisan Breads, Cookies, Cakes"
              value={profile.product_type}
              onChange={(e) => handleInputChange("product_type", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_market">Target Market</Label>
            <Input
              id="target_market"
              type="text"
              placeholder="e.g., Health-conscious millennials, Local restaurants, Specialty grocery stores"
              value={profile.target_market}
              onChange={(e) => handleInputChange("target_market", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              type="text"
              placeholder="City, State"
              value={profile.location}
              onChange={(e) => handleInputChange("location", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={profile.phone}
              onChange={(e) => handleInputChange("phone", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://yourbusiness.com"
              value={profile.website}
              onChange={(e) => handleInputChange("website", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">About Your Business</Label>
            <Textarea
              id="bio"
              placeholder="Tell us about your products, mission, or what makes your business unique..."
              value={profile.bio}
              onChange={(e) => handleInputChange("bio", e.target.value)}
              rows={4}
            />
          </div>

          <Button 
            onClick={handleSaveProfile} 
            disabled={saving || !profile.business_name || !profile.product_type}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </CardContent>
      </Card>

      <Card className="elevated-card mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Information
          </CardTitle>
          <CardDescription>Your login details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              disabled
              className="bg-muted"
            />
            <p className="text-sm text-muted-foreground">
              Email cannot be changed at this time
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="elevated-card border-destructive/50">
        <CardHeader>
          <CardTitle>Sign Out</CardTitle>
          <CardDescription>Sign out of your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={handleSignOut}
            className="w-full"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
