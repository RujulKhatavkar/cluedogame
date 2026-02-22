import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Crown, UserMinus, CheckCircle2, Circle } from "lucide-react";

interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
}

interface PlayerCardProps {
  player: Player;
  isCurrentPlayer?: boolean;
  showKickButton?: boolean;
  onKick?: () => void;
  showTurnIndicator?: boolean;
  isCurrentTurn?: boolean;
  lastAction?: string;
  showNotesIcon?: boolean;
}

const avatarMap: Record<string, string> = {
  detective: "🕵️",
  colonel: "🎖️",
  professor: "👨‍🏫",
  miss: "👩",
  mrs: "👵",
  mr: "🧔",
  doctor: "👨‍⚕️",
  reverend: "👴",
};

export function PlayerCard({
  player,
  isCurrentPlayer,
  showKickButton,
  onKick,
  showTurnIndicator,
  isCurrentTurn,
  lastAction,
  showNotesIcon,
}: PlayerCardProps) {
  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
        isCurrentTurn
          ? "bg-primary/10 border-primary/50 ring-2 ring-primary/20"
          : "bg-card/50 border-border/50"
      } ${isCurrentPlayer ? "ring-2 ring-gold/30" : ""}`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 ${
            player.isConnected
              ? "border-primary/50 bg-primary/5"
              : "border-muted bg-muted/20 opacity-50"
          }`}
        >
          {avatarMap[player.avatar] || "👤"}
        </div>

        {/* Player Info */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              {player.name}
              {isCurrentPlayer && " (You)"}
            </span>
            {player.isHost && (
              <Crown className="w-4 h-4 text-gold" title="Host" />
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <Badge
              variant={player.isConnected ? "default" : "secondary"}
              className={`text-xs ${
                player.isConnected
                  ? "bg-primary/20 text-primary border-primary/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {player.isConnected ? "Connected" : "Disconnected"}
            </Badge>

            {/* Ready Status */}
            {player.isReady ? (
              <Badge
                variant="default"
                className="text-xs bg-primary text-primary-foreground"
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Ready
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                <Circle className="w-3 h-3 mr-1" />
                Not Ready
              </Badge>
            )}
          </div>

          {/* Last Action (for game room) */}
          {lastAction && (
            <p className="text-xs text-muted-foreground">{lastAction}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {showTurnIndicator && isCurrentTurn && (
          <Badge className="bg-gold text-gold-foreground">
            {isCurrentPlayer ? "Your Turn" : "Turn"}
          </Badge>
        )}

        {showNotesIcon && (
          <Button variant="ghost" size="sm" title="View notes">
            📝
          </Button>
        )}

        {showKickButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onKick}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <UserMinus className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
