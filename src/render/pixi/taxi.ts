import { Sprite, type Texture } from "pixi.js";

export function createTaxiSprite(texture: Texture, length: number, width: number): Sprite {
  texture.source.scaleMode = "nearest";
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  const scale = Math.min(length / texture.width, width / texture.height);
  // The reference faces left; the vehicle controller drives toward +x.
  sprite.scale.set(-scale, scale);
  return sprite;
}
