# ClueFinder — Multiplayer Deduction Game (Full Stack)

This is a merged project:
- **Frontend**: from *Multiplayer Deduction Game* (Vite + React + shadcn UI)
- **Backend**: rebuilt from *cluedogame-main*, upgraded with:
  - room naming
  - player naming + avatar
  - join by room code
  - lobby ready state + chat
  - host-only start
  - real-time gameplay (suggest/ask, show card, accuse, elimination, winner)

## Quick start (dev)

```bash
# from project root
npm install
npm run install:all
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3000

## How to play

1. One player creates a room (choose **room name**, **max players**, **private**).
2. Share the room code (or invite link) to friends.
3. Everyone joins, sets ready.
4. Host starts the game.
5. On your turn:
   - **Ask / Suggest**: pick a Suspect + Weapon + Room and optionally a target player.
   - **Accuse**: if you're sure; wrong accusation eliminates you.
6. When prompted, pick a matching card to show (only the asker sees which one).

## Production build

```bash
npm run install:all
npm --prefix client run build
NODE_ENV=production npm --prefix server start
```

The server will serve the built client from `client/dist`.
