import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Switch } from "../components/ui/switch";
import { getSessionId, persistIdentity } from "../lib/sessions";
import { DetectiveBoard3D } from "../components/game/DetectiveBoard3D";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { AvatarPicker } from "../components/game/AvatarPicker";
import { ArrowLeft, Copy, Check, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ensureConnected } from "../lib/socket";
// import { getSessionId } from "../lib/sessions";

export function RoomSetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialMode = searchParams.get("mode") || "create";
  const inviteCode = searchParams.get("code") || "";

  const [activeTab, setActiveTab] = useState<string>(initialMode);
  const [displayName, setDisplayName] = useState(sessionStorage.getItem("playerName") || "");
  const [selectedAvatar, setSelectedAvatar] = useState(sessionStorage.getItem("playerAvatar") || "detective");

  // Create
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("4");
  const [isPrivate, setIsPrivate] = useState(false);
  const [generatedRoomCode, setGeneratedRoomCode] = useState("");
  const [generatedRoomName, setGeneratedRoomName] = useState("");
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Join
  const [roomCode, setRoomCode] = useState(inviteCode);
  const [joinError, setJoinError] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    setActiveTab(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (inviteCode) {
      setRoomCode(inviteCode);
      setActiveTab("join");
    }
  }, [inviteCode]);

  const canCreate = useMemo(() => {
    return displayName.trim() && roomName.trim();
  }, [displayName, roomName]);

  const canJoin = useMemo(() => {
    return displayName.trim() && roomCode.trim();
  }, [displayName, roomCode]);

  const persistPlayer = (isHost: boolean, playerId?: string) => {
    sessionStorage.setItem("playerName", displayName.trim());
    sessionStorage.setItem("playerAvatar", selectedAvatar);
    sessionStorage.setItem("isHost", isHost ? "true" : "false");
    if (playerId) sessionStorage.setItem("playerId", playerId);
  };

  const handleCreateRoom = () => {
    if (!displayName.trim()) return toast.error("Please enter your display name");
    if (!roomName.trim()) return toast.error("Please enter a room name");

    const socket = ensureConnected();

    setIsCreating(true);

    // Avoid stacking listeners
    socket.off("room:created");
    socket.off("room:error");

    socket.once("room:created", (data: any) => {
      setIsCreating(false);
      setGeneratedRoomCode(String(data.roomCode || ""));
      setGeneratedRoomName(String(data.roomName || roomName));
      persistPlayer(true, String(data.playerId || socket.id));
      sessionStorage.setItem("roomCode", String(data.roomCode || ""));
      sessionStorage.setItem("roomName", String(data.roomName || roomName));
      toast.success("Room created successfully!");
    });

    socket.once("room:error", (err: any) => {
      setIsCreating(false);
      toast.error(err?.message || "Could not create room");
    });
persistIdentity(displayName.trim(), selectedAvatar);

    socket.emit("room:create", {
      roomName: roomName.trim(),
      maxPlayers: Number(maxPlayers),
      isPrivate,
      playerName: displayName.trim(),
      playerAvatar: selectedAvatar,
        sessionId: getSessionId()

    });
  };

  const handleCopyCode = () => {
    if (!generatedRoomCode) return;
    navigator.clipboard.writeText(generatedRoomCode);
    setCopied(true);
    toast.success("Room code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyInviteLink = () => {
    if (!generatedRoomCode) return;
    const link = `${window.location.origin}/setup?mode=join&code=${generatedRoomCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied!");
  };

  const handleJoinRoom = () => {
    if (!displayName.trim()) return toast.error("Please enter your display name");
    if (!roomCode.trim()) {
      setJoinError("Please enter a room code");
      return;
    }

    const socket = ensureConnected();

    setIsJoining(true);
    setJoinError("");

    socket.off("room:joined");
    socket.off("room:error");

    socket.once("room:joined", (data: any) => {
      setIsJoining(false);
      const code = String(data.roomCode || roomCode).toUpperCase();
      persistPlayer(false, String(data.playerId || socket.id));
      sessionStorage.setItem("roomCode", code);
      sessionStorage.setItem("roomName", String(data.roomName || ""));
      toast.success("Joined room successfully!");
      navigate(`/lobby/${code}`);
    });

    socket.once("room:error", (err: any) => {
      setIsJoining(false);
      const msg = err?.message || "Could not join room";
      setJoinError(msg);
      toast.error(msg);
        const normalized = roomCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

    socket.emit("room:join", {
      roomCode: normalized,
      playerName: displayName.trim(),
      playerAvatar: selectedAvatar,
      sessionId: getSessionId(),
    });
    });

persistIdentity(displayName.trim(), selectedAvatar);

socket.emit("room:join", {
  roomCode: inviteCode.toUpperCase(),
  playerName: displayName.trim(),
  playerAvatar: selectedAvatar,
  sessionId: getSessionId(),
});
  };

  const handleGoToLobby = () => {
    if (!generatedRoomCode) return;
    navigate(`/lobby/${generatedRoomCode}`);
  };

  return (
<div className="min-h-screen bg-background">
    <div className="mx-auto max-w-7xl px-6 py-10">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
        <div className="mb-10 text-center">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Who<span className="text-primary">DunIt</span>
          </h1>
      <p className="mt-1 text-sm md:text-base text-muted-foreground">
        Create a room, invite friends, and solve the mystery.
      </p>
    </div>
         <div className="grid grid-cols-1 lg:grid-cols-2 items-start">
        <div className="w-full -mt-20">

          <DetectiveBoard3D />
        </div>
        
        <div className="w-full">
        <Card className="p-6 md:p-8 bg-card/80 backdrop-blur-sm w-full mt-[20px]">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create Room</TabsTrigger>
              <TabsTrigger value="join">Join Room</TabsTrigger>
            </TabsList>

            <div className="mt-6 space-y-6">
              {/* Player identity (shared) */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Your Display Name</Label>
                  <Input
                    id="displayName"
                    placeholder="e.g., Detective Sagar"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="bg-input-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Choose an Avatar</Label>
                  <AvatarPicker selected={selectedAvatar} onSelect={setSelectedAvatar} />
                </div>
              </div>

              <TabsContent value="create" className="space-y-6 mt-0">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="roomName">Room Name</Label>
                    <Input
                      id="roomName"
                      placeholder="e.g., Midnight Mansion"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      className="bg-input-background"
                      disabled={!!generatedRoomCode}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Max Players</Label>
                      <Select value={maxPlayers} onValueChange={setMaxPlayers} disabled={!!generatedRoomCode}>
                        <SelectTrigger className="bg-input-background">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {["3", "4", "5", "6"].map((n) => (
                            <SelectItem key={n} value={n}>
                              {n} Players
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-end justify-between rounded-lg border border-border/50 p-3 bg-muted/20">
                      <div>
                        <Label>Private Room</Label>
                        <p className="text-xs text-muted-foreground">Invite-only</p>
                      </div>
                      <Switch checked={isPrivate} onCheckedChange={setIsPrivate} disabled={!!generatedRoomCode} />
                    </div>
                  </div>

                  {!generatedRoomCode ? (
                    <Button
                      size="lg"
                      className="w-full"
                      disabled={!canCreate || isCreating}
                      onClick={handleCreateRoom}
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Room"
                      )}
                    </Button>
                  ) : (
                    <Card className="p-4 bg-primary/5 border-primary/20">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Room Created</p>
                          <p className="text-xl font-bold tracking-wider text-primary">{generatedRoomCode}</p>
                          <p className="text-sm text-muted-foreground">{generatedRoomName}</p>
                        </div>
                        <Button variant="outline" size="icon" onClick={handleCopyCode}>
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>

                      <div className="mt-4 flex flex-col sm:flex-row gap-2">
                        <Button variant="outline" className="w-full" onClick={handleCopyInviteLink}>
                          Copy Invite Link
                        </Button>
                        <Button className="w-full" onClick={handleGoToLobby}>
                          Enter Lobby
                        </Button>
                      </div>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="join" className="space-y-6 mt-0">
                <div className="space-y-2">
                  <Label htmlFor="roomCode">Room Code</Label>
                  <Input
                    id="roomCode"
                    placeholder="e.g., A1B2C3"
                    value={roomCode}
                    onChange={(e) => {
                      setRoomCode(e.target.value.toUpperCase());
                      setJoinError("");
                    }}
                    className={`bg-input-background ${joinError ? "border-destructive" : ""}`}
                  />
                  {joinError && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4" />
                      <span>{joinError}</span>
                    </div>
                  )}
                </div>

                <Button size="lg" className="w-full" disabled={!canJoin || isJoining} onClick={handleJoinRoom}>
                  {isJoining ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    "Join Room"
                  )}
                </Button>

                <div className="text-xs text-muted-foreground">
                  Tip: if you received an invite link, the code should already be filled in.
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </Card>
        </div>
        </div>
      </div>
    // </div>
  );
}
