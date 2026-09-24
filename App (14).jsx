import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Music2,
  Building2,
  UtensilsCrossed,
  Sparkles,
  Camera,
  Cake,
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
  return {
    id: dbVendor.id,
    companyName: dbVendor.company_name,
    organizationNumber: dbVendor.organization_number,
    contactPerson: dbVendor.contact_person,
    email: dbVendor.email,
    phone: dbVendor.phone,
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

const VENDOR_SELECT = "select=*,vendor_categories(category_id),services(*),addons(*),blocked_times(*)";

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
      organization_number: form.organizationNumber,
      contact_person: form.contactPerson,
      email: form.email,
      phone: form.phone,
      base_location: form.baseLocation,
      service_area_type: areaOption?.type || null,
      service_area_value: areaOption?.label || null,
      status: "pending",
    }),
  });
  if (error || !data?.[0]) return { error: error || { message: "Kunde inte skapa leverantörsprofilen." } };
  const vendorRow = data[0];
  if (form.categories.length > 0) {
    await supabaseRestRequest("/vendor_categories", session.access_token, {
      method: "POST",
      body: JSON.stringify(form.categories.map((catId) => ({ vendor_id: vendorRow.id, category_id: catId }))),
    });
  }
  return {
    data: mapDbVendorToLocal({
      ...vendorRow,
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
      contact_person: vendor.contactPerson,
      email: vendor.email,
      phone: vendor.phone,
      base_location: vendor.baseLocation,
      service_area_type: vendor.serviceArea?.type || null,
      service_area_value: vendor.serviceArea?.value || null,
      tagline: vendor.profile.tagline,
      description: vendor.profile.description,
      images: vendor.profile.images,
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

// A vendor signup requiring email confirmation can't insert its vendors row
// right away (no session yet) — the collected form data is stashed here and
// picked back up the first time this email successfully logs in.
const PENDING_VENDOR_KEY = "planifest-pending-vendor";
function stashPendingVendorApplication(email, form) {
  try {
    const { password, confirmPassword, ...rest } = form;
    localStorage.setItem(PENDING_VENDOR_KEY, JSON.stringify({ email, form: rest }));
  } catch (e) {
    // ignore — worst case they just need to redo the vendor form after confirming
  }
}
function loadPendingVendorApplication(email) {
  try {
    const raw = localStorage.getItem(PENDING_VENDOR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.email === email ? parsed.form : null;
  } catch (e) {
    return null;
  }
}
function clearPendingVendorApplication() {
  try {
    localStorage.removeItem(PENDING_VENDOR_KEY);
  } catch (e) {
    // ignore
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
  const mockListings = PROVIDERS.map((p) => {
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

function validateVendorAccount(form) {
  const errors = {};
  if (!form.companyName.trim()) errors.companyName = "Fyll i företagsnamn";
  if (!form.organizationNumber.trim()) errors.organizationNumber = "Ange ett organisationsnummer";
  if (!form.contactPerson.trim()) errors.contactPerson = "Fyll i kontaktperson";
  if (!form.email.trim()) errors.email = "Fyll i e-postadress";
  else if (!EMAIL_RE.test(form.email.trim())) errors.email = "Ange en giltig e-postadress";
  if (!form.phone.trim()) errors.phone = "Fyll i telefonnummer";
  if (!form.password) errors.password = "Ange ett lösenord";
  else if (form.password.length < 6) errors.password = "Lösenordet måste vara minst 6 tecken";
  if (form.confirmPassword !== form.password) errors.confirmPassword = "Lösenorden matchar inte";
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
  const priceLabel = `${formatKr(provider.pricing.amount)}${getUnitLabel(provider.pricing)}`;
  const handleAction = (e) => {
    e.stopPropagation();
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
        <button
          onClick={handleAction}
          className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full shadow-sm"
          style={{
            backgroundColor: inCart && !swapMode ? colors.white : colors.coral,
            color: inCart && !swapMode ? colors.lilacDeep : colors.white,
          }}
          aria-label={swapMode ? "Välj denna" : inCart ? "Ta bort från Min fest" : "Lägg till i Min fest"}
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
                onChange={(e) => setParty((p) => ({ ...p, guests: Number(e.target.value) || 1 }))}
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

function ResultsView({ party, setParty, groups, swapProviders, cart, onView, onAdd, onRemove, sortBy, setSortBy, distanceFilter, setDistanceFilter, swapContext, onCancelSwap }) {
  const toggleCategory = (id) => {
    setParty((p) => ({
      ...p,
      categories: p.categories.includes(id) ? p.categories.filter((c) => c !== id) : [...p.categories, id],
    }));
  };

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
          </div>
        </>
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
              Inga leverantörer matchar just nu — prova en annan kategori.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ProfileView({ provider, party, inCart, cartAddons, onBack, onAdd, onRemove, onToggleAddon, onOpenChat }) {
  const cat = catMap[provider.category];
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
      <button onClick={onBack} className="-ml-2 mb-5 flex items-center gap-1 px-2 py-1.5 text-sm font-medium" style={{ color: colors.plumSoft }}>
        <ChevronLeft size={16} /> Tillbaka
      </button>

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
              <MonthCalendar
                year={calYear}
                month={calMonthIdx}
                onPrevMonth={prevMonth}
                onNextMonth={nextMonth}
                getDayStatus={getDayStatus}
                interactive={false}
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
            <button
              onClick={() => onOpenChat(provider)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium"
              style={{ border: `1.5px solid ${colors.lilac}`, color: colors.lilacDeep, backgroundColor: colors.white }}
            >
              <MessageCircle size={15} /> Fråga leverantören
            </button>
          </div>
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

function CheckoutView({ cart, party, onOpenCart, onConfirm, onOpenTerms }) {
  const [accepted, setAccepted] = useState(false);
  const total = cart.reduce((sum, p) => sum + getLineTotal(p, p.chosenAddons, party), 0);
  return (
    <div className="mx-auto max-w-2xl px-6 pb-24 pt-10 sm:px-10">
      <h1 style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>Din fest</h1>

      <div className="mt-5 rounded-3xl p-6" style={{ backgroundColor: colors.white, border: `1px solid ${colors.beige}` }}>
        <div className="flex flex-wrap gap-4 text-sm" style={{ color: colors.plumSoft }}>
          <span className="flex items-center gap-1">
            <Calendar size={14} /> {party.date || "Datum ej valt"}
          </span>
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
        </div>

        <div className="mt-5 space-y-3" style={{ borderTop: `1px solid ${colors.beige}`, paddingTop: 16 }}>
          <p className="text-sm font-semibold" style={{ color: colors.plum }}>
            Dina leverantörer
          </p>
          {cart.map((p) => {
            const chosen = p.chosenAddons || [];
            const chosenAddonObjs = p.addons.filter((a) => chosen.includes(a.id));
            return (
              <div key={p.id} className="flex items-start justify-between text-sm">
                <div>
                  <span style={{ color: colors.plum }}>{p.name}</span>
                  <p className="text-xs" style={{ color: colors.plumSoft }}>
                    {getBreakdownText(p, party)}
                    {chosenAddonObjs.length > 0 && ` + ${chosenAddonObjs.map((a) => a.name).join(", ")}`}
                  </p>
                </div>
                <span className="whitespace-nowrap font-medium" style={{ color: colors.plum }}>
                  {formatKr(getLineTotal(p, chosen, party))}
                </span>
              </div>
            );
          })}
          <button onClick={onOpenCart} className="text-xs font-medium underline" style={{ color: colors.lilacDeep }}>
            Redigera i Min fest
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between" style={{ borderTop: `1px solid ${colors.beige}`, paddingTop: 16 }}>
          <span className="font-semibold" style={{ color: colors.plum }}>
            Totalpris
          </span>
          <span style={{ fontFamily: serif, fontSize: 24, color: colors.plum }}>{formatKr(total)}</span>
        </div>
      </div>

      <div className="mt-6 rounded-2xl p-4 text-sm leading-relaxed" style={{ backgroundColor: colors.cream, color: colors.plumSoft }}>
        <p className="mb-1 font-semibold" style={{ color: colors.plum }}>
          Bokningsvillkor & avbokningsregler
        </p>
        Att boka skickar en förfrågan till respektive leverantör, som bekräftar eller avböjer inom 24
        timmar. Betalning sker först när samtliga leverantörer bekräftat. Avbokning senare än 14 dagar
        innan eventet kan medföra kostnad enligt leverantörens villkor. Fullständiga villkor finns i
        Planifests allmänna villkor.
      </div>

      <label className="mt-4 flex items-start gap-3 text-sm" style={{ color: colors.plum }}>
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1" />
        Jag har läst och godkänner Planifests{" "}
        <button type="button" onClick={onOpenTerms} className="font-semibold underline" style={{ color: colors.lilacDeep }}>
          bokningsvillkor och avbokningsregler
        </button>
        .
      </label>

      <button
        disabled={!accepted || cart.length === 0}
        onClick={onConfirm}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3 text-base font-semibold"
        style={{ backgroundColor: colors.coral, color: colors.white, opacity: accepted && cart.length > 0 ? 1 : 0.45 }}
      >
        Boka &amp; betala
      </button>
      <p className="mt-2 text-center text-xs" style={{ color: colors.plumSoft }}>
        Detta skickar en bokningsförfrågan till leverantörerna. Ingen betalning sker i denna prototyp.
      </p>
    </div>
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
                    .filter((item) => !item.reviewed)
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
                  {b.items.every((i) => i.reviewed) && (
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

function ChatModal({ target, messages, vendorTyping, onSend, onClose, onAcceptQuote, onDeclineQuote }) {
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
              {target.kind === "booking" ? target.bookingNumber : "Fråga innan du bokar"}
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
            m.message_type === "quote" ? (
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
                    <span
                      className="mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: m.quote_status === "accepted" ? "#E3F3E9" : colors.beige,
                        color: m.quote_status === "accepted" ? colors.green : colors.plumSoft,
                      }}
                    >
                      {m.quote_status === "accepted" ? <Check size={12} /> : <X size={12} />}
                      {m.quote_status === "accepted" ? "Accepterad — tillagd i Min fest" : "Tackade nej"}
                    </span>
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
function AuthModal({ open, mode, onModeChange, onClose, onSignIn, onSignUp }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signedUp, setSignedUp] = useState(false);

  if (!open) return null;

  const reset = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setConfirmPassword("");
    setError("");
    setSignedUp(false);
  };
  const closeAndReset = () => {
    onClose();
    setTimeout(reset, 300);
  };

  const submit = async () => {
    setError("");
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
        ) : (
          <>
            <h2 style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>{mode === "signin" ? "Logga in" : "Skapa konto"}</h2>
            <div className="mt-4 space-y-3">
              {mode === "signup" && <VendorTextField label="Namn" value={fullName} onChange={setFullName} />}
              <VendorTextField label="E-post" type="email" value={email} onChange={setEmail} />
              <VendorTextField label="Lösenord" type="password" value={password} onChange={setPassword} />
              {mode === "signup" && <VendorTextField label="Bekräfta lösenord" type="password" value={confirmPassword} onChange={setConfirmPassword} />}
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

function SupportModal({ open, onClose, onSubmit }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  if (!open) return null;

  const submit = () => {
    if (!message.trim()) return;
    onSubmit({ subject: subject.trim(), message: message.trim() });
    setSent(true);
  };

  const closeAndReset = () => {
    onClose();
    setTimeout(() => {
      setSent(false);
      setSubject("");
      setMessage("");
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
              Vi återkommer inom 24 timmar via e-post.
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
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ämne (valfritt)"
              className="mt-4 w-full rounded-xl px-3 py-2 text-sm"
              style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }}
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Ditt meddelande..."
              className="mt-2 w-full rounded-xl px-3 py-2 text-sm"
              style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum, backgroundColor: colors.white }}
            />
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
                disabled={!message.trim()}
                className="flex-1 rounded-full px-4 py-3 text-sm font-semibold"
                style={{ backgroundColor: colors.coral, color: colors.white, opacity: message.trim() ? 1 : 0.5 }}
              >
                Skicka
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

function VendorSignupView({ step, form, errors, onField, onToggleCategory, onNext, onBack, onSubmit, onShowToast, submitError, submitting, onOpenTerms }) {
  const stepTitles = { 1: "Skapa konto", 2: "Geografi", 3: "Vad erbjuder du?" };

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
            <h2 style={{ fontFamily: serif, fontSize: 22, color: colors.plum }}>Skapa konto</h2>
            <VendorTextField label="Företagsnamn" value={form.companyName} onChange={(v) => onField("companyName", v)} error={errors.companyName} />
            <VendorTextField
              label="Organisationsnummer"
              value={form.organizationNumber}
              onChange={(v) => onField("organizationNumber", v)}
              error={errors.organizationNumber}
              placeholder="XXXXXX-XXXX"
            />
            <VendorTextField label="Kontaktperson" value={form.contactPerson} onChange={(v) => onField("contactPerson", v)} error={errors.contactPerson} />
            <VendorTextField label="E-post" type="email" value={form.email} onChange={(v) => onField("email", v)} error={errors.email} />
            <VendorTextField label="Telefonnummer" type="tel" value={form.phone} onChange={(v) => onField("phone", v)} error={errors.phone} />
            <VendorTextField label="Lösenord" type="password" value={form.password} onChange={(v) => onField("password", v)} error={errors.password} />
            <VendorTextField
              label="Bekräfta lösenord"
              type="password"
              value={form.confirmPassword}
              onChange={(v) => onField("confirmPassword", v)}
              error={errors.confirmPassword}
            />
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

function VendorAwaitingConfirmationView({ email, onHome }) {
  return (
    <div className="mx-auto max-w-xl px-6 pb-24 pt-14 text-center sm:px-10">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: colors.coralSoft }}>
        <Check size={28} color={colors.coral} />
      </div>
      <h1 style={{ fontFamily: serif, fontSize: 28, color: colors.plum }}>Kolla din mejl!</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed" style={{ color: colors.plumSoft }}>
        Vi har skickat en bekräftelselänk till <strong>{email}</strong>. Klicka på den, kom sedan tillbaka hit och logga in — då slutförs din leverantörsansökan automatiskt.
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
    { key: "services", label: "Minst en tjänst/pris", done: (profile.services || []).length > 0 },
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

function VendorDashboardView({ vendor, bookingItems, onEditProfile, onPreview, onBookings, onInbox }) {
  if (!vendor) return null;
  const { percent, missing } = getVendorCompleteness(vendor);
  const locationName = locationMap[vendor.baseLocation]?.name || vendor.baseLocation;
  const categoryLabels = vendor.categories.map((id) => catMap[id]?.label).filter(Boolean).join(", ") || "Inga valda ännu";
  const status = STATUS_META[vendor.status] || STATUS_META.pending;
  const pendingCount = bookingItems.filter((i) => i.status === "pending").length;

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

      <div className="mt-5 rounded-3xl p-6" style={{ backgroundColor: colors.white, border: `1.5px solid ${colors.lilac}` }}>
        <p style={{ fontFamily: serif, fontSize: 20, color: colors.plum }}>{vendor.companyName}</p>
        <span
          className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ backgroundColor: status.bg, color: status.fg }}
        >
          {status.emoji} Status: {status.label}
        </span>
        {vendor.status === "approved" && (
          <p className="mt-2 text-sm" style={{ color: colors.plumSoft }}>
            Er profil är publicerad och synlig för kunder på Planifest.
          </p>
        )}
        {vendor.status === "rejected" && (
          <p className="mt-2 text-sm" style={{ color: colors.plumSoft }}>
            Er ansökan godkändes inte den här gången. Ni kan fortfarande redigera profilen.
          </p>
        )}
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
function VendorInboxView({ conversations, activeConversationId, messages, onOpenConversation, onSendMessage, onSendQuote, onBack }) {
  const [text, setText] = useState("");
  const [quoteMode, setQuoteMode] = useState(false);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteDescription, setQuoteDescription] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, activeConversationId]);

  const active = conversations.find((c) => c.id === activeConversationId) || null;

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
            m.message_type === "quote" ? (
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
              onClick={() => setQuoteMode(true)}
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
              <div className="flex-1">
                <p className="font-semibold" style={{ color: colors.plum }}>
                  {catMap[c.category_id]?.label || "Fråga"}
                </p>
                <p className="text-xs" style={{ color: colors.plumSoft }}>
                  Kund
                </p>
              </div>
              <ChevronRight size={16} color={colors.plumSoft} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VendorBookingsView({ vendor, bookingItems, onRespond, onAddBlockedTime, onRemoveBlockedTime, onShowToast }) {
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
                <div key={`b-${i}`} className="flex items-center justify-between rounded-xl p-3 text-sm" style={{ backgroundColor: "#E3F3E9" }}>
                  <span className="flex items-center gap-2" style={{ color: colors.plum }}>
                    <Check size={14} color={colors.green} /> {e.date}, {e.startTime}–{e.endTime}
                  </span>
                  <span style={{ color: colors.plumSoft }}>{formatKr(e.item.price)}</span>
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
const PRIVACY_POLICY_SECTIONS = [
  {
    heading: "1. Vem är personuppgiftsansvarig?",
    paragraphs: [
      "Planifest drivs som enskild firma av Kristina Onus (\"Planifest\", \"vi\" eller \"oss\"). Kristina Onus är personuppgiftsansvarig för den behandling av personuppgifter som beskrivs i denna policy.",
      "Kontaktuppgifter: info@planifest.se, [DIN REGISTRERADE FÖRETAGSADRESS].",
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
    paragraphs: ["Har du frågor om hur vi behandlar dina personuppgifter? Kontakta oss på info@planifest.se.", "Senast uppdaterad: [DATUM]"],
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
      "Kund och Leverantör som kommit i kontakt via Planifest förbinder sig att inte, under pågående bokningsprocess eller inom [12] månader efter första kontakt via plattformen, ingå avtal om samma eller liknande tjänst direkt med varandra i syfte att kringgå Planifests förmedlingsavgift.",
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
    paragraphs: ["Frågor om dessa villkor? Kontakta oss på info@planifest.se.", "Senast uppdaterad: [DATUM]"],
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
    paragraphs: ["Frågor om cookies? Kontakta oss på info@planifest.se.", "Senast uppdaterad: [DATUM]"],
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
        Det här är ett startutkast — inte juridisk rådgivning. Låt en jurist eller tjänst som Lexly/Avtal24 granska texten, särskilt punkterna markerade med [ ], innan den publiceras skarpt.
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
  const [party, setParty] = useState(emptyParty);
  const [cartItems, setCartItems] = useState([]); // [{ id, addons: [addonId, ...] }]
  const [activeProviderId, setActiveProviderId] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState("recommended");
  const [distanceFilter, setDistanceFilter] = useState("all"); // "all" | 5 | 10 | 25 | 50 (km)
  const [swapContext, setSwapContext] = useState(null); // { oldId, oldName, category }
  const [toast, setToast] = useState("");
  const [vendorStep, setVendorStep] = useState(1);
  const [vendorForm, setVendorForm] = useState(emptyVendorForm);
  const [vendorErrors, setVendorErrors] = useState({});
  const [vendorSubmitError, setVendorSubmitError] = useState("");
  const [vendorSubmitting, setVendorSubmitting] = useState(false);
  const [vendorApplications, setVendorApplications] = useState(SEED_VENDOR_APPLICATIONS);
  const [submittedVendorId, setSubmittedVendorId] = useState(null);
  const [activeAdminVendorId, setActiveAdminVendorId] = useState(null);
  const [adminFilter, setAdminFilter] = useState("all");
  const [bookings, setBookings] = useState(SEED_BOOKINGS);
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
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState("signin"); // "signin" | "signup"
  const howItWorksRef = useRef(null);
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
      if (error || !data || data.length === 0) return;
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
          bookingNumber: b.booking_number,
          date: b.date,
          startTime: b.start_time,
          endTime: b.end_time,
          guests: b.guests,
          occasion: b.occasion,
          cancelled: b.cancelled,
          completed: b.completed,
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
    supabaseRestRequest(
      `/booking_items?vendor_id=eq.${vendorId}&select=*,bookings(booking_number,date,start_time,end_time,guests,occasion,cancelled)`,
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
            next[idx] = { ...next[idx], items: newItems, cancelled: b.cancelled };
          } else {
            next.push({
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
  }, [submittedVendor?.id, session]);

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

  const signIn = async (email, password) => {
    const { data, error } = await supabaseAuthRequest("/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (error) return error;
    setSessionPersist(data);
    showToast("Inloggad ✓");

    // Finish a vendor application that was waiting on email confirmation.
    const pendingForm = loadPendingVendorApplication(email);
    if (pendingForm) {
      const { data: newVendor, error: vendorError } = await createVendorApplication(data, pendingForm);
      clearPendingVendorApplication();
      if (!vendorError && newVendor) {
        setVendorApplications((apps) => [...apps, newVendor]);
        setSubmittedVendorId(newVendor.id);
        setAuthModalOpen(false);
        setView("vendorPending");
        return null;
      }
    }
    return null;
  };

  const signUpCustomer = async (email, password, fullName) => {
    const { data, error } = await supabaseAuthRequest("/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, data: { full_name: fullName } }),
    });
    if (error) return error;
    if (data.access_token) setSessionPersist(data); // in case email confirmation is ever turned off
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
    setSubmittedVendorId(null);
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


  const submittedVendor = vendorApplications.find((v) => v.id === submittedVendorId) || null;
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

    return activeCategoryIds
      .map((catId) => ({
        category: catMap[catId],
        providers: sortWithinCategory(customerProviders.filter((p) => p.category === catId && withinDistance(p))),
      }))
      .filter((g) => g.providers.length > 0);
  }, [party, sortBy, customerProviders, distanceFilter]);

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
    const newBookingNumber = "EVT-" + Math.floor(1000 + Math.random() * 9000);
    const { data: bookingRows, error: bookingError } = await supabaseRestRequest("/bookings", session.access_token, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        booking_number: newBookingNumber,
        customer_id: session.user.id,
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
    const itemsPayload = cart.map((p) => ({
      booking_id: bookingRow.id,
      vendor_id: p.vendorDbId || null,
      category_id: p.category,
      name: p.name,
      price: getLineTotal(p, p.chosenAddons, party),
      status: "pending",
    }));
    const { data: itemRows, error: itemsError } = await supabaseRestRequest("/booking_items", session.access_token, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(itemsPayload),
    });
    const sourceItems = !itemsError && itemRows ? itemRows : itemsPayload;
    const newBooking = {
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
    setCustomerReviews((r) => [...r, { id: "rev-" + Date.now(), providerId: item.providerId, name: "Du", stars, text: trimmed }]);
    setBookings((bs) =>
      bs.map((b) =>
        b.bookingNumber === bookingNumber ? { ...b, items: b.items.map((i) => (i.id === item.id ? { ...i, reviewed: true } : i)) } : b
      )
    );
    setReviewTarget(null);
    showToast("Tack för din recension! ✓");

    if (session?.access_token && item.vendorId) {
      await supabaseRestRequest("/reviews", session.access_token, {
        method: "POST",
        body: JSON.stringify({ booking_item_id: item.id, vendor_id: item.vendorId, customer_id: session.user.id, stars, text: trimmed }),
      });
      await supabaseRestRequest(`/booking_items?id=eq.${item.id}`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({ reviewed: true }),
      });
    }
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
  }, [submittedVendor?.id, session, view]);

  const openVendorConversation = async (conversationId) => {
    setActiveVendorConversationId(conversationId);
    const { data, error } = await supabaseRestRequest(`/messages?conversation_id=eq.${conversationId}&select=*&order=created_at.asc`, session.access_token);
    if (!error && data) setRealMessages((m) => ({ ...m, [conversationId]: data }));
  };
  const closeVendorConversation = () => setActiveVendorConversationId(null);

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

  // --- Support (Fas 4) — simple in-memory contact form, see SupportModal ---
  const submitSupportMessage = (msg) => {
    setSupportMessages((m) => [...m, { id: "sup-" + Date.now(), ...msg, ts: Date.now() }]);
  };

  // --- Vendor signup (Fas 2A) ---
  const goVendorIntro = () => {
    setView(submittedVendor ? "vendorDashboard" : "vendorIntro");
    setMobileMenuOpen(false);
  };

  const startVendorSignup = () => {
    setVendorForm(emptyVendorForm());
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
    const errors = vendorStep === 1 ? validateVendorAccount(vendorForm) : validateVendorGeography(vendorForm);
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
    const { data: signUpData, error: signUpError } = await supabaseAuthRequest("/signup", {
      method: "POST",
      body: JSON.stringify({
        email: vendorForm.email,
        password: vendorForm.password,
        data: { full_name: vendorForm.contactPerson },
      }),
    });
    setVendorSubmitting(false);

    if (signUpError) {
      setVendorSubmitError(signUpError.message);
      return;
    }

    if (signUpData.access_token) {
      // Email confirmation is off (or already confirmed) — we have a session
      // immediately, so create the vendor row right away.
      setSessionPersist(signUpData);
      const { data: newVendor, error: vendorError } = await createVendorApplication(signUpData, vendorForm);
      if (vendorError) {
        setVendorSubmitError(vendorError.message);
        return;
      }
      setVendorApplications((apps) => [...apps, newVendor]);
      setSubmittedVendorId(newVendor.id);
      setView("vendorPending");
    } else {
      // Needs email confirmation first — stash the form and pick it back up on next sign-in.
      stashPendingVendorApplication(vendorForm.email, vendorForm);
      setView("vendorAwaitingConfirmation");
    }
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
  const isVendorPortalView = ["vendorPending", "vendorDashboard", "vendorProfileEditor", "vendorProfilePreview", "vendorBookings", "vendorInbox"].includes(
    view
  );
  const isAdminView = ["adminDashboard", "adminVendorDetail"].includes(view);

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
      >
        Meddelanden
      </button>
      <button
        onClick={() => {
          goVendorPreview();
          setMobileMenuOpen(false);
        }}
      >
        Förhandsvisa
      </button>
    </>
  );

  const vendorLogoutButton = (
    <button
      onClick={() => {
        showToast("Utloggning är inte byggt i denna prototyp än.");
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
    <div style={{ fontFamily: sans, backgroundColor: colors.cream, minHeight: "100%", color: colors.plum }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
        input[type="date"]::-webkit-calendar-picker-indicator, input[type="time"]::-webkit-calendar-picker-indicator { cursor: pointer; }
      `}</style>

      {/* Top nav */}
      <div className="sticky top-0 z-30" style={{ backgroundColor: "rgba(251,244,238,0.92)", backdropFilter: "blur(6px)", borderBottom: `1px solid ${colors.beige}` }}>
        <div className="flex items-center justify-between gap-4 px-6 py-4 sm:px-10">
          <div className="flex items-center gap-8">
            <Logo onClick={goHome} />
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
                  <Briefcase size={14} /> Bli leverantör
                </button>
                {session && profile ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium" style={{ color: colors.plum }}>
                      {profile.full_name || session.user.email}
                    </span>
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
                    showToast("Utloggning är inte byggt i denna prototyp än.");
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
                  <Briefcase size={14} /> Bli leverantör
                </button>
                {session && profile ? (
                  <button
                    onClick={() => {
                      signOut();
                      setMobileMenuOpen(false);
                    }}
                    className="mt-2 rounded-full px-4 py-2.5 text-center"
                    style={{ border: `1.5px solid ${colors.beige}`, color: colors.plum }}
                  >
                    Logga ut ({profile.full_name || session.user.email})
                  </button>
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
        />
      )}

      {view === "checkout" && (
        <CheckoutView cart={cart} party={party} onOpenCart={() => setCartOpen(true)} onConfirm={confirmBooking} onOpenTerms={goTerms} />
      )}

      {view === "confirmation" && <ConfirmationView booking={lastBooking} onRestart={restart} onMinaBokningar={goMinaBokningar} />}

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
        />
      )}

      {view === "vendorAwaitingConfirmation" && <VendorAwaitingConfirmationView email={vendorForm.email} onHome={goHome} />}

      {view === "vendorPending" && <VendorPendingView vendor={submittedVendor} onHome={goHome} onGoDashboard={goVendorDashboard} />}

      {view === "vendorDashboard" && (
        <VendorDashboardView
          vendor={submittedVendor}
          bookingItems={vendorBookingItems}
          onEditProfile={goVendorEditor}
          onPreview={goVendorPreview}
          onBookings={goVendorBookings}
          onInbox={goVendorInbox}
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
        />
      )}

      {view === "vendorProfileEditor" && (
        <VendorProfileEditorView
          vendor={submittedVendor}
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

      {view === "privacyPolicy" && <LegalPageView title="Integritetspolicy" sections={PRIVACY_POLICY_SECTIONS} onBack={goHome} />}
      {view === "terms" && <LegalPageView title="Allmänna villkor" sections={TERMS_SECTIONS} onBack={goHome} />}
      {view === "cookiePolicy" && <LegalPageView title="Cookiepolicy" sections={COOKIE_POLICY_SECTIONS} onBack={goHome} />}

      {!isVendorPortalView && !isAdminView && !["checkout", "confirmation", "vendorSignup", "vendorAwaitingConfirmation", "privacyPolicy", "terms", "cookiePolicy"].includes(view) && (
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

      <ReviewModal target={reviewTarget} onSubmit={submitReview} onClose={closeReview} />
      <ChatModal
        target={chatTarget}
        messages={chatTarget?.real ? realMessages[chatTarget.conversationId] || [] : chatTarget ? chats[getChatKey(chatTarget)] || [] : []}
        vendorTyping={!chatTarget?.real && vendorTyping}
        onSend={sendChatMessage}
        onClose={closeChat}
        onAcceptQuote={acceptQuote}
        onDeclineQuote={declineQuote}
      />
      <AuthModal
        open={authModalOpen}
        mode={authModalMode}
        onModeChange={setAuthModalMode}
        onClose={() => setAuthModalOpen(false)}
        onSignIn={signIn}
        onSignUp={signUpCustomer}
      />
      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} onSubmit={submitSupportMessage} />
      <Toast message={toast} />
      {cookieConsent === null && (
        <CookieConsentBanner onAcceptAll={() => setConsent("all")} onNecessaryOnly={() => setConsent("necessary")} onOpenPolicy={goCookiePolicy} />
      )}
    </div>
  );
}
