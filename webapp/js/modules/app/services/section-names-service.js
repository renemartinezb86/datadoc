define(['./module'], function(module) {
  module.factory('SectionNamesService', function () {
      var SECTIONS = {
          MY_DATA: 0,
          USER_SETTINGS: 1,
          SEARCH: 2,
      };

      var SECTION_NAMES = {
          MY_DATA: 'main.landing.my_data',
          USER_SETTINGS: 'main.landing.user_settings',
          SEARCH: 'main.landing.search'
      };

      function getKeyFromObjByValue(value, obj) {
          for (var key in obj) {
              if (obj[key] === value) {
                  return key;
              }
          }
      }

      return {
          SECTIONS: SECTIONS,
          SECTION_NAMES: SECTION_NAMES,
          getSectionNameFromSection: function(section) {
              return SECTION_NAMES[getKeyFromObjByValue(section, SECTIONS)];
          },
          getSectionFromSectionName: function(sectionName) {
              return SECTIONS[getKeyFromObjByValue(sectionName, SECTION_NAMES)];
          },
          getSectionKey: function(section) {
              return getKeyFromObjByValue(section, SECTIONS)
          }
      };
  });
});