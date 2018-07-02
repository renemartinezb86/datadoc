define("utils", ['alertify'], function(alertify){
    function showNotification(message, wait, callback){
        return alertify.notify(message, wait, callback);
    }

    //todo fix this
    function getRandomGUID(){
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    }

    return {
        randomGUID: getRandomGUID,
        showNotification: showNotification,
        instanceGUID: getRandomGUID()
    }
});
