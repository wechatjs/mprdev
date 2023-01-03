// Copyright 2022 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import * as Common from '../../core/common/common.js';
let instance = null;
export class RecorderPluginManager extends Common.ObjectWrapper.ObjectWrapper {
    #plugins = new Set();
    static instance() {
        if (!instance) {
            instance = new RecorderPluginManager();
        }
        return instance;
    }
    addPlugin(plugin) {
        this.#plugins.add(plugin);
        this.dispatchEventToListeners(Events.PluginAdded, plugin);
    }
    removePlugin(plugin) {
        this.#plugins.delete(plugin);
        this.dispatchEventToListeners(Events.PluginRemoved, plugin);
    }
    plugins() {
        return Array.from(this.#plugins.values());
    }
}
// TODO(crbug.com/1167717): Make this a const enum again
// eslint-disable-next-line rulesdir/const_enum
export var Events;
(function (Events) {
    Events["PluginAdded"] = "pluginAdded";
    Events["PluginRemoved"] = "pluginRemoved";
})(Events || (Events = {}));
//# sourceMappingURL=RecorderPluginManager.js.map