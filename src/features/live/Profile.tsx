import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Globe,
  ImagePlus,
  KeyRound,
  LoaderCircle,
  MapPin,
  Phone,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Modal, PageTitle, Panel } from "../../components/ui";
import { apiBaseUrl } from "../../services/api/environment";
import type { AuthUser } from "../../services/api/tokens";
import { liveAuth } from "../../services/api/liveAuth";
import { useAppStore } from "../../store";
import {
  contracts,
  idOf,
  labelOf,
  stationRequest,
  uploadFile,
  validate,
  type Row,
  type Schema,
} from "../../services/api/station";
import {
  Details,
  ErrorNotice,
  FileView,
  Loading,
  MutationDialog,
  useLive,
  useRefresh,
} from "./shared";
const days = [
  ["sun", "Sunday"],
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
];
type Hours = Record<string, { open: string; close: string; closed: boolean }>;
function emptyHours() {
  return Object.fromEntries(
    days.map(([key]) => [
      key,
      { open: "00:00", close: "00:00", closed: false },
    ]),
  ) as Hours;
}
function PhotoUpload({
  photos,
  stationId,
  onChange,
  onUploading,
}: {
  photos: string[];
  stationId?: string;
  onChange: (photos: string[]) => void;
  onUploading: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    urls = useRef(new Set<string>()),
    alive = useRef(true),
    lock = useRef(false);
  const [previews, setPreviews] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [dragging, setDragging] = useState(false),
    [error, setError] = useState<unknown>(null),
    [count, setCount] = useState("");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      for (const url of urls.current) URL.revokeObjectURL(url);
      onUploading(false);
    };
  }, [onUploading]);
  async function upload(files: File[]) {
    if (!files.length || lock.current) return;
    lock.current = true;
    setBusy(true);
    onUploading(true);
    setError(null);
    const next = [...photos];
    try {
      for (const [index, file] of files.entries()) {
        if (!alive.current) return;
        setCount(`${index + 1} of ${files.length}`);
        if (next.length >= 20)
          throw new Error(
            "A station can have up to 20 photos. Remove a photo before adding another.",
          );
        if (!["image/jpeg", "image/png"].includes(file.type))
          throw new Error("Choose JPEG or PNG photos.");
        const result = await uploadFile(file);
        if (!alive.current) return;
        if (!result.data.id)
          throw new Error("The server did not return a file ID.");
        const url = URL.createObjectURL(file);
        urls.current.add(url);
        setPreviews((previous) => ({ ...previous, [result.data.id]: url }));
        next.push(result.data.id);
        onChange([...next]);
      }
    } catch (reason) {
      if (alive.current) setError(reason);
    } finally {
      lock.current = false;
      if (alive.current) {
        setBusy(false);
        onUploading(false);
      }
    }
  }
  return (
    <div className="live-upload">
      <input
        className="live-hidden-input"
        type="file"
        ref={input}
        aria-label="Upload station photos"
        multiple
        accept="image/jpeg,image/png"
        disabled={busy}
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          event.target.value = "";
          void upload(files);
        }}
      />
      <div
        className={`live-dropzone ${dragging ? "dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!busy) void upload(Array.from(event.dataTransfer.files));
        }}
      >
        <span className="live-upload-icon">
          {busy ? (
            <LoaderCircle className="spin" size={28} />
          ) : (
            <UploadCloud size={28} />
          )}
        </span>
        <h3>
          {busy ? `Uploading photo ${count}` : "Show your station at its best"}
        </h3>
        <p>Drag your photos here, or browse to choose images.</p>
        <Button
          variant="secondary"
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          <ImagePlus size={16} />
          {photos.length ? "Add more photos" : "Browse photos"}
        </Button>
        <small>JPG or PNG · Up to 5 MB each · Maximum 20 photos</small>
      </div>
      <div className="live-photo-count" role="status">
        <span>{busy ? "Uploading…" : `${photos.length} photos added`}</span>
        {photos.length > 0 && (
          <span>
            <CheckCircle2 size={14} />
            Uploaded securely
          </span>
        )}
      </div>
      {photos.length > 0 && (
        <div className="live-photo-grid">
          {photos.map((id, index) => (
            <figure key={id} className="live-photo-card">
              <div>
                {previews[id] ? (
                  <img src={previews[id]} alt={`Station photo ${index + 1}`} />
                ) : stationId ? (
                  <img
                    src={`${apiBaseUrl}/public/stations/${encodeURIComponent(stationId)}/photos/${encodeURIComponent(id)}`}
                    alt={`Station photo ${index + 1}`}
                  />
                ) : (
                  <FileView value={id} imageOnly />
                )}
                <button
                  type="button"
                  className="live-photo-remove"
                  aria-label={`Remove photo ${index + 1}`}
                  disabled={busy}
                  onClick={() =>
                    onChange(photos.filter((photo) => photo !== id))
                  }
                >
                  <Trash2 size={15} />
                </button>
                <span>
                  <CheckCircle2 size={12} />
                  Uploaded
                </span>
              </div>
              <figcaption>
                Station photo {String(index + 1).padStart(2, "0")}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {!!error && <ErrorNotice error={error} />}
    </div>
  );
}
export function StationProfile() {
  const result = useLive("getStationProfile"),
    refresh = useRefresh();
  const [form, setForm] = useState<Row | null>(null),
    [uploading, setUploading] = useState(false),
    [review, setReview] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [facility, setFacility] = useState("");
  const lock = useRef(false);
  const data = result.data?.data;
  const station =
    data?.station && typeof data.station === "object"
      ? (data.station as Row)
      : data;
  useEffect(() => {
    if (station && !form) {
      const values = Object.fromEntries(
        Object.keys(contracts.patchStationProfile.body.properties).map(
          (key) => [key, station[key] ?? ""],
        ),
      );
      values.photos = Array.isArray(station.photos)
        ? station.photos.map(idOf).filter(Boolean)
        : [];
      values.facilities = Array.isArray(station.facilities)
        ? station.facilities
        : [];
      values.workingHours = {
        ...emptyHours(),
        ...((station.workingHours as Hours) || {}),
      };
      setForm(values);
    }
  }, [station, form]);
  function change(name: string, value: unknown) {
    setForm((previous) => ({ ...previous, [name]: value }));
    setReview(null);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form || uploading) return;
    setError(null);
    try {
      setReview(
        validate(contracts.patchStationProfile.body as Schema, form) as Row,
      );
    } catch (reason) {
      setError(reason);
    }
  }
  async function save() {
    if (!review || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await stationRequest("patchStationProfile", {
        body: review,
      });
      await refresh();
      toast.success(response.message);
      setReview(null);
    } catch (reason) {
      setError(reason);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (result.isPending)
    return <Loading label="Loading your station profile…" />;
  if (result.error)
    return (
      <ErrorNotice error={result.error} retry={() => void result.refetch()} />
    );
  if (!form) return null;
  const hours = form.workingHours as Hours,
    photos = form.photos as string[],
    facilities = form.facilities as string[];
  const field = (name: string, title: string, type = "text") => (
    <label
      className={`field ${name === "address" || name === "description" ? "live-field-wide" : ""}`}
      key={name}
    >
      <span>{title}</span>
      {["address", "description"].includes(name) ? (
        <textarea
          value={String(form[name] || "")}
          rows={name === "address" ? 2 : 3}
          onChange={(event) => change(name, event.target.value)}
        />
      ) : (
        <input
          type={type}
          value={String(form[name] || "")}
          onChange={(event) => change(name, event.target.value)}
        />
      )}
    </label>
  );
  return (
    <>
      <PageTitle
        eyebrow="YOUR STATION PROFILE"
        title="Make a great first impression."
        description="Keep your contact details, opening hours and photos up to date for customers."
      />
      <div className="live-station-profile-banner">
        <span>
          <Building2 size={31} />
        </span>
        <div>
          <h2>{labelOf(station?.name)}</h2>
          <p>
            <MapPin size={14} />
            {labelOf(station?.address)}
          </p>
        </div>
        <span className="live-station-id">{idOf(station)}</span>
      </div>
      <form
        className="live-profile-form"
        onSubmit={(event) => void submit(event)}
      >
        <fieldset disabled={busy}>
          <Panel
            title="Station details"
            subtitle="Tell customers a little about your station"
          >
            <div className="live-form-grid">
              {field("name", "Station name")}
              {field("description", "About your station")}
            </div>
          </Panel>
          <Panel
            title="Location & contact"
            subtitle="Help customers find and reach your station"
          >
            <div className="live-form-grid">
              {field("address", "Street address")}
              {field("city", "City")}
              {field("state", "State / region")}
              {field("postalCode", "Postal code")}
              {field("email", "Station email", "email")}
              {field("phone", "Phone number", "tel")}
              {field("timezone", "Timezone")}
              <p className="live-field-hint">
                Use an IANA timezone such as Africa/Brazzaville. Location
                coordinates are maintained by your administrator.
              </p>
            </div>
          </Panel>
          <Panel
            title="Working hours"
            subtitle="Times use your station’s timezone"
          >
            <div className="live-hours-heading">
              <span>Day</span>
              <span>Opens</span>
              <span>Closes</span>
              <span>Closed</span>
            </div>
            <div className="live-hours">
              {days.map(([key, name]) => (
                <div key={key}>
                  <strong>{name}</strong>
                  <input
                    type="time"
                    aria-label={`${name} opening time`}
                    value={hours[key].open}
                    disabled={hours[key].closed}
                    required
                    onChange={(event) =>
                      change("workingHours", {
                        ...hours,
                        [key]: { ...hours[key], open: event.target.value },
                      })
                    }
                  />
                  <input
                    type="time"
                    aria-label={`${name} closing time`}
                    value={hours[key].close}
                    disabled={hours[key].closed}
                    required
                    onChange={(event) =>
                      change("workingHours", {
                        ...hours,
                        [key]: { ...hours[key], close: event.target.value },
                      })
                    }
                  />
                  <input
                    type="checkbox"
                    aria-label={`${name} closed`}
                    checked={hours[key].closed}
                    onChange={(event) =>
                      change("workingHours", {
                        ...hours,
                        [key]: { ...hours[key], closed: event.target.checked },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </Panel>
          <Panel
            title="Facilities"
            subtitle="Services your customers can expect"
          >
            <div className="live-facility-chips">
              {facilities.map((item) => (
                <span key={item}>
                  {item}
                  <button
                    type="button"
                    aria-label={`Remove ${item}`}
                    onClick={() =>
                      change(
                        "facilities",
                        facilities.filter((value) => value !== item),
                      )
                    }
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
            <div className="live-facility-add">
              <input
                aria-label="Facility name"
                value={facility}
                maxLength={60}
                onChange={(event) => setFacility(event.target.value)}
                placeholder="e.g. Restroom, Car Wash or Convenience Store"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (
                      facility.trim() &&
                      !facilities.includes(facility.trim()) &&
                      facilities.length < 30
                    ) {
                      change("facilities", [...facilities, facility.trim()]);
                      setFacility("");
                    }
                  }
                }}
              />
              <Button
                variant="secondary"
                disabled={
                  !facility.trim() ||
                  facilities.includes(facility.trim()) ||
                  facilities.length >= 30
                }
                onClick={() => {
                  change("facilities", [...facilities, facility.trim()]);
                  setFacility("");
                }}
              >
                <Plus size={15} />
                Add facility
              </Button>
            </div>
          </Panel>
          <Panel
            title="Station photos"
            subtitle="Clear photos of your entrance, forecourt and customer facilities"
          >
            <PhotoUpload
              photos={photos}
              stationId={idOf(station)}
              onChange={(value) => change("photos", value)}
              onUploading={setUploading}
            />
          </Panel>
        </fieldset>
        {!!error && <ErrorNotice error={error} />}
        <div className="live-sticky-save">
          <span>
            <ShieldCheck size={15} />
            Changes apply to your station profile.
          </span>
          <Button type="submit" disabled={busy || uploading}>
            <Save size={16} />
            {uploading ? "Uploading photos…" : "Review changes"}
          </Button>
        </div>
      </form>
      {review && (
        <Modal
          title="Review station profile"
          wide
          onClose={() => {
            if (!busy) setReview(null);
          }}
        >
          <div className="live-dialog-body">
            <p className="live-form-note">
              Confirm your station details before publishing these changes.
            </p>
            <Details data={{ ...review, photos: `${photos.length} photos` }} />
            {!!error && <ErrorNotice error={error} />}
            <div className="form-footer">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setReview(null)}
              >
                Continue editing
              </Button>
              <Button disabled={busy} onClick={() => void save()}>
                {busy ? "Saving…" : "Confirm & save profile"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
export function AccountSettings() {
  const profile = useLive("getSharedProfile"),
    refresh = useRefresh();
  const navigate = useNavigate(),
    client = useQueryClient();
  const session = useAppStore((s) => s.session),
    setSession = useAppStore((s) => s.setSession),
    theme = useAppStore((s) => s.theme),
    setTheme = useAppStore((s) => s.setTheme);
  const [dialog, setDialog] = useState<"profile" | "password" | "pin" | null>(
      null,
    ),
    [photo, setPhoto] = useState(""),
    [uploading, setUploading] = useState(false),
    [uploadError, setUploadError] = useState<unknown>(null);
  const data = profile.data?.data;
  async function avatar(file?: File) {
    if (!file || uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      if (!file.type.startsWith("image/"))
        throw new Error("Choose a JPEG or PNG photo.");
      const result = await uploadFile(file);
      await stationRequest("patchSharedProfile", {
        body: { photoId: result.data.id },
      });
      setPhoto(result.data.id);
      await refresh();
      toast.success("Profile photo updated.");
    } catch (reason) {
      setUploadError(reason);
    } finally {
      setUploading(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="ACCOUNT SETTINGS"
        title="A workspace that feels like yours."
        description="Manage your personal profile, account security and display preferences."
      />
      {profile.isPending ? (
        <Loading />
      ) : profile.error ? (
        <ErrorNotice
          error={profile.error}
          retry={() => void profile.refetch()}
        />
      ) : (
        <div className="live-account-grid">
          <Panel
            title="Your profile"
            subtitle="The account linked to this station"
          >
            <div className="live-account-person">
              <span className="live-account-avatar">
                {photo || data?.photo ? (
                  <FileView value={photo || data?.photo} imageOnly />
                ) : (
                  <UserRound size={29} />
                )}
              </span>
              <div>
                <h2>{labelOf(data?.name || session?.name)}</h2>
                <p>{labelOf(data?.email || session?.email)}</p>
                <small>Station partner</small>
              </div>
            </div>
            <label className="field">
              <span>Profile photo</span>
              <input
                type="file"
                aria-label="Change profile photo"
                accept="image/jpeg,image/png"
                disabled={uploading}
                onChange={(event) => void avatar(event.target.files?.[0])}
              />
            </label>
            {uploading && <small role="status">Uploading profile photo…</small>}
            {!!uploadError && <ErrorNotice error={uploadError} />}
            <Button variant="secondary" onClick={() => setDialog("profile")}>
              <PencilIcon />
              Edit profile
            </Button>
          </Panel>
          <Panel
            title="Security"
            subtitle="Keep your account and POS actions protected"
          >
            <div className="live-setting-row">
              <span>
                <KeyRound size={20} />
              </span>
              <div>
                <h3>Account password</h3>
                <p>Changing your password signs out existing sessions.</p>
              </div>
              <Button variant="secondary" onClick={() => setDialog("password")}>
                Change
              </Button>
            </div>
            <div className="live-setting-row">
              <span>
                <ShieldCheck size={20} />
              </span>
              <div>
                <h3>POS dispensing PIN</h3>
                <p>A six-digit PIN protects fuel dispensing.</p>
              </div>
              <Button variant="secondary" onClick={() => setDialog("pin")}>
                Set PIN
              </Button>
            </div>
          </Panel>
          <Panel
            title="Phone verification"
            subtitle="Verify your registered phone number"
          >
            <PhoneVerification
              phone={String(data?.phone || "")}
              verified={data?.phoneVerified === true}
            />
          </Panel>
          <Panel
            title="Display preferences"
            subtitle="Choose a comfortable interface"
          >
            <div className="live-setting-row">
              <span>
                <Globe size={20} />
              </span>
              <div>
                <h3>Interface theme</h3>
                <p>Saved on this device.</p>
              </div>
              <select
                aria-label="Interface theme"
                value={theme}
                onChange={(event) =>
                  setTheme(event.target.value as "light" | "dark")
                }
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </Panel>
        </div>
      )}
      {dialog === "profile" && (
        <MutationDialog
          title="Edit your profile"
          operation="patchSharedProfile"
          fields={[
            { name: "name", label: "Full name" },
            {
              name: "language",
              label: "Preferred language",
              options: [
                { value: "en", label: "English" },
                { value: "fr", label: "Français" },
              ],
            },
          ]}
          initial={{
            name: data?.name || session?.name,
            language: data?.language || "en",
          }}
          onSuccess={(result) => {
            liveAuth.updateUser(result as AuthUser);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "password" && (
        <MutationDialog
          title="Change account password"
          operation="postSharedProfilePassword"
          fields={[
            {
              name: "currentPassword",
              label: "Current password",
              type: "password",
            },
            {
              name: "newPassword",
              label: "New password",
              type: "password",
              help: "Use 10–128 characters.",
            },
            {
              name: "confirmPassword",
              label: "Confirm new password",
              type: "password",
            },
          ]}
          transform={(values) => {
            if (values.newPassword !== values.confirmPassword)
              throw new Error("The new passwords do not match.");
            return values;
          }}
          help="After a successful password change, sign in again with your new password."
          onSuccess={() => {
            setSession(null);
            client.clear();
            navigate("/auth/login", { replace: true });
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "pin" && (
        <MutationDialog
          title="Set POS dispensing PIN"
          operation="postSharedProfilePin"
          fields={[
            { name: "password", label: "Account password", type: "password" },
            { name: "pin", label: "New six-digit PIN", type: "password" },
            { name: "confirmPin", label: "Confirm PIN", type: "password" },
          ]}
          transform={(values) => {
            if (values.pin !== values.confirmPin)
              throw new Error("The PIN values do not match.");
            return values;
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
function PencilIcon() {
  return <UserRound size={16} />;
}
function PhoneVerification({
  phone,
  verified,
}: {
  phone: string;
  verified: boolean;
}) {
  const [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState(""),
    [resendAt, setResendAt] = useState(0),
    [now, setNow] = useState(Date.now());
  const refresh = useRefresh();
  useEffect(() => {
    if (!resendAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  async function request() {
    if (busy || Date.now() < resendAt) return;
    setBusy(true);
    setError(null);
    try {
      const result = await liveAuth.requestOtp(phone, "LOGIN");
      setResendAt(Date.now() + result.resendAfter * 1000);
      setNotice(
        "A verification code has been requested for your registered phone.",
      );
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await stationRequest("postSharedProfileVerifyPhone", {
        body: { code },
      });
      await refresh();
      setNotice(response.message);
      setCode("");
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  if (!phone)
    return (
      <p className="muted">
        No phone number is assigned to this account. Contact your administrator
        to add one.
      </p>
    );
  return verified ? (
    <p className="live-success">
      <CheckCircle2 size={16} />
      {phone} is verified.
    </p>
  ) : (
    <div className="live-form">
      <p>{phone}</p>
      <Button
        variant="secondary"
        onClick={() => void request()}
        disabled={busy || now < resendAt}
      >
        <Phone size={15} />
        {now < resendAt
          ? `Resend in ${Math.ceil((resendAt - now) / 1000)}s`
          : "Request verification code"}
      </Button>
      <form
        className="live-inline-form"
        onSubmit={(event) => void verify(event)}
      >
        <label className="field">
          <span>Verification code</span>
          <input
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          />
        </label>
        <Button type="submit" disabled={busy || code.length !== 6}>
          Verify phone
        </Button>
      </form>
      {notice && (
        <p role="status" className="live-form-note">
          {notice}
        </p>
      )}
      {!!error && <ErrorNotice error={error} />}
    </div>
  );
}
