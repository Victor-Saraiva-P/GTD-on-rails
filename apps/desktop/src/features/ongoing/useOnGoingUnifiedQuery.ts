import { useMemo } from "react";
import { useOnGoingNextActionsQuery } from "../next-actions/useOnGoingNextActionsQuery.ts";
import { useOnGoingCalendarsQuery } from "../calendar/useOnGoingCalendarsQuery.ts";
import { mergeAndSortOnGoingItems } from "./onGoingListOrdering.ts";
import type { OnGoingItemSelection } from "./combinedOnGoingState.ts";

export function useOnGoingUnifiedQuery() {
  const nextActionsQuery = useOnGoingNextActionsQuery();
  const calendarsQuery = useOnGoingCalendarsQuery();

  const items: OnGoingItemSelection[] = useMemo(() => {
    return mergeAndSortOnGoingItems(nextActionsQuery.items, calendarsQuery.items);
  }, [nextActionsQuery.items, calendarsQuery.items]);

  const isLoading = nextActionsQuery.isLoading || calendarsQuery.isLoading;
  const isUpdating = nextActionsQuery.isUpdating || calendarsQuery.isUpdating;
  const isDeleting = nextActionsQuery.isDeleting || calendarsQuery.isDeleting;

  // Show error if either query fails.
  const errorMessage = nextActionsQuery.errorMessage || calendarsQuery.errorMessage || null;

  const reload = () => {
    nextActionsQuery.reload();
    calendarsQuery.reload();
  };

  return {
    items,
    isLoading,
    isUpdating,
    isDeleting,
    errorMessage,
    reload,
    nextActionsActions: {
      markAsDone: nextActionsQuery.markAsDone,
      restoreSelected: nextActionsQuery.restoreStatus,
      deleteSelected: nextActionsQuery.deleteItem,
      updateBody: nextActionsQuery.updateBody,
      updateTitle: nextActionsQuery.updateTitle
    },
    calendarsActions: {
      markAsDone: calendarsQuery.markAsDone,
      restoreStatus: calendarsQuery.restoreStatus,
      deleteItem: calendarsQuery.deleteItem,
      updateBody: calendarsQuery.updateBody,
      updateTitle: calendarsQuery.updateTitle
    }
  };
}
