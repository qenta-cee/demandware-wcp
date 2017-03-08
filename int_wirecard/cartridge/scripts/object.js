/**
 * Shop System Plugins - Terms of use
 *
 * This terms of use regulates warranty and liability between Wirecard Central Eastern Europe
 * (subsequently referred to as WDCEE) and it's contractual partners partners
 * (subsequently referred to as customer or customers) which are related to the use of plugins
 * provided by WDCEE. The Plugin is provided provided by WDCEE free of charge for it's customers
 * and must be used for the purpose of WDCEE's payment platform platform integration only.
 * It explicitly is not part of the general contract between WDCEE and it's customer. The plugin
 * has successfully been tested under specific circumstances which are are defined as the shopsystem's
 * standard configuration (vendor's delivery state). The Customer is responsible for testing the plugin's
 * functionality before putting it into production environment. The customer uses the the plugin
 * at own risk. WDCEE does not guarantee it's full functionality neither does WDCEE assume liability
 * for any disadvantage related to the use use of this plugin.
 * By installing the plugin into the shopsystem the customer agrees to the terms of use.
 * Please do not use this plugin if you do not agree to the terms of use !
 */

'use strict';

/**
 * @module object
 */

/**
 * Deep copies all all object properties from source to target
 *
 * @param {Object} target The target object which should be extended
 * @param {Object} source The object for extension
 * @return {Object}
 */
exports.extend = function (target, source) {
    var _source; // eslint-disable-line no-underscore-dangle
    var i;
    var prop;

    if (!target) {
        return source;
    }

    for (i = 1; i < arguments.length; i++) {
        _source = arguments[i];
        /* eslint-disable guard-for-in,no-param-reassign */
        for (prop in _source) { // eslint-disable-line no-restricted-syntax
            // recurse for non-API objects
            if (_source[prop] && typeof _source[prop] === 'object' && !_source[prop].class) {
                target[prop] = this.extend(target[prop], _source[prop]);
            } else {
                target[prop] = _source[prop];
            }
        }
        /* eslint-enable guard-for-in,no-param-reassign */
    }

    return target;
};

/**
 * Access given properties of an object recursively
 *
 * @param {Object} object The object
 * @param {String} propertyString The property string, i.e. 'data.myValue.prop1'
 * @return {Object} The value of the given property or undefined
 * @example
 * var prop1 = require('~/object').resolve(obj, 'data.myValue.prop1')
 */
exports.resolve = function (object, propertyString) {
    var result = object;
    var propPath = propertyString.split('.');

    propPath.forEach(function (prop) {
        if (result && prop in result) {
            result = result[prop];
        } else {
            result = undefined;
        }
    });
    return result;
};

/**
 * Returns an array containing all object values
 *
 * @param {Object} object
 * @return {Array}
 */
exports.values = function (object) {
    return !object ? [] : Object.keys(object).map(function (key) {
        return object[key];
    });
};

/**
 * A shortcut for native static method "keys" of "Object" class
 *
 * @param {Object} object
 * @return {Array}
 */
exports.keys = function (object) {
    return object ? Object.keys(object) : [];
};

/**
 * Convert the given object to a HashMap object
 *
 * @param object {Object}
 * @return {dw.util.HashMap} all the data which will be used in mail template.
 */
exports.toHashMap = function (object) {
    var HashMap = require('dw/util/HashMap');
    var hashmap = new HashMap();
    var key;

    for (key in object) { // eslint-disable-line no-restricted-syntax
        if (object.hasOwnProperty(key)) { // eslint-disable-line no-prototype-builtins
            hashmap.put(key, object[key]);
        }
    }

    return hashmap;
};

/**
 * Convert the given Map to a plain object
 *
 * @param object {dw.util.Map}
 * @return {Object} all the data which will be used in mail template.
 */
exports.fromHashMap = function (map) {
    var object = {};
    var entry;

    /* eslint-disable guard-for-in */
    for (entry in map.entrySet()) { // eslint-disable-line no-restricted-syntax
        object[entry.key] = entry.value;
    }
    /* eslint-enable guard-for-in */

    return object;
};
