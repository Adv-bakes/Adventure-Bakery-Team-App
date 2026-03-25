import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { Package, ArrowRight, Eye, Trash2, Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ProjectCardProps {
  id: number;
  name: string;
  progress: number;
  thumbnail?: string;
  updatedAt: string;
  currentSection?: string;
  onDelete: (id: number) => void;
  pssFilePath?: string | null;
  pssFileName?: string | null;
}

export function ProjectCard({ id, name, progress, thumbnail, updatedAt, currentSection, onDelete, pssFilePath, pssFileName }: ProjectCardProps) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPss = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!pssFilePath) return;

    setDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from('product-spec-sheets')
        .download(pssFilePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = pssFileName || 'product-spec-sheet';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("PSS downloaded!");
    } catch (error: any) {
      toast.error(`Download failed: ${error.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const getSectionName = () => {
    if (progress === 0) return "Getting Started";
    if (progress === 100) return "Complete";
    if (progress < 20) return "Concept";
    if (progress < 35) return "Ingredients";
    if (progress < 50) return "Formulation";
    if (progress < 65) return "Shelf-Life";
    if (progress < 80) return "Costing";
    return "Packaging";
  };

  return (
    <Card 
      className="premium-card group relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-6">
        <div className="flex gap-4 mb-4">
          {/* Thumbnail */}
          <div 
            className="w-20 h-20 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 bg-gradient-to-br from-accent/15 to-accent/5 shadow-inner"
          >
            {thumbnail ? (
              <img src={thumbnail} alt={name} className="w-full h-full object-cover rounded-lg" />
            ) : (
              <Package className="h-10 w-10 text-accent" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate mb-1 text-foreground group-hover:text-accent transition-colors">
              {name}
            </h3>
            <p className="text-sm text-muted-foreground">
              Updated {new Date(updatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">
              {getSectionName()}
            </span>
            <span className="font-bold text-accent">{progress}%</span>
          </div>
          <div className="relative">
            <Progress 
              value={progress} 
              className={cn(
                "h-3 rounded-full",
                progress >= 100 && "animate-[shimmer_2s_infinite]"
              )}
            />
          </div>
        </div>

        {/* PSS Badge */}
        {pssFilePath && (
          <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" />
            <span>PSS Attached</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs ml-auto"
              onClick={handleDownloadPss}
              disabled={downloading}
            >
              <Download className="h-3 w-3 mr-1" />
              {downloading ? "..." : "Download"}
            </Button>
          </div>
        )}

        {/* Hover Buttons */}
        <div 
          className={cn(
            "flex gap-2 transition-all duration-300",
            isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          )}
        >
          <Button
            onClick={() => navigate(`/project/${id}/concept`)}
            className="flex-1 bg-gradient-to-r from-accent to-accent-light hover:from-accent/90 hover:to-accent text-primary-foreground shadow-md"
          >
            Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <Button
            onClick={() => navigate(`/project/${id}`)}
            variant="outline"
            className="border-accent text-accent hover:bg-accent/10"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;{name}&quot;? This action cannot be undone and will remove all project data including formulas, costing, and packaging details.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Project
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Status Badge */}
        {progress === 100 && (
          <div 
            className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold text-primary-foreground bg-gradient-to-r from-accent to-accent-light shadow-md"
          >
            ✓ Complete
          </div>
        )}
      </CardContent>
    </Card>
  );
}
