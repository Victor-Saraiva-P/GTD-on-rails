import { createContext, useContext, type PropsWithChildren, createElement } from "react";
import type { TitleSearchState } from "./types";

const TitleSearchContext = createContext<TitleSearchState | null>(null);

/**
 * Hook to access the current list title search state.
 *
 * @example const search = useTitleSearchContext();
 */
export function useTitleSearchContext(): TitleSearchState | null {
  return useContext(TitleSearchContext);
}

type TitleSearchProviderProps = Readonly<PropsWithChildren<{
  value: TitleSearchState | null;
}>>;

/**
 * Supplies list title search state to descendant components.
 *
 * @example <TitleSearchProvider value={searchState}>{children}</TitleSearchProvider>
 */
export function TitleSearchProvider({ value, children }: TitleSearchProviderProps) {
  return createElement(TitleSearchContext.Provider, { value }, children);
}
