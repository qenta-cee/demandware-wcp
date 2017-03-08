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
 * Standard view used to render most templates.
 * @module views/View
 */

var ISML = require('dw/template/ISML');

var Class = require('~/cartridge/scripts/util/Class').Class;
var object = require('~/cartridge/scripts/object');

/**
 * View class to pass parameters to the templates and renders the templates.
 * Other view modules extend this class.
 *
 * @class View
 * @extends module:util/Class~Class
 * @returns {module:views/View~View}
 */
var View = Class.extend({
    /** @lends module:views/View~View.prototype */

    /**
     * Base class for all view modules. See also {@tutorial Views}.
     * Loops through the parameters and passes them to the view.
     *
     * @constructs module:views/View~View
     * @extends module:util/Class~Class
     * @param {Object} params The parameters to pass.
     * @see {@link module:object} for information on the extend function.
     * @returns {module:views/View~View}
     */
    init: function (params) {
        // Copies all properties of params to the view.
        if (params) {
            object.extend(this, params);
        }

        return this;
    },

    /**
     * Renders the current view with the given template. This function gets all of the customer,
     * request, and session information that might be needed to render the template and passes it
     * to the template for rendering.
     *
     * @abstract
     * @alias module:views/View~View/render
     * @param {String} templateName - The path and name of the template to render.
     * The base of the path is assumed to be the templates/default folder in the cartridge, unless a locale is
     * selected, in which case it is templates <i>locale</i>. If the template is not found in the current cartridge,
     * the cartridge path is searched until a cartridge containing it is found.
     *
     * The name of the template is the file name without the file extension.
     * @example app.getView().render('account/accountoverview');
     * @return {module:views/View~View} Returns the current view.
     */
    render: function (templateName) {
        templateName = templateName || this.template; // eslint-disable-line no-param-reassign
        // provide reference to View itself
        this.View = this;
        // provide Meta
        this.Meta = require('~/cartridge/scripts/meta');

        try {
            ISML.renderTemplate(templateName, this);
        } catch (e) {
            dw.system.Logger.error('Error while rendering template ' + templateName);
            throw e;
        }
        return this;
    },
});

/** @type {module:views/View~View.prototype} */
module.exports = View;
