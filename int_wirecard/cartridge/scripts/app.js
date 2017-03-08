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
 * @module app
 */

/**
 * Returns the model for the given name. The model is expected under the models directory.
 */
exports.getModel = function (modelName) {
    return require('./models/' + modelName + 'Model');
};

/**
 * Returns the SiteGenesis model for the given name. The model is expected under the models directory.
 */
exports.getSGModel = function (modelName) {
    var storefrontCartridgeName = dw.web.Resource.msg('setting.storefront.controller.cartridge', 'wirecard', null);
    return require(storefrontCartridgeName + '/cartridge/scripts/models/' + modelName + 'Model');
};

/**
 * Returns a view for the given name. The view is expected under the views directory.
 * If no view exists with this name or if no view name is specified, a default view is returned instead.
 *
 * @param  {string} viewName   The name of the view
 * @param  {object} parameters The parameters to pass to the view
 * @return {object/View}       The view object instance
 *
 * @example
 * // use an anonymous view
 * require('~/app').getView().render('path/to/template');
 *
 * // or use a named view
 * var product = dw.catalog.ProductMgr.getProduct('123456');
 * require('~/app').getView('Product', {
 *     product : product,
 *     showRecommendations : false
 * }).render('path/to/template');
 */
exports.getView = function (viewName, parameters) {
    var View;
    try {
        if (typeof viewName === 'string') {
            View = require('./views/' + viewName + 'View');
        } else {
            // use first argument as parameters if not a string
            // to allow for anonymous views
            parameters = viewName; // eslint-disable-line no-param-reassign
            View = require('./views/View');
        }
    } catch (e) {
        View = require('./views/View');
    }
    return new View(parameters || {});
};

/**
 * Use this method to get a new instance for a given form reference or form object.
 *
 * @param formReference {dw.web.FormElement|String} Salesforce form id (/forms/$name$.xml) or Salesforce form object.
 * @returns {module:models/FormModel~FormModel}
 * @example
 * // simple form preparation
 * var form = require('~/app').getForm('registration');
 * form.clear();
 *
 * // handling the form submit
 * var form = require('~/app').getForm('registration');
 * form.handleAction({
 *     'register' : function(formGroup, action){
 *         // handle the action here
 *     },
 *     'error'    : function(){
 *         // handle form errors here
 *     }
 * });
 */
exports.getForm = function (formReference) {
    var formInstance;
    var FormModel;

    FormModel = require('~/cartridge/scripts/models/FormModel');
    formInstance = null;
    if (typeof formReference === 'string') {
        formInstance = require('~/cartridge/scripts/object').resolve(session.forms, formReference);
    } else if (typeof formReference === 'object') {
        formInstance = formReference;
    }

    return new FormModel(formInstance);
};

/**
 * Returns the controller with the given name.
 */
exports.getController = function (controllerName) {
    return require('~/cartridge/controllers/' + controllerName);
};

/**
 * Returns the SiteGenesis controller with the given name.
 */
exports.getSGController = function (controllerName) {
    var storefrontCartridgeName = dw.web.Resource.msg('setting.storefront.controller.cartridge', 'wirecard', null);
    return require(storefrontCartridgeName + '/cartridge/controllers/' + controllerName);
};
