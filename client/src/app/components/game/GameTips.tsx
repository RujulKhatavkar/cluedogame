import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { X, Lightbulb } from "lucide-react";

const tips = [
  "💡 Mark cards you've seen as 'Seen' to eliminate them from the solution.",
  "🔍 Cards in your hand can't be in the solution - mark them as 'Seen'.",
  "⚡ Use the search and filters to quickly find specific cards.",
  "🎯 Make an accusation only when you're 100% certain!",
  "👥 Pay attention to what other players are asking about.",
];

export function GameTips() {
  const [dismissed, setDismissed] = useState(false);
  const [currentTip, setCurrentTip] = useState(0);

  useEffect(() => {
    // Check if tips have been dismissed before
    const tipsDismissed = localStorage.getItem("gameTipsDismissed");
    if (tipsDismissed === "true") {
      setDismissed(true);
    }
  }, []);

  useEffect(() => {
    if (!dismissed) {
      const interval = setInterval(() => {
        setCurrentTip((prev) => (prev + 1) % tips.length);
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("gameTipsDismissed", "true");
  };

  if (dismissed) return null;

  return (
    <Card className="p-4 bg-gold/5 border-gold/20 relative overflow-hidden">
      <div className="flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {tips[currentTip]}
          </p>
          <div className="flex items-center gap-1 mt-2">
            {tips.map((_, index) => (
              <div
                key={index}
                className={`h-1 rounded-full transition-all ${
                  index === currentTip
                    ? "w-6 bg-gold"
                    : "w-1.5 bg-gold/30"
                }`}
              />
            ))}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="flex-shrink-0 -mt-1 -mr-1"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
