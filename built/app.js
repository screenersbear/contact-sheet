// Made by tools/join.mjs from the files listed in files.txt. Never edit it: change those files, then run node tools/join.mjs.
// \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", {
	value,
	configurable: true
});

// components/keyboard-fit.js
const vv = window.visualViewport;
const html$1 = document.documentElement;
function fitViewport() {
	if (!vv) return;
	html$1.style.setProperty("--vv-top", `${vv.offsetTop}px`);
	html$1.style.setProperty("--vv-height", `${vv.height}px`);
}
if (vv) {
	vv.addEventListener("resize", fitViewport);
	vv.addEventListener("scroll", fitViewport);
	fitViewport();
}

// components/screen-fit.js
const html = document.documentElement;
const iPhoneApp = /iPhone|iPod/.test(navigator.userAgent) && (navigator.standalone === true || matchMedia("(display-mode: standalone)").matches);
const turned = () => html.classList.contains("is-turned");
const typing = () => !!document.activeElement && document.activeElement.matches("input, textarea, [contenteditable]");
let probe = null;
function screenGap(full = 0) {
	if (!document.body) return 0;
	if (!probe) {
		probe = document.createElement("div");
		probe.setAttribute("aria-hidden", "true");
		probe.style.cssText = "position: fixed; left: 0; bottom: 0; width: 1px; height: 0; visibility: hidden; pointer-events: none; padding-top: var(--test-safe-top, var(--sa-t));";
		document.body.appendChild(probe);
	}
	const portrait = Math.abs(window.innerWidth - screen.width) < 2;
	const real = full || (portrait ? screen.height : screen.width);
	html.style.setProperty("--screen-h", `${Math.round(real)}px`);
	const under = parseFloat(getComputedStyle(probe).paddingTop) > 0;
	const gap = Math.round(real - probe.getBoundingClientRect().bottom);
	if (under) return gap > 8 && gap < 120 ? gap : 0;
	return gap > 76 && gap < 150 ? Math.round(gap / 2) : 0;
}
let nudging = false;
function nudgeScreen(tries = 5, full = 0) {
	return new Promise((done) => {
		const go = (left) => {
			if (!left || turned() || !screenGap(full) || typing()) {
				nudging = false;
				done(screenGap(full));
				return;
			}
			nudging = true;
			html.classList.add("ios-nudge");
			setTimeout(() => {
				const y = window.scrollY;
				window.scrollTo(0, y + 1);
				setTimeout(() => {
					window.scrollTo(0, y);
					setTimeout(() => {
						html.classList.remove("ios-nudge");
						setTimeout(() => go(left - 1), 200);
					}, 120);
				}, 40);
			}, 30);
		};
		if (nudging) done(screenGap(full));
		else go(tries);
	});
}
if (!iPhoneApp) html.classList.add("settled");
else setTimeout(() => html.classList.add("settled"), 3500);
if (iPhoneApp) {
	const soon = (ms) => setTimeout(() => {
		if (turned()) return;
		if (!nudging && screenGap() > 0) html.classList.remove("settled");
		nudgeScreen().then((gap) => {
			html.classList.add("settled");
			if (turned()) return;
			html.classList.toggle("is-short", gap > 0);
			window.dispatchEvent(new Event("resize"));
		});
	}, ms);
	window.addEventListener("load", () => soon(120));
	window.addEventListener("pageshow", () => soon(80));
	document.addEventListener("visibilitychange", () => {
		if (!document.hidden) soon(80);
	});
	window.addEventListener("orientationchange", () => soon(300));
}

// components/no-zoom.js
if (/iP(hone|ad|od)/.test(navigator.userAgent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) {
	const meta = document.querySelector("meta[name=\"viewport\"]");
	if (meta && !/maximum-scale/.test(meta.content)) meta.content += ", maximum-scale=1";
}

// data/formats.js
const SLIDE_W = 1080;
const MAX_SLIDES = 20;
const MIN_FRAME = 60;
const RATIOS = {
	"3:4": {
		h: 1440,
		story: false,
		label: "Feed post 3:4",
		size: "1080 × 1440",
		detail: "Tall. Matches the profile grid."
	},
	"4:5": {
		h: 1350,
		story: false,
		label: "Feed post 4:5",
		size: "1080 × 1350",
		detail: "The classic portrait size."
	},
	"1:1": {
		h: 1080,
		story: false,
		label: "Feed post 1:1",
		size: "1080 × 1080",
		detail: "Square."
	},
	"9:16": {
		h: 1920,
		story: true,
		label: "Story 9:16",
		size: "1080 × 1920",
		detail: "Full screen. One or a series."
	},
	"2:3": {
		h: 1620,
		story: false,
		print: true,
		scale: 1,
		label: "Photo 4 × 6",
		size: "4 × 6 in",
		detail: "The usual photo print."
	},
	"5:7": {
		h: 1512,
		story: false,
		print: true,
		scale: 1.5,
		label: "Photo 5 × 7",
		size: "5 × 7 in",
		detail: "A framed print."
	},
	"8:10": {
		h: 1350,
		story: false,
		print: true,
		scale: 2,
		label: "Print 8 × 10",
		size: "8 × 10 in",
		detail: "A larger print."
	},
	letter: {
		h: 1398,
		story: false,
		print: true,
		scale: 2,
		label: "US Letter",
		size: "8.5 × 11 in",
		detail: "A full sheet of paper."
	},
	a4: {
		h: 1527,
		story: false,
		print: true,
		scale: 2,
		label: "A4",
		size: "210 × 297 mm",
		detail: "A full sheet of paper."
	},
	"3:2": {
		h: 720,
		story: false,
		print: true,
		scale: 2,
		label: "Landscape 3:2",
		size: "6 × 4 in",
		detail: "A photo print on its side."
	},
	"4:3": {
		h: 810,
		story: false,
		print: true,
		scale: 2,
		label: "Landscape 4:3",
		size: "2160 × 1620",
		detail: "Wide, for slides and screens."
	},
	"16:9": {
		h: 608,
		story: false,
		print: true,
		scale: 2,
		label: "Widescreen 16:9",
		size: "2160 × 1216",
		detail: "Wider, for video and presentations."
	}
};
const RATIO_ORDER = [
	"3:4",
	"4:5",
	"1:1",
	"9:16"
];
const MORE_RATIOS = [
	"2:3",
	"5:7",
	"8:10",
	"letter",
	"a4",
	"3:2",
	"4:3",
	"16:9"
];
const DEFAULT_RATIO = "3:4";
const slideH = (p) => RATIOS[p.ratio].h;
const isStory = (p) => RATIOS[p.ratio].story;
const stripW = (p) => p.slides * SLIDE_W;
const isPrint = (p) => !!RATIOS[p.ratio].print;
const pageWord = (p, plural = false) => {
	if (isStory(p)) return plural ? "stories" : "story";
	if (isPrint(p)) return plural ? "pages" : "page";
	return plural ? "slides" : "slide";
};
const pageTitle = (p, plural = false) => {
	const word = pageWord(p, plural);
	return word[0].toUpperCase() + word.slice(1);
};
const SAFE_TOP = 250;
const SAFE_BOTTOM = 340;
const DEFAULT_BG = "#ffffff";
const LAYOUT_KEYS = [
	"ratio",
	"slides",
	"background",
	"padding",
	"seamsOpen",
	"borderWidth",
	"borderColor"
];

// components/util.js
function uuid() {
	if (crypto.randomUUID) return crypto.randomUUID();
	const b = crypto.getRandomValues(new Uint8Array(16));
	b[6] = b[6] & 15 | 64;
	b[8] = b[8] & 63 | 128;
	const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function nowISO() {
	return new Date().toISOString();
}
function esc(v) {
	return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const clamp$1 = /* @__PURE__ */ __name((v, lo, hi) => Math.min(hi, Math.max(lo, v)), "clamp");
const clone = (v) => JSON.parse(JSON.stringify(v));
function shortDate(iso) {
	const d = new Date(iso);
	const opts = {
		month: "short",
		day: "numeric"
	};
	if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
	return d.toLocaleDateString(undefined, opts);
}
function slug(name) {
	const s = String(name || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
	return s || "post";
}
function debounce(fn, ms) {
	let t;
	const run = (...args) => {
		clearTimeout(t);
		t = setTimeout(() => fn(...args), ms);
	};
	run.flush = (...args) => {
		clearTimeout(t);
		return fn(...args);
	};
	run.cancel = () => clearTimeout(t);
	return run;
}
function downloadBlob(blob, name) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 6e4);
}
function canvasToBlob(canvas, type, quality) {
	try {
		const url = canvas.toDataURL(type, quality);
		const comma = url.indexOf(",");
		if (comma < 0 || url.length < 30) throw new Error("Could not make the image");
		const mime = url.slice(5, url.indexOf(";")) || type;
		const bin = atob(url.slice(comma + 1));
		const bytes = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
		return Promise.resolve(new Blob([bytes], { type: mime }));
	} catch (e) {
		return Promise.reject(e);
	}
}
const nextFrame = () => new Promise((r) => setTimeout(r, 0));
function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.decoding = "async";
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error("Could not open the image"));
		img.src = src;
	});
}
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
const isPhone = () => window.matchMedia("(pointer: coarse)").matches;

// data/templates.js
const defaultCrop = () => ({
	zoom: 1,
	cx: .5,
	cy: .5,
	rot: 0
});
function newFrame(x, y, w, h, photoId = null) {
	return {
		id: uuid(),
		x,
		y,
		w,
		h,
		photoId,
		crop: defaultCrop()
	};
}
function blankLayout(ratio = "3:4") {
	const h = RATIOS[ratio].h;
	return {
		ratio,
		slides: 1,
		background: DEFAULT_BG,
		padding: 0,
		seamsOpen: false,
		borderWidth: 0,
		borderColor: "#ffffff",
		frames: [newFrame(0, 0, SLIDE_W, h)]
	};
}
function layoutFromTemplate(t) {
	const out = {};
	LAYOUT_KEYS.forEach((k) => out[k] = t[k]);
	out.frames = (t.frames || []).map((f) => newFrame(f.x, f.y, f.w, f.h));
	return out;
}
function templateFromProject(p) {
	const out = {};
	LAYOUT_KEYS.forEach((k) => out[k] = p[k]);
	out.frames = p.frames.map((f) => ({
		x: f.x,
		y: f.y,
		w: f.w,
		h: f.h
	}));
	return out;
}
function starterTemplates() {
	const W = SLIDE_W;
	const H = 1440;
	const full = (i, h = H) => ({
		x: i * W,
		y: 0,
		w: W,
		h
	});
	const base = {
		background: DEFAULT_BG,
		padding: 0,
		seamsOpen: false,
		borderWidth: 0,
		borderColor: "#ffffff",
		starter: true
	};
	const B = 60;
	return [
		{
			...base,
			starterKey: "white-border",
			name: "White border",
			ratio: "3:4",
			slides: 3,
			padding: B,
			frames: [
				0,
				1,
				2
			].map((i) => ({
				x: i * W + B,
				y: B,
				w: W - 2 * B,
				h: H - 2 * B
			}))
		},
		{
			...base,
			starterKey: "panorama",
			name: "Two-slide panorama",
			ratio: "3:4",
			slides: 2,
			frames: [{
				x: 0,
				y: 0,
				w: 2 * W,
				h: H
			}]
		},
		{
			...base,
			starterKey: "panorama-singles",
			name: "Panorama plus singles",
			ratio: "3:4",
			slides: 4,
			frames: [
				{
					x: 0,
					y: 0,
					w: 2 * W,
					h: H
				},
				full(2),
				full(3)
			]
		},
		{
			...base,
			starterKey: "story",
			name: "Story full bleed",
			ratio: "9:16",
			slides: 1,
			frames: [full(0, 1920)]
		}
	].map((t, i) => ({
		...t,
		sortOrder: i
	}));
}

// components/placement.js
function placement(frame, photo) {
	const rot = frame.crop.rot || 0;
	const turned = rot % 180 !== 0;
	const rw = turned ? photo.height : photo.width;
	const rh = turned ? photo.width : photo.height;
	const s = Math.max(frame.w / rw, frame.h / rh) * Math.max(1, frame.crop.zoom || 1);
	const hx = frame.w / (2 * s) / rw;
	const hy = frame.h / (2 * s) / rh;
	const cx = clamp$1(frame.crop.cx, hx, 1 - hx);
	const cy = clamp$1(frame.crop.cy, hy, 1 - hy);
	return {
		s,
		rw,
		rh,
		cx,
		cy,
		rot,
		px: (cx - .5) * rw,
		py: (cy - .5) * rh
	};
}
function clampedCrop(frame, photo) {
	const pl = placement(frame, photo);
	return {
		...frame.crop,
		cx: pl.cx,
		cy: pl.cy
	};
}
function drawPhoto(ctx, frame, photo, src) {
	const pl = placement(frame, photo);
	ctx.translate(frame.x + frame.w / 2, frame.y + frame.h / 2);
	ctx.scale(pl.s, pl.s);
	ctx.translate(-pl.px, -pl.py);
	ctx.rotate(pl.rot * Math.PI / 180);
	ctx.drawImage(src, -photo.width / 2, -photo.height / 2, photo.width, photo.height);
}
function cssTransform(frame, photo, sw, z) {
	const pl = placement(frame, photo);
	const k = photo.width / sw;
	return `translate(${frame.w * z / 2}px,${frame.h * z / 2}px) scale(${pl.s * z}) ` + `translate(${-pl.px}px,${-pl.py}px) rotate(${pl.rot}deg) ` + `translate(${-photo.width / 2}px,${-photo.height / 2}px) scale(${k})`;
}
function rotatedCrop(crop) {
	return {
		...crop,
		rot: ((crop.rot || 0) + 90) % 360,
		cx: 1 - crop.cy,
		cy: crop.cx
	};
}

// data/spreads.js
const spreadOf = (k) => Math.floor(k / 2);
const spreadCount = (p) => Math.ceil(p.slides / 2);
function keepInSpreads(p) {
	const S = 2 * SLIDE_W;
	const end = p.slides * SLIDE_W;
	let changed = false;
	for (const f of p.frames) {
		const first = Math.floor(f.x / S) + 1;
		if (first * S >= f.x + f.w || first * S >= end || first < 1) continue;
		const lo = Math.floor((f.x + f.w / 2) / S) * S;
		const l = Math.max(f.x, lo);
		const r = Math.min(f.x + f.w, lo + S);
		f.x = l;
		f.w = Math.max(60, r - l);
		changed = true;
	}
	return changed;
}

// data/db.js
const DB_NAME = "contact-sheet";
const DB_VERSION = 1;
let dbPromise = null;
function openDb() {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
			if (!db.objectStoreNames.contains("templates")) db.createObjectStore("templates", { keyPath: "id" });
			if (!db.objectStoreNames.contains("photos")) {
				const s = db.createObjectStore("photos", { keyPath: "id" });
				s.createIndex("projectId", "projectId");
			}
			if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
		};
		req.onsuccess = () => {
			const db = req.result;
			db.onversionchange = () => {
				db.close();
				dbPromise = null;
			};
			resolve(db);
		};
		req.onerror = () => reject(req.error);
		req.onblocked = () => reject(new Error("Close Layouts in your other tabs, then try again."));
	});
	dbPromise.catch(() => {
		dbPromise = null;
	});
	return dbPromise;
}
function done(req) {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}
async function tx(stores, mode, fn) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const t = db.transaction(stores, mode);
		let result;
		Promise.resolve(fn(t)).then((r) => result = r, reject);
		t.oncomplete = () => resolve(result);
		t.onerror = () => reject(t.error);
		t.onabort = () => reject(t.error || new Error("Storage was interrupted"));
	});
}
const getAll = (store) => tx([store], "readonly", (t) => done(t.objectStore(store).getAll()));
const getOne = (store, id) => tx([store], "readonly", (t) => done(t.objectStore(store).get(id)));
function stamp(rec) {
	const now = nowISO();
	return {
		...rec,
		id: rec.id || uuid(),
		createdAt: rec.createdAt || now,
		updatedAt: now
	};
}
async function listProjects() {
	const all = await getAll("projects");
	return all.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}
const getProject = (id) => getOne("projects", id);
async function saveProject(p) {
	const rec = stamp(p);
	await tx(["projects"], "readwrite", (t) => t.objectStore("projects").put(rec));
	return rec;
}
async function saveProjectThumb(id, thumb) {
	await tx(["projects"], "readwrite", async (t) => {
		const s = t.objectStore("projects");
		const p = await done(s.get(id));
		if (p) s.put({
			...p,
			thumb
		});
	});
}
async function deleteProject(id) {
	await tx(["projects", "photos"], "readwrite", async (t) => {
		t.objectStore("projects").delete(id);
		const photos = t.objectStore("photos");
		const keys = await done(photos.index("projectId").getAllKeys(id));
		keys.forEach((k) => photos.delete(k));
	});
}
async function duplicateProject(id, name) {
	const p = await getProject(id);
	if (!p) return null;
	const photos = await photosForProject(id);
	const newId = uuid();
	const map = {};
	const copies = photos.map((ph) => {
		map[ph.id] = uuid();
		return {
			...ph,
			id: map[ph.id],
			projectId: newId
		};
	});
	const now = nowISO();
	const copy = {
		...p,
		id: newId,
		name,
		createdAt: now,
		updatedAt: now,
		photoIds: (p.photoIds || []).filter((x) => map[x]).map((x) => map[x]),
		frames: p.frames.map((f) => ({
			...f,
			photoId: f.photoId && map[f.photoId] ? map[f.photoId] : null
		}))
	};
	await tx(["projects", "photos"], "readwrite", (t) => {
		t.objectStore("projects").put(copy);
		const s = t.objectStore("photos");
		copies.forEach((c) => s.put(c));
	});
	return copy;
}
async function addPhoto(rec) {
	const r = stamp(rec);
	await tx(["photos"], "readwrite", (t) => t.objectStore("photos").put(r));
	return r;
}
const getPhoto = (id) => getOne("photos", id);
function photosForProject(projectId) {
	return tx(["photos"], "readonly", (t) => done(t.objectStore("photos").index("projectId").getAll(projectId)));
}
async function deleteUnlistedPhotos(projectId, keepIds) {
	const keep = new Set(keepIds);
	await tx(["photos"], "readwrite", async (t) => {
		const s = t.objectStore("photos");
		const keys = await done(s.index("projectId").getAllKeys(projectId));
		keys.filter((k) => !keep.has(k)).forEach((k) => s.delete(k));
	});
}
async function listTemplates() {
	const all = await getAll("templates");
	return all.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.createdAt || "").localeCompare(b.createdAt || ""));
}
const getTemplate = (id) => getOne("templates", id);
async function saveTemplate(t) {
	const rec = stamp(t);
	await tx(["templates"], "readwrite", (x) => x.objectStore("templates").put(rec));
	return rec;
}
async function saveTemplates(list) {
	const recs = list.map(stamp);
	await tx(["templates"], "readwrite", (x) => {
		const s = x.objectStore("templates");
		recs.forEach((r) => s.put(r));
	});
	return recs;
}
const deleteTemplate = (id) => tx(["templates"], "readwrite", (t) => t.objectStore("templates").delete(id));
async function getMeta(key, fallback = null) {
	const r = await getOne("meta", key);
	return r ? r.value : fallback;
}
const setMeta = (key, value) => tx(["meta"], "readwrite", (t) => t.objectStore("meta").put({
	key,
	value
}));
function askToPersist() {
	try {
		if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
	} catch {}
}

// data/slide-layouts.js
const third = 1 / 3;
const SLIDE_LAYOUTS = [
	{
		key: "full",
		name: "Full",
		cells: [[
			0,
			0,
			1,
			1
		]]
	},
	{
		key: "two-stacked",
		name: "Two stacked",
		cells: [[
			0,
			0,
			1,
			.5
		], [
			0,
			.5,
			1,
			.5
		]]
	},
	{
		key: "side-by-side",
		name: "Side by side",
		cells: [[
			0,
			0,
			.5,
			1
		], [
			.5,
			0,
			.5,
			1
		]]
	},
	{
		key: "grid-4",
		name: "Grid of 4",
		cells: [
			[
				0,
				0,
				.5,
				.5
			],
			[
				.5,
				0,
				.5,
				.5
			],
			[
				0,
				.5,
				.5,
				.5
			],
			[
				.5,
				.5,
				.5,
				.5
			]
		]
	},
	{
		key: "three-stacked",
		name: "Three stacked",
		cells: [
			[
				0,
				0,
				1,
				third
			],
			[
				0,
				third,
				1,
				third
			],
			[
				0,
				2 * third,
				1,
				third
			]
		]
	},
	{
		key: "three-across",
		name: "Three across",
		cells: [
			[
				0,
				0,
				third,
				1
			],
			[
				third,
				0,
				third,
				1
			],
			[
				2 * third,
				0,
				third,
				1
			]
		]
	},
	{
		key: "big-top",
		name: "Big top, two below",
		cells: [
			[
				0,
				0,
				1,
				.6
			],
			[
				0,
				.6,
				.5,
				.4
			],
			[
				.5,
				.6,
				.5,
				.4
			]
		]
	},
	{
		key: "big-left",
		name: "Big left, two right",
		cells: [
			[
				0,
				0,
				.6,
				1
			],
			[
				.6,
				0,
				.4,
				.5
			],
			[
				.6,
				.5,
				.4,
				.5
			]
		]
	},
	{
		key: "grid-6",
		name: "Grid of 6",
		cells: [
			0,
			1,
			2
		].flatMap((r) => [[
			0,
			r * third,
			.5,
			third
		], [
			.5,
			r * third,
			.5,
			third
		]])
	},
	{
		key: "centred",
		name: "Small, centred",
		cells: [[
			.15,
			.2,
			.7,
			.6
		]]
	},
	{
		key: "blank",
		name: "Blank",
		cells: []
	}
];
function layoutRects(p, i, layout) {
	if (layout.exact) return layout.exact.map((r) => ({
		...r,
		x: r.x + i * SLIDE_W
	}));
	const box = slideBox(p, i);
	const gap = p.padding || 0;
	const at = (f, start, size, inner) => start + f * size + (inner ? gap / 2 : 0);
	return layout.cells.map(([cx, cy, cw, ch]) => {
		const l = at(cx, box.x, box.w, cx > .001);
		const r = at(cx + cw, box.x, box.w, false) - (cx + cw < .999 ? gap / 2 : 0);
		const t = at(cy, box.y, box.h, cy > .001);
		const b = at(cy + ch, box.y, box.h, false) - (cy + ch < .999 ? gap / 2 : 0);
		return {
			x: Math.round(l),
			y: Math.round(t),
			w: Math.round(r - l),
			h: Math.round(b - t)
		};
	});
}
function framesWithinSlide(p, i) {
	const a = i * SLIDE_W;
	const b = a + SLIDE_W;
	return p.frames.filter((f) => f.x >= a - .5 && f.x + f.w <= b + .5);
}
function applySlideLayout(p, i, layout) {
	const old = framesWithinSlide(p, i);
	const photoIds = old.filter((f) => f.photoId).sort((a, b) => a.y - b.y || a.x - b.x).map((f) => f.photoId);
	const fresh = layoutRects(p, i, layout).map((r) => newFrame(r.x, r.y, r.w, r.h, photoIds.shift() || null));
	return {
		...p,
		frames: [...p.frames.filter((f) => !old.includes(f)), ...fresh]
	};
}
function layoutOfSlide(p, from) {
	const a = from * SLIDE_W;
	return {
		key: `slide-${from}`,
		name: `Same as ${pageWord(p)} ${from + 1}`,
		exact: framesWithinSlide(p, from).map((f) => ({
			x: f.x - a,
			y: f.y,
			w: f.w,
			h: f.h
		}))
	};
}
function slideBox(p, i) {
	const P = p.padding || 0;
	const H = slideH(p);
	const left = p.seamsOpen && i > 0 ? 0 : P;
	const right = p.seamsOpen && i < p.slides - 1 ? 0 : P;
	return {
		x: i * SLIDE_W + left,
		y: P,
		w: SLIDE_W - left - right,
		h: H - 2 * P
	};
}
function borderBands(p, i) {
	const P = p.padding || 0;
	if (!P) return [];
	const H = slideH(p);
	const x0 = i * SLIDE_W;
	const bands = [{
		x: x0,
		y: 0,
		w: SLIDE_W,
		h: P
	}, {
		x: x0,
		y: H - P,
		w: SLIDE_W,
		h: P
	}];
	if (!p.seamsOpen || i === 0) bands.push({
		x: x0,
		y: 0,
		w: P,
		h: H
	});
	if (!p.seamsOpen || i === p.slides - 1) bands.push({
		x: x0 + SLIDE_W - P,
		y: 0,
		w: P,
		h: H
	});
	return bands;
}

// components/render.js
function drawSlide(ctx, p, i, getSrc, { scale = 1, dx = 0, dy = 0, emptyFill = null, smooth = "high" } = {}) {
	const W = SLIDE_W;
	const H = slideH(p);
	const a = i * W;
	const b = a + W;
	ctx.save();
	ctx.setTransform(scale, 0, 0, scale, dx, dy);
	ctx.beginPath();
	ctx.rect(0, 0, W, H);
	ctx.clip();
	ctx.fillStyle = p.background;
	ctx.fillRect(0, 0, W, H);
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = smooth;
	ctx.translate(-a, 0);
	const bw = p.borderWidth || 0;
	for (const f of p.frames) {
		if (f.x >= b || f.x + f.w <= a || f.y >= H || f.y + f.h <= 0) continue;
		const got = f.photoId ? getSrc(f.photoId) : null;
		if (!got) {
			if (emptyFill) {
				ctx.fillStyle = emptyFill;
				ctx.fillRect(f.x, f.y, f.w, f.h);
			}
			continue;
		}
		ctx.save();
		ctx.beginPath();
		ctx.rect(f.x, f.y, f.w, f.h);
		ctx.clip();
		ctx.save();
		drawPhoto(ctx, f, got.photo, got.src);
		ctx.restore();
		if (bw > 0) {
			ctx.fillStyle = p.borderColor;
			const t = Math.min(bw, f.w / 2, f.h / 2);
			ctx.fillRect(f.x, f.y, f.w, t);
			ctx.fillRect(f.x, f.y + f.h - t, f.w, t);
			ctx.fillRect(f.x, f.y, t, f.h);
			ctx.fillRect(f.x + f.w - t, f.y, t, f.h);
		}
		ctx.restore();
	}
	ctx.fillStyle = p.background;
	for (const band of borderBands(p, i)) ctx.fillRect(band.x, band.y, band.w, band.h);
	ctx.restore();
}
const EMPTY = "#cdcdcd";
function previewCanvas(p, getSrc, { height = 200, from = 0, count = p.slides, gap = 0, empty = EMPTY } = {}) {
	const H = slideH(p);
	const scale = height / H;
	const sw = Math.round(SLIDE_W * scale);
	const c = document.createElement("canvas");
	const n = Math.max(1, Math.min(count, p.slides - from));
	c.width = sw * n + gap * (n - 1);
	c.height = Math.round(height);
	const ctx = c.getContext("2d", { colorSpace: "srgb" });
	for (let k = 0; k < n; k++) drawSlide(ctx, p, from + k, getSrc, {
		scale,
		dx: k * (sw + gap),
		emptyFill: empty
	});
	return c;
}

// components/toast.js
let toastTimer;
function toast(message, { action, ms = 3200 } = {}) {
	const el = document.getElementById("toast");
	el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button" class="toast-action">${esc(action.label)}</button>` : ""}`;
	el.hidden = false;
	el.classList.remove("show");
	void el.offsetWidth;
	el.classList.add("show");
	if (action) {
		el.querySelector(".toast-action").addEventListener("click", () => {
			el.hidden = true;
			action.run();
		});
	}
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		el.hidden = true;
	}, action ? ms + 2e3 : ms);
}
function hideToast() {
	clearTimeout(toastTimer);
	const el = document.getElementById("toast");
	if (el) el.hidden = true;
}

