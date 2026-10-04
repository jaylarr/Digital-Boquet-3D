import type { BouquetConfigV1 } from './config';
import { stemBase } from './flowerArrangement';
import { OBJECT_FLOOR } from './giftCatalog';

/** Saved object heights are relative to the original floor, so old gifts keep their placements. */
export function bouquetGround(config: BouquetConfigV1) {
  return config.arrangement?.showStems && config.wrapper.id !== 'gift-bag' && (config.flowers.length || config.fillers.length)
    ? stemBase(config) - .02 : OBJECT_FLOOR;
}
export const objectGroundOffset = (ground: number) => ground - OBJECT_FLOOR;
