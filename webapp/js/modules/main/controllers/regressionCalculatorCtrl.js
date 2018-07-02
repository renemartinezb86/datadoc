define(['./module', 'chartCommons'], function (controllers, chartC) {
    'use strict';

    controllers.controller('regressionCalculatorCtrl', ['regData', '$scope', '$uibModalInstance', '$filter', function(regData, $scope, $uibModalInstance, $filter) {
        regData = JSON.parse(regData);
        var equation = regData.equation;
        var regressionType = regData.type;
        var REGRESSION_TYPES = chartC.REGRESSION_TYPES;

        $scope.title = regData.string;

        $scope.calculateFormModel = {
            x: '',
            y: ''
        };

        $scope.calculate = function() {
            var x = parseFloat($scope.calculateFormModel.x);

            switch(regressionType) {
                case REGRESSION_TYPES.LINEAR:
                    $scope.calculateFormModel.y = $filter('fixedIfFloatFilter')(equation[0] * x + equation[1]);
                    break;
                case REGRESSION_TYPES.EXPONENTIAL:
                    $scope.calculateFormModel.y = $filter('fixedIfFloatFilter')(equation[0] * Math.exp(equation[1] * x));
                    break;
                case REGRESSION_TYPES.LOGARITHMIC:
                    $scope.calculateFormModel.y = $filter('fixedIfFloatFilter')(equation[0] + equation[1] * Math.log(x));
                    break;
                case REGRESSION_TYPES.POWER:
                    $scope.calculateFormModel.y = $filter('fixedIfFloatFilter')(equation[0] * Math.pow(x, equation[1]));
                    break;
                case REGRESSION_TYPES.POLYNOMIAL:
                    $scope.calculateFormModel.y = $filter('fixedIfFloatFilter')(equation[2] * Math.pow(x, 2) + equation[1] * x + equation[0]);
                    break;
            }
        };

        $scope.ok = function () {
            $uibModalInstance.close();
        };

        $scope.cancel = function () {
            $uibModalInstance.dismiss('cancel');
        };
    }]);

});
