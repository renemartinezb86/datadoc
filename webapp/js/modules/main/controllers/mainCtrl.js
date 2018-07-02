define(['./module', 'angular', 'common', 'lodash'], function (controllers, angular, common, _) {
    'use strict';
    controllers.controller('mainCtrl', ['$scope', '$rootScope', '$state', 'UserStateService', 'SectionNamesService',
        function ($scope, $rootScope, $state, UserStateService, SectionNamesService) {
            $scope.userState = UserStateService.get();
            let currentSection;
            if($state.current.name == 'main') {
                currentSection = $scope.userState.activeSection;
            } else if(_.startsWith($state.current.name, 'main.landing.')) {
                currentSection = SectionNamesService.getSectionFromSectionName($state.current.name);
            } else {
                return;
            }
            const sectionToGo = SectionNamesService.getSectionNameFromSection(currentSection);
            if(sectionToGo !== $state.current.name) {
                console.log('Redirecting to: ' + SectionNamesService.getSectionKey(currentSection));
                $state.go(sectionToGo);
            }
        }]);
});
