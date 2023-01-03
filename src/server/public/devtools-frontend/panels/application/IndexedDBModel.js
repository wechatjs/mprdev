/*
 * Copyright (C) 2012 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
import * as Common from '../../core/common/common.js';
import * as SDK from '../../core/sdk/sdk.js';
export class IndexedDBModel extends SDK.SDKModel.SDKModel {
    securityOriginManager;
    storageKeyManager;
    indexedDBAgent;
    storageAgent;
    databasesInternal;
    databaseNamesBySecurityOrigin;
    databaseNamesByStorageKey;
    originsUpdated;
    updatedStorageKeys;
    throttler;
    enabled;
    constructor(target) {
        super(target);
        target.registerStorageDispatcher(this);
        this.securityOriginManager = target.model(SDK.SecurityOriginManager.SecurityOriginManager);
        this.storageKeyManager = target.model(SDK.StorageKeyManager.StorageKeyManager);
        this.indexedDBAgent = target.indexedDBAgent();
        this.storageAgent = target.storageAgent();
        this.databasesInternal = new Map();
        this.databaseNamesBySecurityOrigin = new Map();
        this.databaseNamesByStorageKey = new Map();
        this.originsUpdated = new Set();
        this.updatedStorageKeys = new Set();
        this.throttler = new Common.Throttler.Throttler(1000);
    }
    // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static keyFromIDBKey(idbKey) {
        if (typeof (idbKey) === 'undefined' || idbKey === null) {
            return undefined;
        }
        let key;
        switch (typeof (idbKey)) {
            case 'number':
                key = {
                    type: "number" /* Protocol.IndexedDB.KeyType.Number */,
                    number: idbKey,
                };
                break;
            case 'string':
                key = {
                    type: "string" /* Protocol.IndexedDB.KeyType.String */,
                    string: idbKey,
                };
                break;
            case 'object':
                if (idbKey instanceof Date) {
                    key = {
                        type: "date" /* Protocol.IndexedDB.KeyType.Date */,
                        date: idbKey.getTime(),
                    };
                }
                else if (Array.isArray(idbKey)) {
                    const array = [];
                    for (let i = 0; i < idbKey.length; ++i) {
                        const nestedKey = IndexedDBModel.keyFromIDBKey(idbKey[i]);
                        if (nestedKey) {
                            array.push(nestedKey);
                        }
                    }
                    key = {
                        type: "array" /* Protocol.IndexedDB.KeyType.Array */,
                        array,
                    };
                }
                else {
                    return undefined;
                }
                break;
            default:
                return undefined;
        }
        return key;
    }
    static keyRangeFromIDBKeyRange(idbKeyRange) {
        return {
            lower: IndexedDBModel.keyFromIDBKey(idbKeyRange.lower),
            upper: IndexedDBModel.keyFromIDBKey(idbKeyRange.upper),
            lowerOpen: Boolean(idbKeyRange.lowerOpen),
            upperOpen: Boolean(idbKeyRange.upperOpen),
        };
    }
    static idbKeyPathFromKeyPath(keyPath) {
        let idbKeyPath;
        switch (keyPath.type) {
            case "null" /* Protocol.IndexedDB.KeyPathType.Null */:
                idbKeyPath = null;
                break;
            case "string" /* Protocol.IndexedDB.KeyPathType.String */:
                idbKeyPath = keyPath.string;
                break;
            case "array" /* Protocol.IndexedDB.KeyPathType.Array */:
                idbKeyPath = keyPath.array;
                break;
        }
        return idbKeyPath;
    }
    static keyPathStringFromIDBKeyPath(idbKeyPath) {
        if (typeof idbKeyPath === 'string') {
            return '"' + idbKeyPath + '"';
        }
        if (idbKeyPath instanceof Array) {
            return '["' + idbKeyPath.join('", "') + '"]';
        }
        return null;
    }
    enable() {
        if (this.enabled) {
            return;
        }
        void this.indexedDBAgent.invoke_enable();
        if (this.securityOriginManager) {
            this.securityOriginManager.addEventListener(SDK.SecurityOriginManager.Events.SecurityOriginAdded, this.securityOriginAdded, this);
            this.securityOriginManager.addEventListener(SDK.SecurityOriginManager.Events.SecurityOriginRemoved, this.securityOriginRemoved, this);
            for (const securityOrigin of this.securityOriginManager.securityOrigins()) {
                this.addOrigin(securityOrigin);
            }
        }
        if (this.storageKeyManager) {
            this.storageKeyManager.addEventListener(SDK.StorageKeyManager.Events.StorageKeyAdded, this.storageKeyAdded, this);
            this.storageKeyManager.addEventListener(SDK.StorageKeyManager.Events.StorageKeyRemoved, this.storageKeyRemoved, this);
            for (const storageKey of this.storageKeyManager.storageKeys()) {
                this.addStorageKey(storageKey);
            }
        }
        this.enabled = true;
    }
    clearForOrigin(origin) {
        if (!this.enabled || !this.databaseNamesBySecurityOrigin.has(origin)) {
            return;
        }
        this.removeOrigin(origin);
        this.addOrigin(origin);
    }
    clearForStorageKey(storageKey) {
        if (!this.enabled || !this.databaseNamesByStorageKey.has(storageKey)) {
            return;
        }
        this.removeStorageKey(storageKey);
        this.addStorageKey(storageKey);
    }
    async deleteDatabase(databaseId) {
        if (!this.enabled) {
            return;
        }
        // TODO(crbug.com/1347831) Prioritize storageKey once everything is ready
        if (databaseId.securityOrigin) {
            await this.indexedDBAgent.invoke_deleteDatabase({ securityOrigin: databaseId.securityOrigin, databaseName: databaseId.name });
            void this.loadDatabaseNames(databaseId.securityOrigin);
        }
        else if (databaseId.storageKey) {
            await this.indexedDBAgent.invoke_deleteDatabase({ storageKey: databaseId.storageKey, databaseName: databaseId.name });
            void this.loadDatabaseNamesByStorageKey(databaseId.storageKey);
        }
    }
    async refreshDatabaseNames() {
        for (const securityOrigin of this.databaseNamesBySecurityOrigin.keys()) {
            await this.loadDatabaseNames(securityOrigin);
        }
        for (const storageKey of this.databaseNamesByStorageKey.keys()) {
            await this.loadDatabaseNamesByStorageKey(storageKey);
        }
        this.dispatchEventToListeners(Events.DatabaseNamesRefreshed);
    }
    refreshDatabase(databaseId) {
        void this.loadDatabase(databaseId, true);
    }
    async clearObjectStore(databaseId, objectStoreName) {
        // TODO(crbug.com/1347831) Prioritize storageKey once everything is ready
        if (databaseId.securityOrigin) {
            await this.indexedDBAgent.invoke_clearObjectStore({ securityOrigin: databaseId.securityOrigin, databaseName: databaseId.name, objectStoreName });
        }
        else if (databaseId.storageKey) {
            await this.indexedDBAgent.invoke_clearObjectStore({ storageKey: databaseId.storageKey, databaseName: databaseId.name, objectStoreName });
        }
    }
    async deleteEntries(databaseId, objectStoreName, idbKeyRange) {
        const keyRange = IndexedDBModel.keyRangeFromIDBKeyRange(idbKeyRange);
        // TODO(crbug.com/1347831) Prioritize storageKey once everything is ready
        if (databaseId.securityOrigin) {
            await this.indexedDBAgent.invoke_deleteObjectStoreEntries({ securityOrigin: databaseId.securityOrigin, databaseName: databaseId.name, objectStoreName, keyRange });
        }
        else if (databaseId.storageKey) {
            await this.indexedDBAgent.invoke_deleteObjectStoreEntries({ storageKey: databaseId.storageKey, databaseName: databaseId.name, objectStoreName, keyRange });
        }
    }
    securityOriginAdded(event) {
        this.addOrigin(event.data);
    }
    storageKeyAdded(event) {
        this.addStorageKey(event.data);
    }
    securityOriginRemoved(event) {
        this.removeOrigin(event.data);
    }
    storageKeyRemoved(event) {
        this.removeStorageKey(event.data);
    }
    addOrigin(securityOrigin) {
        console.assert(!this.databaseNamesBySecurityOrigin.has(securityOrigin));
        this.databaseNamesBySecurityOrigin.set(securityOrigin, new Set());
        void this.loadDatabaseNames(securityOrigin);
        if (this.isValidSecurityOrigin(securityOrigin)) {
            void this.storageAgent.invoke_trackIndexedDBForOrigin({ origin: securityOrigin });
        }
    }
    addStorageKey(storageKey) {
        console.assert(!this.databaseNamesByStorageKey.has(storageKey));
        this.databaseNamesByStorageKey.set(storageKey, new Set());
        void this.loadDatabaseNamesByStorageKey(storageKey);
        void this.storageAgent.invoke_trackIndexedDBForStorageKey({ storageKey });
    }
    removeOrigin(securityOrigin) {
        console.assert(this.databaseNamesBySecurityOrigin.has(securityOrigin));
        for (const item of this.databaseNamesBySecurityOrigin.get(securityOrigin) || []) {
            this.databaseRemoved(securityOrigin, item);
        }
        this.databaseNamesBySecurityOrigin.delete(securityOrigin);
        if (this.isValidSecurityOrigin(securityOrigin)) {
            void this.storageAgent.invoke_untrackIndexedDBForOrigin({ origin: securityOrigin });
        }
    }
    removeStorageKey(storageKey) {
        console.assert(this.databaseNamesByStorageKey.has(storageKey));
        for (const name of this.databaseNamesByStorageKey.get(storageKey) || []) {
            this.databaseRemovedForStorageKey(storageKey, name);
        }
        this.databaseNamesByStorageKey.delete(storageKey);
        void this.storageAgent.invoke_untrackIndexedDBForStorageKey({ storageKey });
    }
    isValidSecurityOrigin(securityOrigin) {
        const parsedURL = Common.ParsedURL.ParsedURL.fromString(securityOrigin);
        return parsedURL !== null && parsedURL.scheme.startsWith('http');
    }
    updateOriginDatabaseNames(securityOrigin, databaseNames) {
        const newDatabaseNames = new Set(databaseNames);
        const oldDatabaseNames = new Set(this.databaseNamesBySecurityOrigin.get(securityOrigin));
        this.databaseNamesBySecurityOrigin.set(securityOrigin, newDatabaseNames);
        for (const databaseName of oldDatabaseNames) {
            if (!newDatabaseNames.has(databaseName)) {
                this.databaseRemoved(securityOrigin, databaseName);
            }
        }
        for (const databaseName of newDatabaseNames) {
            if (!oldDatabaseNames.has(databaseName)) {
                this.databaseAdded(securityOrigin, databaseName);
            }
        }
    }
    updateStorageKeyDatabaseNames(storageKey, databaseNames) {
        const newDatabaseNames = new Set(databaseNames);
        const oldDatabaseNames = new Set(this.databaseNamesByStorageKey.get(storageKey));
        this.databaseNamesByStorageKey.set(storageKey, newDatabaseNames);
        for (const databaseName of oldDatabaseNames) {
            if (!newDatabaseNames.has(databaseName)) {
                this.databaseRemovedForStorageKey(storageKey, databaseName);
            }
        }
        for (const databaseName of newDatabaseNames) {
            if (!oldDatabaseNames.has(databaseName) && !this.hasDuplicateWithSecurityOrigin(storageKey, databaseName)) {
                this.databaseAddedForStorageKey(storageKey, databaseName);
            }
        }
    }
    // TODO(crbug.com/1360001) Remove deduplication once we stop supporting security origin
    hasDuplicateWithSecurityOrigin(storageKey, databaseName) {
        const securityOrigin = storageKey.slice(0, -1);
        const databaseNames = this.databaseNamesBySecurityOrigin.get(securityOrigin);
        return Boolean(databaseNames?.has(databaseName));
    }
    databases() {
        const result = [];
        for (const [securityOrigin, databaseNames] of this.databaseNamesBySecurityOrigin) {
            for (const databaseName of databaseNames) {
                result.push(new DatabaseId(securityOrigin, undefined, databaseName));
            }
        }
        for (const [storageKey, databaseNames] of this.databaseNamesByStorageKey) {
            for (const name of databaseNames) {
                result.push(new DatabaseId(undefined, storageKey, name));
            }
        }
        return result;
    }
    databaseAdded(securityOrigin, databaseName) {
        const databaseId = new DatabaseId(securityOrigin, undefined, databaseName);
        this.dispatchEventToListeners(Events.DatabaseAdded, { model: this, databaseId: databaseId });
    }
    databaseAddedForStorageKey(storageKey, databaseName) {
        const databaseId = new DatabaseId(undefined, storageKey, databaseName);
        this.dispatchEventToListeners(Events.DatabaseAdded, { model: this, databaseId: databaseId });
    }
    databaseRemoved(securityOrigin, databaseName) {
        const databaseId = new DatabaseId(securityOrigin, undefined, databaseName);
        this.dispatchEventToListeners(Events.DatabaseRemoved, { model: this, databaseId: databaseId });
    }
    databaseRemovedForStorageKey(storageKey, databaseName) {
        const databaseId = new DatabaseId(undefined, storageKey, databaseName);
        this.dispatchEventToListeners(Events.DatabaseRemoved, { model: this, databaseId: databaseId });
    }
    async loadDatabaseNames(securityOrigin) {
        const { databaseNames } = await this.indexedDBAgent.invoke_requestDatabaseNames({ securityOrigin });
        if (!databaseNames) {
            return [];
        }
        if (!this.databaseNamesBySecurityOrigin.has(securityOrigin)) {
            return [];
        }
        this.updateOriginDatabaseNames(securityOrigin, databaseNames);
        return databaseNames;
    }
    async loadDatabaseNamesByStorageKey(storageKey) {
        const { databaseNames } = await this.indexedDBAgent.invoke_requestDatabaseNames({ storageKey });
        if (!databaseNames) {
            return [];
        }
        if (!this.databaseNamesByStorageKey.has(storageKey)) {
            return [];
        }
        this.updateStorageKeyDatabaseNames(storageKey, databaseNames);
        return databaseNames;
    }
    async loadDatabase(databaseId, entriesUpdated) {
        let databaseWithObjectStores = null;
        // TODO(crbug.com/1347831) Prioritize storageKey once everything is ready
        if (databaseId.securityOrigin) {
            databaseWithObjectStores = (await this.indexedDBAgent.invoke_requestDatabase({
                securityOrigin: databaseId.securityOrigin,
                databaseName: databaseId.name,
            })).databaseWithObjectStores;
            if (!this.databaseNamesBySecurityOrigin.has(databaseId.securityOrigin)) {
                return;
            }
        }
        else if (databaseId.storageKey) {
            databaseWithObjectStores = (await this.indexedDBAgent.invoke_requestDatabase({
                storageKey: databaseId.storageKey,
                databaseName: databaseId.name,
            })).databaseWithObjectStores;
            if (!this.databaseNamesByStorageKey.has(databaseId.storageKey)) {
                return;
            }
        }
        if (!databaseWithObjectStores) {
            return;
        }
        const databaseModel = new Database(databaseId, databaseWithObjectStores.version);
        this.databasesInternal.set(databaseId, databaseModel);
        for (const objectStore of databaseWithObjectStores.objectStores) {
            const objectStoreIDBKeyPath = IndexedDBModel.idbKeyPathFromKeyPath(objectStore.keyPath);
            const objectStoreModel = new ObjectStore(objectStore.name, objectStoreIDBKeyPath, objectStore.autoIncrement);
            for (let j = 0; j < objectStore.indexes.length; ++j) {
                const index = objectStore.indexes[j];
                const indexIDBKeyPath = IndexedDBModel.idbKeyPathFromKeyPath(index.keyPath);
                const indexModel = new Index(index.name, indexIDBKeyPath, index.unique, index.multiEntry);
                objectStoreModel.indexes.set(indexModel.name, indexModel);
            }
            databaseModel.objectStores.set(objectStoreModel.name, objectStoreModel);
        }
        this.dispatchEventToListeners(Events.DatabaseLoaded, { model: this, database: databaseModel, entriesUpdated: entriesUpdated });
    }
    loadObjectStoreData(databaseId, objectStoreName, idbKeyRange, skipCount, pageSize, callback) {
        void this.requestData(databaseId, databaseId.name, objectStoreName, '', idbKeyRange, skipCount, pageSize, callback);
    }
    loadIndexData(databaseId, objectStoreName, indexName, idbKeyRange, skipCount, pageSize, callback) {
        void this.requestData(databaseId, databaseId.name, objectStoreName, indexName, idbKeyRange, skipCount, pageSize, callback);
    }
    async requestData(databaseId, databaseName, objectStoreName, indexName, idbKeyRange, skipCount, pageSize, callback) {
        const keyRange = idbKeyRange ? IndexedDBModel.keyRangeFromIDBKeyRange(idbKeyRange) : undefined;
        const runtimeModel = this.target().model(SDK.RuntimeModel.RuntimeModel);
        let response = null;
        // TODO(crbug.com/1347831) Prioritize storageKey once everything is ready
        if (databaseId.securityOrigin) {
            response = await this.indexedDBAgent.invoke_requestData({
                securityOrigin: databaseId.securityOrigin,
                databaseName,
                objectStoreName,
                indexName,
                skipCount,
                pageSize,
                keyRange,
            });
            if (!runtimeModel || !this.databaseNamesBySecurityOrigin.has(databaseId.securityOrigin)) {
                return;
            }
        }
        else if (databaseId.storageKey) {
            response = await this.indexedDBAgent.invoke_requestData({
                storageKey: databaseId.storageKey,
                databaseName,
                objectStoreName,
                indexName,
                skipCount,
                pageSize,
                keyRange,
            });
            if (!runtimeModel || !this.databaseNamesByStorageKey.has(databaseId.storageKey)) {
                return;
            }
        }
        if (!response) {
            return;
        }
        if (response.getError()) {
            console.error('IndexedDBAgent error: ' + response.getError());
            return;
        }
        const dataEntries = response.objectStoreDataEntries;
        const entries = [];
        for (const dataEntry of dataEntries) {
            const key = runtimeModel?.createRemoteObject(dataEntry.key);
            const primaryKey = runtimeModel?.createRemoteObject(dataEntry.primaryKey);
            const value = runtimeModel?.createRemoteObject(dataEntry.value);
            if (!key || !primaryKey || !value) {
                return;
            }
            entries.push(new Entry(key, primaryKey, value));
        }
        callback(entries, response.hasMore);
    }
    async getMetadata(databaseId, objectStore) {
        const databaseName = databaseId.name;
        const objectStoreName = objectStore.name;
        let response = null;
        // TODO(crbug.com/1347831) Prioritize storageKey once everything is ready
        if (databaseId.securityOrigin) {
            response = await this.indexedDBAgent.invoke_getMetadata({ securityOrigin: databaseId.securityOrigin, databaseName, objectStoreName });
        }
        else if (databaseId.storageKey) {
            await this.indexedDBAgent.invoke_getMetadata({ storageKey: databaseId.storageKey, databaseName, objectStoreName });
        }
        if (!response) {
            return null;
        }
        if (response.getError()) {
            console.error('IndexedDBAgent error: ' + response.getError());
            return null;
        }
        return { entriesCount: response.entriesCount, keyGeneratorValue: response.keyGeneratorValue };
    }
    async refreshDatabaseList(securityOrigin) {
        const databaseNames = await this.loadDatabaseNames(securityOrigin);
        for (const databaseName of databaseNames) {
            void this.loadDatabase(new DatabaseId(securityOrigin, undefined, databaseName), false);
        }
    }
    async refreshDatabaseListForStorageKey(storageKey) {
        const databaseNames = await this.loadDatabaseNamesByStorageKey(storageKey);
        for (const databaseName of databaseNames) {
            void this.loadDatabase(new DatabaseId(undefined, storageKey, databaseName), false);
        }
    }
    indexedDBListUpdated({ origin: securityOrigin, storageKey: storageKey }) {
        // TODO(crbug.com/1347831) Prioritize storageKey once everything is ready
        if (securityOrigin) {
            this.originsUpdated.add(securityOrigin);
            void this.throttler.schedule(() => {
                const promises = Array.from(this.originsUpdated, securityOrigin => {
                    void this.refreshDatabaseList(securityOrigin);
                });
                this.originsUpdated.clear();
                return Promise.all(promises);
            });
        }
        else if (storageKey) {
            this.updatedStorageKeys.add(storageKey);
            void this.throttler.schedule(() => {
                const promises = Array.from(this.updatedStorageKeys, storageKey => {
                    void this.refreshDatabaseListForStorageKey(storageKey);
                });
                this.updatedStorageKeys.clear();
                return Promise.all(promises);
            });
        }
    }
    indexedDBContentUpdated({ origin: securityOrigin, storageKey, databaseName, objectStoreName }) {
        // TODO(crbug.com/1347831) Prioritize storageKey once everything is ready
        const databaseId = securityOrigin ? new DatabaseId(securityOrigin, undefined, databaseName) :
            new DatabaseId(undefined, storageKey, databaseName);
        this.dispatchEventToListeners(Events.IndexedDBContentUpdated, { databaseId: databaseId, objectStoreName: objectStoreName, model: this });
    }
    cacheStorageListUpdated(_event) {
    }
    cacheStorageContentUpdated(_event) {
    }
    interestGroupAccessed(_event) {
    }
}
SDK.SDKModel.SDKModel.register(IndexedDBModel, { capabilities: SDK.Target.Capability.Storage, autostart: false });
// TODO(crbug.com/1167717): Make this a const enum again
// eslint-disable-next-line rulesdir/const_enum
export var Events;
(function (Events) {
    Events["DatabaseAdded"] = "DatabaseAdded";
    Events["DatabaseRemoved"] = "DatabaseRemoved";
    Events["DatabaseLoaded"] = "DatabaseLoaded";
    Events["DatabaseNamesRefreshed"] = "DatabaseNamesRefreshed";
    Events["IndexedDBContentUpdated"] = "IndexedDBContentUpdated";
})(Events || (Events = {}));
export class Entry {
    key;
    primaryKey;
    value;
    constructor(key, primaryKey, value) {
        this.key = key;
        this.primaryKey = primaryKey;
        this.value = value;
    }
}
export class DatabaseId {
    securityOrigin;
    storageKey;
    name;
    constructor(securityOrigin, storageKey, name) {
        if (Boolean(securityOrigin) === Boolean(storageKey)) {
            throw new Error('At least and at most one of security origin or storage key must be defined');
        }
        this.securityOrigin = securityOrigin;
        this.storageKey = securityOrigin ? undefined : storageKey;
        this.name = name;
    }
    // cannot be null since constructor checks that either one of security origin or storage key is set
    getOriginOrStorageKey() {
        return this.securityOrigin ? this.securityOrigin : this.storageKey;
    }
    equals(databaseId) {
        return this.name === databaseId.name && this.securityOrigin === databaseId.securityOrigin &&
            this.storageKey === databaseId.storageKey;
    }
}
export class Database {
    databaseId;
    version;
    objectStores;
    constructor(databaseId, version) {
        this.databaseId = databaseId;
        this.version = version;
        this.objectStores = new Map();
    }
}
export class ObjectStore {
    name;
    // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keyPath;
    autoIncrement;
    indexes;
    // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(name, keyPath, autoIncrement) {
        this.name = name;
        this.keyPath = keyPath;
        this.autoIncrement = autoIncrement;
        this.indexes = new Map();
    }
    get keyPathString() {
        // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
        // @ts-expect-error
        return IndexedDBModel.keyPathStringFromIDBKeyPath(this.keyPath);
    }
}
export class Index {
    name;
    // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keyPath;
    unique;
    multiEntry;
    // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(name, keyPath, unique, multiEntry) {
        this.name = name;
        this.keyPath = keyPath;
        this.unique = unique;
        this.multiEntry = multiEntry;
    }
    get keyPathString() {
        return IndexedDBModel.keyPathStringFromIDBKeyPath(this.keyPath);
    }
}
//# sourceMappingURL=IndexedDBModel.js.map