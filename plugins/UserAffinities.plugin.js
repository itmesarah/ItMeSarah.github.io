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
const RelationshipStore = BdApi.Webpack.getStore("RelationshipStore"); 
const UserStore = BdApi.Webpack.getStore("UserStore"); 
const SelectedGuildStore = BdApi.Webpack.getStore("SelectedGuildStore");
const ConsentStore = BdApi.Webpack.getStore("ConsentStore");
const updateConsents = BdApi.Webpack.getByStrings("SETTINGS_CONSENT", "grant", {searchExports: true});
const GuildStore = BdApi.Webpack.getStore("GuildStore")
const React = BdApi.React
const {useState, useLayoutEffect} = React
const settings = ZLibrary.Utilities.loadSettings("UserAffinities", {popoutaffinities: true, modalaffinities: true, guildaffinities: true});
const SystemDesign = BdApi.Webpack.getModule(x=>x.ModalRoot)
const uri = (guild) => `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=1280`;

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
        { className: 'Affinities-fa-item' },
        type === 'friend'
            ? React.createElement(
                'div',
                { className: 'author-icon' },
                React.createElement('img', { src: item.icon, alt: item.affinity, className: 'Affinities-fa-item-icon' }),
                React.createElement('span', null, item.globalName || item.username)
            )
            : item.icon
                ? React.createElement('img', { src: item.icon, alt: item.name, className: 'Affinities-fa-item-icon' })
                : React.createElement('span', null, item.acronym),
        React.createElement(
            'span',
            { className: 'Affinities-fa-item-name' },
            item.name,
            React.createElement('span', { className: 'Affinities-fa-item-date' }, ' - ', item.affinity)
        )
    );
}

function ChangeSection({ title, items, type }) {
    if (items.length === 0) return null;

    return React.createElement(
        'div',
        { className: 'Affinities-fa-section' },
        React.createElement('h3', { className: 'Affinities-fa-section-title' }, `${title} - ${items.length}`),
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
            { className: 'Affinities-fa-modal' },
            React.createElement(
                'div',
                { className: 'Affinities-fa-header' },
                React.createElement('h2', { className: 'Affinities-fa-title' }, 'Friend & Server Affinities')
            ),
            React.createElement(
                'div',
                { className: 'Affinities-fa-tabs' },
                React.createElement(
                    'button',
                    {
                        className: `Affinities-fa-tab ${activeTab === 'friends' ? 'active' : ''}`,
                        onClick: () => setActiveTab('friends')
                    },
                    'Friends'
                ),
                React.createElement(
                    'button',
                    {
                        className: `Affinities-fa-tab ${activeTab === 'servers' ? 'active' : ''}`,
                        onClick: () => setActiveTab('servers')
                    },
                    'Servers'
                )
            ),
            React.createElement(
                'div',
                { className: 'Affinities-fa-content' },
                activeTab === 'friends' &&
                    React.createElement(
                        'div',
                        { className: 'Affinities-fa-tab-content' },
                        React.createElement(ChangeSection, { title: 'Friend', items: friends, type: 'friend' })
                    ),
                activeTab === 'servers' &&
                    React.createElement(
                        'div',
                        { className: 'Affinities-fa-tab-content' },
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
                React.createElement(ButtonUwU, {key: "uwu-affinity", icon: SystemDesign.RobotIcon, tooltip: "Open Affinities", onClick: () => {
                    SystemDesign.openModal((props) => React.createElement(LostItemsModal, {props:props}))
                }})
            )
        })

        BdApi.DOM.addStyle(`sarah-boo`,`.Affinities-fa-modal {
            background-color: var(--bg-gradient-midnight-blurple-2);
            border-radius: 5px;
            color: #dcddde;
            padding: 16px;
            width: 440px;
        }
        
        .Affinities-fa-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .Affinities-fa-title {
            color: #ffffff;
            font-size: 16px;
            font-weight: 600;
            margin: 0;
        }
       
        .Affinities-fa-tabs {
            display: flex;
            border-bottom: 1px solid #202225;
            margin-bottom: 20px;
        }
        
        .Affinities-fa-tab {
            background: none;
            border: none;
            color: #b9bbbe;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            padding: 10px 16px;
            transition: color 0.2s, border-color 0.2s;
        }
        
        .Affinities-fa-tab:hover {
            color: #dcddde;
        }
        
        .Affinities-fa-tab.active {
            color: #ffffff;
            border-bottom: 2px solid #7289da;
        }
        
        .Affinities-fa-content {
            max-height: 400px;
            overflow-y: auto;
        }
        
        .Affinities-fa-section-title {
            color: #ffffff;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
        }
        
        .Affinities-fa-item {
            display: flex;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #40444b;
            gap: 10px
        }
        
        .Affinities-fa-item:last-child {
            border-bottom: none;
        }
        
        .Affinities-fa-item-icon {
            width: 32px;
            height: 32px;
            border-radius: 50%;
        }
        
        .Affinities-fa-item-name {
            font-size: 14px;
        }
        
        .Affinities-fa-item-date {
            font-size: 12px;
            color: #72767d;
            margin-left: 8px;
        }
        
        .Affinities-fa-no-changes {
            color: #72767d;
            font-size: 14px;
            text-align: center;
            padding: 20px 0;
        }
        
        .Affinities-fa-content::-webkit-scrollbar {
            width: 8px;
        }
        
        .Affinities-fa-content::-webkit-scrollbar-track {
            background-color: #2f3136;
            border-radius: 4px;
        }
        
        .Affinities-fa-content::-webkit-scrollbar-thumb {
            background-color: #202225;
            border-radius: 4px;
        }
        
        .Affinities-fa-content::-webkit-scrollbar-thumb:hover {
            background-color: #18191c;
        }
		.rootWithShadow_f9a4c9{
			box-shadow: none;
		}`)
    }

    stop() {
        BdApi.DOM.removeStyle("UserAffinities");
        BdApi.DOM.addStyle(`sarah-boo`)
        BdApi.Patcher.unpatchAll("UserAffPatch")
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