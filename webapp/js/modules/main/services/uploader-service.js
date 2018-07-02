define(['./module', 'common', 'lodash', 'google-drive-upload'], (module, common, _, googleDriveUpload) => {
    module.service('UploaderService', ['FileUploader', 'UserStateService', '$localStorage', (FileUploader, UserStateService, $localStorage) => {
        const fileTypes = {
            file: 'file',
            xls: 'excel',
            archive: 'archive',
            unknown: 'unknown'
        };

        class ItemExtension {
            constructor(extension, type = fileTypes.file) {
                this.extension = extension;
                this.type = type;
            }
        }

        const availableFileFormats = [
            new ItemExtension('xls', fileTypes.xls),
            new ItemExtension('xlsx', fileTypes.xls),
            new ItemExtension('txt'),
            new ItemExtension('xml'),
            new ItemExtension('csv'),
            new ItemExtension('tsv'),
            new ItemExtension('json'),
            new ItemExtension('avro'),
            new ItemExtension(''),
            new ItemExtension('zip', fileTypes.archive),
            new ItemExtension('gz', fileTypes.archive),
        ];

        const availableFileFormatsAsString = availableFileFormats.filter(({extension}) => !!extension).map(({extension}) => extension);

        const getFileExtension = fileName => {
            const fileNameSplit = fileName.split('.');
            return fileNameSplit.length === 1 ? '' : _.last(fileNameSplit);
        };

        const getFileType = (fileName) => {
            const extension = getFileExtension(fileName);
            const fileType = _.get(_.find(availableFileFormats, { extension }), 'type');
            return fileType ? fileType : fileTypes.unknown;
        };

        const gcsUploaderConfig = {
            // For local testing you should enable localhost CORS in browser and set GCS strategy on backend
            customTransport: config => {
                const {_fileUploaderContext, item } = config;

                _fileUploaderContext._onBeforeUploadItem(item);

                const options = {
                    token: item.accessToken,
                    file: item._file,
                    contentType: item._file.type,
                    metadata: {
                        title: item.file.name,
                        mimeType: item._file.type,
                    },
                    chunkSize: 1024 * 1024 * 15,
                    onComplete: (response) => {
                        _fileUploaderContext._onSuccessItem(item, response, 200);
                        _fileUploaderContext._onCompleteItem(item, response, 200);
                    },
                    onError: (response) => {
                        _fileUploaderContext._onErrorItem(item, response, status, headers);
                        _fileUploaderContext._onCompleteItem(item, response, 200);
                    },
                    onProgress: _.throttle(progress => {
                            _fileUploaderContext._onProgressItem(item, progress)
                        }, 600)
                };
                const upload = new googleDriveUpload(options);

                const abort = () => {
                    upload.cancel();
                    _fileUploaderContext._onCancelItem(item, response, status, headers);
                };

                // GCS doesn't return such data
                let { response, status, headers } = [];
                if(item.restoredIngest) {
                    _fileUploaderContext._onSuccessItem(item, response, 200);
                    _fileUploaderContext._onCompleteItem(item, response, 200);
                } else {
                    upload.upload();
                }

                item._customProp = { abort };

            }
        };

        const defaultUploaderConfig = {
            url: '/api/files/upload',
            headers: { X_INSTANCE_ID: common.instanceGUID },
        };

        /**
         * Checks whether upload strategy is set to 'ALWAYS_GCS'
         * It mean that any other upload strategies includes 'DEPENDS_ON_FILESIZE' won't be resulted as true
         * @type {boolean}
         */
        //todo decide on backend
        const isGCSUploader = true;

        const uploader = new FileUploader(isGCSUploader ? gcsUploaderConfig : defaultUploaderConfig);

        const setUrl = uid => {
            uploader.path = uid ? 'id:' + uid : '';
        };

        const getUploader = () => uploader;

        const isAcceptableFormat = (extension) => {
            return availableFileFormats.includes(extension);
        };
        return {
            getUploader,
            isGCSUploader,
            availableFileFormats,
            getFileExtension,
            availableFileFormatsAsString,
            isAcceptableFormat,
            getFileType,
            setUrl
        };
    }]);
});