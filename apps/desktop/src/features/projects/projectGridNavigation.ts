export type ProjectGridDirection = "left" | "right" | "up" | "down";

export type ProjectGridCardRect = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

type ProjectGridCardCenter = ProjectGridCardRect & {
  centerX: number;
  centerY: number;
};

/**
 * Chooses the next project by visible card position instead of list order.
 *
 * @example nextProjectGridSelection(cards, selectedId, "down")
 */
export function nextProjectGridSelection(cards: ProjectGridCardRect[], selectedId: string, direction: ProjectGridDirection): string {
  const centeredCards = cards.map(withCenter);
  const current = centeredCards.find((card) => card.id === selectedId);
  if (!current) return selectedId;
  const candidates = centeredCards.filter((card) => isCandidate(current, card, direction));
  return nearestCard(current, candidates, direction)?.id ?? selectedId;
}

function withCenter(card: ProjectGridCardRect): ProjectGridCardCenter {
  return { ...card, centerX: card.left + card.width / 2, centerY: card.top + card.height / 2 };
}

function isCandidate(current: ProjectGridCardCenter, card: ProjectGridCardCenter, direction: ProjectGridDirection): boolean {
  if (card.id === current.id) return false;
  if (direction === "left") return card.centerX < current.centerX && isSameRow(current, card);
  if (direction === "right") return card.centerX > current.centerX && isSameRow(current, card);
  if (direction === "up") return card.centerY < current.centerY;
  return card.centerY > current.centerY;
}

function isSameRow(current: ProjectGridCardCenter, card: ProjectGridCardCenter): boolean {
  return Math.abs(card.centerY - current.centerY) < Math.min(current.height, card.height) / 2;
}

function nearestCard(current: ProjectGridCardCenter, candidates: ProjectGridCardCenter[], direction: ProjectGridDirection) {
  return [...candidates].sort((first, second) => score(current, first, direction) - score(current, second, direction))[0] ?? null;
}

function score(current: ProjectGridCardCenter, card: ProjectGridCardCenter, direction: ProjectGridDirection): number {
  const xDistance = Math.abs(card.centerX - current.centerX);
  const yDistance = Math.abs(card.centerY - current.centerY);
  return direction === "left" || direction === "right" ? xDistance : yDistance * 1000 + xDistance;
}
