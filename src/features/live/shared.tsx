import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Fuel,
  LoaderCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Modal } from "../../components/ui";
import {
  contracts,
  fetchFile,
  fieldLabel,
  formatLitres,
  formatMoney,
  idOf,
  labelOf,
  stationRequest,
  validate,
  StationApiError,
  type Envelope,
  type Operation,
  type Row,
  type Schema,
} from "../../services/api/station";
import { useAppStore } from "../../store";
export function useLive<T = Row>(
  operation: Operation,
  query: Row = {},
  params: Record<string, string> = {},
  enabled = true,
) {
  const email = useAppStore((s) => s.session?.email);
  return useQuery({
    queryKey: ["station-live", email, operation, query, params],
    queryFn: () => stationRequest<T>(operation, { query, params }),
    enabled: enabled && !!email,
    retry: 1,
  });
}
export function useRefresh() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["station-live"] });
}
export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="live-error" role="alert">
      <div>
        <strong>We couldn’t complete this request</strong>
        <p>{error instanceof Error ? error.message : String(error)}</p>
        {error instanceof StationApiError && error.details.length > 0 && (
          <ul>
            {error.details.map((detail, index) => (
              <li key={index}>
                {fieldLabel(detail.field.replace(/^body\./, ""))}:{" "}
                {detail.message}
              </li>
            ))}
          </ul>
        )}
      </div>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          <RefreshCw size={15} />
          Try again
        </Button>
      )}
    </div>
  );
}

