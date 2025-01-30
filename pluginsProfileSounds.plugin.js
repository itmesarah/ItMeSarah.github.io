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

        // Select the biteSize_ or fullSize_ element
        const popout = element.querySelector(`[class*="biteSize_"], [class*="fullSize_"]`);
        if (!popout) return;

        // Check if the parent contains 'accountProfilePopoutWrapper_b2ca13'
        const parentWrapper = popout.closest(`[class*="accountProfilePopoutWrapper_b2ca13"]`);
        if (parentWrapper) return; // Skip if the parent matches this class

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
                removedNode.querySelector(`[class*="biteSize_"], [class*="fullSize_"]`)
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
                                        color: "#b0b0b0", // Set text color to grey
                                    },
                                    onChange: (e) => (soundUrl = e.target.value),
                                }),
                                React.createElement("div", { style: { display: "flex", alignItems: "center" } }, [
                                    React.createElement("input", {
                                        id: "myinput",
                                        type: "range",
                                        min: 0,
                                        max: 1,
                                        step: 0.01,
                                        defaultValue: volume,
                                        style: {
                                            width: "100%",
                                            marginBottom: "10px",
                                            borderRadius: "8px",
                                            height: "4px",
                                            outline: "none",
                                            "-webkit-appearance": "none",
                                        },
                                        onInput: (event) => {
                                            const slider = event.target;
                                            const min = slider.min;
                                            const max = slider.max;
                                            const value = slider.value;
                                            slider.style.background = `linear-gradient(to right, lime 0%, red ${(value - min) / (max - min) * 50}%, purple ${(value - min) / (max - min) * 100}%, #DEE2E6 ${(value - min) / (max - min) * 100}%, #DEE2E6 100%)`;

                                            // Update volume value display
                                            const volumeDisplay = slider.closest("div").querySelector("span");
                                            if (volumeDisplay) {
                                                volumeDisplay.textContent = `${(value * 100).toFixed(0)}%`;
                                            }
                                        },
                                        onChange: (event) => {
                                            const slider = event.target;
                                            const min = slider.min;
                                            const max = slider.max;
                                            const value = slider.value;
                                            slider.style.background = `linear-gradient(to right, lime 0%, red ${(value - min) / (max - min) * 50}%, purple ${(value - min) / (max - min) * 100}%, #DEE2E6 ${(value - min) / (max - min) * 100}%, #DEE2E6 100%)`;

                                            // Update volume value display
                                            const volumeDisplay = slider.closest("div").querySelector("span");
                                            if (volumeDisplay) {
                                                volumeDisplay.textContent = `${(value * 100).toFixed(0)}%`;
                                            }
                                        },
                                    }),
                                    React.createElement(
                                        "span",
                                        { style: { marginLeft: "10px", fontSize: "14px" } },
                                        `${(volume * 100).toFixed(0)}%`
                                    ),
                                ]),
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

    isValidSoundUrl(url) {
        const isDiscordCdn = url.includes("cdn.discordapp.com");
        return (
            isDiscordCdn ||
            /\.(mp3|wav)$/i.test(url) // Only allow .mp3 or .wav
        );
    }

    getSettingsPanel() {
        const SettingsPanel = () => {
            const [newUserId, setNewUserId] = React.useState("");
            const [newSoundUrl, setNewSoundUrl] = React.useState("");
            const [newVolume, setNewVolume] = React.useState(this.defaultVolume);
            const [newLoop, setNewLoop] = React.useState(this.defaultLoop);
            const [_, forceUpdate] = React.useReducer((x) => x + 1, 0);

            return React.createElement(
                "div",
                { style: { padding: "10px" } },
                React.createElement("h3", null, "Add New Sound"),
                React.createElement("input", {
                    type: "text",
                    placeholder: "Enter User ID",
                    value: newUserId,
                    onChange: (e) => setNewUserId(e.target.value),
                    style: {
                        width: "100%",
                        marginBottom: "10px",
                        padding: "5px",
                        border: "1px solid #ccc",
                        borderRadius: "3px",
                        background: "black",
                        color: "#b0b0b0",
                    },
                }),
                React.createElement("input", {
                    type: "text",
                    placeholder: "Enter Sound URL",
                    value: newSoundUrl,
                    onChange: (e) => setNewSoundUrl(e.target.value),
                    style: {
                        width: "100%",
                        marginBottom: "10px",
                        padding: "5px",
                        border: "1px solid #ccc",
                        borderRadius: "3px",
                        background: "black",
                        color: "#b0b0b0",
                    },
                }),
                React.createElement("div", { style: { display: "flex", alignItems: "center" } }, [
                    React.createElement("input", {
                        type: "range",
                        min: 0,
                        max: 1,
                        step: 0.01,
                        value: newVolume,
                        onChange: (e) => setNewVolume(e.target.value),
                        style: {
                            width: "100%",
                            marginBottom: "10px",
                            borderRadius: "8px",
                            height: "4px",
                            outline: "none",
                            "-webkit-appearance": "none",
                        },
                    }),
                    React.createElement(
                        "span",
                        { style: { marginLeft: "10px", fontSize: "14px" } },
                        `${(newVolume * 100).toFixed(0)}%`
                    ),
                ]),
                React.createElement(
                    "label",
                    { style: { display: "block", marginBottom: "10px" } },
                    React.createElement("input", {
                        type: "checkbox",
                        checked: newLoop,
                        onChange: (e) => setNewLoop(e.target.checked),
                        style: { marginRight: "5px" },
                    }),
                    "Loop Sound"
                ),
                React.createElement("button", {
                    onClick: () => {
                        if (this.isValidSoundUrl(newSoundUrl.trim())) {
                            this.addUserSound(newUserId, newSoundUrl, newVolume, newLoop);
                            forceUpdate(); // Force update after adding
                        } else {
                            BdApi.UI.showToast("Invalid sound URL. Please provide a valid URL.", {
                                type: "error",
                            });
                        }
                    },
                    style: {
                        background: "#4CAF50",
                        color: "#fff",
                        border: "none",
                        padding: "10px 20px",
                        borderRadius: "5px",
                        cursor: "pointer",
                    },
                    children: "Add Sound",
                }),
                React.createElement("h3", null, "Currently Added Sounds"),
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
                                      forceUpdate(); // Force re-render after removal
                                  },
                                  style: {
                                      background: "red",
                                      color: "#fff",
                                      border: "none",
                                      padding: "5px 10px",
                                      borderRadius: "5px",
                                      cursor: "pointer",
                                  },
                                  children: "Remove",
                              })
                          )
                      )
            );
        };

        return SettingsPanel;
    }
};
