# Deploying the game to Render and Vercel

The game can use Vercel for the static website and Render for its Node.js HTTP and WebSocket server. The existing `render.yaml` and `vercel.json` provide the build settings. Deploy both from the same Git repository.

## Render game server

1. In Render, create a Blueprint from this repository and select `render.yaml`.
2. Wait for the service to finish its first deploy. Copy its public URL, such as `https://pass-the-punch-server.onrender.com`.
3. Render's free instance has limited CPU and memory and may take time to wake after inactivity. It is suitable for trying the game, but it cannot promise low latency or uninterrupted matches. Its in-memory rooms are cleared by restarts and deploys.

## Vercel website

1. Import the same repository into Vercel. It will use `vercel.json` to build the Vite site into `dist`.
2. In the Vercel project settings, add `VITE_GAME_SERVER_URL` with the Render URL (without a trailing slash), for example `https://pass-the-punch-server.onrender.com`.
3. Redeploy after adding the variable. The browser converts the URL to a secure WebSocket URL and uses Render for room connections.

The Render-only option also works: it serves the built website and WebSocket server from the same URL, so `VITE_GAME_SERVER_URL` is not needed. Vercel's WebSocket function support is in public beta and function invocation limits and pricing apply; keep the persistent room server on Render for this setup. Check each provider's current plan terms before deployment: free plans can change, and Render may suspend a free service if account-level included usage is exceeded.

## Public play and direct peer networking

This setup keeps the current room-code game server authoritative. It does not yet create public rooms or send game state directly between browsers. That requires a separate WebRTC peer-hosting and signaling feature. A small signaling service is still needed to publish rooms and exchange connection details, and direct connections cannot be guaranteed across restrictive NATs without a TURN relay. Publicly listed rooms also need moderation and abuse controls before exposing them to strangers.
