const express = require("express");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const BP_LIST_PATH = path.join(__dirname, "ranked.bplist");

// Serve static files (like index.html)
app.use(express.static("public"));

// Utility: fetch all ranked songs page by page (no 100 page limit here, but you can add one)
async function fetchAllRankedSongs() {
  let page = 1;
  const songs = [];

  while (true) {
    console.log(`Fetching page ${page} from ScoreSaber...`);
    const res = await fetch(`https://scoresaber.com/api/leaderboards?ranked=true&page=${page}`);
    if (!res.ok) {
      console.error(`Failed to fetch page ${page}: ${res.status} ${res.statusText}`);
      break;
    }
    const data = await res.json();

    if (!data.leaderboards || data.leaderboards.length === 0) {
      console.log("No more leaderboards found.");
      break;
    }

    songs.push(
      ...data.leaderboards.map(lb => ({
        hash: lb.songHash.toUpperCase(),
        songName: lb.songName,
        difficulties: []
      }))
    );

    page++;
    // Optional: safety break to avoid abuse, can remove or increase this
    if (page > 200) {
      console.log("Reached safety page limit 200, stopping fetch.");
      break;
    }
  }

  return songs;
}

// Generate playlist JSON string from songs array
function generateBplist(songs) {
  return JSON.stringify({
    playlistTitle: "ScoreSaber Ranked",
    playlistAuthor: "EvanBlokEnder",
    customData: {
      icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAACXBIWXMAAC4jAAAuIwF4pT92AAAJg0lEQVR4nO3dQWpTUQCG0TzJJoKB0CBuwInrcWFdjxN3IA2FSueOhefEgYgKJi+5z37nzB/8aULux82g0zzPGwCg5dXoAQDA7QkAAAgSAAAQJAAAIEgAAECQAACAIAEAAEECAACCBAAABAkAAAgSAAAQJAAAIEgAAECQAACAoO0lD0/TtNQOfnE87P2fZuBFeHh8clhcyTyff1S4AQCAIAEAAEECAACCBAAABAkAAAgSAAAQJAAAIAgAQAAQQIAAIIEAAAECQAACBIAABAkAAAgSAAAQJAAAIAgAQAAQQIAAIIEAAAECQAACBIAABAkAAAgSAAAQJAAAIAgAQAAQQIAAIIEAAAECQAACBIAABAkAAAgSAAAQJAAAIAgAQAAQQIAAIIEAAAECQAACBIAABAkAAAgSAAAQJAAAIAgAQAAQQIAAIIEAAAECQAACBIAABAkAAAgaHvJw8fDfl5qyNI+3n8ZPeEi09dvoycALOLzp7ejJ1zkzbvNas+6zWYznfugGwAACBIAABAkAAAgSAAAQJAAAIAgAQAAQQIAAIIEAAAECQAACBIAABAkAAAgSAAAQJAAAIAgAQAAQQIAAIIEAAAECQAACBIAABAkAAAgSAAAQJAAAIAgAQAAQQIAAIIEAAAECQAACBIAABAkAAAgSAAAQJAAAIAgAQAAQdM8z+c/PE0LTuFnx8P+/DcGYEUeHp8cFldyyRnuBgAAggQAAAQJAAAIEgAAECQAACBIAABAkAAAgCABAABBAgAAggQAAAQJAAAIEgAAECQAACBIAABAkAAAgCABAABBAgAAggQAAAQJAAAIEgAAECQAACBIAABAkAAAgCABAABBAgAAggQAAAQJAAAIEgAAECQAACBIAABAkAAAgCABAABBAgAAggQAAAQJAAAIEgAAECQAACBIAABAkAAAgCABAABBAgAAggQAAAQJAAAIEgAAECQAACBIAABAkAAAgCABAABBAgAAggQAAAQJAAAIEgAAECQAACBIAABAkAAAgCABAABBAgAAggQAAAQJAAAIEgAAECQAACBIAABAkAAAgCABAABBAgAAggQAAAQJAAAIEgAAECQAACBIAABA0DTP8+gNAMCNuQEAgCABAABBAgAAggQAAAQJAAAIEgAAECQAACBIAABAkAAAgCABAABBAgAAggQAAAQJAAAIEgAAEPQdRxFJ5MUsCjMAAAAASUVORK5CYII="
    },
    songs
  }, null, 2);
}

// Update playlist file on disk
async function updateBplist() {
  try {
    console.log("Updating ranked.bplist...");

    const songs = await fetchAllRankedSongs();
    const bplist = generateBplist(songs);
    fs.writeFileSync(BP_LIST_PATH, bplist);

    console.log(`ranked.bplist updated with ${songs.length} songs.`);
  } catch (error) {
    console.error("Error updating ranked.bplist:", error);
  }
}

// Serve the existing playlist file for download
app.get("/ranked.bplist", (req, res) => {
  if (fs.existsSync(BP_LIST_PATH)) {
    res.download(BP_LIST_PATH, "ranked.bplist");
  } else {
    res.status(503).send("Playlist not ready yet, please try again later.");
  }
});

// Admin-only manual refresh endpoint (simple token check, replace with your secret)
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "secret_admin_token";

// Simple rate limiting for admin refresh (one request per 5 minutes)
let lastRefreshTime = 0;

app.post("/admin/refresh", (req, res) => {
  const token = req.query.token;

  if (token !== ADMIN_TOKEN) {
    return res.status(403).send("Forbidden: invalid token");
  }

  const now = Date.now();
  if (now - lastRefreshTime < 5 * 60 * 1000) {
    return res.status(429).send("Too many requests: please wait before refreshing again.");
  }

  lastRefreshTime = now;

  updateBplist()
    .then(() => res.send("Playlist refreshed successfully."))
    .catch(err => {
      console.error("Admin refresh failed:", err);
      res.status(500).send("Failed to refresh playlist.");
    });
});

// Start the server and begin auto-updating playlist every 6 hours
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Initial update on start
  updateBplist();

  // Scheduled update every 6 hours
  setInterval(updateBplist, 6 * 60 * 60 * 1000);
});
