import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { 
  Eye, 
  EyeOff, 
  X, 
  StickyNote,
  Check
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import { Textarea } from "../ui/textarea";

interface CardState {
  name: string;
  category: "suspect" | "weapon" | "room";
  selected: boolean;
  seen: boolean;
  notPossible: boolean;
  note: string;
}

interface CardTrackerRowProps {
  card: CardState;
  onUpdate: (updates: Partial<CardState>) => void;
}

export function CardTrackerRow({ card, onUpdate }: CardTrackerRowProps) {
  const [noteText, setNoteText] = useState(card.note);
  const [noteOpen, setNoteOpen] = useState(false);

  const handleSaveNote = () => {
    onUpdate({ note: noteText });
    setNoteOpen(false);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "suspect":
        return "text-primary";
      case "weapon":
        return "text-secondary";
      case "room":
        return "text-gold";
      default:
        return "";
    }
  };

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border transition-all hover:bg-muted/20 ${
        card.selected
          ? "bg-primary/5 border-primary/50"
          : card.seen
          ? "bg-primary/10 border-primary/30"
          : card.notPossible
          ? "bg-muted/30 border-border opacity-60"
          : "bg-card/30 border-border/50"
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Card Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`font-medium truncate ${getCategoryColor(
                card.category
              )}`}
            >
              {card.name}
            </span>
            {card.note && (
              <Badge variant="outline" className="text-xs">
                📝
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        {/* Select/Deselect */}
        <Button
          size="sm"
          variant={card.selected ? "default" : "ghost"}
          className={`h-8 px-2 ${
            card.selected ? "bg-primary text-primary-foreground" : ""
          }`}
          onClick={() => onUpdate({ selected: !card.selected })}
          title="Select/Deselect"
        >
          <Check className="w-4 h-4" />
        </Button>

        {/* Mark Seen */}
        <Button
          size="sm"
          variant={card.seen ? "default" : "ghost"}
          className={`h-8 px-2 ${
            card.seen ? "bg-primary/80 text-primary-foreground" : ""
          }`}
          onClick={() =>
            onUpdate({ seen: !card.seen, notPossible: false })
          }
          title="Mark as Seen"
        >
          <Eye className="w-4 h-4" />
        </Button>

        {/* Mark Not Possible */}
        <Button
          size="sm"
          variant={card.notPossible ? "default" : "ghost"}
          className={`h-8 px-2 ${
            card.notPossible ? "bg-muted text-muted-foreground" : ""
          }`}
          onClick={() =>
            onUpdate({ notPossible: !card.notPossible, seen: false })
          }
          title="Mark as Not Possible"
        >
          <EyeOff className="w-4 h-4" />
        </Button>

        {/* Add Note */}
        <Popover open={noteOpen} onOpenChange={setNoteOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant={card.note ? "default" : "ghost"}
              className={`h-8 px-2 ${
                card.note ? "bg-gold/20 text-gold" : ""
              }`}
              title="Add Note"
            >
              <StickyNote className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-3">
              <h4 className="font-semibold">Add Note</h4>
              <Textarea
                placeholder="Add notes about this card..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="min-h-[100px] bg-input-background"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveNote}
                  className="flex-1"
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNoteText(card.note);
                    setNoteOpen(false);
                  }}
                >
                  Cancel
                </Button>
                {card.note && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNoteText("");
                      onUpdate({ note: "" });
                      setNoteOpen(false);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
