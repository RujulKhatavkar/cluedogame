import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { Users, Target, Eye, Gavel, MessageSquare, CheckCircle } from "lucide-react";

interface RulesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RulesModal({ open, onOpenChange }: RulesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">How to Play ClueFinder</DialogTitle>
          <DialogDescription>
            A complete guide to solving the mystery
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Game Objective */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Game Objective</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Be the first to correctly deduce which Suspect, Weapon, and Room cards
                are in the secret envelope by eliminating possibilities through asking
                other players and tracking information.
              </p>
            </section>

            {/* Setup */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Game Setup</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>3-6 players join the room</li>
                <li>Three cards (one Suspect, one Weapon, one Room) are secretly placed in an envelope - this is the solution</li>
                <li>Remaining cards are dealt evenly to all players</li>
                <li>Players can only see their own cards</li>
              </ul>
            </section>

            {/* Gameplay */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Taking Your Turn</h3>
              </div>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/30">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="outline">1</Badge>
                    Ask/Suggest
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    On your turn, select one Suspect, one Weapon, and one Room card. 
                    Choose a player to ask if they have any of these cards.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/30">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="outline">2</Badge>
                    Show Card
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    If the asked player has one or more of the suggested cards, they must 
                    secretly show exactly ONE card to you. Only you will see which card they reveal.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/30">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="outline">3</Badge>
                    Track Information
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Use the Card Tracker to mark cards as "Seen" (you've seen them) or 
                    "Not Possible" (they can't be in the envelope). Add notes to remember 
                    who showed you what.
                  </p>
                </div>
              </div>
            </section>

            {/* Card Tracker */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Using the Card Tracker</h3>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 text-primary" />
                  <div>
                    <strong>Select:</strong> Highlight cards you're considering for your next question
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Eye className="w-4 h-4 mt-0.5 text-primary" />
                  <div>
                    <strong>Mark Seen:</strong> Cards that have been revealed to you (can't be in envelope)
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-xs">X</Badge>
                  <div>
                    <strong>Not Possible:</strong> Cards you've eliminated through deduction
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-base">📝</span>
                  <div>
                    <strong>Add Note:</strong> Remember which player showed you a card
                  </div>
                </div>
              </div>
            </section>

            {/* Winning */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Making an Accusation</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                When you're confident you know the solution, make your final accusation. 
                Select one Suspect, one Weapon, and one Room. If you're correct, you win! 
                If you're wrong, you're out of the game but can continue helping others by 
                showing cards when asked.
              </p>
              <div className="p-4 rounded-lg bg-gold/10 border border-gold/20">
                <p className="text-sm">
                  <strong className="text-gold">💡 Strategy Tip:</strong> Don't rush! 
                  Use the process of elimination. The last three unmarked cards (one from 
                  each category) are likely the solution.
                </p>
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
