"use client";
import { useState } from "react";
import { saveIdea } from "@/lib/spark/draft";
const games = [
  { name: "BedWars", genre: "Team strategy", image: "290ed0caee58521cdbfd5eb01f7f6d2e", id: "6872265039", prompt: "Help me plan an original team-based base defense game with resource gathering." },
  { name: "Blade Ball", genre: "Arena action", image: "be150ba07c74cd57deb31791c2675323", id: "13772394625", prompt: "Help me design an original arena game built around timing and deflecting projectiles." },
  { name: "DOORS", genre: "Survival horror", image: "ee22e20e38a2496ec796168071deb670", id: "6516141723", prompt: "Help me plan an original cooperative horror game with randomized rooms and encounters." },
  { name: "Fisch", genre: "Explore & collect", image: "17ce753c4b1f087c5eda362c24457e25", id: "16732694052", prompt: "Help me plan an original fishing adventure with island exploration and a collection system." },
];
export default function GameInspiration() {
  const [selected, setSelected] = useState("");
  return <aside className="game-inspiration" aria-labelledby="inspiration-title">
    <p className="eyebrow">BIG WORLDS START WITH SMALL IDEAS</p>
    <h2 id="inspiration-title">Find your next <span>spark.</span></h2>
    <p>Inspired by the games you love. Built around your own imagination.</p>
    <div className="inspiration-grid">{games.map(game => <article className="inspiration-card" key={game.id}>
      <a href={"https://www.roblox.com/games/" + game.id} target="_blank" rel="noopener noreferrer" aria-label={"Explore " + game.name + " on Roblox (opens a new tab)"}>
        <img src={"https://tr.rbxcdn.com/180DAY-" + game.image + "/768/432/Image/Png/noFilter"} alt={game.name + " official game artwork"} width={768} height={432} loading="lazy" />
        <div className="game-caption"><small>{game.genre}</small><h3>{game.name} <span aria-hidden="true">↗</span></h3></div>
      </a>
      <button onClick={() => setSelected(saveIdea(game.prompt) ? game.name + " inspiration selected. Create your account to start with this idea." : "Your browser could not save the idea. Try allowing browser storage, then select it again.")}>Try {game.genre.toLowerCase()} <span aria-hidden="true">↗</span></button>
    </article>)}</div>
    <p className="inspiration-status" role="status">{selected || "Choose a genre to bring a starting idea into your workspace."}</p>
    <small className="inspiration-credit">Roblox inspiration. These games are made by their respective creators, independently of Spark.</small>
  </aside>;
}
