define(['./module'], function (directives) {
    'use strict';
    directives.directive('uploadBorder', function () {
        return {
            restrict: 'A',
            link: function($scope, $elm, $attr){
                var lastDropFolderId = -1,
                    counter = 0;

                var $backdrop = $('<div class="upload-drop"><div class="backdrop"></div>' +
                    '<div class="message no-overflow">Drop files to upload to <span class="folder">Sources</span></div></div>')
                    .hide().appendTo('body'),
                    $folder = $backdrop.find('.folder');

                var addBackdrop = function(e){
                    e.preventDefault(); // needed for IE
                    counter++;
                    $backdrop.show();
                    $scope.resetUploaderUrl();
                    $('body').addClass('drop-file');
                };
                var hideBackdrop = function(){
                    counter = 0;
                    $backdrop.hide();
                    $('body').removeClass('drop-file');
                };

                var editMessage = function (){
                    var folderId = $('.upload-item.movable.drop-active .uid').val();
                    if(folderId != lastDropFolderId){
                        if(!folderId){
                            var currentFolderName = $scope.selectedSourceFolder ? $scope.selectedSourceFolder.name : 'Sources';
                            $folder.text(currentFolderName)
                        } else {
                            var u = $scope.getUploadById(folderId);
                            $folder.text(u.name);
                        }
                        lastDropFolderId = folderId;
                    }
                };
                var removeBackdrop = function(){
                    counter--;
                    if (counter === 0) {
                        hideBackdrop();
                    }
                };

                var dropAndRemoveBackdrop = function(){
                    hideBackdrop();
                };

               $elm
                    .on('dragover', editMessage)
                    .on('dragenter', addBackdrop)
                    .on('dragleave', removeBackdrop)
                    .on('drop', dropAndRemoveBackdrop);

                $scope.$on('$destroy', function(){
                    $elm
                        .off('dragover', editMessage)
                        .off('dragenter', addBackdrop)
                        .off('dragleave', removeBackdrop)
                        .off('drop', dropAndRemoveBackdrop)

                })
            }
        }
    });
});