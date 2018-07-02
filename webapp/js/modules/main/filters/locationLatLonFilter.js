define(['./module'], function (filters) {
  'use strict';
  
  return filters.filter('locationLatLonFilter', [function () {
    
    function format(value) {
      return parseFloat(value).toFixed(2);
    }
    
    return function (value) {
      return '[' + format(value.lat) + ', ' + format(value.lon) + ']';
    };
  }]);
  
});