// components/icons.js
const svg = (d, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;
const ICONS = {
	play: svg("<path d=\"M8 5l11 7-11 7z\" fill=\"currentColor\"/>"),
	back: svg("<path d=\"M15 5l-7 7 7 7\"/>"),
	undo: svg("<path d=\"M9 14L4 9l5-5\"/><path d=\"M4 9h11a5 5 0 0 1 0 10h-3\"/>"),
	redo: svg("<path d=\"M15 14l5-5-5-5\"/><path d=\"M20 9H9a5 5 0 0 0 0 10h3\"/>"),
	more: svg("<circle cx=\"5\" cy=\"12\" r=\"1.6\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"12\" r=\"1.6\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"19\" cy=\"12\" r=\"1.6\" fill=\"currentColor\" stroke=\"none\"/>"),
	addFrame: svg("<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\"/><path d=\"M12 8.5v7M8.5 12h7\"/>"),
	slides: svg("<rect x=\"2\" y=\"6\" width=\"6\" height=\"12\"/><rect x=\"9\" y=\"6\" width=\"6\" height=\"12\"/><rect x=\"16\" y=\"6\" width=\"6\" height=\"12\"/>"),
	layout: svg("<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\"/><rect x=\"7\" y=\"7\" width=\"10\" height=\"10\"/>"),
	format: svg("<rect x=\"6\" y=\"3\" width=\"12\" height=\"18\"/><path d=\"M3 8V3h3M21 16v5h-3\"/>"),
	grid: svg("<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\"/><path d=\"M9 3v18M15 3v18M3 9h18M3 15h18\"/>"),
	safe: svg("<rect x=\"6\" y=\"2\" width=\"12\" height=\"20\"/><path d=\"M6 6h12M6 17h12\"/>"),
	zoomOut: svg("<circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\"/><path d=\"M15.5 15.5L21 21M7.5 10.5h6\"/>"),
	zoomIn: svg("<circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\"/><path d=\"M15.5 15.5L21 21M7.5 10.5h6M10.5 7.5v6\"/>"),
	adjust: svg("<path d=\"M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3\"/>"),
	rotate: svg("<path d=\"M20 11a8 8 0 1 0-2.3 5.7\"/><path d=\"M20 4v7h-7\"/>"),
	swap: svg("<path d=\"M4 8h14l-4-4M20 16H6l4 4\"/>"),
	photo: svg("<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\"/><circle cx=\"9\" cy=\"10\" r=\"1.8\"/><path d=\"M21 16l-5-5-8 8\"/>"),
	fit: svg("<rect x=\"3\" y=\"6\" width=\"18\" height=\"12\"/><path d=\"M8 12h8M8 12l2-2M8 12l2 2M16 12l-2-2M16 12l-2 2\"/>"),
	copy: svg("<rect x=\"8\" y=\"8\" width=\"13\" height=\"13\"/><path d=\"M16 8V3H3v13h5\"/>"),
	trash: svg("<path d=\"M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3\"/>"),
	plus: svg("<path d=\"M12 5v14M5 12h14\"/>"),
	x: svg("<path d=\"M6 6l12 12M18 6L6 18\"/>"),
	export: svg("<path d=\"M12 15V4M7.5 8.5L12 4l4.5 4.5\"/><path d=\"M5 13v7h14v-7\"/>"),
	up: svg("<path d=\"M6 15l6-6 6 6\"/>"),
	down: svg("<path d=\"M6 9l6 6 6-6\"/>"),
	check: svg("<path d=\"M5 12.5l4.5 4.5L19 7.5\"/>", " stroke-width=\"3\""),
	contents: svg("<path d=\"M12 6.5V20\"/><path d=\"M12 6.5C10 5 7 4.6 3 5v13.5c4-.4 7 0 9 1.5 2-1.5 5-1.9 9-1.5V5c-4-.4-7 0-9 1.5z\"/>"),
	shut: svg("<rect x=\"5\" y=\"3\" width=\"14\" height=\"18\" rx=\"1.5\"/><path d=\"M9 3v18\"/>"),
	menu: svg("<path d=\"M4 7h16M4 12h16M4 17h16\"/>", " stroke-width=\"1.8\""),
	sun: svg("<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4\"/>")
};

// components/frame.js
const OUT = 0;
const RIM$1 = 0;
const GAP = 16;
const PEEK = 0 + 0 + 16;
const PAGE_RATIO = .74;
const MIN_TWO = 300;
function bookSize(w, h) {
	const cap = (h - 2 * 0) * PAGE_RATIO + 0 + 16;
	const half = w / 2 - 0;
	const two = half >= MIN_TWO;
	const both = Math.min(half, cap);
	return {
		two,
		both,
		one: two ? both : Math.min(w - 0 - 16, cap)
	};
}
const bookLeft = (w, page) => 2 * page + 2 * 0 <= w + 1 ? (w - 2 * page) / 2 : 0;

// pages/editor-sizes.js
const SNAP_PX = 9;
const ROOM = 34;
const lineH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--lh")) || 32;
const SAFE_KEY = "contact-sheet-safe-zone";
const SNAP_KEYS = [
	"name",
	...LAYOUT_KEYS,
	"frames",
	"photoIds"
];

// pages/editor-layout.js
function addLayout(ed) {
	Object.assign(ed, {
		wsSize,
		fitZ,
		layout,
		placeBook,
		placeWhere,
		setZoom,
		visibleSlide,
		pageX,
		scrollToX,
		showSlide,
		fitTo,
		fitIfNeeded,
		flipTo,
		turnPage,
		toUnits
	});
	function wsSize() {
		return {
			w: ed.ws.clientWidth || 360,
			h: ed.ws.clientHeight || 480
		};
	}
	const sizes = () => bookSize(wsSize().w, ed.nbEl.offsetHeight);
	function fitZ(mode) {
		const { h } = wsSize();
		const g = sizes();
		const room = (mode === "all" ? g.both : g.one) - 0 - 16;
		return Math.max(.02, Math.min(room / SLIDE_W, (h - 34 - (ed.nameEl.offsetHeight || 110)) / ed.H()));
	}
	function pageW() {
		const g = sizes();
		if (ed.zoomFit === "all") return g.both;
		if (ed.zoomFit === "one") return g.one;
		return Math.max(SLIDE_W * ed.z + 0 + 16, g.both);
	}
	const minZ = () => fitZ("all") * .85;
	ed.minZ = minZ;
	const maxZ = () => fitZ("one") * 4;
	ed.maxZ = maxZ;
	function layout() {
		const { w, h } = wsSize();
		const sw = SLIDE_W * ed.z;
		const total = ed.p.slides * sw;
		const sh = ed.H() * ed.z;
		const both = 2 * sw;
		ed.spread = clamp$1(ed.spread, 0, spreadCount(ed.p) - 1);
		const pw = pageW();
		ed.bookX = bookLeft(w, pw);
		ed.pageLeft = ed.bookX + pw - sw;
		ed.margX = ed.pageLeft - ed.spread * both;
		const room = Math.max(34, (h - sh - (ed.nameEl.offsetHeight || 110)) / 2);
		ed.margY = Math.max(lineH(), Math.round(room));
		ed.inner.style.width = `${2 * pw + 2 * ed.bookX}px`;
		ed.inner.style.height = `${Math.max(h, sh + ed.margY + room)}px`;
		ed.strip.style.left = `${ed.margX}px`;
		ed.strip.style.top = `${ed.margY}px`;
		ed.strip.style.width = `${total}px`;
		ed.strip.style.height = `${sh}px`;
		ed.strip.style.background = ed.p.background;
		const a = ed.spread * both;
		const b = Math.min(total, a + both);
		ed.strip.style.clipPath = `inset(0 ${total - b}px 0 ${a}px)`;
		Object.assign(ed.shadowEl.style, {
			left: `${ed.margX + a}px`,
			top: `${ed.margY}px`,
			width: `${b - a}px`,
			height: `${sh}px`
		});
		ed.nbEl.style.width = `${2 * pw}px`;
		ed.editorEl.style.setProperty("--ed-in", `${2 * pw + 2 * 0 <= w + 1 ? ed.bookX + 0 + 16 : 16}px`);
		placeBook();
		placeAdd();
		placeName();
		placeWhere();
	}
	function placeBook(extra = 0) {
		const t = `translateX(${ed.bookX - ed.ws.scrollLeft - extra}px)`;
		ed.nbEl.style.transform = t;
	}
	function placeName() {
		const { h } = wsSize();
		const under = Math.min(h, ed.margY + ed.H() * ed.z);
		const top = Math.round(ed.ws.offsetTop + Math.max(0, Math.min(under + 14, h - ed.nameEl.offsetHeight)));
		ed.nameEl.style.top = `${top}px`;
		ed.nameEl.classList.toggle("is-over", ed.ws.offsetTop + under > top);
	}
	function placeAdd() {
		ed.addBtn.hidden = ed.p.slides >= 20;
	}
	function placeWhere() {
		const n = ed.p.slides;
		const one = ed.zoomFit === "one" ? visibleSlide() : null;
		const first = one ?? firstPage();
		const last = one ?? lastPage();
		ed.whereEl.textContent = first === last ? `${pageWord(ed.p)} ${first + 1} of ${n}` : `${pageWord(ed.p, true)} ${first + 1} and ${last + 1} of ${n}`;
		const count = spreadCount(ed.p);
		ed.dotsEl.innerHTML = count > 1 ? Array.from({ length: count }, (_, i) => `<i${i === ed.spread ? " class=\"on\"" : ""}></i>`).join("") : "";
	}
	function setZoom(nz, cx, cy) {
		const r = ed.ws.getBoundingClientRect();
		if (cx === undefined) {
			cx = r.left + r.width / 2;
			cy = r.top + r.height / 2;
		}
		const u = toUnits(cx, cy);
		ed.z = clamp$1(nz, minZ(), maxZ());
		ed.zoomFit = null;
		ed.renderStrip();
		ed.ws.scrollLeft = ed.margX + u.x * ed.z - (cx - r.left);
		ed.ws.scrollTop = ed.margY + u.y * ed.z - (cy - r.top);
		ed.renderTools();
	}
	const firstPage = () => ed.spread * 2;
	ed.firstPage = firstPage;
	const lastPage = () => Math.min(ed.p.slides - 1, ed.spread * 2 + 1);
	ed.lastPage = lastPage;
	function visibleSlide() {
		if (ed.zoomFit === "all" && ed.touched !== null && spreadOf(ed.touched) === ed.spread && ed.touched < ed.p.slides) return ed.touched;
		const { w } = wsSize();
		const k = Math.floor((ed.ws.scrollLeft + w / 2 - ed.margX) / (SLIDE_W * ed.z));
		return clamp$1(k, firstPage(), lastPage());
	}
	function pageX(k) {
		const { w } = wsSize();
		const max = Math.max(0, ed.inner.offsetWidth - w);
		if (ed.zoomFit === "one") return k % 2 ? max : 0;
		return clamp$1(ed.pageLeft + (k % 2 + .5) * SLIDE_W * ed.z - w / 2, 0, max);
	}
	function scrollToX(x, ms = 260) {
		ed.stopInertia();
		const from = ed.ws.scrollLeft;
		const t0 = performance.now();
		const step = (now) => {
			const t = clamp$1((now - t0) / ms, 0, 1);
			ed.ws.scrollLeft = from + (x - from) * (1 - (1 - t) ** 3);
			ed.inertia = t < 1 ? requestAnimationFrame(step) : 0;
		};
		ed.inertia = requestAnimationFrame(step);
	}
	function showSlide(k) {
		if (spreadOf(k) !== ed.spread) flipTo(spreadOf(k), k);
		else if (ed.zoomFit !== "all") scrollToX(pageX(k));
	}
	function fitTo(mode, slide = visibleSlide()) {
		ed.zoomFit = mode;
		ed.z = fitZ(mode);
		ed.spread = spreadOf(slide);
		ed.renderStrip();
		ed.ws.scrollLeft = mode === "one" ? pageX(slide) : 0;
		ed.ws.scrollTop = Math.max(0, (ed.inner.offsetHeight - wsSize().h) / 2);
		ed.renderTools();
	}
	function fitIfNeeded() {
		if (ed.zoomFit) {
			ed.spread = clamp$1(ed.spread, 0, spreadCount(ed.p) - 1);
			const k = visibleSlide();
			ed.z = fitZ(ed.zoomFit);
			ed.renderStrip();
			if (ed.zoomFit === "one") ed.ws.scrollLeft = pageX(k);
		} else {
			ed.z = clamp$1(ed.z, minZ(), maxZ());
		}
	}
	function flipTo(s, page = s * 2) {
		if (ed.flipping || ed.destroyed) return;
		s = clamp$1(s, 0, spreadCount(ed.p) - 1);
		if (s === ed.spread) return;
		ed.flipping = true;
		ed.stopInertia();
		ed.touched = null;
		ed.sel = null;
		ed.photoMode = false;
		ed.placeSel();
		ed.renderTools();
		ed.renderAdjust();
		const land = (k) => ed.zoomFit === "one" ? pageX(k) : ed.zoomFit === "all" ? 0 : ed.ws.scrollLeft;
		const dir = s > ed.spread ? 1 : -1;
		const swap = () => {
			ed.spread = s;
			ed.renderStrip();
			ed.ws.scrollLeft = land(page);
		};
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			swap();
			ed.flipping = false;
			return;
		}
		const shift = Math.round(Math.min(wsSize().w, 480) * .3);
		const ease = "cubic-bezier(.3, .6, .3, 1)";
		ed.inner.style.transition = `transform 130ms ${ease}, opacity 130ms linear`;
		ed.inner.style.transform = `translateX(${-dir * shift}px)`;
		ed.inner.style.opacity = "0";
		setTimeout(() => {
			if (ed.destroyed) return;
			swap();
			ed.inner.style.transition = "none";
			ed.inner.style.transform = `translateX(${dir * shift}px)`;
			void ed.inner.offsetWidth;
			ed.inner.style.transition = `transform 240ms ${ease}, opacity 180ms linear`;
			ed.inner.style.transform = "";
			ed.inner.style.opacity = "";
			setTimeout(() => {
				ed.inner.style.transition = "";
				ed.flipping = false;
			}, 250);
		}, 130);
	}
	function turnPage(dir) {
		if (ed.flipping) return;
		if (ed.zoomFit === "one") {
			const k = visibleSlide() + dir;
			if (k >= 0 && k < ed.p.slides) showSlide(k);
		} else if (ed.spread + dir >= 0 && ed.spread + dir < spreadCount(ed.p)) {
			flipTo(ed.spread + dir);
		}
	}
	function toUnits(cx, cy) {
		const r = ed.strip.getBoundingClientRect();
		return {
			x: (cx - r.left) / ed.z,
			y: (cy - r.top) / ed.z
		};
	}
}

// data/slides.js
function anchorSlide(f, slides) {
	return clamp$1(Math.floor((f.x + .5) / SLIDE_W), 0, slides - 1);
}
function framesOnSlide(p, i) {
	const a = i * SLIDE_W;
	const b = a + SLIDE_W;
	const H = slideH(p);
	return p.frames.filter((f) => f.x < b && f.x + f.w > a && f.y < H && f.y + f.h > 0);
}
function insertSlide(p, k) {
	const at = k * SLIDE_W;
	return {
		...p,
		slides: p.slides + 1,
		frames: p.frames.map((f) => f.x >= at - .5 ? {
			...f,
			x: f.x + SLIDE_W
		} : f)
	};
}
function removeSlide(p, k) {
	const a = k * SLIDE_W;
	const b = a + SLIDE_W;
	const frames = [];
	for (const f of p.frames) {
		const l = f.x;
		const r = f.x + f.w;
		const overlap = Math.max(0, Math.min(r, b) - Math.max(l, a));
		if (overlap >= f.w - .5) continue;
		if (l >= b - .5) frames.push({
			...f,
			x: f.x - SLIDE_W
		});
		else if (r <= a + .5) frames.push(f);
		else if (l < a && r > b) frames.push({
			...f,
			w: f.w - SLIDE_W
		});
		else if (l < a) frames.push({
			...f,
			w: a - l
		});
		else frames.push({
			...f,
			x: a,
			w: r - b
		});
	}
	return {
		...p,
		slides: p.slides - 1,
		frames: frames.filter((f) => f.w >= 1)
	};
}
function moveSlide(p, from, to) {
	const order = [...Array(p.slides).keys()];
	order.splice(to, 0, order.splice(from, 1)[0]);
	const newIndex = [];
	order.forEach((old, i) => newIndex[old] = i);
	return {
		...p,
		frames: p.frames.map((f) => {
			const a = anchorSlide(f, p.slides);
			return {
				...f,
				x: f.x + (newIndex[a] - a) * SLIDE_W
			};
		})
	};
}
function copySlideLayout(p, k) {
	const a = k * SLIDE_W;
	const b = a + SLIDE_W;
	const own = p.frames.filter((f) => f.x >= a - .5 && f.x + f.w <= b + .5);
	const next = insertSlide(p, k + 1);
	next.frames = [...next.frames, ...own.map((f) => newFrame(f.x + SLIDE_W, f.y, f.w, f.h))];
	return next;
}
function changeRatio(p, ratio) {
	const k = RATIOS[ratio].h / slideH(p);
	return {
		...p,
		ratio,
		padding: Math.round(p.padding * Math.min(1, k)),
		frames: p.frames.map((f) => ({
			...f,
			y: Math.round(f.y * k),
			h: Math.max(60, Math.round(f.h * k))
		}))
	};
}

// pages/editor-strip.js
function addStrip(ed) {
	Object.assign(ed, {
		dropVideo,
		placeFrame,
		renderSafe,
		placeSel,
		placeX,
		showGuides,
		showFrameGuides,
		renderStrip,
		renderTop,
		render
	});
	const frameEls = new Map();
	ed.frameEls = frameEls;
	function dropVideo(o) {
		if (!o.video) return;
		o.video.pause();
		o.video.removeAttribute("src");
		o.video.load();
		o.video.remove();
		o.video = null;
	}
	function showVideo(f, o, ph) {
		if (ph.kind !== "video" || !ph.original || spreadOf(anchorSlide(f, ed.p.slides)) !== ed.spread) {
			dropVideo(o);
			return;
		}
		if (!o.video || o.video.dataset.pid !== f.photoId) {
			dropVideo(o);
			const v = document.createElement("video");
			v.muted = true;
			v.loop = true;
			v.autoplay = true;
			v.playsInline = true;
			v.setAttribute("muted", "");
			v.setAttribute("playsinline", "");
			v.preload = "auto";
			v.dataset.pid = f.photoId;
			v.style.width = `${ph.previewW}px`;
			v.style.height = `${ph.previewH}px`;
			v.style.visibility = "hidden";
			v.addEventListener("playing", () => v.style.visibility = "", { once: true });
			v.addEventListener("error", () => o.video === v && dropVideo(o), { once: true });
			v.src = ed.videoSrc(f.photoId);
			o.img.after(v);
			o.video = v;
			v.play().catch(() => {});
		}
		o.video.style.transform = o.img.style.transform;
	}
	function placeFrame(f) {
		const o = frameEls.get(f.id);
		if (!o) return;
		const s = o.el.style;
		s.left = `${f.x * ed.z}px`;
		s.top = `${f.y * ed.z}px`;
		s.width = `${f.w * ed.z}px`;
		s.height = `${f.h * ed.z}px`;
		const ph = f.photoId && ed.photos[f.photoId];
		if (ph) {
			if (o.img.dataset.pid !== f.photoId) {
				o.img.dataset.pid = f.photoId;
				o.img.src = ed.urlOf(f.photoId);
				o.img.style.width = `${ph.previewW}px`;
				o.img.style.height = `${ph.previewH}px`;
			}
			o.img.hidden = false;
			o.img.style.transform = cssTransform(f, ph, ph.previewW, ed.z);
			showVideo(f, o, ph);
		} else {
			dropVideo(o);
			o.img.hidden = true;
			o.img.removeAttribute("src");
			delete o.img.dataset.pid;
		}
		const bw = ph ? ed.p.borderWidth || 0 : 0;
		o.line.hidden = !bw;
		if (bw) o.line.style.boxShadow = `inset 0 0 0 ${Math.max(.5, bw * ed.z)}px ${ed.p.borderColor}`;
		o.el.classList.toggle("is-empty", !ph);
		o.el.classList.toggle("is-target", ed.dropTarget === f.id);
		o.el.classList.toggle("is-roomy", f.w * ed.z >= 120 && f.h * ed.z >= 90);
	}
	function renderFrames() {
		const seen = new Set();
		ed.p.frames.forEach((f, i) => {
			let o = frameEls.get(f.id);
			if (!o) {
				const el = document.createElement("div");
				el.className = "fr";
				el.dataset.id = f.id;
				el.innerHTML = `<img alt="" draggable="false" hidden /><div class="fr-line" hidden></div>
          <div class="fr-empty"><span class="fr-plus">${ICONS.plus}</span><span class="fr-hint">Double-tap to add a photo or video</span></div>`;
				o = {
					el,
					img: el.querySelector("img"),
					line: el.querySelector(".fr-line")
				};
				frameEls.set(f.id, o);
			}
			if (ed.framesEl.children[i] !== o.el) ed.framesEl.insertBefore(o.el, ed.framesEl.children[i] || null);
			placeFrame(f);
			seen.add(f.id);
		});
		for (const [fid, o] of frameEls) {
			if (!seen.has(fid)) {
				dropVideo(o);
				o.el.remove();
				frameEls.delete(fid);
			}
		}
	}
	function box(el, r) {
		el.style.left = `${r.x * ed.z}px`;
		el.style.top = `${r.y * ed.z}px`;
		el.style.width = `${r.w * ed.z}px`;
		el.style.height = `${r.h * ed.z}px`;
	}
	function renderBands() {
		const html = [];
		for (let i = 0; i < ed.p.slides; i++) {
			for (const b of borderBands(ed.p, i)) {
				html.push(`<div class="border-band" style="left:${b.x * ed.z}px;top:${b.y * ed.z}px;width:${b.w * ed.z}px;height:${b.h * ed.z}px;background:${esc(ed.p.background)}"></div>`);
			}
		}
		ed.bandsEl.innerHTML = html.join("");
	}
	function renderSeams() {
		ed.seamsEl.innerHTML = "";
	}
	function renderSafe() {
		const on = isStory(ed.p) && ed.showSafe;
		ed.safeEl.hidden = !on;
		if (!on) return;
		let html = "";
		for (let i = 0; i < ed.p.slides; i++) {
			const x = i * SLIDE_W * ed.z;
			const w = SLIDE_W * ed.z;
			html += `<div class="safe-band top" style="left:${x}px;top:0;width:${w}px;height:${250 * ed.z}px"><span>Instagram covers this</span></div>
        <div class="safe-band bottom" style="left:${x}px;top:${(ed.H() - 340) * ed.z}px;width:${w}px;height:${340 * ed.z}px"><span>Instagram covers this</span></div>`;
		}
		ed.safeEl.innerHTML = html;
	}
	function renderLabels() {
		const sw = SLIDE_W * ed.z;
		const word = pageTitle(ed.p);
		let html = "";
		for (let i = ed.firstPage(); i <= ed.lastPage(); i++) {
			const del = ed.p.slides > 1 && sw >= 60 ? `<button type="button" class="ws-del" data-act="del-slide" data-k="${i}" aria-label="Delete ${word.toLowerCase()} ${i + 1}">${ICONS.trash}</button>` : "";
			html += `<div class="ws-label${del ? " has-del" : ""}" style="left:${ed.margX + i * sw}px;top:${ed.margY - lineH()}px;width:${sw}px"><span>${sw >= 90 ? `${word} ${i + 1}` : i + 1}</span>${del}</div>`;
		}
		ed.labelsEl.innerHTML = html;
	}
	function placeSel() {
		const f = ed.selFrame();
		ed.selEl.hidden = !f;
		if (!f) return;
		ed.selEl.style.left = `${ed.margX + f.x * ed.z}px`;
		ed.selEl.style.top = `${ed.margY + f.y * ed.z}px`;
		ed.selEl.style.width = `${f.w * ed.z}px`;
		ed.selEl.style.height = `${f.h * ed.z}px`;
		ed.selEl.classList.toggle("is-photo", ed.photoMode);
		ed.selEl.classList.toggle("has-photo", !!f.photoId);
		ed.selEl.classList.toggle("is-small", f.w * ed.z < 70 || f.h * ed.z < 70);
		placeX();
	}
	function placeX() {
		const f = ed.selFrame();
		const x = ed.selEl.querySelector(".sel-x");
		if (!f || !x) return;
		const left = ed.margX + f.x * ed.z;
		const right = left + f.w * ed.z;
		const edge = ed.ws.scrollLeft + ed.ws.clientWidth - 20;
		const over = Math.max(0, Math.min(right - edge, f.w * ed.z - 30));
		x.style.right = `${-13 + over}px`;
	}
	function showGuides(gx, gy) {
		let html = "";
		if (gx !== null && gx !== undefined) html += `<div class="guide v" style="left:${gx * ed.z}px"></div>`;
		if (gy !== null && gy !== undefined) html += `<div class="guide h" style="top:${gy * ed.z}px"></div>`;
		ed.guidesEl.innerHTML = html;
	}
	function showFrameGuides(f, onX, onY) {
		let html = "";
		if (onX) html += `<div class="guide v in-frame" style="left:${(f.x + f.w / 2) * ed.z}px;top:${f.y * ed.z}px;bottom:auto;height:${f.h * ed.z}px"></div>`;
		if (onY) html += `<div class="guide h in-frame" style="top:${(f.y + f.h / 2) * ed.z}px;left:${f.x * ed.z}px;right:auto;width:${f.w * ed.z}px"></div>`;
		ed.guidesEl.innerHTML = html;
	}
	function renderStrip() {
		ed.layout();
		renderFrames();
		renderBands();
		renderSeams();
		renderSafe();
		renderLabels();
		placeSel();
	}
	function renderTop() {
		const u = ed.toolsEl.querySelector("[data-act=\"undo\"]");
		const r = ed.toolsEl.querySelector("[data-act=\"redo\"]");
		if (u) u.disabled = ed.hi === 0;
		if (r) r.disabled = ed.hi >= ed.hist.length - 1;
		ed.nameEl.querySelector("span").textContent = ed.p.name;
	}
	function render() {
		renderStrip();
		renderTop();
		ed.renderTools();
		ed.renderTray();
		ed.renderAdjust();
	}
}

// pages/editor-tools.js
function addTools(ed) {
	Object.assign(ed, {
		renderTools,
		renderAdjust,
		usedIds,
		renderTray
	});
	const tool = (act, icon, label, { disabled = false, on = false, tone = "", name = "" } = {}) => `<button type="button" class="tool${on ? " is-on" : ""}${tone ? ` is-${tone}` : ""}" data-act="${act}"${name ? ` aria-label="${esc(name)}"` : ""}${disabled ? " disabled" : ""}><span class="tool-icon">${icon}</span><span class="tool-label">${esc(label)}</span></button>`;
	function renderTools() {
		const f = ed.selFrame();
		const history = [tool("undo", ICONS.undo, "Undo", { disabled: ed.hi === 0 }), tool("redo", ICONS.redo, "Redo", { disabled: ed.hi >= ed.hist.length - 1 })];
		if (f) {
			const has = !!f.photoId;
			ed.toolsEl.innerHTML = [
				...history,
				tool("adjust", ICONS.adjust, "Adjust", {
					disabled: !has,
					on: ed.photoMode
				}),
				tool("rotate", ICONS.rotate, "Rotate", { disabled: !has }),
				tool("swap", has ? ICONS.swap : ICONS.photo, has ? "Swap" : "Photo"),
				tool("fit", ICONS.fit, "Fit", { disabled: !has }),
				tool("frame-more", ICONS.more, "More"),
				tool("delete", ICONS.trash, "Delete", { tone: "danger" })
			].join("");
			return;
		}
		ed.toolsEl.innerHTML = [
			tool("back", ICONS.back, "Back", { name: "Back to all layouts" }),
			...history,
			tool("add-frame", ICONS.addFrame, "Box"),
			tool("slides", ICONS.slides, pageTitle(ed.p, true)),
			tool("layout", ICONS.layout, "Grid"),
			tool("more", ICONS.more, "More"),
			tool("export", ICONS.export, "Export", { tone: "accent" })
		].join("");
	}
	function renderAdjust() {
		const f = ed.selFrame();
		const on = !!(ed.photoMode && f && f.photoId);
		ed.adjustEl.hidden = !on;
		if (on) ed.zoomInput.value = String(f.crop.zoom || 1);
	}
	function usedIds() {
		return new Set(ed.p.frames.map((f) => f.photoId).filter(Boolean));
	}
	function renderTray() {
		const used = usedIds();
		const items = ed.p.photoIds.filter((pid) => ed.photos[pid]).map((pid) => `<button type="button" class="tray-item${used.has(pid) ? " is-used" : ""}" data-pid="${pid}" aria-label="${used.has(pid) ? "Photo in use" : "Photo"}">
          <img src="${ed.thumbOf(pid)}" alt="" draggable="false" />${ed.photos[pid].kind === "video" ? "<span class=\"tray-vid\"></span>" : ""}${used.has(pid) ? `<span class="tray-used">${ICONS.check}</span>` : ""}</button>`).join("");
		const was = ed.trayEl.querySelector("[data-tray-list]");
		const keep = was ? was.scrollLeft : 0;
		ed.trayEl.innerHTML = `
      <button type="button" class="tray-add" data-act="add-photos">${ICONS.plus}<span>Photos</span></button>
      <div class="tray-list" data-tray-list>${items || "<p class=\"tray-hint\">Add photos and videos from your camera roll. They fill empty boxes in order.</p>"}</div>`;
		ed.trayEl.querySelector("[data-tray-list]").scrollLeft = keep;
	}
}

// components/sheet.js
const X_ICON = "<svg class=\"x-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\"><path d=\"M6 6l12 12M18 6L6 18\"/></svg>";
const open = [];
document.addEventListener("keydown", (e) => {
	if (e.key === "Escape" && open.length) {
		e.stopPropagation();
		open[open.length - 1].close();
	}
});
const sheetIsOpen = () => open.length > 0;
function openSheet({ title, body = "", className = "", onClose } = {}) {
	const opener = document.activeElement;
	const overlay = document.createElement("div");
	overlay.className = "sheet-overlay";
	overlay.style.zIndex = String(50 + open.length * 2);
	overlay.innerHTML = `
    <div class="sheet ${esc(className)}" role="dialog" aria-modal="true" aria-labelledby="sheetTitle${open.length}">
      <header class="sheet-header">
        <h2 id="sheetTitle${open.length}">${esc(title)}</h2>
        <button type="button" class="close-btn" data-close aria-label="Close">${X_ICON}</button>
      </header>
      <div class="sheet-body">${body}</div>
    </div>`;
	document.body.appendChild(overlay);
	document.body.classList.add("sheet-open");
	const el = overlay.querySelector(".sheet");
	const api = {
		el,
		overlay,
		body: el.querySelector(".sheet-body"),
		setTitle(t) {
			el.querySelector(".sheet-header h2").textContent = t;
		},
		close(result) {
			if (!overlay.isConnected) return;
			overlay.remove();
			open.splice(open.indexOf(api), 1);
			if (!open.length) document.body.classList.remove("sheet-open");
			if (opener && opener.isConnected && opener.focus) opener.focus({ preventScroll: true });
			if (onClose) onClose(result);
		}
	};
	open.push(api);
	const openedAt = performance.now();
	overlay.addEventListener("click", (e) => {
		if (performance.now() - openedAt < 450) {
			e.stopPropagation();
			e.preventDefault();
		}
	}, true);
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay || e.target.closest("[data-close]")) api.close();
	});
	el.setAttribute("tabindex", "-1");
	el.focus({ preventScroll: true });
	return api;
}
function closeAllSheets() {
	while (open.length) open[open.length - 1].close();
}

// components/dialogs.js
function confirmSheet({ title, message = "", confirmLabel = "OK", cancelLabel = "Cancel", danger = false }) {
	return new Promise((resolve) => {
		let answer = false;
		const s = openSheet({
			title,
			className: "sheet-small",
			body: `
        ${message ? `<p class="sheet-message">${message}</p>` : ""}
        <div class="sheet-actions">
          <button type="button" class="btn secondary" data-no>${esc(cancelLabel)}</button>
          <button type="button" class="btn ${danger ? "danger" : "primary"}" data-yes>${esc(confirmLabel)}</button>
        </div>`,
			onClose: () => resolve(answer)
		});
		s.body.querySelector("[data-no]").addEventListener("click", () => s.close());
		s.body.querySelector("[data-yes]").addEventListener("click", () => {
			answer = true;
			s.close();
		});
	});
}
function choiceSheet({ title, message = "", options, footer = "" }) {
	return new Promise((resolve) => {
		let answer = null;
		const s = openSheet({
			title,
			className: "sheet-small",
			body: `
        ${message ? `<p class="sheet-message">${message}</p>` : ""}
        <div class="choice-list">
          ${options.map((o) => o.heading ? `<span class="field-label choice-heading">${esc(o.heading)}</span>` : `<button type="button" class="choice${o.current ? " current" : ""}${o.danger ? " is-danger" : ""}" data-key="${esc(o.key)}">
                ${o.icon || ""}<span class="choice-text"><span class="choice-label">${esc(o.label)}</span>
                ${o.detail ? `<span class="choice-detail">${esc(o.detail)}</span>` : ""}</span></button>`).join("")}
        </div>${footer}`,
			onClose: () => resolve(answer)
		});
		s.body.querySelectorAll(".choice").forEach((b) => b.addEventListener("click", () => {
			answer = b.dataset.key;
			s.close();
		}));
	});
}
function promptSheet({ title, label = "Name", value = "", confirmLabel = "Save", placeholder = "", allowEmpty = false }) {
	return new Promise((resolve) => {
		let answer = null;
		const s = openSheet({
			title,
			className: "sheet-small",
			body: `
        <form class="form" data-form>
          <label class="field">
            <span class="field-label">${esc(label)}</span>
            <input type="text" name="v" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="80" autocomplete="off" enterkeyhint="done" />
          </label>
          <div class="sheet-actions">
            <button type="button" class="btn secondary" data-no>Cancel</button>
            <button type="submit" class="btn primary">${esc(confirmLabel)}</button>
          </div>
        </form>`,
			onClose: () => resolve(answer)
		});
		const form = s.body.querySelector("[data-form]");
		const input = form.querySelector("input");
		s.body.querySelector("[data-no]").addEventListener("click", () => s.close());
		form.addEventListener("submit", (e) => {
			e.preventDefault();
			const v = input.value.trim();
			if (!v && !allowEmpty) {
				input.focus();
				return;
			}
			answer = v;
			s.close();
		});
		setTimeout(() => {
			input.focus();
			input.select();
		}, 60);
	});
}

