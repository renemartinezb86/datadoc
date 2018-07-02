define(['./module', 'sockjs', 'stomp'], function (module, SockJS) {
    module.factory('WSocket', ['$rootScope', '$cookies', 'User', function ($rootScope, $cookies, User) {
        const RECONNECTION_TIMEOUT = 3000;
        const PUBLIC_CHANEL_DEST_PREFIX = '/all';
        const USER_CHANEL_DEST_PREFIX = '/user';
        const DEBUG_ENABLED = false;

        let socket;
        let stompClient;
        let subscriptions = [];

        function getUserId() {
            return User.isSignedIn() ? User.getCurrent().id : $cookies.get('dataparse-session').split('.')[0];
        }

        const getBaseUserPrefix = isPublicChanel => isPublicChanel ? PUBLIC_CHANEL_DEST_PREFIX : `${USER_CHANEL_DEST_PREFIX}/${getUserId()}`;

        const init = () => {

            const connect = () => new Promise(resolve => {
                socket = new SockJS('/websocket');
                stompClient = Stomp.over(socket);
                stompClient.debug = DEBUG_ENABLED ? (info) => console.log(info) : undefined;
                stompClient.connect({}, () => {
                        subscriptions.forEach(s => {
                            s.id = subscribe(s.destination);
                        });
                        resolve();
                    }, () => {
                        subscriptions.forEach(s => {
                            s.id.unsubscribe(s.destination);
                        });
                        setTimeout(connect, RECONNECTION_TIMEOUT);
                    }
                );
            });

            return connect();
        };

        const cleanUp = () => {
            subscriptions.forEach(subscription => {
                subscription.id.unsubscribe();
            });

            subscriptions = [];

            if (stompClient !== undefined) {
                stompClient.disconnect();
                stompClient = undefined;
            }
        };

        const subscribe = (destination, isPublicChanel) => {
            const fullDestination = getBaseUserPrefix(isPublicChanel) + destination;
            stompClient.unsubscribe()
            if (stompClient.connected) {
                return stompClient.subscribe(fullDestination, event => {
                    const message = JSON.parse(event.body);
                    const subscription = getSubscriptionByDestination(destination);

                    if (subscription !== undefined) {
                        subscription.callbacks.forEach(callback => {
                            callback(message);
                        });
                    }
                });
            }
        };

        const unsubscribe = (destination, callback) => {
            const subscription = getSubscriptionByDestination(destination);

            if (subscription !== undefined) {
                subscription.callbacks.splice(subscription.callbacks.indexOf(callback), 1);

                if (subscription.callbacks.length === 0) {
                    subscriptions.splice(subscriptions.indexOf(subscription), 1);
                    subscription.id.unsubscribe();
                }
            }
        };

        const getSubscriptionByDestination = destination => subscriptions.filter(item => item.destination === destination)[0];

        $rootScope.$on('sign_in', () => {
            cleanUp();
            init();
        });
        $rootScope.$on('sign_out', cleanUp);

        const state = {
            connect: () => {
                state.promise = init();
            },
            disconnect: cleanUp,
            send: (route, payload) => {
                stompClient.send("/websocket" + route, {}, JSON.stringify(payload));
            },
            subscribe: (destination, callback, isPublicChanel, global) => {
                const subscription = getSubscriptionByDestination(destination);

                if (subscription === undefined) {
                    subscriptions.push({
                        destination: destination,
                        callbacks: [callback],
                        id: subscribe(destination, isPublicChanel),
                        global
                    });
                } else {
                    subscription.callbacks.push(callback);
                }

                return {
                    unsubscribe: () => unsubscribe(destination, callback)
                };
            },
            unsubscribe
        };

        state.connect();

        return state;
    }]);
});
