import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BookOpen, FileText, Video, ExternalLink, Info } from "lucide-react";

export default function Resources() {
  const shelfLifeSubResources = [
    { title: "Shelf-Life Science", route: "/resource/shelf-life-science" },
    { title: "Packaging Barriers & Materials", route: "/resource/packaging-barriers-materials" },
    { title: "Functional Ingredients for Shelf Life", route: "/resource/functional-ingredients-shelf-life" },
    { title: "Shelf-Life Testing & Validation", route: "/resource/shelf-life-testing-validation" },
    { title: "Shelf-Life Testing Guide", route: "/resource/shelf-life-testing-guide" }
  ];

  const shelfLifeTitles = shelfLifeSubResources.map(r => r.title);

  // Some resource links are still unset placeholders (e.g. .../your-workbook-id/edit).
  // Render these as a disabled "Coming soon" state so clients never hit a dead link.
  const isPlaceholderLink = (link?: string) => !!link && /your-[a-z-]*id/i.test(link);

  const resources = [
    {
      title: "Shelf Life",
      description: "Comprehensive resources for understanding and managing product shelf life",
      icon: BookOpen,
      tooltip: "Access all shelf-life related resources including science, packaging, ingredients, testing, and validation guides.",
      category: "shelf-life",
      isParent: true
    },
    {
      title: "Kitchen-to-Factory Workbook",
      description: "Complete guide to transforming your recipe into a scalable manufacturing process",
      icon: BookOpen,
      link: "https://docs.google.com/document/d/your-workbook-id/edit",
      tooltip: "This workbook helps you organize all production details manufacturers need to quote and produce your product accurately.",
      category: "getting-started"
    },
    {
      title: "Shelf-Life Science",
      description: "Understanding water activity, pH levels, moisture content, and storage temperature impact on product stability",
      icon: BookOpen,
      link: "#shelf-life-science",
      tooltip: "Learn the key scientific factors that determine how long your baked goods stay fresh and safe, including water activity, pH, moisture content, and storage temperature.",
      category: "shelf-life"
    },
    {
      title: "Packaging Barriers & Materials",
      description: "How packaging materials protect against oxygen, moisture, and light degradation",
      icon: BookOpen,
      link: "#packaging-barriers",
      tooltip: "Discover how different packaging materials and barrier technologies protect your products from environmental factors that cause degradation.",
      category: "shelf-life"
    },
    {
      title: "Functional Ingredients for Shelf Life",
      description: "Natural and synthetic additives that preserve freshness, moisture, and safety",
      icon: BookOpen,
      link: "#functional-ingredients",
      tooltip: "Explore humectants, preservatives, antioxidants, and enzymes that extend shelf life while maintaining product quality and clean label appeal.",
      category: "shelf-life"
    },
    {
      title: "Shelf-Life Testing & Validation",
      description: "Scientific methods to determine and validate shelf life for your products",
      icon: BookOpen,
      link: "#testing-validation",
      tooltip: "Learn about real-time studies, accelerated testing, water activity testing, pH testing, microbial testing, and sensory evaluation protocols.",
      category: "shelf-life"
    },
    {
      title: "PSS to Batch Sheet Template",
      description: "Convert your home recipe into a professional production specification sheet",
      icon: FileText,
      link: "https://docs.google.com/spreadsheets/d/your-batch-sheet-id/edit",
      tooltip: "Batch sheets ensure consistent production at scale by converting weights, temperatures, and timing into manufacturer-ready formats.",
      category: "formulation"
    },
    {
      title: "Shelf-Life Testing Guide",
      description: "Understand water activity, pH testing, and preservation strategies for product safety",
      icon: FileText,
      link: "https://docs.google.com/document/d/your-shelf-life-guide-id/edit",
      tooltip: "Shelf-life testing ensures your product remains safe and high-quality through distribution, storage, and consumption.",
      category: "shelf-life"
    },
    {
      title: "Packaging as a Strategic Superpower",
      description: "Learn how packaging design impacts shelf-life, compliance, and market positioning",
      icon: FileText,
      link: "https://docs.google.com/document/d/your-packaging-guide-id/edit",
      tooltip: "Strategic packaging protects your product, meets FDA requirements, and communicates your brand story effectively.",
      category: "packaging"
    },
    {
      title: "FDA Labeling Self-Assessment",
      description: "Comprehensive checklist for nutrition facts panels and regulatory compliance",
      icon: FileText,
      link: "https://docs.google.com/document/d/your-fda-assessment-id/edit",
      tooltip: "Proper labeling prevents costly recalls and ensures your product meets all FDA requirements before launch.",
      category: "packaging"
    },
    {
      title: "Interactive Walkthroughs",
      description: "Step-by-step guided tours through formulation and costing workflows",
      icon: Video,
      link: "#walkthroughs",
      tooltip: "Interactive guides help you understand each step of the manufacturing preparation process with real examples.",
      category: "getting-started"
    }
  ];

  return (
    <TooltipProvider>
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section with CTA */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Resources Library
          </h1>
          <p className="text-xl text-muted-foreground mt-4 max-w-2xl mx-auto">
            Your learning hub for scaling from recipe to factory production
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Access expert guides, templates, and frameworks used by successful food entrepreneurs
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {resources.filter((resource) => !shelfLifeTitles.includes(resource.title)).map((resource) => (
            <Card key={resource.title} className="premium-card hover:shadow-2xl transition-all duration-300 group">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-accent to-accent-light flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-md">
                    <resource.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl">{resource.title}</CardTitle>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground hover:text-accent cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>{resource.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <CardDescription className="mt-2">{resource.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {resource.isParent ? (
                  <div className="space-y-2">
                    {shelfLifeSubResources.map((subResource) => (
                      <a
                        key={subResource.title}
                        href={subResource.route}
                        className="block text-sm text-foreground hover:text-accent transition-colors py-2 px-3 rounded-md hover:bg-accent/10 border border-transparent hover:border-accent/30"
                      >
                        {subResource.title}
                      </a>
                    ))}
                  </div>
                ) : isPlaceholderLink(resource.link) ? (
                  <Button variant="outline" className="w-full" disabled>
                    Coming soon
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full group-hover:bg-accent/10 group-hover:border-accent/60" asChild>
                    <a href={resource.link} target="_blank" rel="noopener noreferrer">
                      View Resource
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="elevated-card mt-8">
          <CardHeader>
            <CardTitle>Need More Help?</CardTitle>
            <CardDescription>
              Visit our step-by-step guide inside each project section to understand what information manufacturers need.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Each section in your project workspace includes contextual help and tooltips to guide you through the process.
            </p>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