// pages/editor-frames.js
function addFrameActions(ed) {
	Object.assign(ed, {
		select,
		deselect,
		putPhoto,
		emptyFrames,
		addFrame,
		rotateSel,
		fitSel,
		takeOut,
		deleteSlide,
		deleteSel,
		frameMore
	});
	function select(fid) {
		if (ed.sel !== fid) ed.photoMode = false;
		ed.sel = fid;
		ed.placeSel();
		ed.renderTools();
		ed.renderAdjust();
	}
	function deselect() {
		if (!ed.sel && !ed.photoMode) return;
		ed.sel = null;
		ed.photoMode = false;
		ed.placeSel();
		ed.renderTools();
		ed.renderAdjust();
	}
	function putPhoto(f, pid) {
		f.photoId = pid;
		f.crop = defaultCrop();
		if (!ed.p.photoIds.includes(pid)) ed.p.photoIds.push(pid);
	}
	function emptyFrames() {
		return ed.p.frames.filter((f) => !f.photoId).sort((a, b) => anchorSlide(a, ed.p.slides) - anchorSlide(b, ed.p.slides) || a.y - b.y || a.x - b.x);
	}
	function addFrame() {
		const k = ed.visibleSlide();
		const b = slideBox(ed.p, k);
		const onIt = ed.p.frames.some((f) => anchorSlide(f, ed.p.slides) === k);
		const f = onIt ? newFrame(Math.round(b.x + b.w / 4), Math.round(b.y + b.h / 4), Math.round(b.w / 2), Math.round(b.h / 2)) : newFrame(b.x, b.y, b.w, b.h);
		ed.p.frames.push(f);
		ed.sel = f.id;
		ed.photoMode = false;
		ed.render();
		ed.commit();
	}
	function rotateSel() {
		const f = ed.selFrame();
		if (!f || !f.photoId) return;
		f.crop = rotatedCrop(f.crop);
		f.crop = clampedCrop(f, ed.photos[f.photoId]);
		ed.placeFrame(f);
		ed.commit();
	}
	function fitSel() {
		const f = ed.selFrame();
		if (!f || !f.photoId) return;
		const ph = ed.photos[f.photoId];
		const turned = (f.crop.rot || 0) % 180 !== 0;
		const ar = turned ? ph.height / ph.width : ph.width / ph.height;
		const cx = f.x + f.w / 2;
		const cy = f.y + f.h / 2;
		let w = f.w;
		let h = w / ar;
		if (h > ed.H()) {
			h = f.h;
			w = h * ar;
		}
		f.w = Math.round(w);
		f.h = Math.round(h);
		f.x = Math.round(cx - f.w / 2);
		f.y = Math.round(clamp$1(cy - f.h / 2, Math.min(0, ed.H() - f.h), Math.max(0, ed.H() - f.h)));
		f.crop = {
			...defaultCrop(),
			rot: f.crop.rot || 0
		};
		ed.render();
		ed.commit();
	}
	function takeOut() {
		const f = ed.selFrame();
		if (!f || !f.photoId) return;
		f.photoId = null;
		f.crop = defaultCrop();
		ed.photoMode = false;
		ed.render();
		ed.commit();
	}
	function deleteSlide(k) {
		if (ed.p.slides <= 1) return;
		ed.apply(removeSlide(ed.p, k));
		if (ed.sel && !ed.frameById(ed.sel)) {
			ed.sel = null;
			ed.photoMode = false;
		}
		ed.fitIfNeeded();
		ed.render();
		ed.commit();
	}
	function deleteSel() {
		if (!ed.sel) return;
		ed.p.frames = ed.p.frames.filter((f) => f.id !== ed.sel);
		ed.sel = null;
		ed.photoMode = false;
		ed.render();
		ed.commit();
	}
	async function frameMore() {
		const f = ed.selFrame();
		if (!f) return;
		const idx = ed.p.frames.indexOf(f);
		const key = await choiceSheet({
			title: "Box",
			options: [
				{
					key: "fill",
					label: `Fill the ${pageWord(ed.p)}`,
					detail: "Cover the slide, inside its border."
				},
				{
					key: "front",
					label: "Bring to front",
					detail: "Over the boxes it overlaps."
				},
				{
					key: "back",
					label: "Send to back",
					detail: "Under the boxes it overlaps."
				},
				...f.photoId ? [{
					key: "empty",
					label: "Empty this box",
					detail: "The photo stays in the tray."
				}] : []
			].filter((o) => !(o.key === "front" && idx === ed.p.frames.length - 1) && !(o.key === "back" && idx === 0))
		});
		if (!key || !ed.frameById(f.id)) return;
		if (key === "fill") {
			Object.assign(f, slideBox(ed.p, anchorSlide(f, ed.p.slides)));
			if (f.photoId) f.crop = clampedCrop(f, ed.photos[f.photoId]);
		} else if (key === "front") {
			ed.p.frames.splice(idx, 1);
			ed.p.frames.push(f);
		} else if (key === "back") {
			ed.p.frames.splice(idx, 1);
			ed.p.frames.unshift(f);
		} else if (key === "empty") {
			f.photoId = null;
			f.crop = defaultCrop();
			ed.photoMode = false;
		}
		ed.render();
		ed.commit();
	}
}

// data/photos.js
const PREVIEW_MAX = 1600;
const THUMB_MAX = 480;
function downscale(src, srcW, srcH, w, h) {
	let cur = src;
	let cw = srcW;
	let ch = srcH;
	const temps = [];
	while (cw / 2 >= w && ch / 2 >= h) {
		const c = document.createElement("canvas");
		c.width = Math.max(1, Math.round(cw / 2));
		c.height = Math.max(1, Math.round(ch / 2));
		const x = c.getContext("2d", { colorSpace: "srgb" });
		x.imageSmoothingQuality = "high";
		x.drawImage(cur, 0, 0, c.width, c.height);
		temps.push(c);
		cur = c;
		cw = c.width;
		ch = c.height;
	}
	const out = document.createElement("canvas");
	out.width = Math.max(1, Math.round(w));
	out.height = Math.max(1, Math.round(h));
	const ctx = out.getContext("2d", { colorSpace: "srgb" });
	ctx.imageSmoothingQuality = "high";
	ctx.drawImage(cur, 0, 0, out.width, out.height);
	temps.forEach((c) => {
		c.width = 0;
		c.height = 0;
	});
	return out;
}
const fit = (w, h, max) => {
	const k = Math.min(1, max / Math.max(w, h));
	return [Math.round(w * k), Math.round(h * k)];
};
async function stillsOf(src, width, height) {
	const [pw, ph] = fit(width, height, PREVIEW_MAX);
	const pc = downscale(src, width, height, pw, ph);
	const preview = await canvasToBlob(pc, "image/jpeg", .86);
	const [tw, th] = fit(width, height, THUMB_MAX);
	const tc = downscale(pc, pw, ph, tw, th);
	const thumb = await canvasToBlob(tc, "image/jpeg", .8);
	pc.width = pc.height = tc.width = tc.height = 0;
	return {
		preview,
		previewW: pw,
		previewH: ph,
		thumb
	};
}
async function importFile(projectId, file) {
	const url = URL.createObjectURL(file);
	try {
		const img = await loadImage(url);
		const width = img.naturalWidth;
		const height = img.naturalHeight;
		if (!width || !height) throw new Error("empty");
		const stills = await stillsOf(img, width, height);
		img.src = "";
		return addPhoto({
			projectId,
			name: file.name || "photo",
			type: file.type || "",
			original: file,
			width,
			height,
			...stills
		});
	} finally {
		URL.revokeObjectURL(url);
	}
}
const VIDEO_NAME = /\.(mov|mp4|m4v|webm|3gp)$/i;
const isVideoFile = (f) => (f.type || "").startsWith("video/") || !f.type && VIDEO_NAME.test(f.name || "");
function openVideo(blob, wait = 2e4) {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(blob);
		const video = document.createElement("video");
		video.muted = true;
		video.playsInline = true;
		video.setAttribute("playsinline", "");
		video.setAttribute("muted", "");
		video.preload = "auto";
		const release = () => {
			video.pause();
			video.removeAttribute("src");
			video.load();
			URL.revokeObjectURL(url);
		};
		const timer = setTimeout(() => fail(), wait);
		function fail() {
			clearTimeout(timer);
			release();
			reject(new Error("Could not open the video"));
		}
		video.onerror = fail;
		video.onloadedmetadata = async () => {
			video.onloadedmetadata = null;
			try {
				await video.play();
				video.pause();
			} catch {}
			clearTimeout(timer);
			video.onerror = null;
			resolve({
				video,
				release
			});
		};
		video.src = url;
		video.load();
	});
}
function seek(video, t) {
	return new Promise((done) => {
		const finish = () => {
			clearTimeout(timer);
			video.removeEventListener("seeked", finish);
			done();
		};
		const timer = setTimeout(finish, 5e3);
		video.addEventListener("seeked", finish);
		video.currentTime = t;
	});
}
async function importVideo(projectId, file) {
	const { video, release } = await openVideo(file);
	try {
		const width = video.videoWidth;
		const height = video.videoHeight;
		if (!width || !height) throw new Error("empty");
		const duration = Number.isFinite(video.duration) ? video.duration : 0;
		await seek(video, Math.min(.1, duration / 2));
		const stills = await stillsOf(video, width, height);
		return addPhoto({
			projectId,
			kind: "video",
			duration,
			name: file.name || "video",
			type: file.type || "",
			original: file,
			width,
			height,
			...stills
		});
	} finally {
		release();
	}
}
async function importFiles(projectId, files, onProgress) {
	const photos = [];
	const failed = [];
	const list = [...files].filter((f) => !f.type || f.type.startsWith("image/") || isVideoFile(f));
	for (let i = 0; i < list.length; i++) {
		if (onProgress) onProgress(i, list.length);
		try {
			photos.push(await (isVideoFile(list[i]) ? importVideo : importFile)(projectId, list[i]));
		} catch {
			failed.push(list[i].name || "photo");
		}
	}
	return {
		photos,
		failed,
		skipped: files.length - list.length
	};
}
function pickFiles({ multiple = true, accept = "image/*,video/*" } = {}) {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = accept;
		input.multiple = multiple;
		input.style.display = "none";
		input.addEventListener("change", () => {
			const files = [...input.files || []];
			input.remove();
			resolve(files);
		});
		input.addEventListener("cancel", () => {
			input.remove();
			resolve([]);
		});
		document.body.appendChild(input);
		input.click();
	});
}

// pages/editor-photos.js
function addPhotosInOut(ed) {
	Object.assign(ed, {
		importInto,
		addPhotos,
		openSwap,
		trayTap
	});
	async function importInto(files, targetIds = []) {
		askToPersist();
		const addLabel = ed.trayEl.querySelector(".tray-add span");
		const { photos: added, failed } = await importFiles(ed.p.id, files, (i, n) => {
			if (addLabel) addLabel.textContent = n === 1 ? "Adding" : `${i + 1} of ${n}`;
		});
		if (ed.destroyed) return;
		added.forEach((r) => {
			ed.photos[r.id] = r;
			if (!ed.p.photoIds.includes(r.id)) ed.p.photoIds.push(r.id);
		});
		if (failed.length) toast(`${failed.length === 1 ? "One file" : `${failed.length} files`} could not be opened. JPEG, PNG and MP4 work everywhere.`, { ms: 5e3 });
		const queue = added.map((r) => r.id);
		const targets = [].concat(targetIds || []).map((id) => ed.frameById(id)).filter(Boolean);
		for (const f of targets) if (queue.length) ed.putPhoto(f, queue.shift());
		const fillEmpty = () => {
			if (!targets.length) {
				for (const f of ed.emptyFrames()) if (queue.length) ed.putPhoto(f, queue.shift());
			}
		};
		const open = targets.length ? 0 : ed.emptyFrames().length;
		const extra = queue.length - open;
		ed.render();
		if (extra > 0 && ed.p.slides < 20) {
			const room = Math.min(extra, 20 - ed.p.slides);
			const word = pageWord(ed.p, room !== 1);
			const photosLine = queue.length === 1 ? "One photo" : `${queue.length} photos`;
			const key = await choiceSheet({
				title: "More photos than boxes",
				message: open ? `${photosLine}, ${open === 1 ? "one empty box" : `${open} empty boxes`}.` : `${photosLine} without a box.`,
				options: [{
					key: "slides",
					label: `Add ${room} ${word}`,
					detail: open ? `Fills the empty boxes, then one photo on each new ${pageWord(ed.p)}.` : `One photo on each new ${pageWord(ed.p)}.`
				}, {
					key: "tray",
					label: "Keep them in the tray",
					detail: "Nothing goes on the pages yet."
				}]
			});
			if (key === "slides" && !ed.destroyed) {
				fillEmpty();
				for (let n = 0; n < room && queue.length; n++) {
					ed.apply(insertSlide(ed.p, ed.p.slides));
					const b = slideBox(ed.p, ed.p.slides - 1);
					ed.p.frames.push(newFrame(b.x, b.y, b.w, b.h, queue.shift()));
				}
				ed.fitIfNeeded();
				ed.render();
			}
		} else {
			fillEmpty();
			ed.render();
		}
		ed.commit();
	}
	async function addPhotos() {
		const files = await pickFiles({ multiple: true });
		if (files.length) await importInto(files);
	}
	function slideTargets(f) {
		if (f.photoId) return [f.id];
		const k = anchorSlide(f, ed.p.slides);
		const rest = ed.p.frames.filter((o) => o !== f && !o.photoId && anchorSlide(o, ed.p.slides) === k).sort((a, b) => a.y - b.y || a.x - b.x);
		return [f.id, ...rest.map((o) => o.id)];
	}
	function pickColumns(list, current) {
		const cols = [
			[],
			[],
			[]
		];
		const tall = [
			0,
			0,
			0
		];
		for (const pid of list) {
			const ph = ed.photos[pid];
			const i = tall.indexOf(Math.min(...tall));
			cols[i].push(`<button type="button" class="pick-photo${pid === current ? " is-current" : ""}" data-pid="${pid}" style="aspect-ratio:${ph.width || 1} / ${ph.height || 1}"><img src="${ed.thumbOf(pid)}" alt="" draggable="false" />${ph.kind === "video" ? `<span class="tray-vid">${ICONS.play}</span>` : ""}<span class="pick-num"></span></button>`);
			tall[i] += (ph.height || 1) / (ph.width || 1);
		}
		return `<div class="pick-grid">${cols.map((c) => `<div class="pick-col">${c.join("")}</div>`).join("")}</div>`;
	}
	function openSwap(fid) {
		const f = ed.frameById(fid);
		if (!f) return;
		const targets = slideTargets(f);
		const max = targets.length;
		const many = max > 1;
		const list = ed.p.photoIds.filter((pid) => ed.photos[pid]);
		if (!list.length) {
			pickFiles({ multiple: many }).then((files) => files.length && importInto(files, targets));
			return;
		}
		const s = openSheet({
			title: f.photoId ? "Swap photo" : many ? "Add photos" : "Add a photo",
			className: many ? "has-footer" : "",
			body: `
        ${many ? `<p class="sheet-message">Pick up to ${max}, one for each empty box on this ${esc(pageWord(ed.p))}.</p>` : ""}
        ${pickColumns(list, f.photoId)}
        ${many ? `<div class="sheet-footer"><div class="button-stack">
              <button type="button" class="small-btn primary" data-place disabled>Place photos</button>
              <button type="button" class="small-btn secondary" data-new>+ From camera roll</button>
            </div></div>` : `<div class="button-stack">
              <button type="button" class="small-btn primary" data-new>+ From camera roll</button>
              ${f.photoId ? "<button type=\"button\" class=\"small-btn secondary\" data-empty>Empty this box</button>" : ""}
            </div>`}`
		});
		const picked = [];
		const placeBtn = s.body.querySelector("[data-place]");
		function mark() {
			s.body.querySelectorAll("[data-pid]").forEach((b) => {
				const n = picked.indexOf(b.dataset.pid);
				b.classList.toggle("is-picked", n >= 0);
				b.querySelector(".pick-num").textContent = n >= 0 ? String(n + 1) : "";
			});
			placeBtn.disabled = !picked.length;
			placeBtn.textContent = picked.length ? `Place ${picked.length} photo${picked.length === 1 ? "" : "s"}` : "Place photos";
		}
		function place() {
			picked.forEach((pid, i) => {
				const fr = ed.frameById(targets[i]);
				if (fr) ed.putPhoto(fr, pid);
			});
		}
		s.body.querySelectorAll("[data-pid]").forEach((b) => b.addEventListener("click", () => {
			const pid = b.dataset.pid;
			if (!many) {
				const fr = ed.frameById(fid);
				if (fr) ed.putPhoto(fr, pid);
				s.close();
				ed.render();
				ed.commit();
				return;
			}
			const n = picked.indexOf(pid);
			if (n >= 0) picked.splice(n, 1);
			else if (picked.length < max) picked.push(pid);
			mark();
		}));
		if (placeBtn) {
			placeBtn.addEventListener("click", () => {
				place();
				s.close();
				ed.render();
				ed.commit();
			});
		}
		s.body.querySelector("[data-new]").addEventListener("click", async () => {
			place();
			const left = targets.slice(picked.length);
			s.close();
			if (picked.length) {
				ed.render();
				ed.commit();
			}
			if (!left.length) return;
			const files = await pickFiles({ multiple: left.length > 1 });
			if (files.length) await importInto(files, left);
		});
		const emptyBtn = s.body.querySelector("[data-empty]");
		if (emptyBtn) {
			emptyBtn.addEventListener("click", () => {
				const fr = ed.frameById(fid);
				if (fr) {
					fr.photoId = null;
					fr.crop = defaultCrop();
				}
				ed.photoMode = false;
				s.close();
				ed.render();
				ed.commit();
			});
		}
	}
	function trayTap(pid) {
		const f = ed.selFrame() || ed.emptyFrames()[0];
		if (!f) return;
		ed.putPhoto(f, pid);
		ed.sel = f.id;
		ed.render();
		ed.commit();
	}
}

// pages/editor-sheets.js
function addSheets(ed) {
	Object.assign(ed, { openSlides });
	async function openSlides() {
		const get = await ed.previewSources();
		const word = pageTitle(ed.p);
		const s = openSheet({
			title: pageTitle(ed.p, true),
			className: "has-footer"
		});
		function draw() {
			const n = ed.p.slides;
			s.body.innerHTML = `
        <ol class="slide-list">
          ${Array.from({ length: n }, (_, i) => `
            <li class="slide-row">
              <button type="button" class="slide-thumb r-${ed.p.ratio.replace(":", "x")}" data-go="${i}" aria-label="Show ${word} ${i + 1}"></button>
              <span class="slide-name">${word} ${i + 1}</span>
              <span class="slide-acts">
                <button type="button" class="mini-btn" data-layout="${i}" aria-label="Change the grid">${ICONS.grid}</button>
                <button type="button" class="mini-btn" data-up="${i}" aria-label="Move earlier"${i === 0 ? " disabled" : ""}>${ICONS.up}</button>
                <button type="button" class="mini-btn" data-down="${i}" aria-label="Move later"${i === n - 1 ? " disabled" : ""}>${ICONS.down}</button>
                <button type="button" class="mini-btn" data-copy="${i}" aria-label="Copy the grid"${n >= 20 ? " disabled" : ""}>${ICONS.copy}</button>
                <button type="button" class="mini-btn" data-del="${i}" aria-label="Remove"${n <= 1 ? " disabled" : ""}>${ICONS.trash}</button>
              </span>
            </li>`).join("")}
        </ol>
        <p class="field-hint">The grid button picks a new grid for that ${pageWord(ed.p)}. Copy makes a new ${pageWord(ed.p)} with the same empty boxes. A photo that crosses a seam moves with the ${pageWord(ed.p)} it starts on.</p>
        <div class="sheet-footer">
          <button type="button" class="modal-cta primary" data-add${n >= 20 ? " disabled" : ""}>${n >= 20 ? `${20} is the most` : `+ Add a ${pageWord(ed.p)}`}</button>
        </div>`;
			s.body.querySelectorAll(".slide-thumb").forEach((b) => {
				const c = previewCanvas(ed.p, get, {
					height: 96,
					from: Number(b.dataset.go),
					count: 1
				});
				b.appendChild(c);
			});
		}
		function changed() {
			ed.fitIfNeeded();
			ed.render();
			ed.commit();
			draw();
		}
		s.body.addEventListener("click", (e) => {
			const b = e.target.closest("button");
			if (!b || b.disabled) return;
			const d = b.dataset;
			if (d.go !== undefined) {
				s.close();
				ed.showSlide(Number(d.go));
				return;
			}
			if (d.layout !== undefined || d.add !== undefined) {
				const k = d.layout !== undefined ? +d.layout : null;
				ed.pickLayout(k).then((l) => {
					if (!l || ed.destroyed || !s.overlay.isConnected) return;
					if (k === null) ed.addSlideWith(l);
					else ed.apply(applySlideLayout(ed.p, k, l));
					if (ed.sel && !ed.frameById(ed.sel)) ed.sel = null;
					changed();
				});
				return;
			}
			if (d.up !== undefined) ed.apply(moveSlide(ed.p, +d.up, +d.up - 1));
			else if (d.down !== undefined) ed.apply(moveSlide(ed.p, +d.down, +d.down + 1));
			else if (d.copy !== undefined) ed.apply(copySlideLayout(ed.p, +d.copy));
			else if (d.del !== undefined) ed.apply(removeSlide(ed.p, +d.del));
			else return;
			if (ed.sel && !ed.frameById(ed.sel)) ed.sel = null;
			changed();
		});
		draw();
	}
}

// pages/editor-slide-layouts.js
function addSlideLayouts(ed) {
	Object.assign(ed, {
		pickLayout,
		addSlideWith,
		addSlide,
		layoutThisSlide,
		topMore,
		rename,
		leave
	});
	function layoutSvg(q, k, layout) {
		const Hh = slideH(q);
		const rects = layoutRects(q, k, layout).map((r) => `<rect x="${r.x - k * SLIDE_W}" y="${r.y}" width="${r.w}" height="${r.h}" class="lay-frame"/>`).join("");
		return `<svg class="lay-svg" width="${Math.round(84 * SLIDE_W / Hh)}" height="84" viewBox="0 0 ${SLIDE_W} ${Hh}" aria-hidden="true"><rect width="${SLIDE_W}" height="${Hh}" fill="${esc(q.background)}" class="lay-slide"/>${rects}<rect width="${SLIDE_W}" height="${Hh}" class="lay-edge"/></svg>`;
	}
	function pickLayout(k) {
		const isNew = k === null;
		const word = pageWord(ed.p);
		const q = isNew ? insertSlide(ed.p, ed.p.slides) : ed.p;
		const at = isNew ? ed.p.slides : k;
		const options = [];
		if (isNew && framesWithinSlide(ed.p, ed.p.slides - 1).length) options.push(layoutOfSlide(ed.p, ed.p.slides - 1));
		options.push(...SLIDE_LAYOUTS);
		const hasPhotos = !isNew && framesWithinSlide(ed.p, k).some((f) => f.photoId);
		return new Promise((resolve) => {
			let chosen = null;
			const s = openSheet({
				title: isNew ? `New ${word}` : `${word} ${k + 1} grid`,
				className: "sheet-wide",
				body: `
          ${hasPhotos ? `<p class="sheet-message">Its photos move into the new boxes, in order.</p>` : ""}
          <div class="layout-grid">
            ${options.map((o, n) => `<button type="button" class="layout-opt" data-n="${n}">${layoutSvg(q, at, o)}<span>${esc(o.name)}</span></button>`).join("")}
          </div>
          <p class="field-hint">For space around and between the photos: the three dots at the top, then Background and borders.</p>`,
				onClose: () => resolve(chosen)
			});
			s.body.addEventListener("click", (e) => {
				const b = e.target.closest("[data-n]");
				if (!b) return;
				chosen = options[Number(b.dataset.n)];
				s.close();
			});
		});
	}
	function addSlideWith(layout) {
		ed.apply(insertSlide(ed.p, ed.p.slides));
		ed.apply(applySlideLayout(ed.p, ed.p.slides - 1, layout));
	}
	async function addSlide() {
		if (ed.p.slides >= 20) return;
		const layout = await pickLayout(null);
		if (!layout || ed.destroyed || ed.p.slides >= 20) return;
		addSlideWith(layout);
		ed.sel = null;
		ed.photoMode = false;
		ed.fitIfNeeded();
		ed.render();
		ed.showSlide(ed.p.slides - 1);
		ed.commit();
	}
	async function layoutThisSlide() {
		const k = ed.visibleSlide();
		const l = await pickLayout(k);
		if (!l || ed.destroyed) return;
		ed.apply(applySlideLayout(ed.p, k, l));
		if (ed.sel && !ed.frameById(ed.sel)) {
			ed.sel = null;
			ed.photoMode = false;
		}
		ed.render();
		ed.commit();
	}
	function openBorders() {
		const colorChips = (name, value, options) => `
      <div class="swatches" role="radiogroup">
        ${options.map(([v, label]) => `<label class="swatch"><input type="radio" name="${name}" value="${v}"${value.toLowerCase() === v ? " checked" : ""} /><span><i style="background:${v}"></i>${label}</span></label>`).join("")}
        <label class="swatch swatch-custom"><input type="radio" name="${name}" value="custom"${options.some(([v]) => v === value.toLowerCase()) ? "" : " checked"} /><span><input type="color" value="${esc(value)}" data-color="${name}" aria-label="Custom color" />Custom</span></label>
      </div>`;
		const s = openSheet({
			title: "Background and borders",
			body: `
        <div class="form">
          <div class="field">
            <span class="field-label">Background</span>
            ${colorChips("bg", ed.p.background, [["#ffffff", "White"], ["#000000", "Black"]])}
            <span class="field-hint">Shows wherever there's no photo.</span>
          </div>
          <div class="field">
            <span class="field-label">Slide border <b class="range-val" data-val="pad"></b></span>
            <input type="range" min="0" max="200" step="2" value="${ed.p.padding}" data-range="pad" />
            <span class="field-hint">An even border around each ${pageWord(ed.p)}, in the background color. Boxes also snap this far apart.</span>
            <label class="check"><input type="checkbox" data-seams${ed.p.seamsOpen ? " checked" : ""} /> Leave seams open</label>
            <span class="field-hint">No border where ${pageWord(ed.p, true)} meet, so a panorama runs straight across.</span>
          </div>
          <div class="field">
            <span class="field-label">Photo border <b class="range-val" data-val="bw"></b></span>
            <input type="range" min="0" max="80" step="1" value="${ed.p.borderWidth}" data-range="bw" />
            ${colorChips("bc", ed.p.borderColor, [["#ffffff", "White"], ["#000000", "Black"]])}
            <span class="field-hint">A line around the inside edge of every photo.</span>
          </div>
        </div>`,
			onClose: ed.commit
		});
		const b = s.body;
		const vals = () => {
			b.querySelector("[data-val=\"pad\"]").textContent = ed.p.padding ? `${ed.p.padding} px` : "Off";
			b.querySelector("[data-val=\"bw\"]").textContent = ed.p.borderWidth ? `${ed.p.borderWidth} px` : "Off";
		};
		vals();
		const live = () => {
			vals();
			ed.renderStrip();
		};
		const colorOf = (name) => {
			const r = b.querySelector(`input[name="${name}"]:checked`);
			return r.value === "custom" ? b.querySelector(`[data-color="${name}"]`).value : r.value;
		};
		b.addEventListener("input", (e) => {
			const t = e.target;
			if (t.dataset.range === "pad") ed.p.padding = Number(t.value);
			else if (t.dataset.range === "bw") ed.p.borderWidth = Number(t.value);
			else if (t.dataset.color) {
				t.closest(".swatch").querySelector("input[type=\"radio\"]").checked = true;
				if (t.dataset.color === "bg") ed.p.background = t.value;
				else ed.p.borderColor = t.value;
			} else return;
			live();
		});
		b.addEventListener("change", (e) => {
			const t = e.target;
			if (t.name === "bg") ed.p.background = colorOf("bg");
			else if (t.name === "bc") ed.p.borderColor = colorOf("bc");
			else if (t.dataset.seams !== undefined) ed.p.seamsOpen = t.checked;
			live();
			ed.commit();
		});
	}
	async function openGrid() {
		const get = await ed.previewSources();
		const s = openSheet({
			title: "Profile preview",
			body: `
        <div class="grid-preview">
          <div class="grid-tile is-post" data-post></div>
          ${Array.from({ length: 8 }, () => "<div class=\"grid-tile\"></div>").join("")}
        </div>
        <p class="field-hint">${ed.p.ratio === "3:4" ? "Your first slide fills its tile in your profile grid." : "Your profile grid shows the middle of the first slide as a 3:4 tile."}</p>`
		});
		const c = previewCanvas(ed.p, get, {
			height: 480,
			count: 1
		});
		s.body.querySelector("[data-post]").appendChild(c);
	}
	async function topMore() {
		const unused = ed.p.photoIds.filter((pid) => !ed.usedIds().has(pid));
		const both = ed.z <= ed.fitZ("all") * 1.05;
		const key = await choiceSheet({
			title: "Layout",
			options: [
				{
					key: "rename",
					label: "Rename",
					detail: "Also names the exported files."
				},
				{
					key: "zoom",
					label: both ? `See one ${pageWord(ed.p)}` : `See two ${pageWord(ed.p, true)}`,
					detail: both ? "Closer in, one at a time." : "Side by side, two at a time."
				},
				...isStory(ed.p) ? [{
					key: "safe",
					label: ed.showSafe ? "Hide safe zone" : "Show safe zone",
					detail: "The parts Instagram covers."
				}] : [],
				{
					key: "borders",
					label: "Background and borders",
					detail: "The background color, and space around the photos."
				},
				{
					key: "template",
					label: "Save as template",
					detail: "Keeps the boxes, not the photos."
				},
				...isStory(ed.p) || isPrint(ed.p) ? [] : [{
					key: "grid",
					label: "Profile preview",
					detail: "How the first slide looks in your profile grid."
				}],
				...unused.length ? [{
					key: "clear",
					label: "Remove unused photos",
					detail: `${unused.length} in the tray, not in a box.`
				}] : [],
				{
					key: "delete",
					label: "Delete layout",
					detail: "It and its photos go from this device.",
					danger: true
				}
			]
		});
		if (key === "rename") rename();
		else if (key === "zoom") ed.fitTo(both ? "one" : "all");
		else if (key === "safe") toggleSafe();
		else if (key === "borders") openBorders();
		else if (key === "template") saveAsTemplate();
		else if (key === "grid") openGrid();
		else if (key === "clear") {
			ed.p.photoIds = ed.p.photoIds.filter((pid) => ed.usedIds().has(pid));
			ed.renderTray();
			ed.commit();
		} else if (key === "delete") deleteChapter();
	}
	async function deleteChapter() {
		const ok = await confirmSheet({
			title: "Delete layout?",
			message: `<b>${esc(ed.p.name)}</b> and its photos will be deleted from this device. Photos in your camera roll stay where they are.`,
			confirmLabel: "Delete",
			danger: true
		});
		if (!ok || ed.destroyed) return;
		ed.gone = true;
		ed.commitSoon.cancel();
		ed.saveSoon.cancel();
		ed.thumbSoon.cancel();
		await deleteProject(ed.p.id);
		location.hash = "#/contents";
	}
	async function rename() {
		const v = await promptSheet({
			title: "Rename",
			value: ed.p.name
		});
		if (!v || v === ed.p.name) return;
		ed.p.name = v;
		ed.renderTop();
		ed.commit();
	}
	async function saveAsTemplate() {
		const v = await promptSheet({
			title: "Save as template",
			label: "Template name",
			value: ed.p.name,
			confirmLabel: "Save"
		});
		if (!v) return;
		const all = await listTemplates();
		const order = all.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), -1) + 1;
		await saveTemplate({
			...templateFromProject(ed.p),
			name: v,
			sortOrder: order,
			starter: false
		});
	}
	function toggleSafe() {
		ed.showSafe = !ed.showSafe;
		try {
			localStorage.setItem(SAFE_KEY, ed.showSafe ? "on" : "off");
		} catch {}
		ed.renderSafe();
		ed.renderTools();
	}
	async function leave() {
		ed.commitSoon.flush();
		ed.saveSoon.flush();
		ed.thumbSoon.cancel();
		await ed.makeThumb();
		location.hash = "#/contents";
	}
}

