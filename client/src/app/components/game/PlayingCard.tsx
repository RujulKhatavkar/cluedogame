import { Card } from "../ui/card";

interface PlayingCardProps {
  card: {
    name: string;
    category: string;
  };
}

export function PlayingCard({ card }: PlayingCardProps) {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case "suspect":
        return "from-primary/20 to-primary/5 border-primary/30";
      case "weapon":
        return "from-secondary/20 to-secondary/5 border-secondary/30";
      case "room":
        return "from-gold/20 to-gold/5 border-gold/30";
      default:
        return "from-card to-muted border-border";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "suspect":
        return "👤";
      case "weapon":
        return "🔪";
      case "room":
        return "🏠";
      default:
        return "🃏";
    }
  };

  return (
    <div
      className={`p-3 rounded-lg border-2 bg-gradient-to-br ${getCategoryColor(
        card.category
      )} hover:scale-105 transition-transform cursor-pointer`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{getCategoryIcon(card.category)}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{card.name}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {card.category}
          </p>
        </div>
      </div>
    </div>
  );
}
