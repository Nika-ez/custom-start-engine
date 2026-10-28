        /* ============================================================
           Event wiring
           ============================================================ */

        const bindEvents = () => {
            /* Home search */
            dom.searchForm.addEventListener("submit", (event) => {
                event.preventDefault();
                performSearch();
            });

            dom.searchInput.addEventListener("keydown", (event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
                    event.preventDefault();
                    dom.searchForm.requestSubmit();
                }
            });

            dom.searchInput.addEventListener("input", () => {
                autoGrow(dom.searchInput);
                saveDraftsSoon();
            });

            dom.geminiInput.addEventListener("keydown", (event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
                    event.preventDefault();
                    askGemini();
                }
            });

            dom.geminiInput.addEventListener("input", () => {
                autoGrow(dom.geminiInput);
                saveDraftsSoon();
            });

            dom.geminiBtn.addEventListener("click", askGemini);

            /* Navigation */
            dom.brandBtn.addEventListener("click", () => {
                if (currentView !== "home") switchView("home");
                else {
                    try { dom.searchInput.focus(); } catch {}
                }
            });

            dom.settingsBtn.addEventListener("click", () => openEditor("appearance"));
            dom.footerCustomize.addEventListener("click", () => openEditor("appearance"));
            dom.versionBadge.addEventListener("click", () => switchView("version"));
            dom.versionBackBtn.addEventListener("click", () => switchView("home"));
            dom.versionSettingsBtn.addEventListener("click", () => openEditor("appearance"));
            dom.aboutCustomize.addEventListener("click", () => openEditor("appearance"));
            dom.manageShortcutsBtn.addEventListener("click", () => openEditor("search"));
            dom.aboutExport.addEventListener("click", exportConfig);
            dom.aboutCopy.addEventListener("click", copyConfig);
            dom.aboutHomeBtn.addEventListener("click", () => switchView("home"));

            /* Customizer navigation */
            dom.editorBackBtn.addEventListener("click", promptExitEditor);
            dom.topSaveBtn.addEventListener("click", () => saveConfig());
            dom.bottomSaveBtn.addEventListener("click", () => saveConfig());
            dom.revertBtn.addEventListener("click", () => {
                discardDraft();
                toast("Draft reverted to the saved design.", "info");
            });

            /* Tabs */
            const tabs = $all(".tab", dom.editView);
            tabs.forEach((tab, index) => {
                tab.addEventListener("click", () => switchTab(tab.dataset.tab));
                tab.addEventListener("keydown", (event) => {
                    let next = null;
                    if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
                    else if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
                    else if (event.key === "Home") next = tabs[0];
                    else if (event.key === "End") next = tabs[tabs.length - 1];
                    if (next) {
                        event.preventDefault();
                        switchTab(next.dataset.tab, { focusTab: true });
                    }
                });
            });

            /* Config controls */
            dom.editView.addEventListener("input", handleConfigChange);
            dom.editView.addEventListener("change", handleConfigChange);

            dom.accentColor.addEventListener("input", () => {
                dom.accentHex.value = dom.accentColor.value;
            });

            dom.accentHex.addEventListener("input", () => {
                const hex = normalizeHex(dom.accentHex.value, null);
                if (!hex) return;
                draftConfig = { ...draftConfig, accent: hex };
                dom.accentColor.value = hex;
                applyConfig(draftConfig);
                updateDirtyUI();
            });

            dom.accentHex.addEventListener("change", () => {
                const hex = normalizeHex(dom.accentHex.value, null);
                if (!hex) {
                    dom.accentHex.value = normalizeHex(draftConfig.accent, THEMES[draftConfig.theme].accent);
                    toast("Use a 6-digit hex colour such as #8ab4f8.", "error");
                } else {
                    dom.accentHex.value = hex;
                }
            });

            dom.resetAccentBtn.addEventListener("click", () => {
                draftConfig = { ...draftConfig, accent: THEMES[draftConfig.theme].accent };
                applyConfig(draftConfig);
                syncAccentInputs();
                updateDirtyUI();
            });

            /* Shortcut editor */
            dom.scSaveBtn.addEventListener("click", saveShortcutFromForm);
            dom.scCancelBtn.addEventListener("click", resetShortcutForm);

            const shortcutEnter = (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    saveShortcutFromForm();
                } else if (event.key === "Escape") {
                    event.preventDefault();
                    resetShortcutForm();
                }
            };
            dom.scTriggerInput.addEventListener("keydown", shortcutEnter);
            dom.scUrlInput.addEventListener("keydown", shortcutEnter);

            /* Data tab */
            dom.exportBtn.addEventListener("click", exportConfig);
            dom.copyConfigBtn.addEventListener("click", copyConfig);
            dom.importFileBtn.addEventListener("click", () => dom.importFileInput.click());
            dom.pasteImportBtn.addEventListener("click", openImportTextModal);
            dom.legacyImportBtn.addEventListener("click", importLegacySettings);
            dom.clearDraftsBtn.addEventListener("click", clearDrafts);
            dom.resetPrefsBtn.addEventListener("click", resetPreferences);
            dom.factoryResetBtn.addEventListener("click", factoryReset);

            dom.importFileInput.addEventListener("change", async () => {
                const file = dom.importFileInput.files && dom.importFileInput.files[0];
                if (!file) return;
                try {
                    const text = await file.text();
                    importConfigFromText(text);
                    toast(`Imported ${file.name} into the draft. Review and save.`, "success", 3800);
                } catch (error) {
                    toast(error.message || "Could not import that file.", "error", 4200);
                } finally {
                    dom.importFileInput.value = "";
                }
            });

            /* Modal */
            dom.modalCloseBtn.addEventListener("click", () => closeModal());
            dom.modalOverlay.addEventListener("click", (event) => {
                if (event.target === dom.modalOverlay && modalDismissible) closeModal();
            });

            dom.modalOverlay.addEventListener("keydown", (event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    if (modalDismissible) closeModal();
                    return;
                }
                if (event.key !== "Tab") return;

                const focusable = $all(
                    'button:not([disabled]), textarea, input, select, a[href], [tabindex]:not([tabindex="-1"])',
                    dom.modalBox
                ).filter((element) => element.offsetParent !== null);

                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            });

            /* Global keyboard */
            document.addEventListener("keydown", (event) => {
                if (dom.modalOverlay.classList.contains("active")) return;

                const activeTag = (document.activeElement && document.activeElement.tagName || "").toLowerCase();
                const typing = ["input", "textarea", "select"].includes(activeTag) ||
                    Boolean(document.activeElement && document.activeElement.isContentEditable);

                if (event.key === "Escape") {
                    if (currentView === "edit") {
                        event.preventDefault();
                        promptExitEditor();
                    } else if (currentView === "version") {
                        event.preventDefault();
                        switchView("home");
                    } else if (typing) {
                        document.activeElement.blur();
                    }
                    return;
                }

                if ((event.ctrlKey || event.metaKey) && event.key === ",") {
                    event.preventDefault();
                    openEditor("appearance");
                    return;
                }

                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                    if (currentView === "edit") {
                        event.preventDefault();
                        if (isDirty()) saveConfig();
                        else toast("No changes to save.", "info", 1800);
                    }
                    return;
                }

                if (event.key === "/" && !typing && currentView === "home") {
                    event.preventDefault();
                    dom.searchInput.focus();
                }
            });

            /* Keep sizes sane on resize */
            window.addEventListener("resize", () => {
                if (currentView === "home") {
                    autoGrow(dom.searchInput, { save: false });
                    autoGrow(dom.geminiInput, { save: false });
                }
            });

            /* Persist drafts when the page sleeps */
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "hidden") saveDraftsNow();
            });
            window.addEventListener("beforeunload", saveDraftsNow);
        };

        /* ============================================================
           Boot
           ============================================================ */

        const init = () => {
            renderThemeGrid();
            restoreInputs();
            syncSettingsUI();
            applyConfig(savedConfig);
            renderVersionView();
            updateDataTab();
            switchTab("appearance");
            updateClock(savedConfig);
            renderQuickLinks(savedConfig);

            if (initial.migrated && initial.legacyCount > 0) {
                window.setTimeout(() => {
                    toast(
                        `Imported ${initial.legacyCount} shortcut${initial.legacyCount === 1 ? "" : "s"} from the v2.3 page.`,
                        "success",
                        4200
                    );
                }, 800);
            }

            if (!storageOk) {
                window.setTimeout(() => {
                    toast("Local storage is blocked. Settings will not persist.", "warning", 5000);
                }, 1100);
            }

            window.setInterval(() => updateClock(), 30000);

            if (savedConfig.autofocus && window.matchMedia("(pointer: fine)").matches) {
                window.setTimeout(() => {
                    try { dom.searchInput.focus({ preventScroll: true }); } catch {}
                }, 180);
            }
        };

        bindEvents();
        init();
    })();
    </script>
</body>
</html>
