import { useState, type FormEvent } from "react";
import { ArrowDownToLine, Copy, FileUp, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, PageTitle, Panel } from "../../components/ui";
import { fetchFile, uploadFile, type Row } from "../../services/api/station";
import { ErrorNotice, FileView } from "./shared";
export function PrivateFilesPage() {
  const [file, setFile] = useState<File | null>(null),
    [id, setId] = useState(""),
    [result, setResult] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await uploadFile(file);
      if (!response.data.id) throw new Error("No file ID was returned.");
      setResult(response.data);
      setId(response.data.id);
      toast.success("Private file uploaded.");
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  async function download(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await fetchFile(id.trim());
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `neyfuel-${id.trim()}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="SECURE DOCUMENTS"
        title="Your files, safely within reach."
        description="Upload a private document or download a file you have permission to access."
      />
      <div className="live-info-banner">
        <ShieldCheck size={20} />
        <div>
          <strong>Private by default</strong>
          <p>Files are downloaded using your authenticated station account.</p>
        </div>
      </div>
      <div className="live-account-grid">
        <Panel
          title="Upload a document"
          subtitle="PDF, JPEG or PNG · Maximum 5 MB"
        >
          <form
            className="live-file-form"
            onSubmit={(event) => void upload(event)}
          >
            <label className="field">
              <span>Choose a file</span>
              <input
                aria-label="Choose a private file"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                required
                disabled={busy}
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </label>
            <Button type="submit" disabled={busy || !file}>
              <FileUp size={16} />
              {busy ? "Please wait…" : "Upload file"}
            </Button>
          </form>
        </Panel>
        <Panel
          title="Download a private file"
          subtitle="Use the file ID returned after an upload"
        >
          <form
            className="live-file-form"
            onSubmit={(event) => void download(event)}
          >
            <label className="field">
              <span>File ID</span>
              <input
                aria-label="Private file ID"
                value={id}
                placeholder="FIL10130"
                required
                onChange={(event) => setId(event.target.value)}
              />
            </label>
            <Button type="submit" disabled={busy || !id.trim()}>
              <ArrowDownToLine size={16} />
              Download file
            </Button>
          </form>
        </Panel>
      </div>
      {!!error && <ErrorNotice error={error} />}
      {result && (
        <Panel title="File uploaded" subtitle={String(result.originalName)}>
          <div className="live-file-result">
            <span className="live-file-reference">
              {String(result.id)}
              <button
                type="button"
                className="live-icon-button"
                aria-label="Copy file ID"
                onClick={() => {
                  if (!navigator.clipboard) {
                    toast.error("Select and copy the file ID manually.");
                    return;
                  }
                  void navigator.clipboard
                    .writeText(String(result.id))
                    .then(() => toast.success("File ID copied."))
                    .catch(() => toast.error("Unable to copy the file ID."));
                }}
              >
                <Copy size={15} />
              </button>
            </span>
            <FileView value={result} />
          </div>
        </Panel>
      )}
    </>
  );
}
