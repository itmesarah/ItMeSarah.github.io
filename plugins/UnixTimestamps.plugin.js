/**
 * @name UnixTimestamps
 * @description Like regular timestamps, but unix.
  * @authorLink https://github.com/ItMeSarah
 * @version 1.0.2
 * @invite kckPSV8Z3m
 * @author Zerebos
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

const [timestampTools, formatter] = BdApi.Webpack.getWithKey(m => m?.toString?.()?.includes("full:"));
const messageTimestamp = BdApi.Webpack.getByStrings("timeFormatted", { defaultExport: false });

const getClass = (original, args) => {
    class unixTimestamp extends BdApi.React.Component {
        componentDidMount() {
            this.interval = setInterval(this.forceUpdate.bind(this), 1000);
        }

        componentWillUnmount() {
            if (this.interval) clearInterval(this.interval);
        }

        render() {
            // Check if timestampTools and formatter are valid
            if (!timestampTools || !formatter || !timestampTools[formatter]) {
                console.error("timestampTools or formatter is undefined");
                return Reflect.apply(original, null, [this.props]); // Fallback to original if error
            }

            const ret = Reflect.apply(original, null, [this.props]);
            const ts = timestampTools[formatter](args[0].timestamp.getTime() / 1000, "R");

            try {
                ret.props.children = ts.formatted;
            } catch (e) {
                console.log({ thisObject: this, args, ret, msg: e.message });
                return ret; // Fallback on error
            }

            return ret;
        }
    }

    return (props) => BdApi.React.createElement(unixTimestamp, props);
};

module.exports = class unixTimestamps {
    start() {
        // Ensure messageTimestamp is found
        if (!messageTimestamp) {
            console.error("messageTimestamp is undefined");
            return;
        }

        BdApi.Patcher.after("unixTimestamps", messageTimestamp, "Z", (t, a, r) => {
            const orig = r.props.children.props.children;
            // Check if the component is already patched
            if (orig.__patched) return;
            // Apply the patch
            r.props.children.props.children = getClass(orig, a);
            r.props.children.props.children.__patched = true; // Mark as patched
        });
    }

    stop() {
        BdApi.Patcher.unpatchAll("unixTimestamps");
    }
};


/*@end@*/