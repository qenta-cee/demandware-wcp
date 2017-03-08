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

/* API Includes */
var Transaction = require('dw/system/Transaction');
var WirecardManager = require('~/cartridge/scripts/wirecard/manager/WirecardManager');
var app = require('~/cartridge/scripts/app');
var COWirecard = require('~/cartridge/controllers/COWirecard');

var Cart = app.getSGModel('Cart');

/**
 * The handle controller logic for Wirecard does nothing than creating the payment instrument,
 * because everything is handled externally.
 */
function Handle(args) {
    var cart = Cart.get(args.Basket);
    var wirecardManager = new WirecardManager();

    Transaction.wrap(function () {
        wirecardManager.removeExistingPaymentInstruments(args.Basket);
        cart.createPaymentInstrument('WIRECARD_CREDIT_CARD', cart.getNonGiftCertificateAmount());
    });

    return { success: true };
}

/**
 * The authorize controller logic for Wirecard just redirect to their servers.
 */
function Authorize(args) {
    COWirecard.redirect(args);

    return { authorized: true, redirected: true };
}

/**
 * The complete pipeline for Wirecard stores the necessary attributes to the payment transaction.
 */
function Complete(args) {
    var wirecardManager = new WirecardManager();
    wirecardManager.setPaymentParameters(args.Order, args.PaymentInstrument, args.WirecardOrderNo);
}

/*
 * Module exports
 */
exports.Handle = Handle;
exports.Authorize = Authorize;
exports.Complete = Complete;
