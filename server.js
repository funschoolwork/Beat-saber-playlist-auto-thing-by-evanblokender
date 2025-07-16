const express = require("express");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const BP_LIST_PATH = path.join(__dirname, "ranked.bplist");

// Serve static files from 'public' folder if needed
app.use(express.static("public"));

async function fetchRankedMaps() {
  let page = 1;
  const songs = [];

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

    songs.push(
      ...data.leaderboards.map(lb => ({
        hash: lb.songHash.toUpperCase(),
        songName: lb.songName,
        difficulties: []
      }))
    );

    page++;
  }

  return songs;
}

function generateBplist(songs) {
  return JSON.stringify({
    playlistTitle: "ScoreSaber Ranked",
    playlistAuthor: "EvanBlokEnder",
    customData: {
      icon: "data:image/png;base64,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"
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

app.use(express.static("public"));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  updateBplist(); // initial update on start
  setInterval(updateBplist, 6 * 60 * 60 * 1000); // update every 6 hours
});

// Fetch function reused here:
async function fetchRankedMaps() {
  let page = 1;
  const songs = [];

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

    songs.push(
      ...data.leaderboards.map(lb => ({
        hash: lb.songHash.toUpperCase(),
        songName: lb.songName,
        difficulties: []
      }))
    );

    page++;
    if (page > 100) break;
  }

  return songs;
}
