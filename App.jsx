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
  Gift,
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
  Home,
  User,
  Projector,
  Mic,
  Trophy,
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
  babyshower: [
    [8, "Bestäm datum, tema och budget"], [7, "Gör gästlista"], [6, "Boka lokal eller bestäm plats hemma"], [5, "Skicka inbjudningar"],
    [4, "Beställ tårta"], [3, "Planera mat och dryck"], [3, "Köp dekor och ballonger"], [2, "Planera lekar och aktiviteter"],
    [1, "Bekräfta leverantörer"], [1, "Handla det sista"],
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
  yes: { label: "Kommer", bg: "#DCEBD3", fg: "#2F5A2C" },
  maybe: { label: "Kanske", bg: "#F8DDE3", fg: "#7D2248" },
  no: { label: "Kan inte", bg: "#FBDCD8", fg: "#9B2B3A" },
  pending: { label: "Ej svarat", bg: "#F3E8DB", fg: "#6E4F62" },
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
  email: g.email || "",
  emailOptout: !!g.email_optout,
  invitedAt: g.invited_at || null,
  lastRemindedAt: g.last_reminded_at || null,
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
  trycksaker: [
    { id: "items", label: "Vad vill ni ha?", type: "long", required: true },
    { id: "count", label: "Antal", type: "number" },
    { id: "text", label: "Namn eller text som ska stå på", type: "short" },
    { id: "colors", label: "Färger och stil", type: "short" },
    { id: "delivery", label: "Hämtning eller leverans", type: "single", options: choices(["Hämtar själv", "Leverans"]) },
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
const BADGE_RED = "#E85D48";

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

// --- Vendor images: shrunk in the browser, stored in Supabase Storage, only the link goes in the database ---
const IMAGE_BUCKET = "vendor-images";
const IMAGE_PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/`;

async function shrinkImage(file, maxSide = 1600) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (e) {
    bitmap = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("decode"));
      };
      img.src = url;
    });
  }
  const w = bitmap.width || bitmap.naturalWidth;
  const h = bitmap.height || bitmap.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; // transparent PNGs become white instead of black in a JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (bitmap.close) bitmap.close();
  const toBlob = (q) => new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", q));
  let blob = await toBlob(0.82);
  if (blob && blob.size > 1400 * 1024) blob = await toBlob(0.65);
  if (!blob || blob.size > 1500 * 1024) throw new Error("size");
  return blob;
}

// Returns { url } or { error }. Needs a signed-in vendor: the storage rules only allow writes to the user's own folder.
async function uploadVendorImage(file, session) {
  if (!session?.access_token || !session?.user?.id) return { error: "Du måste vara inloggad för att ladda upp bilder." };
  if (!file.type.startsWith("image/")) return { error: `${file.name} är inte en bild.` };
  let blob;
  try {
    blob = await shrinkImage(file);
  } catch (e) {
    return { error: `Kunde inte läsa ${file.name}. Prova en JPG- eller PNG-bild.` };
  }
  const path = `${session.user.id}/${newId()}.jpg`;
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${IMAGE_BUCKET}/${path}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": "image/jpeg", "Cache-Control": "31536000" },
      body: blob,
    });
    if (!res.ok) return { error: `Uppladdningen av ${file.name} misslyckades. Försök igen.` };
    return { url: IMAGE_PUBLIC_PREFIX + path };
  } catch (e) {
    return { error: "Nådde inte servern. Kontrollera din uppkoppling och försök igen." };
  }
}

// Best effort: when a vendor removes one of their own uploaded images, free the space too.
function deleteVendorImageFile(url, session) {
  if (!session?.access_token || typeof url !== "string" || !url.startsWith(IMAGE_PUBLIC_PREFIX)) return;
  const path = url.slice(IMAGE_PUBLIC_PREFIX.length);
  if (!path.startsWith(`${session.user?.id}/`)) return;
  fetch(`${SUPABASE_URL}/storage/v1/object/${IMAGE_BUCKET}/${path}`, {
    method: "DELETE",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Stories — approved vendors post a photo or a short video that is shown for
// 24 hours, like on Instagram. Files live in the public "vendor-stories"
// bucket (one folder per user); the rows live in public.vendor_stories, whose
// RLS only returns stories that haven't expired yet.
// ---------------------------------------------------------------------------
const STORY_BUCKET = "vendor-stories";
const STORY_PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${STORY_BUCKET}/`;
const STORY_SEEN_KEY = "planifest-stories-seen";
const STORY_IMAGE_MS = 5000;
const STORY_MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const STORY_MAX_VIDEO_SECONDS = 60;
const STORY_VIDEO_TYPES = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };

function readVideoDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(v.duration) ? v.duration : null);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    v.src = url;
  });
}

// Returns { url, mediaType } or { error }.
async function uploadStoryMedia(file, session) {
  if (!session?.access_token || !session?.user?.id) return { error: "Du måste vara inloggad för att lägga upp en story." };
  let body;
  let contentType;
  let ext;
  let mediaType;
  if (file.type.startsWith("image/")) {
    try {
      body = await shrinkImage(file, 1440);
    } catch (e) {
      return { error: "Kunde inte läsa bilden. Prova en JPG- eller PNG-bild." };
    }
    contentType = "image/jpeg";
    ext = "jpg";
    mediaType = "image";
  } else if (STORY_VIDEO_TYPES[file.type]) {
    if (file.size > STORY_MAX_VIDEO_BYTES) return { error: "Videon är för stor. Max 25 MB – prova en kortare video." };
    const seconds = await readVideoDuration(file);
    if (seconds != null && seconds > STORY_MAX_VIDEO_SECONDS + 1) return { error: "Videon är för lång. Max 60 sekunder." };
    body = file;
    contentType = file.type;
    ext = STORY_VIDEO_TYPES[file.type];
    mediaType = "video";
  } else {
    return { error: "Välj en bild eller en video (MP4, MOV eller WebM)." };
  }
  const path = `${session.user.id}/${newId()}.${ext}`;
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORY_BUCKET}/${path}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": contentType, "Cache-Control": "86400" },
      body,
    });
    if (!res.ok) return { error: "Uppladdningen misslyckades. Försök igen." };
    return { url: STORY_PUBLIC_PREFIX + path, mediaType };
  } catch (e) {
    return { error: "Nådde inte servern. Kontrollera din uppkoppling och försök igen." };
  }
}

function deleteStoryFile(url, session) {
  if (!session?.access_token || typeof url !== "string" || !url.startsWith(STORY_PUBLIC_PREFIX)) return;
  const path = url.slice(STORY_PUBLIC_PREFIX.length);
  fetch(`${SUPABASE_URL}/storage/v1/object/${STORY_BUCKET}/${path}`, {
    method: "DELETE",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
  }).catch(() => {});
}

function storyTimeAgo(iso) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "nyss";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} tim`;
}

function readSeenStories() {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(STORY_SEEN_KEY) || "[]"));
  } catch (e) {
    return new Set();
  }
}

function StoryRings({ groups, seen, onOpen }) {
  return (
    <div className="mx-auto flex max-w-5xl gap-4 overflow-x-auto px-5 pb-2 sm:gap-6 sm:px-8">
      {groups.map((g, i) => {
        const unseen = g.stories.some((s) => !seen.has(s.id));
        return (
          <button key={g.key} onClick={() => onOpen(i)} aria-label={`Visa story från ${g.name}`} className="flex w-[78px] flex-shrink-0 flex-col items-center gap-2">
            <span
              className="flex h-[74px] w-[74px] rounded-full p-[3px]"
              style={{ background: unseen ? `conic-gradient(${colors.korall}, ${colors.coral}, ${colors.lilac}, ${colors.korall})` : colors.beige }}
            >
              <span className="h-full w-full overflow-hidden rounded-full" style={{ border: `3px solid ${colors.cream}`, backgroundColor: colors.coralSoft }}>
                {g.avatar && <img src={g.avatar} alt="" className="h-full w-full object-cover" />}
              </span>
            </span>
            <span className="w-full truncate text-center text-xs font-semibold" style={{ color: colors.plum }}>{g.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function StoryViewer({ groups, startIndex, onClose, onSeen, onViewProvider, canDelete, onDelete }) {
  const [gi, setGi] = useState(startIndex);
  const [si, setSi] = useState(0);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef(null);
  const group = groups[gi];
  const story = group?.stories[si];

  const next = () => {
    if (!group) return onClose();
    if (si < group.stories.length - 1) {
      setSi(si + 1);
    } else if (gi < groups.length - 1) {
      setGi(gi + 1);
      setSi(0);
    } else {
      onClose();
    }
  };
  const prev = () => {
    if (si > 0) setSi(si - 1);
    else if (gi > 0) {
      setGi(gi - 1);
      setSi(Math.max(0, groups[gi - 1].stories.length - 1));
    } else setProgress(0);
  };

  useEffect(() => {
    setProgress(0);
    if (story) onSeen(story.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // Photos advance on a timer; videos advance when they end.
  useEffect(() => {
    if (!story || story.type !== "image" || paused) return;
    const started = Date.now() - progress * STORY_IMAGE_MS;
    const t = setInterval(() => {
      const p = (Date.now() - started) / STORY_IMAGE_MS;
      if (p >= 1) {
        clearInterval(t);
        next();
      } else setProgress(p);
    }, 50);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, paused]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    else v.play().catch(() => {});
  }, [paused, story?.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  });

  if (!group || !story) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={`Story från ${group.name}`} className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: "#1E0816" }}>
      <div className="relative h-full w-full overflow-hidden sm:h-[92vh] sm:max-w-[440px] sm:rounded-3xl" style={{ backgroundColor: "#000" }}>
        {story.type === "video" ? (
          <video
            key={story.id}
            ref={videoRef}
            src={story.url}
            autoPlay
            playsInline
            muted={muted}
            onTimeUpdate={(e) => e.currentTarget.duration && setProgress(e.currentTarget.currentTime / e.currentTarget.duration)}
            onEnded={next}
            className="h-full w-full object-contain"
          />
        ) : (
          <img key={story.id} src={story.url} alt={`Story från ${group.name}`} className="h-full w-full object-contain" />
        )}

        <div className="absolute inset-x-0 top-0 p-3" style={{ background: "linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0))" }}>
          <div className="flex gap-1">
            {group.stories.map((s, i) => (
              <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.35)" }}>
                <span className="block h-full rounded-full" style={{ backgroundColor: colors.white, width: `${i < si ? 100 : i === si ? Math.round(progress * 100) : 0}%` }} />
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <span className="h-9 w-9 overflow-hidden rounded-full" style={{ border: "2px solid #fff", backgroundColor: colors.coralSoft }}>
              {group.avatar && <img src={group.avatar} alt="" className="h-full w-full object-cover" />}
            </span>
            <span className="min-w-0 flex-1 text-white">
              <span className="block truncate text-sm font-semibold">{group.name}</span>
              <span className="block text-xs opacity-80">{storyTimeAgo(story.createdAt)}</span>
            </span>
            {story.type === "video" && (
              <button onClick={() => setMuted((m) => !m)} aria-label={muted ? "Slå på ljud" : "Stäng av ljud"} className="flex h-11 w-11 items-center justify-center text-white">
                {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
              </button>
            )}
            {canDelete(group, story) && (
              <button
                onClick={() => {
                  onDelete(story);
                  next();
                }}
                aria-label="Ta bort storyn"
                className="flex h-11 w-11 items-center justify-center text-white"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button onClick={onClose} aria-label="Stäng" className="flex h-11 w-11 items-center justify-center text-white">
              <X size={26} />
            </button>
          </div>
        </div>

        <button aria-label="Föregående" onClick={prev} className="absolute bottom-24 left-0 top-24 w-1/3" style={{ background: "transparent" }} />
        <button
          aria-label="Nästa"
          onClick={next}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
          className="absolute bottom-24 right-0 top-24 w-2/3"
          style={{ background: "transparent" }}
        />

        {group.providerId && (
          <div className="absolute inset-x-0 bottom-0 flex justify-center p-5" style={{ background: "linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.5))" }}>
            <button
              onClick={() => {
                onClose();
                onViewProvider(group.providerId);
              }}
              className="flex h-12 items-center gap-2 rounded-full px-6 text-sm font-bold"
              style={{ backgroundColor: colors.white, color: colors.plum }}
            >
              Visa {group.name} <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StoryThumb({ story, children }) {
  return (
    <div className="relative h-36 w-24 flex-shrink-0 overflow-hidden rounded-2xl" style={{ backgroundColor: colors.coralSoft }}>
      {story.type === "video" ? <video src={story.url} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={story.url} alt="" className="h-full w-full object-cover" />}
      {children}
    </div>
  );
}

function StoryManager({ approved, stories, highlights, uploading, onUpload, onDelete, onSaveToHighlight, onRemoveFromHighlight, onDeleteHighlight }) {
  const inputRef = useRef(null);
  const [saving, setSaving] = useState(null); // story being filed into a highlight
  const [choice, setChoice] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const now = Date.now();
  const active = stories.filter((s) => new Date(s.expiresAt).getTime() > now);
  const smallBtn = "absolute flex h-8 w-8 items-center justify-center rounded-full";
  const smallBtnStyle = { backgroundColor: "rgba(255,255,255,0.92)", color: colors.plum };
  const submitSave = () => {
    const title = newTitle.trim();
    if (choice === "new" && !title) return;
    onSaveToHighlight(saving, choice === "new" ? { title } : { id: choice });
    setSaving(null);
    setChoice("");
    setNewTitle("");
  };

  return (
    <section className="mt-5 rounded-3xl p-5" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold" style={{ color: colors.plum }}>Din story</h2>
          <p className="mt-0.5 text-sm" style={{ color: colors.plumSoft }}>
            {approved ? "Visa vad ni gör just nu. En story syns på startsidan i 24 timmar – spara den i en höjdpunkt så ligger den kvar på din profil." : "Du kan lägga upp stories när din profil är godkänd."}
          </p>
        </div>
        {approved && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files && e.target.files[0];
                e.target.value = "";
                if (f) onUpload(f);
              }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold"
              style={{ backgroundColor: colors.coral, color: colors.white, opacity: uploading ? 0.6 : 1 }}
            >
              <Plus size={16} /> {uploading ? "Laddar upp…" : "Ny story"}
            </button>
          </>
        )}
      </div>

      {active.length > 0 && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {active.map((s) => (
            <StoryThumb key={s.id} story={s}>
              <span className="absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={smallBtnStyle}>
                {storyTimeAgo(s.createdAt)}
              </span>
              <button onClick={() => onDelete(s)} aria-label="Ta bort storyn" className={`${smallBtn} right-1 top-1`} style={smallBtnStyle}>
                <Trash2 size={14} />
              </button>
              {!s.highlightId && (
                <button onClick={() => setSaving(s)} aria-label="Spara i höjdpunkt" className={`${smallBtn} right-1 top-10`} style={smallBtnStyle}>
                  <Heart size={14} />
                </button>
              )}
              {s.highlightId && (
                <span className="absolute right-1 top-10 flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: colors.coral, color: colors.white }} title="Sparad i höjdpunkt">
                  <Heart size={14} fill={colors.white} />
                </span>
              )}
            </StoryThumb>
          ))}
        </div>
      )}

      {saving && (
        <div className="mt-4 rounded-2xl p-4" style={{ backgroundColor: colors.cream }}>
          <p className="text-sm font-semibold" style={{ color: colors.plum }}>Spara i höjdpunkt</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {highlights.map((h) => (
              <PillChip key={h.id} active={choice === h.id} onClick={() => setChoice(h.id)}>
                {h.title}
              </PillChip>
            ))}
            <PillChip active={choice === "new"} onClick={() => setChoice("new")}>
              <Plus size={14} /> Ny höjdpunkt
            </PillChip>
          </div>
          {choice === "new" && (
            <label className="mt-3 flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plumSoft }}>
              Namn, t.ex. "Babyshower" eller "Menyer"
              <input value={newTitle} maxLength={30} onChange={(e) => setNewTitle(e.target.value)} className="h-11 rounded-xl px-3 text-sm" style={{ border: `1px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }} />
            </label>
          )}
          <div className="mt-3 flex gap-2">
            <button onClick={submitSave} disabled={!choice || (choice === "new" && !newTitle.trim())} className="h-10 rounded-full px-5 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white, opacity: !choice || (choice === "new" && !newTitle.trim()) ? 0.5 : 1 }}>
              Spara
            </button>
            <button onClick={() => setSaving(null)} className="h-10 rounded-full px-5 text-sm font-medium" style={{ border: `1px solid ${colors.beige}`, color: colors.plum }}>
              Avbryt
            </button>
          </div>
        </div>
      )}

      {highlights.length > 0 && (
        <div className="mt-5 border-t pt-4" style={{ borderColor: colors.beige }}>
          <h3 className="text-sm font-semibold" style={{ color: colors.plum }}>Höjdpunkter på din profil</h3>
          <div className="mt-2 space-y-4">
            {highlights.map((h) => {
              const list = stories.filter((s) => s.highlightId === h.id);
              return (
                <div key={h.id}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: colors.plum }}>{h.title} <span style={{ color: colors.plumSoft, fontWeight: 400 }}>({list.length})</span></span>
                    <button onClick={() => onDeleteHighlight(h)} className="px-2 py-2 text-xs font-semibold underline" style={{ color: colors.coral }}>
                      Ta bort höjdpunkten
                    </button>
                  </div>
                  {list.length > 0 ? (
                    <div className="mt-1 flex gap-3 overflow-x-auto pb-1">
                      {list.map((s) => (
                        <StoryThumb key={s.id} story={s}>
                          <button onClick={() => onRemoveFromHighlight(s)} aria-label="Ta ur höjdpunkten" className={`${smallBtn} right-1 top-1`} style={smallBtnStyle}>
                            <X size={14} />
                          </button>
                        </StoryThumb>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: colors.plumSoft }}>Tom – spara en story hit med hjärtat.</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {approved && <p className="mt-3 text-xs" style={{ color: colors.plumSoft }}>Bild eller video, max 60 sekunder och 25 MB. Stories syns direkt för alla besökare.</p>}
    </section>
  );
}

// Customer profile picture: a small JPEG in the public "avatars" bucket, one folder per user.
const AVATAR_PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/avatars/`;
async function uploadAvatar(file, session) {
  if (!session?.access_token || !session?.user?.id) return { error: "Du måste vara inloggad." };
  if (!file.type.startsWith("image/")) return { error: "Välj en bild." };
  let blob;
  try {
    blob = await shrinkImage(file, 600);
  } catch (e) {
    return { error: "Kunde inte läsa bilden. Prova en JPG- eller PNG-bild." };
  }
  const path = `${session.user.id}/${newId()}.jpg`;
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${path}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": "image/jpeg", "Cache-Control": "31536000" },
      body: blob,
    });
    if (!res.ok) return { error: "Uppladdningen misslyckades. Försök igen." };
    return { url: AVATAR_PUBLIC_PREFIX + path };
  } catch (e) {
    return { error: "Nådde inte servern. Kontrollera din uppkoppling och försök igen." };
  }
}
function deleteAvatarFile(url, session) {
  if (!session?.access_token || typeof url !== "string" || !url.startsWith(AVATAR_PUBLIC_PREFIX)) return;
  fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${url.slice(AVATAR_PUBLIC_PREFIX.length)}`, {
    method: "DELETE",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
  }).catch(() => {});
}

// Round profile picture that opens the file picker when tapped.
function AvatarPicker({ url, initial, size = 64, uploading, onPick }) {
  const ref = useRef(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          e.target.value = "";
          if (f) onPick(f);
        }}
      />
      <button
        onClick={() => ref.current?.click()}
        disabled={uploading}
        aria-label="Byt profilbild"
        className="relative flex-shrink-0 rounded-full"
        style={{ width: size, height: size, backgroundColor: colors.lilacSoft, border: `2px solid ${colors.white}`, boxShadow: `0 0 0 2px ${colors.lilac}`, opacity: uploading ? 0.6 : 1 }}
      >
        <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full">
          {url ? (
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span style={{ fontFamily: serif, fontWeight: 700, fontSize: size * 0.38, color: colors.coral }}>{initial}</span>
          )}
        </span>
        <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: colors.coral, border: `2px solid ${colors.cream}` }}>
          <Camera size={12} color={colors.white} />
        </span>
      </button>
    </>
  );
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
    rejectionReason: dbVendor.rejection_reason || "",
    resubmittedAt: dbVendor.resubmitted_at || null,
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
      services: [...(dbVendor.services || [])]
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((s) => ({
          id: s.id,
          name: s.name || "",
          description: s.description || "",
          priceType: Number(s.price) > 0 ? s.price_type : "quote", // no price = price by agreement (shown to customers as a request)
          price: s.price,
          priceNote: s.price_note || "",
          fromPrice: Number(s.from_price) > 0 ? Number(s.from_price) : "",
          category: s.category_id || "",
          unitLabel: s.unit_label || "",
          minGuests: s.min_guests ?? "",
          maxGuests: s.max_guests ?? "",
          timeFrom: s.time_from ? String(s.time_from).slice(0, 5) : "",
          timeTo: s.time_to ? String(s.time_to).slice(0, 5) : "",
          minHours: s.min_hours ?? "",
          includes: Array.isArray(s.includes) ? s.includes : [],
          choiceGroups: Array.isArray(s.choice_groups) ? s.choice_groups : [],
        })),
      addons: (dbVendor.addons || []).map((a) => ({
        id: a.id,
        name: a.name || "",
        price: a.price,
        priceType: a.price_type === "per_person" ? "per_person" : "fixed",
        serviceIds: Array.isArray(a.service_ids) ? a.service_ids : [],
      })),
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

  // Packages and add-ons keep their ids between saves (updated in place, only removed ones are deleted),
  // so existing bookings stay linked to the package they were made for.
  const idMap = {};
  const stableId = (id) => (isUuid(id) ? id : (idMap[id] = idMap[id] || newId()));
  const services = vendor.profile.services.map((s, i) => serviceToDb(s, vendor.id, stableId(s.id), i));
  const { error: serviceError } = services.length
    ? await supabaseRestRequest("/services?on_conflict=id", accessToken, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(services),
      })
    : { error: null };
  if (serviceError) return { error: serviceError };
  const keepServices = services.map((s) => s.id);
  await supabaseRestRequest(
    `/services?vendor_id=eq.${vendor.id}${keepServices.length ? `&id=not.in.(${keepServices.join(",")})` : ""}`,
    accessToken,
    { method: "DELETE" }
  );

  const addons = vendor.profile.addons
    .filter((a) => String(a.name || "").trim())
    .map((a) => ({
      id: stableId(a.id),
      vendor_id: vendor.id,
      name: String(a.name).trim().slice(0, 80),
      price: Math.max(0, Math.round(Number(a.price) || 0)),
      price_type: a.priceType === "per_person" ? "per_person" : "fixed",
      service_ids: (a.serviceIds || []).map(stableId).filter((sid) => keepServices.includes(sid)),
    }));
  const { error: addonError } = addons.length
    ? await supabaseRestRequest("/addons?on_conflict=id", accessToken, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(addons),
      })
    : { error: null };
  if (addonError) return { error: addonError };
  const keepAddons = addons.map((a) => a.id);
  await supabaseRestRequest(
    `/addons?vendor_id=eq.${vendor.id}${keepAddons.length ? `&id=not.in.(${keepAddons.join(",")})` : ""}`,
    accessToken,
    { method: "DELETE" }
  );
  return { error: null, idMap };
}

const slugId = (v, i, prefix) => {
  const s = String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
  return s || `${prefix}${i + 1}`;
};
const toInt = (v, min, max) => {
  const n = Math.round(Number(v));
  return v === "" || v == null || !Number.isFinite(n) ? null : Math.min(max, Math.max(min, n));
};

// One package card (a "ruta") in the shape the database takes. Also used for quote services (price 0).
function serviceToDb(s, vendorId, id, order) {
  const quote = s.priceType === "quote";
  const groups = quote
    ? []
    : (s.choiceGroups || [])
        .filter((g) => String(g.label || "").trim() && (g.options || []).some((o) => String(o.label || "").trim()))
        .slice(0, 10)
        .map((g, gi) => {
          const options = g.options
            .filter((o) => String(o.label || "").trim())
            .slice(0, 30)
            .map((o, oi) => {
              const opt = { id: slugId(o.id, oi, "o"), label: String(o.label).trim().slice(0, 60) };
              const p = Math.round(Number(o.price) || 0);
              if (p > 0) opt.price = Math.min(100000, p);
              return opt;
            });
          // option ids must be unique within the group
          options.forEach((o, oi) => {
            if (options.findIndex((x) => x.id === o.id) !== oi) o.id = `o${oi + 1}x`;
          });
          const max = Math.min(options.length, Math.max(1, toInt(g.max, 1, 30) ?? 1));
          const min = Math.min(max, Math.max(0, toInt(g.min, 0, 30) ?? max));
          return { id: slugId(g.id, gi, "g"), label: String(g.label).trim().slice(0, 60), min, max, options };
        });
  groups.forEach((g, gi) => {
    if (groups.findIndex((x) => x.id === g.id) !== gi) g.id = `g${gi + 1}x`;
  });
  const minG = toInt(s.minGuests, 1, 100000);
  let maxG = toInt(s.maxGuests, 1, 100000);
  if (minG && maxG && maxG < minG) maxG = minG;
  const window = !quote && /^\d{2}:\d{2}$/.test(s.timeFrom || "") && /^\d{2}:\d{2}$/.test(s.timeTo || "");
  return {
    id,
    vendor_id: vendorId,
    category_id: s.category || null,
    name: String(s.name || "").slice(0, 120),
    description: String(s.description || "").slice(0, 2000),
    price_type: quote ? "fixed" : s.priceType,
    price: quote ? 0 : Math.max(0, Math.round(Number(s.price) || 0)),
    from_price: quote && Number(s.fromPrice) > 0 ? Math.round(Number(s.fromPrice)) : null,
    price_note: s.priceNote || "",
    unit_label: quote || s.priceType !== "per_unit" ? "" : String(s.unitLabel || "").trim().slice(0, 30),
    min_guests: quote ? null : minG,
    max_guests: quote ? null : maxG,
    time_from: window ? s.timeFrom : null,
    time_to: window ? s.timeTo : null,
    min_hours: !quote && s.priceType === "per_hour" && Number(s.minHours) > 0 ? Math.min(48, Number(s.minHours)) : null,
    includes: quote ? [] : (s.includes || []).map((x) => String(x).trim().slice(0, 120)).filter(Boolean).slice(0, 20),
    choice_groups: groups,
    sort_order: order,
  };
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const colors = {
  // Hallonsorbet — hallon, korall, lila och champagne
  cream: "#FBF3E8", // champagne background
  coral: "#7D2248", // primary CTA / accent — hallon
  coralDeep: "#521333", // pressed hallon
  coralSoft: "#F6D3D0", // rosé
  lilac: "#D98BA8", // mid raspberry-pink (was purple)
  lilacDeep: "#7D2248", // hallon (was purple)
  lilacSoft: "#F8DDE3", // pale raspberry tint (was pale lilac)
  pink: "#F6D3D0", // rosé
  pinkSoft: "#FCE9E6",
  peach: "#FFD0C6", // apricot
  peachSoft: "#FFEDE7",
  korall: "#FF7F6B", // playful accent: bubbles, progress
  syren: "#F2B8C6",
  plum: "#4A1538", // primary text — deep wine
  plumSoft: "#6E4F62",
  beige: "#E7D5C2", // champagne border
  white: "#FFFFFF",
  green: "#2F5A2C", // success text
  greenSoft: "#DCEBD3", // success background
};

const serif = "'Fraunces', 'Georgia', serif";
const sans = "'Figtree', system-ui, sans-serif";

// ---------------------------------------------------------------------------
// Demo data switch. When false (the default for real visitors) the seed
// vendors, seed bookings and seed vendor applications below are never shown —
// only real data from the database is. Flip to true locally if you ever want
// the sample marketplace back for a demo.
// ---------------------------------------------------------------------------
const SHOW_DEMO_DATA = false;

// ---------------------------------------------------------------------------
// Demo mode: invented example vendors, two per category, shown only to
// someone who opens the site with ?demo (remembered for that browser tab).
// Ordinary visitors never see them, and they can never be booked.
//   ?demo       demo vendors next to the real ones, with a small banner
//   ?demo=film  only the demo vendors and no banner (for recording videos)
//   ?demo=av    turns demo mode off again
// ---------------------------------------------------------------------------
const DEMO_SETTING = (() => {
  if (typeof window === "undefined") return "";
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.has("demo")) {
      const v = q.get("demo");
      const mode = v === "av" || v === "0" ? "" : v === "film" ? "film" : "on";
      if (mode) window.sessionStorage.setItem("planifest-demo", mode);
      else window.sessionStorage.removeItem("planifest-demo");
      return mode;
    }
    return window.sessionStorage.getItem("planifest-demo") || "";
  } catch (e) {
    return "";
  }
})();
const DEMO_MODE = !!DEMO_SETTING;
const DEMO_FILM = DEMO_SETTING === "film";
const DEMO_ICONS = {"dj": "<circle cx=\"8\" cy=\"18\" r=\"4\"></circle><path d=\"M12 18V2l7 4\"></path>", "lokal": "<path d=\"M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z\"></path><path d=\"M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2\"></path><path d=\"M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2\"></path><path d=\"M10 6h4\"></path><path d=\"M10 10h4\"></path><path d=\"M10 14h4\"></path><path d=\"M10 18h4\"></path>", "catering": "<path d=\"m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8\"></path><path d=\"M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7\"></path><path d=\"m2.1 21.8 6.4-6.3\"></path><path d=\"m19 5-7 7\"></path>", "dekor": "<path d=\"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z\"></path><path d=\"M20 3v4\"></path><path d=\"M22 5h-4\"></path><path d=\"M4 17v2\"></path><path d=\"M5 18H3\"></path>", "fotograf": "<path d=\"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z\"></path><circle cx=\"12\" cy=\"13\" r=\"3\"></circle>", "tarta": "<path d=\"M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8\"></path><path d=\"M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1\"></path><path d=\"M2 21h20\"></path><path d=\"M7 8v3\"></path><path d=\"M12 8v3\"></path><path d=\"M17 8v3\"></path><path d=\"M7 4h0.01\"></path><path d=\"M12 4h0.01\"></path><path d=\"M17 4h0.01\"></path>", "blommor": "<path d=\"M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1\"></path><circle cx=\"12\" cy=\"8\" r=\"2\"></circle><path d=\"M12 10v12\"></path><path d=\"M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z\"></path><path d=\"M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z\"></path>", "uthyrning": "<path d=\"M12 22v-9\"></path><path d=\"M15.17 2.21a1.67 1.67 0 0 1 1.63 0L21 4.57a1.93 1.93 0 0 1 0 3.36L8.82 14.79a1.655 1.655 0 0 1-1.64 0L3 12.43a1.93 1.93 0 0 1 0-3.36z\"></path><path d=\"M20 13v3.87a2.06 2.06 0 0 1-1.11 1.83l-6 3.08a1.93 1.93 0 0 1-1.78 0l-6-3.08A2.06 2.06 0 0 1 4 16.87V13\"></path><path d=\"M21 12.43a1.93 1.93 0 0 0 0-3.36L8.83 2.2a1.64 1.64 0 0 0-1.63 0L3 4.57a1.93 1.93 0 0 0 0 3.36l12.18 6.86a1.636 1.636 0 0 0 1.63 0z\"></path>", "av": "<path d=\"M5 7 3 5\"></path><path d=\"M9 6V3\"></path><path d=\"m13 7 2-2\"></path><circle cx=\"9\" cy=\"13\" r=\"3\"></circle><path d=\"M11.83 12H20a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h2.17\"></path><path d=\"M16 16h2\"></path>", "talare": "<path d=\"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z\"></path><path d=\"M19 10v2a7 7 0 0 1-14 0v-2\"></path><line x1=\"12\" x2=\"12\" y1=\"19\" y2=\"22\"></line>", "teambuilding": "<path d=\"M6 9H4.5a2.5 2.5 0 0 1 0-5H6\"></path><path d=\"M18 9h1.5a2.5 2.5 0 0 0 0-5H18\"></path><path d=\"M4 22h16\"></path><path d=\"M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22\"></path><path d=\"M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22\"></path><path d=\"M18 2H6v7a6 6 0 0 0 12 0V2Z\"></path>"};
const DEMO_PALETTES = [
  ["#F8DDE3", "#F6D3D0"],
  ["#FFEDE7", "#FFD0C6"],
  ["#FCE9E6", "#F2B8C6"],
  ["#FBF3E8", "#E7D5C2"],
  ["#F6D3D0", "#D98BA8"],
];
const DEMO_ACCENTS = ["#7D2248", "#FF7F6B", "#D98BA8", "#F2B8C6", "#FFFFFF", "#FFD0C6"];
// Simple illustrated pictures for the example vendors (no photos of anyone's real work)
function demoArt(cat, seedText, variant) {
  let h = 2166136261;
  for (const ch of `${seedText}-${variant}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0), (h % 10000) / 10000);
  const [c1, c2] = DEMO_PALETTES[Math.floor(rnd() * DEMO_PALETTES.length)];
  const icon = DEMO_ICONS[cat] || DEMO_ICONS.dekor;
  let deco = "";
  for (let i = 0; i < 14; i++) {
    const x = Math.round(rnd() * 600), y = Math.round(rnd() * 420), r = 3 + Math.round(rnd() * 7);
    deco += `<circle cx="${x}" cy="${y}" r="${r}" fill="${DEMO_ACCENTS[i % DEMO_ACCENTS.length]}" opacity="0.55"/>`;
  }
  for (let i = 0; i < 3; i++) {
    const x = 40 + Math.round(rnd() * 520), y = 40 + Math.round(rnd() * 200), c = DEMO_ACCENTS[(i + 1) % 4];
    deco += `<ellipse cx="${x}" cy="${y}" rx="26" ry="32" fill="${c}" opacity="0.7"/><path d="M${x} ${y + 32} q 8 30 -4 60" stroke="${c}" stroke-width="2" fill="none" opacity="0.6"/>`;
  }
  let main;
  if (variant % 3 === 1) {
    main = `<circle cx="210" cy="230" r="130" fill="#fff" opacity="0.85"/><g transform="translate(126 146) scale(7)" fill="none" stroke="#4A1538" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${icon}</g>`;
  } else if (variant % 3 === 2) {
    main = "";
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 4; col++)
        main += `<g transform="translate(${60 + col * 140} ${50 + row * 125}) scale(3.2) rotate(${(row + col) % 2 ? -8 : 8} 12 12)" fill="none" stroke="#7D2248" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="${(row + col) % 2 ? 0.35 : 0.8}">${icon}</g>`;
  } else {
    main = `<circle cx="300" cy="210" r="112" fill="#fff" opacity="0.9"/><g transform="translate(216 126) scale(7)" fill="none" stroke="#4A1538" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${icon}</g>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420" width="600" height="420"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="600" height="420" fill="url(#g)"/>${deco}${main}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
// Free photos from Pexels (pexels.com, free to use). If one doesn't load, the illustrated picture is shown instead.
const DEMO_PHOTOS = {"DEMO-novasund":[1564668, 2111016, 332688],"DEMO-kvallsljud":[29263194, 13902049, 2381596],"DEMO-havsbris":[16859956, 5511124],"DEMO-magasin7":[2649771, 18447739],"DEMO-lagomsmak":[36318467, 34321369, 35247186],"DEMO-bordsdukat":[38110778, 35985198],"DEMO-rose":[14005784, 5701249],"DEMO-pastell":[4684169, 35001439],"DEMO-ljusfangst":[18999581, 30726403, 2479946],"DEMO-bildverkstan":[12906340, 14581845],"DEMO-fluff":[4110008, 3026803],"DEMO-glasyr":[19238270, 14677740, 6479548],"DEMO-kvistknopp":[5532810, 4238349],"DEMO-vinda":[1486677, 11794584],"DEMO-hyrhornan":[50675, 19351564],"DEMO-glasporslin":[6310606],"DEMO-teknikteamet":[13348768, 9005506, 5175355],"DEMO-skarmscen":[29708258, 29708266],"DEMO-scenvana":[29708260, 3321793],"DEMO-gnista":[10401267],"DEMO-kajak":[1252396, 12316141, 1682744],"DEMO-utmaningen":[7551757]};
const pexelsUrl = (id) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=900`;
const DEMO_IMAGE_FALLBACK = {};
if (DEMO_MODE && typeof document !== "undefined") {
  document.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (img && img.tagName === "IMG" && DEMO_IMAGE_FALLBACK[img.getAttribute("src")]) img.src = DEMO_IMAGE_FALLBACK[img.getAttribute("src")];
    },
    true
  );
}
const DEMO_VENDOR_DATA = [{"id": "DEMO-novasund", "cat": "dj", "companyName": "DJ Nova Sund", "tagline": "Mingel, middag och dansgolv – musiken följer kvällen", "description": "DJ i Göteborg för afterworks, kickoffs och kvällar med dans. Jag läser rummet och anpassar musiken efter gästerna.", "requestForms": {}, "services": [{"id": "DEMO-novasund-p1", "name": "Mingel & middag", "description": "Lugn musik som håller stämningen uppe utan att ta över samtalen.", "priceType": "per_hour", "price": 1200, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": 3, "includes": ["Diskret ljud för mingel och middag", "Trådlös mikrofon för tal"], "choiceGroups": [], "category": "dj"}, {"id": "DEMO-novasund-p2", "name": "Kvällspaket med dansgolv", "description": "", "priceType": "per_hour", "price": 1500, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": 4, "includes": ["Ljud och ljus för upp till 150 gäster", "Önskelista i förväg"], "choiceGroups": [{"id": "stil", "label": "Musikstil", "min": 1, "max": 2, "options": [{"id": "o1", "label": "Hits & pop"}, {"id": "o2", "label": "80- och 90-tal"}, {"id": "o3", "label": "House"}, {"id": "o4", "label": "Svenska klassiker"}]}], "category": "dj"}], "addons": [{"id": "DEMO-novasund-a1", "name": "Rökmaskin", "price": 500, "priceType": "fixed", "serviceIds": ["DEMO-novasund-p2"]}, {"id": "DEMO-novasund-a2", "name": "Extra högtalare för talen", "price": 600, "priceType": "fixed", "serviceIds": ["DEMO-novasund-p1", "DEMO-novasund-p2"]}]}, {"id": "DEMO-kvallsljud", "cat": "dj", "companyName": "Kvällsljud DJ-duo", "tagline": "Två DJ:er, ett dansgolv som aldrig blir tomt", "description": "DJ-duo med eget ljud- och ljussystem. Vi spelar på afterworks, julbord och sommarevent.", "requestForms": {}, "services": [{"id": "DEMO-kvallsljud-p1", "name": "Afterwork-set", "description": "", "priceType": "fixed", "price": 6500, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "16:00", "timeTo": "21:00", "minHours": "", "includes": ["3 timmar musik", "Eget ljudsystem"], "choiceGroups": [], "category": "dj"}, {"id": "DEMO-kvallsljud-p2", "name": "DJ-paket kväll", "description": "", "priceType": "per_hour", "price": 1800, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": 4, "includes": ["Två DJ:er", "Ljus och ljud ingår"], "choiceGroups": [], "category": "dj"}], "addons": [{"id": "DEMO-kvallsljud-a1", "name": "Ljusshow", "price": 900, "priceType": "fixed", "serviceIds": ["DEMO-kvallsljud-p1", "DEMO-kvallsljud-p2"]}]}, {"id": "DEMO-havsbris", "cat": "lokal", "companyName": "Salong Havsbris", "tagline": "Ljus konferenslokal vid vattnet med plats för 80", "description": "En ljus lokal vid kajen med stora fönster mot älven. Konferens på dagen, middag och mingel på kvällen.", "requestForms": {}, "services": [{"id": "DEMO-havsbris-p1", "name": "Konferensdag", "description": "", "priceType": "fixed", "price": 9500, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": 60, "timeFrom": "08:00", "timeTo": "17:00", "minHours": "", "includes": ["Projektor och skärm", "Wifi och whiteboard", "Möblering efter önskemål"], "choiceGroups": [], "category": "lokal"}, {"id": "DEMO-havsbris-p2", "name": "Kvällsbokning", "description": "", "priceType": "fixed", "price": 16000, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": 80, "timeFrom": "17:00", "timeTo": "01:00", "minHours": "", "includes": ["Ljudanläggning", "Bar och garderob"], "choiceGroups": [], "category": "lokal"}], "addons": [{"id": "DEMO-havsbris-a1", "name": "Extra grupprum", "price": 1500, "priceType": "fixed", "serviceIds": ["DEMO-havsbris-p1"]}, {"id": "DEMO-havsbris-a2", "name": "Städning efteråt", "price": 2000, "priceType": "fixed", "serviceIds": ["DEMO-havsbris-p1", "DEMO-havsbris-p2"]}]}, {"id": "DEMO-magasin7", "cat": "lokal", "companyName": "Magasin 7 Kajen", "tagline": "Industriell charm, plats för 120 gäster", "description": "Ett gammalt hamnmagasin med högt i tak, tegelväggar och egen scen.", "requestForms": {}, "services": [{"id": "DEMO-magasin7-p1", "name": "Halvdag", "description": "", "priceType": "fixed", "price": 6000, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": 40, "timeFrom": "08:00", "timeTo": "12:30", "minHours": "", "includes": ["Möblering för möte", "Kaffe och vatten"], "choiceGroups": [], "category": "lokal"}, {"id": "DEMO-magasin7-p2", "name": "Hel dag", "description": "", "priceType": "fixed", "price": 10500, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": 40, "timeFrom": "08:00", "timeTo": "17:00", "minHours": "", "includes": ["Möblering för möte", "Kaffe och vatten hela dagen"], "choiceGroups": [], "category": "lokal"}, {"id": "DEMO-magasin7-p3", "name": "Kväll", "description": "", "priceType": "fixed", "price": 14000, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": 120, "timeFrom": "18:00", "timeTo": "02:00", "minHours": "", "includes": ["Scen och ljud", "Bardisk"], "choiceGroups": [], "category": "lokal"}], "addons": [{"id": "DEMO-magasin7-a1", "name": "Scenljus", "price": 1500, "priceType": "fixed", "serviceIds": ["DEMO-magasin7-p3"]}]}, {"id": "DEMO-lagomsmak", "cat": "catering", "companyName": "Lagom Smak Catering", "tagline": "Konferensmat och mingel som alla blir glada av", "description": "Vi lagar luncher, fika och mingelbuffé till konferenser och företagsevent i hela Göteborg. Vegetariskt och allergianpassat ingår alltid.", "requestForms": {}, "services": [{"id": "DEMO-lagomsmak-p1", "name": "Konferenspaket heldag", "description": "", "priceType": "per_person", "price": 395, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": 10, "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["Förmiddagsfika", "Lunch med sallad och bröd", "Eftermiddagsfika"], "choiceGroups": [{"id": "lunch", "label": "Lunch", "min": 1, "max": 1, "options": [{"id": "o1", "label": "Kycklinggryta med jasminris"}, {"id": "o2", "label": "Laxfilé med dillpotatis"}, {"id": "o3", "label": "Vegetarisk lasagne"}, {"id": "o4", "label": "Halloumisallad med bulgur"}]}], "category": "catering"}, {"id": "DEMO-lagomsmak-p2", "name": "Lunch & fika", "description": "", "priceType": "per_person", "price": 225, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": 10, "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["Lunch med sallad och bröd", "Kaffe och kaka"], "choiceGroups": [{"id": "lunch", "label": "Lunch", "min": 1, "max": 1, "options": [{"id": "o1", "label": "Kycklinggryta med jasminris"}, {"id": "o2", "label": "Laxfilé med dillpotatis"}, {"id": "o3", "label": "Vegetarisk lasagne"}, {"id": "o4", "label": "Halloumisallad med bulgur"}]}], "category": "catering"}, {"id": "DEMO-lagomsmak-p3", "name": "Mingelbuffé", "description": "", "priceType": "per_person", "price": 345, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": 20, "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["Bröd och smör", "Ostbricka"], "choiceGroups": [{"id": "smaratter", "label": "Smårätter", "min": 4, "max": 4, "options": [{"id": "o1", "label": "Bruschetta"}, {"id": "o2", "label": "Kycklingspett"}, {"id": "o3", "label": "Västkustsallad på knäcke"}, {"id": "o4", "label": "Caprese"}, {"id": "o5", "label": "Grillade grönsaker", "price": 15}, {"id": "o6", "label": "Rökt lax på blini", "price": 25}]}], "category": "catering"}], "addons": [{"id": "DEMO-lagomsmak-a1", "name": "Alkoholfri dryck", "price": 35, "priceType": "per_person", "serviceIds": ["DEMO-lagomsmak-p1", "DEMO-lagomsmak-p2", "DEMO-lagomsmak-p3"]}, {"id": "DEMO-lagomsmak-a2", "name": "Vinpaket", "price": 195, "priceType": "per_person", "serviceIds": ["DEMO-lagomsmak-p3"]}]}, {"id": "DEMO-bordsdukat", "cat": "catering", "companyName": "Bordsdukat Catering", "tagline": "Sittande middagar med vita dukar", "description": "Trerättersmiddagar och frukostar för företag. Vi kommer med personal, porslin och allt som behövs.", "requestForms": {}, "services": [{"id": "DEMO-bordsdukat-p1", "name": "Trerättersmiddag", "description": "", "priceType": "per_person", "price": 595, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": 20, "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": [], "choiceGroups": [{"id": "forratt", "label": "Förrätt", "min": 1, "max": 1, "options": [{"id": "o1", "label": "Toast skagen"}, {"id": "o2", "label": "Burrata med tomat"}, {"id": "o3", "label": "Svampsoppa"}]}, {"id": "varmratt", "label": "Varmrätt", "min": 1, "max": 1, "options": [{"id": "o1", "label": "Oxfilé med rödvinssås", "price": 60}, {"id": "o2", "label": "Torskrygg med beurre blanc"}, {"id": "o3", "label": "Svamprisotto"}]}, {"id": "dessert", "label": "Dessert", "min": 1, "max": 1, "options": [{"id": "o1", "label": "Chokladfondant"}, {"id": "o2", "label": "Pannacotta"}, {"id": "o3", "label": "Ostar och marmelad"}]}], "category": "catering"}, {"id": "DEMO-bordsdukat-p2", "name": "Frukostbuffé", "description": "", "priceType": "per_person", "price": 165, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": 10, "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["Bröd, pålägg och ägg", "Yoghurt och frukt", "Kaffe och te"], "choiceGroups": [], "category": "catering"}], "addons": [{"id": "DEMO-bordsdukat-a1", "name": "Champagne vid ankomst", "price": 120, "priceType": "per_person", "serviceIds": ["DEMO-bordsdukat-p1"]}, {"id": "DEMO-bordsdukat-a2", "name": "Serveringspersonal", "price": 4500, "priceType": "fixed", "serviceIds": ["DEMO-bordsdukat-p1"]}]}, {"id": "DEMO-rose", "cat": "dekor", "companyName": "Ballongateljén Rosé", "tagline": "Ballongbågar och bordsdekor i dina färger", "description": "Ballongdekor och bordsdekor för företag och privatpersoner. Vi sätter upp och tar ner.", "requestForms": {"dekor": {"direct": true, "fields": []}}, "services": [{"id": "DEMO-rose-p1", "name": "Ballongbåge", "description": "", "priceType": "fixed", "price": 2500, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["Upp till 2,5 meter", "Valfria färger", "Uppsättning och nedmontering"], "choiceGroups": [], "category": "dekor"}, {"id": "DEMO-rose-p2", "name": "Bordsdekor", "description": "", "priceType": "per_unit", "price": 180, "priceNote": "", "fromPrice": "", "unitLabel": "bord", "minGuests": 2, "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["Löpare, ljus och små ballonger"], "choiceGroups": [], "category": "dekor"}, {"id": "DEMO-rose-q1", "name": "", "description": "Större dekor efter önskemål, tema och lokal.", "priceType": "quote", "price": 0, "priceNote": "", "fromPrice": 3500, "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": [], "choiceGroups": [], "category": "dekor"}], "addons": []}, {"id": "DEMO-pastell", "cat": "dekor", "companyName": "Studio Pastell Dekor", "tagline": "Helhetsdekor efter tema och färger", "description": "Vi tar fram ett förslag utifrån er lokal, er grafiska profil och känslan ni vill skapa.", "requestForms": {}, "services": [{"id": "DEMO-pastell-q1", "name": "", "description": "Helhetsdekor efter tema, färger och lokal. Berätta vad ni behöver så får ni ett förslag.", "priceType": "quote", "price": 0, "priceNote": "", "fromPrice": 4000, "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": [], "choiceGroups": [], "category": "dekor"}], "addons": []}, {"id": "DEMO-ljusfangst", "cat": "fotograf", "companyName": "Ljusfångst Foto", "tagline": "Eventfoto och porträtt för företag", "description": "Fotograf för konferenser, kickoffs och mässor. Bilderna får ni använda fritt i företagets kanaler.", "requestForms": {}, "services": [{"id": "DEMO-ljusfangst-p1", "name": "Eventfoto 3 timmar", "description": "", "priceType": "fixed", "price": 7500, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["150 redigerade bilder", "Leverans inom 7 dagar", "Fria för företagets kanaler"], "choiceGroups": [], "category": "fotograf"}, {"id": "DEMO-ljusfangst-p2", "name": "Porträttstation", "description": "", "priceType": "fixed", "price": 4900, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["2 timmar", "Enhetliga porträtt till hemsida och LinkedIn"], "choiceGroups": [], "category": "fotograf"}], "addons": [{"id": "DEMO-ljusfangst-a1", "name": "Expressleverans 48 h", "price": 1500, "priceType": "fixed", "serviceIds": ["DEMO-ljusfangst-p1", "DEMO-ljusfangst-p2"]}]}, {"id": "DEMO-bildverkstan", "cat": "fotograf", "companyName": "Bildverkstan Väst", "tagline": "Foto och film som berättar om er dag", "description": "Vi fotograferar och filmar, och klipper en kort film ni kan dela samma vecka.", "requestForms": {}, "services": [{"id": "DEMO-bildverkstan-p1", "name": "Halvdag foto & film", "description": "", "priceType": "fixed", "price": 14500, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["4 timmar", "100 redigerade bilder", "Film på 60 sekunder"], "choiceGroups": [], "category": "fotograf"}, {"id": "DEMO-bildverkstan-p2", "name": "Heldag foto & film", "description": "", "priceType": "fixed", "price": 24000, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["8 timmar", "250 redigerade bilder", "Film på 2 minuter"], "choiceGroups": [], "category": "fotograf"}], "addons": []}, {"id": "DEMO-fluff", "cat": "tarta", "companyName": "Tårtateljé Fluff", "tagline": "Tårtor med er logga", "description": "Tårtor och bakverk till jubileum, lansering och fredagsfika.", "requestForms": {"tarta": {"direct": true, "fields": []}}, "services": [{"id": "DEMO-fluff-p1", "name": "Tårta med logga", "description": "", "priceType": "per_unit", "price": 65, "priceNote": "", "fromPrice": "", "unitLabel": "bit", "minGuests": 12, "maxGuests": 200, "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["Logga i ätbart tryck"], "choiceGroups": [{"id": "smak", "label": "Smak", "min": 1, "max": 1, "options": [{"id": "o1", "label": "Choklad & hallon"}, {"id": "o2", "label": "Vanilj & jordgubb"}, {"id": "o3", "label": "Citron & passionsfrukt"}]}], "category": "tarta"}, {"id": "DEMO-fluff-q1", "name": "", "description": "Specialtårtor efter önskemål.", "priceType": "quote", "price": 0, "priceNote": "", "fromPrice": 900, "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": [], "choiceGroups": [], "category": "tarta"}], "addons": []}, {"id": "DEMO-glasyr", "cat": "tarta", "companyName": "Bagarstugan Glasyr", "tagline": "Bakat från grunden, varje gång", "description": "Tårtor, cupcakes och småkakor. Berätta vad ni vill ha så skickar vi en offert.", "requestForms": {}, "services": [{"id": "DEMO-glasyr-q1", "name": "", "description": "Tårtor och bakverk efter önskemål.", "priceType": "quote", "price": 0, "priceNote": "", "fromPrice": 900, "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": [], "choiceGroups": [], "category": "tarta"}], "addons": []}, {"id": "DEMO-kvistknopp", "cat": "blommor", "companyName": "Kvist & Knopp", "tagline": "Säsongens blommor till bord och entré", "description": "Bordsarrangemang, entréblommor och buketter efter säsong.", "requestForms": {}, "services": [{"id": "DEMO-kvistknopp-q1", "name": "", "description": "Bordsarrangemang, entréblommor och buketter efter säsong.", "priceType": "quote", "price": 0, "priceNote": "", "fromPrice": 1200, "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": [], "choiceGroups": [], "category": "blommor"}], "addons": []}, {"id": "DEMO-vinda", "cat": "blommor", "companyName": "Blomsterkollektivet Vinda", "tagline": "Gröna, vilda arrangemang", "description": "Lösa, naturliga arrangemang med det som växer just nu.", "requestForms": {"blommor": {"direct": true, "fields": []}}, "services": [{"id": "DEMO-vinda-p1", "name": "Bordsarrangemang", "description": "", "priceType": "per_unit", "price": 350, "priceNote": "", "fromPrice": "", "unitLabel": "bord", "minGuests": 3, "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["Säsongens blommor", "Leverans ingår"], "choiceGroups": [], "category": "blommor"}, {"id": "DEMO-vinda-q1", "name": "", "description": "Större blomsterdekor efter önskemål.", "priceType": "quote", "price": 0, "priceNote": "", "fromPrice": 2000, "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": [], "choiceGroups": [], "category": "blommor"}], "addons": []}, {"id": "DEMO-hyrhornan", "cat": "uthyrning", "companyName": "Hyrhörnan Bord & Stol", "tagline": "Bord, stolar och ståbord", "description": "Vi hyr ut möbler till event i Göteborg och levererar dit ni är.", "requestForms": {}, "services": [{"id": "DEMO-hyrhornan-p1", "name": "Runt bord, 8 personer", "description": "", "priceType": "per_unit", "price": 95, "priceNote": "", "fromPrice": "", "unitLabel": "bord", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["Vit duk ingår"], "choiceGroups": [], "category": "uthyrning"}, {"id": "DEMO-hyrhornan-p2", "name": "Stol med dyna", "description": "", "priceType": "per_unit", "price": 25, "priceNote": "", "fromPrice": "", "unitLabel": "stol", "minGuests": 10, "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": [], "choiceGroups": [], "category": "uthyrning"}, {"id": "DEMO-hyrhornan-p3", "name": "Ståbord med klädsel", "description": "", "priceType": "per_unit", "price": 140, "priceNote": "", "fromPrice": "", "unitLabel": "ståbord", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": [], "choiceGroups": [], "category": "uthyrning"}], "addons": [{"id": "DEMO-hyrhornan-a1", "name": "Leverans och hämtning i Göteborg", "price": 650, "priceType": "fixed", "serviceIds": ["DEMO-hyrhornan-p1", "DEMO-hyrhornan-p2", "DEMO-hyrhornan-p3"]}]}, {"id": "DEMO-glasporslin", "cat": "uthyrning", "companyName": "Glas & Porslin Uthyrning", "tagline": "Dukat för 10 eller 300", "description": "Porslin, bestick och glas. Ni lämnar tillbaka det odiskat.", "requestForms": {}, "services": [{"id": "DEMO-glasporslin-p1", "name": "Kuvert: tallrikar, bestick och glas", "description": "", "priceType": "per_unit", "price": 39, "priceNote": "", "fromPrice": "", "unitLabel": "kuvert", "minGuests": 10, "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["Diskas av oss"], "choiceGroups": [], "category": "uthyrning"}, {"id": "DEMO-glasporslin-p2", "name": "Champagneglas", "description": "", "priceType": "per_unit", "price": 8, "priceNote": "", "fromPrice": "", "unitLabel": "glas", "minGuests": 24, "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": [], "choiceGroups": [], "category": "uthyrning"}], "addons": [{"id": "DEMO-glasporslin-a1", "name": "Leverans och hämtning", "price": 450, "priceType": "fixed", "serviceIds": ["DEMO-glasporslin-p1", "DEMO-glasporslin-p2"]}]}, {"id": "DEMO-teknikteamet", "cat": "av", "companyName": "Teknikteamet Ljud & Bild", "tagline": "Teknik som bara fungerar", "description": "Ljud, bild och streaming för konferenser. En tekniker är med på plats så att ni kan fokusera på innehållet.", "requestForms": {}, "services": [{"id": "DEMO-teknikteamet-p1", "name": "Konferenspaket", "description": "", "priceType": "fixed", "price": 5900, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["Projektor och duk", "2 trådlösa mikrofoner", "Tekniker på plats i 2 timmar"], "choiceGroups": [], "category": "av"}, {"id": "DEMO-teknikteamet-p2", "name": "Hybridmöte med streaming", "description": "", "priceType": "fixed", "price": 12500, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["Kamera och streaming", "Ljud för deltagare på distans", "Tekniker hela dagen"], "choiceGroups": [], "category": "av"}], "addons": [{"id": "DEMO-teknikteamet-a1", "name": "Extra tekniktimme", "price": 850, "priceType": "fixed", "serviceIds": ["DEMO-teknikteamet-p1"]}]}, {"id": "DEMO-skarmscen", "cat": "av", "companyName": "Skärm & Scen AV", "tagline": "Scen, LED-skärm och ljud", "description": "Vi bygger scen och sätter upp skärmar och ljud för större event.", "requestForms": {}, "services": [{"id": "DEMO-skarmscen-p1", "name": "Scen och ljud", "description": "", "priceType": "fixed", "price": 8900, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["Scen 4 x 3 meter", "Ljud för upp till 200"], "choiceGroups": [], "category": "av"}, {"id": "DEMO-skarmscen-p2", "name": "LED-skärm", "description": "", "priceType": "fixed", "price": 6500, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["Skärm 3 x 2 meter", "Uppsättning och nedmontering"], "choiceGroups": [], "category": "av"}], "addons": []}, {"id": "DEMO-scenvana", "cat": "talare", "companyName": "Scenvana Moderatorer", "tagline": "Moderatorer som håller tiden och stämningen", "description": "Erfarna moderatorer för konferenser, paneler och interna dagar.", "requestForms": {}, "services": [{"id": "DEMO-scenvana-p1", "name": "Moderator halvdag", "description": "", "priceType": "fixed", "price": 12000, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["Förmöte och körschema", "Leder samtal och paneler"], "choiceGroups": [], "category": "talare"}, {"id": "DEMO-scenvana-p2", "name": "Moderator heldag", "description": "", "priceType": "fixed", "price": 19500, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["Förmöte och körschema", "Leder hela dagen"], "choiceGroups": [], "category": "talare"}], "addons": []}, {"id": "DEMO-gnista", "cat": "talare", "companyName": "Talarbyrån Gnista", "tagline": "Föreläsningar som ger energi", "description": "Inspirationsföreläsningar för kickoffs och konferenser.", "requestForms": {}, "services": [{"id": "DEMO-gnista-p1", "name": "Inspirationsföreläsning 45 min", "description": "", "priceType": "fixed", "price": 18000, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": "", "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": [], "choiceGroups": [{"id": "tema", "label": "Tema", "min": 1, "max": 1, "options": [{"id": "o1", "label": "Hållbart ledarskap"}, {"id": "o2", "label": "Kreativitet i vardagen"}, {"id": "o3", "label": "Stress och återhämtning"}]}], "category": "talare"}], "addons": []}, {"id": "DEMO-kajak", "cat": "teambuilding", "companyName": "Kajak & Kompass Aktiviteter", "tagline": "Aktiviteter i skärgården och i stan", "description": "Teambuilding utomhus med guide. Vi anpassar efter gruppen.", "requestForms": {}, "services": [{"id": "DEMO-kajak-p1", "name": "Kajakpaddling i skärgården", "description": "", "priceType": "per_person", "price": 690, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": 8, "maxGuests": 40, "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["Guide och utrustning", "Fika på en ö"], "choiceGroups": [], "category": "teambuilding"}, {"id": "DEMO-kajak-p2", "name": "Stadsorientering", "description": "", "priceType": "per_person", "price": 395, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": 10, "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["Kartor och uppdrag", "Pris till vinnarlaget"], "choiceGroups": [], "category": "teambuilding"}], "addons": []}, {"id": "DEMO-utmaningen", "cat": "teambuilding", "companyName": "Utmaningen Teambuilding", "tagline": "Tävlingar som får gruppen att skratta", "description": "Escape room, matlagningsdueller och quiz för företag.", "requestForms": {}, "services": [{"id": "DEMO-utmaningen-p1", "name": "Escape room-tävling", "description": "", "priceType": "per_person", "price": 450, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": 8, "maxGuests": "", "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["60 minuter", "Prisutdelning"], "choiceGroups": [], "category": "teambuilding"}, {"id": "DEMO-utmaningen-p2", "name": "Matlagningsduell", "description": "", "priceType": "per_person", "price": 795, "priceNote": "", "fromPrice": "", "unitLabel": "", "minGuests": 10, "maxGuests": 30, "timeFrom": "", "timeTo": "", "minHours": "", "includes": ["Kock som leder", "Middagen ni lagar"], "choiceGroups": [], "category": "teambuilding"}], "addons": []}];
const DEMO_VENDORS = DEMO_MODE
  ? DEMO_VENDOR_DATA.map((v) => ({
      id: v.id,
      createdAt: "2026-10-01T00:00:00Z",
      requestForms: v.requestForms,
      companyName: v.companyName,
      baseLocation: "goteborg",
      serviceArea: { type: "city", value: "Göteborg" },
      categories: [v.cat],
      status: "approved",
      blockedTimes: [],
      profile: {
        tagline: v.tagline,
        description: v.description,
        images: [
          ...(DEMO_PHOTOS[v.id] || []).map((id, n) => {
            const url = pexelsUrl(id);
            DEMO_IMAGE_FALLBACK[url] = demoArt(v.cat, v.id, n);
            return url;
          }),
          demoArt(v.cat, v.id, 2),
        ],
        services: v.services.map((x) => ({ ...x, category: v.cat })),
        addons: v.addons,
      },
    }))
  : [];
const DEMO_NO_BOOKING = "Det här är påhittade exempel i demoläget och går inte att boka.";

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
  { id: "trycksaker", label: "Trycksaker & personliga gåvor", icon: Gift, tagline: "Inbjudningar, namnskyltar, ljus och gåvor med ditt namn på", tint: "pinkSoft" },
  { id: "av", label: "AV & teknik", icon: Projector, tagline: "Ljud, bild och teknik som bara fungerar", tint: "lilacSoft" },
  { id: "talare", label: "Talare & moderator", icon: Mic, tagline: "Någon som leder, inspirerar och håller tiden", tint: "peachSoft" },
  { id: "teambuilding", label: "Teambuilding", icon: Trophy, tagline: "Aktiviteter som samlar gruppen", tint: "pinkSoft" },
];

const catMap = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const OCCASIONS = [
  { id: "babyshower", label: "Babyshower", emoji: "🍼", boardLabel: "Babyshower" },
  { id: "birthday", label: "Födelsedag", emoji: "🎂", boardLabel: "Födelsedag" },
  { id: "wedding", label: "Bröllop", emoji: "💍", boardLabel: "Bröllop" },
  { id: "baptism", label: "Dop", emoji: "👶", boardLabel: "Dop" },
  { id: "graduation", label: "Student", emoji: "🎓", boardLabel: "Student" },
  { id: "party", label: "Kalas", emoji: "🎉", boardLabel: "Kalas" },
  { id: "corporate", label: "Företagsevent & konferens", emoji: "🏢", boardLabel: "Företagsevent" },
  { id: "other", label: "Annat", emoji: "✨", boardLabel: "Mitt event" },
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

// --- Time slots: a vendor is only busy during the hours already booked, not the whole day -----------------------------
// Missing times count as the whole day; an end at or before the start means the event runs past midnight.
const toMinutes = (t) => {
  const [h, m] = String(t || "").split(":");
  return (Number(h) || 0) * 60 + (Number(m) || 0);
};
function slotBounds(start, end) {
  if (!start || !end) return [0, 1440];
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (e <= s) e += 1440;
  return [s, e];
}
function slotsOverlap(a, b) {
  const [as, ae] = slotBounds(a.start, a.end);
  const [bs, be] = slotBounds(b.start, b.end);
  return as < be && bs < ae;
}
const busyOnDate = (provider, date) => (provider.busySlots || []).filter((sl) => sl.date === date);
const isBusyAt = (provider, party) =>
  !!party?.date && busyOnDate(provider, party.date).some((sl) => slotsOverlap(sl, { start: party.startTime, end: party.endTime }));
const hhmm = (t) => String(t || "").slice(0, 5);
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
function mapVendorToProviders(vendor, bookings, busyByVendor = {}) {
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

    const quoteFroms = (categoryServices.length ? categoryServices : services.filter((s) => !s.category)).map((s) => Number(s.fromPrice) || 0).filter((n) => n > 0);
    const quoteFrom = quoteFroms.length ? Math.min(...quoteFroms) : 0;
    // Package cards: this category's ready-priced packages, shown when the vendor has them turned on
    const allAddons = vendor.profile.addons || [];
    const packages = categoryServices.filter(isPackage).map((s) => ({ ...s, addons: packageAddons(s, allAddons) }));
    // Quote-first categories (cake, decor, flowers) show packages only when the vendor turned them on
    const directSetting = vendor.requestForms?.[categoryId]?.direct;
    const packagesOn = packages.length > 0 && (QUOTE_FIRST_CATEGORIES.includes(categoryId) ? directSetting === true : directSetting !== false);
    const cheapest = packages.length ? packages.reduce((a, b) => (Number(b.price) < Number(a.price) ? b : a)) : null;
    if (packagesOn) Object.assign(pricing, { type: cheapest.priceType, amount: Number(cheapest.price) || 0, note: cheapest.name || "", suffix: packageSuffix(cheapest) });
    const hasPrice = pricing.amount > 0;
    const request = getRequestConfig(vendor.requestForms, categoryId, hasPrice);
    const quoteText = categoryServices.filter((s) => !isPackage(s)).map((s) => s.description).filter(Boolean).join("\n\n");
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
      alsoOffers: vendor.categories.filter((c) => c !== categoryId),
      name: vendor.companyName,
      tagline: vendor.profile.tagline || "Ny leverantör på Planifest",
      rating: null,
      reviews: 0,
      location: locationMap[vendor.baseLocation]?.name || vendor.baseLocation,
      distanceKm: getMockDistance(vendor.id, vendor.baseLocation),
      pricing,
      serviceId: primaryService?.id || null,
      request,
      requestOnly: !packagesOn,
      packages: packagesOn ? packages : [],
      packagesOn,
      fromPrice: packagesOn ? pricing.amount : quoteFrom || fieldsFrom || (cheapest ? Number(cheapest.price) || 0 : 0),
      seed: vendor.id,
      image: images[0],
      images,
      available: true,
      closedDates,
      bookedDates,
      busySlots: busyByVendor[vendor.id] || [],
      blurb: vendor.profile.description || "",
      service: packagesOn ? quoteText : serviceText,
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

function getCustomerVisibleProviders(vendorApplications, customerReviews, bookings, busyByVendor = {}) {
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
  const approvedListings = DEMO_FILM ? [] : vendorApplications.filter((v) => v.status === "approved").flatMap((v) => mapVendorToProviders(v, bookings, busyByVendor));
  const demoListings = DEMO_VENDORS.flatMap((v) => mapVendorToProviders(v, [], {})).map((p) => ({ ...p, vendorDbId: null, isDemo: true }));
  return [...mockListings, ...approvedListings, ...demoListings].map((p) => applyCustomerReviews(p, customerReviews));
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
  if (pricing.suffix != null) return pricing.suffix;
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

const addonAmount = (a, party) => (Number(a.price) || 0) * (a.priceType === "per_person" ? Math.max(1, Number(party?.guests) || 1) : 1);
const addonPriceLabel = (a) => `+${formatKr(Number(a.price) || 0)}${a.priceType === "per_person" ? "/person" : ""}`;

function getAddonsAmount(provider, addonIds = [], party) {
  if (!provider.addons || provider.addons.length === 0) return 0;
  return provider.addons.filter((a) => addonIds.includes(a.id)).reduce((sum, a) => sum + addonAmount(a, party), 0);
}

function getLineTotal(provider, addonIds, party) {
  if (provider.package) return packageTotal(provider.package, party, { quantity: provider.quantity, choices: provider.choices, addonIds }, provider.addons);
  return getBaseAmount(provider, party) + getAddonsAmount(provider, addonIds, party);
}

function getBreakdownText(provider, party) {
  if (provider.package) return packageBreakdown(provider.package, party, provider.quantity);
  const { pricing } = provider;
  if (pricing.type === "per_person") return `${formatKr(pricing.amount)}/person × ${party.guests || 0} gäster`;
  if (pricing.type === "per_hour") return `${formatKr(pricing.amount)}/timme × ${getDurationHours(party)} timmar`;
  return pricing.note || "Paketpris";
}

// ---------------------------------------------------------------------------
// Package cards ("rutor"): a vendor's ready-priced packages that go straight
// to checkout. One shape for every category; the unit decides how the price
// is worked out. The database works the price out the same way
// (public.package_price), so the browser's sum is only ever a preview.
// ---------------------------------------------------------------------------
const PACKAGE_UNITS = [
  { id: "per_person", label: "Per person", hint: "Gånger kundens antal gäster" },
  { id: "fixed", label: "Fast pris", hint: "Ett pris per tillfälle" },
  { id: "per_hour", label: "Per timme", hint: "Gånger eventets längd" },
  { id: "per_unit", label: "Per styck", hint: "Kunden väljer antal" },
];
// Categories where a quote comes first; ready-priced packages are something the vendor turns on.
const QUOTE_FIRST_CATEGORIES = ["tarta", "dekor", "blommor"];

const emptyOptions = (n) => Array.from({ length: n }, (_, i) => ({ id: `o${i + 1}`, label: "", price: "" }));
const PACKAGE_TEMPLATES = {
  catering: { name: "Buffé", priceType: "per_person", minGuests: 10, includes: [""], choiceGroups: [
    { id: "forratt", label: "Förrätter", min: 2, max: 2, options: emptyOptions(4) },
    { id: "huvudratt", label: "Huvudrätt", min: 1, max: 1, options: emptyOptions(3) },
  ] },
  dj: { name: "DJ-paket", priceType: "per_hour", minHours: 4, includes: ["Ljudanläggning", "Mikrofon för tal"] },
  lokal: { name: "Kvällsbokning", priceType: "fixed", timeFrom: "18:00", timeTo: "01:00", includes: [""] },
  fotograf: { name: "Fotopaket", priceType: "fixed", includes: [""] },
  uthyrning: { name: "", priceType: "per_unit", unitLabel: "st" },
  trycksaker: { name: "", priceType: "per_unit", unitLabel: "st", includes: [""] },
  av: { name: "Teknikpaket", priceType: "fixed", includes: [""] },
};
const PACKAGE_HINTS = {
  catering: { name: "T.ex. Stora buffén", include: "T.ex. Chark, ostar och kex", group: "T.ex. Förrätter", option: "T.ex. Potatissallad" },
  dj: { name: "T.ex. DJ helkväll", include: "T.ex. Ljus och rökmaskin", group: "T.ex. Musikstil", option: "T.ex. Hits & pop" },
  lokal: { name: "T.ex. Stora lokalen, kväll", include: "T.ex. Ljudanläggning och scen", group: "T.ex. Uppställning", option: "T.ex. Sittande middag" },
  fotograf: { name: "T.ex. Bröllop heldag", include: "T.ex. 150 redigerade bilder", group: "T.ex. Leverans", option: "T.ex. Fotobok" },
  uthyrning: { name: "T.ex. Runt bord, 8 personer", include: "T.ex. Duk ingår", group: "T.ex. Färg", option: "T.ex. Vit" },
  trycksaker: { name: "T.ex. Personliga ljus, 20 st", include: "T.ex. Valfritt namn och datum", group: "T.ex. Färg", option: "T.ex. Vit" },
};
const packageHint = (cat) => PACKAGE_HINTS[cat] || { name: "T.ex. Standardpaket", include: "T.ex. Vad som ingår", group: "T.ex. Välj variant", option: "T.ex. Alternativ 1" };

function newPackageFromTemplate(cat) {
  const t = PACKAGE_TEMPLATES[cat] || { name: "", priceType: "fixed", includes: [""] };
  return JSON.parse(JSON.stringify({ description: "", includes: [], choiceGroups: [], ...t }));
}

const isPackage = (s) => !!s && s.priceType !== "quote" && Number(s.price) > 0;
const unitWord = (pkg) => String(pkg.unitLabel || "").trim().replace(/^per\s+/i, "") || "st";
function packageSuffix(pkg) {
  if (pkg.priceType === "per_person") return "/person";
  if (pkg.priceType === "per_hour") return "/timme";
  if (pkg.priceType === "per_unit") return `/${unitWord(pkg)}`;
  return "";
}
const packagePriceLabel = (pkg) => `${formatKr(Number(pkg.price) || 0)}${packageSuffix(pkg)}`;
const packageAddons = (pkg, addons = []) => addons.filter((a) => String(a.name || "").trim() && (a.serviceIds || []).includes(pkg.id));

// Minutes of `t` after `from`, on a 24h clock that may pass midnight.
const minsAfter = (t, from) => (((timeToMinutes(t) - timeToMinutes(from)) % 1440) + 1440) % 1440;

// Why the package doesn't fit the customer's event right now, or "" when it does.
function packageMisfit(pkg, party, quantity = 1) {
  const guests = Math.max(1, Number(party?.guests) || 1);
  const min = Number(pkg.minGuests) || 0;
  const max = Number(pkg.maxGuests) || 0;
  if (pkg.priceType === "per_unit") {
    if (min && quantity < min) return `Minst ${min} ${unitWord(pkg)}`;
    if (max && quantity > max) return `Högst ${max} ${unitWord(pkg)}`;
  } else {
    if (min && guests < min) return `Minst ${min} personer`;
    if (max && guests > max) return `Max ${max} gäster`;
  }
  if (pkg.timeFrom && pkg.timeTo && party?.startTime && party?.endTime) {
    let w = minsAfter(pkg.timeTo, pkg.timeFrom);
    if (w === 0) w = 1440;
    const s = minsAfter(party.startTime, pkg.timeFrom);
    let d = minsAfter(party.endTime, party.startTime);
    if (d === 0) d = 1440;
    if (s + d > w) return `Passar ${pkg.timeFrom}–${pkg.timeTo}`;
  }
  return "";
}

// Facts about the package shown as small badges on the card.
function packageFacts(pkg) {
  const facts = [];
  const min = Number(pkg.minGuests) || 0;
  const max = Number(pkg.maxGuests) || 0;
  if (pkg.priceType === "per_unit") {
    if (min) facts.push(`Minst ${min} ${unitWord(pkg)}`);
  } else {
    if (min) facts.push(`Minst ${min} personer`);
    if (max) facts.push(`Max ${max} gäster`);
  }
  if (pkg.timeFrom && pkg.timeTo) facts.push(`${pkg.timeFrom}–${pkg.timeTo}`);
  if (pkg.priceType === "per_hour" && Number(pkg.minHours) > 0) facts.push(`Minst ${String(pkg.minHours).replace(".", ",")} timmar`);
  return facts;
}

function packageMultiplier(pkg, party, quantity = 1) {
  if (pkg.priceType === "per_person") return Math.max(1, Number(party?.guests) || 1);
  if (pkg.priceType === "per_hour") return Math.max(getDurationHours(party || {}), Number(pkg.minHours) || 0);
  if (pkg.priceType === "per_unit") return Math.max(1, Math.round(Number(quantity) || 1));
  return 1;
}

function packageTotal(pkg, party, { quantity = 1, choices = {}, addonIds = [] } = {}, addons = []) {
  const mult = packageMultiplier(pkg, party, quantity);
  let total = (Number(pkg.price) || 0) * mult;
  (pkg.choiceGroups || []).forEach((g) => {
    const picked = choices?.[g.id] || [];
    (g.options || []).forEach((o) => {
      if (picked.includes(o.id)) total += (Number(o.price) || 0) * mult;
    });
  });
  addons.filter((a) => addonIds.includes(a.id)).forEach((a) => (total += addonAmount(a, party)));
  return Math.round(total);
}

function packageBreakdown(pkg, party, quantity = 1) {
  const price = formatKr(Number(pkg.price) || 0);
  const name = pkg.name ? `${pkg.name} · ` : "";
  if (pkg.priceType === "per_person") return `${name}${price}/person × ${Math.max(1, Number(party.guests) || 1)} gäster`;
  if (pkg.priceType === "per_hour") {
    const h = getDurationHours(party);
    const billed = packageMultiplier(pkg, party);
    return `${name}${price}/timme × ${String(billed).replace(".", ",")} timmar${billed > h ? " (minsta tid)" : ""}`;
  }
  if (pkg.priceType === "per_unit") return `${name}${Math.max(1, Number(quantity) || 1)} ${unitWord(pkg)} × ${price}`;
  return `${name}${price}`;
}

// What still has to be picked before the package can be added ("" when everything is chosen).
function packageChoiceProblem(pkg, choices = {}) {
  for (const g of pkg.choiceGroups || []) {
    const n = (choices?.[g.id] || []).length;
    if (n < g.min || n > g.max) {
      if (g.min === g.max) return `Välj ${g.min} ${String(g.label).toLowerCase()}`;
      return `Välj ${g.min}–${g.max} ${String(g.label).toLowerCase()}`;
    }
  }
  return "";
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
    else if (form.password.length < 8) errors.password = "Lösenordet måste vara minst 8 tecken";
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
  const h = size * 1.3;
  return (
    <svg width={size} height={h} viewBox="0 0 64 84" fill="none" aria-hidden="true">
      <ellipse cx="22" cy="30" rx="16" ry="19" fill={colors.korall} />
      <ellipse cx="16" cy="22" rx="4" ry="5.5" fill="#fff" fillOpacity="0.45" />
      <ellipse cx="42" cy="26" rx="14" ry="17" fill={colors.syren} />
      <ellipse cx="37" cy="19" rx="3.4" ry="4.6" fill="#fff" fillOpacity="0.5" />
      <ellipse cx="50" cy="44" rx="10" ry="12" fill={colors.coral} />
      <path d="M22 49Q27 62 33 76M42 43Q38 60 33 76M50 56Q42 66 33 76" stroke={colors.plum} strokeOpacity="0.5" strokeWidth="1.2" />
    </svg>
  );
}

// Planifest wordmark: lowercase "planifest" where the dot of the i is a
// hallon balloon. Sizes are ratios of fontSize so it scales everywhere.
function Wordmark({ fontSize = 20, color = colors.plum }) {
  return (
    <span
      role="img"
      aria-label="Planifest"
      style={{
        fontFamily: serif,
        fontWeight: 600,
        fontSize,
        lineHeight: 1,
        letterSpacing: "-0.02em",
        color,
        display: "inline-flex",
        alignItems: "baseline",
        fontVariationSettings: "'WONK' 0, 'SOFT' 0",
      }}
    >
      <span aria-hidden="true">plan</span>
      <span aria-hidden="true" style={{ position: "relative", display: "inline-block", marginRight: fontSize * 0.027 }}>
        {"\u0131"}
        <svg
          viewBox="0 0 60 74"
          width={fontSize * 0.27}
          height={fontSize * 0.333}
          aria-hidden="true"
          style={{ position: "absolute", left: "50%", bottom: fontSize * 0.6, transform: "translateX(-62%) rotate(-6deg)" }}
        >
          <path d="M30 2 C46 2 57 15 57 32 C57 50 43 64 30 66 C17 64 3 50 3 32 C3 15 14 2 30 2 Z" fill={colors.coral} />
          <path d="M26 65 L34 65 L30 71 Z" fill={colors.coral} />
          <ellipse cx="19" cy="21" rx="5" ry="10" fill="#FFFFFF" opacity="0.35" transform="rotate(-20 19 21)" />
        </svg>
      </span>
      <span aria-hidden="true">fest</span>
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
    <button onClick={onClick} aria-label="Planifest – till startsidan" className="flex items-center" style={{ background: "none", border: "none", cursor: "pointer", paddingTop: 6 }}>
      <Wordmark fontSize={large ? 46 : 32} />
    </button>
  );
}

function CategoryChip({ active, onClick, icon: Icon, emoji, label, size = "lg", tone }) {
  if (tone === "dark") {
    return (
      <button
        onClick={onClick}
        aria-pressed={!!active}
        className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm transition-colors"
        style={{
          border: `1.5px solid ${active ? colors.korall : "rgba(251,243,232,0.4)"}`,
          backgroundColor: active ? colors.korall : "transparent",
          color: active ? colors.plum : colors.cream,
          fontWeight: active ? 700 : 600,
        }}
      >
        {Icon ? <Icon size={16} /> : <span style={{ fontSize: 15, lineHeight: 1 }}>{emoji}</span>}
        {label}
      </button>
    );
  }
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
      className="flex flex-col items-center gap-1.5 rounded-3xl px-3 py-2.5 text-center transition-colors"
      style={{
        border: `2px solid ${active ? colors.coral : "transparent"}`,
        backgroundColor: active ? colors.coral : colors.cream,
        minWidth: 78,
      }}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: active ? "rgba(255,255,255,0.28)" : colors.white }}
      >
        {Icon ? <Icon size={17} color={active ? colors.cream : colors.coral} /> : <span style={{ fontSize: 16, lineHeight: 1 }}>{emoji}</span>}
      </span>
      <span className="text-xs font-bold leading-tight" style={{ color: active ? colors.cream : colors.plum }}>
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
        <span className={compact ? "inline-block h-1.5 w-1.5 rounded-full" : "inline-block h-2.5 w-2.5 rounded-full"} style={{ backgroundColor: colors.greenSoft, border: `1px solid ${colors.green}` }} /> Ledig
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
    open: { bg: colors.greenSoft, fg: colors.green },
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
function VendorCard({ provider, party, inCart, onView, onAdd, onRemove, swapMode, compact = false }) {
  const priceLabel = provider.requestOnly
    ? provider.fromPrice > 0
      ? `från ${formatKr(provider.fromPrice)}`
      : "Pris på förfrågan"
    : `${provider.packages?.length > 1 ? "från " : ""}${formatKr(provider.pricing.amount)}${getUnitLabel(provider.pricing)}`;
  const busy = !!party?.date && (isBusyAt(provider, party) || !!provider.closedDates?.includes(party.date));
  const handleAction = (e) => {
    e.stopPropagation();
    if (busy) {
      onView(provider.id); // can't be added for a taken time; the profile explains why
      return;
    }
    if (provider.requestOnly || provider.packagesOn) {
      onView(provider.id); // a package is picked on the vendor's page; otherwise booked through a request and a quote
      return;
    }
    if (swapMode) onAdd(provider.id);
    else if (inCart) onRemove(provider.id);
    else onAdd(provider.id);
  };

  const cat = catMap[provider.category];
  const added = inCart && !swapMode;
  const where = provider.distanceKm != null ? formatDistance(provider.distanceKm) : provider.location;
  const subtitle = [provider.tagline, where].filter(Boolean).join(" · ");
  return (
    <div
      onClick={() => onView(provider.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onView(provider.id)}
      className="group flex cursor-pointer flex-col gap-2.5"
    >
      <div className="relative overflow-hidden" style={{ borderRadius: 20, backgroundColor: colors.coralSoft, aspectRatio: "1 / 1.08" }}>
        <img
          src={provider.image || `https://picsum.photos/seed/${provider.seed}/500/540`}
          alt={provider.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {cat && (
          <span className="absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: "rgba(255,255,255,0.92)", color: colors.plum }}>
            {cat.label}
          </span>
        )}
        <HeartButton vendorId={provider.vendorDbId} className="absolute right-2 top-2 shadow-sm" />
        {busy ? (
          <span className="absolute bottom-2.5 left-2.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: colors.white, color: colors.coralDeep }}>
            Upptagen din tid
          </span>
        ) : party?.date ? (
          <span className="absolute bottom-2.5 left-2.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: colors.lilacSoft, color: colors.coral }}>
            Ledig ditt datum
          </span>
        ) : null}
        {inCart && !swapMode && (
          <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: colors.greenSoft, color: colors.green }}>
            <Check size={12} /> Offert godkänd
          </span>
        )}
      </div>
      <div className="min-w-0 px-0.5">
        <h3 className="truncate leading-tight" style={{ fontFamily: serif, fontWeight: 700, fontSize: 17, color: colors.plum }}>
          {provider.name}
        </h3>
        {subtitle && (
          <p className="mt-0.5 truncate text-[13px]" style={{ color: colors.plumSoft }}>
            {subtitle}
          </p>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold" style={{ color: colors.plum }}>
            {priceLabel}
          </span>
          {provider.reviews > 0 ? (
            <span className="flex flex-shrink-0 items-center gap-1 text-[13px] font-semibold" style={{ color: colors.plum }}>
              <Star size={14} fill={colors.coral} color={colors.coral} />
              {provider.rating}
              <span className="font-normal" style={{ color: colors.plumSoft }}>({provider.reviews})</span>
            </span>
          ) : (
            <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: colors.lilacSoft, color: colors.plum }}>
              Ny
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------
function PillChip({ active, onClick, children, ariaLabel }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={!!active}
      aria-label={ariaLabel}
      className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm transition-colors"
      style={{
        border: `1px solid ${active ? colors.plum : colors.beige}`,
        backgroundColor: active ? colors.plum : colors.white,
        color: active ? colors.white : colors.plum,
        fontWeight: active ? 600 : 500,
      }}
    >
      {children}
    </button>
  );
}

function formatEventDate(ds) {
  if (!ds) return "";
  return new Date(`${ds}T00:00:00`).toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "long" });
}

function StoryRing({ active, children }) {
  return (
    <span
      className="flex h-[74px] w-[74px] rounded-full p-[3px]"
      style={{ background: active ? colors.coral : `conic-gradient(${colors.korall}, ${colors.coral}, ${colors.lilac}, ${colors.korall})` }}
    >
      <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full" style={{ border: `3px solid ${colors.cream}`, backgroundColor: active ? colors.coral : colors.white }}>
        {children}
      </span>
    </span>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="text-2xl sm:text-3xl" style={{ fontFamily: serif, fontWeight: 700, letterSpacing: "-0.01em", color: colors.plum }}>
        {children}
      </h2>
      {action}
    </div>
  );
}

// Chips for switching between the customer's parties, plus "Ny fest".
function EventSwitcher({ events, activeId, onSelect, onNew, label = "Dina event" }) {
  if (!events.length && !onNew) return null;
  return (
    <div>
      {label && <p className="mb-2 text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: colors.plumSoft }}>{label}</p>}
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {events.map((e) => (
          <PillChip key={e.id} active={e.id === activeId} onClick={() => onSelect(e.id)}>
            {e.title || "Fest"}
            {e.date && <span style={{ opacity: 0.75, fontWeight: 400 }}>· {new Date(`${e.date}T00:00:00`).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}</span>}
          </PillChip>
        ))}
        {onNew && (
          <button onClick={onNew} className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold" style={{ border: `1.5px dashed ${colors.lilac}`, color: colors.coral, backgroundColor: "transparent" }}>
            <Plus size={15} /> Nytt event
          </button>
        )}
      </div>
    </div>
  );
}

function HomeView({ party, setParty, onBuild, onExplore, onExploreCategory, howItWorksRef, onVendorIntro, session, profile, upcomingEvent, onPlanning, onToggleTask, popular = [], onViewProvider, storyGroups = [], seenStories, onOpenStory, reviewsDue = [], onReview, events = [], activeEventId, onSelectEvent, onNewEvent }) {
  const ev = session ? events.find((e) => e.id === activeEventId) || upcomingEvent : null;
  const evDays = ev?.date ? daysUntil(ev.date) : null;
  const tasks = ev?.tasks || [];
  const done = tasks.filter((t) => t.done).length;
  const nextTasks = tasks.filter((t) => !t.done).slice(0, 3);
  const guestList = ev?.guestList || [];
  const answered = guestList.filter((g) => g.status && g.status !== "pending").length;
  const budgetSpent = ev ? (ev.budget || []).reduce((n, b) => n + (b.actual != null ? b.actual : b.estimated || 0), 0) : 0;
  const firstName = (profile?.full_name || "").trim().split(/\s+/)[0];

  return (
    <div className="pb-6">
      {session && reviewsDue.length > 0 && (
        <section className="mx-auto max-w-3xl px-5 pt-6 sm:px-8">
          <ReviewPrompt due={reviewsDue} onReview={onReview} />
        </section>
      )}
      {ev ? (
        <section className="mx-auto max-w-3xl px-5 pt-6 sm:px-8 sm:pt-10">
          <div className="mb-4 flex items-center gap-3">
            {profile?.avatar_url && <img src={profile.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" style={{ border: `2px solid ${colors.white}`, boxShadow: `0 0 0 2px ${colors.lilac}` }} />}
            <h1 className="text-3xl" style={{ fontFamily: serif, fontWeight: 700, color: colors.plum }}>
              Hej{firstName ? ` ${firstName}` : ""}!
            </h1>
          </div>
          <div className="mb-4">
            <EventSwitcher events={events} activeId={ev.id} onSelect={onSelectEvent} onNew={onNewEvent} label={events.length > 1 ? "Dina event" : null} />
          </div>
          <button onClick={onPlanning} className="flex w-full flex-col gap-4 p-5 text-left sm:p-7" style={{ backgroundColor: colors.plum, color: colors.white, borderRadius: 26 }}>
            <span className="flex w-full items-start justify-between gap-4">
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.12em", color: colors.lilacSoft }}>Ditt event</span>
                <span className="truncate" style={{ fontFamily: serif, fontWeight: 700, fontSize: 24, lineHeight: 1.15 }}>{ev.title || "Ditt event"}</span>
                <span className="text-sm" style={{ color: colors.lilacSoft }}>
                  {[formatEventDate(ev.date), ev.guests ? `${ev.guests} gäster` : null].filter(Boolean).join(" · ") || "Inget datum satt än"}
                </span>
              </span>
              {evDays != null && evDays >= 0 && (
                <span className="flex h-[74px] w-[74px] flex-shrink-0 flex-col items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)" }}>
                  <span style={{ fontFamily: serif, fontWeight: 700, fontSize: 24, lineHeight: 1 }}>{evDays}</span>
                  <span className="text-[11px]" style={{ color: colors.lilacSoft }}>{evDays === 1 ? "dag kvar" : "dagar kvar"}</span>
                </span>
              )}
            </span>
            <span className="flex w-full flex-col gap-1.5">
              <span className="flex justify-between text-[13px]">
                <span>{tasks.length ? `${done} av ${tasks.length} klara i checklistan` : "Din planering väntar"}</span>
                <span className="font-semibold">Öppna Mina event →</span>
              </span>
              {tasks.length > 0 && (
                <span className="flex h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.18)" }}>
                  <span className="rounded-full" style={{ width: `${Math.round((done / tasks.length) * 100)}%`, backgroundColor: colors.korall }} />
                </span>
              )}
            </span>
          </button>

          <button onClick={onBuild} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold" style={{ backgroundColor: colors.coral, color: colors.white }}>
            Hitta leverantörer till {ev.title || "eventet"} <ArrowRight size={17} />
          </button>

          {nextTasks.length > 0 && (
            <div className="mt-6">
              <SectionTitle>Nästa steg</SectionTitle>
              <div className="overflow-hidden" style={{ backgroundColor: colors.white, border: `1px solid ${colors.beige}`, borderRadius: 20 }}>
                {nextTasks.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2" style={{ borderTop: i ? `1px solid ${colors.cream}` : "none" }}>
                    <button onClick={() => onToggleTask(ev.id, t.id)} aria-label={`Markera som klar: ${t.title}`} className="flex h-11 w-11 flex-shrink-0 items-center justify-center">
                      <span className="h-6 w-6 rounded-full" style={{ border: `2px solid ${colors.lilac}` }} />
                    </button>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-medium" style={{ color: colors.plum }}>{t.title}</span>
                      {t.dueDate && <span className="text-xs" style={{ color: colors.plumSoft }}>Senast {formatEventDate(t.dueDate)}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { icon: Users, value: guestList.length ? `${answered}/${guestList.length}` : "–", label: "gäster har svarat", bg: colors.lilacSoft },
              { icon: Wallet, value: ev.budgetTotal ? formatKr(budgetSpent) : "–", label: ev.budgetTotal ? `av ${formatKr(ev.budgetTotal)}` : "ingen budget satt", bg: colors.peachSoft },
              { icon: ListChecks, value: tasks.length ? `${done}/${tasks.length}` : "–", label: "i checklistan", bg: colors.pinkSoft },
            ].map(({ icon: Icon, value, label, bg }) => (
              <button key={label} onClick={onPlanning} className="flex flex-col gap-1 p-3 text-left" style={{ backgroundColor: bg, borderRadius: 18, color: colors.plum }}>
                <Icon size={18} color={colors.coral} />
                <span className="truncate" style={{ fontFamily: serif, fontWeight: 700, fontSize: 19 }}>{value}</span>
                <span className="text-xs" style={{ color: colors.plumSoft }}>{label}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="px-5 pb-2 pt-8 sm:px-8 sm:pt-14">
          <div className="mx-auto max-w-5xl">
            <h1 style={{ fontFamily: serif, fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.02em", color: colors.plum }} className="text-4xl sm:text-6xl">
              Vad ska ni fira?
            </h1>
            <p className="mt-3 max-w-lg text-base sm:text-lg" style={{ color: colors.plumSoft, lineHeight: 1.55 }}>
              Från babyshower och dop till kickoff och konferens – hitta, jämför och boka allt på ett ställe. Just nu i Göteborg.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["babyshower", "baptism", "birthday", "corporate", "other"].map((id) => occasionMap[id]).map((o) => (
                <PillChip key={o.id} active={party.occasion === o.id} onClick={() => setParty((p) => ({ ...p, occasion: p.occasion === o.id ? null : o.id }))}>
                  {o.label}
                </PillChip>
              ))}
            </div>
            <button
              onClick={onBuild}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full py-4 text-base font-bold sm:w-auto sm:px-10"
              style={{ backgroundColor: colors.coral, color: colors.white }}
            >
              Planera ditt event <ArrowRight size={18} />
            </button>
          </div>
        </section>
      )}

      {storyGroups.length > 0 ? (
        <>
          <section aria-label="Stories" className="pt-8">
            <StoryRings groups={storyGroups} seen={seenStories} onOpen={onOpenStory} />
          </section>
          <section aria-label="Kategorier" className="pt-3">
            <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-5 pb-1 sm:flex-wrap sm:px-8">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                return (
                  <PillChip key={c.id} onClick={() => onExploreCategory(c.id)}>
                    <Icon size={15} color={colors.coral} /> {c.label}
                  </PillChip>
                );
              })}
            </div>
          </section>
        </>
      ) : (
      <section aria-label="Kategorier" className="pt-8">
        <div className="mx-auto flex max-w-5xl gap-4 overflow-x-auto px-5 pb-2 sm:flex-wrap sm:justify-center sm:gap-7 sm:px-8">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <button key={c.id} onClick={() => onExploreCategory(c.id)} className="flex flex-shrink-0 flex-col items-center gap-2">
                <StoryRing>
                  <span className="flex h-full w-full items-center justify-center" style={{ backgroundColor: colors[c.tint] || colors.lilacSoft }}>
                    <Icon size={26} color={colors.coral} />
                  </span>
                </StoryRing>
                <span className="text-xs font-semibold" style={{ color: colors.plum }}>{c.label}</span>
              </button>
            );
          })}
        </div>
      </section>
      )}

      {!ev && (
        <section className="mx-auto max-w-5xl px-5 pt-10 sm:px-8">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-8" style={{ backgroundColor: colors.white, border: `1px solid ${colors.beige}`, borderRadius: 24 }}>
            <div className="sm:flex-1">
              <h2 className="text-2xl" style={{ fontFamily: serif, fontWeight: 700, color: colors.plum }}>Hela eventet på ett ställe</h2>
              <p className="mt-1 text-sm leading-relaxed sm:text-base" style={{ color: colors.plumSoft }}>
                Oavsett om det är ett kalas eller ett företagsevent får du en egen planeringssida – gratis.
              </p>
              <button onClick={onPlanning} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: colors.coral }}>
                Se hur det fungerar <ArrowRight size={15} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:w-[320px]">
              {[
                { icon: ListChecks, label: "Checklista", bg: colors.lilacSoft },
                { icon: Users, label: "Gästlista", bg: colors.pinkSoft },
                { icon: Wallet, label: "Budget", bg: colors.peachSoft },
                { icon: PartyPopper, label: "Leverantörer", bg: colors.coralSoft },
              ].map(({ icon: Icon, label, bg }) => (
                <span key={label} className="flex items-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold" style={{ backgroundColor: bg, color: colors.plum }}>
                  <Icon size={18} color={colors.coral} /> {label}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {popular.length > 0 && (
        <section className="mx-auto max-w-5xl px-5 pt-12 sm:px-8">
          <SectionTitle
            action={
              <button onClick={onExplore} className="text-sm font-semibold" style={{ color: colors.coral }}>
                Se alla
              </button>
            }
          >
            {ev ? "Förslag till ditt event" : "Populära just nu"}
          </SectionTitle>
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 lg:grid-cols-4">
            {popular.map((p) => (
              <VendorCard key={p.id} provider={p} party={null} compact onView={onViewProvider} onAdd={() => {}} onRemove={() => {}} />
            ))}
          </div>
        </section>
      )}

      {!ev && (
        <section ref={howItWorksRef} className="mx-auto max-w-5xl px-5 pt-12 sm:px-8" style={{ scrollMarginTop: 80 }}>
          <SectionTitle>Så funkar det</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {[
              { n: 1, title: "Bygg ditt event", text: "Kalas, kickoff eller konferens – välj datum, antal gäster och vad du behöver, så visar vi vilka som är lediga." },
              { n: 2, title: "Jämför & fråga", text: "Kika på bilder och omdömen, chatta med leverantören eller begär offert." },
              { n: 3, title: "Boka & fira", text: "Godkänn offerten, fira din dag och lämna ett omdöme efteråt." },
            ].map((st) => (
              <div key={st.n} className="flex items-start gap-4 p-5 sm:flex-col sm:gap-3 sm:p-6" style={{ backgroundColor: colors.coralSoft, borderRadius: 22 }}>
                <span style={{ fontFamily: serif, fontStyle: "italic", fontWeight: 600, fontSize: 38, lineHeight: 1, color: colors.coral, minWidth: 24 }}>{st.n}</span>
                <span className="flex flex-col gap-1">
                  <span className="text-base font-bold" style={{ color: colors.plum }}>{st.title}</span>
                  <span className="text-sm leading-relaxed" style={{ color: colors.plumSoft }}>{st.text}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {onVendorIntro && !ev && (
        <section className="mx-auto max-w-5xl px-5 pb-10 pt-12 sm:px-8">
          <div className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-10" style={{ backgroundColor: colors.lilacSoft, border: `1px solid ${colors.lilac}`, borderRadius: 24 }}>
            <div className="max-w-lg">
              <p className="text-xs font-bold uppercase" style={{ letterSpacing: "0.12em", color: colors.coral }}>För leverantörer</p>
              <h2 className="mt-1 text-2xl sm:text-3xl" style={{ fontFamily: serif, fontWeight: 700, color: colors.plum, lineHeight: 1.2 }}>Visa upp ditt arbete där kunderna letar</h2>
              <p className="mt-2 text-sm sm:text-base" style={{ color: colors.plumSoft }}>Privatpersoner och företag hittar dig här. Samla bilder, omdömen och förfrågningar på en egen profil.</p>
            </div>
            <button onClick={onVendorIntro} className="mt-2 flex-shrink-0 rounded-full px-6 py-3 text-sm font-bold sm:mt-0" style={{ backgroundColor: colors.plum, color: colors.white }}>
              Bli leverantör
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function BuilderView({ party, setParty, onSubmit, onClose, events = [], activeEventId, onSelectEvent, onNewEvent }) {
  const toggleCategory = (id) =>
    setParty((p) => ({ ...p, categories: p.categories.includes(id) ? p.categories.filter((c) => c !== id) : [...p.categories, id] }));
  const canSubmit = party.date && party.categories.length > 0;
  const fieldStyle = { border: `1px solid ${colors.beige}`, backgroundColor: colors.white, color: colors.plum, fontWeight: 500 };
  const guestsNum = Number(party.guests) || 0;
  const setGuests = (n) => setParty((p) => ({ ...p, guests: Math.max(1, n) }));
  const occ = party.occasion ? occasionMap[party.occasion] : null;

  return (
    <div className="mx-auto max-w-2xl px-5 pb-36 pt-4 sm:px-8 sm:pt-8">
      <button onClick={onClose} className="-ml-2 flex items-center gap-1 rounded-full px-2 py-2 text-sm font-medium" style={{ color: colors.plumSoft }}>
        <ChevronLeft size={18} /> Tillbaka
      </button>
      {events.length > 0 && (
        <div className="mt-3">
          <EventSwitcher events={events} activeId={activeEventId} onSelect={onSelectEvent} onNew={onNewEvent} label="Det här gäller" />
        </div>
      )}
      <h1 className="mt-4 text-3xl sm:text-4xl" style={{ fontFamily: serif, fontWeight: 700, color: colors.plum, lineHeight: 1.15 }}>
        Berätta om ert event
      </h1>
      <p className="mt-2 text-base" style={{ color: colors.plumSoft }}>
        Så visar vi bara leverantörer som är lediga och passar.
      </p>

      <fieldset className="mt-7">
        <legend className="mb-3 text-[15px] font-bold" style={{ color: colors.plum }}>Vad är det för tillfälle?</legend>
        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map((o) => (
            <PillChip key={o.id} active={party.occasion === o.id} onClick={() => setParty((p) => ({ ...p, occasion: p.occasion === o.id ? null : o.id }))}>
              {o.label}
            </PillChip>
          ))}
        </div>
      </fieldset>

      <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="col-span-2 flex flex-col gap-1.5 text-[13px] font-semibold sm:col-span-1" style={{ color: colors.plumSoft }}>
          Datum
          <input type="date" value={party.date} onChange={(e) => setParty((p) => ({ ...p, date: e.target.value }))} className="h-12 rounded-2xl px-4 text-[15px]" style={fieldStyle} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold" style={{ color: colors.plumSoft }}>
          Start
          <input type="time" value={party.startTime} onChange={(e) => setParty((p) => ({ ...p, startTime: e.target.value }))} className="h-12 rounded-2xl px-4 text-[15px]" style={fieldStyle} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold" style={{ color: colors.plumSoft }}>
          Slut
          <input type="time" value={party.endTime} onChange={(e) => setParty((p) => ({ ...p, endTime: e.target.value }))} className="h-12 rounded-2xl px-4 text-[15px]" style={fieldStyle} />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 px-4 py-3" style={{ backgroundColor: colors.white, border: `1px solid ${colors.beige}`, borderRadius: 18 }}>
        <span className="flex flex-col">
          <span className="text-[15px] font-bold" style={{ color: colors.plum }}>Antal gäster</span>
        </span>
        <span className="flex items-center gap-2">
          <button onClick={() => setGuests(guestsNum - 5)} aria-label="Färre gäster" className="flex h-11 w-11 items-center justify-center rounded-full text-xl" style={{ border: `1px solid ${colors.beige}`, backgroundColor: colors.cream, color: colors.plum }}>
            −
          </button>
          <input
            type="number"
            min={1}
            aria-label="Antal gäster"
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
            className="w-14 bg-transparent text-center text-lg font-bold"
            style={{ color: colors.plum, border: "none" }}
          />
          <button onClick={() => setGuests(guestsNum + 5)} aria-label="Fler gäster" className="flex h-11 w-11 items-center justify-center rounded-full text-xl" style={{ border: `1px solid ${colors.beige}`, backgroundColor: colors.cream, color: colors.plum }}>
            +
          </button>
        </span>
      </div>

      <fieldset className="mt-8">
        <legend className="text-[15px] font-bold" style={{ color: colors.plum }}>Vad behöver ni?</legend>
        <p className="mb-3 mt-1 text-[13px]" style={{ color: colors.plumSoft }}>Välj så många du vill – du kan ändra sen.</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const on = party.categories.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCategory(c.id)}
                aria-pressed={on}
                className="relative flex h-24 flex-col items-center justify-center gap-2 text-[13px]"
                style={{ borderRadius: 18, border: on ? `2px solid ${colors.coral}` : `1px solid ${colors.beige}`, backgroundColor: on ? colors.lilacSoft : colors.white, color: colors.plum, fontWeight: on ? 700 : 500 }}
              >
                <Icon size={24} color={on ? colors.coral : colors.plumSoft} />
                {c.label}
                {on && (
                  <span className="absolute right-1.5 top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full" style={{ backgroundColor: colors.coral }}>
                    <Check size={11} color={colors.white} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="fixed inset-x-0 bottom-0 z-40 px-5 pb-5 pt-3 sm:px-8" style={{ backgroundColor: colors.white, borderTop: `1px solid ${colors.beige}` }}>
        <div className="mx-auto max-w-2xl">
          <p className="mb-2 text-center text-[13px]" style={{ color: colors.plumSoft }}>
            {canSubmit
              ? [occ?.label, `${party.guests || 1} gäster`, `${party.categories.length} ${party.categories.length === 1 ? "kategori" : "kategorier"}`].filter(Boolean).join(" · ")
              : "Välj datum och minst en kategori för att komma igång."}
          </p>
          <button
            disabled={!canSubmit}
            onClick={onSubmit}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-base font-bold transition-opacity"
            style={{ backgroundColor: colors.coral, color: colors.white, opacity: canSubmit ? 1 : 0.45, cursor: canSubmit ? "pointer" : "not-allowed" }}
          >
            Visa lediga leverantörer <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function BottomTabBar({ active, unread, onHome, onExplore, onMinFest, onMessages, onMinSida }) {
  const items = [
    { id: "home", label: "Hem", icon: Home, onClick: onHome },
    { id: "explore", label: "Utforska", icon: Search, onClick: onExplore },
    { id: "minfest", label: "Mina event", icon: PartyPopper, onClick: onMinFest },
    { id: "messages", label: "Meddelanden", icon: MessageCircle, onClick: onMessages, badge: unread },
    { id: "minsida", label: "Min sida", icon: User, onClick: onMinSida },
  ];
  return (
    <nav aria-label="Huvudmeny" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 lg:hidden" style={{ backgroundColor: colors.white, borderTop: `1px solid ${colors.beige}`, paddingBottom: "env(safe-area-inset-bottom)" }}>
      {items.map(({ id, label, icon: Icon, onClick, badge }) => {
        const on = active === id;
        return (
          <button key={id} onClick={onClick} aria-current={on ? "page" : undefined} className="relative flex flex-col items-center gap-1 pb-2.5 pt-2 text-[11px]" style={{ color: on ? colors.coral : colors.plumSoft, fontWeight: on ? 700 : 500 }}>
            <Icon size={23} strokeWidth={on ? 2.2 : 1.8} />
            {label}
            {badge > 0 && (
              <span className="absolute top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold" style={{ left: "calc(50% + 6px)", backgroundColor: colors.korall, color: colors.white }}>
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function MinFestBoard({ cart, categories, total, onOpenCart, onExploreCategory }) {
  const filled = new Set(cart.map((p) => p.category));
  const empty = categories.filter((c) => !filled.has(c));
  if (cart.length === 0 && empty.length === 0) {
    return (
      <div className="mt-5 p-6 text-center" style={{ backgroundColor: colors.white, border: `1px dashed ${colors.lilac}`, borderRadius: 20 }}>
        <p className="text-[15px] font-semibold" style={{ color: colors.plum }}>Inga leverantörer valda än</p>
        <p className="mt-1 text-sm" style={{ color: colors.plumSoft }}>Hitta lediga leverantörer och lägg till dem här.</p>
        <button onClick={() => onExploreCategory(null)} className="mt-4 rounded-full px-5 py-2.5 text-sm font-bold" style={{ backgroundColor: colors.coral, color: colors.white }}>
          Utforska leverantörer
        </button>
      </div>
    );
  }
  return (
    <div className="mt-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cart.map((p) => (
          <button key={p.id} onClick={onOpenCart} className="flex flex-col overflow-hidden text-left" style={{ backgroundColor: colors.white, border: `1px solid ${colors.beige}`, borderRadius: 18 }}>
            <span className="relative block h-28 w-full" style={{ backgroundColor: colors.coralSoft }}>
              <img src={p.image || `https://picsum.photos/seed/${p.seed}/400/300`} alt="" className="h-full w-full object-cover" />
              <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: "rgba(255,255,255,0.92)", color: colors.plum }}>
                {catMap[p.category]?.label}
              </span>
            </span>
            <span className="flex flex-col gap-0.5 px-3 pb-3 pt-2">
              <span className="truncate" style={{ fontFamily: serif, fontWeight: 700, fontSize: 16, color: colors.plum }}>{p.name}</span>
              <span className="text-xs font-semibold" style={{ color: colors.coral }}>Byt eller ändra</span>
            </span>
          </button>
        ))}
        {empty.map((id) => (
          <button key={id} onClick={() => onExploreCategory(id)} className="flex min-h-[176px] flex-col items-center justify-center gap-2 p-3 text-center" style={{ border: `2px dashed ${colors.lilac}`, borderRadius: 18, color: colors.plum }}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: colors.lilacSoft }}>
              <Plus size={20} color={colors.coral} />
            </span>
            <span className="text-[15px] font-bold">{catMap[id]?.label}</span>
            <span className="text-xs" style={{ color: colors.plumSoft }}>Hitta lediga</span>
          </button>
        ))}
      </div>
      {cart.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 p-4" style={{ backgroundColor: colors.white, border: `1px solid ${colors.beige}`, borderRadius: 18 }}>
          <span className="flex justify-between text-sm" style={{ color: colors.plum }}>
            <span style={{ color: colors.plumSoft }}>Uppskattat totalt ({cart.length} {cart.length === 1 ? "leverantör" : "leverantörer"})</span>
            <span className="font-bold">{formatKr(total)}</span>
          </span>
          <button onClick={onOpenCart} className="mt-1 h-12 rounded-full text-[15px] font-bold" style={{ backgroundColor: colors.coral, color: colors.white }}>
            Gå vidare till bokning
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mina event → Leverantörer: one row per vendor with where things stand in plain words and the one thing
// to do next, so nobody has to hunt between chats, quotes, the booking and Mina bokningar.
// ---------------------------------------------------------------------------
const VENDOR_STEP = {
  quote_ready: { label: "Offert klar", bg: colors.peach, fg: colors.coralDeep, cta: "Se offerten", action: true, order: 1 },
  replied_new: { label: "Nytt svar", bg: colors.peach, fg: colors.coralDeep, cta: "Läs svaret", action: true, order: 2 },
  ready_to_book: { label: "Redo att boka", bg: colors.greenSoft, fg: colors.green, cta: "Boka nu", action: true, order: 3 },
  declined: { label: "Kunde inte", bg: colors.coralSoft, fg: colors.coralDeep, cta: "Hitta ett alternativ", action: true, order: 4 },
  waiting: { label: "Väntar på svar", bg: colors.lilacSoft, fg: colors.lilacDeep, cta: "Öppna chatten", order: 5 },
  replied: { label: "Har svarat", bg: colors.lilacSoft, fg: colors.lilacDeep, cta: "Öppna chatten", order: 6 },
  awaiting_confirm: { label: "Väntar på bekräftelse", bg: colors.lilacSoft, fg: colors.lilacDeep, cta: "Visa bokningen", order: 7 },
  quote_accepted: { label: "Offert godkänd", bg: colors.greenSoft, fg: colors.green, cta: "Öppna chatten", order: 8 },
  booked: { label: "Bokad ✓", bg: colors.greenSoft, fg: colors.green, cta: "Skriv till dem", order: 9 },
  declined_quote: { label: "Du tackade nej", bg: colors.beige, fg: colors.plumSoft, cta: "Öppna chatten", order: 10 },
};

function sinceText(iso) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? "idag" : days === 1 ? "igår" : `för ${days} dagar sedan`;
}

function buildVendorRows({ ev, statuses, bookings, cart, multipleEvents }) {
  const rows = new Map();
  const put = (key, row) => rows.set(key, { ...(rows.get(key) || {}), ...row });
  const evBookings = (bookings || []).filter((b) => !b.cancelled && (!ev || b.eventId === ev.id || (!b.eventId && ev.date && b.date === ev.date)));
  evBookings.forEach((b) =>
    b.items.forEach((i) => {
      if (i.status === "cancelled" || !i.vendorId) return;
      const step = i.status === "confirmed" || i.status === "completed" ? "booked" : i.status === "declined" ? "declined" : "awaiting_confirm";
      put(`${i.vendorId}-${i.category}`, { vendorId: i.vendorId, category: i.category, name: i.name, step, amount: Number(i.price) || 0, bookingNumber: b.bookingNumber });
    })
  );
  (cart || []).forEach((p) => {
    if (!p.vendorDbId) return;
    const key = `${p.vendorDbId}-${p.category}`;
    if (rows.has(key)) return;
    put(key, { vendorId: p.vendorDbId, category: p.category, name: p.name, step: "ready_to_book", amount: p.pricing?.amount || 0 });
  });
  (statuses || []).forEach((s) => {
    const forThisEvent = !ev || !multipleEvents || !s.brief_date || !ev.date || s.brief_date === ev.date;
    if (!forThisEvent) return;
    const key = `${s.vendor_id}-${s.category_id}`;
    const base = { vendorId: s.vendor_id, category: s.category_id, name: s.vendor_name, conversationId: s.conversation_id, unread: s.unread, lastAt: s.last_at };
    if (rows.has(key)) {
      put(key, base);
      return;
    }
    let step = "waiting";
    let amount = 0;
    if (s.open_quote_id) {
      step = "quote_ready";
      amount = Number(s.open_quote_amount) || 0;
    } else if (s.accepted_quote_id) {
      step = "quote_accepted";
      amount = Number(s.accepted_quote_amount) || 0;
    } else if (s.last_quote_status === "declined") step = "declined_quote";
    else if (s.last_sender === "vendor") step = s.unread > 0 ? "replied_new" : "replied";
    else if (!s.has_brief && !s.last_sender) return; // an empty chat that was opened but never used
    put(key, { ...base, step, amount });
  });
  return [...rows.values()].sort((a, b) => VENDOR_STEP[a.step].order - VENDOR_STEP[b.step].order);
}

function VendorStatusBoard({ ev, statuses, bookings, cart, cartTotal, multipleEvents, providers, categories, onOpenConversation, onOpenCart, onExploreCategory, onGoBookings }) {
  const rows = buildVendorRows({ ev, statuses, bookings, cart, multipleEvents });
  const todo = rows.filter((r) => VENDOR_STEP[r.step].action).length;
  const covered = new Set(rows.filter((r) => !["declined", "declined_quote"].includes(r.step)).map((r) => r.category));
  const missing = (categories || []).filter((c) => !covered.has(c));
  const ready = rows.filter((r) => r.step === "ready_to_book");

  const detail = (r) => {
    switch (r.step) {
      case "quote_ready":
        return `${formatKr(r.amount)} · titta på vad som ingår och godkänn`;
      case "replied_new":
        return `${r.unread} ${r.unread === 1 ? "nytt meddelande" : "nya meddelanden"}`;
      case "ready_to_book":
        return `Offerten på ${formatKr(r.amount)} är godkänd. Boka för att säkra datumet.`;
      case "declined":
        return `Kunde inte ta uppdraget. Välj en annan ${(catMap[r.category]?.label || "leverantör").toLowerCase()}.`;
      case "waiting":
        return `Förfrågan skickad ${sinceText(r.lastAt)}. De flesta svarar inom ett dygn.`;
      case "replied":
        return "Har svarat i chatten. Offerten kommer där.";
      case "awaiting_confirm":
        return `Bokning ${r.bookingNumber} skickad. Leverantören bekräftar inom 24 timmar.`;
      case "quote_accepted":
        return `Du har godkänt offerten på ${formatKr(r.amount)}.`;
      case "booked":
        return r.amount ? `${formatKr(r.amount)} · bokning ${r.bookingNumber}` : `Bokning ${r.bookingNumber}`;
      default:
        return "";
    }
  };
  const act = (r) => {
    if (r.step === "ready_to_book") return onOpenCart();
    if (r.step === "declined") return onExploreCategory(r.category);
    if (r.step === "awaiting_confirm" || (r.step === "booked" && !r.conversationId)) return onGoBookings();
    if (r.conversationId) return onOpenConversation(r);
    return onGoBookings();
  };

  if (rows.length === 0) {
    return (
      <div className="mt-5 p-6 text-center" style={{ backgroundColor: colors.white, border: `1px dashed ${colors.lilac}`, borderRadius: 20 }}>
        <p className="text-[15px] font-semibold" style={{ color: colors.plum }}>Inga leverantörer än</p>
        <p className="mt-1 text-sm" style={{ color: colors.plumSoft }}>Hitta lediga leverantörer och skicka en förfrågan. Här ser du sedan vem som har svarat och vad som är bokat.</p>
        <button onClick={() => onExploreCategory(null)} className="mt-4 rounded-full px-5 py-2.5 text-sm font-bold" style={{ backgroundColor: colors.coral, color: colors.white }}>
          Hitta leverantörer
        </button>
        {missing.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {missing.map((id) => (
              <button key={id} onClick={() => onExploreCategory(id)} className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ border: `1.5px dashed ${colors.lilac}`, color: colors.plum }}>
                + {catMap[id]?.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-5">
      <p className="text-sm font-semibold" style={{ color: todo ? colors.coralDeep : colors.plumSoft }}>
        {todo ? `${todo} ${todo === 1 ? "sak väntar" : "saker väntar"} på dig` : "Inget du behöver göra just nu"}
      </p>
      <div className="mt-3 space-y-2.5">
        {rows.map((r) => {
          const meta = VENDOR_STEP[r.step];
          const prov = (providers || []).find((p) => p.vendorDbId === r.vendorId && p.category === r.category) || (providers || []).find((p) => p.vendorDbId === r.vendorId);
          return (
            <div
              key={`${r.vendorId}-${r.category}`}
              className="flex items-center gap-3 p-3"
              style={{ backgroundColor: colors.white, border: `1.5px solid ${meta.action ? colors.korall : colors.beige}`, borderRadius: 20 }}
            >
              {prov?.image ? (
                <img src={prov.image} alt="" className="h-12 w-12 flex-shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-lg" style={{ backgroundColor: colors.coralSoft, fontFamily: serif, fontWeight: 700, color: colors.coral }}>
                  {(r.name || "?").charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate text-[15px] font-semibold" style={{ color: colors.plum }}>{r.name}</span>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: meta.bg, color: meta.fg }}>{meta.label}</span>
                </div>
                <p className="text-xs" style={{ color: colors.plumSoft }}>{catMap[r.category]?.label}</p>
                <p className="mt-0.5 text-[13px] leading-snug" style={{ color: colors.plum }}>{detail(r)}</p>
                <button
                  onClick={() => act(r)}
                  className="mt-2 rounded-full px-4 py-2 text-xs font-bold"
                  style={meta.action ? { backgroundColor: colors.coral, color: colors.white } : { border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }}
                >
                  {meta.cta}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {ready.length > 1 && (
        <button onClick={onOpenCart} className="mt-4 h-12 w-full rounded-full text-[15px] font-bold" style={{ backgroundColor: colors.coral, color: colors.white }}>
          Boka alla {ready.length} · {formatKr(cartTotal)}
        </button>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {missing.map((id) => (
          <button key={id} onClick={() => onExploreCategory(id)} className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ border: `1.5px dashed ${colors.lilac}`, color: colors.plum }}>
            + {catMap[id]?.label}
          </button>
        ))}
        <button onClick={() => onExploreCategory(null)} className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ border: `1.5px dashed ${colors.lilac}`, color: colors.plum }}>
          + Hitta fler leverantörer
        </button>
      </div>
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
  const fieldStyle = { border: `1px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white };
  const all = groups.flatMap((g) => g.providers);
  const dateLabel = party.date ? new Date(`${party.date}T00:00:00`).toLocaleDateString("sv-SE", { day: "numeric", month: "short" }) : "";
  const filterSummary = [dateLabel || "Inget datum", `${party.guests || 1} gäster`].join(", ");
  const grid = "grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4";

  return (
    <div className="mx-auto max-w-6xl px-5 pb-32 pt-6 sm:px-8 sm:pt-8">
      {swapContext ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4" style={{ backgroundColor: colors.lilacSoft }}>
          <p className="text-sm" style={{ color: colors.plum }}>
            Byter ut <strong>{swapContext.oldName}</strong> — här är andra alternativ inom {catMap[swapContext.category].label.toLowerCase()}.
          </p>
          <button onClick={onCancelSwap} className="text-sm font-semibold underline" style={{ color: colors.coral }}>
            Avbryt byte
          </button>
        </div>
      ) : (
        <>
          <h1 className="text-3xl sm:text-4xl" style={{ fontFamily: serif, fontWeight: 700, letterSpacing: "-0.01em", color: colors.plum }}>Utforska</h1>
          <label className="mt-4 flex h-12 items-center gap-2.5 rounded-full px-4" style={{ backgroundColor: colors.white, border: `1px solid ${colors.beige}` }}>
            <Search size={19} color={colors.plumSoft} />
            <span className="sr-only">Sök</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sök leverantör, tjänst eller område"
              className="flex-1 bg-transparent text-[15px] outline-none"
              style={{ color: colors.plum, border: "none" }}
            />
          </label>
          <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            <PillChip active={party.categories.length === 0} onClick={() => setParty((p) => ({ ...p, categories: [] }))}>
              Alla
            </PillChip>
            {CATEGORIES.map((c) => (
              <PillChip key={c.id} active={party.categories.includes(c.id)} onClick={() => toggleCategory(c.id)}>
                {c.label}
              </PillChip>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm" style={{ color: colors.plumSoft }}>
            <span>{all.length} {all.length === 1 ? "leverantör" : "leverantörer"} i Göteborg</span>
            <button onClick={() => setEditOpen((v) => !v)} aria-expanded={editOpen} className="flex h-11 items-center gap-1.5 font-semibold" style={{ color: colors.plum }}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
              <span className="hidden sm:inline">Filter · </span>{filterSummary}
            </button>
          </div>

          {editOpen && (
            <div className="mt-2 p-4 sm:p-5" style={{ backgroundColor: colors.white, border: `1px solid ${colors.beige}`, borderRadius: 20 }}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className="col-span-2 flex flex-col gap-1 text-[13px] font-semibold sm:col-span-1" style={{ color: colors.plumSoft }}>
                  Datum
                  <input type="date" value={party.date} onChange={(e) => setParty((p) => ({ ...p, date: e.target.value }))} className="h-11 rounded-xl px-3 text-sm" style={fieldStyle} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] font-semibold" style={{ color: colors.plumSoft }}>
                  Start
                  <input type="time" value={party.startTime} onChange={(e) => setParty((p) => ({ ...p, startTime: e.target.value }))} className="h-11 rounded-xl px-3 text-sm" style={fieldStyle} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] font-semibold" style={{ color: colors.plumSoft }}>
                  Slut
                  <input type="time" value={party.endTime} onChange={(e) => setParty((p) => ({ ...p, endTime: e.target.value }))} className="h-11 rounded-xl px-3 text-sm" style={fieldStyle} />
                </label>
                <label className="col-span-2 flex flex-col gap-1 text-[13px] font-semibold sm:col-span-1" style={{ color: colors.plumSoft }}>
                  Gäster
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
                    className="h-11 rounded-xl px-3 text-sm"
                    style={fieldStyle}
                  />
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-[13px] font-semibold" style={{ color: colors.plumSoft }}>
                  Avstånd
                  <select value={distanceFilter} onChange={(e) => setDistanceFilter(e.target.value === "all" ? "all" : Number(e.target.value))} className="h-11 rounded-xl px-3 text-sm" style={fieldStyle}>
                    <option value="all">Alla avstånd</option>
                    <option value="5">Inom 5 km</option>
                    <option value="10">Inom 10 km</option>
                    <option value="25">Inom 25 km</option>
                    <option value="50">Inom 50 km</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[13px] font-semibold" style={{ color: colors.plumSoft }}>
                  Sortera
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-11 rounded-xl px-3 text-sm" style={fieldStyle}>
                    <option value="recommended">Rekommenderade</option>
                    <option value="rating">Högst betyg</option>
                    <option value="reviews">Flest omdömen</option>
                    <option value="price">Pris</option>
                    <option value="distance">Närmast först</option>
                  </select>
                </label>
              </div>
              <button onClick={() => setEditOpen(false)} className="mt-4 h-11 w-full rounded-full text-sm font-bold sm:w-auto sm:px-8" style={{ backgroundColor: colors.coral, color: colors.white }}>
                Visa resultat
              </button>
            </div>
          )}
        </>
      )}

      {swapContext ? (
        <div className={`mt-2 ${grid}`}>
          {swapProviders.map((p) => (
            <VendorCard key={p.id} provider={p} party={party} inCart={cart.includes(p.id)} onView={onView} onAdd={onAdd} onRemove={onRemove} swapMode />
          ))}
          {swapProviders.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm" style={{ color: colors.plumSoft }}>
              Inga andra alternativ tillgängliga i den här kategorin just nu.
            </p>
          )}
        </div>
      ) : all.length > 0 ? (
        <div className={`mt-4 ${grid}`}>
          {all.map((p) => (
            <VendorCard key={p.id} provider={p} party={party} inCart={cart.includes(p.id)} onView={onView} onAdd={onAdd} onRemove={onRemove} swapMode={false} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-sm" style={{ color: colors.plumSoft }}>
          Vi bygger just nu upp utbudet i Göteborg — inga leverantörer matchar just nu. Prova en annan kategori eller sökning, eller kom tillbaka snart!
        </p>
      )}
    </div>
  );
}

function ProfileView({ provider, party, inCart, cartAddons, onBack, onAdd, onRemove, onToggleAddon, onOpenChat, onSelectDate, onUpdateParty, onSendRequest, siblings = [], cartIds = [], onViewOther, storyIndex = -1, storyUnseen = false, onOpenStory, highlightGroups = [], onOpenHighlight, cartPackages = [], onAddPackage, onOpenCart }) {
  const [openPackageId, setOpenPackageId] = useState(null);
  const packagesRef = useRef(null);
  const cat = catMap[provider.category];
  const [requestOpen, setRequestOpen] = useState(false);
  const [pendingAddons, setPendingAddons] = useState([]);
  const [tab, setTab] = useState("posts");
  const [lightbox, setLightbox] = useState(null);
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
  const closedNow = !!party.date && !!provider.closedDates?.includes(party.date);
  const busyNow = !closedNow && isBusyAt(provider, party);
  const unavailableNow = closedNow || busyNow;
  const daySlots = party.date ? busyOnDate(provider, party.date) : [];

  const images = (provider.images && provider.images.length ? provider.images : [provider.image]).filter(Boolean);
  const avatar = images[0] || `https://picsum.photos/seed/${provider.seed}/300/300`;
  const reviewsList = provider.reviewsList || [];
  const priceLabel = provider.requestOnly
    ? provider.fromPrice > 0
      ? `Från ${formatKr(provider.fromPrice)}`
      : "Pris på förfrågan"
    : `Från ${formatKr(provider.pricing.amount)}${getUnitLabel(provider.pricing)}`;
  const dateLabel = party.date ? new Date(`${party.date}T00:00:00`).toLocaleDateString("sv-SE", { day: "numeric", month: "long" }) : "";
  const handle = provider.name.toLowerCase().replace(/[^a-z0-9åäö]+/g, "");
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: reviewsList.filter((r) => Math.round(Number(r.stars)) === n).length }));
  const maxCount = Math.max(1, ...dist.map((d) => d.count));
  const statNum = { fontFamily: sans, fontWeight: 700, fontSize: 18, color: colors.plum };
  const btnBase = "flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold";

  // Everything is booked through a quote first, so nobody can claim a price the vendor never agreed to.
  const askForQuote = () => (provider.request && provider.vendorDbId ? setRequestOpen(true) : onOpenChat(provider));
  const showPackages = () => {
    setTab("info");
    setTimeout(() => packagesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const primaryButton = inCart ? (
    <span className={`${btnBase} flex-1`} style={{ backgroundColor: colors.greenSoft, color: colors.green }}>
      <Check size={16} /> Offert godkänd
    </span>
  ) : provider.packagesOn ? (
    <button onClick={showPackages} className={`${btnBase} flex-1`} style={{ backgroundColor: colors.coral, color: colors.white }}>
      {cartPackages.length > 0 ? <><Check size={16} /> {cartPackages.length} {cartPackages.length === 1 ? "paket valt" : "paket valda"}</> : "Se paket & priser"}
    </button>
  ) : (
    <button onClick={askForQuote} className={`${btnBase} flex-1`} style={{ backgroundColor: colors.coral, color: colors.white }}>
      Skicka förfrågan
    </button>
  );

  const tabBtn = (id, label, Icon) => (
    <button
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className="flex h-12 items-center justify-center gap-1.5 text-sm"
      style={{ color: tab === id ? colors.plum : colors.plumSoft, fontWeight: tab === id ? 700 : 500, borderBottom: `2px solid ${tab === id ? colors.plum : "transparent"}` }}
    >
      <Icon size={17} /> {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-3xl pb-28">
      <div className="grid items-center px-2 py-2 sm:px-4" style={{ gridTemplateColumns: "44px 1fr 44px", borderBottom: `1px solid ${colors.beige}` }}>
        <button onClick={onBack} aria-label="Tillbaka" className="flex h-11 w-11 items-center justify-center" style={{ color: colors.plum }}>
          <ChevronLeft size={22} />
        </button>
        <span className="truncate text-center text-base font-semibold" style={{ color: colors.plum }}>{handle || provider.name}</span>
        <span className="flex justify-end">
          <HeartButton vendorId={provider.vendorDbId} />
        </span>
      </div>

      <div className="px-5 pt-5 sm:px-8">
        <div className="flex items-center gap-5">
          <button
            onClick={() => storyIndex >= 0 && onOpenStory(storyIndex)}
            disabled={storyIndex < 0}
            aria-label={storyIndex >= 0 ? `Visa story från ${provider.name}` : undefined}
            className="flex h-[92px] w-[92px] flex-shrink-0 rounded-full p-[3px]"
            style={{ background: storyIndex >= 0 ? (storyUnseen ? `conic-gradient(${colors.korall}, ${colors.coral}, ${colors.lilac}, ${colors.korall})` : colors.beige) : "transparent", cursor: storyIndex >= 0 ? "pointer" : "default" }}
          >
            <span className="h-full w-full overflow-hidden rounded-full" style={{ border: `3px solid ${colors.cream}` }}>
              <img src={avatar} alt={`${provider.name}s profilbild`} className="h-full w-full object-cover" />
            </span>
          </button>
          <div className="grid flex-1 grid-cols-3 text-center">
            <span className="flex flex-col">
              <span style={statNum}>{images.length}</span>
              <span className="text-xs" style={{ color: colors.plumSoft }}>{images.length === 1 ? "bild" : "bilder"}</span>
            </span>
            <button onClick={() => setTab("reviews")} className="flex flex-col">
              <span style={statNum} className="flex items-center justify-center gap-1">
                {provider.reviews > 0 ? (
                  <>
                    <Star size={15} fill={colors.coral} color={colors.coral} /> {provider.rating}
                  </>
                ) : (
                  "Ny"
                )}
              </span>
              <span className="text-xs" style={{ color: colors.plumSoft }}>{provider.reviews > 0 ? "betyg" : "leverantör"}</span>
            </button>
            <button onClick={() => setTab("reviews")} className="flex flex-col">
              <span style={statNum}>{provider.reviews || 0}</span>
              <span className="text-xs" style={{ color: colors.plumSoft }}>omdömen</span>
            </button>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="flex items-center gap-1.5" style={{ fontFamily: serif, fontWeight: 700, fontSize: 26, color: colors.plum, lineHeight: 1.15 }}>
            {provider.name}
            <span title="Granskad av Planifest" className="flex h-[18px] w-[18px] items-center justify-center rounded-full" style={{ backgroundColor: colors.coral }}>
              <Check size={11} color={colors.white} strokeWidth={3} />
            </span>
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: colors.plumSoft }}>
            {[cat?.label, ...(provider.alsoOffers || []).map((id) => catMap[id]?.label)].filter(Boolean).join(" · ")}
          </p>
          {provider.blurb && (
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed" style={{ color: colors.plum }}>
              {provider.blurb}
            </p>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-sm" style={{ color: colors.plumSoft }}>
            <MapPin size={15} /> {[provider.location, priceLabel].filter(Boolean).join(" · ")}
          </p>
          {party.date && (
            <span
              className="mt-3 inline-block rounded-full px-3 py-1.5 text-[13px] font-semibold"
              style={{ backgroundColor: unavailableNow ? colors.beige : colors.lilacSoft, color: unavailableNow ? colors.plumSoft : colors.coral }}
            >
              {closedNow ? `Stängd ${dateLabel}` : busyNow ? `Upptagen ${dateLabel}, ${party.startTime}–${party.endTime}` : `Ledig ${dateLabel}`}
            </span>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          {primaryButton}
          <button onClick={() => onOpenChat(provider)} className={`${btnBase} flex-1`} style={{ backgroundColor: colors.lilacSoft, color: colors.plum }}>
            <MessageCircle size={17} /> Meddelande
          </button>
        </div>

        {highlightGroups.length > 0 && (
          <div className="mt-5 flex gap-4 overflow-x-auto pb-1">
            {highlightGroups.map((g, i) => (
              <button key={g.key} onClick={() => onOpenHighlight(highlightGroups, i)} aria-label={`Visa höjdpunkten ${g.name}`} className="flex w-[68px] flex-shrink-0 flex-col items-center gap-1.5">
                <span className="h-16 w-16 overflow-hidden rounded-full p-[2px]" style={{ border: `1px solid ${colors.beige}`, backgroundColor: colors.white }}>
                  <span className="block h-full w-full overflow-hidden rounded-full" style={{ backgroundColor: colors.coralSoft }}>
                    {g.cover?.type === "video" ? (
                      <video src={g.cover.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    ) : g.cover ? (
                      <img src={g.cover.url} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                </span>
                <span className="w-full truncate text-center text-xs" style={{ color: colors.plum }}>{g.name}</span>
              </button>
            ))}
          </div>
        )}

        {siblings.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: colors.plumSoft }}>Boka även hos {provider.name}</p>
            <div className="flex gap-4 overflow-x-auto pb-1">
              {siblings.map((sib) => {
                const sibCat = catMap[sib.category];
                const Icon = sibCat?.icon || Sparkles;
                const sibIn = cartIds.includes(sib.id);
                return (
                  <button key={sib.id} onClick={() => onViewOther && onViewOther(sib.id)} className="flex w-[68px] flex-shrink-0 flex-col items-center gap-1.5">
                    <span className="relative flex h-16 w-16 items-center justify-center rounded-full" style={{ border: `1px solid ${colors.beige}`, backgroundColor: colors.white }}>
                      <Icon size={24} color={colors.coral} />
                      {sibIn && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: colors.green }}>
                          <Check size={12} color={colors.white} strokeWidth={3} />
                        </span>
                      )}
                    </span>
                    <span className="truncate text-xs" style={{ color: colors.plum, maxWidth: 68 }}>{sibCat?.label || "Tjänst"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div role="tablist" className="mt-5 grid grid-cols-3" style={{ borderBottom: `1px solid ${colors.beige}` }}>
        {tabBtn("posts", "Bilder", Camera)}
        {tabBtn("reviews", `Omdömen${provider.reviews ? ` (${provider.reviews})` : ""}`, Star)}
        {tabBtn("info", "Pris & info", ClipboardList)}
      </div>

      {tab === "posts" && (
        images.length > 0 ? (
          <div className="grid grid-cols-3 gap-0.5">
            {images.map((src, i) => (
              <button key={i} onClick={() => setLightbox(src)} className="block aspect-square overflow-hidden" style={{ backgroundColor: colors.coralSoft }} aria-label={`Visa bild ${i + 1}`}>
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <p className="px-5 py-10 text-center text-sm" style={{ color: colors.plumSoft }}>Inga bilder än.</p>
        )
      )}

      {tab === "reviews" && (
        <div className="flex flex-col gap-3 px-5 pt-5 sm:px-8">
          {reviewsList.length > 0 ? (
            <>
              <div className="flex items-center gap-5 p-4" style={{ backgroundColor: colors.white, border: `1px solid ${colors.beige}`, borderRadius: 20 }}>
                <div className="flex min-w-[88px] flex-col items-center gap-1">
                  <span style={{ fontFamily: serif, fontWeight: 700, fontSize: 42, lineHeight: 1, color: colors.plum }}>{provider.rating}</span>
                  <span className="flex gap-0.5" aria-label={`${provider.rating} av 5 stjärnor`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={13} fill={n <= Math.round(Number(provider.rating)) ? colors.coral : colors.beige} color={n <= Math.round(Number(provider.rating)) ? colors.coral : colors.beige} />
                    ))}
                  </span>
                  <span className="text-xs" style={{ color: colors.plumSoft }}>{provider.reviews} omdömen</span>
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  {dist.map((d) => (
                    <span key={d.n} className="flex items-center gap-2 text-xs" style={{ color: colors.plumSoft }}>
                      <span className="w-2">{d.n}</span>
                      <span className="flex h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: colors.lilacSoft }}>
                        <span className="rounded-full" style={{ width: `${(d.count / maxCount) * 100}%`, backgroundColor: colors.coral }} />
                      </span>
                    </span>
                  ))}
                </div>
              </div>
              {reviewsList.map((r, i) => (
                <article key={i} className="flex flex-col gap-2 p-4" style={{ backgroundColor: colors.white, border: `1px solid ${colors.beige}`, borderRadius: 20 }}>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: colors.lilacSoft, color: colors.coral }}>
                      {(r.name || "?").charAt(0).toUpperCase()}
                    </span>
                    <span className="flex-1 text-sm font-semibold" style={{ color: colors.plum }}>{r.name}</span>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: colors.coralSoft, color: colors.plum }}>Verifierad bokning</span>
                  </div>
                  <span className="flex gap-0.5" aria-label={`${r.stars} av 5 stjärnor`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={14} fill={n <= Number(r.stars) ? colors.coral : colors.beige} color={n <= Number(r.stars) ? colors.coral : colors.beige} />
                    ))}
                  </span>
                  {r.text && <p className="text-sm leading-relaxed" style={{ color: colors.plum }}>{r.text}</p>}
                </article>
              ))}
            </>
          ) : (
            <p className="py-8 text-center text-sm" style={{ color: colors.plumSoft }}>
              Inga omdömen än – en av de första att boka får gärna dela sina intryck efteråt.
            </p>
          )}
        </div>
      )}

      {tab === "info" && (
        <div className="flex flex-col gap-6 px-5 pt-5 sm:px-8">
          {provider.packagesOn && (
            <section ref={packagesRef} className="flex flex-col gap-3" style={{ scrollMarginTop: 80 }}>
              <div>
                <h2 className="text-[15px] font-bold" style={{ color: colors.plum }}>Paket & priser</h2>
                <p className="mt-0.5 text-xs" style={{ color: colors.plumSoft }}>
                  Välj ett eller flera paket. Priset räknas på din tid och ditt antal gäster.
                </p>
              </div>
              {provider.packages.map((pkg) => {
                const entry = cartPackages.find((ci) => ci.pkg.serviceId === pkg.id);
                return (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    party={party}
                    entry={entry}
                    blockedReason={closedNow ? `Stängd ${dateLabel}` : busyNow ? "Upptagen den tiden" : ""}
                    onChoose={() => setOpenPackageId(pkg.id)}
                    onContact={() => onOpenChat(provider)}
                  />
                );
              })}
              {cartPackages.length > 0 && onOpenCart && (
                <button onClick={onOpenCart} className={`${btnBase} w-full`} style={{ backgroundColor: colors.plum, color: colors.white }}>
                  Gå vidare till bokningen <ArrowRight size={16} />
                </button>
              )}
              <div className="flex items-center justify-between gap-3 p-4" style={{ backgroundColor: colors.lilacSoft, borderRadius: 20 }}>
                <p className="text-sm" style={{ color: colors.plum }}>
                  <span className="font-semibold">Vill du ha något annat?</span> Skicka en förfrågan så får du en offert.
                </p>
                <button onClick={askForQuote} className="flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold" style={{ backgroundColor: colors.white, color: colors.plum }}>
                  Förfrågan
                </button>
              </div>
            </section>
          )}

          {provider.service && (
            <section>
              <h2 className="mb-1.5 text-[15px] font-bold" style={{ color: colors.plum }}>{provider.packagesOn ? "Om offert" : "Tjänst"}</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: colors.plumSoft }}>{provider.service}</p>
            </section>
          )}

          {!provider.requestOnly && !provider.packagesOn && (
            <section className="p-4" style={{ backgroundColor: colors.white, border: `1px solid ${colors.beige}`, borderRadius: 20 }}>
              <p style={{ fontFamily: serif, fontWeight: 700, fontSize: 21, color: colors.plum }}>{priceLabel}</p>
              <p className="mt-0.5 text-xs" style={{ color: colors.plumSoft }}>{getBreakdownText(provider, party)}</p>
              {provider.addons.length > 0 && (
                <div className="mt-4 space-y-2 border-t pt-4" style={{ borderColor: colors.beige }}>
                  <p className="text-xs font-semibold" style={{ color: colors.plum }}>Tillägg (valfritt)</p>
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
                <span className="text-sm font-semibold" style={{ color: colors.plum }}>Riktpris</span>
                <span style={{ fontFamily: serif, fontWeight: 700, fontSize: 20, color: colors.plum }}>{formatKr(estimate)}</span>
              </div>
              <p className="mt-2 text-xs" style={{ color: colors.plumSoft }}>Slutpriset får du i leverantörens offert. När du har godkänt den kan du boka.</p>
            </section>
          )}

          {provider.requestOnly && (
            <section className="p-4" style={{ backgroundColor: colors.white, border: `1px solid ${colors.beige}`, borderRadius: 20 }}>
              <p style={{ fontFamily: serif, fontWeight: 700, fontSize: 21, color: colors.plum }}>{priceLabel}</p>
              <p className="mt-1 text-sm" style={{ color: colors.plumSoft }}>
                Berätta vad du behöver, så svarar leverantören i chatten och skickar en offert med slutpris.
              </p>
            </section>
          )}

          {party.date ? (
            <section className="space-y-2 p-4" style={{ backgroundColor: colors.white, border: `1px solid ${colors.beige}`, borderRadius: 20 }}>
              <h2 className="text-[15px] font-bold" style={{ color: colors.plum }}>Din tid</h2>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-0.5 text-xs" style={{ color: colors.plumSoft }}>
                  Start
                  <input type="time" value={party.startTime} onChange={(e) => onUpdateParty({ startTime: e.target.value })} className="rounded-xl px-2 py-2 text-sm" style={{ border: `1px solid ${colors.beige}`, color: colors.plum }} />
                </label>
                <label className="flex flex-col gap-0.5 text-xs" style={{ color: colors.plumSoft }}>
                  Slut
                  <input type="time" value={party.endTime} onChange={(e) => onUpdateParty({ endTime: e.target.value })} className="rounded-xl px-2 py-2 text-sm" style={{ border: `1px solid ${colors.beige}`, color: colors.plum }} />
                </label>
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
                    className="rounded-xl px-2 py-2 text-sm"
                    style={{ border: `1px solid ${colors.beige}`, color: colors.plum }}
                  />
                </label>
              </div>
              {daySlots.length > 0 && (
                <p className="text-xs" style={{ color: colors.plumSoft }}>
                  Redan bokad den dagen: {daySlots.map((sl) => `${hhmm(sl.start)}–${hhmm(sl.end)}`).join(", ")}.{busyNow ? " Välj en annan tid eller ett annat datum." : ""}
                </p>
              )}
              <button onClick={() => onUpdateParty({ date: "" })} className="text-xs font-semibold underline" style={{ color: colors.coral }}>
                Byt datum
              </button>
            </section>
          ) : (
            <section>
              <h2 className="mb-1 text-[15px] font-bold" style={{ color: colors.plum }}>Tillgänglighet</h2>
              <p className="mb-2 text-xs" style={{ color: colors.plumSoft }}>Tryck på en ledig dag för att välja den.</p>
              <MonthCalendar
                year={calYear}
                month={calMonthIdx}
                onPrevMonth={prevMonth}
                onNextMonth={nextMonth}
                getDayStatus={getDayStatus}
                onDayClick={(ds, status) => status === "open" && onSelectDate(ds)}
                interactive
                highlightDate={null}
              />
              <CalendarLegend />
            </section>
          )}
        </div>
      )}

      {lightbox && (
        <div role="dialog" aria-label="Bild" onClick={() => setLightbox(null)} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(30,8,22,0.85)" }}>
          <button aria-label="Stäng" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.15)", color: colors.white }}>
            <X size={22} />
          </button>
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
        </div>
      )}

      {openPackageId && provider.packages?.some((x) => x.id === openPackageId) && (() => {
        const pkg = provider.packages.find((x) => x.id === openPackageId);
        const entry = cartPackages.find((ci) => ci.pkg.serviceId === pkg.id);
        return (
          <PackageSheet
            provider={provider}
            pkg={pkg}
            party={party}
            entry={entry}
            onUpdateParty={onUpdateParty}
            onAdd={(cfg) => onAddPackage(provider, pkg, cfg)}
            onRemove={() => entry && onRemove(entry.id)}
            onClose={() => setOpenPackageId(null)}
          />
        );
      })()}

      {requestOpen && (
        <RequestFormModal provider={provider} party={party} onUpdateParty={onUpdateParty} onSend={(brief) => onSendRequest(provider, brief)} onClose={() => setRequestOpen(false)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Package cards on a vendor's page. Each white card is one ready-priced
// package; the customer opens it, makes the choices it asks for and adds it.
// ---------------------------------------------------------------------------
function PackageCard({ pkg, party, entry, blockedReason, onChoose, onContact }) {
  const misfit = blockedReason || packageMisfit(pkg, party, entry?.pkg?.quantity || Math.max(1, Number(pkg.minGuests) || 1));
  const greyed = !!misfit && pkg.priceType !== "per_unit";
  const added = !!entry;
  const estimate = entry
    ? packageTotal(pkg, party, { quantity: entry.pkg.quantity, choices: entry.pkg.choices, addonIds: entry.addons }, pkg.addons)
    : packageTotal(pkg, party, { quantity: Math.max(1, Number(pkg.minGuests) || 1) });
  const facts = packageFacts(pkg);
  const includes = (pkg.includes || []).filter((x) => String(x).trim());
  const groups = pkg.choiceGroups || [];
  const estimateNote =
    pkg.priceType === "per_person"
      ? `för ${Math.max(1, Number(party.guests) || 1)} gäster`
      : pkg.priceType === "per_hour"
      ? `för ${String(packageMultiplier(pkg, party)).replace(".", ",")} timmar`
      : pkg.priceType === "per_unit"
      ? `för ${entry?.pkg?.quantity || Math.max(1, Number(pkg.minGuests) || 1)} ${unitWord(pkg)}`
      : "";

  return (
    <article
      className="flex flex-col p-5"
      style={{ backgroundColor: colors.white, border: `1.5px solid ${added ? colors.coral : colors.beige}`, borderRadius: 20 }}
    >
      <div style={{ opacity: greyed ? 0.5 : 1 }}>
        <div className="flex items-start justify-between gap-3">
          <h3 style={{ fontFamily: serif, fontWeight: 700, fontSize: 19, color: colors.plum, lineHeight: 1.2 }}>{pkg.name || "Paket"}</h3>
          <span className="flex-shrink-0 text-right" style={{ fontFamily: serif, fontWeight: 700, fontSize: 18, color: colors.plum }}>
            {packagePriceLabel(pkg)}
          </span>
        </div>
        {pkg.description && <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed" style={{ color: colors.plumSoft }}>{pkg.description}</p>}
        {(includes.length > 0 || groups.length > 0) && (
          <ul className="mt-3 space-y-1.5">
            {includes.map((x, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: colors.plum }}>
                <Check size={15} color={colors.coral} className="mt-0.5 flex-shrink-0" /> {x}
              </li>
            ))}
            {groups.map((g) => (
              <li key={g.id} className="flex items-start gap-2 text-sm" style={{ color: colors.plum }}>
                <Check size={15} color={colors.coral} className="mt-0.5 flex-shrink-0" />
                <span>
                  {g.min === g.max ? g.min : `${g.min}–${g.max}`} {String(g.label).toLowerCase()} som du väljer
                  <span style={{ color: colors.plumSoft }}> ({g.options.map((o) => o.label).join(", ")})</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {facts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {facts.map((f) => (
              <span key={f} className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: colors.lilacSoft, color: colors.plum }}>
                {f}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4" style={{ borderColor: colors.beige }}>
        {greyed ? (
          <>
            <span className="text-sm font-semibold" style={{ color: colors.coralDeep }}>
              {misfit}
            </span>
            <button onClick={onContact} className="flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold" style={{ backgroundColor: colors.lilacSoft, color: colors.plum }}>
              Fråga leverantören
            </button>
          </>
        ) : (
          <>
            <span className="text-sm" style={{ color: colors.plumSoft }}>
              <span className="font-semibold" style={{ color: colors.plum }}>{formatKr(estimate)}</span> {estimateNote}
            </span>
            <button
              onClick={onChoose}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold"
              style={{ backgroundColor: added ? colors.greenSoft : colors.coral, color: added ? colors.green : colors.white }}
            >
              {added ? (
                <>
                  <Check size={15} /> Tillagd · ändra
                </>
              ) : (
                "Välj"
              )}
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function PackageSheet({ provider, pkg, party, entry, onUpdateParty, onAdd, onRemove, onClose }) {
  const [quantity, setQuantity] = useState(entry?.pkg?.quantity || Math.max(1, Number(pkg.minGuests) || 1));
  const [choices, setChoices] = useState(entry?.pkg?.choices || {});
  const [addonIds, setAddonIds] = useState(entry?.addons || []);
  const addons = pkg.addons || [];
  const total = packageTotal(pkg, party, { quantity, choices, addonIds }, addons);
  const misfit = packageMisfit(pkg, party, quantity);
  const choiceProblem = packageChoiceProblem(pkg, choices);
  const problem = misfit || choiceProblem;
  const optSuffix = pkg.priceType === "per_person" ? "/person" : pkg.priceType === "per_hour" ? "/timme" : pkg.priceType === "per_unit" ? `/${unitWord(pkg)}` : "";
  const maxQ = Number(pkg.maxGuests) || 10000;

  const pick = (g, optId) =>
    setChoices((c) => {
      const cur = c[g.id] || [];
      if (g.max === 1) return { ...c, [g.id]: cur.includes(optId) ? [] : [optId] };
      if (cur.includes(optId)) return { ...c, [g.id]: cur.filter((x) => x !== optId) };
      if (cur.length >= g.max) return c; // full; the customer removes one first
      return { ...c, [g.id]: [...cur, optId] };
    });
  const toggleAddon = (id) => setAddonIds((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const fieldStyle = { border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ backgroundColor: "rgba(74,21,56,0.45)" }} onClick={onClose}>
      <div role="dialog" aria-label={pkg.name} className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl" style={{ backgroundColor: colors.cream }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-6 pb-3 pt-5" style={{ borderBottom: `1.5px solid ${colors.lilacSoft}` }}>
          <div>
            <p className="text-xs font-semibold uppercase" style={{ letterSpacing: "0.08em", color: colors.plumSoft }}>{provider.name}</p>
            <p style={{ fontFamily: serif, fontWeight: 700, fontSize: 21, color: colors.plum }}>{pkg.name || "Paket"}</p>
            <p className="text-sm" style={{ color: colors.plumSoft }}>{packagePriceLabel(pkg)}</p>
          </div>
          <button onClick={onClose} className="-mr-2 p-2" aria-label="Stäng">
            <X size={18} color={colors.plumSoft} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-4">
          {pkg.priceType === "per_unit" ? (
            <section>
              <p className="mb-2 text-sm font-semibold" style={{ color: colors.plum }}>Antal ({unitWord(pkg)})</p>
              <div className="flex items-center gap-3">
                <button aria-label="Färre" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-semibold" style={fieldStyle}>−</button>
                <input
                  type="number"
                  min={1}
                  max={maxQ}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.min(maxQ, Math.max(1, Math.round(Number(e.target.value) || 1))))}
                  className="w-20 rounded-xl px-3 py-2 text-center text-sm"
                  style={fieldStyle}
                  aria-label="Antal"
                />
                <button aria-label="Fler" onClick={() => setQuantity((q) => Math.min(maxQ, q + 1))} className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-semibold" style={fieldStyle}>+</button>
              </div>
            </section>
          ) : (
            <section className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-0.5 text-xs" style={{ color: colors.plumSoft }}>
                Start
                <input type="time" value={party.startTime} onChange={(e) => onUpdateParty({ startTime: e.target.value })} className="rounded-xl px-2 py-2 text-sm" style={fieldStyle} />
              </label>
              <label className="flex flex-col gap-0.5 text-xs" style={{ color: colors.plumSoft }}>
                Slut
                <input type="time" value={party.endTime} onChange={(e) => onUpdateParty({ endTime: e.target.value })} className="rounded-xl px-2 py-2 text-sm" style={fieldStyle} />
              </label>
              <label className="flex flex-col gap-0.5 text-xs" style={{ color: colors.plumSoft }}>
                Gäster
                <input
                  type="number"
                  min={1}
                  value={party.guests}
                  onChange={(e) => onUpdateParty({ guests: e.target.value === "" ? "" : Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                  className="rounded-xl px-2 py-2 text-sm"
                  style={fieldStyle}
                />
              </label>
            </section>
          )}

          {(pkg.choiceGroups || []).map((g) => {
            const picked = choices[g.id] || [];
            const need = g.min === g.max ? `Välj ${g.min}` : `Välj ${g.min}–${g.max}`;
            const done = picked.length >= g.min && picked.length <= g.max;
            return (
              <section key={g.id}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold" style={{ color: colors.plum }}>{g.label}</p>
                  <span className="text-xs font-semibold" style={{ color: done ? colors.green : colors.coralDeep }}>
                    {need} · {picked.length} valda
                  </span>
                </div>
                <div className="space-y-1.5">
                  {g.options.map((o) => {
                    const on = picked.includes(o.id);
                    const full = !on && g.max > 1 && picked.length >= g.max;
                    return (
                      <button
                        key={o.id}
                        onClick={() => pick(g, o.id)}
                        disabled={full}
                        aria-pressed={on}
                        className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm"
                        style={{ border: `1.5px solid ${on ? colors.coral : colors.beige}`, backgroundColor: on ? colors.coralSoft : colors.white, color: colors.plum, opacity: full ? 0.45 : 1 }}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center ${g.max === 1 ? "rounded-full" : "rounded-md"}`}
                            style={{ border: `1.5px solid ${on ? colors.coral : colors.lilac}`, backgroundColor: on ? colors.coral : colors.white }}
                          >
                            {on && <Check size={12} color={colors.white} strokeWidth={3} />}
                          </span>
                          {o.label}
                        </span>
                        {Number(o.price) > 0 && <span style={{ color: colors.plumSoft }}>+{formatKr(Number(o.price))}{optSuffix}</span>}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {addons.length > 0 && (
            <section>
              <p className="mb-2 text-sm font-semibold" style={{ color: colors.plum }}>Tillägg (valfritt)</p>
              <div className="space-y-1.5">
                {addons.map((a) => {
                  const on = addonIds.includes(a.id);
                  return (
                    <label key={a.id} className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm" style={{ border: `1.5px solid ${on ? colors.coral : colors.beige}`, backgroundColor: on ? colors.coralSoft : colors.white, color: colors.plum }}>
                      <span className="flex items-center gap-2">
                        <input type="checkbox" checked={on} onChange={() => toggleAddon(a.id)} />
                        {a.name}
                      </span>
                      <span style={{ color: colors.plumSoft }}>{addonPriceLabel(a)}</span>
                    </label>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className="px-6 py-4" style={{ borderTop: `1.5px solid ${colors.lilacSoft}` }}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-sm" style={{ color: colors.plumSoft }}>
              {packageBreakdown({ ...pkg, name: "" }, party, quantity)}
              {total > packageTotal(pkg, party, { quantity }) ? " + val och tillägg" : ""}
            </span>
            <span style={{ fontFamily: serif, fontWeight: 700, fontSize: 22, color: colors.plum }}>{formatKr(total)}</span>
          </div>
          {problem && (
            <p className="mb-2 text-sm font-semibold" style={{ color: colors.coralDeep }}>
              {problem}
            </p>
          )}
          <button
            onClick={() => {
              onAdd({ quantity, choices, addonIds });
              onClose();
            }}
            disabled={!!problem}
            className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold"
            style={{ backgroundColor: colors.coral, color: colors.white, opacity: problem ? 0.45 : 1 }}
          >
            {entry ? "Spara ändringarna" : "Lägg till"} · {formatKr(total)}
          </button>
          {entry && (
            <button
              onClick={() => {
                onRemove();
                onClose();
              }}
              className="mt-2 w-full py-1.5 text-sm font-medium underline"
              style={{ color: colors.plumSoft }}
            >
              Ta bort paketet
            </button>
          )}
          <p className="mt-2 text-center text-xs" style={{ color: colors.plumSoft }}>
            Leverantören bekräftar bokningen innan något är klart.
          </p>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({ open, onClose, cart, party, onSwap, onRemove, onToggleAddon, onGoCheckout, onAddForCategory, onKeepBrowsing }) {
  const total = cart.reduce((sum, p) => sum + getLineTotal(p, p.chosenAddons, party), 0);
  // Everything in the cart always shows, even if its category wasn't picked for the party
  const boardWanted = new Set([...party.categories, ...cart.map((p) => p.category)]);
  const boardCategoryIds = CATEGORIES.filter((c) => boardWanted.has(c.id)).map((c) => c.id);
  const isEmpty = boardCategoryIds.length === 0;
  const occasionInfo = party.occasion ? occasionMap[party.occasion] : null;

  return (
    <>
      {open && <div className="fixed inset-0 z-40" style={{ backgroundColor: "rgba(74,21,56,0.35)" }} onClick={onClose} />}
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
            <h2 style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>Att boka</h2>
          </div>
          <button onClick={onClose} className="-m-2 p-2">
            <X size={20} color={colors.plumSoft} />
          </button>
        </div>

        <div className="px-6 pb-4 pt-4" style={{ borderBottom: `1.5px solid ${colors.lilacSoft}` }}>
          <p style={{ fontFamily: serif, fontSize: 18, color: colors.plum }}>
            {occasionInfo ? `${occasionInfo.emoji} ${occasionInfo.boardLabel}` : "Ditt event"}
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
              Inget att boka än. Skicka en förfrågan till en leverantör, så hamnar offerten här när du har godkänt den.
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
                          {p.package && (p.package.choiceGroups || []).length > 0 && (
                            <p className="mt-0.5 text-xs" style={{ color: colors.plumSoft }}>
                              {p.package.choiceGroups
                                .map((g) => g.options.filter((o) => (p.choices?.[g.id] || []).includes(o.id)).map((o) => o.label).join(", "))
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                          {p.package && (packageMisfit(p.package, party, p.quantity) || packageChoiceProblem(p.package, p.choices)) && (
                            <p className="mt-0.5 text-xs font-semibold" style={{ color: colors.coralDeep }}>
                              {packageMisfit(p.package, party, p.quantity) || packageChoiceProblem(p.package, p.choices)}. Ändra eller ta bort paketet.
                            </p>
                          )}
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
                              {a.name} ({addonPriceLabel(a)}) <X size={11} />
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
            Hitta fler leverantörer →
          </button>
        </div>
      </div>
    </>
  );
}

function CheckoutView({ cart, party, session, onOpenCart, onConfirm, onGuestConfirm, onLogin, guestError, guestSubmitting, guestBlockReason, onOpenTerms, events = [], eventChoice, onEventChoice }) {
  const [forCompany, setForCompany] = useState(party.occasion === "corporate");
  const [company, setCompany] = useState({ name: "", org: "", address: "", reference: "" });
  const orgOk = /^[0-9]{6}-?[0-9]{4}$/.test(company.org.trim());
  const companyOk = !forCompany || (company.name.trim() && orgOk && company.address.trim());
  const companyPayload = forCompany
    ? { company_name: company.name.trim(), org_number: company.org.trim(), invoice_address: company.address.trim(), invoice_reference: company.reference.trim() || null }
    : null;
  const setC = (k) => (e) => setCompany((c) => ({ ...c, [k]: e.target.value }));
  const cField = { border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white };
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
      <h1 style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>Din bokning</h1>
      <div className="mt-6 rounded-2xl p-4 text-sm leading-relaxed" style={{ backgroundColor: colors.cream, color: colors.plumSoft }}>
        <p className="mb-1 font-semibold" style={{ color: colors.plum }}>
          Bokningsvillkor & avbokningsregler
        </p>
        Att boka skickar en förfrågan till respektive leverantör, som bekräftar eller avböjer inom 24
        timmar.{" "}
        {PAYMENTS_LIVE
          ? "När leverantören bekräftat betalar du en deposition på 15 %, och resten senast 14 dagar före eventet (bokar du senare betalar du allt direkt). "
          : "Betalning via Planifest är inte aktiverat än, så ingen betalning sker nu. "}
        Avbokar du själv mer än 14 dagar före eventet får du tillbaka allt. Därefter minskar
        återbetalningen: 14–7 dagar före behålls depositionen, 6–1 dagar före 50 % och samma dag 100 %.
        Avbokar leverantören får du alltid tillbaka allt du betalat. Reglerna är lika för alla
        leverantörer. Fullständiga villkor finns i Planifests allmänna villkor.
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
                Dina uppgifter delas med en leverantör först när hen har bekräftat din bokning. Med ett konto kan du också chatta med leverantörer, spara favoriter och planera dina event.{" "}
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

      {!isGuest && (
        <div className="mt-4 rounded-2xl p-4" style={{ backgroundColor: colors.white, border: `1px solid ${colors.beige}` }}>
          <label className="flex items-center gap-3 text-sm font-semibold" style={{ color: colors.plum }}>
            <input type="checkbox" checked={forCompany} onChange={(e) => setForCompany(e.target.checked)} />
            Jag bokar för ett företag
          </label>
          {forCompany && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
                Företagsnamn
                <input value={company.name} onChange={setC("name")} maxLength={120} autoComplete="organization" className="rounded-xl px-3 py-2 text-sm font-normal" style={cField} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
                Organisationsnummer
                <input value={company.org} onChange={setC("org")} maxLength={11} inputMode="numeric" placeholder="556677-8899" className="rounded-xl px-3 py-2 text-sm font-normal" style={cField} />
                {company.org.trim() && !orgOk && <span className="font-normal" style={{ color: colors.coralDeep }}>Skriv 10 siffror, t.ex. 556677-8899</span>}
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2" style={{ color: colors.plum }}>
                Fakturaadress
                <input value={company.address} onChange={setC("address")} maxLength={300} placeholder="Gata, postnummer och ort – eller e-post för faktura" className="rounded-xl px-3 py-2 text-sm font-normal" style={cField} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2" style={{ color: colors.plum }}>
                Er referens (valfritt)
                <input value={company.reference} onChange={setC("reference")} maxLength={120} placeholder="Namn eller referenskod" className="rounded-xl px-3 py-2 text-sm font-normal" style={cField} />
              </label>
            </div>
          )}
        </div>
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
          disabled={!accepted || cart.length === 0 || !companyOk}
          onClick={() => onConfirm(companyPayload)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3 text-base font-semibold"
          style={{ backgroundColor: colors.coral, color: colors.white, opacity: accepted && cart.length > 0 && companyOk ? 1 : 0.45 }}
        >
          Boka &amp; betala
        </button>
      )}
      <p className="mt-2 text-center text-xs" style={{ color: colors.plumSoft }}>
        {PAYMENTS_LIVE
          ? "Leverantörerna bekräftar bokningen inom 24 timmar. Du betalar först när de har bekräftat."
          : "Leverantörerna bekräftar bokningen inom 24 timmar. Ingen betalning sker än."}
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
        <div className="mb-5 rounded-2xl p-4 text-center" style={{ backgroundColor: colors.greenSoft }}>
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
                Vill du avboka hela bokningen? Mer än 14 dagar före eventet får du tillbaka allt. Därefter gäller Planifests avbokningsregler i de allmänna villkoren, och depositionen behålls.
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
          Vill du chatta, spara favoriter och planera dina event?
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
                <span style={{ color: colors.plum }}>
                  {item.name}
                  {item.packageName ? <span style={{ color: colors.plumSoft }}> · {item.packageName}</span> : null}
                </span>
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
        Boka till ett nytt event
      </button>
    </div>
  );
}

function MinaBokningarView({ bookings, onCancelBooking, onReviewItem, onChatItem, events = [] }) {
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
                    {events.find((e) => e.id === b.eventId)?.title || (occasionInfo ? `${occasionInfo.emoji} ${occasionInfo.boardLabel}` : "Ditt event")}
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
                        {item.packageName ? <span style={{ color: colors.plumSoft }}> · {item.packageName}</span> : null}
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
      style={{ backgroundColor: "rgba(74,21,56,0.45)" }}
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

// Every quote looks the same, whoever sent it: price, what is included, and the payment and cancellation terms,
// so two quotes can be compared at a glance. The terms are Planifest's shared rules (see the terms, sections 4–5).
const QUOTE_DEPOSIT_PCT = 15;
const QUOTE_BALANCE_DAYS = 14;
const QUOTE_FREE_CANCEL_DAYS = 14;
function QuoteCard({ amount, description, vendorName, mine = false, children }) {
  const deposit = Math.round((Number(amount) || 0) * (QUOTE_DEPOSIT_PCT / 100));
  const rows = [
    ["Det här ingår", description?.trim() || "Leverantören har inte skrivit vad som ingår. Fråga i chatten innan du godkänner."],
    ["Deposition", `${QUOTE_DEPOSIT_PCT} % (${formatKr(deposit)}) när ${vendorName || "leverantören"} har bekräftat bokningen`],
    ["Resten", `Senast ${QUOTE_BALANCE_DAYS} dagar före eventet`],
    ["Avbokning", `Gratis mer än ${QUOTE_FREE_CANCEL_DAYS} dagar före. Därefter enligt Planifests avbokningsregler.`],
  ];
  return (
    <div className="w-full max-w-[92%] overflow-hidden text-sm" style={{ backgroundColor: colors.white, border: `2px solid ${mine ? colors.lilac : colors.korall}`, borderRadius: 22, boxShadow: "0 8px 24px rgba(74,21,56,0.08)" }}>
      <div className="px-4 pb-3 pt-3.5" style={{ backgroundColor: mine ? colors.lilacSoft : colors.peachSoft }}>
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase" style={{ color: colors.lilacDeep, letterSpacing: "0.06em" }}>
          <Sparkles size={13} /> {mine ? "Din offert" : `Offert${vendorName ? ` från ${vendorName}` : ""}`}
        </p>
        <p className="mt-1" style={{ fontFamily: serif, fontWeight: 700, fontSize: 28, lineHeight: 1.1, color: colors.plum }}>
          {formatKr(Number(amount) || 0)}
        </p>
      </div>
      <dl className="px-4 py-3">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[92px_1fr] gap-2 py-1.5" style={{ borderTop: k === rows[0][0] ? "none" : `1px solid ${colors.beige}` }}>
            <dt className="text-xs font-semibold" style={{ color: colors.plumSoft }}>{k}</dt>
            <dd className="whitespace-pre-line text-[13px] leading-snug" style={{ color: colors.plum }}>{v}</dd>
          </div>
        ))}
        {!PAYMENTS_LIVE && (
          <p className="mt-1 text-[11px]" style={{ color: colors.plumSoft }}>
            Betalning via Planifest öppnar snart. Tills dess betalas ingenting här.
          </p>
        )}
      </dl>
      {children && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
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
      style={{ backgroundColor: "rgba(74,21,56,0.45)" }}
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
                <QuoteCard amount={m.quote_amount} description={m.quote_description} vendorName={vendorName}>
                  {m.quote_status === "pending" ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => onDeclineQuote(m)}
                        className="flex-1 rounded-full px-3 py-2 text-xs font-medium"
                        style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }}
                      >
                        Tacka nej
                      </button>
                      <button
                        onClick={() => onAcceptQuote(m)}
                        className="flex-1 rounded-full px-3 py-2 text-xs font-bold"
                        style={{ backgroundColor: colors.coral, color: colors.cream, boxShadow: `0 3px 0 ${colors.coralDeep}` }}
                      >
                        Godkänn offerten
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: m.quote_status === "accepted" ? colors.greenSoft : colors.beige,
                          color: m.quote_status === "accepted" ? colors.green : colors.plumSoft,
                        }}
                      >
                        {m.quote_status === "accepted" ? <Check size={12} /> : <X size={12} />}
                        {m.quote_status === "accepted" ? "Godkänd – redo att boka" : "Du tackade nej"}
                      </span>
                      {m.quote_status === "accepted" && onOpenCart && (
                        <button onClick={onOpenCart} className="text-xs font-semibold underline" style={{ color: colors.lilacDeep }}>
                          Gå till bokning
                        </button>
                      )}
                    </div>
                  )}
                </QuoteCard>
              </div>
            ) : (
              <div key={m.id} className="flex" style={{ justifyContent: m.sender === "customer" ? "flex-end" : "flex-start" }}>
                <div
                  className="max-w-[75%] px-4 py-2.5 text-sm"
                  style={{
                    backgroundColor: m.sender === "customer" ? colors.coral : colors.white,
                    color: m.sender === "customer" ? colors.cream : colors.plum,
                    border: m.sender === "customer" ? "none" : `1px solid ${colors.beige}`,
                    borderRadius: m.sender === "customer" ? "22px 22px 6px 22px" : "22px 22px 22px 6px",
                    lineHeight: 1.45,
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
        {target.real ? (
          <div className="pb-4" />
        ) : (
          <p className="px-5 pb-4 pt-2 text-center text-xs" style={{ color: colors.plumSoft }}>
            Exempelleverantör – svaren här är simulerade och sparas inte.
          </p>
        )}
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
// Cloudflare Turnstile ("I am not a robot" check). Paste the public site key between the quotes to switch it on;
// while it is empty no check is shown and nothing changes. The secret key goes in Supabase (Authentication -> Attack Protection).
const TURNSTILE_SITE_KEY = "0x4AAAAAAFUpIRdMJCuFMWoq";
const captchaBody = (token) => (token ? { gotrue_meta_security: { captcha_token: token } } : {});

function TurnstileBox({ onToken, resetKey = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return undefined;
    let cancelled = false;
    let widgetId = null;
    const mount = () => {
      if (cancelled || !ref.current || !window.turnstile) return;
      widgetId = window.turnstile.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        language: "sv",
        theme: "light",
        callback: (t) => onToken(t),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };
    let script = document.getElementById("cf-turnstile-script");
    if (window.turnstile) mount();
    else {
      if (!script) {
        script = document.createElement("script");
        script.id = "cf-turnstile-script";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", mount);
    }
    return () => {
      cancelled = true;
      if (script) script.removeEventListener("load", mount);
      if (widgetId !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch (e) {
          // already gone
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);
  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} className="mt-3 flex min-h-[65px] justify-center" />;
}

// Supabase's own messages are in English; the visitor should get something she can act on.
function friendlyAuthError(message) {
  const m = String(message || "").toLowerCase();
  if (m.includes("invalid login")) return "Fel e-post eller lösenord. Kontrollera och försök igen, eller välj \"Glömt lösenord?\".";
  if (m.includes("not confirmed")) return "Din e-post är inte bekräftad än. Klicka på länken i mejlet vi skickade, och logga sedan in.";
  if (m.includes("captcha")) return "Spamskyddet kunde inte bekräfta dig. Vänta tills rutan ovan visar en bock och försök igen.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("over_request")) return "För många försök. Vänta några minuter och försök igen.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Det finns redan ett konto med den e-postadressen. Logga in istället.";
  return message || "Något gick fel, försök igen.";
}

function AuthModal({ open, mode, onModeChange, onClose, onSignIn, onSignUp, onForgotPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signedUp, setSignedUp] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot: a real person never sees or fills this
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const [captchaSlow, setCaptchaSlow] = useState(false);

  // If the spam check hasn't finished after a while (slow phone, blocked script), say so instead of leaving her guessing.
  useEffect(() => {
    setCaptchaSlow(false);
    if (!open || captchaToken || !TURNSTILE_SITE_KEY) return undefined;
    const id = setTimeout(() => setCaptchaSlow(true), 10000);
    return () => clearTimeout(id);
  }, [open, captchaToken, captchaKey]);

  useEffect(() => {
    // a new form needs a new check: tokens are single-use and belong to the widget that issued them
    setCaptchaToken("");
    setCaptchaKey((k) => k + 1);
  }, [mode, open]);

  if (!open) return null;

  const needCaptcha = () => {
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError("Bekräfta att du inte är en robot.");
      return true;
    }
    return false;
  };
  const freshCaptcha = () => {
    setCaptchaToken("");
    setCaptchaKey((k) => k + 1);
  };

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
      if (needCaptcha()) return;
      setLoading(true);
      await onForgotPassword(email.trim(), captchaToken);
      setLoading(false);
      freshCaptcha();
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
      if (password.length < 8) {
        setError("Lösenordet måste vara minst 8 tecken.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Lösenorden matchar inte.");
        return;
      }
      if (website) {
        setSignedUp(true); // looks like a bot: pretend it worked, create nothing
        return;
      }
    }
    if (needCaptcha()) return;
    setLoading(true);
    const err =
      mode === "signin"
        ? await onSignIn(email.trim(), password, captchaToken)
        : await onSignUp(email.trim(), password, fullName.trim(), captchaToken);
    setLoading(false);
    freshCaptcha();
    if (err) {
      setError(friendlyAuthError(err.message));
      return;
    }
    if (mode === "signup") setSignedUp(true);
    else closeAndReset();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ backgroundColor: "rgba(74,21,56,0.45)" }}
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
            <p className="mt-3 text-xs" style={{ color: colors.plumSoft }}>
              Hittar du inget mejl inom en minut? Titta i skräpposten och markera det som "Inte skräppost".
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
            <p className="mt-3 text-xs" style={{ color: colors.plumSoft }}>
              Hittar du inget mejl inom en minut? Titta i skräpposten och markera det som "Inte skräppost".
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
            <TurnstileBox onToken={setCaptchaToken} resetKey={captchaKey} />
            {error && (
              <p role="alert" className="mt-3 rounded-xl px-3 py-2 text-sm font-medium" style={{ color: colors.coralDeep, backgroundColor: colors.pinkSoft }}>
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
              {mode === "signup" && (
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, width: 0 }}
                />
              )}
            </div>
            <TurnstileBox onToken={setCaptchaToken} resetKey={captchaKey} />
            {TURNSTILE_SITE_KEY && !captchaToken && (
              <p className="mt-1 text-center text-xs" style={{ color: colors.plumSoft }}>
                {captchaSlow
                  ? "Spamskyddet tar lång tid. Ladda om sidan, eller prova en annan webbläsare om rutan inte dyker upp."
                  : "Vänta tills spamskyddet ovan är klart innan du trycker på knappen."}
              </p>
            )}
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
              <p role="alert" className="mt-3 rounded-xl px-3 py-2 text-sm font-medium" style={{ color: colors.coralDeep, backgroundColor: colors.pinkSoft }}>
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
      style={{ backgroundColor: "rgba(74,21,56,0.45)" }}
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

function VendorSignupView({ step, form, errors, onField, onToggleCategory, onNext, onBack, onSubmit, onShowToast, submitError, submitting, onOpenTerms, hasAccount, accountEmail, onCaptchaToken, captchaKey }) {
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
            <p className="rounded-2xl px-3 py-2 text-xs" style={{ backgroundColor: colors.lilacSoft, color: colors.plum }}>
              Erbjuder ni mer än en sak, till exempel en lokal som också har egen catering? Välj båda. Ni visas då i båda kategorierna och lägger in egna tjänster och priser för varje, så att kunder ser att ni kan ordna båda.
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
                , inklusive reglerna om avbokning.
              </span>
            </label>
            {errors.acceptedTerms && (
              <p className="text-xs" style={{ color: colors.coralDeep }}>
                {errors.acceptedTerms}
              </p>
            )}
          </div>
        )}

        {step === 3 && !hasAccount && <TurnstileBox onToken={onCaptchaToken} resetKey={captchaKey} />}

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

// Confirmation step for deleting an account: says plainly what goes and what stays, and needs the word RADERA typed.
function DeleteAccountDialog({ isVendor, onCancel, onConfirm }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = typed.trim().toUpperCase() === "RADERA";

  const submit = async () => {
    if (!ready || busy) return;
    setError("");
    setBusy(true);
    const err = await onConfirm();
    if (err) {
      setBusy(false);
      setError(err);
    }
  };

  const goes = isVendor
    ? ["Din leverantörsprofil, dina bilder, tjänster och priser", "Dina konversationer och offerter", "Omdömen om dig och omdömen du har skrivit", "Dina egna festplaner och gästlistor, om du har några", "Din inloggning och dina kontaktuppgifter"]
    : ["Dina festplaner, gästlistor och sparade leverantörer", "Dina bokningar och konversationer", "Omdömen du har skrivit", "Din inloggning och dina kontaktuppgifter"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ backgroundColor: "rgba(74,21,56,0.45)" }}
      onClick={busy ? undefined : onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
    >
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl p-6 sm:max-w-md sm:rounded-3xl"
        style={{ backgroundColor: colors.cream }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="delete-account-title" style={{ fontFamily: serif, fontSize: 24, color: colors.plum }}>
          Radera ditt konto?
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
          Det här går inte att ångra. Det här försvinner för alltid:
        </p>
        <ul className="mt-3 space-y-1.5 text-sm" style={{ color: colors.plum }}>
          {goes.map((g) => (
            <li key={g} className="flex gap-2">
              <span aria-hidden="true" style={{ color: colors.coral }}>•</span>
              <span>{g}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-2xl p-4 text-sm leading-relaxed" style={{ backgroundColor: colors.pinkSoft, color: colors.plum }}>
          <p className="font-semibold">Om du har kommande bokningar</p>
          <p className="mt-1" style={{ color: colors.plumSoft }}>
            {isVendor
              ? "Du behöver svara på eller avboka dem först, så att kunderna inte blir utan besked. Kunder behåller sin bokningshistorik, utan länk till din profil."
              : "Du behöver avboka dem först, så att leverantörerna inte blir utan besked."}
          </p>
        </div>
        <label className="mt-5 flex flex-col gap-1 text-sm">
          <span className="font-medium" style={{ color: colors.plum }}>
            Skriv RADERA för att bekräfta
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            className="rounded-xl px-3 py-2 text-sm"
            style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }}
          />
        </label>
        {error && (
          <p className="mt-3 text-sm" style={{ color: colors.coralDeep }} role="alert">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            onClick={submit}
            disabled={!ready || busy}
            className="rounded-full px-5 py-3 text-sm font-semibold"
            style={{ backgroundColor: colors.coralDeep, color: colors.white, opacity: !ready || busy ? 0.45 : 1 }}
          >
            {busy ? "Raderar..." : "Radera mitt konto"}
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-full px-5 py-3 text-sm font-semibold"
            style={{ border: `1.5px solid ${colors.coral}`, color: colors.coral, backgroundColor: "transparent" }}
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
}

function MyAccountView({ profile, email, onSaveProfile, onChangePassword, onBack, isVendor, customerMode, onSwitchMode, onDeleteAccount }) {
  const [deleting, setDeleting] = useState(false);
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
    if (newPassword.length < 8) {
      setPasswordError("Lösenordet måste vara minst 8 tecken.");
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

      <div className="mt-10 border-t pt-6" style={{ borderColor: colors.beige }}>
        <h2 className="font-semibold" style={{ color: colors.plum }}>
          Radera konto
        </h2>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
          Vill du inte längre ha ett konto hos Planifest kan du radera det och all information som hör till det.
        </p>
        <button
          onClick={() => setDeleting(true)}
          className="mt-3 rounded-full px-5 py-2.5 text-sm font-semibold"
          style={{ border: `1.5px solid ${colors.coralDeep}`, color: colors.coralDeep, backgroundColor: "transparent" }}
        >
          Radera mitt konto
        </button>
      </div>

      {deleting && <DeleteAccountDialog isVendor={isVendor} onCancel={() => setDeleting(false)} onConfirm={onDeleteAccount} />}
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
    if (password.length < 8) {
      setError("Lösenordet måste vara minst 8 tecken.");
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
      <p className="mx-auto mt-3 max-w-sm text-xs" style={{ color: colors.plumSoft }}>
        Hittar du inget mejl inom en minut? Titta i skräpposten och markera det som "Inte skräppost".
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

// Categories where a customer would see "Pris på förfrågan": no fixed price, no "from" price and no priced choices in the form.
function vendorMissingPriceCategories(vendor) {
  const services = vendor?.profile?.services || [];
  return (vendor?.categories || []).filter((cat) => {
    const own = services.filter((s) => s.category === cat);
    const list = own.length ? own : services.filter((s) => !s.category);
    if (list.some((s) => (s.priceType !== "quote" && Number(s.price) > 0) || Number(s.fromPrice) > 0)) return false;
    const form = sanitizeRequestForms(vendor?.requestForms)[cat];
    return !(form?.fields || []).some((f) => f.required && f.type === "single" && f.options.some((o) => o.price));
  });
}

function getVendorCompleteness(vendor) {
  const profile = vendor?.profile || {};
  const checks = [
    { key: "tagline", label: "Tagline", done: !!profile.tagline?.trim() },
    { key: "description", label: "Beskrivning", done: !!profile.description?.trim() },
    { key: "images", label: "Minst en bild", done: (profile.images || []).length > 0 },
    { key: "services", label: "Minst en tjänst/pris eller ett förfrågningsformulär", done: (profile.services || []).length > 0 || Object.values(sanitizeRequestForms(vendor?.requestForms)).some((c) => c.fields.length > 0) },
    { key: "categories", label: "Minst en kategori", done: (vendor?.categories || []).length > 0 },
    { key: "price", label: "Från-pris", done: vendorMissingPriceCategories(vendor).length === 0 },
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
          company: b.company || null,
        }))
    );
}

const STATUS_META = {
  pending: { emoji: "🟡", label: "Väntar på granskning", bg: colors.lilacSoft, fg: colors.lilacDeep },
  approved: { emoji: "🟢", label: "Godkänd", bg: colors.greenSoft, fg: colors.green },
  rejected: { emoji: "🔴", label: "Avslagen", bg: "#FBDCD8", fg: colors.coralDeep },
};

// Status of a single vendor item inside a customer booking (separate from
// STATUS_META above, which describes a vendor's admin-approval status).
const BOOKING_STATUS_META = {
  pending: { label: "Väntar på svar", bg: colors.lilacSoft, fg: colors.lilacDeep },
  confirmed: { label: "Bekräftad", bg: colors.greenSoft, fg: colors.green },
  declined: { label: "Nekad", bg: "#FBDCD8", fg: colors.coralDeep },
  completed: { label: "Genomförd", bg: colors.greenSoft, fg: colors.green },
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

function VendorDashboardView({ vendor, bookingItems, conversationCount, onEditProfile, onPreview, onBookings, onInbox, onRespond, storyManager = null, onChangeAvatar, avatarUploading = false, onSaveDescription }) {
  const avatarInput = useRef(null);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  if (!vendor) return null;
  const { percent, missing } = getVendorCompleteness(vendor);
  const locationName = locationMap[vendor.baseLocation]?.name || vendor.baseLocation;
  const categoryLabels = vendor.categories.map((id) => catMap[id]?.label).filter(Boolean).join(" · ") || "Inga kategorier valda ännu";
  const pendingItems = bookingItems.filter((i) => i.status === "pending");
  const upcomingAll = bookingItems
    .filter((i) => i.status === "confirmed" && i.date >= todayStr())
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  const hhmm = (t) => String(t || "").slice(0, 5);
  const fmtDate = (ds) => (ds ? new Date(`${ds}T00:00:00`).toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" }) : "");
  const avatar = (vendor.profile?.images || [])[0];
  const first = (vendor.contactPerson || "").trim().split(/\s+/)[0];
  const card = { backgroundColor: colors.white, border: `1px solid ${colors.beige}`, borderRadius: 22 };
  const banner = {
    pending: { bg: colors.lilacSoft, title: "Din ansökan granskas", text: "Vi går igenom din ansökan och mejlar dig så fort den är klar. Du kan fylla i din profil under tiden." },
    rejected: { bg: colors.coralSoft, title: "Tyvärr nekades din ansökan", text: "Vill du ändra din ansökan? Gå igenom din profil, gör dina ändringar och skicka in den igen – så tittar vi på den på nytt." },
  }[vendor.status];

  const links = [
    { title: "Profil & beskrivning", desc: "Det kunderna läser om er", icon: Sparkles, action: onEditProfile },
    { title: "Tjänster & priser", desc: "Vad ni erbjuder och vad det kostar", icon: Wallet, action: onEditProfile },
    { title: "Bilder", desc: "Bildflödet på er profil", icon: Camera, action: onEditProfile },
    { title: "Bokningar & kalender", desc: "Förfrågningar och lediga dagar", icon: Calendar, action: onBookings },
    { title: "Meddelanden", desc: "Frågor och offerter till kunder", icon: MessageCircle, action: onInbox },
    { title: "Förhandsvisa profilen", desc: "Se den som en kund", icon: Eye, action: onPreview },
  ];

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-6 sm:px-8 sm:pt-10">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <input
            ref={avatarInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              e.target.value = "";
              if (f) onChangeAvatar(f);
            }}
          />
          <button
            onClick={() => avatarInput.current?.click()}
            disabled={avatarUploading}
            aria-label="Byt profilbild"
            className="relative h-16 w-16 flex-shrink-0 rounded-full"
            style={{ backgroundColor: colors.coralSoft, border: `2px solid ${colors.white}`, boxShadow: `0 0 0 2px ${colors.lilac}`, opacity: avatarUploading ? 0.6 : 1 }}
          >
            <span className="block h-full w-full overflow-hidden rounded-full">
              {avatar ? (
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xl" style={{ fontFamily: serif, fontWeight: 700, color: colors.coral }}>
                  {(vendor.companyName || "?").charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: colors.coral, border: `2px solid ${colors.cream}` }}>
              <Camera size={12} color={colors.white} />
            </span>
          </button>
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase" style={{ letterSpacing: "0.1em", color: colors.plumSoft }}>Leverantörsportal</span>
            <h1 className="truncate text-2xl sm:text-3xl" style={{ fontFamily: serif, fontWeight: 700, color: colors.plum, lineHeight: 1.15 }}>
              {first ? `Hej ${first}!` : vendor.companyName}
            </h1>
          </span>
        </span>
        <button onClick={onPreview} className="flex-shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold" style={{ border: `1px solid ${colors.beige}`, backgroundColor: colors.white, color: colors.plum }}>
          Se min profil
        </button>
      </div>

      {banner && (
        <div className="mt-5 p-5" style={{ backgroundColor: banner.bg, borderRadius: 22 }}>
          <p className="font-semibold" style={{ color: colors.plum }}>{banner.title}</p>
          {vendor.status === "rejected" && vendor.rejectionReason && (
            <div className="mt-3 rounded-2xl px-4 py-3" style={{ backgroundColor: colors.white }}>
              <p className="text-xs font-semibold uppercase" style={{ color: colors.plumSoft, letterSpacing: "0.08em" }}>Anledning</p>
              <p className="mt-1 whitespace-pre-line text-sm" style={{ color: colors.plum }}>{vendor.rejectionReason}</p>
            </div>
          )}
          <p className="mt-3 text-sm" style={{ color: colors.plum }}>{banner.text}</p>
          {vendor.status === "rejected" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={onEditProfile} className="rounded-full px-4 py-2.5 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
                Ändra ansökan
              </button>
              <a href="mailto:info@planifest.se" className="rounded-full px-4 py-2.5 text-sm font-semibold" style={{ border: `1px solid ${colors.beige}`, backgroundColor: colors.white, color: colors.plum }}>
                Kontakta oss
              </a>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: pendingItems.length === 1 ? "ny förfrågan" : "nya förfrågningar", value: pendingItems.length, action: onBookings, bg: colors.pinkSoft },
          { label: "kommande event", value: upcomingAll.length, action: onBookings, bg: colors.lilacSoft },
          { label: conversationCount === 1 ? "konversation" : "konversationer", value: conversationCount, action: onInbox, bg: colors.peachSoft },
        ].map((t) => (
          <button key={t.label} onClick={t.action} className="flex flex-col gap-0.5 p-3 text-left sm:p-4" style={{ backgroundColor: t.bg, borderRadius: 18 }}>
            <span style={{ fontFamily: serif, fontWeight: 700, fontSize: 28, lineHeight: 1.1, color: colors.coral }}>{t.value}</span>
            <span className="text-xs" style={{ color: colors.plum }}>{t.label}</span>
          </button>
        ))}
      </div>

      {storyManager}

      {pendingItems.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-xl" style={{ fontFamily: serif, fontWeight: 700, color: colors.plum }}>Nya förfrågningar</h2>
          <div className="space-y-3">
            {pendingItems.slice(0, 3).map((i) => (
              <article key={`${i.bookingNumber}-${i.id}`} className="p-4" style={card}>
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-semibold" style={{ color: colors.plum }}>{i.name}</span>
                    <span className="mt-0.5 block text-sm" style={{ color: colors.plumSoft }}>
                      {fmtDate(i.date)} · {hhmm(i.startTime)}–{hhmm(i.endTime)} · {i.guests} gäster
                    </span>
                    {i.company && (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: colors.lilacSoft, color: colors.plum }}>
                        <Briefcase size={12} /> Företag: {i.company.name} · {i.company.org}
                      </span>
                    )}
                  </span>
                  <span className="flex-shrink-0 font-bold" style={{ color: colors.plum }}>{formatKr(i.price)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => onRespond(i.bookingNumber, i.id, "confirmed")} className="h-11 rounded-full text-sm font-semibold" style={{ backgroundColor: colors.plum, color: colors.white }}>
                    Bekräfta
                  </button>
                  <button onClick={() => onRespond(i.bookingNumber, i.id, "declined")} className="h-11 rounded-full text-sm font-medium" style={{ border: `1px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }}>
                    Neka
                  </button>
                </div>
              </article>
            ))}
          </div>
          {pendingItems.length > 3 && (
            <button onClick={onBookings} className="mt-3 text-sm font-semibold" style={{ color: colors.coral }}>
              Visa alla {pendingItems.length} förfrågningar →
            </button>
          )}
        </section>
      )}

      {upcomingAll.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xl" style={{ fontFamily: serif, fontWeight: 700, color: colors.plum }}>Kommande bokningar</h2>
            <button onClick={onBookings} className="text-sm font-semibold" style={{ color: colors.coral }}>Kalendern</button>
          </div>
          <div className="overflow-hidden" style={card}>
            {upcomingAll.slice(0, 4).map((i, idx) => (
              <div key={`${i.bookingNumber}-${i.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm" style={{ borderTop: idx ? `1px solid ${colors.cream}` : "none" }}>
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-xl" style={{ backgroundColor: colors.lilacSoft, color: colors.coral }}>
                    <span className="text-[10px] font-semibold uppercase">{i.date ? new Date(`${i.date}T00:00:00`).toLocaleDateString("sv-SE", { month: "short" }).replace(".", "") : ""}</span>
                    <span className="text-base font-bold leading-none">{i.date ? Number(i.date.slice(8, 10)) : ""}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold" style={{ color: colors.plum }}>{i.name}</span>
                    <span className="block text-xs" style={{ color: colors.plumSoft }}>{hhmm(i.startTime)}–{hhmm(i.endTime)}</span>
                  </span>
                </span>
                <span className="flex-shrink-0 font-semibold" style={{ color: colors.plum }}>{formatKr(i.price)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6 p-5" style={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold" style={{ color: colors.plum }}>Om er</h2>
          {!editingDesc && (
            <button
              onClick={() => {
                setDescDraft(vendor.profile?.description || "");
                setEditingDesc(true);
              }}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold"
              style={{ color: colors.coral }}
            >
              <Pencil size={14} /> Redigera
            </button>
          )}
        </div>
        {editingDesc ? (
          <>
            <textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              rows={5}
              maxLength={1500}
              aria-label="Beskrivning"
              placeholder="Berätta vad ni gör, för vilka fester och vad som gör er speciella."
              className="mt-2 w-full rounded-2xl p-3 text-sm leading-relaxed"
              style={{ border: `1px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.cream }}
            />
            <div className="mt-1 text-right text-[11px]" style={{ color: colors.plumSoft }}>{descDraft.length}/1500</div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={async () => {
                  setSavingDesc(true);
                  const ok = await onSaveDescription(descDraft.trim());
                  setSavingDesc(false);
                  if (ok) setEditingDesc(false);
                }}
                disabled={savingDesc}
                className="h-10 rounded-full px-5 text-sm font-semibold"
                style={{ backgroundColor: colors.coral, color: colors.white, opacity: savingDesc ? 0.6 : 1 }}
              >
                {savingDesc ? "Sparar…" : "Spara"}
              </button>
              <button onClick={() => setEditingDesc(false)} className="h-10 rounded-full px-5 text-sm font-medium" style={{ border: `1px solid ${colors.beige}`, color: colors.plum }}>
                Avbryt
              </button>
            </div>
          </>
        ) : (
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed" style={{ color: vendor.profile?.description ? colors.plum : colors.plumSoft }}>
            {vendor.profile?.description || "Ingen beskrivning än – tryck på Redigera och berätta om er."}
          </p>
        )}
      </section>

      <section className="mt-6 p-5" style={card}>
        <div className="flex items-center justify-between text-sm font-semibold" style={{ color: colors.plum }}>
          <span>Profilen är {percent} % klar</span>
          <span style={{ color: colors.coral }}>{percent} %</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: colors.lilacSoft }}>
          <div className="h-2 rounded-full" style={{ width: `${percent}%`, backgroundColor: colors.coral }} />
        </div>
        {missing.length > 0 ? (
          <p className="mt-2 text-sm" style={{ color: colors.plumSoft }}>Saknas: {missing.join(", ")}</p>
        ) : (
          <p className="mt-2 text-sm" style={{ color: colors.plumSoft }}>Snyggt! Profiler med många bilder får fler förfrågningar.</p>
        )}
        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: colors.plumSoft }}>
          <span className="flex items-center gap-1"><MapPin size={12} /> {locationName}</span>
          <span>{categoryLabels}</span>
        </p>
      </section>

      <section className="mt-6 overflow-hidden" style={card}>
        {links.map((l, idx) => {
          const Icon = l.icon;
          return (
            <button key={l.title} onClick={l.action} className="flex w-full items-center gap-3 px-4 text-left" style={{ minHeight: 64, borderTop: idx ? `1px solid ${colors.cream}` : "none" }}>
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: colors.lilacSoft }}>
                <Icon size={18} color={colors.coral} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold" style={{ color: colors.plum }}>{l.title}</span>
                <span className="block truncate text-xs" style={{ color: colors.plumSoft }}>{l.desc}</span>
              </span>
              <ChevronRight size={18} color={colors.plumSoft} />
            </button>
          );
        })}
      </section>
    </div>
  );
}

function VendorTabBar({ active, unread, pending, onOverview, onBookings, onInbox, onProfile }) {
  const items = [
    { id: "overview", label: "Översikt", icon: Home, onClick: onOverview },
    { id: "bookings", label: "Bokningar", icon: Calendar, onClick: onBookings, badge: pending },
    { id: "inbox", label: "Meddelanden", icon: MessageCircle, onClick: onInbox, badge: unread },
    { id: "profile", label: "Min profil", icon: User, onClick: onProfile },
  ];
  return (
    <nav aria-label="Leverantörsmeny" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 lg:hidden" style={{ backgroundColor: colors.white, borderTop: `1px solid ${colors.beige}`, paddingBottom: "env(safe-area-inset-bottom)" }}>
      {items.map(({ id, label, icon: Icon, onClick, badge }) => {
        const on = active === id;
        return (
          <button key={id} onClick={onClick} aria-current={on ? "page" : undefined} className="relative flex flex-col items-center gap-1 pb-2.5 pt-2 text-[11px]" style={{ color: on ? colors.coral : colors.plumSoft, fontWeight: on ? 700 : 500 }}>
            <Icon size={23} strokeWidth={on ? 2.2 : 1.8} />
            {label}
            {badge > 0 && (
              <span className="absolute top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold" style={{ left: "calc(50% + 6px)", backgroundColor: colors.korall, color: colors.white }}>
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Vendor editor for package cards ("rutor"): one block per category with the
// category's packages, and the quote option that every vendor always has.
// ---------------------------------------------------------------------------
const pkgInput = { border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white };
const smallLabel = "flex flex-col gap-1 text-xs font-semibold";

function PackageEditor({ pkg, index, count, onChange, onRemove, onMove }) {
  const hint = packageHint(pkg.category);
  const set = (field) => (e) => onChange(field, e.target.value);
  const includes = pkg.includes?.length ? pkg.includes : [""];
  const groups = pkg.choiceGroups || [];
  const [open, setOpen] = useState(!pkg.name || !(Number(pkg.price) > 0));
  const setGroups = (next) => onChange("choiceGroups", next);
  const updGroup = (gi, patch) => setGroups(groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const updOption = (gi, oi, patch) => updGroup(gi, { options: groups[gi].options.map((o, i) => (i === oi ? { ...o, ...patch } : o)) });
  const nextId = (list, prefix) => {
    let n = list.length + 1;
    while (list.some((x) => x.id === `${prefix}${n}`)) n += 1;
    return `${prefix}${n}`;
  };
  const priced = Number(pkg.price) > 0;
  const unitHint = PACKAGE_UNITS.find((u) => u.id === pkg.priceType)?.hint;

  return (
    <div className="rounded-2xl" style={{ backgroundColor: colors.cream, border: `1.5px solid ${priced ? colors.beige : colors.coral}` }}>
      <div className="flex items-center gap-2 p-3">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-semibold" style={{ color: colors.plum }}>{pkg.name || "Nytt paket"}</span>
          <span className="block text-xs" style={{ color: priced ? colors.plumSoft : colors.coralDeep }}>
            {priced ? packagePriceLabel(pkg) : "Sätt ett pris, annars visas paketet inte"}
          </span>
        </button>
        <button onClick={() => onMove(-1)} disabled={index === 0} aria-label="Flytta upp" title="Flytta upp" className="rounded-full p-2" style={{ backgroundColor: colors.white, opacity: index === 0 ? 0.35 : 1 }}>
          <ChevronLeft size={14} color={colors.plum} style={{ transform: "rotate(90deg)" }} />
        </button>
        <button onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Flytta ner" title="Flytta ner" className="rounded-full p-2" style={{ backgroundColor: colors.white, opacity: index === count - 1 ? 0.35 : 1 }}>
          <ChevronRight size={14} color={colors.plum} style={{ transform: "rotate(90deg)" }} />
        </button>
        <button onClick={onRemove} aria-label="Ta bort paketet" title="Ta bort paketet" className="rounded-full p-2" style={{ backgroundColor: colors.white }}>
          <Trash2 size={14} color={colors.coralDeep} />
        </button>
        <button onClick={() => setOpen((o) => !o)} className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ backgroundColor: colors.white, color: colors.plum }}>
          {open ? "Stäng" : "Ändra"}
        </button>
      </div>

      {open && (
        <div className="space-y-4 border-t px-4 pb-4 pt-3" style={{ borderColor: colors.beige }}>
          <label className={smallLabel} style={{ color: colors.plum }}>
            Paketets namn
            <input value={pkg.name} onChange={set("name")} placeholder={hint.name} className="rounded-lg px-3 py-2 text-sm font-normal" style={pkgInput} />
          </label>
          <label className={smallLabel} style={{ color: colors.plum }}>
            Kort beskrivning (valfritt)
            <textarea value={pkg.description} onChange={set("description")} rows={2} className="rounded-lg px-3 py-2 text-sm font-normal" style={pkgInput} />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className={smallLabel} style={{ color: colors.plum }}>
              Hur räknas priset?
              <select value={pkg.priceType} onChange={set("priceType")} className="rounded-lg px-2 py-2 text-sm font-normal" style={pkgInput}>
                {PACKAGE_UNITS.map((u) => (
                  <option key={u.id} value={u.id}>{u.label}</option>
                ))}
              </select>
            </label>
            <label className={smallLabel} style={{ color: colors.plum }}>
              Pris (kr{packageSuffix(pkg)})
              <input type="number" inputMode="numeric" min={0} value={pkg.price} onChange={set("price")} placeholder="0" className="rounded-lg px-3 py-2 text-sm font-normal" style={{ ...pkgInput, borderColor: priced ? colors.beige : colors.coral }} />
            </label>
            {unitHint && <p className="col-span-2 -mt-1 text-xs" style={{ color: colors.plumSoft }}>{unitHint}.</p>}
            {pkg.priceType === "per_unit" && (
              <label className={`${smallLabel} col-span-2`} style={{ color: colors.plum }}>
                Pris per vad? Skriv enheten
                <input value={pkg.unitLabel} onChange={set("unitLabel")} placeholder="T.ex. bord, stolsklädsel, glas" maxLength={30} className="rounded-lg px-3 py-2 text-sm font-normal" style={pkgInput} />
              </label>
            )}
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold" style={{ color: colors.plum }}>Det här ingår</p>
            <div className="space-y-1.5">
              {includes.map((line, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={line}
                    onChange={(e) => onChange("includes", includes.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={hint.include}
                    maxLength={120}
                    className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm"
                    style={pkgInput}
                  />
                  <button onClick={() => onChange("includes", includes.filter((_, j) => j !== i))} aria-label="Ta bort raden" className="rounded-full p-2" style={{ backgroundColor: colors.white }}>
                    <X size={13} color={colors.plumSoft} />
                  </button>
                </div>
              ))}
            </div>
            {includes.length < 20 && (
              <button onClick={() => onChange("includes", [...includes, ""])} className="mt-1.5 flex items-center gap-1 text-xs font-semibold" style={{ color: colors.coralDeep }}>
                <Plus size={12} /> Lägg till rad
              </button>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold" style={{ color: colors.plum }}>Val som kunden gör (valfritt)</p>
            <p className="mb-2 text-xs" style={{ color: colors.plumSoft }}>
              T.ex. "Välj 4 förrätter" av 6. Ett val kan kosta extra, och då räknas det på samma sätt som paketets pris.
            </p>
            <div className="space-y-3">
              {groups.map((g, gi) => (
                <div key={g.id} className="rounded-xl p-3" style={{ backgroundColor: colors.white }}>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className={`${smallLabel} min-w-0 basis-full`} style={{ color: colors.plum }}>
                      Rubrik
                      <input value={g.label} onChange={(e) => updGroup(gi, { label: e.target.value })} placeholder={hint.group} maxLength={60} className="rounded-lg px-3 py-2 text-sm font-normal" style={pkgInput} />
                    </label>
                    <label className={`${smallLabel} w-16`} style={{ color: colors.plum }}>
                      Minst
                      <input type="number" min={0} value={g.min} onChange={(e) => updGroup(gi, { min: e.target.value === "" ? "" : Math.max(0, Math.round(Number(e.target.value))) })} className="rounded-lg px-2 py-2 text-sm font-normal" style={pkgInput} />
                    </label>
                    <label className={`${smallLabel} w-16`} style={{ color: colors.plum }}>
                      Högst
                      <input type="number" min={1} value={g.max} onChange={(e) => updGroup(gi, { max: e.target.value === "" ? "" : Math.max(1, Math.round(Number(e.target.value))) })} className="rounded-lg px-2 py-2 text-sm font-normal" style={pkgInput} />
                    </label>
                    <button onClick={() => setGroups(groups.filter((_, i) => i !== gi))} aria-label="Ta bort valet" className="mb-0.5 ml-auto flex items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold" style={{ backgroundColor: colors.cream, color: colors.coralDeep }}>
                      <Trash2 size={13} color={colors.coralDeep} /> Ta bort valet
                    </button>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: colors.plumSoft }}>
                    Kunden väljer {Number(g.min) === Number(g.max) ? `exakt ${g.min || 0}` : `${g.min || 0}–${g.max || 0}`} av {g.options.filter((o) => String(o.label).trim()).length} alternativ.
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {g.options.map((o, oi) => (
                      <div key={o.id} className="flex gap-2">
                        <input value={o.label} onChange={(e) => updOption(gi, oi, { label: e.target.value })} placeholder={hint.option} maxLength={60} className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm" style={pkgInput} />
                        <input type="number" min={0} value={o.price ?? ""} onChange={(e) => updOption(gi, oi, { price: e.target.value })} placeholder="+ kr" aria-label="Extra pris" className="w-16 flex-shrink-0 rounded-lg px-2 py-2 text-sm" style={pkgInput} />
                        <button onClick={() => updGroup(gi, { options: g.options.filter((_, i) => i !== oi) })} aria-label="Ta bort alternativet" className="rounded-full p-2" style={{ backgroundColor: colors.cream }}>
                          <X size={13} color={colors.plumSoft} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {g.options.length < 30 && (
                    <button onClick={() => updGroup(gi, { options: [...g.options, { id: nextId(g.options, "o"), label: "", price: "" }] })} className="mt-1.5 flex items-center gap-1 text-xs font-semibold" style={{ color: colors.coralDeep }}>
                      <Plus size={12} /> Lägg till alternativ
                    </button>
                  )}
                </div>
              ))}
            </div>
            {groups.length < 10 && (
              <button
                onClick={() => setGroups([...groups, { id: nextId(groups, "g"), label: "", min: 1, max: 1, options: emptyOptions(2) }])}
                className="mt-2 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ backgroundColor: colors.coralSoft, color: colors.coralDeep }}
              >
                <Plus size={12} /> Lägg till ett val
              </button>
            )}
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold" style={{ color: colors.plum }}>Gränser (valfritt)</p>
            <div className="grid grid-cols-2 gap-2">
              <label className={smallLabel} style={{ color: colors.plumSoft }}>
                {pkg.priceType === "per_unit" ? "Minsta antal" : "Minst antal gäster"}
                <input type="number" min={1} value={pkg.minGuests} onChange={set("minGuests")} className="rounded-lg px-3 py-2 text-sm font-normal" style={pkgInput} />
              </label>
              <label className={smallLabel} style={{ color: colors.plumSoft }}>
                {pkg.priceType === "per_unit" ? "Högsta antal" : "Max antal gäster"}
                <input type="number" min={1} value={pkg.maxGuests} onChange={set("maxGuests")} className="rounded-lg px-3 py-2 text-sm font-normal" style={pkgInput} />
              </label>
              {pkg.priceType === "per_hour" && (
                <label className={smallLabel} style={{ color: colors.plumSoft }}>
                  Minsta antal timmar
                  <input type="number" min={0.5} step={0.5} value={pkg.minHours} onChange={set("minHours")} className="rounded-lg px-3 py-2 text-sm font-normal" style={pkgInput} />
                </label>
              )}
              <label className={`${smallLabel} col-span-2`} style={{ color: colors.plumSoft }}>
                Bara vissa tider (t.ex. 18:00–02:00)
                <span className="flex items-center gap-2">
                  <input type="time" value={pkg.timeFrom} onChange={set("timeFrom")} className="flex-1 rounded-lg px-2 py-2 text-sm font-normal" style={pkgInput} aria-label="Från" />
                  –
                  <input type="time" value={pkg.timeTo} onChange={set("timeTo")} className="flex-1 rounded-lg px-2 py-2 text-sm font-normal" style={pkgInput} aria-label="Till" />
                  {(pkg.timeFrom || pkg.timeTo) && (
                    <button onClick={() => { onChange("timeFrom", ""); onChange("timeTo", ""); }} aria-label="Ta bort tiderna" className="rounded-full p-2" style={{ backgroundColor: colors.white }}>
                      <X size={13} color={colors.plumSoft} />
                    </button>
                  )}
                </span>
              </label>
            </div>
            <p className="mt-1 text-xs" style={{ color: colors.plumSoft }}>
              Passar inte kundens gäster eller tid blir paketet grått, och kunden kan kontakta er.
              {pkg.priceType === "per_hour" ? " Är eventet kortare än minsta tiden betalar kunden ändå för minsta tiden." : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function VendorPackagesSection({ vendor, onAddService, onUpdateService, onRemoveService, onMoveService, onAddAddon, onUpdateAddon, onRemoveAddon, onRequestForm }) {
  const services = vendor.profile.services;
  const addons = vendor.profile.addons;
  const allPackages = services.filter((s) => s.priceType !== "quote");
  const setDirect = (cat, on) => onRequestForm(cat, { ...(vendor.requestForms?.[cat] || {}), fields: vendor.requestForms?.[cat]?.fields || [], direct: on });
  const toggleLink = (a, sid) =>
    onUpdateAddon(a.id, "serviceIds", (a.serviceIds || []).includes(sid) ? a.serviceIds.filter((x) => x !== sid) : [...(a.serviceIds || []), sid]);

  return (
    <>
      {vendor.categories.map((cat) => {
        const label = catMap[cat]?.label || cat;
        const packages = services.filter((s) => s.priceType !== "quote" && (s.category === cat || (!s.category && vendor.categories.length === 1)));
        const quote = services.find((s) => s.priceType === "quote" && (s.category === cat || (!s.category && vendor.categories.length === 1)));
        const quoteFirst = QUOTE_FIRST_CATEGORIES.includes(cat);
        const directSetting = vendor.requestForms?.[cat]?.direct;
        const on = quoteFirst ? directSetting === true : directSetting !== false;
        return (
          <section key={cat} className="mb-6 rounded-3xl p-6" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
            <h2 className="mb-1" style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>
              {label}: paket & priser
            </h2>

            {quoteFirst && !on ? (
              <>
                <p className="mb-4 text-sm" style={{ color: colors.plumSoft }}>
                  Kunder skickar en förfrågan och ni svarar med en offert. Har ni även fasta paket, till exempel en ballongbåge för 2 500 kr, kan kunderna boka dem direkt.
                </p>
                <button
                  onClick={() => {
                    setDirect(cat, true);
                    if (packages.length === 0) onAddService(cat, "package");
                  }}
                  className="mb-5 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
                  style={{ border: `2px dashed ${colors.coral}`, color: colors.coralDeep, backgroundColor: colors.coralSoft + "55" }}
                >
                  <Plus size={15} /> Vill ni även visa färdiga paketpriser? Klicka här
                </button>
              </>
            ) : (
              <>
                <p className="mb-4 text-sm" style={{ color: colors.plumSoft }}>
                  Varje paket blir en vit ruta på er sida som kunden kan lägga direkt i sin bokning. Ni bekräftar sedan bokningen.
                </p>
                <div className="space-y-3">
                  {packages.map((s, i) => (
                    <PackageEditor
                      key={s.id}
                      pkg={{ ...s, category: cat }}
                      index={i}
                      count={packages.length}
                      onChange={(field, value) => onUpdateService(s.id, field, value)}
                      onRemove={() => onRemoveService(s.id)}
                      onMove={(dir) => onMoveService(s.id, dir)}
                    />
                  ))}
                </div>
                {packages.length === 0 && (
                  <p className="text-xs" style={{ color: colors.plumSoft }}>
                    Inga paket än. Utan paket kan kunder bara skicka en förfrågan.
                  </p>
                )}
                <button onClick={() => onAddService(cat, "package")} className="mt-3 flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold" style={{ backgroundColor: colors.coralSoft, color: colors.coralDeep }}>
                  <Plus size={14} /> Nytt paket
                </button>
                {packages.length > 0 && (
                  <label className="mt-4 flex items-start gap-2 text-sm" style={{ color: colors.plum }}>
                    <input type="checkbox" className="mt-1" checked={on} onChange={(e) => setDirect(cat, e.target.checked)} />
                    <span>
                      Visa paketen för kunder
                      <span className="block text-xs" style={{ color: colors.plumSoft }}>
                        Avmarkera för att tillfälligt bara ta emot förfrågningar. Paketen sparas.
                      </span>
                    </span>
                  </label>
                )}
                {quoteFirst && (
                  <button onClick={() => setDirect(cat, false)} className="mt-2 text-xs underline" style={{ color: colors.plumSoft }}>
                    Visa inte paketpriser, bara offert
                  </button>
                )}
              </>
            )}

            <div className="mt-5 rounded-2xl p-4" style={{ backgroundColor: colors.lilacSoft }}>
              <p className="text-sm font-semibold" style={{ color: colors.plum }}>Offert</p>
              <p className="mb-3 text-xs" style={{ color: colors.plumSoft }}>
                Alla kunder kan alltid skicka en förfrågan till er. Ett från-pris hjälper dem att veta om ni passar budgeten.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  type="number"
                  inputMode="numeric"
                  value={quote?.fromPrice ?? ""}
                  onChange={(e) => (quote ? onUpdateService(quote.id, "fromPrice", e.target.value) : onAddService(cat, "quote", { fromPrice: e.target.value }))}
                  placeholder="Från-pris (kr)"
                  aria-label="Från-pris för offert"
                  className="rounded-lg px-3 py-2 text-sm"
                  style={pkgInput}
                />
                <input
                  value={quote?.description ?? ""}
                  onChange={(e) => (quote ? onUpdateService(quote.id, "description", e.target.value) : onAddService(cat, "quote", { description: e.target.value }))}
                  placeholder='T.ex. "Pris utifrån önskemål och storlek"'
                  aria-label="Text om offert"
                  className="rounded-lg px-3 py-2 text-sm sm:col-span-2"
                  style={pkgInput}
                />
              </div>
            </div>
          </section>
        );
      })}

      <section className="mb-6 rounded-3xl p-6" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
        <h2 className="mb-1" style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>
          Tillägg (valfritt)
        </h2>
        <p className="mb-4 text-sm" style={{ color: colors.plumSoft }}>
          Extra saker kunden kan lägga till, till exempel vinpaket, champagne eller rökmaskin. Skapa ett tillägg en gång och välj vilka paket det hör till.
        </p>
        <div className="space-y-3">
          {addons.map((a) => (
            <div key={a.id} className="rounded-2xl p-3" style={{ backgroundColor: colors.cream }}>
              <div className="flex flex-wrap items-center gap-2">
                <input value={a.name} onChange={(e) => onUpdateAddon(a.id, "name", e.target.value)} placeholder="T.ex. Vinpaket" className="min-w-[140px] flex-1 rounded-lg px-3 py-2 text-sm" style={pkgInput} />
                <input type="number" value={a.price} onChange={(e) => onUpdateAddon(a.id, "price", e.target.value)} placeholder="Pris (kr)" className="w-24 rounded-lg px-3 py-2 text-sm" style={pkgInput} />
                <select value={a.priceType || "fixed"} onChange={(e) => onUpdateAddon(a.id, "priceType", e.target.value)} className="rounded-lg px-2 py-2 text-sm" style={pkgInput} aria-label="Hur räknas tillägget?">
                  <option value="fixed">Fast pris</option>
                  <option value="per_person">Per person</option>
                </select>
                <button onClick={() => onRemoveAddon(a.id)} aria-label="Ta bort tillägget" className="rounded-full p-2" style={{ backgroundColor: colors.white }}>
                  <Trash2 size={14} color={colors.coralDeep} />
                </button>
              </div>
              {allPackages.length > 0 ? (
                <div className="mt-2">
                  <p className="mb-1 text-xs" style={{ color: colors.plumSoft }}>Gäller för:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {allPackages.map((s) => {
                      const linked = (a.serviceIds || []).includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleLink(a, s.id)}
                          aria-pressed={linked}
                          className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
                          style={{ backgroundColor: linked ? colors.coral : colors.white, color: linked ? colors.white : colors.plum, border: `1px solid ${linked ? colors.coral : colors.beige}` }}
                        >
                          {linked && <Check size={11} />} {s.name || "Namnlöst paket"}
                          {vendor.categories.length > 1 ? ` (${catMap[s.category]?.label || ""})` : ""}
                        </button>
                      );
                    })}
                  </div>
                  {(a.serviceIds || []).filter((id) => allPackages.some((s) => s.id === id)).length === 0 && (
                    <p className="mt-1 text-xs" style={{ color: colors.coralDeep }}>Välj minst ett paket, annars syns tillägget inte.</p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs" style={{ color: colors.plumSoft }}>Skapa ett paket först, sedan kopplar ni tillägget till det.</p>
              )}
            </div>
          ))}
        </div>
        <button onClick={() => onAddAddon([])} className="mt-4 flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold" style={{ backgroundColor: colors.coralSoft, color: colors.coralDeep }}>
          <Plus size={14} /> Nytt tillägg
        </button>
      </section>
    </>
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
  onMakeMainImage,
  onUploadImage,
  onAddService,
  onUpdateService,
  onRemoveService,
  onAddAddon,
  onUpdateAddon,
  onRemoveAddon,
  onMoveService,
  onPreview,
  onDashboard,
  onShowToast,
  onRequestForm,
  onResubmit,
}) {
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  if (!vendor) return null;
  const { percent } = getVendorCompleteness(vendor);

  const addImage = () => {
    if (!imageUrl.trim()) return;
    onAddImage(imageUrl.trim());
    setImageUrl("");
  };
  const addSampleImage = () => onAddImage(`https://picsum.photos/seed/vendor-${Date.now()}/600/420`);

  const MAX_FILE_SIZE = 25 * 1024 * 1024; // photos are shrunk before upload, so big phone originals are fine
  const MAX_IMAGES = 12;
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-selecting the same file later
    const room = MAX_IMAGES - vendor.profile.images.length;
    if (files.length > room) onShowToast(room > 0 ? `Max ${MAX_IMAGES} bilder – bara de första ${room} laddas upp.` : `Max ${MAX_IMAGES} bilder. Ta bort en bild först.`);
    for (const file of files.slice(0, Math.max(0, room))) {
      if (file.size > MAX_FILE_SIZE) {
        onShowToast(`${file.name} är för stor (max 25 MB)`);
        continue;
      }
      setUploading((n) => n + 1);
      const result = await onUploadImage(file);
      setUploading((n) => n - 1);
      if (result.error) onShowToast(result.error);
      else onAddImage(result.url);
    }
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

      <div className="mb-6 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: colors.lilacSoft, color: colors.plum }}>
        <p className="font-semibold">Det här behöver ni fylla i:</p>
        <p className="mt-1">1. Om er. 2. Bilder. 3. Vad ni erbjuder och vad det kostar. Allt annat längst ner är valfritt, och ni kan ändra senare.</p>
      </div>

      <section className="mb-6 rounded-3xl p-6" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
        <h2 className="mb-4" style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>
          Om er
        </h2>
        <div className="space-y-4">
          <VendorTextField label="Företagsnamn" value={vendor.companyName} onChange={(v) => onField("companyName", v)} />
          <div>
            <VendorTextField
              label="En mening om er"
              value={vendor.profile.tagline}
              onChange={(v) => onProfileField("tagline", v)}
              placeholder="T.ex. Mysig lokal i centrala Göteborg"
            />
            {!vendor.profile.tagline?.trim() && (
              <p className="mt-1 text-xs" style={{ color: colors.plumSoft }}>
                Visas högst upp på er profil.
              </p>
            )}
          </div>
          <div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium" style={{ color: colors.plum }}>
                Berätta mer om er
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
        <p className="mb-3 text-sm" style={{ color: colors.plumSoft }}>
          Erbjuder ni mer än en sak, till exempel en lokal som också caterar? Välj båda. Ni visas då i båda kategorierna, och kunder ser vad ni även kan ordna. Lägg sedan in tjänster och priser för varje kategori längre ner.
        </p>
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
          Huvudbilden visas på ditt kort och överst på din profil. Tryck "Gör till huvudbild" på den bild du vill ha först.
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
                {i > 0 && (
                  <button
                    onClick={() => onMakeMainImage(i)}
                    className="absolute inset-x-1 bottom-1 rounded-full px-2 py-1 text-[11px] font-semibold"
                    style={{ backgroundColor: "rgba(255,255,255,0.92)", color: colors.coralDeep }}
                  >
                    Gör till huvudbild
                  </button>
                )}
                <button
                  onClick={() => onRemoveImage(i)}
                  aria-label="Ta bort bilden"
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(74,21,56,0.7)" }}
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
          {uploading > 0 ? "Laddar upp…" : "Ladda upp bilder från mobil eller dator"}
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} disabled={uploading > 0} />
        </label>

      </section>

      <VendorPackagesSection
        vendor={vendor}
        onAddService={onAddService}
        onUpdateService={onUpdateService}
        onRemoveService={onRemoveService}
        onMoveService={onMoveService}
        onAddAddon={onAddAddon}
        onUpdateAddon={onUpdateAddon}
        onRemoveAddon={onRemoveAddon}
        onRequestForm={onRequestForm}
      />

      {vendor.categories.length > 0 && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-left text-sm font-semibold"
            style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}`, color: colors.plum }}
          >
            <span>
              Egna frågor till kunden (valfritt)
              <span className="mt-0.5 block text-xs font-normal" style={{ color: colors.plumSoft }}>
                Ni behöver inte göra något här. Kunder får annars frågan "Berätta vad du behöver".
              </span>
            </span>
            <span aria-hidden="true">{showAdvanced ? "−" : "+"}</span>
          </button>
          {showAdvanced && (
            <div className="mt-4">
              {vendor.categories.map((cat) => (
                  <RequestFormEditor
                    key={cat}
                    categoryId={cat}
                    form={vendor.requestForms?.[cat]}
                    hasPrice={vendor.profile.services.some((sv) => (!sv.category || sv.category === cat) && Number(sv.price) > 0)}
                    onChange={(cfg) => onRequestForm(cat, cfg)}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={onPreview}
          className="flex-1 rounded-full px-5 py-3 text-sm font-semibold"
          style={{ border: `1.5px solid ${colors.lilac}`, color: colors.lilacDeep, backgroundColor: colors.white }}
        >
          Förhandsvisa profil
        </button>
        {vendor.status === "rejected" ? (
          <button onClick={onResubmit} className="flex-1 rounded-full px-5 py-3 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
            Spara ändringar och skicka om ansökan
          </button>
        ) : (
          <button onClick={onDashboard} className="flex-1 rounded-full px-5 py-3 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
            Klart, till min profil
          </button>
        )}
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
                      {s.price ? formatKr(Number(s.price)) : "Enligt överenskommelse"}
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
function VendorInboxView({ conversations, activeConversationId, messages, onOpenConversation, onSendMessage, onSendQuote, onBack, inboxById = {}, quoteFromBrief, customerAvatars = {} }) {
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

  const quoteReady = Number(quoteAmount) > 0 && quoteDescription.trim().length >= 3;
  const submitQuote = () => {
    const amount = Number(quoteAmount);
    if (!amount || amount <= 0 || !quoteReady) return;
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
        <div className="mb-3 flex items-center gap-3">
          {customerAvatars[active.customer_id] && <img src={customerAvatars[active.customer_id]} alt="" className="h-11 w-11 rounded-full object-cover" />}
          <div>
            <p style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>{catMap[active.category_id]?.label || "Fråga"}</p>
            <p className="text-xs" style={{ color: colors.plumSoft }}>Kund</p>
          </div>
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
                <QuoteCard amount={m.quote_amount} description={m.quote_description} mine>
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: m.quote_status === "accepted" ? colors.greenSoft : m.quote_status === "declined" ? colors.beige : colors.white,
                      color: m.quote_status === "accepted" ? colors.green : colors.plumSoft,
                    }}
                  >
                    {m.quote_status === "accepted" ? "Godkänd av kunden" : m.quote_status === "declined" ? "Kunden tackade nej" : "Väntar på kundens svar"}
                  </span>
                </QuoteCard>
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
            <label className="block text-xs font-semibold" style={{ color: colors.plum }} htmlFor="quote-amount">
              Totalpris (kr)
            </label>
            <input
              id="quote-amount"
              type="number"
              inputMode="numeric"
              value={quoteAmount}
              onChange={(e) => setQuoteAmount(e.target.value)}
              placeholder="T.ex. 4500"
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
              style={fieldStyle}
            />
            <label className="mt-3 block text-xs font-semibold" style={{ color: colors.plum }} htmlFor="quote-includes">
              Det här ingår
            </label>
            <textarea
              id="quote-includes"
              value={quoteDescription}
              onChange={(e) => setQuoteDescription(e.target.value.slice(0, 600))}
              rows={3}
              placeholder="T.ex. Tårta för 30 personer, tre våningar, leverans och uppställning."
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
              style={fieldStyle}
            />
            <p className="mt-2 text-xs leading-relaxed" style={{ color: colors.plumSoft }}>
              Kunden ser också Planifests villkor i offerten: {QUOTE_DEPOSIT_PCT} % deposition
              {Number(quoteAmount) > 0 ? ` (${formatKr(Math.round(Number(quoteAmount) * QUOTE_DEPOSIT_PCT / 100))})` : ""} när ni bekräftat, resten senast {QUOTE_BALANCE_DAYS} dagar före och gratis avbokning mer än {QUOTE_FREE_CANCEL_DAYS} dagar före.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setQuoteMode(false)}
                className="flex-1 rounded-full px-4 py-2 text-sm font-medium"
                style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }}
              >
                Avbryt
              </button>
              <button
                onClick={submitQuote}
                disabled={!quoteReady}
                className="flex-1 rounded-full px-4 py-2 text-sm font-semibold"
                style={{ backgroundColor: colors.coral, color: colors.white, opacity: quoteReady ? 1 : 0.5 }}
              >
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
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ backgroundColor: colors.lilacSoft }}>
                {customerAvatars[c.customer_id] ? <img src={customerAvatars[c.customer_id]} alt="" className="h-full w-full object-cover" /> : Icon && <Icon size={16} color={colors.lilacDeep} />}
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
  const palette = [colors.lilac, colors.korall, colors.syren, colors.lilacDeep, colors.peach, colors.coral];
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
        <path d="M5 4.6 C 11 3.4, 18 3.6, 23.2 4.4 C 24.2 10, 24 17, 23.4 23.2 C 17 24.4, 11 24.2, 4.8 23.4 C 3.8 17, 4 10, 5 4.6 Z" stroke={done ? colors.green : colors.lilac} strokeWidth="1.8" fill={done ? colors.greenSoft : colors.white} strokeLinejoin="round" />
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
    // Only when the form opens: the page behind re-renders now and then (new messages, stories),
    // and resetting on every render wiped what had been typed, e.g. the budget.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ backgroundColor: "rgba(74,21,56,0.45)" }} onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 sm:rounded-3xl" style={{ backgroundColor: colors.cream }} onClick={(e) => e.stopPropagation()}>
        <p style={{ fontFamily: serif, fontSize: 22, color: colors.plum }}>{mode === "create" ? "Nytt event" : "Redigera eventet"}</p>
        <label className="mt-4 flex flex-col gap-1 text-xs font-semibold" style={{ color: colors.plum }}>
          Namn på eventet
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
          <input type="text" inputMode="numeric" placeholder="t.ex. 20 000" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9 ]/g, ""))} className="rounded-xl px-3 py-2 text-sm font-normal" style={fieldStyle} />
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
                Ta bort hela eventet, med checklista, budget och anteckningar?{" "}
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
                Ta bort eventet
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
      <span aria-hidden="true" className="absolute left-1/2 -top-3 h-6 w-24 -translate-x-1/2 rotate-[-2deg] rounded-sm" style={{ backgroundColor: "rgba(217,139,168,0.45)" }} />
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
          backgroundColor: "#FFFAF3",
          backgroundImage: "repeating-linear-gradient(transparent, transparent 27px, rgba(217,139,168,0.4) 28px)",
          backgroundAttachment: "local",
          border: `1.5px solid ${colors.beige}`,
          borderLeft: "3px solid rgba(255,127,107,0.45)",
          boxShadow: "0 6px 14px rgba(74,21,56,0.07)",
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
  const [newEmail, setNewEmail] = useState("");
  const [confirmMail, setConfirmMail] = useState(null); // { kind, ids, n } while the host is asked "send N mails?"
  const [mailMsg, setMailMsg] = useState("");
  const [mailBusy, setMailBusy] = useState(false);
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
    if (newEmail.trim() && !EMAIL_RE.test(newEmail.trim())) {
      setMailMsg("Den e-postadressen ser inte rätt ut.");
      return;
    }
    guestApi.add(ev.id, [{ name: name.trim(), email: newEmail.trim() }]);
    setName("");
    setNewEmail("");
    setMailMsg("");
  };
  // One guest per line: "Kalle kalle@epost.se" or "Kalle, kalle@epost.se". A line with no address may hold several names ("Lisa, Pelle").
  const addBulk = () => {
    const people = [];
    bulk.split(/\n/).forEach((line) => {
      const m = line.match(/[^\s<>,;]+@[^\s<>,;]+\.[^\s<>,;]+/);
      if (m) people.push({ name: line.replace(m[0], "").replace(/[<>,;]+/g, " ").replace(/\s+/g, " ").trim(), email: m[0] });
      else line.split(/,|;/).forEach((n) => people.push({ name: n.trim(), email: "" }));
    });
    const clean = people.filter((x) => x.name).slice(0, 100);
    if (clean.length === 0) return;
    guestApi.add(ev.id, clean);
    setBulk("");
    setShowBulk(false);
  };

  // who the mail buttons would reach right now
  const reachable = guests.filter((g) => g.email && !g.emailOptout);
  const toInvite = reachable.filter((g) => !g.invitedAt);
  const deadlinePassed = ev.rsvpDeadline && ev.rsvpDeadline < todayISO();
  const toRemind = deadlinePassed ? [] : reachable.filter((g) => g.status === "pending" && (!g.lastRemindedAt || Date.now() - new Date(g.lastRemindedAt).getTime() > 86400000));
  const optedOut = guests.filter((g) => g.email && g.emailOptout).length;
  const runMail = async () => {
    if (!confirmMail) return;
    setMailBusy(true);
    const res = await guestApi.sendEmails(ev.id, confirmMail.kind, confirmMail.ids);
    setMailBusy(false);
    setConfirmMail(null);
    setMailMsg(res.error ? res.error : res.count === 0 ? "Inga mejl behövde skickas." : `${res.count} ${res.count === 1 ? "mejl skickas" : "mejl skickas"} ✓`);
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
          Sätt antal gäster i eventet till {yesHeads}
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

      {reachable.length + optedOut > 0 && (
        <div className="mt-4 rounded-2xl p-4" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
          <p className="text-sm font-semibold" style={{ color: colors.plum }}>
            Mejl från Planifest
          </p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: colors.plumSoft }}>
            Vi mejlar inbjudan och påminnelser åt dig, i ditt namn. Gäster som svarar på mejlet når dig på din e-post, och varje mejl har en avanmälningslänk. Du ansvarar för att dina gäster är okej med att få mejl.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setConfirmMail({ kind: "invite", ids: null, n: toInvite.length })}
              disabled={toInvite.length === 0 || mailBusy}
              className="rounded-full px-4 py-2 text-sm font-semibold"
              style={{ backgroundColor: colors.coral, color: colors.white, opacity: toInvite.length === 0 ? 0.4 : 1 }}
            >
              Mejla inbjudan till {toInvite.length} {toInvite.length === 1 ? "gäst" : "gäster"}
            </button>
            <button
              onClick={() => setConfirmMail({ kind: "reminder", ids: null, n: toRemind.length })}
              disabled={toRemind.length === 0 || mailBusy}
              className="rounded-full px-4 py-2 text-sm font-semibold"
              style={{ border: `1.5px solid ${colors.coral}`, color: colors.coral, backgroundColor: colors.white, opacity: toRemind.length === 0 ? 0.4 : 1 }}
            >
              Påminn {toRemind.length} som inte svarat
            </button>
          </div>
          {confirmMail && (
            <div className="mt-3 rounded-xl p-3 text-sm" style={{ backgroundColor: colors.cream, color: colors.plum }}>
              <p>
                Skicka {confirmMail.n} {confirmMail.kind === "invite" ? (confirmMail.n === 1 ? "inbjudan" : "inbjudningar") : confirmMail.n === 1 ? "påminnelse" : "påminnelser"} nu?
              </p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => setConfirmMail(null)} className="rounded-full px-4 py-1.5 text-xs font-medium" style={{ border: `1.5px solid ${colors.beige}`, backgroundColor: colors.white }}>
                  Avbryt
                </button>
                <button onClick={runMail} disabled={mailBusy} className="rounded-full px-4 py-1.5 text-xs font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
                  {mailBusy ? "Skickar..." : "Ja, skicka"}
                </button>
              </div>
            </div>
          )}
          {optedOut > 0 && (
            <p className="mt-2 text-xs" style={{ color: colors.plumSoft }}>
              {optedOut} {optedOut === 1 ? "gäst har" : "gäster har"} avanmält sig från mejl och får inga fler.
            </p>
          )}
        </div>
      )}
      {mailMsg && (
        <p className="mt-2 text-sm font-medium" style={{ color: mailMsg.endsWith("✓") ? colors.green : colors.coralDeep }}>
          {mailMsg}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addOne()} maxLength={100} placeholder="Lägg till en gäst..." aria-label="Ny gäst" className="min-w-[160px] flex-1 rounded-xl px-3 py-2 text-sm" style={fieldStyle} />
        <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addOne()} maxLength={254} placeholder="E-post (valfritt)" aria-label="Gästens e-post" className="min-w-[160px] flex-1 rounded-xl px-3 py-2 text-sm" style={fieldStyle} />
        <button onClick={addOne} className="rounded-full px-5 py-2 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
          Lägg till
        </button>
      </div>
      <button onClick={() => setShowBulk((v) => !v)} className="mt-2 text-xs font-medium underline" style={{ color: colors.lilacDeep }}>
        {showBulk ? "Dölj" : "Klistra in flera namn på en gång"}
      </button>
      {showBulk && (
        <div className="mt-2">
          <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={5} aria-label="Flera gäster" placeholder={"Ett namn per rad, gärna med e-post:\nFarmor\nKalle kalle@epost.se"} className="w-full rounded-xl px-3 py-2 text-sm" style={fieldStyle} />
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
              {g.email && (
                <p className="mt-0.5 text-xs" style={{ color: colors.plumSoft }}>
                  {g.email}
                  {g.emailOptout ? " · avanmäld från mejl" : [g.invitedAt ? ` · inbjuden ${shortDate(g.invitedAt.slice(0, 10))}` : "", g.lastRemindedAt ? ` · påmind ${shortDate(g.lastRemindedAt.slice(0, 10))}` : ""].join("")}
                </p>
              )}
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
                {g.email && !g.emailOptout && (
                  <button onClick={() => setConfirmMail({ kind: "invite", ids: [g.id], n: 1 })} className="font-medium underline" style={{ color: colors.lilacDeep }}>
                    {g.invitedAt ? "Mejla igen" : "Mejla inbjudan"}
                  </button>
                )}
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
                  <label className="flex items-center gap-1.5">
                    E-post
                    <input
                      defaultValue={g.email}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v === g.email) return;
                        if (v && !EMAIL_RE.test(v)) {
                          setMailMsg("Den e-postadressen ser inte rätt ut.");
                          return;
                        }
                        guestApi.update(ev.id, g.id, { email: v });
                      }}
                      maxLength={254}
                      type="email"
                      aria-label={`E-post för ${g.name}`}
                      placeholder="namn@epost.se"
                      className="w-48 rounded-lg px-2 py-1"
                      style={fieldStyle}
                    />
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
// The link in every guest mail. It asks first (a mail scanner that opens links must not opt anyone out by accident).
function OptOutView({ state, onConfirm, onHome }) {
  const wrap = (children) => <div className="mx-auto max-w-md px-6 pb-24 pt-14 text-center sm:px-10">{children}</div>;
  if (state.error) {
    return wrap(
      <>
        <h1 style={{ fontFamily: serif, fontSize: 26, color: colors.plum }}>Länken fungerar inte</h1>
        <p className="mt-3 text-sm" style={{ color: colors.plumSoft }}>
          {state.error}
        </p>
      </>
    );
  }
  if (state.done) {
    return wrap(
      <>
        <p style={{ fontFamily: hand, fontSize: 30, color: colors.lilacDeep }}>klart</p>
        <h1 style={{ fontFamily: serif, fontSize: 26, color: colors.plum }}>Du får inga fler mejl</h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
          Vi skickar inga fler mejl om fester till den här adressen. Du kan fortfarande svara på en inbjudan om du öppnar länken du fått.
        </p>
        <button onClick={onHome} className="mt-6 rounded-full px-6 py-3 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
          Till Planifest
        </button>
      </>
    );
  }
  return wrap(
    <>
      <h1 style={{ fontFamily: serif, fontSize: 26, color: colors.plum }}>Vill du inte ha fler mejl?</h1>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
        Om du avanmäler dig skickar Planifest inga fler mejl om fester till den här adressen, från någon som bjuder in dig.
      </p>
      <button onClick={onConfirm} disabled={state.loading} className="mt-6 rounded-full px-6 py-3 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white, opacity: state.loading ? 0.6 : 1 }}>
        {state.loading ? "Ett ögonblick..." : "Ja, avanmäl mig"}
      </button>
      <p className="mt-4 text-xs" style={{ color: colors.plumSoft }}>
        Ändrade du dig? Du kan bara stänga den här sidan.
      </p>
    </>
  );
}

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
    <div className="relative overflow-hidden rounded-3xl p-6 text-center" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}`, boxShadow: "0 10px 30px rgba(74,21,56,0.08)" }}>
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
          <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: colors.greenSoft }}>
            <p style={{ fontFamily: hand, fontSize: 28, color: colors.green }}>Tack, ditt svar är sparat!</p>
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
        Ska du själv planera ett event?{" "}
        <button onClick={onHome} className="font-semibold underline" style={{ color: colors.lilacDeep }}>
          Planera den på Planifest
        </button>
      </p>
    </>
  );
}

function ReviewPrompt({ due, onReview }) {
  if (!due || due.length === 0) return null;
  const first = due[0];
  return (
    <div className="flex items-center gap-3 p-4" style={{ backgroundColor: colors.peachSoft, border: `1px solid ${colors.peach}`, borderRadius: 20 }}>
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: colors.white }}>
        <Star size={20} fill={colors.coral} color={colors.coral} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold" style={{ color: colors.plum }}>Hur blev festen?</span>
        <span className="block text-sm" style={{ color: colors.plumSoft }}>
          Lämna ett omdöme till {first.item.name}{due.length > 1 ? ` och ${due.length - 1} till` : ""}.
        </span>
      </span>
      <button onClick={() => onReview(first.bookingNumber, first.item)} className="flex-shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
        Betygsätt
      </button>
    </div>
  );
}

function MinSidaHeader({ name, email, isAdmin, hasVendor, onAccount, onSaved, onSupport, onVendor, onAdmin, onSignOut, reviewsDue = [], onReview, avatarUrl, avatarUploading, onChangeAvatar, onRemoveAvatar }) {
  const first = (name || "").trim().split(/\s+/)[0];
  const links = [
    { label: "Mina uppgifter", onClick: onAccount },
    { label: "Sparade leverantörer", onClick: onSaved },
    { label: "Hjälp & kontakt", onClick: onSupport },
    { label: hasVendor ? "Min leverantörsportal" : "Bli leverantör", onClick: onVendor },
    ...(isAdmin ? [{ label: "Admin", onClick: onAdmin }] : []),
  ];
  return (
    <div className="mx-auto max-w-3xl px-6 pt-8 sm:px-10">
      <div className="flex items-center gap-4">
        <AvatarPicker url={avatarUrl} initial={(first || email || "?").charAt(0).toUpperCase()} size={64} uploading={avatarUploading} onPick={onChangeAvatar} />
        <span className="min-w-0">
          <h1 className="truncate text-3xl" style={{ fontFamily: serif, fontWeight: 700, color: colors.plum }}>Hej{first ? ` ${first}` : ""}!</h1>
          <span className="block truncate text-sm" style={{ color: colors.plumSoft }}>{email}</span>
          {avatarUrl && (
            <button onClick={onRemoveAvatar} className="mt-0.5 text-xs font-semibold underline" style={{ color: colors.coral }}>
              Ta bort profilbild
            </button>
          )}
        </span>
      </div>
      {reviewsDue.length > 0 && (
        <div className="mt-5">
          <ReviewPrompt due={reviewsDue} onReview={onReview} />
        </div>
      )}
      <div className="mt-5 overflow-hidden" style={{ backgroundColor: colors.white, border: `1px solid ${colors.beige}`, borderRadius: 20 }}>
        {links.map((l, i) => (
          <button key={l.label} onClick={l.onClick} className="flex w-full items-center justify-between px-4 text-left text-[15px]" style={{ minHeight: 52, color: colors.plum, borderTop: i ? `1px solid ${colors.cream}` : "none" }}>
            {l.label}
            <ChevronRight size={18} color={colors.plumSoft} />
          </button>
        ))}
        <button onClick={onSignOut} className="flex w-full items-center px-4 text-left text-[15px] font-semibold" style={{ minHeight: 52, color: colors.coral, borderTop: `1px solid ${colors.cream}` }}>
          Logga ut
        </button>
      </div>
    </div>
  );
}

function PlanningView({ session, events, activeEventId, onSelectEvent, onCreateEvent, onUpdateEvent, onDeleteEvent, taskApi, budgetApi, guestApi, bookings, savedProviders, onViewProvider, party, onLogin, onSignup, cart = [], cartTotal = 0, onOpenCart, onExploreCategory, createRequest = 0, vendorStatus = [], providers = [], onOpenConversation, onGoBookings }) {
  const [tab, setTab] = useState("vendors");
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
  useEffect(() => {
    if (createRequest && session) setModal("create");
  }, [createRequest]); // eslint-disable-line react-hooks/exhaustive-deps
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

  const board = session ? (
    <VendorStatusBoard
      ev={ev}
      statuses={vendorStatus}
      bookings={bookings}
      cart={cart}
      cartTotal={cartTotal}
      multipleEvents={events.length > 1}
      providers={providers}
      categories={party.categories || []}
      onOpenConversation={onOpenConversation}
      onOpenCart={onOpenCart}
      onExploreCategory={onExploreCategory}
      onGoBookings={onGoBookings}
    />
  ) : (
    <MinFestBoard cart={cart} categories={party.categories || []} total={cartTotal} onOpenCart={onOpenCart} onExploreCategory={onExploreCategory} />
  );
  if (!session) {
    return (
      <div className="mx-auto max-w-3xl px-5 pb-24 pt-8 sm:px-8">
        <h1 className="text-3xl sm:text-4xl" style={{ fontFamily: serif, fontWeight: 700, color: colors.plum }}>Mina event</h1>
        {board}
      <div className="mx-auto mt-10 max-w-xl text-center">
        <h2 style={{ fontFamily: serif, fontSize: 26, color: colors.plum }}>Planera hela eventet</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
          Spara dina event, bocka av en checklista, håll koll på budgeten, skriv anteckningar och samla leverantörerna du gillar. Allt med ett gratis konto.
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
      <div className="mx-auto max-w-3xl px-5 pb-24 pt-8 sm:px-8">
        <h1 className="text-3xl sm:text-4xl" style={{ fontFamily: serif, fontWeight: 700, color: colors.plum }}>Mina event</h1>
        {board}
      <div className="mx-auto mt-10 max-w-xl text-center">
        <h2 style={{ fontFamily: serif, fontSize: 26, color: colors.plum }}>Skapa ditt event</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
          Skapa ditt första event, så får du checklista, budget och anteckningsblock på ett ställe.
        </p>
        <button onClick={() => setModal("create")} className="mt-6 rounded-full px-6 py-3 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
          Skapa mitt första event
        </button>
        {savedProviders.length > 0 && (
          <p className="mt-4 text-xs" style={{ color: colors.plumSoft }}>
            Du har {savedProviders.length} sparade leverantörer. De hittar du här när eventet är skapat.
          </p>
        )}
        {createModal}
      </div>
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
    { id: "vendors", label: "Leverantörer", icon: PartyPopper, count: buildVendorRows({ ev, statuses: vendorStatus, bookings, cart, multipleEvents: events.length > 1 }).length },
    { id: "checklist", label: "Checklista", icon: ListChecks, count: open.length },
    { id: "budget", label: "Budget", icon: Wallet },
    { id: "guests", label: "Gäster", icon: Users, count: ev.guestList.length },
    { id: "notes", label: "Anteckningar", icon: StickyNote },
    { id: "saved", label: "Sparade", icon: Heart, count: savedProviders.length },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 pb-28 pt-8 sm:px-10">
      <h1 className="mb-3 text-3xl sm:text-4xl" style={{ fontFamily: serif, fontWeight: 700, color: colors.plum }}>Mina event</h1>

      <div className="mb-4">
        <EventSwitcher events={events} activeId={ev.id} onSelect={onSelectEvent} onNew={() => setModal("create")} label={null} />
      </div>

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
                <Plus size={12} /> Nytt event
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

      {tab === "vendors" && board}

      {tab === "checklist" && (
        <div className="mt-5">
          <div className="flex items-end justify-between">
            <p style={{ fontFamily: hand, fontSize: 24, color: colors.plum }}>{totalCount === 0 ? "ingenting att göra än" : `${doneCount} av ${totalCount} klara`}</p>
            {totalCount > 0 && <span className="text-xs" style={{ color: colors.plumSoft }}>{pct}%</span>}
          </div>
          {totalCount > 0 && (
            <div className="mt-1 h-2 overflow-hidden rounded-full" style={{ backgroundColor: colors.beige }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors.korall, transition: "width 0.4s ease" }} />
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
              type="text"
              inputMode="numeric"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value.replace(/[^0-9 ]/g, ""))}
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
              Leverantörer du bokar till det här eventet dyker upp här automatiskt, med pris och status.
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
// Shown right after a request is sent: the same request can go to a few more vendors in one tap, so the customer
// gets several quotes to compare without filling anything in again.
function AskMoreSheet({ state, onSend, onOpenChat, onShowStatus, onClose }) {
  const [picked, setPicked] = useState(() => new Set(state.suggestions.slice(0, 2).map((p) => p.id)));
  const [sending, setSending] = useState(false);
  const cat = catMap[state.provider.category]?.label?.toLowerCase() || "leverantörer";
  const when = state.brief.party?.date ? formatEventDate(state.brief.party.date) : "";
  const toggle = (id) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const send = async () => {
    setSending(true);
    await onSend(state.suggestions.filter((p) => picked.has(p.id)));
    setSending(false);
  };
  const done = state.sent !== null && state.sent !== undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ backgroundColor: "rgba(74,21,56,0.45)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl px-5 pb-6 pt-5 sm:rounded-3xl" style={{ backgroundColor: colors.cream }} onClick={(e) => e.stopPropagation()}>
        {done ? (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: colors.greenSoft }}>
              <Check size={22} color={colors.green} />
            </span>
            <p className="mt-3" style={{ fontFamily: serif, fontWeight: 700, fontSize: 22, color: colors.plum }}>
              Skickat till {state.sent + 1} {state.sent + 1 === 1 ? "leverantör" : "leverantörer"}
            </p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
              Du ser vem som har svarat och vilka offerter som är klara under Mina event → Leverantörer. Vi mejlar dig också när någon svarar.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button onClick={onShowStatus} className="h-12 rounded-full text-[15px] font-bold" style={{ backgroundColor: colors.coral, color: colors.white }}>
                Visa mina leverantörer
              </button>
              <button onClick={onOpenChat} className="h-12 rounded-full text-sm font-semibold" style={{ border: `1.5px solid ${colors.beige}`, backgroundColor: colors.white, color: colors.plum }}>
                Öppna chatten med {state.provider.name}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: colors.green }}>
              <Check size={16} /> Förfrågan skickad till {state.provider.name}
            </p>
            <p className="mt-2" style={{ fontFamily: serif, fontWeight: 700, fontSize: 22, lineHeight: 1.2, color: colors.plum }}>
              Vill du jämföra offerter?
            </p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
              Skicka samma förfrågan till fler inom {cat}{when ? ` som är lediga ${when}` : ""}. Du behöver inte fylla i något igen.
            </p>
            <div className="mt-4 space-y-2">
              {state.suggestions.map((p) => {
                const on = picked.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    aria-pressed={on}
                    className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left"
                    style={{ backgroundColor: colors.white, border: `1.5px solid ${on ? colors.coral : colors.beige}` }}
                  >
                    <img src={p.image} alt="" className="h-12 w-12 flex-shrink-0 rounded-full object-cover" style={{ backgroundColor: colors.coralSoft }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold" style={{ color: colors.plum }}>{p.name}</span>
                      <span className="block text-xs" style={{ color: colors.plumSoft }}>
                        {p.fromPrice > 0 ? `från ${formatKr(p.fromPrice)}` : "Pris i offerten"}
                        {p.location ? ` · ${p.location}` : ""}
                      </span>
                    </span>
                    <span
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: on ? colors.coral : colors.white, border: `1.5px solid ${on ? colors.coral : colors.beige}` }}
                    >
                      {on && <Check size={14} color={colors.white} />}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={send}
                disabled={picked.size === 0 || sending}
                className="h-12 rounded-full text-[15px] font-bold"
                style={{ backgroundColor: colors.coral, color: colors.white, opacity: picked.size === 0 || sending ? 0.5 : 1 }}
              >
                {sending ? "Skickar..." : picked.size === 0 ? "Välj minst en" : `Skicka till ${picked.size} till`}
              </button>
              <button onClick={onOpenChat} className="h-11 rounded-full text-sm font-semibold" style={{ color: colors.plumSoft }}>
                Nej tack, öppna chatten
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RequestFormModal({ provider, party, onUpdateParty, onSend, onClose }) {
  const fields = provider.request.fields;
  const [answers, setAnswers] = useState({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const fieldStyle = { border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white };
  const closed = !!party.date && provider.closedDates?.includes(party.date);
  const busy = !closed && isBusyAt(provider, party);
  const setAnswer = (id, v) => setAnswers((a) => ({ ...a, [id]: v }));
  const toggleMulti = (id, label) => setAnswers((a) => ({ ...a, [id]: (a[id] || []).includes(label) ? a[id].filter((x) => x !== label) : [...(a[id] || []), label] }));
  const isEmpty = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
  const missing = fields.some((f) => f.required && isEmpty(answers[f.id]));
  const canSend = !!party.date && !closed && !busy && !missing && !sending;

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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ backgroundColor: "rgba(74,21,56,0.45)" }} onClick={onClose}>
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
          {busy && (
            <p className="mt-1 text-xs" style={{ color: colors.coralDeep }}>
              Leverantören är redan bokad {busyOnDate(provider, party.date).map((sl) => `${hhmm(sl.start)}–${hhmm(sl.end)}`).join(", ")} det datumet. Välj en annan tid eller ett annat datum.
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
      ...(categoryId === "tarta" && form?.direct !== true ? { direct: false } : {}),
    });
  const setOption = (i, k, patch) => setField(i, { options: fields[i].options.map((o, j) => (j === k ? { ...o, ...patch } : o)) });

  return (
    <section className="mb-6 rounded-3xl p-6" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
      <h2 className="mb-1" style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>
        Frågor till kunden: {catMap[categoryId]?.label}
      </h2>
      <p className="mb-4 text-sm" style={{ color: colors.plumSoft }}>
        Det här är frågorna kunden svarar på när de skickar en förfrågan till er. Ni kan lägga till egna frågor och ändra dem, eller använda våra färdiga.
      </p>

      {fields.length === 0 && (
        <div className="mb-4 rounded-2xl p-4 text-sm" style={{ backgroundColor: colors.lilacSoft, color: colors.plum }}>
          <p>
            Just nu får kunden en enda fråga: <strong>"Berätta vad du behöver"</strong>. Det räcker bra. Vill ni ha färdiga frågor som passar er bransch kan ni använda dem.
          </p>
          <button onClick={useTemplate} className="mt-3 rounded-full px-4 py-2 text-sm font-semibold" style={{ backgroundColor: colors.coral, color: colors.white }}>
            Använd färdiga frågor
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
                placeholder="Fråga till kunden, t.ex. Hur många gäster?"
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
                <input type="checkbox" checked={!!f.required} onChange={(e) => setField(i, { required: e.target.checked })} /> Måste besvaras
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
                      placeholder="Extra kr"
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
          Lägg till egen fråga
        </button>
        {fields.length > 0 && (
          <button onClick={useTemplate} className="text-xs font-medium underline" style={{ color: colors.plumSoft }}>
            Återställ till färdiga frågor
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

// What the customer picked in a booked package, as saved when they booked.
function PackageDetails({ name, details }) {
  if (!name && !details) return null;
  const groups = (details?.groups || []).filter((g) => (g.picked || []).length);
  const adds = details?.addons || [];
  const qty = details?.unit === "per_unit" ? `${details.quantity} ${String(details.unit_label || "st").replace(/^per\s+/i, "")}` : "";
  return (
    <div className="mt-3 rounded-xl p-3 text-sm" style={{ backgroundColor: colors.white, color: colors.plum }}>
      {name && (
        <p className="font-semibold">
          {name}
          {qty ? ` · ${qty}` : ""}
        </p>
      )}
      {groups.map((g, i) => (
        <p key={i} className="mt-1">
          <span style={{ color: colors.plumSoft }}>{g.label}:</span> {g.picked.join(", ")}
        </p>
      ))}
      {adds.length > 0 && (
        <p className="mt-1">
          <span style={{ color: colors.plumSoft }}>Tillägg:</span> {adds.map((a) => a.name).join(", ")}
        </p>
      )}
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
                        {occasionInfo ? `${occasionInfo.emoji} ${occasionInfo.boardLabel}` : "Kundens event"}
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
                  <PackageDetails name={i.packageName} details={i.packageDetails} />
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
                      Bekräfta
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
                <div key={`b-${i}`} className="rounded-xl p-3 text-sm" style={{ backgroundColor: colors.greenSoft }}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2" style={{ color: colors.plum }}>
                      <Check size={14} color={colors.green} /> {e.date}, {e.startTime}–{e.endTime}
                    </span>
                    <span style={{ color: colors.plumSoft }}>{formatKr(e.item.price)}</span>
                  </div>
                  <PackageDetails name={e.item.packageName} details={e.item.packageDetails} />
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

const ADMIN_BOOKING_STATUS = { pending: "Väntar på svar", confirmed: "Bekräftad", declined: "Nekad", completed: "Genomförd", cancelled: "Avbokad" };

// Small helper for the admin tabs: loads a list from the database as the signed-in admin.
function useAdminList(path, token, reloadKey = 0) {
  const [state, setState] = useState({ loading: true, error: "", rows: [] });
  useEffect(() => {
    let cancelled = false;
    setState((st) => ({ ...st, loading: true, error: "" }));
    supabaseRestRequest(path, token).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !Array.isArray(data)) setState({ loading: false, error: error?.message || "Kunde inte hämta listan.", rows: [] });
      else setState({ loading: false, error: "", rows: data });
    });
    return () => {
      cancelled = true;
    };
  }, [path, token, reloadKey]);
  return state;
}

function AdminListShell({ state, empty, children }) {
  if (state.loading) return <p className="py-10 text-center text-sm" style={{ color: colors.plumSoft }}>Hämtar…</p>;
  if (state.error) return <p className="py-10 text-center text-sm" style={{ color: colors.coralDeep }}>{state.error}</p>;
  if (state.rows.length === 0) return <p className="py-10 text-center text-sm" style={{ color: colors.plumSoft }}>{empty}</p>;
  return children;
}

function AdminBookingsTab({ token, vendorApplications }) {
  const [onlyUpcoming, setOnlyUpcoming] = useState(true);
  const bookings = useAdminList("/bookings?select=*,booking_items(*)&order=date.desc&limit=300", token);
  const profiles = useAdminList("/profiles?select=id,full_name", token);
  const nameOf = (id) => profiles.rows.find((p) => p.id === id)?.full_name;
  const vendorName = (id) => vendorApplications.find((v) => v.id === id)?.companyName || "Okänd leverantör";
  const today = todayStr();
  const rows = bookings.rows.filter((b) => !onlyUpcoming || (b.date >= today && !b.cancelled));
  return (
    <div>
      <div className="mt-5 flex gap-2">
        {[
          { v: true, label: "Kommande" },
          { v: false, label: "Alla" },
        ].map((o) => (
          <button
            key={String(o.v)}
            onClick={() => setOnlyUpcoming(o.v)}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              border: `1px solid ${onlyUpcoming === o.v ? colors.coral : colors.beige}`,
              backgroundColor: onlyUpcoming === o.v ? colors.coralSoft : colors.white,
              color: onlyUpcoming === o.v ? colors.coralDeep : colors.plumSoft,
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        <AdminListShell state={{ ...bookings, rows }} empty="Inga bokningar här än.">
          {rows.map((b) => {
            const total = (b.booking_items || []).filter((i) => i.status !== "declined" && i.status !== "cancelled").reduce((sum, i) => sum + (Number(i.price) || 0), 0);
            return (
              <div key={b.id} className="rounded-2xl p-4" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold" style={{ color: colors.plum }}>
                    {b.booking_number} · {b.date}
                    {b.start_time ? `, ${hhmm(b.start_time)}–${hhmm(b.end_time)}` : ""}
                  </p>
                  <p className="text-xs" style={{ color: colors.plumSoft }}>
                    {b.cancelled ? "Avbokad" : b.completed ? "Genomförd" : !b.released_at && !b.customer_id ? "Gäst, väntar på e-postbekräftelse" : "Aktiv"}
                  </p>
                </div>
                <p className="mt-0.5 text-xs" style={{ color: colors.plumSoft }}>
                  {b.customer_id ? nameOf(b.customer_id) || "Kund" : "Gästbokning"} · {b.guests} gäster{b.occasion ? ` · ${b.occasion}` : ""} · Totalt {formatKr(total)}
                </p>
                <ul className="mt-2 space-y-1">
                  {(b.booking_items || []).map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: colors.plum }}>
                      <span>
                        {i.name} <span style={{ color: colors.plumSoft }}>· {i.vendor_id ? vendorName(i.vendor_id) : "Raderad leverantör"}</span>
                      </span>
                      <span className="text-xs" style={{ color: colors.plumSoft }}>
                        {formatKr(Number(i.price) || 0)} · {ADMIN_BOOKING_STATUS[i.status] || i.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </AdminListShell>
      </div>
    </div>
  );
}

function AdminSupportTab({ token }) {
  const msgs = useAdminList("/support_messages?select=*&order=created_at.desc&limit=200", token);
  return (
    <div className="mt-5 space-y-3">
      <AdminListShell state={msgs} empty="Inga supportmeddelanden.">
        {msgs.rows.map((m) => (
          <div key={m.id} className="rounded-2xl p-4" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold" style={{ color: colors.plum }}>{m.subject || "(utan ämne)"}</p>
              <p className="text-xs" style={{ color: colors.plumSoft }}>{formatAppliedAt(m.created_at)}</p>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm" style={{ color: colors.plum }}>{m.message}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs" style={{ color: colors.plumSoft }}>
              <span>{m.email || "Ingen e-post angiven"}</span>
              {m.email && (
                <a
                  href={`mailto:${m.email}?subject=${encodeURIComponent("Re: " + (m.subject || "Ditt meddelande till Planifest"))}`}
                  className="font-semibold underline"
                  style={{ color: colors.lilacDeep }}
                >
                  Svara
                </a>
              )}
            </div>
          </div>
        ))}
      </AdminListShell>
    </div>
  );
}

function AdminReviewsTab({ token, vendorApplications, onShowToast }) {
  const [reload, setReload] = useState(0);
  const reviews = useAdminList("/reviews?select=*&order=created_at.desc&limit=200", token, reload);
  const vendorName = (id) => vendorApplications.find((v) => v.id === id)?.companyName || "Okänd leverantör";
  const remove = async (id) => {
    if (!window.confirm("Ta bort den här recensionen? Det går inte att ångra.")) return;
    const { error } = await supabaseRestRequest(`/reviews?id=eq.${id}`, token, { method: "DELETE" });
    if (error) onShowToast("Kunde inte ta bort recensionen.");
    else {
      onShowToast("Recensionen är borttagen");
      setReload((n) => n + 1);
    }
  };
  return (
    <div className="mt-5 space-y-3">
      <AdminListShell state={reviews} empty="Inga recensioner än.">
        {reviews.rows.map((r) => (
          <div key={r.id} className="rounded-2xl p-4" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold" style={{ color: colors.plum }}>
                {vendorName(r.vendor_id)} · {"★".repeat(r.stars || 0)}
                <span style={{ color: colors.beige }}>{"★".repeat(Math.max(0, 5 - (r.stars || 0)))}</span>
              </p>
              <p className="text-xs" style={{ color: colors.plumSoft }}>{formatAppliedAt(r.created_at)}</p>
            </div>
            {r.text && <p className="mt-1 whitespace-pre-wrap text-sm" style={{ color: colors.plum }}>{r.text}</p>}
            <button onClick={() => remove(r.id)} className="mt-2 text-xs font-semibold underline" style={{ color: colors.coralDeep }}>
              Ta bort recensionen
            </button>
          </div>
        ))}
      </AdminListShell>
    </div>
  );
}

function AdminDashboardView({ vendorApplications, filter, onFilterChange, onOpenVendor, token, onShowToast }) {
  const [tab, setTab] = useState("vendors");
  const tabs = [
    { id: "vendors", label: "Leverantörer" },
    { id: "bookings", label: "Bokningar" },
    { id: "support", label: "Support" },
    { id: "reviews", label: "Recensioner" },
  ];
  return (
    <div>
      <div className="mx-auto max-w-4xl px-6 pt-10 sm:px-10">
        <h1 style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>Admin</h1>
        <div className="mt-4 flex flex-wrap gap-2 border-b pb-3" style={{ borderColor: colors.beige }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="rounded-full px-4 py-2 text-sm font-semibold"
              style={{ backgroundColor: tab === t.id ? colors.coral : colors.white, color: tab === t.id ? colors.white : colors.plum, border: `1.5px solid ${tab === t.id ? colors.coral : colors.beige}` }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "vendors" && <AdminVendorsList vendorApplications={vendorApplications} filter={filter} onFilterChange={onFilterChange} onOpenVendor={onOpenVendor} />}
      {tab !== "vendors" && (
        <div className="mx-auto max-w-4xl px-6 pb-24 sm:px-10">
          {tab === "bookings" && <AdminBookingsTab token={token} vendorApplications={vendorApplications} />}
          {tab === "support" && <AdminSupportTab token={token} />}
          {tab === "reviews" && <AdminReviewsTab token={token} vendorApplications={vendorApplications} onShowToast={onShowToast} />}
        </div>
      )}
    </div>
  );
}

function AdminVendorsList({ vendorApplications, filter, onFilterChange, onOpenVendor }) {
  const filters = [
    { id: "all", label: "Alla" },
    { id: "pending", label: "Väntar på granskning" },
    { id: "approved", label: "Godkända" },
    { id: "rejected", label: "Avslagna" },
  ];
  const filtered = filter === "all" ? vendorApplications : vendorApplications.filter((v) => v.status === filter);

  return (
    <div className="mx-auto max-w-4xl px-6 pb-24 pt-10 sm:px-10">
      <div className="flex flex-wrap gap-2">
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
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  useEffect(() => {
    setRejecting(false);
    setReason("");
  }, [vendor?.id]);
  if (!vendor) return null;
  const isSuspend = vendor.status === "approved";
  const fmtStamp = (iso) => (iso ? new Date(iso).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
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
      {vendor.rejectionReason && (
        <div className="mb-5 rounded-3xl p-4" style={{ backgroundColor: vendor.status === "pending" ? colors.lilacSoft : colors.coralSoft }}>
          <p className="text-sm font-semibold" style={{ color: colors.plum }}>
            {vendor.status === "pending" && vendor.resubmittedAt
              ? `Ändrad och skickad igen ${fmtStamp(vendor.resubmittedAt)}. Ditt förra avslag:`
              : "Anledning som leverantören ser:"}
          </p>
          <p className="mt-1 whitespace-pre-line text-sm" style={{ color: colors.plum }}>{vendor.rejectionReason}</p>
        </div>
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
                    {s.price ? formatKr(Number(s.price)) : "Enligt överenskommelse"}
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

      {rejecting && (
        <div className="mt-6 rounded-3xl p-5" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.coral}` }}>
          <label htmlFor="reject-reason" className="font-semibold" style={{ color: colors.plum }}>
            {isSuspend ? "Varför stängs leverantören av?" : "Varför avslås ansökan?"}
          </label>
          <p className="mt-1 text-sm" style={{ color: colors.plumSoft }}>
            Visas för leverantören i portalen och i mejlet, så skriv vad de behöver ändra.
            {isSuspend ? " Profilen försvinner direkt för kunder. Redan bekräftade bokningar påverkas inte." : ""}
          </p>
          <textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            rows={4}
            autoFocus
            placeholder="T.ex. Lägg till minst tre bilder på era tjänster och fyll i priser, så tittar vi på ansökan igen."
            className="mt-3 w-full rounded-2xl px-4 py-3 text-sm outline-none"
            style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.cream }}
          />
          <p className="mt-1 text-right text-xs" style={{ color: colors.plumSoft }}>{reason.length}/500</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => {
                setRejecting(false);
                setReason("");
              }}
              className="flex-1 rounded-full px-5 py-3 text-sm font-semibold"
              style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }}
            >
              Avbryt
            </button>
            <button
              onClick={() => onReject(vendor.id, reason)}
              disabled={!reason.trim()}
              className="flex-1 rounded-full px-5 py-3 text-sm font-semibold"
              style={{ backgroundColor: colors.coral, color: colors.white, opacity: reason.trim() ? 1 : 0.5 }}
            >
              {isSuspend ? "Stäng av och skicka besked" : "Avslå och skicka besked"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {vendor.status !== "rejected" && !rejecting && (
          <button
            onClick={() => setRejecting(true)}
            className="flex-1 rounded-full px-5 py-3 text-sm font-semibold"
            style={{ border: `1.5px solid ${colors.coral}`, color: colors.coralDeep, backgroundColor: colors.white }}
          >
            {isSuspend ? "Stäng av leverantör" : "Avslå ansökan"}
          </button>
        )}
        {vendor.status !== "approved" && !rejecting && (
          <button onClick={() => onApprove(vendor.id)} className="flex-1 rounded-full px-5 py-3 text-sm font-semibold" style={{ backgroundColor: colors.green, color: colors.white }}>
            {vendor.status === "rejected" ? "Godkänn igen" : "Godkänn leverantör"}
          </button>
        )}
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
const LEGAL_LAST_UPDATED = "15 oktober 2026";

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
      "Kund: namn, e-postadress, telefonnummer, uppgifter om ditt event (datum, tid, antal gäster, typ av tillställning), vilka leverantörer du bokar och – om du själv väljer att lägga upp en – din profilbild.",
      "Leverantör: företagsnamn, organisationsnummer, kontaktperson, e-post, telefonnummer, verksamhetsområde, bilder, stories (bilder och videor) samt beskrivningar av tjänster och priser.",
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
      "Har du laddat upp en profilbild visas den för de leverantörer du skickar meddelanden eller bokningsförfrågningar till. Du kan byta eller ta bort bilden när du vill.",
      "När betalning införs på plattformen kommer nödvändiga uppgifter att delas med vår betaltjänstleverantör.",
      "Vi säljer aldrig dina uppgifter till tredje part för marknadsföringsändamål.",
    ],
  },
  {
    heading: "5. Hur länge sparar vi dina uppgifter?",
    paragraphs: [
      "Vi sparar dina uppgifter så länge det behövs för ändamålen ovan, eller så länge lagen kräver — till exempel kräver bokföringslagen att räkenskapsinformation sparas i sju år. Kontouppgifter raderas eller anonymiseras på begäran, om vi inte är skyldiga att spara dem enligt lag.",
      "Stories som leverantörer lägger upp visas i 24 timmar och raderas därefter automatiskt, om leverantören inte har sparat dem i en höjdpunkt på sin profil.",
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

// Sätts till true först när Stripe-betalningen är byggd, testad och live.
// Styr texterna i kassan och i villkoren så att sidan aldrig lovar betalning som inte finns.
const PAYMENTS_LIVE = false;

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
      ...(PAYMENTS_LIVE ? [] : ["Betalning via Planifest är inte aktiverat än. Tills vidare sker ingen betalning på webbplatsen, och reglerna nedan om betalning och avbokning börjar gälla när betalningen aktiveras."]),
      "Priser anges av Leverantören och visas inklusive eventuella tillägg innan bokning bekräftas.",
      "Betalning sker via Planifest och vår betalpartner Stripe. När Leverantören har bekräftat bokningen betalar Kunden en deposition på 15 % av totalbeloppet. Resterande belopp betalas senast 14 dagar före eventet. Bokas ett event med mindre än 14 dagar kvar betalar Kunden hela beloppet direkt.",
      "Planifest tar emot betalningen och betalar ut den till Leverantören 48 timmar efter att eventet ägt rum, med avdrag för Planifests provision. Planifest står själv för betalpartnerns avgifter, så Kunden betalar aldrig extra avgift för betalningen.",
    ],
  },
  {
    heading: "5. Kundens avbokning",
    paragraphs: [
      "Samma avbokningsregler gäller för alla Leverantörer. Hur mycket Kunden får tillbaka beror på hur många dagar som återstår till eventet när avbokningen görs:",
    ],
    bullets: [
      "Mer än 14 dagar före eventet: Kunden får tillbaka allt som betalats, inklusive depositionen.",
      "14 till 7 dagar före eventet: Leverantören behåller depositionen (15 %). Kunden får tillbaka resten.",
      "6 till 1 dag före eventet: Leverantören får 50 % av totalbeloppet. Kunden får tillbaka resten.",
      "Samma dag som eventet: Leverantören får 100 % av totalbeloppet.",
    ],
    after: [
      "Kund och Leverantör kan också komma överens om en avbokning via chatten på Planifest. Då bestämmer de tillsammans hur mycket som betalas tillbaka.",
      "Återbetalningar görs till det betalsätt som användes vid betalningen.",
    ],
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
      "Leverantören godkänner att Planifest tar en provision på 10 % av den del av beloppet som tillfaller Leverantören. Det gäller även vid avbokning. Provisionen dras vid utbetalning, och Leverantören betalar ingen avgift för betalningen i övrigt.",
      "För att få utbetalningar behöver Leverantören koppla ett utbetalningskonto via Planifests betalpartner Stripe.",
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
      "Avbokar Leverantören eller ställer in en bokning får Kunden alltid tillbaka allt som betalats, oavsett när avbokningen sker. Planifest föreslår lediga Leverantörer i samma kategori som Kunden kan välja bland.",
      "En sen avbokning registreras som en varning på Leverantörens konto. Avbokningar som beror på samma händelse eller orsak, inom en kort tidsperiod, räknas som en varning. Planifest avgör vad som räknas som samma orsak.",
      "Upprepade sena avbokningar kan leda till att kontot stängs av från Planifest.",
      "Vid upprepade sena avbokningar kan en avgift motsvarande provisionen komma att dras från Leverantörens nästa utbetalning.",
    ],
  },
  {
    heading: "9. Immateriella rättigheter",
    paragraphs: ["Allt innehåll på Planifest (varumärke, design och texter som tillhör Planifest) ägs av Planifest eller våra licensgivare. Leverantörer behåller rättigheterna till sina egna bilder och texter men ger Planifest rätt att visa dem på plattformen."],
  },
  {
    heading: "10. Ansvarsbegränsning",
    paragraphs: ["Planifest ansvarar inte för Leverantörens utförande av bokade tjänster eller för skador i samband med ett event. Planifests ansvar är i alla händelser begränsat till den provision som Planifest erhållit för den aktuella bokningen."],
  },
  {
    heading: "11. Reklamation och tvist",
    paragraphs: ["Klagomål på en utförd tjänst riktas i första hand till Leverantören. Kan tvisten inte lösas kan Kund vända sig till Allmänna reklamationsnämnden (ARN) eller allmän domstol. Svensk lag tillämpas."],
  },
  {
    heading: "12. Ändringar av villkoren",
    paragraphs: ["Vi kan komma att ändra dessa villkor. Väsentliga ändringar meddelas via webbplatsen eller e-post i god tid innan de träder i kraft."],
  },
  {
    heading: "13. Kontakt",
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
      "Nödvändiga cookies: krävs för att webbplatsen ska fungera, t.ex. för att komma ihåg vad du har valt att boka under besöket. Kan inte stängas av.",
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
            {s.after?.map((p, i) => (
              <p key={`after-${i}`} className="mt-2 text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
                {p}
              </p>
            ))}
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
    <div className="fixed inset-x-0 bottom-0 z-40 p-4 sm:p-6">
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
              <Wordmark fontSize={28} />
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
              Planifest samlar allt du behöver för ditt event på ett ställe: lokal, catering, DJ, dekor,
              foto och mer. Istället för att leta leverantörer i tio olika flikar och samtal bygger du
              hela ditt event i din egen takt, från första idé till färdig fest, oavsett om det är en
              födelsedag, ett bröllop eller ett företagsevent. Vi startade i Göteborg med en övertygelse
              om att bra event börjar med bra idéer, och att rätt verktyg gör hela skillnaden.
            </p>
            <a
              href="https://www.instagram.com/planifest.se/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex h-8 w-8 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.coralSoft, color: colors.coralDeep }}
              aria-label="Planifest på Instagram"
            >
              <Instagram size={15} />
            </a>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase" style={{ letterSpacing: "0.1em", color: colors.plum }}>
              Utforska
            </h3>
            <ul className="space-y-2 text-sm" style={{ color: colors.plumSoft }}>
              <li>
                <button onClick={onGoHome}>Planera ditt event</button>
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
  const [optOut, setOptOut] = useState({ token: "", loading: false, done: false, error: "" });
  const [guestError, setGuestError] = useState("");
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [guestPendingEmail, setGuestPendingEmail] = useState("");
  const [guestBooking, setGuestBooking] = useState({ loading: false, error: "", data: null, justVerified: false, token: "" });
  const [busyByVendor, setBusyByVendor] = useState({});
  const [busyRefresh, setBusyRefresh] = useState(0);
  const [pollTick, setPollTick] = useState(0); // bumps every 20 s while a vendor view is open, to refresh requests and conversations
  useEffect(() => {
    if (!["vendorDashboard", "vendorBookings", "vendorInbox"].includes(view)) return;
    const id = setInterval(() => {
      if (!document.hidden) setPollTick((t) => t + 1);
    }, 20000);
    return () => clearInterval(id);
  }, [view]);

  // Browser history: every page change is a history entry, so the phone's back swipe and the back button
  // step back through the pages instead of leaving the site.
  const viewFromPopRef = useRef(false);
  const viewNowRef = useRef(view);
  const historyReadyRef = useRef(false);
  useEffect(() => {
    viewNowRef.current = view;
    try {
      if (!historyReadyRef.current) {
        historyReadyRef.current = true; // first load (or a reload): this entry becomes the starting page
        window.history.replaceState({ pv: view }, "", window.location.pathname + window.location.search);
        return;
      }
      if (viewFromPopRef.current) {
        viewFromPopRef.current = false;
        return;
      }
      if (!window.history.state || window.history.state.pv !== view) window.history.pushState({ pv: view }, "", window.location.pathname);
    } catch (e) {
      // history unavailable (rare embedded browsers) — navigation still works, just without the back button
    }
  }, [view]);
  useEffect(() => {
    const onPop = (e) => {
      const target = (e.state && e.state.pv) || "home";
      if (target === viewNowRef.current) return;
      viewFromPopRef.current = true;
      setView(target);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

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
  // The opt-out link in guest mails: ?avanmal=TOKEN (nothing happens until the guest presses the button)
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("avanmal");
    if (!token) return;
    window.history.replaceState(null, "", window.location.pathname);
    setOptOut({ token, loading: false, done: false, error: "" });
    setView("rsvpOptout");
  }, []);
  const confirmOptOut = async () => {
    setOptOut((o) => ({ ...o, loading: true }));
    const { data, error } = await rpcAnon("rsvp_optout", { p_token: optOut.token });
    if (error || !data) setOptOut((o) => ({ ...o, loading: false, error: "Länken fungerar inte. Om du fortfarande får mejl, svara på ett av dem så hjälper vi dig." }));
    else setOptOut((o) => ({ ...o, loading: false, done: true }));
  };
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
  const [vendorCaptchaToken, setVendorCaptchaToken] = useState("");
  const [vendorCaptchaKey, setVendorCaptchaKey] = useState(0);
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

  // --- Where each vendor stands for the customer (Mina event → Leverantörer) ---
  const [vendorStatus, setVendorStatus] = useState([]);
  const [askMore, setAskMore] = useState(null); // { provider, brief, conversationId, suggestions, sent }
  const loadVendorStatus = async () => {
    if (!session?.access_token) return;
    const { data } = await supabaseRestRequest("/rpc/my_vendor_status", session.access_token, { method: "POST", body: "{}" });
    if (Array.isArray(data)) setVendorStatus(data);
  };

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

  // Vendor status for Mina event: loaded with the session, and kept fresh while the planning page is open.
  const inboxSig = inbox.map((c) => `${c.conversation_id}:${c.last_at}`).join(",");
  useEffect(() => {
    if (!session?.access_token) {
      setVendorStatus([]);
      return;
    }
    loadVendorStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, view, inboxSig]);

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

  // A vendor whose application is still under review gets the answer without logging out and in again:
  // her own row is re-read every 15 s (and when she comes back to the tab) until the status changes.
  const ownVendorStatus = vendorApplications.find((v) => v.id === submittedVendorId)?.status;
  useEffect(() => {
    if (!session?.user || ownVendorStatus !== "pending") return;
    let stopped = false;
    const check = () => {
      if (document.hidden || stopped) return;
      fetchVendorByProfileId(session.user.id, session.access_token).then(({ data, error }) => {
        if (stopped || error || !data || !data[0] || data[0].status === "pending") return;
        const local = mapDbVendorToLocal(data[0]);
        setVendorApplications((apps) => apps.map((v) => (v.id === local.id ? local : v)));
        showToast(local.status === "approved" ? "Din ansökan är godkänd! 🎉" : "Din ansökan har fått ett svar");
      });
    };
    const id = setInterval(check, 15000);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, ownVendorStatus]);

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
            packageName: i.package_name || "",
            packageDetails: i.package_details || null,
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
      `/booking_items?vendor_id=eq.${vendorId}&select=*,bookings(id,booking_number,date,start_time,end_time,guests,occasion,cancelled,customer_id,company_name,org_number,invoice_address,invoice_reference)`,
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
            packageName: item.package_name || "",
            packageDetails: item.package_details || null,
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
            next[idx] = { ...next[idx], items: newItems, cancelled: b.cancelled, bookingId: b.id, isGuest: !b.customer_id, company: b.company_name ? { name: b.company_name, org: b.org_number, address: b.invoice_address, reference: b.invoice_reference } : null };
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
              company: b.company_name ? { name: b.company_name, org: b.org_number, address: b.invoice_address, reference: b.invoice_reference } : null,
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
      let dismissed = [];
      try {
        dismissed = JSON.parse(localStorage.getItem("planifest-dismissed-quotes") || "[]");
      } catch (e) {
        dismissed = [];
      }
      const open = q.data.filter((m) => !used.has(m.id) && m.conversations && !dismissed.includes(`quote-${m.id}`));
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

  const requestPasswordReset = async (email, captchaToken) => {
    await supabaseAuthRequest("/recover", { method: "POST", body: JSON.stringify({ email, ...captchaBody(captchaToken) }) });
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

  const signIn = async (email, password, captchaToken) => {
    // A visitor who is simply logging in keeps their cart and search choices (checkout asks them to log in
    // at the last step). Local data is only wiped when an account that was already signed in is replaced.
    if (session?.user) clearLocalUserState();
    const { data, error } = await supabaseAuthRequest("/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password, ...captchaBody(captchaToken) }),
    });
    if (error) return error;
    landOnPortalRef.current = true;
    setSessionPersist(data);
    showToast("Inloggad ✓");
    return null;
  };

  const signUpCustomer = async (email, password, fullName, captchaToken) => {
    if (session?.user) clearLocalUserState();
    const { data, error } = await supabaseAuthRequest("/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, data: { full_name: fullName }, ...captchaBody(captchaToken) }),
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

  // Deleting the account runs on the server (delete-account function): it refuses while bookings are live, then removes everything.
  const deleteMyAccount = async () => {
    if (!session?.access_token) return "Du är inte inloggad.";
    let res;
    try {
      res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ confirm: true }),
      });
    } catch (e) {
      return "Nådde inte servern. Kontrollera din uppkoppling och försök igen.";
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 404) return "Radering av konto är inte tillgängligt just nu. Skriv till info@planifest.se så hjälper vi dig.";
    if (!res.ok || !data.ok) return data.error || "Kontot kunde inte raderas. Försök igen eller skriv till info@planifest.se.";
    setSessionPersist(null);
    clearLocalUserState();
    setCustomerMode(false);
    try {
      localStorage.removeItem("planifest-mode");
    } catch (e) {
      // fine
    }
    showToast("Ditt konto är raderat. Tack för den tid du var med oss.");
    goHome();
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

  // Which hours each vendor is already booked (confirmed bookings only; no names or details), so customers
  // can't pick a taken time. If the database function is missing the list stays empty and nothing breaks.
  const approvedVendorIdsKey = vendorApplications
    .filter((v) => v.status === "approved" && v.id && !String(v.id).startsWith("VND-"))
    .map((v) => v.id)
    .sort()
    .join(",");
  useEffect(() => {
    if (!approvedVendorIdsKey) {
      setBusyByVendor({});
      return;
    }
    let cancelled = false;
    supabaseRestRequest("/rpc/vendor_busy_slots", session?.access_token, {
      method: "POST",
      body: JSON.stringify({ p_vendor_ids: approvedVendorIdsKey.split(",") }),
    }).then(({ data, error }) => {
      if (cancelled || error || !Array.isArray(data)) return;
      const map = {};
      data.forEach((r) => {
        (map[r.vendor_id] = map[r.vendor_id] || []).push({ date: r.date, start: r.start_time, end: r.end_time });
      });
      setBusyByVendor(map);
    });
    return () => {
      cancelled = true;
    };
  }, [approvedVendorIdsKey, session?.access_token, busyRefresh]);

  const customerProviders = useMemo(() => {
    const base = getCustomerVisibleProviders(vendorApplications, customerReviews, bookings, busyByVendor);
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
  }, [vendorApplications, customerReviews, bookings, acceptedQuotes, busyByVendor]);
  const vendorBookingItems = useMemo(() => getVendorBookingItems(submittedVendor, bookings), [submittedVendor, bookings]);

  const cart = cartItems
    .map((ci) => {
      if (ci.pkg) {
        // A package card: the vendor's listing, priced by the chosen package
        const provider = customerProviders.find((p) => p.id === ci.pkg.providerId);
        const pkg = provider?.packages?.find((x) => x.id === ci.pkg.serviceId);
        if (!provider || !pkg) return null;
        return {
          ...provider,
          id: ci.id,
          providerId: provider.id,
          serviceId: pkg.id,
          package: pkg,
          packageName: pkg.name,
          quantity: ci.pkg.quantity || 1,
          choices: ci.pkg.choices || {},
          addons: pkg.addons || [],
          chosenAddons: ci.addons,
          pricing: { type: pkg.priceType, amount: Number(pkg.price) || 0, note: pkg.name, suffix: packageSuffix(pkg) },
          requestOnly: false,
        };
      }
      const provider = customerProviders.find((p) => p.id === ci.id);
      return provider ? { ...provider, chosenAddons: ci.addons } : null;
    })
    .filter(Boolean);
  const total = cart.reduce((sum, p) => sum + getLineTotal(p, p.chosenAddons, party), 0);
  const cartProviderIds = cartItems.map((ci) => (ci.pkg ? ci.pkg.providerId : ci.id));

  const sortWithinCategory = (list) => {
    const sorted = [...list];
    sorted.sort((a, b) => {
      const busyA = isBusyAt(a, party) || !!(party.date && a.closedDates?.includes(party.date));
      const busyB = isBusyAt(b, party) || !!(party.date && b.closedDates?.includes(party.date));
      if (busyA !== busyB) return Number(busyA) - Number(busyB); // vendors taken at the chosen time go last
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
  // Adds (or updates) one package card. Choosing the same package again replaces the earlier choices.
  const addPackageToCart = (provider, pkg, { quantity = 1, choices = {}, addonIds = [] } = {}) => {
    const id = `${provider.id}::${pkg.id}`;
    const entry = { id, addons: addonIds, pkg: { providerId: provider.id, serviceId: pkg.id, quantity, choices } };
    if (swapContext) {
      setCartItems((c) => c.filter((x) => x.id !== swapContext.oldId && x.id !== id).concat(entry));
      setSwapContext(null);
      setView("results");
      setCartOpen(true);
      showToast("Utbytt ✓");
      return;
    }
    const existed = cartItems.some((x) => x.id === id);
    setCartItems((c) => (c.some((x) => x.id === id) ? c.map((x) => (x.id === id ? entry : x)) : [...c, entry]));
    showToast(existed ? "Paketet är uppdaterat ✓" : `${pkg.name || "Paketet"} är tillagt ✓`);
  };
  const removeFromCart = (id) => {
    // A removed accepted quote must not come back into the cart at the next login
    if (String(id).startsWith("quote-")) {
      try {
        const key = "planifest-dismissed-quotes";
        const list = JSON.parse(localStorage.getItem(key) || "[]");
        localStorage.setItem(key, JSON.stringify([...new Set([...list, id])]));
      } catch (e) {
        /* storage unavailable: the quote simply returns next time */
      }
    }
    setCartItems((c) => c.filter((x) => x.id !== id));
  };
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

  // A package that no longer fits (guests or time changed) or lacks a choice can't be booked.
  const cartPackageProblem = () => {
    const bad = cart.find((p) => p.package && (packageMisfit(p.package, party, p.quantity) || packageChoiceProblem(p.package, p.choices)));
    return bad ? `${bad.packageName || bad.name}: ${packageMisfit(bad.package, party, bad.quantity) || packageChoiceProblem(bad.package, bad.choices)}. Ändra paketet i din bokning.` : "";
  };

  const confirmBooking = async (company = null) => {
    if (cart.some((p) => p.isDemo)) {
      showToast(DEMO_NO_BOOKING);
      return;
    }
    const companyFields = company && typeof company === "object" && company.company_name ? company : {};
    const pkgProblem = cartPackageProblem();
    if (pkgProblem) {
      showToast(pkgProblem);
      return;
    }
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
        ...companyFields,
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
      ...(p.package ? { quantity: p.quantity || 1, choices: p.choices || {} } : {}),
    }));
    const { data: itemRows, error: itemsError } = await supabaseRestRequest("/booking_items", session.access_token, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(itemsPayload),
    });
    if (itemsError || !itemRows) {
      // Don't pretend it worked: take the empty booking back and say so.
      await supabaseRestRequest(`/bookings?id=eq.${bookingRow.id}`, session.access_token, { method: "PATCH", body: JSON.stringify({ cancelled: true }) });
      showToast(
        String(itemsError?.message || "").includes("vendor_busy")
          ? "En av leverantörerna hann bli bokad den tiden. Välj en annan tid eller en annan leverantör."
          : String(itemsError?.message || "").includes("package_")
          ? "Ett av paketen passar inte antalet gäster, tiden eller valen. Kontrollera paketen och försök igen."
          : "Bokningen kunde inte slutföras" + (itemsError?.message ? `: ${itemsError.message}` : "") + ". Försök igen."
      );
      setBusyRefresh((n) => n + 1);
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
        packageName: row.package_name || "",
        packageDetails: row.package_details || null,
        category: row.category_id,
        price: row.price,
        status: row.status || "pending",
        reviewed: false,
      })),
    };
    setBookings((b) => [newBooking, ...b]);
    setLastBooking(newBooking);
    setCartItems([]);
    setBusyRefresh((n) => n + 1);
    setView("confirmation");
  };

  // --- Guest booking ---
  const guestBlockReason = cart.some((p) => !p.vendorDbId || !isUuid(p.serviceId) || p.quoteMessageId || p.requestOnly)
    ? "En eller flera leverantörer i din bokning kräver ett konto (till exempel en offert eller en förfrågan). Logga in för att boka."
    : "";

  const submitGuestBooking = async ({ name, email, phone }) => {
    setGuestError("");
    if (cart.some((p) => p.isDemo)) {
      setGuestError(DEMO_NO_BOOKING);
      return;
    }
    const pkgProblem = cartPackageProblem();
    if (pkgProblem) {
      setGuestError(pkgProblem);
      return;
    }
    setGuestSubmitting(true);
    const { error } = await guestRequest({
      action: "create",
      name,
      email,
      phone,
      party: { date: party.date, start: party.startTime, end: party.endTime, guests: Number(party.guests) || 1, occasion: party.occasion || "" },
      items: cart.map((p) => ({ vendor_id: p.vendorDbId, category_id: p.category, name: p.name, service_id: p.serviceId, addon_ids: (p.chosenAddons || []).filter(isUuid), quantity: p.quantity || 1, choices: p.choices || {} })),
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
      failed("spara eventet", error);
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
      failed("ta bort eventet", error);
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
    add: async (eventId, people) => {
      const have = new Set((events.find((e) => e.id === eventId)?.guestList || []).map((g) => g.name.toLowerCase()));
      const rows = [];
      people.forEach((person) => {
        const { name, email } = typeof person === "string" ? { name: person, email: "" } : person;
        if (have.has(name.toLowerCase())) return;
        have.add(name.toLowerCase());
        rows.push({ id: newId(), name: name.slice(0, 100), token: `${newId()}${newId()}`.replace(/-/g, ""), status: "pending", allowedParty: 1, partySize: 1, dietary: "", message: "", source: "host", email: EMAIL_RE.test(email || "") ? email.trim() : "", emailOptout: false, invitedAt: null, lastRemindedAt: null });
      });
      if (rows.length === 0) {
        showToast("Den gästen finns redan i listan");
        return;
      }
      patchEvent(eventId, (e) => ({ ...e, guestList: [...e.guestList, ...rows] }));
      const { error } = await planningDb("/event_guests", { method: "POST", body: JSON.stringify(rows.map((g) => ({ id: g.id, event_id: eventId, name: g.name, token: g.token, email: g.email || null }))) });
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
      if ("email" in next) body.email = next.email || null;
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
    // The host asks Planifest to email invitations or reminders. The database decides who is eligible and enforces the daily ceiling.
    sendEmails: async (eventId, kind, ids) => {
      const { data, error } = await planningDb("/rpc/send_guest_emails", { method: "POST", body: JSON.stringify({ p_event_id: eventId, p_kind: kind, p_guest_ids: ids || null }) });
      if (error) {
        const m = error.message || "";
        return {
          error: m.includes("mail:limit") ? "Max 100 mejl per fest och dygn. Försök igen i morgon." : m.includes("mail:past") ? "Festen har redan varit." : m.includes("mail:closed") ? "Svarstiden har gått ut, så det går inte att påminna längre." : "Kunde inte skicka mejlen. Försök igen.",
        };
      }
      await guestApi.refresh(eventId);
      return { count: Number(data) || 0 };
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
  // Home page: the next upcoming party (or the latest one) and a few well-reviewed vendors.
  const upcomingEvent = useMemo(() => {
    if (!events.length) return null;
    const today = todayStr();
    const ahead = events.filter((e) => e.date && e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    return ahead[0] || events.find((e) => e.id === activeEventId) || events[0];
  }, [events, activeEventId]);
  const popularProviders = useMemo(() => {
    const seen = new Set();
    return customerProviders
      .filter((p) => !p.quoteMessageId && p.image)
      .sort((a, b) => (b.reviews || 0) - (a.reviews || 0) || (Number(b.rating) || 0) - (Number(a.rating) || 0))
      .filter((p) => {
        const key = p.vendorDbId || p.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 4);
  }, [customerProviders]);
  // --- Stories ---
  const [stories, setStories] = useState([]);
  const [seenStories, setSeenStories] = useState(() => readSeenStories());
  const [storyViewer, setStoryViewer] = useState(null); // { groups, index } — a snapshot, so the order stays put while watching
  const [storyUploading, setStoryUploading] = useState(false);
  const [highlights, setHighlights] = useState([]);
  // Returns active stories plus any saved in a highlight (the database only hands out those).
  const loadStories = async () => {
    const [st, hl] = await Promise.all([
      supabaseRestRequest(`/vendor_stories?select=id,vendor_id,media_url,media_type,created_at,expires_at,highlight_id&order=created_at.asc`, session?.access_token),
      supabaseRestRequest(`/vendor_highlights?select=id,vendor_id,title,created_at&order=created_at.asc`, session?.access_token),
    ]);
    if (Array.isArray(st.data)) setStories(st.data);
    if (Array.isArray(hl.data)) setHighlights(hl.data);
  };
  const toStory = (st) => ({ id: st.id, url: st.media_url, type: st.media_type, createdAt: st.created_at, expiresAt: st.expires_at, highlightId: st.highlight_id || null });
  useEffect(() => {
    loadStories();
    const t = setInterval(loadStories, 5 * 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);
  const storyGroups = useMemo(() => {
    const byVendor = new Map();
    const nowMs = Date.now();
    stories.forEach((st) => {
      if (new Date(st.expires_at).getTime() <= nowMs) return; // only live stories in the ring row
      if (!byVendor.has(st.vendor_id)) byVendor.set(st.vendor_id, []);
      byVendor.get(st.vendor_id).push({ id: st.id, url: st.media_url, type: st.media_type, createdAt: st.created_at });
    });
    const groups = [];
    byVendor.forEach((list, vendorId) => {
      const provider = customerProviders.find((p) => p.vendorDbId === vendorId);
      if (!provider) return;
      groups.push({
        key: vendorId,
        vendorId,
        name: provider.name,
        avatar: (provider.images && provider.images[0]) || provider.image || null,
        providerId: provider.id,
        stories: list,
        latest: list[list.length - 1].createdAt,
      });
    });
    return groups.sort((a, b) => {
      const ua = a.stories.some((x) => !seenStories.has(x.id)) ? 1 : 0;
      const ub = b.stories.some((x) => !seenStories.has(x.id)) ? 1 : 0;
      return ub - ua || String(b.latest).localeCompare(String(a.latest));
    });
  }, [stories, customerProviders, seenStories]);
  const myStories = submittedVendor ? stories.filter((st) => st.vendor_id === submittedVendor.id).map(toStory) : [];
  const myHighlights = submittedVendor ? highlights.filter((h) => h.vendor_id === submittedVendor.id) : [];
  // Highlights on a vendor's profile: each one plays like its own story.
  const highlightGroupsFor = (vendorDbId, provider) =>
    highlights
      .filter((h) => h.vendor_id === vendorDbId)
      .map((h) => {
        const list = stories.filter((st) => st.highlight_id === h.id).map(toStory);
        return {
          key: h.id,
          vendorId: vendorDbId,
          name: h.title,
          avatar: (provider?.images && provider.images[0]) || provider?.image || null,
          cover: list[0] || null,
          providerId: null,
          stories: list,
        };
      })
      .filter((g) => g.stories.length > 0);
  const saveStoryToHighlight = async (story, target) => {
    let highlightId = target.id;
    if (!highlightId) {
      const { data, error } = await supabaseRestRequest("/vendor_highlights", session?.access_token, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ vendor_id: submittedVendor.id, title: target.title }),
      });
      if (error || !Array.isArray(data) || !data[0]) {
        showToast("Kunde inte skapa höjdpunkten.");
        return;
      }
      setHighlights((list) => [...list, data[0]]);
      highlightId = data[0].id;
    }
    const { error } = await supabaseRestRequest(`/vendor_stories?id=eq.${story.id}`, session?.access_token, { method: "PATCH", body: JSON.stringify({ highlight_id: highlightId }) });
    if (error) {
      showToast("Kunde inte spara storyn i höjdpunkten.");
      return;
    }
    setStories((list) => list.map((st) => (st.id === story.id ? { ...st, highlight_id: highlightId } : st)));
    showToast("Sparad i höjdpunkten ♥");
  };
  const removeStoryFromHighlight = async (story) => {
    const { error } = await supabaseRestRequest(`/vendor_stories?id=eq.${story.id}`, session?.access_token, { method: "PATCH", body: JSON.stringify({ highlight_id: null }) });
    if (error) {
      showToast("Kunde inte ta ur storyn.");
      return;
    }
    setStories((list) => list.map((st) => (st.id === story.id ? { ...st, highlight_id: null } : st)));
  };
  const deleteHighlight = async (h) => {
    if (!window.confirm(`Ta bort höjdpunkten "${h.title}"? Stories i den som är äldre än 24 timmar försvinner.`)) return;
    const { error } = await supabaseRestRequest(`/vendor_highlights?id=eq.${h.id}`, session?.access_token, { method: "DELETE" });
    if (error) {
      showToast("Kunde inte ta bort höjdpunkten.");
      return;
    }
    setHighlights((list) => list.filter((x) => x.id !== h.id));
    setStories((list) => list.map((st) => (st.highlight_id === h.id ? { ...st, highlight_id: null } : st)));
  };
  const markStorySeen = (id) =>
    setSeenStories((prevSeen) => {
      if (prevSeen.has(id)) return prevSeen;
      const nextSeen = new Set(prevSeen);
      nextSeen.add(id);
      try {
        window.localStorage.setItem(STORY_SEEN_KEY, JSON.stringify([...nextSeen].slice(-500)));
      } catch (e) {
        // fine
      }
      return nextSeen;
    });
  const addStory = async (file) => {
    if (!submittedVendor || submittedVendor.status !== "approved") return;
    setStoryUploading(true);
    const up = await uploadStoryMedia(file, session);
    if (up.error) {
      setStoryUploading(false);
      showToast(up.error);
      return;
    }
    const { data, error } = await supabaseRestRequest("/vendor_stories", session.access_token, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ vendor_id: submittedVendor.id, media_url: up.url, media_type: up.mediaType }),
    });
    setStoryUploading(false);
    if (error || !Array.isArray(data) || !data[0]) {
      deleteStoryFile(up.url, session);
      showToast("Det gick inte att publicera storyn. Försök igen.");
      return;
    }
    setStories((list) => [...list, data[0]]);
    showToast("Din story är publicerad i 24 timmar ✨");
  };
  const removeStory = async (story) => {
    setStories((list) => list.filter((st) => st.id !== story.id));
    const { error } = await supabaseRestRequest(`/vendor_stories?id=eq.${story.id}`, session?.access_token, { method: "DELETE" });
    if (error) {
      showToast("Kunde inte ta bort storyn.");
      loadStories();
      return;
    }
    deleteStoryFile(story.url, session);
    showToast("Storyn är borttagen.");
  };
  const openStory = (index) => setStoryViewer({ groups: storyGroups, index });

  // Quick edits from the vendor overview: profile picture and description, saved straight away.
  const [avatarUploading, setAvatarUploading] = useState(false);
  const patchOwnVendor = (fn) => setVendorApplications((list) => list.map((v) => (v.id === submittedVendor?.id ? fn(v) : v)));
  const changeVendorAvatar = async (file) => {
    if (!submittedVendor || !session?.access_token) return;
    setAvatarUploading(true);
    const up = await uploadVendorImage(file, session);
    if (up.error) {
      setAvatarUploading(false);
      showToast(up.error);
      return;
    }
    const images = [up.url, ...(submittedVendor.profile?.images || [])];
    const { error } = await supabaseRestRequest(`/vendors?id=eq.${submittedVendor.id}`, session.access_token, { method: "PATCH", body: JSON.stringify({ images }) });
    setAvatarUploading(false);
    if (error) {
      deleteVendorImageFile(up.url, session);
      showToast("Kunde inte spara profilbilden. Försök igen.");
      return;
    }
    patchOwnVendor((v) => ({ ...v, profile: { ...v.profile, images } }));
    showToast("Ny profilbild ✓");
  };
  const saveVendorDescription = async (text) => {
    if (!submittedVendor || !session?.access_token) return false;
    const { error } = await supabaseRestRequest(`/vendors?id=eq.${submittedVendor.id}`, session.access_token, { method: "PATCH", body: JSON.stringify({ description: text }) });
    if (error) {
      showToast("Kunde inte spara beskrivningen. Försök igen.");
      return false;
    }
    patchOwnVendor((v) => ({ ...v, profile: { ...v.profile, description: text } }));
    showToast("Beskrivningen är sparad ✓");
    return true;
  };
  // Finished bookings the customer hasn't reviewed yet — shown as a gentle reminder.
  const reviewsDue = bookings
    .filter((b) => b.completed && !b.cancelled)
    .flatMap((b) => b.items.filter((i) => !i.reviewed && (i.status === "confirmed" || i.status === "completed")).map((item) => ({ bookingNumber: b.bookingNumber, item })));

  // --- Several parties at once ---
  // Each party has its own builder answers and its own list of vendors to book. Switching party saves the
  // current one and loads the other; a brand-new party starts from its own date, guests and type.
  const [planningCreateRequest, setPlanningCreateRequest] = useState(0);
  const partyStore = useRef({});
  const prevEventKey = useRef(null);
  useEffect(() => {
    const nextKey = activeEventId || "none";
    const prevKey = prevEventKey.current;
    prevEventKey.current = nextKey;
    if (prevKey === null || prevKey === nextKey) return;
    partyStore.current[prevKey] = { party, cartItems };
    const saved = partyStore.current[nextKey];
    if (saved) {
      setParty(saved.party);
      setCartItems(saved.cartItems);
    } else if (prevKey === "none") {
      // the first party keeps whatever was picked before logging in or creating it, and fills in the
      // event's own date and guests where nothing was picked, so a request never asks for them again
      const evn = events.find((e) => e.id === activeEventId);
      if (evn) setParty((p) => ({ ...p, date: p.date || evn.date || "", guests: evn.guests && !p.date ? evn.guests : p.guests, occasion: p.occasion || evn.eventType || null }));
    } else {
      const evn = events.find((e) => e.id === activeEventId);
      setParty({ ...emptyParty(), date: evn?.date || "", guests: evn?.guests || 50, occasion: evn?.eventType || null });
      setCartItems([]);
    }
    setBookingEventId(undefined);
    setSwapContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEventId]);
  const startNewEvent = () => {
    if (!session) {
      openAuthModal("signup");
      return;
    }
    setView("planning");
    setPlanningCreateRequest((n) => n + 1);
    window.scrollTo(0, 0);
  };

  const [customerAvatarUploading, setCustomerAvatarUploading] = useState(false);
  const changeCustomerAvatar = async (file) => {
    if (!session?.access_token) return;
    setCustomerAvatarUploading(true);
    const up = await uploadAvatar(file, session);
    if (up.error) {
      setCustomerAvatarUploading(false);
      showToast(up.error);
      return;
    }
    const old = profile?.avatar_url;
    const { error } = await supabaseRestRequest(`/profiles?id=eq.${session.user.id}`, session.access_token, { method: "PATCH", body: JSON.stringify({ avatar_url: up.url }) });
    setCustomerAvatarUploading(false);
    if (error) {
      deleteAvatarFile(up.url, session);
      showToast("Kunde inte spara profilbilden. Försök igen.");
      return;
    }
    setProfile((pr) => (pr ? { ...pr, avatar_url: up.url } : pr));
    if (old) deleteAvatarFile(old, session);
    showToast("Ny profilbild ✓");
  };
  const removeCustomerAvatar = async () => {
    const old = profile?.avatar_url;
    if (!old || !session?.access_token) return;
    const { error } = await supabaseRestRequest(`/profiles?id=eq.${session.user.id}`, session.access_token, { method: "PATCH", body: JSON.stringify({ avatar_url: null }) });
    if (error) {
      showToast("Kunde inte ta bort profilbilden.");
      return;
    }
    setProfile((pr) => (pr ? { ...pr, avatar_url: null } : pr));
    deleteAvatarFile(old, session);
    showToast("Profilbilden är borttagen.");
  };

  // Profile pictures of the customers a vendor talks to (the database only hands out those).
  const [customerAvatars, setCustomerAvatars] = useState({});
  const customerIdsKey = [...new Set(vendorConversations.map((c) => c.customer_id).filter(Boolean))].sort().join(",");
  useEffect(() => {
    if (!customerIdsKey || !session?.access_token) return;
    supabaseRestRequest("/rpc/customer_avatars", session.access_token, { method: "POST", body: JSON.stringify({ p_ids: customerIdsKey.split(",") }) }).then(({ data }) => {
      if (Array.isArray(data)) setCustomerAvatars(Object.fromEntries(data.map((r) => [r.id, r.avatar_url])));
    });
  }, [customerIdsKey, session?.access_token]);

  const goBuilder = () => {
    setView("builder");
    setSwapContext(null);
    setMobileMenuOpen(false);
    window.scrollTo(0, 0);
  };
  const goExplore = (categoryId) => {
    setParty((p) => ({ ...p, categories: categoryId ? [categoryId] : [] }));
    setSwapContext(null);
    setView("results");
    setMobileMenuOpen(false);
    window.scrollTo(0, 0);
  };
  const openMessages = () => {
    if (!session) {
      openAuthModal("signin");
      return;
    }
    setPanelOpen((o) => !o);
  };
  const goMinSida = () => {
    if (!session) {
      openAuthModal("signin");
      return;
    }
    goMinaBokningar();
  };
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
    if (provider.isDemo) {
      showToast("Det här är en påhittad exempelleverantör och går inte att kontakta.");
      return;
    }
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

  // Posts one request to one vendor. Returns the conversation id, or null (with an error already shown unless quiet).
  const postBrief = async (provider, brief, quiet = false) => {
    const { data: convo, error } = await findOrCreateConversation({
      vendorId: provider.vendorDbId,
      customerId: session.user.id,
      categoryId: provider.category,
      accessToken: session.access_token,
    });
    if (error || !convo) {
      if (!quiet) showToast("Kunde inte skicka förfrågan just nu");
      return null;
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
      if (!quiet) showToast("Kunde inte skicka förfrågan" + (msgError?.message ? `: ${msgError.message}` : ""));
      return null;
    }
    return convo.id;
  };

  const openRequestChat = async (provider, conversationId) => {
    const { data: msgs } = await supabaseRestRequest(`/messages?conversation_id=eq.${conversationId}&select=*&order=created_at.asc`, session.access_token);
    setRealMessages((m) => ({ ...m, [conversationId]: msgs || [] }));
    setChatTarget({ kind: "provider", provider, real: true, conversationId });
  };

  // Other vendors in the same category who are free at the same time and haven't been asked yet.
  const similarProviders = (provider, brief) => {
    const asked = new Set(vendorStatus.filter((c) => c.category_id === provider.category).map((c) => c.vendor_id));
    const when = { date: brief.party?.date || "", startTime: brief.party?.start || "", endTime: brief.party?.end || "" };
    return customerProviders
      .filter(
        (p) =>
          p.category === provider.category &&
          p.vendorDbId &&
          p.vendorDbId !== provider.vendorDbId &&
          !p.quoteMessageId &&
          !asked.has(p.vendorDbId) &&
          !(when.date && (p.closedDates?.includes(when.date) || isBusyAt(p, when)))
      )
      .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (Number(b.fromPrice) > 0) - (Number(a.fromPrice) > 0))
      .slice(0, 3);
  };

  // A request: the customer answers the vendor's own questions, the vendor replies in the chat and
  // sends a quote with the final price, and accepting that quote is what puts it in Mina event.
  const sendRequest = async (provider, brief) => {
    if (provider.isDemo) {
      showToast("Det här är en påhittad exempelleverantör och går inte att kontakta.");
      return false;
    }
    if (!provider.vendorDbId) {
      showToast("Den här leverantören går inte att kontakta än.");
      return false;
    }
    if (!session?.access_token) {
      openAuthModal("signin");
      showToast("Logga in för att skicka en förfrågan");
      return false;
    }
    const conversationId = await postBrief(provider, brief);
    if (!conversationId) return false;
    loadVendorStatus();
    const suggestions = similarProviders(provider, brief);
    if (suggestions.length > 0) {
      setAskMore({ provider, brief, conversationId, suggestions, sent: null });
    } else {
      await openRequestChat(provider, conversationId);
      showToast("Förfrågan skickad ✓");
    }
    return true;
  };

  // The same request to more vendors at once, so the customer can compare quotes. The first vendor's price
  // estimate is left out: it was worked out from that vendor's prices, not the others'.
  const sendRequestToMore = async (providers) => {
    if (!askMore) return;
    const { rows, party: when } = askMore.brief;
    let sent = 0;
    for (const p of providers) {
      if (await postBrief(p, { rows, party: when }, true)) sent++;
    }
    loadVendorStatus();
    setAskMore((a) => (a ? { ...a, sent } : a));
    if (sent < providers.length) showToast(sent ? `Skickat till ${sent} av ${providers.length}` : "Kunde inte skicka just nu");
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
      showToast("Offert godkänd – redo att boka ✓");
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
    // A starting point for "Det här ingår": the customer's own choices, one per line (questions are left out, answers kept)
    const parts = rows.slice(0, 6).map((r) => {
      const v = [].concat(r.value).join(", ");
      return /\?\s*$/.test(r.label) ? v : `${r.label}: ${v}`;
    });
    const guests = Number(brief.party?.guests) || 0;
    return { amount: Math.round(base + extra), description: [...parts, guests ? `För ${guests} gäster` : ""].filter(Boolean).join("\n").slice(0, 600) };
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

    if (!session?.access_token && TURNSTILE_SITE_KEY && !vendorCaptchaToken) {
      setVendorSubmitError("Bekräfta att du inte är en robot.");
      return;
    }
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
        ...captchaBody(vendorCaptchaToken),
      }),
    });
    setVendorSubmitting(false);
    setVendorCaptchaToken("");
    setVendorCaptchaKey((k) => k + 1);

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
      const res = await saveVendorProfile(submittedVendor, session.access_token);
      if (res?.error) {
        showToast("Kunde inte spara: " + (res.error.message || "kontrollera paketen och försök igen"));
        return;
      }
      applySavedIds(res?.idMap);
      showToast("Sparat ✓");
    }
    setView(nextView);
  };
  // New packages get their permanent ids when saved; keep the editor in step with them.
  const applySavedIds = (idMap) => {
    if (!idMap || Object.keys(idMap).length === 0) return;
    const m = (id) => idMap[id] || id;
    patchVendor((v) => ({
      ...v,
      profile: {
        ...v.profile,
        services: v.profile.services.map((s) => ({ ...s, id: m(s.id) })),
        addons: v.profile.addons.map((a) => ({ ...a, id: m(a.id), serviceIds: (a.serviceIds || []).map(m) })),
      },
    }));
  };
  const saveAndGoDashboard = () => saveVendorProfileAndGo("vendorDashboard");
  // A rejected vendor saves the changes and sends the application in again (rejected -> pending).
  const resubmitVendorApplication = async () => {
    if (!submittedVendor || !session?.access_token) return;
    const saved = await saveVendorProfile(submittedVendor, session.access_token);
    if (saved?.error) {
      showToast("Kunde inte spara: " + (saved.error.message || "kontrollera paketen och försök igen"));
      return;
    }
    applySavedIds(saved?.idMap);
    const { error } = await supabaseRestRequest(`/vendors?id=eq.${submittedVendor.id}`, session.access_token, { method: "PATCH", body: JSON.stringify({ status: "pending" }) });
    if (error) {
      showToast("Ändringarna är sparade, men ansökan kunde inte skickas om. Försök igen.");
      return;
    }
    setVendorApplications((list) => list.map((v) => (v.id === submittedVendor.id ? { ...v, status: "pending" } : v)));
    showToast("Din ansökan är skickad igen ✓");
    setView("vendorDashboard");
  };
  const saveAndGoPreview = () => saveVendorProfileAndGo("vendorProfilePreview");

  const respondToBookingItem = async (bookingNumber, itemId, status) => {
    setBookings((bs) =>
      bs.map((b) =>
        b.bookingNumber === bookingNumber ? { ...b, items: b.items.map((i) => (i.id === itemId ? { ...i, status } : i)) } : b
      )
    );
    showToast(status === "confirmed" ? "Bokning bekräftad ✓" : "Bokning nekad");
    if (session?.access_token) {
      const { error } = await supabaseRestRequest(`/booking_items?id=eq.${itemId}`, session.access_token, { method: "PATCH", body: JSON.stringify({ status } ) });
      if (error) {
        // The database refused (for example two requests for the same time): put the request back as it was.
        setBookings((bs) =>
          bs.map((b) =>
            b.bookingNumber === bookingNumber ? { ...b, items: b.items.map((i) => (i.id === itemId ? { ...i, status: "pending" } : i)) } : b
          )
        );
        showToast(
          String(error.message || "").includes("vendor_busy")
            ? "Du har redan en bekräftad bokning den tiden. Neka den här förfrågan eller avboka den andra först."
            : "Det gick inte att spara svaret. Försök igen."
        );
        setPollTick((t) => t + 1);
      }
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
  const removeVendorImage = (index) => {
    deleteVendorImageFile(submittedVendor?.profile?.images?.[index], session);
    patchVendor((v) => ({ ...v, profile: { ...v.profile, images: v.profile.images.filter((_, i) => i !== index) } }));
  };
  // Moves the chosen picture to the front: the first picture is the one shown on cards and as the profile's main picture.
  const makeVendorImageMain = (index) =>
    patchVendor((v) => {
      const imgs = v.profile.images;
      if (index <= 0 || index >= imgs.length) return v;
      return { ...v, profile: { ...v.profile, images: [imgs[index], ...imgs.filter((_, i) => i !== index)] } };
    });
  const uploadVendorImageFile = (file) => uploadVendorImage(file, session);

  // Adds a package card (or, with priceType "quote", the quote description) for a category,
  // filled from the category's template so the vendor only adjusts it.
  const addVendorService = (category, kind = "package", extra = {}) =>
    patchVendor((v) => {
      const cat = category || v.categories[0] || "";
      const base = kind === "quote" ? { priceType: "quote", name: "", description: "" } : newPackageFromTemplate(cat);
      return {
        ...v,
        profile: {
          ...v.profile,
          services: [
            ...v.profile.services,
            { unitLabel: "", minGuests: "", maxGuests: "", timeFrom: "", timeTo: "", minHours: "", includes: [], choiceGroups: [], price: "", priceNote: "", fromPrice: "", ...base, ...extra, id: newId(), category: cat },
          ],
        },
      };
    });
  const moveVendorService = (id, dir) =>
    patchVendor((v) => {
      const list = [...v.profile.services];
      const i = list.findIndex((s) => s.id === id);
      const cat = list[i]?.category;
      let j = i + dir;
      while (j >= 0 && j < list.length && list[j].category !== cat) j += dir;
      if (i < 0 || j < 0 || j >= list.length) return v;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...v, profile: { ...v.profile, services: list } };
    });
  const updateVendorService = (id, field, value) =>
    patchVendor((v) => ({
      ...v,
      profile: { ...v.profile, services: v.profile.services.map((s) => (s.id === id ? { ...s, [field]: value } : s)) },
    }));
  const removeVendorService = (id) =>
    patchVendor((v) => ({ ...v, profile: { ...v.profile, services: v.profile.services.filter((s) => s.id !== id) } }));

  const addVendorAddon = (serviceIds) =>
    patchVendor((v) => ({
      ...v,
      profile: { ...v.profile, addons: [...v.profile.addons, { id: newId(), name: "", price: "", priceType: "fixed", serviceIds: serviceIds || [] }] },
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
    setVendorApplications((apps) => apps.map((v) => (v.id === id ? { ...v, status: "approved", rejectionReason: "" } : v)));
    showToast("Leverantören är godkänd ✓");
    if (!id.startsWith("VND-") && session?.access_token) {
      await supabaseRestRequest(`/vendors?id=eq.${id}`, session.access_token, { method: "PATCH", body: JSON.stringify({ status: "approved" }) });
    }
  };
  const rejectVendor = async (id, reason) => {
    const clean = String(reason || "").trim().slice(0, 500);
    setVendorApplications((apps) => apps.map((v) => (v.id === id ? { ...v, status: "rejected", rejectionReason: clean } : v)));
    showToast("Ansökan har avslagits");
    if (!id.startsWith("VND-") && session?.access_token) {
      // saved in the same update as the status, so the rejection email to the vendor includes the reason
      const { error } = await supabaseRestRequest(`/vendors?id=eq.${id}`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({ rejection_reason: clean || null, status: "rejected" }),
      });
      if (error) showToast("Kunde inte spara avslaget. Försök igen.");
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
    if (vendorMode && ["home", "builder", "results", "profile", "checkout", "confirmation", "planning", "minaBokningar", "vendorIntro"].includes(view)) setView("vendorDashboard");
  }, [vendorMode, view]);

  const activeTab = panelOpen
    ? "messages"
    : view === "home" || view === "builder"
    ? "home"
    : view === "results" || view === "profile"
    ? "explore"
    : view === "planning"
    ? "minfest"
    : view === "minaBokningar" || view === "myAccount"
    ? "minsida"
    : null;
  const navItem = (id, label, onClick, badge) => (
    <button
      onClick={() => {
        if (id !== "messages") setPanelOpen(false);
        onClick();
      }}
      className="relative flex items-center gap-1.5 py-1"
      style={{ color: activeTab === id ? colors.coral : colors.plum, fontWeight: activeTab === id ? 700 : 500, borderBottom: `2px solid ${activeTab === id ? colors.coral : "transparent"}` }}
    >
      {label}
      {badge > 0 && (
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold" style={{ backgroundColor: colors.korall, color: colors.white }}>
          {badge}
        </span>
      )}
    </button>
  );
  const centerNavLinks = (
    <>
      {navItem("home", "Hem", goHome)}
      {navItem("explore", "Utforska", () => goExplore(null))}
      {navItem("minfest", "Mina event", goPlanning, cartItems.length)}
      {navItem("messages", "Meddelanden", openMessages, unreadTotal)}
      {navItem("minsida", "Min sida", goMinSida)}
    </>
  );
  const showTabBar = !isVendorPortalView && !isAdminView && !["builder", "checkout", "confirmation", "vendorSignup", "vendorAwaitingConfirmation", "resetPassword", "rsvp", "rsvpOptout"].includes(view);

  const minFestButton = (
    <button
      onClick={() => {
        setCartOpen(true);
        setMobileMenuOpen(false);
      }}
      className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
      style={{ backgroundColor: colors.coral, color: colors.white }}
    >
      <ShoppingBag size={15} />
      Att boka
      {cartItems.length > 0 && (
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full text-xs"
          style={{ backgroundColor: colors.korall, color: colors.white }}
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
    <div className={showTabBar || (isVendorPortalView && submittedVendor && !isAdminView) ? "pb-20 lg:pb-0" : ""} style={{ fontFamily: sans, backgroundColor: colors.cream, minHeight: "100%", color: colors.plum }}>
      <style>{`
        input[type="checkbox"], input[type="radio"] { accent-color: #7D2248; }
        input[type="date"]::-webkit-calendar-picker-indicator, input[type="time"]::-webkit-calendar-picker-indicator { cursor: pointer; }
        @keyframes planifest-wiggle { 0%,100% { transform: rotate(0); } 15% { transform: rotate(-14deg); } 30% { transform: rotate(12deg); } 45% { transform: rotate(-8deg); } 60% { transform: rotate(6deg); } 75% { transform: rotate(-3deg); } }
        @keyframes planifest-ring { 0% { box-shadow: 0 0 0 0 rgba(125,34,72,0.55), 0 8px 20px rgba(0,0,0,0.15); } 70%, 100% { box-shadow: 0 0 0 16px rgba(125,34,72,0), 0 8px 20px rgba(0,0,0,0.15); } }
        @keyframes planifest-pop { 0% { transform: scale(1); } 40% { transform: scale(1.4); } 100% { transform: scale(1); } }
        @keyframes planifest-confetti { 0% { transform: translate(0, 0) rotate(0); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { [style*="planifest-"] { animation: none !important; } }
      `}</style>

      {/* Top nav */}
      <div className="sticky top-0 z-30" style={{ backgroundColor: "rgba(251,243,232,0.92)", backdropFilter: "blur(6px)", borderBottom: `1px solid ${colors.beige}` }}>
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
                    <button onClick={goMyAccount} title={profile.full_name || session.user.email} className="text-sm font-medium underline" style={{ color: colors.plum }}>
                      Mitt konto
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
                {profile?.role === "admin" && (
                  <button onClick={goAdminDashboard} className="flex items-center gap-1 text-xs" style={{ color: colors.plumSoft, opacity: 0.6 }}>
                    <Shield size={12} /> Admin
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            {isVendorPortalView || isAdminView ? (
              <button className="-m-2 p-2" onClick={() => setMobileMenuOpen((v) => !v)} aria-label="Meny">
                {mobileMenuOpen ? <X size={22} color={colors.plum} /> : <Menu size={22} color={colors.plum} />}
              </button>
            ) : !session ? (
              <button onClick={() => openAuthModal("signin")} className="rounded-full px-4 py-2 text-sm font-semibold" style={{ border: `1px solid ${colors.beige}`, backgroundColor: colors.white, color: colors.plum }}>
                Logga in
              </button>
            ) : null}
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
        <HomeView
          party={party}
          setParty={setParty}
          onBuild={goBuilder}
          onExplore={() => goExplore(null)}
          onExploreCategory={goExplore}
          howItWorksRef={howItWorksRef}
          onVendorIntro={vendorMode ? null : goVendorIntro}
          session={session}
          profile={profile}
          upcomingEvent={upcomingEvent}
          onPlanning={goPlanning}
          onToggleTask={(eventId, taskId) => taskApi.toggle(eventId, taskId)}
          popular={popularProviders}
          onViewProvider={viewProfile}
          events={events}
          activeEventId={activeEventId}
          onSelectEvent={setActiveEventId}
          onNewEvent={startNewEvent}
          storyGroups={storyGroups}
          seenStories={seenStories}
          onOpenStory={openStory}
          reviewsDue={reviewsDue}
          onReview={openReview}
        />
      )}

      {view === "builder" && <BuilderView party={party} setParty={setParty} onSubmit={startBuilder} onClose={goHome} events={session ? events : []} activeEventId={activeEventId} onSelectEvent={setActiveEventId} onNewEvent={startNewEvent} />}

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
          cartPackages={cartItems.filter((ci) => ci.pkg?.providerId === activeProvider.id)}
          onAddPackage={addPackageToCart}
          onOpenCart={() => setCartOpen(true)}
          onBack={() => setView("results")}
          onAdd={addToCart}
          onRemove={removeFromCart}
          onToggleAddon={toggleAddon}
          onOpenChat={openProviderChat}
          onSelectDate={(date) => setParty((p) => ({ ...p, date }))}
          onUpdateParty={(patch) => setParty((p) => ({ ...p, ...patch }))}
          onSendRequest={sendRequest}
          siblings={
            activeProvider.vendorDbId
              ? customerProviders.filter((p) => p.vendorDbId === activeProvider.vendorDbId && p.id !== activeProvider.id && !p.quoteMessageId)
              : []
          }
          cartIds={cartProviderIds}
          storyIndex={activeProvider.vendorDbId ? storyGroups.findIndex((g) => g.vendorId === activeProvider.vendorDbId) : -1}
          storyUnseen={!!storyGroups.find((g) => g.vendorId === activeProvider.vendorDbId)?.stories.some((x) => !seenStories.has(x.id))}
          onOpenStory={openStory}
          highlightGroups={activeProvider.vendorDbId ? highlightGroupsFor(activeProvider.vendorDbId, activeProvider) : []}
          onOpenHighlight={(groups, index) => setStoryViewer({ groups, index })}
          onViewOther={(id) => {
            viewProfile(id);
            window.scrollTo({ top: 0 });
          }}
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

      {view === "rsvpOptout" && <OptOutView state={optOut} onConfirm={confirmOptOut} onHome={goHome} />}

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
          cart={cart}
          cartTotal={total}
          onOpenCart={() => setCartOpen(true)}
          onExploreCategory={goExplore}
          createRequest={planningCreateRequest}
          vendorStatus={vendorStatus}
          providers={customerProviders}
          onOpenConversation={(r) => openConversationFromPanel({ conversation_id: r.conversationId, vendor_id: r.vendorId, category_id: r.category, other_name: r.name, i_am: "customer" })}
          onGoBookings={goMinaBokningar}
        />
      )}

      {view === "minaBokningar" && (
        <>
          {session && (
            <MinSidaHeader
              name={profile?.full_name || ""}
              email={session.user?.email || ""}
              isAdmin={profile?.role === "admin"}
              hasVendor={!!submittedVendor}
              onAccount={goMyAccount}
              onSaved={goPlanning}
              onSupport={() => setSupportOpen(true)}
              onVendor={goVendorIntro}
              onAdmin={goAdminDashboard}
              onSignOut={signOut}
              reviewsDue={reviewsDue}
              onReview={openReview}
              avatarUrl={profile?.avatar_url || null}
              avatarUploading={customerAvatarUploading}
              onChangeAvatar={changeCustomerAvatar}
              onRemoveAvatar={removeCustomerAvatar}
            />
          )}
          <MinaBokningarView bookings={bookings} onCancelBooking={cancelBooking} onReviewItem={openReview} onChatItem={openBookingChat} events={events} />
        </>
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
          onCaptchaToken={setVendorCaptchaToken}
          captchaKey={vendorCaptchaKey}
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
          onDeleteAccount={deleteMyAccount}
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
          onChangeAvatar={changeVendorAvatar}
          avatarUploading={avatarUploading}
          onSaveDescription={saveVendorDescription}
          storyManager={
            <StoryManager
              approved={submittedVendor?.status === "approved"}
              stories={myStories}
              highlights={myHighlights}
              uploading={storyUploading}
              onUpload={addStory}
              onDelete={removeStory}
              onSaveToHighlight={saveStoryToHighlight}
              onRemoveFromHighlight={removeStoryFromHighlight}
              onDeleteHighlight={deleteHighlight}
            />
          }
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
          customerAvatars={customerAvatars}
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
          onMakeMainImage={makeVendorImageMain}
          onUploadImage={uploadVendorImageFile}
          onAddService={addVendorService}
          onUpdateService={updateVendorService}
          onRemoveService={removeVendorService}
          onAddAddon={addVendorAddon}
          onUpdateAddon={updateVendorAddon}
          onRemoveAddon={removeVendorAddon}
          onMoveService={moveVendorService}
          onPreview={saveAndGoPreview}
          onDashboard={saveAndGoDashboard}
          onResubmit={resubmitVendorApplication}
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
        <AdminDashboardView vendorApplications={vendorApplications} filter={adminFilter} onFilterChange={setAdminFilter} onOpenVendor={goAdminVendorDetail} token={session?.access_token} onShowToast={showToast} />
      )}

      {view === "adminVendorDetail" && (
        <AdminVendorDetailView
          vendor={activeAdminVendor}
          onBack={goAdminDashboard}
          onApprove={(id) => {
            approveVendor(id);
            goAdminDashboard();
          }}
          onReject={(id, reason) => {
            rejectVendor(id, reason);
            goAdminDashboard();
          }}
        />
      )}

      {view === "privacyPolicy" && <LegalPageView title="Integritetspolicy" sections={PRIVACY_POLICY_SECTIONS} onBack={leavePage} />}
      {view === "terms" && <LegalPageView title="Allmänna villkor" sections={TERMS_SECTIONS} onBack={leavePage} />}
      {view === "cookiePolicy" && <LegalPageView title="Cookiepolicy" sections={COOKIE_POLICY_SECTIONS} onBack={leavePage} />}

      {vendorMode && <VendorFooter onOpenTerms={goTerms} onOpenPrivacy={goPrivacyPolicy} onOpenCookies={goCookiePolicy} onSupport={() => setSupportOpen(true)} />}

      {!isVendorPortalView && !isAdminView && !["builder", "checkout", "confirmation", "vendorSignup", "vendorAwaitingConfirmation", "resetPassword", "privacyPolicy", "terms", "cookiePolicy"].includes(view) && (
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
        !["confirmation", "vendorIntro", "vendorSignup", "builder", "planning"].includes(view) &&
        !isVendorPortalView &&
        !isAdminView &&
        !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-24 right-4 z-30 flex items-center gap-2 rounded-full px-5 py-3 shadow-lg lg:bottom-6 lg:right-6"
          style={{ backgroundColor: colors.coral, color: colors.white }}
        >
          <ShoppingBag size={18} />
          <span className="text-sm font-semibold">
            <span className="hidden sm:inline">Att boka · </span>
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

      {storyViewer && storyViewer.groups[storyViewer.index] && (
        <StoryViewer
          groups={storyViewer.groups}
          startIndex={storyViewer.index}
          onClose={() => setStoryViewer(null)}
          onSeen={markStorySeen}
          onViewProvider={viewProfile}
          canDelete={(g) => profile?.role === "admin" || (!!submittedVendor && g.vendorId === submittedVendor.id)}
          onDelete={removeStory}
        />
      )}
      <ReviewModal target={reviewTarget} onSubmit={submitReview} onClose={closeReview} />
      {askMore && (
        <AskMoreSheet
          state={askMore}
          onSend={sendRequestToMore}
          onOpenChat={() => {
            const a = askMore;
            setAskMore(null);
            openRequestChat(a.provider, a.conversationId);
          }}
          onShowStatus={() => {
            setAskMore(null);
            goPlanning();
          }}
          onClose={() => setAskMore(null)}
        />
      )}
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
          <div className="hidden lg:block">
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
          </div>
        </>
      )}
      {isVendorPortalView && submittedVendor && !isAdminView && (
        <VendorTabBar
          active={view === "vendorDashboard" ? "overview" : view === "vendorBookings" ? "bookings" : view === "vendorInbox" ? "inbox" : ["vendorProfileEditor", "vendorProfilePreview"].includes(view) ? "profile" : null}
          unread={unreadTotal}
          pending={vendorBookingItems.filter((i) => i.status === "pending").length}
          onOverview={goVendorDashboard}
          onBookings={goVendorBookings}
          onInbox={goVendorInbox}
          onProfile={goVendorEditor}
        />
      )}
      {showTabBar && (
        <BottomTabBar
          active={activeTab}
          unread={unreadTotal}
          onHome={() => {
            setPanelOpen(false);
            goHome();
          }}
          onExplore={() => {
            setPanelOpen(false);
            goExplore(null);
          }}
          onMinFest={() => {
            setPanelOpen(false);
            goPlanning();
          }}
          onMessages={openMessages}
          onMinSida={() => {
            setPanelOpen(false);
            goMinSida();
          }}
        />
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
      {DEMO_MODE && !DEMO_FILM && (
        <div className="fixed left-1/2 top-2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold shadow" style={{ backgroundColor: colors.plum, color: colors.white }}>
          Demoläge: påhittade exempelleverantörer
          <a href="?demo=av" className="underline" style={{ color: colors.peach }}>
            Avsluta
          </a>
        </div>
      )}
      {cookieConsent === null && (
        <CookieConsentBanner onAcceptAll={() => setConsent("all")} onNecessaryOnly={() => setConsent("necessary")} onOpenPolicy={goCookiePolicy} />
      )}
    </div>
    </FavoritesContext.Provider>
  );
}
