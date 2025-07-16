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
    if (page > 100) break; // safety limit
  }

  return songs;
}

function generateBplist(songs) {
  return JSON.stringify({
    playlistTitle: "ScoreSaber Ranked",
    playlistAuthor: "Auto Generator",
    customData: {},
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

// Serve the playlist file for download
app.get("/ranked.bplist", (req, res) => {
  res.download(BP_LIST_PATH, "ranked.bplist");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  updateBplist(); // initial update on startup
  setInterval(updateBplist, 6 * 60 * 60 * 1000); // update every 6 hours
});
