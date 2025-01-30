/**
 * @name ProfileSoundPlugin
 * @version 2.1.0
 * @description Plays a custom sound when a user profile is opened in Discord, with support for direct audio links. Includes a settings panel to manage user sounds and a context menu option to add custom sounds for users, with volume control, looping, and hover tooltips for sound URLs.
 */

const { React } = BdApi;

module.exports = class ProfileSoundPlugin {
    constructor() {
        this.pluginName = "ProfileSoundPlugin";
        this.configKey = "userSounds";
        this.defaultVolume = 0.5; // Default volume for new sounds
        this.defaultLoop = true; // Default loop setting
        this.userSounds = {};
    }

    start() {
        this.loadUserSounds();
        this.observeProfileModal();
        this.addContextMenuPatch();
        console.log(`[${this.pluginName}] Started!`);
    }

    stop() {
        if (this.observer) this.observer.disconnect();
        this.stopAudio();
        this.removeContextMenuPatch();
        console.log(`[${this.pluginName}] Stopped!`);
    }

    loadUserSounds() {
        const savedData = BdApi.Data.load(this.pluginName, this.configKey);
        this.userSounds = savedData || {};

        for (const userId in this.userSounds) {
            const soundData = this.userSounds[userId];
            if (typeof soundData === "string") {
                this.userSounds[userId] = {
                    url: soundData,
                    volume: this.defaultVolume,
                    loop: this.defaultLoop,
                };
            }
        }

        this.saveUserSounds();
    }

    saveUserSounds() {
        BdApi.Data.save(this.pluginName, this.configKey, this.userSounds);
    }

    addUserSound(userId, soundUrl, volume = this.defaultVolume, loop = this.defaultLoop) {
        this.userSounds[userId] = { url: soundUrl, volume: volume, loop: loop };
        this.saveUserSounds();
    }

    removeUserSound(userId) {
        delete this.userSounds[userId];
        this.saveUserSounds();
    }

    getSoundForUser(userId) {
        const soundData = this.userSounds[userId];
        if (!soundData) return null;

        if (typeof soundData === "string") {
            this.userSounds[userId] = {
                url: soundData,
                volume: this.defaultVolume,
                loop: this.defaultLoop,
            };
            this.saveUserSounds();
        }

        return this.userSounds[userId];
    }

    playAudio(url, volume, loop) {
        if (this.audio) this.stopAudio();

        this.audio = new Audio(url);
        this.audio.loop = loop;
        this.audio.volume = volume;
        this.audio.play().catch((error) => {
            console.error(`[${this.pluginName}] Failed to play audio:`, error);
            BdApi.UI.showToast("Failed to play audio. Please check the URL.", { type: "error" });
        });
    }

    stopAudio() {
        if (this.audio) {
            this.audio.pause();
            this.audio = null;
        }
    }

    observeProfileModal() {
        const appMount = document.querySelector("#app-mount");
        if (!appMount) {
            console.error(`[${this.pluginName}] #app-mount not found. Aborting.`);
            return;
        }

        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => this.handleMutation(mutation));
        });

        this.observer.observe(appMount, { childList: true, subtree: true });
    }

    handleMutation(mutation) {
        if (mutation.addedNodes.length) {
            const element = mutation.addedNodes[0];
            if (!(element instanceof HTMLElement)) return;

            const popout = element.querySelector(`[class*="biteSize_"]`);
            if (!popout) return;

            const userId = this.getUserIdFromPopout(popout);
            if (!userId) return;

            const soundData = this.getSoundForUser(userId);
            if (!soundData) return;

            this.playAudio(soundData.url, soundData.volume, soundData.loop);
        }

        if (mutation.removedNodes.length) {
            mutation.removedNodes.forEach((removedNode) => {
                if (
                    removedNode.nodeType === 1 &&
                    removedNode.querySelector(`[class*="biteSize_"]`)
                ) {
                    this.stopAudio();
                }
            });
        }
    }

    getUserIdFromPopout(popout) {
        const instance = BdApi.ReactUtils.getInternalInstance(popout);
        const userObject = BdApi.Utils.findInTree(
            instance,
            (m) => m?.user?.id,
            { walkable: ["memoizedProps", "return"] }
        );
        return userObject?.user?.id || null;
    }

    addContextMenuPatch() {
        this.unpatchContextMenu = BdApi.ContextMenu.patch("user-context", (menu, { user }) => {
            if (!user) return;

            const existingSound = this.getSoundForUser(user.id);

            menu.props.children.push(
                BdApi.ContextMenu.buildItem({
                    label: "Add Custom Sound",
                    action: () => {
                        let soundUrl = existingSound ? existingSound.url : "";
                        let volume = existingSound ? existingSound.volume : this.defaultVolume;
                        let loop = existingSound ? existingSound.loop : this.defaultLoop;

                        BdApi.showConfirmationModal(
                            "Add Custom Sound",
                            [
                                `Set a custom sound for user **${user.username}**.`,
                                React.createElement("input", {
                                    type: "text",
                                    placeholder: "Enter Sound URL",
                                    defaultValue: soundUrl,
                                    style: {
                                        width: "100%",
                                        marginBottom: "10px",
                                        padding: "5px",
                                        border: "1px solid #ccc",
                                        borderRadius: "3px",
                                        background: "black",
                                    },
                                    onChange: (e) => (soundUrl = e.target.value),
                                }),
                                React.createElement("div", {
                                    style: { marginBottom: "10px" },
                                    children: [
                                        React.createElement("input", {
                                            type: "range",
                                            min: 0,
                                            max: 1,
                                            step: 0.01,
                                            defaultValue: volume,
                                            style: { width: "100%" },
                                            onChange: (e) => {
                                                volume = parseFloat(e.target.value);
                                            },
                                        }),
                                        React.createElement(
                                            "span",
                                            {
                                                style: {
                                                    fontWeight: "bold",
                                                    marginLeft: "10px",
                                                },
                                            },
                                            `${(volume * 100).toFixed(0)}%`
                                        ),
                                    ],
                                }),
                                React.createElement(
                                    "label",
                                    { style: { display: "block", marginBottom: "10px" } },
                                    React.createElement("input", {
                                        type: "checkbox",
                                        defaultChecked: loop,
                                        onChange: (e) => (loop = e.target.checked),
                                        style: { marginRight: "5px" },
                                    }),
                                    "Loop Sound"
                                ),
                            ],
                            {
                                confirmText: "Save",
                                cancelText: "Cancel",
                                onConfirm: () => {
                                    if (soundUrl.trim()) {
                                        this.addUserSound(user.id, soundUrl, volume, loop);
                                        BdApi.UI.showToast(
                                            `Added sound for ${user.username}!`,
                                            { type: "success" }
                                        );
                                    } else {
                                        this.removeUserSound(user.id);
                                        BdApi.UI.showToast(`Removed sound for ${user.username}`, {
                                            type: "info",
                                        });
                                    }
                                },
                            }
                        );
                    },
                })
            );
        });
    }

    removeContextMenuPatch() {
        if (this.unpatchContextMenu) {
            this.unpatchContextMenu();
            delete this.unpatchContextMenu;
        }
    }

    getSettingsPanel() {
        const SettingsPanel = () => {
            const [_, forceUpdate] = React.useReducer((x) => x + 1, 0);

            return React.createElement(
                "div",
                { style: { padding: "10px" } },
                React.createElement("h3", null, "Currently Added Sounds"),
                React.createElement("input", {
                    type: "text",
                    placeholder: "Enter User ID",
                    id: "user-id-input",
                    style: {
                        width: "100%",
                        marginBottom: "10px",
                        padding: "5px",
                        border: "1px solid #ccc",
                        borderRadius: "3px",
                        background: "black",
                    },
                }),
                React.createElement("input", {
                    type: "text",
                    placeholder: "Enter Sound URL",
                    id: "sound-url-input",
                    style: {
                        width: "100%",
                        marginBottom: "10px",
                        padding: "5px",
                        border: "1px solid #ccc",
                        borderRadius: "3px",
                        background: "black",
                    },
                }),
                React.createElement("div", {
                    style: { marginBottom: "10px" },
                    children: [
                        React.createElement("input", {
                            type: "range",
                            min: 0,
                            max: 1,
                            step: 0.01,
                            defaultValue: this.defaultVolume,
                            style: { width: "100%" },
                            onChange: (e) => {
                                this.defaultVolume = parseFloat(e.target.value);
                            },
                        }),
                        React.createElement(
                            "span",
                            {
                                style: {
                                    fontWeight: "bold",
                                    marginLeft: "10px",
                                },
                            },
                            `${(this.defaultVolume * 100).toFixed(0)}%`
                        ),
                    ],
                }),
                React.createElement(
                    "label",
                    { style: { display: "block", marginBottom: "10px" } },
                    React.createElement("input", {
                        type: "checkbox",
                        defaultChecked: this.defaultLoop,
                        onChange: (e) => (this.defaultLoop = e.target.checked),
                        style: { marginRight: "5px" },
                    }),
                    "Loop Sound"
                ),
                React.createElement("button", {
                    onClick: () => {
                        const userId = document.getElementById("user-id-input").value;
                        const soundUrl = document.getElementById("sound-url-input").value;

                        if (userId && soundUrl.trim()) {
                            this.addUserSound(userId, soundUrl, this.defaultVolume, this.defaultLoop);
                            forceUpdate();
                            BdApi.UI.showToast(`Added custom sound for User ID: ${userId}!`, { type: "success" });
                        } else {
                            BdApi.UI.showToast("Please fill in both the User ID and Sound URL", { type: "error" });
                        }
                    },
                    style: {
                        background: "#7289da",
                        color: "#fff",
                        border: "none",
                        padding: "5px 10px",
                        borderRadius: "5px",
                        cursor: "pointer",
                    },
                    children: "Add Sound",
                }),
                Object.keys(this.userSounds).length === 0
                    ? React.createElement("p", null, "No custom sounds added yet.")
                    : Object.entries(this.userSounds).map(([userId, { url, volume, loop }]) =>
                          React.createElement(
                              "div",
                              {
                                  style: {
                                      marginBottom: "10px",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                  },
                                  key: userId,
                              },
                              React.createElement(
                                  "div",
                                  null,
                                  React.createElement("strong", null, `User ID: `),
                                  React.createElement("span", null, userId),
                                  React.createElement("br", null),
                                  React.createElement("strong", null, `Sound URL: `),
                                  React.createElement(
                                      "a",
                                      {
                                          href: url,
                                          target: "_blank",
                                          style: {
                                              textDecoration: "underline",
                                              color: "#7289da",
                                              cursor: "pointer",
                                              position: "relative",
                                          },
                                          title: url,
                                      },
                                      "Sound URL"
                                  ),
                                  React.createElement("br", null),
                                  React.createElement(
                                      "strong",
                                      null,
                                      `Volume: ${(volume * 100).toFixed(0)}%`
                                  ),
                                  React.createElement("br", null),
                                  React.createElement(
                                      "strong",
                                      null,
                                      `Loop: ${loop ? "Yes" : "No"}`
                                  )
                              ),
                              React.createElement("button", {
                                  onClick: () => {
                                      this.removeUserSound(userId);
                                      forceUpdate();
                                  },
                                  style: {
                                      background: "#f04747",
                                      color: "#fff",
                                      border: "none",
                                      padding: "5px 10px",
                                      borderRadius: "5px",
                                      cursor: "pointer",
                                  },
                                  children: "Delete",
                              })
                          )
                      )
            );
        };

        return React.createElement(SettingsPanel);
    }
};
