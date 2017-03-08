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
 * Controller which encapsulates all wirecard logic.
 *
 * @module controllers/COWirecard
 */
var Order = require('dw/order/Order');
var Site = require('dw/system/Site');
var Status = require('dw/system/Status');
var Transaction = require('dw/system/Transaction');
var Resource = require('dw/web/Resource');
var URLUtils = require('dw/web/URLUtils');

/* Script Modules */
var app = require('~/cartridge/scripts/app');
var guard = require('~/cartridge/scripts/guard');
var WirecardManager = require('~/cartridge/scripts/wirecard/manager/WirecardManager');
var WirecardLogger = require('~/cartridge/scripts/util/WirecardLogger');

var OrderModel = app.getSGModel('Order');

/**
 * This function checks if the Wirecard page was opened in an iFrame. If yes, the parameters will
 * be send to another template in the iFrame, and submitted again into the _top window. The same URL
 * as before is called then, and but an additional parameter ResponseIFrame is send with that to
 * ignore the logic in a second step.
 */
function checkForIFrameResponse() {
    if (Site.getCurrent().getCustomPreferenceValue('wirecardRedirectConfig').value === 'IFRAME' &&
            !request.httpParameterMap.ResponseIFrame.submitted) {
        return true;
    }
    return false;
}

/**
 * Collects and generates all parameters for the Wirecard post request.
 */
function redirect(args) {
    // Read input parameters
    var order = args.Order;
    var wirecardManager = new WirecardManager();

    app.getView({
        Order: order,
        WirecardUrl: Site.getCurrent().getCustomPreferenceValue('wirecardUrl'),
        WirecardParameters: wirecardManager.getWirecardCallParameters(order),
    }).render('wirecard/wirecardswitch');
}

/**
 * URL to show the wirecard template in an iframe.
 */
function showInIFrame() {
    var wirecardManager = new WirecardManager();
    var order = wirecardManager.getOrder();

    if (order) {
        app.getView({
            WirecardUrl: Site.getCurrent().getCustomPreferenceValue('wirecardUrl'),
            WirecardParameters: wirecardManager.getWirecardCallParameters(order),
        }).render('wirecard/wirecardforward');
    }
}

/**
 * Completes the asynchronous payment for the confirm and success url. After the storage of all payment parameters
 * is done, the SiteGenesis standard controller will be called to finish the order.
 */
function completePayment(wirecardResponseStatus, paymentMethodId, wirecardOrderNo) {
    var wirecardManager = new WirecardManager();
    var order = wirecardManager.getOrder();
    var orderPlacementStatus;
    var error = false;

    if (order && order.status.value === Order.ORDER_STATUS_CREATED) {
        if (wirecardManager.validateWirecardResponse(order)) {
            Transaction.begin();

            // Complete the payment
            wirecardManager.completePayment(order, order.getPaymentInstruments(paymentMethodId)[0], wirecardOrderNo);

            // Set the payment status
            wirecardManager.setPaymentStatus(order, wirecardResponseStatus);

            // Place the order
            orderPlacementStatus = OrderModel.submit(order);
            if (orderPlacementStatus.error) {
                error = true;
                Transaction.rollback();
            } else {
                Transaction.commit();
            }
        } else {
            request.custom.wirecardErrorMessage = Resource.msg('checkout.wirecard.error', 'wirecard', null);
            wirecardManager.resetOrder();
            error = true;
        }
    } else if (order && order.status.value === Order.ORDER_STATUS_FAILED) {
        error = true;
    }

    return {
        error: error,
        order: order,
    };
}

/**
 * The Confirm URL is passed, if the transaction was properly carried out.
 * The URL is called in the background with a 'server-to-server' request.
 * Payment states could be CANCEL, SUCCESS or FAILURE
 */
function confirm() {
    var paymentMethodId = request.httpParameterMap.DWRPaymentMethodId.value;
    var wirecardOrderNo = request.httpParameterMap.orderNumber.value;
    var paymentState = request.httpParameterMap.paymentState.value;
    var wirecardManager = new WirecardManager();
    var orderCompleteStatus;

    WirecardLogger.logWirecardReturn('confirm', request.httpParameterMap);

    if (paymentState === 'SUCCESS') {
        orderCompleteStatus = completePayment('confirm', paymentMethodId, wirecardOrderNo);

        wirecardManager.completePendingPayment(paymentMethodId, paymentState);

        if (!orderCompleteStatus.error) {
            app.getView({
                Order: orderCompleteStatus.order,
                Status: new Status(Status.OK),
                ReportOrder: true,
            }).render('wirecard/wirecardconfirm');
        } else {
            app.getView({
                Status: new Status(Status.ERROR, 'ERROR', 'The order could not be placed.'),
            }).render('wirecard/wirecardconfirm');
        }
    } else if (paymentState === 'FAILURE') {
        wirecardManager.completePendingPayment(paymentMethodId, paymentState);

        app.getView({
            Status: new Status(Status.OK),
            ReportOrder: false,
        }).render('wirecard/wirecardconfirm');
    } else if (paymentState === 'PENDING') {
        app.getView({
            Status: new Status(Status.OK),
            ReportOrder: false,
        }).render('wirecard/wirecardconfirm');
    } else {
        app.getView({
            Status: new Status(Status.ERROR, 'ERROR', 'Invalid payment state received: ' + paymentState),
        }).render('wirecard/wirecardconfirm');
    }
}

/**
 * The successURL is passed, if the transaction was properly carried out.
 */
