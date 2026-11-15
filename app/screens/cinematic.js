// Plays the cinematic scenes from assets/cinematics/ inside the app. Each scene is its own HTML file
// there (contract.html, sold.html, ...); the shared player in assets/cinematics/shared/ pulls a scene in.
//
//   const film = await openFilm(root)              a full-window 16:9 picture
//   const scene = await film.play("contract")      loads and starts a scene; scene.events sends "release" and "end"
//   await film.play("sold", { manual: true })      the page triggers the scene's moments: scene.send("stamp")
//   await film.close()

const BASE = "/assets/cinematics/shared/";
const FILES = ["player.js", "pixel-art.js"];
let loading = null;

function load() {
  if (loading) return loading;
  const css = document.createElement("link");
  css.rel = "stylesheet"; css.href = BASE + "cinematic.css";
  document.head.append(css);
  loading = FILES.reduce((ready, file) => ready.then(() => new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = BASE + file; s.onload = resolve; s.onerror = () => reject(new Error(`Could not load ${file}`));
    document.head.append(s);
  })), Promise.resolve());
  return loading;
}

export async function openFilm(root) {
  await load();
  const box = document.createElement("div");
  box.className = "cinematic";
  box.innerHTML = `<div class="cinematic-screen"></div>`;
  root.append(box);
  const film = window.Cinematic.film(box.querySelector(".cinematic-screen"));
  requestAnimationFrame(() => box.classList.add("on"));
  let current = null;
  return {
    box,
    // id is the file name without .html, e.g. "contract" or "projects/dryer-replacement"
    async play(id, opts) {
      await window.Cinematic.load(id);
      current?.pause(); current?.show(false);
      current = window.Cinematic.create(id.split("/").pop(), film, opts);
      current.show(); current.play();
      return current;
    },
    close() {
      box.classList.remove("on");
      return new Promise((r) => setTimeout(() => { box.remove(); r(); }, 600));
    },
  };
}
