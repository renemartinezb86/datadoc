define(['./module', 'common'], function (controllers, common) {
    'use strict';

    controllers.controller('dsAnnotationCtrl', ['$scope', '$http', '$uibModalInstance', 'uploadId', 'annotation', 'onSuccess', function($scope, $http, $uibModalInstance, uploadId, annotation, onSuccess) {

        $scope.oldAnnotation = annotation;
        $scope.annotation = annotation;

        $scope.closeDsAnnotationModal = function(){
            $uibModalInstance.dismiss();
        };

        $scope.updateDsAnnotation = function(){
            $scope.annotate($scope.annotation)
        };

        $scope.deleteDsAnnotation = function(){
            $scope.annotate(null);
        };

        $scope.annotate = function(annotation){
            $scope.updateRunning = true;
            $http.post('/api/files/annotate', {
                path: 'id:' + uploadId,
                annotation: annotation
            }).success(function(data){
                onSuccess(data);
                $scope.updateRunning = false;
                $scope.closeDsAnnotationModal();
            }).error(function(e){
                $scope.xlsPreviewErrorString = e.message;
                $scope.updateRunning = false;
            })
        };
    }]);

});
