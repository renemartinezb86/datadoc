define(['./module'], function (filters) {
    'use strict';

    return filters.filter('fixedIfFloatFilter', [function () {
        return function(value) {
            if(typeof value == 'number') {
                if(value % 1 === 0) {
                    return value;
                } else {
                    return parseFloat(value.toFixed(2));
                }
            } else {
                return value;
            }
        }
    }]);

});
