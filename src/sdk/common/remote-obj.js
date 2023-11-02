let currentId = 1;
const objectIds = new Map();
const objects = new Map();
const objectGroups = new Map();
const funcToString = Function.prototype.toString;

export function getIdByObject(object, opts = {}) {
  let id = objectIds.get(object);
  if (id) return id;

  // eslint-disable-next-line
  id = `${currentId++}`;
  objects.set(id, object);
  objectIds.set(object, id);
  if (opts.group) {
    const group = objectGroups.get(opts.group) || [];
    objectGroups.set(opts.group, group.concat(id));
  }
  return id;
}

export function getObjectById(objectId) {
  return objects.get(objectId);
}

export function getRealType(val) {
  const reg = /\[object\s+(.*)\]/;
  const res = reg.exec(Object.prototype.toString.call(val));
  return res ? res[1] : '';
}

export function getSubType(val) {
  // DOM节点类型
  try {
    if (val && [1, 8, 9].includes(val.nodeType)) return 'node';
  } catch { /* empty */ }

  const realType = getRealType(val).toLowerCase();
  return [
    'array', 'null', 'regexp', 'date', 'map', 'set', 'weakmap', 'weakset',
    'error', 'proxy', 'promise', 'arraybuffer', 'iterator', 'generator',
  ].includes(realType) ? realType : '';
}

export function getType(val) {
  return {
    type: typeof val,
    subtype: getSubType(val),
  };
}

export function getPropertyNames(obj) {
  let depth = 10; // 只找10层，避免循环引用
  let keys = Object.getOwnPropertyNames(obj).filter(k => !k.startsWith('$$$_sb_'));
  while (depth-- && obj.__proto__) {
    obj = obj.__proto__;
    keys = keys.concat(Object.getOwnPropertyNames(obj).filter(k => !keys.includes(k) && !k.startsWith('$$$_sb_')));
  }
  return keys;
}

export function getPropertyDescriptor(obj, key) {
  let depth = 10; // 只找10层，避免循环引用
  let dptor = Object.getOwnPropertyDescriptor(obj, key);
  while (depth-- && !dptor && obj.__proto__) {
    obj = obj.__proto__;
    dptor = Object.getOwnPropertyDescriptor(obj, key);
  }
  return dptor;
}

export function getPreviewProp(key, subVal) {
  const { type, subtype } = getType(subVal);
  if (type === 'object') {
    if (subtype === 'array') {
      subVal = `Array(${subVal.length})`;
    } else if (subtype === 'null') {
      subVal = 'null';
    } else if (['date', 'regexp'].includes(subtype)) {
      subVal = subVal.toString();
    } else if (subtype === 'node') {
      subVal = `#${subVal.nodeName}`;
    } else if (subVal instanceof Set) {
      subVal = `Set(${subVal.size})`
    } else if (subVal instanceof Map) {
      subVal = `Map(${subVal.size})`
    } else {
      let ctor;
      try {
        // try catch一下，防止访问window的constructor报跨域错误
        ctor = subVal.constructor?.name || 'Object';
      } catch { /* empty */ }
      subVal = ctor || 'Object';
    }
  } else {
    subVal = subVal === undefined ? 'undefined' : subVal.toString();
  }
  return {
    name: key,
    type,
    subtype,
    value: subVal,
  };
}

