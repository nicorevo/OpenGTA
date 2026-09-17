/**
 * Render-loop control for one game view (top-down or first-person). The
 * bootstrap adapts a Pixi Application to this interface (ticker stop/start,
 * one-shot render) so the switch logic stays free of Pixi imports.
 */
export interface ViewLoop {
  /** Whether the render loop is currently running. */
  readonly started: boolean;
  /** Stops the render loop: a hidden view performs 0 render calls at idle. */
  stop(): void;
  /** Resumes the render loop. */
  start(): void;
  /** Forces one immediate render pass of the current scene. */
  render(): void;
}

/**
 * Switches which view is alive: the app that is becoming hidden stops its
 * render loop, and the app that is becoming visible resumes with one
 * immediate render pass. The pass runs synchronously, before the browser
 * paints the just-visible canvas, so no stale or black frame is shown.
 */
export function switchView(hidden: ViewLoop, visible: ViewLoop): void {
  hidden.stop();
  visible.start();
  visible.render();
}