function success() {
    var isIFrameResponse = checkForIFrameResponse();
    var orderCompleteStatus;
    var paymentMethodId = request.httpParameterMap.DWRPaymentMethodId.value;
    var wirecardOrderNo = request.httpParameterMap.orderNumber.value;

    if (isIFrameResponse) {
        app.getView({
            WirecardResponseURL: URLUtils.https('COWirecard-Success').toString(),
        }).render('wirecard/wirecardresponse');
    } else {
        WirecardLogger.logWirecardReturn('success', request.httpParameterMap);

        orderCompleteStatus = completePayment('success', paymentMethodId, wirecardOrderNo);

        if (orderCompleteStatus.error) {
            app.getSGController('COBilling').Start();
        } else {
            app.getSGController('COSummary').ShowConfirmation(orderCompleteStatus.order);
        }
    }
}

/**
 * The pendingURL is called when the payment is pending. We show complete the
 * order in this case as well, and show the order confirmation page.
 * Custom implementations need to decide if the order will be exported to a backend in this
 * case or how the orders are handled in this case.
 */
function pending() {
    var isIFrameResponse = checkForIFrameResponse();
    var orderCompleteStatus;
    var paymentMethodId = request.httpParameterMap.DWRPaymentMethodId.value;
    var wirecardOrderNo = request.httpParameterMap.orderNumber.value;

    if (isIFrameResponse) {
        app.getView({
            WirecardResponseURL: URLUtils.https('COWirecard-Pending').toString(),
        }).render('wirecard/wirecardresponse');
    } else {
        WirecardLogger.logWirecardReturn('pending', request.httpParameterMap);

        orderCompleteStatus = completePayment('pending', paymentMethodId, wirecardOrderNo);

        if (orderCompleteStatus.error) {
            app.getSGController('COBilling').Start();
        } else {
            app.getSGController('COSummary').ShowConfirmation(orderCompleteStatus.order);
        }
    }
}

/**
 * The Cancel URL is passed, if the transaction was canceled by the customer at Wirecard.
 * The order will be rolled back in this case.
 */
function cancel() {
    var isIFrameResponse = checkForIFrameResponse();
    var wirecardManager = new WirecardManager();

    if (isIFrameResponse) {
        app.getView({
            WirecardResponseURL: URLUtils.https('COWirecard-Cancel').toString(),
        }).render('wirecard/wirecardresponse');
    } else {
        WirecardLogger.logWirecardReturn('cancel', request.httpParameterMap);

        wirecardManager.resetOrder();

        request.custom.wirecardErrorMessage = Resource.msg('checkout.wirecard.cancel', 'wirecard', null);

        app.getSGController('COBilling').Start();
    }
}

/**
 * The FailureURL is passed, if the transaction failed at Wirecard.
 * The order will be rolled back in this case.
 */
function failure() {
    var isIFrameResponse = checkForIFrameResponse();
    var wirecardManager = new WirecardManager();

    if (isIFrameResponse) {
        app.getView({
            WirecardResponseURL: URLUtils.https('COWirecard-Failure').toString(),
        }).render('wirecard/wirecardresponse');
    } else {
        WirecardLogger.logWirecardReturn('failure', request.httpParameterMap);

        wirecardManager.resetOrder();

        request.custom.wirecardErrorMessage = Resource.msg('checkout.wirecard.failure', 'wirecard', null);

        app.getSGController('COBilling').Start();
    }
}

/**
 * The Service URL is a link behind the logo of the web shop. This link should be used to link
 * to a Service Page (Content Asset) to display more details about the payment methods. In the
 * standard plugin, the content asset 'payment' is called, but this could be changed easily
 * according to your needs.
 */
function service() {
    var isIFrameResponse = checkForIFrameResponse();
    var wirecardManager = new WirecardManager();

    if (isIFrameResponse) {
        app.getView({
            WirecardResponseURL: URLUtils.https('COWirecard-Service').toString(),
        }).render('wirecard/wirecardresponse');
    } else {
        WirecardLogger.logWirecardReturn('service', request.httpParameterMap);

        wirecardManager.resetOrder();

        app.getView({
            Location: URLUtils.https('Page-Show', 'cid', 'payment').toString(),
        }).render('util/redirectpermanent');
    }
}

exports.redirect = redirect;

/** URL to show the wirecard template in an iframe.
 * @see {@link module:controllers/COWirecard~showInIFrame} */
exports.ShowInIFrame = guard.ensure(['https'], showInIFrame);

/** The successURL is passed, if the transaction was properly carried out.
 * @see {@link module:controllers/COWirecard~success} */
exports.Success = guard.ensure(['https'], success);
/** The pendingURL is called when the payment is pending.
 * @see {@link module:controllers/COWirecard~pending} */
exports.Pending = guard.ensure(['https'], pending);

/** The Confirm URL is passed, if the transaction was properly carried out.
 * @see {@link module:controllers/COWirecard~confirm} */
exports.Confirm = guard.ensure(['https'], confirm);

/** The Cancel URL is passed, if the transaction was canceled by the customer at Wirecard.
 * The order will be rolled back in this case.
 * @see {@link module:controllers/COWirecard~cancel} */
exports.Cancel = guard.ensure(['https'], cancel);
/** The FailureURL is passed, if the transaction failed at Wirecard.
 * The order will be rolled back in this case.
 * @see {@link module:controllers/COWirecard~failure} */
exports.Failure = guard.ensure(['https'], failure);

/** Call for the Service URL.
 * @see {@link module:controllers/COWirecard~service} */
exports.Service = service;
