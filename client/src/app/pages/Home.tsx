import { useNavigate } from "react-router";
import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { PlusCircle, LogIn, BookOpen, Users, Eye, Gavel } from "lucide-react";
import { RulesModal } from "../components/game/RulesModal";

export function Home() {
  const navigate = useNavigate();
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <main className="relative z-10 max-w-4xl w-full space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/20 mb-4">
            <Eye className="w-4 h-4 text-gold" />
            <span className="text-sm text-gold">Mystery Deduction Game</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Who<span className="text-primary">DunIt</span> 
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Uncover the truth through deduction. Work with clues, eliminate suspects, and solve the mystery before your opponents.
          </p>
        </div>

        {/* Main CTAs */}
        <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <Button
            size="lg"
            className="h-auto py-6 flex flex-col gap-2 bg-primary hover:bg-primary/90 hover:scale-105 transition-all"
            onClick={() => navigate("/setup?mode=create")}
          >
            <PlusCircle className="w-6 h-6" />
            <span className="text-lg">Create Room</span>
            <span className="text-xs text-primary-foreground/70">Host a new game</span>
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="h-auto py-6 flex flex-col gap-2 border-2 hover:bg-card/50 hover:scale-105 hover:border-primary/50 transition-all"
            onClick={() => navigate("/setup?mode=join")}
          >
            <LogIn className="w-6 h-6" />
            <span className="text-lg">Join Room</span>
            <span className="text-xs text-muted-foreground">Enter with room code</span>
          </Button>
        </div>

        {/* How it Works */}
        <Card className="p-8 bg-card/50 backdrop-blur-sm border-border/50">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold">1. Create or Join</h3>
              <p className="text-sm text-muted-foreground">
                Host creates a room with custom settings, or join an existing game with a room code.
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Eye className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold">2. Gather Clues</h3>
              <p className="text-sm text-muted-foreground">
                Ask other players about suspects, weapons, and rooms. Track what you learn.
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Gavel className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold">3. Solve the Mystery</h3>
              <p className="text-sm text-muted-foreground">
                Use deduction to eliminate possibilities and make your final accusation!
              </p>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <Button
            variant="link"
            className="text-muted-foreground hover:text-primary"
            onClick={() => setRulesOpen(true)}
          >
            View Complete Rules & Guide →
          </Button>
        </div>
      </main>

      {/* Footer note */}
      <footer className="relative z-10 mt-12 text-center text-sm text-muted-foreground">
        <p>Play with 3-6 players • Real-time multiplayer • Built for deduction enthusiasts</p>
      </footer>

      <RulesModal open={rulesOpen} onOpenChange={setRulesOpen} />
    </div>
  );
}