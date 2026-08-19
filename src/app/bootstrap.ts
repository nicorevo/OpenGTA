export function bootstrap(root: HTMLElement): void {
  const heading = document.createElement("h1");
  heading.textContent = "OpenGTA Web V0";
  root.replaceChildren(heading);
}
