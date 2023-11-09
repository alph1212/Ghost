const debug = require('@tryghost/debug')('web:endpoints:admin:app');
const boolParser = require('express-query-boolean');
const bodyParser = require('body-parser');
const errorHandler = require('@tryghost/mw-error-handler');
const versionMatch = require('@tryghost/mw-version-match');

const shared = require('../../../shared');
const express = require('../../../../../shared/express');
const sentry = require('../../../../../shared/sentry');
const routes = require('./routes');
const APIVersionCompatibilityService = require('../../../../services/api-version-compatibility');
const GhostNestApp = require('@tryghost/ghost');

module.exports = function setupApiApp() {
    debug('Admin API setup start');
    const apiApp = express('admin api');

    // API middleware

    // Body parsing
    apiApp.use(bodyParser.json({limit: '50mb'}));
    apiApp.use(bodyParser.urlencoded({extended: true, limit: '50mb'}));

    // Query parsing
    apiApp.use(boolParser());

    // Check version matches for API requests, depends on res.locals.safeVersion being set
    // Therefore must come after themeHandler.ghostLocals, for now
    apiApp.use(versionMatch);

    // Admin API shouldn't be cached
    apiApp.use(shared.middleware.cacheControl('private'));

    const nestAppPromise = GhostNestApp.create().then(async (app) => {
        await app.init();
        return app;
    });

    apiApp.use(async (req, res, next) => {
        const app = await nestAppPromise;
        app.getHttpAdapter().getInstance()(req, res, next);
    });

    // Routing
    apiApp.use(routes());

    // API error handling
    apiApp.use(errorHandler.resourceNotFound);
    apiApp.use(APIVersionCompatibilityService.errorHandler);
    apiApp.use(errorHandler.handleJSONResponse(sentry));

    debug('Admin API setup end');

    return apiApp;
};
