define(['./module', 'jquery', 'jquery-ui'], function (directives) {
    'use strict';
    directives.directive('mainPageDsPane', ['$timeout', function ($timeout) {
        return {
            restrict: 'E',
            templateUrl: 'static/templates/include/main-page-ds-pane.html',
            link: function ($scope, $elm, $attr) {
                $elm = $elm.children().first();
                $scope.$watch('uploadToRename', function (u) {
                    if (u) {
                        $timeout(function () {
                            var input = $elm.find('.new-file-name');
                            if (input.length) {
                                input.focus();
                                if (u.type == 'folder') {
                                    input[0].setSelectionRange(0, input.val().length)
                                } else {
                                    // search for extension and select only file name
                                    var fileNameEndIndex = input.val().lastIndexOf('.');
                                    if (fileNameEndIndex > 0) {
                                        input[0].setSelectionRange(0, fileNameEndIndex)
                                    } else {
                                        input[0].setSelectionRange(0, input.val().length);
                                    }
                                }
                            }
                        });
                    }
                });

                // todo DRY, see datadoc-pane.js
                $elm.bind("keydown keypress", function (event) {
                    if (event.which === 13) {
                        $scope.doRenameSource();
                        event.preventDefault();
                    } else if (event.which === 27) {
                        $scope.resetRenameSource();
                        event.preventDefault();
                    }
                });

                $elm.find('.new-file-name').bind("blur", function (event) {
                    $scope.resetRenameSource();
                    event.preventDefault();
                });

                $timeout(function(){
                    if($attr.dsDrag && $attr.dsDrag == 'false'){
                        return;
                    }
                    var uploadId = $elm.find(".uid").val();
                    var upload = $scope.getUploadById(uploadId);
                    if(!upload){
                        return;
                    }

                    $elm.draggable({
                        distance: 10,
                        disabled: true,
                        cursorAt: { top: -12, left: -20 },
                        appendTo: 'body',
                        containment: 'window',
                        helper: function(event){
                            if(!isUploadSelected(upload)){
                                $scope.$apply(function(){
                                    $scope.singleClick(upload, event);
                                })
                            }
                            $scope.isSelectionDragged.value = true;
                            var icon = $scope.getUploadIcon($scope.selectedUploads[0]);
                            return $('<div style="z-index: 2000;"><div class="drag-source-helper ' + icon + '"><div class="count">' + $scope.selectedUploads.length + '</div></div></div>')
                        },
                        cancel: ".new-file-name",
                        drag: function(event, ui){
                            $scope.$emit('scroll-container', event);
                        },
                        start: function(event, ui){
                            $scope.$emit('cancel-selection', event);
                        },
                        stop: function(event, ui){
                            $scope.isSelectionDragged.value = false;
                        }
                    });

                    function enableDragging(e){
                        e.originalEvent.dragStarted = true;
                        $elm.draggable('enable');
                        $(window).on('mouseup', function(event){
                            if($elm.data('ui-draggable')) {
                                $elm.draggable('disable');
                            }
                        });
                        $elm.trigger(e);
                        $scope.$emit('cancel-selection');
                    }

                    function isDraggedByNameOrIcon(e){
                        return $(e.originalEvent.target).closest('.drag-handler').length > 0;
                    }
                    function isUploadSelected(u){
                        return !!_.find($scope.selectedUploads, function(upload){
                            return upload.id === u.id;
                        })
                    }

                    $elm.mousedown(function(e){
                        if(!e.originalEvent.dragStarted) {
                            if ((isUploadSelected(upload)
                                  && !(e.originalEvent.ctrlKey || e.originalEvent.metaKey))
                                || isDraggedByNameOrIcon(e)) {
                                enableDragging(e);
                            }
                        }
                    });

                    var dragOverFolder = false;
                    if(upload.type == 'folder') {
                        $($elm).droppable({
                            accept: ".upload-item.movable",
                            tolerance: "pointer",
                            // these handlers are for inner file d&d:
                            over: function(e){
                                var $to = $(e.target);
                                var to = $scope.getUploadById($to.find('input.uid').val());
                                $('.drop-active').removeClass('drop-active');
                                if(!isUploadSelected(to)){
                                    $to.addClass('drop-active')
                                }
                            },
                            out: function(e){
                                var $to = $(e.target);
                                $to.removeClass('drop-active');
                            },
                            drop: $scope.dropFileCallback
                            // and these handlers are for outer file d&d:
                        }).bind('dragover', function () {
                            dragOverFolder = true;
                            $('.drop-active').removeClass('drop-active');
                            $(this).addClass('drop-active')
                        }).bind('dragleave', function () {
                            dragOverFolder = false;
                            var that = this;
                            setTimeout(function () {
                                if (!dragOverFolder) {
                                    $(that).removeClass('drop-active');
                                }
                            }, 100)
                        }).bind('drop', function (e) {
                            $(this).removeClass('drop-active');
                            $scope.setUploaderUrl($(this).find('input.uid').val());
                        });
                    }
                })
            }
        }
    }]);
});