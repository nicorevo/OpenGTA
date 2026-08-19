import { bootstrap } from "./app/bootstrap.ts";

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("Application root was not found");
}

void bootstrap(root);
