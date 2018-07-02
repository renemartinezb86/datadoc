define(['./module'], function (directives) {
    directives.directive('formatToolbar', [function() {
        return {
            restrict: 'EA',
            templateUrl: 'static/templates/include/format-toolbar.html',
            controller: ['$scope', function($scope) {

                $scope.formatOtherOptions = [
                    {
                        label: 'Text',
                        descr: 'asdf',
                        action: function() {
                            console.log('action', this.label);
                        },
                        isChecked: () => {

                        }
                    },
                    {
                        label: 'Number',
                        descr: '123.23',
                        action: function() {
                            console.log('action', this.label);
                        },
                        isChecked: () => {

                        }
                    },
                    {
                        label: 'Percent',
                        descr: '12%',
                        action: function() {
                            console.log('action', this.label);
                        },
                        isChecked: () => {

                        }
                    },
                    {
                        label: 'Financial',
                        descr: '$12,000.25',
                        action: function() {
                            console.log('action', this.label);
                        },
                        isChecked: () => {

                        }
                    },
                    // {
                    //     label: 'Date 1',
                    //     description: '11/17/2014',
                    //     action: function() {
                    //         console.log('action', this.label);
                    //     },
                    //     isChecked: () => {
                    //
                    //     }
                    // },
                    // {
                    //     label: 'Date 2',
                    //     description: 'Sep. 14, 2014',
                    //     action: function() {
                    //         console.log('action', this.label);
                    //     },
                    //     isChecked: () => {
                    //
                    //     }
                    // },
                    // {
                    //     label: 'Time',
                    //     description: '3:20:00 PM',
                    //     action: function() {
                    //         console.log('action', this.label);
                    //     },
                    //     isChecked: () => {
                    //
                    //     }
                    // },
                    // {
                    //     label: 'Datetime',
                    //     description: '11/17/2014 12:13:14',
                    //     action: function() {
                    //         console.log('action', this.label);
                    //     },
                    //     isChecked: () => {
                    //
                    //     }
                    // },
                    // {
                    //     label: 'Duration',
                    //     description: '02:12:20',
                    //     action: function() {
                    //         console.log('action', this.label);
                    //     },
                    //     isChecked: () => {
                    //
                    //     }
                    // }
                ]

            }]
        }
    }]);
});