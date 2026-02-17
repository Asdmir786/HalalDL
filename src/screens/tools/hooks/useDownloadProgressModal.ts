import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { Tool } from "@/store/tools";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import type { DownloadProgress } from "../constants";

export interface ModalApi {
  beginTransferModal: (title: string, toolIds: string[], initialLogs?: string[]) => boolean;
  pushModalLog: (message: string) => void;
  setModalProgress: Dispatch<SetStateAction<number>>;
  setModalToolProgress: Dispatch<SetStateAction<Record<string, number>>>;
  setModalDone: Dispatch<SetStateAction<boolean>>;
  setModalCurrentStatus: Dispatch<SetStateAction<string>>;
  setModalError: Dispatch<SetStateAction<string | null>>;
  handleDismiss: () => void;
  transferLockRef: MutableRefObject<boolean>;
  isTransferActive: boolean;
}

export function useDownloadProgressModal(tools: Tool[]) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalProgress, setModalProgress] = useState(0);
  const [modalLogs, setModalLogs] = useState<string[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalDone, setModalDone] = useState(false);
  const [modalTitle, setModalTitle] = useState("Updating Tools");
  const [isTransferRunning, setIsTransferRunning] = useState(false);
  const [modalTargetToolIds, setModalTargetToolIds] = useState<string[]>([]);
  const [modalToolProgress, setModalToolProgress] = useState<Record<string, number>>({});
  const [modalCurrentToolId, setModalCurrentToolId] = useState<string | null>(null);
  const [modalCurrentStatus, setModalCurrentStatus] = useState("Preparing...");

  const isTransferActive = isTransferRunning && !modalDone && !modalError;
  const transferLockRef = useRef(false);
  const modalTargetToolIdsRef = useRef<string[]>([]);
  const modalLastLogRef = useRef<Record<string, { status: string; bucket: number }>>({});
  const modalClosedNoticeRef = useRef<{ done: boolean; error: string | null }>({
    done: false,
    error: null,
  });

  const toolNameById = useMemo(
    () => Object.fromEntries(tools.map((t) => [t.id, t.name])) as Record<string, string>,
    [tools]
  );

  useEffect(() => {
    modalTargetToolIdsRef.current = modalTargetToolIds;
  }, [modalTargetToolIds]);

  /* Release the transfer lock when the operation finishes or errors */
  useEffect(() => {
    if (transferLockRef.current && (modalDone || Boolean(modalError))) {
      transferLockRef.current = false;
    }
  }, [modalDone, modalError]);

  useEffect(() => {
    if (modalOpen) {
      modalClosedNoticeRef.current = { done: false, error: null };
      return;
    }

    if (modalError && modalClosedNoticeRef.current.error !== modalError) {
      toast.error(`Background update failed: ${modalError}`);
      modalClosedNoticeRef.current.error = modalError;
    }
  }, [modalOpen, modalError]);

  const resetModal = useCallback(() => {
    setIsTransferRunning(false);
    setModalProgress(0);
    setModalLogs([]);
    setModalError(null);
    setModalDone(false);
    setModalTargetToolIds([]);
    setModalToolProgress({});
    setModalCurrentToolId(null);
    setModalCurrentStatus("Preparing...");
    modalLastLogRef.current = {};
  }, []);

  const pushModalLog = useCallback((message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setModalLogs((prev) => {
      if (prev[prev.length - 1] === trimmed) return prev;
      return [...prev.slice(-79), trimmed];
    });
  }, []);

  const beginTransferModal = useCallback(
    (title: string, toolIds: string[], initialLogs: string[] = []): boolean => {
      if (transferLockRef.current) return false;
      transferLockRef.current = true;
      resetModal();
      setModalTitle(title);
      setModalTargetToolIds(toolIds);
      setModalToolProgress(
        Object.fromEntries(toolIds.map((id) => [id, 0])) as Record<string, number>
      );
      setModalCurrentToolId(toolIds[0] ?? null);
      setModalCurrentStatus("Preparing...");
      setModalLogs(initialLogs);
      setIsTransferRunning(true);
      setModalOpen(true);
      return true;
    },
    [resetModal]
  );

  const handleDismiss = useCallback(() => {
    setModalOpen(false);
    resetModal();
  }, [resetModal]);

  /* Listen to download-progress events */
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | null = null;

    void listen<DownloadProgress>("download-progress", (event) => {
      if (disposed) return;
      const toolId = event.payload.tool;
      const targets = modalTargetToolIdsRef.current;
      if (targets.length > 0 && !targets.includes(toolId)) return;

      const clamped = Math.max(0, Math.min(100, event.payload.percentage));
      const status = event.payload.status?.trim() || "Working...";

      setModalCurrentToolId(toolId);
      setModalCurrentStatus(status);

      setModalToolProgress((prev) => {
        const next = { ...prev, [toolId]: clamped };
        const effectiveTargets =
          targets.length > 0 ? targets : Object.keys(next);
        if (effectiveTargets.length > 0) {
          const total = effectiveTargets.reduce(
            (acc, id) => acc + (next[id] ?? 0),
            0
          );
          setModalProgress(total / effectiveTargets.length);
        } else {
          setModalProgress(clamped);
        }
        return next;
      });

      const bucket = Math.floor(clamped / 10) * 10;
      const last = modalLastLogRef.current[toolId];
      if (!(last && last.status === status && last.bucket === bucket)) {
        modalLastLogRef.current[toolId] = { status, bucket };
        pushModalLog(
          `[${toolNameById[toolId] ?? toolId}] ${status} (${Math.round(clamped)}%)`
        );
      }
    }).then((fn) => {
      if (disposed) {
        fn();
      } else {
        cleanup = fn;
      }
    });

    return () => {
      disposed = true;
      if (cleanup) cleanup();
    };
  }, [pushModalLog, toolNameById]);

  const isDownloading = isTransferActive;
  const modalCurrentToolName = modalCurrentToolId
    ? toolNameById[modalCurrentToolId] ?? modalCurrentToolId
    : null;
  const orderedModalToolIds =
    modalTargetToolIds.length > 0
      ? modalTargetToolIds
      : Object.keys(modalToolProgress);

  const modalApi: ModalApi = useMemo(
    () => ({
      beginTransferModal,
      pushModalLog,
      setModalProgress,
      setModalToolProgress,
      setModalDone,
      setModalCurrentStatus,
      setModalError,
      handleDismiss,
      transferLockRef,
      isTransferActive,
    }),
    [beginTransferModal, pushModalLog, handleDismiss, isTransferActive]
  );

  return {
    modalOpen,
    setModalOpen,
    modalProgress,
    modalLogs,
    modalError,
    modalDone,
    modalTitle,
    modalToolProgress,
    modalCurrentStatus,
    modalTargetToolIds,
    isTransferActive,
    isDownloading,
    modalCurrentToolName,
    orderedModalToolIds,
    toolNameById,
    handleDismiss,
    modalApi,
  };
}
