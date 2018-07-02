define(['./module', 'lodash'], function (filters, _) {
    'use strict';
    return filters.filter('groupBy', ['$parse', function ($parse) {
        return _.memoize(function (items, field) {
            const getter = $parse(field);
            return _.groupBy(items, function (item) {
                return getter(item);
            });
        });
    }]);
});