export function getPreview(val, opts = {}) {
  const { length = 5, pstate, presult } = opts;
  const res = { overflow: false, properties: [] };

  if (pstate) {
    res.properties.push(getPreviewProp('[[PromiseState]]', pstate));
    res.properties.push(getPreviewProp('[[PromiseResult]]', presult));
  } else {
    const keys = getPropertyNames(val).filter((key) => {
      const ownDptor = Object.getOwnPropertyDescriptor(val, key);
      if (ownDptor) {
        return ownDptor.enumerable;
      }
      const protoDptor = getPropertyDescriptor(val.__proto__, key);
      if (protoDptor?.get) {
        return protoDptor.enumerable;
      }
      return false;
    });
    res.overflow = keys.length > length;
    keys.slice(0, length).forEach((key) => {
      let subVal;
      try {
        subVal = val[key];
      } catch { /* empty */ }
      res.properties.push(getPreviewProp(key, subVal));
    });

    let count = 0;
    const entries = [];
    if (val instanceof Set) {
      for (const subVal of val.values()) {
        if (++count > length) {
          break;
        }
        entries.push({
          value: objectFormat(subVal),
        });
      }
    } else if (val instanceof Map) {
      for (const subVal of val.entries()) {
        if (++count > length) {
          break;
        }
        entries.push({
          key: objectFormat(subVal[0]),
          value: objectFormat(subVal[1]),
        });
      }
    }
    if (entries.length) {
      res.entries = entries;
      if (count > length) {
        res.overflow = true;
      }
    }
  }

  return res;
}

export function objectFormat(val, opts = {}) {
  if (val === undefined) return { type: 'undefined' };
  if (val === null) return { type: 'object', subtype: 'null', value: val };

  const { type, subtype: valSubtype } = getType(val);
  let subtype = valSubtype;
  try {
    // try catch一下，防止访问window的属性报跨域错误
    subtype = val.$$$_sb_subtype || valSubtype;
  } catch { /* empty */ }
  if (type === 'string' || type === 'boolean' || opts.value) return { type, value: val };
  if (type === 'number') return { type, value: val, description: String(val) };
  if (type === 'symbol') return { type, objectId: getIdByObject(val, opts), description: String(val) };

  const res = { type, subtype, objectId: getIdByObject(val, opts) };
  // 对部分不同的数据类型需要单独处理
  if (type === 'function') {
    // function类型
    let description = 'Function';
    try {
      description = funcToString.call(val);
    } catch { /* empty */ }
    res.className = 'Function';
    res.description = description;
    opts.preview && (res.preview = {
      type,
      subtype,
      description: 'Function',
      ...getPreview(val),
    });
  } else if (subtype === 'array') {
    // 数组类型
    res.className = 'Array';
    res.description = `Array(${val.length})`;
    opts.preview && (res.preview = {
      type,
      subtype,
      description: `Array(${val.length})`,
      ...getPreview(val, { length: 100 }),
    });
  } else if (subtype === 'error') {
    // Error类型
    res.className = 'Error';
    res.description = val.stack;
    opts.preview && (res.preview = {
      type,
      subtype,
      description: val.stack,
      ...getPreview(val),
    });
  } else if (subtype === 'node') {
    // html的元素
    const ctorName = val.constructor?.name || 'Element';
    res.className = ctorName;
    res.description = val.tagName?.toLowerCase?.() || ctorName;
  } else if (subtype === 'internal#entry') {
    // 内部entry元素，用于展示map的元素
    const description = `${objectFormat(val.key).description} => ${objectFormat(val.value).description}`;
    res.className = 'Object';
    res.description = description;
    opts.preview && (res.preview = {
      type,
      subtype,
      description,
      ...getPreview(val),
    });
  } else if (val instanceof Set) {
    // 集合类型
    res.className = 'Set';
    res.description = `Set(${val.size})`;
    opts.preview && (res.preview = {
      type,
      subtype,
      description: `Set(${val.size})`,
      ...getPreview(val),
    });
  } else if (val instanceof Map) {
    // 映射类型
    res.className = 'Map';
    res.description = `Map(${val.size})`;
    opts.preview && (res.preview = {
      type,
      subtype,
      description: `Map(${val.size})`,
      ...getPreview(val),
    });
  } else if (val instanceof Promise) {
    res.className = 'Promise';
    res.description = 'Promise';
    opts.preview && (res.preview = {
      type,
      subtype,
      description: 'Promise',
      ...getPreview(val, opts),
    });
  } else {
    let ctorName = 'Object';
    try {
      // try catch一下，防止访问window的constructor报跨域错误
      ctorName = val.constructor?.name || 'Object';
    } catch { /* empty */ }
    res.className = ctorName;
    res.description = ctorName;
    opts.preview && (res.preview = {
      type,
      subtype,
      description: ctorName,
      ...getPreview(val),
    });
  }

  return res;
}

