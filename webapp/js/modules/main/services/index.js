/**
 * attach services to this module
 * if you get 'unknown {x}Provider' errors from angular, be sure they are
 * properly referenced in one of the module dependencies in the array.
 * below, you can see we bring in our services and constants modules 
 * which avails each service of, for example, the `config` constants object.
 **/
define([
    './websocket',
    './history-service',
    './browser-history-service',
    './codes-service',
    './export-service',
    './available-fixed-dates',
    './data-loading',
    './grid-service',
    './embed-service',
    './scope-service',
    './sort-section-service',
    './history-handler-service',
    './event-names-constant',
    './tabs-section',
    './constants',
    './source-service',
    './recent-sources-service',
    './user-state-service',
    './sort-section-columns-service',
    './sort-direction-constant',
    './search-service',
    './ingest-data-loading',
    './uploader-service',
    './flow-service',
    './format-cell-service',
    './router-service',
    './bookmark-commit-service',
    './share-service',
    './columns-service',
    './bookmark-event-service',
    './format-toolbar-service',
    './date-pattern-service',
    './time-zone-service',
    './user-event-service',
    './filter-service',
    './db-source-service'
], function () {});
