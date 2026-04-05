export type ImportStage = "review" | "importing" | "confirm-delete" | "deleting" | "done";

export interface ImportProgress {
  current: number;
  total: number;
  currentFile: string;
}

interface ImportDialogProps {
  stage: ImportStage;
  photoCount: number;
  deleteAfterImport: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  progress: ImportProgress | null;
}

export function ImportDialog({
  stage,
  photoCount,
  deleteAfterImport,
  onConfirm,
  onCancel,
  progress,
}: ImportDialogProps) {
  return (
    <div className="dialog-overlay">
      <div className="dialog">
        {stage === "importing" && progress && (
          <>
            <h3>Importing photos...</h3>
            <p className="dialog-progress-file">{progress.currentFile}</p>
            <div className="dialog-progress-bar">
              <div
                className="dialog-progress-fill"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <p className="dialog-progress-count">
              {progress.current} of {progress.total}
            </p>
          </>
        )}

        {stage === "confirm-delete" && (
          <>
            <h3>Delete {photoCount} imported photos from SD card?</h3>
            <p className="dialog-warning">This cannot be undone.</p>
            <div className="dialog-actions">
              <button className="dialog-btn secondary" onClick={onCancel}>Keep on Card</button>
              <button className="dialog-btn danger" onClick={onConfirm}>Delete</button>
            </div>
          </>
        )}

        {stage === "deleting" && (
          <h3>Deleting from SD card...</h3>
        )}

        {stage === "done" && (
          <>
            <h3>Import complete!</h3>
            <p>{photoCount} photos imported successfully.</p>
            <div className="dialog-actions">
              <button className="dialog-btn primary" onClick={onCancel}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
