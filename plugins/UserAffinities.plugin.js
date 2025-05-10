/**
 * @name UserAffinities
 * @description Shows user affinity scores in user popouts and user profile as well as it's own modal.
 * @version 2.1.3
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

const Queries = {
    UserPopout: {
        main: [
            `[class*="user-profile-popout"]` // Just in case
        ].join(","),

        target: [
            `[class*="body_"] [class*="container_"]` // This is for simplified
        ].join(",")
    },

    UserModal: {
        main: [
            `[class*="user-profile-modal"]` // This catches all user modal roots
        ].join(","),

        target: [
            `[class*="body_"] > [class*="container_"], [class*="profileBody__"] > [class*="container_"]` // This is for simplified
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
const SystemDesign = {
    RobotIcon: BdApi.Webpack.getByStrings('"M7.89 13.46a1 1 0 0 1-1.78-.9L7 13l-.9-.45.01-.01.01-.02a2.42 2.42 0 0 1',{searchExports:true}),
    ModalRoot: BdApi.Webpack.getByStrings('.ImpressionTypes.MODAL,"aria-labelledby":',{searchExports:true}),
    openModal: BdApi.Webpack.getByStrings('onCloseRequest','onCloseCallback','onCloseCallback','instant','backdropStyle',{searchExports:true})
}
const uri = (guild) => `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=720`;
const Module = BdApi.Webpack.getBySource('"data-windows"')
const AffinitiesButton = BdApi.Webpack.getModule(x=>x.Icon).Icon
const openContextMenu = BdApi.Webpack.getByStrings("new DOMRect",{searchExports:true})

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

// Change types are fixed, improved, progress, added
const changelog = {
    blurb: "Version 2.1.3 Plugin fixed, should no longer have issues in vc, button moved to top bar",
    changes: [
        {
            title: "Fixed the plugin having issues in vc where it'd rerender the user speaking repeatedly",
            type: "fixed",
            blurb: "Plugin should be fixed, thanks Arven.",
            items: [
                "Fixed and handing it over to Arven"
            ]
        }
    ]
}


function forceUpdateApp() {
    const appMount = document.getElementById("app-mount");

    const reactContainerKey = Object.keys(appMount).find(m => m.startsWith("__reactContainer$"));

    let container = appMount[reactContainerKey];

    while (!container.stateNode?.isReactComponent) {
        container = container.child;
    }

    const { render } = container.stateNode;

    if (render.toString().includes("null")) return;

    container.stateNode.render = () => null;

    container.stateNode.forceUpdate(() => {
        container.stateNode.render = render;
        container.stateNode.forceUpdate();
    });
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
        forceUpdateApp()

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

        BdApi.Patcher.after("UserAffPatch", Module, "T", (a, args, res) => {
            const topbar = res.props.children[2].props.children[0].props.children
            
            const button = React.createElement(AffinitiesButton, {
                key: "affinities",
                icon: SystemDesign.RobotIcon,
                tooltip: "Open Affinities",
                onClick: () => SystemDesign.openModal(props => React.createElement(LostItemsModal, { props }))
            });

            topbar.push(button)
        });

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