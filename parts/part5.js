        /* ============================================================
           Constants
           ============================================================ */

        const APP_VERSION = "2.4.0";
        const CONFIG_VERSION = 3;
        const MAX_SHORTCUTS = 40;

        const STORAGE_KEYS = {
            config: "sp2:config",
            drafts: "sp2:drafts",
            heights: "sp2:heights",
            lastSaved: "sp2:lastSaved"
        };

        const LEGACY_KEYS = {
            shortcuts: "engineShortcuts",
            geminiDraft: "backupGeminiText",
            googleHeight: "googleInputHeight",
            geminiHeight: "geminiInputHeight"
        };

        // These were the old personal defaults. They are stripped once from
        // pre-v3 configs so fresh visitors start with a clean shortcut list.
        const RETIRED_DEFAULT_SHORTCUTS = Object.freeze({
            m: "https://myinstants.com/",
            y: "https://youtube.com/"
        });

        const THEMES = {
            midnight: { name: "Midnight", accent: "#8ab4f8", meta: "#131314", swatch: ["#131314", "#1e1f20"] },
            amoled: { name: "AMOLED", accent: "#8ab4f8", meta: "#000000", swatch: ["#000000", "#0d0d0d"] },
            slate: { name: "Slate", accent: "#7aa2ff", meta: "#0b1220", swatch: ["#0b1220", "#141d2e"] },
            ocean: { name: "Ocean", accent: "#4dd0e1", meta: "#061a20", swatch: ["#061a20", "#0c2831"] },
            light: { name: "Daylight", accent: "#1a73e8", meta: "#f4f6fb", swatch: ["#f4f6fb", "#ffffff"] }
        };

        const SEARCH_ENGINES = {
            google: { name: "Google", url: "https://www.google.com/search?q={query}" },
            duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com/?q={query}" },
            bing: { name: "Bing", url: "https://www.bing.com/search?q={query}" },
            brave: { name: "Brave Search", url: "https://search.brave.com/search?q={query}" },
            startpage: { name: "Startpage", url: "https://www.startpage.com/sp/search?query={query}" },
            custom: { name: "Custom URL", url: "" }
        };

        const DEFAULT_CONFIG = {
            configVersion: CONFIG_VERSION,
            theme: "midnight",
            accent: "#8ab4f8",
            background: "aurora",
            customBackgroundUrl: "",
            backgroundDim: 55,
            backgroundBlur: 0,
            compact: false,
            showClock: true,
            clock24h: false,
            showGreeting: true,
            userName: "Nika",
            showShortcutChips: true,
            showGoogle: true,
            showGemini: true,
            searchEngine: "google",
            customSearchUrl: "https://www.google.com/search?q={query}",
            googlePlaceholder: "Search Google...",
            geminiPlaceholder: "Ask Gemini...",
            openSearchInNewTab: false,
            copyGeminiPrompt: true,
            saveDrafts: true,
            autofocus: true,
            shortcuts: {}
        };

        /* ============================================================
           Small utilities
           ============================================================ */

        const $id = (id) => document.getElementById(id);
        const $all = (selector, root = document) => Array.from(root.querySelectorAll(selector));

        const clone = (value) => {
            if (typeof structuredClone === "function") {
                try { return structuredClone(value); } catch {}
            }
            return JSON.parse(JSON.stringify(value));
        };

        const isPlainObject = (value) =>
            value !== null && typeof value === "object" && !Array.isArray(value);

        const safeParse = (raw, fallback = null) => {
            if (typeof raw !== "string" || !raw) return fallback;
            try { return JSON.parse(raw); } catch { return fallback; }
        };

        const canonical = (value) => {
            if (Array.isArray(value)) return value.map(canonical);
            if (isPlainObject(value)) {
                const out = {};
                Object.keys(value).sort().forEach((key) => { out[key] = canonical(value[key]); });
                return out;
            }
            return value;
        };

        const clampInt = (value, min, max, fallback) => {
            const number = Number(value);
            if (!Number.isFinite(number)) return fallback;
            return Math.min(max, Math.max(min, Math.round(number)));
        };

        const cleanText = (value, maxLength, fallback = "") => {
            if (typeof value !== "string") return fallback;
            return value.trim().slice(0, maxLength) || fallback;
        };

        const normalizeHex = (value, fallback = "#8ab4f8") => {
            let text = String(value || "").trim();
            if (!text) return fallback;
            if (!text.startsWith("#")) text = "#" + text;
            if (/^#[0-9a-f]{3}$/i.test(text)) {
                text = "#" + text[1] + text[1] + text[2] + text[2] + text[3] + text[3];
            }
            if (!/^#[0-9a-f]{6}$/i.test(text)) return fallback;
            return text.toLowerCase();
        };

        const hexToRgb = (hex) => {
            const clean = normalizeHex(hex, "#8ab4f8").slice(1);
            return {
                r: parseInt(clean.slice(0, 2), 16),
                g: parseInt(clean.slice(2, 4), 16),
                b: parseInt(clean.slice(4, 6), 16)
            };
        };

        const relativeLuminance = ({ r, g, b }) => {
            const channel = (value) => {
                const v = value / 255;
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            };
            return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        };

        const contrastRatio = (first, second) => {
            const a = relativeLuminance(first);
            const b = relativeLuminance(second);
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        };

        const mixHex = (hex, target, amount) => {
            const from = hexToRgb(hex);
            const to = hexToRgb(target);
            const mix = (a, b) => Math.round(a + (b - a) * amount);
            return "#" + [mix(from.r, to.r), mix(from.g, to.g), mix(from.b, to.b)]
                .map((value) => value.toString(16).padStart(2, "0"))
                .join("");
        };

        const parseHeight = (value) => {
            const number = parseFloat(String(value || "").replace("px", ""));
            if (!Number.isFinite(number)) return null;
            return Math.min(300, Math.max(40, Math.round(number)));
        };

        const normalizeTrigger = (value) => {
            const trigger = String(value || "").trim().toLowerCase();
            if (!/^[a-z0-9!@#$%^&*_+.\-]{1,24}$/.test(trigger)) return null;
            return trigger;
        };

        const normalizeUrl = (value) => {
            let text = String(value || "").trim();
            if (!text) return null;
            if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = "https://" + text;
            try {
                const url = new URL(text);
                if (url.protocol !== "http:" && url.protocol !== "https:") return null;
                return url.href;
            } catch {
                return null;
            }
        };

        const normalizeSearchUrl = (value) => {
            let text = String(value || "").trim();
            if (!text) return null;
            if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = "https://" + text;
            text = text.replace(/%s/g, "{query}");
            if (!text.includes("{query}")) return null;
            try {
                new URL(text.replace(/\{query\}/g, "engine-test"));
                if (!/^https?:\/\//i.test(text)) return null;
                return text;
            } catch {
                return null;
            }
        };

        const normalizeImageUrl = (value) => {
            const text = String(value || "").trim();
            if (!text) return "";
            if (/^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i.test(text)) {
                return text;
            }
            try {
                const url = new URL(text, window.location.href);
                const allowed = url.protocol === "https:" || url.protocol === "http:" ||
                    (window.location.protocol === "file:" && url.protocol === "file:");
                return allowed ? url.href : "";
            } catch {
                return "";
            }
        };

        const normalizeShortcuts = (value) => {
            const out = {};
            if (!isPlainObject(value)) return out;
            for (const [rawTrigger, rawUrl] of Object.entries(value)) {
                if (Object.keys(out).length >= MAX_SHORTCUTS) break;
                const trigger = normalizeTrigger(rawTrigger);
                const url = normalizeUrl(rawUrl);
                if (trigger && url) out[trigger] = url;
            }
            return out;
        };

        const prettyHost = (value) => {
            try {
                return new URL(value).hostname.replace(/^www\./i, "") || value;
            } catch {
                return value;
            }
        };

        const normalizeConfig = (input) => {
            const source = isPlainObject(input) ? input : {};
            const theme = Object.prototype.hasOwnProperty.call(THEMES, source.theme)
                ? source.theme
                : DEFAULT_CONFIG.theme;
            const background = ["aurora", "mesh", "solid", "image"].includes(source.background)
                ? source.background
                : DEFAULT_CONFIG.background;

            return {
                configVersion: CONFIG_VERSION,
                theme,
                accent: normalizeHex(source.accent, THEMES[theme].accent),
                background,
                customBackgroundUrl: normalizeImageUrl(source.customBackgroundUrl),
                backgroundDim: clampInt(source.backgroundDim, 0, 90, DEFAULT_CONFIG.backgroundDim),
                backgroundBlur: clampInt(source.backgroundBlur, 0, 24, DEFAULT_CONFIG.backgroundBlur),
                compact: Boolean(source.compact),
                showClock: source.showClock !== false,
                clock24h: Boolean(source.clock24h),
                showGreeting: source.showGreeting !== false,
                userName: cleanText(source.userName, 24, ""),
                showShortcutChips: source.showShortcutChips !== false,
                showGoogle: source.showGoogle !== false,
                showGemini: source.showGemini !== false,
                searchEngine: Object.prototype.hasOwnProperty.call(SEARCH_ENGINES, source.searchEngine)
                    ? source.searchEngine
                    : DEFAULT_CONFIG.searchEngine,
                customSearchUrl: normalizeSearchUrl(source.customSearchUrl) || DEFAULT_CONFIG.customSearchUrl,
                googlePlaceholder: cleanText(source.googlePlaceholder, 60, DEFAULT_CONFIG.googlePlaceholder),
                geminiPlaceholder: cleanText(source.geminiPlaceholder, 60, DEFAULT_CONFIG.geminiPlaceholder),
                openSearchInNewTab: Boolean(source.openSearchInNewTab),
                copyGeminiPrompt: source.copyGeminiPrompt !== false,
                saveDrafts: source.saveDrafts !== false,
                autofocus: source.autofocus !== false,
                shortcuts: normalizeShortcuts(source.shortcuts)
            };
        };

        const withoutRetiredShortcuts = (shortcuts) => {
            const cleaned = { ...shortcuts };
            for (const [trigger, url] of Object.entries(RETIRED_DEFAULT_SHORTCUTS)) {
                if (cleaned[trigger] === url) delete cleaned[trigger];
            }
            return cleaned;
        };

        const migrateConfig = (input) => {
            const source = isPlainObject(input) ? clone(input) : {};
            const version = Number(source.configVersion);
            if (Number.isFinite(version) && version >= CONFIG_VERSION) return source;

            source.shortcuts = withoutRetiredShortcuts(normalizeShortcuts(source.shortcuts));
            source.userName = DEFAULT_CONFIG.userName;
            source.configVersion = CONFIG_VERSION;
            return source;
        };

        /* ============================================================
           Storage
           ============================================================ */

        const storage = {
            get(key) {
                try { return window.localStorage.getItem(key); } catch { return null; }
            },
            set(key, value) {
                try {
                    window.localStorage.setItem(key, value);
                    return true;
                } catch {
                    return false;
                }
            },
            remove(key) {
                try { window.localStorage.removeItem(key); } catch {}
            },
            test() {
                const key = "sp2:test";
                try {
                    window.localStorage.setItem(key, "1");
                    window.localStorage.removeItem(key);
                    return true;
                } catch {
                    return false;
                }
            }
        };

        const readLegacyShortcuts = () => {
            const raw = storage.get(LEGACY_KEYS.shortcuts);
            const parsed = safeParse(raw, null);
            const normalized = normalizeShortcuts(parsed);
            const shortcuts = withoutRetiredShortcuts(normalized);
            if (raw && JSON.stringify(shortcuts) !== JSON.stringify(normalized)) {
                storage.set(LEGACY_KEYS.shortcuts, JSON.stringify(shortcuts));
            }
            return { shortcuts, count: Object.keys(shortcuts).length };
        };

        const loadInitialConfig = () => {
            const stored = storage.get(STORAGE_KEYS.config);
            if (stored) {
                const parsed = safeParse(stored, null);
                const config = normalizeConfig(migrateConfig(parsed));
                const previousVersion = Number(parsed && parsed.configVersion) || 0;
                if (previousVersion < CONFIG_VERSION) {
                    storage.set(STORAGE_KEYS.config, JSON.stringify(config));
                    storage.set(LEGACY_KEYS.shortcuts, JSON.stringify(config.shortcuts));
                }
                return {
                    config,
                    migrated: false,
                    legacyCount: 0
                };
            }

            let alternate = null;
            for (const key of ["startpageConfig", "engineConfig", "startpageEngineConfig"]) {
                const raw = storage.get(key);
                if (!raw) continue;
                const parsed = safeParse(raw, null);
                if (isPlainObject(parsed)) { alternate = parsed; break; }
            }

            const legacy = readLegacyShortcuts();

            if (alternate) {
                const merged = normalizeConfig(migrateConfig(alternate));
                for (const [trigger, url] of Object.entries(legacy.shortcuts)) {
                    if (!Object.prototype.hasOwnProperty.call(merged.shortcuts, trigger)) {
                        merged.shortcuts[trigger] = url;
                    }
                }
                merged.shortcuts = withoutRetiredShortcuts(merged.shortcuts);
                storage.set(STORAGE_KEYS.config, JSON.stringify(merged));
                return { config: merged, migrated: legacy.count > 0, legacyCount: legacy.count };
            }

            if (legacy.count > 0) {
                const config = normalizeConfig({ ...DEFAULT_CONFIG, shortcuts: legacy.shortcuts });
                storage.set(STORAGE_KEYS.config, JSON.stringify(config));
                return { config, migrated: true, legacyCount: legacy.count };
            }

            return {
                config: normalizeConfig(DEFAULT_CONFIG),
                migrated: false,
                legacyCount: 0
            };
        };

        const loadHeights = () => {
            const stored = safeParse(storage.get(STORAGE_KEYS.heights), null);
            const google = parseHeight(stored && stored.google) ??
                parseHeight(storage.get(LEGACY_KEYS.googleHeight)) ?? 40;
            const gemini = parseHeight(stored && stored.gemini) ??
                parseHeight(storage.get(LEGACY_KEYS.geminiHeight)) ?? 40;
            return { google, gemini };
        };

        const loadDrafts = () => {
            const stored = safeParse(storage.get(STORAGE_KEYS.drafts), null);
            const googleDraft = isPlainObject(stored) && typeof stored.google === "string"
                ? stored.google
                : "";
            const geminiDraft = isPlainObject(stored) && typeof stored.gemini === "string"
                ? stored.gemini
                : (storage.get(LEGACY_KEYS.geminiDraft) || "");
            return { google: googleDraft, gemini: geminiDraft };
        };

        const formatSavedAt = (iso) => {
            if (!iso) return "Not yet";
            const date = new Date(iso);
            if (Number.isNaN(date.getTime())) return "Unknown";
            try {
                return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(date);
            } catch {
                return date.toLocaleDateString();
            }
        };

        const formatBytes = (bytes) => {
            if (bytes < 1024) return bytes + " B";
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
            return (bytes / (1024 * 1024)).toFixed(1) + " MB";
        };

        /* ============================================================
           DOM references
           ============================================================ */

        const dom = {
            homeView: $id("homeView"),
            versionView: $id("versionView"),
            editView: $id("editView"),

            searchForm: $id("searchForm"),
            searchInput: $id("searchInput"),
            geminiWrapper: $id("geminiWrapper"),
            geminiInput: $id("geminiInput"),
            geminiBtn: $id("geminiBtn"),
            quickLinks: $id("quickLinks"),
            heroCopy: $id("heroCopy"),
            greeting: $id("greeting"),
            dateLine: $id("dateLine"),
            clockWrap: $id("clockWrap"),
            clockTime: $id("clockTime"),

            settingsBtn: $id("settingsBtn"),
            brandBtn: $id("brandBtn"),
            versionBadge: $id("versionBadge"),
            footerCustomize: $id("footerCustomize"),

            versionBackBtn: $id("versionBackBtn"),
            versionSettingsBtn: $id("versionSettingsBtn"),
            aboutCustomize: $id("aboutCustomize"),
            aboutExport: $id("aboutExport"),
            aboutCopy: $id("aboutCopy"),
            aboutHomeBtn: $id("aboutHomeBtn"),
            manageShortcutsBtn: $id("manageShortcutsBtn"),
            versionShortcutCount: $id("versionShortcutCount"),
            versionThemeName: $id("versionThemeName"),
            versionSavedAt: $id("versionSavedAt"),
            versionChips: $id("versionChips"),

            editorBackBtn: $id("editorBackBtn"),
            topSaveBtn: $id("topSaveBtn"),
            bottomSaveBtn: $id("bottomSaveBtn"),
            revertBtn: $id("revertBtn"),
            dirtyIndicator: $id("dirtyIndicator"),
            dirtyIndicatorBottom: $id("dirtyIndicatorBottom"),

            themeGrid: $id("themeGrid"),
            accentColor: $id("accentColor"),
            accentHex: $id("accentHex"),
            resetAccentBtn: $id("resetAccentBtn"),
            bgStyle: $id("bgStyle"),
            imageBgFields: $id("imageBgFields"),
            bgUrl: $id("bgUrl"),
            dimValue: $id("dimValue"),
            blurValue: $id("blurValue"),
            userName: $id("userName"),

            searchEngine: $id("searchEngine"),
            customSearchFields: $id("customSearchFields"),
            customSearchUrl: $id("customSearchUrl"),
            googlePlaceholder: $id("googlePlaceholder"),
            geminiPlaceholder: $id("geminiPlaceholder"),

            scTriggerInput: $id("scTriggerInput"),
            scUrlInput: $id("scUrlInput"),
            scSaveBtn: $id("scSaveBtn"),
            scCancelBtn: $id("scCancelBtn"),
            shortcutEditorList: $id("shortcutEditorList"),
            shortcutCountLabel: $id("shortcutCountLabel"),

            exportBtn: $id("exportBtn"),
            copyConfigBtn: $id("copyConfigBtn"),
            importFileBtn: $id("importFileBtn"),
            importFileInput: $id("importFileInput"),
            pasteImportBtn: $id("pasteImportBtn"),
            lastSavedLabel: $id("lastSavedLabel"),
            configSizeLabel: $id("configSizeLabel"),
            legacyStatus: $id("legacyStatus"),
            legacyImportBtn: $id("legacyImportBtn"),
            clearDraftsBtn: $id("clearDraftsBtn"),
            resetPrefsBtn: $id("resetPrefsBtn"),
            factoryResetBtn: $id("factoryResetBtn"),
            storageStatus: $id("storageStatus"),

            modalOverlay: $id("modalOverlay"),
            modalBox: $id("modalBox"),
            modalTitle: $id("modalTitle"),
            modalText: $id("modalText"),
            modalField: $id("modalField"),
            modalFieldLabel: $id("modalFieldLabel"),
            modalInput: $id("modalInput"),
            modalActions: $id("modalActions"),
            modalCloseBtn: $id("modalCloseBtn"),

            loadingOverlay: $id("loadingOverlay"),
            toastRegion: $id("toastRegion"),
            bgImage: $id("bgImage"),
            themeColorMeta: $id("themeColorMeta")
        };
