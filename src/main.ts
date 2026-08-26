import { bootstrap } from "./app/bootstrap.ts";

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("Application root was not found");
}

void bootstrap(root).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "The world could not be loaded";
  const status = root.querySelector("p");
  if (status) status.textContent = `Errore caricamento mondo: ${message}`;
});
