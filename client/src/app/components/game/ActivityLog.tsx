import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { formatDistanceToNow } from "date-fns";

interface Activity {
  id: string;
  type: "ask" | "show" | "turn" | "game";
  playerName: string;
  description: string;
  timestamp: Date;
}

interface ActivityLogProps {
  activities: Activity[];
}

export function ActivityLog({ activities }: ActivityLogProps) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "ask":
        return "❓";
      case "show":
        return "🃏";
      case "turn":
        return "⏰";
      case "game":
        return "🎮";
      default:
        return "•";
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "ask":
        return "text-primary";
      case "show":
        return "text-secondary";
      case "turn":
        return "text-gold";
      default:
        return "text-foreground";
    }
  };

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3 pr-4">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No activity yet
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="p-3 rounded-lg bg-muted/30 space-y-1"
            >
              <div className="flex items-start gap-2">
                <span className="text-lg flex-shrink-0">
                  {getActivityIcon(activity.type)}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-sm font-semibold ${getActivityColor(
                        activity.type
                      )}`}
                    >
                      {activity.playerName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(activity.timestamp, {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">
                    {activity.description}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}
