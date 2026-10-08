import React, { useState, useMemo, useRef, useEffect, createContext, useContext } from "react";
import {
  Music2,
  Building2,
  UtensilsCrossed,
  Sparkles,
  Camera,
  Cake,
  ClipboardList,
  Flower2,
  PackageOpen,
  Star,
  MapPin,
  Users,
  Calendar,
  Clock,
  ShoppingBag,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  ArrowRight,
  Plus,
  RefreshCw,
  Trash2,
  PartyPopper,
  Menu,
  Briefcase,
  Shield,
  Instagram,
  MessageCircle,
  Eye,
  EyeOff,
  Search,
  Volume2,
  VolumeX,
  Heart,
  ListChecks,
  Wallet,
  StickyNote,
  Pencil,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Supabase — talked to directly over fetch (no @supabase/supabase-js import)
// so this keeps working inside a plain artifact preview, which only allows a
// fixed set of libraries and can't load arbitrary npm packages. The key
// below is a publishable key, safe to ship in frontend code — access is
// controlled by the Row Level Security policies on the database, not by
// hiding this key.
// ---------------------------------------------------------------------------
const SUPABASE_URL = "https://lhmcrbzdjkihmbubmpcw.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxobWNyYnpkamtpaG1idWJtcGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMDk4NjAsImV4cCI6MjEwNTU4NTg2MH0.RbC31c3BhDdSv2FyZvWa7OTcHMFC_QZ1fK7UVwGLVX0"; // legacy anon key — the newer sb_publishable_ key isn't fully rolled out for REST on this project yet

// Session persistence — now that this runs on real hosting (not the old
// artifact preview sandbox), localStorage works fine and is the right place
// for this: per-browser, never shared between visitors.
const SESSION_STORAGE_KEY = "planifest-session";
const CHAT_POLL_MS = 5000; // how often an open conversation checks for new messages
const INBOX_POLL_MS = 10000; // how often the message bubble checks for unread messages
const SOUND_KEY = "planifest-sound";
const hand = "'Caveat', 'Segoe Script', cursive"; // a little handwriting for notes and margins

// ---- Min planering ----
// Starting checklists per kind of event. w = how many weeks before the event it is a good time to do it.
const TASK_TEMPLATES = {
  wedding: [
    [52, "Bestäm preliminär budget"], [52, "Gör en första gästlista"], [48, "Boka lokal för vigsel och fest"], [44, "Välj och boka fotograf"],
    [40, "Boka catering eller meny"], [36, "Boka DJ eller band"], [32, "Beställ bröllopstårta"], [26, "Skicka ut save-the-date"],
    [20, "Välj blommor och dekor"], [16, "Skicka ut inbjudningar"], [12, "Planera bordsplacering"], [8, "Bekräfta alla leverantörer"],
    [4, "Slutlig gästlista och allergier"], [2, "Gå igenom dagens tidsschema"], [1, "Packa och förbered det sista"],
  ],
  birthday: [
    [12, "Bestäm datum, tema och budget"], [10, "Gör gästlista"], [8, "Boka lokal"], [8, "Skicka inbjudningar"], [6, "Boka DJ eller underhållning"],
    [5, "Beställ tårta"], [4, "Planera mat och dryck"], [3, "Köp dekor och ballonger"], [2, "Bekräfta leverantörer"], [1, "Handla det sista"], [1, "Gå igenom tidsschema"],
  ],
  baptism: [
    [12, "Bestäm datum med dopförrättaren"], [10, "Gör gästlista"], [8, "Boka lokal för kalaset"], [8, "Skicka inbjudningar"], [6, "Fråga faddrar"],
    [5, "Beställ tårta"], [4, "Planera mat och dryck"], [3, "Köp dekor och blommor"], [2, "Bekräfta leverantörer"], [1, "Förbered dopkläder"],
  ],
  graduation: [
    [10, "Bestäm datum och budget"], [8, "Boka lokal"], [8, "Skicka inbjudningar"], [6, "Boka DJ"], [5, "Beställ tårta"],
    [4, "Planera mat och dryck"], [3, "Köp dekor"], [2, "Bekräfta leverantörer"], [1, "Gå igenom tidsschema"],
  ],
  party: [
    [8, "Bestäm datum, tema och budget"], [6, "Gör gästlista och bjud in"], [5, "Boka lokal"], [4, "Boka DJ eller underhållning"],
    [3, "Planera mat och dryck"], [2, "Bekräfta leverantörer"], [1, "Handla det sista"],
  ],
  corporate: [
    [12, "Bestäm syfte och budget"], [10, "Boka lokal"], [8, "Boka catering"], [8, "Skicka inbjudan och be om svar"], [6, "Boka underhållning eller talare"],
    [4, "Planera program och tidsschema"], [3, "Boka fotograf"], [2, "Bekräfta leverantörer och antal gäster"], [1, "Skicka praktisk information till gästerna"],
  ],
  other: [[8, "Bestäm datum och budget"], [6, "Gör gästlista"], [4, "Boka leverantörer"], [2, "Bekräfta allt"]],
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dayNumber = (iso) => {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};
const daysUntil = (iso) => (iso ? dayNumber(iso) - dayNumber(todayISO()) : null);
const addDaysISO = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const shortDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("sv-SE", { day: "numeric", month: "short" }) : "");
const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => ((Math.random() * 16) | 0).toString(16)));
const toMoney = (v) => {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 100000000 ? Math.round(n) : null;
};
// The template as tasks with real due dates (a date already passed just means "do it now").
function buildTemplateTasks(eventType, eventDate, existingTitles = []) {
  const have = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
  return (TASK_TEMPLATES[eventType] || TASK_TEMPLATES.other)
    .filter(([, title]) => !have.has(title.toLowerCase()))
    .map(([weeks, title]) => {
      const due = eventDate ? addDaysISO(eventDate, -weeks * 7) : null;
      return { id: newId(), title, done: false, dueDate: due && due >= todayISO() ? due : null };
    });
}
// ---- Gästlista & RSVP ----
const RSVP_STATUS = {
  yes: { label: "Kommer", bg: "#E3F3E9", fg: "#3D7A52" },
  maybe: { label: "Kanske", bg: "#EFE3EE", fg: "#8B6589" },
  no: { label: "Kan inte", bg: "#FBE4E1", fg: "#A5483F" },
  pending: { label: "Ej svarat", bg: "#EFE6DE", fg: "#8F7A6C" },
};
const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Glutenfri", "Laktosfri", "Nötfri"];
const guestLink = (token) => `${typeof window !== "undefined" ? window.location.origin : ""}/?svara=${token}`;
const eventWhen = (ev) =>
  [ev.date ? new Date(`${ev.date}T00:00:00`).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" }) : "", ev.eventTime ? `kl. ${ev.eventTime}` : ""].filter(Boolean).join(" ");
const invitationText = (ev, guest) =>
  `Hej ${guest.name}! ${(occasionMap[ev.eventType] || occasionMap.other).emoji} Du är bjuden till ${ev.title}${eventWhen(ev) ? ` ${eventWhen(ev)}` : ""}${ev.location ? `, ${ev.location}` : ""}. Svara gärna här: ${guestLink(guest.token)}`;
// On a phone this opens the share sheet (WhatsApp, SMS...); elsewhere it copies the text.
async function shareOrCopy(text, title) {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, text });
      return "shared";
    }
  } catch (e) {
    if (e && e.name === "AbortError") return "cancelled";
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch (e) {
    window.prompt("Kopiera texten:", text);
    return "copied";
  }
}
// Guests are not signed in, so they talk to the database only through two public functions.
async function rpcAnon(name, payload) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { error: { message: data?.message || "error" } };
    return { data };
  } catch (e) {
    return { error: { message: "network" } };
  }
}
const rsvpErrorText = (m = "") =>
  m.includes("closed") ? "Svarstiden har gått ut." : m.includes("name") ? "Skriv ditt namn." : m.includes("toomany") ? "Många svarar just nu. Försök igen om en stund." : m.includes("toolong") ? "Texten är för lång." : m.includes("network") ? "Kunde inte nå servern. Försök igen." : "Länken fungerar inte. Be den som bjudit in dig om en ny.";
const mapGuest = (g) => ({
  id: g.id,
  name: g.name,
  token: g.token,
  status: g.status,
  allowedParty: g.allowed_party,
  partySize: g.party_size,
  dietary: g.dietary || "",
  message: g.message || "",
  source: g.source,
});

const normalizeEvent = (e) => ({
  location: e.location || "",
  eventTime: e.event_time || "",
  inviteMessage: e.invite_message || "",
  rsvpDeadline: e.rsvp_deadline || "",
  inviteToken: e.invite_token || null,
  guestList: (e.event_guests || [])
    .slice()
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map(mapGuest),
  id: e.id,
  title: e.title,
  eventType: e.event_type,
  date: e.event_date || "",
  guests: e.guests,
  budgetTotal: e.budget_total == null ? null : Number(e.budget_total),
  notes: e.notes || "",
  tasks: (e.event_tasks || [])
    .slice()
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map((t) => ({ id: t.id, title: t.title, done: t.done, dueDate: t.due_date || null })),
  budget: (e.event_budget_items || [])
    .slice()
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map((b) => ({ id: b.id, label: b.label, estimated: Number(b.estimated) || 0, actual: b.actual == null ? null : Number(b.actual), paid: b.paid })),
});

// "Sparade": which vendors the customer has saved, available to every heart button without threading props.
const FavoritesContext = createContext({ ids: new Set(), toggle: () => {} });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);

// Guest bookings go through one server function (it checks everything and sets the prices itself).
async function guestRequest(payload) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/guest-booking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { error: data?.error || "Något gick fel. Försök igen." };
    return { data };
  } catch (e) {
    return { error: "Kunde inte nå servern. Kontrollera din uppkoppling och försök igen." };
  }
}

// ---- Request forms: every vendor decides what customers are asked, per category ----
// A form is a list of fields. Choice fields can carry a price (an add-on), which feeds the guide price.
const FIELD_TYPES = [
  ["single", "Ett val"],
  ["multi", "Flera val"],
  ["short", "Kort text"],
  ["long", "Lång text"],
  ["number", "Siffra"],
];
// What every vendor has until they build their own: one open question, so anyone can always be asked something.
const DEFAULT_REQUEST_FIELDS = [{ id: "wishes", label: "Berätta vad du behöver", type: "long", required: true }];
const choices = (labels) => labels.map((label) => ({ label }));
// Starting points per category. Vendors edit these freely (rename, remove, add, price the options).
const REQUEST_TEMPLATES = {
  tarta: [
    { id: "size", label: "Storlek", type: "single", required: true, options: choices([6, 8, 10, 12, 15, 18, 20, 22, 25, 28].map((n) => `${n} bitar`)) },
    { id: "flavor", label: "Smak", type: "single", required: true, options: choices(["Choklad", "Vanilj", "Jordgubb"]) },
    { id: "shape", label: "Form", type: "single", options: choices(["Rund", "Fyrkantig", "Rektangulär", "Hjärta", "Annan form"]) },
    { id: "tiers", label: "Våningar", type: "single", options: choices(["1", "2", "3 eller fler"]) },
    { id: "theme", label: "Tema / design", type: "long" },
    { id: "colors", label: "Färger", type: "short" },
    { id: "text", label: "Text på tårtan", type: "short" },
    { id: "diet", label: "Kostönskemål", type: "multi", options: choices(["Glutenfri", "Laktosfri", "Vegansk", "Nötfri"]) },
    { id: "allergies", label: "Allergier", type: "short" },
    { id: "pickup", label: "Hämtning eller leverans", type: "single", options: choices(["Hämtar själv", "Leverans"]) },
  ],
  dj: [
    { id: "genres", label: "Musikstil och önskemål", type: "long", required: true },
    { id: "venue", label: "Var ska ni vara?", type: "short" },
    { id: "sound", label: "Behöver ni ljudanläggning?", type: "single", options: choices(["Ja", "Nej, det finns på plats"]) },
    { id: "extras", label: "Tillägg", type: "multi", options: choices(["Ljus", "Rökmaskin", "Mikrofon för tal"]) },
    { id: "avoid", label: "Låtar ni inte vill ha", type: "long" },
  ],
  lokal: [
    { id: "setup", label: "Uppställning", type: "single", required: true, options: choices(["Sittande middag", "Stående mingel", "Konferens", "Annat"]) },
    { id: "needs", label: "Behov", type: "multi", options: choices(["Bord och stolar", "Scen", "Ljudanläggning", "Projektor", "Kök"]) },
    { id: "cleaning", label: "Städning", type: "single", options: choices(["Ni städar", "Vi städar själva"]) },
    { id: "notes", label: "Övrigt", type: "long" },
  ],
  catering: [
    { id: "service", label: "Typ av servering", type: "single", required: true, options: choices(["Buffé", "Tallrik", "Tapas och mingel", "Avhämtning"]) },
    { id: "diet", label: "Kostönskemål", type: "multi", options: choices(["Vegetariskt", "Veganskt", "Glutenfritt", "Laktosfritt"]) },
    { id: "allergies", label: "Allergier", type: "short" },
    { id: "staff", label: "Serveringspersonal", type: "single", options: choices(["Behövs", "Behövs inte"]) },
    { id: "menu", label: "Meny och önskemål", type: "long" },
  ],
  dekor: [
    { id: "theme", label: "Tema", type: "long", required: true },
    { id: "colors", label: "Färger", type: "short" },
    { id: "place", label: "Plats", type: "single", options: choices(["Hemma", "Lokal", "Utomhus"]) },
    { id: "mount", label: "Montering och nedmontering", type: "single", options: choices(["Ni sätter upp och tar ner", "Jag fixar själv"]) },
    { id: "extras", label: "Tillägg", type: "multi", options: choices(["Ballongbåge", "Ljusslingor", "Bordsdekor"]) },
  ],
  fotograf: [
    { id: "event", label: "Typ av event", type: "short", required: true },
    { id: "moments", label: "Önskade stunder och motiv", type: "long" },
    { id: "delivery", label: "Leverans", type: "multi", options: choices(["Digitala bilder", "Album", "Tryckta bilder"]) },
    { id: "extras", label: "Tillägg", type: "multi", options: choices(["Extra fotograf", "Snabbleverans"]) },
  ],
  blommor: [
    { id: "kind", label: "Vad behöver ni?", type: "single", required: true, options: choices(["Bukett", "Bordsdekoration", "Brudbukett", "Krans", "Annat"]) },
    { id: "colors", label: "Färger", type: "short" },
    { id: "delivery", label: "Hämtning eller leverans", type: "single", options: choices(["Hämtar själv", "Leverans"]) },
    { id: "card", label: "Text på kortet", type: "short" },
  ],
  uthyrning: [
    { id: "items", label: "Vad vill ni hyra?", type: "long", required: true },
    { id: "count", label: "Antal", type: "number" },
    { id: "delivery", label: "Hämtning eller leverans", type: "single", options: choices(["Hämtar själv", "Leverans"]) },
    { id: "setup", label: "Uppsättning", type: "single", options: choices(["Ni sätter upp", "Jag sätter upp själv"]) },
  ],
};
const newFieldId = () => `n${Date.now().toString(36)}${Math.floor(Math.random() * 36).toString(36)}`.slice(0, 16);

// Cleans a vendor's forms the same way before they are used or saved, so an unfinished field in the
// editor can never make a save fail or show up half-built to customers.
function sanitizeRequestForms(forms) {
  const out = {};
  if (!forms || typeof forms !== "object") return out;
  Object.entries(forms).forEach(([cat, cfg]) => {
    if (!catMap[cat] || !cfg || typeof cfg !== "object") return;
    const ids = new Set();
    const fields = [];
    (Array.isArray(cfg.fields) ? cfg.fields : []).slice(0, 25).forEach((f, i) => {
      const label = String(f?.label ?? "").trim().slice(0, 80);
      const type = FIELD_TYPES.some(([t]) => t === f?.type) ? f.type : null;
      if (!label || !type) return;
      let base = String(f?.id ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 14) || `f${i}`;
      let id = base;
      for (let k = 2; ids.has(id); k++) id = `${base}${k}`.slice(0, 16);
      ids.add(id);
      const field = { id, label, type };
      if (f.required) field.required = true;
      if (type === "single" || type === "multi") {
        const seen = new Set();
        const options = [];
        (Array.isArray(f.options) ? f.options : []).forEach((o) => {
          const ol = String(o?.label ?? "").trim().slice(0, 60);
          if (!ol || seen.has(ol.toLowerCase()) || options.length >= 30) return;
          seen.add(ol.toLowerCase());
          const price = Math.round(Number(o?.price));
          options.push(Number.isFinite(price) && price > 0 && price <= 100000 ? { label: ol, price } : { label: ol });
        });
        if (options.length === 0) return;
        field.options = options;
      }
      fields.push(field);
    });
    const form = { fields };
    if (typeof cfg.direct === "boolean") form.direct = cfg.direct;
    out[cat] = form;
  });
  return out;
}

// What a customer is shown for one category: the vendor's own form, or the one-question default.
// Direct booking only exists when the vendor has a fixed price and hasn't switched it off.
function getRequestConfig(forms, categoryId, hasPrice) {
  const cfg = sanitizeRequestForms(forms)[categoryId];
  const custom = !!cfg?.fields?.length;
  return { fields: custom ? cfg.fields : DEFAULT_REQUEST_FIELDS, direct: hasPrice ? cfg?.direct !== false : false, custom };
}

// Guide price: the base price (if the vendor has one) plus the priced options the customer picked.
function priceFromAnswers(fields, getPicked) {
  let extra = 0;
  fields.forEach((f) => {
    if (f.type !== "single" && f.type !== "multi") return;
    const picked = [].concat(getPicked(f) ?? []);
    f.options.forEach((o) => {
      if (o.price && picked.includes(o.label)) extra += o.price;
    });
  });
  return extra;
}
const BADGE_RED = "#C8554B";

// A short two-note "ping", generated in the browser (no audio file needed).
// Browsers only allow sound after the person has clicked or tapped something on
// the page, so this stays silent until then. That is a browser rule, not a bug.
let pingCtx = null;
function playPing() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    pingCtx = pingCtx || new AC();
    if (pingCtx.state === "suspended" && pingCtx.resume) {
      const r = pingCtx.resume();
      if (r && r.catch) r.catch(() => {});
    }
    const now = pingCtx.currentTime;
    [
      [880, 0],
      [1320, 0.13],
    ].forEach(([freq, offset]) => {
      const osc = pingCtx.createOscillator();
      const gain = pingCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.4);
      osc.connect(gain);
      gain.connect(pingCtx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.45);
    });
  } catch (e) {
    // sound is a nicety, never a reason to break anything
  }
}

const timeLabel = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
};

function loadStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function storeSession(sessionData) {
  try {
    if (sessionData) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    else localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (e) {
    // ignore — e.g. private browsing; session just won't persist across reloads
  }
}

async function supabaseAuthRequest(path, options = {}) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: { message: data.error_description || data.msg || data.error || "Något gick fel." } };
    return { data };
  } catch (e) {
    return { error: { message: "Nådde inte Supabase (nätverksanropet blockerades eller misslyckades): " + (e?.message || "okänt fel") } };
  }
}

async function supabaseRestRequest(path, accessToken, options = {}) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${accessToken || SUPABASE_KEY}`,
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { error: { message: data?.message || "Något gick fel." } };
    return { data };
  } catch (e) {
    return { error: { message: "Nådde inte Supabase (nätverksanropet blockerades eller misslyckades): " + (e?.message || "okänt fel") } };
  }
}

// ---------------------------------------------------------------------------
// Vendor data layer (Fas 6) — maps between the DB's shape (vendors +
// vendor_categories + services + addons + blocked_times) and the local
// object shape the rest of the app already expects (vendor.profile.services
// etc.), so the view components below didn't need to change, only where the
// data comes from and goes to.
// ---------------------------------------------------------------------------
function mapDbVendorToLocal(dbVendor) {
  const priv = (Array.isArray(dbVendor.vendor_private) ? dbVendor.vendor_private[0] : dbVendor.vendor_private) || {};
  return {
    id: dbVendor.id,
    createdAt: dbVendor.created_at,
    requestForms: sanitizeRequestForms(dbVendor.request_forms),
    companyName: dbVendor.company_name,
    organizationNumber: priv.organization_number ?? dbVendor.organization_number,
    contactPerson: priv.contact_person ?? dbVendor.contact_person,
    email: priv.email ?? dbVendor.email,
    phone: priv.phone ?? dbVendor.phone,
    baseLocation: dbVendor.base_location,
    serviceArea: dbVendor.service_area_type ? { type: dbVendor.service_area_type, value: dbVendor.service_area_value } : null,
    categories: (dbVendor.vendor_categories || []).map((vc) => vc.category_id),
    status: dbVendor.status,
    blockedTimes: (dbVendor.blocked_times || []).map((bt) => ({
      id: bt.id,
      date: bt.date,
      startTime: bt.start_time,
      endTime: bt.end_time,
      note: bt.note || "",
    })),
    profile: {
      tagline: dbVendor.tagline || "",
      description: dbVendor.description || "",
      images: dbVendor.images || [],
      services: (dbVendor.services || []).map((s) => ({
        id: s.id,
        name: s.name || "",
        description: s.description || "",
        priceType: s.price_type,
        price: s.price,
        priceNote: s.price_note || "",
        category: s.category_id || "",
      })),
      addons: (dbVendor.addons || []).map((a) => ({ id: a.id, name: a.name || "", price: a.price })),
    },
  };
}

// vendor_private (email, phone, org number, contact person) comes back only for the vendor herself and for admins
const VENDOR_SELECT = "select=*,vendor_categories(category_id),services(*),addons(*),blocked_times(*),vendor_private(*)";

async function fetchVendorByProfileId(profileId, accessToken) {
  return supabaseRestRequest(`/vendors?profile_id=eq.${profileId}&${VENDOR_SELECT}`, accessToken);
}

async function fetchApprovedVendors(accessToken) {
  return supabaseRestRequest(`/vendors?status=eq.approved&${VENDOR_SELECT}`, accessToken);
}

async function fetchAllVendorsForAdmin(accessToken) {
  return supabaseRestRequest(`/vendors?${VENDOR_SELECT}&order=created_at.desc`, accessToken);
}

// ---------------------------------------------------------------------------
// Real chat + quotes (Fas 8) — one conversation per (vendor, customer,
// category), whether it started before or after a booking. Mock/demo
// listings (no real vendorDbId) never reach this — they keep using the
// simulated local-only chat, same as before.
// ---------------------------------------------------------------------------
async function findOrCreateConversation({ vendorId, customerId, categoryId, accessToken }) {
  const { data: existing, error: findError } = await supabaseRestRequest(
    `/conversations?vendor_id=eq.${vendorId}&customer_id=eq.${customerId}&category_id=eq.${categoryId}&select=*`,
    accessToken
  );
  if (findError) return { error: findError };
  if (existing && existing[0]) return { data: existing[0] };
  return supabaseRestRequest("/conversations", accessToken, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ vendor_id: vendorId, customer_id: customerId, category_id: categoryId }),
  }).then(({ data, error }) => (error || !data?.[0] ? { error } : { data: data[0] }));
}

// Creates the vendors row plus its vendor_categories rows for a freshly
// confirmed account. Returns the mapped local-shape vendor on success.
async function createVendorApplication(session, form) {
  const areaOption = SERVICE_AREA_OPTIONS.find((o) => o.type === form.serviceArea);
  const { data, error } = await supabaseRestRequest("/vendors", session.access_token, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      profile_id: session.user.id,
      company_name: form.companyName,
      base_location: form.baseLocation,
      service_area_type: areaOption?.type || null,
      service_area_value: areaOption?.label || null,
      status: "pending",
    }),
  });
  if (error || !data?.[0]) return { error: error || { message: "Kunde inte skapa leverantörsprofilen." } };
  const vendorRow = data[0];
  // Email, phone, organisation number and contact person go in their own locked table (only she and admins can read it).
  const privateDetails = { email: form.email, phone: form.phone, organization_number: form.organizationNumber, contact_person: form.contactPerson };
  const { error: privateError } = await supabaseRestRequest("/vendor_private", session.access_token, {
    method: "POST",
    body: JSON.stringify({ vendor_id: vendorRow.id, ...privateDetails }),
  });
  if (privateError) {
    // the database moves details sent the old way into the locked table by itself
    await supabaseRestRequest(`/vendors?id=eq.${vendorRow.id}`, session.access_token, { method: "PATCH", body: JSON.stringify(privateDetails) });
  }
  if (form.categories.length > 0) {
    await supabaseRestRequest("/vendor_categories", session.access_token, {
      method: "POST",
      body: JSON.stringify(form.categories.map((catId) => ({ vendor_id: vendorRow.id, category_id: catId }))),
    });
  }
  return {
    data: mapDbVendorToLocal({
      ...vendorRow,
      vendor_private: privateDetails,
      vendor_categories: form.categories.map((c) => ({ category_id: c })),
      services: [],
      addons: [],
      blocked_times: [],
    }),
  };
}

// Batch-saves the editable parts of a vendor profile: replaces categories,
// services and addons wholesale (simplest correct approach at this scale)
// and patches the main row's own fields.
async function saveVendorProfile(vendor, accessToken) {
  await supabaseRestRequest(`/vendors?id=eq.${vendor.id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({
      company_name: vendor.companyName,
      base_location: vendor.baseLocation,
      service_area_type: vendor.serviceArea?.type || null,
      service_area_value: vendor.serviceArea?.value || null,
      tagline: vendor.profile.tagline,
      description: vendor.profile.description,
      images: vendor.profile.images,
      request_forms: sanitizeRequestForms(vendor.requestForms),
    }),
  });

  await supabaseRestRequest("/vendor_private?on_conflict=vendor_id", accessToken, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      vendor_id: vendor.id,
      email: vendor.email || null,
      phone: vendor.phone || null,
      organization_number: vendor.organizationNumber || null,
      contact_person: vendor.contactPerson || null,
      updated_at: new Date().toISOString(),
    }),
  });

  await supabaseRestRequest(`/vendor_categories?vendor_id=eq.${vendor.id}`, accessToken, { method: "DELETE" });
  if (vendor.categories.length > 0) {
    await supabaseRestRequest("/vendor_categories", accessToken, {
      method: "POST",
      body: JSON.stringify(vendor.categories.map((c) => ({ vendor_id: vendor.id, category_id: c }))),
    });
  }

  await supabaseRestRequest(`/services?vendor_id=eq.${vendor.id}`, accessToken, { method: "DELETE" });
  if (vendor.profile.services.length > 0) {
    await supabaseRestRequest("/services", accessToken, {
      method: "POST",
      body: JSON.stringify(
        vendor.profile.services.map((s) => ({
          vendor_id: vendor.id,
          category_id: s.category || null,
          name: s.name,
          description: s.description,
          price_type: s.priceType,
          price: Number(s.price) || 0,
          price_note: s.priceNote,
        }))
      ),
    });
  }

  await supabaseRestRequest(`/addons?vendor_id=eq.${vendor.id}`, accessToken, { method: "DELETE" });
  if (vendor.profile.addons.length > 0) {
    await supabaseRestRequest("/addons", accessToken, {
      method: "POST",
      body: JSON.stringify(vendor.profile.addons.map((a) => ({ vendor_id: vendor.id, name: a.name, price: Number(a.price) || 0 }))),
    });
  }
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const colors = {
  cream: "#F6E5DC",
  coral: "#4C3326", // primary CTA / accent — deep espresso brown, not bright coral anymore
  coralDeep: "#382318",
  coralSoft: "#F4DFD6",
  lilac: "#BD9BBD", // dusty mauve secondary accent
  lilacDeep: "#8B6589",
  lilacSoft: "#F1E7F0",
  pink: "#E3C2BD", // dusty rose
  pinkSoft: "#F9EEEC",
  peach: "#E5D5C3", // warm tan
  peachSoft: "#F9F1E7",
  plum: "#4C3326", // primary text — same deep brown as the accent, for a quiet monochrome feel
  plumSoft: "#8F7A6C",
  beige: "#E5D5C3",
  white: "#FFFFFF",
  green: "#5C6B4E", // muted sage, replaces the brighter green for success/available states
};

const serif = "'Fraunces', 'Georgia', serif";
const sans = "'Inter', system-ui, sans-serif";

// ---------------------------------------------------------------------------
// Demo data switch. When false (the default for real visitors) the seed
// vendors, seed bookings and seed vendor applications below are never shown —
// only real data from the database is. Flip to true locally if you ever want
// the sample marketplace back for a demo.
// ---------------------------------------------------------------------------
const SHOW_DEMO_DATA = false;

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const CATEGORIES = [
  { id: "dj", label: "DJ", icon: Music2, tagline: "Musiken som sätter stämningen", tint: "lilacSoft" },
  { id: "lokal", label: "Lokal", icon: Building2, tagline: "Platsen där allt händer", tint: "peachSoft" },
  { id: "catering", label: "Catering", icon: UtensilsCrossed, tagline: "Mat och dryck för dina gäster", tint: "pinkSoft" },
  { id: "dekor", label: "Dekor", icon: Sparkles, tagline: "Färger, ballonger och detaljer", tint: "coralSoft" },
  { id: "fotograf", label: "Fotograf", icon: Camera, tagline: "Minnen värda att spara", tint: "lilacSoft" },
  { id: "tarta", label: "Tårta", icon: Cake, tagline: "Den söta höjdpunkten", tint: "peachSoft" },
  { id: "blommor", label: "Blommor", icon: Flower2, tagline: "Naturliga detaljer som lyfter känslan", tint: "pinkSoft" },
  { id: "uthyrning", label: "Uthyrning", icon: PackageOpen, tagline: "Allt praktiskt på plats", tint: "coralSoft" },
];

const catMap = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const OCCASIONS = [
  { id: "birthday", label: "Födelsedag", emoji: "🎂", boardLabel: "Födelsedagsfest" },
  { id: "wedding", label: "Bröllop", emoji: "💍", boardLabel: "Bröllop" },
  { id: "baptism", label: "Dop", emoji: "👶", boardLabel: "Dop" },
  { id: "graduation", label: "Student", emoji: "🎓", boardLabel: "Studentfest" },
  { id: "party", label: "Fest", emoji: "🎉", boardLabel: "Fest" },
  { id: "corporate", label: "Företagsevent", emoji: "🏢", boardLabel: "Företagsevent" },
  { id: "other", label: "Annat", emoji: "✨", boardLabel: "Din fest" },
];
const occasionMap = Object.fromEntries(OCCASIONS.map((o) => [o.id, o]));

// ---------------------------------------------------------------------------
// Geography (Fas 2A) — kept data-driven so new cities can go live by flipping
// `active` to true, without touching the vendor-signup flow itself.
// ---------------------------------------------------------------------------
const LOCATIONS = [
  { id: "goteborg", name: "Göteborg", active: true },
  { id: "stockholm", name: "Stockholm", active: false },
  { id: "malmo", name: "Malmö", active: false },
  { id: "uppsala", name: "Uppsala", active: false },
  { id: "orebro", name: "Örebro", active: false },
];
const locationMap = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]));
const ACTIVE_LOCATIONS = LOCATIONS.filter((l) => l.active).map((l) => l.id);

// serviceArea.type also doubles as a stable id for the option below.
const SERVICE_AREA_OPTIONS = [
  { type: "city", label: "Endast min stad" },
  { type: "radius25", label: "Inom 25 km" },
  { type: "radius50", label: "Inom 50 km" },
  { type: "region", label: "Hela Västra Götaland" },
  { type: "country", label: "Hela Sverige" },
];

// ---------------------------------------------------------------------------
// Seed vendor applications (Fas 3 demo data) — represents applications that
// already exist in the system so the admin queue isn't empty on first load.
// Real applications submitted through "Bli leverantör" are appended to this
// same array at runtime (see vendorApplications state in App).
// ---------------------------------------------------------------------------
const SEED_VENDOR_APPLICATIONS = [
  {
    id: "VND-2041",
    companyName: "Ljud & Ljus AB",
    organizationNumber: "556677-1234",
    contactPerson: "Jonas Ek",
    email: "jonas@ljudochljus.se",
    phone: "070-123 45 67",
    baseLocation: "goteborg",
    serviceArea: { type: "region", value: "Hela Västra Götaland" },
    categories: ["dj"],
    status: "pending",
    blockedTimes: [],
    profile: {
      tagline: "Proffsljud för fester i alla storlekar",
      description: "Vi har jobbat med ljud och ljus i över tio år och kör allt från bröllop till klubbkvällar.",
      images: ["https://picsum.photos/seed/ljud-ljus/600/420", "https://picsum.photos/seed/ljud-ljus-b/600/420"],
      services: [{ id: "srv-1", name: "DJ-paket kväll", description: "4–6 timmar, eget ljud- och ljussystem.", priceType: "fixed", price: 5200, priceNote: "", category: "dj" }],
      addons: [{ id: "addon-1", name: "Rökmaskin", price: 400 }],
    },
  },
  {
    id: "VND-2042",
    companyName: "Festfixarna Göteborg",
    organizationNumber: "556677-5678",
    contactPerson: "Malin Berg",
    email: "malin@festfixarna.se",
    phone: "073-234 56 78",
    baseLocation: "goteborg",
    serviceArea: { type: "city", value: "Endast min stad" },
    categories: ["dekor", "uthyrning"],
    status: "approved",
    blockedTimes: [],
    profile: {
      tagline: "Vi fixar dekoren så ni slipper",
      description: "Ballonger, dukning och hyrmöbler i fina färger för fest i alla storlekar.",
      images: ["https://picsum.photos/seed/festfixarna/600/420", "https://picsum.photos/seed/festfixarna-b/600/420"],
      services: [
        { id: "srv-1", name: "Dekorpaket", description: "Ballonger, bordsdekor och skyltar.", priceType: "fixed", price: 2200, priceNote: "", category: "dekor" },
        { id: "srv-2", name: "Möbeluthyrning", description: "Bord, stolar och porslin per gäst.", priceType: "per_person", price: 35, priceNote: "", category: "uthyrning" },
      ],
      addons: [{ id: "addon-1", name: "Fotohörna", price: 600 }],
    },
  },
  {
    id: "VND-2043",
    companyName: "Kalasfabriken",
    organizationNumber: "556677-9012",
    contactPerson: "Peter Lund",
    email: "peter@kalasfabriken.se",
    phone: "076-345 67 89",
    baseLocation: "goteborg",
    serviceArea: { type: "country", value: "Hela Sverige" },
    categories: ["catering"],
    status: "rejected",
    blockedTimes: [],
    profile: {
      tagline: "Catering för stora och små kalas",
      description: "Vi levererar smörgåstårtor och buffé till hela Sverige.",
      images: ["https://picsum.photos/seed/kalasfabriken/600/420"],
      services: [{ id: "srv-1", name: "Buffé", description: "Varm buffé för sällskap.", priceType: "per_person", price: 210, priceNote: "", category: "catering" }],
      addons: [],
    },
  },
];

const PROVIDERS = [
  {
    id: "dj-marcus",
    category: "dj",
    name: "DJ Marcus",
    tagline: "För fulla dansgolv och bra energi hela kvällen.",
    rating: 4.9,
    reviews: 37,
    location: "Göteborg",
    pricing: { type: "fixed", amount: 4500, note: "Paket, 4–6 timmar" },
    addons: [
      { id: "smoke", name: "Rökmaskin", price: 500 },
      { id: "extra-speaker", name: "Extra högtalarpar", price: 600 },
    ],
    seed: "dj-marcus",
    available: true,
    blurb:
      "Marcus har lagt musik på över 300 fester i Göteborg, från 30-årskalas till bröllop. Han läser rummet och bygger sättlistan efter stämningen på plats.",
    service:
      "Ljudanläggning för upp till 150 gäster, mikrofon för tal, samt förslag på låtlista i förväg som ni kan justera tillsammans.",
    reviewsList: [
      { name: "Sofia", stars: 5, text: "Dansgolvet var fullt hela kvällen. Marcus kändes som en i gänget direkt." },
      { name: "Erik", stars: 5, text: "Superbra kommunikation innan och grymt hantverk på plats." },
    ],
  },
  {
    id: "beat-bas",
    category: "dj",
    name: "Beat & Bas DJ",
    tagline: "Hög energi och housevibbar till schysst pris.",
    rating: 4.7,
    reviews: 21,
    location: "Göteborg",
    pricing: { type: "per_hour", amount: 800, note: "minst 4 timmar" },
    addons: [],
    seed: "beat-bas",
    available: true,
    blurb:
      "Ung DJ-duo med fokus på house och svensk pop. Prisvärt alternativ för er som vill ha hög energi utan att det kostar skjortan.",
    service: "Egen ljudanläggning, LED-belysning ingår, spelar 4-6 timmar.",
    reviewsList: [
      { name: "Amanda", stars: 5, text: "Peppiga och lyhörda för önskningar hela kvällen." },
      { name: "Johan", stars: 4, text: "Riktigt bra stämning, kom gärna lite tidigare nästa gång för uppriggning." },
    ],
  },
  {
    id: "lokal-bella",
    category: "lokal",
    name: "Lokal Bella",
    tagline: "Ljust loft med gård – perfekt för mingel.",
    rating: 4.8,
    reviews: 52,
    location: "Majorna, Göteborg",
    pricing: { type: "fixed", amount: 8000, note: "Paket, 6 timmar" },
    addons: [{ id: "extra-hour", name: "Extra timme lokalhyra", price: 1200 }],
    seed: "lokal-bella",
    available: true,
    blurb:
      "Ljus loftlokal med plats för upp till 80 gäster, stora fönster och en gård för mingel när vädret tillåter.",
    service: "Lokalhyra 6 timmar, bord och stolar för 80 personer, enkelt kök, egen ingång.",
    reviewsList: [
      { name: "Lina", stars: 5, text: "Vackraste lokalen vi hittade i Göteborg för priset." },
      { name: "Fredrik", stars: 5, text: "Personalen var hjälpsam med allt från parkering till städning." },
    ],
  },
  {
    id: "kajskjul",
    category: "lokal",
    name: "Kajskjul 111",
    tagline: "Industriell hamnkänsla med utsikt över älven.",
    rating: 4.9,
    reviews: 64,
    location: "Frihamnen, Göteborg",
    pricing: { type: "per_hour", amount: 1600, note: "minst 4 timmar" },
    addons: [{ id: "sound", name: "Ljud- & ljusrigg", price: 2000 }],
    seed: "kajskjul",
    available: false,
    blurb:
      "Industriell hamnlokal med högt i tak och utsikt över älven. Rymmer upp till 150 gäster stående.",
    service: "Lokalhyra 8 timmar, ljud- och ljusrigg finns på plats, catering-kök.",
    reviewsList: [
      { name: "Maria", stars: 5, text: "Helt magisk plats, gästerna pratar fortfarande om utsikten." },
    ],
  },
  {
    id: "smakverket",
    category: "catering",
    name: "Smakverket Catering",
    tagline: "Säsongens smaker, skräddarsydda efter ert event.",
    rating: 4.9,
    reviews: 89,
    location: "Göteborg",
    pricing: { type: "per_person", amount: 195 },
    addons: [{ id: "drinks", name: "Alkoholfri drinkbar", price: 1500 }],
    seed: "smakverket",
    available: true,
    blurb:
      "Säsongsbaserad meny med rötter i västkustmat. Bygger menyn tillsammans med er utifrån antal gäster och budget.",
    service: "Tre rätter, dryck exklusive alkohol, serveringspersonal ingår.",
    reviewsList: [
      { name: "Karin", stars: 5, text: "Bästa maten vi haft på en fest, flera gäster frågade om receptet." },
      { name: "Oscar", stars: 5, text: "Smidigt upplägg och all personal var proffsig." },
    ],
  },
  {
    id: "skargardens-bord",
    category: "catering",
    name: "Skärgårdens Bord",
    tagline: "Skaldjursbuffé med västkustkänsla.",
    rating: 4.6,
    reviews: 44,
    location: "Göteborg",
    pricing: { type: "per_person", amount: 245 },
    addons: [],
    seed: "skargarden",
    available: true,
    blurb: "Fisk- och skaldjursbuffé i skärgårdsstil, populärt för sommarfester och dop.",
    service: "Buffé med varmt och kallt, dukning och avdukning ingår.",
    reviewsList: [{ name: "Petra", stars: 4, text: "Väldigt god mat, buffén fick fyllas på snabbare än väntat." }],
  },
  {
    id: "dekor-anna",
    category: "dekor",
    name: "Dekor by Anna",
    tagline: "Färgtema och stämning som gör festen minnesvärd.",
    rating: 4.8,
    reviews: 30,
    location: "Göteborg",
    pricing: { type: "fixed", amount: 2500 },
    addons: [{ id: "balloon-arch", name: "Extra ballongbåge", price: 800 }],
    seed: "dekor-anna",
    available: true,
    blurb: "Anna skapar färgtema och känsla utifrån ert event – från ballonger till bordsdukning.",
    service: "Färgtema, ballongbåge, bordsdekor för upp till 12 bord, uppsättning ingår.",
    reviewsList: [{ name: "Elin", stars: 5, text: "Precis den där korall-och-persiko-känslan vi ville ha!" }],
  },
  {
    id: "ballong-co",
    category: "dekor",
    name: "Ballong & Co",
    tagline: "Ballongväggar som blir kvällens fotohörna.",
    rating: 4.5,
    reviews: 18,
    location: "Göteborg",
    pricing: { type: "fixed", amount: 1800 },
    addons: [],
    seed: "ballong-co",
    available: true,
    blurb: "Prisvärd dekoratör som är experter på ballongväggar och fotohörnor.",
    service: "Ballongvägg 2x2 meter, fotohörna med rekvisita, nedmontering ingår ej.",
    reviewsList: [{ name: "Niklas", stars: 4, text: "Ballongväggen blev en snackis bland gästerna." }],
  },
  {
    id: "studio-ljus",
    category: "fotograf",
    name: "Studio Ljus Foto",
    tagline: "Äkta ögonblick fångade utan posering.",
    rating: 4.9,
    reviews: 41,
    location: "Göteborg",
    pricing: { type: "fixed", amount: 5500, note: "Paket, 4 timmar" },
    addons: [{ id: "extra-hour-photo", name: "Extra timme fotografering", price: 800 }],
    seed: "studio-ljus",
    available: true,
    blurb: "Fotograferar fest och porträtt i ett naturligt, avslappnat stil utan posering på kommando.",
    service: "4 timmars närvaro, 150+ redigerade bilder digitalt inom två veckor.",
    reviewsList: [{ name: "Hanna", stars: 5, text: "Fångade precis de där äkta skratten vi ville minnas." }],
  },
  {
    id: "tartverkstan",
    category: "tarta",
    name: "Tårtverkstan",
    tagline: "Handgjorda tårtor värda att fota innan de äts upp.",
    rating: 4.8,
    reviews: 57,
    location: "Göteborg",
    pricing: { type: "fixed", amount: 950 },
    addons: [],
    seed: "tartverkstan",
    available: true,
    blurb: "Handgjorda tårtor efter tema och smak, glutenfritt och veganskt på begäran.",
    service: "Tårta för upp till 40 bitar, leverans inom Göteborg ingår.",
    reviewsList: [{ name: "Sara", stars: 5, text: "Vackrast tårta vi sett, och godare än den var vacker." }],
  },
  {
    id: "blomsterhornan",
    category: "blommor",
    name: "Blomsterhörnan",
    tagline: "Lösa, naturliga blomsterarrangemang för bord och entré.",
    rating: 4.7,
    reviews: 26,
    location: "Göteborg",
    pricing: { type: "fixed", amount: 1200 },
    addons: [],
    seed: "blomsterhornan",
    available: true,
    blurb: "Säsongsblommor i lösa, naturliga arrangemang – perfekt till bord och entré.",
    service: "Bordsarrangemang för 8 bord samt en större entréarrangemang.",
    reviewsList: [{ name: "Ida", stars: 5, text: "Blommorna höll hela kvällen och doftade fantastiskt." }],
  },
  {
    id: "hyr-fest",
    category: "uthyrning",
    name: "Hyr & Fest AB",
    tagline: "Bord, stolar och porslin – hämtas och lämnas åt er.",
    rating: 4.6,
    reviews: 33,
    location: "Göteborg",
    pricing: { type: "per_person", amount: 45, note: "bord, stolar & porslin per gäst" },
    addons: [{ id: "tent", name: "Tält 6×9 m", price: 3500 }],
    seed: "hyr-fest",
    available: true,
    blurb: "Hyr bord, stolar, porslin och tält – hämtas och lämnas efter festen.",
    service: "Paket för 50 gäster: bord, stolar, porslin och glas. Upphämtning ingår.",
    reviewsList: [{ name: "Tobias", stars: 4, text: "Allt var rent och i bra skick, smidig avhämtning." }],
  },
];

const formatKr = (n) => Math.round(n).toLocaleString("sv-SE") + " kr";
const formatAppliedAt = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" }) + ", " + d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
};
function formatDistance(km) {
  return `${String(km).replace(".", ",")} km bort`;
}

// ---------------------------------------------------------------------------
// Customer visibility (Fas 3) — the single gate that decides what a customer
// can ever see. Pending/rejected applications never reach this list.
// ---------------------------------------------------------------------------
function mapVendorToProviders(vendor, bookings) {
  const services = vendor.profile.services || [];
  const images = vendor.profile.images.length > 0 ? vendor.profile.images : [`https://picsum.photos/seed/${vendor.id}/600/420`];
  const myListingIds = vendor.categories.map((c) => `${vendor.id}-${c}`);
  const closedDates = [...new Set((vendor.blockedTimes || []).map((bt) => bt.date))];
  const bookedDates = [
    ...new Set(
      bookings
        .filter((b) => !b.cancelled)
        .flatMap((b) => b.items.filter((i) => myListingIds.includes(i.providerId) && i.status !== "declined").map(() => b.date))
    ),
  ];

  // A vendor offering several categories gets one listing per category (same
  // profile data, different category context) rather than one merged card —
  // simplest way to fit multi-category vendors into a single-category grid.
  // Each service is tagged with the category it belongs to (set in the vendor
  // profile editor), so we pick the listing's primary service by matching on
  // that tag. Untagged services (from older data) are used as a fallback so
  // nothing silently disappears.
  return vendor.categories.map((categoryId) => {
    const categoryServices = services.filter((s) => s.category === categoryId);
    const primaryService = categoryServices[0] || services.find((s) => !s.category) || services[0];
    const pricing = primaryService
      ? { type: primaryService.priceType, amount: Number(primaryService.price) || 0, note: primaryService.priceNote || "" }
      : { type: "fixed", amount: 0, note: "" };
    const otherServiceNames = services
      .filter((s) => s !== primaryService && s.category === categoryId)
      .map((s) => s.name)
      .filter(Boolean);
    const serviceText = [primaryService?.description || "", otherServiceNames.length > 0 ? `Övriga tjänster: ${otherServiceNames.join(", ")}.` : ""]
      .filter(Boolean)
      .join(" ");

    const hasPrice = pricing.amount > 0;
    const request = getRequestConfig(vendor.requestForms, categoryId, hasPrice);
    // "from" price when there is no fixed price: the cheapest option of each required choice, added up
    const fieldsFrom = request.fields
      .filter((f) => f.required && f.type === "single")
      .reduce((sum, f) => {
        const prices = f.options.filter((o) => o.price).map((o) => o.price);
        return sum + (prices.length ? Math.min(...prices) : 0);
      }, 0);

    return {
      id: `${vendor.id}-${categoryId}`,
      vendorDbId: vendor.id.startsWith("VND-") ? null : vendor.id, // only real (Supabase) vendors get a real FK id
      category: categoryId,
      name: vendor.companyName,
      tagline: vendor.profile.tagline || "Ny leverantör på Planifest",
      rating: null,
      reviews: 0,
      location: locationMap[vendor.baseLocation]?.name || vendor.baseLocation,
      distanceKm: getMockDistance(vendor.id, vendor.baseLocation),
      pricing,
      serviceId: primaryService?.id || null,
      request,
      requestOnly: !request.direct,
      fromPrice: hasPrice ? pricing.amount : fieldsFrom,
      seed: vendor.id,
      image: images[0],
      images,
      available: true,
      closedDates,
      bookedDates,
      blurb: vendor.profile.description || "",
      service: serviceText,
      reviewsList: [],
      addons: vendor.profile.addons || [],
    };
  });
}

function applyCustomerReviews(provider, customerReviews) {
  const mine = customerReviews.filter((r) => r.providerId === provider.id).map((r) => ({ name: r.name, stars: r.stars, text: r.text }));
  if (mine.length === 0) return provider;
  const reviewsList = [...mine, ...provider.reviewsList];
  if (provider.reviews > 0) {
    // established listing with existing sample reviews — add the new one(s) on top,
    // keep the existing aggregate rating (recomputing a true blended average isn't
    // worth the complexity for a prototype, and is a reasonable known simplification)
    return { ...provider, reviewsList, reviews: provider.reviews + mine.length };
  }
  // brand-new vendor with no reviews yet — the rating is genuinely just these
  const avg = Math.round((mine.reduce((s, r) => s + r.stars, 0) / mine.length) * 10) / 10;
  return { ...provider, reviewsList, reviews: mine.length, rating: avg };
}

function getCustomerVisibleProviders(vendorApplications, customerReviews, bookings) {
  const mockListings = (SHOW_DEMO_DATA ? PROVIDERS : []).map((p) => {
    const { closedDates, bookedDates } = getMockAvailability(p.seed);
    return {
      ...p,
      image: `https://picsum.photos/seed/${p.seed}/600/420`,
      images: [`https://picsum.photos/seed/${p.seed}/600/420`, `https://picsum.photos/seed/${p.seed}-b/600/420`],
      closedDates,
      bookedDates,
      distanceKm: getMockDistance(p.seed, "goteborg"),
    };
  });
  const approvedListings = vendorApplications.filter((v) => v.status === "approved").flatMap((v) => mapVendorToProviders(v, bookings));
  return [...mockListings, ...approvedListings].map((p) => applyCustomerReviews(p, customerReviews));
}

// --- Pricing helpers -------------------------------------------------------
// Every provider has a `pricing` shape of { type: 'fixed'|'per_person'|'per_hour', amount, note? }
// plus an optional `addons` array of { id, name, price }. This lets the cart/checkout
// compute a real total instead of assuming every price is a flat package.

function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function getDurationHours(party) {
  const start = timeToMinutes(party.startTime);
  const end = timeToMinutes(party.endTime);
  if (start == null || end == null) return 4; // sensible fallback
  let diff = end - start;
  if (diff <= 0) diff += 24 * 60; // event crosses midnight
  return Math.max(1, Math.round((diff / 60) * 2) / 2); // nearest half hour, min 1h
}

function getUnitLabel(pricing) {
  if (pricing.type === "per_person") return "/person";
  if (pricing.type === "per_hour") return "/timme";
  return "";
}

function getBaseAmount(provider, party) {
  const { pricing } = provider;
  if (pricing.type === "per_person") return pricing.amount * Math.max(1, party.guests || 1);
  if (pricing.type === "per_hour") return pricing.amount * getDurationHours(party);
  return pricing.amount;
}

function getAddonsAmount(provider, addonIds = []) {
  if (!provider.addons || provider.addons.length === 0) return 0;
  return provider.addons.filter((a) => addonIds.includes(a.id)).reduce((sum, a) => sum + a.price, 0);
}

function getLineTotal(provider, addonIds, party) {
  return getBaseAmount(provider, party) + getAddonsAmount(provider, addonIds);
}

function getBreakdownText(provider, party) {
  const { pricing } = provider;
  if (pricing.type === "per_person") return `${formatKr(pricing.amount)}/person × ${party.guests || 0} gäster`;
  if (pricing.type === "per_hour") return `${formatKr(pricing.amount)}/timme × ${getDurationHours(party)} timmar`;
  return pricing.note || "Paketpris";
}

// --- Vendor signup validation (Fas 2A) -------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateVendorAccount(form, hasAccount = false) {
  const errors = {};
  if (!form.companyName.trim()) errors.companyName = "Fyll i företagsnamn";
  if (!form.organizationNumber.trim()) errors.organizationNumber = "Ange ett organisationsnummer";
  if (!form.contactPerson.trim()) errors.contactPerson = "Fyll i kontaktperson";
  if (!hasAccount) {
    if (!form.email.trim()) errors.email = "Fyll i e-postadress";
    else if (!EMAIL_RE.test(form.email.trim())) errors.email = "Ange en giltig e-postadress";
  }
  if (!form.phone.trim()) errors.phone = "Fyll i telefonnummer";
  if (!hasAccount) {
    if (!form.password) errors.password = "Ange ett lösenord";
    else if (form.password.length < 6) errors.password = "Lösenordet måste vara minst 6 tecken";
    if (form.confirmPassword !== form.password) errors.confirmPassword = "Lösenorden matchar inte";
  }
  return errors;
}

function validateVendorGeography(form) {
  const errors = {};
  if (!form.baseLocation) errors.baseLocation = "Välj var du utgår från";
  if (!form.serviceArea) errors.serviceArea = "Välj ditt arbetsområde";
  return errors;
}

function validateVendorCategories(form) {
  const errors = {};
  if (form.categories.length === 0) errors.categories = "Välj minst en kategori";
  if (!form.acceptedTerms) errors.acceptedTerms = "Du måste godkänna villkoren för leverantörer för att skicka in ansökan";
  return errors;
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
function BalloonMark({ size = 26, color }) {
  const fill = color || colors.pink;
  const h = size * 1.3;
  return (
    <svg width={size} height={h} viewBox="0 0 20 26" fill="none" aria-hidden="true">
      <ellipse cx="10" cy="9" rx="8.5" ry="9" fill={fill} />
      <ellipse cx="7" cy="6" rx="2.2" ry="3" fill="rgba(255,255,255,0.4)" />
      <polygon points="7.5,17 12.5,17 10,20" fill={fill} />
      <path d="M10 20 Q 13 23 10.5 26" stroke={colors.plum} strokeWidth="1" fill="none" opacity="0.55" />
    </svg>
  );
}

// The real Planifest mark: pink, lavender and cream balloons tied together
// with a small ribbon bow — matches the brand board (three balloons above the
// PLAN·FEST wordmark), used for the header and hero logo.
function LogoBalloons({ size = 40 }) {
  const h = size * 1.4;
  return (
    <svg width={size} height={h} viewBox="0 0 64 90" fill="none" aria-hidden="true">
      <ellipse cx="37" cy="23" rx="14" ry="17" fill={colors.lilac} />
      <ellipse cx="32" cy="16" rx="3.5" ry="4.5" fill="rgba(255,255,255,0.35)" />
      <polygon points="33,39 41,39 37,45" fill={colors.lilac} />

      <ellipse cx="47" cy="40" rx="10" ry="12" fill={colors.peach} />
      <ellipse cx="44" cy="34" rx="2.8" ry="3.5" fill="rgba(255,255,255,0.4)" />
      <polygon points="43,50 51,50 47,55" fill={colors.peach} />

      <ellipse cx="20" cy="36" rx="16" ry="19" fill={colors.pink} />
      <ellipse cx="14" cy="28" rx="4.2" ry="5.2" fill="rgba(255,255,255,0.4)" />
      <polygon points="15,53 25,53 20,60" fill={colors.pink} />

      <path d="M37 45 Q 34 62 31 76" stroke={colors.plum} strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M47 55 Q 38 68 31 76" stroke={colors.plum} strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M20 60 Q 25 70 31 76" stroke={colors.plum} strokeWidth="1" fill="none" opacity="0.5" />

      <path d="M25 78 Q 31 73 37 78 Q 31 83 25 78 Z" fill={colors.pink} />
      <circle cx="31" cy="78" r="1.6" fill={colors.plum} />
    </svg>
  );
}

function Wordmark({ fontSize = 20, letterSpacing = "0.06em" }) {
  // A real lowercase "i", tinted as a small brand accent, instead of a
  // hand-built dot+bar graphic — guarantees it sits correctly with the rest
  // of the word since it's the same text run, not a separate element next to it.
  return (
    <span style={{ fontFamily: serif, fontWeight: 600, fontSize, letterSpacing, color: colors.plum }}>
      <span className="uppercase">Plan</span>
      <span style={{ color: colors.pink }}>i</span>
      <span className="uppercase">Fest</span>
    </span>
  );
}

function EdgeBalloons() {
  const items = [
    { size: 90, top: -26, left: -28, rotate: -10, color: colors.pink },
    { size: 46, top: 86, left: 6, rotate: 8, color: colors.lilac },
    { size: 100, top: -34, right: -30, rotate: 9, color: colors.lilac },
    { size: 52, top: 104, right: 24, rotate: -6, color: colors.pink },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {items.map((b, i) => (
        <div
          key={i}
          className="absolute hidden sm:block"
          style={{ top: b.top, left: b.left, right: b.right, transform: `rotate(${b.rotate}deg)`, opacity: 0.85 }}
        >
          <BalloonMark size={b.size} color={b.color} />
        </div>
      ))}
    </div>
  );
}

function Logo({ onClick, size = "normal" }) {
  const large = size === "large";
  return (
    <button onClick={onClick} className="flex items-center gap-2" style={{ background: "none", border: "none", cursor: "pointer" }}>
      <LogoBalloons size={large ? 46 : 24} />
      <Wordmark fontSize={large ? 40 : 19} letterSpacing={large ? "0.14em" : "0.05em"} />
    </button>
  );
}

function CategoryChip({ active, onClick, icon: Icon, emoji, label, size = "lg" }) {
  if (size === "sm") {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
        style={{
          border: `1px solid ${active ? colors.lilac : colors.beige}`,
          backgroundColor: active ? colors.lilacSoft : "transparent",
          color: active ? colors.lilacDeep : colors.plumSoft,
        }}
      >
        {Icon && <Icon size={13} color={active ? colors.lilacDeep : colors.plumSoft} />}
        {label}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-2xl px-3 py-2.5 text-center transition-colors"
      style={{
        border: `1.5px solid ${active ? colors.coral : colors.lilac}`,
        backgroundColor: active ? colors.coral : colors.white,
        minWidth: 74,
      }}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: active ? "rgba(255,255,255,0.28)" : colors.lilacSoft }}
      >
        {Icon ? <Icon size={16} color={active ? colors.white : colors.lilacDeep} /> : <span style={{ fontSize: 15, lineHeight: 1 }}>{emoji}</span>}
      </span>
      <span className="text-xs font-semibold leading-tight" style={{ color: active ? colors.white : colors.plum }}>
        {label}
      </span>
    </button>
  );
}

function StarRating({ rating, reviews, size = 14 }) {
  return (
    <span className="inline-flex items-center gap-1" style={{ color: colors.plum }}>
      <Star size={size} fill={colors.coral} color={colors.coral} />
      <span className="text-sm font-semibold">{rating}</span>
      {reviews != null && (
        <span className="text-sm" style={{ color: colors.plumSoft }}>
          ({reviews})
        </span>
      )}
    </span>
  );
}

// --- Calendar helpers --------------------------------------------------
const WEEKDAY_LABELS = ["M", "T", "O", "T", "F", "L", "S"];
const MONTH_LABELS = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December",
];

function pad2(n) {
  return String(n).padStart(2, "0");
}
function dateStr(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}
function todayStr() {
  const d = new Date();
  return dateStr(d.getFullYear(), d.getMonth(), d.getDate());
}
function getMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// Deterministic "fake" availability for the original mock providers, so their
// calendars show a believable pattern instead of every single day being open.
function getMockAvailability(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const next = (n) => {
    hash = (hash * 1103515245 + 12345) >>> 0;
    return hash % n;
  };
  const base = new Date();
  const closed = [];
  const booked = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + next(45) + 1);
    const ds = dateStr(d.getFullYear(), d.getMonth(), d.getDate());
    (i < 2 ? closed : booked).push(ds);
  }
  return { closedDates: closed, bookedDates: booked };
}

// Deterministic mock "distance from you" until real geocoding exists. Vendors
// based in the active market (Göteborg) get a small realistic radius; vendors
// elsewhere read as genuinely far away, which is honest given we don't have
// real coordinates yet.
function getMockDistance(seed, baseLocationId) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const isNearby = !baseLocationId || baseLocationId === "goteborg";
  const rangeTenths = isNearby ? 220 : 3000; // up to 22 km nearby, else up to 300 km
  return Math.max(0.4, Math.round((hash % rangeTenths) / 10 * 10) / 10);
}

function CalendarLegend({ compact = false }) {
  return (
    <div className={compact ? "mt-2 flex flex-wrap gap-2 text-[10px]" : "mt-3 flex flex-wrap gap-3 text-xs"} style={{ color: colors.plumSoft }}>
      <span className="flex items-center gap-1">
        <span className={compact ? "inline-block h-1.5 w-1.5 rounded-full" : "inline-block h-2.5 w-2.5 rounded-full"} style={{ backgroundColor: "#EAF4EE", border: `1px solid ${colors.green}` }} /> Ledig
      </span>
      <span className="flex items-center gap-1">
        <span className={compact ? "inline-block h-1.5 w-1.5 rounded-full" : "inline-block h-2.5 w-2.5 rounded-full"} style={{ backgroundColor: colors.peachSoft }} /> Bokad
      </span>
      <span className="flex items-center gap-1">
        <span className={compact ? "inline-block h-1.5 w-1.5 rounded-full" : "inline-block h-2.5 w-2.5 rounded-full"} style={{ backgroundColor: colors.beige }} /> Stängd
      </span>
    </div>
  );
}

function MonthCalendar({ year, month, onPrevMonth, onNextMonth, getDayStatus, onDayClick, interactive, highlightDate, compact = false }) {
  const cells = getMonthGrid(year, month);
  const statusStyle = {
    open: { bg: "#EAF4EE", fg: colors.green },
    booked: { bg: colors.peachSoft, fg: colors.coralDeep },
    closed: { bg: colors.beige, fg: colors.plumSoft },
    past: { bg: "transparent", fg: colors.beige },
  };

  return (
    <div
      className="rounded-2xl"
      style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}`, padding: compact ? 10 : 16, maxWidth: compact ? 190 : undefined }}
    >
      <div className={compact ? "mb-2 flex items-center justify-between" : "mb-3 flex items-center justify-between"}>
        <button
          onClick={onPrevMonth}
          className="rounded-full"
          style={{ backgroundColor: colors.lilacSoft, padding: compact ? 3 : 6 }}
          aria-label="Föregående månad"
        >
          <ChevronLeft size={compact ? 11 : 15} color={colors.lilacDeep} />
        </button>
        <p className="font-semibold" style={{ color: colors.plum, fontSize: compact ? 11 : 14 }}>
          {MONTH_LABELS[month]} {year}
        </p>
        <button
          onClick={onNextMonth}
          className="rounded-full"
          style={{ backgroundColor: colors.lilacSoft, padding: compact ? 3 : 6 }}
          aria-label="Nästa månad"
        >
          <ChevronRight size={compact ? 11 : 15} color={colors.lilacDeep} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center" style={{ color: colors.plumSoft, gap: compact ? 2 : 4, fontSize: compact ? 9 : 12 }}>
        {WEEKDAY_LABELS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7" style={{ gap: compact ? 2 : 4 }}>
        {cells.map((day, i) => {
          if (day == null) return <span key={i} />;
          const ds = dateStr(year, month, day);
          const status = getDayStatus(ds);
          const style = statusStyle[status] || statusStyle.open;
          const isHighlighted = highlightDate === ds;
          const clickable = interactive && status !== "past";
          return (
            <button
              key={i}
              onClick={clickable ? () => onDayClick(ds, status) : undefined}
              disabled={!clickable}
              className="flex aspect-square items-center justify-center rounded-lg font-medium"
              style={{
                fontSize: compact ? 9 : 12,
                backgroundColor: isHighlighted ? colors.coral : style.bg,
                color: isHighlighted ? colors.white : style.fg,
                border: isHighlighted ? `2px solid ${colors.coralDeep}` : "1px solid transparent",
                cursor: clickable ? "pointer" : "default",
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      className="fixed left-1/2 z-50 max-w-xs rounded-full px-5 py-3 text-center text-sm font-medium shadow-lg"
      style={{
        bottom: 28,
        transform: "translateX(-50%)",
        backgroundColor: colors.plum,
        color: colors.white,
      }}
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vendor card
// ---------------------------------------------------------------------------
function VendorCard({ provider, party, inCart, onView, onAdd, onRemove, swapMode }) {
  const priceLabel = provider.requestOnly
    ? provider.fromPrice > 0
      ? `från ${formatKr(provider.fromPrice)}`
      : "Pris på förfrågan"
    : `${formatKr(provider.pricing.amount)}${getUnitLabel(provider.pricing)}`;
  const handleAction = (e) => {
    e.stopPropagation();
    if (provider.requestOnly) {
      onView(provider.id); // booked through a request and a quote, never added straight to the cart
      return;
    }
    if (swapMode) onAdd(provider.id);
    else if (inCart) onRemove(provider.id);
    else onAdd(provider.id);
  };

  return (
    <div
      onClick={() => onView(provider.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onView(provider.id)}
      className="flex cursor-pointer flex-col overflow-hidden rounded-2xl"
      style={{ backgroundColor: colors.lilac }}
    >
      <div className="relative">
        <img
          src={provider.image || `https://picsum.photos/seed/${provider.seed}/200/200`}
          alt={provider.name}
          className="h-12 w-full object-cover sm:h-14"
        />
        <HeartButton vendorId={provider.vendorDbId} small className="absolute left-1 top-1 shadow-sm" />
        <button
          onClick={handleAction}
          className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full shadow-sm"
          style={{
            backgroundColor: inCart && !swapMode ? colors.white : colors.coral,
            color: inCart && !swapMode ? colors.lilacDeep : colors.white,
          }}
          aria-label={provider.requestOnly ? "Skicka förfrågan" : swapMode ? "Välj denna" : inCart ? "Ta bort från Min fest" : "Lägg till i Min fest"}
        >
          {swapMode || inCart ? <Check size={9} /> : <Plus size={9} />}
        </button>
      </div>
      <div className="p-1.5">
        <h3 className="truncate leading-tight" style={{ fontFamily: serif, fontSize: 11, color: colors.plum }}>
          {provider.name}
        </h3>
        <div className="mt-0.5 flex min-w-0 items-center gap-1 leading-tight" style={{ fontSize: 9, color: colors.plum, opacity: 0.75 }}>
          {provider.reviews > 0 ? (
            <span className="flex flex-shrink-0 items-center gap-0.5">
              <Star size={8} fill={colors.coral} color={colors.coral} /> {provider.rating}
            </span>
          ) : (
            <span className="flex-shrink-0">Ny</span>
          )}
          <span className="truncate">{provider.distanceKm != null ? formatDistance(provider.distanceKm) : provider.location}</span>
        </div>
        <p className="mt-0.5 truncate leading-tight" style={{ fontFamily: serif, fontSize: 11, color: colors.plum }}>
          {priceLabel}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------
function HomeView({ party, setParty, onSubmit, howItWorksRef }) {
  const builderRef = useRef(null);
  const toggleCategory = (id) => {
    setParty((p) => ({
      ...p,
      categories: p.categories.includes(id) ? p.categories.filter((c) => c !== id) : [...p.categories, id],
    }));
  };
  const toggleOccasion = (id) => {
    setParty((p) => ({ ...p, occasion: p.occasion === id ? null : id }));
  };
  const canSubmit = party.date && party.categories.length > 0;
  const scrollToBuilder = () => builderRef.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <div>
      <section className="relative overflow-hidden px-6 pb-14 pt-16 sm:px-10 sm:pb-20 sm:pt-24">
        <EdgeBalloons />
        <div className="relative mx-auto max-w-xl text-center">
          <div className="flex flex-col items-center gap-2">
            <LogoBalloons size={56} />
            <Wordmark fontSize={40} letterSpacing="0.14em" />
          </div>
          <p className="mx-auto mt-5 max-w-sm text-lg italic sm:text-xl" style={{ fontFamily: serif, color: colors.plumSoft }}>
            För stunder värda att planera.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <span style={{ width: 24, height: 1, backgroundColor: colors.lilac }} />
            <p className="text-xs font-semibold" style={{ letterSpacing: "0.22em", color: colors.lilacDeep }}>
              PLAN | CREATE | CELEBRATE
            </p>
            <span style={{ width: 24, height: 1, backgroundColor: colors.lilac }} />
          </div>
          <button
            onClick={scrollToBuilder}
            className="mt-8 rounded-full px-8 py-3.5 text-sm font-semibold uppercase"
            style={{ backgroundColor: colors.coral, color: colors.white, letterSpacing: "0.08em" }}
          >
            Börja planera
          </button>
        </div>
      </section>

      <section ref={builderRef} className="px-6 pb-10 sm:px-10">
        <div className="relative mx-auto max-w-2xl rounded-3xl p-6 shadow-sm sm:p-8" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
          <h2 style={{ fontFamily: serif, fontSize: 22, color: colors.plum }} className="mb-5">
            Bygg din fest
          </h2>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1" style={{ color: colors.plumSoft }}>
              <span className="flex items-center gap-1">
                <Calendar size={14} /> Datum
              </span>
              <input
                type="date"
                value={party.date}
                onChange={(e) => setParty((p) => ({ ...p, date: e.target.value }))}
                className="rounded-xl px-3 py-2 text-sm"
                style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm" style={{ color: colors.plumSoft }}>
              <span className="flex items-center gap-1">
                <Clock size={14} /> Start
              </span>
              <input
                type="time"
                value={party.startTime}
                onChange={(e) => setParty((p) => ({ ...p, startTime: e.target.value }))}
                className="rounded-xl px-3 py-2 text-sm"
                style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm" style={{ color: colors.plumSoft }}>
              <span className="flex items-center gap-1">
                <Clock size={14} /> Slut
              </span>
              <input
                type="time"
                value={party.endTime}
                onChange={(e) => setParty((p) => ({ ...p, endTime: e.target.value }))}
                className="rounded-xl px-3 py-2 text-sm"
                style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum }}
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1" style={{ color: colors.plumSoft }}>
              <span className="flex items-center gap-1">
                <Users size={14} /> Gäster
              </span>
              <input
                type="number"
                min={1}
                value={party.guests}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setParty((p) => ({ ...p, guests: "" }));
                    return;
                  }
                  const n = Number(raw);
                  if (!Number.isNaN(n)) setParty((p) => ({ ...p, guests: n }));
                }}
                onBlur={() => setParty((p) => ({ ...p, guests: p.guests === "" || p.guests < 1 ? 1 : p.guests }))}
                className="rounded-xl px-3 py-2 text-sm"
                style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum }}
              />
            </label>
          </div>

          <p className="mb-2 mt-5 text-sm font-medium" style={{ color: colors.plum }}>
            Vad ska du fira? <span style={{ color: colors.plumSoft, fontWeight: 400 }}>(valfritt)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <CategoryChip key={o.id} active={party.occasion === o.id} onClick={() => toggleOccasion(o.id)} emoji={o.emoji} label={o.label} />
            ))}
          </div>

          <p className="mb-2 mt-5 text-sm font-medium" style={{ color: colors.plum }}>
            Vad behöver du?
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <CategoryChip key={c.id} active={party.categories.includes(c.id)} onClick={() => toggleCategory(c.id)} icon={c.icon} label={c.label} />
            ))}
          </div>

          <button
            disabled={!canSubmit}
            onClick={onSubmit}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full py-3 text-base font-semibold transition-opacity"
            style={{
              backgroundColor: colors.coral,
              color: colors.white,
              opacity: canSubmit ? 1 : 0.45,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            Visa leverantörer <ArrowRight size={18} />
          </button>
          {!canSubmit && (
            <p className="mt-2 text-center text-xs" style={{ color: colors.plumSoft }}>
              Välj datum och minst en kategori för att komma igång.
            </p>
          )}
        </div>
      </section>

      <section ref={howItWorksRef} className="mx-auto max-w-5xl px-6 py-16 sm:px-10">
        <div className="rounded-3xl p-6 sm:p-10" style={{ backgroundColor: colors.lilacSoft }}>
          <h2 className="mb-8 text-center" style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>
            Så fungerar Planifest
          </h2>
          <div className="grid gap-6 sm:grid-cols-4">
            {[
              { n: 1, title: "Berätta om ditt event", text: "Datum, tid, antal gäster och vad du behöver." },
              { n: 2, title: "Jämför", text: "Se priser, bilder, recensioner och tillgänglighet." },
              { n: 3, title: "Bygg din fest", text: "Välj leverantörer, byt när du vill och se totalpriset." },
              { n: 4, title: "Boka", text: "Boka och betala på ett ställe." },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl p-4" style={{ backgroundColor: colors.white }}>
                <div
                  className="mb-3 flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
                  style={{ backgroundColor: colors.coralSoft, color: colors.coralDeep }}
                >
                  {s.n}
                </div>
                <h3 className="mb-1 font-semibold" style={{ color: colors.plum }}>
                  {s.title}
                </h3>
                <p className="text-sm" style={{ color: colors.plumSoft }}>
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ResultsView({
  party,
  setParty,
  groups,
  swapProviders,
  cart,
  onView,
  onAdd,
  onRemove,
  sortBy,
  setSortBy,
  distanceFilter,
  setDistanceFilter,
  swapContext,
  onCancelSwap,
  searchQuery,
  setSearchQuery,
}) {
  const [editOpen, setEditOpen] = useState(false);
  const toggleCategory = (id) => {
    setParty((p) => ({
      ...p,
      categories: p.categories.includes(id) ? p.categories.filter((c) => c !== id) : [...p.categories, id],
    }));
  };
  const fieldStyle = { border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white };

  return (
    <div className="mx-auto max-w-6xl px-6 pb-32 pt-8 sm:px-10">
      {swapContext ? (
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4"
          style={{ backgroundColor: colors.lilacSoft }}
        >
          <p className="text-sm" style={{ color: colors.plum }}>
            Byter ut <strong>{swapContext.oldName}</strong> — här är andra alternativ inom {catMap[swapContext.category].label.toLowerCase()}.
          </p>
          <button onClick={onCancelSwap} className="text-sm font-semibold underline" style={{ color: colors.lilacDeep }}>
            Avbryt byte
          </button>
        </div>
      ) : (
        <>
          <h1 style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>Bygg ditt event 🎉</h1>
          <p className="mt-1 text-sm" style={{ color: colors.plumSoft }}>
            Här är leverantörer som passar dina val.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm" style={{ color: colors.plumSoft }}>
            {party.date && (
              <span className="flex items-center gap-1">
                <Calendar size={14} /> {party.date}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={14} /> {party.startTime}–{party.endTime}
            </span>
            <span className="flex items-center gap-1">
              <Users size={14} /> {party.guests} gäster
            </span>
            {party.occasion && occasionMap[party.occasion] && (
              <span className="flex items-center gap-1">
                {occasionMap[party.occasion].emoji} {occasionMap[party.occasion].label}
              </span>
            )}
            <button onClick={() => setEditOpen((v) => !v)} className="flex items-center gap-1 font-semibold underline" style={{ color: colors.lilacDeep }}>
              Ändra
            </button>
          </div>

          {editOpen && (
            <div className="mt-4 rounded-2xl p-5" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1" style={{ color: colors.plumSoft }}>
                  <span className="flex items-center gap-1">
                    <Calendar size={14} /> Datum
                  </span>
                  <input
                    type="date"
                    value={party.date}
                    onChange={(e) => setParty((p) => ({ ...p, date: e.target.value }))}
                    className="rounded-xl px-3 py-2 text-sm"
                    style={fieldStyle}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm" style={{ color: colors.plumSoft }}>
                  <span className="flex items-center gap-1">
                    <Clock size={14} /> Start
                  </span>
                  <input
                    type="time"
                    value={party.startTime}
                    onChange={(e) => setParty((p) => ({ ...p, startTime: e.target.value }))}
                    className="rounded-xl px-3 py-2 text-sm"
                    style={fieldStyle}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm" style={{ color: colors.plumSoft }}>
                  <span className="flex items-center gap-1">
                    <Clock size={14} /> Slut
                  </span>
                  <input
                    type="time"
                    value={party.endTime}
                    onChange={(e) => setParty((p) => ({ ...p, endTime: e.target.value }))}
                    className="rounded-xl px-3 py-2 text-sm"
                    style={fieldStyle}
                  />
                </label>
                <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1" style={{ color: colors.plumSoft }}>
                  <span className="flex items-center gap-1">
                    <Users size={14} /> Gäster
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={party.guests}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        setParty((p) => ({ ...p, guests: "" }));
                        return;
                      }
                      const n = Number(raw);
                      if (!Number.isNaN(n)) setParty((p) => ({ ...p, guests: n }));
                    }}
                    onBlur={() => setParty((p) => ({ ...p, guests: p.guests === "" || p.guests < 1 ? 1 : p.guests }))}
                    className="rounded-xl px-3 py-2 text-sm"
                    style={fieldStyle}
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {OCCASIONS.map((o) => (
                  <CategoryChip
                    key={o.id}
                    size="sm"
                    active={party.occasion === o.id}
                    onClick={() => setParty((p) => ({ ...p, occasion: p.occasion === o.id ? "" : o.id }))}
                    icon={null}
                    label={`${o.emoji} ${o.label}`}
                  />
                ))}
              </div>
              <button
                onClick={() => setEditOpen(false)}
                className="mt-4 rounded-full px-4 py-2 text-sm font-semibold"
                style={{ backgroundColor: colors.coral, color: colors.white }}
              >
                Klart
              </button>
            </div>
          )}
        </>
      )}

      {!swapContext && (
        <div className="relative mt-5 max-w-sm">
          <Search size={15} color={colors.plumSoft} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Sök leverantör..."
            className="w-full rounded-full py-2 pl-9 pr-4 text-sm"
            style={{ border: `1px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }}
          />
        </div>
      )}

      {!swapContext && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <CategoryChip key={c.id} size="sm" active={party.categories.includes(c.id)} onClick={() => toggleCategory(c.id)} icon={c.icon} label={c.label} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={distanceFilter}
              onChange={(e) => setDistanceFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="rounded-full px-3 py-1.5 text-xs font-medium"
              style={{ border: `1px solid ${colors.beige}`, color: colors.plumSoft, backgroundColor: colors.white }}
            >
              <option value="all">Alla avstånd</option>
              <option value="5">Nära dig · inom 5 km</option>
              <option value="10">Inom 10 km</option>
              <option value="25">Inom 25 km</option>
              <option value="50">Inom 50 km</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-full bg-transparent px-2 py-1 text-xs font-medium"
              style={{ border: "none", color: colors.plumSoft }}
            >
              <option value="recommended">Rekommenderade</option>
              <option value="rating">Högst betyg</option>
              <option value="reviews">Flest recensioner</option>
              <option value="price">Pris</option>
              <option value="distance">Närmast först</option>
            </select>
          </div>
        </div>
      )}

      {swapContext ? (
        <div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-7">
          {swapProviders.map((p) => (
            <VendorCard
              key={p.id}
              provider={p}
              party={party}
              inCart={cart.includes(p.id)}
              onView={onView}
              onAdd={onAdd}
              onRemove={onRemove}
              swapMode
            />
          ))}
          {swapProviders.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm" style={{ color: colors.plumSoft }}>
              Inga andra alternativ tillgängliga i den här kategorin just nu.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.map((g) => {
            const Icon = g.category.icon;
            return (
              <section key={g.category.id} className="rounded-3xl p-5 sm:p-7" style={{ backgroundColor: colors[g.category.tint] }}>
                <div className="mb-5 flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full shadow-sm"
                    style={{ backgroundColor: colors.white }}
                  >
                    <Icon size={18} color={colors.lilacDeep} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>{g.category.label}</h2>
                      <span className="text-sm" style={{ color: colors.plumSoft }}>
                        ({g.providers.length})
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: colors.plumSoft }}>
                      {g.category.tagline}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-7">
                  {g.providers.map((p) => (
                    <VendorCard
                      key={p.id}
                      provider={p}
                      party={party}
                      inCart={cart.includes(p.id)}
                      onView={onView}
                      onAdd={onAdd}
                      onRemove={onRemove}
                      swapMode={false}
                    />
                  ))}
                </div>
              </section>
            );
          })}
          {groups.length === 0 && (
            <p className="py-16 text-center text-sm" style={{ color: colors.plumSoft }}>
              Vi bygger just nu upp utbudet i Göteborg — inga leverantörer matchar just nu. Prova en annan kategori eller sökning, eller kom tillbaka snart!
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ProfileView({ provider, party, inCart, cartAddons, onBack, onAdd, onRemove, onToggleAddon, onOpenChat, onSelectDate, onUpdateParty, onSendRequest }) {
  const cat = catMap[provider.category];
  const [requestOpen, setRequestOpen] = useState(false);
  const [pendingAddons, setPendingAddons] = useState([]);
  const initialCalDate = party.date ? new Date(party.date) : new Date();
  const [calYear, setCalYear] = useState(initialCalDate.getFullYear());
  const [calMonthIdx, setCalMonthIdx] = useState(initialCalDate.getMonth());
  const activeAddons = inCart ? cartAddons || [] : pendingAddons;
  const toggleAddon = (addonId) => {
    if (inCart) onToggleAddon(provider.id, addonId);
    else setPendingAddons((a) => (a.includes(addonId) ? a.filter((x) => x !== addonId) : [...a, addonId]));
  };
  const estimate = getLineTotal(provider, activeAddons, party);
  const prevMonth = () => {
    if (calMonthIdx === 0) {
      setCalYear((y) => y - 1);
      setCalMonthIdx(11);
    } else {
      setCalMonthIdx((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (calMonthIdx === 11) {
      setCalYear((y) => y + 1);
      setCalMonthIdx(0);
    } else {
      setCalMonthIdx((m) => m + 1);
    }
  };
  const getDayStatus = (ds) => {
    if (ds < todayStr()) return "past";
    if (provider.closedDates?.includes(ds)) return "closed";
    if (provider.bookedDates?.includes(ds)) return "booked";
    return "open";
  };
  return (
    <div className="mx-auto max-w-3xl px-6 pb-40 pt-8 sm:px-10">
      <div className="mb-5 flex items-center justify-between">
        <button onClick={onBack} className="-ml-2 flex items-center gap-1 px-2 py-1.5 text-sm font-medium" style={{ color: colors.plumSoft }}>
          <ChevronLeft size={16} /> Tillbaka
        </button>
        <HeartButton vendorId={provider.vendorDbId} />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <img
          src={(provider.images && provider.images[0]) || `https://picsum.photos/seed/${provider.seed}/700/500`}
          className="col-span-2 rounded-3xl object-cover"
          style={{ height: 280 }}
          alt={provider.name}
        />
        <img
          src={(provider.images && provider.images[1]) || `https://picsum.photos/seed/${provider.seed}-b/400/500`}
          className="hidden rounded-3xl object-cover sm:block"
          style={{ height: 280 }}
          alt={provider.name}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-2">
        <div>
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: colors.lilacSoft, color: colors.lilacDeep }}
          >
            {cat.label}
          </span>
          <h1 className="mt-2" style={{ fontFamily: serif, fontSize: 30, color: colors.plum }}>
            {provider.name}
          </h1>
          <p className="mt-1 flex items-center gap-1 text-sm" style={{ color: colors.plumSoft }}>
            <MapPin size={14} /> {provider.location}
          </p>
        </div>
        {provider.reviews > 0 ? (
          <StarRating rating={provider.rating} reviews={provider.reviews} size={16} />
        ) : (
          <span className="flex items-center gap-1 text-sm font-semibold" style={{ color: colors.coralDeep }}>
            <Sparkles size={13} /> Ny leverantör
          </span>
        )}
      </div>

      <div className="mt-8 grid gap-8 sm:grid-cols-3">
        <div className="space-y-8 sm:col-span-2">
          {!party.date && (
            <section>
              <h2 className="mb-2 font-semibold" style={{ color: colors.plum }}>
                Tillgänglighet
              </h2>
              <p className="mb-2 text-xs" style={{ color: colors.plumSoft }}>
                Klicka på en ledig dag för att välja den och boka direkt.
              </p>
              <MonthCalendar
                year={calYear}
                month={calMonthIdx}
                onPrevMonth={prevMonth}
                onNextMonth={nextMonth}
                getDayStatus={getDayStatus}
                onDayClick={(ds, status) => status === "open" && onSelectDate(ds)}
                interactive
                highlightDate={null}
                compact
              />
              <CalendarLegend compact />
            </section>
          )}
          <section>
            <h2 className="mb-2 font-semibold" style={{ color: colors.plum }}>
              Om oss
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
              {provider.blurb}
            </p>
          </section>
          <section>
            <h2 className="mb-2 font-semibold" style={{ color: colors.plum }}>
              Tjänst
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
              {provider.service}
            </p>
          </section>
          <section>
            <h2 className="mb-3 font-semibold" style={{ color: colors.plum }}>
              Recensioner
            </h2>
            {provider.reviewsList.length > 0 ? (
              <div className="space-y-3">
                {provider.reviewsList.map((r, i) => (
                  <div key={i} className="rounded-2xl p-4" style={{ backgroundColor: colors.cream }}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-semibold" style={{ color: colors.plum }}>
                        {r.name}
                      </span>
                      <StarRating rating={r.stars} />
                    </div>
                    <p className="text-sm" style={{ color: colors.plumSoft }}>
                      {r.text}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: colors.plumSoft }}>
                Inga recensioner än – en av de första att boka får gärna dela sina intryck efteråt.
              </p>
            )}
          </section>
        </div>

        <div className="sm:col-span-1">
          {provider.requestOnly ? (
            <div className="rounded-3xl p-5 sm:sticky sm:top-6" style={{ backgroundColor: colors.white, border: `1px solid ${colors.beige}` }}>
              <p style={{ fontFamily: serif, fontSize: 22, color: colors.plum }}>{provider.fromPrice > 0 ? `Från ${formatKr(provider.fromPrice)}` : "Pris på förfrågan"}</p>
              <p className="mt-1 text-sm" style={{ color: colors.plumSoft }}>
                Berätta vad du behöver, så svarar leverantören i chatten och skickar en offert med slutpris.
              </p>
              <button
                onClick={() => setRequestOpen(true)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold"
                style={{ backgroundColor: colors.coral, color: colors.white }}
              >
                <ClipboardList size={16} /> Skicka förfrågan
              </button>
              <button
                onClick={() => onOpenChat(provider)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium"
                style={{ border: `1.5px solid ${colors.lilac}`, color: colors.lilacDeep, backgroundColor: colors.white }}
              >
                <MessageCircle size={15} /> Fråga leverantören
              </button>
            </div>
          ) : (
          <div className="rounded-3xl p-5 sm:sticky sm:top-6" style={{ backgroundColor: colors.white, border: `1px solid ${colors.beige}` }}>
            <p style={{ fontFamily: serif, fontSize: 22, color: colors.plum }}>
              Från {formatKr(provider.pricing.amount)}
              {getUnitLabel(provider.pricing)}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: colors.plumSoft }}>
              {getBreakdownText(provider, party)}
            </p>

            {provider.addons.length > 0 && (
              <div className="mt-4 space-y-2 border-t pt-4" style={{ borderColor: colors.beige }}>
                <p className="text-xs font-semibold" style={{ color: colors.plum }}>
                  Tillägg (valfritt)
                </p>
                {provider.addons.map((a) => (
                  <label key={a.id} className="flex items-center justify-between gap-2 text-sm" style={{ color: colors.plum }}>
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={activeAddons.includes(a.id)} onChange={() => toggleAddon(a.id)} />
                      {a.name}
                    </span>
                    <span style={{ color: colors.plumSoft }}>+{formatKr(a.price)}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between border-t pt-4" style={{ borderColor: colors.beige }}>
              <span className="text-sm font-semibold" style={{ color: colors.plum }}>
                Uppskattat pris
              </span>
              <span style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>{formatKr(estimate)}</span>
            </div>

            <div
              className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
              style={{
                backgroundColor: party.date && provider.closedDates?.includes(party.date) ? "#F3EFE9" : "#EAF4EE",
                color: party.date && provider.closedDates?.includes(party.date) ? colors.plumSoft : colors.green,
              }}
            >
              <span
                className="inline-block rounded-full"
                style={{
                  width: 6,
                  height: 6,
                  backgroundColor: party.date && provider.closedDates?.includes(party.date) ? colors.plumSoft : colors.green,
                }}
              />
              {party.date
                ? provider.closedDates?.includes(party.date)
                  ? `Stängd ${party.date}`
                  : `Tillgänglig ${party.date}, ${party.startTime}–${party.endTime}`
                : "Se hela kalendern ovan för tillgänglighet"}
            </div>

            {party.date && (
              <div className="mt-3 space-y-2 rounded-xl p-3" style={{ backgroundColor: colors.cream }}>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-0.5 text-xs" style={{ color: colors.plumSoft }}>
                    Start
                    <input
                      type="time"
                      value={party.startTime}
                      onChange={(e) => onUpdateParty({ startTime: e.target.value })}
                      className="rounded-lg px-2 py-1.5 text-sm"
                      style={{ border: `1px solid ${colors.beige}`, color: colors.plum }}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 text-xs" style={{ color: colors.plumSoft }}>
                    Slut
                    <input
                      type="time"
                      value={party.endTime}
                      onChange={(e) => onUpdateParty({ endTime: e.target.value })}
                      className="rounded-lg px-2 py-1.5 text-sm"
                      style={{ border: `1px solid ${colors.beige}`, color: colors.plum }}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-0.5 text-xs" style={{ color: colors.plumSoft }}>
                  Gäster
                  <input
                    type="number"
                    min={1}
                    value={party.guests}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        onUpdateParty({ guests: "" });
                        return;
                      }
                      const n = Number(raw);
                      if (!Number.isNaN(n)) onUpdateParty({ guests: n });
                    }}
                    onBlur={() => onUpdateParty({ guests: party.guests === "" || party.guests < 1 ? 1 : party.guests })}
                    className="rounded-lg px-2 py-1.5 text-sm"
                    style={{ border: `1px solid ${colors.beige}`, color: colors.plum }}
                  />
                </label>
                <button onClick={() => onUpdateParty({ date: "" })} className="text-xs font-medium underline" style={{ color: colors.lilacDeep }}>
                  Byt datum
                </button>
              </div>
            )}
            {inCart ? (
              <button
                onClick={() => onRemove(provider.id)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold"
                style={{ backgroundColor: colors.lilacSoft, color: colors.lilacDeep }}
              >
                <Check size={16} /> I din fest
              </button>
            ) : (
              <button
                onClick={() => onAdd(provider.id, pendingAddons)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold"
                style={{ backgroundColor: colors.coral, color: colors.white }}
              >
                <Plus size={16} /> Lägg till i min fest
              </button>
            )}
            {provider.request && provider.vendorDbId && (
              <button
                onClick={() => setRequestOpen(true)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold"
                style={{ border: `1.5px solid ${colors.coral}`, color: colors.coral, backgroundColor: colors.white }}
              >
                <ClipboardList size={15} /> Skicka förfrågan
              </button>
            )}
            <button
              onClick={() => onOpenChat(provider)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium"
              style={{ border: `1.5px solid ${colors.lilac}`, color: colors.lilacDeep, backgroundColor: colors.white }}
            >
              <MessageCircle size={15} /> Fråga leverantören
            </button>
          </div>
          )}
          {requestOpen && (
            <RequestFormModal provider={provider} party={party} onUpdateParty={onUpdateParty} onSend={(brief) => onSendRequest(provider, brief)} onClose={() => setRequestOpen(false)} />
          )}
        </div>
      </div>
    </div>
  );
}

function CartDrawer({ open, onClose, cart, party, onSwap, onRemove, onToggleAddon, onGoCheckout, onAddForCategory, onKeepBrowsing }) {
  const total = cart.reduce((sum, p) => sum + getLineTotal(p, p.chosenAddons, party), 0);
  const boardCategoryIds =
    party.categories.length > 0
      ? CATEGORIES.filter((c) => party.categories.includes(c.id)).map((c) => c.id)
      : [...new Set(cart.map((p) => p.category))];
  const isEmpty = boardCategoryIds.length === 0;
  const occasionInfo = party.occasion ? occasionMap[party.occasion] : null;

  return (
    <>
      {open && <div className="fixed inset-0 z-40" style={{ backgroundColor: "rgba(60,47,69,0.35)" }} onClick={onClose} />}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col shadow-2xl transition-transform"
        style={{
          backgroundColor: colors.cream,
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
      >
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1.5px solid ${colors.lilac}` }}>
          <div className="flex items-center gap-2">
            <PartyPopper size={20} color={colors.coral} />
            <h2 style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>Min fest</h2>
          </div>
          <button onClick={onClose} className="-m-2 p-2">
            <X size={20} color={colors.plumSoft} />
          </button>
        </div>

        <div className="px-6 pb-4 pt-4" style={{ borderBottom: `1.5px solid ${colors.lilacSoft}` }}>
          <p style={{ fontFamily: serif, fontSize: 18, color: colors.plum }}>
            {occasionInfo ? `${occasionInfo.emoji} ${occasionInfo.boardLabel}` : "Din fest"}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm" style={{ color: colors.plumSoft }}>
            {party.date && (
              <span className="flex items-center gap-1">
                <Calendar size={14} /> {party.date}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={14} /> {party.startTime}–{party.endTime}
            </span>
            <span className="flex items-center gap-1">
              <Users size={14} /> {party.guests} gäster
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isEmpty ? (
            <p className="py-10 text-center text-sm" style={{ color: colors.plumSoft }}>
              Din fest är tom än så länge. Börja bygga för att fylla på brädet.
            </p>
          ) : (
            <div className="space-y-3">
              {boardCategoryIds.map((catId) => {
                const category = catMap[catId];
                const Icon = category.icon;
                const itemsInCategory = cart.filter((p) => p.category === catId);

                if (itemsInCategory.length === 0) {
                  return (
                    <div
                      key={catId}
                      className="flex items-center gap-3 rounded-2xl p-3"
                      style={{ border: `2px dashed ${colors.lilac}`, backgroundColor: colors.lilacSoft + "66" }}
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: colors.white }}>
                        <Icon size={16} color={colors.lilacDeep} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: colors.plum }}>
                          {category.label}
                        </p>
                        <p className="text-xs" style={{ color: colors.plumSoft }}>
                          Ingen vald ännu
                        </p>
                      </div>
                      <button
                        onClick={() => onAddForCategory(catId)}
                        className="flex flex-shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold"
                        style={{ backgroundColor: colors.coral, color: colors.white }}
                      >
                        <Plus size={13} /> Lägg till
                      </button>
                    </div>
                  );
                }

                return itemsInCategory.map((p) => {
                  const chosen = p.chosenAddons || [];
                  const chosenAddonObjs = p.addons.filter((a) => chosen.includes(a.id));
                  return (
                    <div key={p.id} className="rounded-2xl p-3 shadow-sm" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: colors.lilacSoft }}>
                          <Icon size={16} color={colors.lilacDeep} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold" style={{ color: colors.plum }}>
                            {p.name}
                          </p>
                          <p className="text-xs" style={{ color: colors.plumSoft }}>
                            {getBreakdownText(p, party)}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 flex-col items-end gap-1">
                          <span className="text-sm font-semibold" style={{ color: colors.plum }}>
                            {formatKr(getLineTotal(p, chosen, party))}
                          </span>
                          <div className="flex gap-1">
                            <button onClick={() => onSwap(p)} title="Byt" className="rounded-full p-1.5" style={{ backgroundColor: colors.cream }}>
                              <RefreshCw size={13} color={colors.plum} />
                            </button>
                            <button onClick={() => onRemove(p.id)} title="Ta bort" className="rounded-full p-1.5" style={{ backgroundColor: colors.cream }}>
                              <Trash2 size={13} color={colors.coralDeep} />
                            </button>
                          </div>
                        </div>
                      </div>
                      {chosenAddonObjs.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5 pl-12">
                          {chosenAddonObjs.map((a) => (
                            <button
                              key={a.id}
                              onClick={() => onToggleAddon(p.id, a.id)}
                              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                              style={{ backgroundColor: colors.lilacSoft, color: colors.lilacDeep }}
                            >
                              {a.name} (+{formatKr(a.price)}) <X size={11} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-5" style={{ borderTop: `1.5px solid ${colors.lilac}` }}>
          <div className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-semibold" style={{ color: colors.plum }}>
              <Sparkles size={15} color={colors.lilacDeep} /> Total hittills
            </span>
            <span style={{ fontFamily: serif, fontSize: 22, color: colors.plum }}>{formatKr(total)}</span>
          </div>
          <button
            onClick={onGoCheckout}
            disabled={cart.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold"
            style={{ backgroundColor: colors.coral, color: colors.white, opacity: cart.length === 0 ? 0.45 : 1 }}
          >
            Gå till checkout <ArrowRight size={16} />
          </button>
          <button onClick={onKeepBrowsing} className="mt-2 w-full py-2 text-sm font-medium underline" style={{ color: colors.plumSoft }}>
            Fortsätt bygga festen →
          </button>
        </div>
      </div>
    </>
  );
}

function CheckoutView({ cart, party, session, onOpenCart, onConfirm, onGuestConfirm, onLogin, guestError, guestSubmitting, guestBlockReason, onOpenTerms, events = [], eventChoice, onEventChoice }) {
  const [accepted, setAccepted] = useState(false);
  const [gName, setGName] = useState("");
  const [gEmail, setGEmail] = useState("");
  const [gPhone, setGPhone] = useState("");
  const [tried, setTried] = useState(false);
  const total = cart.reduce((sum, p) => sum + getLineTotal(p, p.chosenAddons, party), 0);
  const isGuest = !session;
  const gErrors = {
    name: gName.trim() ? "" : "Fyll i ditt namn",
    email: EMAIL_RE.test(gEmail.trim()) ? "" : "Ange en giltig e-postadress",
    phone: gPhone.trim() ? "" : "Fyll i ditt telefonnummer",
    date: party.date ? "" : "Välj ett datum för ditt event först",
  };
  const gValid = !Object.values(gErrors).some(Boolean);
  const fieldStyle = { border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white };
  const err = (k) =>
    tried && gErrors[k] ? (
      <span className="text-xs" style={{ color: colors.coralDeep }}>
        {gErrors[k]}
      </span>
    ) : null;

  return (
    <div className="mx-auto max-w-2xl px-6 pb-24 pt-10 sm:px-10">
      <h1 style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>Din fest</h1>
      <div className="mt-6 rounded-2xl p-4 text-sm leading-relaxed" style={{ backgroundColor: colors.cream, color: colors.plumSoft }}>
        <p className="mb-1 font-semibold" style={{ color: colors.plum }}>
          Bokningsvillkor & avbokningsregler
        </p>
        Att boka skickar en förfrågan till respektive leverantör, som bekräftar eller avböjer inom 24
        timmar. Betalning sker först när samtliga leverantörer bekräftat. Avbokning senare än 14 dagar
        innan eventet kan medföra kostnad enligt leverantörens villkor. Fullständiga villkor finns i
        Planifests allmänna villkor.
      </div>

      {isGuest && (
        <div className="mt-4 rounded-2xl p-5" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
          <p style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>Boka som gäst</p>
          {guestBlockReason ? (
            <>
              <p className="mt-2 text-sm" style={{ color: colors.plumSoft }}>
                {guestBlockReason}
              </p>
              <button onClick={onLogin} className="mt-3 rounded-full px-5 py-2.5 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
                Logga in
              </button>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm" style={{ color: colors.plumSoft }}>
                Du behöver inget konto för att boka. Vi mejlar dig en länk att bekräfta, och en länk där du följer och kan avboka din bokning.
              </p>
              <label className="mt-4 flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
                Namn
                <input value={gName} onChange={(e) => setGName(e.target.value)} maxLength={100} autoComplete="name" className="rounded-xl px-3 py-2 text-sm font-normal" style={fieldStyle} />
                {err("name")}
              </label>
              <label className="mt-3 flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
                E-post
                <input type="email" value={gEmail} onChange={(e) => setGEmail(e.target.value)} maxLength={254} autoComplete="email" className="rounded-xl px-3 py-2 text-sm font-normal" style={fieldStyle} />
                {err("email")}
              </label>
              <label className="mt-3 flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
                Telefonnummer
                <input type="tel" value={gPhone} onChange={(e) => setGPhone(e.target.value)} maxLength={40} autoComplete="tel" className="rounded-xl px-3 py-2 text-sm font-normal" style={fieldStyle} />
                {err("phone")}
              </label>
              {tried && gErrors.date && (
                <p className="mt-2 text-xs" style={{ color: colors.coralDeep }}>
                  {gErrors.date}
                </p>
              )}
              <p className="mt-3 text-xs" style={{ color: colors.plumSoft }}>
                Dina uppgifter delas med en leverantör först när hen har accepterat din bokning. Med ett konto kan du också chatta med leverantörer, spara favoriter och planera din fest.{" "}
                <button type="button" onClick={onLogin} className="font-semibold underline" style={{ color: colors.lilacDeep }}>
                  Logga in
                </button>
              </p>
            </>
          )}
        </div>
      )}

      {!isGuest && events.length > 0 && (
        <label className="mt-4 flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
          Koppla bokningen till din planering
          <select value={eventChoice} onChange={(e) => onEventChoice(e.target.value)} className="rounded-xl px-3 py-2 text-sm font-normal" style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }}>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
            <option value="none">Ingen planering</option>
          </select>
        </label>
      )}

      <label className="mt-4 flex items-start gap-3 text-sm" style={{ color: colors.plum }}>
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1" />
        Jag har läst och godkänner Planifests{" "}
        <button type="button" onClick={onOpenTerms} className="font-semibold underline" style={{ color: colors.lilacDeep }}>
          bokningsvillkor och avbokningsregler
        </button>
        .
      </label>

      {isGuest ? (
        <>
          {guestError && (
            <p className="mt-3 text-sm" style={{ color: colors.coralDeep }}>
              {guestError}
            </p>
          )}
          <button
            disabled={!accepted || cart.length === 0 || !!guestBlockReason || guestSubmitting}
            onClick={() => {
              setTried(true);
              if (gValid) onGuestConfirm({ name: gName.trim(), email: gEmail.trim(), phone: gPhone.trim() });
            }}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3 text-base font-semibold"
            style={{ backgroundColor: colors.coral, color: colors.white, opacity: accepted && cart.length > 0 && !guestBlockReason && !guestSubmitting ? 1 : 0.45 }}
          >
            {guestSubmitting ? "Skickar..." : "Skicka förfrågan som gäst"}
          </button>
        </>
      ) : (
        <button
          disabled={!accepted || cart.length === 0}
          onClick={onConfirm}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3 text-base font-semibold"
          style={{ backgroundColor: colors.coral, color: colors.white, opacity: accepted && cart.length > 0 ? 1 : 0.45 }}
        >
          Boka &amp; betala
        </button>
      )}
      <p className="mt-2 text-center text-xs" style={{ color: colors.plumSoft }}>
        Detta skickar en bokningsförfrågan till leverantörerna. Ingen betalning sker i denna prototyp.
      </p>
    </div>
  );
}

// "Check your email": shown right after a guest sends their booking.
function GuestCheckView({ email, onHome }) {
  return (
    <div className="mx-auto max-w-xl px-6 pb-24 pt-14 text-center sm:px-10">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: colors.coralSoft }}>
        <Check size={28} color={colors.coral} />
      </div>
      <h1 style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>Bekräfta din e-post</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
        Vi har skickat ett mejl till <strong>{email}</strong>. Klicka på knappen i mejlet så skickas din förfrågan vidare till leverantörerna.
      </p>
      <p className="mx-auto mt-2 max-w-sm text-xs" style={{ color: colors.plumSoft }}>
        Hittar du inget mejl? Titta i skräpposten. Förfrågan skickas inte vidare förrän du har bekräftat.
      </p>
      <button onClick={onHome} className="mt-6 w-full rounded-full py-3 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
        Till startsidan
      </button>
    </div>
  );
}

// The guest's own booking page, reached from the link in their emails.
function GuestBookingView({ state, onCancel, onHome, onCreateAccount }) {
  const [confirming, setConfirming] = useState(false);
  const { loading, error, data, justVerified } = state;
  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-6 pb-24 pt-14 text-center sm:px-10">
        <p className="text-sm" style={{ color: colors.plumSoft }}>
          Hämtar din bokning...
        </p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl px-6 pb-24 pt-14 text-center sm:px-10">
        <h1 style={{ fontFamily: serif, fontSize: 26, color: colors.plum }}>Länken fungerar inte</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm" style={{ color: colors.plumSoft }}>
          {error || "Bokningen hittades inte."} Kontakta oss på info@planifest.se om du behöver hjälp.
        </p>
        <button onClick={onHome} className="mt-6 w-full rounded-full py-3 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
          Till startsidan
        </button>
      </div>
    );
  }
  const total = data.items.reduce((sum, i) => sum + Number(i.price || 0), 0);
  const time = data.start_time && data.end_time ? `${String(data.start_time).slice(0, 5)}–${String(data.end_time).slice(0, 5)}` : "";
  return (
    <div className="mx-auto max-w-xl px-6 pb-24 pt-12 sm:px-10">
      {justVerified && !data.cancelled && (
        <div className="mb-5 rounded-2xl p-4 text-center" style={{ backgroundColor: "#E3F3E9" }}>
          <p className="font-semibold" style={{ color: colors.green }}>
            Tack! Din förfrågan är skickad
          </p>
          <p className="mt-1 text-sm" style={{ color: colors.plum }}>
            Leverantörerna svarar normalt inom 24 timmar. Du får ett mejl så fort någon har svarat.
          </p>
        </div>
      )}
      <h1 style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>Din bokning</h1>
      <p className="mt-1 text-sm" style={{ color: colors.plumSoft }}>
        {data.booking_number} · {data.date}
        {time ? `, ${time}` : ""} · {data.guests} gäster
      </p>
      {data.cancelled && (
        <div className="mt-4 rounded-2xl p-4 text-sm font-semibold" style={{ backgroundColor: colors.beige, color: colors.plum }}>
          Den här bokningen är avbokad.
        </div>
      )}
      <div className="mt-5 space-y-2">
        {data.items.map((i, k) => {
          const meta = BOOKING_STATUS_META[data.cancelled ? "cancelled" : i.status] || BOOKING_STATUS_META.pending;
          return (
            <div key={k} className="flex items-center justify-between gap-3 rounded-2xl p-4" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
              <div>
                <p className="font-semibold" style={{ color: colors.plum }}>
                  {i.name}
                </p>
                <p className="text-xs" style={{ color: colors.plumSoft }}>
                  {catMap[i.category_id]?.label || ""} · {formatKr(i.price)}
                </p>
              </div>
              <span className="flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: meta.bg, color: meta.fg }}>
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: colors.plum }}>
          Totalt
        </span>
        <span style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>{formatKr(total)}</span>
      </div>

      {!data.cancelled && (
        <div className="mt-6">
          {confirming ? (
            <div className="rounded-2xl p-4" style={{ backgroundColor: colors.cream }}>
              <p className="text-sm" style={{ color: colors.plum }}>
                Vill du avboka hela bokningen? Avbokning senare än 14 dagar innan eventet kan medföra kostnad enligt leverantörens villkor.
              </p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setConfirming(false)} className="flex-1 rounded-full px-4 py-2.5 text-sm font-medium" style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }}>
                  Behåll
                </button>
                <button
                  onClick={async () => {
                    await onCancel();
                    setConfirming(false);
                  }}
                  className="flex-1 rounded-full px-4 py-2.5 text-sm font-semibold"
                  style={{ backgroundColor: colors.coralDeep, color: colors.white }}
                >
                  Ja, avboka
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} className="w-full rounded-full py-2.5 text-sm font-medium" style={{ border: `1.5px solid ${colors.coral}`, color: colors.coral, backgroundColor: colors.white }}>
              Avboka bokningen
            </button>
          )}
        </div>
      )}

      <div className="mt-8 rounded-2xl p-5" style={{ backgroundColor: colors.lilacSoft }}>
        <p className="font-semibold" style={{ color: colors.plum }}>
          Vill du chatta, spara favoriter och planera din fest?
        </p>
        <p className="mt-1 text-sm" style={{ color: colors.plum }}>
          Med ett gratis konto kan du prata med leverantörerna, spara dem och använda checklistor och budget.
        </p>
        <button onClick={onCreateAccount} className="mt-3 rounded-full px-5 py-2.5 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
          Skapa konto
        </button>
      </div>
    </div>
  );
}

// Vendor side: a guest's contact details, shown only once the vendor has accepted the booking.
function GuestContact({ bookingId, fetchContact }) {
  const [contact, setContact] = useState(null);
  useEffect(() => {
    let stop = false;
    if (bookingId) fetchContact(bookingId).then((c) => !stop && setContact(c));
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);
  if (!contact) return null;
  return (
    <p className="mt-2 text-xs" style={{ color: colors.plum }}>
      <strong>Gäst:</strong> {contact.name}
      {contact.phone ? ` · ${contact.phone}` : ""} · {contact.email}
    </p>
  );
}

function ConfirmationView({ booking, onRestart, onMinaBokningar }) {
  if (!booking) return null;
  const occasionInfo = booking.occasion ? occasionMap[booking.occasion] : null;
  return (
    <div className="mx-auto max-w-xl px-6 pb-24 pt-14 text-center sm:px-10">
      <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center">
        <span className="absolute rounded-full" style={{ width: 6, height: 6, backgroundColor: colors.lilac, top: -6, left: 2 }} />
        <span className="absolute rounded-full" style={{ width: 5, height: 5, backgroundColor: colors.pink, top: 4, right: -10 }} />
        <span className="absolute rounded-full" style={{ width: 5, height: 5, backgroundColor: colors.peach, bottom: -8, left: -8 }} />
        <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: colors.coralSoft }}>
          <PartyPopper size={28} color={colors.coral} />
        </div>
      </div>
      <h1 style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>Bokningsförfrågan skickad!</h1>
      <p className="mt-2 text-sm" style={{ color: colors.plumSoft }}>
        Referensnummer <strong style={{ color: colors.plum }}>{booking.bookingNumber}</strong>
      </p>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
        Vi har skickat din förfrågan till leverantörerna nedan. De brukar svara inom 24 timmar — du får
        besked här och via mejl så snart de bekräftat.
      </p>
      {occasionInfo && (
        <p className="mt-2 text-sm" style={{ color: colors.plum }}>
          {occasionInfo.emoji} {occasionInfo.label}
        </p>
      )}

      <div className="mt-6 rounded-3xl p-6 text-left" style={{ backgroundColor: colors.white, border: `1px solid ${colors.beige}` }}>
        <p className="mb-3 flex flex-wrap gap-4 text-sm" style={{ color: colors.plumSoft }}>
          <span className="flex items-center gap-1">
            <Calendar size={14} /> {booking.date}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={14} /> {booking.startTime}–{booking.endTime}
          </span>
          <span className="flex items-center gap-1">
            <Users size={14} /> {booking.guests} gäster
          </span>
        </p>
        <div className="space-y-2" style={{ borderTop: `1px solid ${colors.beige}`, paddingTop: 12 }}>
          {booking.items.map((item) => {
            const meta = BOOKING_STATUS_META[item.status] || BOOKING_STATUS_META.pending;
            return (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span style={{ color: colors.plum }}>{item.name}</span>
                <span
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ backgroundColor: meta.bg, color: meta.fg }}
                >
                  <Clock size={12} /> {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-xs" style={{ color: colors.plumSoft }}>
        Betalning sker först när samtliga leverantörer bekräftat bokningen.
      </p>

      <button
        onClick={onMinaBokningar}
        className="mt-6 w-full rounded-full py-3 text-sm font-semibold"
        style={{ backgroundColor: colors.coral, color: colors.white }}
      >
        Visa Mina bokningar
      </button>
      <button onClick={onRestart} className="mt-3 w-full py-2 text-sm font-medium underline" style={{ color: colors.plumSoft }}>
        Boka en till fest
      </button>
    </div>
  );
}

function MinaBokningarView({ bookings, onCancelBooking, onReviewItem, onChatItem }) {
  const [tab, setTab] = useState("upcoming");
  const tabs = [
    { id: "upcoming", label: "Kommande" },
    { id: "completed", label: "Genomförda" },
    { id: "cancelled", label: "Avbokade" },
  ];
  const getTab = (b) => (b.cancelled ? "cancelled" : b.completed ? "completed" : "upcoming");
  const filtered = bookings.filter((b) => getTab(b) === tab);

  return (
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-10 sm:px-10">
      <h1 style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>Mina bokningar</h1>

      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="rounded-full px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: tab === t.id ? colors.coral : colors.white,
              color: tab === t.id ? colors.white : colors.plumSoft,
              border: `1.5px solid ${tab === t.id ? colors.coral : colors.beige}`,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {filtered.length === 0 && (
          <p className="py-16 text-center text-sm" style={{ color: colors.plumSoft }}>
            {tab === "upcoming"
              ? "Inga kommande bokningar än."
              : tab === "completed"
              ? "Inga genomförda bokningar än."
              : "Inga avbokade bokningar."}
          </p>
        )}
        {filtered.map((b) => {
          const total = b.items.reduce((sum, i) => sum + i.price, 0);
          const occasionInfo = b.occasion ? occasionMap[b.occasion] : null;
          return (
            <div key={b.bookingNumber} className="rounded-3xl p-5" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p style={{ fontFamily: serif, fontSize: 18, color: colors.plum }}>
                    {occasionInfo ? `${occasionInfo.emoji} ${occasionInfo.boardLabel}` : "Din fest"}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-3 text-sm" style={{ color: colors.plumSoft }}>
                    <span className="flex items-center gap-1">
                      <Calendar size={13} /> {b.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={13} /> {b.startTime}–{b.endTime}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={13} /> {b.guests} gäster
                    </span>
                  </p>
                </div>
                <span className="text-xs" style={{ color: colors.plumSoft }}>
                  {b.bookingNumber}
                </span>
              </div>

              <div className="mt-4 space-y-2 border-t pt-4" style={{ borderColor: colors.beige }}>
                {b.items.map((item) => {
                  const Icon = catMap[item.category]?.icon;
                  const meta = BOOKING_STATUS_META[item.status] || BOOKING_STATUS_META.pending;
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2" style={{ color: colors.plum }}>
                        {Icon && <Icon size={14} color={colors.lilacDeep} />} {item.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span style={{ color: colors.plumSoft }}>{formatKr(item.price)}</span>
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: meta.bg, color: meta.fg }}>
                          {meta.label}
                        </span>
                        {item.status !== "cancelled" && (
                          <button
                            onClick={() => onChatItem(b.bookingNumber, item)}
                            className="rounded-full p-1.5"
                            style={{ backgroundColor: colors.lilacSoft }}
                            aria-label={`Chatta med ${item.name}`}
                          >
                            <MessageCircle size={13} color={colors.lilacDeep} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between border-t pt-4" style={{ borderColor: colors.beige }}>
                <span className="font-semibold" style={{ color: colors.plum }}>
                  Totalt
                </span>
                <span style={{ fontFamily: serif, fontSize: 18, color: colors.plum }}>{formatKr(total)}</span>
              </div>

              {tab === "upcoming" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => onCancelBooking(b.bookingNumber)}
                    className="rounded-full px-4 py-2 text-xs font-medium"
                    style={{ border: `1.5px solid ${colors.coral}`, color: colors.coralDeep }}
                  >
                    Avboka
                  </button>
                </div>
              )}

              {tab === "completed" && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {b.items
                    .filter((item) => !item.reviewed && (item.status === "confirmed" || item.status === "completed"))
                    .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => onReviewItem(b.bookingNumber, item)}
                        className="rounded-full px-4 py-2 text-xs font-semibold"
                        style={{ backgroundColor: colors.coral, color: colors.white }}
                      >
                        Recensera {item.name}
                      </button>
                    ))}
                  {b.items.some((i) => i.status === "confirmed" || i.status === "completed") && b.items.filter((i) => i.status === "confirmed" || i.status === "completed").every((i) => i.reviewed) && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: colors.plumSoft }}>
                      <Check size={13} color={colors.green} /> Tack för din recension!
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewModal({ target, onSubmit, onClose }) {
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");
  if (!target) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ backgroundColor: "rgba(60,47,69,0.45)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-6 sm:rounded-3xl"
        style={{ backgroundColor: colors.cream }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>Recensera {target.item.name}</h2>
        <p className="mt-1 text-sm" style={{ color: colors.plumSoft }}>
          Din upplevelse hjälper andra att välja rätt.
        </p>

        <div className="mt-4 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setStars(n)} aria-label={`${n} stjärnor`}>
              <Star size={28} fill={n <= stars ? colors.coral : "none"} color={colors.coral} />
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Berätta kort om din upplevelse..."
          className="mt-4 w-full rounded-xl px-3 py-2 text-sm"
          style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }}
        />

        <div className="mt-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-full px-4 py-3 text-sm font-medium"
            style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }}
          >
            Avbryt
          </button>
          <button
            onClick={() => onSubmit(stars, text)}
            disabled={!text.trim()}
            className="flex-1 rounded-full px-4 py-3 text-sm font-semibold"
            style={{ backgroundColor: colors.coral, color: colors.white, opacity: text.trim() ? 1 : 0.5 }}
          >
            Skicka recension
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat (Fas 4) — a mocked conversation per booking item. Nothing here is a
// real backend: messages live only in this browser session, and "the vendor"
// is simulated with a short delay + a canned reply so the flow feels alive
// during testing. Replace with real messaging once a backend exists.
// ---------------------------------------------------------------------------
const VENDOR_AUTO_REPLIES = [
  "Hej! Tack för ditt meddelande, vi återkommer så snart vi kan.",
  "Tack för att du hör av dig – vi kikar på det här och svarar inom kort.",
  "Hej! Vi har tagit emot din fråga och återkommer strax.",
  "Tack! Vi ser över det här och hör av oss igen inom kort.",
];

// Basic heuristic filter against the easiest way to dodge the platform: swapping
// contact details in the very first chat message. Not bulletproof (see the
// anti-circumvention clause discussion — this closes one door, not all of them),
// but catches phone numbers, emails, @handles and the most common phrasing.
const CONTACT_INFO_PATTERNS = [
  /(?:\+46|0)[\d\s\-]{7,}\d/, // phone number (Swedish-style: starts with 0 or +46)
  /[^\s@]+@[^\s@]+\.[^\s@]+/, // email address
  /@[a-zA-Z0-9_.]{2,}/, // @instagram-handle style mention
  /\b(instagram|insta|snapchat|whatsapp|messenger|facebook|tiktok)\b/i, // platform names
  /\b(ring mig|ring till mig|maila mig|mejla mig|sms:a mig|mitt nummer|kontakta mig p[åa])\b/i, // common phrasing
];

function containsContactInfo(text) {
  return CONTACT_INFO_PATTERNS.some((re) => re.test(text));
}

function ChatModal({ target, messages, vendorTyping, onSend, onClose, onAcceptQuote, onDeclineQuote, onOpenCart }) {
  const [text, setText] = useState("");
  const [blocked, setBlocked] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, vendorTyping, target]);

  if (!target) return null;

  const vendorName = target.kind === "booking" ? target.item.name : target.provider.name;

  const submit = () => {
    if (!text.trim()) return;
    if (containsContactInfo(text)) {
      setBlocked(true);
      return;
    }
    onSend(text);
    setText("");
  };

  const handleChange = (e) => {
    setText(e.target.value);
    if (blocked) setBlocked(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ backgroundColor: "rgba(60,47,69,0.45)" }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col rounded-t-3xl sm:rounded-3xl"
        style={{ backgroundColor: colors.cream, height: "min(560px, 82vh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1.5px solid ${colors.lilacSoft}` }}>
          <div>
            <p style={{ fontFamily: serif, fontSize: 18, color: colors.plum }}>{vendorName}</p>
            <p className="text-xs" style={{ color: colors.plumSoft }}>
              {target.kind === "booking" ? target.bookingNumber : catMap[target.provider.category]?.label || "Meddelanden"}
            </p>
          </div>
          <button onClick={onClose} className="-m-2 p-2" aria-label="Stäng chatt">
            <X size={18} color={colors.plumSoft} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {messages.length === 0 && !vendorTyping && (
            <p className="py-8 text-center text-sm" style={{ color: colors.plumSoft }}>
              {target.kind === "booking"
                ? `Skriv ett meddelande till ${target.item.name} om er bokning.`
                : `Skriv en fråga till ${vendorName} — kolla t.ex. om de har det du behöver innan du bokar.`}
            </p>
          )}
          {messages.map((m) =>
            m.message_type === "brief" ? (
              <div key={m.id} className="flex" style={{ justifyContent: m.sender === "customer" ? "flex-end" : "flex-start" }}>
                <BriefCard brief={m.brief} />
              </div>
            ) : m.message_type === "quote" ? (
              <div key={m.id} className="flex" style={{ justifyContent: "flex-start" }}>
                <div className="max-w-[85%] rounded-2xl p-3.5 text-sm" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
                  <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: colors.lilacDeep }}>
                    <Sparkles size={13} /> Offert
                  </p>
                  <p className="mt-1" style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>
                    {formatKr(m.quote_amount)}
                  </p>
                  {m.quote_description && (
                    <p className="mt-1 text-sm" style={{ color: colors.plumSoft }}>
                      {m.quote_description}
                    </p>
                  )}
                  {m.quote_status === "pending" ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => onDeclineQuote(m)}
                        className="flex-1 rounded-full px-3 py-2 text-xs font-medium"
                        style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }}
                      >
                        Tacka nej
                      </button>
                      <button
                        onClick={() => onAcceptQuote(m)}
                        className="flex-1 rounded-full px-3 py-2 text-xs font-semibold"
                        style={{ backgroundColor: colors.coral, color: colors.white }}
                      >
                        Acceptera
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: m.quote_status === "accepted" ? "#E3F3E9" : colors.beige,
                          color: m.quote_status === "accepted" ? colors.green : colors.plumSoft,
                        }}
                      >
                        {m.quote_status === "accepted" ? <Check size={12} /> : <X size={12} />}
                        {m.quote_status === "accepted" ? "Accepterad — tillagd i Min fest" : "Tackade nej"}
                      </span>
                      {m.quote_status === "accepted" && onOpenCart && (
                        <button onClick={onOpenCart} className="text-xs font-semibold underline" style={{ color: colors.lilacDeep }}>
                          Öppna Min fest
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex" style={{ justifyContent: m.sender === "customer" ? "flex-end" : "flex-start" }}>
                <div
                  className="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm"
                  style={{
                    backgroundColor: m.sender === "customer" ? colors.coral : colors.white,
                    color: m.sender === "customer" ? colors.white : colors.plum,
                    border: m.sender === "customer" ? "none" : `1px solid ${colors.beige}`,
                  }}
                >
                  {m.text}
                </div>
              </div>
            )
          )}
          {vendorTyping && (
            <div className="flex" style={{ justifyContent: "flex-start" }}>
              <div
                className="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm italic"
                style={{ backgroundColor: colors.white, border: `1px solid ${colors.beige}`, color: colors.plumSoft }}
              >
                Skriver...
              </div>
            </div>
          )}
        </div>

        {blocked && (
          <p className="px-5 pb-2 text-xs leading-relaxed" style={{ color: colors.coralDeep }}>
            Det går inte att skicka telefonnummer, e-post eller sociala medier i chatten — håll kontakten här på Planifest så gäller våra villkor och ert skydd. Skriv om meddelandet utan kontaktuppgifter.
          </p>
        )}

        <div className="flex items-center gap-2 px-5 pt-3" style={{ borderTop: `1.5px solid ${colors.lilacSoft}` }}>
          <input
            value={text}
            onChange={handleChange}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Skriv ett meddelande..."
            className="flex-1 rounded-full px-4 py-2.5 text-sm"
            style={{ border: `1.5px solid ${blocked ? colors.coral : colors.beige}`, color: colors.plum, backgroundColor: colors.white }}
          />
          <button
            onClick={submit}
            disabled={!text.trim()}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.coral, color: colors.white, opacity: text.trim() ? 1 : 0.5 }}
            aria-label="Skicka"
          >
            <ArrowRight size={16} />
          </button>
        </div>
        <p className="px-5 pb-4 pt-2 text-center text-xs" style={{ color: colors.plumSoft }}>
          Prototyp — meddelanden sparas inte mellan sessioner, och svaret ovan är simulerat.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Support (Fas 4) — a simple contact form. Messages are kept in memory only
// (supportMessages in App state); there is no inbox or real delivery yet.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Auth (Fas 5) — real Supabase accounts. Covers customer sign up/in only;
// the dedicated vendor signup flow further down still runs on local mock
// data for now (see the note where it's rendered).
// ---------------------------------------------------------------------------
function AuthModal({ open, mode, onModeChange, onClose, onSignIn, onSignUp, onForgotPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signedUp, setSignedUp] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  if (!open) return null;

  const reset = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setConfirmPassword("");
    setError("");
    setSignedUp(false);
    setResetSent(false);
  };
  const closeAndReset = () => {
    onClose();
    setTimeout(reset, 300);
  };

  const submit = async () => {
    setError("");
    if (mode === "forgot") {
      if (!email.trim()) {
        setError("Fyll i din e-postadress.");
        return;
      }
      setLoading(true);
      await onForgotPassword(email.trim());
      setLoading(false);
      setResetSent(true);
      return;
    }
    if (!email.trim() || !password) {
      setError("Fyll i e-post och lösenord.");
      return;
    }
    if (mode === "signup") {
      if (!fullName.trim()) {
        setError("Fyll i ditt namn.");
        return;
      }
      if (password.length < 6) {
        setError("Lösenordet måste vara minst 6 tecken.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Lösenorden matchar inte.");
        return;
      }
    }
    setLoading(true);
    const err =
      mode === "signin" ? await onSignIn(email.trim(), password) : await onSignUp(email.trim(), password, fullName.trim());
    setLoading(false);
    if (err) {
      setError(err.message || "Något gick fel, försök igen.");
      return;
    }
    if (mode === "signup") setSignedUp(true);
    else closeAndReset();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ backgroundColor: "rgba(60,47,69,0.45)" }}
      onClick={closeAndReset}
    >
      <div className="w-full max-w-md rounded-t-3xl p-6 sm:rounded-3xl" style={{ backgroundColor: colors.cream }} onClick={(e) => e.stopPropagation()}>
        {signedUp ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: colors.coralSoft }}>
              <Check size={22} color={colors.coralDeep} />
            </div>
            <h2 style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>Kolla din mejl!</h2>
            <p className="mt-2 text-sm" style={{ color: colors.plumSoft }}>
              Vi har skickat en bekräftelselänk till <strong>{email}</strong>. Klicka på den för att aktivera kontot, logga sedan in här.
            </p>
            <button
              onClick={closeAndReset}
              className="mt-5 w-full rounded-full py-3 text-sm font-semibold"
              style={{ backgroundColor: colors.coral, color: colors.white }}
            >
              Stäng
            </button>
          </div>
        ) : resetSent ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: colors.coralSoft }}>
              <Check size={22} color={colors.coralDeep} />
            </div>
            <h2 style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>Kolla din mejl!</h2>
            <p className="mt-2 text-sm" style={{ color: colors.plumSoft }}>
              Om <strong>{email}</strong> har ett konto hos oss har vi skickat en länk dit för att återställa lösenordet.
            </p>
            <button
              onClick={closeAndReset}
              className="mt-5 w-full rounded-full py-3 text-sm font-semibold"
              style={{ backgroundColor: colors.coral, color: colors.white }}
            >
              Stäng
            </button>
          </div>
        ) : mode === "forgot" ? (
          <>
            <h2 style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>Glömt lösenord?</h2>
            <p className="mt-1 text-sm" style={{ color: colors.plumSoft }}>
              Fyll i din e-post så skickar vi en länk för att välja ett nytt lösenord.
            </p>
            <div className="mt-4 space-y-3">
              <VendorTextField label="E-post" type="email" value={email} onChange={setEmail} />
            </div>
            {error && (
              <p className="mt-2 text-xs" style={{ color: colors.coralDeep }}>
                {error}
              </p>
            )}
            <button
              onClick={submit}
              disabled={loading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold"
              style={{ backgroundColor: colors.coral, color: colors.white, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Ett ögonblick..." : "Skicka återställningslänk"}
            </button>
            <button
              onClick={() => onModeChange("signin")}
              className="mt-3 w-full text-center text-sm font-medium underline"
              style={{ color: colors.lilacDeep }}
            >
              Tillbaka till inloggning
            </button>
          </>
        ) : (
          <>
            <h2 style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>{mode === "signin" ? "Logga in" : "Skapa konto"}</h2>
            <div className="mt-4 space-y-3">
              {mode === "signup" && <VendorTextField label="Namn" value={fullName} onChange={setFullName} />}
              <VendorTextField label="E-post" type="email" value={email} onChange={setEmail} />
              <VendorTextField label="Lösenord" type="password" value={password} onChange={setPassword} />
              {mode === "signup" && <VendorTextField label="Bekräfta lösenord" type="password" value={confirmPassword} onChange={setConfirmPassword} />}
            </div>
            {mode === "signin" && (
              <button
                onClick={() => {
                  setError("");
                  onModeChange("forgot");
                }}
                className="mt-2 text-xs font-medium underline"
                style={{ color: colors.lilacDeep }}
              >
                Glömt lösenord?
              </button>
            )}
            {error && (
              <p className="mt-2 text-xs" style={{ color: colors.coralDeep }}>
                {error}
              </p>
            )}
            <button
              onClick={submit}
              disabled={loading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold"
              style={{ backgroundColor: colors.coral, color: colors.white, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Ett ögonblick..." : mode === "signin" ? "Logga in" : "Skapa konto"}
            </button>
            <button
              onClick={() => onModeChange(mode === "signin" ? "signup" : "signin")}
              className="mt-3 w-full text-center text-sm font-medium underline"
              style={{ color: colors.lilacDeep }}
            >
              {mode === "signin" ? "Inget konto? Skapa ett" : "Har du redan ett konto? Logga in"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SupportModal({ open, onClose, onSubmit, defaultEmail }) {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — a real person never sees or fills this
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && defaultEmail && !email) setEmail(defaultEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultEmail]);

  if (!open) return null;

  const emailOk = EMAIL_RE.test(email.trim());
  const canSend = message.trim().length > 0 && emailOk && !sending;
  const fieldStyle = { border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white };

  const submit = async () => {
    if (!canSend) return;
    setError("");
    if (website) {
      setSent(true); // looks like a bot: pretend it worked, send nothing
      return;
    }
    setSending(true);
    const err = await onSubmit({ email: email.trim(), subject: subject.trim(), message: message.trim() });
    setSending(false);
    if (err) {
      setError("Det gick inte att skicka just nu. Försök igen, eller mejla info@planifest.se.");
      return;
    }
    setSent(true);
  };

  const closeAndReset = () => {
    onClose();
    setTimeout(() => {
      setSent(false);
      setSubject("");
      setMessage("");
      setError("");
    }, 300);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ backgroundColor: "rgba(60,47,69,0.45)" }}
      onClick={closeAndReset}
    >
      <div className="w-full max-w-md rounded-t-3xl p-6 sm:rounded-3xl" style={{ backgroundColor: colors.cream }} onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: colors.coralSoft }}>
              <Check size={22} color={colors.coralDeep} />
            </div>
            <h2 style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>Tack för ditt meddelande!</h2>
            <p className="mt-2 text-sm" style={{ color: colors.plumSoft }}>
              Vi återkommer inom 24 timmar via e-post till <strong>{email}</strong>.
            </p>
            <button
              onClick={closeAndReset}
              className="mt-5 w-full rounded-full py-3 text-sm font-semibold"
              style={{ backgroundColor: colors.coral, color: colors.white }}
            >
              Stäng
            </button>
          </div>
        ) : (
          <>
            <h2 style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>Kontakta support</h2>
            <p className="mt-1 text-sm" style={{ color: colors.plumSoft }}>
              Beskriv vad det gäller så återkommer vi så snart vi kan.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Din e-post (så vi kan svara)"
              maxLength={254}
              className="mt-4 w-full rounded-xl px-3 py-2 text-sm"
              style={fieldStyle}
            />
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ämne (valfritt)"
              maxLength={200}
              className="mt-2 w-full rounded-xl px-3 py-2 text-sm"
              style={fieldStyle}
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={3000}
              placeholder="Ditt meddelande..."
              className="mt-2 w-full rounded-xl px-3 py-2 text-sm"
              style={fieldStyle}
            />
            <input
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, width: 0 }}
            />
            {error && (
              <p className="mt-2 text-xs" style={{ color: colors.coralDeep }}>
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-3">
              <button
                onClick={closeAndReset}
                className="flex-1 rounded-full px-4 py-3 text-sm font-medium"
                style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }}
              >
                Avbryt
              </button>
              <button
                onClick={submit}
                disabled={!canSend}
                className="flex-1 rounded-full px-4 py-3 text-sm font-semibold"
                style={{ backgroundColor: colors.coral, color: colors.white, opacity: canSend ? 1 : 0.5 }}
              >
                {sending ? "Skickar..." : "Skicka"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vendor signup (Fas 2A)
// ---------------------------------------------------------------------------
function VendorTextField({ label, value, onChange, error, type = "text", placeholder }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const resolvedType = isPassword && showPassword ? "text" : type;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium" style={{ color: colors.plum }}>
        {label}
      </span>
      <div className="relative">
        <input
          type={resolvedType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl px-3 py-2 text-sm"
          style={{ border: `1.5px solid ${error ? colors.coral : colors.beige}`, color: colors.plum, paddingRight: isPassword ? 38 : undefined }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1"
            aria-label={showPassword ? "Dölj lösenord" : "Visa lösenord"}
          >
            {showPassword ? <EyeOff size={16} color={colors.plumSoft} /> : <Eye size={16} color={colors.plumSoft} />}
          </button>
        )}
      </div>
      {error && (
        <span className="text-xs" style={{ color: colors.coralDeep }}>
          {error}
        </span>
      )}
    </label>
  );
}

function VendorIntroView({ onStart }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-14 sm:px-10">
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
        style={{ backgroundColor: colors.lilacSoft, color: colors.lilacDeep }}
      >
        <MapPin size={12} /> Planifest finns just nu i Göteborg
      </span>
      <h1 className="mt-4" style={{ fontFamily: serif, fontSize: 32, color: colors.plum }}>
        Bli leverantör på Planifest
      </h1>
      <p className="mt-3 text-base leading-relaxed" style={{ color: colors.plumSoft }}>
        Nå kunder som redan bygger sin fest och letar efter DJ, lokal, catering, dekor och mer – samlat på
        ett ställe. Skapa ett leverantörskonto och ansök om att synas på Planifest.
      </p>
      <p className="mt-2 text-sm" style={{ color: colors.plumSoft }}>
        Vi öppnar snart upp för leverantörer och kunder i hela Sverige.
      </p>
      <button
        onClick={onStart}
        className="mt-6 flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold"
        style={{ backgroundColor: colors.coral, color: colors.white }}
      >
        Skapa leverantörskonto <ArrowRight size={16} />
      </button>
    </div>
  );
}

function GeographyPicker({ baseLocation, serviceAreaType, onBaseLocation, onServiceArea, onShowToast, errors = {} }) {
  const [locationQuery, setLocationQuery] = useState("");
  const filteredLocations = LOCATIONS.filter((l) => l.name.toLowerCase().includes(locationQuery.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-3 text-sm leading-relaxed" style={{ backgroundColor: colors.lilacSoft, color: colors.lilacDeep }}>
        Planifest finns just nu i Göteborg. Vi öppnar snart upp för leverantörer och kunder i hela Sverige.
      </div>

      <div>
        <p className="mb-2 text-sm font-medium" style={{ color: colors.plum }}>
          Var utgår du från?
        </p>
        <input
          type="text"
          value={locationQuery}
          onChange={(e) => setLocationQuery(e.target.value)}
          placeholder="Sök stad..."
          className="mb-2 w-full rounded-xl px-3 py-2 text-sm"
          style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum }}
        />
        <div className="space-y-2">
          {filteredLocations.map((loc) => {
            const selected = baseLocation === loc.id;
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => (loc.active ? onBaseLocation(loc.id) : onShowToast(`${loc.name} kommer snart`))}
                className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm"
                style={{
                  border: `1.5px solid ${selected ? colors.coral : colors.beige}`,
                  backgroundColor: selected ? colors.coralSoft : colors.white,
                  color: colors.plum,
                  opacity: loc.active ? 1 : 0.6,
                }}
              >
                <span className="flex items-center gap-2">
                  <MapPin size={14} /> {loc.name}
                </span>
                {loc.active ? (
                  selected && <Check size={16} color={colors.coralDeep} />
                ) : (
                  <span className="text-xs font-medium" style={{ color: colors.plumSoft }}>
                    Kommer snart
                  </span>
                )}
              </button>
            );
          })}
          {filteredLocations.length === 0 && (
            <p className="text-sm" style={{ color: colors.plumSoft }}>
              Ingen stad hittades.
            </p>
          )}
        </div>
        {errors.baseLocation && (
          <p className="mt-1 text-xs" style={{ color: colors.coralDeep }}>
            {errors.baseLocation}
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium" style={{ color: colors.plum }}>
          Vilka områden arbetar du i?
        </p>
        <div className="space-y-2">
          {SERVICE_AREA_OPTIONS.map((opt) => {
            const selected = serviceAreaType === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => onServiceArea(opt.type)}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm"
                style={{
                  border: `1.5px solid ${selected ? colors.coral : colors.beige}`,
                  backgroundColor: selected ? colors.coralSoft : colors.white,
                  color: colors.plum,
                }}
              >
                <span
                  className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ border: `1.5px solid ${selected ? colors.coral : colors.beige}` }}
                >
                  {selected && <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: colors.coral }} />}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
        {errors.serviceArea && (
          <p className="mt-1 text-xs" style={{ color: colors.coralDeep }}>
            {errors.serviceArea}
          </p>
        )}
      </div>
    </div>
  );
}

function VendorSignupView({ step, form, errors, onField, onToggleCategory, onNext, onBack, onSubmit, onShowToast, submitError, submitting, onOpenTerms, hasAccount, accountEmail }) {
  const stepTitles = { 1: hasAccount ? "Om ditt företag" : "Skapa konto", 2: "Geografi", 3: "Vad erbjuder du?" };

  return (
    <div className="mx-auto max-w-2xl px-6 pb-24 pt-10 sm:px-10">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {[1, 2, 3].map((n) => (
          <span key={n} className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
              style={{ backgroundColor: n <= step ? colors.coral : colors.lilacSoft, color: n <= step ? colors.white : colors.lilacDeep }}
            >
              {n}
            </span>
            {n < 3 && <span style={{ width: 24, height: 2, backgroundColor: colors.lilacSoft }} />}
          </span>
        ))}
        <span className="ml-1 text-sm font-medium" style={{ color: colors.plumSoft }}>
          Steg {step} av 3: {stepTitles[step]}
        </span>
      </div>

      <div className="rounded-3xl p-6 sm:p-8" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
        {step === 1 && (
          <div className="space-y-4">
            <h2 style={{ fontFamily: serif, fontSize: 22, color: colors.plum }}>{hasAccount ? "Om ditt företag" : "Skapa konto"}</h2>
            {hasAccount && (
              <p className="rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: colors.lilacSoft, color: colors.lilacDeep }}>
                Du ansöker med ditt konto <strong>{accountEmail}</strong>, så du behöver inte skapa något nytt.
              </p>
            )}
            <VendorTextField label="Företagsnamn" value={form.companyName} onChange={(v) => onField("companyName", v)} error={errors.companyName} />
            <VendorTextField
              label="Organisationsnummer"
              value={form.organizationNumber}
              onChange={(v) => onField("organizationNumber", v)}
              error={errors.organizationNumber}
              placeholder="XXXXXX-XXXX"
            />
            <VendorTextField label="Kontaktperson" value={form.contactPerson} onChange={(v) => onField("contactPerson", v)} error={errors.contactPerson} />
            {!hasAccount && <VendorTextField label="E-post" type="email" value={form.email} onChange={(v) => onField("email", v)} error={errors.email} />}
            <VendorTextField label="Telefonnummer" type="tel" value={form.phone} onChange={(v) => onField("phone", v)} error={errors.phone} />
            {!hasAccount && (
              <>
                <VendorTextField label="Lösenord" type="password" value={form.password} onChange={(v) => onField("password", v)} error={errors.password} />
                <VendorTextField
                  label="Bekräfta lösenord"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(v) => onField("confirmPassword", v)}
                  error={errors.confirmPassword}
                />
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 style={{ fontFamily: serif, fontSize: 22, color: colors.plum }}>Var jobbar du?</h2>
            <GeographyPicker
              baseLocation={form.baseLocation}
              serviceAreaType={form.serviceArea}
              onBaseLocation={(id) => onField("baseLocation", id)}
              onServiceArea={(type) => onField("serviceArea", type)}
              onShowToast={onShowToast}
              errors={errors}
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 style={{ fontFamily: serif, fontSize: 22, color: colors.plum }}>Vad erbjuder du?</h2>
            <p className="text-sm" style={{ color: colors.plumSoft }}>
              Välj de kategorier som stämmer in på er verksamhet. Ni kan lägga till fler senare.
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <CategoryChip key={c.id} active={form.categories.includes(c.id)} onClick={() => onToggleCategory(c.id)} icon={c.icon} label={c.label} />
              ))}
            </div>
            {errors.categories && (
              <p className="text-xs" style={{ color: colors.coralDeep }}>
                {errors.categories}
              </p>
            )}

            <label className="mt-2 flex items-start gap-3 text-sm" style={{ color: colors.plum, borderTop: `1px solid ${colors.beige}`, paddingTop: 16 }}>
              <input type="checkbox" checked={form.acceptedTerms} onChange={(e) => onField("acceptedTerms", e.target.checked)} className="mt-1" />
              <span>
                Jag har läst och godkänner{" "}
                <button type="button" onClick={onOpenTerms} className="font-semibold underline" style={{ color: colors.lilacDeep }}>
                  Planifests villkor för leverantörer
                </button>
                , inklusive reglerna om avbokning och att inte kringgå plattformen.
              </span>
            </label>
            {errors.acceptedTerms && (
              <p className="text-xs" style={{ color: colors.coralDeep }}>
                {errors.acceptedTerms}
              </p>
            )}
          </div>
        )}

        {step === 3 && submitError && (
          <p className="mt-3 text-xs" style={{ color: colors.coralDeep }}>
            {submitError}
          </p>
        )}

        <div className="mt-8 flex gap-3">
          {step > 1 && (
            <button
              onClick={onBack}
              className="flex-1 rounded-full px-4 py-3 text-sm font-medium"
              style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }}
            >
              Tillbaka
            </button>
          )}
          {step < 3 ? (
            <button onClick={onNext} className="flex-1 rounded-full px-4 py-3 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
              Nästa
            </button>
          ) : (
            <button
              onClick={onSubmit}
              disabled={submitting}
              className="flex-1 rounded-full px-4 py-3 text-sm font-semibold"
              style={{ backgroundColor: colors.coral, color: colors.white, opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? "Skickar..." : "Skicka ansökan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MyAccountView({ profile, email, onSaveProfile, onChangePassword, onBack, isVendor, customerMode, onSwitchMode }) {
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  const fieldStyle = { border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white };

  const saveProfile = async () => {
    setProfileError("");
    setProfileSaving(true);
    const err = await onSaveProfile({ fullName: fullName.trim(), phone: phone.trim() });
    setProfileSaving(false);
    if (err) setProfileError(err.message || "Kunde inte spara.");
  };

  const savePassword = async () => {
    setPasswordError("");
    setPasswordSaved(false);
    if (newPassword.length < 6) {
      setPasswordError("Lösenordet måste vara minst 6 tecken.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Lösenorden matchar inte.");
      return;
    }
    setPasswordSaving(true);
    const err = await onChangePassword(newPassword);
    setPasswordSaving(false);
    if (err) {
      setPasswordError(err.message || "Kunde inte spara.");
      return;
    }
    setPasswordSaved(true);
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="mx-auto max-w-xl px-6 pb-24 pt-10 sm:px-10">
      <button onClick={onBack} className="-ml-2 mb-5 flex items-center gap-1 px-2 py-1.5 text-sm font-medium" style={{ color: colors.plumSoft }}>
        <ChevronLeft size={16} /> Tillbaka
      </button>
      <h1 style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>Mitt konto</h1>

      <div className="mt-6 rounded-2xl p-5" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
        <h2 className="mb-3 font-semibold" style={{ color: colors.plum }}>
          Kontaktuppgifter
        </h2>
        <div className="space-y-3">
          <VendorTextField label="Namn" value={fullName} onChange={setFullName} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium" style={{ color: colors.plum }}>
              E-post
            </span>
            <input disabled value={email} className="rounded-xl px-3 py-2 text-sm opacity-60" style={fieldStyle} />
          </label>
          <VendorTextField label="Mobilnummer" value={phone} onChange={setPhone} placeholder="07X-XXX XX XX" />
        </div>
        {profileError && (
          <p className="mt-2 text-xs" style={{ color: colors.coralDeep }}>
            {profileError}
          </p>
        )}
        <button
          onClick={saveProfile}
          disabled={profileSaving}
          className="mt-4 rounded-full px-5 py-2.5 text-sm font-semibold"
          style={{ backgroundColor: colors.coral, color: colors.white, opacity: profileSaving ? 0.6 : 1 }}
        >
          {profileSaving ? "Sparar..." : "Spara"}
        </button>
      </div>

      <div className="mt-5 rounded-2xl p-5" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
        <h2 className="mb-3 font-semibold" style={{ color: colors.plum }}>
          Byt lösenord
        </h2>
        <div className="space-y-3">
          <VendorTextField label="Nytt lösenord" type="password" value={newPassword} onChange={setNewPassword} />
          <VendorTextField label="Bekräfta nytt lösenord" type="password" value={confirmPassword} onChange={setConfirmPassword} />
        </div>
        {passwordError && (
          <p className="mt-2 text-xs" style={{ color: colors.coralDeep }}>
            {passwordError}
          </p>
        )}
        {passwordSaved && (
          <p className="mt-2 text-xs" style={{ color: colors.green }}>
            Lösenordet är uppdaterat ✓
          </p>
        )}
        <button
          onClick={savePassword}
          disabled={passwordSaving}
          className="mt-4 rounded-full px-5 py-2.5 text-sm font-semibold"
          style={{ border: `1.5px solid ${colors.coral}`, color: colors.coral, backgroundColor: "transparent", opacity: passwordSaving ? 0.6 : 1 }}
        >
          {passwordSaving ? "Sparar..." : "Byt lösenord"}
        </button>
      </div>

      {isVendor && (
        <div className="mt-6 rounded-3xl p-6" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
          <h2 style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>Läge</h2>
          {customerMode ? (
            <>
              <p className="mt-1 text-sm" style={{ color: colors.plumSoft }}>
                Du använder just nu Planifest som kund, till exempel för att planera en egen fest. Din leverantörsprofil finns kvar och fungerar som vanligt.
              </p>
              <button onClick={() => onSwitchMode(false)} className="mt-4 rounded-full px-5 py-2.5 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
                Tillbaka till leverantörsportalen
              </button>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm" style={{ color: colors.plumSoft }}>
                Du använder Planifest som leverantör. Vill du också planera en egen fest kan du byta till kundläge. Du kommer tillbaka till portalen via "Min portal" i menyn.
              </p>
              <button onClick={() => onSwitchMode(true)} className="mt-4 rounded-full px-5 py-2.5 text-sm font-semibold" style={{ border: `1.5px solid ${colors.coral}`, color: colors.coral, backgroundColor: colors.white }}>
                Byt till kundläge
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// A slim footer for vendors: the legal pages and a way to reach us, nothing aimed at customers.
function VendorFooter({ onOpenTerms, onOpenPrivacy, onOpenCookies, onSupport }) {
  return (
    <footer className="mt-16 border-t px-6 pb-8 pt-6 text-center text-xs" style={{ borderColor: colors.beige, color: colors.plumSoft }}>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <button onClick={onOpenTerms} className="underline">
          Villkor
        </button>
        <button onClick={onOpenPrivacy} className="underline">
          Integritetspolicy
        </button>
        <button onClick={onOpenCookies} className="underline">
          Cookiepolicy
        </button>
        <button onClick={onSupport} className="underline">
          Support
        </button>
        <a href="mailto:info@planifest.se" className="underline">
          Kontakt
        </a>
      </div>
      <p className="mt-2">Planifest, enskild firma · info@planifest.se</p>
    </footer>
  );
}

function ResetPasswordView({ onSubmit, onShowToast }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    if (password.length < 6) {
      setError("Lösenordet måste vara minst 6 tecken.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Lösenorden matchar inte.");
      return;
    }
    setLoading(true);
    const err = await onSubmit(password);
    setLoading(false);
    if (err) setError(err.message || "Något gick fel, försök igen.");
  };

  return (
    <div className="mx-auto max-w-md px-6 pb-24 pt-14 sm:px-10">
      <h1 style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>Välj nytt lösenord</h1>
      <p className="mt-2 text-sm" style={{ color: colors.plumSoft }}>
        Skriv in ditt nya lösenord nedan.
      </p>
      <div className="mt-5 space-y-3">
        <VendorTextField label="Nytt lösenord" type="password" value={password} onChange={setPassword} />
        <VendorTextField label="Bekräfta nytt lösenord" type="password" value={confirmPassword} onChange={setConfirmPassword} />
      </div>
      {error && (
        <p className="mt-2 text-xs" style={{ color: colors.coralDeep }}>
          {error}
        </p>
      )}
      <button
        onClick={submit}
        disabled={loading}
        className="mt-5 w-full rounded-full py-3 text-sm font-semibold"
        style={{ backgroundColor: colors.coral, color: colors.white, opacity: loading ? 0.6 : 1 }}
      >
        {loading ? "Ett ögonblick..." : "Spara nytt lösenord"}
      </button>
    </div>
  );
}

function VendorAwaitingConfirmationView({ email, onHome }) {
  return (
    <div className="mx-auto max-w-xl px-6 pb-24 pt-14 text-center sm:px-10">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: colors.coralSoft }}>
        <Check size={28} color={colors.coral} />
      </div>
      <h1 style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>Kolla din mejl!</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
        Vi har skickat en bekräftelselänk till <strong>{email}</strong>. Klicka på den, på vilken enhet du vill — då skickas din leverantörsansökan in automatiskt. Logga sedan in för att följa den.
      </p>
      <button onClick={onHome} className="mt-6 w-full rounded-full py-3 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
        Till startsidan
      </button>
    </div>
  );
}

function VendorPendingView({ vendor, onHome, onGoDashboard }) {
  if (!vendor) return null;
  const categoryLabels = vendor.categories.map((id) => catMap[id]?.label).filter(Boolean).join(", ");
  const locationName = locationMap[vendor.baseLocation]?.name || vendor.baseLocation;
  return (
    <div className="mx-auto max-w-xl px-6 pb-24 pt-14 text-center sm:px-10">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: colors.coralSoft }}>
        <PartyPopper size={28} color={colors.coral} />
      </div>
      <h1 style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>Din ansökan är inskickad! 🎉</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
        Vi har tagit emot din ansökan till Planifest. Vi granskar dina uppgifter innan din leverantörsprofil
        publiceras.
      </p>
      <span
        className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
        style={{ backgroundColor: colors.lilacSoft, color: colors.lilacDeep }}
      >
        <Clock size={14} /> Status: Väntar på granskning
      </span>

      <div className="mt-6 rounded-3xl p-6 text-left" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
        <p className="text-sm font-semibold" style={{ color: colors.plum }}>
          {vendor.companyName}
        </p>
        <p className="mt-1 flex items-center gap-1 text-sm" style={{ color: colors.plumSoft }}>
          <MapPin size={13} /> {locationName} · {vendor.serviceArea?.value}
        </p>
        <p className="mt-1 text-sm" style={{ color: colors.plumSoft }}>
          {categoryLabels}
        </p>
      </div>

      <div className="mt-6 rounded-3xl p-6 text-left" style={{ backgroundColor: colors.peachSoft }}>
        <p style={{ fontFamily: serif, fontSize: 18, color: colors.plum }}>Fyll i din leverantörsprofil</p>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
          Medan vi granskar ansökan kan du redan nu lägga till bilder, beskrivning, tjänster och priser.
          Din profil publiceras när din ansökan har godkänts.
        </p>
      </div>

      <button onClick={onGoDashboard} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
        Fortsätt till min profil <ArrowRight size={16} />
      </button>
      <button onClick={onHome} className="mt-3 w-full py-2 text-sm font-medium underline" style={{ color: colors.plumSoft }}>
        Till startsidan
      </button>
    </div>
  );
}

function getVendorCompleteness(vendor) {
  const profile = vendor?.profile || {};
  const checks = [
    { key: "tagline", label: "Tagline", done: !!profile.tagline?.trim() },
    { key: "description", label: "Beskrivning", done: !!profile.description?.trim() },
    { key: "images", label: "Minst en bild", done: (profile.images || []).length > 0 },
    { key: "services", label: "Minst en tjänst/pris eller ett förfrågningsformulär", done: (profile.services || []).length > 0 || Object.values(sanitizeRequestForms(vendor?.requestForms)).some((c) => c.fields.length > 0) },
    { key: "categories", label: "Minst en kategori", done: (vendor?.categories || []).length > 0 },
    { key: "geo", label: "Geografi", done: !!vendor?.baseLocation && !!vendor?.serviceArea },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  const percent = Math.round((doneCount / checks.length) * 100);
  const missing = checks.filter((c) => !c.done).map((c) => c.label);
  return { percent, missing, checks };
}

// Finds every booking item that belongs to this vendor (matches one of the
// listing ids mapVendorToProviders would generate for them), skipping
// cancelled bookings. Each item is enriched with its parent booking's
// date/time/customer info so the vendor sees a full request in one place.
function getVendorBookingItems(vendor, bookings) {
  if (!vendor) return [];
  const myListingIds = vendor.categories.map((catId) => `${vendor.id}-${catId}`);
  return bookings
    .filter((b) => !b.cancelled)
    .flatMap((b) =>
      b.items
        .filter((item) => myListingIds.includes(item.providerId))
        .map((item) => ({
          ...item,
          bookingNumber: b.bookingNumber,
          bookingId: b.bookingId,
          isGuest: !!b.isGuest,
          date: b.date,
          startTime: b.startTime,
          endTime: b.endTime,
          guests: b.guests,
          occasion: b.occasion,
        }))
    );
}

const STATUS_META = {
  pending: { emoji: "🟡", label: "Väntar på granskning", bg: colors.lilacSoft, fg: colors.lilacDeep },
  approved: { emoji: "🟢", label: "Godkänd", bg: "#E3F3E9", fg: colors.green },
  rejected: { emoji: "🔴", label: "Avslagen", bg: "#FBE4E1", fg: colors.coralDeep },
};

// Status of a single vendor item inside a customer booking (separate from
// STATUS_META above, which describes a vendor's admin-approval status).
const BOOKING_STATUS_META = {
  pending: { label: "Väntar på svar", bg: colors.lilacSoft, fg: colors.lilacDeep },
  confirmed: { label: "Bekräftad", bg: "#E3F3E9", fg: colors.green },
  declined: { label: "Nekad", bg: "#FBE4E1", fg: colors.coralDeep },
  completed: { label: "Genomförd", bg: "#E3F3E9", fg: colors.green },
  cancelled: { label: "Avbokad", bg: colors.beige, fg: colors.plumSoft },
};

const SEED_BOOKINGS = [
  {
    bookingNumber: "EVT-7734",
    date: "2026-11-14",
    startTime: "18:00",
    endTime: "00:00",
    guests: 50,
    occasion: "birthday",
    cancelled: false,
    completed: false,
    items: [
      { id: "dj-marcus", providerId: "dj-marcus", name: "DJ Marcus", category: "dj", price: 4500, status: "confirmed", reviewed: false },
      { id: "smakverket", providerId: "smakverket", name: "Smakverket Catering", category: "catering", price: 9750, status: "pending", reviewed: false },
    ],
  },
  {
    bookingNumber: "EVT-6021",
    date: "2026-06-20",
    startTime: "16:00",
    endTime: "22:00",
    guests: 30,
    occasion: "party",
    cancelled: false,
    completed: true,
    items: [
      { id: "dekor-anna", providerId: "dekor-anna", name: "Dekor by Anna", category: "dekor", price: 2500, status: "completed", reviewed: false },
      { id: "tartverkstan", providerId: "tartverkstan", name: "Tårtverkstan", category: "tarta", price: 950, status: "completed", reviewed: true },
    ],
  },
  {
    bookingNumber: "EVT-5310",
    date: "2026-03-08",
    startTime: "19:00",
    endTime: "23:00",
    guests: 40,
    occasion: "corporate",
    cancelled: true,
    completed: false,
    items: [{ id: "lokal-bella", providerId: "lokal-bella", name: "Lokal Bella", category: "lokal", price: 8000, status: "cancelled", reviewed: false }],
  },
];

function VendorDashboardView({ vendor, bookingItems, conversationCount, onEditProfile, onPreview, onBookings, onInbox, onRespond }) {
  if (!vendor) return null;
  const { percent, missing } = getVendorCompleteness(vendor);
  const locationName = locationMap[vendor.baseLocation]?.name || vendor.baseLocation;
  const categoryLabels = vendor.categories.map((id) => catMap[id]?.label).filter(Boolean).join(", ") || "Inga valda ännu";
  const status = STATUS_META[vendor.status] || STATUS_META.pending;
  const pendingCount = bookingItems.filter((i) => i.status === "pending").length;
  const pendingItems = bookingItems.filter((i) => i.status === "pending");
  const upcomingAll = bookingItems
    .filter((i) => i.status === "confirmed" && i.date >= todayStr())
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  const hhmm = (t) => String(t || "").slice(0, 5);
  const banner = {
    pending: {
      bg: colors.lilacSoft,
      fg: colors.lilacDeep,
      title: "Din ansökan granskas",
      text: "Vi går igenom din ansökan och mejlar dig så fort den är klar. Du kan fylla i din profil under tiden.",
    },
    approved: { bg: "#E3F3E9", fg: colors.green, title: "Du är godkänd!", text: "Din profil är publicerad och syns för kunder på Planifest." },
    rejected: {
      bg: "#FBE4E1",
      fg: colors.coralDeep,
      title: "Din ansökan godkändes inte den här gången",
      text: "Du är välkommen att höra av dig om du vill veta mer eller komplettera dina uppgifter.",
    },
  }[vendor.status];

  const cards = [
    { title: "Profil", desc: "Tagline, beskrivning och kontaktuppgifter", icon: Sparkles, action: onEditProfile },
    { title: "Tjänster & priser", desc: "Vad ni erbjuder och vad det kostar", icon: Check, action: onEditProfile },
    { title: "Bilder", desc: "Visa upp er verksamhet", icon: Camera, action: onEditProfile },
    {
      title: "Bokningar & kalender",
      desc: pendingCount > 0 ? `${pendingCount} ny${pendingCount > 1 ? "a" : ""} förfrågan att svara på` : "Se förfrågningar och din kalender",
      icon: Calendar,
      action: onBookings,
    },
    { title: "Meddelanden", desc: "Frågor och offerter till kunder", icon: MessageCircle, action: onInbox },
    { title: "Förhandsvisning", desc: "Se hur kunder kommer se er profil", icon: Star, action: onPreview },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-10 sm:px-10">
      <h1 style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>Hej, {vendor.contactPerson || vendor.companyName}! 👋</h1>

      {banner && (
        <div className="mt-5 rounded-3xl p-5" style={{ backgroundColor: banner.bg }}>
          <p className="font-semibold" style={{ color: banner.fg }}>
            {banner.title}
          </p>
          <p className="mt-1 text-sm" style={{ color: colors.plum }}>
            {banner.text}
          </p>
          {vendor.status === "rejected" && (
            <a
              href="mailto:info@planifest.se"
              className="mt-3 inline-block rounded-full px-4 py-2 text-sm font-semibold"
              style={{ backgroundColor: colors.coral, color: colors.white }}
            >
              Kontakta oss
            </a>
          )}
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          { label: "Nya förfrågningar", value: pendingItems.length, action: onBookings },
          { label: "Kommande bokningar", value: upcomingAll.length, action: onBookings },
          { label: "Konversationer", value: conversationCount, action: onInbox },
        ].map((t) => (
          <button key={t.label} onClick={t.action} className="rounded-2xl p-4 text-center" style={{ backgroundColor: colors.lilacSoft }}>
            <p style={{ fontFamily: serif, fontSize: 22, color: colors.plum }}>{t.value}</p>
            <p className="text-xs" style={{ color: colors.lilacDeep }}>
              {t.label}
            </p>
          </button>
        ))}
      </div>

      {pendingItems.length > 0 && (
        <section className="mt-5 rounded-3xl p-5" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
          <h2 className="mb-3 font-semibold" style={{ color: colors.plum }}>
            Nya förfrågningar
          </h2>
          <div className="space-y-3">
            {pendingItems.slice(0, 3).map((i) => (
              <div key={`${i.bookingNumber}-${i.id}`} className="rounded-2xl p-4" style={{ backgroundColor: colors.cream }}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold" style={{ color: colors.plum }}>
                      {i.name}
                    </p>
                    <p className="mt-0.5 text-sm" style={{ color: colors.plumSoft }}>
                      {i.date}, {hhmm(i.startTime)}–{hhmm(i.endTime)} · {i.guests} gäster
                    </p>
                  </div>
                  <span style={{ fontFamily: serif, fontSize: 17, color: colors.plum }}>{formatKr(i.price)}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => onRespond(i.bookingNumber, i.id, "declined")}
                    className="flex-1 rounded-full px-4 py-2 text-sm font-medium"
                    style={{ border: `1.5px solid ${colors.coral}`, color: colors.coralDeep, backgroundColor: colors.white }}
                  >
                    Neka
                  </button>
                  <button
                    onClick={() => onRespond(i.bookingNumber, i.id, "confirmed")}
                    className="flex-1 rounded-full px-4 py-2 text-sm font-semibold"
                    style={{ backgroundColor: colors.green, color: colors.white }}
                  >
                    Acceptera
                  </button>
                </div>
              </div>
            ))}
          </div>
          {pendingItems.length > 3 && (
            <button onClick={onBookings} className="mt-3 text-sm font-medium underline" style={{ color: colors.lilacDeep }}>
              Visa alla {pendingItems.length} förfrågningar
            </button>
          )}
        </section>
      )}

      {upcomingAll.length > 0 && (
        <section className="mt-5 rounded-3xl p-5" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
          <h2 className="mb-3 font-semibold" style={{ color: colors.plum }}>
            Kommande bokningar
          </h2>
          <div className="space-y-2">
            {upcomingAll.slice(0, 3).map((i) => (
              <div key={`${i.bookingNumber}-${i.id}`} className="flex items-center justify-between rounded-xl p-3 text-sm" style={{ backgroundColor: "#E3F3E9" }}>
                <span className="flex items-center gap-2" style={{ color: colors.plum }}>
                  <Check size={14} color={colors.green} /> {i.date}, {hhmm(i.startTime)}–{hhmm(i.endTime)} · {i.name}
                </span>
                <span style={{ color: colors.plumSoft }}>{formatKr(i.price)}</span>
              </div>
            ))}
          </div>
          <button onClick={onBookings} className="mt-3 text-sm font-medium underline" style={{ color: colors.lilacDeep }}>
            Öppna kalendern
          </button>
        </section>
      )}

      <div className="mt-5 rounded-3xl p-6" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
        <p style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>{vendor.companyName}</p>
        <span
          className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ backgroundColor: status.bg, color: status.fg }}
        >
          {status.emoji} Status: {status.label}
        </span>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2" style={{ color: colors.plumSoft }}>
          <span className="flex items-center gap-1">
            <MapPin size={13} /> {locationName}
          </span>
          <span>{vendor.serviceArea?.value || "Arbetsområde ej valt"}</span>
          <span className="sm:col-span-2">{categoryLabels}</span>
        </div>
      </div>

      <div className="mt-5 rounded-3xl p-6" style={{ backgroundColor: colors.lilacSoft }}>
        <p className="font-semibold" style={{ color: colors.plum }}>
          Profil {percent} % klar
        </p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: colors.white }}>
          <div className="h-2 rounded-full" style={{ width: `${percent}%`, backgroundColor: colors.coral }} />
        </div>
        {missing.length > 0 && (
          <p className="mt-2 text-sm" style={{ color: colors.lilacDeep }}>
            Saknas: {missing.join(", ")}
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.title}
              onClick={card.action}
              className="flex items-start gap-3 rounded-2xl p-4 text-left"
              style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: colors.lilacSoft }}>
                <Icon size={16} color={colors.lilacDeep} />
              </div>
              <div>
                <p className="font-semibold" style={{ color: colors.plum }}>
                  {card.title}
                </p>
                <p className="text-sm" style={{ color: colors.plumSoft }}>
                  {card.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button onClick={onEditProfile} className="flex-1 rounded-full px-5 py-3 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
          Redigera profil
        </button>
        <button
          onClick={onPreview}
          className="flex-1 rounded-full px-5 py-3 text-sm font-semibold"
          style={{ border: `1.5px solid ${colors.lilac}`, color: colors.lilacDeep, backgroundColor: colors.white }}
        >
          Förhandsvisa profil
        </button>
      </div>
    </div>
  );
}

function VendorProfileEditorView({
  vendor,
  onField,
  onBaseLocation,
  onServiceArea,
  onToggleCategory,
  onProfileField,
  onAddImage,
  onRemoveImage,
  onAddService,
  onUpdateService,
  onRemoveService,
  onAddAddon,
  onUpdateAddon,
  onRemoveAddon,
  onPreview,
  onDashboard,
  onShowToast,
  onRequestForm,
}) {
  const [imageUrl, setImageUrl] = useState("");
  if (!vendor) return null;
  const { percent } = getVendorCompleteness(vendor);

  const addImage = () => {
    if (!imageUrl.trim()) return;
    onAddImage(imageUrl.trim());
    setImageUrl("");
  };
  const addSampleImage = () => onAddImage(`https://picsum.photos/seed/vendor-${Date.now()}/600/420`);

  const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB — generous but avoids choking the browser tab on huge phone photos
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        onShowToast(`${file.name} är för stor (max 8 MB)`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => onAddImage(reader.result);
      reader.readAsDataURL(file);
    });
    e.target.value = ""; // allow re-selecting the same file later
  };

  const fieldInputStyle = { border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white };

  return (
    <div className="mx-auto max-w-3xl px-6 pb-32 pt-8 sm:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>Redigera profil</h1>
        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: colors.lilacSoft, color: colors.lilacDeep }}>
          Profil {percent} % klar
        </span>
      </div>

      <section className="mb-6 rounded-3xl p-6" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
        <h2 className="mb-4" style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>
          Grunduppgifter
        </h2>
        <div className="space-y-4">
          <VendorTextField label="Företagsnamn" value={vendor.companyName} onChange={(v) => onField("companyName", v)} />
          <div>
            <VendorTextField
              label="Tagline"
              value={vendor.profile.tagline}
              onChange={(v) => onProfileField("tagline", v)}
              placeholder="En kort mening som beskriver er"
            />
            {!vendor.profile.tagline?.trim() && (
              <p className="mt-1 text-xs" style={{ color: colors.plumSoft }}>
                Rekommenderas – visas högst upp på er profil.
              </p>
            )}
          </div>
          <div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium" style={{ color: colors.plum }}>
                Om företaget
              </span>
              <textarea
                value={vendor.profile.description}
                onChange={(e) => onProfileField("description", e.target.value)}
                rows={4}
                className="rounded-xl px-3 py-2 text-sm"
                style={fieldInputStyle}
              />
            </label>
            {!vendor.profile.description?.trim() && (
              <p className="mt-1 text-xs" style={{ color: colors.plumSoft }}>
                Rekommenderas – berätta vad som gör er unika.
              </p>
            )}
          </div>
          <VendorTextField label="Kontaktperson" value={vendor.contactPerson} onChange={(v) => onField("contactPerson", v)} />
          <VendorTextField label="E-post" type="email" value={vendor.email} onChange={(v) => onField("email", v)} />
          <VendorTextField label="Telefon" type="tel" value={vendor.phone} onChange={(v) => onField("phone", v)} />
        </div>
      </section>

      <section className="mb-6 rounded-3xl p-6" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
        <h2 className="mb-4" style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>
          Geografi
        </h2>
        <GeographyPicker
          baseLocation={vendor.baseLocation}
          serviceAreaType={vendor.serviceArea?.type}
          onBaseLocation={onBaseLocation}
          onServiceArea={onServiceArea}
          onShowToast={onShowToast}
        />
      </section>

      <section className="mb-6 rounded-3xl p-6" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
        <h2 className="mb-4" style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>
          Kategorier
        </h2>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <CategoryChip key={c.id} active={vendor.categories.includes(c.id)} onClick={() => onToggleCategory(c.id)} icon={c.icon} label={c.label} />
          ))}
        </div>
        {vendor.categories.length === 0 && (
          <p className="mt-2 text-xs" style={{ color: colors.coralDeep }}>
            Välj minst en kategori.
          </p>
        )}
      </section>

      <section className="mb-6 rounded-3xl p-6" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
        <h2 className="mb-1" style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>
          Bilder
        </h2>
        <p className="mb-4 text-sm" style={{ color: colors.plumSoft }}>
          Första bilden används som huvudbild.
        </p>
        {vendor.profile.images.length === 0 && (
          <p className="mb-3 text-xs" style={{ color: colors.coralDeep }}>
            Lägg till minst en bild.
          </p>
        )}
        {vendor.profile.images.length > 0 && (
          <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {vendor.profile.images.map((url, i) => (
              <div key={i} className="relative overflow-hidden rounded-xl" style={{ aspectRatio: "1 / 1" }}>
                <img src={url} alt="" className="h-full w-full object-cover" />
                {i === 0 && (
                  <span
                    className="absolute left-1 top-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ backgroundColor: colors.white, color: colors.lilacDeep }}
                  >
                    Huvudbild
                  </span>
                )}
                <button
                  onClick={() => onRemoveImage(i)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(60,47,69,0.7)" }}
                >
                  <X size={11} color={colors.white} />
                </button>
              </div>
            ))}
          </div>
        )}
        <label
          className="flex cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
          style={{ backgroundColor: colors.coral, color: colors.white }}
        >
          <Camera size={16} />
          Ladda upp bilder från mobil eller dator
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
        </label>

        <p className="mb-1 mt-4 text-xs font-medium" style={{ color: colors.plum }}>
          Eller klistra in en bild-URL
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 rounded-xl px-3 py-2 text-sm"
            style={fieldInputStyle}
          />
          <button
            onClick={addImage}
            className="rounded-full px-4 py-2 text-sm font-semibold"
            style={{ border: `1.5px solid ${colors.lilac}`, color: colors.lilacDeep, backgroundColor: colors.white }}
          >
            Lägg till
          </button>
        </div>
        <button onClick={addSampleImage} className="mt-2 text-xs font-medium underline" style={{ color: colors.lilacDeep }}>
          + Lägg till exempelbild
        </button>
      </section>

      {vendor.categories.map((cat) => (
        <RequestFormEditor
          key={cat}
          categoryId={cat}
          form={vendor.requestForms?.[cat]}
          hasPrice={vendor.profile.services.some((sv) => (!sv.category || sv.category === cat) && Number(sv.price) > 0)}
          onChange={(cfg) => onRequestForm(cat, cfg)}
        />
      ))}

      <section className="mb-6 rounded-3xl p-6" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
        <h2 className="mb-1" style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>
          Tjänster & priser
        </h2>
        <p className="mb-4 text-sm" style={{ color: colors.plumSoft }}>
          Lägg till en post för varje tjänst eller paket ni erbjuder, och märk den med vilken kategori den hör till.
        </p>
        {vendor.profile.services.length === 0 && (
          <p className="mb-3 text-xs" style={{ color: colors.coralDeep }}>
            Lägg till minst en tjänst.
          </p>
        )}
        <div className="space-y-4">
          {vendor.profile.services.map((s) => (
            <div key={s.id} className="rounded-2xl p-4" style={{ backgroundColor: colors.cream }}>
              <div className="flex items-start justify-between gap-2">
                <input
                  value={s.name}
                  onChange={(e) => onUpdateService(s.id, "name", e.target.value)}
                  placeholder="T.ex. DJ-paket 4 timmar"
                  className="flex-1 rounded-lg px-3 py-2 text-sm font-medium"
                  style={fieldInputStyle}
                />
                <button onClick={() => onRemoveService(s.id)} className="flex-shrink-0 rounded-full p-2" style={{ backgroundColor: colors.white }}>
                  <Trash2 size={14} color={colors.coralDeep} />
                </button>
              </div>
              <textarea
                value={s.description}
                onChange={(e) => onUpdateService(s.id, "description", e.target.value)}
                placeholder="Kort beskrivning"
                rows={2}
                className="mt-2 w-full rounded-lg px-3 py-2 text-sm"
                style={fieldInputStyle}
              />
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <select
                  value={s.category || ""}
                  onChange={(e) => onUpdateService(s.id, "category", e.target.value)}
                  className="col-span-2 rounded-lg px-2 py-2 text-sm sm:col-span-1"
                  style={fieldInputStyle}
                  disabled={vendor.categories.length === 0}
                >
                  <option value="">{vendor.categories.length === 0 ? "Välj kategori ovan först" : "Välj kategori"}</option>
                  {vendor.categories.map((catId) => (
                    <option key={catId} value={catId}>
                      {catMap[catId]?.label}
                    </option>
                  ))}
                </select>
                <select
                  value={s.priceType}
                  onChange={(e) => onUpdateService(s.id, "priceType", e.target.value)}
                  className="rounded-lg px-2 py-2 text-sm"
                  style={fieldInputStyle}
                >
                  <option value="fixed">Fast pris</option>
                  <option value="per_person">Per person</option>
                  <option value="per_hour">Per timme</option>
                </select>
                <input
                  type="number"
                  value={s.price}
                  onChange={(e) => onUpdateService(s.id, "price", e.target.value)}
                  placeholder="Pris (kr)"
                  className="rounded-lg px-3 py-2 text-sm"
                  style={fieldInputStyle}
                />
                <input
                  value={s.priceNote}
                  onChange={(e) => onUpdateService(s.id, "priceNote", e.target.value)}
                  placeholder="Prisnotering (valfritt)"
                  className="rounded-lg px-3 py-2 text-sm"
                  style={fieldInputStyle}
                />
              </div>
              {!s.category && vendor.categories.length > 0 && (
                <p className="mt-2 text-xs" style={{ color: colors.coralDeep }}>
                  Välj vilken kategori denna tjänst hör till, annars kan den hamna fel bland era listningar.
                </p>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={onAddService}
          className="mt-4 flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold"
          style={{ backgroundColor: colors.coralSoft, color: colors.coralDeep }}
        >
          <Plus size={14} /> Lägg till tjänst
        </button>
      </section>

      <section className="mb-6 rounded-3xl p-6" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
        <h2 className="mb-4" style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>
          Tillägg
        </h2>
        <div className="space-y-3">
          {vendor.profile.addons.map((a) => (
            <div key={a.id} className="flex items-center gap-2">
              <input
                value={a.name}
                onChange={(e) => onUpdateAddon(a.id, "name", e.target.value)}
                placeholder="T.ex. Rökmaskin"
                className="flex-1 rounded-lg px-3 py-2 text-sm"
                style={fieldInputStyle}
              />
              <input
                type="number"
                value={a.price}
                onChange={(e) => onUpdateAddon(a.id, "price", e.target.value)}
                placeholder="Pris (kr)"
                className="w-28 rounded-lg px-3 py-2 text-sm"
                style={fieldInputStyle}
              />
              <button onClick={() => onRemoveAddon(a.id)} className="flex-shrink-0 rounded-full p-2" style={{ backgroundColor: colors.cream }}>
                <Trash2 size={14} color={colors.coralDeep} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={onAddAddon}
          className="mt-4 flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold"
          style={{ backgroundColor: colors.coralSoft, color: colors.coralDeep }}
        >
          <Plus size={14} /> Lägg till tillägg
        </button>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={onPreview}
          className="flex-1 rounded-full px-5 py-3 text-sm font-semibold"
          style={{ border: `1.5px solid ${colors.lilac}`, color: colors.lilacDeep, backgroundColor: colors.white }}
        >
          Förhandsvisa profil
        </button>
        <button onClick={onDashboard} className="flex-1 rounded-full px-5 py-3 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
          Klart, till min profil
        </button>
      </div>
    </div>
  );
}

function VendorProfilePreviewView({ vendor, onBack }) {
  if (!vendor) return null;
  const categoryLabels = vendor.categories.map((id) => catMap[id]?.label).filter(Boolean);
  const mainCategory = categoryLabels[0] || "Leverantör";
  const locationName = locationMap[vendor.baseLocation]?.name || vendor.baseLocation;
  const images = vendor.profile.images.length > 0 ? vendor.profile.images : [`https://picsum.photos/seed/${vendor.id}/700/500`];

  return (
    <div className="mx-auto max-w-3xl px-6 pb-40 pt-8 sm:px-10">
      <button onClick={onBack} className="-ml-2 mb-5 flex items-center gap-1 px-2 py-1.5 text-sm font-medium" style={{ color: colors.plumSoft }}>
        <ChevronLeft size={16} /> Tillbaka till redigering
      </button>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: colors.lilacSoft, color: colors.lilacDeep }}>
          Förhandsvisning
        </span>
        <span
          className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
          style={{ backgroundColor: (STATUS_META[vendor.status] || STATUS_META.pending).bg, color: (STATUS_META[vendor.status] || STATUS_META.pending).fg }}
        >
          {(STATUS_META[vendor.status] || STATUS_META.pending).emoji} {(STATUS_META[vendor.status] || STATUS_META.pending).label}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <img src={images[0]} className="col-span-2 rounded-3xl object-cover" style={{ height: 280 }} alt={vendor.companyName} />
        {images[1] && <img src={images[1]} className="hidden rounded-3xl object-cover sm:block" style={{ height: 280 }} alt={vendor.companyName} />}
      </div>

      {images.length > 2 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {images.slice(2).map((url, i) => (
            <img key={i} src={url} className="h-16 w-16 flex-shrink-0 rounded-xl object-cover" alt="" />
          ))}
        </div>
      )}

      <div className="mt-5">
        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: colors.lilacSoft, color: colors.lilacDeep }}>
          {mainCategory}
        </span>
        <h1 className="mt-2" style={{ fontFamily: serif, fontSize: 30, color: colors.plum }}>
          {vendor.companyName}
        </h1>
        {vendor.profile.tagline && (
          <p className="mt-1 text-sm italic" style={{ color: colors.plumSoft }}>
            “{vendor.profile.tagline}”
          </p>
        )}
        <p className="mt-1 flex items-center gap-1 text-sm" style={{ color: colors.plumSoft }}>
          <MapPin size={14} /> {locationName} · {vendor.serviceArea?.value}
        </p>
      </div>

      <div className="mt-8 space-y-8">
        {vendor.profile.description && (
          <section>
            <h2 className="mb-2 font-semibold" style={{ color: colors.plum }}>
              Om oss
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
              {vendor.profile.description}
            </p>
          </section>
        )}

        {vendor.profile.services.length > 0 && (
          <section>
            <h2 className="mb-3 font-semibold" style={{ color: colors.plum }}>
              Tjänster
            </h2>
            <div className="space-y-3">
              {vendor.profile.services.map((s) => (
                <div key={s.id} className="rounded-2xl p-4" style={{ backgroundColor: colors.cream }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold" style={{ color: colors.plum }}>
                      {s.name || "Namnlös tjänst"}
                    </p>
                    <p style={{ fontFamily: serif, fontSize: 16, color: colors.plum }}>
                      {s.price ? formatKr(Number(s.price)) : "—"}
                      {s.priceType === "per_person" ? "/person" : s.priceType === "per_hour" ? "/timme" : ""}
                    </p>
                  </div>
                  {s.description && (
                    <p className="mt-1 text-sm" style={{ color: colors.plumSoft }}>
                      {s.description}
                    </p>
                  )}
                  {s.priceNote && (
                    <p className="mt-1 text-xs" style={{ color: colors.plumSoft }}>
                      {s.priceNote}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {vendor.profile.addons.length > 0 && (
          <section>
            <h2 className="mb-3 font-semibold" style={{ color: colors.plum }}>
              Tillägg
            </h2>
            <div className="flex flex-wrap gap-2">
              {vendor.profile.addons.map((a) => (
                <span key={a.id} className="rounded-full px-3 py-1.5 text-sm" style={{ backgroundColor: colors.lilacSoft, color: colors.lilacDeep }}>
                  {a.name || "Namnlöst tillägg"} {a.price ? `+${formatKr(Number(a.price))}` : ""}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="mt-8 rounded-2xl p-4 text-sm" style={{ backgroundColor: colors.peachSoft, color: colors.plumSoft }}>
        {vendor.status === "approved"
          ? "Så här ser kunder er profil just nu – den är publicerad och bokningsbar."
          : "Så här kommer kunder se er profil när ansökan har godkänts och profilen publicerats."}
      </div>

      <button onClick={onBack} className="mt-6 w-full rounded-full py-3 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
        Tillbaka till redigering
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vendor inbox (Fas 8) — a full page (not a modal, unlike the customer-side
// chat) since a vendor spends more focused time here. Reuses the same quote
// bubble treatment as the customer's ChatModal.
// ---------------------------------------------------------------------------
function VendorInboxView({ conversations, activeConversationId, messages, onOpenConversation, onSendMessage, onSendQuote, onBack, inboxById = {}, quoteFromBrief }) {
  const [text, setText] = useState("");
  const [quoteMode, setQuoteMode] = useState(false);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteDescription, setQuoteDescription] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, activeConversationId]);

  const active = conversations.find((c) => c.id === activeConversationId) || null;
  const lastBrief = [...(messages || [])].reverse().find((m) => m.message_type === "brief")?.brief || null;
  const prefill = lastBrief && active && quoteFromBrief ? quoteFromBrief(lastBrief, active.category_id) : null;
  // With a request in the conversation, the quote starts from the vendor's own prices for what the customer picked.
  const openQuote = () => {
    if (prefill && !quoteAmount && !quoteDescription) {
      if (prefill.amount > 0) setQuoteAmount(String(prefill.amount));
      setQuoteDescription(prefill.description);
    }
    setQuoteMode(true);
  };

  const submitMessage = () => {
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText("");
  };

  const submitQuote = () => {
    const amount = Number(quoteAmount);
    if (!amount || amount <= 0) return;
    onSendQuote(amount, quoteDescription.trim());
    setQuoteAmount("");
    setQuoteDescription("");
    setQuoteMode(false);
  };

  const fieldStyle = { border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white };

  if (active) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col px-6 pb-10 pt-8 sm:px-10" style={{ height: "calc(100vh - 90px)" }}>
        <button onClick={onBack} className="-ml-2 mb-4 flex items-center gap-1 px-2 py-1.5 text-sm font-medium" style={{ color: colors.plumSoft }}>
          <ChevronLeft size={16} /> Alla konversationer
        </button>
        <div className="mb-3">
          <p style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>{catMap[active.category_id]?.label || "Fråga"}</p>
          <p className="text-xs" style={{ color: colors.plumSoft }}>Kund</p>
        </div>
        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto rounded-3xl p-4" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm" style={{ color: colors.plumSoft }}>
              Inga meddelanden än.
            </p>
          )}
          {messages.map((m) =>
            m.message_type === "brief" ? (
              <div key={m.id} className="flex" style={{ justifyContent: "flex-start" }}>
                <BriefCard brief={m.brief} />
              </div>
            ) : m.message_type === "quote" ? (
              <div key={m.id} className="flex" style={{ justifyContent: m.sender === "vendor" ? "flex-end" : "flex-start" }}>
                <div className="max-w-[80%] rounded-2xl p-3.5 text-sm" style={{ backgroundColor: colors.lilacSoft }}>
                  <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: colors.lilacDeep }}>
                    <Sparkles size={13} /> Din offert
                  </p>
                  <p className="mt-1" style={{ fontFamily: serif, fontSize: 18, color: colors.plum }}>
                    {formatKr(m.quote_amount)}
                  </p>
                  {m.quote_description && (
                    <p className="mt-1 text-sm" style={{ color: colors.plumSoft }}>
                      {m.quote_description}
                    </p>
                  )}
                  <span
                    className="mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: m.quote_status === "accepted" ? "#E3F3E9" : m.quote_status === "declined" ? colors.beige : colors.white,
                      color: m.quote_status === "accepted" ? colors.green : colors.plumSoft,
                    }}
                  >
                    {m.quote_status === "accepted" ? "Accepterad" : m.quote_status === "declined" ? "Nekad" : "Väntar på svar"}
                  </span>
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex" style={{ justifyContent: m.sender === "vendor" ? "flex-end" : "flex-start" }}>
                <div
                  className="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm"
                  style={{
                    backgroundColor: m.sender === "vendor" ? colors.coral : colors.cream,
                    color: m.sender === "vendor" ? colors.white : colors.plum,
                  }}
                >
                  {m.text}
                </div>
              </div>
            )
          )}
        </div>

        {quoteMode ? (
          <div className="mt-3 rounded-2xl p-4" style={{ backgroundColor: colors.lilacSoft }}>
            <p className="mb-2 text-sm font-semibold" style={{ color: colors.plum }}>
              Skicka offert
            </p>
            {prefill?.amount > 0 && (
              <p className="mb-2 text-xs" style={{ color: colors.lilacDeep }}>
                Utifrån kundens val och era priser blir riktpriset {formatKr(prefill.amount)}. Justera för design och extra önskemål.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={quoteAmount}
                onChange={(e) => setQuoteAmount(e.target.value)}
                placeholder="Pris (kr)"
                className="col-span-2 rounded-lg px-3 py-2 text-sm sm:col-span-1"
                style={fieldStyle}
              />
              <input
                value={quoteDescription}
                onChange={(e) => setQuoteDescription(e.target.value)}
                placeholder="Vad ingår? (valfritt)"
                className="col-span-2 rounded-lg px-3 py-2 text-sm sm:col-span-1"
                style={fieldStyle}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setQuoteMode(false)}
                className="flex-1 rounded-full px-4 py-2 text-sm font-medium"
                style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }}
              >
                Avbryt
              </button>
              <button onClick={submitQuote} className="flex-1 rounded-full px-4 py-2 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
                Skicka offert
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={openQuote}
              className="flex flex-shrink-0 items-center gap-1 rounded-full px-3 py-2.5 text-xs font-semibold"
              style={{ backgroundColor: colors.lilacSoft, color: colors.lilacDeep }}
            >
              <Sparkles size={14} /> Offert
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitMessage()}
              placeholder="Skriv ett meddelande..."
              className="flex-1 rounded-full px-4 py-2.5 text-sm"
              style={fieldStyle}
            />
            <button
              onClick={submitMessage}
              disabled={!text.trim()}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.coral, color: colors.white, opacity: text.trim() ? 1 : 0.5 }}
              aria-label="Skicka"
            >
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-10 sm:px-10">
      <h1 style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>Meddelanden</h1>
      <div className="mt-5 space-y-2">
        {conversations.length === 0 && (
          <p className="py-16 text-center text-sm" style={{ color: colors.plumSoft }}>
            Inga konversationer än.
          </p>
        )}
        {conversations.map((c) => {
          const Icon = catMap[c.category_id]?.icon;
          const meta = inboxById[c.id];
          const unread = meta?.unread || 0;
          const preview = meta ? (meta.last_type === "quote" ? "Offert" : meta.last_type === "brief" ? "Förfrågan" : meta.last_text) : "";
          return (
            <button
              key={c.id}
              onClick={() => onOpenConversation(c.id)}
              className="flex w-full items-center gap-3 rounded-2xl p-4 text-left"
              style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: colors.lilacSoft }}>
                {Icon && <Icon size={16} color={colors.lilacDeep} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold" style={{ color: colors.plum }}>
                  {catMap[c.category_id]?.label || "Fråga"}
                </p>
                <p className="truncate text-xs" style={{ color: unread > 0 ? colors.plum : colors.plumSoft, fontWeight: unread > 0 ? 600 : 400 }}>
                  Kund{preview ? ` · ${preview}` : ""}
                </p>
              </div>
              {unread > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-bold" style={{ backgroundColor: BADGE_RED, color: colors.white }}>
                  {unread}
                </span>
              )}
              <ChevronRight size={16} color={colors.plumSoft} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HeartButton({ vendorId, small, className = "" }) {
  const { ids, toggle } = useContext(FavoritesContext);
  if (!vendorId || String(vendorId).startsWith("VND-")) return null;
  const on = ids.has(vendorId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle(vendorId);
      }}
      aria-label={on ? "Ta bort från sparade" : "Spara leverantör"}
      aria-pressed={on}
      className={`flex items-center justify-center rounded-full ${className}`}
      style={{ backgroundColor: "rgba(255,255,255,0.92)", width: small ? 16 : 36, height: small ? 16 : 36 }}
    >
      <span key={String(on)} style={{ display: "flex", animation: on ? "planifest-pop 0.4s ease-out" : "none" }}>
        <Heart size={small ? 9 : 18} fill={on ? BADGE_RED : "none"} color={on ? BADGE_RED : colors.plumSoft} />
      </span>
    </button>
  );
}

// A small burst of paper confetti, e.g. when the last item on the checklist is ticked.
function Confetti() {
  const palette = [colors.lilac, BADGE_RED, "#E8B86B", colors.lilacDeep, "#8DB596", colors.coral];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center" aria-hidden="true">
      {Array.from({ length: 26 }, (_, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: 40,
            width: 7 + (i % 3) * 2,
            height: 10 + (i % 2) * 4,
            backgroundColor: palette[i % palette.length],
            borderRadius: i % 4 === 0 ? 999 : 2,
            "--dx": `${((i * 37) % 260) - 130}px`,
            "--dy": `${-(40 + ((i * 53) % 140))}px`,
            "--rot": `${(i * 97) % 540}deg`,
            animation: `planifest-confetti ${1.1 + (i % 5) * 0.12}s ease-out forwards`,
          }}
        />
      ))}
    </div>
  );
}

// A hand-drawn-style tick box: the check mark draws itself.
function HandCheck({ done, onToggle, label }) {
  return (
    <button type="button" onClick={onToggle} aria-label={label} aria-pressed={done} className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
      <svg viewBox="0 0 28 28" width="26" height="26" fill="none">
        <path d="M5 4.6 C 11 3.4, 18 3.6, 23.2 4.4 C 24.2 10, 24 17, 23.4 23.2 C 17 24.4, 11 24.2, 4.8 23.4 C 3.8 17, 4 10, 5 4.6 Z" stroke={done ? colors.green : colors.lilac} strokeWidth="1.8" fill={done ? "#E3F3E9" : colors.white} strokeLinejoin="round" />
        <path d="M8 14.5 L12.3 19 L20.5 8.5" stroke={colors.green} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 26, strokeDashoffset: done ? 0 : 26, transition: "stroke-dashoffset 0.35s ease" }} />
      </svg>
    </button>
  );
}

function EventFormModal({ open, mode, initial, onClose, onSubmit, onDelete }) {
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("party");
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState("");
  const [budget, setBudget] = useState("");
  const [withTemplate, setWithTemplate] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title || "");
    setEventType(initial?.eventType || "party");
    setDate(initial?.date || "");
    setGuests(initial?.guests ? String(initial.guests) : "");
    setBudget(initial?.budgetTotal ? String(initial.budgetTotal) : "");
    setWithTemplate(true);
    setConfirmDelete(false);
    setSaving(false);
  }, [open, initial]);
  if (!open) return null;
  const fieldStyle = { border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white };
  const canSave = title.trim().length > 0 && !saving;
  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    const g = Math.round(Number(guests));
    const ok = await onSubmit({
      title: title.trim(),
      eventType,
      date,
      guests: Number.isFinite(g) && g >= 1 && g <= 5000 ? g : null,
      budgetTotal: budget === "" ? null : toMoney(budget),
      withTemplate: mode === "create" && withTemplate,
    });
    setSaving(false);
    if (ok !== false) onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ backgroundColor: "rgba(60,47,69,0.45)" }} onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 sm:rounded-3xl" style={{ backgroundColor: colors.cream }} onClick={(e) => e.stopPropagation()}>
        <p style={{ fontFamily: serif, fontSize: 22, color: colors.plum }}>{mode === "create" ? "Ny planering" : "Redigera din fest"}</p>
        <label className="mt-4 flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
          Namn på festen
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Till exempel: Elsas 5-årsdag" className="rounded-xl px-3 py-2 text-sm font-normal" style={fieldStyle} />
        </label>
        <p className="mt-4 text-xs font-semibold" style={{ color: colors.plum }}>
          Vad ska ni fira?
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {OCCASIONS.map((o) => (
            <ChoiceChip key={o.id} active={eventType === o.id} onClick={() => setEventType(o.id)}>
              {o.emoji} {o.label}
            </ChoiceChip>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
            Datum
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl px-3 py-2 text-sm font-normal" style={fieldStyle} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
            Antal gäster
            <input type="number" min={1} value={guests} onChange={(e) => setGuests(e.target.value)} className="rounded-xl px-3 py-2 text-sm font-normal" style={fieldStyle} />
          </label>
        </div>
        <label className="mt-3 flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
          Budget (kr, valfritt)
          <input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} className="rounded-xl px-3 py-2 text-sm font-normal" style={fieldStyle} />
        </label>
        {mode === "create" && (
          <label className="mt-4 flex items-start gap-2 text-sm" style={{ color: colors.plum }}>
            <input type="checkbox" checked={withTemplate} onChange={(e) => setWithTemplate(e.target.checked)} className="mt-1" />
            Lägg in en färdig checklista för {occasionMap[eventType]?.label.toLowerCase()}, som du sedan kan ändra fritt.
          </label>
        )}
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-full px-4 py-3 text-sm font-medium" style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }}>
            Avbryt
          </button>
          <button onClick={submit} disabled={!canSave} className="flex-1 rounded-full px-4 py-3 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white, opacity: canSave ? 1 : 0.5 }}>
            {saving ? "Sparar..." : mode === "create" ? "Skapa" : "Spara"}
          </button>
        </div>
        {mode === "edit" && (
          <div className="mt-4 text-center">
            {confirmDelete ? (
              <p className="text-sm" style={{ color: colors.plum }}>
                Ta bort hela festen, med checklista, budget och anteckningar?{" "}
                <button
                  onClick={async () => {
                    await onDelete();
                    onClose();
                  }}
                  className="font-semibold underline"
                  style={{ color: colors.coralDeep }}
                >
                  Ja, ta bort
                </button>
              </p>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs font-medium underline" style={{ color: colors.coralDeep }}>
                Ta bort festen
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// One budget line. Edits are kept locally while typing and saved when the field loses focus.
function BudgetRow({ line, onUpdate, onRemove }) {
  const [label, setLabel] = useState(line.label);
  const [estimated, setEstimated] = useState(String(line.estimated));
  const [actual, setActual] = useState(line.actual == null ? "" : String(line.actual));
  const fieldStyle = { border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white };
  const save = () => {
    const patch = {};
    if (label.trim() && label.trim() !== line.label) patch.label = label.trim();
    const e = toMoney(estimated);
    if (e !== null && e !== line.estimated) patch.estimated = e;
    const a = actual === "" ? null : toMoney(actual);
    if (a !== line.actual && (actual === "" || a !== null)) patch.actual = a;
    if (Object.keys(patch).length) onUpdate(patch);
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl p-3" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.beige}` }}>
      <input value={label} onChange={(e) => setLabel(e.target.value)} onBlur={save} maxLength={100} aria-label="Post" className="min-w-[120px] flex-1 rounded-xl px-3 py-1.5 text-sm" style={fieldStyle} />
      <input type="number" min={0} value={estimated} onChange={(e) => setEstimated(e.target.value)} onBlur={save} aria-label="Uppskattat pris" placeholder="Uppskattat" className="w-24 rounded-xl px-3 py-1.5 text-sm" style={fieldStyle} />
      <input type="number" min={0} value={actual} onChange={(e) => setActual(e.target.value)} onBlur={save} aria-label="Faktiskt pris" placeholder="Faktiskt" className="w-24 rounded-xl px-3 py-1.5 text-sm" style={fieldStyle} />
      <label className="flex items-center gap-1.5 text-xs" style={{ color: colors.plumSoft }}>
        <input type="checkbox" checked={line.paid} onChange={(e) => onUpdate({ paid: e.target.checked })} aria-label="Betald" /> Betald
      </label>
      <button onClick={onRemove} aria-label="Ta bort post" className="p-1">
        <Trash2 size={14} color={colors.coralDeep} />
      </button>
    </div>
  );
}

// The notepad: lined paper that saves itself a moment after you stop typing.
function NotesPad({ initial, onSave }) {
  const [text, setText] = useState(initial);
  const [state, setState] = useState("saved");
  const lastSaved = useRef(initial);
  const textRef = useRef(initial);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  textRef.current = text;
  useEffect(() => {
    if (text === lastSaved.current) return;
    setState("saving");
    const t = setTimeout(async () => {
      lastSaved.current = text;
      await saveRef.current(text);
      setState("saved");
    }, 800);
    return () => clearTimeout(t);
  }, [text]);
  // leaving the page or switching event saves anything still waiting
  useEffect(
    () => () => {
      if (textRef.current !== lastSaved.current) saveRef.current(textRef.current);
    },
    []
  );
  return (
    <div className="relative mt-4">
      <span aria-hidden="true" className="absolute left-1/2 -top-3 h-6 w-24 -translate-x-1/2 rotate-[-2deg] rounded-sm" style={{ backgroundColor: "rgba(189,155,189,0.45)" }} />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={20000}
        aria-label="Anteckningar"
        placeholder="Skriv ner allt du inte vill glömma: idéer, önskemål, namn, telefonnummer..."
        rows={14}
        className="w-full rounded-lg text-base"
        style={{
          fontFamily: hand,
          fontSize: 20,
          lineHeight: "28px",
          padding: "8px 16px 8px 44px",
          color: colors.plum,
          backgroundColor: "#FFFDF8",
          backgroundImage: "repeating-linear-gradient(transparent, transparent 27px, rgba(189,155,189,0.4) 28px)",
          backgroundAttachment: "local",
          border: `1.5px solid ${colors.beige}`,
          borderLeft: "3px solid rgba(200,85,75,0.35)",
          boxShadow: "0 6px 14px rgba(76,51,38,0.07)",
        }}
      />
      <p className="mt-1 text-right text-xs" style={{ color: colors.plumSoft }}>
        {state === "saving" ? "Sparar..." : "Sparat ✓"}
      </p>
    </div>
  );
}

function GuestsTab({ ev, guestApi, onUpdateEvent, onRefresh }) {
  const [filter, setFilter] = useState("all");
  const [name, setName] = useState("");
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [open, setOpen] = useState(null); // guest id with the edit panel open
  const [copied, setCopied] = useState("");
  const [loc, setLoc] = useState(ev.location);
  const [time, setTime] = useState(ev.eventTime);
  const [msg, setMsg] = useState(ev.inviteMessage);
  const fieldStyle = { border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white };
  const guests = ev.guestList;

  // pick up answers that arrive while the page is open
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) onRefresh(ev.id);
    }, 20000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev.id]);

  const heads = (status) => guests.filter((g) => g.status === status).reduce((n, g) => n + g.partySize, 0);
  const count = (status) => guests.filter((g) => g.status === status).length;
  const yesHeads = heads("yes");
  const maybeHeads = heads("maybe");
  const shown = guests.filter((g) => filter === "all" || g.status === filter);

  // what the cook needs to know: dietary wishes of everyone who is coming (or might)
  const diet = {};
  const notes = [];
  guests
    .filter((g) => g.status === "yes" || g.status === "maybe")
    .forEach((g) => {
      g.dietary
        .split(/,\s*/)
        .filter(Boolean)
        .forEach((d) => {
          if (DIETARY_OPTIONS.includes(d)) diet[d] = (diet[d] || 0) + g.partySize;
          else notes.push(`${g.name}: ${d}`);
        });
    });

  const addOne = () => {
    if (!name.trim()) return;
    guestApi.add(ev.id, [name.trim()]);
    setName("");
  };
  const addBulk = () => {
    const names = bulk
      .split(/\n|,|;/)
      .map((n) => n.trim())
      .filter(Boolean)
      .slice(0, 100);
    if (names.length === 0) return;
    guestApi.add(ev.id, names);
    setBulk("");
    setShowBulk(false);
  };
  const flash = (key) => {
    setCopied(key);
    setTimeout(() => setCopied(""), 1800);
  };
  const send = async (g) => {
    const r = await shareOrCopy(invitationText(ev, g), ev.title);
    if (r !== "cancelled") flash(`i-${g.id}`);
  };
  const copyLink = async (g) => {
    await shareOrCopy(guestLink(g.token), ev.title).catch(() => {});
    flash(`l-${g.id}`);
  };
  const filters = [
    ["all", `Alla (${guests.length})`],
    ["yes", `Kommer (${count("yes")})`],
    ["maybe", `Kanske (${count("maybe")})`],
    ["no", `Kan inte (${count("no")})`],
    ["pending", `Ej svarat (${count("pending")})`],
  ];

  return (
    <div className="mt-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Kommer", yesHeads, "yes", "personer"],
          ["Kanske", maybeHeads, "maybe", "personer"],
          ["Kan inte", count("no"), "no", "gäster"],
          ["Ej svarat", count("pending"), "pending", "gäster"],
        ].map(([label, value, key, unit]) => (
          <div key={label} className="rounded-2xl p-3 text-center" style={{ backgroundColor: RSVP_STATUS[key].bg }}>
            <p style={{ fontFamily: serif, fontSize: 24, color: RSVP_STATUS[key].fg }}>{value}</p>
            <p className="text-xs" style={{ color: RSVP_STATUS[key].fg }}>
              {label} <span className="opacity-70">({unit})</span>
            </p>
          </div>
        ))}
      </div>
      {yesHeads > 0 && yesHeads !== ev.guests && (
        <button onClick={() => onUpdateEvent(ev.id, { guests: yesHeads })} className="mt-2 text-xs font-medium underline" style={{ color: colors.lilacDeep }}>
          Sätt antal gäster i festen till {yesHeads}
        </button>
      )}

      <div className="mt-5 rounded-2xl p-4" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.beige}` }}>
        <button onClick={() => setShowInvite((v) => !v)} className="flex w-full items-center justify-between text-left text-sm font-semibold" style={{ color: colors.plum }}>
          <span>Inbjudan: plats, tid och hälsning</span>
          <span style={{ color: colors.lilacDeep }}>{showInvite ? "Dölj" : "Ändra"}</span>
        </button>
        {!showInvite && (
          <p className="mt-1 text-xs" style={{ color: colors.plumSoft }}>
            {[ev.location, ev.eventTime, ev.rsvpDeadline ? `svara senast ${shortDate(ev.rsvpDeadline)}` : ""].filter(Boolean).join(" · ") || "Det här ser gästerna när de öppnar sin länk."}
          </p>
        )}
        {showInvite && (
          <div className="mt-3 grid gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
              Plats
              <input value={loc} onChange={(e) => setLoc(e.target.value)} onBlur={() => loc !== ev.location && onUpdateEvent(ev.id, { location: loc.trim() })} maxLength={200} placeholder="Till exempel: Hemma hos oss, Storgatan 1" className="rounded-xl px-3 py-2 text-sm font-normal" style={fieldStyle} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
                Tid
                <input value={time} onChange={(e) => setTime(e.target.value)} onBlur={() => time !== ev.eventTime && onUpdateEvent(ev.id, { eventTime: time.trim() })} maxLength={40} placeholder="14:00" className="rounded-xl px-3 py-2 text-sm font-normal" style={fieldStyle} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
                Svara senast
                <input type="date" value={ev.rsvpDeadline} onChange={(e) => onUpdateEvent(ev.id, { rsvpDeadline: e.target.value })} className="rounded-xl px-3 py-2 text-sm font-normal" style={fieldStyle} />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
              Hälsning till gästerna
              <textarea value={msg} onChange={(e) => setMsg(e.target.value)} onBlur={() => msg !== ev.inviteMessage && onUpdateEvent(ev.id, { inviteMessage: msg.trim() })} rows={3} maxLength={1000} placeholder="Skriv något personligt..." className="rounded-xl px-3 py-2 text-sm font-normal" style={fieldStyle} />
            </label>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl p-4" style={{ backgroundColor: colors.lilacSoft }}>
        <label className="flex items-start gap-3 text-sm" style={{ color: colors.plum }}>
          <input type="checkbox" checked={!!ev.inviteToken} onChange={(e) => guestApi.setOpen(ev, e.target.checked)} className="mt-1" aria-label="Gemensam länk" />
          <span>
            <strong>Gemensam länk.</strong> Skicka den till en grupp (till exempel i WhatsApp) så lägger gästerna till sig själva när de svarar.
          </span>
        </label>
        {ev.inviteToken && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-xs" style={{ backgroundColor: colors.white, color: colors.plum }}>
              {guestLink(ev.inviteToken)}
            </code>
            <button
              onClick={async () => {
                await shareOrCopy(`${ev.title}: svara här ${guestLink(ev.inviteToken)}`, ev.title);
                flash("open");
              }}
              className="rounded-full px-4 py-1.5 text-xs font-semibold"
              style={{ backgroundColor: colors.coral, color: colors.white }}
            >
              {copied === "open" ? "Kopierad ✓" : "Kopiera länk"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addOne()} maxLength={100} placeholder="Lägg till en gäst..." aria-label="Ny gäst" className="min-w-[160px] flex-1 rounded-xl px-3 py-2 text-sm" style={fieldStyle} />
        <button onClick={addOne} className="rounded-full px-5 py-2 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
          Lägg till
        </button>
      </div>
      <button onClick={() => setShowBulk((v) => !v)} className="mt-2 text-xs font-medium underline" style={{ color: colors.lilacDeep }}>
        {showBulk ? "Dölj" : "Klistra in flera namn på en gång"}
      </button>
      {showBulk && (
        <div className="mt-2">
          <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={5} aria-label="Flera gäster" placeholder={"Ett namn per rad:\nFarmor\nKalle och Lisa"} className="w-full rounded-xl px-3 py-2 text-sm" style={fieldStyle} />
          <button onClick={addBulk} className="mt-2 rounded-full px-5 py-2 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
            Lägg till alla
          </button>
        </div>
      )}

      {guests.length > 0 && (
        <div className="mt-4 flex gap-1.5 overflow-x-auto">
          {filters.map(([id, label]) => (
            <ChoiceChip key={id} active={filter === id} onClick={() => setFilter(id)}>
              {label}
            </ChoiceChip>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {guests.length === 0 && (
          <p className="py-6 text-center text-sm" style={{ color: colors.plumSoft }}>
            Inga gäster än. Lägg till några namn, så får var och en sin egen länk att svara via.
          </p>
        )}
        {shown.map((g) => {
          const meta = RSVP_STATUS[g.status];
          return (
            <div key={g.id} className="rounded-2xl p-3" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.beige}` }}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 truncate font-semibold" style={{ color: colors.plum }}>
                  {g.name}
                  {g.source === "open" && <span className="ml-1.5 text-xs font-normal" style={{ color: colors.plumSoft }}>(anmälde sig själv)</span>}
                </p>
                {(g.status === "yes" || g.status === "maybe") && g.partySize > 1 && (
                  <span className="text-xs font-semibold" style={{ color: meta.fg }}>
                    {g.partySize} personer
                  </span>
                )}
              </div>
              {(g.dietary || g.message) && (
                <p className="mt-1 text-xs italic" style={{ color: colors.plumSoft }}>
                  {[g.dietary, g.message && `"${g.message}"`].filter(Boolean).join(" · ")}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {["yes", "maybe", "no"].map((k) => {
                  const on = g.status === k;
                  return (
                    <button
                      key={k}
                      onClick={() => guestApi.update(ev.id, g.id, { status: on ? "pending" : k })}
                      aria-label={`${g.name}: ${RSVP_STATUS[k].label}`}
                      aria-pressed={on}
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ backgroundColor: on ? RSVP_STATUS[k].bg : colors.white, color: on ? RSVP_STATUS[k].fg : colors.plumSoft, border: `1.5px solid ${on ? RSVP_STATUS[k].fg : colors.beige}` }}
                    >
                      {RSVP_STATUS[k].label}
                    </button>
                  );
                })}
                {(g.status === "yes" || g.status === "maybe") && g.allowedParty > 1 && (
                  <span className="ml-1 flex items-center gap-1.5 text-xs" style={{ color: colors.plumSoft }}>
                    Antal
                    <button onClick={() => guestApi.update(ev.id, g.id, { partySize: Math.max(1, g.partySize - 1) })} aria-label={`Färre personer: ${g.name}`} className="h-6 w-6 rounded-full font-semibold" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.beige}` }}>
                      −
                    </button>
                    <span className="w-4 text-center font-semibold" style={{ color: colors.plum }}>
                      {g.partySize}
                    </span>
                    <button onClick={() => guestApi.update(ev.id, g.id, { partySize: Math.min(g.allowedParty, g.partySize + 1) })} aria-label={`Fler personer: ${g.name}`} className="h-6 w-6 rounded-full font-semibold" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.beige}` }}>
                      +
                    </button>
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                <button onClick={() => send(g)} className="rounded-full px-3 py-1.5 font-semibold" style={{ backgroundColor: colors.lilacSoft, color: colors.lilacDeep }}>
                  {copied === `i-${g.id}` ? "Klart ✓" : "Skicka inbjudan"}
                </button>
                <button onClick={() => copyLink(g)} className="font-medium underline" style={{ color: colors.lilacDeep }}>
                  {copied === `l-${g.id}` ? "Kopierad ✓" : "Kopiera länk"}
                </button>
                <button onClick={() => setOpen(open === g.id ? null : g.id)} className="font-medium underline" style={{ color: colors.plumSoft }}>
                  {open === g.id ? "Stäng" : "Ändra"}
                </button>
                <button onClick={() => guestApi.remove(ev.id, g.id)} aria-label={`Ta bort ${g.name}`} className="ml-auto p-1">
                  <Trash2 size={14} color={colors.coralDeep} />
                </button>
              </div>
              {open === g.id && (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl p-3 text-xs" style={{ backgroundColor: colors.cream, color: colors.plum }}>
                  <label className="flex items-center gap-1.5">
                    Mat / allergier
                    <input
                      defaultValue={g.dietary}
                      onBlur={(e) => e.target.value.trim() !== g.dietary && guestApi.update(ev.id, g.id, { dietary: e.target.value.trim().slice(0, 300) })}
                      maxLength={300}
                      aria-label={`Mat för ${g.name}`}
                      placeholder="Till exempel: Glutenfri"
                      className="w-44 rounded-lg px-2 py-1"
                      style={fieldStyle}
                    />
                  </label>
                  <label className="flex items-center gap-1.5">
                    Platser
                    <select value={g.allowedParty} onChange={(e) => guestApi.update(ev.id, g.id, { allowedParty: Number(e.target.value) })} aria-label={`Platser för ${g.name}`} className="rounded-lg px-2 py-1" style={fieldStyle}>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span style={{ color: colors.plumSoft }}>Platser = hur många som får komma, inklusive gästen.</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(Object.keys(diet).length > 0 || notes.length > 0) && (
        <div className="mt-6 rounded-2xl p-4" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.beige}` }}>
          <p className="text-sm font-semibold" style={{ color: colors.plum }}>
            Mat och allergier
          </p>
          <p className="mt-1 text-xs" style={{ color: colors.plumSoft }}>
            Bra att ge till catering eller bagare. Räknar dem som kommer och kanske kommer.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(diet).map(([d, n]) => (
              <span key={d} className="rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: colors.lilacSoft, color: colors.lilacDeep }}>
                {d} × {n}
              </span>
            ))}
          </div>
          {notes.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs" style={{ color: colors.plum }}>
              {notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// What a guest sees when they open their link. No account, no login.
function RsvpView({ state, onSubmit, onHome }) {
  const { loading, error, data, saved } = state;
  const [status, setStatus] = useState("");
  const [size, setSize] = useState(1);
  const [chips, setChips] = useState([]);
  const [other, setOther] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");
  const [editing, setEditing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  useEffect(() => {
    const g = data?.guest;
    if (!g) return;
    setStatus(g.status === "pending" ? "" : g.status);
    setSize(g.party_size || 1);
    const parts = (g.dietary || "").split(/,\s*/).filter(Boolean);
    setChips(parts.filter((x) => DIETARY_OPTIONS.includes(x)));
    setOther(parts.filter((x) => !DIETARY_OPTIONS.includes(x)).join(", "));
    setMessage(g.message || "");
  }, [data]);

  const wrap = (children) => <div className="mx-auto max-w-lg px-6 pb-24 pt-10 sm:px-10">{children}</div>;
  if (loading) return wrap(<p className="text-center text-sm" style={{ color: colors.plumSoft }}>Öppnar din inbjudan...</p>);
  if (error || !data) {
    return wrap(
      <div className="text-center">
        <h1 style={{ fontFamily: serif, fontSize: 26, color: colors.plum }}>Länken fungerar inte</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm" style={{ color: colors.plumSoft }}>
          {error || "Inbjudan hittades inte."}
        </p>
      </div>
    );
  }

  const e = data.event;
  const occ = occasionMap[e.event_type] || occasionMap.other;
  const isOpen = data.kind === "open";
  const maxParty = isOpen ? 5 : data.guest?.allowed_party || 1;
  const host = e.host ? `${e.host} bjuder in dig till` : "Du är bjuden till";
  const fieldStyle = { border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white };
  const answered = !editing && (saved || (data.guest && data.guest.status !== "pending"));
  const meta = RSVP_STATUS[data.guest?.status || "pending"];

  const submit = async () => {
    if (!status) {
      setFormError("Välj om du kommer.");
      return;
    }
    if (isOpen && !name.trim()) {
      setFormError("Skriv ditt namn.");
      return;
    }
    setFormError("");
    setSending(true);
    const dietary = status === "no" ? "" : [...chips, other.trim()].filter(Boolean).join(", ");
    const err = await onSubmit({ status, partySize: status === "no" ? 1 : size, dietary, message: message.trim(), name: name.trim() });
    setSending(false);
    if (err) setFormError(err);
    else setEditing(false);
  };

  const card = (
    <div className="relative overflow-hidden rounded-3xl p-6 text-center" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}`, boxShadow: "0 10px 30px rgba(76,51,38,0.08)" }}>
      {saved?.status === "yes" && <Confetti key={saved.guestToken} />}
      <p style={{ fontFamily: hand, fontSize: 26, color: colors.lilacDeep }}>{host}</p>
      <p className="mt-1 text-4xl">{occ.emoji}</p>
      <h1 className="mt-1" style={{ fontFamily: serif, fontSize: 30, color: colors.plum }}>
        {e.title}
      </h1>
      <div className="mt-3 flex flex-col items-center gap-1 text-sm" style={{ color: colors.plum }}>
        {e.date && (
          <span className="flex items-center gap-1.5">
            <Calendar size={14} /> {new Date(`${e.date}T00:00:00`).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </span>
        )}
        {e.time && (
          <span className="flex items-center gap-1.5">
            <Clock size={14} /> kl. {e.time}
          </span>
        )}
        {e.location && (
          <span className="flex items-center gap-1.5">
            <MapPin size={14} /> {e.location}
          </span>
        )}
      </div>
      {e.message && (
        <p className="mx-auto mt-4 max-w-sm whitespace-pre-line text-sm italic leading-relaxed" style={{ fontFamily: serif, color: colors.plumSoft }}>
          "{e.message}"
        </p>
      )}
    </div>
  );

  return wrap(
    <>
      {card}
      <div className="mt-5">
        {data.closed ? (
          <div className="rounded-2xl p-4 text-center text-sm" style={{ backgroundColor: colors.beige, color: colors.plum }}>
            Svarstiden har gått ut{e.deadline ? ` (${shortDate(e.deadline)})` : ""}.
            {data.guest && data.guest.status !== "pending" && <span> Ditt svar var: <strong>{meta.label}</strong>.</span>}
          </div>
        ) : answered ? (
          <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: "#E3F3E9" }}>
            <p style={{ fontFamily: hand, fontSize: 28, color: "#3D7A52" }}>Tack, ditt svar är sparat!</p>
            <p className="mt-1 text-sm" style={{ color: colors.plum }}>
              {data.guest?.name ? `${data.guest.name}: ` : ""}
              <strong>{meta.label}</strong>
              {data.guest?.status === "yes" && data.guest.party_size > 1 ? ` · ${data.guest.party_size} personer` : ""}
            </p>
            {isOpen || saved?.guestToken ? (
              <div className="mt-3 text-xs" style={{ color: colors.plum }}>
                <p>Vill du ändra dig? Spara din personliga länk:</p>
                <button
                  onClick={async () => {
                    await shareOrCopy(guestLink(saved?.guestToken || state.token), e.title);
                    setCopiedLink(true);
                  }}
                  className="mt-1 font-semibold underline"
                >
                  {copiedLink ? "Länken är kopierad ✓" : "Kopiera min länk"}
                </button>
              </div>
            ) : null}
            <button onClick={() => setEditing(true)} className="mt-3 rounded-full px-5 py-2 text-sm font-semibold" style={{ border: `1.5px solid ${colors.coral}`, color: colors.coral, backgroundColor: colors.white }}>
              Ändra mitt svar
            </button>
          </div>
        ) : (
          <div className="rounded-3xl p-5" style={{ backgroundColor: colors.cream }}>
            {isOpen ? (
              <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
                Ditt namn
                <input value={name} onChange={(ev2) => setName(ev2.target.value)} maxLength={100} aria-label="Ditt namn" className="rounded-xl px-3 py-2 text-sm font-normal" style={fieldStyle} />
              </label>
            ) : (
              <p style={{ fontFamily: hand, fontSize: 26, color: colors.plum }}>Hej {data.guest?.name}!</p>
            )}
            <p className="mt-3 text-sm font-semibold" style={{ color: colors.plum }}>
              Kommer du?
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[
                ["yes", "Jag kommer 🎉"],
                ["maybe", "Kanske"],
                ["no", "Kan tyvärr inte"],
              ].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setStatus(k)}
                  aria-pressed={status === k}
                  className="rounded-2xl px-2 py-3 text-sm font-semibold"
                  style={{ backgroundColor: status === k ? RSVP_STATUS[k].bg : colors.white, color: status === k ? RSVP_STATUS[k].fg : colors.plum, border: `2px solid ${status === k ? RSVP_STATUS[k].fg : colors.beige}` }}
                >
                  {label}
                </button>
              ))}
            </div>

            {(status === "yes" || status === "maybe") && (
              <>
                {maxParty > 1 && (
                  <div className="mt-4 flex items-center gap-3">
                    <span className="text-sm font-semibold" style={{ color: colors.plum }}>
                      Hur många kommer? <span className="font-normal" style={{ color: colors.plumSoft }}>(inklusive dig)</span>
                    </span>
                    <button onClick={() => setSize((n) => Math.max(1, n - 1))} aria-label="Färre" className="h-8 w-8 rounded-full text-lg font-semibold" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.beige}` }}>
                      −
                    </button>
                    <span aria-label="Antal personer" className="w-5 text-center font-semibold" style={{ color: colors.plum }}>
                      {size}
                    </span>
                    <button onClick={() => setSize((n) => Math.min(maxParty, n + 1))} aria-label="Fler" className="h-8 w-8 rounded-full text-lg font-semibold" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.beige}` }}>
                      +
                    </button>
                  </div>
                )}
                <p className="mt-4 text-sm font-semibold" style={{ color: colors.plum }}>
                  Något vi ska tänka på med maten?
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DIETARY_OPTIONS.map((d) => (
                    <ChoiceChip key={d} active={chips.includes(d)} onClick={() => setChips((c) => (c.includes(d) ? c.filter((x) => x !== d) : [...c, d]))}>
                      {d}
                    </ChoiceChip>
                  ))}
                </div>
                <input value={other} onChange={(ev2) => setOther(ev2.target.value)} maxLength={150} placeholder="Annat, till exempel allergier" aria-label="Annat om maten" className="mt-2 w-full rounded-xl px-3 py-2 text-sm" style={fieldStyle} />
              </>
            )}
            <textarea value={message} onChange={(ev2) => setMessage(ev2.target.value)} rows={2} maxLength={500} placeholder="Ett meddelande till värden (valfritt)" aria-label="Meddelande" className="mt-4 w-full rounded-xl px-3 py-2 text-sm" style={fieldStyle} />
            {formError && (
              <p className="mt-2 text-sm" style={{ color: colors.coralDeep }}>
                {formError}
              </p>
            )}
            <button onClick={submit} disabled={sending} className="mt-4 w-full rounded-full py-3 text-base font-semibold" style={{ backgroundColor: colors.coral, color: colors.white, opacity: sending ? 0.6 : 1 }}>
              {sending ? "Skickar..." : "Skicka mitt svar"}
            </button>
            {e.deadline && (
              <p className="mt-2 text-center text-xs" style={{ color: colors.plumSoft }}>
                Svara senast {shortDate(e.deadline)}.
              </p>
            )}
          </div>
        )}
      </div>
      <p className="mt-5 text-center text-xs" style={{ color: colors.plumSoft }}>
        Ditt svar delas bara med {e.host || "den som bjudit in dig"}.
      </p>
      <p className="mt-4 text-center text-xs" style={{ color: colors.plumSoft }}>
        Ska du själv ha en fest?{" "}
        <button onClick={onHome} className="font-semibold underline" style={{ color: colors.lilacDeep }}>
          Planera den på Planifest
        </button>
      </p>
    </>
  );
}

function PlanningView({ session, events, activeEventId, onSelectEvent, onCreateEvent, onUpdateEvent, onDeleteEvent, taskApi, budgetApi, guestApi, bookings, savedProviders, onViewProvider, party, onLogin, onSignup }) {
  const [tab, setTab] = useState("checklist");
  const [modal, setModal] = useState(null); // null | "create" | "edit"
  const [newTask, setNewTask] = useState("");
  const [newDue, setNewDue] = useState("");
  const [editing, setEditing] = useState(null); // { id, value }
  const [showDone, setShowDone] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [newLine, setNewLine] = useState("");
  const [newEstimate, setNewEstimate] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const ev = events.find((e) => e.id === activeEventId) || events[0] || null;
  const prevDone = useRef(null);
  const fieldStyle = { border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white };

  useEffect(() => {
    setBudgetInput(ev?.budgetTotal ? String(ev.budgetTotal) : "");
  }, [ev?.id, ev?.budgetTotal]);

  // confetti the moment the last open item is ticked off
  const doneCount = ev ? ev.tasks.filter((t) => t.done).length : 0;
  const totalCount = ev ? ev.tasks.length : 0;
  useEffect(() => {
    if (prevDone.current !== null && ev && totalCount >= 3 && doneCount === totalCount && prevDone.current < totalCount) setConfetti((c) => c + 1);
    prevDone.current = ev ? doneCount : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneCount, totalCount, ev?.id]);

  if (!session) {
    return (
      <div className="mx-auto max-w-xl px-6 pb-24 pt-14 text-center sm:px-10">
        <p style={{ fontFamily: hand, fontSize: 28, color: colors.lilacDeep }}>din fest, på ett ställe</p>
        <h1 style={{ fontFamily: serif, fontSize: 32, color: colors.plum }}>Min planering</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
          Spara dina fester, bocka av en checklista, håll koll på budgeten, skriv anteckningar och samla leverantörerna du gillar. Allt med ett gratis konto.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={onSignup} className="rounded-full px-6 py-3 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
            Skapa konto
          </button>
          <button onClick={onLogin} className="rounded-full px-6 py-3 text-sm font-medium" style={{ border: `1.5px solid ${colors.coral}`, color: colors.coral, backgroundColor: colors.white }}>
            Logga in
          </button>
        </div>
      </div>
    );
  }

  const createModal = (
    <EventFormModal
      open={modal === "create" || modal === "edit"}
      mode={modal === "edit" ? "edit" : "create"}
      initial={
        modal === "edit" && ev
          ? ev
          : { title: party.occasion ? occasionMap[party.occasion]?.boardLabel : "", eventType: party.occasion || "party", date: party.date || "", guests: party.guests || "", budgetTotal: null }
      }
      onClose={() => setModal(null)}
      onSubmit={(values) => (modal === "edit" ? onUpdateEvent(ev.id, values) : onCreateEvent(values))}
      onDelete={() => onDeleteEvent(ev.id)}
    />
  );

  if (!ev) {
    return (
      <div className="mx-auto max-w-xl px-6 pb-24 pt-14 text-center sm:px-10">
        <p style={{ fontFamily: hand, fontSize: 28, color: colors.lilacDeep }}>nu börjar det roliga</p>
        <h1 style={{ fontFamily: serif, fontSize: 32, color: colors.plum }}>Min planering</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
          Skapa din första fest, så får du checklista, budget och anteckningsblock på ett ställe.
        </p>
        <button onClick={() => setModal("create")} className="mt-6 rounded-full px-6 py-3 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
          Skapa min första fest
        </button>
        {savedProviders.length > 0 && (
          <p className="mt-4 text-xs" style={{ color: colors.plumSoft }}>
            Du har {savedProviders.length} sparade leverantörer. De hittar du här när festen är skapad.
          </p>
        )}
        {createModal}
      </div>
    );
  }

  const occ = occasionMap[ev.eventType] || occasionMap.other;
  const left = daysUntil(ev.date);
  const open = ev.tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.dueDate && b.dueDate ? a.dueDate.localeCompare(b.dueDate) : a.dueDate ? -1 : b.dueDate ? 1 : 0));
  const done = ev.tasks.filter((t) => t.done);
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  // budget: own lines + what is booked here on Planifest for this event
  const booked = bookings
    .filter((b) => b.eventId === ev.id && !b.cancelled)
    .flatMap((b) => b.items.filter((i) => i.status !== "declined" && i.status !== "cancelled").map((i) => ({ ...i, bookingNumber: b.bookingNumber })));
  const bookedSum = booked.reduce((n, i) => n + Number(i.price || 0), 0);
  const linesPlanned = ev.budget.reduce((n, l) => n + (l.actual ?? l.estimated), 0);
  const linesPaid = ev.budget.filter((l) => l.paid).reduce((n, l) => n + (l.actual ?? l.estimated), 0);
  const planned = linesPlanned + bookedSum;
  const remaining = ev.budgetTotal != null ? ev.budgetTotal - planned : null;
  const usedPct = ev.budgetTotal ? Math.min(100, Math.round((planned / ev.budgetTotal) * 100)) : 0;

  const addTask = () => {
    const title = newTask.trim();
    if (!title) return;
    taskApi.add(ev.id, { title, dueDate: newDue || null });
    setNewTask("");
    setNewDue("");
  };
  const dueInfo = (t) => {
    if (!t.dueDate) return null;
    const d = daysUntil(t.dueDate);
    if (!t.done && d < 0) return { text: `Försenad · ${shortDate(t.dueDate)}`, color: colors.coralDeep };
    if (!t.done && d <= 7) return { text: `Snart · ${shortDate(t.dueDate)}`, color: colors.lilacDeep };
    return { text: shortDate(t.dueDate), color: colors.plumSoft };
  };
  const taskRow = (t) => {
    const info = dueInfo(t);
    return (
      <div key={t.id} className="flex items-center gap-2 rounded-2xl px-3 py-2" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.beige}` }}>
        <HandCheck done={t.done} onToggle={() => taskApi.toggle(ev.id, t.id)} label={t.done ? `Ångra: ${t.title}` : `Klart: ${t.title}`} />
        <div className="min-w-0 flex-1">
          {editing?.id === t.id ? (
            <input
              autoFocus
              value={editing.value}
              onChange={(e) => setEditing({ id: t.id, value: e.target.value })}
              onBlur={() => {
                if (editing.value.trim() && editing.value.trim() !== t.title) taskApi.update(ev.id, t.id, { title: editing.value.trim() });
                setEditing(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              maxLength={200}
              aria-label="Ändra punkt"
              className="w-full rounded-lg px-2 py-1 text-sm"
              style={fieldStyle}
            />
          ) : (
            <button onClick={() => setEditing({ id: t.id, value: t.title })} className="block w-full text-left text-sm" style={{ color: t.done ? colors.plumSoft : colors.plum, textDecoration: t.done ? "line-through" : "none" }}>
              {t.title}
            </button>
          )}
          {info && (
            <span className="text-xs" style={{ color: info.color, fontWeight: info.color === colors.plumSoft ? 400 : 600 }}>
              {info.text}
            </span>
          )}
        </div>
        <button onClick={() => taskApi.remove(ev.id, t.id)} aria-label={`Ta bort: ${t.title}`} className="p-1">
          <Trash2 size={14} color={colors.plumSoft} />
        </button>
      </div>
    );
  };

  const tabs = [
    { id: "checklist", label: "Checklista", icon: ListChecks, count: open.length },
    { id: "budget", label: "Budget", icon: Wallet },
    { id: "guests", label: "Gäster", icon: Users, count: ev.guestList.length },
    { id: "notes", label: "Anteckningar", icon: StickyNote },
    { id: "saved", label: "Sparade", icon: Heart, count: savedProviders.length },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 pb-28 pt-8 sm:px-10">
      <p style={{ fontFamily: hand, fontSize: 24, color: colors.lilacDeep }}>min planering</p>

      {events.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {events.map((e) => (
            <ChoiceChip key={e.id} active={e.id === ev.id} onClick={() => onSelectEvent(e.id)}>
              {(occasionMap[e.eventType] || occasionMap.other).emoji} {e.title}
            </ChoiceChip>
          ))}
        </div>
      )}

      <div className="relative overflow-hidden rounded-3xl" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
        {confetti > 0 && <Confetti key={confetti} />}
        <div className="flex items-stretch">
          <div className="min-w-0 flex-1 p-5">
            <p className="text-2xl">{occ.emoji}</p>
            <h1 className="mt-1 truncate" style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>
              {ev.title}
            </h1>
            <p className="mt-1 flex flex-wrap gap-x-3 text-sm" style={{ color: colors.plumSoft }}>
              {ev.date && <span>{new Date(`${ev.date}T00:00:00`).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>}
              {ev.guests && <span>{ev.guests} gäster</span>}
              {!ev.date && <span>Inget datum satt än</span>}
            </p>
            <div className="mt-3 flex gap-3 text-xs">
              <button onClick={() => setModal("edit")} className="flex items-center gap-1 font-medium underline" style={{ color: colors.lilacDeep }}>
                <Pencil size={12} /> Redigera
              </button>
              <button onClick={() => setModal("create")} className="flex items-center gap-1 font-medium underline" style={{ color: colors.lilacDeep }}>
                <Plus size={12} /> Ny fest
              </button>
            </div>
          </div>
          {left !== null && (
            <div className="relative flex w-28 flex-shrink-0 flex-col items-center justify-center py-4 text-center" style={{ borderLeft: `2px dashed ${colors.lilac}`, backgroundColor: colors.lilacSoft }}>
              <span aria-hidden="true" className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full" style={{ backgroundColor: colors.cream }} />
              <span aria-hidden="true" className="absolute -bottom-2.5 -left-2.5 h-5 w-5 rounded-full" style={{ backgroundColor: colors.cream }} />
              {left > 0 ? (
                <>
                  <span style={{ fontFamily: serif, fontSize: 34, lineHeight: 1, color: colors.plum }}>{left}</span>
                  <span style={{ fontFamily: hand, fontSize: 20, color: colors.lilacDeep }}>{left === 1 ? "dag kvar" : "dagar kvar"}</span>
                </>
              ) : left === 0 ? (
                <span style={{ fontFamily: hand, fontSize: 26, color: colors.lilacDeep }}>Idag! 🎉</span>
              ) : (
                <span style={{ fontFamily: hand, fontSize: 20, color: colors.plumSoft }}>{-left} dagar sedan</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium"
              style={{ backgroundColor: active ? colors.coral : colors.white, color: active ? colors.white : colors.plum, border: `1.5px solid ${active ? colors.coral : colors.beige}` }}
            >
              <Icon size={14} /> {t.label}
              {t.count > 0 && <span className="text-xs opacity-80">({t.count})</span>}
            </button>
          );
        })}
      </div>

      {tab === "checklist" && (
        <div className="mt-5">
          <div className="flex items-end justify-between">
            <p style={{ fontFamily: hand, fontSize: 24, color: colors.plum }}>{totalCount === 0 ? "ingenting att göra än" : `${doneCount} av ${totalCount} klara`}</p>
            {totalCount > 0 && <span className="text-xs" style={{ color: colors.plumSoft }}>{pct}%</span>}
          </div>
          {totalCount > 0 && (
            <div className="mt-1 h-2 overflow-hidden rounded-full" style={{ backgroundColor: colors.beige }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors.green, transition: "width 0.4s ease" }} />
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              maxLength={200}
              placeholder="Lägg till något att göra..."
              aria-label="Ny punkt"
              className="min-w-[160px] flex-1 rounded-xl px-3 py-2 text-sm"
              style={fieldStyle}
            />
            <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} aria-label="Klart senast" className="rounded-xl px-2 py-2 text-sm" style={fieldStyle} />
            <button onClick={addTask} className="rounded-full px-5 py-2 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
              Lägg till
            </button>
          </div>
          <button
            onClick={() => taskApi.addTemplate(ev)}
            className="mt-2 flex items-center gap-1.5 text-xs font-medium underline"
            style={{ color: colors.lilacDeep }}
          >
            <Sparkles size={12} /> Fyll på med förslag för {occ.label.toLowerCase()}
          </button>
          <div className="mt-4 space-y-2">{open.map(taskRow)}</div>
          {done.length > 0 && (
            <div className="mt-5">
              <button onClick={() => setShowDone((v) => !v)} className="text-sm font-medium underline" style={{ color: colors.plumSoft }}>
                {showDone ? "Dölj" : "Visa"} klara ({done.length})
              </button>
              {showDone && <div className="mt-2 space-y-2">{done.map(taskRow)}</div>}
            </div>
          )}
        </div>
      )}

      {tab === "budget" && (
        <div className="mt-5">
          <label className="flex flex-wrap items-center gap-3 text-sm font-semibold" style={{ color: colors.plum }}>
            Din totala budget
            <input
              type="number"
              min={0}
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              onBlur={() => {
                const v = budgetInput === "" ? null : toMoney(budgetInput);
                if (v !== ev.budgetTotal && (budgetInput === "" || v !== null)) onUpdateEvent(ev.id, { budgetTotal: v });
              }}
              aria-label="Total budget"
              placeholder="kr"
              className="w-36 rounded-xl px-3 py-2 text-sm font-normal"
              style={fieldStyle}
            />
          </label>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              ["Planerat", formatKr(planned), colors.plum],
              ["Betalt", formatKr(linesPaid), colors.plum],
              [remaining != null && remaining < 0 ? "Över budget" : "Kvar", remaining != null ? formatKr(Math.abs(remaining)) : "–", remaining != null && remaining < 0 ? colors.coralDeep : colors.green],
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-2xl p-3 text-center" style={{ backgroundColor: colors.lilacSoft }}>
                <p style={{ fontFamily: serif, fontSize: 19, color }}>{value}</p>
                <p className="text-xs" style={{ color: colors.lilacDeep }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
          {ev.budgetTotal ? (
            <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: colors.beige }}>
              <div className="h-full rounded-full" style={{ width: `${usedPct}%`, backgroundColor: remaining < 0 ? colors.coralDeep : colors.lilacDeep, transition: "width 0.4s ease" }} />
            </div>
          ) : (
            <p className="mt-2 text-xs" style={{ color: colors.plumSoft }}>
              Sätt en total budget så ser du hur mycket som finns kvar.
            </p>
          )}

          <p className="mb-2 mt-6 text-sm font-semibold" style={{ color: colors.plum }}>
            Bokat på Planifest
          </p>
          {booked.length === 0 ? (
            <p className="text-xs" style={{ color: colors.plumSoft }}>
              Leverantörer du bokar och kopplar till den här festen dyker upp här automatiskt, med pris och status.
            </p>
          ) : (
            <div className="space-y-2">
              {booked.map((i) => {
                const meta = BOOKING_STATUS_META[i.status] || BOOKING_STATUS_META.pending;
                return (
                  <div key={`${i.bookingNumber}-${i.id}`} className="flex items-center justify-between gap-3 rounded-2xl p-3" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.beige}` }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: colors.plum }}>
                        {i.name}
                      </p>
                      <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: meta.bg, color: meta.fg }}>
                        {meta.label}
                      </span>
                    </div>
                    <span style={{ fontFamily: serif, fontSize: 17, color: colors.plum }}>{formatKr(i.price)}</span>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mb-2 mt-6 text-sm font-semibold" style={{ color: colors.plum }}>
            Egna poster
          </p>
          <div className="space-y-2">
            {ev.budget.map((l) => (
              <BudgetRow key={l.id} line={l} onUpdate={(patch) => budgetApi.update(ev.id, l.id, patch)} onRemove={() => budgetApi.remove(ev.id, l.id)} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={newLine} onChange={(e) => setNewLine(e.target.value)} maxLength={100} placeholder="Till exempel: Ballonger" aria-label="Ny post" className="min-w-[140px] flex-1 rounded-xl px-3 py-2 text-sm" style={fieldStyle} />
            <input type="number" min={0} value={newEstimate} onChange={(e) => setNewEstimate(e.target.value)} placeholder="kr" aria-label="Pris på ny post" className="w-24 rounded-xl px-3 py-2 text-sm" style={fieldStyle} />
            <button
              onClick={() => {
                if (!newLine.trim()) return;
                budgetApi.add(ev.id, { label: newLine.trim(), estimated: toMoney(newEstimate) ?? 0 });
                setNewLine("");
                setNewEstimate("");
              }}
              className="rounded-full px-5 py-2 text-sm font-semibold"
              style={{ backgroundColor: colors.coral, color: colors.white }}
            >
              Lägg till post
            </button>
          </div>
        </div>
      )}

      {tab === "guests" && <GuestsTab key={ev.id} ev={ev} guestApi={guestApi} onUpdateEvent={onUpdateEvent} onRefresh={guestApi.refresh} />}

      {tab === "notes" && <NotesPad key={ev.id} initial={ev.notes} onSave={(text) => onUpdateEvent(ev.id, { notes: text })} />}

      {tab === "saved" && (
        <div className="mt-5">
          {savedProviders.length === 0 ? (
            <p className="py-6 text-center text-sm" style={{ color: colors.plumSoft }}>
              Du har inga sparade leverantörer än. Tryck på hjärtat på en leverantör så hamnar den här.
            </p>
          ) : (
            <div className="space-y-2">
              {savedProviders.map((p) => (
                <div key={p.id} onClick={() => onViewProvider(p.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onViewProvider(p.id)} className="flex cursor-pointer items-center gap-3 rounded-2xl p-3" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.beige}` }}>
                  <img src={p.image || `https://picsum.photos/seed/${p.seed}/120/120`} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold" style={{ color: colors.plum }}>
                      {p.name}
                    </p>
                    <p className="text-xs" style={{ color: colors.plumSoft }}>
                      {catMap[p.category]?.label} · {p.requestOnly ? (p.fromPrice > 0 ? `från ${formatKr(p.fromPrice)}` : "Pris på förfrågan") : `${formatKr(p.pricing.amount)}${getUnitLabel(p.pricing)}`}
                    </p>
                  </div>
                  <HeartButton vendorId={p.vendorDbId} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {createModal}
    </div>
  );
}

function ChoiceChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-xs font-medium"
      style={{
        border: `1px solid ${active ? colors.lilac : colors.beige}`,
        backgroundColor: active ? colors.lilacSoft : colors.white,
        color: active ? colors.lilacDeep : colors.plum,
      }}
    >
      {children}
    </button>
  );
}

// A customer's request as a card inside the chat: the date and details, then the vendor's own questions with the answers.
function BriefCard({ brief }) {
  const rows = (brief?.rows || []).filter((r) => r && r.value !== "" && !(Array.isArray(r.value) && r.value.length === 0));
  const party = brief?.party;
  const partyText = party
    ? [party.date, party.start && party.end ? `${String(party.start).slice(0, 5)}–${String(party.end).slice(0, 5)}` : "", party.guests ? `${party.guests} gäster` : ""].filter(Boolean).join(" · ")
    : "";
  return (
    <div className="max-w-[90%] rounded-2xl p-4 text-sm" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
      <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: colors.lilacDeep }}>
        <ClipboardList size={13} /> Förfrågan
      </p>
      {partyText && (
        <p className="mt-1.5 text-xs" style={{ color: colors.plumSoft }}>
          {partyText}
        </p>
      )}
      <dl className="mt-2 space-y-1.5">
        {rows.map((r, i) => (
          <div key={`${r.label}-${i}`} className="flex gap-3">
            <dt className="w-28 flex-shrink-0 text-xs" style={{ color: colors.plumSoft }}>
              {r.label}
            </dt>
            <dd style={{ color: colors.plum }}>{[].concat(r.value).join(", ")}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Customer side: the vendor's own questions in a pop-up. Sent as one request, then the talk continues in the chat.
function RequestFormModal({ provider, party, onUpdateParty, onSend, onClose }) {
  const fields = provider.request.fields;
  const [answers, setAnswers] = useState({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const fieldStyle = { border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white };
  const closed = !!party.date && provider.closedDates?.includes(party.date);
  const setAnswer = (id, v) => setAnswers((a) => ({ ...a, [id]: v }));
  const toggleMulti = (id, label) => setAnswers((a) => ({ ...a, [id]: (a[id] || []).includes(label) ? a[id].filter((x) => x !== label) : [...(a[id] || []), label] }));
  const isEmpty = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
  const missing = fields.some((f) => f.required && isEmpty(answers[f.id]));
  const canSend = !!party.date && !closed && !missing && !sending;

  const base = provider.pricing.amount > 0 ? getBaseAmount(provider, party) : 0;
  const estimate = base + priceFromAnswers(fields, (f) => answers[f.id]);

  const submit = async () => {
    setError("");
    const freeText = fields.filter((f) => f.type === "short" || f.type === "long").map((f) => answers[f.id] || "").join(" ");
    if (containsContactInfo(freeText)) {
      setError("Telefonnummer, e-post och länkar får inte skickas här. Håll kontakten på Planifest så gäller ert skydd.");
      return;
    }
    const rows = fields
      .filter((f) => !isEmpty(answers[f.id]))
      .map((f) => ({ label: f.label, value: Array.isArray(answers[f.id]) ? answers[f.id] : String(answers[f.id]).trim() }))
      .filter((r) => r.value !== "");
    const brief = {
      rows: rows.length ? rows : [{ label: "Förfrågan", value: "Inga särskilda önskemål" }],
      party: { date: party.date, start: party.startTime, end: party.endTime, guests: Number(party.guests) || 1, occasion: party.occasion || "" },
    };
    if (estimate > 0) brief.estimate = Math.round(estimate);
    setSending(true);
    const ok = await onSend(brief);
    setSending(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ backgroundColor: "rgba(60,47,69,0.45)" }} onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl"
        style={{ backgroundColor: colors.cream }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 pb-3 pt-5" style={{ borderBottom: `1.5px solid ${colors.lilacSoft}` }}>
          <div>
            <p style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>Skicka förfrågan till {provider.name}</p>
            <p className="mt-0.5 text-xs" style={{ color: colors.plumSoft }}>
              Berätta vad du behöver. Ni pratar vidare i chatten, och leverantören skickar en offert med slutpris.
            </p>
          </div>
          <button onClick={onClose} className="-mr-2 p-2" aria-label="Stäng">
            <X size={18} color={colors.plumSoft} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="col-span-2 flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
              Datum *
              <input type="date" value={party.date || ""} onChange={(e) => onUpdateParty({ date: e.target.value })} className="rounded-xl px-3 py-2 text-sm font-normal" style={fieldStyle} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
              Start
              <input type="time" value={party.startTime} onChange={(e) => onUpdateParty({ startTime: e.target.value })} className="rounded-xl px-2 py-2 text-sm font-normal" style={fieldStyle} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
              Slut
              <input type="time" value={party.endTime} onChange={(e) => onUpdateParty({ endTime: e.target.value })} className="rounded-xl px-2 py-2 text-sm font-normal" style={fieldStyle} />
            </label>
          </div>
          <label className="mt-3 flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
            Antal gäster
            <input
              type="number"
              min={1}
              value={party.guests}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") onUpdateParty({ guests: "" });
                else if (!Number.isNaN(Number(raw))) onUpdateParty({ guests: Number(raw) });
              }}
              onBlur={() => onUpdateParty({ guests: party.guests === "" || party.guests < 1 ? 1 : party.guests })}
              className="w-32 rounded-xl px-3 py-2 text-sm font-normal"
              style={fieldStyle}
            />
          </label>
          {closed && (
            <p className="mt-1 text-xs" style={{ color: colors.coralDeep }}>
              Leverantören har stängt det här datumet. Välj ett annat.
            </p>
          )}

          {fields.map((f) => (
            <div key={f.id} className="mt-4">
              <p className="text-xs font-semibold" style={{ color: colors.plum }}>
                {f.label}
                {f.required ? " *" : ""}
              </p>
              {(f.type === "single" || f.type === "multi") && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {f.options.map((o) => {
                    const active = f.type === "single" ? answers[f.id] === o.label : (answers[f.id] || []).includes(o.label);
                    return (
                      <ChoiceChip key={o.label} active={active} onClick={() => (f.type === "single" ? setAnswer(f.id, active ? "" : o.label) : toggleMulti(f.id, o.label))}>
                        {o.label}
                        {o.price ? ` · ${f.type === "multi" ? "+" : ""}${formatKr(o.price)}` : ""}
                      </ChoiceChip>
                    );
                  })}
                </div>
              )}
              {f.type === "short" && (
                <input value={answers[f.id] || ""} onChange={(e) => setAnswer(f.id, e.target.value)} maxLength={200} aria-label={f.label} className="mt-1.5 w-full rounded-xl px-3 py-2 text-sm" style={fieldStyle} />
              )}
              {f.type === "long" && (
                <textarea value={answers[f.id] || ""} onChange={(e) => setAnswer(f.id, e.target.value)} rows={3} maxLength={1000} aria-label={f.label} className="mt-1.5 w-full rounded-xl px-3 py-2 text-sm" style={fieldStyle} />
              )}
              {f.type === "number" && (
                <input type="number" min={0} value={answers[f.id] ?? ""} onChange={(e) => setAnswer(f.id, e.target.value)} aria-label={f.label} className="mt-1.5 w-32 rounded-xl px-3 py-2 text-sm" style={fieldStyle} />
              )}
            </div>
          ))}

          {estimate > 0 && (
            <div className="mt-5 flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: colors.lilacSoft }}>
              <span className="text-sm font-semibold" style={{ color: colors.plum }}>
                Riktpris
              </span>
              <span style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>{formatKr(estimate)}</span>
            </div>
          )}
          {estimate > 0 && (
            <p className="mt-1 text-xs" style={{ color: colors.plumSoft }}>
              Slutpriset bestäms av leverantören när ni pratat klart.
            </p>
          )}
          {error && (
            <p className="mt-3 text-xs leading-relaxed" style={{ color: colors.coralDeep }}>
              {error}
            </p>
          )}
        </div>

        <div className="px-6 pb-5 pt-2">
          <button
            onClick={submit}
            disabled={!canSend}
            className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold"
            style={{ backgroundColor: colors.coral, color: colors.white, opacity: canSend ? 1 : 0.5 }}
          >
            <ClipboardList size={16} /> {sending ? "Skickar..." : "Skicka förfrågan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Vendor side (profile editor): this category's questions and add-ons, with prices on the choices.
function RequestFormEditor({ categoryId, form, hasPrice, onChange }) {
  const [newType, setNewType] = useState("short");
  const fieldStyle = { border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white };
  const fields = form?.fields || [];
  const direct = hasPrice ? form?.direct !== false : false;
  const emit = (next) => onChange({ ...(form || {}), ...next });
  const setField = (i, patch) => emit({ fields: fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    emit({ fields: next });
  };
  const addField = () => {
    if (fields.length >= 25) return;
    const base = { id: newFieldId(), label: "", type: newType };
    emit({ fields: [...fields, newType === "single" || newType === "multi" ? { ...base, options: [{ label: "" }] } : base] });
  };
  const useTemplate = () =>
    emit({
      fields: (REQUEST_TEMPLATES[categoryId] || DEFAULT_REQUEST_FIELDS).map((f) => ({ ...f, options: f.options ? f.options.map((o) => ({ ...o })) : undefined })),
      ...(categoryId === "tarta" ? { direct: false } : {}),
    });
  const setOption = (i, k, patch) => setField(i, { options: fields[i].options.map((o, j) => (j === k ? { ...o, ...patch } : o)) });

  return (
    <section className="mb-6 rounded-3xl p-6" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
      <h2 className="mb-1" style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>
        Förfrågningsformulär: {catMap[categoryId]?.label}
      </h2>
      <p className="mb-4 text-sm" style={{ color: colors.plumSoft }}>
        Det här är frågorna kunder svarar på när de skickar en förfrågan till er. Lägg gärna till tillägg med pris, så får kunden ett riktpris och er offert fylls i automatiskt.
      </p>

      <div className="mb-4 rounded-2xl p-4 text-sm" style={{ backgroundColor: colors.cream, color: colors.plum }}>
        {hasPrice ? (
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={direct} onChange={(e) => emit({ direct: e.target.checked })} className="mt-1" />
            <span>
              Kunder får också <strong>boka direkt</strong> till era fasta priser, utan att skicka förfrågan först. Avmarkera om varje uppdrag kräver att ni pratar först.
            </span>
          </label>
        ) : (
          <span>Ni har inga fasta priser inlagda för den här kategorin, så kunder skickar alltid en förfrågan först.</span>
        )}
      </div>

      {fields.length === 0 && (
        <div className="mb-4 rounded-2xl p-4 text-sm" style={{ backgroundColor: colors.lilacSoft, color: colors.plum }}>
          <p>
            Just nu ser kunder bara en fråga: <strong>"Berätta vad du behöver"</strong>. Starta från en mall för att få frågor som passar er bransch.
          </p>
          <button onClick={useTemplate} className="mt-3 rounded-full px-4 py-2 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
            Starta från mall
          </button>
        </div>
      )}

      <div className="space-y-3">
        {fields.map((f, i) => (
          <div key={f.id} className="rounded-2xl p-4" style={{ border: `1.5px solid ${colors.beige}` }}>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={f.label}
                onChange={(e) => setField(i, { label: e.target.value })}
                placeholder="Fråga, till exempel: Storlek"
                maxLength={80}
                aria-label="Fråga"
                className="min-w-[140px] flex-1 rounded-xl px-3 py-2 text-sm"
                style={fieldStyle}
              />
              <select
                value={f.type}
                onChange={(e) => {
                  const t = e.target.value;
                  const choice = t === "single" || t === "multi";
                  setField(i, { type: t, options: choice ? (f.options?.length ? f.options : [{ label: "" }]) : undefined });
                }}
                aria-label="Typ"
                className="rounded-xl px-2 py-2 text-sm"
                style={fieldStyle}
              >
                {FIELD_TYPES.map(([t, l]) => (
                  <option key={t} value={t}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs" style={{ color: colors.plumSoft }}>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={!!f.required} onChange={(e) => setField(i, { required: e.target.checked })} /> Obligatorisk
              </label>
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Flytta upp" className="underline disabled:opacity-30">
                ↑ Flytta upp
              </button>
              <button onClick={() => move(i, 1)} disabled={i === fields.length - 1} aria-label="Flytta ner" className="underline disabled:opacity-30">
                ↓ Flytta ner
              </button>
              <button onClick={() => emit({ fields: fields.filter((_, j) => j !== i) })} aria-label="Ta bort fråga" className="font-medium underline" style={{ color: colors.coralDeep }}>
                Ta bort
              </button>
            </div>
            {(f.type === "single" || f.type === "multi") && (
              <div className="mt-3 space-y-2">
                {(f.options || []).map((o, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <input
                      value={o.label}
                      onChange={(e) => setOption(i, k, { label: e.target.value })}
                      placeholder="Val"
                      maxLength={60}
                      aria-label="Val"
                      className="min-w-0 flex-1 rounded-xl px-3 py-1.5 text-sm"
                      style={fieldStyle}
                    />
                    <input
                      type="number"
                      min={0}
                      value={o.price ?? ""}
                      onChange={(e) => setOption(i, k, { price: e.target.value === "" ? undefined : e.target.value })}
                      placeholder="+ kr"
                      aria-label="Pris i kronor"
                      className="w-24 rounded-xl px-3 py-1.5 text-sm"
                      style={fieldStyle}
                    />
                    <button onClick={() => setField(i, { options: f.options.filter((_, j) => j !== k) })} aria-label="Ta bort val" className="p-1">
                      <X size={14} color={colors.plumSoft} />
                    </button>
                  </div>
                ))}
                <button onClick={() => setField(i, { options: [...(f.options || []), { label: "" }] })} className="text-xs font-medium underline" style={{ color: colors.lilacDeep }}>
                  + Lägg till val
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select value={newType} onChange={(e) => setNewType(e.target.value)} aria-label="Typ av ny fråga" className="rounded-xl px-2 py-2 text-sm" style={fieldStyle}>
          {FIELD_TYPES.map(([t, l]) => (
            <option key={t} value={t}>
              {l}
            </option>
          ))}
        </select>
        <button onClick={addField} className="rounded-full px-4 py-2 text-sm font-semibold" style={{ border: `1.5px solid ${colors.lilac}`, color: colors.lilacDeep, backgroundColor: colors.white }}>
          Lägg till fråga
        </button>
        {fields.length > 0 && (
          <button onClick={useTemplate} className="text-xs font-medium underline" style={{ color: colors.plumSoft }}>
            Börja om från mall
          </button>
        )}
      </div>
    </section>
  );
}

function ChatBubble({ count, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={count > 0 ? `Meddelanden, ${count} nya` : "Meddelanden"}
      className="fixed z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg"
      style={{
        right: 20,
        bottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
        backgroundColor: colors.coral,
        color: colors.white,
        animation: count > 0 ? "planifest-ring 2.4s ease-out infinite" : "none",
      }}
    >
      <span key={count} style={{ display: "flex", animation: count > 0 ? "planifest-wiggle 0.8s ease-in-out" : "none" }}>
        <MessageCircle size={24} />
      </span>
      {count > 0 && (
        <span
          className="absolute -right-1 -top-1 flex h-6 min-w-[24px] items-center justify-center rounded-full px-1.5 text-xs font-bold"
          style={{ backgroundColor: BADGE_RED, color: colors.white, border: `2px solid ${colors.cream}` }}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

function MessagesPanel({ open, conversations, soundOn, onToggleSound, onOpen, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed z-40 flex flex-col overflow-hidden rounded-3xl shadow-xl"
      style={{
        right: 20,
        bottom: "calc(90px + env(safe-area-inset-bottom, 0px))",
        width: "min(92vw, 360px)",
        maxHeight: "60vh",
        backgroundColor: colors.cream,
        border: `1.5px solid ${colors.lilac}`,
      }}
    >
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1.5px solid ${colors.lilacSoft}` }}>
        <p style={{ fontFamily: serif, fontSize: 18, color: colors.plum }}>Meddelanden</p>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleSound}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
            style={{ color: colors.plumSoft }}
            aria-label={soundOn ? "Stäng av ljud" : "Slå på ljud"}
          >
            {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {soundOn ? "Ljud på" : "Ljud av"}
          </button>
          <button onClick={onClose} className="-mr-1 p-1.5" aria-label="Stäng meddelanden">
            <X size={16} color={colors.plumSoft} />
          </button>
        </div>
      </div>
      <div className="overflow-y-auto">
        {conversations.length === 0 && (
          <p className="px-5 py-8 text-center text-sm" style={{ color: colors.plumSoft }}>
            Inga meddelanden än. Öppna en leverantör och klicka på <strong>Fråga leverantören</strong>.
          </p>
        )}
        {conversations.map((c) => {
          const Icon = catMap[c.category_id]?.icon;
          const preview = c.last_type === "quote" ? "Offert" : c.last_type === "brief" ? "Förfrågan" : c.last_text || "Inga meddelanden än";
          return (
            <button
              key={c.conversation_id}
              onClick={() => onOpen(c)}
              className="flex w-full items-center gap-3 px-5 py-3 text-left"
              style={{ borderBottom: `1px solid ${colors.beige}`, backgroundColor: c.unread > 0 ? colors.white : "transparent" }}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: colors.lilacSoft }}>
                {Icon && <Icon size={16} color={colors.lilacDeep} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold" style={{ color: colors.plum }}>
                    {c.other_name}
                  </p>
                  <span className="flex-shrink-0 text-xs" style={{ color: colors.plumSoft }}>
                    {timeLabel(c.last_at)}
                  </span>
                </div>
                <p className="truncate text-xs" style={{ color: c.unread > 0 ? colors.plum : colors.plumSoft, fontWeight: c.unread > 0 ? 600 : 400 }}>
                  {c.last_sender === c.i_am ? "Du: " : ""}
                  {preview}
                </p>
              </div>
              {c.unread > 0 && (
                <span
                  className="flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold"
                  style={{ backgroundColor: BADGE_RED, color: colors.white }}
                >
                  {c.unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VendorBookingsView({ vendor, bookingItems, onRespond, onAddBlockedTime, onRemoveBlockedTime, onShowToast, onFetchGuestContact }) {
  const [blockDate, setBlockDate] = useState("");
  const [blockStart, setBlockStart] = useState("09:00");
  const [blockEnd, setBlockEnd] = useState("17:00");
  const [blockNote, setBlockNote] = useState("");
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonthIdx, setCalMonthIdx] = useState(today.getMonth());
  if (!vendor) return null;

  const pending = bookingItems.filter((i) => i.status === "pending");
  const completed = bookingItems.filter((i) => i.status === "completed");
  const declined = bookingItems.filter((i) => i.status === "declined");

  const upcomingEntries = [
    ...bookingItems
      .filter((i) => i.status === "confirmed")
      .map((i) => ({ type: "booking", date: i.date, startTime: i.startTime, endTime: i.endTime, item: i })),
    ...(vendor.blockedTimes || []).map((bt, index) => ({ type: "blocked", date: bt.date, startTime: bt.startTime, endTime: bt.endTime, note: bt.note, index })),
  ].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));

  const submitBlock = () => {
    if (!blockDate) return;
    onAddBlockedTime({ date: blockDate, startTime: blockStart, endTime: blockEnd, note: blockNote.trim() });
    setBlockDate("");
    setBlockNote("");
  };

  const prevMonth = () => {
    if (calMonthIdx === 0) {
      setCalYear((y) => y - 1);
      setCalMonthIdx(11);
    } else {
      setCalMonthIdx((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (calMonthIdx === 11) {
      setCalYear((y) => y + 1);
      setCalMonthIdx(0);
    } else {
      setCalMonthIdx((m) => m + 1);
    }
  };
  const getDayStatus = (ds) => {
    if (ds < todayStr()) return "past";
    if ((vendor.blockedTimes || []).some((bt) => bt.date === ds)) return "closed";
    if (bookingItems.some((i) => i.date === ds && i.status === "confirmed")) return "booked";
    return "open";
  };
  const toggleDay = (ds, status) => {
    if (status === "booked") {
      onShowToast?.("Det finns redan en bokning den dagen.");
      return;
    }
    if (status === "closed") {
      const idx = (vendor.blockedTimes || []).findIndex((bt) => bt.date === ds);
      if (idx >= 0) onRemoveBlockedTime(idx);
    } else {
      onAddBlockedTime({ date: ds, startTime: "00:00", endTime: "23:59", note: "Stängd av leverantören" });
    }
  };

  const fieldStyle = { border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white };

  return (
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-10 sm:px-10">
      <h1 style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>Bokningar & kalender</h1>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          { label: "Nya förfrågningar", value: pending.length },
          { label: "Kommande", value: bookingItems.filter((i) => i.status === "confirmed").length },
          { label: "Genomförda", value: completed.length },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4 text-center" style={{ backgroundColor: colors.lilacSoft }}>
            <p style={{ fontFamily: serif, fontSize: 22, color: colors.plum }}>{s.value}</p>
            <p className="text-xs" style={{ color: colors.lilacDeep }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-6 rounded-3xl p-5" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
        <h2 className="mb-1 font-semibold" style={{ color: colors.plum }}>
          Din kalender
        </h2>
        <p className="mb-3 text-xs" style={{ color: colors.plumSoft }}>
          Klicka på en dag för att stänga eller öppna den. Dagar med en bekräftad bokning går inte att stänga härifrån.
        </p>
        <MonthCalendar year={calYear} month={calMonthIdx} onPrevMonth={prevMonth} onNextMonth={nextMonth} getDayStatus={getDayStatus} onDayClick={toggleDay} interactive />
        <CalendarLegend />
      </section>

      <section className="mt-6 rounded-3xl p-5" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
        <h2 className="mb-3 font-semibold" style={{ color: colors.plum }}>
          Inkommande förfrågningar
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm" style={{ color: colors.plumSoft }}>
            Inga nya förfrågningar just nu.
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map((i) => {
              const occasionInfo = i.occasion ? occasionMap[i.occasion] : null;
              return (
                <div key={`${i.bookingNumber}-${i.id}`} className="rounded-2xl p-4" style={{ backgroundColor: colors.cream }}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold" style={{ color: colors.plum }}>
                        {occasionInfo ? `${occasionInfo.emoji} ${occasionInfo.boardLabel}` : "Kundens fest"}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-3 text-sm" style={{ color: colors.plumSoft }}>
                        <span className="flex items-center gap-1">
                          <Calendar size={13} /> {i.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={13} /> {i.startTime}–{i.endTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={13} /> {i.guests} gäster
                        </span>
                      </p>
                    </div>
                    <span style={{ fontFamily: serif, fontSize: 17, color: colors.plum }}>{formatKr(i.price)}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => onRespond(i.bookingNumber, i.id, "declined")}
                      className="flex-1 rounded-full px-4 py-2 text-sm font-medium"
                      style={{ border: `1.5px solid ${colors.coral}`, color: colors.coralDeep, backgroundColor: colors.white }}
                    >
                      Neka
                    </button>
                    <button
                      onClick={() => onRespond(i.bookingNumber, i.id, "confirmed")}
                      className="flex-1 rounded-full px-4 py-2 text-sm font-semibold"
                      style={{ backgroundColor: colors.green, color: colors.white }}
                    >
                      Acceptera
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-3xl p-5" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
        <h2 className="mb-3 font-semibold" style={{ color: colors.plum }}>
          Kommande i din kalender
        </h2>
        <p className="mb-3 text-xs" style={{ color: colors.plumSoft }}>
          Bekräftade bokningar och tider du själv blockerat, i datumordning. Flera bokningar samma dag är
          inga problem så länge tiderna inte krockar.
        </p>
        {upcomingEntries.length === 0 ? (
          <p className="text-sm" style={{ color: colors.plumSoft }}>
            Inget inbokat än.
          </p>
        ) : (
          <div className="space-y-2">
            {upcomingEntries.map((e, i) =>
              e.type === "booking" ? (
                <div key={`b-${i}`} className="rounded-xl p-3 text-sm" style={{ backgroundColor: "#E3F3E9" }}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2" style={{ color: colors.plum }}>
                      <Check size={14} color={colors.green} /> {e.date}, {e.startTime}–{e.endTime}
                    </span>
                    <span style={{ color: colors.plumSoft }}>{formatKr(e.item.price)}</span>
                  </div>
                  {e.item.isGuest && onFetchGuestContact && <GuestContact bookingId={e.item.bookingId} fetchContact={onFetchGuestContact} />}
                </div>
              ) : (
                <div key={`x-${i}`} className="flex items-center justify-between rounded-xl p-3 text-sm" style={{ backgroundColor: colors.beige }}>
                  <span className="flex items-center gap-2" style={{ color: colors.plum }}>
                    <Clock size={14} color={colors.plumSoft} /> {e.date}, {e.startTime}–{e.endTime}
                    {e.note ? ` · ${e.note}` : " · Blockerad tid"}
                  </span>
                  <button onClick={() => onRemoveBlockedTime(e.index)} className="rounded-full p-1" style={{ backgroundColor: colors.white }}>
                    <Trash2 size={13} color={colors.coralDeep} />
                  </button>
                </div>
              )
            )}
          </div>
        )}

        <div className="mt-5 border-t pt-4" style={{ borderColor: colors.beige }}>
          <p className="mb-2 text-sm font-medium" style={{ color: colors.plum }}>
            Blockera en tid manuellt
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} className="col-span-2 rounded-lg px-2 py-2 text-sm sm:col-span-1" style={fieldStyle} />
            <input type="time" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} className="rounded-lg px-2 py-2 text-sm" style={fieldStyle} />
            <input type="time" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} className="rounded-lg px-2 py-2 text-sm" style={fieldStyle} />
            <input
              value={blockNote}
              onChange={(e) => setBlockNote(e.target.value)}
              placeholder="Anteckning (valfritt)"
              className="col-span-2 rounded-lg px-2 py-2 text-sm sm:col-span-1"
              style={fieldStyle}
            />
          </div>
          <button
            onClick={submitBlock}
            disabled={!blockDate}
            className="mt-3 flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: colors.coral, color: colors.white, opacity: blockDate ? 1 : 0.5 }}
          >
            <Plus size={14} /> Lägg till
          </button>
        </div>
      </section>

      {(completed.length > 0 || declined.length > 0) && (
        <section className="mt-6 rounded-3xl p-5" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
          <h2 className="mb-3 font-semibold" style={{ color: colors.plum }}>
            Historik
          </h2>
          <div className="space-y-2">
            {[...completed, ...declined].map((i) => {
              const meta = BOOKING_STATUS_META[i.status] || BOOKING_STATUS_META.pending;
              return (
                <div key={`${i.bookingNumber}-${i.id}`} className="flex items-center justify-between text-sm">
                  <span style={{ color: colors.plum }}>
                    {i.date}, {i.startTime}–{i.endTime}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: meta.bg, color: meta.fg }}>
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function AdminDashboardView({ vendorApplications, filter, onFilterChange, onOpenVendor }) {
  const filters = [
    { id: "all", label: "Alla" },
    { id: "pending", label: "Väntar på granskning" },
    { id: "approved", label: "Godkända" },
    { id: "rejected", label: "Avslagna" },
  ];
  const filtered = filter === "all" ? vendorApplications : vendorApplications.filter((v) => v.status === filter);

  return (
    <div className="mx-auto max-w-4xl px-6 pb-24 pt-10 sm:px-10">
      <h1 style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>Admin</h1>
      <p className="mt-1 text-sm" style={{ color: colors.plumSoft }}>
        Leverantörsansökningar
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              border: `1px solid ${filter === f.id ? colors.coral : colors.beige}`,
              backgroundColor: filter === f.id ? colors.coralSoft : colors.white,
              color: filter === f.id ? colors.coralDeep : colors.plumSoft,
            }}
          >
            {f.label}
            {f.id !== "all" && ` (${vendorApplications.filter((v) => v.status === f.id).length})`}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {filtered.map((v) => {
          const status = STATUS_META[v.status] || STATUS_META.pending;
          const categoryLabels = v.categories.map((id) => catMap[id]?.label).filter(Boolean).join(", ");
          const locationName = locationMap[v.baseLocation]?.name || v.baseLocation;
          return (
            <button
              key={v.id}
              onClick={() => onOpenVendor(v.id)}
              className="flex w-full flex-col gap-2 rounded-2xl p-4 text-left sm:flex-row sm:items-center sm:justify-between"
              style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}
            >
              <div>
                <p className="font-semibold" style={{ color: colors.plum }}>
                  {v.companyName}
                </p>
                <p className="text-sm" style={{ color: colors.plumSoft }}>
                  {v.contactPerson} · {categoryLabels || "Inga kategorier"}
                </p>
                <p className="text-xs" style={{ color: colors.plumSoft }}>
                  {locationName} · {v.serviceArea?.value || "Inget område valt"}
                </p>
                {v.createdAt && (
                  <p className="text-xs" style={{ color: colors.plumSoft }}>
                    Ansökte {formatAppliedAt(v.createdAt)}
                  </p>
                )}
              </div>
              <span
                className="flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-medium sm:self-auto"
                style={{ backgroundColor: status.bg, color: status.fg }}
              >
                {status.emoji} {status.label}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm" style={{ color: colors.plumSoft }}>
            Inga ansökningar i den här kategorin.
          </p>
        )}
      </div>
    </div>
  );
}

function AdminVendorDetailView({ vendor, onBack, onApprove, onReject }) {
  if (!vendor) return null;
  const status = STATUS_META[vendor.status] || STATUS_META.pending;
  const categoryLabels = vendor.categories.map((id) => catMap[id]?.label).filter(Boolean);
  const locationName = locationMap[vendor.baseLocation]?.name || vendor.baseLocation;

  return (
    <div className="mx-auto max-w-3xl px-6 pb-32 pt-8 sm:px-10">
      <button onClick={onBack} className="-ml-2 mb-5 flex items-center gap-1 px-2 py-1.5 text-sm font-medium" style={{ color: colors.plumSoft }}>
        <ChevronLeft size={16} /> Tillbaka till listan
      </button>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ fontFamily: serif, fontSize: 26, color: colors.plum }}>{vendor.companyName}</h1>
        <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium" style={{ backgroundColor: status.bg, color: status.fg }}>
          {status.emoji} {status.label}
        </span>
      </div>
      {vendor.createdAt && (
        <p className="-mt-3 mb-5 text-xs" style={{ color: colors.plumSoft }}>
          Ansökte {formatAppliedAt(vendor.createdAt)}
        </p>
      )}

      {vendor.profile.images.length > 0 && (
        <div className="mb-6 flex gap-2 overflow-x-auto">
          {vendor.profile.images.map((url, i) => (
            <img key={i} src={url} className="h-28 w-40 flex-shrink-0 rounded-2xl object-cover" alt="" />
          ))}
        </div>
      )}

      <div className="space-y-5">
        <section className="rounded-3xl p-5" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
          <h2 className="mb-3 font-semibold" style={{ color: colors.plum }}>
            Företagsuppgifter
          </h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2" style={{ color: colors.plumSoft }}>
            <div>
              <dt className="text-xs" style={{ color: colors.plum }}>
                Organisationsnummer
              </dt>
              <dd>{vendor.organizationNumber || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs" style={{ color: colors.plum }}>
                Kontaktperson
              </dt>
              <dd>{vendor.contactPerson || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs" style={{ color: colors.plum }}>
                E-post
              </dt>
              <dd>{vendor.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs" style={{ color: colors.plum }}>
                Telefon
              </dt>
              <dd>{vendor.phone || "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-3xl p-5" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
          <h2 className="mb-3 font-semibold" style={{ color: colors.plum }}>
            Geografi & kategorier
          </h2>
          <p className="flex items-center gap-1 text-sm" style={{ color: colors.plumSoft }}>
            <MapPin size={13} /> {locationName} · {vendor.serviceArea?.value || "Inget område valt"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {categoryLabels.length > 0 ? (
              categoryLabels.map((label) => (
                <span key={label} className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: colors.lilacSoft, color: colors.lilacDeep }}>
                  {label}
                </span>
              ))
            ) : (
              <span className="text-sm" style={{ color: colors.plumSoft }}>
                Inga kategorier valda
              </span>
            )}
          </div>
        </section>

        <section className="rounded-3xl p-5" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
          <h2 className="mb-3 font-semibold" style={{ color: colors.plum }}>
            Profil
          </h2>
          {vendor.profile.tagline && (
            <p className="text-sm italic" style={{ color: colors.plumSoft }}>
              “{vendor.profile.tagline}”
            </p>
          )}
          {vendor.profile.description && (
            <p className="mt-2 text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
              {vendor.profile.description}
            </p>
          )}
          {!vendor.profile.tagline && !vendor.profile.description && (
            <p className="text-sm" style={{ color: colors.plumSoft }}>
              Ingen profiltext ifylld ännu.
            </p>
          )}
        </section>

        {vendor.profile.services.length > 0 && (
          <section className="rounded-3xl p-5" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
            <h2 className="mb-3 font-semibold" style={{ color: colors.plum }}>
              Tjänster & priser
            </h2>
            <div className="space-y-2">
              {vendor.profile.services.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span style={{ color: colors.plum }}>{s.name || "Namnlös tjänst"}</span>
                  <span style={{ color: colors.plumSoft }}>
                    {s.price ? formatKr(Number(s.price)) : "—"}
                    {s.priceType === "per_person" ? "/person" : s.priceType === "per_hour" ? "/timme" : ""}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {vendor.profile.addons.length > 0 && (
          <section className="rounded-3xl p-5" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
            <h2 className="mb-3 font-semibold" style={{ color: colors.plum }}>
              Tillägg
            </h2>
            <div className="flex flex-wrap gap-2">
              {vendor.profile.addons.map((a) => (
                <span key={a.id} className="rounded-full px-3 py-1.5 text-sm" style={{ backgroundColor: colors.lilacSoft, color: colors.lilacDeep }}>
                  {a.name || "Namnlöst"} +{formatKr(Number(a.price) || 0)}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => onReject(vendor.id)}
          className="flex-1 rounded-full px-5 py-3 text-sm font-semibold"
          style={{ border: `1.5px solid ${colors.coral}`, color: colors.coralDeep, backgroundColor: colors.white }}
        >
          Avslå ansökan
        </button>
        <button onClick={() => onApprove(vendor.id)} className="flex-1 rounded-full px-5 py-3 text-sm font-semibold" style={{ backgroundColor: colors.green, color: colors.white }}>
          Godkänn leverantör
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legal pages (Juridiska sidor) — Integritetspolicy, Allmänna villkor och
// Cookiepolicy. Content lives as data so LegalPageView can render all three
// the same way. IMPORTANT: this is a solid starting draft, not legal advice —
// see the [PLACEHOLDER]-marked spots that need Kristina's real details, and
// have a lawyer or a service like Lexly/Avtal24 review before publishing,
// especially the anti-circumvention clause in the terms.
// ---------------------------------------------------------------------------
// Shown as "Senast uppdaterad" at the bottom of each legal page — update this
// one line whenever the texts change. Must stay above the section lists below.
const LEGAL_LAST_UPDATED = "28 september 2026";

const PRIVACY_POLICY_SECTIONS = [
  {
    heading: "1. Vem är personuppgiftsansvarig?",
    paragraphs: [
      "Planifest drivs som enskild firma av Kristina Onus (\"Planifest\", \"vi\" eller \"oss\"). Kristina Onus är personuppgiftsansvarig för den behandling av personuppgifter som beskrivs i denna policy.",
      "Kontaktuppgifter: info@planifest.se, Knivetorpsvägen 1, 433 31 Partille.",
    ],
  },
  {
    heading: "2. Vilka personuppgifter samlar vi in?",
    paragraphs: ["Vilka uppgifter vi samlar in beror på om du använder Planifest som kund eller leverantör:"],
    bullets: [
      "Kund: namn, e-postadress, telefonnummer, uppgifter om ditt event (datum, tid, antal gäster, typ av tillställning) och vilka leverantörer du bokar.",
      "Leverantör: företagsnamn, organisationsnummer, kontaktperson, e-post, telefonnummer, verksamhetsområde, bilder samt beskrivningar av tjänster och priser.",
      "Automatiskt insamlad information via cookies och liknande tekniker — se vår cookiepolicy.",
    ],
  },
  {
    heading: "3. Varför behandlar vi dina uppgifter?",
    paragraphs: ["Vi behandlar dina uppgifter med följande rättsliga grunder:"],
    bullets: [
      "För att fullgöra avtalet mellan dig och Planifest, t.ex. skapa och hantera en bokning eller ett leverantörskonto (rättslig grund: avtal).",
      "För att visa leverantörsprofiler för kunder och förmedla bokningsförfrågningar (rättslig grund: avtal/berättigat intresse).",
      "För att kontakta dig om din bokning eller ansökan (rättslig grund: avtal).",
      "För marknadsföring, om du har samtyckt till det (rättslig grund: samtycke).",
      "För att uppfylla rättsliga skyldigheter, t.ex. enligt bokföringslagen (rättslig grund: rättslig förpliktelse).",
    ],
  },
  {
    heading: "4. Vem delar vi dina uppgifter med?",
    paragraphs: [
      "Leverantörer du väljer att boka får del av de uppgifter som krävs för att genomföra bokningen (namn, kontaktuppgifter, eventdetaljer).",
      "När betalning införs på plattformen kommer nödvändiga uppgifter att delas med vår betaltjänstleverantör.",
      "Vi säljer aldrig dina uppgifter till tredje part för marknadsföringsändamål.",
    ],
  },
  {
    heading: "5. Hur länge sparar vi dina uppgifter?",
    paragraphs: [
      "Vi sparar dina uppgifter så länge det behövs för ändamålen ovan, eller så länge lagen kräver — till exempel kräver bokföringslagen att räkenskapsinformation sparas i sju år. Kontouppgifter raderas eller anonymiseras på begäran, om vi inte är skyldiga att spara dem enligt lag.",
    ],
  },
  {
    heading: "6. Dina rättigheter",
    paragraphs: ["Du har rätt att:"],
    bullets: [
      "Begära ett registerutdrag (rätt till tillgång)",
      "Begära rättelse av felaktiga uppgifter",
      "Begära radering (\"rätten att bli glömd\")",
      "Invända mot viss behandling",
      "Begära dataportabilitet",
      "Klaga till Integritetsskyddsmyndigheten, IMY (imy.se)",
    ],
  },
  {
    heading: "7. Säkerhet",
    paragraphs: ["Vi vidtar rimliga tekniska och organisatoriska åtgärder för att skydda dina uppgifter mot obehörig åtkomst, förlust eller missbruk."],
  },
  {
    heading: "8. Cookies",
    paragraphs: ["Se vår separata cookiepolicy för information om hur vi använder cookies på Planifest."],
  },
  {
    heading: "9. Ändringar av denna policy",
    paragraphs: ["Vi kan komma att uppdatera denna integritetspolicy. Väsentliga ändringar meddelas på webbplatsen."],
  },
  {
    heading: "10. Kontakt",
    paragraphs: ["Har du frågor om hur vi behandlar dina personuppgifter? Kontakta oss på info@planifest.se.", `Senast uppdaterad: ${LEGAL_LAST_UPDATED}`],
  },
];

const TERMS_SECTIONS = [
  {
    heading: "1. Om Planifest",
    paragraphs: [
      "Planifest (\"vi\", \"oss\") är en digital marknadsplats som förmedlar kontakt mellan privatpersoner som planerar events (\"Kund\") och företag som erbjuder eventrelaterade tjänster (\"Leverantör\"). Avtalet om den bokade tjänsten ingås direkt mellan Kund och Leverantör. Planifest är inte part i det avtalet och ansvarar inte för Leverantörens utförande av tjänsten, om inget annat anges.",
    ],
  },
  {
    heading: "2. Konto och registrering",
    paragraphs: ["För att boka eller erbjuda tjänster via Planifest kan du behöva skapa ett konto. Du ansvarar för att de uppgifter du lämnar är korrekta och för att hålla dina inloggningsuppgifter hemliga."],
  },
  {
    heading: "3. Bokningsprocess",
    paragraphs: ["En bokningsförfrågan skickas till vald(a) Leverantör(er), som bekräftar eller avböjer inom 24 timmar. Ett bindande avtal om tjänsten uppstår när Leverantören bekräftat bokningen."],
  },
  {
    heading: "4. Priser och betalning",
    paragraphs: [
      "Priser anges av Leverantören och visas inklusive eventuella tillägg innan bokning bekräftas.",
      "När betalfunktionen är på plats: betalning sker via Planifests betalningslösning och hålls tills tjänsten är genomförd, då den betalas ut till Leverantören med avdrag för Planifests förmedlingsavgift.",
    ],
  },
  {
    heading: "5. Avbokning",
    paragraphs: ["Kund kan avboka enligt Leverantörens angivna avbokningsvillkor. Avbokning senare än 14 dagar innan eventet kan medföra kostnad enligt Leverantörens villkor."],
  },
  {
    heading: "6. Leverantörens ansvar",
    paragraphs: ["Leverantören ansvarar för att informationen om tjänster, priser och tillgänglighet är korrekt, och för att tjänsten utförs med den kvalitet och vid den tidpunkt som avtalats med Kunden."],
    bullets: [
      "För skräddarsydda beställningar (t.ex. tårtdesign, anpassad dekoration) anger Leverantören ett grundpris. Tillägg som chattas fram med Kunden läggs till som en offert som Kunden godkänner innan bokningen bekräftas.",
      "Leverantören bekräftar eller avböjer bokningsförfrågningar inom 24 timmar.",
      "Leverantören ansvarar själv för de tillstånd och licenser som krävs för sin verksamhet.",
      "Kunduppgifter som delas via Planifest får endast användas för att genomföra den aktuella bokningen.",
      "Leverantören ska bemöta kunder professionellt, utan diskriminering eller trakasserier.",
      "Leverantören är ensam ansvarig för den bokade tjänstens genomförande. Planifest är enbart förmedlare och part inte i avtalet mellan Leverantör och Kund.",
      "Leverantören godkänner att betala Planifests förmedlingsavgift (för närvarande cirka 10 %) när betalfunktionen är i drift.",
    ],
  },
  {
    heading: "7. Kundens ansvar",
    paragraphs: ["Kunden ansvarar för att lämnade uppgifter (datum, antal gäster, plats m.m.) är korrekta och för att i tid meddela ändringar som påverkar bokningen."],
  },
  {
    heading: "8. Leverantörens avbokning",
    paragraphs: [
      "Leverantören kan avboka en bekräftad bokning avgiftsfritt fram till 30 dagar innan eventet.",
      "Avbokning senare än så innebär att Kunden inte behöver betala för tjänsten, oavsett om Planifest lyckas hitta en ersättare. Planifest hjälper aktivt till att hitta en ny leverantör i samma prisklass.",
      "En sen avbokning registreras som en varning på Leverantörens konto. Avbokningar som beror på samma händelse eller orsak, inom en kort tidsperiod, räknas som en varning. Planifest avgör vad som räknas som samma orsak.",
      "Upprepade sena avbokningar kan leda till att kontot stängs av från Planifest.",
      "När betalfunktionen är på plats kan en avgift motsvarande förmedlingsavgiften komma att dras från Leverantörens nästa utbetalning vid upprepade sena avbokningar.",
    ],
  },
  {
    heading: "9. Kringgående av plattformen",
    paragraphs: [
      "Kund och Leverantör som kommit i kontakt via Planifest förbinder sig att inte, under pågående bokningsprocess eller inom 12 månader efter första kontakt via plattformen, ingå avtal om samma eller liknande tjänst direkt med varandra i syfte att kringgå Planifests förmedlingsavgift.",
      "Vid brott mot denna bestämmelse har Planifest rätt att fakturera den ansvariga parten ett belopp motsvarande den förmedlingsavgift som skulle ha utgått vid bokning via plattformen, samt att stänga av kontot.",
    ],
  },
  {
    heading: "10. Immateriella rättigheter",
    paragraphs: ["Allt innehåll på Planifest (varumärke, design och texter som tillhör Planifest) ägs av Planifest eller våra licensgivare. Leverantörer behåller rättigheterna till sina egna bilder och texter men ger Planifest rätt att visa dem på plattformen."],
  },
  {
    heading: "11. Ansvarsbegränsning",
    paragraphs: ["Planifest ansvarar inte för Leverantörens utförande av bokade tjänster eller för skador i samband med ett event. Planifests ansvar är i alla händelser begränsat till den förmedlingsavgift som betalats för den aktuella bokningen."],
  },
  {
    heading: "12. Reklamation och tvist",
    paragraphs: ["Klagomål på en utförd tjänst riktas i första hand till Leverantören. Kan tvisten inte lösas kan Kund vända sig till Allmänna reklamationsnämnden (ARN) eller allmän domstol. Svensk lag tillämpas."],
  },
  {
    heading: "13. Ändringar av villkoren",
    paragraphs: ["Vi kan komma att ändra dessa villkor. Väsentliga ändringar meddelas via webbplatsen eller e-post i god tid innan de träder i kraft."],
  },
  {
    heading: "14. Kontakt",
    paragraphs: ["Frågor om dessa villkor? Kontakta oss på info@planifest.se.", `Senast uppdaterad: ${LEGAL_LAST_UPDATED}`],
  },
];

const COOKIE_POLICY_SECTIONS = [
  {
    heading: "1. Vad är cookies?",
    paragraphs: ["Cookies är små textfiler som sparas på din enhet när du besöker en webbplats. De används för att webbplatsen ska fungera, komma ihåg dina val och i vissa fall analysera hur webbplatsen används."],
  },
  {
    heading: "2. Vilka cookies använder vi?",
    paragraphs: ["Just nu använder Planifest endast nödvändiga cookies. Om vi i framtiden lägger till analys- eller marknadsföringscookies uppdaterar vi denna policy och ber om ditt samtycke innan de aktiveras."],
    bullets: [
      "Nödvändiga cookies: krävs för att webbplatsen ska fungera, t.ex. för att komma ihåg din \"Min fest\"-korg under besöket. Kan inte stängas av.",
      "Funktionella cookies: kommer ihåg dina inställningar, t.ex. ditt val i cookie-bannern.",
      "Analyscookies: hjälper oss förstå hur besökare använder webbplatsen. Används endast om du samtycker.",
      "Marknadsföringscookies: används för att visa relevanta annonser. Används endast om du samtycker.",
    ],
  },
  {
    heading: "3. Hur hanterar du dina val?",
    paragraphs: ["När du besöker Planifest första gången ber vi om ditt samtycke via en banner. Du kan när som helst ändra ditt val genom att rensa webbläsarens cookies för planifest.se och ladda om sidan."],
  },
  {
    heading: "4. Tredjepartscookies",
    paragraphs: ["Om vi använder tjänster från tredje part (t.ex. analysverktyg) kan dessa sätta egna cookies. Vi uppdaterar denna policy om sådana tjänster tillkommer."],
  },
  {
    heading: "5. Kontakt",
    paragraphs: ["Frågor om cookies? Kontakta oss på info@planifest.se.", `Senast uppdaterad: ${LEGAL_LAST_UPDATED}`],
  },
];

function LegalPageView({ title, sections, onBack }) {
  return (
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-8 sm:px-10">
      <button onClick={onBack} className="-ml-2 mb-5 flex items-center gap-1 px-2 py-1.5 text-sm font-medium" style={{ color: colors.plumSoft }}>
        <ChevronLeft size={16} /> Tillbaka
      </button>
      <h1 style={{ fontFamily: serif, fontSize: 30, color: colors.plum }}>{title}</h1>
      <p className="mt-2 text-sm" style={{ color: colors.plumSoft }}>
        Det här är ett startutkast — inte juridisk rådgivning. Låt en jurist eller tjänst som Lexly/Avtal24 granska texten innan den publiceras skarpt.
      </p>
      <div className="mt-8 space-y-7">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="mb-2 font-semibold" style={{ color: colors.plum }}>
              {s.heading}
            </h2>
            {s.paragraphs?.map((p, i) => (
              <p key={i} className="mb-2 text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
                {p}
              </p>
            ))}
            {s.bullets && (
              <ul className="ml-5 list-disc space-y-1 text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
                {s.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cookie consent banner — shown until the visitor picks an option, then
// remembered in localStorage (a per-browser convenience, not shared data).
// No analytics are wired up to consent yet since none exist in the prototype;
// this scaffolding is ready for when they're added.
// ---------------------------------------------------------------------------
function CookieConsentBanner({ onAcceptAll, onNecessaryOnly, onOpenPolicy }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl rounded-3xl p-5 shadow-2xl sm:p-6" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
        <p className="text-sm leading-relaxed" style={{ color: colors.plum }}>
          Vi använder cookies för att webbplatsen ska fungera och, om du tillåter det, för att förstå hur den används. Läs mer i vår{" "}
          <button onClick={onOpenPolicy} className="font-semibold underline" style={{ color: colors.lilacDeep }}>
            cookiepolicy
          </button>
          .
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={onNecessaryOnly}
            className="flex-1 rounded-full px-4 py-2.5 text-sm font-medium"
            style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }}
          >
            Endast nödvändiga
          </button>
          <button onClick={onAcceptAll} className="flex-1 rounded-full px-4 py-2.5 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
            Acceptera alla
          </button>
        </div>
      </div>
    </div>
  );
}

function Footer({ onGoHome, onBrowse, onHowItWorks, onBecomeVendor, onOpenTerms, onOpenPrivacy, onOpenCookies, onShowToast }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t px-6 pb-10 pt-12 sm:px-10" style={{ borderColor: colors.beige, backgroundColor: colors.peachSoft }}>
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">
              <LogoBalloons size={28} />
              <Wordmark fontSize={18} letterSpacing="0.08em" />
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
              Planifest föddes ur en enkel idé: att festen förtjänar lika mycket omtanke som planeringen
              bakom den. Istället för att leta leverantörer i tio olika flikar och samtal samlar vi allt
              du behöver – lokal, catering, DJ, dekor, foto och mer – på ett ställe, så att du kan bygga
              hela ditt event i din egen takt. Vi startade i Göteborg med en övertygelse om att bra fester
              börjar med bra idéer, och att rätt verktyg gör hela skillnaden.
            </p>
            <button
              onClick={() => onShowToast("Instagram-länk läggs till snart.")}
              className="mt-4 flex h-8 w-8 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.coralSoft, color: colors.coralDeep }}
              aria-label="Planifest på Instagram"
            >
              <Instagram size={15} />
            </button>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase" style={{ letterSpacing: "0.1em", color: colors.plum }}>
              Utforska
            </h3>
            <ul className="space-y-2 text-sm" style={{ color: colors.plumSoft }}>
              <li>
                <button onClick={onGoHome}>Bygg din fest</button>
              </li>
              <li>
                <button onClick={onBrowse}>Leverantörer</button>
              </li>
              <li>
                <button onClick={onHowItWorks}>Så fungerar det</button>
              </li>
              <li>
                <button onClick={onBecomeVendor}>Bli leverantör</button>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase" style={{ letterSpacing: "0.1em", color: colors.plum }}>
              Planifest
            </h3>
            <ul className="space-y-2 text-sm" style={{ color: colors.plumSoft }}>
              <li>
                <a href="mailto:info@planifest.se">Kontakt</a>
              </li>
              <li>
                <button onClick={onOpenTerms}>Villkor</button>
              </li>
              <li>
                <button onClick={onOpenPrivacy}>Integritetspolicy</button>
              </li>
              <li>
                <button onClick={onOpenCookies}>Cookies</button>
              </li>
            </ul>
          </div>
        </div>

        <div
          className="mt-10 flex flex-col items-center justify-between gap-2 border-t pt-6 text-xs sm:flex-row"
          style={{ borderColor: colors.beige, color: colors.plumSoft }}
        >
          <p>© {year} Planifest. Alla rättigheter förbehållna.</p>
          <p style={{ fontStyle: "italic" }}>För stunder värda att planera.</p>
        </div>
        <p className="mt-3 text-center text-xs sm:text-left" style={{ color: colors.plumSoft }}>
          Planifest, enskild firma · Kristina Onus · Knivetorpsvägen 1, 433 31 Partille · info@planifest.se
        </p>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const emptyParty = () => ({ date: "", startTime: "18:00", endTime: "00:00", guests: 50, categories: [], occasion: null });

const emptyVendorForm = () => ({
  companyName: "",
  organizationNumber: "",
  contactPerson: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  baseLocation: "goteborg",
  serviceArea: null,
  categories: [],
  acceptedTerms: false,
});

export default function App() {
  const [view, setView] = useState("home");
  const [recoverySession, setRecoverySession] = useState(null);
  // A vendor account lives in the vendor portal. Only someone who also wants to plan their own party switches to customer mode (on "Mitt konto").
  const [customerMode, setCustomerMode] = useState(() => {
    try {
      return localStorage.getItem("planifest-mode") === "customer";
    } catch (e) {
      return false;
    }
  });
  const [events, setEvents] = useState([]);
  const [activeEventId, setActiveEventId] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());
  const [bookingEventId, setBookingEventId] = useState(undefined); // undefined = the active planning, "none" = no planning
  const [rsvp, setRsvp] = useState({ loading: false, error: "", data: null, token: "", openToken: "", saved: null });
  const [guestError, setGuestError] = useState("");
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [guestPendingEmail, setGuestPendingEmail] = useState("");
  const [guestBooking, setGuestBooking] = useState({ loading: false, error: "", data: null, justVerified: false, token: "" });
  const [pollTick, setPollTick] = useState(0); // bumps every 20 s while a vendor view is open, to refresh requests and conversations
  useEffect(() => {
    if (!["vendorDashboard", "vendorBookings", "vendorInbox"].includes(view)) return;
    const id = setInterval(() => {
      if (!document.hidden) setPollTick((t) => t + 1);
    }, 20000);
    return () => clearInterval(id);
  }, [view]);

  // Detect the redirect Supabase sends the browser to after a link in one of
  // our auth emails is clicked. Both arrive with tokens in the URL hash;
  // recovery links use them to auto-authenticate for a "set new password"
  // step, while a signup confirmation intentionally does NOT log the person
  // in automatically — we discard those tokens and send them to sign in.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      const params = new URLSearchParams(hash.slice(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const expiresIn = params.get("expires_in");
      if (accessToken) {
        setRecoverySession({ access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn ? Number(expiresIn) : 3600 });
        setView("resetPassword");
      }
      window.history.replaceState(null, "", window.location.pathname);
    } else if (hash && hash.includes("type=signup")) {
      setAuthModalMode("signin");
      setAuthModalOpen(true);
      showToast("Kontot är bekräftat ✓ Logga in för att fortsätta.");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  // A guest's emails link back here: ?gast=verifiera&t=... (confirm the booking) or ?gast=bokning&t=... (follow / cancel it).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kind = params.get("gast");
    const token = params.get("t");
    if (!kind || !token) return;
    window.history.replaceState(null, "", window.location.pathname);
    setGuestBooking({ loading: true, error: "", data: null, justVerified: false, token });
    setView("guestBooking");
    (async () => {
      const { data, error } = await guestRequest({ action: kind === "verifiera" ? "verify" : "get", token });
      setGuestBooking({ loading: false, error: error || "", data: data?.booking || null, justVerified: kind === "verifiera" && !error, token });
    })();
  }, []);
  // A guest's invitation link: ?svara=TOKEN. Their personal link answers for them; the open link adds them to the list.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("svara");
    if (!token) return;
    window.history.replaceState(null, "", window.location.pathname);
    setRsvp({ loading: true, error: "", data: null, token, openToken: token, saved: null });
    setView("rsvp");
    (async () => {
      let use = token;
      try {
        // someone who joined through the open link earlier gets their own answer back
        const stored = window.localStorage.getItem(`planifest-rsvp-${token}`);
        if (stored) use = stored;
      } catch (e) {
        // no storage: fine
      }
      let res = await rpcAnon("rsvp_get", { p_token: use });
      if ((res.error || !res.data) && use !== token) {
        use = token;
        res = await rpcAnon("rsvp_get", { p_token: token });
      }
      if (res.error || !res.data) setRsvp({ loading: false, error: "Länken fungerar inte. Be den som bjudit in dig om en ny.", data: null, token: use, openToken: token, saved: null });
      else setRsvp({ loading: false, error: "", data: res.data, token: use, openToken: token, saved: null });
    })();
  }, []);
  const [party, setParty] = useState(emptyParty);
  const [cartItems, setCartItems] = useState([]); // [{ id, addons: [addonId, ...] }]
  const [activeProviderId, setActiveProviderId] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState("recommended");
  const [distanceFilter, setDistanceFilter] = useState("all"); // "all" | 5 | 10 | 25 | 50 (km)
  const [searchQuery, setSearchQuery] = useState("");
  const [swapContext, setSwapContext] = useState(null); // { oldId, oldName, category }
  const [toast, setToast] = useState("");
  const [vendorStep, setVendorStep] = useState(1);
  const [vendorForm, setVendorForm] = useState(emptyVendorForm);
  const [vendorErrors, setVendorErrors] = useState({});
  const [vendorSubmitError, setVendorSubmitError] = useState("");
  const [vendorSubmitting, setVendorSubmitting] = useState(false);
  const [vendorApplications, setVendorApplications] = useState(SHOW_DEMO_DATA ? SEED_VENDOR_APPLICATIONS : []);
  const [submittedVendorId, setSubmittedVendorId] = useState(null);
  // Declared early (not just where it's conceptually used) because several
  // useEffect hooks below reference it in their dependency array, which is
  // evaluated synchronously during render — unlike an effect's callback body,
  // that reference can't be deferred, so this needs to exist before them.
  const submittedVendor = vendorApplications.find((v) => v.id === submittedVendorId) || null;
  const [activeAdminVendorId, setActiveAdminVendorId] = useState(null);
  const [adminFilter, setAdminFilter] = useState("all");
  const [bookings, setBookings] = useState(SHOW_DEMO_DATA ? SEED_BOOKINGS : []);
  const [lastBooking, setLastBooking] = useState(null);
  const [customerReviews, setCustomerReviews] = useState([]);
  const [reviewTarget, setReviewTarget] = useState(null); // { bookingNumber, item }
  const [chats, setChats] = useState({}); // { [bookingNumber-itemId]: [{ id, sender, text, ts }] }
  const [chatTarget, setChatTarget] = useState(null); // { kind: "booking", bookingNumber, item } | { kind: "provider", provider } | { kind: "real", conversationId, provider }
  const [vendorTyping, setVendorTyping] = useState(false);
  const [realMessages, setRealMessages] = useState({}); // conversationId -> messages[]
  const [vendorConversations, setVendorConversations] = useState([]);
  const [activeVendorConversationId, setActiveVendorConversationId] = useState(null);
  const [acceptedQuotes, setAcceptedQuotes] = useState([]); // synthetic cart-able listings from accepted quotes
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportMessages, setSupportMessages] = useState([]);
  const [cookieConsent, setCookieConsent] = useState(null); // null = undecided, "all" | "necessary"
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // row from public.profiles for the logged-in user

  // --- Message bubble: every conversation I'm in, with unread counts ---
  const [inbox, setInbox] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return localStorage.getItem(SOUND_KEY) !== "off";
    } catch (e) {
      return true;
    }
  });
  const lastUnreadRef = useRef(null); // null until the first answer, so logging in never pings
  const unreadTotal = inbox.reduce((n, c) => n + (c.unread || 0), 0);

  useEffect(() => {
    if (!session?.access_token) {
      setInbox([]);
      lastUnreadRef.current = null;
      return;
    }
    let stop = false;
    let firstLoad = true;
    const load = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const { data } = await supabaseRestRequest("/rpc/my_conversations", session.access_token, { method: "POST", body: "{}" });
      if (stop || !Array.isArray(data)) return;
      if (firstLoad) {
        // Whatever is already unread when the page opens is the starting point, so only messages that arrive afterwards ping.
        lastUnreadRef.current = data.reduce((n, c) => n + (c.unread || 0), 0);
        firstLoad = false;
      }
      setInbox(data);
    };
    load();
    const id = setInterval(load, INBOX_POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [session]);

  // A new unread message: ping (if sound is on). The bubble wiggles on its own via its changing count.
  useEffect(() => {
    if (lastUnreadRef.current !== null && unreadTotal > lastUnreadRef.current && soundOn) playPing();
    lastUnreadRef.current = unreadTotal;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadTotal]);

  // The browser tab shows the count too, e.g. "(2) Planifest".
  useEffect(() => {
    document.title = unreadTotal > 0 ? `(${unreadTotal}) Planifest` : "Planifest";
  }, [unreadTotal]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState("signin"); // "signin" | "signup"
  const howItWorksRef = useRef(null);
  const landOnPortalRef = useRef(false); // set at login / session restore; consumed once the vendor row has loaded
  const toastTimer = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };
  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  // --- Auth (Fas 5) — session now persists in localStorage across reloads,
  // since this runs on real hosting.
  useEffect(() => {
    const stored = loadStoredSession();
    if (!stored) return;
    landOnPortalRef.current = true;
    if (stored._expiresAtMs && stored._expiresAtMs > Date.now() + 60000) {
      setSession(stored);
      return;
    }
    if (stored.refresh_token) {
      supabaseAuthRequest("/token?grant_type=refresh_token", {
        method: "POST",
        body: JSON.stringify({ refresh_token: stored.refresh_token }),
      }).then(({ data, error }) => {
        if (!error && data?.access_token) {
          const enriched = { ...data, _expiresAtMs: Date.now() + (data.expires_in || 3600) * 1000 };
          setSession(enriched);
          storeSession(enriched);
        } else {
          storeSession(null);
        }
      });
    } else {
      storeSession(null);
    }
  }, []);

  const setSessionPersist = (data) => {
    if (data) {
      const enriched = { ...data, _expiresAtMs: Date.now() + (data.expires_in || 3600) * 1000 };
      setSession(enriched);
      storeSession(enriched);
    } else {
      setSession(null);
      storeSession(null);
    }
  };

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    supabaseRestRequest(`/profiles?id=eq.${session.user.id}&select=*`, session.access_token).then(({ data, error }) => {
      if (!error && data && data[0]) setProfile(data[0]);
    });
  }, [session]);

  // Load this visitor's own vendor row, if any, so returning vendors land
  // back on their dashboard instead of the signup flow.
  useEffect(() => {
    if (!session?.user) return;
    fetchVendorByProfileId(session.user.id, session.access_token).then(({ data, error }) => {
      if (error || !data || data.length === 0) {
        landOnPortalRef.current = false;
        return;
      }
      const local = mapDbVendorToLocal(data[0]);
      setVendorApplications((apps) => {
        const idx = apps.findIndex((v) => v.id === local.id);
        if (idx >= 0) {
          const next = [...apps];
          next[idx] = local;
          return next;
        }
        return [...apps, local];
      });
      setSubmittedVendorId(local.id);
      if (landOnPortalRef.current) {
        landOnPortalRef.current = false;
        if (!customerMode) setView((v) => (v === "home" ? "vendorDashboard" : v)); // only from the front page, never mid-checkout
      }
    });
  }, [session]);

  // Approved vendors are publicly readable — load them for anyone browsing,
  // logged in or not, and merge them in alongside the seed/demo listings.
  useEffect(() => {
    fetchApprovedVendors(session?.access_token).then(({ data, error }) => {
      if (error || !data) return;
      const localList = data.map(mapDbVendorToLocal);
      setVendorApplications((apps) => {
        const next = [...apps];
        localList.forEach((l) => {
          const idx = next.findIndex((v) => v.id === l.id);
          if (idx >= 0) next[idx] = l;
          else next.push(l);
        });
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Admins additionally need to see pending/rejected applications, not just approved ones.
  useEffect(() => {
    if (profile?.role !== "admin" || !session?.access_token) return;
    fetchAllVendorsForAdmin(session.access_token).then(({ data, error }) => {
      if (error || !data) return;
      const localList = data.map(mapDbVendorToLocal);
      setVendorApplications((apps) => {
        const next = [...apps];
        localList.forEach((l) => {
          const idx = next.findIndex((v) => v.id === l.id);
          if (idx >= 0) next[idx] = l;
          else next.push(l);
        });
        return next;
      });
    });
  }, [profile, session]);

  // A logged-in customer's own real bookings (Fas 7).
  useEffect(() => {
    if (!session?.user) return;
    supabaseRestRequest(`/bookings?customer_id=eq.${session.user.id}&select=*,booking_items(*)&order=created_at.desc`, session.access_token).then(
      ({ data, error }) => {
        if (error || !data) return;
        const real = data.map((b) => ({
          eventId: b.event_id || null,
          bookingNumber: b.booking_number,
          date: b.date,
          startTime: b.start_time,
          endTime: b.end_time,
          guests: b.guests,
          occasion: b.occasion,
          cancelled: b.cancelled,
          completed: !!b.completed || (!!b.date && b.date < todayISO() && !b.cancelled),
          items: (b.booking_items || []).map((i) => ({
            id: i.id,
            providerId: i.vendor_id ? `${i.vendor_id}-${i.category_id}` : i.id,
            vendorId: i.vendor_id,
            name: i.name,
            category: i.category_id,
            price: i.price,
            status: i.status,
            reviewed: i.reviewed,
          })),
        }));
        setBookings((bs) => {
          const next = [...bs];
          real.forEach((r) => {
            const idx = next.findIndex((b) => b.bookingNumber === r.bookingNumber);
            if (idx >= 0) next[idx] = r;
            else next.push(r);
          });
          return next;
        });
      }
    );
  }, [session]);

  // A vendor's own incoming booking requests (Fas 7) — folded into the same
  // `bookings` array so the existing getVendorBookingItems() keeps working.
  useEffect(() => {
    const vendorId = submittedVendor?.id;
    if (!vendorId || vendorId.startsWith("VND-") || !session?.access_token) return;
    if (!["vendorDashboard", "vendorBookings"].includes(view)) return;
    supabaseRestRequest(
      `/booking_items?vendor_id=eq.${vendorId}&select=*,bookings(id,booking_number,date,start_time,end_time,guests,occasion,cancelled,customer_id)`,
      session.access_token
    ).then(({ data, error }) => {
      if (error || !data) return;
      setBookings((bs) => {
        const next = [...bs];
        data.forEach((item) => {
          const b = item.bookings;
          if (!b) return;
          const localItem = {
            id: item.id,
            providerId: `${item.vendor_id}-${item.category_id}`,
            vendorId: item.vendor_id,
            name: item.name,
            category: item.category_id,
            price: item.price,
            status: item.status,
            reviewed: item.reviewed,
          };
          const idx = next.findIndex((m) => m.bookingNumber === b.booking_number);
          if (idx >= 0) {
            const itemIdx = next[idx].items.findIndex((i) => i.id === item.id);
            const newItems = [...next[idx].items];
            if (itemIdx >= 0) newItems[itemIdx] = localItem;
            else newItems.push(localItem);
            next[idx] = { ...next[idx], items: newItems, cancelled: b.cancelled, bookingId: b.id, isGuest: !b.customer_id };
          } else {
            next.push({
              bookingId: b.id,
              isGuest: !b.customer_id,
              bookingNumber: b.booking_number,
              date: b.date,
              startTime: b.start_time,
              endTime: b.end_time,
              guests: b.guests,
              occasion: b.occasion,
              cancelled: b.cancelled,
              completed: false,
              items: [localItem],
            });
          }
        });
        return next;
      });
    });
  }, [submittedVendor?.id, session, view, pollTick]);

  // The customer's saved events (with checklist and budget) and saved vendors.
  useEffect(() => {
    if (!session?.user) return;
    let stop = false;
    (async () => {
      const [ev, fav] = await Promise.all([
        supabaseRestRequest("/events?select=*,event_tasks(*),event_budget_items(*),event_guests(*)&order=created_at.asc", session.access_token),
        supabaseRestRequest("/favorites?select=vendor_id", session.access_token),
      ]);
      if (stop) return;
      if (Array.isArray(ev.data)) {
        const list = ev.data.map(normalizeEvent);
        setEvents(list);
        setActiveEventId((id) => (list.some((e) => e.id === id) ? id : list[0]?.id || null));
      }
      if (Array.isArray(fav.data)) setFavoriteIds(new Set(fav.data.map((f) => f.vendor_id)));
    })();
    return () => {
      stop = true;
    };
  }, [session]);

  // Accepted quotes that haven't become a booking yet are rebuilt into the cart, so
  // accepting a quote and then closing the tab never loses it.
  useEffect(() => {
    if (!session?.user) return;
    let stop = false;
    (async () => {
      const [q, b] = await Promise.all([
        supabaseRestRequest(
          `/messages?message_type=eq.quote&quote_status=eq.accepted&select=id,quote_amount,quote_description,conversations!inner(vendor_id,category_id,customer_id,vendors(company_name))&conversations.customer_id=eq.${session.user.id}`,
          session.access_token
        ),
        supabaseRestRequest(`/bookings?customer_id=eq.${session.user.id}&cancelled=eq.false&select=booking_items(quote_message_id)`, session.access_token),
      ]);
      if (stop || q.error || !q.data) return;
      const used = new Set((b.data || []).flatMap((x) => (x.booking_items || []).map((i) => i.quote_message_id)).filter(Boolean));
      const open = q.data.filter((m) => !used.has(m.id) && m.conversations);
      if (open.length === 0) return;
      const synth = open.map((m) => ({
        id: `quote-${m.id}`,
        messageId: m.id,
        vendorDbId: m.conversations.vendor_id,
        category: m.conversations.category_id,
        name: m.conversations.vendors?.company_name || "Leverantör",
        amount: Number(m.quote_amount),
        description: m.quote_description,
      }));
      setAcceptedQuotes((prev) => [...prev, ...synth.filter((x) => !prev.some((p) => p.id === x.id))]);
      setCartItems((c) => [...c, ...synth.filter((x) => !c.some((i) => i.id === x.id)).map((x) => ({ id: x.id, addons: [] }))]);
    })();
    return () => {
      stop = true;
    };
  }, [session]);

  // Real reviews, publicly readable — merged in the same shape applyCustomerReviews() already expects.
  useEffect(() => {
    supabaseRestRequest(`/reviews?select=*,booking_items(category_id)`, session?.access_token).then(({ data, error }) => {
      if (error || !data) return;
      const mapped = data.map((r) => ({
        id: r.id,
        providerId: r.booking_items ? `${r.vendor_id}-${r.booking_items.category_id}` : null,
        name: "Kund",
        stars: r.stars,
        text: r.text || "",
      }));
      setCustomerReviews((existing) => {
        const ids = new Set(existing.map((e) => e.id));
        const fresh = mapped.filter((m) => m.providerId && !ids.has(m.id));
        return [...existing, ...fresh];
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAuthModal = (mode) => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
    setMobileMenuOpen(false);
  };

  const requestPasswordReset = async (email) => {
    await supabaseAuthRequest("/recover", { method: "POST", body: JSON.stringify({ email }) });
    // Always resolve quietly either way — never reveal whether an email is registered.
  };

  const submitNewPassword = async (newPassword) => {
    if (!recoverySession?.access_token) return { message: "Länken har gått ut. Begär en ny återställningslänk." };
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${recoverySession.access_token}` },
      body: JSON.stringify({ password: newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { message: data.error_description || data.msg || data.error || "Något gick fel." };
    setSessionPersist({ ...recoverySession, user: data });
    setRecoverySession(null);
    showToast("Lösenordet är uppdaterat ✓");
    setView("home");
    return null;
  };

  const goMyAccount = () => {
    setView("myAccount");
    setMobileMenuOpen(false);
  };

  const saveMyProfile = async ({ fullName, phone }) => {
    if (!session?.access_token) return { message: "Du är inte inloggad." };
    const { error } = await supabaseRestRequest(`/profiles?id=eq.${session.user.id}`, session.access_token, {
      method: "PATCH",
      body: JSON.stringify({ full_name: fullName, phone }),
    });
    if (error) return error;
    setProfile((p) => ({ ...p, full_name: fullName, phone }));
    showToast("Sparat ✓");
    return null;
  };

  const changeMyPassword = async (newPassword) => {
    if (!session?.access_token) return { message: "Du är inte inloggad." };
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ password: newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { message: data.error_description || data.msg || data.error || "Något gick fel." };
    return null;
  };

  // Wipes locally-held data before a different account's session takes over,
  // so nothing left in memory from a previous user in the same tab can ever
  // bleed into the next login — cart, party details, and anything fetched
  // for the previous account.
  const clearLocalUserState = () => {
    setCartItems([]);
    setBookings([]);
    setLastBooking(null);
    setParty(emptyParty());
    setVendorApplications((apps) => apps.filter((v) => v.status === "approved"));
    setSubmittedVendorId(null);
    setVendorConversations([]);
    setActiveVendorConversationId(null);
    setAcceptedQuotes([]);
    setEvents([]);
    setActiveEventId(null);
    setFavoriteIds(new Set());
    setBookingEventId(undefined);
  };

  const signIn = async (email, password) => {
    // A visitor who is simply logging in keeps their cart and search choices (checkout asks them to log in
    // at the last step). Local data is only wiped when an account that was already signed in is replaced.
    if (session?.user) clearLocalUserState();
    const { data, error } = await supabaseAuthRequest("/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (error) return error;
    landOnPortalRef.current = true;
    setSessionPersist(data);
    showToast("Inloggad ✓");
    return null;
  };

  const signUpCustomer = async (email, password, fullName) => {
    if (session?.user) clearLocalUserState();
    const { data, error } = await supabaseAuthRequest("/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, data: { full_name: fullName } }),
    });
    if (error) return error;
    if (data.access_token) {
      setSessionPersist(data); // in case email confirmation is ever turned off
      return null;
    }
    const created = data.user || data;
    if (Array.isArray(created?.identities) && created.identities.length === 0) {
      return { message: "Det finns redan ett konto med den e-postadressen. Logga in istället." };
    }
    return null;
  };

  const signOut = async () => {
    if (session?.access_token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});
    }
    setSessionPersist(null);
    clearLocalUserState();
    setCustomerMode(false);
    try {
      localStorage.removeItem("planifest-mode");
    } catch (e) {
      // fine
    }
    showToast("Utloggad");
    goHome();
  };

  // Remember the visitor's cookie choice across visits (per-browser, not shared).
  useEffect(() => {
    try {
      const stored = localStorage.getItem("planifest-cookie-consent");
      if (stored === "all" || stored === "necessary") setCookieConsent(stored);
    } catch (e) {
      // localStorage unavailable (e.g. private browsing) — banner just won't remember; not fatal.
    }
  }, []);
  const setConsent = (value) => {
    setCookieConsent(value);
    try {
      localStorage.setItem("planifest-cookie-consent", value);
    } catch (e) {
      // ignore — nothing to persist, the choice still applies for this visit
    }
  };

  // --- Legal pages ---
  const goPrivacyPolicy = () => {
    setView("privacyPolicy");
    setMobileMenuOpen(false);
  };
  const goTerms = () => {
    setView("terms");
    setMobileMenuOpen(false);
  };
  const goCookiePolicy = () => {
    setView("cookiePolicy");
    setMobileMenuOpen(false);
  };

  const customerProviders = useMemo(() => {
    const base = getCustomerVisibleProviders(vendorApplications, customerReviews, bookings);
    const quoteListings = acceptedQuotes.map((q) => ({
      id: q.id,
      category: q.category,
      name: q.name,
      tagline: "Anpassad offert",
      rating: null,
      reviews: 0,
      location: "",
      distanceKm: null,
      pricing: { type: "fixed", amount: q.amount, note: q.description || "Offert" },
      seed: q.id,
      vendorDbId: q.vendorDbId,
      quoteMessageId: q.messageId,
      image: null,
      images: [],
      available: true,
      closedDates: [],
      bookedDates: [],
      blurb: q.description || "",
      service: q.description || "",
      reviewsList: [],
      addons: [],
    }));
    return [...base, ...quoteListings];
  }, [vendorApplications, customerReviews, bookings, acceptedQuotes]);
  const vendorBookingItems = useMemo(() => getVendorBookingItems(submittedVendor, bookings), [submittedVendor, bookings]);

  const cart = cartItems
    .map((ci) => {
      const provider = customerProviders.find((p) => p.id === ci.id);
      return provider ? { ...provider, chosenAddons: ci.addons } : null;
    })
    .filter(Boolean);
  const total = cart.reduce((sum, p) => sum + getLineTotal(p, p.chosenAddons, party), 0);
  const cartProviderIds = cartItems.map((ci) => ci.id);

  const sortWithinCategory = (list) => {
    const sorted = [...list];
    sorted.sort((a, b) => {
      const availDiff = Number(b.available) - Number(a.available); // available always first
      if (availDiff !== 0) return availDiff;
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "reviews") return b.reviews - a.reviews;
      if (sortBy === "price") return getBaseAmount(a, party) - getBaseAmount(b, party);
      if (sortBy === "distance") return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
      return 0; // "recommended" keeps catalog order within the availability group
    });
    return sorted;
  };
  const withinDistance = (p) => distanceFilter === "all" || (p.distanceKm ?? Infinity) <= distanceFilter;

  const groupedProviders = useMemo(() => {
    const activeCategoryIds =
      party.categories.length > 0 ? CATEGORIES.filter((c) => party.categories.includes(c.id)).map((c) => c.id) : CATEGORIES.map((c) => c.id);
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = (p) => !q || p.name.toLowerCase().includes(q);

    return activeCategoryIds
      .map((catId) => ({
        category: catMap[catId],
        providers: sortWithinCategory(customerProviders.filter((p) => p.category === catId && withinDistance(p) && matchesSearch(p))),
      }))
      .filter((g) => g.providers.length > 0);
  }, [party, sortBy, customerProviders, distanceFilter, searchQuery]);

  const swapProviders = useMemo(() => {
    if (!swapContext) return [];
    return sortWithinCategory(customerProviders.filter((p) => p.category === swapContext.category && p.id !== swapContext.oldId && withinDistance(p)));
  }, [swapContext, sortBy, party, customerProviders, distanceFilter]);

  const addToCart = (id, addonIds = []) => {
    if (swapContext) {
      setCartItems((c) => c.filter((x) => x.id !== swapContext.oldId).concat({ id, addons: addonIds }));
      setSwapContext(null);
      setView("results");
      setCartOpen(true);
      showToast("Leverantör utbytt ✓");
      return;
    }
    setCartItems((c) => (c.some((x) => x.id === id) ? c : [...c, { id, addons: addonIds }]));
  };
  const removeFromCart = (id) => setCartItems((c) => c.filter((x) => x.id !== id));
  const toggleAddon = (providerId, addonId) => {
    setCartItems((c) =>
      c.map((ci) =>
        ci.id === providerId
          ? { ...ci, addons: ci.addons.includes(addonId) ? ci.addons.filter((a) => a !== addonId) : [...ci.addons, addonId] }
          : ci
      )
    );
  };

  const goHome = () => {
    setView("home");
    setSwapContext(null);
    setMobileMenuOpen(false);
  };

  const startBuilder = () => {
    setView("results");
    setSwapContext(null);
  };

  const viewProfile = (id) => {
    setActiveProviderId(id);
    setView("profile");
  };

  const openSwap = (provider) => {
    setSwapContext({ oldId: provider.id, oldName: provider.name, category: provider.category });
    setCartOpen(false);
    setView("results");
  };

  const goCheckout = () => {
    setCartOpen(false);
    setView("checkout");
  };

  const confirmBooking = async () => {
    if (!session?.access_token) {
      openAuthModal("signin");
      showToast("Logga in för att slutföra bokningen");
      return;
    }
    const { data: bookingRows, error: bookingError } = await supabaseRestRequest("/bookings", session.access_token, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        customer_id: session.user.id,
        event_id: (bookingEventId === "none" ? null : bookingEventId || activeEventId) || null,
        date: party.date || null,
        start_time: party.startTime || null,
        end_time: party.endTime || null,
        guests: party.guests,
        occasion: party.occasion,
      }),
    });
    if (bookingError || !bookingRows?.[0]) {
      showToast("Kunde inte skapa bokningen: " + (bookingError?.message || "okänt fel"));
      return;
    }
    const bookingRow = bookingRows[0];
    const newBookingNumber = bookingRow.booking_number; // handed out by the database
    const itemsPayload = cart.map((p) => ({
      booking_id: bookingRow.id,
      vendor_id: p.vendorDbId || null,
      category_id: p.category,
      name: p.name,
      price: getLineTotal(p, p.chosenAddons, party),
      status: "pending",
      quote_message_id: p.quoteMessageId || null,
      service_id: isUuid(p.serviceId) ? p.serviceId : null,
      addon_ids: (p.chosenAddons || []).filter(isUuid),
    }));
    const { data: itemRows, error: itemsError } = await supabaseRestRequest("/booking_items", session.access_token, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(itemsPayload),
    });
    if (itemsError || !itemRows) {
      // Don't pretend it worked: take the empty booking back and say so.
      await supabaseRestRequest(`/bookings?id=eq.${bookingRow.id}`, session.access_token, { method: "PATCH", body: JSON.stringify({ cancelled: true }) });
      showToast("Bokningen kunde inte slutföras" + (itemsError?.message ? `: ${itemsError.message}` : "") + ". Försök igen.");
      return;
    }
    const sourceItems = itemRows;
    const newBooking = {
      eventId: (bookingEventId === "none" ? null : bookingEventId || activeEventId) || null,
      bookingNumber: newBookingNumber,
      date: party.date,
      startTime: party.startTime,
      endTime: party.endTime,
      guests: party.guests,
      occasion: party.occasion,
      cancelled: false,
      completed: false,
      items: sourceItems.map((row, i) => ({
        id: row.id || cart[i].id,
        providerId: cart[i].id,
        vendorId: row.vendor_id ?? cart[i].vendorDbId ?? null,
        name: row.name,
        category: row.category_id,
        price: row.price,
        status: row.status || "pending",
        reviewed: false,
      })),
    };
    setBookings((b) => [newBooking, ...b]);
    setLastBooking(newBooking);
    setCartItems([]);
    setView("confirmation");
  };

  // --- Guest booking ---
  const guestBlockReason = cart.some((p) => !p.vendorDbId || !isUuid(p.serviceId) || p.quoteMessageId || p.requestOnly)
    ? "En eller flera leverantörer i din fest kräver ett konto (till exempel en offert eller en förfrågan). Logga in för att boka."
    : "";

  const submitGuestBooking = async ({ name, email, phone }) => {
    setGuestError("");
    setGuestSubmitting(true);
    const { error } = await guestRequest({
      action: "create",
      name,
      email,
      phone,
      party: { date: party.date, start: party.startTime, end: party.endTime, guests: Number(party.guests) || 1, occasion: party.occasion || "" },
      items: cart.map((p) => ({ vendor_id: p.vendorDbId, category_id: p.category, name: p.name, service_id: p.serviceId, addon_ids: (p.chosenAddons || []).filter(isUuid) })),
    });
    setGuestSubmitting(false);
    if (error) {
      setGuestError(error);
      return;
    }
    setGuestPendingEmail(email);
    setCartItems([]);
    setView("guestCheck");
  };

  const cancelGuestBooking = async () => {
    const { data, error } = await guestRequest({ action: "cancel", token: guestBooking.token });
    if (error) {
      showToast(error);
      return;
    }
    setGuestBooking((g) => ({ ...g, data: data.booking }));
    showToast("Bokningen är avbokad");
  };

  const fetchGuestContact = async (bookingId) => {
    const { data } = await supabaseRestRequest("/rpc/vendor_guest_contact", session.access_token, { method: "POST", body: JSON.stringify({ p_booking_id: bookingId }) });
    return Array.isArray(data) ? data[0] || null : null;
  };

  // --- Min planering: every change shows at once and is saved in the background; a failed save is undone and explained ---
  const planningDb = (path, opts) => supabaseRestRequest(path, session.access_token, opts);
  const patchEvent = (id, fn) => setEvents((list) => list.map((e) => (e.id === id ? fn(e) : e)));
  const failed = (what, error) => showToast(`Kunde inte ${what}${error?.message ? `: ${error.message}` : ""}`);

  const createEvent = async ({ title, eventType, date, guests, budgetTotal, withTemplate }) => {
    const id = newId();
    const tasks = withTemplate ? buildTemplateTasks(eventType, date) : [];
    const local = { id, title, eventType, date: date || "", guests: guests || null, budgetTotal: budgetTotal ?? null, notes: "", tasks, budget: [], location: "", eventTime: "", inviteMessage: "", rsvpDeadline: "", inviteToken: null, guestList: [] };
    setEvents((l) => [...l, local]);
    setActiveEventId(id);
    const { error } = await planningDb("/events", {
      method: "POST",
      body: JSON.stringify({ id, owner_id: session.user.id, title, event_type: eventType, event_date: date || null, guests: guests || null, budget_total: budgetTotal ?? null }),
    });
    if (error) {
      setEvents((l) => l.filter((e) => e.id !== id));
      failed("spara festen", error);
      return false;
    }
    if (tasks.length) {
      const { error: tErr } = await planningDb("/event_tasks", {
        method: "POST",
        body: JSON.stringify(tasks.map((t) => ({ id: t.id, event_id: id, title: t.title, done: false, due_date: t.dueDate }))),
      });
      if (tErr) failed("lägga in checklistan", tErr);
    }
    showToast("Din planering är skapad ✓");
    return true;
  };

  const updateEvent = async (id, patch) => {
    const before = events.find((e) => e.id === id);
    if (!before) return false;
    patchEvent(id, (e) => ({ ...e, ...patch }));
    const body = {};
    if ("title" in patch) body.title = patch.title;
    if ("eventType" in patch) body.event_type = patch.eventType;
    if ("date" in patch) body.event_date = patch.date || null;
    if ("guests" in patch) body.guests = patch.guests || null;
    if ("budgetTotal" in patch) body.budget_total = patch.budgetTotal;
    if ("notes" in patch) body.notes = patch.notes;
    if ("location" in patch) body.location = patch.location || null;
    if ("eventTime" in patch) body.event_time = patch.eventTime || null;
    if ("inviteMessage" in patch) body.invite_message = patch.inviteMessage || null;
    if ("rsvpDeadline" in patch) body.rsvp_deadline = patch.rsvpDeadline || null;
    const { error } = await planningDb(`/events?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(body) });
    if (error) {
      patchEvent(id, () => before);
      failed("spara ändringen", error);
      return false;
    }
    return true;
  };

  const deleteEvent = async (id) => {
    const before = events;
    const rest = events.filter((e) => e.id !== id);
    setEvents(rest);
    setActiveEventId(rest[0]?.id || null);
    const { error } = await planningDb(`/events?id=eq.${id}`, { method: "DELETE" });
    if (error) {
      setEvents(before);
      failed("ta bort festen", error);
    }
  };

  const taskApi = {
    add: async (eventId, { title, dueDate }) => {
      const t = { id: newId(), title, done: false, dueDate: dueDate || null };
      patchEvent(eventId, (e) => ({ ...e, tasks: [...e.tasks, t] }));
      const { error } = await planningDb("/event_tasks", { method: "POST", body: JSON.stringify({ id: t.id, event_id: eventId, title, done: false, due_date: t.dueDate }) });
      if (error) {
        patchEvent(eventId, (e) => ({ ...e, tasks: e.tasks.filter((x) => x.id !== t.id) }));
        failed("lägga till punkten", error);
      }
    },
    toggle: async (eventId, taskId) => {
      const cur = events.find((e) => e.id === eventId)?.tasks.find((t) => t.id === taskId);
      if (!cur) return;
      patchEvent(eventId, (e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? { ...t, done: !cur.done } : t)) }));
      const { error } = await planningDb(`/event_tasks?id=eq.${taskId}`, { method: "PATCH", body: JSON.stringify({ done: !cur.done }) });
      if (error) {
        patchEvent(eventId, (e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? { ...t, done: cur.done } : t)) }));
        failed("spara", error);
      }
    },
    update: async (eventId, taskId, patch) => {
      const cur = events.find((e) => e.id === eventId)?.tasks.find((t) => t.id === taskId);
      if (!cur) return;
      patchEvent(eventId, (e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) }));
      const body = {};
      if ("title" in patch) body.title = patch.title;
      if ("dueDate" in patch) body.due_date = patch.dueDate || null;
      const { error } = await planningDb(`/event_tasks?id=eq.${taskId}`, { method: "PATCH", body: JSON.stringify(body) });
      if (error) {
        patchEvent(eventId, (e) => ({ ...e, tasks: e.tasks.map((t) => (t.id === taskId ? cur : t)) }));
        failed("spara", error);
      }
    },
    remove: async (eventId, taskId) => {
      const cur = events.find((e) => e.id === eventId)?.tasks.find((t) => t.id === taskId);
      patchEvent(eventId, (e) => ({ ...e, tasks: e.tasks.filter((t) => t.id !== taskId) }));
      const { error } = await planningDb(`/event_tasks?id=eq.${taskId}`, { method: "DELETE" });
      if (error && cur) {
        patchEvent(eventId, (e) => ({ ...e, tasks: [...e.tasks, cur] }));
        failed("ta bort", error);
      }
    },
    addTemplate: async (ev) => {
      const fresh = buildTemplateTasks(ev.eventType, ev.date, ev.tasks.map((t) => t.title));
      if (fresh.length === 0) {
        showToast("Alla förslag finns redan i din checklista ✓");
        return;
      }
      patchEvent(ev.id, (e) => ({ ...e, tasks: [...e.tasks, ...fresh] }));
      const { error } = await planningDb("/event_tasks", {
        method: "POST",
        body: JSON.stringify(fresh.map((t) => ({ id: t.id, event_id: ev.id, title: t.title, done: false, due_date: t.dueDate }))),
      });
      if (error) {
        patchEvent(ev.id, (e) => ({ ...e, tasks: e.tasks.filter((t) => !fresh.some((f) => f.id === t.id)) }));
        failed("lägga in förslagen", error);
      } else showToast(`${fresh.length} förslag tillagda ✓`);
    },
  };

  const budgetApi = {
    add: async (eventId, { label, estimated }) => {
      const b = { id: newId(), label, estimated, actual: null, paid: false };
      patchEvent(eventId, (e) => ({ ...e, budget: [...e.budget, b] }));
      const { error } = await planningDb("/event_budget_items", { method: "POST", body: JSON.stringify({ id: b.id, event_id: eventId, label, estimated }) });
      if (error) {
        patchEvent(eventId, (e) => ({ ...e, budget: e.budget.filter((x) => x.id !== b.id) }));
        failed("lägga till posten", error);
      }
    },
    update: async (eventId, lineId, patch) => {
      const cur = events.find((e) => e.id === eventId)?.budget.find((b) => b.id === lineId);
      if (!cur) return;
      patchEvent(eventId, (e) => ({ ...e, budget: e.budget.map((b) => (b.id === lineId ? { ...b, ...patch } : b)) }));
      const { error } = await planningDb(`/event_budget_items?id=eq.${lineId}`, { method: "PATCH", body: JSON.stringify(patch) });
      if (error) {
        patchEvent(eventId, (e) => ({ ...e, budget: e.budget.map((b) => (b.id === lineId ? cur : b)) }));
        failed("spara", error);
      }
    },
    remove: async (eventId, lineId) => {
      const cur = events.find((e) => e.id === eventId)?.budget.find((b) => b.id === lineId);
      patchEvent(eventId, (e) => ({ ...e, budget: e.budget.filter((b) => b.id !== lineId) }));
      const { error } = await planningDb(`/event_budget_items?id=eq.${lineId}`, { method: "DELETE" });
      if (error && cur) {
        patchEvent(eventId, (e) => ({ ...e, budget: [...e.budget, cur] }));
        failed("ta bort", error);
      }
    },
  };

  const guestApi = {
    add: async (eventId, names) => {
      const have = new Set((events.find((e) => e.id === eventId)?.guestList || []).map((g) => g.name.toLowerCase()));
      const rows = [];
      names.forEach((name) => {
        if (have.has(name.toLowerCase())) return;
        have.add(name.toLowerCase());
        rows.push({ id: newId(), name: name.slice(0, 100), token: `${newId()}${newId()}`.replace(/-/g, ""), status: "pending", allowedParty: 1, partySize: 1, dietary: "", message: "", source: "host" });
      });
      if (rows.length === 0) {
        showToast("Den gästen finns redan i listan");
        return;
      }
      patchEvent(eventId, (e) => ({ ...e, guestList: [...e.guestList, ...rows] }));
      const { error } = await planningDb("/event_guests", { method: "POST", body: JSON.stringify(rows.map((g) => ({ id: g.id, event_id: eventId, name: g.name, token: g.token }))) });
      if (error) {
        patchEvent(eventId, (e) => ({ ...e, guestList: e.guestList.filter((g) => !rows.some((r) => r.id === g.id)) }));
        failed("lägga till gästerna", error);
      }
    },
    update: async (eventId, guestId, patch) => {
      const cur = events.find((e) => e.id === eventId)?.guestList.find((g) => g.id === guestId);
      if (!cur) return;
      const next = { ...patch };
      if ("allowedParty" in patch && cur.partySize > patch.allowedParty) next.partySize = patch.allowedParty;
      if (next.status === "no") next.partySize = 1;
      patchEvent(eventId, (e) => ({ ...e, guestList: e.guestList.map((g) => (g.id === guestId ? { ...g, ...next } : g)) }));
      const body = {};
      if ("name" in next) body.name = next.name;
      if ("status" in next) body.status = next.status;
      if ("allowedParty" in next) body.allowed_party = next.allowedParty;
      if ("partySize" in next) body.party_size = next.partySize;
      if ("dietary" in next) body.dietary = next.dietary;
      const { error } = await planningDb(`/event_guests?id=eq.${guestId}`, { method: "PATCH", body: JSON.stringify(body) });
      if (error) {
        patchEvent(eventId, (e) => ({ ...e, guestList: e.guestList.map((g) => (g.id === guestId ? cur : g)) }));
        failed("spara", error);
      }
    },
    remove: async (eventId, guestId) => {
      const cur = events.find((e) => e.id === eventId)?.guestList.find((g) => g.id === guestId);
      patchEvent(eventId, (e) => ({ ...e, guestList: e.guestList.filter((g) => g.id !== guestId) }));
      const { error } = await planningDb(`/event_guests?id=eq.${guestId}`, { method: "DELETE" });
      if (error && cur) {
        patchEvent(eventId, (e) => ({ ...e, guestList: [...e.guestList, cur] }));
        failed("ta bort gästen", error);
      }
    },
    setOpen: async (ev, enabled) => {
      const { data, error } = await planningDb("/rpc/set_open_rsvp", { method: "POST", body: JSON.stringify({ p_event_id: ev.id, p_enabled: enabled }) });
      if (error) {
        failed("ändra den gemensamma länken", error);
        return;
      }
      patchEvent(ev.id, (e) => ({ ...e, inviteToken: typeof data === "string" ? data : null }));
    },
    // answers can arrive at any time (a guest answering from their phone): fetch the list again
    refresh: async (eventId) => {
      const { data } = await planningDb(`/event_guests?event_id=eq.${eventId}&select=*&order=created_at.asc`);
      if (Array.isArray(data)) patchEvent(eventId, (e) => ({ ...e, guestList: data.map(mapGuest) }));
    },
  };

  const toggleFavorite = async (vendorId) => {
    if (!session?.access_token) {
      openAuthModal("signin");
      showToast("Logga in för att spara leverantörer");
      return;
    }
    const on = favoriteIds.has(vendorId);
    setFavoriteIds((s) => {
      const n = new Set(s);
      if (on) n.delete(vendorId);
      else n.add(vendorId);
      return n;
    });
    const { error } = on
      ? await planningDb(`/favorites?vendor_id=eq.${vendorId}&user_id=eq.${session.user.id}`, { method: "DELETE" })
      : await planningDb("/favorites", { method: "POST", body: JSON.stringify({ user_id: session.user.id, vendor_id: vendorId }) });
    if (error) {
      setFavoriteIds((s) => {
        const n = new Set(s);
        if (on) n.add(vendorId);
        else n.delete(vendorId);
        return n;
      });
      failed("spara", error);
    } else if (!on) showToast("Sparad ♥");
  };

  const savedProviders = [...favoriteIds].map((id) => customerProviders.find((p) => p.vendorDbId === id)).filter(Boolean);
  const goPlanning = () => {
    setView("planning");
    setMobileMenuOpen(false);
  };

  // A guest answers their invitation. Returns an error text, or "" when it worked.
  const submitRsvp = async ({ status, partySize, dietary, message, name }) => {
    const { data, error } = await rpcAnon("rsvp_submit", { p_token: rsvp.token, p_status: status, p_party_size: partySize, p_dietary: dietary, p_message: message, p_name: name || null });
    if (error) return rsvpErrorText(error.message);
    const guestToken = data.guest_token;
    if (rsvp.data?.kind === "open") {
      try {
        window.localStorage.setItem(`planifest-rsvp-${rsvp.openToken}`, guestToken);
      } catch (e) {
        // fine
      }
    }
    const g = await rpcAnon("rsvp_get", { p_token: guestToken });
    setRsvp((st) => ({ ...st, token: guestToken, data: g.data || st.data, saved: { status, guestToken } }));
    return "";
  };

  const restart = () => {
    setParty(emptyParty());
    setCartItems([]);
    setLastBooking(null);
    setView("home");
  };

  // --- Mina bokningar & recensioner ---
  const goMinaBokningar = () => {
    setView("minaBokningar");
    setMobileMenuOpen(false);
  };

  const cancelBooking = async (bookingNumber) => {
    setBookings((bs) =>
      bs.map((b) =>
        b.bookingNumber === bookingNumber ? { ...b, cancelled: true, items: b.items.map((i) => ({ ...i, status: "cancelled" })) } : b
      )
    );
    showToast("Bokningen är avbokad.");
    if (session?.access_token) {
      await supabaseRestRequest(`/bookings?booking_number=eq.${bookingNumber}`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({ cancelled: true }),
      });
    }
  };

  const openReview = (bookingNumber, item) => setReviewTarget({ bookingNumber, item });
  const closeReview = () => setReviewTarget(null);

  const submitReview = async (stars, text) => {
    if (!reviewTarget) return;
    const { bookingNumber, item } = reviewTarget;
    const trimmed = text.trim();
    if (session?.access_token && item.vendorId) {
      const { error } = await supabaseRestRequest("/reviews", session.access_token, {
        method: "POST",
        body: JSON.stringify({ booking_item_id: item.id, vendor_id: item.vendorId, customer_id: session.user.id, stars, text: trimmed }),
      });
      if (error) {
        setReviewTarget(null);
        showToast("Recensionen kunde inte sparas. Du kan recensera en genomförd, bekräftad bokning, en gång.");
        return;
      }
      await supabaseRestRequest(`/booking_items?id=eq.${item.id}`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({ reviewed: true }),
      });
    }
    setCustomerReviews((r) => [...r, { id: "rev-" + Date.now(), providerId: item.providerId, name: "Du", stars, text: trimmed }]);
    setBookings((bs) =>
      bs.map((b) =>
        b.bookingNumber === bookingNumber ? { ...b, items: b.items.map((i) => (i.id === item.id ? { ...i, reviewed: true } : i)) } : b
      )
    );
    setReviewTarget(null);
    showToast("Tack för din recension! ✓");
  };

  // --- Chat (Fas 8) — real, persisted conversations for real vendors; mock/
  // demo listings keep the old simulated local-only chat as a fallback.
  const getChatKey = (target) => (target.kind === "booking" ? `booking-${target.bookingNumber}-${target.item.id}` : `provider-${target.provider.id}`);

  const openBookingChat = async (bookingNumber, item) => {
    if (!item.vendorId || !session?.access_token) {
      setChatTarget({ kind: "booking", bookingNumber, item });
      return;
    }
    const { data: convo, error } = await findOrCreateConversation({
      vendorId: item.vendorId,
      customerId: session.user.id,
      categoryId: item.category,
      accessToken: session.access_token,
    });
    if (error || !convo) {
      setChatTarget({ kind: "booking", bookingNumber, item });
      return;
    }
    const { data: msgs } = await supabaseRestRequest(`/messages?conversation_id=eq.${convo.id}&select=*&order=created_at.asc`, session.access_token);
    setRealMessages((m) => ({ ...m, [convo.id]: msgs || [] }));
    setChatTarget({ kind: "booking", bookingNumber, item, real: true, conversationId: convo.id });
  };

  const openProviderChat = async (provider) => {
    if (!provider.vendorDbId) {
      setChatTarget({ kind: "provider", provider });
      return;
    }
    if (!session?.access_token) {
      openAuthModal("signin");
      showToast("Logga in för att chatta med leverantören");
      return;
    }
    const { data: convo, error } = await findOrCreateConversation({
      vendorId: provider.vendorDbId,
      customerId: session.user.id,
      categoryId: provider.category,
      accessToken: session.access_token,
    });
    if (error || !convo) {
      showToast("Kunde inte öppna chatten just nu");
      return;
    }
    const { data: msgs } = await supabaseRestRequest(`/messages?conversation_id=eq.${convo.id}&select=*&order=created_at.asc`, session.access_token);
    setRealMessages((m) => ({ ...m, [convo.id]: msgs || [] }));
    setChatTarget({ kind: "provider", provider, real: true, conversationId: convo.id });
  };

  const closeChat = () => setChatTarget(null);

  // A request: the customer answers the vendor's own questions, the vendor replies in the chat and
  // sends a quote with the final price, and accepting that quote is what puts it in Min fest.
  const sendRequest = async (provider, brief) => {
    if (!provider.vendorDbId) {
      showToast("Den här leverantören går inte att kontakta än.");
      return false;
    }
    if (!session?.access_token) {
      openAuthModal("signin");
      showToast("Logga in för att skicka en förfrågan");
      return false;
    }
    const { data: convo, error } = await findOrCreateConversation({
      vendorId: provider.vendorDbId,
      customerId: session.user.id,
      categoryId: provider.category,
      accessToken: session.access_token,
    });
    if (error || !convo) {
      showToast("Kunde inte skicka förfrågan just nu");
      return false;
    }
    const summary = `${catMap[provider.category]?.label || "Förfrågan"}: ${brief.rows
      .slice(0, 2)
      .map((r) => [].concat(r.value).join(", "))
      .join(", ")}`.slice(0, 140);
    const { data: rows, error: msgError } = await supabaseRestRequest("/messages", session.access_token, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ conversation_id: convo.id, sender: "customer", text: summary, message_type: "brief", brief }),
    });
    if (msgError || !rows?.[0]) {
      showToast("Kunde inte skicka förfrågan" + (msgError?.message ? `: ${msgError.message}` : ""));
      return false;
    }
    const { data: msgs } = await supabaseRestRequest(`/messages?conversation_id=eq.${convo.id}&select=*&order=created_at.asc`, session.access_token);
    setRealMessages((m) => ({ ...m, [convo.id]: msgs || [rows[0]] }));
    setChatTarget({ kind: "provider", provider, real: true, conversationId: convo.id });
    showToast("Förfrågan skickad ✓");
    return true;
  };

  const sendChatMessage = async (text) => {
    if (!chatTarget || !text.trim()) return;

    if (chatTarget.real) {
      const { data, error } = await supabaseRestRequest("/messages", session.access_token, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ conversation_id: chatTarget.conversationId, sender: "customer", text: text.trim(), message_type: "text" }),
      });
      if (!error && data?.[0]) {
        setRealMessages((m) => ({ ...m, [chatTarget.conversationId]: [...(m[chatTarget.conversationId] || []), data[0]] }));
      }
      return;
    }

    const key = getChatKey(chatTarget);
    const customerMsg = { id: "msg-" + Date.now(), sender: "customer", text: text.trim(), ts: Date.now() };
    setChats((c) => ({ ...c, [key]: [...(c[key] || []), customerMsg] }));
    setVendorTyping(true);
    const replyDelay = 900 + Math.random() * 1100;
    setTimeout(() => {
      const reply = VENDOR_AUTO_REPLIES[Math.floor(Math.random() * VENDOR_AUTO_REPLIES.length)];
      const vendorMsg = { id: "msg-" + Date.now() + "-v", sender: "vendor", text: reply, ts: Date.now() };
      setChats((c) => ({ ...c, [key]: [...(c[key] || []), vendorMsg] }));
      setVendorTyping(false);
    }, replyDelay);
  };

  const acceptQuote = async (message) => {
    if (!session?.access_token || !chatTarget?.conversationId) return;
    const { error } = await supabaseRestRequest(`/messages?id=eq.${message.id}`, session.access_token, {
      method: "PATCH",
      body: JSON.stringify({ quote_status: "accepted" }),
    });
    if (error) {
      showToast("Kunde inte acceptera offerten just nu");
      return;
    }
    setRealMessages((m) => ({
      ...m,
      [chatTarget.conversationId]: (m[chatTarget.conversationId] || []).map((msg) => (msg.id === message.id ? { ...msg, quote_status: "accepted" } : msg)),
    }));
    const provider =
      chatTarget.provider || (chatTarget.item ? { vendorDbId: chatTarget.item.vendorId, category: chatTarget.item.category, name: chatTarget.item.name } : null);
    if (provider) {
      const quoteId = `quote-${message.id}`;
      const synthetic = {
        id: quoteId,
        messageId: message.id,
        vendorDbId: provider.vendorDbId,
        category: provider.category,
        name: provider.name,
        amount: message.quote_amount,
        description: message.quote_description,
      };
      setAcceptedQuotes((q) => [...q.filter((x) => x.id !== quoteId), synthetic]);
      setCartItems((c) => (c.some((x) => x.id === quoteId) ? c : [...c, { id: quoteId, addons: [] }]));
      showToast("Offert accepterad — tillagd i Min fest ✓");
    }
  };

  const declineQuote = async (message) => {
    if (!session?.access_token || !chatTarget?.conversationId) return;
    await supabaseRestRequest(`/messages?id=eq.${message.id}`, session.access_token, { method: "PATCH", body: JSON.stringify({ quote_status: "declined" }) });
    setRealMessages((m) => ({
      ...m,
      [chatTarget.conversationId]: (m[chatTarget.conversationId] || []).map((msg) => (msg.id === message.id ? { ...msg, quote_status: "declined" } : msg)),
    }));
  };

  // --- Vendor inbox (Fas 8) ---
  useEffect(() => {
    const vendorId = submittedVendor?.id;
    if (!vendorId || vendorId.startsWith("VND-") || !session?.access_token) return;
    supabaseRestRequest(`/conversations?vendor_id=eq.${vendorId}&select=*&order=created_at.desc`, session.access_token).then(({ data, error }) => {
      if (!error && data) setVendorConversations(data);
    });
  }, [submittedVendor?.id, session, view, pollTick]);

  const openVendorConversation = async (conversationId) => {
    setActiveVendorConversationId(conversationId);
    const { data, error } = await supabaseRestRequest(`/messages?conversation_id=eq.${conversationId}&select=*&order=created_at.asc`, session.access_token);
    if (!error && data) setRealMessages((m) => ({ ...m, [conversationId]: data }));
  };
  const closeVendorConversation = () => setActiveVendorConversationId(null);

  // Live updates: poll whichever conversation is open (a customer's chat or the
  // vendor's inbox thread) so new messages and quote answers show up by themselves.
  const openConvoId = chatTarget?.real ? chatTarget.conversationId : view === "vendorInbox" ? activeVendorConversationId : null;
  useEffect(() => {
    if (!openConvoId || !session?.access_token) return;
    const sig = (a) => (a || []).map((x) => `${x.id}:${x.quote_status}`).join(",");
    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const { data } = await supabaseRestRequest(`/messages?conversation_id=eq.${openConvoId}&select=*&order=created_at.asc`, session.access_token);
      if (data) setRealMessages((m) => (sig(m[openConvoId]) === sig(data) ? m : { ...m, [openConvoId]: data }));
    };
    const id = setInterval(tick, CHAT_POLL_MS);
    return () => clearInterval(id);
  }, [openConvoId, session]);

  // Whatever is open on screen counts as read, including messages that arrive while it is open.
  const openMsgCount = openConvoId ? (realMessages[openConvoId] || []).length : 0;
  useEffect(() => {
    if (!openConvoId || !session?.access_token) return;
    setInbox((list) => list.map((c) => (c.conversation_id === openConvoId ? { ...c, unread: 0 } : c)));
    supabaseRestRequest("/rpc/mark_conversation_read", session.access_token, { method: "POST", body: JSON.stringify({ p_conversation_id: openConvoId }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openConvoId, openMsgCount]);

  const toggleSound = () => {
    setSoundOn((on) => {
      try {
        localStorage.setItem(SOUND_KEY, on ? "off" : "on");
      } catch (e) {
        // ignore
      }
      return !on;
    });
  };

  const openConversationFromPanel = async (c) => {
    setPanelOpen(false);
    if (c.i_am === "vendor") {
      await openVendorConversation(c.conversation_id);
      setView("vendorInbox");
      return;
    }
    const provider = { id: `${c.vendor_id}-${c.category_id}`, vendorDbId: c.vendor_id, category: c.category_id, name: c.other_name };
    const { data: msgs } = await supabaseRestRequest(`/messages?conversation_id=eq.${c.conversation_id}&select=*&order=created_at.asc`, session.access_token);
    setRealMessages((m) => ({ ...m, [c.conversation_id]: msgs || [] }));
    setChatTarget({ kind: "provider", provider, real: true, conversationId: c.conversation_id });
  };

  const sendVendorMessage = async (text) => {
    if (!activeVendorConversationId) return;
    const { data, error } = await supabaseRestRequest("/messages", session.access_token, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ conversation_id: activeVendorConversationId, sender: "vendor", text, message_type: "text" }),
    });
    if (!error && data?.[0]) {
      setRealMessages((m) => ({ ...m, [activeVendorConversationId]: [...(m[activeVendorConversationId] || []), data[0]] }));
    }
  };

  const sendVendorQuote = async (amount, description) => {
    if (!activeVendorConversationId) return;
    const { data, error } = await supabaseRestRequest("/messages", session.access_token, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        conversation_id: activeVendorConversationId,
        sender: "vendor",
        text: description || "Offert",
        message_type: "quote",
        quote_amount: amount,
        quote_description: description,
        quote_status: "pending",
      }),
    });
    if (!error && data?.[0]) {
      setRealMessages((m) => ({ ...m, [activeVendorConversationId]: [...(m[activeVendorConversationId] || []), data[0]] }));
      showToast("Offert skickad ✓");
    }
  };

  const goVendorInbox = () => setView("vendorInbox");

  // Suggested quote for the vendor, worked out from THEIR OWN prices and what the customer picked
  // (never from the customer's own total, which could say anything).
  const quoteFromBrief = (brief, categoryId) => {
    if (!submittedVendor) return null;
    const provider = mapVendorToProviders(submittedVendor, bookings).find((p) => p.category === categoryId);
    if (!provider) return null;
    const rows = brief.rows || [];
    const partyLike = { guests: Number(brief.party?.guests) || 1, startTime: brief.party?.start, endTime: brief.party?.end };
    let base = provider.pricing.amount > 0 ? getBaseAmount(provider, partyLike) : 0;
    if (!Number.isFinite(base)) base = 0;
    const extra = priceFromAnswers(provider.request.fields, (f) => rows.find((r) => r.label === f.label)?.value);
    const parts = rows.slice(0, 6).map((r) => `${r.label}: ${[].concat(r.value).join(", ")}`);
    return { amount: Math.round(base + extra), description: `${catMap[categoryId]?.label || "Förfrågan"}. ${parts.join("; ")}`.slice(0, 300) };
  };

  // --- Support — saved to the database; a trigger there emails info@planifest.se ---
  const submitSupportMessage = async ({ email, subject, message }) => {
    const { error } = await supabaseRestRequest("/support_messages", session?.access_token, {
      method: "POST",
      body: JSON.stringify({ customer_id: session?.user?.id || null, email, subject, message }),
    });
    return error || null;
  };

  // --- Vendor signup (Fas 2A) ---
  const switchMode = (toCustomer) => {
    setCustomerMode(toCustomer);
    try {
      if (toCustomer) localStorage.setItem("planifest-mode", "customer");
      else localStorage.removeItem("planifest-mode");
    } catch (e) {
      // fine
    }
    setView(toCustomer ? "home" : "vendorDashboard");
    setMobileMenuOpen(false);
  };

  const goVendorIntro = () => {
    if (submittedVendor) {
      switchMode(false); // "Min portal" always means the vendor portal
      return;
    }
    setView("vendorIntro");
    setMobileMenuOpen(false);
  };

  const startVendorSignup = () => {
    setVendorForm({
      ...emptyVendorForm(),
      ...(session?.user ? { email: session.user.email || "", contactPerson: profile?.full_name || "", phone: profile?.phone || "" } : {}),
    });
    setVendorErrors({});
    setVendorSubmitError("");
    setVendorStep(1);
    setView("vendorSignup");
    setMobileMenuOpen(false);
  };

  const updateVendorField = (field, value) => {
    setVendorForm((f) => ({ ...f, [field]: value }));
  };

  const toggleVendorCategory = (id) => {
    setVendorForm((f) => ({
      ...f,
      categories: f.categories.includes(id) ? f.categories.filter((c) => c !== id) : [...f.categories, id],
    }));
  };

  const vendorNext = () => {
    const errors = vendorStep === 1 ? validateVendorAccount(vendorForm, !!session) : validateVendorGeography(vendorForm);
    setVendorErrors(errors);
    if (Object.keys(errors).length === 0) setVendorStep((s) => Math.min(3, s + 1));
  };

  const vendorBack = () => setVendorStep((s) => Math.max(1, s - 1));

  const submitVendorApplication = async () => {
    const errors = validateVendorCategories(vendorForm);
    setVendorErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setVendorSubmitError("");
    setVendorSubmitting(true);

    // Already signed in (for example a customer who now wants to become a vendor):
    // no new account is needed, the application is simply saved on this one.
    if (session?.access_token) {
      const { data: newVendor, error: vendorError } = await createVendorApplication(session, { ...vendorForm, email: session.user.email });
      setVendorSubmitting(false);
      if (vendorError) {
        setVendorSubmitError(vendorError.message);
        return;
      }
      setVendorApplications((apps) => [...apps.filter((v) => v.id !== newVendor.id), newVendor]);
      setSubmittedVendorId(newVendor.id);
      setView("vendorDashboard");
      return;
    }

    // New person: the application travels with the signup. The database creates
    // it the moment the email address is confirmed, from any device, so nothing
    // depends on this browser remembering anything.
    const areaOption = SERVICE_AREA_OPTIONS.find((o) => o.type === vendorForm.serviceArea);
    const { data: signUpData, error: signUpError } = await supabaseAuthRequest("/signup", {
      method: "POST",
      body: JSON.stringify({
        email: vendorForm.email.trim(),
        password: vendorForm.password,
        data: {
          full_name: vendorForm.contactPerson,
          vendor_application: {
            company_name: vendorForm.companyName,
            organization_number: vendorForm.organizationNumber,
            contact_person: vendorForm.contactPerson,
            phone: vendorForm.phone,
            base_location: vendorForm.baseLocation,
            service_area_type: areaOption?.type || null,
            service_area_value: areaOption?.label || null,
            categories: vendorForm.categories,
          },
        },
      }),
    });
    setVendorSubmitting(false);

    if (signUpError) {
      setVendorSubmitError(signUpError.message);
      return;
    }

    if (signUpData.access_token) {
      // Email confirmation is off: we have a session immediately, so create the application right away.
      setSessionPersist(signUpData);
      const { data: newVendor, error: vendorError } = await createVendorApplication(signUpData, vendorForm);
      if (vendorError) {
        setVendorSubmitError(vendorError.message);
        return;
      }
      setVendorApplications((apps) => [...apps, newVendor]);
      setSubmittedVendorId(newVendor.id);
      setView("vendorPending");
      return;
    }

    // Supabase never says whether an address is already registered; it answers
    // with a user that has no identities. Tell the person instead of leaving them waiting for a mail that never comes.
    const created = signUpData.user || signUpData;
    if (Array.isArray(created?.identities) && created.identities.length === 0) {
      setVendorSubmitError("Det finns redan ett konto med den e-postadressen. Logga in, så kan du ansöka som leverantör från ditt konto.");
      openAuthModal("signin");
      return;
    }

    setView("vendorAwaitingConfirmation");
  };

  // --- Vendor portal navigation (Fas 2B) ---
  const goVendorDashboard = () => setView("vendorDashboard");
  const goVendorEditor = () => setView("vendorProfileEditor");
  const goVendorPreview = () => setView("vendorProfilePreview");
  const goVendorBookings = () => setView("vendorBookings");

  // Batch-saves the profile editor's changes to the database before leaving it.
  const saveVendorProfileAndGo = async (nextView) => {
    if (submittedVendor && session?.access_token) {
      await saveVendorProfile(submittedVendor, session.access_token);
      showToast("Sparat ✓");
    }
    setView(nextView);
  };
  const saveAndGoDashboard = () => saveVendorProfileAndGo("vendorDashboard");
  const saveAndGoPreview = () => saveVendorProfileAndGo("vendorProfilePreview");

  const respondToBookingItem = async (bookingNumber, itemId, status) => {
    setBookings((bs) =>
      bs.map((b) =>
        b.bookingNumber === bookingNumber ? { ...b, items: b.items.map((i) => (i.id === itemId ? { ...i, status } : i)) } : b
      )
    );
    showToast(status === "confirmed" ? "Bokning bekräftad ✓" : "Bokning nekad");
    if (session?.access_token) {
      await supabaseRestRequest(`/booking_items?id=eq.${itemId}`, session.access_token, { method: "PATCH", body: JSON.stringify({ status } ) });
    }
  };

  const addBlockedTime = async (block) => {
    if (!submittedVendor) return;
    if (session?.access_token) {
      const { data, error } = await supabaseRestRequest("/blocked_times", session.access_token, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          vendor_id: submittedVendor.id,
          date: block.date,
          start_time: block.startTime,
          end_time: block.endTime,
          note: block.note,
        }),
      });
      if (!error && data?.[0]) {
        const saved = { id: data[0].id, date: data[0].date, startTime: data[0].start_time, endTime: data[0].end_time, note: data[0].note || "" };
        patchVendor((v) => ({ ...v, blockedTimes: [...(v.blockedTimes || []), saved] }));
        return;
      }
    }
    patchVendor((v) => ({ ...v, blockedTimes: [...(v.blockedTimes || []), block] }));
  };
  const removeBlockedTime = async (index) => {
    if (!submittedVendor) return;
    const item = submittedVendor.blockedTimes[index];
    if (item?.id && session?.access_token) {
      await supabaseRestRequest(`/blocked_times?id=eq.${item.id}`, session.access_token, { method: "DELETE" });
    }
    patchVendor((v) => ({ ...v, blockedTimes: (v.blockedTimes || []).filter((_, i) => i !== index) }));
  };

  // --- Vendor profile editing (Fas 2B) — patches this vendor's entry inside vendorApplications ---
  const patchVendor = (updater) => {
    if (!submittedVendorId) return;
    setVendorApplications((apps) => apps.map((v) => (v.id === submittedVendorId ? updater(v) : v)));
  };

  const updateVendorTopField = (field, value) => patchVendor((v) => ({ ...v, [field]: value }));

  const updateVendorBaseLocation = (id) => patchVendor((v) => ({ ...v, baseLocation: id }));

  const updateVendorServiceArea = (type) => {
    const option = SERVICE_AREA_OPTIONS.find((o) => o.type === type);
    patchVendor((v) => ({ ...v, serviceArea: option ? { type: option.type, value: option.label } : null }));
  };

  const toggleVendorProfileCategory = (id) =>
    patchVendor((v) => ({
      ...v,
      categories: v.categories.includes(id) ? v.categories.filter((c) => c !== id) : [...v.categories, id],
    }));

  const updateVendorRequestForm = (cat, cfg) => patchVendor((v) => ({ ...v, requestForms: { ...(v.requestForms || {}), [cat]: cfg } }));
  const updateVendorProfileField = (field, value) => patchVendor((v) => ({ ...v, profile: { ...v.profile, [field]: value } }));

  const addVendorImage = (url) => patchVendor((v) => ({ ...v, profile: { ...v.profile, images: [...v.profile.images, url] } }));
  const removeVendorImage = (index) =>
    patchVendor((v) => ({ ...v, profile: { ...v.profile, images: v.profile.images.filter((_, i) => i !== index) } }));

  const addVendorService = () =>
    patchVendor((v) => ({
      ...v,
      profile: {
        ...v.profile,
        services: [
          ...v.profile.services,
          { id: "srv-" + Date.now(), name: "", description: "", priceType: "fixed", price: "", priceNote: "", category: v.categories[0] || "" },
        ],
      },
    }));
  const updateVendorService = (id, field, value) =>
    patchVendor((v) => ({
      ...v,
      profile: { ...v.profile, services: v.profile.services.map((s) => (s.id === id ? { ...s, [field]: value } : s)) },
    }));
  const removeVendorService = (id) =>
    patchVendor((v) => ({ ...v, profile: { ...v.profile, services: v.profile.services.filter((s) => s.id !== id) } }));

  const addVendorAddon = () =>
    patchVendor((v) => ({
      ...v,
      profile: { ...v.profile, addons: [...v.profile.addons, { id: "addon-" + Date.now(), name: "", price: "" }] },
    }));
  const updateVendorAddon = (id, field, value) =>
    patchVendor((v) => ({
      ...v,
      profile: { ...v.profile, addons: v.profile.addons.map((a) => (a.id === id ? { ...a, [field]: value } : a)) },
    }));
  const removeVendorAddon = (id) =>
    patchVendor((v) => ({ ...v, profile: { ...v.profile, addons: v.profile.addons.filter((a) => a.id !== id) } }));

  // --- Admin (Fas 3) ---
  const goAdminDashboard = () => {
    setView("adminDashboard");
    setMobileMenuOpen(false);
  };
  const goAdminVendorDetail = (id) => {
    setActiveAdminVendorId(id);
    setView("adminVendorDetail");
  };
  const approveVendor = async (id) => {
    setVendorApplications((apps) => apps.map((v) => (v.id === id ? { ...v, status: "approved" } : v)));
    showToast("Leverantören är godkänd ✓");
    if (!id.startsWith("VND-") && session?.access_token) {
      await supabaseRestRequest(`/vendors?id=eq.${id}`, session.access_token, { method: "PATCH", body: JSON.stringify({ status: "approved" }) });
    }
  };
  const rejectVendor = async (id) => {
    setVendorApplications((apps) => apps.map((v) => (v.id === id ? { ...v, status: "rejected" } : v)));
    showToast("Ansökan har avslagits");
    if (!id.startsWith("VND-") && session?.access_token) {
      await supabaseRestRequest(`/vendors?id=eq.${id}`, session.access_token, { method: "PATCH", body: JSON.stringify({ status: "rejected" }) });
    }
  };
  const activeAdminVendor = vendorApplications.find((v) => v.id === activeAdminVendorId) || null;

  const activeProvider = customerProviders.find((p) => p.id === activeProviderId);
  const activeCartEntry = activeProvider ? cartItems.find((ci) => ci.id === activeProvider.id) : null;
  const isAdminView = ["adminDashboard", "adminVendorDetail"].includes(view);
  // Vendor mode: a vendor account sees the vendor portal on every page, never the customer front page, cart or customer menu.
  const vendorMode = !!submittedVendor && !customerMode && !isAdminView;
  const isVendorPortalView =
    vendorMode || ["vendorPending", "vendorDashboard", "vendorProfileEditor", "vendorProfilePreview", "vendorBookings", "vendorInbox"].includes(view);
  const leavePage = () => (vendorMode ? goVendorDashboard() : goHome());
  useEffect(() => {
    if (vendorMode && ["home", "results", "profile", "checkout", "confirmation", "planning", "minaBokningar", "vendorIntro"].includes(view)) setView("vendorDashboard");
  }, [vendorMode, view]);

  const centerNavLinks = (
    <>
      <button
        onClick={() => {
          goHome();
          setMobileMenuOpen(false);
        }}
      >
        Bygg din fest
      </button>
      <button
        onClick={() => {
          setParty((p) => ({ ...p, categories: [] }));
          setSwapContext(null);
          setView("results");
          setMobileMenuOpen(false);
        }}
      >
        Leverantörer
      </button>
      <button
        onClick={() => {
          goMinaBokningar();
        }}
      >
        Mina bokningar
      </button>
      <button onClick={goPlanning} className="flex items-center gap-1.5">
        Min planering
        {favoriteIds.size > 0 && <Heart size={12} fill={BADGE_RED} color={BADGE_RED} />}
      </button>
      <button
        onClick={() => {
          if (view !== "home") goHome();
          setMobileMenuOpen(false);
          setTimeout(() => howItWorksRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }}
      >
        Så fungerar det
      </button>
      <button
        onClick={() => {
          setSupportOpen(true);
          setMobileMenuOpen(false);
        }}
      >
        Support
      </button>
    </>
  );

  const minFestButton = (
    <button
      onClick={() => {
        setCartOpen(true);
        setMobileMenuOpen(false);
      }}
      className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
      style={{ backgroundColor: colors.lilacDeep, color: colors.white }}
    >
      <PartyPopper size={15} />
      Min fest
      {cartItems.length > 0 && (
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full text-xs"
          style={{ backgroundColor: colors.coral, color: colors.white }}
        >
          {cartItems.length}
        </span>
      )}
    </button>
  );

  const vendorPortalNavLinks = (
    <>
      <button
        onClick={() => {
          goVendorDashboard();
          setMobileMenuOpen(false);
        }}
      >
        Min profil
      </button>
      <button
        onClick={() => {
          goVendorBookings();
          setMobileMenuOpen(false);
        }}
      >
        Bokningar
      </button>
      <button
        onClick={() => {
          goVendorInbox();
          setMobileMenuOpen(false);
        }}
        className="flex items-center gap-1.5"
      >
        Meddelanden
        {unreadTotal > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-bold" style={{ backgroundColor: BADGE_RED, color: colors.white }}>
            {unreadTotal}
          </span>
        )}
      </button>
      <button
        onClick={() => {
          goVendorPreview();
          setMobileMenuOpen(false);
        }}
      >
        Förhandsvisa
      </button>
      <button
        onClick={() => {
          goMyAccount();
          setMobileMenuOpen(false);
        }}
      >
        Mitt konto
      </button>
    </>
  );

  const vendorLogoutButton = (
    <button
      onClick={() => {
        signOut();
        setMobileMenuOpen(false);
      }}
      className="text-sm font-medium"
      style={{ color: colors.plum }}
    >
      Logga ut
    </button>
  );

  const adminExitLink = (
    <button onClick={goHome} className="text-sm font-medium" style={{ color: colors.plum }}>
      Till Planifest
    </button>
  );

  return (
    <FavoritesContext.Provider value={{ ids: favoriteIds, toggle: toggleFavorite }}>
    <div style={{ fontFamily: sans, backgroundColor: colors.cream, minHeight: "100%", color: colors.plum }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
        input[type="date"]::-webkit-calendar-picker-indicator, input[type="time"]::-webkit-calendar-picker-indicator { cursor: pointer; }
        @keyframes planifest-wiggle { 0%,100% { transform: rotate(0); } 15% { transform: rotate(-14deg); } 30% { transform: rotate(12deg); } 45% { transform: rotate(-8deg); } 60% { transform: rotate(6deg); } 75% { transform: rotate(-3deg); } }
        @keyframes planifest-ring { 0% { box-shadow: 0 0 0 0 rgba(139,101,137,0.55), 0 8px 20px rgba(0,0,0,0.15); } 70%, 100% { box-shadow: 0 0 0 16px rgba(139,101,137,0), 0 8px 20px rgba(0,0,0,0.15); } }
        @keyframes planifest-pop { 0% { transform: scale(1); } 40% { transform: scale(1.4); } 100% { transform: scale(1); } }
        @keyframes planifest-confetti { 0% { transform: translate(0, 0) rotate(0); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { [style*="planifest-"] { animation: none !important; } }
      `}</style>

      {/* Top nav */}
      <div className="sticky top-0 z-30" style={{ backgroundColor: "rgba(251,244,238,0.92)", backdropFilter: "blur(6px)", borderBottom: `1px solid ${colors.beige}` }}>
        <div className="flex items-center justify-between gap-4 px-6 py-4 sm:px-10">
          <div className="flex items-center gap-8">
            <Logo onClick={vendorMode ? goVendorDashboard : goHome} />
            <div className="hidden items-center gap-6 text-sm font-medium lg:flex" style={{ color: colors.plum }}>
              {isVendorPortalView ? vendorPortalNavLinks : centerNavLinks}
            </div>
          </div>
          <div className="hidden items-center gap-4 lg:flex">
            {isVendorPortalView ? (
              vendorLogoutButton
            ) : isAdminView ? (
              adminExitLink
            ) : (
              <>
                <button
                  onClick={goVendorIntro}
                  className="flex items-center gap-1.5 text-sm font-medium"
                  style={{ color: colors.plumSoft }}
                >
                  <Briefcase size={14} /> {submittedVendor ? "Min portal" : "Bli leverantör"}
                </button>
                {session && profile ? (
                  <div className="flex items-center gap-3">
                    <button onClick={goMyAccount} className="text-sm font-medium underline" style={{ color: colors.plum }}>
                      {profile.full_name || session.user.email}
                    </button>
                    <button onClick={signOut} className="text-sm font-medium" style={{ color: colors.plumSoft }}>
                      Logga ut
                    </button>
                  </div>
                ) : (
                  <button onClick={() => openAuthModal("signin")} className="text-sm font-medium" style={{ color: colors.plum }}>
                    Logga in
                  </button>
                )}
                {minFestButton}
                {profile?.role === "admin" && (
                  <button onClick={goAdminDashboard} className="flex items-center gap-1 text-xs" style={{ color: colors.plumSoft, opacity: 0.6 }}>
                    <Shield size={12} /> Admin
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            {!isVendorPortalView && !isAdminView && minFestButton}
            <button className="-m-2 p-2" onClick={() => setMobileMenuOpen((v) => !v)} aria-label="Meny">
              {mobileMenuOpen ? <X size={22} color={colors.plum} /> : <Menu size={22} color={colors.plum} />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div
            className="flex flex-col gap-1 px-6 pb-4 text-sm font-medium lg:hidden"
            style={{ color: colors.plum, borderTop: `1px solid ${colors.beige}` }}
          >
            {isVendorPortalView ? (
              <>
                <div className="flex flex-col items-start gap-3 pt-3 [&>button]:text-left">{vendorPortalNavLinks}</div>
                <button
                  onClick={() => {
                    signOut();
                    setMobileMenuOpen(false);
                  }}
                  className="mt-3 rounded-full px-4 py-2.5 text-center"
                  style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum }}
                >
                  Logga ut
                </button>
              </>
            ) : isAdminView ? (
              <button
                onClick={() => {
                  goHome();
                  setMobileMenuOpen(false);
                }}
                className="mt-3 rounded-full px-4 py-2.5 text-center"
                style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum }}
              >
                Till Planifest
              </button>
            ) : (
              <>
                <div className="flex flex-col items-start gap-3 pt-3 [&>button]:text-left">{centerNavLinks}</div>
                <button
                  onClick={goVendorIntro}
                  className="mt-3 flex items-center gap-1.5 rounded-full px-4 py-2.5"
                  style={{ border: `1.5px solid ${colors.lilac}`, color: colors.lilacDeep }}
                >
                  <Briefcase size={14} /> {submittedVendor ? "Min portal" : "Bli leverantör"}
                </button>
                {session && profile ? (
                  <>
                    <button
                      onClick={goMyAccount}
                      className="mt-2 rounded-full px-4 py-2.5 text-center"
                      style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum }}
                    >
                      Mitt konto ({profile.full_name || session.user.email})
                    </button>
                    <button
                      onClick={() => {
                        signOut();
                        setMobileMenuOpen(false);
                      }}
                      className="mt-2 rounded-full px-4 py-2.5 text-center"
                      style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum }}
                    >
                      Logga ut
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => openAuthModal("signin")}
                    className="mt-2 rounded-full px-4 py-2.5 text-center"
                    style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum }}
                  >
                    Logga in
                  </button>
                )}
                {profile?.role === "admin" && (
                  <button
                    onClick={() => {
                      goAdminDashboard();
                      setMobileMenuOpen(false);
                    }}
                    className="mt-3 flex items-center gap-1 self-center text-xs"
                    style={{ color: colors.plumSoft }}
                  >
                    <Shield size={11} /> Admin
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {view === "home" && (
        <HomeView party={party} setParty={setParty} onSubmit={startBuilder} howItWorksRef={howItWorksRef} />
      )}

      {view === "results" && (
        <ResultsView
          party={party}
          setParty={setParty}
          groups={groupedProviders}
          swapProviders={swapProviders}
          cart={cartProviderIds}
          onView={viewProfile}
          onAdd={addToCart}
          onRemove={removeFromCart}
          sortBy={sortBy}
          setSortBy={setSortBy}
          distanceFilter={distanceFilter}
          setDistanceFilter={setDistanceFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          swapContext={swapContext}
          onCancelSwap={() => {
            setSwapContext(null);
            setCartOpen(true);
          }}
        />
      )}

      {view === "profile" && activeProvider && (
        <ProfileView
          key={activeProvider.id}
          provider={activeProvider}
          party={party}
          inCart={!!activeCartEntry}
          cartAddons={activeCartEntry?.addons}
          onBack={() => setView("results")}
          onAdd={addToCart}
          onRemove={removeFromCart}
          onToggleAddon={toggleAddon}
          onOpenChat={openProviderChat}
          onSelectDate={(date) => setParty((p) => ({ ...p, date }))}
          onUpdateParty={(patch) => setParty((p) => ({ ...p, ...patch }))}
          onSendRequest={sendRequest}
        />
      )}

      {view === "guestCheck" && <GuestCheckView email={guestPendingEmail} onHome={goHome} />}

      {view === "guestBooking" && (
        <GuestBookingView state={guestBooking} onCancel={cancelGuestBooking} onHome={goHome} onCreateAccount={() => openAuthModal("signup")} />
      )}

      {view === "checkout" && (
        <CheckoutView
          cart={cart}
          party={party}
          session={session}
          onOpenCart={() => setCartOpen(true)}
          onConfirm={confirmBooking}
          onGuestConfirm={submitGuestBooking}
          onLogin={() => openAuthModal("signin")}
          guestError={guestError}
          guestSubmitting={guestSubmitting}
          guestBlockReason={guestBlockReason}
          onOpenTerms={goTerms}
          events={events}
          eventChoice={bookingEventId || activeEventId || "none"}
          onEventChoice={setBookingEventId}
        />
      )}

      {view === "confirmation" && <ConfirmationView booking={lastBooking} onRestart={restart} onMinaBokningar={goMinaBokningar} />}

      {view === "rsvp" && <RsvpView state={rsvp} onSubmit={submitRsvp} onHome={goHome} />}

      {view === "planning" && (
        <PlanningView
          session={session}
          events={events}
          activeEventId={activeEventId}
          onSelectEvent={setActiveEventId}
          onCreateEvent={createEvent}
          onUpdateEvent={updateEvent}
          onDeleteEvent={deleteEvent}
          taskApi={taskApi}
          budgetApi={budgetApi}
          guestApi={guestApi}
          bookings={bookings}
          savedProviders={savedProviders}
          onViewProvider={viewProfile}
          party={party}
          onLogin={() => openAuthModal("signin")}
          onSignup={() => openAuthModal("signup")}
        />
      )}

      {view === "minaBokningar" && (
        <MinaBokningarView bookings={bookings} onCancelBooking={cancelBooking} onReviewItem={openReview} onChatItem={openBookingChat} />
      )}

      {view === "vendorIntro" && <VendorIntroView onStart={startVendorSignup} />}

      {view === "vendorSignup" && (
        <VendorSignupView
          step={vendorStep}
          form={vendorForm}
          errors={vendorErrors}
          onField={updateVendorField}
          onToggleCategory={toggleVendorCategory}
          onNext={vendorNext}
          onBack={vendorBack}
          onSubmit={submitVendorApplication}
          onShowToast={showToast}
          submitError={vendorSubmitError}
          submitting={vendorSubmitting}
          onOpenTerms={goTerms}
          hasAccount={!!session}
          accountEmail={session?.user?.email}
        />
      )}

      {view === "vendorAwaitingConfirmation" && <VendorAwaitingConfirmationView email={vendorForm.email} onHome={goHome} />}

      {view === "resetPassword" && <ResetPasswordView onSubmit={submitNewPassword} onShowToast={showToast} />}

      {view === "myAccount" && session && (
        <MyAccountView
          profile={profile}
          email={session.user.email}
          onSaveProfile={saveMyProfile}
          onChangePassword={changeMyPassword}
          onBack={leavePage}
          isVendor={!!submittedVendor}
          customerMode={customerMode}
          onSwitchMode={switchMode}
        />
      )}

      {view === "vendorPending" && <VendorPendingView vendor={submittedVendor} onHome={goHome} onGoDashboard={goVendorDashboard} />}

      {view === "vendorDashboard" && (
        <VendorDashboardView
          vendor={submittedVendor}
          bookingItems={vendorBookingItems}
          onEditProfile={goVendorEditor}
          onPreview={goVendorPreview}
          onBookings={goVendorBookings}
          onInbox={goVendorInbox}
          onRespond={respondToBookingItem}
          conversationCount={vendorConversations.length}
        />
      )}

      {view === "vendorInbox" && (
        <VendorInboxView
          conversations={vendorConversations}
          activeConversationId={activeVendorConversationId}
          messages={activeVendorConversationId ? realMessages[activeVendorConversationId] || [] : []}
          onOpenConversation={openVendorConversation}
          onSendMessage={sendVendorMessage}
          onSendQuote={sendVendorQuote}
          onBack={closeVendorConversation}
          inboxById={Object.fromEntries(inbox.map((c) => [c.conversation_id, c]))}
          quoteFromBrief={quoteFromBrief}
        />
      )}

      {view === "vendorProfileEditor" && (
        <VendorProfileEditorView
          vendor={submittedVendor}
          onRequestForm={updateVendorRequestForm}
          onField={updateVendorTopField}
          onBaseLocation={updateVendorBaseLocation}
          onServiceArea={updateVendorServiceArea}
          onToggleCategory={toggleVendorProfileCategory}
          onProfileField={updateVendorProfileField}
          onAddImage={addVendorImage}
          onRemoveImage={removeVendorImage}
          onAddService={addVendorService}
          onUpdateService={updateVendorService}
          onRemoveService={removeVendorService}
          onAddAddon={addVendorAddon}
          onUpdateAddon={updateVendorAddon}
          onRemoveAddon={removeVendorAddon}
          onPreview={saveAndGoPreview}
          onDashboard={saveAndGoDashboard}
          onShowToast={showToast}
        />
      )}

      {view === "vendorProfilePreview" && <VendorProfilePreviewView vendor={submittedVendor} onBack={goVendorEditor} />}

      {view === "vendorBookings" && (
        <VendorBookingsView
          vendor={submittedVendor}
          bookingItems={vendorBookingItems}
          onRespond={respondToBookingItem}
          onAddBlockedTime={addBlockedTime}
          onRemoveBlockedTime={removeBlockedTime}
          onFetchGuestContact={fetchGuestContact}
        />
      )}

      {view === "adminDashboard" && (
        <AdminDashboardView vendorApplications={vendorApplications} filter={adminFilter} onFilterChange={setAdminFilter} onOpenVendor={goAdminVendorDetail} />
      )}

      {view === "adminVendorDetail" && (
        <AdminVendorDetailView
          vendor={activeAdminVendor}
          onBack={goAdminDashboard}
          onApprove={(id) => {
            approveVendor(id);
            goAdminDashboard();
          }}
          onReject={(id) => {
            rejectVendor(id);
            goAdminDashboard();
          }}
        />
      )}

      {view === "privacyPolicy" && <LegalPageView title="Integritetspolicy" sections={PRIVACY_POLICY_SECTIONS} onBack={leavePage} />}
      {view === "terms" && <LegalPageView title="Allmänna villkor" sections={TERMS_SECTIONS} onBack={leavePage} />}
      {view === "cookiePolicy" && <LegalPageView title="Cookiepolicy" sections={COOKIE_POLICY_SECTIONS} onBack={leavePage} />}

      {vendorMode && <VendorFooter onOpenTerms={goTerms} onOpenPrivacy={goPrivacyPolicy} onOpenCookies={goCookiePolicy} onSupport={() => setSupportOpen(true)} />}

      {!isVendorPortalView && !isAdminView && !["checkout", "confirmation", "vendorSignup", "vendorAwaitingConfirmation", "resetPassword", "privacyPolicy", "terms", "cookiePolicy"].includes(view) && (
        <Footer
          onGoHome={goHome}
          onBrowse={() => {
            setParty((p) => ({ ...p, categories: [] }));
            setSwapContext(null);
            setView("results");
          }}
          onHowItWorks={() => {
            if (view !== "home") goHome();
            setTimeout(() => howItWorksRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
          }}
          onBecomeVendor={goVendorIntro}
          onOpenTerms={goTerms}
          onOpenPrivacy={goPrivacyPolicy}
          onOpenCookies={goCookiePolicy}
          onShowToast={showToast}
        />
      )}

      {/* Floating cart button */}
      {cartItems.length > 0 &&
        !["confirmation", "vendorIntro", "vendorSignup"].includes(view) &&
        !isVendorPortalView &&
        !isAdminView &&
        !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full px-5 py-3 shadow-lg"
          style={{ backgroundColor: colors.plum, color: colors.white }}
        >
          <ShoppingBag size={18} />
          <span className="text-sm font-semibold">
            <span className="hidden sm:inline">Min fest · </span>
            {cartItems.length} · {formatKr(total)}
          </span>
        </button>
      )}

      {!isVendorPortalView && !isAdminView && (
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        party={party}
        onSwap={openSwap}
        onRemove={removeFromCart}
        onToggleAddon={toggleAddon}
        onGoCheckout={goCheckout}
        onAddForCategory={() => {
          setCartOpen(false);
          setView("results");
        }}
        onKeepBrowsing={() => {
          setCartOpen(false);
          if (view !== "results" && view !== "profile") setView("results");
        }}
      />
      )}

      <ReviewModal target={reviewTarget} onSubmit={submitReview} onClose={closeReview} />
      <ChatModal
        target={chatTarget}
        messages={chatTarget?.real ? realMessages[chatTarget.conversationId] || [] : chatTarget ? chats[getChatKey(chatTarget)] || [] : []}
        vendorTyping={!chatTarget?.real && vendorTyping}
        onSend={sendChatMessage}
        onClose={closeChat}
        onAcceptQuote={acceptQuote}
        onDeclineQuote={declineQuote}
        onOpenCart={() => {
          closeChat();
          setCartOpen(true);
        }}
      />
      {session && profile && !isAdminView && (
        <>
          <MessagesPanel
            open={panelOpen && !isVendorPortalView}
            conversations={inbox}
            soundOn={soundOn}
            onToggleSound={toggleSound}
            onOpen={openConversationFromPanel}
            onClose={() => setPanelOpen(false)}
          />
          <ChatBubble
            count={unreadTotal}
            onClick={() => {
              if (isVendorPortalView) {
                setPanelOpen(false);
                goVendorInbox();
              } else {
                setPanelOpen((o) => !o);
              }
            }}
          />
        </>
      )}
      <AuthModal
        open={authModalOpen}
        mode={authModalMode}
        onModeChange={setAuthModalMode}
        onClose={() => setAuthModalOpen(false)}
        onSignIn={signIn}
        onSignUp={signUpCustomer}
        onForgotPassword={requestPasswordReset}
      />
      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} onSubmit={submitSupportMessage} defaultEmail={session?.user?.email || ""} />
      <Toast message={toast} />
      {cookieConsent === null && (
        <CookieConsentBanner onAcceptAll={() => setConsent("all")} onNecessaryOnly={() => setConsent("necessary")} onOpenPolicy={goCookiePolicy} />
      )}
    </div>
    </FavoritesContext.Provider>
  );
}
