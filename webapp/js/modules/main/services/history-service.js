define(['./module', 'common'], function(module, common) {
    module.factory('HistoryService', ['$q', function ($q) {
        return {
            history: [],
            currentItem: -1,
            maxsize: 100,
            print: function(){
                console.log(this.history);
            },
            setMaxSize: function(maxSize){
                this.maxSize = maxSize;
            },
            push: function(e){
                e.undone = 0;
                e.redone = 0;
                this.history.splice(this.currentItem + 1, this.history.length, e);
                this.currentItem = this.history.length - 1;
                if(this.history.length > this.maxsize){
                    this.history.shift();
                }
            },
            do: function(e){
                this.push(e);
                return e.redo().then(function(){
                    if(e.notify){
                        common.notify(e.notify);
                    }
                });
            },
            clear: function(){
                this.history = [];
                this.currentItem = -1;
            },
            undo: function(){
                if(this.currentItem >= 0) {
                    var item = this.history[this.currentItem--];
                    if(item) {
                        item.undone++;
                        return item.undo().then(function(){
                            common.notify('Action undone');
                        });
                    }
                } else {
                    common.notify('Nothing to undo');
                }
            },
            redo: function(){
                if(this.currentItem < this.history.length - 1){
                    var item = this.history[++this.currentItem];
                    if(item) {
                        item.redone++;
                        return item.redo().then(function(){
                            var notificationMessage = 'Action redone';
                            if(item.notify && item.redone <= 1){
                                notificationMessage = item.notify;
                            }
                            common.notify(notificationMessage);
                        });
                    }
                } else {
                    common.notify('Nothing to redo');
                }
            },
            canUndo: function(){
                return this.currentItem >= 0;
            },
            canRedo: function(){
                return this.currentItem < this.history.length - 1;
            },
            handleShortcuts: function($scope){
                var that = this;
                return function(e){
                    let n = e.target.nodeName;

                    if(n !== 'INPUT' && n !== 'TEXTAREA' && e.keyCode == 90 && (e.ctrlKey || e.metaKey)){
                        if(e.shiftKey){
                            $scope.$apply(function(){
                                that.redo();
                            })
                        } else {
                            $scope.$apply(function(){
                                that.undo();
                            })
                        }
                    }
                }
            }
        }
    }]);
});