# Host a friend game for free

The lowest-cost way to play online is to run the game on your own computer and give it a temporary public URL with a Cloudflare Quick Tunnel. You do not need to rent a server, buy a domain, open router ports, or create a Cloudflare account. Your computer and internet connection are the host, so the game is online only while both terminals stay open and the computer stays awake.

## 1. Install the required tools

This project requires Node.js 24.22.2 or later in the 24.x line. This computer has the official ZIP extracted to `%LOCALAPPDATA%\PassThePunch\node-v24.22.2-win-x64`. In each PowerShell window, activate it for that window with:

```powershell
$nodeRoot = Join-Path $env:LOCALAPPDATA 'PassThePunch\node-v24.22.2-win-x64'
$env:PATH = "$nodeRoot;$env:PATH"
node --version
```

It must show `v24.22.2` or a newer 24.x version. The downloaded `cloudflared.exe` is in your Downloads folder and can be run directly below. Alternatively, install `cloudflared` using Cloudflare's [official Windows download instructions](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/#windows). If you have WinGet, you can also install it with:

```powershell
winget install --exact --id Cloudflare.cloudflared
```

Open a new PowerShell window after installation and check that `cloudflared --version` works.

## 2. Start the game server

In PowerShell, go to the project folder and run:

```powershell
npm ci
npm run build
$env:NODE_ENV = 'production'
$env:PORT = '3100'
npm start
```

Port `3000` was already in use on this computer, so these commands use `3100`. Leave this PowerShell window running. The server should report that it is listening on port `3100`.

## 3. Give it a temporary public URL

Open a second PowerShell window and run:

```powershell
& "$env:USERPROFILE\Downloads\cloudflared.exe" tunnel --url http://localhost:3100
```

Cloudflare prints a URL ending in `trycloudflare.com`. Send that URL to your friends. They open it in a browser, choose **Online Multiplayer**, and create or join the same room using its room code. The game automatically uses a secure WebSocket connection through the HTTPS URL.

## 4. Finish the session

Keep both PowerShell windows open and keep the host computer awake. When you stop the `cloudflared` command, the public URL stops working. A new Quick Tunnel gets a new random URL, so share that new URL next time.

## Cost and limits

The hosting and tunnel cost is **₹0**: this uses your computer and existing internet connection instead of a rented server or paid domain. Cloudflare's base plan is free, and Quick Tunnels need no account or domain. Your normal internet and electricity still apply. There is no always-on hosting or uptime guarantee; the game stops when your computer, server process, or tunnel stops. Quick Tunnels allow up to 200 in-flight requests, and WebSockets, which this game uses for multiplayer, are supported.

Anyone who has the temporary URL can open the game, so only share it with your friends and stop the tunnel after playing. Quick Tunnel details and limitations are in [Cloudflare's documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
