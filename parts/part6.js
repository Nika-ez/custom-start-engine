        /* ============================================================
           State
           ============================================================ */

        const storageOk = storage.test();
        const initial = loadInitialConfig();

        let savedConfig = initial.config;
        let draftConfig = clone(savedConfig);
        let previewConfig = clone(savedConfig);

        let currentView = "home";
        let activeTab = "appearance";
        let pendingTab = "appearance";
        let editingTrigger = null;
        let modalLastFocus = null;
        let modalDismissible = true;
        let draftTimer = null;

        /* ============================================================
           Theme + background
           ============================================================ */

        const applyAccent = (accent) => {
            const hex = normalizeHex(accent, THEMES[savedConfig.theme].accent);
            const rgb = hexToRgb(hex);
            const darkInk = { r: 11, g: 15, b: 20 };
            const whiteInk = { r: 255, g: 255, b: 255 };
            const useDarkInk = contrastRatio(rgb, darkInk) >= contrastRatio(rgb, whiteInk);
            const root = document.documentElement;
            root.style.setProperty("--accent", hex);
            root.style.setProperty("--accent-ink", useDarkInk ? "#0b0f14" : "#ffffff");
            root.style.setProperty("--accent-soft", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`);
            root.style.setProperty("--accent-glow", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);
            root.style.setProperty("--accent-strong", mixHex(hex, useDarkInk ? "#000000" : "#ffffff", 0.14));
        };

        const setBackgroundImage = (url) => {
            if (!url) {
                dom.bgImage.style.backgroundImage = "none";
                return;
            }
            const safe = url.replace(/["\\\n\r]/g, (character) => encodeURIComponent(character));
            dom.bgImage.style.backgroundImage = `url("${safe}")`;
        };

        const applyConfig = (config) => {
            previewConfig = config;
            const root = document.documentElement;
            const theme = THEMES[config.theme] || THEMES.midnight;
            const imageUrl = config.background === "image"
                ? normalizeImageUrl(config.customBackgroundUrl)
                : "";
            const effectiveBackground = config.background === "image" && !imageUrl
                ? "aurora"
                : config.background;

            root.dataset.theme = config.theme;
            root.dataset.bg = effectiveBackground;
            root.style.setProperty("--bg-dim", String(config.backgroundDim / 100));
            root.style.setProperty("--bg-blur", config.backgroundBlur + "px");

            applyAccent(config.accent);
            dom.themeColorMeta.setAttribute("content", theme.meta);
            document.body.classList.toggle("compact", Boolean(config.compact));

            dom.clockWrap.hidden = !config.showClock;
            dom.heroCopy.hidden = !config.showGreeting;
            dom.searchForm.hidden = !config.showGoogle;
            dom.geminiWrapper.hidden = !config.showGemini;

            dom.searchInput.placeholder = config.googlePlaceholder;
            dom.geminiInput.placeholder = config.geminiPlaceholder;

            setBackgroundImage(imageUrl);
            renderQuickLinks(config);
            updateClock(config);
        };

        /* ============================================================
           Clock + greeting
           ============================================================ */

        const updateClock = (config = previewConfig || savedConfig) => {
            const now = new Date();
            const name = (config.userName || "").trim();
            const hour = now.getHours();
            const greetingWord = hour < 5
                ? "Good night"
                : hour < 12
                    ? "Good morning"
                    : hour < 18
                        ? "Good afternoon"
                        : "Good evening";

            dom.greeting.textContent = name ? `${greetingWord}, ${name}.` : `${greetingWord}.`;
            dom.clockWrap.hidden = !config.showClock;
            dom.heroCopy.hidden = !config.showGreeting;

            try {
                dom.clockTime.textContent = new Intl.DateTimeFormat(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: !config.clock24h
                }).format(now);
                dom.dateLine.textContent = new Intl.DateTimeFormat(undefined, {
                    weekday: "long",
                    day: "numeric",
                    month: "long"
                }).format(now);
            } catch {
                dom.clockTime.textContent = now.toLocaleTimeString();
                dom.dateLine.textContent = now.toLocaleDateString();
            }
        };

        /* ============================================================
           Quick links
           ============================================================ */

        const makeQuickChip = (label, url) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "quick-chip";
            chip.title = `Open ${url}`;

            const key = document.createElement("span");
            key.className = "chip-key";
            key.textContent = label;

            const text = document.createElement("span");
            text.className = "chip-label";
            text.textContent = prettyHost(url);

            chip.append(key, text);
            chip.addEventListener("click", () => {
                window.open(url, "_blank", "noopener,noreferrer");
            });
            return chip;
        };

        const renderQuickLinks = (config = savedConfig) => {
            const wrap = dom.quickLinks;
            wrap.replaceChildren();

            if (!config.showShortcutChips) {
                wrap.hidden = true;
                return;
            }
            wrap.hidden = false;

            const entries = Object.entries(config.shortcuts);
            if (!entries.length) {
                const add = document.createElement("button");
                add.type = "button";
                add.className = "quick-chip add";
                add.textContent = "Add your first shortcut";
                add.addEventListener("click", () => openEditor("search"));
                wrap.append(add);
                return;
            }

            entries.slice(0, 10).forEach(([trigger, url]) => {
                wrap.append(makeQuickChip(trigger, url));
            });

            if (entries.length > 10) {
                const more = document.createElement("button");
                more.type = "button";
                more.className = "quick-chip add";
                more.textContent = `+${entries.length - 10} more`;
                more.addEventListener("click", () => openEditor("search"));
                wrap.append(more);
            }

            const manage = document.createElement("button");
            manage.type = "button";
            manage.className = "quick-chip add";
            manage.setAttribute("aria-label", "Manage shortcuts");
            manage.title = "Manage shortcuts";
            manage.textContent = "+";
            manage.addEventListener("click", () => openEditor("search"));
            wrap.append(manage);
        };

        /* ============================================================
           Draft + height persistence
           ============================================================ */

        const currentHeights = () => {
            const stored = loadHeights();
            const measure = (input, fallback) => {
                const height = input.getBoundingClientRect().height;
                return height > 0 ? Math.max(40, Math.round(height)) : fallback;
            };
            return {
                google: measure(dom.searchInput, stored.google),
                gemini: measure(dom.geminiInput, stored.gemini)
            };
        };

        const saveHeightsNow = () => {
            const heights = currentHeights();
            storage.set(STORAGE_KEYS.heights, JSON.stringify(heights));
            storage.set(LEGACY_KEYS.googleHeight, heights.google + "px");
            storage.set(LEGACY_KEYS.geminiHeight, heights.gemini + "px");
        };

        const saveDraftsNow = () => {
            if (savedConfig.saveDrafts) {
                storage.set(STORAGE_KEYS.drafts, JSON.stringify({
                    google: dom.searchInput.value,
                    gemini: dom.geminiInput.value
                }));
                storage.set(LEGACY_KEYS.geminiDraft, dom.geminiInput.value);
            }
            saveHeightsNow();
        };

        const saveDraftsSoon = () => {
            window.clearTimeout(draftTimer);
            draftTimer = window.setTimeout(saveDraftsNow, 320);
        };

        const autoGrow = (input, { save = false } = {}) => {
            const minHeight = parseFloat(window.getComputedStyle(input).minHeight) || 40;
            input.style.height = "auto";
            const next = Math.min(300, Math.max(minHeight, input.scrollHeight));
            input.style.height = next + "px";
            input.style.overflowY = input.scrollHeight > 300 ? "auto" : "hidden";
            if (save) saveDraftsSoon();
        };

        const restoreInputs = () => {
            const drafts = loadDrafts();
            const heights = loadHeights();

            dom.searchInput.value = savedConfig.saveDrafts ? drafts.google : "";
            dom.geminiInput.value = savedConfig.saveDrafts ? drafts.gemini : "";

            if (dom.searchInput.value) autoGrow(dom.searchInput, { save: false });
            else dom.searchInput.style.height = heights.google + "px";

            if (dom.geminiInput.value) autoGrow(dom.geminiInput, { save: false });
            else dom.geminiInput.style.height = heights.gemini + "px";
        };

        /* ============================================================
           Search + Gemini
           ============================================================ */

        const findShortcut = (text, config = savedConfig) => {
            const key = String(text || "").trim().toLowerCase();
            if (!key) return null;
            if (!Object.prototype.hasOwnProperty.call(config.shortcuts, key)) return null;
            return config.shortcuts[key];
        };

        const openInNewTab = (url) => {
            window.open(url, "_blank", "noopener,noreferrer");
        };

        const buildSearchUrl = (text, config = savedConfig) => {
            const engine = SEARCH_ENGINES[config.searchEngine] || SEARCH_ENGINES.google;
            const template = config.searchEngine === "custom"
                ? (normalizeSearchUrl(config.customSearchUrl) || DEFAULT_CONFIG.customSearchUrl)
                : engine.url;
            return template.replace(/\{query\}/g, encodeURIComponent(text));
        };

        const performSearch = () => {
            const text = dom.searchInput.value.trim();
            if (!text) {
                dom.searchInput.focus();
                return;
            }

            const shortcut = findShortcut(text);
            if (shortcut) {
                openInNewTab(shortcut);
                dom.searchInput.value = "";
                autoGrow(dom.searchInput, { save: false });
                saveDraftsNow();
                return;
            }

            saveDraftsNow();
            const url = buildSearchUrl(text);
            if (savedConfig.openSearchInNewTab) openInNewTab(url);
            else window.location.assign(url);
        };

        const copyText = async (text) => {
            const previousFocus = document.activeElement;
            if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                try {
                    await navigator.clipboard.writeText(text);
                    return true;
                } catch {}
            }

            const area = document.createElement("textarea");
            area.value = text;
            area.setAttribute("readonly", "");
            area.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
            document.body.appendChild(area);
            area.select();
            area.setSelectionRange(0, area.value.length);
            let copied = false;
            try { copied = document.execCommand("copy"); } catch { copied = false; }
            area.remove();
            if (previousFocus && typeof previousFocus.focus === "function") {
                try { previousFocus.focus({ preventScroll: true }); } catch {}
            }
            if (!copied) throw new Error("Clipboard unavailable");
            return true;
        };

        const askGemini = async () => {
            const text = dom.geminiInput.value.trim();
            if (!text) {
                openInNewTab("https://gemini.google.com/app");
                return;
            }

            const shortcut = findShortcut(text);
            if (shortcut) {
                openInNewTab(shortcut);
                dom.geminiInput.value = "";
                autoGrow(dom.geminiInput, { save: false });
                saveDraftsNow();
                return;
            }

            openInNewTab("https://gemini.google.com/app");

            if (!savedConfig.copyGeminiPrompt) return;

            try {
                await copyText(text);
                toast("Prompt copied. Paste it into Gemini.", "success");
                if (dom.geminiInput.value.trim() === text) {
                    dom.geminiInput.value = "";
                    autoGrow(dom.geminiInput, { save: false });
                    saveDraftsNow();
                }
            } catch {
                toast("Could not copy automatically. Your prompt is still in the bar.", "error", 4200);
            }
        };

        /* ============================================================
           Toasts
           ============================================================ */

        const toast = (message, type = "info", duration = 3000) => {
            const node = document.createElement("div");
            node.className = "toast " + type;
            node.textContent = message;
            dom.toastRegion.append(node);

            while (dom.toastRegion.children.length > 3) {
                dom.toastRegion.firstElementChild.remove();
            }

            window.setTimeout(() => {
                node.classList.add("leaving");
                window.setTimeout(() => node.remove(), 220);
            }, duration);
        };
