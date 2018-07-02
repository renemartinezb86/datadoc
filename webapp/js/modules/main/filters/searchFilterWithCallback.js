define(['./module'], function (filters) {
    'use strict';

    return filters.filter('searchFilterWithCallback', ['$filter', function ($filter) {

        return function (items, text, callback) {
            if(text && text.name) {
                const result = items.filter(item => item.name.toLowerCase().includes(text.name.toLowerCase()));
                callback && callback(result);
                return result;
            } else {
                return items;
            }

        };
    }]);

});
