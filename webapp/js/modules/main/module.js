define([
    'angular',
    'angular-cookies',
    'angular-file-upload',
    'angular-dropdown-multiselect',
    'angular-elastic-input',
    'angular-svg-round-progressbar',
    'ui-codemirror',
    'codemirror',
    'codemirror/mode/sql/sql',
    'codemirror/addon/display/autorefresh',
    'codemirror/addon/hint/show-hint',
    'codemirror/addon/mode/simple',
    'codemirror/addon/custom/bnf',
    'codemirror/addon/lint/lint',
    'codemirror/addon/edit/matchbrackets',
    'moment-timezone-with-data',
    'angular-ui-select',
    'json-formatter',
    'pluralize',
    'numericInput',
    'angular-cron-jobs',
    'tag-context-menu',

    'cached-templates/templates-include',
    'cached-templates/templates-main',
    'modules/main/controllers/index',
    'modules/main/directives/index',
    'modules/main/services/index',
    'modules/main/filters/index'
], function (ng) {
    'use strict';

    return ng.module('app.index', [
        'templates-include',
        'templates-main',
        'ngCookies',
        'angularFileUpload',
        'angularjs-dropdown-multiselect',
        'ui.codemirror',
        'rzModule',
        'angular-sortable-view',
        'ui.select',
        'jsonFormatter',
        'angular-clipboard',
        'angular-cron-jobs',
        'puElasticInput',

        'app.main.controllers',
        'app.main.directives',
        'app.main.services',
        'app.main.filters'
    ])
});
