import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
  isOwnMessage: boolean;
}

export function ChatMessage({ message, isOwnMessage }: ChatMessageProps) {
  return (
    <div
      className={`flex flex-col gap-1 ${
        isOwnMessage ? "items-end" : "items-start"
      }`}
    >
      <div className="flex items-baseline gap-2">
        {!isOwnMessage && (
          <span className="text-xs font-semibold text-primary">
            {message.playerName}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(message.timestamp, { addSuffix: true })}
        </span>
      </div>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 ${
          isOwnMessage
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        <p className="text-sm">{message.text}</p>
      </div>
    </div>
  );
}
