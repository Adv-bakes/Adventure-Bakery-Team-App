import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Lightbulb, PartyPopper } from "lucide-react";
import { ProjectCard } from "@/components/ProjectCard";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { toast } from "sonner";

interface Project {
  id: number;
  product_name: string;
  created_at: string;
  progress: number;
  pss_file_path?: string | null;
  pss_file_name?: string | null;
}

const motivationalQuotes = [
  "Each detail you define brings your product closer to the factory floor.",
  "Manufacturing excellence starts with thorough documentation.",
  "Every specification you complete is a step toward market success.",
  "Your attention to detail today becomes your competitive advantage tomorrow.",
  "Great products are built on great specifications.",
  "Professional manufacturing requires professional preparation.",
];

const Dashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "completed" | "inProgress">("all");
  const [currentQuote, setCurrentQuote] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationType, setCelebrationType] = useState<"25" | "50" | "75" | "100">("25");

  useEffect(() => {
    loadProjects();
    
    // Rotate motivational quotes every 8 seconds
    const quoteInterval = setInterval(() => {
      setCurrentQuote((prev) => (prev + 1) % motivationalQuotes.length);
    }, 8000);

    return () => clearInterval(quoteInterval);
  }, []);

  useEffect(() => {
    filterProjects();
  }, [projects, activeFilter]);

  const filterProjects = () => {
    if (activeFilter === "all") {
      setFilteredProjects(projects);
    } else if (activeFilter === "completed") {
      setFilteredProjects(projects.filter(p => p.progress === 100));
    } else if (activeFilter === "inProgress") {
      setFilteredProjects(projects.filter(p => p.progress > 0 && p.progress < 100));
    }
  };

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Debug: Log the current user ID
      console.log("Dashboard - Current user ID:", user.id);
      console.log("Dashboard - Current user email:", user.email);

      // Load concepts with their readiness data
      const { data: concepts, error: conceptsError } = await supabase
        .from("concepts")
        .select("id, product_name, created_at, user_id, pss_file_path, pss_file_name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(6);

      // Debug: Log the fetched concepts
      console.log("Dashboard - Fetched concepts:", concepts);

      if (conceptsError) throw conceptsError;

      // Load readiness data for all projects and calculate progress
      const projectsWithProgress = await Promise.all(
        (concepts || []).map(async (concept) => {
          // Call the progress calculation function
          const { data: progressData, error: progressError } = await (supabase as any)
            .rpc('calculate_project_progress', { project_concept_id: concept.id });

          if (progressError) {
            console.error("Error calculating progress:", progressError);
          }

          return {
            id: concept.id,
            product_name: concept.product_name,
            created_at: concept.created_at,
            progress: progressData || 0,
            pss_file_path: concept.pss_file_path,
            pss_file_name: concept.pss_file_name
          };
        })
      );

      setProjects(projectsWithProgress);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    try {
      const { error } = await supabase
        .from("concepts")
        .delete()
        .eq("id", projectId);

      if (error) throw error;

      toast.success("Project deleted successfully");
      // Reload projects
      await loadProjects();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const totalProjects = projects.length;
  const completedProjects = projects.filter(p => p.progress === 100).length;
  const inProgressProjects = projects.filter(p => p.progress > 0 && p.progress < 100).length;

  const handleFilterChange = (filter: "all" | "completed" | "inProgress") => {
    setActiveFilter(filter);
  };

  return (
    <div className="space-y-8" style={{ minHeight: '100vh' }}>
      {/* Celebration Modal */}
      <Dialog open={showCelebration} onOpenChange={setShowCelebration}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <PartyPopper className="h-6 w-6" style={{ color: '#C89B3C' }} />
              {celebrationType === "100" ? "Manufacturing Ready! 🎉" : `Great Job! ${celebrationType}% Complete!`}
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              {celebrationType === "100" ? (
                <p className="text-foreground font-semibold">
                  Congratulations! Your project is 100% complete and ready for manufacturing.
                  You can now generate your Product Specification Sheet (PSS).
                </p>
              ) : celebrationType === "75" ? (
                <p>Outstanding progress! You&apos;re almost there. Just a few more details to complete.</p>
              ) : celebrationType === "50" ? (
                <p>You&apos;re halfway there! Keep up the excellent work documenting your product.</p>
              ) : (
                <p>Great start! You&apos;re building a solid foundation for your product specification.</p>
              )}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ color: '#2C1810' }}>
            Your Workspace
          </h1>
          <p className="text-muted-foreground mt-1 font-medium" style={{ color: '#8B7355' }}>
            This is where your recipe becomes a real product.
          </p>
        </div>
        <Button 
          onClick={() => navigate("/project/new")} 
          size="lg"
          className="bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white shadow-lg"
        >
          <Plus className="h-5 w-5 mr-2" />
          Start New Project
        </Button>
      </div>

      {/* Motivational Quote Banner */}
      <div 
        className="rounded-lg p-4 transition-all duration-500"
        style={{
          background: 'linear-gradient(135deg, rgba(200, 155, 60, 0.08) 0%, rgba(245, 241, 230, 0.5) 100%)',
          border: '1px solid rgba(200, 155, 60, 0.2)'
        }}
      >
        <p 
          className="text-center text-sm font-medium italic transition-opacity duration-500"
          style={{ color: '#8B7355' }}
        >
          &quot;{motivationalQuotes[currentQuote]}&quot;
        </p>
      </div>

      {/* Metrics */}
      <DashboardMetrics
        total={totalProjects}
        completed={completedProjects}
        inProgress={inProgressProjects}
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
      />

      {/* Projects Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold" style={{ color: '#2C1810' }}>
            {activeFilter === "all" ? "Your Projects" : activeFilter === "completed" ? "Completed Projects" : "Projects In Progress"}
          </h2>
          {projects.length > 0 && (
            <Button 
              variant="ghost" 
              onClick={() => navigate("/projects")}
              style={{ color: '#C89B3C' }}
            >
              View All
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading projects...</div>
        ) : filteredProjects.length === 0 ? (
          <div 
            className="text-center py-16 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(245, 241, 230, 0.95) 0%, rgba(255, 253, 250, 0.95) 100%)',
              border: '2px dashed rgba(200, 155, 60, 0.3)'
            }}
          >
            <div className="max-w-md mx-auto">
              <div 
                className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(200, 155, 60, 0.15) 0%, rgba(200, 155, 60, 0.05) 100%)' }}
              >
                <Plus className="h-8 w-8" style={{ color: '#C89B3C' }} />
              </div>
              <p className="text-muted-foreground mb-4 font-medium">
                {activeFilter === "all" 
                  ? "No projects yet. Let's create your first product specification!"
                  : `No ${activeFilter === "completed" ? "completed" : "in-progress"} projects found.`}
              </p>
              <Button 
                onClick={() => activeFilter === "all" ? navigate("/project/new") : setActiveFilter("all")}
                className="bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                {activeFilter === "all" ? "Create Your First Project" : "Show All Projects"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                id={project.id}
                name={project.product_name}
                progress={project.progress}
                updatedAt={project.created_at}
                onDelete={handleDeleteProject}
                pssFilePath={project.pss_file_path}
                pssFileName={project.pss_file_name}
              />
            ))}
          </div>
        )}
      </div>

      {/* Learning Card - Removed, now replaced by floating AI Co-Pilot */}
    </div>
  );
};

export default Dashboard;
