define(['./module', 'lodash'], (module, _) => {
    module.service('ShareService', ['$http', '$uibModal',
         ($http, $uibModal) => {
             const usersShareHint = (datadocId, namePart) => $http.post("/share/users_hint", {datadocId, namePart}).then(response => response.data || []);

             const shareWithMessage = ({sharedWith, publicShared}) => {
                 const sharedCount = sharedWith.length;
                 const buildMessageObject = () => {
                     if (sharedCount > 0) {
                         return {
                             header: `Shared with ${sharedCount} people`,
                             icon_class: 'fa fa-users'
                         };
                     } else if (publicShared) {
                         return {
                             header: "Anyone with the link",
                             description: "Anyone who has the link can access.",
                             icon_class: "fa fa-users"
                         }
                     } else {
                         return {
                             header: "Not shared with anyone yet",
                             icon_class: 'fa fa-users'
                         }
                     }
                 };

                 const message = buildMessageObject();
                 return `
                 <div class="share-tooltip-icon">
                     <i class="${message.icon_class}"></i>
                 </div>
                 <div class="share-tooltip-info">
                     <h4 class="share-tooltip-header">${message.header}</h4>
                     ${message.description ? `<p class="share-tooltip-description">${message.description}</p>` : ""}
                 <div> 
                 `;
             };

             const getAllSharedStates = datadocId =>
                 $http.get(`/share/${datadocId}/shared_tabs`).then(response => response.data || []);

             const selectSharedState = (datadocId, sharedStateId) =>
                 $http.post("/share/select_shared_state", { datadocId, sharedStateId });

             const openShareModal = async (datadocId, $scope) => {
                 const init = [usersShareHint(datadocId), retrieveSharedInfo(datadocId), getAllSharedStates(datadocId)];
                 return Promise.all(init).then(([shareWith, shareInfo, sharedStates]) => {
                     return $uibModal.open({
                         templateUrl: '/static/templates/include/share-modal.html',
                         controller: "shareCtrl",
                         resolve: {
                             datadocId: () => datadocId,
                             shareWith: () => shareWith,
                             shareInfo: () => shareInfo,
                             sharedStates: () => sharedStates
                         },
                         scope: $scope,
                         animation: true,
                         size: 'md',
                         windowClass: 'share-window'
                     });
                 })
             };

             const retrieveSharedInfo = async (datadocId) => {
                 return $http.get(`/share/info/${datadocId}`).then(({data}) => data)
             };

             // Todo: How do I get tabs from here?
             // const getTabSharedStates = async (tabId) => {
             //     if(!tabId) {
             //         return;
             //     }
             //
             //     return $http.get(`/api/docs/bookmarks/${tabId}/shared_states`)
             //         .then(result => {
             //             console.log(result);
             //             return result.data;
             //         }, err => {
             //             console.error("Failed to load bookmark shared states", err);
             //         });
             // };

             const shareDatadoc = async (datadocId, emails, shareType, noteText, shareAttachedSources) => {
                 const request = {
                     datadocId,
                     email: emails,
                     shareType,
                     noteText,
                     shareAttachedSources
                 };
                 return $http.post("/share", request).then(({data}) => data);
             };


             const fileDetailsShareWithMessage = (source) => {
                 if (!source) { return; }
                 const {publicShared, sharedWithInfo} = source;

                 const allSharedCount = sharedWithInfo.allSharedCount;
                 const publicSharedMessages = {
                     only: "Public shared only",
                     both: " + public shared"
                 };

                 if(allSharedCount === 0) {
                     if(publicShared) {
                         return publicSharedMessages.only;
                     }
                     return "Not shared";
                 } else {
                     return `${allSharedCount} member${allSharedCount > 1 ? "s" : ""} ${publicShared ? publicSharedMessages.both : ""}`;
                 }
             };

             return {
                 openShareModal,
                 retrieveSharedInfo,
                 shareWithMessage,
                 selectSharedState,
                 fileDetailsShareWithMessage,
                 usersShareHint,
                 shareDatadoc
             }
        }]);
});