export function Loading({
  label = "Loading station data…",
}: {
  label?: string;
}) {
  return (
    <div className="live-loading" role="status">
      <LoaderCircle size={23} className="spin" />
      <span>{label}</span>
    </div>
  );
}
export function Empty({
  title = "No records yet",
  detail = "New activity will appear here when it is available.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="live-empty">
      <span>
        <FileText size={25} />
      </span>
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
export function Status({ value }: { value: unknown }) {
  const text = String(value ?? "Unknown").replaceAll("_", " ");
  const good =
    /^(true|active|approved|completed|delivered|captured|paid|online|available|configured|read)$/i.test(
      text,
    );
  const bad = /^(false|rejected|cancelled|failed|inactive|blocked)$/i.test(
    text,
  );
  return (
    <span className={`live-status ${good ? "good" : bad ? "bad" : ""}`}>
      <i />
      {text === "true" ? "Active" : text === "false" ? "Inactive" : text}
    </span>
  );
}
export function valueText(key: string, value: unknown, currency = "XAF") {
  if (typeof value === "number" && /Minor$/.test(key))
    return formatMoney(value, currency);
  if (typeof value === "number" && /Ml$/.test(key)) return formatLitres(value);
  if (
    typeof value === "string" &&
    /(At|expiresAt|from|to)$/.test(key) &&
    Number.isFinite(Date.parse(value))
  )
    return new Date(value).toLocaleString();
  return labelOf(value);
}
export interface Column {
  key: string;
  label?: string;
  render?: (row: Row) => ReactNode;
}
export function RecordTable({
  rows,
  columns,
  actions,
  currency = "XAF",
  search = true,
}: {
  rows: Row[];
  columns: Column[];
  actions?: (row: Row) => ReactNode;
  currency?: string;
  search?: boolean;
}) {
  const [term, setTerm] = useState("");
  const filtered = rows.filter((row) =>
    JSON.stringify(row).toLowerCase().includes(term.toLowerCase()),
  );
  return (
    <>
      {search && (
        <div className="live-table-toolbar">
          <div className="search-box">
            <Search size={16} />
            <input
              aria-label="Search this page"
              placeholder="Search this page…"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            />
          </div>
          <span>{filtered.length} records on this page</span>
        </div>
      )}
      {filtered.length ? (
        <div className="table-scroll">
          <table className="live-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>
                    {column.label || fieldLabel(column.key)}
                  </th>
                ))}
                {actions && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, index) => (
                <tr key={idOf(row) || index}>
                  {columns.map((column) => (
                    <td key={column.key}>
                      {column.render ? (
                        column.render(row)
                      ) : /status|^active$|^online$/i.test(column.key) ? (
                        <Status value={row[column.key]} />
                      ) : (
                        valueText(
                          column.key,
                          row[column.key],
                          String(row.currency || currency),
                        )
                      )}
                    </td>
                  ))}
                  {actions && (
                    <td>
                      <div className="live-row-actions">{actions(row)}</div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title={term ? "No matching records" : "No records yet"}
          detail={
            term
              ? "Try another search on this page."
              : "Activity from your station will appear here."
          }
        />
      )}
    </>
  );
}
export function DownloadCsv({
  rows,
  columns,
  name,
}: {
  rows: Row[];
  columns: Column[];
  name: string;
}) {
  const download = () => {
    const cell = (text: string) =>
      '"' +
      (/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""') +
      '"';
    const lines = [
      columns
        .map((column) => cell(column.label || fieldLabel(column.key)))
        .join(","),
      ...rows.map((row) =>
        columns
          .map((column) =>
            cell(
              valueText(
                column.key,
                row[column.key],
                String(row.currency || "XAF"),
              ),
            ),
          )
          .join(","),
      ),
    ];
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + lines.join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${name}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Button variant="secondary" disabled={!rows.length} onClick={download}>
      <ArrowDownToLine size={15} />
      Export page
    </Button>
  );
}
export function LiveList({
  operation,
  columns,
  actions,
  query = {},
  title,
  subtitle,
  tools,
  showExport = true,
}: {
  operation: Operation;
  columns: Column[];
  actions?: (row: Row) => ReactNode;
  query?: Row;
  title: string;
  subtitle?: string;
  tools?: ReactNode;
  showExport?: boolean;
}) {
  const [page, setPage] = useState(1),
    [limit, setLimit] = useState(20);
  const paginated = "page" in contracts[operation].query;
  const queryKey = JSON.stringify(query);
  useEffect(() => setPage(1), [queryKey]);
  const result = useLive<Row[]>(operation, {
    ...query,
    ...(paginated ? { page, limit } : {}),
  });
  const data = result.data?.data;
  const rows = Array.isArray(data) ? data : [];
  const invalidShape = result.isSuccess && !Array.isArray(data);
  return (
    <section className="panel live-list">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="live-inline-actions">
          {tools}
          <Button
            variant="ghost"
            onClick={() => void result.refetch()}
            disabled={result.isFetching}
          >
            <RefreshCw size={16} />
          </Button>
          {showExport && (
            <DownloadCsv
              rows={rows}
              columns={columns}
              name={title.toLowerCase().replaceAll(" ", "-")}
            />
          )}
        </div>
      </div>
      {result.isPending ? (
        <Loading />
      ) : result.error || invalidShape ? (
        <ErrorNotice
          error={
            result.error ||
            new Error("The server returned an unexpected list format.")
          }
          retry={() => void result.refetch()}
        />
      ) : (
        <RecordTable
          rows={rows}
          columns={columns}
          actions={actions}
          currency={result.data?.meta?.currency}
        />
      )}
      {paginated && (
        <div className="pagination">
          <span>{result.data?.meta?.total ?? rows.length} total records</span>
          <div>
            <select
              aria-label="Records per page"
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
            >
              {[20, 50, 100].map((count) => (
                <option key={count}>{count}</option>
              ))}
            </select>
            <button
              className="icon-btn"
              aria-label="Previous page"
              disabled={page === 1 || result.isFetching}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              {page} / {Math.max(1, result.data?.meta?.pages || 1)}
            </span>
            <button
              className="icon-btn"
              aria-label="Next page"
              disabled={
                page >= (result.data?.meta?.pages || 1) || result.isFetching
              }
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
export function FileView({
  value,
  imageOnly = false,
}: {
  value: unknown;
  imageOnly?: boolean;
}) {
  const id = idOf(value);
  const [blob, setBlob] = useState<Blob | null>(null),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setBlob(null);
    setError("");
    if (id)
      void fetchFile(id)
        .then((file) => {
          if (active) setBlob(file);
        })
        .catch((reason) => {
          if (active) setError(reason.message);
        });
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    if (!blob) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  if (!id) return null;
  return (
    <div className="live-file">
      {blob?.type.startsWith("image/") && url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={
              labelOf((value as Row)?.originalName) === "—"
                ? "Station photo"
                : labelOf((value as Row)?.originalName)
            }
          />
        </a>
      ) : (
        !imageOnly && <FileText size={25} />
      )}
      {!imageOnly && (
        <>
          {error ? (
            <small className="error">{error}</small>
          ) : url ? (
            <a
              href={url}
              download={
                typeof value === "object"
                  ? labelOf((value as Row).originalName)
                  : `${id}`
              }
            >
              <ArrowDownToLine size={14} />
              Download file
            </a>
          ) : (
            <small>Loading file…</small>
          )}
        </>
      )}
    </div>
  );
}
const hidden = new Set([
  "__v",
  "passwordHash",
  "pinHash",
  "tokenHash",
  "pushToken",
  "tokenVersion",
  "accountNumberEncrypted",
  "refreshToken",
  "accessToken",
]);
export function Details({
  data,
  depth = 0,
  currency = "XAF",
}: {
  data: unknown;
  depth?: number;
  currency?: string;
}) {
  if (data == null) return <p className="muted">No additional details.</p>;
  if (typeof data !== "object") return <span>{labelOf(data)}</span>;
  if (Array.isArray(data))
    return data.length ? (
      <div className="live-detail-array">
        {data.map((row, index) => (
          <Details
            key={index}
            data={row}
            depth={depth + 1}
            currency={currency}
          />
        ))}
      </div>
    ) : (
      <span className="muted">None</span>
    );
  const row = data as Row;
  const unit = String(row.currency || currency);
  return (
    <dl className={`live-details ${depth ? "nested" : ""}`}>
      {Object.entries(row)
        .filter(([key]) => !hidden.has(key) && !(key === "_id" && row.unitId))
        .map(([key, value]) => (
          <div
            key={key}
            className={value && typeof value === "object" ? "wide" : ""}
          >
            <dt>{fieldLabel(key)}</dt>
            <dd>
              {key === "photos" && Array.isArray(value) ? (
                <div className="live-photo-grid">
                  {value.map((photo, index) => (
                    <FileView key={index} value={photo} />
                  ))}
                </div>
              ) : key === "photo" && value ? (
                <FileView value={value} imageOnly />
              ) : value && typeof value === "object" && depth < 4 ? (
                <Details data={value} depth={depth + 1} currency={unit} />
              ) : (
                valueText(key, value, unit)
              )}
            </dd>
          </div>
        ))}
    </dl>
  );
}
export function DetailDialog({
  title,
  operation,
  id,
  record,
  onClose,
  children,
}: {
  title: string;
  operation?: Operation;
  id?: string;
  record?: Row;
  onClose: () => void;
  children?: ReactNode;
}) {
  const result = useLive(
    operation || "getStationProfile",
    {},
    { id: id || "" },
    !!operation && !!id,
  );
  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="live-dialog-body">
        {operation ? (
          result.isPending ? (
            <Loading />
          ) : result.error ? (
            <ErrorNotice
              error={result.error}
              retry={() => void result.refetch()}
            />
          ) : (
            <Details data={result.data?.data} />
          )
        ) : (
          <Details data={record} />
        )}
        {children}
      </div>
    </Modal>
  );
}
export interface InputField {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  help?: string;
  options?: { value: string; label: string }[];
  value?: string;
  min?: number;
  max?: number;
  step?: string;
}
export function MutationDialog({
  title,
  operation,
  params,
  fields,
  help,
  onClose,
  onSuccess,
  initial = {},
  transform,
  deviceToken,
}: {
  title: string;
  operation: Operation;
  params?: Record<string, string>;
  fields: InputField[];
  help?: string;
  onClose: () => void;
  onSuccess?: (data: unknown) => void;
  initial?: Row;
  transform?: (values: Row) => Row;
  deviceToken?: string;
}) {
  const [values, setValues] = useState<Row>(initial),
    [review, setReview] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const lock = useRef(false);
  const refresh = useRefresh();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    setError(null);
    try {
      const next = transform ? transform(values) : values;
      const body = contracts[operation].body
        ? (validate(contracts[operation].body as Schema, next) as Row)
        : undefined;
      if (!review) {
        setReview(body || {});
        return;
      }
      lock.current = true;
      setBusy(true);
      const result = await stationRequest(operation, {
        params,
        body,
        deviceToken,
      });
      await refresh();
      toast.success(result.message);
      onSuccess?.(result.data);
      onClose();
    } catch (reason) {
      setError(reason);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="live-dialog-body live-form"
        onSubmit={(event) => void submit(event)}
      >
        {help && <p className="live-form-note">{help}</p>}
        {review ? (
          <div className="live-review">
            <span className="live-step-label">
              <Check size={15} />
              Review before confirming
            </span>
            <dl>
              {fields.map((field) => (
                <div key={field.name}>
                  <dt>{field.label}</dt>
                  <dd>
                    {field.type === "password"
                      ? "••••••••"
                      : labelOf(values[field.name])}
                  </dd>
                </div>
              ))}
            </dl>
            {!fields.length && (
              <p>Confirm this action for the selected record.</p>
            )}
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setReview(null)}
            >
              Edit details
            </Button>
          </div>
        ) : (
          <fieldset disabled={busy}>
            {fields.map((field) => (
              <label className="field" key={field.name}>
                <span>
                  {field.label}
                  {field.required !== false ? " *" : ""}
                </span>
                {field.options ? (
                  <select
                    aria-label={field.label}
                    value={String(values[field.name] ?? field.value ?? "")}
                    required={field.required !== false}
                    onChange={(event) =>
                      setValues((previous) => ({
                        ...previous,
                        [field.name]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    aria-label={field.label}
                    rows={3}
                    required={field.required !== false}
                    value={String(values[field.name] ?? "")}
                    onChange={(event) =>
                      setValues((previous) => ({
                        ...previous,
                        [field.name]: event.target.value,
                      }))
                    }
                  />
                ) : (
                  <input
                    aria-label={field.label}
                    type={field.type || "text"}
                    autoComplete={field.type === "password" ? "off" : undefined}
                    min={field.min}
                    max={field.max}
                    step={
                      field.step ||
                      (field.type === "number" ? "any" : undefined)
                    }
                    required={field.required !== false}
                    value={String(values[field.name] ?? "")}
                    onChange={(event) =>
                      setValues((previous) => ({
                        ...previous,
                        [field.name]: event.target.value,
                      }))
                    }
                  />
                )}
                {field.help && <small>{field.help}</small>}
              </label>
            ))}
          </fieldset>
        )}
        {!!error && <ErrorNotice error={error} />}
        <div className="form-footer">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={16} /> : null}
            {busy ? "Saving…" : review ? "Confirm & save" : "Review changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function ViewButton({
  onClick,
  label = "View details",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="live-icon-button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Eye size={16} />
    </button>
  );
}
export function LinkCard({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="live-link-card">
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      {children || <ArrowUpRight size={19} />}
    </div>
  );
}
export type ListResponse = Envelope<Row[]>;

export function PrintableReceipt({ receipt }: { receipt: Row }) {
  const profile = useLive("getStationProfile");
  const station = profile.data?.data;
  const currency = String(receipt.currency || "XAF");
  return (
    <section className="live-receipt">
      <header>
        <Fuel size={32} />
        <h2>NeyFuel</h2>
        <strong>{labelOf(station?.name)}</strong>
        <p>{labelOf(station?.address)}</p>
        <span className="live-receipt-tag">FUEL DISPENSING RECEIPT</span>
      </header>
      <div className="live-receipt-meta">
        <div>
          <small>Receipt number</small>
          <strong>{labelOf(receipt.number || receipt.unitId)}</strong>
        </div>
        <div>
          <small>Issued</small>
          <strong>{valueText("createdAt", receipt.createdAt)}</strong>
        </div>
        <div>
          <small>Company</small>
          <strong>{labelOf(receipt.company)}</strong>
        </div>
        <div>
          <small>Vehicle</small>
          <strong>{labelOf(receipt.vehicle)}</strong>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Fuel</th>
            <th>Quantity</th>
            <th>Price / litre</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{labelOf(receipt.fuel)}</td>
            <td>{formatLitres(receipt.quantityMl)}</td>
            <td>{formatMoney(receipt.unitPriceMinor, currency)}</td>
            <td>{formatMoney(receipt.totalMinor, currency)}</td>
          </tr>
        </tbody>
      </table>
      <div className="live-receipt-total">
        <span>Total</span>
        <strong>{formatMoney(receipt.totalMinor, currency)}</strong>
      </div>
      <div className="live-receipt-meta">
        <div>
          <small>Employee</small>
          <strong>{labelOf(receipt.employee)}</strong>
        </div>
        <div>
          <small>Odometer reading</small>
          <strong>{labelOf(receipt.mileage)}</strong>
        </div>
      </div>
      <footer>
        Thank you for choosing NeyFuel.
        <br />
        {labelOf(receipt.unitId)}
      </footer>
    </section>
  );
}
