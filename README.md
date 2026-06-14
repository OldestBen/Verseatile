# Verseatile

Find and read lyrics for any artist — search their entire discography, browse by album, read individual songs, and download everything as a text file. Includes an interactive galaxy visualization of an artist's catalog.

---

## Table of contents

- [What it does](#what-it-does)
- [Prerequisites](#prerequisites)
- [Get a Genius API token](#get-a-genius-api-token)
- [Quick start (Docker — recommended)](#quick-start-docker--recommended)
  - [macOS](#macos)
  - [Windows](#windows)
  - [Linux](#linux)
- [Running without Docker](#running-without-docker)
- [Environment variables](#environment-variables)
- [Features](#features)
- [Pages and routes](#pages-and-routes)
- [Troubleshooting](#troubleshooting)

---

## What it does

1. **Search** for any artist by name.
2. **Browse** their full discography — every song, grouped by album.
3. **Read lyrics** for any song in a clean, readable view.
4. **Download all lyrics** for an artist as a single `.txt` file.
5. **Visualize** the discography as an interactive galaxy — albums as glowing nodes, songs as orbiting satellites.

---

## Prerequisites

You need two things before you start:

| Requirement | Why |
|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Runs the app in a container — no Node.js install needed |
| A free Genius API token | Lets the app search for artists and songs |

If you prefer not to use Docker, you also need [Node.js 20+](https://nodejs.org).

---

## Get a Genius API token

1. Go to [genius.com/api-clients](https://genius.com/api-clients) and sign in (create a free account if you don't have one).
2. Click **New API Client**.
3. Fill in the form — all four fields are shown but only two matter:

   | Field | What to enter |
   |---|---|
   | **APP NAME** | Anything you like, e.g. `Verseatile` |
   | **ICON URL** | Leave blank |
   | **APP WEBSITE URL** | `http://localhost` — must include `http://` or the form will reject it |
   | **REDIRECT URI** | Leave blank |

4. Click **Save**.
5. On the next page, click **Generate Access Token**.
6. Copy the long token string — you'll need it in the next step.

---

## Quick start (Docker — recommended)

### macOS

**Step 1 — Install Docker Desktop**

Download and install [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/).  
Open it and wait for the whale icon in the menu bar to stop animating (it's ready when it's still).

**Step 2 — Clone the repo**

Open Terminal (`Cmd + Space`, type `Terminal`):

```bash
git clone https://github.com/oldestben/verseatile.git
cd verseatile
```

**Step 3 — Add your Genius token**

```bash
cp .env.example .env
```

Open `.env` in any text editor and replace `your_token_here` with your actual token:

```
GENIUS_ACCESS_TOKEN=your_actual_token_goes_here
```

**Step 4 — Start the app**

```bash
docker compose up --build
```

The first run takes a few minutes to build. You'll see log lines streaming — when you see `Ready`, open your browser to:

```
http://localhost:3000
```

**To stop the app:** press `Ctrl + C` in Terminal.  
**To start again later** (no rebuild needed): `docker compose up`

---

### Windows

**Step 1 — Install Docker Desktop**

Download and install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).

During install, when asked about WSL 2, click **OK** to install it (Docker requires it on Windows).

Open Docker Desktop and wait for it to say **Engine running** in the bottom-left corner.

**Step 2 — Clone the repo**

Open **PowerShell** (`Win + X` → Windows PowerShell):

```powershell
git clone https://github.com/oldestben/verseatile.git
cd verseatile
```

If you don't have Git, install it from [git-scm.com](https://git-scm.com/download/win) first.

**Step 3 — Add your Genius token**

```powershell
copy .env.example .env
notepad .env
```

In Notepad, replace `your_token_here` with your actual token and save:

```
GENIUS_ACCESS_TOKEN=your_actual_token_goes_here
```

**Step 4 — Start the app**

```powershell
docker compose up --build
```

Wait for `Ready` to appear, then open:

```
http://localhost:3000
```

**To stop the app:** press `Ctrl + C` in PowerShell.

> **Windows Defender / Firewall:** If you get a firewall popup, click **Allow access**.

---

### Linux

**Step 1 — Install Docker**

Run these commands one at a time (Ubuntu/Debian):

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

Then **log out and log back in** so the group change takes effect.

For other distros, follow the [official Docker install guide](https://docs.docker.com/engine/install/).

**Step 2 — Clone the repo**

```bash
git clone https://github.com/oldestben/verseatile.git
cd verseatile
```

**Step 3 — Add your Genius token**

```bash
cp .env.example .env
nano .env
```

Replace `your_token_here` with your actual token:

```
GENIUS_ACCESS_TOKEN=your_actual_token_goes_here
```

Save and exit: `Ctrl + O`, `Enter`, `Ctrl + X`.

**Step 4 — Start the app**

```bash
docker compose up --build
```

Open your browser to:

```
http://localhost:3000
```

**To stop:** `Ctrl + C`.

---

## Running without Docker

If you'd rather run it directly with Node.js:

**Requirements:** Node.js 20 or higher — check with `node --version`.

```bash
# 1. Install dependencies
npm install

# 2. Create your .env file
cp .env.example .env
# Edit .env and add your Genius token

# 3. Run in development mode (with hot reload)
npm run dev

# — OR — build and run for production
npm run build
npm start
```

Open `http://localhost:3000`.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GENIUS_ACCESS_TOKEN` | Yes | Your Genius API access token. Get one at [genius.com/api-clients](https://genius.com/api-clients). |

The app will not start correctly without this token. If you see an error about a missing token, double-check your `.env` file is saved and the token has no extra spaces.

---

## Features

### Search
Type an artist name in the search bar on the home page. Results appear as a grid of artist cards — click any card to go to their discography.

### Discography page
Shows every song the artist has on Genius, grouped by album. Each song links to its lyrics page.

### Lyrics page
Displays the full lyrics in a clean, large-text format. Two buttons in the top-right:
- **Copy** — copies lyrics to clipboard
- **Download** — saves lyrics as a `.txt` file named after the song

### Download all lyrics
On an artist's discography page, the **Download All Lyrics** button fetches every song's lyrics one by one and packages them into a single `.txt` file. This takes time for artists with large catalogs — a counter shows progress.

### Galaxy visualization
Click **Visualize** on any artist page to open the galaxy view:
- Each album is a large glowing circle, sized by number of songs
- Songs are smaller dots orbiting their album
- Hover over any node to see its name
- Click a node to select it — the info panel at the bottom shows details
- Click **View Lyrics** from the bottom panel to open that song's lyrics

---

## Pages and routes

| URL | Description |
|---|---|
| `/` | Home — artist search |
| `/artist/[id]` | Full discography for an artist |
| `/song/[id]` | Lyrics for a single song |
| `/visualize/[id]` | Galaxy visualization of an artist's discography |

---

## Troubleshooting

**The page loads but search returns no results**

Your Genius API token is likely missing or wrong. Check your `.env` file:
- Make sure the file is named exactly `.env` (not `.env.txt` or `env`)
- Make sure the token has no quotes around it: `GENIUS_ACCESS_TOKEN=abc123` not `GENIUS_ACCESS_TOKEN="abc123"`
- After editing `.env`, restart the app: `Ctrl + C` then `docker compose up`

**`docker compose` says "command not found"**

On older Docker versions the command is `docker-compose` (with a hyphen):

```bash
docker-compose up --build
```

**Port 3000 is already in use**

Something else on your machine is using port 3000. Either stop that process, or change the port in `docker-compose.yml`:

```yaml
ports:
  - "3001:3000"   # change 3001 to any free port
```

Then open `http://localhost:3001` instead.

**The build is very slow or hangs**

The first build downloads Node.js and installs all dependencies — this is normal and takes 2–5 minutes depending on your internet connection. Subsequent starts with `docker compose up` (no `--build`) are near-instant.

**Lyrics show as blank or "Could not load lyrics"**

Genius occasionally restructures their pages, which can break the lyrics scraper. This affects individual songs, not the whole app. Try a different song to confirm — if all songs fail, open a GitHub issue.

**On Windows: "Docker Desktop requires WSL 2"**

Open PowerShell as Administrator and run:

```powershell
wsl --install
```

Then restart your computer and try again.

**On Linux: "permission denied" running docker**

You need to log out and back in after adding yourself to the `docker` group. If that doesn't work:

```bash
sudo docker compose up --build
```
