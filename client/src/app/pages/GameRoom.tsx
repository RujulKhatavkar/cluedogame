import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { PlayerCard } from "../components/game/PlayerCard";
import { CardTrackerRow } from "../components/game/CardTrackerRow";
import { PlayingCard } from "../components/game/PlayingCard";
import { ActivityLog } from "../components/game/ActivityLog";
import { GameTips } from "../components/game/GameTips";
import { Search, Filter, Users, Clock, MessageSquare, Trophy } from "lucide-react";
import { toast } from "sonner";
import { ensureConnected } from "../lib/socket";

// Game data (must match server)
const suspects = [
  "Miss Scarlet",
  "Colonel Mustard",
  "Mrs. White",
  "Mr. Green",
  "Mrs. Peacock",
  "Professor Plum",
];

const weapons = ["Candlestick", "Knife", "Lead Pipe", "Revolver", "Rope", "Wrench"];

const rooms = [
  "Kitchen",
  "Ballroom",
  "Conservatory",
  "Dining Room",
  "Billiard Room",
  "Library",
  "Lounge",
  "Hall",
  "Study",
];

interface CardState {
  name: string;
  category: "suspect" | "weapon" | "room";
  selected: boolean;
  seen: boolean;
  notPossible: boolean;
  note: string;
}

interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
  eliminated?: boolean;
}

interface Activity {
  id: string;
  type: "ask" | "show" | "turn" | "game";
  playerName: string;
  description: string;
  timestamp: Date;
}

type HandCard = { name: string; category: "suspect" | "weapon" | "room" };

type Assumption = { suspect: string; weapon: string; room: string };

function categorize(cardName: string): HandCard["category"] {
  if (suspects.includes(cardName)) return "suspect";
  if (weapons.includes(cardName)) return "weapon";
  return "room";
}

