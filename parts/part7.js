        /* ============================================================
           Settings UI
           ============================================================ */

        const renderThemeGrid = () => {
            dom.themeGrid.replaceChildren();
            for (const [id, theme] of Object.entries(THEMES)) {
                const card = document.createElement("button");
                card.type = "button";
                card.className = "theme-card";
                card.dataset.theme = id;
                card.setAttribute("aria-pressed", "false");

                const swatch = document.createElement("span");
                swatch.className = "theme-swatch";
                swatch.style.background = `linear-gradient(135deg, ${theme.swatch[0]}, ${theme.swatch[1]})`;
                swatch.style.setProperty("--swatch-accent", theme.accent);

                const name = document.createElement("span");
                name.className = "theme-name";
                name.textContent = theme.name;

                card.append(swatch, name);
                card.addEventListener("click", () => selectTheme(id));
                dom.themeGrid.append(card);
            }
        };

        const updateThemeCards = () => {
            $all(".theme-card", dom.themeGrid).forEach((card) => {
                const active = card.dataset.theme === draftConfig.theme;
                card.classList.toggle("active", active);
                card.setAttribute("aria-pressed", String(active));
            });
        };

        const selectTheme = (themeId) => {
            const theme = THEMES[themeId];
            if (!theme) return;
            draftConfig = { ...draftConfig, theme: themeId, accent: theme.accent };
            applyConfig(draftConfig);
            syncAccentInputs();
            updateThemeCards();
            updateConditionalFields();
            updateDirtyUI();
        };

        const syncAccentInputs = () => {
            const hex = normalizeHex(draftConfig.accent, THEMES[draftConfig.theme].accent);
            dom.accentColor.value = hex;
            dom.accentHex.value = hex;
        };

        const updateConditionalFields = () => {
            dom.imageBgFields.classList.toggle("hidden", draftConfig.background !== "image");
            dom.customSearchFields.classList.toggle("hidden", draftConfig.searchEngine !== "custom");
            dom.dimValue.textContent = clampInt(draftConfig.backgroundDim, 0, 90, 55) + "%";
            dom.blurValue.textContent = clampInt(draftConfig.backgroundBlur, 0, 24, 0) + "px";
        };

        const isDirty = () =>
            JSON.stringify(canonical(draftConfig)) !== JSON.stringify(canonical(savedConfig));

        const updateDirtyUI = () => {
            const dirty = isDirty();
            dom.dirtyIndicator.classList.toggle("visible", dirty);
            dom.dirtyIndicatorBottom.classList.toggle("visible", dirty);
            dom.topSaveBtn.disabled = !dirty;
            dom.bottomSaveBtn.disabled = !dirty;
            dom.revertBtn.disabled = !dirty;
            dom.topSaveBtn.textContent = dirty ? "Save" : "Saved";
            dom.bottomSaveBtn.textContent = dirty ? "Save design" : "Saved";
        };

        const syncSettingsUI = () => {
            $all("[data-config]", dom.editView).forEach((input) => {
                const key = input.dataset.config;
                if (!Object.prototype.hasOwnProperty.call(draftConfig, key)) return;
                const value = draftConfig[key];
                if (input.type === "checkbox") input.checked = Boolean(value);
                else input.value = value ?? "";
            });

            syncAccentInputs();
            updateThemeCards();
            updateConditionalFields();
            renderShortcutEditor();
            updateDirtyUI();

            if (activeTab === "data") updateDataTab();
        };

        const handleConfigChange = (event) => {
            const input = event.target.closest("[data-config]");
            if (!input) return;

            const key = input.dataset.config;
            let value;
            if (input.type === "checkbox") value = input.checked;
            else if (input.type === "range") value = Number(input.value);
            else value = input.value;

            if ((key === "showGoogle" || key === "showGemini") && value === false) {
                const other = key === "showGoogle" ? draftConfig.showGemini : draftConfig.showGoogle;
                if (!other) {
                    input.checked = true;
                    toast("Keep at least one search bar visible.", "error");
                    return;
                }
            }

            if (key === "searchEngine" && !Object.prototype.hasOwnProperty.call(SEARCH_ENGINES, value)) {
                value = "google";
            }

            if (key === "accent") {
                const hex = normalizeHex(value, null);
                if (!hex) return;
                value = hex;
                dom.accentHex.value = hex;
            }

            draftConfig = { ...draftConfig, [key]: value };
            applyConfig(draftConfig);
            updateConditionalFields();
            updateThemeCards();
            updateDirtyUI();
        };

        /* ============================================================
           Shortcut editor
           ============================================================ */

        const resetShortcutForm = () => {
            editingTrigger = null;
            dom.scTriggerInput.value = "";
            dom.scUrlInput.value = "";
            dom.scSaveBtn.textContent = "Add";
            dom.scCancelBtn.classList.add("hidden");
        };

        const beginEditShortcut = (trigger) => {
            editingTrigger = trigger;
            dom.scTriggerInput.value = trigger;
            dom.scUrlInput.value = draftConfig.shortcuts[trigger] || "";
            dom.scSaveBtn.textContent = "Save";
            dom.scCancelBtn.classList.remove("hidden");
            dom.scTriggerInput.focus();
            dom.scTriggerInput.select();
        };

        const deleteShortcut = (trigger) => {
            const next = { ...draftConfig.shortcuts };
            delete next[trigger];
            draftConfig = { ...draftConfig, shortcuts: next };
            if (editingTrigger === trigger) resetShortcutForm();
            renderShortcutEditor();
            applyConfig(draftConfig);
            updateDirtyUI();
            toast("Shortcut removed from the draft.", "info");
        };

        const renderShortcutEditor = () => {
            const list = dom.shortcutEditorList;
            list.replaceChildren();
            const entries = Object.entries(draftConfig.shortcuts);

            dom.shortcutCountLabel.textContent = String(entries.length);

            if (!entries.length) {
                const empty = document.createElement("div");
                empty.className = "empty-state";
                empty.textContent = "No shortcuts yet. Add one above — for example: yt → https://youtube.com";
                list.append(empty);
                return;
            }

            for (const [trigger, url] of entries) {
                const row = document.createElement("div");
                row.className = "sc-row";

                const key = document.createElement("span");
                key.className = "sc-key";
                key.textContent = trigger;

                const address = document.createElement("span");
                address.className = "sc-url";
                address.textContent = url;
                address.title = url;

                const actions = document.createElement("div");
                actions.className = "sc-actions";

                const edit = document.createElement("button");
                edit.type = "button";
                edit.className = "mini-btn";
                edit.setAttribute("aria-label", `Edit shortcut ${trigger}`);
                edit.title = "Edit";
                edit.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-edit"/></svg>';
                edit.addEventListener("click", () => beginEditShortcut(trigger));

                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "mini-btn danger";
                remove.setAttribute("aria-label", `Delete shortcut ${trigger}`);
                remove.title = "Delete";
                remove.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-trash"/></svg>';
                remove.addEventListener("click", () => deleteShortcut(trigger));

                actions.append(edit, remove);
                row.append(key, address, actions);
                list.append(row);
            }
        };

        const saveShortcutFromForm = () => {
            const trigger = normalizeTrigger(dom.scTriggerInput.value);
            const url = normalizeUrl(dom.scUrlInput.value);

            if (!trigger) {
                toast("Trigger must be 1–24 characters: letters, numbers or ! @ # $ % ^ & * _ + . -", "error", 4200);
                dom.scTriggerInput.focus();
                return;
            }
            if (!url) {
                toast("Enter a valid http:// or https:// URL.", "error");
                dom.scUrlInput.focus();
                return;
            }

            const adding = !editingTrigger;
            if (adding && Object.keys(draftConfig.shortcuts).length >= MAX_SHORTCUTS) {
                toast(`Shortcut limit reached (${MAX_SHORTCUTS}).`, "error");
                return;
            }

            if (editingTrigger && editingTrigger !== trigger &&
                Object.prototype.hasOwnProperty.call(draftConfig.shortcuts, trigger)) {
                toast("That trigger already exists. Pick another one.", "error");
                dom.scTriggerInput.focus();
                return;
            }

            if (adding && Object.prototype.hasOwnProperty.call(draftConfig.shortcuts, trigger)) {
                toast("That trigger already exists. Edit the existing shortcut instead.", "error");
                dom.scTriggerInput.focus();
                return;
            }

            const next = { ...draftConfig.shortcuts };
            if (editingTrigger && editingTrigger !== trigger) delete next[editingTrigger];
            next[trigger] = url;

            draftConfig = { ...draftConfig, shortcuts: next };
            resetShortcutForm();
            renderShortcutEditor();
            applyConfig(draftConfig);
            updateDirtyUI();
            toast(adding ? "Shortcut added to the draft." : "Shortcut updated in the draft.", "success");
        };

        /* ============================================================
           Tabs
           ============================================================ */

        const switchTab = (name, { focusTab = false } = {}) => {
            if (!["appearance", "search", "behaviour", "data"].includes(name)) return;
            activeTab = name;

            $all(".tab", dom.editView).forEach((tab) => {
                const selected = tab.dataset.tab === name;
                tab.classList.toggle("active", selected);
                tab.setAttribute("aria-selected", String(selected));
                tab.tabIndex = selected ? 0 : -1;
                if (selected && focusTab) tab.focus();
            });

            $all(".tab-panel", dom.editView).forEach((panel) => {
                panel.classList.toggle("active", panel.id === "tab-" + name);
            });

            if (name === "data") updateDataTab();
        };
