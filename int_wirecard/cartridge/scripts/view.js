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
 * @module view
 */

/**
 * Get the decorator templates which is typically the passed template but in case of an AJAX request it is
 * an empty decorator
 *
 * @param decoratorName {String} the name of the decorator template to use
 * @param  customValues {Array} Array of parameter values for 'format' which indicate an AJAX response
 * @return {String} The name of the decorator template to be used
 *
 * @example
 * <isdecorate template="${require('~/view').decorate('path/to/decorator')}">
 */
exports.decorate = function (decoratorName, customValues) {
    // get the value of the 'format' HTTP parameter
    var pageFormat = request.httpParameters.format && request.httpParameters.format.length
                         && request.httpParameters.format[0];

    // standard set of values that indicate an AJAX response.
    var noDecoration = ['ajax'];

    // if pageFormat is within the standard OR the custom set of values, use the blank decorator
    if (noDecoration.indexOf(pageFormat) > -1 || (customValues && customValues.indexOf(pageFormat) > -1)) {
        decoratorName = 'util/pt_empty'; // eslint-disable-line no-param-reassign
    }
    return decoratorName;
};
