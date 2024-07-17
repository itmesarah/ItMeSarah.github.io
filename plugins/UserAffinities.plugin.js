/**
 * @name UserAffinities
 * @description Shows user affinity scores in user popouts and user profile.
 * @version 1.0.2
 * @author Sarah
 * @authorLink https://github.com/ItMeSarah
 * @invite kckPSV8Z3m
 * @website https://itmesarah.github.io/
 */
 
/*@cc_on
@if (@_jscript)
    
    // Offer to self-install for clueless users that try to run this directly.
    var shell = WScript.CreateObject("WScript.Shell");
    var fs = new ActiveXObject("Scripting.FileSystemObject");
    var pathPlugins = shell.ExpandEnvironmentStrings("%APPDATA%\\BetterDiscord\\plugins");
    var pathSelf = WScript.ScriptFullName;
    // Put the user at ease by addressing them in the first person
    shell.Popup("It looks like you've mistakenly tried to run me directly. \n(Don't do that!)", 0, "I'm a plugin for BetterDiscord", 0x30);
    if (fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
        shell.Popup("I'm in the correct folder already.", 0, "I'm already installed", 0x40);
    } else if (!fs.FolderExists(pathPlugins)) {
        shell.Popup("I can't find the BetterDiscord plugins folder.\nAre you sure it's even installed?", 0, "Can't install myself", 0x10);
    } else if (shell.Popup("Should I copy myself to BetterDiscord's plugins folder for you?", 0, "Do you need some help?", 0x34) === 6) {
        fs.MoveFile(pathSelf, fs.BuildPath(pathPlugins, fs.GetFileName(pathSelf)));
        // Show the user where to put plugins in the future
        shell.Exec("explorer " + pathPlugins);
        shell.Popup("I'm installed!", 0, "Successfully installed", 0x40);
    }
    WScript.Quit();

@else@*/


const Queries = {
    UserPopout: {
        main: [
            `[class*="userPopout_"]`,      // This should catch all
            `[class*="userPopoutOuter_"]`, // Just in case
            `[class*="userPanelInner_"]`   // Just in case
        ].join(","),

        target: [
            `[class*="section__"] > div`,            // This is for normal
            `[class*="body_"] [class*="container_"]` // This is for simplified
        ].join(",")
    },

    UserModal: {
        main: [
            `[class*="root_"]` // This catches all user modal roots
        ].join(","),

        target: [
            `[class*="body_"] [class*="container_"]`,       // This is for normal
            `[class*="container_"] > [class*="container_"]` // This is for simplified
        ].join(",")
    },

    GuildHeader: {
        main: [
            `[class*="headerContent_"]` // This catches all guild header content
        ].join(","),

        target: [
            `[class*="name_"]` // This works for all guild headers
        ].join(",")
    }
}


const GenericTextClasses = BdApi.Webpack.getByKeys("defaultColor", "h2") ?? {"text-sm/normal": "text-sm-normal__95a78"};
const SelectClasses = BdApi.Webpack.getByKeys("defaultColor", "selectable") ?? {defaultColor: "defaultColor__30336"};
const TextClasses = Object.assign(GenericTextClasses, SelectClasses);
const AffinityStore = BdApi.Webpack.getStore("UserAffinitiesStore");
const GuildAffinitiesStore = BdApi.Webpack.getStore("GuildAffinitiesStore");
const SelectedGuildStore = BdApi.Webpack.getStore("SelectedGuildStore");
const ConsentStore = BdApi.Webpack.getStore("ConsentStore");
const updateConsents = BdApi.Webpack.getByStrings("SETTINGS_CONSENT", "grant", {searchExports: true});
const settings = ZLibrary.Utilities.loadSettings("UserAffinities", {popoutaffinities: true, modalaffinities: true, guildaffinities: true});

const PLUGIN_CSS = `
.affinity-value {
    color: var(--text-normal);
}

.affinity-label {
    color: var(--text-normal);
}

.affinity-container {
    user-select: text;
    padding-top: 2px;
}
`;

