import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { DetectiveBoard3D } from "../components/game/DetectiveBoard3D";
import {
  Copy,
  Check,
  Crown,
  Settings,
  Play,
  Send,
  Users,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PlayerCard } from "../components/game/PlayerCard";
import { ChatMessage } from "../components/game/ChatMessage";
import { ensureConnected } from "../lib/socket";

interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
  eliminated?: boolean;
}

interface LobbyPayload {
  room: {
    code: string;
    name: string;
    maxPlayers: number;
    isPrivate: boolean;
    hostId: string;
    started: boolean;
  };
  players: Player[];
}

interface Message {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: Date;
}

export function WaitingRoom() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [copied, setCopied] = useState(false);
  const [roomName, setRoomName] = useState(sessionStorage.getItem("roomName") || "");
  const [players, setPlayers] = useState<Player[]>([]);
  const [myPlayerId, setMyPlayerId] = useState(sessionStorage.getItem("playerId") || "");

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const displayName = sessionStorage.getItem("playerName") || "";
  const avatar = sessionStorage.getItem("playerAvatar") || "detective";

  useEffect(() => {
    if (!roomCode) return;
    if (!displayName.trim()) {
      navigate(`/setup?mode=join&code=${roomCode}`);
      return;
    }

    const socket = ensureConnected();

    const onJoined = (data: any) => {
      const pid = String(data.playerId || socket.id);
      setMyPlayerId(pid);
      sessionStorage.setItem("playerId", pid);
      sessionStorage.setItem("roomCode", String(data.roomCode || roomCode));
      sessionStorage.setItem("roomName", String(data.roomName || ""));
      setRoomName(String(data.roomName || roomName));

      // If host started already, jump to game
      if (data.started) {
        navigate(`/game/${String(data.roomCode || roomCode)}`);
      }
    };

    const onLobbyState = (payload: LobbyPayload) => {
      setRoomName(payload.room?.name || "");
      setPlayers(payload.players || []);

      if (payload.room?.started) {
        navigate(`/game/${payload.room.code}`);
      }

      const isHost = payload.room?.hostId === (myPlayerId || socket.id);
      sessionStorage.setItem("isHost", isHost ? "true" : "false");
    };

    const onChat = (msg: any) => {
      setMessages((prev) => [
        ...prev,
        {
          id: String(msg.id),
          playerId: String(msg.playerId),
          playerName: String(msg.playerName),
          text: String(msg.text),
          timestamp: new Date(msg.timestamp || Date.now()),
        },
      ]);
    };

    const onError = (err: any) => {
      toast.error(err?.message || "Something went wrong");
    };

    const onGameStarted = (data: any) => {
      navigate(`/game/${String(data.roomCode || roomCode)}`);
    };

    socket.off("room:joined").on("room:joined", onJoined);
    socket.off("lobby:state").on("lobby:state", onLobbyState);
    socket.off("lobby:chat").on("lobby:chat", onChat);
    socket.off("room:error").on("room:error", onError);
    socket.off("game:started").on("game:started", onGameStarted);

    // (re)join safely
    socket.emit("room:join", {
      roomCode: String(roomCode).toUpperCase(),
      playerName: displayName,
      playerAvatar: avatar,
    });

    return () => {
      socket.off("room:joined", onJoined);
      socket.off("lobby:state", onLobbyState);
      socket.off("lobby:chat", onChat);
      socket.off("room:error", onError);
      socket.off("game:started", onGameStarted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const currentPlayer = useMemo(() => {
    const id = myPlayerId || undefined;
    return players.find((p) => p.id === id) || null;
  }, [players, myPlayerId]);

  const isHost = useMemo(() => {
    return currentPlayer?.isHost || sessionStorage.getItem("isHost") === "true";
  }, [currentPlayer]);

  const readyCount = players.filter((p) => p.isReady).length;
  const canStartGame = players.length >= 3 && players.every((p) => p.isReady);

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    toast.success("Room code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyInviteLink = () => {
    const link = `${window.location.origin}/setup?mode=join&code=${roomCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied!");
  };

  const handleToggleReady = () => {
    if (!roomCode || !currentPlayer) return;
    const socket = ensureConnected();
    socket.emit("lobby:ready", {
      roomCode: String(roomCode).toUpperCase(),
      isReady: !currentPlayer.isReady,
    });
    toast.success(!currentPlayer.isReady ? "Marked as ready" : "Marked as not ready");
  };

  const handleStartGame = () => {
    if (!roomCode) return;
    const socket = ensureConnected();
    socket.emit("game:start", { roomCode: String(roomCode).toUpperCase() });
  };

  const handleSendMessage = () => {
    if (!roomCode) return;
    const text = newMessage.trim();
    if (!text) return;
    const socket = ensureConnected();
    socket.emit("lobby:chat", { roomCode: String(roomCode).toUpperCase(), text });
    setNewMessage("");
  };

  return (
    <div className="min-h-screen p-4 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto space-y-6 py-8">
        <Card className="p-6 bg-card/80 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold">Waiting Room</h1>
              <p className="text-sm text-muted-foreground">
                {roomName ? `Room: ${roomName}` : "Waiting for players to join and ready up"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-center px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground mb-1">Room Code</p>
                <p className="text-xl font-bold tracking-wider text-primary">{roomCode}</p>
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={handleCopyCode} variant="outline" size="sm">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button
                  onClick={handleCopyInviteLink}
                  variant="outline"
                  size="sm"
                  title="Copy invite link"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-6 bg-card/80 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Players ({players.length}/6)
                </h2>
                <Badge variant="outline" className="border-primary/50 text-primary">
                  {readyCount} Ready
                </Badge>
              </div>

              <div className="space-y-3">
                {players.map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    isCurrentPlayer={player.id === myPlayerId}
                    showKickButton={false}
                  />
                ))}
              </div>

              {players.length < 3 && (
                <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-sm text-muted-foreground">⚠️ Minimum 3 players required to start the game</p>
                </div>
              )}
            </Card>

            <Card className="p-6 bg-card/80 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold">Ready Status</h3>
                  <p className="text-sm text-muted-foreground">Toggle when you're ready to play</p>
                </div>
                <Switch
                  checked={!!currentPlayer?.isReady}
                  onCheckedChange={handleToggleReady}
                  className="data-[state=checked]:bg-primary"
                  disabled={!currentPlayer}
                />
              </div>
            </Card>

            {isHost && (
              <Card className="p-6 bg-secondary/10 border-secondary/20 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="w-5 h-5 text-gold" />
                  <h3 className="font-semibold">Host Controls</h3>
                </div>

                <div className="space-y-3">
                  <Button onClick={handleStartGame} disabled={!canStartGame} className="w-full" size="lg">
                    <Play className="w-4 h-4 mr-2" />
                    Start Game
                  </Button>

                  {!canStartGame && (
                    <p className="text-sm text-muted-foreground text-center">
                      {players.length < 3 ? "Need at least 3 players" : "All players must be ready"}
                    </p>
                  )}

                  <Button variant="outline" className="w-full" onClick={() => toast.info("Settings coming soon")}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Change Settings
                  </Button>
                </div>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="p-6 bg-card/80 backdrop-blur-sm h-[600px] flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <MessageCircle className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Chat</h3>
              </div>

              <Separator className="mb-4" />

              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      message={message}
                      isOwnMessage={message.playerId === myPlayerId}
                    />
                  ))}
                </div>
              </ScrollArea>

              <div className="mt-4 flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="bg-input-background"
                />
                <Button onClick={handleSendMessage} size="icon">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
