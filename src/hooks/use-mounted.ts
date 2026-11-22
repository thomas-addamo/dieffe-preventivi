import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** true solo nel browser dopo l'idratazione (dati salvati in localStorage). */
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}
