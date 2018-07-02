define(['./module', 'common'], function (directives, common) {
    'use strict';
    directives.directive('addFolderPane', ['$timeout', function ($timeout) {
        return {
            restrict: 'E',
            templateUrl: 'static/templates/include/add-folder-pane.html',
            scope: {
                editedFolder: '=',
                loading: '=',
                onEnter: '&',
                onCancel: '&'
            },
            link: function($scope, $elm, $attr){
                let input,
                    foldersLimit = 10,
                    charLimit = 50;

                $scope.$on(`create-folder-${$attr.id}`, (e, currentFolder) => {
                    if(currentFolder && currentFolder.parentsPath.length >= foldersLimit - 1) {
                        $scope.onCancel({folder: $scope.editedFolder});
                        common.notify({message: `You cannot nest more folders (${foldersLimit} folders limit)`, icon: 'warning', wait: 5});
                        console.error('You cannot create folder here. Folders limit:', foldersLimit);
                    } else {
                        $scope.editedFolder = {name: undefined};
                        $timeout(() => {
                            input = $elm.find('.new-folder-name');
                            input.focus();
                            input[0].setSelectionRange(0, input.val().length)
                        })
                    }
                });

                $elm.bind("keydown keypress", function(event) {
                    if(event.which === 13) {
                        if(input[0].value.length >= charLimit) {
                            $timeout(() => {
                                common.notify({message: `${charLimit} characters limit exceeded`, icon: 'warning', wait: 3});
                                console.error('Characters limit:', charLimit);
                                event.preventDefault();
                            })
                        } else {
                            $scope.onEnter({folder: $scope.editedFolder});
                            event.preventDefault();
                        }
                    } else if(event.which === 27) {
                        $timeout(() => {
                            $scope.onCancel({folder: $scope.editedFolder});
                            event.preventDefault();
                        })
                    }
                });

                $elm.find('.new-folder-name').bind("blur", function(event){
                    $scope.onCancel({folder: $scope.editedFolder});
                    event.preventDefault();
                })
            }
        }
    }]);
});