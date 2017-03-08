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

var Class = require('~/cartridge/scripts/util/Class').Class;

var Logger = require('dw/system/Logger');

var logger = Logger.getLogger('wirecard', 'Wirecard.plugin');

var WirecardLogger = Class.extend({
});

WirecardLogger.logWirecardReturn = function (status, parameters) {
    var orderNo = parameters.get('DWROrderNo').value;
    var paymentType = parameters.get('paymentType').submitted ? parameters.get('paymentType').value : '';
    var paymentState = parameters.get('paymentState').submitted ? parameters.get('paymentState').value : '';
    var errorMsg;

    switch (status) {
    case 'success':
        WirecardLogger.logWarn('LogWirecardReturn.ds: SUCCESS - Wirecard payment was successful for Order: ' + orderNo
            + '; Payment Type: ' + paymentType + '; Payment State: ' + paymentState);
        break;
    case 'confirm':
        WirecardLogger.logWarn('LogWirecardReturn.ds: CONFIRM - Wirecard payment was confirmed for Order: ' + orderNo
            + '; Payment Type: ' + paymentType + '; Payment State: ' + paymentState);
        break;
    case 'failure':
        errorMsg = parameters.get('message').submitted ? parameters.get('message').value : '<no error message>';
        WirecardLogger.logWarn('LogWirecardReturn.ds: FAILURE - Wirecard reported a failure for Order: ' + orderNo
            + '; Wirecard Error Message: ' + errorMsg + '; Payment Type: ' + paymentType + '; Payment State: ' + paymentState);
        break;
    case 'cancel':
        WirecardLogger.logWarn('LogWirecardReturn.ds: CANCEL - Wirecard payment was canceled for Order: ' + orderNo
            + '; Payment Type: ' + paymentType + '; Payment State: ' + paymentState);
        break;
    case 'pending':
        WirecardLogger.logWarn('LogWirecardReturn.ds: PENDING - Wirecard payment is pending for Order: ' + orderNo
            + '; Payment Type: ' + paymentType + '; Payment State: ' + paymentState);
        break;
    case 'service':
        WirecardLogger.logWarn('LogWirecardReturn.ds: SERVICE - Returned with service URL from Wirecard - Order: ' + orderNo);
        break;
    default:
    }
};

WirecardLogger.logDebug = function (msg) {
    logger.debug(msg);
};

WirecardLogger.logWarn = function (msg) {
    logger.warn(msg);
};

WirecardLogger.logError = function (msg) {
    logger.error(msg);
};

WirecardLogger.logFatal = function (msg) {
    logger.fatal(msg);
};

module.exports = WirecardLogger;
