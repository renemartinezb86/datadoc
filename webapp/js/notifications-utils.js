define(['./module', 'lodash', 'alertify'], function(module, _, alertify) {
        class NotificationContent {
            constructor(id, message) {
                this.id = id;
                this.message = message;
            }
        }
        const NotificationType = {
            SUCCESS: 0,
            WARNING: 1,
            ERROR: 2
        };

        class NotificationsHolder {
            constructor() {
                this.notifications = {};
            }

            _onDismiss(id, notification, element, options) {
                notification.ondismiss = (e) => {
                    delete this.notifications[id];
                    const closing = !e || $(e.target).closest('.close').length > 0;
                    if(closing) {
                        if (element.ondismiss) {
                            element.ondismiss(e);
                        }
                        if(options.customDismissHandler) {
                            options.customDismissHandler();
                        }
                    }
                    return closing;
                };
            }

            addNotification(id, notification, element, options = {}) {
                if(id) {
                    this.notifications[id] = { notification, element, options };
                    this._onDismiss(id, notification, element, options);
                    return true;
                }
                return false;
            }
            notificationAppear(id) {
                return !!this.notifications[id];
            }
            getNotification(id) {
                return this.notifications[id];
            }
            updateNotificationElement(id, element) {
                this.notifications[id].element = element;
            }
            closeAll(withGlobal = false) {
                _.values(this.notifications).forEach(({ notification, options }) => {
                    if(options.global && withGlobal) {
                        notification.dismiss();
                    } else if (!options.global) {
                        notification.dismiss();
                    }
                });
            }
        }

        const notificationsHolder = new NotificationsHolder();

        const closeButton = '<a class="close"><svg x="0px" y="0px" width="12px" height="12px" viewBox="0 0 10 10" focusable="false"><polygon class="a-s-fa-Ha-pa" fill="#FFFFFF" points="10,1.01 8.99,0 5,3.99 1.01,0 0,1.01 3.99,5 0,8.99 1.01,10 5,6.01 8.99,10 10,8.99 6.01,5 "></polygon></svg></a>';

        const _getNotificationClass = type => {
            if (type !== null && type !== undefined) {
                switch (type) {
                    case NotificationType.ERROR:
                        return 'fa-warning';
                    case NotificationType.SUCCESS:
                        return 'fa-check-circle notification';
                    case NotificationType.WARNING:
                    default:
                        return 'fa-warning notification';
                }
            }
        };

        const _buildNotificationContainer = (id, notificationElement, withCloseButton, width) => {
            const element = $(`<div id="${id}" class="content" ${width ? 'style="min-width: '+ width + '"': ""}>`);
            element.append(notificationElement);
            if(withCloseButton) {
                element.append(closeButton);
            }
            return element
        };

        const _getNotificationElement = (notification, type) => {
            const { message } = notification;
            if(message){
                const iconClass = _getNotificationClass(type);

                const elementHtml = `<span id="notification">
                     <i class="fa fa-lg ${iconClass}"></i>
                      <span>${message}</span>
                  </span>`;
                return $(elementHtml);
            } else {
                return notification;
            }
        };

        const notifyError = (notificationContent, options = {}) => {
            notify(notificationContent, _.merge(options, { type: NotificationType.ERROR }))
        };
        const notifyWarning = (notificationContent, options = {}) => {
            notify(notificationContent, _.merge(options, { type: NotificationType.WARNING }))
        };
        const notifySuccess = (notificationContent, options = {}) => {
            notify(notificationContent, _.merge(options, { type: NotificationType.SUCCESS }))
        };

        const closeNotification = (id) => {
            const ntf  = notificationsHolder.getNotification(id);
            if(ntf) {
                ntf.notification.dismiss();
                return true;
            }
            return false;
        };

        const notify = (notificationContent, options = {}) => {
            const { hideOthers = false, delay = 10, type = NotificationType.SUCCESS, customDismissHandler, width } = options;

            const { id } = notificationContent;
            const notificationElement = _getNotificationElement(notificationContent, type);

            const notificationContainer = _buildNotificationContainer(id, notificationElement, true, width);

            if(notificationsHolder.notificationAppear(id)) {
                const { element, notification } = notificationsHolder.getNotification(id);
                element.replaceWith(notificationContainer);
                notification.delay(delay);
                notificationsHolder.updateNotificationElement(id, notificationContainer);
            } else {
                const notification = alertify.notify(_.first(notificationContainer), 'notification', delay);
                if(hideOthers) {
                    notification.dismissOthers();
                }
                if(id) {
                    notificationsHolder.addNotification(id, notification, notificationContainer, options);
                }

                return notification;
            }
        };

        return {
            closeAll: notificationsHolder.closeAll,
            closeNotification,
            NotificationContent,
            NotificationType,
            notify,
            notifyError,
            notifyWarning,
            notifySuccess,
        }

});
