import { usePersistenceInit } from "./persistence/usePersistenceInit";
import { useApplyTheme } from "./persistence/useApplyTheme";
import { useAutoSave } from "./persistence/useAutoSave";

export function PersistenceManager() {
  const initialized = usePersistenceInit();
  useApplyTheme();
  useAutoSave(initialized);

  return null;
}
