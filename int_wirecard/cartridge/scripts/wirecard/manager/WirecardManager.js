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
 * Implements the Manager helper and business logic functions used in the controller.
 *
 * @module wirecard/manager/WirecardManager
 */

/* API Includes */
var Class = require('~/cartridge/scripts/util/Class').Class;
var WirecardLogger = require('~/cartridge/scripts/util/WirecardLogger');

var Encoding = require('dw/crypto/Encoding');
var Mac = require('dw/crypto/Mac');
var BasketMgr = require('dw/order/BasketMgr');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var PaymentMgr = require('dw/order/PaymentMgr');
var OrderMgr = require('dw/order/OrderMgr');
var HookMgr = require('dw/system/HookMgr');
var Site = require('dw/system/Site');
var Transaction = require('dw/system/Transaction');
var Locale = require('dw/util/Locale');
var SortedMap = require('dw/util/SortedMap');
var StringUtils = require('dw/util/StringUtils');
var CSRFProtection = require('dw/web/CSRFProtection');
var Resource = require('dw/web/Resource');
var URLUtils = require('dw/web/URLUtils');

var WirecardManager = Class.extend({

    /**
     * Gets the order using the originally passed and now returned DWROrderNo.
     *
     * @returns dw.order.Order or null
     */
    getOrder: function () {
        var orderNo = request.httpParameterMap.DWROrderNo.value;
        var email = request.httpParameterMap.DWREmail.stringValue;
        var postalCode = request.httpParameterMap.DWRPostalCode.stringValue;

        var order = OrderMgr.getOrder(orderNo);

        if (order && order.customerEmail === email && order.billingAddress.postalCode === postalCode) {
            return order;
        }
        return null;
    },

    /**
     * Gets the non-giftcertificate payment method for the basket, which is used as the main
     * payment method send to Wirecard.
     *
     * @returns dw.order.PaymentMethod
     */
    getNonGCPaymentMethod: function (paymentInstruments) {
        var paymentInstrument;
        var i;
        for (i = 0; i < paymentInstruments.size(); i++) {
            paymentInstrument = paymentInstruments[i];
            if (paymentInstrument.paymentMethod !== PaymentInstrument.METHOD_GIFT_CERTIFICATE) {
                return PaymentMgr.getPaymentMethod(paymentInstrument.paymentMethod);
            }
        }
    },

    /**
     * Determines if the basket already contains payment
     * instruments which are no gift certificates and removes them from the basket.
     */
    removeExistingPaymentInstruments: function (lineItemCtnr) {
        // get all payment instruments
        var paymentInstrs = lineItemCtnr.getPaymentInstruments();
        var iter = paymentInstrs.iterator();
        var existingPI;

        // remove them
        while (iter.hasNext()) {
            existingPI = iter.next();
            if (existingPI.paymentMethod !== PaymentInstrument.METHOD_GIFT_CERTIFICATE) {
                lineItemCtnr.removePaymentInstrument(existingPI);
            }
        }
    },

    /**
     * This function collects all necessary parameters to be submitted to Wirecard.
     *
     * @returns dw.util.SortedMap - the parameters
     */
    getWirecardCallParameters: function (order) {
        var params = new SortedMap();

        // Get all site preferences / parameters
        var secret = Site.current.getCustomPreferenceValue('wirecardSecretString');
        var customerId = Site.getCurrent().getCustomPreferenceValue('wirecardCustomerId');
        var shopID = !empty(Site.getCurrent().getCustomPreferenceValue('wirecardShopId')) ?
                         Site.current.getCustomPreferenceValue('wirecardShopId') : '';

        // Basic Payment Information
        var orderNo = order.orderNo;
        var timestamp = StringUtils.formatCalendar(Site.getCalendar(), 'yyyyMMDDHHmmssSSS');
        var amount = order.totalGrossPrice.value.toFixed(2);
        var currency = session.currency.currencyCode;
        var paymentInstruments = order.getPaymentInstruments();
        var paymentMethod = this.getNonGCPaymentMethod(paymentInstruments);
        var paymenttype = paymentMethod.custom.wirecardPaymentType.value;

        var language;
        var locale = request.getLocale();

        // All URLs
        var successURL = URLUtils.https(Site.getCurrent().getCustomPreferenceValue('wirecardSuccessUrl'))
                                    .append(CSRFProtection.getTokenName(), CSRFProtection.generateToken()).toString();
        var cancelURL = URLUtils.https(Site.getCurrent().getCustomPreferenceValue('wirecardCancelUrl')).toString();
        var failureURL = URLUtils.https(Site.getCurrent().getCustomPreferenceValue('wirecardFailureUrl')).toString();
        var pendingURL = URLUtils.https(Site.getCurrent().getCustomPreferenceValue('wirecardPendingUrl')).toString();
        var confirmURL = URLUtils.https(Site.getCurrent().getCustomPreferenceValue('wirecardConfirmUrl')).toString();
        var serviceURL = URLUtils.https(Site.getCurrent().getCustomPreferenceValue('wirecardServiceUrl')).toString();

        // Display Texts
        var displayText = Resource.msgf(Site.getCurrent().getCustomPreferenceValue('wirecardDisplayText'), 'wirecard', '', orderNo);
        var customerStatement = Resource.msgf(Site.getCurrent().getCustomPreferenceValue('wirecardCustomerStatement'), 'wirecard', '', orderNo);
        var orderDescription = Resource.msgf(Site.getCurrent().getCustomPreferenceValue('wirecardOrderDescription'), 'wirecard', '', orderNo,
                                    order.billingAddress.firstName, order.billingAddress.lastName);

        // Other Control Parameters
        var duplicateRequestCheck = Site.getCurrent().getCustomPreferenceValue('wirecardDuplicateRequestCheck') ? 'yes' : '';
        var trimResponseParameters = Site.getCurrent().getCustomPreferenceValue('wirecardTrimResponseParameters') ? 'yes' : '';

        var autoDeposit = paymentMethod.custom.wirecardAutoDeposit ? 'yes' : '';
        var maxRetries = empty(paymentMethod.custom.wirecardMaxRetries) ? '-1' : paymentMethod.custom.wirecardMaxRetries.toFixed(0);

        var orderNumber = (Site.getCurrent().getCustomPreferenceValue('wirecardOrderNumber') && maxRetries === '0') ? orderNo : '';

        // Shipping Address Information
        var address = order.defaultShipment.shippingAddress;
        var shipFirstName = address.firstName;
        var shipLastName = address.lastName;
        var shipAddress1 = address.address1;
        var shipAddress2 = address.address2;
        var shipCity = address.city;
        var shipPostCode = address.postalCode;
        var shipCountry = address.countryCode.value;
        var shipPhoneNo = address.phone;

        // Billing Address Information
        var billingAddress = order.defaultShipment.shippingAddress;
        var billFirstName = billingAddress.firstName;
        var billLastName = billingAddress.lastName;
        var billAddress1 = billingAddress.address1;
        var billAddress2 = billingAddress.address2;
        var billCity = billingAddress.city;
        var billPostCode = billingAddress.postalCode;
        var billCountry = billingAddress.countryCode.value;
        var billPhoneNo = billingAddress.phone;

        // Plugin Information
        var shopName = Site.getCurrent().getCustomPreferenceValue('wirecardShopName');
        var shopVersion = Site.getCurrent().getCustomPreferenceValue('wirecardShopVersion');
        var pluginName = Site.getCurrent().getCustomPreferenceValue('wirecardPluginName');
        var pluginVersion = Site.getCurrent().getCustomPreferenceValue('wirecardPluginVersion');
        var pluginVersionBase64 = StringUtils.encodeBase64(shopName + ';' + shopVersion + ';;' + pluginName + ';' + pluginVersion);

        // Custom Parameters
        var dwrOrderNo = orderNo;
        var dwrPaymentMethodId = paymentMethod.ID;
        var dwrEmail = order.customerEmail;
        var dwrPostalCode = order.billingAddress.postalCode;

        var requestFingerprintOrder;
        var fingerprintSeed;
        var requestFingerprint;
        var mac = Mac(Mac.HMAC_SHA_512);

        if (locale === 'default') {
            language = 'en';
        } else {
            language = Locale.getLocale(locale).getLanguage();
        }

        // Generate the fingerprint
        requestFingerprintOrder = 'secret,shopId,orderReference,customerStatement,customerId,amount,currency,language,orderDescription,'
                                  + 'displayText,successURL,confirmURL,duplicateRequestCheck,trimResponseParameters,autoDeposit,maxRetries'
                                  + ',timestamp,DWROrderNo,DWRPaymentMethodId,DWREmail,DWRPostalCode';
        fingerprintSeed = secret + shopID + orderNo + customerStatement + customerId + amount + currency + language + orderDescription
                          + displayText + successURL + confirmURL + duplicateRequestCheck + trimResponseParameters + autoDeposit
                          + maxRetries + timestamp + dwrOrderNo + dwrPaymentMethodId + dwrEmail + dwrPostalCode;

        // Add optional parameters to fingerprint
        if (!empty(orderNumber)) {
            requestFingerprintOrder += ',orderNumber';
            fingerprintSeed += orderNumber;
        }

        WirecardLogger.logWarn('WirecardManager.getWirecardCallParameters: Prepare Wirecard call parameters for Order ' + order.orderNo
                               + '; Payment Type: ' + paymenttype);

        // Add shipping address parameters to fingerprint
        if (paymentMethod.custom.wirecardSubmitShippingData) {
            requestFingerprintOrder += ',consumerShippingFirstname,consumerShippingLastname,consumerShippingAddress1,consumerShippingCity,'
                                       + 'consumerShippingCountry,consumerShippingZipCode';
            fingerprintSeed += shipFirstName + shipLastName + shipAddress1 + shipCity + shipCountry + shipPostCode;

            if (!empty(shipAddress2)) {
                requestFingerprintOrder += ',consumerShippingAddress2';
                fingerprintSeed += shipAddress2;
            }

            if (!empty(shipPhoneNo)) {
                requestFingerprintOrder += ',consumerShippingPhone';
                fingerprintSeed += shipPhoneNo;
            }
        }

        // Add billing address parameters to fingerprint
        if (paymentMethod.custom.wirecardSubmitBillingData) {
            requestFingerprintOrder += ',consumerBillingFirstname,consumerBillingLastname,consumerBillingAddress1,consumerBillingCity,'
                                       + 'consumerBillingCountry,consumerBillingZipCode';
            fingerprintSeed += billFirstName + billLastName + billAddress1 + billCity + billCountry + billPostCode;

            if (!empty(billAddress2)) {
                requestFingerprintOrder += ',consumerBillingAddress2';
                fingerprintSeed += billAddress2;
            }

            if (!empty(billPhoneNo)) {
                requestFingerprintOrder += ',consumerBillingPhone';
                fingerprintSeed += billPhoneNo;
            }
        }

        // Adding basket parameters to fingerprint
        let counter = 0;
        for (let i = 0; i < order.productLineItems.size(); i++) {
            let pli = order.productLineItems[i];
            counter += 1;

            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'ArticleNumber';
            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'Quantity';
            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'Name';
            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'UnitGrossAmount';
            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'UnitNetAmount';
            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'UnitTaxAmount';
            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'UnitTaxRate';

            fingerprintSeed += pli.productID;
            fingerprintSeed += pli.quantity.value.toFixed();
            fingerprintSeed += pli.lineItemText;
            fingerprintSeed += pli.adjustedGrossPrice.value.toFixed(2);
            fingerprintSeed += pli.adjustedNetPrice.value.toFixed(2);
            fingerprintSeed += pli.adjustedTax.value.toFixed(2);
            fingerprintSeed += Number(pli.taxRate * 100).toFixed(3);
        }

        for (let i = 0; i < order.giftCertificateLineItems.size(); i++) {
            let gcli = order.giftCertificateLineItems[i];
            counter += 1;

            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'ArticleNumber';
            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'Quantity';
            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'Name';
            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'UnitGrossAmount';
            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'UnitNetAmount';
            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'UnitTaxAmount';
            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'UnitTaxRate';

            fingerprintSeed += gcli.UUID;
            fingerprintSeed += '1';
            fingerprintSeed += gcli.lineItemText;
            fingerprintSeed += gcli.grossPrice.value.toFixed(2);
            fingerprintSeed += gcli.netPrice.value.toFixed(2);
            fingerprintSeed += gcli.tax.value.toFixed(2);
            fingerprintSeed += Number(gcli.taxRate * 100).toFixed(3);
        }

        if (order.adjustedShippingTotalGrossPrice.value > 0) {
            counter += 1;

            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'ArticleNumber';
            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'Quantity';
            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'Name';
            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'UnitGrossAmount';
            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'UnitNetAmount';
            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'UnitTaxAmount';
            requestFingerprintOrder += ',basketItem' + counter.toFixed() + 'UnitTaxRate';

            let sli = order.defaultShipment.shippingLineItems[0];
            fingerprintSeed += sli.ID;
            fingerprintSeed += '1';
            fingerprintSeed += sli.lineItemText;
            fingerprintSeed += order.adjustedShippingTotalGrossPrice.value.toFixed(2);
            fingerprintSeed += order.adjustedShippingTotalNetPrice.value.toFixed(2);
            fingerprintSeed += order.adjustedShippingTotalTax.value.toFixed(2);
            fingerprintSeed += Number(sli.taxRate * 100).toFixed(3);
        }

        requestFingerprintOrder += ',basketItems';
        fingerprintSeed += counter.toFixed();

        // Complete fingerprint
        requestFingerprintOrder += ',requestFingerprintOrder';
        fingerprintSeed += requestFingerprintOrder;

        // Encode the fingerprint
        requestFingerprint = Encoding.toHex(mac.digest(fingerprintSeed, secret));

        // Generate the map with all necessary Wirecard parameters
        params.put('customerId', customerId);
        params.put('shopId', shopID);
        params.put('amount', amount);
        params.put('currency', currency);
        params.put('language', language);
        params.put('successURL', successURL);
        params.put('cancelURL', cancelURL);
        params.put('failureURL', failureURL);
        params.put('pendingURL', pendingURL);
        params.put('confirmURL', confirmURL);
        params.put('serviceURL', serviceURL);
        params.put('paymenttype', paymenttype);
        params.put('timestamp', timestamp);

        params.put('requestFingerprintOrder', requestFingerprintOrder);
        params.put('requestFingerprint', requestFingerprint);

        params.put('orderReference', orderNo);
        params.put('orderDescription', orderDescription);
        params.put('displayText', displayText);
        params.put('customerStatement', customerStatement);

        params.put('duplicateRequestCheck', duplicateRequestCheck);
        params.put('trimResponseParameters', trimResponseParameters);
        params.put('autoDeposit', autoDeposit);
        params.put('maxRetries', maxRetries);

        if (!empty(orderNumber)) {
            params.put('orderNumber', orderNumber);
        }

        if (paymentMethod.custom.wirecardSubmitShippingData) {
            params.put('consumerShippingFirstname', shipFirstName);
            params.put('consumerShippingLastname', shipLastName);
            params.put('consumerShippingAddress1', shipAddress1);
            params.put('consumerShippingCity', shipCity);
            params.put('consumerShippingCountry', shipCountry);
            params.put('consumerShippingZipCode', shipPostCode);

            if (!empty(shipAddress2)) {
                params.put('consumerShippingAddress2', shipAddress2);
            }
            if (!empty(shipPhoneNo)) {
                params.put('consumerShippingPhone', shipPhoneNo);
            }
        }

        if (paymentMethod.custom.wirecardSubmitBillingData) {
            params.put('consumerBillingFirstname', billFirstName);
            params.put('consumerBillingLastname', billLastName);
            params.put('consumerBillingAddress1', billAddress1);
            params.put('consumerBillingCity', billCity);
            params.put('consumerBillingCountry', billCountry);
            params.put('consumerBillingZipCode', billPostCode);

            if (!empty(billAddress2)) {
                params.put('consumerBillingAddress2', billAddress2);
            }
            if (!empty(billPhoneNo)) {
                params.put('consumerBillingPhone', billPhoneNo);
            }
        }

        counter = 0;
        for (let i = 0; i < order.productLineItems.size(); i++) {
            let pli = order.productLineItems[i];
            counter += 1;

            params.put('basketItem' + counter.toFixed() + 'ArticleNumber', pli.productID);
            params.put('basketItem' + counter.toFixed() + 'Quantity', pli.quantity.value.toFixed());
            params.put('basketItem' + counter.toFixed() + 'Name', pli.lineItemText);
            params.put('basketItem' + counter.toFixed() + 'UnitGrossAmount', pli.adjustedGrossPrice.value.toFixed(2));
            params.put('basketItem' + counter.toFixed() + 'UnitNetAmount', pli.adjustedNetPrice.value.toFixed(2));
            params.put('basketItem' + counter.toFixed() + 'UnitTaxAmount', pli.adjustedTax.value.toFixed(2));
            params.put('basketItem' + counter.toFixed() + 'UnitTaxRate', Number(pli.taxRate * 100).toFixed(3));
        }

        for (let i = 0; i < order.giftCertificateLineItems.size(); i++) {
            let gcli = order.giftCertificateLineItems[i];
            counter += 1;

            params.put('basketItem' + counter.toFixed() + 'ArticleNumber', gcli.UUID);
            params.put('basketItem' + counter.toFixed() + 'Quantity', '1');
            params.put('basketItem' + counter.toFixed() + 'Name', gcli.lineItemText);
            params.put('basketItem' + counter.toFixed() + 'UnitGrossAmount', gcli.grossPrice.value.toFixed(2));
            params.put('basketItem' + counter.toFixed() + 'UnitNetAmount', gcli.netPrice.value.toFixed(2));
            params.put('basketItem' + counter.toFixed() + 'UnitTaxAmount', gcli.tax.value.toFixed(2));
            params.put('basketItem' + counter.toFixed() + 'UnitTaxRate', Number(gcli.taxRate * 100).toFixed(3));
        }

        if (order.adjustedShippingTotalGrossPrice.value > 0) {
            let sli = order.defaultShipment.shippingLineItems[0];
            counter += 1;

            params.put('basketItem' + counter.toFixed() + 'ArticleNumber', sli.ID);
            params.put('basketItem' + counter.toFixed() + 'Quantity', '1');
            params.put('basketItem' + counter.toFixed() + 'Name', sli.lineItemText);
            params.put('basketItem' + counter.toFixed() + 'UnitGrossAmount', order.adjustedShippingTotalGrossPrice.value.toFixed(2));
            params.put('basketItem' + counter.toFixed() + 'UnitNetAmount', order.adjustedShippingTotalNetPrice.value.toFixed(2));
            params.put('basketItem' + counter.toFixed() + 'UnitTaxAmount', order.adjustedShippingTotalTax.value.toFixed(2));
            params.put('basketItem' + counter.toFixed() + 'UnitTaxRate', Number(sli.taxRate * 100).toFixed(3));
        }
        params.put('basketItems', counter.toFixed());

        params.put('DWROrderNo', dwrOrderNo);
        params.put('DWRPaymentMethodId', dwrPaymentMethodId);
        params.put('DWREmail', dwrEmail);
        params.put('DWRPostalCode', dwrPostalCode);
        params.put('pluginVersion', pluginVersionBase64);

        return params;
    },

    /**
     * Calls the processor script as Hook to complete the payment and set all necessary attributes.
     */
    completePayment: function (order, paymentInstrument, wirecardOrderNo) {
        var processor = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor();
        if (HookMgr.hasHook('app.payment.processor.' + processor.ID)) {
            return HookMgr.callHook('app.payment.processor.' + processor.ID, 'Complete', {
                Order: order,
                OrderNo: order.getOrderNo(),
                WirecardOrderNo: wirecardOrderNo,
                PaymentInstrument: paymentInstrument,
            });
        }
    },

    /**
     * Validates the parameters and fingerprint returned by Wirecard in order to prevent fraud.
     */
    validateWirecardResponse: function (order) {
        var fingerprintSeed = '';
        var parameters = request.httpParameterMap;
        var fingerprintOrder = parameters.responseFingerprintOrder.value;
        var fingerprint = parameters.responseFingerprint.value;
        var wirecardAmount = parameters.amount.value;
        var wirecardAmountStr = new Number(wirecardAmount).toFixed(2);  // eslint-disable-line no-new-wrappers
        var secret = Site.getCurrent().getCustomPreferenceValue('wirecardSecretString');
        var mac = Mac(Mac.HMAC_SHA_512);
        var paymentState;
        var fpArray;
        var fpItem;
        var validationFingerprint;
        var i;

        WirecardLogger.logDebug('WirecardManager.validateWirecardResponse: Validate payment amount against order amount.');

        // Check the authorized amount, but not for the pending payment state
        paymentState = parameters.get('paymentState').submitted ? parameters.get('paymentState').value : '';
        if (paymentState !== 'PENDING' && wirecardAmountStr !== order.totalGrossPrice.value.toFixed(2)) {
            WirecardLogger.logFatal('WirecardManager.validateWirecardResponse: Fatal error or fraud - different order amount was authorized'
                                    + 'at Wirecard; Wirecard Amount: ' + wirecardAmountStr + '; Order Amount: '
                                    + order.totalGrossPrice.value.toFixed(2) + '; Order ' + order.orderNo);
            return false;
        }

        // Check the fingerprint
        fpArray = fingerprintOrder.split(',');

        for (i = 0; i < fpArray.length; i++) {
            fpItem = fpArray[i];
            if (fpItem === 'senderBankName') {
                // for certain parameters, where a whitespace might be added in front or after the parameter, the raw value should be used
                fingerprintSeed += parameters.get(fpItem).rawValue;
            } else {
                fingerprintSeed += fpItem === 'secret' ? secret : parameters.get(fpItem);
            }
        }

        WirecardLogger.logWarn('WirecardManager.validateWirecardResponse: Validate the wirecard fingerprint for the following parameters: \n'
                               + fingerprintOrder + '; Fingerprint seed calculated in Shop: ' + fingerprintSeed);

        validationFingerprint = Encoding.toHex(mac.digest(fingerprintSeed, secret));

        if (validationFingerprint.equals(fingerprint)) {
            WirecardLogger.logDebug('WirecardManager.validateWirecardResponse: Fingerprint validation was successful.');
            return true;
        }

        WirecardLogger.logFatal('WirecardManager.validateWirecardResponse: Fatal error or fraud - fingerprint validation'
                                + 'failed and the order will not be completed. Calculated Fingerprint: ' + validationFingerprint
                                + '; Wirecard Fingerprint: ' + fingerprint + '; Order ' + order.orderNo);
        return false;
    },

    /**
     * Set the order payment status to paid in case the confirm url was called and the payment was successful.
     */
    setPaymentStatus: function (order, responseStatus) {
        var parameters = request.httpParameterMap;
        var paymentState = parameters.get('paymentState').submitted ? parameters.get('paymentState').value : '';

        // the payment status is only updated with the confirm URL and if the payment state is success
        if (responseStatus === 'confirm' && paymentState === 'SUCCESS') {
            WirecardLogger.logWarn('WirecardManager.setPaymentStatus: Set payment status to paid for Order ' + order.orderNo);
            order.setPaymentStatus(order.PAYMENT_STATUS_PAID);
        }
    },

    /**
     * Sets all necessary parameters and attributes to the payment of the order.
     */
    setPaymentParameters: function (order, paymentInstrument, wirecardOrderNo) {
        var parameters = request.httpParameterMap;
        var paymentTransaction = paymentInstrument.paymentTransaction;
        var paymentMethod = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod());
        var paymentType;
        var expiry;
        var shippingAddress;
        var name;

        paymentTransaction.transactionID = wirecardOrderNo;
        paymentTransaction.paymentProcessor = paymentMethod.getPaymentProcessor();
        order.custom.wirecardOrderNo = wirecardOrderNo;

        WirecardLogger.logWarn('WirecardManager.setPaymentParameters: Set all payment parameters to Order ' + order.orderNo);

        // Map and set the basic parameters
        paymentTransaction.custom.wirecardFinancialInstitution = parameters.get('financialInstitution').submitted ?
                                                                 parameters.get('financialInstitution').value : '';
        paymentTransaction.custom.wirecardGatewayReferenceNumber = parameters.get('gatewayReferenceNumber').submitted ?
                                                                   parameters.get('gatewayReferenceNumber').value : '';
        paymentTransaction.custom.wirecardGatewayContractNumber = parameters.get('gatewayContractNumber').submitted ?
                                                                  parameters.get('gatewayContractNumber').value : '';
        paymentTransaction.custom.wirecardPaymentState = parameters.get('paymentState').submitted ?
                                                         parameters.get('paymentState').value : '';

        paymentType = parameters.get('paymentType').submitted ? parameters.get('paymentType').value : '';
        paymentTransaction.custom.wirecardPaymentType = paymentType;

        // Switch by payment type, map parameters and save at the payment
        // Note that this list can be enhanced according to your needs
        switch (paymentType) {
        case 'CCARD':
            paymentTransaction.custom.wirecardMaskedPan = parameters.get('maskedPan').submitted ? parameters.get('maskedPan').value : '';

            if (parameters.get('financialInstitution').submitted) {
                paymentInstrument.setCreditCardType(parameters.get('financialInstitution').value);
            }

            if (parameters.get('cardholder').submitted) {
                paymentInstrument.setCreditCardHolder(parameters.get('cardholder').value);
            }

            if (parameters.get('expiry').submitted) {
                expiry = parameters.get('expiry').value.split('/');
                paymentInstrument.setCreditCardExpirationMonth(parseInt(expiry[0], 10));
                paymentInstrument.setCreditCardExpirationYear(parseInt(expiry[1], 10));
            }
            break;

        case 'IDL':
            paymentTransaction.custom.wirecardIdealConsumerName = parameters.get('idealConsumerName').submitted ?
                                                                  parameters.get('idealConsumerName').value : '';
            paymentTransaction.custom.wirecardIdealConsumerAccountNumber = parameters.get('idealConsumerAccountNumber').submitted ?
                                                                           parameters.get('idealConsumerAccountNumber').value : '';
            paymentTransaction.custom.wirecardIdealConsumerCity = parameters.get('idealConsumerCity').submitted ?
                                                                  parameters.get('idealConsumerCity').value : '';

            break;

        case 'PAYPAL':
            paymentTransaction.custom.wirecardPaypalPayerId = parameters.get('paypalPayerID').submitted ?
                                                              parameters.get('paypalPayerID').value : '';
            paymentTransaction.custom.wirecardPaypalPayerEmail = parameters.get('paypalPayerEmail').submitted ?
                                                                 parameters.get('paypalPayerEmail').value : '';
            paymentTransaction.custom.wirecardPaypalPayerLastName = parameters.get('paypalPayerLastName').submitted ?
                                                                    parameters.get('paypalPayerLastName').value : '';
            paymentTransaction.custom.wirecardPaypalPayerFirstName = parameters.get('paypalPayerFirstName').submitted ?
                                                                     parameters.get('paypalPayerFirstName').value : '';

            if (PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).custom.wirecardUpdateShippingData) {
                shippingAddress = order.defaultShipment.shippingAddress;

                if (parameters.get('paypalPayerAddressName').submitted) {
                    // This is a bit of guessing, but PayPal returns only one name parameter,
                    // so we split it at the first whitespace
                    name = parameters.get('paypalPayerAddressName').value.split(' ', 2);
                    if (name.length > 1) {
                        shippingAddress.setFirstName(name[0]);
                        shippingAddress.setLastName(name[1]);
                    } else {
                        // We don't touch the first name entered during checkout in this case
                        shippingAddress.setLastName(name[0]);
                    }
                }

                if (parameters.get('paypalPayerAddressCountry').submitted) {
                    shippingAddress.setCountryCode(parameters.get('paypalPayerAddressCountry').value);
                }

                if (parameters.get('paypalPayerAddressCity').submitted) {
                    shippingAddress.setCity(parameters.get('paypalPayerAddressCity').value);
                }

                if (parameters.get('paypalPayerAddressState').submitted) {
                    shippingAddress.setStateCode(parameters.get('paypalPayerAddressState').value);
                }

                if (parameters.get('paypalPayerAddressStreet1').submitted) {
                    shippingAddress.setAddress1(parameters.get('paypalPayerAddressStreet1').value);
                }

                if (parameters.get('paypalPayerAddressStreet2').submitted) {
                    shippingAddress.setAddress2(parameters.get('paypalPayerAddressStreet2').value);
                }

                if (parameters.get('paypalPayerAddressZIP').submitted) {
                    shippingAddress.setPostalCode(parameters.get('paypalPayerAddressZIP').value);
                }
            }

            break;

        case 'SOFORTUEBERWEISUNG':
            paymentTransaction.custom.wirecardSenderAccountNumber = parameters.get('senderAccountNumber').submitted ?
                                                                    parameters.get('senderAccountNumber').value : '';
            paymentTransaction.custom.wirecardSenderAccountOwner = parameters.get('senderAccountOwner').submitted ?
                                                                   parameters.get('senderAccountOwner').value : '';
            paymentTransaction.custom.wirecardSenderBankNumber = parameters.get('senderBankNumber').submitted ?
                                                                 parameters.get('senderBankNumber').value : '';
            paymentTransaction.custom.wirecardSenderBankName = parameters.get('senderBankName').submitted ?
                                                               parameters.get('senderBankName').value : '';
            paymentTransaction.custom.wirecardSenderBIC = parameters.get('senderBIC').submitted ?
                                                          parameters.get('senderBIC').value : '';
            paymentTransaction.custom.wirecardSenderIBAN = parameters.get('senderIBAN').submitted ?
                                                           parameters.get('senderIBAN').value : '';
            paymentTransaction.custom.wirecardSenderCountry = parameters.get('senderCountry').submitted ?
                                                              parameters.get('senderCountry').value : '';
            paymentTransaction.custom.wirecardSecurityCriteria = parameters.get('securityCriteria').submitted ?
                                                                 parameters.get('securityCriteria').value : '';

            break;

        default:
            break;
        }
    },

    /**
     * Resets the order and restores the basket of the customer.
     */
    resetOrder: function () {
        var order = this.getOrder();
        if (order) {
            OrderMgr.failOrder(order);

            this.checkAndRestoreBasket(order);
        }
    },

    /**
     * Completes a payment if the payment state was PENDING.
     */
    completePendingPayment: function (paymentMethodId) {
        var order = this.getOrder();
        var paymentState = request.httpParameterMap.paymentState.value;
        var paymentInstrument;

        if (order) {
            paymentInstrument = order.getPaymentInstruments(paymentMethodId)[0];

            if (paymentInstrument.paymentTransaction.custom.wirecardPaymentState === 'PENDING') {
                Transaction.wrap(function () {
                    paymentInstrument.paymentTransaction.custom.wirecardPaymentState = paymentState;
                });
            }

            if (paymentState === 'SUCCESS') {
                WirecardLogger.logWarn('WirecardManager.completePendingPayment: Set payment status to paid for Order ' + order.orderNo);
                Transaction.wrap(function () {
                    order.setPaymentStatus(order.PAYMENT_STATUS_PAID);
                });
            }
        }
    },

    /**
     * Checks for a session timeout and restores the basket in this case using the values of the failed order.
     */
    checkAndRestoreBasket: function (order) {
        var basket = BasketMgr.getCurrentOrNewBasket();
        var it;
        var pli;
        var newPLI;
        var gcit;
        var gcli;
        var newGCLI;
        var billingAddress;
        var shippingAddress;

        if (basket && basket.productLineItems.size() === 0 && basket.giftCertificateLineItems.size() === 0) {
            WirecardLogger.logWarn('WirecardManager.checkAndRestoreBasket: A session timeout has been detected for Order ' + order.orderNo);

            request.custom.wirecardSessionTimeoutMessage = Resource.msg('checkout.wirecard.sessiontimeout', 'wirecard', null);

            Transaction.begin();

            it = order.productLineItems.iterator();
            while (it.hasNext()) {
                pli = it.next();
                newPLI = basket.createProductLineItem(pli.productID, basket.defaultShipment);
                newPLI.setQuantityValue(pli.quantity.value);

                // TODO: add pli custom attributes which needs to be copied
            }

            gcit = order.giftCertificateLineItems.iterator();
            while (gcit.hasNext()) {
                gcli = it.next();
                newGCLI = basket.createGiftCertificateLineItem(gcli.priceValue, gcli.recipientEmail);

                newGCLI.setMessage(gcli.message);
                newGCLI.setRecipientName(gcli.recipientName);
                newGCLI.setSenderName(gcli.senderName);
                newGCLI.setProductListItem(gcli.productListItem);

                // TODO: add gift certificate line item custom attributes which needs to be copied
            }

            // Handle email address
            basket.customerEmail = order.customerEmail;

            // Handle billing address
            billingAddress = basket.createBillingAddress();
            billingAddress.firstName = order.billingAddress.firstName;
            billingAddress.lastName = order.billingAddress.lastName;
            billingAddress.address1 = order.billingAddress.address1;
            billingAddress.address2 = order.billingAddress.address2;
            billingAddress.city = order.billingAddress.city;
            billingAddress.postalCode = order.billingAddress.postalCode;
            billingAddress.stateCode = order.billingAddress.stateCode;
            billingAddress.countryCode = order.billingAddress.countryCode;
            billingAddress.phone = order.billingAddress.phone;
            // TODO: add billing address custom attributes which needs to be copied

            // Handle shipping address
            shippingAddress = basket.defaultShipment.createShippingAddress();
            shippingAddress.firstName = order.defaultShipment.shippingAddress.firstName;
            shippingAddress.lastName = order.defaultShipment.shippingAddress.lastName;
            shippingAddress.address1 = order.defaultShipment.shippingAddress.address1;
            shippingAddress.address2 = order.defaultShipment.shippingAddress.address2;
            shippingAddress.city = order.defaultShipment.shippingAddress.city;
            shippingAddress.postalCode = order.defaultShipment.shippingAddress.postalCode;
            shippingAddress.stateCode = order.defaultShipment.shippingAddress.stateCode;
            shippingAddress.countryCode = order.defaultShipment.shippingAddress.countryCode;
            shippingAddress.phone = order.defaultShipment.shippingAddress.phone;
            // TODO: add shipping address custom attributes which needs to be copied

            // Handle shipping method
            basket.defaultShipment.setShippingMethod(order.defaultShipment.getShippingMethod());

            // add shipment custom attributes
            // TODO: basket.defaultShipment.custom.xxx = order.defaultShipment.custom.xxx

            // add order custom attributes which needs to be copied
            // TODO: basket.custom.xxx = order.custom.xxx

            Transaction.commit();

            WirecardLogger.logWarn('WirecardManager.checkAndRestoreBasket: Basket has been restored for failed Order ' + order.orderNo);
        } else {
            WirecardLogger.logDebug('WirecardManager.checkAndRestoreBasket: Basket restored when order was failed for Order ' + order.orderNo);
        }
    },
});

module.exports = WirecardManager;
