export function scrollDetailPane(direction: 1 | -1): void {
  const detailPane = document.querySelector(".list-pane__body--detail");
  if (detailPane) {
    const scrollAmount = detailPane.clientHeight * 0.2;
    detailPane.scrollBy({ top: scrollAmount * direction, behavior: "auto" });
  }
}
