export const INSERT_BLOCK_ENTITY_EVENT = "gtd:insert-block-entity";

export type InsertBlockEntityEventDetail = {
  assetId: string;
  displayName: string;
  contentType: string;
  relativePath?: string;
  url?: string;
  image: boolean;
};
