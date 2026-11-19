import { useRef, useState, type FormEvent } from "react";
import {
  Check,
  CheckCircle2,
  CreditCard,
  Fuel,
  KeyRound,
  LoaderCircle,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Modal, PageTitle, Panel } from "../../components/ui";
import {
  contracts,
  stationRequest,
  validate,
  type Row,
  type Schema,
} from "../../services/api/station";
import { Details, ErrorNotice, PrintableReceipt, useRefresh } from "./shared";
export function DispensePage() {
  const [method, setMethod] = useState<"QR" | "RFID">("QR"),
    [deviceToken, setDeviceToken] = useState(""),
    [credential, setCredential] = useState(""),
    [verified, setVerified] = useState<Row | null>(null),
    [quantity, setQuantity] = useState(""),
    [mileage, setMileage] = useState(""),
    [pin, setPin] = useState(""),
    [busy, setBusy] = useState(false),
    [review, setReview] = useState<Row | null>(null),
    [receipt, setReceipt] = useState<Row | null>(null),
    [error, setError] = useState<unknown>(null);
  const lock = useRef(false),
    refresh = useRefresh();
  const credentialBody = () =>
    method === "QR"
      ? { token: credential.trim() }
      : { cardUid: credential.trim() };
  function resetVerification() {
    setVerified(null);
    setReview(null);
    setPin("");
    setError(null);
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!credential.trim())
        throw new Error("Scan or enter an authorization credential.");
      const response = await stationRequest("postStationAuthorizationsVerify", {
        body: credentialBody(),
        deviceToken,
      });
      setVerified(response.data);
      toast.success(response.message);
    } catch (reason) {
      setError(reason);
      setVerified(null);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function prepare(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (!verified) throw new Error("Verify a credential before dispensing.");
      const body = validate(contracts.postStationDispenses.body as Schema, {
        credential: credentialBody(),
        quantityLitres: quantity,
        mileage,
        pin,
      }) as Row;
      setReview(body);
    } catch (reason) {
      setError(reason);
    }
  }
  async function dispense() {
    if (!review || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await stationRequest("postStationDispenses", {
        body: review,
        deviceToken,
      });
      const issued = response.data.receipt as Row | undefined;
      setReceipt(
        issued
          ? {
              ...response.data,
              receipt: {
                ...issued,
                fuel: verified?.fuel || issued.fuel,
                company: verified?.company || issued.company,
                employee: verified?.employee || issued.employee,
                vehicle: verified?.vehicle || issued.vehicle,
              },
            }
          : response.data,
      );
      setReview(null);
      setVerified(null);
      setCredential("");
      setPin("");
      setQuantity("");
      setMileage("");
      await refresh();
      toast.success(response.message);
    } catch (reason) {
      setError(reason);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="SECURE FUEL DISPENSING"
        title="Verify first. Dispense with confidence."
        description="Validate an assigned QR or RFID authorization, then record fuel dispensing using your POS device token and operator PIN."
      />
      <div className="live-dispense-steps">
        <span className={verified ? "complete" : "active"}>
          <i>{verified ? <Check size={13} /> : "1"}</i>Verify credential
        </span>
        <b />
        <span className={verified ? "active" : ""}>
          <i>2</i>Dispense fuel
        </span>
        <b />
        <span>
          <i>3</i>Receipt
        </span>
      </div>
      <div className="live-dispense-grid">
        <Panel
          title="Verify authorization"
          subtitle="Your device must belong to this station"
        >
          <form className="live-form" onSubmit={(event) => void verify(event)}>
            <fieldset disabled={busy}>
              <label className="field">
                <span>POS device token *</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={deviceToken}
                  required
                  onChange={(event) => {
                    setDeviceToken(event.target.value);
                    resetVerification();
                  }}
                  placeholder="Token issued by your administrator"
                />
                <small>
                  Device credentials stay in memory and are cleared when this
                  page closes.
                </small>
              </label>
              <div className="live-credential-tabs">
                <button
                  type="button"
                  className={method === "QR" ? "active" : ""}
                  onClick={() => {
                    setMethod("QR");
                    setCredential("");
                    resetVerification();
                  }}
                >
                  <QrCode size={18} />
                  QR credential
                </button>
                <button
                  type="button"
                  className={method === "RFID" ? "active" : ""}
                  onClick={() => {
                    setMethod("RFID");
                    setCredential("");
                    resetVerification();
                  }}
                >
                  <CreditCard size={18} />
                  RFID card
                </button>
              </div>
              <label className="field">
                <span>
                  {method === "QR" ? "Scanned QR token" : "RFID card UID"} *
                </span>
                <input
                  required
                  autoComplete="off"
                  value={credential}
                  onChange={(event) => {
                    setCredential(event.target.value);
                    resetVerification();
                  }}
                  placeholder={
                    method === "QR"
                      ? "Scan or paste the QR token"
                      : "Tap a card reader or enter the UID"
                  }
                />
                <small>
                  Use the authorization token, rather than a receipt or
                  authorization ID.
                </small>
              </label>
              <Button
                type="submit"
                disabled={busy || !deviceToken.trim() || !credential.trim()}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <ShieldCheck size={16} />
                )}
                Verify authorization
              </Button>
            </fieldset>
          </form>
          {verified && (
            <div className="live-verification-success">
              <span>
                <CheckCircle2 size={18} />
                Authorization verified
              </span>
              <Details data={verified} />
            </div>
          )}
        </Panel>
        <Panel
          title="Dispensing details"
          subtitle="A successful confirmation charges the company wallet and deducts station stock"
        >
          {!verified ? (
            <div className="live-dispense-placeholder">
              <span>
                <Fuel size={38} />
              </span>
              <h3>Ready when you are</h3>
              <p>
                Verify an authorization to enter the fuel quantity, mileage and
                dispensing PIN.
              </p>
            </div>
          ) : (
            <form className="live-form" onSubmit={prepare}>
              <fieldset disabled={busy}>
                <label className="field">
                  <span>Quantity (litres) *</span>
                  <input
                    type="number"
                    required
                    min="0.001"
                    max="100000"
                    step="0.001"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Vehicle mileage *</span>
                  <input
                    type="number"
                    required
                    min="0"
                    max="10000000"
                    step="1"
                    value={mileage}
                    onChange={(event) => setMileage(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Six-digit dispensing PIN *</span>
                  <input
                    type="password"
                    autoComplete="off"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={pin}
                    onChange={(event) =>
                      setPin(event.target.value.replace(/\D/g, ""))
                    }
                  />
                </label>
                <Button type="submit" disabled={busy}>
                  <Fuel size={16} />
                  Review dispensing
                </Button>
              </fieldset>
            </form>
          )}
          <div className="live-security-note">
            <KeyRound size={16} />
            <span>
              Your PIN is never saved. If the connection is interrupted, retry
              with the same details to avoid a duplicate transaction.
            </span>
          </div>
        </Panel>
      </div>
      {!!error && <ErrorNotice error={error} />}
      {review && (
        <Modal
          title="Confirm fuel dispensing"
          onClose={() => {
            if (!busy) setReview(null);
          }}
        >
          <div className="live-dialog-body">
            <p className="live-form-note">
              Confirm that this quantity has been physically dispensed. The
              company wallet and station stock will be updated.
            </p>
            <dl className="live-confirm-summary">
              <div>
                <dt>Fuel quantity</dt>
                <dd>{quantity} litres</dd>
              </div>
              <div>
                <dt>Vehicle mileage</dt>
                <dd>{Number(mileage).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Authorization method</dt>
                <dd>{method}</dd>
              </div>
            </dl>
            {!!error && <ErrorNotice error={error} />}
            <div className="form-footer">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setReview(null)}
              >
                Go back
              </Button>
              <Button disabled={busy} onClick={() => void dispense()}>
                {busy ? "Recording…" : "Confirm dispensing"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {receipt && (
        <Modal
          title="Fuel dispensed successfully"
          wide
          onClose={() => setReceipt(null)}
        >
          <div className="live-dialog-body">
            <p className="live-success">
              <CheckCircle2 size={17} />
              Dispensing recorded successfully.
            </p>
            <PrintableReceipt receipt={(receipt.receipt as Row) || receipt} />
            <div className="form-footer">
              <Button variant="secondary" onClick={() => setReceipt(null)}>
                Close
              </Button>
              <Button onClick={() => window.print()}>Print receipt</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