module.exports = class UserAffinities { 
    getSettingsPanel() {
        const S = ZLibrary.Settings;
        return S.SettingPanel.build((id, value) => {
                settings[id.toLowerCase()] = value;
                ZLibrary.Utilities.saveSettings("UserAffinities", settings);
            },
            new S.Switch("PopoutAffinities", "Adds Affinity Scores to User Popouts", settings.popoutaffinities),
            new S.Switch("ModalAffinities", "Adds Affinity Scores to User Modals", settings.modalaffinities),
            new S.Switch("GuildAffinities", "Adds Affinity Scores to Guilds", settings.guildaffinities),
        );
    }

    start() {
        BdApi.DOM.addStyle("UserAffinities", PLUGIN_CSS);

        if (!ConsentStore.hasConsented("personalization")) {
            BdApi.UI.showConfirmationModal("Incorrect Setting", "In order for this plugin to work, you must enable Discord personalization data collection. Do you want to enable it now?", {
                confirmText: "Yes",
                cancelText: "Not Now",
                onConfirm: () => updateConsents(["personalization"])
            });
        }
    }

    stop() {
        BdApi.DOM.removeStyle("UserAffinities");
    }

    createAffinityLabel(score) {
        const affinityLabel = document.createElement("span");
        affinityLabel.classList.add("affinity-label");
        affinityLabel.textContent = `Affinity Score: `;

        const affinityValue = document.createElement("span");
        affinityValue.classList.add("affinity-value");
        affinityValue.textContent = Math.round(score);

        const affinityWrap = document.createElement("div");
        affinityWrap.classList.add("affinity-container", TextClasses.defaultColor, TextClasses["text-sm/normal"]);
        affinityWrap.append(affinityLabel);
        affinityWrap.append(affinityValue);

        return affinityWrap;
    }

    processUserElement(element, mainQuery, targetQuery) { 
        // Try go get the main element as a descendent with fallback to currently added element
        const mainElement = element.querySelector(mainQuery) ?? element;

        // This is a sanity check for the fallback above
        if (!mainElement || !mainElement.matches(mainQuery)) return;

        // Grab the first user object that can be found in the tree
        const userId = BdApi.Utils.findInTree(BdApi.ReactUtils.getInternalInstance(mainElement), m => m?.user?.id || m?.userId || m?.message?.author?.id, {walkable: ["memoizedProps", "return"]});
        const id = userId?.userId ?? userId?.user?.id ?? userId?.message?.author?.id;

        // Check the set to see if this user has an affinity
        const affinityUsers = AffinityStore.getUserAffinitiesUserIds();
        if (!affinityUsers.has(id)) return;

        // Grab our destination element
        const target = mainElement.querySelector(targetQuery);
        if (!target) return;

        // Get the actual affinity score
        const affinities = AffinityStore.getUserAffinities();
        const affinity = affinities.find(a => a.user_id === id);

        // Add it to the target
        target.append(this.createAffinityLabel(affinity.affinity));
    }

    processUserPopout(element) { 
        // If the setting is disabled don't bother processing
        if (!settings.popoutaffinities) return;

        // Process as a user element with custom queries
        this.processUserElement(element, Queries.UserPopout.main, Queries.UserPopout.target);
    }

    processUserModal(element) {
        // If the setting is disabled don't bother processing
        if (!settings.modalaffinities) return;

        // Process as a user element with custom queries
        this.processUserElement(element, Queries.UserModal.main, Queries.UserModal.target);
    }

    processGuildHeader(element) {
        // If the setting is disabled don't bother processing
        if (!settings.guildaffinities) return;

        // Try go get the modal as a descendent with fallback to currently added element
        const header = element.querySelector(Queries.GuildHeader.main) ?? element;

        // This is a sanity check for the fallback above
        if (!header || !header.matches(Queries.GuildHeader.main)) return;

        // Grab the first user object that can be found in the tree
        const currentGuildId = SelectedGuildStore.getGuildId();
        const guildAffinity = GuildAffinitiesStore.getGuildAffinity(currentGuildId);
        if (!guildAffinity) return;

        // Grab our destination element
        const target = header.querySelector(Queries.GuildHeader.target);
        if (!target) return;

        // Add it to the target
        target.append(this.createAffinityLabel(Math.round(guildAffinity.score)));
    }

    observer(e) {
        if (!e.addedNodes.length || !(e.addedNodes[0] instanceof Element)) return;

        // Each of these will automatically check settings as well
        // as do filtering to grab the right elements.
        this.processUserPopout(e.addedNodes[0]);
        this.processUserModal(e.addedNodes[0]);
        this.processGuildHeader(e.addedNodes[0]);
    }
}

/*@end@*/