// data/zip.js
const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
		t[n] = c >>> 0;
	}
	return t;
})();
function crc32(bytes) {
	let c = 4294967295;
	for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ c >>> 8;
	return (c ^ 4294967295) >>> 0;
}
function dosTime(d) {
	const time = d.getHours() << 11 | d.getMinutes() << 5 | d.getSeconds() >> 1;
	const date = d.getFullYear() - 1980 << 9 | d.getMonth() + 1 << 5 | d.getDate();
	return {
		time,
		date
	};
}
async function makeZip(files) {
	const enc = new TextEncoder();
	const { time, date } = dosTime(new Date());
	const parts = [];
	const central = [];
	let offset = 0;
	for (const f of files) {
		const data = new Uint8Array(await f.blob.arrayBuffer());
		const name = enc.encode(f.name);
		const crc = crc32(data);
		const local = new DataView(new ArrayBuffer(30));
		local.setUint32(0, 67324752, true);
		local.setUint16(4, 20, true);
		local.setUint16(6, 2048, true);
		local.setUint16(8, 0, true);
		local.setUint16(10, time, true);
		local.setUint16(12, date, true);
		local.setUint32(14, crc, true);
		local.setUint32(18, data.length, true);
		local.setUint32(22, data.length, true);
		local.setUint16(26, name.length, true);
		local.setUint16(28, 0, true);
		parts.push(local, name, data);
		const cen = new DataView(new ArrayBuffer(46));
		cen.setUint32(0, 33639248, true);
		cen.setUint16(4, 20, true);
		cen.setUint16(6, 20, true);
		cen.setUint16(8, 2048, true);
		cen.setUint16(10, 0, true);
		cen.setUint16(12, time, true);
		cen.setUint16(14, date, true);
		cen.setUint32(16, crc, true);
		cen.setUint32(20, data.length, true);
		cen.setUint32(24, data.length, true);
		cen.setUint16(28, name.length, true);
		cen.setUint32(42, offset, true);
		central.push(cen, name);
		offset += 30 + name.length + data.length;
	}
	const cenSize = central.reduce((n, part) => n + part.byteLength, 0);
	const end = new DataView(new ArrayBuffer(22));
	end.setUint32(0, 101010256, true);
	end.setUint16(8, files.length, true);
	end.setUint16(10, files.length, true);
	end.setUint32(12, cenSize, true);
	end.setUint32(16, offset, true);
	return new Blob([
		...parts,
		...central,
		end
	], { type: "application/zip" });
}

// data/videoexport.js
const MAX_VIDEO_S = 60;
const FPS = 30;
const MAX_SOUND_BYTES = 300 * 1024 * 1024;
const TYPES = [
	["video/mp4;codecs=avc1.640028,mp4a.40.2", "mp4"],
	["video/mp4;codecs=avc1,mp4a.40.2", "mp4"],
	["video/mp4", "mp4"],
	["video/webm;codecs=vp9,opus", "webm"],
	["video/webm", "webm"]
];
function recorderType() {
	if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
	return TYPES.find(([t]) => MediaRecorder.isTypeSupported(t)) || null;
}
const canRecordVideo = () => !!recorderType();
const hasVideo = (p, photos, i) => framesOnSlide(p, i).some((f) => f.photoId && photos[f.photoId] && photos[f.photoId].kind === "video");
function startSound() {
	const Ctx = window.AudioContext || window.webkitAudioContext;
	if (!Ctx) return null;
	const ctx = new Ctx();
	ctx.resume().catch(() => {});
	return ctx;
}
async function soundOf(audio, photo, out, length) {
	if (!audio || photo.original.size > MAX_SOUND_BYTES) return null;
	try {
		const buffer = await audio.decodeAudioData(await photo.original.arrayBuffer());
		const node = audio.createBufferSource();
		node.buffer = buffer;
		node.loop = buffer.duration < length - .05;
		node.connect(out);
		return node;
	} catch {
		return null;
	}
}
async function recordSlide(p, photos, i, { audio, host, openSource, onTime, stillOpen }) {
	const [mime, ext] = recorderType();
	const W = SLIDE_W;
	const H = slideH(p) - slideH(p) % 2;
	const canvas = document.createElement("canvas");
	canvas.width = W;
	canvas.height = H;
	host.appendChild(canvas);
	const ctx = canvas.getContext("2d", {
		colorSpace: "srgb",
		alpha: false
	});
	const frames = framesOnSlide(p, i).filter((f) => f.photoId && photos[f.photoId]);
	const open = new Map();
	const videos = [];
	const sounds = [];
	let stream = null;
	try {
		for (const f of frames) {
			const id = f.photoId;
			if (open.has(id)) continue;
			const photo = photos[id];
			if (photo.kind === "video") {
				const opened = await openVideo(photo.original);
				videos.push(opened);
				open.set(id, {
					photo,
					src: opened.video
				});
			} else {
				const scale = Math.max(...frames.filter((o) => o.photoId === id).map((o) => placement(o, photo).s));
				const opened = await openSource(photo, scale);
				open.set(id, opened);
			}
		}
		const lengths = videos.map((v) => v.video.duration).filter(Number.isFinite);
		const length = Math.min(60, Math.max(1, ...lengths));
		videos.forEach(({ video }) => {
			video.currentTime = 0;
			video.loop = !(video.duration >= length - .05);
		});
		const draw = () => {
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			drawSlide(ctx, p, i, (id) => open.get(id) || null, { smooth: "medium" });
		};
		draw();
		stream = canvas.captureStream(FPS);
		if (audio) {
			const out = audio.createMediaStreamDestination();
			for (const [, o] of open) {
				if (o.photo.kind !== "video") continue;
				const node = await soundOf(audio, o.photo, out, length);
				if (node) sounds.push(node);
			}
			if (sounds.length) out.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
		}
		const chunks = [];
		const rec = new MediaRecorder(stream, {
			mimeType: mime,
			videoBitsPerSecond: 12e6,
			audioBitsPerSecond: 16e4
		});
		rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
		const stopped = new Promise((done, fail) => {
			rec.onstop = done;
			rec.onerror = () => fail(new Error("Recording failed"));
		});
		await Promise.all(videos.map(({ video }) => video.play()));
		rec.start(1e3);
		sounds.forEach((n) => n.start());
		const t0 = performance.now();
		await new Promise((done, fail) => {
			let over = false;
			const end = (err) => {
				if (over) return;
				over = true;
				clearTimeout(guard);
				document.removeEventListener("visibilitychange", away);
				if (err) fail(err);
				else done();
			};
			const away = () => document.hidden && end(new Error("The app was put away"));
			document.addEventListener("visibilitychange", away);
			const guard = setTimeout(end, length * 1e3 + 500);
			const step = () => {
				if (over) return;
				if (!stillOpen()) return end(new Error("Closed"));
				const t = (performance.now() - t0) / 1e3;
				if (t >= length) return end();
				draw();
				if (onTime) onTime(t, length);
				requestAnimationFrame(step);
			};
			requestAnimationFrame(step);
		});
		rec.stop();
		await stopped;
		const type = mime.split(";")[0];
		return {
			blob: new Blob(chunks, { type }),
			mime: type,
			ext,
			width: W,
			height: H,
			isVideo: true
		};
	} finally {
		sounds.forEach((n) => {
			try {
				n.stop();
			} catch {}
			n.disconnect();
		});
		if (stream) stream.getTracks().forEach((t) => t.stop());
		videos.forEach((v) => v.release());
		open.forEach((o) => o.release && o.release());
		canvas.remove();
		canvas.width = canvas.height = 0;
	}
}

// components/band.js
const ring = (label, attr, svg) => `<button type="button" class="ring-btn" ${attr} aria-label="${esc(label)}"><span>${svg}</span></button>`;
const line = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const BOOKS = "<svg viewBox=\"0 0 24 24\" width=\"19\" height=\"19\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3\" y=\"5\" width=\"4.5\" height=\"14\" rx=\"1\"/><rect x=\"9.5\" y=\"3\" width=\"4.5\" height=\"16\" rx=\"1\"/><path d=\"M16 6.2l3.6-1 3 12.6-3.6 1z\"/></svg>";
const PLUS = line("<line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/><line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/>");
const MENU = line("<line x1=\"4\" y1=\"7\" x2=\"20\" y2=\"7\"/><line x1=\"4\" y1=\"12\" x2=\"20\" y2=\"12\"/><line x1=\"4\" y1=\"17\" x2=\"20\" y2=\"17\"/>");
const MARK = "<svg class=\"band-mark\" viewBox=\"0 0 80 40\" aria-hidden=\"true\"><rect x=\"6\" width=\"20\" height=\"40\" class=\"mk-p\"/><rect x=\"32\" y=\"8\" width=\"20\" height=\"32\" class=\"mk-w\"/><rect x=\"58\" y=\"14.4\" width=\"20\" height=\"25.6\" class=\"mk-p\"/></svg>";
const BACK = line("<polyline points=\"15 5 8 12 15 19\"/>");
const CLOSE = line("<line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/>");
const MORE$1 = "<svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" aria-hidden=\"true\"><circle cx=\"5\" cy=\"12\" r=\"1.8\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"12\" r=\"1.8\" fill=\"currentColor\"/><circle cx=\"19\" cy=\"12\" r=\"1.8\" fill=\"currentColor\"/></svg>";
const bandDate = (d = new Date()) => d.toLocaleDateString("en-GB", {
	weekday: "short",
	day: "numeric",
	month: "short"
}).replace(",", "");
function bandHtml({ title, place }) {
	return `
    <header class="band">
      <h1 class="band-title">${esc(title)}</h1>
      <div class="band-btns">${ring("Back to your notebooks", "data-books", BOOKS)}${ring("Options", "data-app-menu", MENU)}</div>
      ${MARK}
      <p class="band-line"><b>${esc(place)}</b><span class="band-rule"></span><span class="band-date">${bandDate()}</span></p>
    </header>`;
}
function shortBandHtml({ name, backAttr, backLabel = "Back", end = null }) {
	const right = end ? ring(end.label, end.attr, end.svg) : "<span class=\"ring-btn\" aria-hidden=\"true\"></span>";
	return `
    <header class="band band-short">
      ${ring(backLabel, backAttr, BACK)}
      <p class="band-line"><b>${esc(name)}</b><span class="band-rule"></span></p>
      ${right}
    </header>`;
}

// data/slide-images.js
async function openSource(photo, scale) {
	const url = URL.createObjectURL(photo.kind === "video" ? photo.preview : photo.original || photo.preview);
	try {
		const img = await loadImage(url);
		const tw = Math.ceil(photo.width * scale);
		const th = Math.ceil(photo.height * scale);
		if (img.naturalWidth / 2 >= tw && img.naturalHeight / 2 >= th) {
			const c = downscale(img, img.naturalWidth, img.naturalHeight, tw, th);
			img.src = "";
			return {
				photo,
				src: c,
				release: () => c.width = c.height = 0
			};
		}
		return {
			photo,
			src: img,
			release: () => img.src = ""
		};
	} finally {
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}
}
const exportScale = (p) => RATIOS[p.ratio].scale || 1;
async function renderSlides(p, photos, type, onProgress, { thumbs = true, scale = exportScale(p), only = null } = {}) {
	const k = scale;
	const list = only || Array.from({ length: p.slides }, (_, i) => i);
	const W = Math.round(SLIDE_W * k);
	const H = Math.round(slideH(p) * k);
	const mime = type === "png" ? "image/png" : "image/jpeg";
	const ext = type === "png" ? "png" : "jpg";
	const base = slug(p.name);
	const canvas = document.createElement("canvas");
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext("2d", { colorSpace: "srgb" });
	const needs = list.map((i) => new Set(framesOnSlide(p, i).filter((f) => f.photoId && photos[f.photoId]).map((f) => f.photoId)));
	const scaleOf = {};
	for (const f of p.frames) {
		if (!f.photoId || !photos[f.photoId]) continue;
		scaleOf[f.photoId] = Math.max(scaleOf[f.photoId] || 0, placement(f, photos[f.photoId]).s);
	}
	const open = new Map();
	const out = [];
	try {
		for (let n = 0; n < list.length; n++) {
			const i = list[n];
			if (onProgress) onProgress(n, list.length);
			await nextFrame();
			for (const id of needs[n]) {
				if (!open.has(id)) open.set(id, await openSource(photos[id], scaleOf[id] * k));
			}
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.fillStyle = p.background;
			ctx.fillRect(0, 0, W, H);
			drawSlide(ctx, p, i, (id) => open.get(id) || null, { scale: k });
			const blob = await canvasToBlob(canvas, mime, type === "png" ? undefined : .95);
			let thumb = null;
			if (thumbs) {
				const t = document.createElement("canvas");
				t.height = 240;
				t.width = Math.round(240 * W / H);
				t.getContext("2d").drawImage(canvas, 0, 0, t.width, t.height);
				thumb = await canvasToBlob(t, "image/jpeg", .8);
				t.width = t.height = 0;
			}
			out.push({
				name: `${base}-${String(i + 1).padStart(2, "0")}.${ext}`,
				blob,
				thumb,
				mime,
				width: W,
				height: H
			});
			const next = needs[n + 1] || new Set();
			for (const [id, s] of open) {
				if (!next.has(id)) {
					s.release();
					open.delete(id);
				}
			}
		}
	} finally {
		open.forEach((s) => s.release());
		canvas.width = canvas.height = 0;
	}
	return out;
}

