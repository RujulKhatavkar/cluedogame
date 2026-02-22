import { createBrowserRouter } from "react-router";
import { Home } from "./pages/Home";
import { RoomSetup } from "./pages/RoomSetup";
import { WaitingRoom } from "./pages/WaitingRoom";
import { GameRoom } from "./pages/GameRoom";
import { NotFound } from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/setup",
    Component: RoomSetup,
  },
  {
    path: "/lobby/:roomCode",
    Component: WaitingRoom,
  },
  {
    path: "/game/:roomCode",
    Component: GameRoom,
  },
  {
    path: "*",
    Component: NotFound,
  },
]);