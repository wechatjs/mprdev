import { type RecorderExtensionEndpoint } from './RecorderExtensionEndpoint.js';
import * as Common from '../../core/common/common.js';
export declare class RecorderPluginManager extends Common.ObjectWrapper.ObjectWrapper<EventTypes> {
    #private;
    static instance(): RecorderPluginManager;
    addPlugin(plugin: RecorderExtensionEndpoint): void;
    removePlugin(plugin: RecorderExtensionEndpoint): void;
    plugins(): RecorderExtensionEndpoint[];
}
export declare enum Events {
    PluginAdded = "pluginAdded",
    PluginRemoved = "pluginRemoved"
}
export declare type EventTypes = {
    [Events.PluginAdded]: RecorderExtensionEndpoint;
    [Events.PluginRemoved]: RecorderExtensionEndpoint;
};
