define([
    'angular',
    'cached-templates/templates-auth',
    'modules/login/controllers/index'
], function (ng) {
    'use strict';

    return ng.module('app.login', [ 'app.login.controllers', 'templates-auth'])
});
