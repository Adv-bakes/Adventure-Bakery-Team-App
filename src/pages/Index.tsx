import React from "react";
import { CoachChat } from "@/components/CoachChat";

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">Welcome to Your Blank App</h1>
        <p className="text-xl text-muted-foreground">Start building your amazing project here!</p>
      </div>

      {/* AI Manufacturing Coach (floating orb on right side) */}
      <CoachChat progress={0} currentSection="Concept" />
    </div>
  );
};

export default Index;