export function exceptionFormat(err) {
  return {
    text: `Uncaught ${err.toString()}`,
    exception: objectFormat(err),
    exceptionId: 999,
    lineNumber: 0,
    columnNumber: 0,
  };
}

export function callOnObject(params) {
  const { objectId, callFunction, callArguments } = params;
  const thisObj = getObjectById(objectId);
  const args = [];
  for (let i = 0; i < callArguments.length; i++) {
    const rawArg = callArguments[i];
    if ('value' in rawArg) {
      args.push(rawArg.value);
    } else if ('objectId' in rawArg) {
      args.push(getObjectById(rawArg.objectId));
    }
  }

  return callFunction.apply(thisObj, args);
}

// 获取对象属性，层级可以无限深
export function getObjectProperties(params, opts = {}) {
  // ownProperties标识是否为对象自身的属性
  const { objectId, accessorPropertiesOnly, ownProperties, generatePreview, nonIndexedPropertiesOnly } = params;
  const curObject = getObjectById(objectId) || {};
  const keys = getPropertyNames(curObject);
  const ret = { result: [] };

  for (const key of keys) {
    let descriptor = Object.getOwnPropertyDescriptor(curObject, key);
    const isOwn = !!descriptor;
    if (!descriptor && !ownProperties) descriptor = getPropertyDescriptor(curObject.__proto__, key);
    if (!descriptor || !descriptor.get && !descriptor.set && accessorPropertiesOnly) continue;
    if (nonIndexedPropertiesOnly && /^\d+$/.test(key)) continue;

    const property = {
      name: key,
      isOwn,
      enumerable: descriptor.enumerable,
      configurable: descriptor.configurable,
    };

    if (!descriptor.get && !descriptor.set) {
      property.writable = descriptor.writable;
      property.value = objectFormat(descriptor.value, { preview: generatePreview });
    } else {
      if (descriptor.get) {
        try {
          property.value = objectFormat(descriptor.get.call(curObject), { preview: generatePreview });
          property.writable = false;
        } catch { /* empty */ }
      }
      if (!property.value) {
        property.get = objectFormat(descriptor.get, { preview: generatePreview });
        property.set = objectFormat(descriptor.set, { preview: generatePreview });
      }
    }

    ret.result.push(property);
  }

  // 追加内部对象
  if (ownProperties && !nonIndexedPropertiesOnly) {
    ret.internalProperties = [];
    if (curObject.__proto__) {
      ret.internalProperties.push({
        name: '[[Prototype]]',
        value: objectFormat(curObject.__proto__),
      });
    }
    if (curObject instanceof Set) {
      const entries = Object.create(null);
      let count = 0;
      curObject.forEach((value) => {
        entries[count++] = value;
      });
      ret.internalProperties.push({
        name: '[[Entries]]',
        value: objectFormat(entries),
      });
    } else if (curObject instanceof Map) {
      const entries = Object.create(null);
      let count = 0;
      curObject.forEach((value, key) => {
        const entry = Object.create(null);
        entry.$$$_sb_subtype = 'internal#entry'
        entry.key = key;
        entry.value = value;
        entries[count++] = entry;
      });
      ret.internalProperties.push({
        name: '[[Entries]]',
        value: objectFormat(entries),
      });
    } else if (curObject instanceof Promise) {
      ret.internalProperties.push({
        name: '[[PromiseState]]',
        value: objectFormat(opts.pstate || 'pending'),
      });
      ret.internalProperties.push({
        name: '[[PromiseResult]]',
        value: objectFormat(opts.presult || undefined),
      });
    }
  }

  return ret;
}

// 释放对象
export function objectRelease({ objectId }) {
  const object = getObjectById(objectId);
  objects.delete(objectId, object);
  objectIds.delete(object, objectId);
}

// 释放对象组
export function objectGroupRelease({ objectGroup }) {
  const group = objectGroups.get(objectGroup);
  if (group?.length) {
    group.forEach((objectId) => objectRelease({ objectId }));
    objectGroups.delete(objectGroup);
  }
}
