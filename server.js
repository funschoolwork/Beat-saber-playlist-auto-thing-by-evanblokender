const express = require("express");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const BP_LIST_PATH = path.join(__dirname, "ranked.bplist");

app.use(express.static("public"));

async function fetchRankedMaps() {
  let page = 1;
  const songs = [];
  const seenHashes = new Set();

  while (true) {
    const res = await fetch(`https://scoresaber.com/api/leaderboards?ranked=true&page=${page}`);
    if (!res.ok) {
      console.error(`Failed to fetch page ${page}: ${res.status} ${res.statusText}`);
      break;
    }
    const data = await res.json();

    if (!data.leaderboards || data.leaderboards.length === 0) {
      break;
    }

    for (const lb of data.leaderboards) {
      const hash = lb.songHash.toUpperCase();
      if (!seenHashes.has(hash)) {
        songs.push({
          hash,
          songName: lb.songName,
          difficulties: []
        });
        seenHashes.add(hash);
      }
    }

    page++;
    // NO SAFETY LIMIT HERE, will continue until no more data
  }

  return songs;
}

function generateBplist(songs) {
  return JSON.stringify({
    playlistTitle: "ScoreSaber Ranked",
    playlistAuthor: "EvanBlokEnder",
    customData: {
      icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAACXBIWXMAAC4jAAAuIwF4pT92AAAJg0lEQVR4nO3dQWpTUQCG0TzJJoKB0CBuwInrcWFdjxN3IA2FSueOhefEgYgKJi+5z37nzB/8aULux82g0zzPGwCg5dXoAQDA7QkAAAgSAAAQJAAAIEgAAECQAACAIAEAAEECAACCBAAABAkAAAgSAAAQJAAAIEgAAECQAACAoO0lD0/TtNQOfnE87P2fZuBFeHh8clhcyTyff1S4AQCAIAEAAEECAACCBAAABAkAAAgSAAAQJAAAIEgAAECQAACAIAEAAEECAACCBAAABAkAAAgSAAAQJAAAIEgAAECQAACAIAEAAEECAACCBAAABAkAAAgSAAAQJAAAIEgAAECQAACAIAEAAEECAACCBAAABAkAAAgSAAAQtB094FqOh/08esMlPn86jp4AsIg37zb/9ffxw+PTNHrDNbgBAIAgAQAAQQIAAIIEAAAECQAACBIAABAkAAAgSAAAQJAAAIAgAQAAQQIAAIIEAAAECQAACBIAABAkAAAgSAAAQJAAAIAgAQAAQQIAAIIEAAAECQAACBIAABAkAA..."
    },
    songs
  }, null, 2);
}

async function updateBplist() {
  try {
    console.log("Updating ranked.bplist...");
    const songs = await fetchRankedMaps();
    const bplist = generateBplist(songs);
    fs.writeFileSync(BP_LIST_PATH, bplist);
    console.log(`ranked.bplist updated with ${songs.length} songs.`);
  } catch (error) {
    console.error("Error updating ranked.bplist:", error);
  }
}

app.get("/ranked.bplist", (req, res) => {
  res.download(BP_LIST_PATH, "ranked.bplist");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  updateBplist();
  setInterval(updateBplist, 6 * 60 * 60 * 1000);
});
