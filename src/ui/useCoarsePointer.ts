import { useMediaQuery } from "./useMediaQuery";

export function useCoarsePointer(): boolean {
  return useMediaQuery("(pointer: coarse)");
}
