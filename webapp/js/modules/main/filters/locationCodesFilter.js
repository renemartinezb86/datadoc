define(['./module'], function (filters) {
  'use strict';

  return filters.filter('locationCodesFilter', [function () {
    return function (value) {
      for (var key in value) {
        return value[key];
      }
    };
  }]);

});