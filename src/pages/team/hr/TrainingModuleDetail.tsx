import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, XCircle, Lightbulb, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  TRAINING_CATEGORY_LABELS,
  TrainingModule, TrainingAssignment, QuizQuestion,
  getAssignmentStatus,
  fetchModuleById, fetchAssignment, fetchQuizQuestions,
  scoreQuiz, submitQuizResult, markAssignmentComplete,
  getTrainingSlideUrl,
} from "@/lib/training";

const cardStyle = { background: "#FFFFFF", borderColor: "rgba(200,155,60,0.25)" };

export default function TrainingModuleDetail() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();

  const [module, setModule] = useState<TrainingModule | null>(null);
  const [assignment, setAssignment] = useState<TrainingAssignment | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [slideUrls, setSlideUrls] = useState<string[]>([]);

  const [quizStarted, setQuizStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [finalResult, setFinalResult] = useState<{ scorePct: number; passed: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!moduleId) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const [mod, quizQs] = await Promise.all([
        fetchModuleById(moduleId),
        fetchQuizQuestions(moduleId),
      ]);
      setModule(mod);
      setQuestions(quizQs);
      if (mod?.content?.slides && Array.isArray(mod.content.slides)) {
        const urls = await Promise.all(
          mod.content.slides.map((path: string) => getTrainingSlideUrl(path))
        );
        setSlideUrls(urls);
      } else {
        setSlideUrls([]);
      }
      if (user && mod) {
        const a = await fetchAssignment(user.id, mod.id);
        setAssignment(a);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load training module");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [moduleId]);

  const status = getAssignmentStatus(assignment ?? undefined);

  const startQuiz = () => {
    setCurrentIndex(0);
    setSelected(null);
    setRevealed(false);
    setShowHint(false);
    setAnswers([]);
    setFinalResult(null);
    setQuizStarted(true);
  };

  const selectOption = (idx: number) => {
    if (revealed) return;
    setSelected(idx);
  };

  const checkAnswer = () => {
    if (selected === null) return;
    setRevealed(true);
  };

  const nextQuestion = async () => {
    if (selected === null) return;
    const nextAnswers = [...answers, selected];
    setAnswers(nextAnswers);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
      setSelected(null);
      setRevealed(false);
      setShowHint(false);
      return;
    }

    // Last question — score and submit
    if (!assignment || !module) return;
    const result = scoreQuiz(questions, nextAnswers, module.passing_score_pct, module.is_critical);
    setSubmitting(true);
    try {
      await submitQuizResult(assignment, result, assignment.recurrence_months);
      setFinalResult(result);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkComplete = async () => {
    if (!assignment) return;
    setSubmitting(true);
    try {
      await markAssignmentComplete(assignment);
      toast.success("Training marked complete & signed");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center" style={{ color: "#F5F1E6" }}>Loading...</div>;
  }

  if (!module) {
    return (
      <div className="space-y-4">
        <Card className="p-8 text-center border" style={cardStyle}>
          <p className="text-[#2A1F0E]/50 text-sm">Training module not found.</p>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link to="/team/hr/trainings" className="inline-flex items-center gap-1 text-sm mb-2" style={{ color: "rgba(245,241,230,0.6)" }}>
          <ArrowLeft className="w-3.5 h-3.5" />Back to Training & SOPs
        </Link>
        <h1 className="text-3xl font-bold" style={{ color: "#F5F1E6" }}>
          {module.module_number} — {module.title}
        </h1>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline" style={{ color: "#F5F1E6", borderColor: "rgba(245,241,230,0.3)" }}>
            {TRAINING_CATEGORY_LABELS[module.training_category]}
          </Badge>
          {module.is_annual_refresher && (
            <Badge className="bg-[#C89B3C]/15 text-[#C89B3C] border-[#C89B3C]/30">Annual Refresher</Badge>
          )}
          {module.is_critical && (
            <Badge className="bg-red-500/15 text-red-400 border-red-500/30">Critical — 100% required</Badge>
          )}
        </div>
      </div>

      {!assignment && (
        <Card className="p-4 border" style={cardStyle}>
          <p className="text-sm text-[#2A1F0E]/60">No assignment found for your account for this module.</p>
        </Card>
      )}

      {assignment && status === "completed" && !quizStarted && (
        <Card className="p-4 border" style={cardStyle}>
          <div className="flex items-center gap-2 text-green-700 mb-2">
            <CheckCircle2 className="w-5 h-5" />
            <h3 className="font-semibold">Completed</h3>
          </div>
          <div className="text-sm text-[#2A1F0E]/70 space-y-1">
            <p>Completed: {assignment.completed_at ? new Date(assignment.completed_at).toLocaleString() : "—"}</p>
            {assignment.quiz_passed_at && (
              <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Quiz passed: {new Date(assignment.quiz_passed_at).toLocaleString()} ({assignment.quiz_score}%)</p>
            )}
            {assignment.expires_at && <p>Renewal due: {assignment.expires_at}</p>}
          </div>
        </Card>
      )}

      {/* Content viewer */}
      {!quizStarted && (
        <Card className="p-4 border" style={cardStyle}>
          <h3 className="font-semibold text-[#2A1F0E] mb-2">Module Content</h3>
          {slideUrls.length > 0 ? (
            <div className="space-y-3">
              {slideUrls.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Slide ${idx + 1}`}
                  className="w-full rounded-md border border-black/10"
                />
              ))}
            </div>
          ) : module.content ? (
            <pre className="whitespace-pre-wrap rounded-md border border-black/10 bg-black/5 p-3 text-xs text-[#2A1F0E]">
              {JSON.stringify(module.content, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-[#2A1F0E]/50">No content uploaded yet for this module.</p>
          )}
        </Card>
      )}

      {/* Quiz entry / fallback */}
      {assignment && !quizStarted && status !== "completed" && (
        <Card className="p-4 border" style={cardStyle}>
          {questions.length > 0 ? (
            <>
              <h3 className="font-semibold text-[#2A1F0E] mb-1">Quiz</h3>
              <p className="text-sm text-[#2A1F0E]/60 mb-3">
                {questions.length} question{questions.length !== 1 ? "s" : ""} · multiple choice ·
                {" "}{module.is_critical ? "100% required" : `${module.passing_score_pct}% to pass`}
                {assignment.quiz_attempts > 0 && ` · ${assignment.quiz_attempts} attempt${assignment.quiz_attempts !== 1 ? "s" : ""} so far`}
              </p>
              <Button onClick={startQuiz} className="bg-[#C89B3C] hover:bg-[#B8892C]">
                {assignment.quiz_attempts > 0 ? "Retake Quiz" : "Begin Quiz"}
              </Button>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-[#2A1F0E] mb-1">Quiz not yet available</h3>
              <p className="text-sm text-[#2A1F0E]/60 mb-3">
                Review the content above. Once you've reviewed it, mark this training complete & sign.
              </p>
              <Button onClick={handleMarkComplete} disabled={submitting} className="bg-[#C89B3C] hover:bg-[#B8892C]">
                Mark Complete & Sign
              </Button>
            </>
          )}
        </Card>
      )}

      {/* Quiz in progress */}
      {quizStarted && !finalResult && currentQuestion && (
        <Card className="p-5 border" style={cardStyle}>
          <p className="text-xs text-[#2A1F0E]/50 mb-2">
            Question {currentIndex + 1} of {questions.length}
          </p>
          <h3 className="font-semibold text-[#2A1F0E] text-lg mb-4">{currentQuestion.question_text}</h3>

          <div className="space-y-2">
            {currentQuestion.options.map((opt, idx) => {
              const isCorrect = idx === currentQuestion.correct_option_index;
              const isSelected = idx === selected;
              let style = "border-[#2A1F0E]/15 hover:bg-[#C89B3C]/5";
              if (revealed) {
                if (isCorrect) style = "border-green-500 bg-green-500/10";
                else if (isSelected) style = "border-red-500 bg-red-500/10";
              } else if (isSelected) {
                style = "border-[#C89B3C] bg-[#C89B3C]/10";
              }
              return (
                <button
                  key={idx}
                  onClick={() => selectOption(idx)}
                  disabled={revealed}
                  className={`w-full text-left px-4 py-2.5 rounded-md border text-sm text-[#2A1F0E] transition-colors ${style}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{opt}</span>
                    {revealed && isCorrect && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
                    {revealed && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>

          {currentQuestion.hint && !revealed && (
            <div className="mt-3">
              {showHint ? (
                <p className="text-xs text-[#2A1F0E]/60 flex items-start gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 mt-0.5 text-[#C89B3C]" />{currentQuestion.hint}
                </p>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setShowHint(true)} className="text-[#C89B3C]">
                  <Lightbulb className="w-3.5 h-3.5 mr-1" />Show Hint
                </Button>
              )}
            </div>
          )}

          {revealed && (
            <div className="mt-3 space-y-1.5">
              <p className={`text-sm font-medium ${selected === currentQuestion.correct_option_index ? "text-green-700" : "text-red-700"}`}>
                {selected === currentQuestion.correct_option_index ? "Correct!" : `Incorrect. The correct answer is: ${currentQuestion.options[currentQuestion.correct_option_index]}`}
              </p>
              {currentQuestion.rationale && (
                <p className="text-sm text-[#2A1F0E]/70">{currentQuestion.rationale}</p>
              )}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            {!revealed ? (
              <Button onClick={checkAnswer} disabled={selected === null} className="bg-[#C89B3C] hover:bg-[#B8892C]">
                Check Answer
              </Button>
            ) : (
              <Button onClick={nextQuestion} disabled={submitting} className="bg-[#C89B3C] hover:bg-[#B8892C]">
                {currentIndex + 1 < questions.length ? "Next Question" : "See Results"}
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Quiz result */}
      {finalResult && (
        <Card className="p-5 border" style={cardStyle}>
          <div className={`flex items-center gap-2 mb-2 ${finalResult.passed ? "text-green-700" : "text-red-700"}`}>
            {finalResult.passed ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            <h3 className="font-semibold text-lg">{finalResult.passed ? "Passed!" : "Not Passed"}</h3>
          </div>
          <p className="text-sm text-[#2A1F0E]/70 mb-4">
            Score: {finalResult.scorePct}% · {module.is_critical ? "100% required (critical module)" : `${module.passing_score_pct}% required`}
          </p>
          {finalResult.passed ? (
            <p className="text-sm text-[#2A1F0E]/70">
              Training marked complete and signed.
              {assignment?.expires_at && ` Renewal due ${assignment.expires_at}.`}
            </p>
          ) : (
            <Button onClick={startQuiz} className="bg-[#C89B3C] hover:bg-[#B8892C]">Retry Quiz</Button>
          )}
          <div className="mt-4">
            <Button variant="outline" onClick={() => navigate("/team/hr/trainings")}>Back to Training & SOPs</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
