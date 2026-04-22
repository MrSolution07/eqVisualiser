import { useCallback, useState, type RefObject } from "react";
import type { ProjectFileV1 } from "../core/ir";
import { exportProjectVideo } from "../export/webCodecsVideo";

type UseProjectVideoExportResult = {
  exporting: boolean;
  onExport: () => Promise<void>;
};

/**
 * Download path for timeline export: measures host, calls `exportProjectVideo`, triggers download.
 */
export function useProjectVideoExport(
  project: ProjectFileV1,
  hostRef: RefObject<HTMLDivElement | null>,
  exportDpr: number,
): UseProjectVideoExportResult {
  const [exporting, setExporting] = useState(false);

  const onExport = useCallback(async () => {
    setExporting(true);
    try {
      const host = hostRef.current;
      const w = host?.clientWidth ?? 1280;
      const h = host?.clientHeight ?? 720;
      const { blob, mime } = await exportProjectVideo(project, {
        width: w,
        height: h,
        dpr: exportDpr,
        fps: project.timeline.fps,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `eq-visualiser-export.${mime.includes("mp4") ? "mp4" : "webm"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [exportDpr, hostRef, project]);

  return { exporting, onExport };
}
