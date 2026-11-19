import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowLeftRight,
  Bell,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  FileBarChart2,
  FileText,
  Fuel,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorSmartphone,
  Package,
  Search,
  Settings,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Brand } from "../auth/Auth";
import { useAppStore } from "../../store";
import {
  idOf,
  labelOf,
  publicRequest,
  stationRequest,
  type Row,
} from "../../services/api/station";
import { useLive } from "./shared";
const groups = [
  {
    label: "STATION WORKSPACE",
    items: [
      { path: "dashboard", label: "Overview", Icon: LayoutDashboard },
      { path: "orders", label: "Delivery requests", Icon: ClipboardList },
      { path: "dispense", label: "Fuel dispensing", Icon: Fuel },
      { path: "fuel-prices", label: "Fuel prices", Icon: ArrowLeftRight },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { path: "inventory", label: "Fuel inventory", Icon: Package },
      { path: "authorizations", label: "Authorizations", Icon: ShieldCheck },
      { path: "transactions", label: "Transactions", Icon: ArrowLeftRight },
      { path: "pos-devices", label: "POS devices", Icon: MonitorSmartphone },
      { path: "settlements", label: "Settlements", Icon: Wallet },
      { path: "reports", label: "Reports", Icon: FileBarChart2 },
    ],
  },
  {
    label: "YOUR WORKSPACE",
    items: [
      { path: "stations", label: "Station profile", Icon: Building2 },
      { path: "notifications", label: "Notifications", Icon: Bell },
      { path: "wallet", label: "Wallet & ledger", Icon: Wallet },
      { path: "support", label: "Partner support", Icon: CircleHelp },
      { path: "files", label: "Private files", Icon: FileText },
      { path: "settings", label: "Account settings", Icon: Settings },
    ],
  },
];
export function PartnerLayout() {
  const session = useAppStore((s) => s.session),
    setSession = useAppStore((s) => s.setSession),
    setStation = useAppStore((s) => s.setStation);
  const [mobile, setMobile] = useState(false),
    [menu, setMenu] = useState(false),
    [search, setSearch] = useState(""),
    [signingOut, setSigningOut] = useState(false);
  const location = useLocation(),
    navigate = useNavigate(),
    client = useQueryClient();
  const profile = useLive("getStationProfile"),
    notifications = useLive<Row[]>("getSharedNotifications", {
      page: 1,
      limit: 100,
    });
  useQuery({
    queryKey: ["public-config"],
    queryFn: () => publicRequest("/public/config"),
    staleTime: 300000,
  });
  const raw = profile.data?.data;
  const station =
    raw?.station && typeof raw.station === "object"
      ? (raw.station as Row)
      : raw;
  useEffect(() => {
    setMobile(false);
    setMenu(false);
    setSearch("");
  }, [location.pathname]);
  useEffect(() => {
    if (station && idOf(station)) setStation(idOf(station));
  }, [station, setStation]);
  const unread = Array.isArray(notifications.data?.data)
    ? notifications.data.data.filter((row) => !row.readAt).length
    : 0;
  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await stationRequest("postSharedAuthLogout");
    } catch {
      toast.error(
        "Signed out locally. Server sign-out could not be confirmed.",
      );
    } finally {
      setSession(null);
      client.clear();
      navigate("/auth/login", { replace: true });
    }
  }
  const current = groups
    .flatMap((group) => group.items)
    .find((item) => location.pathname === "/" + item.path);
  return (
    <div className="app-shell live-shell">
      <div
        className={`mobile-scrim ${mobile ? "show" : ""}`}
        onClick={() => setMobile(false)}
      />
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <Link to="/dashboard" aria-label="NeyFuel station overview">
            <Brand withName />
          </Link>
          <span className="partner-tag">STATION PARTNER</span>
          <button
            className="icon-btn mobile-close"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="live-station-switch">
          <span>
            <Building2 size={20} />
          </span>
          <div>
            <strong>
              {station
                ? labelOf(station.name)
                : profile.error
                  ? "Station unavailable"
                  : "Loading station…"}
            </strong>
            <small>{station ? idOf(station) : "Your station workspace"}</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav aria-label="Main navigation">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              {group.items.map(({ path, label, Icon }) => (
                <NavLink
                  key={path}
                  to={"/" + path}
                  className={({ isActive }) =>
                    `nav-item${isActive ? " active" : ""}`
                  }
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {path === "notifications" && unread > 0 && <b>{unread}</b>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="live-sidebar-foot">
          <div>
            <span className="live-dot" />
            <span>
              {profile.error
                ? "Connection needs attention"
                : "Connected workspace"}
            </span>
          </div>
          <button onClick={() => void logout()} disabled={signingOut}>
            <LogOut size={16} />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu size={22} />
          </button>
          <div className="live-breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{current?.label || "Station portal"}</strong>
          </div>
          <div className="header-actions">
            <div className="live-menu-search">
              <Search size={16} />
              <input
                aria-label="Find a page"
                placeholder="Find a page…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <div className="search-results">
                  {groups
                    .flatMap((group) => group.items)
                    .filter((item) =>
                      item.label.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((item) => (
                      <Link key={item.path} to={"/" + item.path}>
                        {item.label}
                        <ChevronRight size={14} />
                      </Link>
                    ))}
                </div>
              )}
            </div>
            <Link
              to="/notifications"
              className="icon-btn notifications-btn"
              aria-label="Open notifications"
            >
              <Bell size={20} />
              {unread > 0 && <i />}
            </Link>
            <div className="profile-menu">
              <button
                className="profile-trigger"
                onClick={() => setMenu(!menu)}
                aria-expanded={menu}
              >
                <span className="avatar">
                  {session?.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <span>
                  <strong>{session?.name}</strong>
                  <small>Station partner</small>
                </span>
                <ChevronDown size={14} />
              </button>
              {menu && (
                <div className="profile-dropdown">
                  <strong>{session?.email}</strong>
                  <Link to="/settings">
                    <Settings size={15} />
                    Account settings
                  </Link>
                  <button onClick={() => void logout()} disabled={signingOut}>
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="page-content live-content">
          <Outlet />
          <footer className="page-footer">
            <span>
              © {new Date().getFullYear()} NeyFuel. Powering partnerships.
            </span>
            <span>
              <ShieldCheck size={13} />
              Secure station workspace
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
