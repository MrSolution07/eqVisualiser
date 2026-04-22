import { useMediaQuery } from "./useMediaQuery";

const MOBILE_LAYOUT_QUERY = "(max-width: 768px)";

export function useIsMobileLayout(): boolean {
  return useMediaQuery(MOBILE_LAYOUT_QUERY);
}
