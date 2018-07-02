/**
 * configure RequireJS
 * prefer named modules to long paths, especially for version mgt
 * or 3rd party libraries
 */
require.config({
    baseUrl: 'static/js',
    urlArgs: "v=%timestamp%",
    waitSeconds: 0,

    packages: [{
        name: "codemirror",
        location: "lib/codemirror",
        main: "lib/codemirror"
    }],

    paths: {
        'jquery': 'lib/jquery/jquery-1.11.3.min',
        'jquery-ui': 'lib/jquery/jquery-ui.min',
        'jquery-actual': 'lib/jquery/jquery.actual.min',
        'google-drive-upload': 'lib/google-drive-upload/upload',
        'angular': 'lib/angular/angular.min',
        'angular-animate': 'lib/angular/angular-animate.min',
        'angular-ui-router': 'lib/angular/angular-ui-router.min',
        'angular-ui-bootstrap-tpls': 'lib/angular/angular-ui-bootstrap-tpls.min',
        'angular-storage': 'lib/angular/ngStorage.min',
        'angular-file-upload': 'lib/angular/angular-file-upload.min',
        'angular-cookies': 'lib/angular/angular-cookies.min',
        'angular-dropdown-multiselect': 'lib/angular/angularjs-dropdown-multiselect.min',
        'angular-sanitize': 'lib/angular/angular-sanitize.min',
        'angular-clipboard': 'lib/angular-clipboard',
        'angular-elastic-input': 'lib/angular/angular-elastic-input.min',
        'angular-svg-round-progressbar': 'lib/roundProgress',
        'ui-codemirror': 'lib/angular/ui-codemirror.min',
        'ladda': 'lib/ladda.min',
        'spin': 'lib/spin.min',
        'lodash': 'lib/lodash.min',
        'alertify': 'lib/alertify.min',
        'stomp': 'lib/stomp',
        'sockjs': 'lib/sockjs.min',
        'rzslider': 'lib/rzslider.min',
        'moment': 'lib/moment',
        'moment-timezone-with-data': 'lib/moment-timezone-with-data.min',
        'moment-duration-format': 'lib/moment-duration-format',
        'Switchery': 'lib/switchery.min',
        'angular-sortable-view': 'lib/angular-sortable-view.min',
        'angular-ui-select': 'lib/select.min',
        'json-formatter': 'lib/json-formatter.min',
        'pluralize': 'lib/pluralize',
        'numericInput': 'lib/numericInput',
        'angular-cron-jobs': 'lib/angular-cron-jobs',
        'ag-grid': 'lib/ag-grid-enterprise',
        'fin-grid': 'lib/fin-hypergrid',
        'ocLazyLoad': 'lib/ocLazyLoad',
        'ocLazyLoad-uiRouterDecorator': 'lib/ocLazyLoad-uiRouterDecorator',
        'tag-context-menu': 'lib/tag-context-menu',
        'KeyJS': 'lib/key.min',
        'app': 'modules/app/module',
        'bluebird': 'lib/bluebird'
    },

    /**
     * for libs that either do not support AMD out of the box, or
     * require some fine tuning to dependency mgt'
     */
    shim: {
        'angular': {
            deps: ['jquery'],
            exports: 'angular'
        },
        'angular-animate': {
            deps: ['angular']
        },
        'angular-ui-router': {
            deps: ['angular']
        },
        'angular-ui-bootstrap-tpls': {
            deps: ['angular']
        },
        'angular-storage': {
            deps: ['angular']
        },
        'angular-cookies': {
            deps: ['angular']
        },
        'angular-file-upload': {
            deps: ['angular']
        },
        'angular-dropdown-multiselect': {
            deps: ['angular']
        },
        'angular-sanitize': {
            deps: ['angular']
        },
        'angular-clipboard': {
            deps: ['angular']
        },
        'angular-elastic-input': {
            deps: ['angular']
        },
        'angular-svg-round-progressbar': {
            deps: ['angular']
        },
        'ui-codemirror': {
            exports: 'angular',
            deps: [
                'angular',
                'codemirror'
            ],
            // after deps are loaded, codemirror is not a global, but angular-ui-codemirror expects
            // to see a global, so this function fixes that requirement.
            init: function(angular, codemirror) {
                window.CodeMirror = codemirror;
            }
        },
        'codemirror': {
            exports: 'CodeMirror'
        },
        'codemirror/addon/custom/bnf': {
            deps: ['codemirror/addon/mode/simple']
        },
        'google-drive-upload': {
            exports: 'MediaUploader'
        },
        'jquery': {
            exports: '$'
        },
        'jquery-ui': {
            exports: '$',
            deps: ['jquery']
        },
        'jquery-actual': {
            deps: ['jquery']
        },
        'angular-sortable-view': {
            deps: ['angular']
        },
        'angular-ui-select': {
            deps: ['angular']
        },
        'json-formatter': {
            deps: ['angular']
        },
        'moment-duration-format': {
            deps: ['moment']
        },
        'numericInput': {
            deps: ['jquery']
        },
        'angular-cron-jobs': {
            deps: ['angular']
        },
        'ocLazyLoad': {
            deps: ['angular']
        },
        'ocLazyLoad-uiRouterDecorator': {
            deps: ['ocLazyLoad']
        },
        'tag-context-menu': {
            deps: ['angular']
        },
        'KeyJS': {
            exports: "KeyJS"
        }
    }
});

require([
    'angular',
    'bluebird',
    'app'
], function (ng, bluebird) {
    'use strict';

    // TODO: make as part of build process, get rid of this for modern browsers
    window.Promise = bluebird;

    ng.bootstrap(document, ['app'], {
        strictDi: true
    });
});
