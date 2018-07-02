define(['./module', 'common'], function (filters, common) {
    'use strict';

    function replaceIn(value, smap){
        _.each(smap, function(v, k){
            value = value.split(k).join(v);
        });
        return value;
    }

    return filters.filter('errorValueDescriptionFilter', [function () {
        return function (value) {
            return replaceIn(value, common.typeNameMappings);
        };
    }]);

});