// data/pdf.js
const SHEET_W = 792;
const SHEET_H = 612;
const enc = new TextEncoder();
const n2 = (v) => Number(v).toFixed(2);
function makePdf(sheets) {
	const parts = [];
	const offsets = [];
	let size = 0;
	const put = (v) => {
		const bytes = typeof v === "string" ? enc.encode(v) : v;
		parts.push(bytes);
		size += bytes instanceof Blob ? bytes.size : bytes.length;
	};
	const obj = (id, write) => {
		offsets[id] = size;
		put(`${id} 0 obj\n`);
		write();
		put("\nendobj\n");
	};
	let next = 4;
	const images = new Map();
	for (const sheet of sheets) {
		for (const im of sheet.images) {
			if (!images.has(im.jpeg)) images.set(im.jpeg, {
				id: next++,
				pxW: im.pxW,
				pxH: im.pxH
			});
		}
	}
	const pageIds = sheets.map(() => {
		const id = next;
		next += 2;
		return id;
	});
	put("%PDF-1.4\n");
	put(new Uint8Array([
		37,
		226,
		227,
		207,
		211,
		10
	]));
	obj(1, () => put("<< /Type /Catalog /Pages 2 0 R >>"));
	obj(2, () => put(`<< /Type /Pages /Count ${sheets.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`));
	obj(3, () => put("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"));
	for (const [jpeg, im] of images) {
		obj(im.id, () => {
			put(`<< /Type /XObject /Subtype /Image /Width ${im.pxW} /Height ${im.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.size} >>\nstream\n`);
			put(jpeg);
			put("\nendstream");
		});
	}
	sheets.forEach((sheet, i) => {
		const pageId = pageIds[i];
		let draw = "";
		for (const im of sheet.images) {
			const name = `Im${images.get(im.jpeg).id}`;
			draw += `q ${n2(im.w)} 0 0 ${n2(im.h)} ${n2(im.x)} ${n2(im.y)} cm /${name} Do Q\n`;
			if (im.outline) draw += `q 0.82 G 0.25 w ${n2(im.x)} ${n2(im.y)} ${n2(im.w)} ${n2(im.h)} re S Q\n`;
		}
		for (const t of sheet.text || []) {
			const safe = String(t.str).replace(/[\\()]/g, "\\$&");
			draw += `q 0.19 0.24 0.27 rg BT /F1 ${n2(t.size)} Tf ${n2(t.x)} ${n2(t.y)} Td (${safe}) Tj ET Q\n`;
		}
		const used = [...new Set(sheet.images.map((im) => images.get(im.jpeg).id))];
		obj(pageId, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${792} ${612}] /Contents ${pageId + 1} 0 R /Resources << /Font << /F1 3 0 R >> /XObject << ${used.map((id) => `/Im${id} ${id} 0 R`).join(" ")} >> >> >>`));
		const stream = enc.encode(draw);
		obj(pageId + 1, () => {
			put(`<< /Length ${stream.length} >>\nstream\n`);
			put(stream);
			put("\nendstream");
		});
	});
	const xref = size;
	let table = `xref\n0 ${next}\n0000000000 65535 f \n`;
	for (let id = 1; id < next; id++) table += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
	put(table);
	put(`trailer\n<< /Size ${next} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
	return new Blob(parts, { type: "application/pdf" });
}

// pages/pdfview.js
const MAX_ZOOM = 4;
const pct = (v, of) => `${(v / of * 100).toFixed(3)}%`;
const box = (r) => `left:${pct(r.x, 792)};top:${pct(612 - r.y - r.h, 612)};width:${pct(r.w, 792)};height:${pct(r.h, 612)}`;
async function sendPdf(blob, name) {
	const file = new File([blob], name, { type: "application/pdf" });
	let canShare = false;
	try {
		canShare = isPhone() && !!navigator.canShare && navigator.canShare({ files: [file] });
	} catch {}
	if (!canShare) {
		downloadBlob(blob, name);
		return true;
	}
	try {
		await navigator.share({ files: [file] });
		return true;
	} catch (e) {
		if (e && e.name !== "AbortError") toast("Sharing did not work here. Try again in Safari.");
		return false;
	}
}
function noticeHtml({ checked, low }) {
	if (low.length) {
		const one = low.length === 1;
		return `<button type="button" class="pdfv-notice is-low" data-low><span><b>${low.length} ${one ? "picture" : "pictures"} may not print sharply.</b> Tap to see ${one ? "it" : "which"}.</span></button>`;
	}
	return checked ? "<p class=\"pdfv-notice\">Every picture is sharp enough to print.</p>" : "";
}
function showPdf(s, { sheets, report, fileName, onSaved }) {
	const urls = new Map();
	const urlOf = (blob) => {
		if (!urls.has(blob)) urls.set(blob, URL.createObjectURL(blob));
		return urls.get(blob);
	};
	const sheetHtml = (sheet) => `
    <div class="pdfv-sheet">
      ${sheet.images.map((im) => `<img class="${im.outline ? "has-edge" : ""}" style="${box(im)}" data-src="${urlOf(im.jpeg)}" alt="" draggable="false" />`).join("")}
      ${(sheet.text || []).map((t) => `<span class="pdfv-text" style="left:${pct(t.x, 792)};bottom:${pct(t.y, 612)};font-size:${(t.size / 792 * 100).toFixed(3)}cqw">${t.str}</span>`).join("")}
      ${(sheet.marks || []).map((m) => `<span class="pdfv-mark${m.blurry ? " is-blurry" : ""}" style="${box(m)}"></span>`).join("")}
    </div>`;
	s.el.classList.add("sheet-pdf");
	s.setTitle("Preview");
	s.body.innerHTML = `
    ${noticeHtml(report)}
    <div class="pdfv-scroll" data-scroll>
      <div class="pdfv-pages" data-pages>${sheets.map(sheetHtml).join("")}</div>
    </div>
    <div class="pdfv-foot">
      <div class="pdfv-row">
        <span class="pdfv-count" data-count></span>
        <button type="button" class="mini-btn" data-out aria-label="Zoom out">${ICONS.zoomOut}</button>
        <button type="button" class="mini-btn" data-in aria-label="Zoom in">${ICONS.zoomIn}</button>
      </div>
      <button type="button" class="modal-cta primary" data-save>${isPhone() ? "Save or print" : "Download PDF"}</button>
    </div>`;
	const scroll = s.body.querySelector("[data-scroll]");
	const pages = s.body.querySelector("[data-pages]");
	const count = s.body.querySelector("[data-count]");
	const zoomOut = s.body.querySelector("[data-out]");
	const zoomIn = s.body.querySelector("[data-in]");
	const sheetEls = [...pages.children];
	const near = new IntersectionObserver((entries) => {
		for (const e of entries) {
			for (const img of e.target.querySelectorAll("img")) {
				if (e.isIntersecting) img.src = img.dataset.src;
				else img.removeAttribute("src");
			}
		}
	}, {
		root: scroll,
		rootMargin: "400px"
	});
	sheetEls.forEach((el) => near.observe(el));
	function showCount() {
		const atEnd = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 2;
		const line = scroll.scrollTop + sheetEls[0].offsetHeight / 2;
		const n = atEnd ? sheetEls.length - 1 : Math.max(0, sheetEls.findIndex((el) => el.offsetTop + el.offsetHeight > line));
		count.textContent = `Sheet ${n + 1} of ${sheetEls.length}`;
	}
	scroll.addEventListener("scroll", showCount, { passive: true });
	let z = 1;
	function setZoom(next, cx = scroll.clientWidth / 2, cy = scroll.clientHeight / 2) {
		const to = clamp$1(next, 1, MAX_ZOOM);
		const k = to / z;
		const x = scroll.scrollLeft + cx;
		const y = scroll.scrollTop + cy;
		z = to;
		pages.style.setProperty("--z", String(z));
		scroll.scrollLeft = x * k - cx;
		scroll.scrollTop = y * k - cy;
		zoomOut.disabled = z <= 1;
		zoomIn.disabled = z >= MAX_ZOOM;
		showCount();
	}
	zoomOut.addEventListener("click", () => setZoom(z / 1.5));
	zoomIn.addEventListener("click", () => setZoom(z * 1.5));
	const inScroll = (x, y) => {
		const r = scroll.getBoundingClientRect();
		return [x - r.left, y - r.top];
	};
	let pinch = null;
	const spread = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
	scroll.addEventListener("touchstart", (e) => {
		if (e.touches.length === 2) pinch = {
			d: spread(e.touches),
			z
		};
	}, { passive: true });
	scroll.addEventListener("touchmove", (e) => {
		if (!pinch || e.touches.length !== 2) return;
		e.preventDefault();
		const t = e.touches;
		setZoom(pinch.z * spread(t) / pinch.d, ...inScroll((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2));
	}, { passive: false });
	scroll.addEventListener("touchend", (e) => {
		if (e.touches.length < 2) pinch = null;
	});
	scroll.addEventListener("gesturestart", (e) => e.preventDefault());
	scroll.addEventListener("wheel", (e) => {
		if (!e.ctrlKey) return;
		e.preventDefault();
		setZoom(z * Math.exp(-e.deltaY / 100), ...inScroll(e.clientX, e.clientY));
	}, { passive: false });
	let lastUp = 0;
	scroll.addEventListener("pointerup", (e) => {
		if (e.timeStamp - lastUp < 300) {
			setZoom(z > 1 ? 1 : 2.5, ...inScroll(e.clientX, e.clientY));
			lastUp = 0;
		} else lastUp = e.timeStamp;
	});
	function goTo(n) {
		setZoom(1);
		scroll.scrollTop = sheetEls[n].offsetTop - 12;
		for (const m of sheetEls[n].querySelectorAll(".pdfv-mark")) {
			m.classList.remove("is-flash");
			void m.offsetWidth;
			m.classList.add("is-flash");
		}
	}
	const lowBtn = s.body.querySelector("[data-low]");
	if (lowBtn) {
		lowBtn.addEventListener("click", async () => {
			const key = await choiceSheet({
				title: "Low resolution",
				message: "Book printers ask for 300 pixels per inch at the printed size. Below 150 usually looks blurry.",
				options: report.low.map((l, i) => ({
					key: String(i),
					icon: l.thumb ? `<img class="pdfv-thumb" src="${urlOf(l.thumb)}" alt="" />` : "",
					label: l.label,
					detail: `${l.ppi} pixels per inch. ${l.blurry ? "Will look blurry." : "May look a little soft."}`
				})),
				footer: "<p class=\"field-hint\">To fix one, use a larger copy of the picture, zoom out of it, or make its box smaller.</p>"
			});
			if (key !== null) goTo(report.low[Number(key)].sheet);
		});
	}
	s.body.querySelector("[data-save]").addEventListener("click", async () => {
		if (await sendPdf(makePdf(sheets), fileName)) onSaved();
	});
	setZoom(1);
	return () => {
		near.disconnect();
		urls.forEach((u) => URL.revokeObjectURL(u));
	};
}

// data/print-check.js
const FULL_AREA = {
	x: 36,
	y: 36,
	w: 792 - 72,
	h: 612 - 72
};
const BOOK_AREA = {
	x: 36,
	y: 44,
	w: 792 - 72,
	h: 612 - 74
};
const INK$1 = "#313d45";
const PRINT_PPI = 300;
const BLURRY_PPI = 150;
const pagesPerSheet = (pxW, pxH) => pxW / pxH > 1.1 ? 1 : 2;
const printedW = (aspect, area) => Math.min(area.w / (aspect > 1.1 ? 1 : 2), area.h * aspect);
const printScale = (p, area) => Math.round(PRINT_PPI * printedW(SLIDE_W / slideH(p), area) / 72) / SLIDE_W;
function checkPictures(p, photos, order, sheets, first = 0, layout = "") {
	const per = pagesPerSheet(SLIDE_W, slideH(p));
	const H = slideH(p);
	const report = {
		checked: 0,
		low: []
	};
	for (const f of p.frames) {
		const photo = f.photoId && photos[f.photoId];
		if (!photo) continue;
		const seen = order.map((i, pos) => ({
			i,
			pos
		})).filter(({ i }) => framesOnSlide(p, i).includes(f));
		if (!seen.length) continue;
		report.checked++;
		const sheetAt = (pos) => sheets[Math.floor(pos / per)];
		const pageAt = (pos) => sheetAt(pos).images[pos % per];
		const real = photo.original && photo.kind !== "video" ? 1 : (photo.previewW || photo.width) / photo.width;
		const ppi = Math.round(real * 72 * SLIDE_W / (placement(f, photo).s * pageAt(seen[0].pos).w));
		if (ppi >= PRINT_PPI) continue;
		const blurry = ppi < BLURRY_PPI;
		for (const { i, pos } of seen) {
			const im = pageAt(pos);
			const x0 = Math.max(0, f.x - i * SLIDE_W);
			const x1 = Math.min(SLIDE_W, f.x + f.w - i * SLIDE_W);
			const y0 = Math.max(0, f.y);
			const y1 = Math.min(H, f.y + f.h);
			const sheet = sheetAt(pos);
			sheet.marks = sheet.marks || [];
			sheet.marks.push({
				x: im.x + x0 / SLIDE_W * im.w,
				y: im.y + im.h - y1 / H * im.h,
				w: (x1 - x0) / SLIDE_W * im.w,
				h: (y1 - y0) / H * im.h,
				blurry
			});
		}
		const where = `${pageWord(p)} ${seen[0].i + 1}`;
		report.low.push({
			ppi,
			blurry,
			thumb: photo.thumb,
			sheet: first + Math.floor(seen[0].pos / per),
			label: layout ? `${layout}, ${where}` : where[0].toUpperCase() + where.slice(1)
		});
	}
	return report;
}

// data/notebook-pdf.js
function sheetsOf(jpegs, pxW, pxH, area = FULL_AREA) {
	const aspect = pxW / pxH;
	const per = pagesPerSheet(pxW, pxH);
	const w = printedW(aspect, area);
	const h = w / aspect;
	const y = area.y + (area.h - h) / 2;
	const sheets = [];
	for (let i = 0; i < jpegs.length; i += per) {
		const group = jpegs.slice(i, i + per);
		const x0 = area.x + (area.w - group.length * w) / 2;
		sheets.push({
			images: group.map((jpeg, n) => ({
				jpeg,
				pxW,
				pxH,
				x: x0 + n * w,
				y,
				w,
				h,
				outline: true
			})),
			text: []
		});
	}
	return sheets;
}
function whiteCanvas(w, h) {
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	const ctx = c.getContext("2d", { colorSpace: "srgb" });
	ctx.fillStyle = "#fff";
	ctx.fillRect(0, 0, w, h);
	return {
		c,
		ctx
	};
}
async function finishCanvas(c) {
	const jpeg = await canvasToBlob(c, "image/jpeg", .92);
	const size = {
		pxW: c.width,
		pxH: c.height
	};
	c.width = c.height = 0;
	return {
		jpeg,
		...size
	};
}
function fitText(ctx, str, max) {
	if (ctx.measureText(str).width <= max) return str;
	let s = str;
	while (s.length > 1 && ctx.measureText(`${s}...`).width > max) s = s.slice(0, -1);
	return `${s.trimEnd()}...`;
}
async function coverSheet() {
	try {
		const img = await loadImage(`art/${document.documentElement.dataset.book || "berry"}-cover.webp`);
		const { c, ctx } = whiteCanvas(1e3, 1360);
		ctx.drawImage(img, 0, 0, 1e3, 1360);
		const h = FULL_AREA.h;
		const w = h * 1e3 / 1360;
		return {
			images: [{
				...await finishCanvas(c),
				x: (792 - w) / 2,
				y: FULL_AREA.y,
				w,
				h
			}],
			text: []
		};
	} catch {
		return null;
	}
}
const FONT = "\"Figtree\", system-ui, sans-serif";
async function nameStrip(name) {
	const { c, ctx } = whiteCanvas(1400, 72);
	ctx.fillStyle = INK$1;
	ctx.textBaseline = "middle";
	ctx.font = `500 44px ${FONT}`;
	ctx.fillText(fitText(ctx, name, 1380), 0, 38);
	return {
		...await finishCanvas(c),
		x: 36,
		y: 12,
		w: 504,
		h: 25.92
	};
}
async function numberMark(str) {
	const { c, ctx } = whiteCanvas(160, 72);
	ctx.fillStyle = INK$1;
	ctx.textAlign = "right";
	ctx.textBaseline = "middle";
	ctx.font = `500 44px ${FONT}`;
	ctx.fillText(str, 156, 38);
	return {
		...await finishCanvas(c),
		x: 792 - 36 - 57.6,
		y: 12,
		w: 57.6,
		h: 25.92
	};
}
async function makeNotebook(onProgress, stillOpen = () => true) {
	const layouts = await listProjects();
	if (!layouts.length) return null;
	if (document.fonts && document.fonts.load) await document.fonts.load(`500 44px ${FONT}`).catch(() => {});
	const total = layouts.reduce((sum, p) => sum + p.slides, 0);
	const cover = await coverSheet();
	const sheets = cover ? [cover] : [];
	const report = {
		checked: 0,
		low: []
	};
	let made = 0;
	let number = 1;
	for (const p of layouts) {
		if (!stillOpen()) return null;
		const photos = Object.fromEntries((await photosForProject(p.id)).map((ph) => [ph.id, ph]));
		const files = await renderSlides(p, photos, "jpeg", (i) => onProgress && onProgress(p.name, (made + i) / total), {
			thumbs: false,
			scale: printScale(p, BOOK_AREA)
		});
		made += p.slides;
		const strip = await nameStrip(p.name);
		const own = sheetsOf(files.map((f) => f.blob), files[0].width, files[0].height, BOOK_AREA);
		const found = checkPictures(p, photos, files.map((_, i) => i), own, sheets.length, p.name);
		report.checked += found.checked;
		report.low.push(...found.low);
		for (const sheet of own) {
			sheet.images.push(strip);
			sheet.images.push(await numberMark(String(number++)));
			sheets.push(sheet);
		}
	}
	return {
		sheets,
		report
	};
}

// pages/notebook-export.js
function openNotebookExport() {
	let free = null;
	const s = openSheet({
		title: "Everything as one PDF",
		className: "sheet-export",
		onClose: () => free && free()
	});
	async function run() {
		s.body.innerHTML = `
      <p class="sheet-message" data-msg>Getting ready</p>
      <div class="progress"><div class="progress-bar" data-bar></div></div>
      <p class="field-hint">Keep this screen open while it works.</p>`;
		const msg = s.body.querySelector("[data-msg]");
		const bar = s.body.querySelector("[data-bar]");
		let book;
		try {
			book = await makeNotebook((name, part) => {
				msg.textContent = `Making ${name}`;
				bar.style.width = `${Math.round(part * 100)}%`;
			}, () => s.overlay.isConnected);
		} catch (e) {
			console.error(e);
			if (!s.overlay.isConnected) return;
			s.body.innerHTML = `
        <p class="sheet-message">Something went wrong making the PDF. Try again.</p>
        <button type="button" class="modal-cta primary" data-again>Try again</button>`;
			s.body.querySelector("[data-again]").addEventListener("click", run);
			return;
		}
		if (!s.overlay.isConnected) return;
		if (!book) {
			s.body.innerHTML = "<p class=\"sheet-message\">There are no layouts to export yet.</p>";
			return;
		}
		free = showPdf(s, {
			...book,
			fileName: "layouts.pdf",
			onSaved: () => s.close()
		});
	}
	run();
	return s;
}
function openLayoutPdf(p, photos, order, base, exportSheet) {
	let free = null;
	const s = openSheet({
		title: "Printable PDF",
		className: "sheet-export",
		onClose: () => free && free()
	});
	async function run() {
		s.body.innerHTML = `
      <p class="sheet-message" data-msg>Getting ready</p>
      <div class="progress"><div class="progress-bar" data-bar></div></div>
      <p class="field-hint">Keep this screen open while it works.</p>`;
		const msg = s.body.querySelector("[data-msg]");
		const bar = s.body.querySelector("[data-bar]");
		let files;
		try {
			files = await renderSlides(p, photos, "jpeg", (i, n) => {
				msg.textContent = `Making ${pageWord(p)} ${i + 1} of ${n}`;
				bar.style.width = `${Math.round(i / n * 100)}%`;
			}, {
				thumbs: false,
				scale: printScale(p, FULL_AREA),
				only: order
			});
		} catch (e) {
			console.error(e);
			if (!s.overlay.isConnected) return;
			s.body.innerHTML = `
        <p class="sheet-message">Something went wrong making the PDF. Try again.</p>
        <button type="button" class="modal-cta primary" data-again>Try again</button>`;
			s.body.querySelector("[data-again]").addEventListener("click", run);
			return;
		}
		if (!s.overlay.isConnected) return;
		const sheets = sheetsOf(files.map((f) => f.blob), files[0].width, files[0].height);
		free = showPdf(s, {
			sheets,
			report: checkPictures(p, photos, order, sheets),
			fileName: `${base}-print.pdf`,
			onSaved: () => {
				s.close();
				exportSheet.close();
			}
		});
	}
	run();
}

// pages/export-drag.js
function dragToReorder(list, onMove, setSuppress) {
	let d = null;
	const HOLD = 300;
	const index = (li) => [...list.children].indexOf(li);
	function lift(x, y) {
		d.on = true;
		setSuppress(true);
		const r = d.li.getBoundingClientRect();
		d.ghost = d.li.cloneNode(true);
		d.ghost.className = `order-ghost${d.li.classList.contains("is-off") ? " is-off" : ""}`;
		d.ghost.style.width = `${r.width}px`;
		d.dx = x - r.left;
		d.dy = y - r.top;
		document.body.appendChild(d.ghost);
		d.li.classList.add("is-placeholder");
		place(x, y);
		if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(12);
	}
	function place(x, y) {
		d.ghost.style.transform = `translate(${x - d.dx}px, ${y - d.dy}px)`;
		const hit = document.elementFromPoint(x, y);
		const over = hit && hit.closest("li[data-i]");
		if (!over || over === d.li || over.parentNode !== list) return;
		const from = index(d.li);
		const to = index(over);
		onMove(from, to);
	}
	function end() {
		if (!d) return;
		clearTimeout(d.timer);
		if (d.on) {
			d.ghost.remove();
			d.li.classList.remove("is-placeholder");
			setTimeout(() => setSuppress(false), 0);
		}
		d = null;
	}
	list.addEventListener("pointerdown", (e) => {
		const li = e.target.closest("li[data-i]");
		if (!li || e.pointerType === "mouse" && e.button !== 0) return;
		d = {
			li,
			id: e.pointerId,
			x0: e.clientX,
			y0: e.clientY,
			mouse: e.pointerType === "mouse",
			on: false
		};
		if (!d.mouse) d.timer = setTimeout(() => d && !d.on && lift(d.x0, d.y0), HOLD);
	});
	list.addEventListener("pointermove", (e) => {
		if (!d || e.pointerId !== d.id) return;
		if (!d.on) {
			const far = Math.hypot(e.clientX - d.x0, e.clientY - d.y0);
			if (!d.mouse) {
				if (far > 8) end();
				return;
			}
			if (far < 4) return;
			try {
				list.setPointerCapture(e.pointerId);
			} catch {}
			lift(e.clientX, e.clientY);
		}
		d.x0 = e.clientX;
		d.y0 = e.clientY;
		place(e.clientX, e.clientY);
	});
	list.addEventListener("touchmove", (e) => d && d.on && e.preventDefault(), { passive: false });
	list.addEventListener("pointerup", end);
	list.addEventListener("pointercancel", end);
	list.addEventListener("contextmenu", (e) => e.preventDefault());
}

// pages/export.js
const PDF_ICON = "<svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3v12\"/><path d=\"M7 10l5 5 5-5\"/><path d=\"M5 20h14\"/></svg>";
const GO_ICON = "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M9 5l7 7-7 7\"/></svg>";
function openExport(p, photos) {
	const H = slideH(p);
	const empty = p.frames.filter((f) => !f.photoId).length;
	let urls = [];
	const slidesWithVideo = Array.from({ length: p.slides }, (_, i) => i).filter((i) => hasVideo(p, photos, i));
	const record = slidesWithVideo.length > 0 && canRecordVideo();
	const audio = record ? startSound() : null;
	const s = openSheet({
		title: "Export",
		className: "sheet-page sheet-export",
		onClose: () => {
			urls.forEach((u) => URL.revokeObjectURL(u));
			if (audio) audio.close().catch(() => {});
		}
	});
	s.body.innerHTML = `
    ${shortBandHtml({
		name: "Export",
		backAttr: "data-close"
	})}
    <div class="page-scroll" data-scroll></div>
    <div class="page-foot exp-foot" data-foot hidden></div>`;
	const scroll = s.body.querySelector("[data-scroll]");
	const foot = s.body.querySelector("[data-foot]");
	async function run() {
		foot.hidden = true;
		scroll.innerHTML = `
      <h1 class="page-title" data-msg>Getting ready</h1>
      <p class="page-ask" data-hint>${p.slides} ${esc(pageWord(p, p.slides !== 1))}, each ${Math.round(SLIDE_W * exportScale(p))} × ${Math.round(H * exportScale(p))}. Keep this screen open while it works.</p>
      <div class="progress"><div class="progress-bar" data-bar></div></div>`;
		const msg = scroll.querySelector("[data-msg]");
		const bar = scroll.querySelector("[data-bar]");
		let files;
		try {
			files = await renderSlides(p, photos, "jpeg", (i, n) => {
				msg.textContent = `Making ${pageWord(p)} ${i + 1} of ${n}`;
				bar.style.width = `${Math.round(i / n * 100)}%`;
			});
			if (record) {
				scroll.querySelector("[data-hint]").textContent = `Videos are made as they play, up to ${60} seconds each. Keep this screen open while it works.`;
				const live = document.createElement("div");
				live.className = "video-live";
				scroll.appendChild(live);
				for (const i of slidesWithVideo) {
					if (!s.overlay.isConnected) return;
					msg.textContent = `Making the video on ${pageWord(p)} ${i + 1}`;
					bar.style.width = "0%";
					const made = await recordSlide(p, photos, i, {
						audio,
						host: live,
						openSource,
						stillOpen: () => s.overlay.isConnected,
						onTime: (t, length) => bar.style.width = `${Math.round(t / length * 100)}%`
					});
					files[i] = {
						...files[i],
						...made,
						name: files[i].name.replace(/\.jpg$/, `.${made.ext}`)
					};
				}
			}
		} catch (e) {
			console.error(e);
			if (!s.overlay.isConnected) return;
			scroll.innerHTML = `
        <h1 class="page-title">That didn't work</h1>
        <p class="page-ask">Something went wrong making the ${record ? "videos" : "images"}. Keep this screen open and try again, or try fewer ${esc(pageWord(p, true))} at a time.</p>`;
			foot.innerHTML = "<button type=\"button\" class=\"btn primary\" data-again>Try again</button>";
			foot.hidden = false;
			foot.querySelector("[data-again]").addEventListener("click", run);
			return;
		}
		if (!s.overlay.isConnected) return;
		finished(files);
	}
	function finished(files) {
		urls = files.map((f) => URL.createObjectURL(f.thumb));
		const base = slug(p.name);
		const n = files.length;
		let order = files.map((_, i) => i);
		const off = new Set();
		let canShare = false;
		try {
			canShare = isPhone() && !!navigator.canShare && navigator.canShare({ files: files.map((f) => new File([f.blob], f.name, { type: f.mime })) });
		} catch {}
		const word = pageWord(p);
		scroll.innerHTML = `
      ${n > 1 ? `<h1 class="page-title">${isPrint(p) ? "Keep" : "Post"} them in this order</h1>
           <p class="page-ask">Tap a ${esc(word)} to leave it out. Hold and drag to change the order.</p>` : `<h1 class="page-title">Ready</h1><p class="page-ask">Your ${esc(word)}, made at full size.</p>`}
      <ol class="order-grid${n > 1 ? " is-pick" : ""}" data-grid>
        ${files.map((f, i) => `<li data-i="${i}"><img style="aspect-ratio:${f.width}/${f.height}" src="${urls[i]}" alt="${esc(word)} ${i + 1}" draggable="false" /><span class="order-num"></span>${f.isVideo ? `<span class="order-vid">${ICONS.play}</span>` : ""}<span class="order-off">Left out</span></li>`).join("")}
      </ol>
      ${n > 1 ? "<p class=\"order-count\" data-count></p>" : ""}
      ${empty ? `<p class="tip">${empty === 1 ? "1 box is" : `${empty} boxes are`} empty and show the background color.</p>` : ""}
      ${slidesWithVideo.length && !record ? `<p class="tip">This browser can't save video, so those ${esc(pageWord(p, true))} are saved as still images. Safari and Chrome can.</p>` : ""}
      <button type="button" class="exp-row" data-pdf>
        <span class="exp-row-icon">${PDF_ICON}</span>
        <span class="exp-row-text"><span class="exp-row-name">Printable PDF</span><span class="exp-row-sub">Preview, sharpness check, then save or print</span></span>
        <span class="exp-row-go">${GO_ICON}</span>
      </button>`;
		foot.innerHTML = `
      <button type="button" class="btn primary" data-save></button>
      ${canShare ? "<p class=\"exp-hint\" data-share-hint></p>" : ""}`;
		foot.hidden = false;
		const grid = scroll.querySelector("[data-grid]");
		const count = scroll.querySelector("[data-count]");
		const save = foot.querySelector("[data-save]");
		const hint = foot.querySelector("[data-share-hint]");
		const items = new Map([...grid.children].map((li) => [Number(li.dataset.i), li]));
		const chosen = () => order.filter((i) => !off.has(i)).map((i, k) => ({
			...files[i],
			name: `${base}-${String(k + 1).padStart(2, "0")}.${files[i].ext || "jpg"}`
		}));
		function draw() {
			let k = 0;
			for (const i of order) {
				const li = items.get(i);
				grid.appendChild(li);
				li.classList.toggle("is-off", off.has(i));
				li.querySelector(".order-num").textContent = off.has(i) ? "" : String(++k);
			}
			const c = k;
			save.disabled = !c;
			if (canShare) save.textContent = c ? `Save ${c} to Photos` : "Save to Photos";
			else save.textContent = c > 1 ? `Download ${c} as ZIP` : "Download";
			if (count) count.textContent = c === n ? `${n} ${pageWord(p, true)}` : `${c} of ${n} ${pageWord(p, true)} · ${n - c} left out`;
			if (hint) {
				const v = order.filter((i) => !off.has(i) && files[i].isVideo).length;
				const what = !v ? c === 1 ? "Image" : `${c} Images` : c === 1 ? "Video" : v === c ? `${c} Videos` : `${c} Items`;
				hint.innerHTML = c ? `In the share sheet, tap <b>Save ${what}</b>.` : `Tap a ${esc(word)} to put it back.`;
			}
		}
		save.addEventListener("click", async () => {
			const list = chosen();
			if (!list.length) return;
			if (canShare) {
				try {
					await navigator.share({ files: list.map((f) => new File([f.blob], f.name, { type: f.mime })) });
					s.close();
				} catch (e) {
					if (e && e.name !== "AbortError") toast("Sharing did not work here. Try again in Safari.");
				}
				return;
			}
			if (list.length === 1) downloadBlob(list[0].blob, list[0].name);
			else downloadBlob(await makeZip(list), `${base}.zip`);
			s.close();
		});
		scroll.querySelector("[data-pdf]").addEventListener("click", () => {
			const picked = order.filter((i) => !off.has(i));
			if (picked.length) openLayoutPdf(p, photos, picked, base, s);
		});
		if (n > 1) {
			let suppress = false;
			grid.addEventListener("click", (e) => {
				const li = e.target.closest("li[data-i]");
				if (!li || suppress) return;
				const i = Number(li.dataset.i);
				if (off.has(i)) off.delete(i);
				else off.add(i);
				draw();
			});
			dragToReorder(grid, (from, to) => {
				const [i] = order.splice(from, 1);
				order.splice(to, 0, i);
				draw();
			}, (v) => suppress = v);
		}
		draw();
	}
	run();
	return s;
}

// pages/editor-buttons.js
function addButtons(ed) {
	const off = new AbortController();
	ed.off = off;
	ed.view.addEventListener("click", (e) => {
		const b = e.target.closest("[data-act]");
		if (b && !b.disabled) {
			const a = b.dataset.act;
			if (a === "back") ed.leave();
			else if (a === "undo") ed.undo();
			else if (a === "redo") ed.redo();
			else if (a === "more") ed.topMore();
			else if (a === "rename") ed.rename();
			else if (a === "export") {
				ed.commitSoon.flush();
				ed.saveSoon.flush();
				openExport(ed.p, ed.photos);
			} else if (a === "add-frame") ed.addFrame();
			else if (a === "add-slide") ed.addSlide();
			else if (a === "slides") ed.openSlides();
			else if (a === "layout") ed.layoutThisSlide();
			else if (a === "adjust") {
				ed.photoMode = !ed.photoMode;
				ed.placeSel();
				ed.renderTools();
				ed.renderAdjust();
			} else if (a === "adjust-done") {
				ed.photoMode = false;
				ed.placeSel();
				ed.renderTools();
				ed.renderAdjust();
			} else if (a === "rotate") ed.rotateSel();
			else if (a === "swap") ed.openSwap(ed.sel);
			else if (a === "fit") ed.fitSel();
			else if (a === "frame-more") ed.frameMore();
			else if (a === "delete") ed.deleteSel();
			else if (a === "add-photos") ed.addPhotos();
			else if (a === "take-out") ed.takeOut();
			else if (a === "del-slide") ed.deleteSlide(Number(b.dataset.k));
			return;
		}
		const t = e.target.closest(".tray-item");
		if (t && !ed.trayDrag.suppressClick) ed.trayTap(t.dataset.pid);
	}, { signal: off.signal });
	ed.zoomInput.addEventListener("input", () => {
		const f = ed.selFrame();
		if (!f || !f.photoId) return;
		f.crop = {
			...f.crop,
			zoom: Number(ed.zoomInput.value)
		};
		f.crop = clampedCrop(f, ed.photos[f.photoId]);
		ed.placeFrame(f);
	});
	ed.zoomInput.addEventListener("change", ed.commit);
}

// components/snapping.js
function snapTargets(p, skipId, { safeZone = false } = {}) {
	const W = SLIDE_W;
	const H = slideH(p);
	const P = p.padding || 0;
	const xs = [];
	const ys = [
		0,
		H,
		H / 2
	];
	for (let k = 0; k <= p.slides; k++) xs.push(k * W);
	for (let k = 0; k < p.slides; k++) {
		xs.push(k * W + W / 2);
		if (P) xs.push(k * W + P, (k + 1) * W - P);
	}
	if (P) ys.push(P, H - P);
	if (safeZone && isStory(p)) ys.push(250, H - 340);
	for (const f of p.frames) {
		if (f.id === skipId) continue;
		xs.push(f.x, f.x + f.w, f.x + f.w / 2);
		ys.push(f.y, f.y + f.h, f.y + f.h / 2);
		if (P) {
			xs.push(f.x - P, f.x + f.w + P);
			ys.push(f.y - P, f.y + f.h + P);
		}
	}
	return {
		xs,
		ys
	};
}
function nearest(values, targets, tol) {
	let best = null;
	for (const v of values) {
		for (const t of targets) {
			const d = t - v;
			if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = {
				d,
				line: t
			};
		}
	}
	return best;
}

// pages/editor-gestures.js
function addGestures(ed) {
	Object.assign(ed, {
		stopHold,
		endLift,
		stopInertia,
		onDown,
		onMove,
		glide
	});
	const pts = new Map();
	ed.pts = pts;
	ed.g = null;
	ed.lastTap = {
		id: null,
		t: 0
	};
	ed.inertia = 0;
	let holdTimer = 0;
	const HOLD_MS = 420;
	function stopHold() {
		clearTimeout(holdTimer);
		holdTimer = 0;
	}
	function startLift() {
		holdTimer = 0;
		if (!ed.g || ed.g.moved || pts.size !== 1 || ed.g.type !== "pan" && ed.g.type !== "photo") return;
		const id = ed.g.type === "pan" ? ed.g.frameId : ed.g.id;
		const f = id && ed.frameById(id);
		if (!f || !f.photoId) return;
		stopInertia();
		const ghost = document.createElement("img");
		ghost.className = "drag-ghost is-lift";
		ghost.src = ed.thumbOf(f.photoId);
		document.body.appendChild(ghost);
		const el = ed.framesEl.querySelector(`.fr[data-id="${f.id}"]`);
		if (el) el.classList.add("is-lifted");
		ed.g = {
			type: "lift",
			pid: ed.g.pid,
			id: f.id,
			ghost,
			el,
			moved: true
		};
		const pt = pts.get(ed.g.pid);
		if (pt) moveLift(pt.x, pt.y);
		if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(12);
	}
	function moveLift(x, y) {
		ed.g.ghost.style.transform = `translate(${x - 44}px, ${y - 44}px)`;
		const d = ed.dropAt(x, y);
		ed.setDropTarget(d && d.frameId && d.frameId !== ed.g.id ? d.frameId : null);
	}
	function endLift(was, e) {
		was.ghost.remove();
		if (was.el) was.el.classList.remove("is-lifted");
		const to = ed.dropTarget;
		ed.setDropTarget(null);
		if (e.type !== "pointerup" || !to) return;
		const a = ed.frameById(was.id);
		const b = ed.frameById(to);
		if (!a || !b) return;
		const [pa, ra, pb, rb] = [
			a.photoId,
			a.crop.rot || 0,
			b.photoId,
			b.crop.rot || 0
		];
		a.photoId = pb;
		a.crop = {
			...defaultCrop(),
			rot: pb ? rb : 0
		};
		b.photoId = pa;
		b.crop = {
			...defaultCrop(),
			rot: ra
		};
		ed.sel = b.id;
		ed.photoMode = false;
		ed.render();
		ed.commit();
	}
	function stopInertia() {
		cancelAnimationFrame(ed.inertia);
		ed.inertia = 0;
	}
	function startPinch() {
		const [a, b] = [...pts.values()];
		const mid = {
			x: (a.x + b.x) / 2,
			y: (a.y + b.y) / 2
		};
		const d0 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
		const f = ed.g && ed.g.id && ed.frameById(ed.g.id);
		if (f && f.photoId && ed.sel === f.id && (ed.g.type === "photo" || ed.g.type === "resize")) {
			if (ed.g.start) Object.assign(f, ed.g.start);
			ed.placeFrame(f);
			ed.placeSel();
			ed.showGuides(null, null);
			const pl = placement(f, ed.photos[f.photoId]);
			ed.g = {
				type: "ppinch",
				id: f.id,
				d0,
				zoom0: f.crop.zoom || 1,
				crop0: {
					...f.crop,
					cx: pl.cx,
					cy: pl.cy
				},
				mid0: mid
			};
		} else {
			ed.showGuides(null, null);
			ed.g = {
				type: "zpinch",
				d0,
				z0: ed.z,
				u: ed.toUnits(mid.x, mid.y)
			};
		}
	}
	function pinchMove() {
		const [a, b] = [...pts.values()];
		if (!a || !b) return;
		const mid = {
			x: (a.x + b.x) / 2,
			y: (a.y + b.y) / 2
		};
		const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
		if (ed.g.type === "zpinch") {
			const r = ed.ws.getBoundingClientRect();
			ed.z = clamp$1(ed.g.z0 * (d / ed.g.d0), ed.minZ(), ed.maxZ());
			ed.zoomFit = null;
			ed.renderStrip();
			ed.ws.scrollLeft = ed.margX + ed.g.u.x * ed.z - (mid.x - r.left);
			ed.ws.scrollTop = ed.margY + ed.g.u.y * ed.z - (mid.y - r.top);
			return;
		}
		const f = ed.frameById(ed.g.id);
		if (!f) return;
		const ph = ed.photos[f.photoId];
		const r = ed.strip.getBoundingClientRect();
		const fc = {
			x: r.left + (f.x + f.w / 2) * ed.z,
			y: r.top + (f.y + f.h / 2) * ed.z
		};
		const pl0 = placement({
			...f,
			crop: ed.g.crop0
		}, ph);
		const q = {
			x: pl0.px + (ed.g.mid0.x - fc.x) / ed.z / pl0.s,
			y: pl0.py + (ed.g.mid0.y - fc.y) / ed.z / pl0.s
		};
		const zoom = clamp$1(ed.g.zoom0 * (d / ed.g.d0), 1, 8);
		const pl1 = placement({
			...f,
			crop: {
				...ed.g.crop0,
				zoom
			}
		}, ph);
		const px = q.x - (mid.x - fc.x) / ed.z / pl1.s;
		const py = q.y - (mid.y - fc.y) / ed.z / pl1.s;
		f.crop = {
			...ed.g.crop0,
			zoom,
			cx: px / pl1.rw + .5,
			cy: py / pl1.rh + .5
		};
		f.crop = clampedCrop(f, ph);
		ed.placeFrame(f);
		if (ed.photoMode) ed.zoomInput.value = String(zoom);
	}
	function resizeFrame(f, dxu, dyu, noSnap) {
		const s = ed.g.start;
		const h = ed.g.h;
		const tol = 9 / ed.z;
		let l = s.x;
		let r = s.x + s.w;
		let t = s.y;
		let b = s.y + s.h;
		let gx = null;
		let gy = null;
		const snap = (v, list) => {
			const n = noSnap ? null : nearest([v], list, tol);
			return n ? [v + n.d, n.line] : [v, null];
		};
		if (h.includes("w")) [l, gx] = snap(s.x + dxu, ed.g.targets.xs);
		if (h.includes("e")) [r, gx] = snap(s.x + s.w + dxu, ed.g.targets.xs);
		const lo = ed.spread * 2 * SLIDE_W;
		const hi2 = lo + 2 * SLIDE_W;
		if (l < lo) [l, gx] = [lo, null];
		if (r > hi2) [r, gx] = [hi2, null];
		if (h.includes("n")) [t, gy] = snap(s.y + dyu, ed.g.targets.ys);
		if (h.includes("s")) [b, gy] = snap(s.y + s.h + dyu, ed.g.targets.ys);
		if (r - l < 60) {
			if (h.includes("w")) l = r - 60;
			else r = l + 60;
			gx = null;
		}
		if (b - t < 60) {
			if (h.includes("n")) t = b - 60;
			else b = t + 60;
			gy = null;
		}
		f.x = Math.round(l);
		f.y = Math.round(t);
		f.w = Math.round(r - l);
		f.h = Math.round(b - t);
		ed.showGuides(gx, gy);
	}
	function panPhoto(f, dxu, dyu) {
		const ph = ed.photos[f.photoId];
		const pl = placement({
			...f,
			crop: ed.g.crop0
		}, ph);
		f.crop = {
			...ed.g.crop0,
			cx: pl.cx - dxu / (pl.s * pl.rw),
			cy: pl.cy - dyu / (pl.s * pl.rh)
		};
		const wide = pl.s * pl.rw;
		const tall = pl.s * pl.rh;
		const onX = wide > f.w + .5 && Math.abs(f.crop.cx - .5) * wide * ed.z < 9;
		const onY = tall > f.h + .5 && Math.abs(f.crop.cy - .5) * tall * ed.z < 9;
		if (onX) f.crop.cx = .5;
		if (onY) f.crop.cy = .5;
		f.crop = clampedCrop(f, ph);
		ed.showFrameGuides(f, onX, onY);
	}
	function onDown(e) {
		if (e.pointerType === "mouse" && e.button !== 0) return;
		if (e.target.closest("button") || ed.flipping) return;
		try {
			ed.ws.setPointerCapture(e.pointerId);
		} catch {}
		pts.set(e.pointerId, {
			x: e.clientX,
			y: e.clientY
		});
		stopInertia();
		ed.inner.style.transition = "none";
		ed.inner.style.transform = "";
		if (pts.size === 2) {
			stopHold();
			ed.showGuides(null, null);
			if (ed.g && ed.g.type === "lift") return;
			startPinch();
			return;
		}
		if (pts.size > 2) return;
		const base = {
			pid: e.pointerId,
			x0: e.clientX,
			y0: e.clientY,
			moved: false,
			mouse: e.pointerType === "mouse"
		};
		const handle = e.target.closest("[data-h]");
		const frEl = e.target.closest(".fr");
		const f = handle ? ed.selFrame() : frEl && ed.frameById(frEl.dataset.id);
		if (handle && f) {
			ed.g = {
				...base,
				type: "resize",
				id: f.id,
				h: handle.dataset.h,
				start: {
					x: f.x,
					y: f.y,
					w: f.w,
					h: f.h
				},
				targets: snapTargets(ed.p, f.id, { safeZone: ed.showSafe })
			};
			return;
		}
		stopHold();
		if (f && f.photoId) holdTimer = setTimeout(startLift, HOLD_MS);
		if (f && ed.sel === f.id && f.photoId) {
			const pl = placement(f, ed.photos[f.photoId]);
			ed.g = {
				...base,
				type: "photo",
				id: f.id,
				wasSel: true,
				crop0: {
					...f.crop,
					cx: pl.cx,
					cy: pl.cy
				}
			};
			return;
		}
		ed.g = {
			...base,
			type: "pan",
			frameId: f ? f.id : null,
			wasSel: !!f && ed.sel === f.id,
			sl: ed.ws.scrollLeft,
			st: ed.ws.scrollTop,
			samples: [{
				t: performance.now(),
				x: e.clientX,
				y: e.clientY
			}]
		};
	}
	function onMove(e) {
		if (!pts.has(e.pointerId)) return;
		pts.set(e.pointerId, {
			x: e.clientX,
			y: e.clientY
		});
		if (!ed.g) return;
		if (ed.g.type === "zpinch" || ed.g.type === "ppinch") {
			pinchMove();
			return;
		}
		if (e.pointerId !== ed.g.pid) return;
		if (ed.g.type === "lift") {
			moveLift(e.clientX, e.clientY);
			return;
		}
		const dx = e.clientX - ed.g.x0;
		const dy = e.clientY - ed.g.y0;
		if (!ed.g.moved && Math.hypot(dx, dy) < (ed.g.mouse ? 3 : ed.g.type === "pan" ? 7 : 10)) return;
		ed.g.moved = true;
		stopHold();
		if (ed.g.type === "pan") {
			const want = ed.g.sl - dx;
			const maxS = Math.max(0, ed.inner.offsetWidth - ed.wsSize().w);
			ed.ws.scrollLeft = want;
			ed.ws.scrollTop = ed.g.st - dy;
			ed.g.over = want < 0 ? want : want > maxS ? want - maxS : 0;
			ed.inner.style.transform = ed.g.over ? `translateX(${-ed.g.over * .4}px)` : "";
			ed.placeBook(ed.g.over * .4);
			ed.g.samples.push({
				t: performance.now(),
				x: e.clientX,
				y: e.clientY
			});
			if (ed.g.samples.length > 6) ed.g.samples.shift();
			return;
		}
		const f = ed.frameById(ed.g.id);
		if (!f) return;
		if (ed.g.type === "resize") resizeFrame(f, dx / ed.z, dy / ed.z, e.altKey);
		else if (ed.g.type === "photo") panPhoto(f, dx / ed.z, dy / ed.z);
		ed.placeFrame(f);
		ed.placeSel();
	}
	function glide(vx, vy) {
		let last = performance.now();
		const step = (now) => {
			const dt = Math.min(40, now - last);
			last = now;
			ed.ws.scrollLeft -= vx * dt;
			ed.ws.scrollTop -= vy * dt;
			const k = Math.pow(.994, dt);
			vx *= k;
			vy *= k;
			if (Math.abs(vx) + Math.abs(vy) > .02) ed.inertia = requestAnimationFrame(step);
			else ed.inertia = 0;
		};
		ed.inertia = requestAnimationFrame(step);
	}
}

// pages/editor-drag-end.js
function addDragEnd(ed) {
	function settlePan(was, e) {
		const s = was.samples;
		const a = s[0];
		const b = s[s.length - 1];
		const dt = b.t - a.t;
		const fresh = e.type === "pointerup" && dt > 0 && performance.now() - b.t < 60;
		const vx = fresh ? (b.x - a.x) / dt : 0;
		const vy = fresh ? (b.y - a.y) / dt : 0;
		const over = was.over || 0;
		const dragged = b.x - was.x0;
		const flick = Math.abs(vx) > .35 && Math.sign(vx) === Math.sign(dragged);
		ed.inner.style.transition = "transform .22s ease-out";
		ed.inner.style.transform = "";
		if (over) {
			const given = `translateX(${ed.bookX - ed.ws.scrollLeft - over * .4}px)`;
			ed.placeBook();
			ed.nbEl.animate([{ transform: given }, { transform: ed.nbEl.style.transform }], {
				duration: 220,
				easing: "ease-out"
			});
		}
		if (ed.zoomFit === "one") {
			const first = ed.firstPage();
			const last = ed.lastPage();
			const from = Math.abs(was.sl - ed.pageX(first)) <= Math.abs(was.sl - ed.pageX(last)) ? first : last;
			const turned = Math.abs(dragged) > 1080 * ed.z * .28 || flick;
			const k = from + (turned ? dragged < 0 ? 1 : -1 : 0);
			if (k < 0 || k >= ed.p.slides) ed.scrollToX(ed.pageX(from));
			else if (spreadOf(k) !== ed.spread) ed.flipTo(spreadOf(k), k);
			else ed.scrollToX(ed.pageX(k));
			return;
		}
		const maxS = Math.max(0, ed.inner.offsetWidth - ed.wsSize().w);
		const next = over > 60 || flick && vx < 0 && ed.ws.scrollLeft >= maxS - 2;
		const prev = over < -60 || flick && vx > 0 && ed.ws.scrollLeft <= 2;
		if (next && ed.spread < spreadCount(ed.p) - 1) ed.flipTo(ed.spread + 1);
		else if (prev && ed.spread > 0) ed.flipTo(ed.spread - 1, ed.spread * 2 - 1);
		else if (fresh && !was.mouse) ed.glide(vx, vy);
	}
	function onUp(e) {
		if (!ed.pts.has(e.pointerId)) return;
		ed.pts.delete(e.pointerId);
		ed.stopHold();
		if (!ed.g) return;
		if (ed.g.type === "lift") {
			if (e.pointerId !== ed.g.pid) return;
			const was = ed.g;
			ed.g = null;
			ed.endLift(was, e);
			return;
		}
		if (ed.g.type === "zpinch" || ed.g.type === "ppinch") {
			if (ed.g.type === "ppinch") ed.commit();
			else ed.renderTools();
			ed.g = ed.pts.size ? { type: "idle" } : null;
			return;
		}
		if (ed.g.type === "idle") {
			if (!ed.pts.size) ed.g = null;
			return;
		}
		if (e.pointerId !== ed.g.pid) return;
		ed.showGuides(null, null);
		const was = ed.g;
		ed.g = null;
		if (was.moved) {
			if (was.type === "pan") {
				settlePan(was, e);
			} else ed.commit();
			return;
		}
		if (e.type !== "pointerup") return;
		if (was.type === "resize") return;
		const hit = ed.toUnits(e.clientX, e.clientY);
		ed.touched = clamp$1(Math.floor(hit.x / SLIDE_W), ed.firstPage(), ed.lastPage());
		const id = was.type === "pan" ? was.frameId : was.id;
		if (!id) {
			ed.deselect();
			return;
		}
		const now = performance.now();
		const double = ed.lastTap.id === id && now - ed.lastTap.t < 380;
		ed.lastTap = double ? {
			id: null,
			t: 0
		} : {
			id,
			t: now
		};
		const f = ed.frameById(id);
		if (!f) return;
		if (!was.wasSel) ed.select(id);
		if (double || was.wasSel && !f.photoId) ed.openSwap(f.id);
	}
	ed.ws.addEventListener("contextmenu", (e) => e.preventDefault());
	ed.ws.addEventListener("pointerdown", ed.onDown);
	ed.ws.addEventListener("pointermove", ed.onMove);
	ed.ws.addEventListener("pointerup", onUp);
	ed.ws.addEventListener("pointercancel", onUp);
	ed.ws.addEventListener("lostpointercapture", (e) => {
		if (ed.pts.has(e.pointerId)) onUp(e);
	});
	ed.ws.addEventListener("wheel", (e) => {
		if (!e.ctrlKey && !e.metaKey) return;
		e.preventDefault();
		const f = ed.selFrame();
		const over = e.target.closest(".fr");
		if (ed.photoMode && f && f.photoId && over && over.dataset.id === f.id) {
			f.crop = {
				...f.crop,
				zoom: clamp$1((f.crop.zoom || 1) * Math.exp(-e.deltaY * .01), 1, 8)
			};
			f.crop = clampedCrop(f, ed.photos[f.photoId]);
			ed.placeFrame(f);
			ed.zoomInput.value = String(f.crop.zoom);
			ed.commitSoon();
			return;
		}
		ed.setZoom(ed.z * Math.exp(-e.deltaY * .01), e.clientX, e.clientY);
	}, { passive: false });
}

// pages/editor-tray-drag.js
function addTrayDrag(ed) {
	Object.assign(ed, {
		dropAt,
		setDropTarget
	});
	const trayDrag = {
		rec: null,
		ghost: null,
		suppressClick: false
	};
	ed.trayDrag = trayDrag;
	function dropAt(x, y) {
		const hit = document.elementFromPoint(x, y);
		const fr = hit && hit.closest(".fr");
		if (fr && ed.view.contains(fr)) return { frameId: fr.dataset.id };
		const sr = ed.strip.getBoundingClientRect();
		if (x >= sr.left && x <= sr.right && y >= sr.top && y <= sr.bottom) {
			return { slide: clamp$1(Math.floor((x - sr.left) / (SLIDE_W * ed.z)), ed.firstPage(), ed.lastPage()) };
		}
		return null;
	}
	function setDropTarget(fid) {
		if (ed.dropTarget === fid) return;
		const prev = ed.dropTarget && ed.frameById(ed.dropTarget);
		ed.dropTarget = fid;
		if (prev) ed.placeFrame(prev);
		const next = fid && ed.frameById(fid);
		if (next) ed.placeFrame(next);
	}
	const trayList = () => ed.trayEl.querySelector("[data-tray-list]");
	const trayMax = (list) => {
		const last = list.querySelector(".tray-item:last-child");
		return last ? Math.max(0, last.offsetLeft + last.offsetWidth + 2 - list.clientWidth) : 0;
	};
	let trayInertia = 0;
	function stopTrayGlide() {
		if (trayInertia) cancelAnimationFrame(trayInertia);
		trayInertia = 0;
	}
	function trayGlide(list, v) {
		let last = performance.now();
		const max = trayMax(list);
		const step = (now) => {
			const dt = Math.min(40, now - last);
			last = now;
			const to = clamp$1(list.scrollLeft - v * dt, 0, max);
			list.scrollLeft = to;
			v *= Math.pow(.994, dt);
			trayInertia = Math.abs(v) > .02 && to > 0 && to < max ? requestAnimationFrame(step) : 0;
		};
		trayInertia = requestAnimationFrame(step);
	}
	ed.trayEl.addEventListener("pointerdown", (e) => {
		if (e.target.closest(".tray-add") || e.pointerType === "mouse" && e.button !== 0) return;
		const list = trayList();
		if (!list) return;
		stopTrayGlide();
		const item = e.target.closest(".tray-item");
		trayDrag.rec = {
			pid: item ? item.dataset.pid : null,
			id: e.pointerId,
			x0: e.clientX,
			y0: e.clientY,
			item,
			list,
			mode: null,
			sl: list.scrollLeft,
			samples: [{
				t: performance.now(),
				x: e.clientX
			}]
		};
		trayDrag.suppressClick = false;
		if (e.pointerType !== "mouse") traySwell(e.clientX);
	});
	ed.trayEl.addEventListener("pointermove", (e) => {
		const r = trayDrag.rec;
		if (!r || r.id !== e.pointerId) return;
		const dx = e.clientX - r.x0;
		if (!r.mode) {
			const up = r.y0 - e.clientY;
			if (r.item && up >= 12 && up >= Math.abs(dx)) r.mode = "drag";
			else if (Math.abs(dx) >= 6 && Math.abs(dx) >= Math.abs(e.clientY - r.y0)) r.mode = "scroll";
			else return;
			try {
				ed.trayEl.setPointerCapture(e.pointerId);
			} catch {}
			if (r.mode === "drag") {
				traySwell(null);
				const ghost = document.createElement("img");
				ghost.className = "drag-ghost";
				ghost.src = ed.thumbOf(r.pid);
				document.body.appendChild(ghost);
				trayDrag.ghost = ghost;
			}
		}
		if (r.mode === "scroll") {
			r.list.scrollLeft = clamp$1(r.sl - dx, 0, trayMax(r.list));
			r.samples.push({
				t: performance.now(),
				x: e.clientX
			});
			if (r.samples.length > 6) r.samples.shift();
			if (e.pointerType !== "mouse") traySwell(e.clientX);
			return;
		}
		trayDrag.ghost.style.transform = `translate(${e.clientX - 32}px, ${e.clientY - 32}px)`;
		const d = dropAt(e.clientX, e.clientY);
		setDropTarget(d && d.frameId ? d.frameId : null);
	});
	const endTrayDrag = (e) => {
		const r = trayDrag.rec;
		if (!r || r.id !== e.pointerId) return;
		trayDrag.rec = null;
		if (e.pointerType !== "mouse") traySwell(null);
		if (!r.mode) return;
		trayDrag.suppressClick = true;
		setTimeout(() => trayDrag.suppressClick = false, 400);
		if (r.mode === "scroll") {
			const a = r.samples[0];
			const b = r.samples[r.samples.length - 1];
			const dt = b.t - a.t;
			if (e.type === "pointerup" && dt > 0 && performance.now() - b.t < 60) trayGlide(r.list, (b.x - a.x) / dt);
			return;
		}
		if (trayDrag.ghost) trayDrag.ghost.remove();
		trayDrag.ghost = null;
		setDropTarget(null);
		if (e.type !== "pointerup") return;
		const d = dropAt(e.clientX, e.clientY);
		if (!d) return;
		if (d.frameId) {
			const f = ed.frameById(d.frameId);
			if (f) {
				ed.putPhoto(f, r.pid);
				ed.sel = f.id;
			}
		} else {
			const b = slideBox(ed.p, d.slide);
			const f = newFrame(b.x, b.y, b.w, b.h, r.pid);
			ed.p.frames.push(f);
			ed.sel = f.id;
		}
		ed.photoMode = false;
		ed.render();
		ed.commit();
	};
	ed.trayEl.addEventListener("pointerup", endTrayDrag);
	ed.trayEl.addEventListener("pointercancel", endTrayDrag);
	const SWELL = .45;
	let swellX = null;
	let swellRaf = 0;
	function traySwell(x) {
		swellX = x;
		if (!swellRaf) swellRaf = requestAnimationFrame(applySwell);
	}
	function applySwell() {
		swellRaf = 0;
		const list = ed.trayEl.querySelector("[data-tray-list]");
		const items = list ? [...list.querySelectorAll(".tray-item")] : [];
		const on = swellX !== null && !(trayDrag.rec && trayDrag.rec.mode === "drag") && items.length > 0;
		ed.trayEl.classList.toggle("is-swell", on);
		if (!on) {
			items.forEach((el) => el.style.transform = "");
			return;
		}
		const left = list.getBoundingClientRect().left - list.scrollLeft;
		const pitch = items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : items[0].offsetWidth + 6;
		const R = pitch * 2.2;
		const a = Math.PI / R;
		const push = (d) => Math.abs(d) >= R ? Math.sign(d) * SWELL * (R / 2) : SWELL * (d / 2 + Math.sin(a * d) / (2 * a));
		const w = items[0].offsetWidth;
		const fx = items.map((el) => {
			const d = left + el.offsetLeft + w / 2 - swellX;
			return {
				el,
				d,
				x: push(d),
				k: Math.abs(d) >= R ? 1 : 1 + SWELL * Math.cos(a * d / 2) ** 2
			};
		});
		const first = fx[0];
		const last = fx[fx.length - 1];
		const firstOut = -(first.x - w * (first.k - 1) / 2);
		const lastOut = last.x + w * (last.k - 1) / 2;
		const room = trayMax(list) - list.scrollLeft;
		const nudge = Math.max(0, firstOut - list.scrollLeft) - Math.max(0, lastOut - room);
		for (const { el, x, k } of fx) el.style.transform = `translateX(${(x + nudge).toFixed(1)}px) scale(${k.toFixed(3)})`;
	}
	ed.trayEl.addEventListener("pointermove", (e) => {
		if (e.pointerType !== "mouse") return;
		const list = trayList();
		const r = list && list.getBoundingClientRect();
		traySwell(r && e.clientX >= r.left && e.clientX <= r.right ? e.clientX : null);
	});
	ed.trayEl.addEventListener("pointerleave", (e) => {
		if (e.pointerType === "mouse") traySwell(null);
	});
	ed.trayEl.addEventListener("scroll", () => swellX !== null && traySwell(swellX), {
		capture: true,
		passive: true
	});
}

// pages/editor-keys.js
function addKeys(ed) {
	function onKey(e) {
		if (sheetIsOpen() || ed.destroyed) return;
		if (e.target.closest && e.target.closest("input, textarea, select")) return;
		const mod = e.metaKey || e.ctrlKey;
		const k = e.key.toLowerCase();
		if (mod && k === "z") {
			e.preventDefault();
			if (e.shiftKey) ed.redo();
			else ed.undo();
		} else if (mod && k === "y") {
			e.preventDefault();
			ed.redo();
		} else if ((e.key === "Backspace" || e.key === "Delete") && ed.sel) {
			e.preventDefault();
			ed.deleteSel();
		} else if (e.key === "Escape") {
			ed.deselect();
		} else if (!ed.sel && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
			e.preventDefault();
			ed.turnPage(e.key === "ArrowRight" ? 1 : -1);
		} else if (ed.sel && e.key.startsWith("Arrow")) {
			e.preventDefault();
			const f = ed.selFrame();
			if (!f.photoId) return;
			const n = e.shiftKey ? 10 : 1;
			const dx = e.key === "ArrowLeft" ? -n : e.key === "ArrowRight" ? n : 0;
			const dy = e.key === "ArrowUp" ? -n : e.key === "ArrowDown" ? n : 0;
			const ph = ed.photos[f.photoId];
			const pl = placement(f, ph);
			f.crop = {
				...f.crop,
				cx: pl.cx - dx / (pl.s * pl.rw),
				cy: pl.cy - dy / (pl.s * pl.rh)
			};
			f.crop = clampedCrop(f, ph);
			ed.placeFrame(f);
			ed.commitSoon();
		}
	}
	document.addEventListener("keydown", onKey, { signal: ed.off.signal });
}

// pages/editor.js
async function mountEditor(view, id) {
	const ed = { view };
	Object.assign(ed, {
		previewSources,
		commit,
		undo,
		redo,
		makeThumb
	});
	const loaded = await getProject(id);
	if (!loaded) {
		location.hash = "#/";
		return () => {};
	}
	const p = loaded;
	ed.p = p;
	const recs = await photosForProject(id);
	const photos = {};
	ed.photos = photos;
	const previewUrl = {};
	const thumbUrl = {};
	const previewImg = {};
	const videoUrl = {};
	recs.forEach((r) => photos[r.id] = r);
	p.photoIds = (p.photoIds || []).filter((x) => photos[x]);
	p.frames.forEach((f) => {
		if (f.photoId && !photos[f.photoId]) f.photoId = null;
		if (!f.crop) f.crop = defaultCrop();
	});
	const keep = new Set([...p.photoIds, ...p.frames.map((f) => f.photoId).filter(Boolean)]);
	if (recs.some((r) => !keep.has(r.id))) deleteUnlistedPhotos(id, [...keep]).catch(() => {});
	p.frames.forEach((f) => {
		if (f.photoId && !p.photoIds.includes(f.photoId)) p.photoIds.push(f.photoId);
	});
	const urlOf = (pid) => previewUrl[pid] || (previewUrl[pid] = URL.createObjectURL(photos[pid].preview));
	ed.urlOf = urlOf;
	const thumbOf = (pid) => thumbUrl[pid] || (thumbUrl[pid] = URL.createObjectURL(photos[pid].thumb || photos[pid].preview));
	ed.thumbOf = thumbOf;
	const videoSrc = (pid) => videoUrl[pid] || (videoUrl[pid] = URL.createObjectURL(photos[pid].original));
	ed.videoSrc = videoSrc;
	function previewImage(pid) {
		if (!previewImg[pid]) previewImg[pid] = loadImage(urlOf(pid));
		return previewImg[pid];
	}
	async function previewSources() {
		const ids = [...new Set(p.frames.map((f) => f.photoId).filter((x) => x && photos[x]))];
		const imgs = await Promise.all(ids.map((pid) => previewImage(pid).catch(() => null)));
		const map = {};
		ids.forEach((pid, i) => imgs[i] && (map[pid] = {
			photo: photos[pid],
			src: imgs[i]
		}));
		return (pid) => map[pid] || null;
	}
	ed.sel = null;
	ed.photoMode = false;
	ed.z = .3;
	ed.zoomFit = "one";
	ed.showSafe = true;
	try {
		ed.showSafe = localStorage.getItem(SAFE_KEY) !== "off";
	} catch {}
	ed.margX = 24;
	ed.margY = 32;
	ed.pageLeft = 24;
	ed.bookX = 0;
	ed.spread = 0;
	ed.flipping = false;
	ed.touched = null;
	ed.dropTarget = null;
	ed.destroyed = false;
	ed.gone = false;
	const H = () => slideH(p);
	ed.H = H;
	const frameById = (fid) => p.frames.find((f) => f.id === fid);
	ed.frameById = frameById;
	const selFrame = () => ed.sel ? frameById(ed.sel) : null;
	ed.selFrame = selFrame;
	function holdSpreads() {
		if (!keepInSpreads(p)) return;
		p.frames.forEach((f) => {
			if (f.photoId && photos[f.photoId]) f.crop = clampedCrop(f, photos[f.photoId]);
		});
	}
	const apply = (next) => {
		Object.assign(p, next);
		holdSpreads();
	};
	ed.apply = apply;
	holdSpreads();
	const snapshot = () => {
		const o = {};
		SNAP_KEYS.forEach((k) => o[k] = p[k]);
		return JSON.stringify(o);
	};
	ed.hist = [snapshot()];
	ed.hi = 0;
	const saveSoon = debounce(() => ed.gone || saveProject(p).then((r) => p.updatedAt = r.updatedAt).catch(() => toast("Could not save. Is your storage full?")), 400);
	ed.saveSoon = saveSoon;
	const thumbSoon = debounce(makeThumb, 1500);
	ed.thumbSoon = thumbSoon;
	function commit() {
		const s = snapshot();
		if (s === ed.hist[ed.hi]) return;
		ed.hist = ed.hist.slice(0, ed.hi + 1);
		ed.hist.push(s);
		if (ed.hist.length > 150) ed.hist.shift();
		ed.hi = ed.hist.length - 1;
		saveSoon();
		thumbSoon();
		ed.renderTop();
	}
	const commitSoon = debounce(commit, 600);
	ed.commitSoon = commitSoon;
	function restore(s) {
		const o = JSON.parse(s);
		SNAP_KEYS.forEach((k) => p[k] = o[k]);
		if (ed.sel && !frameById(ed.sel)) {
			ed.sel = null;
			ed.photoMode = false;
		}
		ed.fitIfNeeded();
		ed.render();
		saveSoon();
		thumbSoon();
	}
	function undo() {
		commitSoon.flush();
		if (ed.hi > 0) restore(ed.hist[--ed.hi]);
	}
	function redo() {
		if (ed.hi < ed.hist.length - 1) restore(ed.hist[++ed.hi]);
	}
	async function makeThumb() {
		try {
			const get = await previewSources();
			const c = previewCanvas(p, get, {
				height: 200,
				count: Math.min(3, p.slides),
				gap: 11
			});
			const ctx = c.getContext("2d");
			ctx.globalCompositeOperation = "destination-over";
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, c.width, c.height);
			const blob = await canvasToBlob(c, "image/jpeg", .8);
			c.width = c.height = 0;
			p.thumb = blob;
			await saveProjectThumb(p.id, blob);
		} catch {}
	}
	view.innerHTML = `
    <div class="editor" data-editor>
      <p class="ed-line"><b>Layouts</b><span data-where></span></p>
      <div class="nb-open" data-nb></div>
      <div class="ws" data-ws>
        <div class="ws-inner" data-inner>
          <div class="ws-labels" data-labels></div>
          <div class="strip-shadow" data-shadow></div>
          <div class="strip" data-strip>
            <div class="strip-frames" data-frames></div>
            <div class="strip-bands" data-bands></div>
            <div class="strip-seams" data-seams></div>
            <div class="strip-safe" data-safe></div>
            <div class="strip-guides" data-guides></div>
          </div>
          <div class="sel" data-sel hidden>
            ${[
		"nw",
		"n",
		"ne",
		"e",
		"se",
		"s",
		"sw",
		"w"
	].map((h) => `<span class="handle h-${h}" data-h="${h}"></span>`).join("")}
            <button type="button" class="sel-x" data-act="take-out" aria-label="Take the photo out">${ICONS.x}</button>
          </div>
        </div>
      </div>
      <div class="ed-under" data-name>
        <button type="button" class="ed-name-btn" data-act="rename" aria-label="Rename this layout"><span>${esc(p.name)}</span></button>
        <span class="ed-dots" data-dots aria-hidden="true"></span>
        <button type="button" class="ed-add" data-act="add-slide">${ICONS.plus}Add a ${esc(pageWord(p))}</button>
      </div>
      <div class="ed-adjust" data-adjust hidden>
        <span class="ed-adjust-label">Zoom</span>
        <input type="range" min="1" max="5" step="0.01" value="1" data-zoom aria-label="Photo zoom" />
        <button type="button" class="small-btn primary" data-act="adjust-done">Done</button>
      </div>
      <div class="tray" data-tray></div>
      <nav class="ed-tools" data-tools aria-label="Tools"></nav>
    </div>`;
	document.body.dataset.route = "edit";
	const $ = (s) => view.querySelector(s);
	const ws = $("[data-ws]");
	ed.ws = ws;
	const inner = $("[data-inner]");
	ed.inner = inner;
	const strip = $("[data-strip]");
	ed.strip = strip;
	const framesEl = $("[data-frames]");
	ed.framesEl = framesEl;
	const bandsEl = $("[data-bands]");
	ed.bandsEl = bandsEl;
	const seamsEl = $("[data-seams]");
	ed.seamsEl = seamsEl;
	const safeEl = $("[data-safe]");
	ed.safeEl = safeEl;
	const guidesEl = $("[data-guides]");
	ed.guidesEl = guidesEl;
	const labelsEl = $("[data-labels]");
	ed.labelsEl = labelsEl;
	const editorEl = $("[data-editor]");
	ed.editorEl = editorEl;
	const nbEl = $("[data-nb]");
	ed.nbEl = nbEl;
	const selEl = $("[data-sel]");
	ed.selEl = selEl;
	const adjustEl = $("[data-adjust]");
	ed.adjustEl = adjustEl;
	const zoomInput = $("[data-zoom]");
	ed.zoomInput = zoomInput;
	const addBtn = $(".ed-add");
	ed.addBtn = addBtn;
	ed.whereEl = $("[data-where]");
	ed.dotsEl = $("[data-dots]");
	ed.shadowEl = $("[data-shadow]");
	const nameEl = $("[data-name]");
	ed.nameEl = nameEl;
	const trayEl = $("[data-tray]");
	ed.trayEl = trayEl;
	const toolsEl = $("[data-tools]");
	ed.toolsEl = toolsEl;
	ws.addEventListener("scroll", () => {
		ed.placeBook();
		ed.placeWhere();
		if (ed.sel) ed.placeX();
	}, { passive: true });
	addLayout(ed);
	addStrip(ed);
	addTools(ed);
	addFrameActions(ed);
	addPhotosInOut(ed);
	addSheets(ed);
	addSlideLayouts(ed);
	addButtons(ed);
	addGestures(ed);
	addDragEnd(ed);
	addTrayDrag(ed);
	addKeys(ed);
	const ro = new ResizeObserver(() => {
		if (ed.destroyed) return;
		ed.fitIfNeeded();
		ed.renderStrip();
		ed.renderTools();
	});
	ro.observe(ws);
	ed.render();
	ed.fitTo("all", 0);
	ed.render();
	if (!p.thumb) thumbSoon();
	window.__editor = {
		p,
		photos,
		importInto: ed.importInto,
		render: ed.render,
		commit,
		undo,
		redo,
		get z() {
			return ed.z;
		},
		get spread() {
			return ed.spread;
		},
		get flipping() {
			return ed.flipping;
		},
		setZoom: ed.setZoom,
		fitTo: ed.fitTo,
		select: ed.select,
		openSwap: ed.openSwap,
		flipTo: ed.flipTo,
		showSlide: ed.showSlide
	};
	return function destroy() {
		ed.destroyed = true;
		if (!ed.gone) {
			commitSoon.flush();
			saveSoon.flush();
		}
		thumbSoon.cancel();
		ro.disconnect();
		ed.stopInertia();
		ed.off.abort();
		if (ed.trayDrag.ghost) ed.trayDrag.ghost.remove();
		ed.frameEls.forEach(ed.dropVideo);
		delete document.body.dataset.route;
		setTimeout(() => {
			Object.values(previewUrl).forEach((u) => URL.revokeObjectURL(u));
			Object.values(thumbUrl).forEach((u) => URL.revokeObjectURL(u));
			Object.values(videoUrl).forEach((u) => URL.revokeObjectURL(u));
		}, 1e3);
		if (window.__editor && window.__editor.p === p) delete window.__editor;
	};
}

// components/sticker-sizes.js
const KEY = "stickers";
const PRINT = 1e3;
const EDGE = .04;
const CORNER = .05;
const RECT = 1.5;
const START_SIZE = .42;
const MIN_SIZE = .12;
const MAX_SIZE = 1.5;
const COVER_TALL = 1360 / 1e3;
const BEND = .09;
const INK = "66, 48, 30";
const LOOK = 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const printSize = (ratio) => ratio >= 1 ? [PRINT, Math.round(PRINT / ratio)] : [Math.round(PRINT * ratio), PRINT];
function shapePath(ctx, shape, w, h, inset) {
	const short = Math.min(w, h);
	ctx.beginPath();
	if (shape === "circle") ctx.arc(w / 2, h / 2, short / 2 - inset, 0, Math.PI * 2);
	else ctx.roundRect(inset, inset, w - 2 * inset, h - 2 * inset, Math.max(0, short * CORNER - inset));
}

// components/sticker-print.js
function fade(ctx, w, h) {
	const image = ctx.getImageData(0, 0, w, h);
	const d = image.data;
	const TILE = 256;
	const grain = new Float32Array(TILE * TILE);
	for (let i = 0; i < grain.length; i++) grain[i] = (Math.random() - .5) * 13;
	const LOW = 30;
	const HIGH = 240;
	const span = (HIGH - LOW) / 255;
	for (let y = 0, i = 0; y < h; y++) {
		for (let x = 0; x < w; x++, i += 4) {
			const light = 1.035 - .09 * (x + y) / (w + h);
			const noise = grain[(y >> 1 & 255) * TILE + (x >> 1 & 255)];
			const grey = .3 * d[i] + .59 * d[i + 1] + .11 * d[i + 2];
			d[i] = (LOW + (grey + (d[i] - grey) * .78) * span) * light + noise;
			d[i + 1] = (LOW + (grey + (d[i + 1] - grey) * .78) * span) * light * .985 + noise;
			d[i + 2] = (LOW + (grey + (d[i + 2] - grey) * .78) * span) * light * .95 + noise;
		}
	}
	ctx.putImageData(image, 0, 0);
}
function rimPoint(shape, w, h, a) {
	const cos = Math.cos(a);
	const sin = Math.sin(a);
	const r = shape === "circle" ? Math.min(w, h) / 2 : Math.min(w / 2 / Math.abs(cos || 1e-6), h / 2 / Math.abs(sin || 1e-6));
	return [w / 2 + cos * r, h / 2 + sin * r];
}
function seeded(seed) {
	let t = seed >>> 0;
	return (a = 0, b = 1) => {
		t = t + 1831565813 >>> 0;
		let r = Math.imul(t ^ t >>> 15, 1 | t);
		r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
		return a + ((r ^ r >>> 14) >>> 0) / 4294967296 * (b - a);
	};
}
function softStroke(ctx, scratch, path, { width, blur, colour, mode, from, to }) {
	const s = scratch.getContext("2d");
	s.setTransform(1, 0, 0, 1, 0, 0);
	s.globalCompositeOperation = "source-over";
	s.clearRect(0, 0, scratch.width, scratch.height);
	const OFF = scratch.width + 4 * blur;
	s.save();
	s.lineCap = "round";
	s.lineJoin = "round";
	s.lineWidth = width;
	s.strokeStyle = "#000";
	s.shadowColor = `rgba(${colour})`;
	s.shadowBlur = blur;
	s.shadowOffsetX = OFF;
	s.translate(-OFF, 0);
	s.stroke(path);
	s.restore();
	const g = s.createLinearGradient(from[0], from[1], to[0], to[1]);
	g.addColorStop(0, "rgba(0, 0, 0, 1)");
	g.addColorStop(.5, "rgba(0, 0, 0, 0.8)");
	g.addColorStop(1, "rgba(0, 0, 0, 0)");
	s.globalCompositeOperation = "destination-in";
	s.fillStyle = g;
	s.fillRect(0, 0, scratch.width, scratch.height);
	ctx.save();
	ctx.globalCompositeOperation = mode;
	ctx.drawImage(scratch, 0, 0);
	ctx.restore();
}
function oneCrease(ctx, scratch, shape, w, h, reach, r) {
	const short = Math.min(w, h);
	const k = short / 1e3;
	const a = r(0, Math.PI * 2);
	const [x0, y0] = rimPoint(shape, w, h, a);
	let heading = a + Math.PI + r(.25, .95) * (r() < .5 ? -1 : 1);
	const STEPS = 6;
	const len = short * reach / STEPS;
	const pts = [[x0, y0]];
	for (let i = 0; i < STEPS; i++) {
		heading += r(-.09, .09);
		const [x, y] = pts[i];
		pts.push([x + Math.cos(heading) * len, y + Math.sin(heading) * len]);
	}
	const side = r() < .5 ? -1 : 1;
	const along = (off) => {
		const p = new Path2D();
		const at = (i) => {
			const [ax, ay] = pts[Math.max(0, i - 1)];
			const [bx, by] = pts[Math.min(STEPS, i + 1)];
			const d = Math.hypot(bx - ax, by - ay) || 1;
			return [pts[i][0] - (by - ay) / d * off * side, pts[i][1] + (bx - ax) / d * off * side];
		};
		const q = pts.map((_, i) => at(i));
		p.moveTo(q[0][0], q[0][1]);
		for (let i = 1; i < STEPS; i++) p.quadraticCurveTo(q[i][0], q[i][1], (q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2);
		p.lineTo(q[STEPS][0], q[STEPS][1]);
		return p;
	};
	const from = pts[0];
	const to = pts[STEPS];
	const deep = r(.75, 1.15);
	softStroke(ctx, scratch, along(9 * k), {
		width: 18 * k,
		blur: 30 * k,
		colour: `${INK}, ${.34 * deep}`,
		mode: "multiply",
		from,
		to
	});
	softStroke(ctx, scratch, along(-11 * k), {
		width: 14 * k,
		blur: 26 * k,
		colour: `255, 255, 255, ${.3 * deep}`,
		mode: "screen",
		from,
		to
	});
}
function crease(ctx, shape, w, h, seed) {
	const r = seeded(seed);
	const short = Math.min(w, h);
	ctx.save();
	for (let i = 0, n = 6 + Math.floor(r(0, 4)); i < n; i++) {
		const x = r(0, w);
		const y = r(0, h);
		const rad = short * r(.22, .5);
		const dark = i % 2 === 0;
		const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
		g.addColorStop(0, dark ? `rgba(${INK}, ${r(.035, .06)})` : `rgba(255, 255, 255, ${r(.04, .07)})`);
		g.addColorStop(1, dark ? `rgba(${INK}, 0)` : "rgba(255, 255, 255, 0)");
		ctx.globalCompositeOperation = dark ? "multiply" : "screen";
		ctx.fillStyle = g;
		ctx.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
	}
	for (let i = 0; i < 2; i++) {
		const a = r(0, Math.PI);
		const c = r(-.25, .25) * short;
		const dx = Math.cos(a) * short * .7;
		const dy = Math.sin(a) * short * .7;
		const g = ctx.createLinearGradient(w / 2 + c - dx, h / 2 + c - dy, w / 2 + c + dx, h / 2 + c + dy);
		g.addColorStop(.2, `rgba(${INK}, 0)`);
		g.addColorStop(.46, `rgba(${INK}, 0.1)`);
		g.addColorStop(.56, "rgba(255, 255, 255, 0.09)");
		g.addColorStop(.8, "rgba(255, 255, 255, 0)");
		ctx.globalCompositeOperation = "soft-light";
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
	}
	ctx.globalCompositeOperation = "multiply";
	for (let i = 0, n = 3 + Math.floor(r(0, 3)); i < n; i++) {
		const [x, y] = rimPoint(shape, w, h, r(0, Math.PI * 2));
		const rad = short * r(.12, .26);
		const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
		g.addColorStop(0, `rgba(${INK}, ${r(.12, .24)})`);
		g.addColorStop(1, `rgba(${INK}, 0)`);
		ctx.fillStyle = g;
		ctx.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
	}
	ctx.restore();
	const scratch = document.createElement("canvas");
	scratch.width = w;
	scratch.height = h;
	for (let i = 0, n = 3 + Math.floor(r(0, 3)); i < n; i++) oneCrease(ctx, scratch, shape, w, h, r(.28, .6), r);
	for (let i = 0, n = 2 + Math.floor(r(0, 3)); i < n; i++) oneCrease(ctx, scratch, shape, w, h, r(.1, .2), r);
	scratch.width = scratch.height = 0;
}
const newSeed = () => Math.floor(Math.random() * 4294967296);
async function print(img, cut, shape, ratio, seed) {
	const [w, h] = printSize(ratio);
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	ctx.fillStyle = "#fbf8f1";
	ctx.fillRect(0, 0, w, h);
	const edge = Math.min(w, h) * EDGE;
	ctx.save();
	shapePath(ctx, shape, w, h, edge);
	ctx.clip();
	ctx.imageSmoothingQuality = "high";
	ctx.drawImage(img, cut.x, cut.y, cut.w, cut.h, edge, edge, w - 2 * edge, h - 2 * edge);
	ctx.restore();
	fade(ctx, w, h);
	const plain = await canvasToBlob(canvas, "image/jpeg", .9);
	crease(ctx, shape, w, h, seed);
	const image = await canvasToBlob(canvas, "image/jpeg", .9);
	canvas.width = canvas.height = 0;
	return {
		plain,
		image
	};
}
async function recrease(s) {
	const url = URL.createObjectURL(s.plain);
	try {
		const img = await loadImage(url);
		const canvas = document.createElement("canvas");
		canvas.width = img.naturalWidth;
		canvas.height = img.naturalHeight;
		const ctx = canvas.getContext("2d");
		ctx.drawImage(img, 0, 0);
		crease(ctx, s.shape, canvas.width, canvas.height, s.seed);
		s.image = await canvasToBlob(canvas, "image/jpeg", .9);
		canvas.width = canvas.height = 0;
	} finally {
		URL.revokeObjectURL(url);
	}
	s.creased = true;
	s.look = 2;
}

// components/sticker-crop.js
function followFingers(el, onMove) {
	const fingers = new Map();
	let last = null;
	const read = () => {
		const [a, b] = [...fingers.values()];
		return b ? {
			x: (a.x + b.x) / 2,
			y: (a.y + b.y) / 2,
			d: Math.hypot(a.x - b.x, a.y - b.y)
		} : {
			x: a.x,
			y: a.y,
			d: 0
		};
	};
	el.addEventListener("pointerdown", (e) => {
		if (e.target.closest("button")) return;
		el.setPointerCapture(e.pointerId);
		fingers.set(e.pointerId, {
			x: e.clientX,
			y: e.clientY
		});
		last = read();
	});
	el.addEventListener("pointermove", (e) => {
		if (!fingers.has(e.pointerId)) return;
		fingers.set(e.pointerId, {
			x: e.clientX,
			y: e.clientY
		});
		const now = read();
		onMove(now.x - last.x, now.y - last.y, now.d && last.d ? now.d / last.d : 1);
		last = now;
	});
	const lift = (e) => {
		fingers.delete(e.pointerId);
		last = fingers.size ? read() : null;
	};
	el.addEventListener("pointerup", lift);
	el.addEventListener("pointercancel", lift);
	el.addEventListener("wheel", (e) => {
		e.preventDefault();
		onMove(0, 0, Math.exp(-e.deltaY * .002));
	}, { passive: false });
	el.addEventListener("gesturestart", (e) => e.preventDefault());
}
function cropSheet(img, shape, ratio) {
	return new Promise((resolve) => {
		let answer = null;
		const s = openSheet({
			title: "Crop",
			className: "sheet-small",
			body: `
        <div class="crop-stage"><canvas></canvas><div class="crop-hole is-${shape}"></div></div>
        <p class="field-hint crop-hint">Drag to move. Pinch to zoom.</p>
        <button type="button" class="modal-cta primary" data-crop-ok>Next</button>`,
			onClose: () => resolve(answer)
		});
		const stage = s.body.querySelector(".crop-stage");
		const hole = s.body.querySelector(".crop-hole");
		const view = stage.querySelector("canvas");
		const nw = img.naturalWidth;
		const nh = img.naturalHeight;
		const fit = Math.min(1, 1600 / Math.max(nw, nh));
		const cw = view.width = Math.round(nw * fit);
		const ch = view.height = Math.round(nh * fit);
		const vctx = view.getContext("2d");
		vctx.imageSmoothingQuality = "high";
		vctx.drawImage(img, 0, 0, cw, ch);
		const base = Math.min(stage.clientWidth - 48, window.innerHeight * .42);
		const hw = ratio >= 1 ? base : base * ratio;
		const hh = ratio >= 1 ? base / ratio : base;
		const sw = stage.clientWidth;
		const sh = base + 40;
		stage.style.height = `${sh}px`;
		hole.style.width = `${hw}px`;
		hole.style.height = `${hh}px`;
		if (shape !== "circle") hole.style.borderRadius = cornersOf(ratio);
		const fill = Math.max(hw / cw, hh / ch);
		let zoom = 1;
		let cx = .5;
		let cy = .5;
		let halfW = 0;
		let halfH = 0;
		const show = () => {
			const k = fill * zoom;
			halfW = hw / (2 * cw * k);
			halfH = hh / (2 * ch * k);
			cx = clamp(cx, halfW, 1 - halfW);
			cy = clamp(cy, halfH, 1 - halfH);
			view.style.transform = `translate(${sw / 2 - cx * cw * k}px, ${sh / 2 - cy * ch * k}px) scale(${k})`;
		};
		show();
		followFingers(stage, (dx, dy, pinch) => {
			const k = fill * zoom;
			cx -= dx / (cw * k);
			cy -= dy / (ch * k);
			zoom = clamp(zoom * pinch, 1, 8);
			show();
		});
		s.body.querySelector("[data-crop-ok]").addEventListener("click", () => {
			answer = {
				x: (cx - halfW) * nw,
				y: (cy - halfH) * nh,
				w: 2 * halfW * nw,
				h: 2 * halfH * nh
			};
			view.width = view.height = 0;
			s.close();
		});
	});
}
const cornersOf = (ratio) => ratio >= 1 ? `${CORNER * 100 / ratio}% / ${CORNER * 100}%` : `${CORNER * 100}% / ${CORNER * 100 * ratio}%`;

// components/stickers.js
function mountStickers(root, front) {
	const layer = document.createElement("div");
	layer.className = "nb-stickers";
	const edges = document.createElement("div");
	edges.className = "nb-sticker-edges";
	front.append(layer, edges);
	let list = [];
	let editing = null;
	let gone = false;
	const shown = new Map();
	const SIDES = [
		"right",
		"left",
		"top",
		"bottom"
	];
	function place(o, s) {
		const ratio = s.ratio || 1;
		const fw = s.size;
		const fh = s.size / ratio;
		const left = s.x - fw / 2;
		const top = s.y * COVER_TALL - fh / 2;
		const over = {
			right: left + fw - 1,
			left: -left,
			top: -top,
			bottom: top + fh - COVER_TALL
		};
		o.faces.forEach((el) => {
			el.style.left = `${s.x * 100}%`;
			el.style.top = `${s.y * 100}%`;
			el.style.width = `${s.size * 100}%`;
		});
		const at = {
			right: (1 - left) / fw,
			left: (left + fw) / fw,
			top: (top + fh) / fh,
			bottom: (COVER_TALL - top) / fh
		};
		const bends = [];
		for (const side of SIDES) {
			const show = over[side] > 0;
			o.folds[side].hidden = !show;
			if (!show) continue;
			const strength = clamp(over[side] / .035, 0, 1);
			const e = at[side] * 100;
			const band = BEND / (side === "top" || side === "bottom" ? fh : fw) * 100;
			const way = {
				right: "to right",
				left: "to left",
				top: "to top",
				bottom: "to bottom"
			}[side];
			bends.push(`linear-gradient(${way}, rgba(255, 255, 255, 0) ${e - band}%, rgba(255, 255, 255, ${.36 * strength}) ${e - band * .55}%, rgba(${INK}, ${.1 * strength}) ${e - band * .26}%, rgba(${INK}, ${.68 * strength}) ${e}%)`);
		}
		o.bend.style.backgroundImage = bends.join(", ");
	}
	function face(s, url) {
		const el = document.createElement("i");
		el.className = `nb-sticker is-${s.shape}`;
		const ratio = s.ratio || 1;
		el.style.aspectRatio = String(ratio);
		if (s.shape !== "circle") el.style.borderRadius = cornersOf(ratio);
		const img = new Image();
		img.alt = "";
		img.draggable = false;
		img.src = url;
		el.appendChild(img);
		return el;
	}
	function draw(s) {
		const url = URL.createObjectURL(s.image);
		const clip = document.createElement("div");
		clip.className = "nb-stick-clip";
		const main = face(s, url);
		const bend = document.createElement("b");
		bend.className = "nb-bend";
		main.appendChild(bend);
		clip.appendChild(main);
		layer.appendChild(clip);
		const faces = [main];
		const folds = {};
		for (const side of SIDES) {
			const fold = document.createElement("div");
			fold.className = `nb-fold is-${side}`;
			fold.hidden = true;
			const copy = face(s, url);
			fold.appendChild(copy);
			edges.appendChild(fold);
			faces.push(copy);
			folds[side] = fold;
		}
		const o = {
			clip,
			url,
			faces,
			folds,
			bend
		};
		shown.set(s.id, o);
		place(o, s);
		return main.querySelector("img");
	}
	function undraw(id) {
		const o = shown.get(id);
		if (!o) return;
		o.clip.remove();
		Object.values(o.folds).forEach((f) => f.remove());
		URL.revokeObjectURL(o.url);
		shown.delete(id);
	}
	const ready = getMeta(KEY, []).then(async (saved) => {
		if (gone) return null;
		list = saved || [];
		list.forEach((s) => {
			if (!s.creased && !s.plain) s.plain = s.image;
			if (s.plain && s.seed == null) s.seed = newSeed();
		});
		const stale = list.filter((s) => s.plain && s.look !== 2);
		if (stale.length) {
			await Promise.all(stale.map((s) => recrease(s).catch((e) => console.error(e))));
			setMeta(KEY, list).catch((e) => console.error(e));
		}
		if (gone) return null;
		return Promise.all(list.map((s) => draw(s).decode().catch(() => {})));
	}).catch((e) => console.error(e));
	function edit(s) {
		const o = shown.get(s.id);
		root.classList.add("is-sticking");
		const pad = document.createElement("div");
		pad.className = "nb-stickpad";
		pad.innerHTML = `
      <div class="nb-stick-bar">
        <p class="nb-stick-hint">Drag to move. Pinch to resize.</p>
        <button type="button" class="modal-cta primary nb-stick-ok">OK</button>
      </div>`;
		root.appendChild(pad);
		followFingers(pad, (dx, dy, pinch) => {
			const box = front.getBoundingClientRect();
			s.x = clamp(s.x + dx / box.width, 0, 1);
			s.y = clamp(s.y + dy / box.height, 0, 1);
			s.size = clamp(s.size * pinch, MIN_SIZE, MAX_SIZE);
			place(o, s);
		});
		const finish = () => {
			pad.remove();
			root.classList.remove("is-sticking");
			editing = null;
		};
		editing = {
			s,
			finish
		};
		pad.querySelector(".nb-stick-ok").addEventListener("click", async () => {
			list.push(s);
			finish();
			try {
				await setMeta(KEY, list);
			} catch (e) {
				console.error(e);
				toast("The sticker could not be saved.");
			}
		});
	}
	function drop() {
		if (!editing) return;
		const { s, finish } = editing;
		finish();
		undraw(s.id);
	}
	return {
		ready,
		list: () => list,
		urlOf: (id) => shown.get(id)?.url,
		drop,
		async add(shape, file) {
			const url = URL.createObjectURL(file);
			try {
				let img;
				try {
					img = await loadImage(url);
					if (!img.naturalWidth || !img.naturalHeight) throw new Error("empty");
				} catch (e) {
					console.error(e);
					toast("That photo could not be opened. JPEG and PNG work everywhere.", { ms: 5e3 });
					return;
				}
				const ratio = shape === "rect" ? img.naturalWidth >= img.naturalHeight ? RECT : 1 / RECT : 1;
				const cut = await cropSheet(img, shape, ratio);
				if (!cut || gone || editing || root.dataset.mode !== "closed") return;
				const seed = newSeed();
				const { plain, image } = await print(img, cut, shape, ratio, seed);
				img.src = "";
				const s = {
					id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
					shape,
					ratio,
					creased: true,
					look: 2,
					seed,
					x: .5,
					y: .5,
					size: START_SIZE,
					plain,
					image
				};
				draw(s);
				edit(s);
			} finally {
				URL.revokeObjectURL(url);
			}
		},
		async remove(id) {
			list = list.filter((s) => s.id !== id);
			undraw(id);
			await setMeta(KEY, list);
		},
		destroy() {
			gone = true;
			drop();
			[...shown.keys()].forEach(undraw);
		}
	};
}

// pages/book-sizes.js
const TIP_KEY = "contact-sheet-home-tip";
const RATIO = 1e3 / 1360;
const TIP = `<p class="toc-tip"><b>Keep your layouts safe:</b> add Layouts to your Home Screen. Safari can clear the photos of sites that aren't on it. <button type="button" class="text-btn" data-tip-off>Got it</button></p>`;
const STACK = 16;
const TURNED = 20 * Math.PI / 180;
const PERSPECTIVE = 1100;
const TAB_OUT = .06;
const RIM = 10;
const PAPER_IN = 7;
const OVER = 7 + 12;
const OPEN_MS = 860;
const ZOOM_MS = 760;
const TABS = [["toc", "All layouts"], ["new", "New layout"]];
function artReady() {
	const book = document.documentElement.dataset.book || "berry";
	const ready = ["cover", "block"].map((part) => {
		const img = new Image();
		img.src = `art/${book}-${part}.webp`;
		return img.decode().catch(() => {});
	});
	if (document.fonts && document.fonts.load) ready.push(document.fonts.load("16px \"Klee One\"").catch(() => {}));
	return Promise.race([Promise.all(ready), new Promise((done) => setTimeout(done, 1200))]);
}
function modeOfHash(h) {
	return h === "/contents" || h === "/book" ? "toc" : "closed";
}
const currentMode = () => modeOfHash((location.hash || "#/").slice(1) || "/");

// pages/book-contents.js
function addContents(ed) {
	Object.assign(ed, {
		drawPages,
		releaseThumbs,
		drawToc
	});
	function rowHtml(p) {
		const u = ed.thumbs.get(p.id);
		return `
      <div class="toc-row">
        <a class="toc-open" href="#/edit/${esc(p.id)}" draggable="false">
          <span class="toc-strip" aria-hidden="true">${u ? `<img src="${u}" alt="" draggable="false" />` : "<span class=\"toc-blank\"></span>"}</span>
          <span class="toc-text">
            <span class="toc-name">${esc(p.name)}</span>
            <span class="toc-meta">${p.slides} ${esc(pageWord(p, p.slides !== 1))} · ${esc(shortDate(p.updatedAt))}</span>
          </span>
        </a>
        <button type="button" class="toc-more" data-layout-more="${esc(p.id)}" aria-label="More for ${esc(p.name)}">${MORE$1}</button>
      </div>`;
	}
	function pageHtml() {
		const rows = ed.chapters.map(rowHtml).join("");
		return `
      ${bandHtml({
			title: "Layouts",
			place: "All layouts"
		})}
      <div class="list-head"><h2>Newest first <span>${ed.chapters.length}</span></h2><button type="button" class="list-act" data-toc="new">${PLUS}New layout</button></div>
      <div class="list-rule"></div>
      <div class="toc-list">${rows || "<p class=\"toc-empty\">No layouts yet.</p>"}</div>
      ${ed.showTip ? TIP : ""}`;
	}
	function drawPages() {
		ed.leftEl.innerHTML = pageHtml();
	}
	function releaseThumbs() {
		ed.thumbs.forEach((u) => URL.revokeObjectURL(u));
		ed.thumbs = new Map();
	}
	async function drawToc() {
		const projects = await listProjects();
		if (ed.destroyed) return;
		releaseThumbs();
		ed.chapters = projects;
		ed.chapters.forEach((p) => p.thumb && ed.thumbs.set(p.id, URL.createObjectURL(p.thumb)));
		ed.showTip = (() => {
			if (!isIOS() || isStandalone()) return false;
			try {
				return localStorage.getItem(TIP_KEY) !== "off";
			} catch {
				return true;
			}
		})();
		drawPages();
	}
}

// pages/cover-spin.js
const SPIN_LEFT = .9;
const SPIN_RIGHT = .62;
const TILT = .42;
const soft = (raw, max) => max * Math.tanh(raw / max);
const spinOf = (raw) => soft(raw, raw < 0 ? SPIN_LEFT : SPIN_RIGHT);
function makeTurnable(root, { canStart, onMoved, size }) {
	let spin = 0;
	let tilt = 0;
	let spinV = 0;
	let tiltV = 0;
	let spinGoal = 0;
	let tiltGoal = 0;
	let drag = null;
	let raf = 0;
	let last = 0;
	const paint = () => {
		root.style.setProperty("--spin", `${spin.toFixed(4)}rad`);
		root.style.setProperty("--tilt", `${tilt.toFixed(4)}rad`);
	};
	function frame(now) {
		const dt = Math.min(.033, (now - last) / 1e3 || .016);
		last = now;
		const held = drag && drag.moved;
		spinV += (-(drag ? 40 : 14) * (spin - (held ? spinGoal : 0)) - (drag ? 12 : 7.5) * spinV) * dt;
		tiltV += (-(drag ? 40 : 30) * (tilt - (held ? tiltGoal : 0)) - (drag ? 12 : 10) * tiltV) * dt;
		spin += spinV * dt;
		tilt += tiltV * dt;
		const still = Math.abs(spin) < .001 && Math.abs(tilt) < .001 && Math.abs(spinV) < .01 && Math.abs(tiltV) < .01;
		if (!drag && still) {
			reset();
			return;
		}
		paint();
		raf = requestAnimationFrame(frame);
	}
	function kick() {
		root.classList.add("is-turning");
		if (raf) return;
		last = performance.now();
		raf = requestAnimationFrame(frame);
	}
	function reset() {
		cancelAnimationFrame(raf);
		raf = 0;
		drag = null;
		spin = tilt = spinV = tiltV = 0;
		root.style.removeProperty("--spin");
		root.style.removeProperty("--tilt");
		root.classList.remove("is-turning");
	}
	const down = (e) => {
		if (drag || e.button || !canStart(e)) return;
		drag = {
			id: e.pointerId,
			x: e.clientX,
			y: e.clientY,
			spin,
			tilt,
			moved: false
		};
	};
	const move = (e) => {
		if (!drag || drag.id !== e.pointerId) return;
		const dx = e.clientX - drag.x;
		const dy = e.clientY - drag.y;
		if (!drag.moved) {
			if (Math.hypot(dx, dy) <= 6) return;
			drag.moved = true;
			try {
				root.setPointerCapture(e.pointerId);
			} catch {}
			onMoved();
			kick();
		}
		const k = Math.PI / size() * .5;
		spinGoal = spinOf(drag.spin + dx * k);
		tiltGoal = soft(drag.tilt - dy * k, TILT);
	};
	const up = (e) => {
		if (drag && drag.id === e.pointerId) drag = null;
	};
	root.addEventListener("pointerdown", down);
	root.addEventListener("pointermove", move);
	root.addEventListener("pointerup", up);
	root.addEventListener("pointercancel", up);
	return { reset };
}

// components/sticker-sheets.js
function openRemove(stickers) {
	const s = openSheet({
		title: "Remove sticker",
		className: "sheet-small"
	});
	const drawList = () => {
		s.body.innerHTML = `
      <p class="sheet-message">Tap the one to remove.</p>
      <div class="opt-stickers">
        ${[...stickers.list()].reverse().map((k) => `
          <button type="button" class="opt-sticker is-${k.shape}" data-id="${k.id}" aria-label="Remove this ${k.shape === "rect" ? "rectangle" : k.shape} sticker">
            <img src="${stickers.urlOf(k.id)}" alt="" draggable="false" style="aspect-ratio:${k.ratio || 1}${k.shape === "circle" ? "" : `;border-radius:${cornersOf(k.ratio || 1)}`}" />
          </button>`).join("")}
      </div>`;
	};
	drawList();
	s.body.addEventListener("click", async (e) => {
		const b = e.target.closest("[data-id]");
		if (!b) return;
		await stickers.remove(b.dataset.id);
		if (stickers.list().length) drawList();
		else s.close();
	});
}
function openStickers(stickers, leave) {
	const s = openSheet({
		title: "Stickers",
		className: "sheet-small",
		body: `
      <div class="opt-shapes">
        <button type="button" class="opt-shape" data-shape="circle"><i class="is-circle"></i><span>Circle</span></button>
        <button type="button" class="opt-shape" data-shape="square"><i class="is-square"></i><span>Square</span></button>
        <button type="button" class="opt-shape" data-shape="rect"><i class="is-rect"></i><span>Rectangle</span></button>
      </div>
      ${stickers.list().length ? `
        <div class="choice-list">
          <button type="button" class="choice" data-remove><span class="choice-text"><span class="choice-label">Remove sticker</span></span></button>
        </div>` : ""}`
	});
	s.body.addEventListener("click", (e) => {
		const b = e.target.closest("[data-shape]");
		if (b) {
			const picking = pickFiles({
				multiple: false,
				accept: "image/*"
			});
			s.close();
			if (leave) leave();
			picking.then(([file]) => file && stickers.add(b.dataset.shape, file));
			return;
		}
		if (e.target.closest("[data-remove]")) {
			s.close();
			openRemove(stickers);
		}
	});
}

// pages/intro.js
const CARDS = [
	["A layout is a post", "Tap New layout, pick a size and start from a template or a blank one. Each layout is one post: slides for a carousel, or stories."],
	["Fill the boxes", "Double-tap a box to add a photo or video. A box can run across the edge of a slide, so one photo carries on into the next."],
	["Save it out", "In a layout, Export saves its slides to Photos, ready to post. Options can save everything as one PDF."],
	["Keep a copy", "Your layouts are saved inside the app, on this phone. Now and then, save a backup in Options."]
];
function openIntro() {
	let at = 0;
	const s = openSheet({
		title: CARDS[0][0],
		className: "sheet-small intro"
	});
	const draw = () => {
		const last = at === CARDS.length - 1;
		s.setTitle(CARDS[at][0]);
		s.body.innerHTML = `
      <p class="sheet-message">${CARDS[at][1]}</p>
      <span class="wz-dots intro-dots" aria-hidden="true">${CARDS.map((_, i) => `<i class="${i === at ? "on" : ""}"></i>`).join("")}</span>
      <div class="sheet-actions${at ? "" : " one"}">
        ${at ? "<button type=\"button\" class=\"btn secondary\" data-back>Back</button>" : ""}
        <button type="button" class="btn primary" data-next>${last ? "Got it" : "Next"}</button>
      </div>`;
	};
	s.body.addEventListener("click", (e) => {
		if (e.target.closest("[data-back]")) {
			at--;
			draw();
		} else if (e.target.closest("[data-next]")) {
			if (at === CARDS.length - 1) s.close();
			else {
				at++;
				draw();
			}
		}
	});
	draw();
	return s;
}

// data/backup.js
const D = window.DFData;
const makeBackup = ({ extra = {}, onProgress } = {}) => D.zipBackup({
	app: "contact-sheet",
	databases: ["contact-sheet"],
	extra,
	filename: `contact-sheet-backup-${D.todayStr()}.zip`,
	onProgress
});
const isZipBackup = (file) => D.isZipFile(file);
const restoreBackup$1 = /* @__PURE__ */ __name((files, onProgress) => D.restoreZip(files, {
	databases: ["contact-sheet"],
	onProgress
}), "restoreBackup");

// pages/options-backup.js
function saveBackup() {
	const D = window.DFData;
	let open = true;
	let made = null;
	const s = openSheet({
		title: "Save a backup",
		className: "sheet-small sheet-options",
		body: "<p class=\"sheet-message\" data-msg>Putting it together</p>",
		onClose: () => {
			open = false;
			if (made) made.done();
		}
	});
	const msg = s.body.querySelector("[data-msg]");
	makeBackup({
		extra: { book: document.documentElement.dataset.book || "" },
		onProgress: (f) => {
			if (open) msg.textContent = `Putting it together, ${Math.floor(f * 100)}%`;
		}
	}).then((m) => {
		made = m;
		if (!open) {
			if (m) m.done();
			return;
		}
		if (!m) {
			msg.textContent = "There is nothing to back up yet.";
			return;
		}
		const steps = D.backupSteps(m);
		msg.textContent = steps.note;
		msg.insertAdjacentHTML("afterend", `<button type="button" class="btn secondary opt-wide" data-save>${steps.label}</button>`);
		const btn = s.body.querySelector("[data-save]");
		btn.addEventListener("click", async () => {
			try {
				if (!await steps.tap()) {
					btn.textContent = steps.label;
					return;
				}
				s.close();
				toast("Backup saved");
			} catch (err) {
				console.error(err);
				toast(err.message || "The backup wasn't saved.");
			}
		});
	}).catch((err) => {
		console.error(err);
		if (open) msg.textContent = err.message || "The backup couldn't be made.";
	});
}
async function restoreBackup(close) {
	const D = window.DFData;
	const files = await D.pickFiles(".zip,application/zip,.json,application/json");
	if (!files.length) return;
	if (!await confirmSheet({
		title: "Restore backup",
		message: "Everything in Layouts now is swapped for what's in the file.",
		confirmLabel: "Restore",
		danger: true
	})) return;
	toast("Restoring the backup", { ms: 6e5 });
	try {
		const r = await isZipBackup(files[0]) ? await restoreBackup$1(files) : await D.importDb(files[0], "contact-sheet", {
			app: "contact-sheet",
			replace: true
		});
		const book = r.extra && r.extra.book || (r.local ? await r.local("contact-sheet-book") : null);
		if (book) {
			try {
				localStorage.setItem("contact-sheet-book", book);
			} catch {}
		}
		close();
		toast("Backup restored");
		setTimeout(() => location.reload(), 700);
	} catch (err) {
		console.error(err);
		toast(err.message || "That backup couldn't be restored.");
	}
}

// pages/options.js
const BOOK_KEY = "contact-sheet-book";
const START_KEY = "contact-sheet-start";
const COLORS = [
	["mango", "Mango"],
	["orange", "Orange"],
	["berry", "Berry"],
	["fern", "Fern"],
	["ocean", "Ocean"],
	["leaf", "Leaf"],
	["ink", "Black"]
];
function useBook(name) {
	document.documentElement.dataset.book = name;
	try {
		localStorage.setItem(BOOK_KEY, name);
	} catch {}
}
function startsOnFirstPage() {
	try {
		return localStorage.getItem(START_KEY) === "first";
	} catch {
		return false;
	}
}
const TICK = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><polyline points=\"5 12.5 10 17 19 7\"/></svg>";
const CHEVRON = "<svg class=\"opt-chevron\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><polyline points=\"9 5 16 12 9 19\"/></svg>";
function colorsHtml() {
	const now = document.documentElement.dataset.book || "berry";
	return `<div class="opt-colors" role="radiogroup" aria-label="Notebook color">${COLORS.map(([key, name]) => `
    <button type="button" class="opt-color" role="radio" data-color="${key}" aria-checked="${key === now}">
      <span class="opt-swatch" data-swatch="${key}"><span class="opt-swatch-line"></span><span class="opt-swatch-sun"></span>${key === now ? `<span class="opt-swatch-tick">${TICK}</span>` : ""}</span>
      <span class="opt-color-name">${name}</span>
    </button>`).join("")}</div>`;
}
const row = (attr, name, sub = "") => `<button type="button" class="opt-row" ${attr}><span class="opt-row-words"><span class="opt-row-name">${name}</span>${sub ? `<span class="opt-row-sub">${sub}</span>` : ""}</span>${CHEVRON}</button>`;
function openOptions(stickers) {
	const alone = !window.DF_SUITE;
	const first = startsOnFirstPage();
	const s = openSheet({
		title: "Options",
		className: "opt-sheet",
		body: `
      <span class="opt-label">Notebook color</span>
      <div data-colors>${colorsHtml()}</div>
      ${alone ? `<span class="opt-label opt-gap">Always start</span>
      <div class="opt-seg" role="group" aria-label="Always start">
        <button type="button" data-start="notebook" class="${first ? "" : "on"}" aria-pressed="${!first}">In the notebook</button>
        <button type="button" data-start="first" class="${first ? "on" : ""}" aria-pressed="${first}">On the first page</button>
      </div>` : ""}
      <span class="opt-label opt-gap">Export</span>
      <div class="opt-rows">${row("data-pdf", "Everything as one PDF", "A cover in the app colour, then each layout")}</div>
      ${alone ? `<span class="opt-label opt-gap">Cover</span><div class="opt-rows">${row("data-stickers", "Stickers")}</div>` : ""}
      <span class="opt-label opt-gap">Backups</span>
      <div class="opt-rows">${row("data-save-backup", "Save a backup")}${row("data-restore-backup", "Restore a backup")}</div>
      <span class="opt-label opt-gap">Help</span>
      <div class="opt-rows">${row("data-intro", "How it works")}</div>`
	});
	s.body.addEventListener("click", (e) => {
		const color = e.target.closest("[data-color]");
		if (color) {
			useBook(color.dataset.color);
			s.body.querySelector("[data-colors]").innerHTML = colorsHtml();
			return;
		}
		const start = e.target.closest("[data-start]");
		if (start) {
			try {
				localStorage.setItem(START_KEY, start.dataset.start);
			} catch {}
			s.body.querySelectorAll("[data-start]").forEach((b) => {
				b.classList.toggle("on", b === start);
				b.setAttribute("aria-pressed", String(b === start));
			});
			return;
		}
		if (e.target.closest("[data-stickers]")) openStickers(stickers, () => s.close());
		else if (e.target.closest("[data-pdf]")) {
			s.close();
			openNotebookExport();
		} else if (e.target.closest("[data-intro]")) {
			s.close();
			openIntro();
		} else if (e.target.closest("[data-save-backup]")) saveBackup();
		else if (e.target.closest("[data-restore-backup]")) restoreBackup(() => s.close());
	});
}

// pages/layout-menu.js
async function layoutMenu(id, redraw) {
	const p = await getProject(id);
	if (!p) return;
	const key = await choiceSheet({
		title: p.name,
		options: [
			{
				key: "rename",
				label: "Rename",
				detail: "Also names the exported files."
			},
			{
				key: "duplicate",
				label: "Duplicate",
				detail: "A copy with its own photos."
			},
			{
				key: "delete",
				label: "Delete",
				detail: "It and its photos go from this device.",
				danger: true
			}
		]
	});
	if (key === "rename") {
		const v = await promptSheet({
			title: "Rename",
			value: p.name
		});
		if (!v || v === p.name) return;
		await saveProject({
			...p,
			name: v
		});
	} else if (key === "duplicate") {
		await duplicateProject(p.id, `${p.name} copy`);
	} else if (key === "delete") {
		const ok = await confirmSheet({
			title: "Delete layout?",
			message: `<b>${esc(p.name)}</b> and its photos will be deleted from this device. Photos in your camera roll stay where they are.`,
			confirmLabel: "Delete",
			danger: true
		});
		if (!ok) return;
		await deleteProject(p.id);
	} else {
		return;
	}
	await redraw();
}

// pages/book-touch.js
function addTouch(ed) {
	Object.assign(ed, { onKey });
	ed.root.addEventListener("pointerdown", () => ed.swiped = false, true);
	const turn = makeTurnable(ed.root, {
		size: () => ed.geo.W,
		onMoved: () => ed.swiped = true,
		canStart: (e) => ed.root.dataset.mode === "closed" && !ed.root.classList.contains("is-sticking") && Math.abs(e.clientX - window.innerWidth / 2) <= ed.geo.W * .62 && Math.abs(e.clientY - window.innerHeight / 2) <= ed.geo.H * .56
	});
	ed.turn = turn;
	ed.tocBook.addEventListener("pointerdown", (e) => {
		ed.swipe = {
			id: e.pointerId,
			x: e.clientX,
			y: e.clientY,
			moved: false,
			samples: []
		};
	});
	ed.tocBook.addEventListener("pointermove", (e) => {
		if (!ed.swipe || ed.swipe.id !== e.pointerId) return;
		const dx = e.clientX - ed.swipe.x;
		const dy = e.clientY - ed.swipe.y;
		if (!ed.swipe.moved) {
			if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
			ed.swipe.moved = true;
			try {
				ed.tocBook.setPointerCapture(e.pointerId);
			} catch {}
		}
		ed.swipe.samples.push({
			t: e.timeStamp,
			x: e.clientX
		});
		if (ed.swipe.samples.length > 6) ed.swipe.samples.shift();
	});
	ed.tocBook.addEventListener("pointerup", (e) => {
		if (!ed.swipe || ed.swipe.id !== e.pointerId) return;
		const was = ed.swipe;
		ed.swipe = null;
		if (!was.moved) return;
		ed.swiped = true;
		const dx = e.clientX - was.x;
		const a = was.samples[0];
		const b = was.samples[was.samples.length - 1];
		const v = a && b && b.t > a.t && e.timeStamp - b.t < 60 ? (b.x - a.x) / (b.t - a.t) : 0;
		const flick = Math.abs(v) > .35 && Math.sign(v) === Math.sign(dx);
		if (Math.abs(dx) > window.innerWidth * .28 || flick) ed.step(dx < 0 ? 1 : -1);
	});
	ed.tocBook.addEventListener("pointercancel", () => {
		ed.swipe = null;
	});
	function onKey(e) {
		if (ed.root.dataset.mode !== "toc" || sheetIsOpen()) return;
		if (e.key === "ArrowRight") ed.step(1);
		else if (e.key === "ArrowLeft") ed.step(-1);
	}
	document.addEventListener("keydown", onKey);
	ed.sun.addEventListener("click", () => {
		if (ed.root.dataset.mode === "closed" && !ed.root.classList.contains("is-sticking")) openOptions(ed.stickers);
	});
	ed.root.addEventListener("click", (e) => {
		if (e.target.closest("[data-app-menu]") && ed.root.dataset.mode === "toc" && !sheetIsOpen()) {
			e.stopPropagation();
			openOptions(ed.stickers);
		}
	}, true);
	ed.root.addEventListener("click", async (e) => {
		if (ed.root.classList.contains("is-sticking")) return;
		if (ed.swiped) {
			ed.swiped = false;
			e.preventDefault();
			return;
		}
		const tab = e.target.closest("[data-tab]");
		if (tab) {
			if (tab.dataset.tab === "toc") location.hash = "#/contents";
			else ed.startNew();
			return;
		}
		if (e.target.closest("[data-books]")) {
			location.hash = "#/";
			return;
		}
		if (e.target.closest("[data-toc=\"new\"]")) {
			ed.startNew();
			return;
		}
		const more = e.target.closest("[data-layout-more]");
		if (more) {
			if (!sheetIsOpen()) layoutMenu(more.dataset.layoutMore, ed.drawToc);
			return;
		}
		if (e.target.closest("[data-tip-off]")) {
			try {
				localStorage.setItem(TIP_KEY, "off");
			} catch {}
			ed.showTip = false;
			ed.drawPages();
			return;
		}
		if (e.target.closest(".nb-toc")) return;
		if (ed.root.dataset.mode === "closed") {
			const dx = Math.abs(e.clientX - window.innerWidth / 2);
			const dy = Math.abs(e.clientY - window.innerHeight / 2);
			if (dx <= ed.geo.W / 2 && dy <= ed.geo.H / 2) location.hash = "#/contents";
		}
	});
}

// pages/book.js
function mountBook(view, startMode, onNew) {
	const ed = {};
	Object.assign(ed, { startNew });
	document.body.dataset.route = "book";
	view.innerHTML = `
    <div class="nb no-anim${startMode === "closed" ? " is-waiting" : " cover-later"}" data-mode="${startMode}">
      <div class="nb-ground"></div>
      <div class="nb-float">
        <div class="nb-book">
          <div class="nb-stack">
            ${Array.from({ length: 16 }, (_, i) => `<i style="--i:${i + 1}"></i>`).join("")}
            <b style="--i:${16 + 1}"></b>
            <u class="nb-box is-spine"></u>
            <u class="nb-box is-top"></u>
            <u class="nb-box is-bottom"></u>
          </div>
          <div class="nb-side-tabs">
            ${TABS.map(([key, name], i) => `<i class="is-${key}" style="--t:${i};--i:${5 + i * 6}"><span>${name}</span></i>`).join("")}
          </div>
          <div class="nb-block"></div>
          <div class="nb-leaf">
            <div class="nb-front"></div>
            <div class="nb-inside"></div>
          </div>
        </div>
      </div>
      <div class="nb-tabhits">
        ${TABS.map(([key, name]) => `<button type="button" class="nb-tabhit" data-tab="${key}" aria-label="${name}"></button>`).join("")}
      </div>
      <div class="nb-toc" hidden>
        <div class="toc-page" data-tocbook data-left></div>
      </div>
    </div>
    <button type="button" class="nb-sun" aria-label="App options">${ICONS.sun}</button>`;
	const root = view.querySelector(".nb");
	ed.root = root;
	const sun = view.querySelector(".nb-sun");
	ed.sun = sun;
	const toc = root.querySelector(".nb-toc");
	ed.toc = toc;
	const tocBook = root.querySelector("[data-tocbook]");
	ed.tocBook = tocBook;
	const leftEl = root.querySelector("[data-left]");
	ed.leftEl = leftEl;
	const sideTabs = root.querySelector(".nb-side-tabs");
	const tabHits = root.querySelector(".nb-tabhits");
	const stickers = mountStickers(root, root.querySelector(".nb-front"));
	ed.stickers = stickers;
	ed.geo = {
		W: 300,
		H: 400
	};
	let timer = 0;
	ed.destroyed = false;
	ed.chapters = [];
	ed.thumbs = new Map();
	ed.swipe = null;
	ed.swiped = false;
	ed.showTip = false;
	function shutBook(vw, vh) {
		const cos = Math.cos(TURNED);
		const sin = Math.sin(TURNED);
		const seenOf = (W) => {
			const depth = (16 + 1) * W * .0112;
			return [
				[-W / 2, 0],
				[W / 2, 0],
				[-W / 2, -depth],
				[W / 2 + W * TAB_OUT, -depth * .7]
			].map(([x, d]) => (x * cos - d * sin) * PERSPECTIVE / (PERSPECTIVE - (x * sin + d * cos)));
		};
		const W = Math.min(vw * .78, vh * .66 * RATIO, 460);
		const seen = seenOf(W);
		return {
			W,
			shutX: -(Math.min(...seen) + Math.max(...seen)) / 2 / cos
		};
	}
	function measure() {
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const { W, shutX } = shutBook(vw, vh);
		const H = W / RATIO;
		ed.geo = {
			W,
			H
		};
		const kx = (vw + 19) / W;
		const ky = (vh + 2 * 19) / H;
		const set = (k, v) => root.style.setProperty(k, v);
		set("--W", `${W}px`);
		set("--H", `${H}px`);
		set("--shut-x", `${shutX}px`);
		set("--kx", String(kx));
		set("--ky", String(ky));
		set("--rx", `${10 / kx}px`);
		set("--ry", `${10 / ky}px`);
		set("--toc-x", `${vw / 2}px`);
		set("--new-x", `${-vw / 2}px`);
		set("--toc-y", "0px");
	}
	function placeTabHits() {
		const mode = root.dataset.mode;
		const still = root.classList.contains("no-anim");
		root.classList.add("no-anim");
		root.dataset.mode = "closed";
		const rects = [...sideTabs.children].map((el) => el.getBoundingClientRect());
		[...tabHits.children].forEach((hit, i) => {
			const r = rects[i];
			const above = i ? (rects[i - 1].bottom + r.top) / 2 : r.top - 6;
			const below = i < rects.length - 1 ? (r.bottom + rects[i + 1].top) / 2 : r.bottom + 6;
			hit.style.cssText = `left:${r.left - 8}px;right:0;top:${above}px;height:${below - above}px`;
		});
		root.dataset.mode = mode;
		if (!still) root.classList.remove("no-anim");
		void root.offsetWidth;
	}
	addContents(ed);
	const step = (dir) => {
		if (dir < 0) location.hash = "#/";
	};
	ed.step = step;
	function setMode(next, instant = false) {
		if (next !== "closed") {
			stickers.drop();
			ed.turn.reset();
		}
		clearTimeout(timer);
		const wasShut = root.dataset.mode === "closed";
		if (next === "closed") root.classList.remove("cover-later");
		root.classList.toggle("no-anim", instant);
		if (next === "toc") {
			ed.drawToc();
			root.dataset.mode = "toc";
			const show = () => {
				toc.hidden = false;
				root.classList.add("is-reading");
			};
			if (instant) show();
			else timer = setTimeout(show, wasShut ? 860 : 760);
		} else {
			toc.hidden = true;
			root.classList.remove("is-reading");
			root.dataset.mode = next;
		}
		if (instant) setTimeout(() => root.classList.remove("no-anim"), 60);
	}
	function startNew() {
		const wasShut = root.dataset.mode === "closed";
		setMode("new");
		timer = setTimeout(async () => {
			const made = await onNew();
			if (!made && !ed.destroyed) setMode(currentMode());
		}, wasShut ? 860 : 620);
	}
	addTouch(ed);
	const refit = () => {
		measure();
		placeTabHits();
	};
	window.addEventListener("resize", refit);
	measure();
	setMode(startMode, true);
	placeTabHits();
	if (startMode === "closed") {
		Promise.race([Promise.all([artReady(), stickers.ready]), new Promise((done) => setTimeout(done, 1500))]).then(() => root.classList.remove("is-waiting"));
	} else {
		const warm = () => setTimeout(artReady, 0);
		if (document.readyState === "complete") warm();
		else window.addEventListener("load", warm, { once: true });
	}
	return {
		setMode,
		destroy() {
			ed.destroyed = true;
			clearTimeout(timer);
			window.removeEventListener("resize", refit);
			document.removeEventListener("keydown", ed.onKey);
			ed.releaseThumbs();
			stickers.destroy();
			delete document.body.dataset.route;
		}
	};
}

// pages/welcome.js
function welcome(name, openTour) {
	const suite = window.DF_SUITE;
	if (!suite || !suite.firstVisit) return false;
	const w = suite.words(name);
	let step = "back";
	let toured = false;
	const s = openSheet({
		title: w.back[0],
		className: "sheet-small intro",
		onClose: () => {
			suite.welcomed();
			if (toured) setTimeout(openTour, 60);
		}
	});
	const say = (text) => `<p class="sheet-message">${text}</p>`;
	const one = (label, step) => `<div class="sheet-actions one"><button type="button" class="btn primary" data-step="${step}">${label}</button></div>`;
	const draw = () => {
		if (step === "back") {
			s.setTitle(w.back[0]);
			s.body.innerHTML = say(w.back[1]) + one("Next", "next");
		} else if (step === "ask") {
			s.setTitle(w.ask[0]);
			s.body.innerHTML = say(w.ask[1]) + `<div class="sheet-actions">
        <button type="button" class="btn secondary" data-step="no">${w.ask[3]}</button>
        <button type="button" class="btn primary" data-step="yes">${w.ask[2]}</button>
      </div>`;
		} else {
			s.setTitle(w.later[0]);
			s.body.innerHTML = say(w.later[1]) + one(w.later[2], "done");
		}
	};
	s.body.addEventListener("click", (e) => {
		const b = e.target.closest("[data-step]");
		if (!b) return;
		const k = b.dataset.step;
		if (k === "next") {
			step = "ask";
			draw();
		} else if (k === "no") {
			step = "later";
			draw();
		} else {
			toured = k === "yes";
			s.close();
		}
	});
	draw();
	return true;
}

// components/guide-marks.js
function marksHtml(names, at) {
	const last = names.length - 1;
	const marks = names.map((_, i) => {
		const line = i ? `<span class="guide-line${i <= at ? " inked" : ""}"></span>` : "";
		return `${line}<span class="guide-mark${i === at ? " now" : i < at ? " done" : ""}"></span>`;
	}).join("");
	const words = names.map((n, i) => {
		const where = i === 0 ? "left:0" : i === last ? "right:0" : `left:${i / last * 100}%`;
		return `<span class="guide-mark-name${i <= at ? " reached" : ""}${i && i < last ? " mid" : ""}" style="${where}">${esc(n)}</span>`;
	}).join("");
	return `<div class="guide-marks" role="img" aria-label="Step ${at + 1} of ${names.length}: ${esc(names[at])}"><div class="guide-mark-row">${marks}</div><div class="guide-mark-names" aria-hidden="true">${words}</div></div>`;
}

// data/starters.js
async function seedStarters() {
	if (await getMeta("startersSeeded")) return;
	await saveTemplates(starterTemplates());
	await setMeta("startersSeeded", true);
}

// pages/template-menu.js
async function templateMenu(id, redraw) {
	const list = await listTemplates();
	const i = list.findIndex((t) => t.id === id);
	const t = list[i];
	if (!t) return;
	const key = await choiceSheet({
		title: t.name,
		options: [
			{
				key: "rename",
				label: "Rename"
			},
			{
				key: "duplicate",
				label: "Duplicate"
			},
			...i > 0 ? [{
				key: "up",
				label: "Move up"
			}] : [],
			...i < list.length - 1 ? [{
				key: "down",
				label: "Move down"
			}] : [],
			{
				key: "delete",
				label: "Delete",
				danger: true
			}
		]
	});
	if (!key) return;
	if (key === "rename") {
		const v = await promptSheet({
			title: "Rename template",
			value: t.name
		});
		if (v && v !== t.name) await saveTemplate({
			...t,
			name: v
		});
	} else if (key === "duplicate") {
		const copy = {
			...t,
			id: undefined,
			createdAt: undefined,
			name: `${t.name} copy`,
			starter: false
		};
		delete copy.starterKey;
		list.splice(i + 1, 0, copy);
		await saveTemplates(list.map((x, n) => ({
			...x,
			sortOrder: n
		})));
	} else if (key === "up" || key === "down") {
		const j = key === "up" ? i - 1 : i + 1;
		[list[i], list[j]] = [list[j], list[i]];
		await saveTemplates(list.map((x, n) => ({
			...x,
			sortOrder: n
		})));
	} else if (key === "delete") {
		const ok = await confirmSheet({
			title: "Delete template?",
			message: `<b>${esc(t.name)}</b> will be removed. Drafts made from it stay as they are.`,
			confirmLabel: "Delete",
			danger: true
		});
		if (!ok) return;
		await deleteTemplate(t.id);
	}
	await redraw();
}

// components/template-picture.js
function spreadSvg(t, boxes = true) {
	const W = SLIDE_W;
	const H = RATIOS[t.ratio].h;
	const rects = boxes ? (t.frames || []).filter((f) => f.x < 2 * W).map((f) => `<rect class="spread-box" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}"/>`).join("") : "";
	return `<svg class="spread-svg" viewBox="0 0 ${2 * W} ${H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect class="spread-paper" width="${2 * W}" height="${H}"/>${rects}<line class="spread-seam" x1="${W}" y1="0" x2="${W}" y2="${H}" stroke-width="16" stroke-dasharray="53 53"/></svg>`;
}

// pages/new-layout-steps.js
const MARKS = [
	"Name",
	"Size",
	"Template"
];
const SIZE_GROUPS = [
	["Feed and story", [
		[
			"4:5",
			"Feed",
			"4:5"
		],
		[
			"3:4",
			"Feed",
			"3:4"
		],
		[
			"1:1",
			"Square",
			"1:1"
		],
		[
			"9:16",
			"Story",
			"9:16"
		]
	]],
	["Print", [
		[
			"2:3",
			"Photo",
			"4 × 6"
		],
		[
			"5:7",
			"Photo",
			"5 × 7"
		],
		[
			"8:10",
			"Print",
			"8 × 10"
		],
		[
			"a4",
			"A4",
			""
		]
	]],
	["Screen", [
		[
			"3:2",
			"Landscape",
			"3:2"
		],
		[
			"4:3",
			"Landscape",
			"4:3"
		],
		[
			"16:9",
			"Wide",
			"16:9"
		],
		[
			"letter",
			"Letter",
			"US"
		]
	]]
];
const MORE = "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"5\" r=\"1.6\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"12\" r=\"1.6\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"19\" r=\"1.6\" fill=\"currentColor\"/></svg>";
const head = (title, ask) => `<h1 class="page-title">${esc(title)}</h1><p class="page-ask">${esc(ask)}</p>`;
function nameStep(W) {
	return `${head("Name", "What is this one called?")}
    <input class="guide-input" type="text" data-name value="${esc(W.name)}" placeholder="${esc(W.defaultName)}" aria-label="Name" autocomplete="off" enterkeyhint="next" />`;
}
function shape(ratio) {
	const r = SLIDE_W / RATIOS[ratio].h;
	let w = Math.sqrt(2025 * r);
	let h = Math.sqrt(2025 / r);
	const k = Math.min(1, 60 / Math.max(w, h));
	w *= k;
	h *= k;
	return `<span class="size-shape-box"><span class="size-shape" style="width:${w.toFixed(1)}px;height:${h.toFixed(1)}px"></span></span>`;
}
function sizeStep(W) {
	const card = ([key, name, sub]) => `<button type="button" class="size-card" role="radio" aria-checked="${key === W.ratio}" data-ratio="${key}" aria-label="${esc(RATIOS[key].label)}">${shape(key)}<span class="size-name">${esc(name)}</span><span class="size-sub">${esc(sub)}</span></button>`;
	return `${head("Size", "Where will this one live?")}
    ${SIZE_GROUPS.map(([group, sizes]) => `<p class="guide-group">${esc(group)}</p><div class="size-cards" role="radiogroup" aria-label="${esc(group)}">${sizes.map(card).join("")}</div>`).join("")}`;
}
function templateStep(W, list, blank) {
	const card = (t, id) => `
    <div class="tpl-pick${W.template === id ? " on" : ""}">
      <button type="button" class="tpl-pick-btn" role="radio" aria-checked="${W.template === id}" data-use="${esc(id)}">
        <span class="tpl-pick-art">${spreadSvg(t, !!id)}</span>
        <span class="tpl-pick-name">${esc(t.name)}</span>
      </button>
      ${id ? `<button type="button" class="tpl-pick-more" data-tmore="${esc(id)}" aria-label="More for ${esc(t.name)}">${MORE}</button>` : ""}
    </div>`;
	return `${head("Template", "Start from a layout you've saved, or blank.")}
    <div class="tpl-picks" role="radiogroup" aria-label="Template">${card(blank, "")}${list.map((t) => card(t, t.id)).join("")}</div>
    <p class="guide-small">Save any layout as a template from its More menu.</p>`;
}

// pages/new-layout.js
const dateName = () => `Layout, ${shortDate(new Date().toISOString())}`;
const inRatio = (t, ratio) => t.ratio === ratio ? t : changeRatio(t, ratio);
async function newLayout() {
	await seedStarters();
	return new Promise((resolve) => {
		let made = false;
		const W = {
			step: 0,
			name: "",
			defaultName: dateName(),
			ratio: "3:4",
			template: ""
		};
		let list = [];
		const s = openSheet({
			title: "New layout",
			className: "sheet-page sheet-guide",
			onClose: () => resolve(made)
		});
		s.body.innerHTML = `
      ${shortBandHtml({
			name: "New layout",
			backAttr: "data-back",
			end: {
				label: "Close",
				attr: "data-close",
				svg: CLOSE
			}
		})}
      <div class="page-scroll" data-scroll></div>
      <div class="page-foot guide-foot">
        <button type="button" class="btn secondary" data-back>Back</button>
        <button type="button" class="btn primary" data-next></button>
      </div>`;
		const scroll = s.body.querySelector("[data-scroll]");
		const next = s.body.querySelector("[data-next]");
		async function draw(keepPlace = false) {
			if (W.step === 2) list = (await listTemplates()).filter((t) => t.starterKey !== "story" && t.starterKey !== "full-bleed");
			if (!s.overlay.isConnected) return;
			const blank = {
				...blankLayout(W.ratio),
				name: "Blank"
			};
			const body = W.step === 0 ? nameStep(W) : W.step === 1 ? sizeStep(W) : templateStep(W, list.map((t) => inRatio(t, W.ratio)), blank);
			const top = scroll.scrollTop;
			scroll.innerHTML = marksHtml(MARKS, W.step) + body;
			scroll.scrollTop = keepPlace ? top : 0;
			next.textContent = W.step < 2 ? `Next: ${MARKS[W.step + 1]}` : "Make it";
			const name = scroll.querySelector("[data-name]");
			name?.addEventListener("input", () => W.name = name.value);
			name?.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					go(1);
				}
			});
		}
		async function make() {
			const t = list.find((x) => x.id === W.template);
			const layout = t ? layoutFromTemplate(inRatio(t, W.ratio)) : blankLayout(W.ratio);
			made = true;
			const p = await saveProject({
				name: W.name.trim() || W.defaultName,
				photoIds: [],
				thumb: null,
				...layout
			});
			s.close();
			location.hash = `#/edit/${p.id}`;
		}
		function go(dir) {
			if (dir < 0 && W.step === 0) return s.close();
			if (dir > 0 && W.step === 2) return make();
			W.step += dir;
			draw();
		}
		s.body.addEventListener("click", (e) => {
			if (e.target.closest("[data-back]")) return go(-1);
			if (e.target.closest("[data-next]")) return go(1);
			const size = e.target.closest("[data-ratio]");
			if (size) {
				W.ratio = size.dataset.ratio;
				return draw(true);
			}
			const more = e.target.closest("[data-tmore]");
			if (more) {
				return templateMenu(more.dataset.tmore, async () => {
					await draw(true);
					if (W.template && !list.some((t) => t.id === W.template)) {
						W.template = "";
						draw(true);
					}
				});
			}
			const use = e.target.closest("[data-use]");
			if (use) {
				W.template = use.dataset.use;
				draw(true);
			}
		});
		draw();
	});
}

// app.js
const view = document.getElementById("view");
let destroyCurrent = null;
let book = null;
let routeToken = 0;
const suite = window.DF_SUITE;
async function route() {
	const h0 = (location.hash || "#/").slice(1) || "/";
	if (suite && h0 === "/") {
		suite.home();
		return;
	}
	const token = ++routeToken;
	if (destroyCurrent) {
		destroyCurrent();
		destroyCurrent = null;
	}
	closeAllSheets();
	const h = (location.hash || "#/").slice(1) || "/";
	const m = h.match(/^\/edit\/(.+)$/);
	try {
		if (m) {
			if (book) book.destroy();
			book = null;
			view.dataset.route = "edit";
			const destroy = await mountEditor(view, decodeURIComponent(m[1]));
			if (token !== routeToken) destroy();
			else destroyCurrent = destroy;
		} else {
			view.dataset.route = "book";
			if (book) book.setMode(modeOfHash(h));
			else book = mountBook(view, modeOfHash(h), newLayout);
		}
	} catch (e) {
		console.error(e);
		view.innerHTML = `<div class="empty"><p class="empty-title">Something went wrong</p><p>${esc(e.message || "Try reloading the page.")}</p></div>`;
	}
	if (!m) window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
if (suite || startsOnFirstPage()) {
	if ((location.hash || "#/") === "#/") history.replaceState(null, "", "#/contents");
}
route();
if (suite && suite.at === "new") setTimeout(newLayout, 400);
else if (suite && suite.firstVisit) setTimeout(() => {
	if (!document.querySelector(".sheet-overlay")) welcome("Layouts", openIntro);
}, 900);
try {
	const o = screen.orientation;
	if (o && o.lock) o.lock("portrait").catch(() => {});
} catch {}
if ("serviceWorker" in navigator && location.protocol !== "file:") {
	navigator.serviceWorker.register("./sw.js").catch(() => {});
}
