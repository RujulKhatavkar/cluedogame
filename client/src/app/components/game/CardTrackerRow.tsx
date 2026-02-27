import { useState } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Check, Eye, EyeOff, StickyNote, X, HelpCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CardState {
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

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<CardState["category"], string> = {
  suspect: "text-primary",
  weapon: "text-secondary",
  room: "text-gold",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CardTrackerRow({ card, onUpdate }: CardTrackerRowProps) {

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border transition-all hover:bg-muted/20 ${rowClass}`}
    >
      {/* Card name + note indicator */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={[
              "inline-flex items-center px-2 py-1 rounded-md border ring-2 text-sm font-semibold",
              CATEGORY_COLOR[card.category]       // bg/border/ring
            ].join(" ")}>
              {card.name}
            </span>
            {card.note && (
              <Badge variant="outline" className="text-xs shrink-0">
                📝
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}