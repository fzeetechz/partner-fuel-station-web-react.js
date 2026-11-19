import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ClipboardList,
  Fuel,
  MessageSquare,
  MonitorSmartphone,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button, Metric, Modal, PageTitle, Panel } from "../../components/ui";
import {
  formatLitres,
  formatMoney,
  idOf,
  labelOf,
  publicRequest,
  stationRequest,
  type Row,
} from "../../services/api/station";
import { useQuery } from "@tanstack/react-query";
import {
  DetailDialog,
  Empty,
  ErrorNotice,
  LiveList,
  Loading,
  MutationDialog,
  PrintableReceipt,
  RecordTable,
  Status,
  useLive,
  useRefresh,
  ViewButton,
  type Column,
} from "./shared";
const transactions: Column[] = [
  { key: "unitId", label: "Transaction ID" },
  { key: "company" },
  { key: "vehicle" },
  { key: "fuel" },
  { key: "quantityMl", label: "Quantity" },
  { key: "totalMinor", label: "Total" },
  { key: "createdAt", label: "Date" },
];
const stockColumns: Column[] = [
  { key: "fuel", label: "Fuel type" },
  { key: "quantityMl", label: "Total stock" },
  { key: "lowStockMl", label: "Alert threshold" },
];
export function Overview() {
  const dashboard = useLive("getStationDashboard"),
    profile = useLive("getStationProfile"),
    inventory = useLive<Row[]>("getStationInventory");
  const daysAgo = new Date();
  daysAgo.setUTCDate(daysAgo.getUTCDate() - 6);
  daysAgo.setUTCHours(0, 0, 0, 0);
  const report = useLive<Row[]>("getStationReportsFuel", {
    groupBy: "day",
    from: daysAgo.toISOString(),
  });
  const raw = profile.data?.data;
  const station =
    raw?.station && typeof raw.station === "object"
      ? (raw.station as Row)
      : raw;
  const data = dashboard.data?.data;
  const today = data?.today as Row | undefined,
    unsettled = data?.unsettled as Row | undefined;
  const metrics = data
    ? [
        {
          key: "salesMinor",
          title: "Today’s fuel sales",
          value: today?.salesMinor,
          detail: "Completed dispensing · today",
        },
        {
          key: "quantityMl",
          title: "Fuel dispensed today",
          value: today?.quantityMl,
          detail: "Across your station",
        },
        {
          key: "transactions",
          title: "Transactions today",
          value: today?.transactions,
          detail: "Completed fuel transactions",
        },
        {
          key: "totalMinor",
          title: "Unsettled sales",
          value: unsettled?.totalMinor,
          detail: "Awaiting recorded settlement",
        },
      ]
    : [];
  const icons = [Wallet, Fuel, ClipboardList, ShieldCheck];
  const points = (Array.isArray(report.data?.data) ? report.data.data : []).map(
    (row) => ({
      day: labelOf(row._id || row.day),
      revenue: Number(row.totalMinor ?? row.revenueMinor ?? 0),
    }),
  );
  return (
    <>
      <section className="live-overview-hero">
        <div>
          <span className="live-kicker">
            <span className="live-dot" />
            YOUR STATION, CONNECTED
          </span>
          <h1>
            A clearer view of
            <br />
            your everyday operations.
          </h1>
          <p>
            {station ? labelOf(station.name) : "Your station workspace"} ·
            Sales, delivery requests and fuel stock in one place.
          </p>
          <Link to="/dispense" className="btn primary">
            <Fuel size={16} />
            Start dispensing
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="live-hero-station">
          <Fuel size={76} strokeWidth={1.1} />
          <span className="live-hero-label">STATION WORKSPACE</span>
          <strong>{station ? labelOf(station.name) : "NeyFuel partner"}</strong>
          <small>
            {station
              ? labelOf(station.city || station.address)
              : "Connected to your network"}
          </small>
        </div>
      </section>
      {dashboard.isPending ? (
        <Loading label="Loading your station overview…" />
      ) : dashboard.error ? (
        <ErrorNotice
          error={dashboard.error}
          retry={() => void dashboard.refetch()}
        />
      ) : (
        <>
          {metrics.length > 0 && (
            <div className="metrics-grid live-metrics">
              {metrics.map((metric, index) => {
                const Icon = icons[index];
                return (
                  <Metric
                    key={metric.key}
                    label={metric.title}
                    value={
                      /Minor$/.test(metric.key)
                        ? formatMoney(metric.value)
                        : /Ml$/.test(metric.key)
                          ? formatLitres(metric.value)
                          : typeof metric.value === "number"
                            ? metric.value.toLocaleString()
                            : "—"
                    }
                    icon={<Icon size={20} />}
                    detail={metric.detail}
                    tone={index === 0 ? "orange" : "blue"}
                  />
                );
              })}
            </div>
          )}
          <div className="live-overview-grid">
            <Panel
              title="Fuel sales overview"
              subtitle="The last seven days · UTC"
              action={
                <Link className="text-link" to="/reports">
                  View reports
                  <ArrowUpRight size={14} />
                </Link>
              }
            >
              {report.isPending ? (
                <Loading />
              ) : report.error ? (
                <ErrorNotice error={report.error} />
              ) : points.length ? (
                <div className="live-sales-chart">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={points}>
                      <defs>
                        <linearGradient
                          id="sales-fill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#f56600"
                            stopOpacity={0.18}
                          />
                          <stop
                            offset="100%"
                            stopColor="#f56600"
                            stopOpacity={0.01}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 5"
                        vertical={false}
                        stroke="#e9edf4"
                      />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={65}
                      />
                      <Tooltip
                        formatter={(value) => formatMoney(Number(value))}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#f56600"
                        strokeWidth={2.5}
                        fill="url(#sales-fill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty
                  title="Your sales story starts here"
                  detail="Completed dispensing transactions will populate this chart."
                />
              )}
            </Panel>
            <Panel
              title="Fuel stock"
              subtitle="Available at your station"
              action={
                <Link to="/inventory" className="text-link">
                  Manage
                  <ArrowUpRight size={14} />
                </Link>
              }
            >
              {inventory.isPending ? (
                <Loading />
              ) : inventory.error ? (
                <ErrorNotice error={inventory.error} />
              ) : !inventory.data?.data?.length ? (
                <Empty
                  title="No stock recorded"
                  detail="Your administrator records stock deliveries and adjustments."
                />
              ) : (
                <div className="live-stock-list">
                  {inventory.data.data.map((row, index) => (
                    <div key={idOf(row) || index}>
                      <span className="live-fuel-mark">
                        <Fuel size={20} />
                      </span>
                      <div>
                        <strong>{labelOf(row.fuel || row.name)}</strong>
                        <small>
                          {formatLitres(row.quantityMl)} total stock
                        </small>
                      </div>
                      <Status
                        value={
                          Number(row.quantityMl) <= Number(row.lowStockMl)
                            ? "Low stock"
                            : "Available"
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
          <LiveList
            operation="getStationTransactions"
            columns={transactions}
            title="Recent station activity"
            subtitle="Dispensing transactions recorded for your station"
          />
        </>
      )}
      <div className="live-quick-links">
        <Link to="/orders">
          <span>
            <ClipboardList size={20} />
          </span>
          <div>
            <strong>Delivery requests</strong>
            <small>Review and approve incoming orders</small>
          </div>
          <ArrowRight size={17} />
        </Link>
        <Link to="/fuel-prices">
          <span>
            <Fuel size={20} />
          </span>
          <div>
            <strong>Your fuel prices</strong>
            <small>Set station-specific retail prices</small>
          </div>
          <ArrowRight size={17} />
        </Link>
        <Link to="/support">
          <span>
            <MessageSquare size={20} />
          </span>
          <div>
            <strong>Partner support</strong>
            <small>Get help with your station operations</small>
          </div>
          <ArrowRight size={17} />
        </Link>
      </div>
    </>
  );
}
export function FuelPricing() {
  const prices = useLive<Row[]>("getStationFuelPrices");
  const catalog = useQuery({
    queryKey: ["public-fuels"],
    queryFn: () => publicRequest<Row[]>("/public/fuels"),
  });
  const [edit, setEdit] = useState<Row | null>(null);
  const rows = Array.isArray(prices.data?.data) ? prices.data.data : [];
  function fuelId(row: Row) {
    return idOf(row.fuel || row.fuelId || row);
  }
  return (
    <>
      <PageTitle
        eyebrow="RETAIL FUEL PRICING"
        title="Your prices. Your station."
        description="Set your price per litre for each available fuel. Existing orders retain their quoted prices."
        actions={
          <Button
            variant="secondary"
            onClick={() => void prices.refetch()}
            disabled={prices.isFetching}
          >
            <RefreshCw size={16} />
            Refresh
          </Button>
        }
      />
      <div className="live-info-banner">
        <Fuel size={20} />
        <div>
          <strong>Prices are managed by your station</strong>
          <p>
            XAF uses whole FCFA units: a price of 150 means 150 FCFA per litre.
          </p>
        </div>
      </div>
      {prices.isPending ? (
        <Loading />
      ) : prices.error ? (
        <ErrorNotice error={prices.error} retry={() => void prices.refetch()} />
      ) : rows.length ? (
        <div className="live-price-grid">
          {rows.map((row, index) => (
            <Panel key={fuelId(row) || index} className="live-price-card">
              <div className="live-price-top">
                <span className="live-fuel-mark">
                  <Fuel size={23} />
                </span>
                <Status
                  value={
                    row.priceConfigured === false
                      ? "Not configured"
                      : "Configured"
                  }
                />
              </div>
              <h2>{labelOf(row.fuel || row.name || row)}</h2>
              <p>{labelOf(row.code || (row.fuel as Row)?.code)}</p>
              <div className="live-price-amount">
                {row.priceConfigured === false || row.priceMinor == null
                  ? "Set your price"
                  : formatMoney(row.priceMinor, String(row.currency || "XAF"))}
                <small>per litre</small>
              </div>
              <div className="live-price-stock">
                <Package size={15} />
                {typeof row.availableLitres === "number"
                  ? `${row.availableLitres.toLocaleString()} L available`
                  : row.availableMl !== undefined
                    ? `${formatLitres(row.availableMl)} available`
                    : row.quantityMl !== undefined
                      ? `${formatLitres(row.quantityMl)} in stock`
                      : "Availability follows station inventory"}
              </div>
              <Button
                variant="secondary"
                onClick={() => setEdit({ ...row, selectedFuelId: fuelId(row) })}
              >
                <Pencil size={15} />
                {row.priceConfigured === false
                  ? "Set fuel price"
                  : "Update price"}
              </Button>
            </Panel>
          ))}
        </div>
      ) : (
        <Empty
          title="No fuels available yet"
          detail="Your administrator manages the fuel catalogue. Active fuels appear here for station pricing."
        />
      )}
      {Array.isArray(catalog.data?.data) &&
        catalog.data.data.some(
          (fuel) => !rows.some((row) => fuelId(row) === idOf(fuel)),
        ) && (
          <Panel
            title="More catalogue fuels"
            subtitle="Set a station price to configure an available catalogue fuel"
          >
            <RecordTable
              rows={catalog.data.data.filter(
                (fuel) => !rows.some((row) => fuelId(row) === idOf(fuel)),
              )}
              columns={[{ key: "name" }, { key: "code" }]}
              actions={(row) => (
                <Button
                  variant="secondary"
                  onClick={() => setEdit({ ...row, selectedFuelId: idOf(row) })}
                >
                  <Plus size={14} />
                  Set price
                </Button>
              )}
            />
          </Panel>
        )}
      {edit && (
        <MutationDialog
          title={`Set price · ${labelOf(edit.fuel || edit.name || edit)}`}
          operation="patchStationFuelPricesByFuelId"
          params={{ fuelId: String(edit.selectedFuelId) }}
          fields={[
            {
              name: "priceMinor",
              label: "Retail price per litre (FCFA)",
              type: "number",
              min: 1,
              max: 100000000,
              step: "1",
            },
          ]}
          initial={{ priceMinor: edit.priceMinor ?? "" }}
          help="This price applies only to your station. Existing quotes and receipts are preserved."
          onClose={() => setEdit(null)}
        />
      )}
    </>
  );
}
export function InventoryPage() {
  const [tab, setTab] = useState("stock");
  return (
    <>
      <PageTitle
        eyebrow="STATION INVENTORY"
        title="Stay ahead of every refill."
        description="Monitor fuel quantities, reservations and stock movements. Stock adjustments are recorded by your administrator."
      />
      <div className="live-tabs">
        <button
          className={tab === "stock" ? "active" : ""}
          onClick={() => setTab("stock")}
        >
          Current stock
        </button>
        <button
          className={tab === "movements" ? "active" : ""}
          onClick={() => setTab("movements")}
        >
          Movement history
        </button>
      </div>
      {tab === "stock" ? (
        <LiveList
          operation="getStationInventory"
          columns={stockColumns}
          title="Current fuel inventory"
        />
      ) : (
        <LiveList
          operation="getStationInventoryMovements"
          columns={[
            { key: "unitId", label: "Movement ID" },
            { key: "fuel" },
            { key: "type" },
            { key: "quantityMl", label: "Quantity" },
            { key: "reference" },
            { key: "createdAt", label: "Recorded at" },
          ]}
          title="Stock movements"
        />
      )}
    </>
  );
}
export function StationOrders() {
  const [detail, setDetail] = useState<Row | null>(null),
    [chat, setChat] = useState<Row | null>(null),
    [action, setAction] = useState<{ row: Row; accept: boolean } | null>(null);
  const pending = (row: Row) =>
    row.status === "CONFIRMED" &&
    !row.stationAcceptedAt &&
    !row.adminAcceptedAt;
  return (
    <>
      <PageTitle
        eyebrow="HOME DELIVERY"
        title="The next delivery starts here."
        description="Approve customer requests for your station or reject an eligible pending request with a reason."
      />
      <LiveList
        operation="getStationOrders"
        title="Station delivery requests"
        columns={[
          { key: "number", label: "Order" },
          { key: "user", label: "Customer" },
          { key: "fuelName", label: "Fuel" },
          { key: "quantityMl", label: "Quantity" },
          { key: "totalMinor", label: "Order total" },
          { key: "status" },
          { key: "scheduledAt", label: "Scheduled for" },
        ]}
        actions={(row) => (
          <>
            <ViewButton onClick={() => setDetail(row)} />
            <button
              className="live-icon-button"
              aria-label="View order messages"
              title="Order messages"
              onClick={() => setChat(row)}
            >
              <MessageSquare size={15} />
            </button>
            {pending(row) && (
              <>
                <button
                  className="live-icon-button good"
                  title="Accept delivery request"
                  aria-label={`Accept ${labelOf(row.number || row.unitId)}`}
                  onClick={() => setAction({ row, accept: true })}
                >
                  <Check size={16} />
                </button>
                <button
                  className="live-icon-button bad"
                  title="Reject delivery request"
                  aria-label={`Reject ${labelOf(row.number || row.unitId)}`}
                  onClick={() => setAction({ row, accept: false })}
                >
                  <X size={16} />
                </button>
              </>
            )}
          </>
        )}
      />
      {chat && <OrderMessages order={chat} onClose={() => setChat(null)} />}
      {detail && (
        <DetailDialog
          title="Delivery request details"
          operation="getStationOrdersById"
          id={idOf(detail)}
          onClose={() => setDetail(null)}
        />
      )}
      {action && (
        <MutationDialog
          title={
            action.accept
              ? "Accept delivery request"
              : "Reject delivery request"
          }
          operation={
            action.accept
              ? "postStationOrdersByIdAccept"
              : "postStationOrdersByIdReject"
          }
          params={{ id: idOf(action.row) }}
          fields={
            action.accept
              ? []
              : [
                  {
                    name: "reason",
                    label: "Reason for rejection",
                    type: "textarea",
                  },
                ]
          }
          help={
            action.accept
              ? "Approval reserves station stock and makes the order available to eligible nearby drivers."
              : "This rejects a pending station request. Eligible captured funds are returned to the customer wallet."
          }
          onClose={() => setAction(null)}
        />
      )}
    </>
  );
}
export function AuthorizationsPage() {
  const [detail, setDetail] = useState<Row | null>(null);
  return (
    <>
      <PageTitle
        eyebrow="CORPORATE FUEL"
        title="Authorized. Verified. Ready."
        description="Review active authorizations assigned to your station. Verify the employee’s QR or RFID credential before dispensing."
        actions={
          <Link to="/dispense" className="btn primary">
            <ShieldCheck size={16} />
            Verify & dispense
          </Link>
        }
      />
      <LiveList
        operation="getStationAuthorizations"
        title="Assigned fuel authorizations"
        columns={[
          { key: "number" },
          { key: "company" },
          { key: "employee" },
          { key: "vehicle" },
          { key: "fuel" },
          { key: "remainingMl", label: "Remaining" },
          { key: "method" },
          { key: "status" },
          { key: "expiresAt", label: "Expiry" },
        ]}
        actions={(row) => <ViewButton onClick={() => setDetail(row)} />}
      />
      {detail && (
        <DetailDialog
          title="Authorization details"
          operation="getStationAuthorizationsById"
          id={idOf(detail)}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
export function DevicesPage() {
  const devices = useLive<Row[]>("getStationDevices");
  const [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState<unknown>(null);
  async function heartbeat() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await stationRequest("postStationDevicesHeartbeat", {
        deviceToken: token,
      });
      setMessage(response.message);
      await devices.refetch();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="CONNECTED POS"
        title="Connected at every pump."
        description="Review station POS devices and send a heartbeat using an administrator-issued device token."
      />
      <LiveList
        operation="getStationDevices"
        title="Registered POS devices"
        columns={[
          { key: "unitId", label: "Device ID" },
          { key: "name" },
          { key: "serialNumber", label: "Serial number" },
          { key: "active", label: "Status" },
          { key: "lastSeenAt", label: "Last heartbeat" },
        ]}
      />
      <Panel
        title="Device connection check"
        subtitle="Device registration and token rotation are managed by the administrator"
      >
        <form
          className="live-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void heartbeat();
          }}
        >
          <label className="field">
            <span>POS device token</span>
            <input
              type="password"
              autoComplete="off"
              value={token}
              required
              onChange={(event) => setToken(event.target.value)}
              placeholder="Enter device token"
            />
            <small>Kept only in memory while this page is open.</small>
          </label>
          <Button type="submit" disabled={busy || !token.trim()}>
            <MonitorSmartphone size={16} />
            {busy ? "Checking…" : "Send heartbeat"}
          </Button>
        </form>
        {message && (
          <p role="status" className="live-success">
            {message}
          </p>
        )}
        {!!error && <ErrorNotice error={error} />}
      </Panel>
    </>
  );
}
export function TransactionsPage() {
  const [detail, setDetail] = useState<Row | null>(null);
  return (
    <>
      <PageTitle
        eyebrow="SALES & RECEIPTS"
        title="Every transaction, accounted for."
        description="Review your station’s dispensing history and open digital receipts for printing or reprinting."
      />
      <LiveList
        operation="getStationTransactions"
        title="Dispensing transactions"
        columns={transactions}
        actions={(row) => (
          <ViewButton label="Open receipt" onClick={() => setDetail(row)} />
        )}
      />
      {detail && (
        <Modal
          title="Digital fuel receipt"
          wide
          onClose={() => setDetail(null)}
        >
          <Receipt id={idOf(detail)} onClose={() => setDetail(null)} />
        </Modal>
      )}
    </>
  );
}
function Receipt({ id, onClose }: { id: string; onClose: () => void }) {
  const result = useLive("getStationTransactionsByIdReceipt", {}, { id });
  return (
    <div className="live-dialog-body">
      {result.isPending ? (
        <Loading />
      ) : result.error ? (
        <ErrorNotice error={result.error} />
      ) : (
        <>
          <PrintableReceipt receipt={result.data?.data || {}} />
          <div className="form-footer">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => window.print()}>
              <ArrowDownToLine size={16} />
              Print receipt
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
export function SettlementsPage() {
  return (
    <>
      <PageTitle
        eyebrow="SETTLEMENT HISTORY"
        title="A clear view of your settlements."
        description="View externally completed station payments recorded by the administrator. Settlement records do not initiate a bank transfer."
      />
      <LiveList
        operation="getStationSettlements"
        title="Recorded settlements"
        columns={[
          { key: "unitId", label: "Settlement ID" },
          { key: "reference" },
          { key: "amountMinor", label: "Amount" },
          { key: "currency" },
          { key: "transactionCount", label: "Transactions" },
          { key: "createdAt", label: "Recorded at" },
        ]}
      />
    </>
  );
}
export function ReportsPage() {
  const [tab, setTab] = useState("sales"),
    [groupBy, setGroupBy] = useState("day"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [query, setQuery] = useState<Row>({}),
    [low, setLow] = useState("true");
  const columns: Column[] = [
    { key: "_id", label: groupBy === "fuel" ? "Fuel" : "Day (UTC)" },
    { key: "transactions", label: "Transactions" },
    { key: "quantityMl", label: "Dispensed" },
    { key: "totalMinor", label: "Sales revenue" },
  ];
  return (
    <>
      <PageTitle
        eyebrow="STATION INSIGHTS"
        title="Turn your activity into insight."
        description="Explore fuel sales and low-stock reports using live station records."
      />
      <div className="live-tabs">
        <button
          className={tab === "sales" ? "active" : ""}
          onClick={() => setTab("sales")}
        >
          Fuel sales
        </button>
        <button
          className={tab === "stock" ? "active" : ""}
          onClick={() => setTab("stock")}
        >
          Inventory report
        </button>
      </div>
      {tab === "sales" ? (
        <>
          <form
            className="live-filters"
            onSubmit={(event) => {
              event.preventDefault();
              if (from && to && from > to) {
                toast.error("Start date must be before the end date.");
                return;
              }
              setQuery({
                groupBy,
                ...(from ? { from: new Date(from).toISOString() } : {}),
                ...(to ? { to: new Date(to).toISOString() } : {}),
              });
            }}
          >
            <label className="field">
              <span>From</span>
              <input
                type="datetime-local"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label className="field">
              <span>To</span>
              <input
                type="datetime-local"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Group by</span>
              <select
                value={groupBy}
                onChange={(event) => setGroupBy(event.target.value)}
              >
                <option value="day">Day</option>
                <option value="fuel">Fuel</option>
              </select>
            </label>
            <Button type="submit" variant="secondary">
              Apply filters
            </Button>
          </form>
          <LiveList
            operation="getStationReportsFuel"
            query={query}
            title="Fuel sales report"
            subtitle="Date boundaries are converted to UTC"
            columns={columns}
          />
        </>
      ) : (
        <LiveList
          operation="getStationReportsInventory"
          query={{ lowStockOnly: low }}
          title="Inventory alerts"
          columns={stockColumns}
          tools={
            <select
              aria-label="Low stock filter"
              value={low}
              onChange={(event) => setLow(event.target.value)}
            >
              <option value="true">Low stock only</option>
              <option value="false">All stock</option>
            </select>
          }
        />
      )}
    </>
  );
}
export function WalletPage() {
  const wallet = useLive("getSharedWallet");
  const [direction, setDirection] = useState("");
  return (
    <>
      <PageTitle
        eyebrow="ACCOUNT WALLET"
        title="Your balance, in focus."
        description="View your account wallet and its ledger. Station settlements are listed separately."
      />
      {wallet.isPending ? (
        <Loading />
      ) : wallet.error ? (
        <ErrorNotice error={wallet.error} retry={() => void wallet.refetch()} />
      ) : (
        <Panel className="live-wallet-card">
          <div>
            <span>
              <Wallet size={20} />
              ACCOUNT BALANCE
            </span>
            <h2>
              {formatMoney(
                wallet.data?.data.balanceMinor,
                String(wallet.data?.data.currency || "XAF"),
              )}
            </h2>
            <small>{idOf(wallet.data?.data)}</small>
          </div>
          <ShieldCheck size={68} strokeWidth={1} />
        </Panel>
      )}
      <LiveList
        operation="getSharedWalletTransactions"
        title="Wallet ledger"
        query={direction ? { direction } : {}}
        columns={[
          { key: "unitId", label: "Entry ID" },
          { key: "direction" },
          { key: "type" },
          { key: "amountMinor", label: "Amount" },
          { key: "balanceAfterMinor", label: "Balance after" },
          { key: "reference" },
          { key: "createdAt", label: "Recorded at" },
        ]}
        tools={
          <select
            aria-label="Ledger direction"
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
          >
            <option value="">All entries</option>
            <option value="IN">Money in</option>
            <option value="OUT">Money out</option>
          </select>
        }
      />
    </>
  );
}
export function NotificationsPage() {
  const [busy, setBusy] = useState("");
  const refresh = useRefresh();
  async function read(row: Row) {
    if (busy) return;
    setBusy(idOf(row));
    try {
      await stationRequest("patchSharedNotificationsByIdRead", {
        params: { id: idOf(row) },
      });
      await refresh();
      toast.success("Notification marked as read.");
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Unable to update notification.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="YOUR INBOX"
        title="Stay in the loop."
        description="Updates and notifications addressed to your station account."
      />
      <LiveList
        operation="getSharedNotifications"
        title="Notifications"
        columns={[
          { key: "title" },
          { key: "body", label: "Message" },
          { key: "createdAt", label: "Received" },
          {
            key: "readAt",
            label: "Read",
            render: (row) => <Status value={row.readAt ? "Read" : "Unread"} />,
          },
        ]}
        actions={(row) =>
          !row.readAt ? (
            <Button
              variant="secondary"
              disabled={!!busy}
              onClick={() => void read(row)}
            >
              <Check size={14} />
              {busy === idOf(row) ? "Saving…" : "Mark read"}
            </Button>
          ) : null
        }
      />
    </>
  );
}
export function SupportPage() {
  const [create, setCreate] = useState(false),
    [ticket, setTicket] = useState<Row | null>(null),
    [reply, setReply] = useState<Row | null>(null);
  return (
    <>
      <PageTitle
        eyebrow="PARTNER SUPPORT"
        title="A little help goes a long way."
        description="Raise a support request and follow updates from the NeyFuel team."
        actions={
          <Button onClick={() => setCreate(true)}>
            <Plus size={16} />
            New support ticket
          </Button>
        }
      />
      <LiveList
        operation="getSharedSupportTickets"
        title="Your support tickets"
        columns={[
          { key: "unitId", label: "Ticket ID" },
          { key: "subject" },
          { key: "status" },
          { key: "createdAt", label: "Created" },
        ]}
        actions={(row) => (
          <>
            <ViewButton onClick={() => setTicket(row)} />
            <button
              className="live-icon-button"
              aria-label="Reply to ticket"
              title="Reply"
              onClick={() => setReply(row)}
            >
              <MessageSquare size={16} />
            </button>
          </>
        )}
      />
      {ticket && (
        <DetailDialog
          title="Support ticket"
          record={ticket}
          onClose={() => setTicket(null)}
        />
      )}
      {create && (
        <MutationDialog
          title="Create support ticket"
          operation="postSharedSupportTickets"
          fields={[
            { name: "subject", label: "Subject" },
            { name: "message", label: "How can we help?", type: "textarea" },
            {
              name: "orderId",
              label: "Related order ID",
              required: false,
              help: "Optional. Use an order associated with this account.",
            },
          ]}
          onClose={() => setCreate(false)}
        />
      )}
      {reply && (
        <MutationDialog
          title={`Reply · ${labelOf(reply.subject)}`}
          operation="postSharedSupportTicketsByIdReplies"
          params={{ id: idOf(reply) }}
          fields={[{ name: "message", label: "Your reply", type: "textarea" }]}
          onClose={() => setReply(null)}
        />
      )}
    </>
  );
}

function OrderMessages({
  order,
  onClose,
}: {
  order: Row;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [denied, setDenied] = useState(false);
  const id = idOf(order),
    result = useLive<Row[]>(
      "getSharedOrdersByIdMessages",
      { page, limit: 20 },
      { id },
    );
  const closed = ["DELIVERED", "CANCELLED"].includes(String(order.status));
  const canSend = !!order.driver && !closed && !denied;
  async function send(event: import("react").FormEvent) {
    event.preventDefault();
    if (!canSend || busy || !text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await stationRequest("postSharedOrdersByIdMessages", {
        params: { id },
        body: { text },
      });
      setText("");
      await result.refetch();
    } catch (reason) {
      setError(reason);
      if (
        reason &&
        typeof reason === "object" &&
        "status" in reason &&
        reason.status === 403
      )
        setDenied(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`Order messages · ${labelOf(order.number || order.unitId)}`}
      onClose={onClose}
      wide
    >
      <div className="live-dialog-body">
        {result.isPending ? (
          <Loading />
        ) : result.error ? (
          <ErrorNotice
            error={result.error}
            retry={() => void result.refetch()}
          />
        ) : !result.data?.data.length ? (
          <Empty
            title="No messages yet"
            detail="Messages for this order appear here."
          />
        ) : (
          <div className="live-messages">
            {[...result.data.data].reverse().map((message, index) => (
              <article key={idOf(message) || index}>
                <header>
                  <strong>{labelOf(message.sender)}</strong>
                  <time>
                    {message.createdAt
                      ? new Date(String(message.createdAt)).toLocaleString()
                      : ""}
                  </time>
                </header>
                <p>{labelOf(message.text)}</p>
              </article>
            ))}
          </div>
        )}
        {(result.data?.meta?.pages || 1) > 1 && (
          <div className="live-inline-actions">
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Newer
            </Button>
            <span>Page {page}</span>
            <Button
              variant="secondary"
              disabled={page >= (result.data?.meta?.pages || 1)}
              onClick={() => setPage(page + 1)}
            >
              Older
            </Button>
          </div>
        )}
        {!canSend && (
          <p className="live-form-note">
            {closed
              ? "This order is complete or cancelled. Its messages are read-only."
              : denied
                ? "Messaging is restricted to the participants in this order."
                : "Messages become available after a driver is assigned."}
          </p>
        )}
        <form
          className="live-inline-form"
          onSubmit={(event) => void send(event)}
        >
          <label className="field">
            <span>Message</span>
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={2000}
              disabled={!canSend || busy}
              required
            />
          </label>
          <Button type="submit" disabled={!canSend || busy || !text.trim()}>
            {busy ? "Sending…" : "Send message"}
          </Button>
        </form>
        {!!error && <ErrorNotice error={error} />}
      </div>
    </Modal>
  );
}
