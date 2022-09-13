let currentId = 1;
const objectIds = new Map();
const objects = new Map();

export function getIdByObject(object) {
  let id = objectIds.get(object);
  if (id) return id;

  // eslint-disable-next-line
  id = `${currentId++}`;
  objects.set(id, object);
  objectIds.set(object, id);
  return id;
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
  } catch (err) { /* empty */ }

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

export function getPreview(val, opts = {}) {
  const { length = 5 } = opts;
  // TODO: 这两种数据类型待处理
  // if (subtype === 'map' || subtype === 'set') {

  // }

  const keys = Object.keys(val);
  const properties = [];
  keys.slice(0, length).forEach((key) => {
    let subVal;
    try {
      subVal = val[key];
    } catch (err) { /* empty */ }

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
      } else {
        try {
          // try catch一下，防止访问window的constructor报跨域错误
          subVal = subVal.constructor?.name || 'Object';
        } catch (err) {
          subVal = 'Object';
        }
      }
    } else {
      subVal = subVal === undefined ? 'undefined' : subVal.toString();
    }
    properties.push({
      name: key,
      type,
      subtype,
      value: subVal,
    });
  });

  return {
    overflow: keys.length > length,
    properties,
  };
};

export function objectFormat(val, opts = {}) {
  if (val === undefined) return { type: 'undefined' };
  if (val === null) return { type: 'object', subtype: 'null', value: val };

  const { type, subtype } = getType(val);
  if (type === 'number') return { type, value: val, description: String(val) };
  if (type === 'string' || type === 'boolean') return { type, value: val };
  if (type === 'symbol') return { type, objectId: getIdByObject(val), description: String(val) };

  const res = { type, subtype, objectId: getIdByObject(val) };
  // 对部分不同的数据类型需要单独处理
  // function类型
  if (type === 'function') {
    res.className = 'Function';
    res.description = 'Function';
    opts.preview && (res.preview = {
      type,
      subtype,
      description: 'Function',
      ...getPreview(val),
    });
    // 数组类型
  } else if (subtype === 'array') {
    res.className = 'Array';
    res.description = `Array(${val.length})`;
    opts.preview && (res.preview = {
      type,
      subtype,
      description: `Array(${val.length})`,
      ...getPreview(val, { length: 100 }),
    });
    // Error类型
  } else if (subtype === 'error') {
    res.className = 'Error';
    res.description = val.stack;
    opts.preview && (res.preview = {
      type,
      subtype,
      description: val.stack,
      ...getPreview(val),
    });
    // html的Element
  } else if (subtype === 'node') {
    const ctorName = val.constructor?.name || 'Element';
    res.className = ctorName;
    res.description = ctorName;
  } else {
    let ctorName = 'Object';
    try {
      // try catch一下，防止访问window的constructor报跨域错误
      ctorName = val.constructor?.name || 'Object';
    } catch (err) { /* empty */ }
    res.className = ctorName;
    res.description = ctorName;
    opts.preview && (res.preview = {
      type,
      subtype,
      description: ctorName,
      ...getPreview(val),
    });
  }

  // TODO: 这两种数据类型待处理
  // if (subtype === 'map' || subtype === 'set') {

  // }

  return res;
}

export function exceptionFormat(text) {
  return {
    text: `Uncaught ${text}`,
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
    if (rawArg.value) {
      args.push(rawArg.value);
    } else if (rawArg.objectId) {
      args.push(getObjectById(rawArg.objectId));
    }
  }

  return callFunction.apply(thisObj, args);
}

// 获取对象属性，层级可以无限深
export function getObjectProperties(params) {
  // ownProperties标识是否为对象自身的属性
  const { objectId, accessorPropertiesOnly, ownProperties, generatePreview } = params;
  const curObject = objects.get(objectId);
  const ret = { result: [] };
  // eslint-disable-next-line no-proto
  const proto = curObject.__proto__;

  const keys = Object.getOwnPropertyNames(curObject)
    .concat(proto ? Object.getOwnPropertyNames(proto) : []);

  for (const key of keys) {
    let descriptor = Object.getOwnPropertyDescriptor(curObject, key);
    if (!descriptor && !ownProperties) descriptor = Object.getOwnPropertyDescriptor(proto, key);
    if (!descriptor || !descriptor.get && !descriptor.set && accessorPropertiesOnly) continue;

    const property = {
      name: key,
      isOwn: ownProperties,
      enumerable: descriptor.enumerable,
      configurable: descriptor.configurable,
    };

    if (descriptor.get) {
      property.get = objectFormat(descriptor.get, { preview: generatePreview });
    }
    if (descriptor.set) {
      property.set = objectFormat(descriptor.set, { preview: generatePreview });
    }
    if (!descriptor.get && !descriptor.set) {
      property.writable = descriptor.writable;
      property.value = objectFormat(descriptor.value, { preview: generatePreview });
    }

    ret.result.push(property);
  }

  // 追加__proto__原型
  if (ownProperties && proto) {
    ret.internalProperties = [{
      name: '[[Prototype]]',
      value: objectFormat(proto),
    }];
  }

  return ret;
}

// 释放对象
export function objectRelease({ objectId }) {
  const object = objects.get(objectId);
  objects.delete(objectId, object);
  objectIds.delete(object, objectId);
}

export function getObjectById(objectId) {
  return objects.get(objectId);
}
