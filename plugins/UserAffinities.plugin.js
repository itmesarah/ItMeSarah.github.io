/**
 * @name UserAffinities
 * @description Shows user affinity scores in user popouts and user profile as well as it's own modal.
 * @version 2.0.2
 * @author Sarah,Zerebos,Arven
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

// Change types are fixed, improved, progress, added
const changelog = {
    blurb: "Version 2.0.2 removes the need for Zeres Plugin Library",
    changes: [
        {
            title: "Settings Improved",
            type: "fixed",
            blurb: "Switched away from Zeres Plugin Library",
            items: [
                "Switched to BdApi for settings, so you should no longer need ZPL to use the plugin. "
            ]
        }
    ]
}


const Queries = {
    UserPopout: {
        main: [
            `[class*="biteSize_"]` // Just in case
        ].join(","),

        target: [
            `[class*="body_"] [class*="container_"]` // This is for simplified
        ].join(",")
    },

    UserModal: {
        main: [
            `[class*="fullSize_"]` // This catches all user modal roots
        ].join(","),

        target: [
            `[class*="body_"] > [class*="container_"]` // This is for simplified
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


const GenericTextClasses = BdApi.Webpack.getByKeys("defaultColor", "h2");
const SelectClasses = BdApi.Webpack.getByKeys("defaultColor", "selectable") ?? {defaultColor: "defaultColor__30336"};
const TextClasses = Object.assign(GenericTextClasses, SelectClasses);
const AffinityStore = BdApi.Webpack.getStore("UserAffinitiesStore");
const GuildAffinitiesStore = BdApi.Webpack.getStore("GuildAffinitiesStore"); 
const RelationshipStore = BdApi.Webpack.getStore("RelationshipStore"); 
const UserStore = BdApi.Webpack.getStore("UserStore"); 
const SelectedGuildStore = BdApi.Webpack.getStore("SelectedGuildStore");
const ConsentStore = BdApi.Webpack.getStore("ConsentStore");
const updateConsents = BdApi.Webpack.getByStrings("SETTINGS_CONSENT", "grant", {searchExports: true});
const GuildStore = BdApi.Webpack.getStore("GuildStore")
const React = BdApi.React
const {useState, useLayoutEffect} = React
const settings = Object.assign({popoutaffinities: true, modalaffinities: true, guildaffinities: true}, BdApi.Data.load("UserAffinities", "settings"));
const SystemDesign = BdApi.Webpack.getModule(x=>x.ModalRoot)
const uri = (guild) => `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=720`;
const LinkButton = BdApi.Webpack.getModule((m) => m.prototype?.render?.toString().includes(".linkButtonIcon"), { searchExports: true });
const [Module, Key] = BdApi.Webpack.getWithKey(BdApi.Webpack.Filters.byStrings(".current.setThemeOptions("))
const ButtonUwU = BdApi.Webpack.getByStrings(".iconWrapper])",{searchExports:true})
const openContextMenu = BdApi.Webpack.getByStrings("new DOMRect",{searchExports:true}) // ;3

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
[aria-label="Open Affinities"] path[d="M7.89 13.46a1 1 0 0 1-1.78-.9L7 13l-.9-.45.01-.01.01-.02a2.42 2.42 0 0 1 .14-.23c.1-.14.23-.31.4-.5.37-.36.98-.79 1.84-.79.86 0 1.47.43 1.83.8a3.28 3.28 0 0 1 .55.72v.02h.01v.01L10 13l.9-.45a1 1 0 0 1-1.79.9 1.28 1.28 0 0 0-.19-.25c-.14-.13-.28-.2-.42-.2-.14 0-.28.07-.42.2a1.28 1.28 0 0 0-.19.25ZM13.55 13.9a1 1 0 0 0 1.34-.44c0-.02.02-.04.04-.06.03-.05.08-.13.15-.2.14-.13.28-.2.42-.2.14 0 .28.07.42.2a1.28 1.28 0 0 1 .19.25 1 1 0 0 0 1.78-.9L17 13l.9-.45-.01-.01-.01-.02a2.57 2.57 0 0 0-.14-.23 3.28 3.28 0 0 0-.4-.5c-.37-.36-.98-.79-1.84-.79-.86 0-1.47.43-1.83.8a3.28 3.28 0 0 0-.55.72v.02h-.01v.01L14 13l-.9-.45a1 1 0 0 0 .45 1.34Z"]{
fill: orange;
}
[aria-label="Open Affinities"] path[d="M12 21c5.52 0 10-1.86 10-6 0-5.59-2.8-10.07-4.26-11.67a1 1 0 1 0-1.48 1.34 14.8 14.8 0 0 1 2.35 3.86A10.23 10.23 0 0 0 12 6C9.47 6 7.15 7.02 5.4 8.53a14.8 14.8 0 0 1 2.34-3.86 1 1 0 0 0-1.48-1.34A18.65 18.65 0 0 0 2 15c0 4.14 4.48 6 10 6Zm0-12c3.87 0 7 2 7 4.2S15.87 17 12 17s-7-1.6-7-3.8C5 11 8.13 9 12 9Z"]{
fill: aqua;
}
	
.Affinities-modal {
	background-color: var(--modal-background);
	border-radius: 5px;
	color: #dcddde;
	padding: 16px;
	width: auto;
}
        
.Affinities-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.Affinities-title {
	color: #ffffff;
	font-size: 16px;
	font-weight: 600;
	margin: 0;
}

.Affinities-tabs {
	display: flex;
	margin-bottom: 20px;
}

.Affinities-tab {
	background: none;
	border: none;
	color: #b9bbbe;
	cursor: pointer;
	font-size: 14px;
	font-weight: 500;
	padding: 10px 16px;
	transition: color 0.2s, border-color 0.2s;
}

.Affinities-tab:hover {
	color: #dcddde;
}

.Affinities-tab.active {
	color: #ffffff;
	border-bottom: 2px solid #7289da;
}

.Affinities-content {
	max-height: 400px;
	overflow-y: auto;
}

.Affinities-section-title {
	color: #ffffff;
	font-size: 14px;
	font-weight: 600;
	margin-bottom: 12px;
}

.Affinities-item {
	display: flex;
	align-items: center;
	padding: 8px 0;
	gap: 10px
}

.Affinities-item:last-child {
	border-bottom: none;
}

.Affinities-item-icon {
	width: 32px;
	height: 32px;
	border-radius: 50%;
}

.Affinities-item-name {
	font-size: 14px;
}

.Affinities-item-date {
	font-size: 12px;
	color: #72767d;
	margin-left: 8px;
}

.Affinities-no-changes {
	color: #72767d;
	font-size: 14px;
	text-align: center;
	padding: 20px 0;
}

.Affinities-content::-webkit-scrollbar {
	width: 8px;
}

.Affinities-content::-webkit-scrollbar-track {
	background-color: #2f3136;
	border-radius: 4px;
}

.Affinities-content::-webkit-scrollbar-thumb {
	background-color: #202225;
	border-radius: 4px;
}

.Affinities-content::-webkit-scrollbar-thumb:hover {
	background-color: #18191c;
}
`;

function NavigationButton()
{
    return React.createElement(LinkButton, {icon: SystemDesign.RobotIcon, text: "Affinities", onClick: () => {
        SystemDesign.openModal((props) => React.createElement(LostItemsModal, {props:props}))
    }})
}

function ChangeItem({ item, type }) {
    return React.createElement(
        'div',
        { className: 'Affinities-item' },
        type === 'friend'
            ? React.createElement(
                'div',
                { className: 'author-icon' },
                React.createElement('img', { src: item.icon, alt: item.affinity, className: 'Affinities-item-icon' }),
                React.createElement('span', null, item.globalName || item.username)
            )
            : item.icon
                ? React.createElement('img', { src: item.icon, alt: item.name, className: 'Affinities-item-icon' })
                : React.createElement('span', null, item.acronym),
        React.createElement(
            'span',
            { className: 'Affinities-item-name' },
            item.name,
            React.createElement('span', { className: 'Affinities-item-date' }, ' - ', item.affinity)
        )
    );
}

function ChangeSection({ title, items, type }) {
    if (items.length === 0) return null;

    return React.createElement(
        'div',
        { className: 'Affinities-section' },
        React.createElement('h3', { className: 'Affinities-section-title' }, `${title} - ${items.length}`),
        items.map(item =>
            React.createElement(ChangeItem, { key: item.id, item: item, type: type })
        )
    );
}

function LostItemsModal({ props }) {
    const [activeTab, setActiveTab] = useState('friends');
    const [friends, setFriends] = useState([]);
    const [guilds, setGuilds] = useState([]);

    useLayoutEffect(() => {
        const currentFriends = Object.entries(RelationshipStore.getRelationships())
        .filter(([, type]) => type === 1)
        .map(([id]) => {
            const user = UserStore.getUser(id);
            const affinity = AffinityStore.getUserAffinities().find(a => a.user_id === id)?.affinity ?? 0;
            return { id, name: user.username, affinity: Math.round(affinity), icon: user.getAvatarURL() };
        })
        .sort((a, b) => b.affinity - a.affinity);

    const currentGuilds = Object.values(GuildStore.getGuilds())
        .map(guild => {
            const detailedGuild = GuildStore.getGuild(guild.id);
            const affinity = GuildAffinitiesStore.getGuildAffinity(guild.id)?.score ?? 0;
            return {
                id: detailedGuild.id,
                name: detailedGuild.name,
                affinity: Math.round(affinity),
                icon: detailedGuild.getIconURL() ?? void 0
            };
        })
        .sort((a, b) => b.affinity - a.affinity);

        setFriends(currentFriends);
        setGuilds(currentGuilds);
    }, []);

    return React.createElement(
        SystemDesign.ModalRoot,
        { ...props },
        React.createElement(
            'div',
            { className: 'Affinities-modal' },
            React.createElement(
                'div',
                { className: 'Affinities-header' },
                React.createElement('h2', { className: 'Affinities-title' }, 'Friend & Server Affinities')
            ),
            React.createElement(
                'div',
                { className: 'Affinities-tabs' },
                React.createElement(
                    'button',
                    {
                        className: `Affinities-tab ${activeTab === 'friends' ? 'active' : ''}`,
                        onClick: () => setActiveTab('friends')
                    },
                    'Friends'
                ),
                React.createElement(
                    'button',
                    {
                        className: `Affinities-tab ${activeTab === 'servers' ? 'active' : ''}`,
                        onClick: () => setActiveTab('servers')
                    },
                    'Servers'
                )
            ),
            React.createElement(
                'div',
                { className: 'Affinities-content' },
                activeTab === 'friends' &&
                    React.createElement(
                        'div',
                        { className: 'Affinities-tab-content' },
                        React.createElement(ChangeSection, { title: 'Friend', items: friends, type: 'friend' })
                    ),
                activeTab === 'servers' &&
                    React.createElement(
                        'div',
                        { className: 'Affinities-tab-content' },
                        React.createElement(ChangeSection, { title: 'Guild', items: guilds, type: 'guild' })
                    )
            )
        )
    );
}

function forceUpdate(element) {
    if (!element) return;
    const toForceUpdate = BdApi.ReactUtils.getOwnerInstance(element);
    const forceRerender = BdApi.Patcher.instead(
      "ihatethis",
      toForceUpdate,
      "render",
      () => {
        forceRerender();
        return null;
      }
    );
    toForceUpdate.forceUpdate(() =>
      toForceUpdate.forceUpdate(() => {})
    );
  }

module.exports = class UserAffinities {
    constructor(meta) {
        this.meta = meta;
    }
    
    getSettingsPanel() {
        return BdApi.UI.buildSettingsPanel({
            onChange: (_, id, value) => {
                settings[id.toLowerCase()] = value;
                BdApi.Data.save("UserAffinities", "settings", settings);
            },
            settings: [
                {type: "switch", id: "popoutaffinities", name: "Popout Affinities", note: "Adds Affinity score to User Popouts", value: settings.popoutaffinities},
                {type: "switch", id: "modalaffinities", name: "Modal Affinities", note: "Adds Affinity score to User Modals", value: settings.modalaffinities},
                {type: "switch", id: "guildaffinities", name: "Guild Affinities", note: "Adds Affinity score to Guilds", value: settings.guildaffinities},
            ]
        });
    }

    start() {
        const savedVersion = BdApi.Data.load("UserAffinities", "version");
        if (savedVersion !== this.meta.version) {
            BdApi.UI.showChangelogModal(Object.assign({
                title: this.meta.name,
                subtitle: `v${this.meta.version}`,
            }, changelog));
            BdApi.Data.save("UserAffinities", "version", this.meta.version);
        }

        if (!ConsentStore.hasConsented("personalization")) {
            BdApi.UI.showConfirmationModal("Incorrect Setting", "In order for this plugin to work, you must enable Discord personalization data collection. Do you want to enable it now?", {
                confirmText: "Yes",
                cancelText: "Not Now",
                onConfirm: () => updateConsents(["personalization"])
            });
        }

        BdApi.Patcher.after("UserAffPatch", Module, Key, (a,args,res) => {
            const props = BdApi.Utils.findInTree(res,x=>x?.className?.includes?.("toolbar"),{walkable: ['props','children']})
            if (!props) return
            props.children.props.children.push(
                React.createElement(ButtonUwU, {key: "affinities", icon: SystemDesign.RobotIcon, tooltip: "Open Affinities", onClick: () => {
                    SystemDesign.openModal((props) => React.createElement(LostItemsModal, {props:props}))
                }})
            )
        })
		BdApi.DOM.addStyle("UserAffinities", PLUGIN_CSS);
    }

    stop() {
        BdApi.DOM.removeStyle("UserAffinities");
        BdApi.Patcher.unpatchAll("UserAffPatch");
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