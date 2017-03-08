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
 * @module util/Browsing
 */

/**
 * Recovers the last url from the click stream
 * @return {dw.web.URL} the last called URL
 */
exports.lastUrl = function lastUrl() {
    var location = dw.web.URLUtils.url('Home-Show');
    var click = session.clickStream.last;
    var params;
    if (click) {
        location = dw.web.URLUtils.url(click.pipelineName);
        if (!empty(click.queryString) && click.queryString.indexOf('=') !== -1) {
            params = click.queryString.split('&');
            params.forEach(function (param) {
                location.append.apply(location, param.split('='));
            });
        }
    }
    return location;
};

/**
 * Returns the last catalog URL or homepage URL if non found
 * @return {String} The last browsed catalog URL
 */
exports.lastCatalogURL = function lastCatalogURL() {
    var clicks = session.getClickStream().getClicks();
    var click;
    var i;

    for (i = clicks.size() - 1; i >= 0; i--) {
        click = clicks[i];
        switch (click.getPipelineName()) {
        case 'Product-Show':
        case 'Search-Show':
            // catalog related click
            // replace well-known http parameter names 'source' and 'format' to avoid loading partial page markup only
            return 'http://' + click.host + click.url.replace(/source=/g, 'src=').replace(/format=/g, 'frmt=');
        default:
        }
    }

    return dw.web.URLUtils.httpHome().toString();
};
