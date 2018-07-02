define(['./module', 'angular', 'common'], function (controllers, angular, cc) {
    'use strict';
    controllers.controller('confirmationModalCtrl', ['$scope', '$uibModalInstance', 'title', 'description', 'agreeButtonTitle', 'agree',
        ($scope, $uibModalInstance, title, description, agreeButtonTitle, agree) => {
            $scope.title = title;
            $scope.description = description;
            $scope.agreeButtonTitle = agreeButtonTitle;
            $scope.agree = () => {
                agree();
                $scope.closeModal();
            };

            $scope.closeModal = $uibModalInstance.dismiss;
            return {};
    }]);
});
