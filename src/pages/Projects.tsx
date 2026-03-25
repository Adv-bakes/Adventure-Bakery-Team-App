import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ProjectCard } from "@/components/ProjectCard";
import { toast } from "sonner";

interface Project {
  id: number;
  product_name: string;
  created_at: string;
  updated_at?: string;
  progress: number;
  pss_file_path?: string | null;
  pss_file_name?: string | null;
}

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Debug: Log the current user ID
      console.log("Current user ID:", user.id);
      console.log("Current user email:", user.email);

      // Load concepts with their readiness data
      const { data: concepts, error: conceptsError } = await supabase
        .from("concepts")
        .select("id, product_name, created_at, user_id, pss_file_path, pss_file_name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // Debug: Log the fetched concepts
      console.log("Fetched concepts:", concepts);

      if (conceptsError) throw conceptsError;

      // Load progress for all projects using the calculation function
      const projectsWithProgress = await Promise.all(
        (concepts || []).map(async (concept) => {
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
      setLoading(false);
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
      await loadProjects();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ color: '#2C1810' }}>
            All Projects
          </h1>
          <p className="text-muted-foreground mt-2" style={{ color: '#8B7355' }}>
            Manage all your product development projects
          </p>
        </div>
        <Button 
          onClick={() => navigate("/project/new")} 
          size="lg"
          className="bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white shadow-lg"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Project
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading projects...</div>
      ) : projects.length === 0 ? (
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
            <p className="text-muted-foreground mb-4 font-medium">No projects yet</p>
            <Button 
              onClick={() => navigate("/project/new")}
              className="bg-gradient-to-r from-[#C89B3C] to-[#D4A855] hover:from-[#B8892C] hover:to-[#C89B3C] text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Project
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
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
  );
}
