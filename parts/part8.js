        /* ============================================================
           Modal
           ============================================================ */

        const openModal = ({ title, text, field, actions, dismissible = true }) => {
            modalLastFocus = document.activeElement;
            modalDismissible = dismissible;

            dom.modalTitle.textContent = title || "";
            dom.modalText.textContent = text || "";
            dom.modalText.hidden = !text;

            dom.modalField.classList.toggle("hidden", !field);
            if (field) {
                dom.modalFieldLabel.textContent = field.label || "Value";
                dom.modalInput.value = field.value || "";
                dom.modalInput.placeholder = field.placeholder || "";
            } else {
                dom.modalInput.value = "";
            }

            dom.modalActions.replaceChildren();
            let spacerAdded = false;

            (actions || []).forEach((action) => {
                if (action.align === "left" && !spacerAdded) {
                    const spacer = document.createElement("span");
                    spacer.className = "modal-spacer";
                    dom.modalActions.append(spacer);
                    spacerAdded = true;
                }

                const button = document.createElement("button");
                button.type = "button";
                button.className = "btn btn-" + (action.variant || "secondary");
                button.textContent = action.label || "OK";
                if (action.autofocus) button.dataset.autofocus = "true";
                button.addEventListener("click", () => {
                    const result = action.onClick ? action.onClick() : true;
                    if (result !== false) closeModal();
                });
                dom.modalActions.append(button);
            });

            dom.modalOverlay.classList.add("active");
            dom.modalOverlay.setAttribute("aria-hidden", "false");
            document.body.classList.add("modal-open");

            window.setTimeout(() => {
                const preferred = dom.modalBox.querySelector("[data-autofocus]");
                const target = preferred || (field ? dom.modalInput : dom.modalActions.querySelector("button"));
                if (target) {
                    try { target.focus(); } catch {}
                }
            }, 40);
        };

        const closeModal = () => {
            if (!dom.modalOverlay.classList.contains("active")) return;
            dom.modalOverlay.classList.remove("active");
            dom.modalOverlay.setAttribute("aria-hidden", "true");
            document.body.classList.remove("modal-open");

            if (modalLastFocus && modalLastFocus.isConnected && modalLastFocus.offsetParent !== null) {
                try { modalLastFocus.focus({ preventScroll: true }); } catch {}
            }
            modalLastFocus = null;
        };

        /* ============================================================
           View routing
           ============================================================ */

        const views = {
            home: dom.homeView,
            version: dom.versionView,
            edit: dom.editView
        };

        const renderVersionView = () => {
            dom.versionShortcutCount.textContent = String(Object.keys(savedConfig.shortcuts).length);
            dom.versionThemeName.textContent = (THEMES[savedConfig.theme] || THEMES.midnight).name;
            dom.versionSavedAt.textContent = formatSavedAt(storage.get(STORAGE_KEYS.lastSaved));

            dom.versionChips.replaceChildren();
            const entries = Object.entries(savedConfig.shortcuts);
            if (!entries.length) {
                const empty = document.createElement("span");
                empty.className = "chip-row";
                empty.style.margin = "0";
                empty.style.color = "var(--muted)";
                empty.style.fontSize = "12px";
                empty.textContent = "No shortcuts yet.";
                dom.versionChips.append(empty);
                return;
            }

            entries.slice(0, 8).forEach(([trigger, url]) => {
                const chip = document.createElement("button");
                chip.type = "button";
                chip.className = "mini-chip";
                chip.title = `Open ${url}`;

                const key = document.createElement("b");
                key.textContent = trigger;
                const host = document.createElement("span");
                host.textContent = prettyHost(url);
                chip.append(key, host);
                chip.addEventListener("click", () => openInNewTab(url));
                dom.versionChips.append(chip);
            });

            if (entries.length > 8) {
                const more = document.createElement("span");
                more.className = "mini-chip";
                more.textContent = `+${entries.length - 8} more`;
                dom.versionChips.append(more);
            }
        };

        const onViewEnter = (name) => {
            if (name === "home") {
                applyConfig(savedConfig);
                renderQuickLinks(savedConfig);
                updateClock(savedConfig);
                window.setTimeout(() => {
                    if (savedConfig.autofocus && window.matchMedia("(pointer: fine)").matches) {
                        try { dom.searchInput.focus({ preventScroll: true }); } catch {}
                    }
                }, 70);
                return;
            }

            if (name === "version") {
                applyConfig(savedConfig);
                renderVersionView();
                return;
            }

            if (name === "edit") {
                draftConfig = clone(savedConfig);
                editingTrigger = null;
                resetShortcutForm();
                syncSettingsUI();
                applyConfig(draftConfig);
                switchTab(pendingTab || "appearance");
                pendingTab = "appearance";
            }
        };

        const switchView = (name, { force = false } = {}) => {
            if (!views[name] || name === currentView) return;

            if (currentView === "edit" && name !== "edit" && !force && isDirty()) {
                promptExitEditor();
                return;
            }

            views[currentView].classList.add("hidden");
            const next = views[name];
            next.classList.remove("hidden");
            next.classList.remove("view-enter");
            void next.offsetWidth;
            next.classList.add("view-enter");

            currentView = name;
            window.scrollTo(0, 0);
            onViewEnter(name);
        };

        const openEditor = (tab = "appearance") => {
            pendingTab = tab;
            if (currentView === "edit") {
                switchTab(tab);
                return;
            }
            switchView("edit");
        };

        const discardDraft = () => {
            draftConfig = clone(savedConfig);
            resetShortcutForm();
            applyConfig(savedConfig);
            syncSettingsUI();
        };

        const promptExitEditor = () => {
            if (!isDirty()) {
                switchView("home", { force: true });
                return;
            }

            openModal({
                title: "Unsaved design changes",
                text: "Your customizer changes are only a preview until you save them. Pick what happens next.",
                actions: [
                    {
                        label: "Save design",
                        variant: "secondary",
                        align: "left",
                        onClick: () => {
                            const ok = saveConfig();
                            if (!ok) closeModal();
                            return ok;
                        }
                    },
                    {
                        label: "Don't save",
                        variant: "secondary",
                        onClick: () => {
                            discardDraft();
                            switchView("home", { force: true });
                        }
                    },
                    {
                        label: "Save and exit",
                        variant: "primary",
                        autofocus: true,
                        onClick: () => {
                            const ok = saveConfig();
                            if (ok) switchView("home", { force: true });
                            else closeModal();
                            return ok;
                        }
                    }
                ]
            });
        };

        /* ============================================================
           Save / data
           ============================================================ */

        const saveConfig = ({ silent = false } = {}) => {
            if (!draftConfig.showGoogle && !draftConfig.showGemini) {
                switchTab("search");
                toast("Keep at least one search bar visible.", "error");
                return false;
            }

            if (draftConfig.searchEngine === "custom" && !normalizeSearchUrl(draftConfig.customSearchUrl)) {
                switchTab("search");
                toast("The custom search URL needs a valid {query} placeholder.", "error", 4200);
                return false;
            }

            if (draftConfig.background === "image" && !normalizeImageUrl(draftConfig.customBackgroundUrl)) {
                switchTab("appearance");
                toast("Add a valid background image URL, or choose another style.", "error", 4200);
                return false;
            }

            const normalized = normalizeConfig(draftConfig);
            const persisted = storage.set(STORAGE_KEYS.config, JSON.stringify(normalized));

            storage.set(LEGACY_KEYS.shortcuts, JSON.stringify(normalized.shortcuts));
            savedConfig = clone(normalized);
            draftConfig = clone(normalized);

            if (persisted) storage.set(STORAGE_KEYS.lastSaved, new Date().toISOString());

            if (!savedConfig.saveDrafts) {
                storage.remove(STORAGE_KEYS.drafts);
                storage.remove(LEGACY_KEYS.geminiDraft);
            } else {
                saveDraftsNow();
            }

            applyConfig(savedConfig);
            syncSettingsUI();
            renderVersionView();

            if (!silent) {
                toast(persisted
                    ? "Design saved."
                    : "Applied for this session — local storage is blocked.",
                    persisted ? "success" : "warning",
                    3600);
            }
            return true;
        };

        const configPayload = () => {
            const source = currentView === "edit" ? draftConfig : savedConfig;
            return {
                ...normalizeConfig(source),
                appVersion: APP_VERSION,
                exportedAt: new Date().toISOString()
            };
        };

        const exportConfig = () => {
            const payload = configPayload();
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "custom-start-engine-config-v2.4.json";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1200);
            toast("Config exported.", "success");
        };

        const copyConfig = async () => {
            try {
                await copyText(JSON.stringify(configPayload(), null, 2));
                toast("Config JSON copied to the clipboard.", "success");
            } catch {
                toast("Could not copy the config. Try exporting a file instead.", "error");
            }
        };

        const importConfigFromText = (text) => {
            const parsed = safeParse(text, null);
            if (!isPlainObject(parsed)) throw new Error("That is not valid JSON.");

            const known = Object.keys(DEFAULT_CONFIG).filter((key) => key !== "configVersion");
            if (!known.some((key) => Object.prototype.hasOwnProperty.call(parsed, key))) {
                throw new Error("That JSON does not look like a Custom Start Engine config.");
            }

            const incoming = { ...parsed };
            delete incoming.appVersion;
            delete incoming.exportedAt;

            const merged = { ...draftConfig, ...incoming };
            if (isPlainObject(incoming.shortcuts)) {
                merged.shortcuts = normalizeShortcuts(incoming.shortcuts);
            } else {
                merged.shortcuts = draftConfig.shortcuts;
            }

            draftConfig = normalizeConfig(merged);
            applyConfig(draftConfig);
            syncSettingsUI();
            updateDirtyUI();
        };

        const openImportTextModal = () => {
            openModal({
                title: "Import config from text",
                text: "Paste a Custom Start Engine config backup below. It loads into the customizer as an unsaved draft.",
                field: {
                    label: "Config JSON",
                    value: "",
                    placeholder: '{\n  "theme": "midnight",\n  "shortcuts": { "yt": "https://youtube.com" }\n}'
                },
                actions: [
                    { label: "Cancel", variant: "secondary" },
                    {
                        label: "Load config",
                        variant: "primary",
                        onClick: () => {
                            try {
                                if (!dom.modalInput.value.trim()) throw new Error("Paste a config first.");
                                importConfigFromText(dom.modalInput.value);
                                toast("Config loaded into the draft. Review and save.", "success", 3600);
                                return true;
                            } catch (error) {
                                toast(error.message || "Could not import that config.", "error", 4200);
                                return false;
                            }
                        }
                    }
                ]
            });
        };

        const importLegacySettings = () => {
            const legacy = readLegacyShortcuts();
            const legacyGoogle = parseHeight(storage.get(LEGACY_KEYS.googleHeight));
            const legacyGemini = parseHeight(storage.get(LEGACY_KEYS.geminiHeight));
            const legacyDraft = storage.get(LEGACY_KEYS.geminiDraft) || "";

            if (!legacy.count && legacyGoogle === null && legacyGemini === null && !legacyDraft) {
                toast("No v2.3 settings were found in this browser.", "info", 3600);
                return;
            }

            let added = 0;
            const next = { ...draftConfig.shortcuts };
            for (const [trigger, url] of Object.entries(legacy.shortcuts)) {
                if (!Object.prototype.hasOwnProperty.call(next, trigger)) {
                    next[trigger] = url;
                    added += 1;
                }
            }

            draftConfig = { ...draftConfig, shortcuts: next };

            if (legacyGoogle !== null) {
                if (dom.searchInput.value.trim()) autoGrow(dom.searchInput, { save: false });
                else dom.searchInput.style.height = legacyGoogle + "px";
            }
            if (legacyGemini !== null) {
                if (dom.geminiInput.value.trim()) autoGrow(dom.geminiInput, { save: false });
                else dom.geminiInput.style.height = legacyGemini + "px";
            }

            if (legacyDraft && !dom.geminiInput.value.trim() && savedConfig.saveDrafts) {
                dom.geminiInput.value = legacyDraft;
                autoGrow(dom.geminiInput, { save: false });
            }

            saveHeightsNow();
            applyConfig(draftConfig);
            syncSettingsUI();
            updateDirtyUI();

            toast(
                added
                    ? `Imported ${added} shortcut${added === 1 ? "" : "s"} from v2.3. Review and save.`
                    : "v2.3 draft and input sizes applied. Review and save.",
                "success",
                4200
            );
        };

        const updateDataTab = () => {
            const lastSaved = storage.get(STORAGE_KEYS.lastSaved);
            let savedLabel = "Not saved yet";
            if (lastSaved) {
                const date = new Date(lastSaved);
                if (!Number.isNaN(date.getTime())) {
                    try {
                        savedLabel = new Intl.DateTimeFormat(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short"
                        }).format(date);
                    } catch {
                        savedLabel = date.toLocaleString();
                    }
                }
            }
            dom.lastSavedLabel.textContent = savedLabel;

            const size = new Blob([JSON.stringify(savedConfig)]).size;
            dom.configSizeLabel.textContent = formatBytes(size);

            const legacy = readLegacyShortcuts();
            dom.legacyStatus.textContent = legacy.count
                ? `Found ${legacy.count} valid shortcut${legacy.count === 1 ? "" : "s"} in the old engineShortcuts key. Import merges any that are missing from the draft.`
                : "No shortcut data found in the old engineShortcuts key. Input heights and the Gemini draft are also checked on import.";

            dom.storageStatus.textContent = storageOk
                ? "Local storage is available. Config, shortcuts and drafts stay on this device."
                : "Local storage is blocked. Settings will only last for this session.";
        };

        const clearDrafts = () => {
            storage.remove(STORAGE_KEYS.drafts);
            storage.remove(LEGACY_KEYS.geminiDraft);
            dom.searchInput.value = "";
            dom.geminiInput.value = "";
            dom.searchInput.style.height = "40px";
            dom.geminiInput.style.height = "40px";
            saveHeightsNow();
            toast("Drafts cleared.", "success");
        };

        const resetPreferences = () => {
            openModal({
                title: "Reset preferences?",
                text: "Theme, background, search engine, layout and behaviour return to defaults. Your shortcuts stay exactly where they are.",
                actions: [
                    { label: "Cancel", variant: "secondary", autofocus: true },
                    {
                        label: "Reset preferences",
                        variant: "danger",
                        onClick: () => {
                            draftConfig = normalizeConfig({
                                ...DEFAULT_CONFIG,
                                shortcuts: clone(draftConfig.shortcuts)
                            });
                            applyConfig(draftConfig);
                            syncSettingsUI();
                            updateDirtyUI();
                            toast("Preferences reset in the draft. Save to keep it.", "success", 3600);
                        }
                    }
                ]
            });
        };

        const factoryReset = () => {
            openModal({
                title: "Factory reset everything?",
                text: "This wipes Custom Start Engine settings, shortcuts, drafts and the v2.3 legacy keys on this device. There is no undo button. Export a backup first if you care about it.",
                actions: [
                    { label: "Cancel", variant: "secondary", autofocus: true },
                    {
                        label: "Factory reset",
                        variant: "danger",
                        onClick: () => {
                            const fresh = normalizeConfig(DEFAULT_CONFIG);
                            savedConfig = clone(fresh);
                            draftConfig = clone(fresh);
                            editingTrigger = null;
                            resetShortcutForm();

                            storage.set(STORAGE_KEYS.config, JSON.stringify(fresh));
                            storage.set(LEGACY_KEYS.shortcuts, "{}");
                            storage.set(STORAGE_KEYS.lastSaved, new Date().toISOString());
                            storage.remove(STORAGE_KEYS.drafts);
                            storage.remove(STORAGE_KEYS.heights);
                            storage.remove(LEGACY_KEYS.geminiDraft);
                            storage.remove(LEGACY_KEYS.googleHeight);
                            storage.remove(LEGACY_KEYS.geminiHeight);

                            dom.searchInput.value = "";
                            dom.geminiInput.value = "";
                            dom.searchInput.style.height = "40px";
                            dom.geminiInput.style.height = "40px";

                            applyConfig(savedConfig);
                            syncSettingsUI();
                            renderVersionView();
                            toast("Factory reset complete. A clean start awaits.", "success", 3600);
                        }
                    }
                ]
            });
        };