export function GameRoom() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [roomName, setRoomName] = useState(sessionStorage.getItem("roomName") || "");
  const [players, setPlayers] = useState<Player[]>([]);
  const [myPlayerId, setMyPlayerId] = useState(sessionStorage.getItem("playerId") || "");
  const [turnPlayerId, setTurnPlayerId] = useState<string>("");

  // Card tracking
  const [cards, setCards] = useState<CardState[]>(() => [
    ...suspects.map((name) => ({
      name,
      category: "suspect" as const,
      selected: false,
      seen: false,
      notPossible: false,
      note: "",
    })),
    ...weapons.map((name) => ({
      name,
      category: "weapon" as const,
      selected: false,
      seen: false,
      notPossible: false,
      note: "",
    })),
    ...rooms.map((name) => ({
      name,
      category: "room" as const,
      selected: false,
      seen: false,
      notPossible: false,
      note: "",
    })),
  ]);

  const [myHand, setMyHand] = useState<HandCard[]>([]);
  const myHandNamesRef = useRef<string[]>([]);
  const myIdRef = useRef<string>(sessionStorage.getItem("playerId") || "");

  // UI
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Actions
  const [askDialogOpen, setAskDialogOpen] = useState(false);
  const [accuseDialogOpen, setAccuseDialogOpen] = useState(false);

  const [targetPlayerId, setTargetPlayerId] = useState<string>("all");
  const [selectedSuspect, setSelectedSuspect] = useState("");
  const [selectedWeapon, setSelectedWeapon] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");

  // Show card prompt
  const [showCardDialogOpen, setShowCardDialogOpen] = useState(false);
  const [promptFrom, setPromptFrom] = useState<{ id: string; name: string } | null>(null);
  const [promptAssumption, setPromptAssumption] = useState<Assumption | null>(null);
  const [promptMatches, setPromptMatches] = useState<string[]>([]);

  // Winner
  const [winnerDialogOpen, setWinnerDialogOpen] = useState(false);
  const [winnerInfo, setWinnerInfo] = useState<{ name: string; solution: Assumption } | null>(null);

  // Activity log
  const [activities, setActivities] = useState<Activity[]>([]);

  const me = useMemo(() => players.find((p) => p.id === myPlayerId) || null, [players, myPlayerId]);
  const isSpectator = !!me?.eliminated;

  const isMyTurn = !!turnPlayerId && turnPlayerId === myPlayerId;

  const addActivity = (type: Activity["type"], playerName: string, description: string) => {
    setActivities((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type,
        playerName,
        description,
        timestamp: new Date(),
      },
      ...prev,
    ]);
  };

  useEffect(() => {
    if (!roomCode) return;

    const displayName = sessionStorage.getItem("playerName") || "";
    const avatar = sessionStorage.getItem("playerAvatar") || "detective";

    if (!displayName.trim()) {
      navigate(`/setup?mode=join&code=${roomCode}`);
      return;
    }

    const socket = ensureConnected();

    const onJoined = (data: any) => {
      const pid = String(data.playerId || socket.id);
      setMyPlayerId(pid);
      myIdRef.current = pid;
      sessionStorage.setItem("playerId", pid);
      sessionStorage.setItem("roomName", String(data.roomName || ""));
      setRoomName(String(data.roomName || ""));

      if (!data.started) {
        // If someone navigated to game before start
        toast.info("Game hasn't started yet. Redirecting to lobby...");
        navigate(`/lobby/${String(data.roomCode || roomCode)}`);
      }
    };

    const onPlayers = (payload: any) => {
      const rp = payload?.room;
      if (rp?.name) setRoomName(String(rp.name));
      if (Array.isArray(payload?.players)) setPlayers(payload.players);
    };

    const onHand = (data: any) => {
      const cardsArr: string[] = Array.isArray(data?.cards) ? data.cards : [];
      setMyHand(cardsArr.map((name) => ({ name, category: categorize(name) })));
      myHandNamesRef.current = cardsArr;
      addActivity("game", "System", "Cards dealt");
    };

    const onTurn = (data: any) => {
      setTurnPlayerId(String(data.turnPlayerId || ""));
      if (data.turnPlayerId === myIdRef.current || data.turnPlayerId === socket.id) {
        addActivity("turn", "System", "Your turn");
        toast.success("Your turn!");
      } else {
        addActivity("turn", "System", `Turn: ${String(data.turnPlayerName || "Player")}`);
      }
    };

    const onAssumption = (data: any) => {
      const fromName = String(data.fromPlayerName || "Player");
      const a = data.assumption as Assumption;
      const targetText = data.targetPlayerName ? ` (to ${String(data.targetPlayerName)})` : "";
      addActivity(
        "ask",
        fromName,
        `Suggested${targetText}: ${a?.suspect}, ${a?.weapon}, ${a?.room}`
      );
    };

    const onPrompt = (data: any) => {
      const fromId = String(data.fromPlayerId);
      const fromName = String(data.fromPlayerName || "Player");
      const a = data.assumption as Assumption;

      const myCards = myHandNamesRef.current;
      const matches = myCards.filter((c) => c === a.suspect || c === a.weapon || c === a.room);

      setPromptFrom({ id: fromId, name: fromName });
      setPromptAssumption(a);
      setPromptMatches(matches);

      if (matches.length === 0) {
        // Auto-skip
        addActivity("show", "System", `You had no matching cards for ${fromName}'s suggestion`);
        socket.emit("game:showCard", { roomCode: String(roomCode).toUpperCase(), cardName: null });
        toast.info("No matching cards — you passed.");
        return;
      }

      setShowCardDialogOpen(true);
    };

    const onCardShown = (data: any) => {
      const fromName = String(data.fromPlayerName || "No one");
      if (fromName === "No one") {
        addActivity("show", "System", "No one could show a card.");
      } else {
        addActivity("show", "System", `${fromName} showed a card.`);
      }
    };

    const onCardRevealed = (data: any) => {
      const fromName = String(data.fromPlayerName || "Player");
      const cardName = String(data.cardName || "");
      addActivity("show", "System", `${fromName} revealed: ${cardName}`);
      toast.success(`You saw: ${cardName}`);

      // Auto-mark it as seen in tracker
      setCards((prev) => prev.map((c) => (c.name === cardName ? { ...c, seen: true } : c)));
    };

    const onEliminated = (data: any) => {
      const name = String(data.playerName || "A player");
      addActivity("game", "System", `${name} was eliminated (wrong accusation).`);
      toast.error(`${name} was eliminated`);
    };

    const onWinner = (data: any) => {
      const name = String(data.playerName || "Winner");
      const sol = data.solution as Assumption;
      addActivity("game", "System", `${name} won the game!`);
      setWinnerInfo({ name, solution: sol });
      setWinnerDialogOpen(true);
    };

    const onInvalidShow = (data: any) => {
      toast.error(data?.message || "Invalid response");
    };

    const onRoomError = (err: any) => {
      toast.error(err?.message || "Something went wrong");
    };

    socket.off("room:joined").on("room:joined", onJoined);
    socket.off("game:players").on("game:players", onPlayers);
    socket.off("lobby:state").on("lobby:state", onPlayers); // also works
    socket.off("game:hand").on("game:hand", onHand);
    socket.off("game:turn").on("game:turn", onTurn);
    socket.off("game:assumption").on("game:assumption", onAssumption);
    socket.off("game:prompt").on("game:prompt", onPrompt);
    socket.off("game:cardShown").on("game:cardShown", onCardShown);
    socket.off("game:cardRevealed").on("game:cardRevealed", onCardRevealed);
    socket.off("game:eliminated").on("game:eliminated", onEliminated);
    socket.off("game:winner").on("game:winner", onWinner);
    socket.off("game:showCard:invalid").on("game:showCard:invalid", onInvalidShow);
    socket.off("room:error").on("room:error", onRoomError);

    // Join to ensure we receive state
    socket.emit("room:join", {
      roomCode: String(roomCode).toUpperCase(),
      playerName: displayName,
      playerAvatar: avatar,
    });

    addActivity("game", "System", "Connected to game room");

    return () => {
      socket.off("room:joined", onJoined);
      socket.off("game:players", onPlayers);
      socket.off("lobby:state", onPlayers);
      socket.off("game:hand", onHand);
      socket.off("game:turn", onTurn);
      socket.off("game:assumption", onAssumption);
      socket.off("game:prompt", onPrompt);
      socket.off("game:cardShown", onCardShown);
      socket.off("game:cardRevealed", onCardRevealed);
      socket.off("game:eliminated", onEliminated);
      socket.off("game:winner", onWinner);
      socket.off("game:showCard:invalid", onInvalidShow);
      socket.off("room:error", onRoomError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const matchesSearch = card.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === "all" || card.category === filterCategory;
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "unmarked" && !card.selected && !card.seen && !card.notPossible) ||
        (filterStatus === "seen" && card.seen) ||
        (filterStatus === "not-possible" && card.notPossible);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [cards, searchQuery, filterCategory, filterStatus]);

  const handleCardUpdate = (cardName: string, updates: Partial<CardState>) => {
    setCards((prev) => prev.map((card) => (card.name === cardName ? { ...card, ...updates } : card)));
  };

  const handleAsk = () => {
    if (!roomCode) return;
    if (!selectedSuspect || !selectedWeapon || !selectedRoom) {
      toast.error("Please select suspect, weapon, and room");
      return;
    }

    const socket = ensureConnected();

    const assumption: Assumption = {
      suspect: selectedSuspect,
      weapon: selectedWeapon,
      room: selectedRoom,
    };

    socket.emit("game:ask", {
      roomCode: String(roomCode).toUpperCase(),
      suspect: assumption.suspect,
      weapon: assumption.weapon,
      room: assumption.room,
      targetPlayerId: targetPlayerId !== "all" ? targetPlayerId : null,
    });

    addActivity("ask", me?.name || "You", `Suggested: ${assumption.suspect}, ${assumption.weapon}, ${assumption.room}`);

    toast.success("Suggestion sent!");
    setAskDialogOpen(false);

    setTargetPlayerId("all");
    setSelectedSuspect("");
    setSelectedWeapon("");
    setSelectedRoom("");
  };

  const handleShowCard = (cardName: string) => {
    if (!roomCode) return;
    const socket = ensureConnected();

    socket.emit("game:showCard", {
      roomCode: String(roomCode).toUpperCase(),
      cardName,
    });

    addActivity("show", me?.name || "You", `Showed a card to ${promptFrom?.name || "another player"}`);

    toast.success("Card shown (only the asker can see which card)");
    setShowCardDialogOpen(false);
    setPromptFrom(null);
    setPromptAssumption(null);
    setPromptMatches([]);
  };

  const handleAccuse = () => {
    if (!roomCode) return;
    if (!selectedSuspect || !selectedWeapon || !selectedRoom) {
      toast.error("Please select suspect, weapon, and room");
      return;
    }

    const socket = ensureConnected();
    socket.emit("game:accuse", {
      roomCode: String(roomCode).toUpperCase(),
      suspect: selectedSuspect,
      weapon: selectedWeapon,
      room: selectedRoom,
    });

    addActivity("game", me?.name || "You", `Made an accusation: ${selectedSuspect}, ${selectedWeapon}, ${selectedRoom}`);
    toast.info("Accusation submitted");

    setAccuseDialogOpen(false);
    setSelectedSuspect("");
    setSelectedWeapon("");
    setSelectedRoom("");
  };

  const currentTurnName = useMemo(() => {
    return players.find((p) => p.id === turnPlayerId)?.name || "...";
  }, [players, turnPlayerId]);

  return (
    <div className="min-h-screen p-2 md:p-4 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-[2000px] mx-auto space-y-4">
        <Card className="p-4 bg-card/80 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-center px-3 py-1 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground">Room</p>
                <p className="text-sm font-bold text-primary">{roomCode}</p>
                {roomName && <p className="text-xs text-muted-foreground">{roomName}</p>}
              </div>

              <div className="flex items-center gap-2">
                {isMyTurn ? (
                  <Badge className="bg-gold text-gold-foreground">
                    <Clock className="w-3 h-3 mr-1" />
                    Your Turn
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <Clock className="w-3 h-3 mr-1" />
                    Waiting for {currentTurnName}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/50">
                <Users className="w-3 h-3 mr-1" />
                {players.length} Players
              </Badge>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Players */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="p-4 bg-card/80 backdrop-blur-sm">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> Players
              </h3>
              <div className="space-y-3">
                {players.map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    isCurrentPlayer={player.id === myPlayerId}
                    showTurnIndicator
                    isCurrentTurn={player.id === turnPlayerId}
                    lastAction={player.eliminated ? "Eliminated" : undefined}
                    showNotesIcon
                  />
                ))}
              </div>
            </Card>

            <Card className="p-4 bg-card/80 backdrop-blur-sm">
              <h3 className="font-semibold mb-4">My Hand</h3>
              {myHand.length === 0 ? (
                <p className="text-sm text-muted-foreground">Waiting for cards...</p>
              ) : (
                <div className="space-y-2">
                  {myHand.map((card, index) => (
                    <PlayingCard key={index} card={card} />
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Tracker */}
          <div className="lg:col-span-6 space-y-4">
            <GameTips />

            <Card className="p-4 bg-card/80 backdrop-blur-sm">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Card Tracker</h2>
                  <Badge variant="outline">{cards.filter((c) => c.seen).length} Seen</Badge>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search cards..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-input-background"
                    />
                  </div>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-full sm:w-40 bg-input-background">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="suspect">Suspects</SelectItem>
                      <SelectItem value="weapon">Weapons</SelectItem>
                      <SelectItem value="room">Rooms</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full sm:w-40 bg-input-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="unmarked">Unmarked</SelectItem>
                      <SelectItem value="seen">Seen</SelectItem>
                      <SelectItem value="not-possible">Not Possible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <ScrollArea className="h-[600px]">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-2">SUSPECTS</h3>
                      <div className="space-y-1">
                        {filteredCards
                          .filter((c) => c.category === "suspect")
                          .map((card) => (
                            <CardTrackerRow
                              key={card.name}
                              card={card}
                              onUpdate={(updates) => handleCardUpdate(card.name, updates)}
                            />
                          ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-2">WEAPONS</h3>
                      <div className="space-y-1">
                        {filteredCards
                          .filter((c) => c.category === "weapon")
                          .map((card) => (
                            <CardTrackerRow
                              key={card.name}
                              card={card}
                              onUpdate={(updates) => handleCardUpdate(card.name, updates)}
                            />
                          ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-2">ROOMS</h3>
                      <div className="space-y-1">
                        {filteredCards
                          .filter((c) => c.category === "room")
                          .map((card) => (
                            <CardTrackerRow
                              key={card.name}
                              card={card}
                              onUpdate={(updates) => handleCardUpdate(card.name, updates)}
                            />
                          ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </Card>
          </div>

          {/* Actions & Activity */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="p-4 bg-card/80 backdrop-blur-sm">
              <h3 className="font-semibold mb-4">Actions</h3>
              <div className="space-y-2">
                <Button onClick={() => setAskDialogOpen(true)} disabled={!isMyTurn || isSpectator} className="w-full">
  Ask / Suggest
</Button>

<Button variant="outline" disabled={!isMyTurn || isSpectator} className="w-full" onClick={() => setAccuseDialogOpen(true)}>
  Make Accusation
</Button>
{isSpectator ? (
  <p className="text-xs text-muted-foreground mt-3">
    You are spectating (eliminated). You can still view updates, but cannot make moves.
  </p>
) : !isMyTurn ? (
  <p className="text-xs text-muted-foreground mt-3">You can only act on your turn.</p>
) : null}
              </div>
              {!isMyTurn && (
                <p className="text-xs text-muted-foreground mt-3">You can only act on your turn.</p>
              )}
            </Card>

            <Card className="p-4 bg-card/80 backdrop-blur-sm">
              <h3 className="font-semibold mb-4">Activity Log</h3>
              <ActivityLog activities={activities} />
            </Card>
          </div>
        </div>
      </div>

      {/* Ask dialog */}
      <Dialog open={askDialogOpen} onOpenChange={setAskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make a Suggestion</DialogTitle>
            <DialogDescription>
              Select one card from each category. Optionally choose a player to ask directly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Target Player (optional)</Label>
              <Select value={targetPlayerId} onValueChange={setTargetPlayerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Ask everyone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Ask everyone (default)</SelectItem>
                  {players
                    .filter((p) => p.id !== myPlayerId && !p.eliminated && p.isConnected)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Suspect</Label>
              <Select value={selectedSuspect} onValueChange={setSelectedSuspect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select suspect" />
                </SelectTrigger>
                <SelectContent>
                  {suspects.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Weapon</Label>
              <Select value={selectedWeapon} onValueChange={setSelectedWeapon}>
                <SelectTrigger>
                  <SelectValue placeholder="Select weapon" />
                </SelectTrigger>
                <SelectContent>
                  {weapons.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Room</Label>
              <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAskDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAsk}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accuse dialog */}
      <Dialog open={accuseDialogOpen} onOpenChange={setAccuseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Final Accusation</DialogTitle>
            <DialogDescription>
              If you're wrong, you're eliminated. If you're right, you win.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Suspect</Label>
              <Select value={selectedSuspect} onValueChange={setSelectedSuspect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select suspect" />
                </SelectTrigger>
                <SelectContent>
                  {suspects.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Weapon</Label>
              <Select value={selectedWeapon} onValueChange={setSelectedWeapon}>
                <SelectTrigger>
                  <SelectValue placeholder="Select weapon" />
                </SelectTrigger>
                <SelectContent>
                  {weapons.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Room</Label>
              <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAccuseDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleAccuse}>
              Accuse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show card dialog */}
      <Dialog open={showCardDialogOpen} onOpenChange={setShowCardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Show a Card</DialogTitle>
            <DialogDescription>
              {promptFrom?.name || "Someone"} is asking about {promptAssumption?.suspect}, {promptAssumption?.weapon}, {promptAssumption?.room}.
              Choose one matching card to reveal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">🔒 Only the asker will see which card you reveal.</p>

            {promptMatches.map((name) => (
              <Button
                key={name}
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => handleShowCard(name)}
              >
                <div className="text-left">
                  <div className="font-semibold">{name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{categorize(name)}</div>
                </div>
              </Button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCardDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Winner dialog */}
      <Dialog open={winnerDialogOpen} onOpenChange={setWinnerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-gold" />
              Game Over
            </DialogTitle>
            <DialogDescription>
              {winnerInfo ? `${winnerInfo.name} won the game!` : "We have a winner."}
            </DialogDescription>
          </DialogHeader>

          {winnerInfo && (
            <div className="mt-2 rounded-lg border border-border/50 bg-muted/20 p-4">
              <p className="font-semibold mb-2">Solution</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Suspect: {winnerInfo.solution.suspect}</li>
                <li>Weapon: {winnerInfo.solution.weapon}</li>
                <li>Room: {winnerInfo.solution.room}</li>
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                setWinnerDialogOpen(false);
                navigate("/");
              }}
            >
              Back to Home
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
