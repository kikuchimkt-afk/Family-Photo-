/**
 * Family Photo Album - Google Drive Version with Tags
 * ====================================================
 * Googleドライブで家族の写真をタグで管理するアプリ
 */

class PhotoAlbumApp {
    constructor() {
        // State
        this.isSignedIn = false;
        this.tokenClient = null;
        this.accessToken = null;
        this.tokenRefreshResolver = null;

        this.photos = [];           // All photos in root folder
        this.allTags = new Set();   // All available tags
        this.currentTag = null;     // Currently selected tag filter (null = show all)
        this.selectedItems = new Set();
        this.rootFolderId = null;

        // DOM Elements
        this.elements = {
            // Screens
            loginScreen: document.getElementById('loginScreen'),
            mainApp: document.getElementById('mainApp'),

            // PWA
            installBtn: document.getElementById('installBtn'),

            // Login
            loginBtn: document.getElementById('loginBtn'),

            // Header
            userInfo: document.getElementById('userInfo'),
            userAvatar: document.getElementById('userAvatar'),
            userName: document.getElementById('userName'),
            logoutBtn: document.getElementById('logoutBtn'),

            // Toolbar
            uploadBtn: document.getElementById('uploadBtn'),
            uploadFolderBtn: document.getElementById('uploadFolderBtn'),
            fileInput: document.getElementById('fileInput'),
            folderInput: document.getElementById('folderInput'),
            newFolderBtn: document.getElementById('newFolderBtn'),
            selectAllBtn: document.getElementById('selectAllBtn'),
            deselectAllBtn: document.getElementById('deselectAllBtn'),
            downloadBtn: document.getElementById('downloadBtn'),
            moveBtn: document.getElementById('moveBtn'),
            removeTagBtn: document.getElementById('removeTagBtn'),
            renameBtn: document.getElementById('renameBtn'),
            deleteBtn: document.getElementById('deleteBtn'),
            selectionCount: document.getElementById('selectionCount'),
            totalCount: document.getElementById('totalCount'),

            // Navigation
            breadcrumb: document.getElementById('breadcrumb'),

            // Content
            dropZone: document.getElementById('dropZone'),
            emptyState: document.getElementById('emptyState'),
            photoGallery: document.getElementById('photoGallery'),

            // Modals
            moveModal: document.getElementById('moveModal'),
            closeMoveModal: document.getElementById('closeMoveModal'),
            folderList: document.getElementById('folderList'),
            createFolderInModal: document.getElementById('createFolderInModal'),
            cancelMoveBtn: document.getElementById('cancelMoveBtn'),
            confirmMoveBtn: document.getElementById('confirmMoveBtn'),

            renameModal: document.getElementById('renameModal'),
            closeRenameModal: document.getElementById('closeRenameModal'),
            renamePrefix: document.getElementById('renamePrefix'),
            startNumber: document.getElementById('startNumber'),
            digitCount: document.getElementById('digitCount'),
            renamePreview: document.getElementById('renamePreview'),
            cancelRenameBtn: document.getElementById('cancelRenameBtn'),
            confirmRenameBtn: document.getElementById('confirmRenameBtn'),

            newFolderModal: document.getElementById('newFolderModal'),
            closeNewFolderModal: document.getElementById('closeNewFolderModal'),
            newFolderName: document.getElementById('newFolderName'),
            cancelNewFolderBtn: document.getElementById('cancelNewFolderBtn'),
            confirmNewFolderBtn: document.getElementById('confirmNewFolderBtn'),

            // Loading & Progress
            loadingOverlay: document.getElementById('loadingOverlay'),
            uploadProgress: document.getElementById('uploadProgress'),
            uploadProgressText: document.getElementById('uploadProgressText'),
            uploadProgressFill: document.getElementById('uploadProgressFill'),

            // Viewer
            viewerModal: document.getElementById('viewerModal'),
            viewerImage: document.getElementById('viewerImage'),
            viewerFileName: document.getElementById('viewerFileName'),
            viewerDate: document.getElementById('viewerDate'),
            viewerTags: document.getElementById('viewerTags'),
            closeViewerBtn: document.getElementById('closeViewerBtn'),
            viewerPrevBtn: document.getElementById('viewerPrevBtn'),
            viewerNextBtn: document.getElementById('viewerNextBtn')
        };

        this.selectedTagForMove = null;
        this.deferredPrompt = null;
        this.init();
    }

    async init() {
        this.initPWA();
        this.bindEvents();
        await this.initGoogleAPI();
    }

    initPWA() {
        // Service Worker Registration
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(registration => {
                        console.log('SW registered: ', registration);
                    })
                    .catch(registrationError => {
                        console.log('SW registration failed: ', registrationError);
                    });
            });
        }

        // Install Trigger
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.elements.installBtn.style.display = 'inline-flex';
        });

        this.elements.installBtn.addEventListener('click', async () => {
            if (this.deferredPrompt) {
                this.deferredPrompt.prompt();
                const { outcome } = await this.deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                this.deferredPrompt = null;
                this.elements.installBtn.style.display = 'none';
            }
        });
    }

    bindEvents() {
        // Login/Logout
        this.elements.loginBtn.addEventListener('click', () => this.handleLogin());
        this.elements.logoutBtn.addEventListener('click', () => this.handleLogout());

        // Upload
        this.elements.uploadBtn.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Folder Upload (no auto-tagging)
        this.elements.uploadFolderBtn.addEventListener('click', () => this.elements.folderInput.click());
        this.elements.folderInput.addEventListener('change', (e) => this.handleFolderSelect(e));

        // New Tag
        this.elements.newFolderBtn.addEventListener('click', () => this.openNewTagModal());

        // Selection
        this.elements.selectAllBtn.addEventListener('click', () => this.selectAll());
        this.elements.deselectAllBtn.addEventListener('click', () => this.deselectAll());

        // Actions
        this.elements.downloadBtn.addEventListener('click', () => this.downloadSelected());
        this.elements.moveBtn.addEventListener('click', () => this.openTagModal());  // Now adds tags
        this.elements.removeTagBtn.addEventListener('click', () => this.openRemoveTagModal());
        this.elements.renameBtn.addEventListener('click', () => this.openRenameModal());
        this.elements.deleteBtn.addEventListener('click', () => this.deleteSelected());

        // Tag Modal (was Move Modal)
        this.elements.closeMoveModal.addEventListener('click', () => this.closeTagModal());
        this.elements.cancelMoveBtn.addEventListener('click', () => this.closeTagModal());
        this.elements.confirmMoveBtn.addEventListener('click', () => this.handleTagConfirm());
        this.elements.createFolderInModal.addEventListener('click', () => {
            this.closeTagModal();
            this.openNewTagModal();
        });
        this.elements.moveModal.querySelector('.modal-overlay').addEventListener('click', () => this.closeTagModal());

        // Rename Modal
        this.elements.closeRenameModal.addEventListener('click', () => this.closeRenameModal());
        this.elements.cancelRenameBtn.addEventListener('click', () => this.closeRenameModal());
        this.elements.confirmRenameBtn.addEventListener('click', () => this.executeRename());
        this.elements.renamePrefix.addEventListener('input', () => this.updateRenamePreview());
        this.elements.startNumber.addEventListener('input', () => this.updateRenamePreview());
        this.elements.digitCount.addEventListener('change', () => this.updateRenamePreview());
        this.elements.renameModal.querySelector('.modal-overlay').addEventListener('click', () => this.closeRenameModal());

        // New Tag Modal (was New Folder Modal)
        this.elements.closeNewFolderModal.addEventListener('click', () => this.closeNewTagModal());
        this.elements.cancelNewFolderBtn.addEventListener('click', () => this.closeNewTagModal());
        this.elements.confirmNewFolderBtn.addEventListener('click', () => this.createNewTag());
        this.elements.newFolderModal.querySelector('.modal-overlay').addEventListener('click', () => this.closeNewTagModal());

        // Viewer Modal
        this.elements.closeViewerBtn.addEventListener('click', () => this.closePhotoViewer());
        this.elements.viewerPrevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigateViewer(-1);
        });
        this.elements.viewerNextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.navigateViewer(1);
        });
        this.elements.viewerModal.querySelector('.modal-overlay').addEventListener('click', () => this.closePhotoViewer());

        // Keyboard shortcuts for viewer
        document.addEventListener('keydown', (e) => {
            if (!this.elements.viewerModal.classList.contains('active')) return;
            if (e.key === 'Escape') this.closePhotoViewer();
            if (e.key === 'ArrowLeft') this.navigateViewer(-1);
            if (e.key === 'ArrowRight') this.navigateViewer(1);
        });

        // Drag & Drop
        document.addEventListener('dragenter', (e) => this.handleDragEnter(e));
        document.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => this.handleDrop(e));
    }

    // ===== Google API Initialization =====
    async initGoogleAPI() {
        try {
            await new Promise((resolve) => {
                if (typeof google !== 'undefined' && google.accounts) {
                    resolve();
                } else {
                    const checkGoogle = setInterval(() => {
                        if (typeof google !== 'undefined' && google.accounts) {
                            clearInterval(checkGoogle);
                            resolve();
                        }
                    }, 100);
                }
            });

            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CONFIG.CLIENT_ID,
                scope: CONFIG.SCOPES,
                callback: (response) => this.handleAuthResponse(response)
            });

            const savedToken = sessionStorage.getItem('gapi_token');
            if (savedToken) {
                this.accessToken = savedToken;
                this.isSignedIn = true;
                await this.onSignIn();
            }
        } catch (err) {
            console.error('Failed to initialize Google API:', err);
        }
    }

    handleLogin() {
        if (CONFIG.CLIENT_ID === 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com') {
            alert('config.js の CLIENT_ID を設定してください。');
            return;
        }
        this.tokenClient.requestAccessToken();
    }

    handleAuthResponse(response) {
        if (response.error) {
            console.error('Auth error:', response);
            if (this.tokenRefreshResolver) {
                this.tokenRefreshResolver(Promise.reject(response));
                this.tokenRefreshResolver = null;
            } else {
                alert('認証エラー: ' + (response.error_description || response.error));
            }
            return;
        }

        this.accessToken = response.access_token;
        sessionStorage.setItem('gapi_token', this.accessToken);
        this.isSignedIn = true;

        // If this was a refresh request, resolve the promise and return
        if (this.tokenRefreshResolver) {
            this.tokenRefreshResolver(this.accessToken);
            this.tokenRefreshResolver = null;
            return;
        }

        this.onSignIn().catch(err => {
            console.error('onSignIn error:', err);
            alert('ログイン処理中にエラーが発生しました。\n\n詳細: ' + err.message);
            this.handleLogout();
        });
    }

    async handleLogout() {
        if (this.accessToken) {
            google.accounts.oauth2.revoke(this.accessToken);
        }
        this.accessToken = null;
        sessionStorage.removeItem('gapi_token');
        this.isSignedIn = false;

        this.elements.mainApp.style.display = 'none';
        this.elements.loginScreen.style.display = 'flex';
    }

    async onSignIn() {
        this.showLoading('読み込み中...');

        try {
            const userInfo = await this.fetchAPI('https://www.googleapis.com/oauth2/v2/userinfo');
            this.elements.userAvatar.src = userInfo.picture || '';
            this.elements.userName.textContent = userInfo.name || userInfo.email;

            this.elements.loginScreen.style.display = 'none';
            this.elements.mainApp.style.display = 'flex';

            await this.initRootFolder();
            await this.loadPhotos();
        } catch (err) {
            console.error('Sign in error:', err);
            alert('ログイン処理中にエラーが発生しました。');
            this.handleLogout();
        }

        this.hideLoading();
    }

    // ===== API Helpers =====
    async fetchAPI(url, options = {}) {
        let response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                ...options.headers
            }
        });

        // Handle 401 Unauthorized (Token expired)
        if (response.status === 401) {
            console.log('Token expired, refreshing...');
            try {
                await this.refreshToken();
                // Retry request with new token
                response = await fetch(url, {
                    ...options,
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        ...options.headers
                    }
                });
            } catch (err) {
                console.error('Token refresh failed:', err);
                throw err;
            }
        }

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        return response.json();
    }

    async refreshToken() {
        return new Promise((resolve, reject) => {
            // Save resolver to be called in handleAuthResponse
            this.tokenRefreshResolver = resolve;

            // Trigger token request
            // prompt: '' is not supported in GIS, but requestAccessToken without user interaction
            // might work if session is still valid, otherwise it shows popup.
            this.tokenClient.requestAccessToken();
        });
    }

    async driveAPI(endpoint, options = {}) {
        return this.fetchAPI(`https://www.googleapis.com/drive/v3${endpoint}`, options);
    }

    // ===== Root Folder =====
    async runWithConcurrency(tasks, concurrency) {
        const results = [];
        const executing = [];
        for (const task of tasks) {
            const p = task().then(result => {
                executing.splice(executing.indexOf(p), 1);
                return result;
            });
            results.push(p);
            executing.push(p);
            if (executing.length >= concurrency) {
                await Promise.race(executing);
            }
        }
        return Promise.all(results);
    }

    async initRootFolder() {
        const query = `name='${CONFIG.PHOTO_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const result = await this.driveAPI(`/files?q=${encodeURIComponent(query)}&fields=files(id,name)`);

        if (result.files && result.files.length > 0) {
            this.rootFolderId = result.files[0].id;
        } else {
            const folder = await this.createFolder(CONFIG.PHOTO_FOLDER_NAME, null);
            this.rootFolderId = folder.id;
        }
    }

    async createFolder(name, parentId) {
        const metadata = {
            name: name,
            mimeType: 'application/vnd.google-apps.folder'
        };

        if (parentId) {
            metadata.parents = [parentId];
        }

        const response = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });

        return response.json();
    }

    async getAllDescendantFolders(rootId) {
        let allFolders = [];
        let currentLevel = [rootId];

        while (currentLevel.length > 0) {
            let nextLevel = [];

            // Limit concurrency for folder scanning
            const chunks = [];
            for (let i = 0; i < currentLevel.length; i += 10) {
                chunks.push(currentLevel.slice(i, i + 10));
            }

            const tasks = chunks.map(batch => async () => {
                const query = batch.map(id => `'${id}' in parents`).join(' or ');
                const fullQuery = `(${query}) and mimeType='application/vnd.google-apps.folder' and trashed=false`;

                let foundIds = [];
                let nextPageToken = null;
                do {
                    let url = `/files?q=${encodeURIComponent(fullQuery)}&fields=nextPageToken,files(id)&pageSize=1000`;
                    if (nextPageToken) url += `&pageToken=${encodeURIComponent(nextPageToken)}`;

                    const result = await this.driveAPI(url);
                    if (result.files && result.files.length > 0) {
                        foundIds = foundIds.concat(result.files.map(f => f.id));
                    }
                    nextPageToken = result.nextPageToken;
                } while (nextPageToken);

                return foundIds;
            });

            const results = await this.runWithConcurrency(tasks, CONFIG.CONCURRENT_LOADS || 6);
            const foundIdsFlat = results.flat();

            allFolders = allFolders.concat(foundIdsFlat);
            nextLevel = foundIdsFlat;

            currentLevel = nextLevel;
        }

        return allFolders;
    }

    // ===== Load Photos with Tags (Recursive) =====
    async loadPhotos() {
        this.showLoading('写真を読み込み中...');

        try {
            // 1. Get ALL descendant folders
            const allFolderIds = await this.getAllDescendantFolders(this.rootFolderId);
            allFolderIds.push(this.rootFolderId); // Include root

            // 2. Fetch photos from all folders (concurrently)
            let allFiles = [];

            const BATCH_SIZE = 20;
            const chunks = [];
            for (let i = 0; i < allFolderIds.length; i += BATCH_SIZE) {
                chunks.push(allFolderIds.slice(i, i + BATCH_SIZE));
            }

            let loadedCount = 0;
            const tasks = chunks.map(batchIds => async () => {
                const parentQueries = batchIds.map(id => `'${id}' in parents`).join(' or ');
                const mimeTypeQueries = CONFIG.IMAGE_MIME_TYPES.map(t => `mimeType='${t}'`).join(' or ');
                const photosQuery = `(${parentQueries}) and (${mimeTypeQueries}) and trashed=false`;

                let foundFiles = [];
                let nextPageToken = null;
                do {
                    let url = `/files?q=${encodeURIComponent(photosQuery)}` +
                        `&fields=nextPageToken,files(id,name,mimeType,thumbnailLink,createdTime,modifiedTime,size,imageMediaMetadata(time),appProperties,parents)` +
                        `&orderBy=createdTime desc` +
                        `&pageSize=1000`;

                    if (nextPageToken) {
                        url += `&pageToken=${encodeURIComponent(nextPageToken)}`;
                    }

                    const result = await this.driveAPI(url);
                    if (result.files) {
                        foundFiles = foundFiles.concat(result.files);
                    }
                    nextPageToken = result.nextPageToken;
                } while (nextPageToken);

                loadedCount += foundFiles.length;
                this.showLoading(`写真を読み込み中... (${loadedCount}枚)`);
                return foundFiles;
            });

            const results = await this.runWithConcurrency(tasks, CONFIG.CONCURRENT_LOADS || 6);
            allFiles = results.flat();

            // 3. Process & Deduplicate
            this.allTags.clear();
            const uniquePhotosMap = new Map(); // Key: ExifTime_Size or Name_Size

            // Sort to process Subfolder > Root (We'll use map overwriting logic)
            // But we need to know WHICH one is in root.
            // If we process ROOT first, then SUBFOLDER later, the later one overwrites in Map.
            // THIS is how we prioritize Subfolder!

            // Separate files into Root and Non-Root
            const rootFiles = allFiles.filter(f => f.parents && f.parents.includes(this.rootFolderId));
            const subFiles = allFiles.filter(f => !f.parents || !f.parents.includes(this.rootFolderId));

            // Function to process a file and add to map
            const processFile = (file) => {
                // Parse EXIF date
                let photoDate;
                if (file.imageMediaMetadata && file.imageMediaMetadata.time) {
                    const exifTime = file.imageMediaMetadata.time;
                    const parsed = exifTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
                    photoDate = new Date(parsed);
                } else {
                    photoDate = new Date(file.createdTime || file.modifiedTime);
                }

                // Parse tags
                const tags = file.appProperties && file.appProperties.tags
                    ? file.appProperties.tags.split(',').filter(t => t.trim())
                    : [];
                tags.forEach(tag => this.allTags.add(tag));

                const photoObj = {
                    ...file,
                    date: photoDate,
                    tags: tags
                };

                // Create Unique Key for Deduplication
                // Prefer Exif Time + Size. Fallback to Name + Size.
                let uniqueKey;
                if (file.imageMediaMetadata && file.imageMediaMetadata.time) {
                    uniqueKey = `${file.imageMediaMetadata.time}_${file.size}`;
                } else {
                    uniqueKey = `${file.name}_${file.size}`;
                }

                uniquePhotosMap.set(uniqueKey, photoObj);
            };

            // Process Root files FIRST
            rootFiles.forEach(processFile);

            // Process Subfolder files SECOND (will overwrite root files if keys match)
            subFiles.forEach(processFile);

            this.photos = Array.from(uniquePhotosMap.values());

            // Re-sort by date descending after merging
            this.photos.sort((a, b) => b.date - a.date);

            this.elements.totalCount.textContent = this.photos.length;
            this.selectedItems.clear();
            this.renderTagNav();
            this.renderGallery();
            this.updateToolbar();
        } catch (err) {
            console.error('Load photos error:', err);
            alert('写真の読み込み中にエラーが発生しました。');
        }

        this.hideLoading();
    }

    // ===== Tag Navigation =====
    renderTagNav() {
        const sortedTags = Array.from(this.allTags).sort();

        let html = `
            <span class="breadcrumb-item ${this.currentTag === null ? 'active' : ''}" data-tag="">
                🏠 すべての写真
            </span>
        `;

        if (sortedTags.length > 0) {
            html += '<span class="breadcrumb-separator">|</span>';
            html += sortedTags.map(tag => `
                <span class="breadcrumb-item ${this.currentTag === tag ? 'active' : ''}" data-tag="${tag}">
                    🏷️ ${tag}
                </span>
            `).join('');
        }

        this.elements.breadcrumb.innerHTML = html;

        // Add click handlers
        this.elements.breadcrumb.querySelectorAll('.breadcrumb-item').forEach(item => {
            item.addEventListener('click', () => {
                const tag = item.dataset.tag;
                this.currentTag = tag || null;
                this.renderTagNav();
                this.renderGallery();
            });
        });
    }

    // ===== Tag Operations =====
    openTagModal() {
        if (this.selectedItems.size === 0) return;

        const sortedTags = Array.from(this.allTags).sort();

        this.elements.folderList.innerHTML = sortedTags.length > 0
            ? sortedTags.map(tag => `
                <div class="folder-list-item" data-tag="${tag}">
                    <span>🏷️</span>
                    <span>${tag}</span>
                </div>
            `).join('')
            : '<p style="color: var(--text-muted); text-align: center;">タグがありません</p>';

        this.elements.folderList.querySelectorAll('.folder-list-item').forEach(item => {
            item.addEventListener('click', () => {
                this.elements.folderList.querySelectorAll('.folder-list-item').forEach(i =>
                    i.classList.remove('selected')
                );
                item.classList.add('selected');
                this.selectedTagForMove = item.dataset.tag;
            });
        });

        this.selectedTagForMove = null;
        this.elements.moveModal.classList.add('active');
    }

    handleTagConfirm() {
        if (this.isRemoveTagMode) {
            this.removeTagFromSelected();
        } else {
            this.addTagToSelected();
        }
    }

    async addTagToSelected() {
        if (!this.selectedTagForMove) {
            alert('タグを選択してください。');
            return;
        }

        this.closeTagModal();
        this.showLoading('タグを追加中...');

        const selectedPhotoIds = Array.from(this.selectedItems);

        for (const photoId of selectedPhotoIds) {
            const photo = this.photos.find(p => p.id === photoId);
            if (!photo) continue;

            // Add tag if not already present
            if (!photo.tags.includes(this.selectedTagForMove)) {
                const newTags = [...photo.tags, this.selectedTagForMove];
                await this.updatePhotoTags(photoId, newTags);
            }
        }

        await this.loadPhotos();
        this.hideLoading();
    }

    async updatePhotoTags(photoId, tags) {
        const appProperties = {
            tags: tags.join(',')
        };

        await fetch(`https://www.googleapis.com/drive/v3/files/${photoId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ appProperties })
        });
    }

    // ===== Remove Tag =====
    openRemoveTagModal() {
        if (this.selectedItems.size === 0) return;

        // Get tags that are on selected photos
        const selectedPhotos = this.photos.filter(p => this.selectedItems.has(p.id));
        const tagsOnSelected = new Set();
        selectedPhotos.forEach(photo => {
            photo.tags.forEach(tag => tagsOnSelected.add(tag));
        });

        const sortedTags = Array.from(tagsOnSelected).sort();

        if (sortedTags.length === 0) {
            alert('選択した写真にはタグがありません。');
            return;
        }

        this.isRemoveTagMode = true;

        this.elements.folderList.innerHTML = sortedTags.map(tag => `
            <div class="folder-list-item" data-tag="${tag}">
                <span>🏷️</span>
                <span>${tag}</span>
            </div>
        `).join('');

        this.elements.folderList.querySelectorAll('.folder-list-item').forEach(item => {
            item.addEventListener('click', () => {
                this.elements.folderList.querySelectorAll('.folder-list-item').forEach(i =>
                    i.classList.remove('selected')
                );
                item.classList.add('selected');
                this.selectedTagForMove = item.dataset.tag;
            });
        });

        // Update modal title temporarily
        const modalTitle = this.elements.moveModal.querySelector('.modal-header h2');
        modalTitle.textContent = 'タグを削除';
        this.elements.confirmMoveBtn.textContent = '削除';
        this.isRemoveTagMode = true;

        this.selectedTagForMove = null;
        this.elements.moveModal.classList.add('active');
    }

    async removeTagFromSelected() {
        if (!this.selectedTagForMove) {
            alert('削除するタグを選択してください。');
            return;
        }

        this.closeTagModal();
        this.showLoading('タグを削除中...');

        const selectedPhotoIds = Array.from(this.selectedItems);

        for (const photoId of selectedPhotoIds) {
            const photo = this.photos.find(p => p.id === photoId);
            if (!photo) continue;

            // Remove tag if present
            if (photo.tags.includes(this.selectedTagForMove)) {
                const newTags = photo.tags.filter(t => t !== this.selectedTagForMove);
                await this.updatePhotoTags(photoId, newTags);
            }
        }

        // Reset modal to add mode
        this.resetTagModal();

        await this.loadPhotos();
        this.hideLoading();
    }

    resetTagModal() {
        const modalTitle = this.elements.moveModal.querySelector('.modal-header h2');
        modalTitle.textContent = 'タグを追加';
        const confirmBtn = this.elements.confirmMoveBtn;
        confirmBtn.textContent = '追加';
        confirmBtn.onclick = null;
        this.isRemoveTagMode = false;
    }

    closeTagModal() {
        this.elements.moveModal.classList.remove('active');
        this.resetTagModal();
    }

    // ===== New Tag =====
    openNewTagModal() {
        this.elements.newFolderName.value = '';
        this.elements.newFolderModal.classList.add('active');
        this.elements.newFolderName.focus();
    }

    closeNewTagModal() {
        this.elements.newFolderModal.classList.remove('active');
    }

    async createNewTag() {
        const tagName = this.elements.newFolderName.value.trim();
        if (!tagName) {
            alert('タグ名を入力してください。');
            return;
        }

        this.closeNewTagModal();

        // If photos are selected, add the tag to them
        if (this.selectedItems.size > 0) {
            this.showLoading('タグを追加中...');

            for (const photoId of this.selectedItems) {
                const photo = this.photos.find(p => p.id === photoId);
                if (!photo) continue;

                if (!photo.tags.includes(tagName)) {
                    const newTags = [...photo.tags, tagName];
                    await this.updatePhotoTags(photoId, newTags);
                }
            }

            await this.loadPhotos();
            this.hideLoading();
        } else {
            // Just add to allTags for future use
            this.allTags.add(tagName);
            this.renderTagNav();
        }
    }

    // ===== File Upload =====
    handleDragEnter(e) {
        e.preventDefault();
        if (this.isSignedIn) {
            this.elements.dropZone.classList.add('active');
        }
    }

    handleDragLeave(e) {
        e.preventDefault();
        if (e.target === this.elements.dropZone || !this.elements.dropZone.contains(e.relatedTarget)) {
            this.elements.dropZone.classList.remove('active');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        this.elements.dropZone.classList.remove('active');

        if (!this.isSignedIn) return;

        const files = Array.from(e.dataTransfer.files).filter(f =>
            CONFIG.IMAGE_MIME_TYPES.includes(f.type)
        );

        if (files.length > 0) {
            this.uploadFiles(files);
        }
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            this.uploadFiles(files);
        }
        e.target.value = '';
    }

    async handleFolderSelect(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) {
            e.target.value = '';
            return;
        }

        // Filter image files
        const imageFiles = files.filter(file => {
            if (CONFIG.IMAGE_MIME_TYPES.includes(file.type)) return true;
            const ext = file.name.split('.').pop().toLowerCase();
            return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext);
        });

        if (imageFiles.length === 0) {
            alert('アップロードできる画像ファイルがありません。');
            e.target.value = '';
            return;
        }

        // Upload files without auto-tagging
        await this.uploadFiles(imageFiles);
        e.target.value = '';
    }

    isDuplicate(file) {
        return this.photos.some(p => p.name === file.name && parseInt(p.size) === file.size);
    }

    async uploadFiles(files) {
        const total = files.length;
        let uploaded = 0;
        let skipped = 0;

        this.elements.uploadProgress.classList.add('active');
        this.updateUploadProgress(0, total);

        // Queue for concurrency control
        const queue = [...files];
        const concurrency = CONFIG.CONCURRENT_LOADS || 3;

        const processFile = async () => {
            while (queue.length > 0) {
                const file = queue.shift();

                if (this.isDuplicate(file)) {
                    skipped++;
                    this.updateUploadProgress(uploaded + skipped, total);
                    continue;
                }

                try {
                    await this.uploadFile(file);
                    uploaded++;
                    this.updateUploadProgress(uploaded + skipped, total);
                } catch (err) {
                    console.error('Upload error:', file.name, err);
                }
            }
        };

        // Create workers
        const workers = [];
        const limit = Math.min(files.length, concurrency); // Don't create more workers than files
        for (let i = 0; i < limit; i++) {
            workers.push(processFile());
        }

        await Promise.all(workers);

        setTimeout(() => {
            this.elements.uploadProgress.classList.remove('active');
            if (skipped > 0) {
                alert(`${uploaded}個のファイルをアップロードしました。\n${skipped}個の重複ファイルをスキップしました。`);
            }
        }, 1000);

        await this.loadPhotos();
    }

    async uploadFilesWithTag(files, tagName) {
        const total = files.length;
        let uploaded = 0;

        this.elements.uploadProgress.classList.add('active');
        this.updateUploadProgress(uploaded, total);

        for (const file of files) {
            try {
                await this.uploadFile(file, tagName);
                uploaded++;
                this.updateUploadProgress(uploaded, total);
            } catch (err) {
                console.error('Upload error:', file.name, err);
            }
        }

        setTimeout(() => {
            this.elements.uploadProgress.classList.remove('active');
        }, 1000);

        await this.loadPhotos();
    }

    updateUploadProgress(current, total) {
        this.elements.uploadProgressText.textContent = `${current}/${total}`;
        this.elements.uploadProgressFill.style.width = `${(current / total) * 100}%`;
    }

    async uploadFile(file, tag = null) {
        const metadata = {
            name: file.name,
            parents: [this.rootFolderId]
        };

        if (tag) {
            metadata.appProperties = { tags: tag };
        }

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: form
            }
        );

        return response.json();
    }

    // ===== Download =====
    async downloadSelected() {
        const selectedPhotos = this.photos.filter(p => this.selectedItems.has(p.id));
        if (selectedPhotos.length === 0) return;

        this.showLoading('ダウンロード準備中...');

        for (const photo of selectedPhotos) {
            try {
                const response = await fetch(
                    `https://www.googleapis.com/drive/v3/files/${photo.id}?alt=media`,
                    { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
                );
                const blob = await response.blob();

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = photo.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                await new Promise(r => setTimeout(r, 300));
            } catch (err) {
                console.error('Download error:', photo.name, err);
            }
        }

        this.hideLoading();
    }

    // ===== Delete =====
    async deleteSelected() {
        const count = this.selectedItems.size;
        if (count === 0) return;

        if (!confirm(`${count}件のファイルを削除しますか？\n（ゴミ箱に移動されます）`)) {
            return;
        }

        this.showLoading('削除中...');

        for (const id of this.selectedItems) {
            try {
                await fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ trashed: true })
                });
            } catch (err) {
                console.error('Delete error:', id, err);
            }
        }

        await this.loadPhotos();
        this.hideLoading();
    }

    // ===== Rename =====
    openRenameModal() {
        if (this.selectedItems.size === 0) return;

        this.elements.renamePrefix.value = '';
        this.elements.startNumber.value = '1';
        this.elements.digitCount.value = '3';
        this.updateRenamePreview();

        this.elements.renameModal.classList.add('active');
    }

    closeRenameModal() {
        this.elements.renameModal.classList.remove('active');
    }

    updateRenamePreview() {
        const prefix = this.elements.renamePrefix.value || 'ファイル';
        const startNum = parseInt(this.elements.startNumber.value) || 1;
        const digits = parseInt(this.elements.digitCount.value) || 3;

        const selectedPhotosList = this.photos.filter(p => this.selectedItems.has(p.id)).slice(0, 5);

        if (selectedPhotosList.length === 0) {
            this.elements.renamePreview.innerHTML = '<div class="preview-item">選択された写真がありません</div>';
            return;
        }

        const preview = selectedPhotosList.map((photo, index) => {
            const num = String(startNum + index).padStart(digits, '0');
            const ext = photo.name.split('.').pop();
            const newName = `${prefix}${num}.${ext}`;
            return `
                <div class="preview-item">
                    ${photo.name} <span class="preview-arrow">→</span> <span class="preview-new">${newName}</span>
                </div>
            `;
        }).join('');

        const moreCount = this.selectedItems.size - selectedPhotosList.length;
        const moreText = moreCount > 0 ? `<div class="preview-item">...他 ${moreCount}件</div>` : '';

        this.elements.renamePreview.innerHTML = preview + moreText;
    }

    async executeRename() {
        const prefix = this.elements.renamePrefix.value || 'ファイル';
        const startNum = parseInt(this.elements.startNumber.value) || 1;
        const digits = parseInt(this.elements.digitCount.value) || 3;

        const selectedPhotosList = this.photos.filter(p => this.selectedItems.has(p.id));
        if (selectedPhotosList.length === 0) return;

        this.closeRenameModal();
        this.showLoading('リネーム中...');

        for (let i = 0; i < selectedPhotosList.length; i++) {
            const photo = selectedPhotosList[i];
            const num = String(startNum + i).padStart(digits, '0');
            const ext = photo.name.split('.').pop();
            const newName = `${prefix}${num}.${ext}`;

            try {
                await fetch(`https://www.googleapis.com/drive/v3/files/${photo.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name: newName })
                });
            } catch (err) {
                console.error('Rename error:', photo.name, err);
            }
        }

        await this.loadPhotos();
        this.hideLoading();
    }

    // ===== Gallery Rendering =====
    getFilteredPhotos() {
        if (this.currentTag === null) {
            return this.photos;
        }
        return this.photos.filter(p => p.tags.includes(this.currentTag));
    }

    groupPhotosByMonth() {
        const photos = this.getFilteredPhotos();
        const groups = {};

        for (const photo of photos) {
            const year = photo.date.getFullYear();
            const month = photo.date.getMonth() + 1;
            const day = photo.date.getDate();
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            const dayKey = `${monthKey}-${String(day).padStart(2, '0')}`;
            const monthLabel = `${year}年${month}月`;
            const dayLabel = `${month}月${day}日`;

            if (!groups[monthKey]) {
                groups[monthKey] = {
                    key: monthKey,
                    label: monthLabel,
                    photos: [],
                    days: {}
                };
            }
            groups[monthKey].photos.push(photo);

            // Add to day subgroup
            if (!groups[monthKey].days[dayKey]) {
                groups[monthKey].days[dayKey] = {
                    key: dayKey,
                    label: dayLabel,
                    photos: []
                };
            }
            groups[monthKey].days[dayKey].photos.push(photo);
        }

        // Convert days object to sorted array for each month
        for (const monthKey in groups) {
            groups[monthKey].daysArray = Object.values(groups[monthKey].days)
                .sort((a, b) => b.key.localeCompare(a.key));
        }

        return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
    }

    renderGallery() {
        const filteredPhotos = this.getFilteredPhotos();

        if (filteredPhotos.length === 0) {
            this.elements.emptyState.style.display = 'flex';
            this.elements.photoGallery.innerHTML = '';
            return;
        }

        this.elements.emptyState.style.display = 'none';

        // Initialize expanded sets if not exists
        if (!this.expandedMonths) {
            this.expandedMonths = new Set();
        }
        if (!this.expandedDays) {
            this.expandedDays = new Set();
        }

        const groups = this.groupPhotosByMonth();

        // Auto-expand first month if nothing expanded yet
        if (this.expandedMonths.size === 0 && groups.length > 0) {
            this.expandedMonths.add(groups[0].key);
        }

        const html = groups.map(group => {
            const isMonthExpanded = this.expandedMonths.has(group.key);

            // Render day groups inside month
            const daysHtml = group.daysArray.map(day => {
                const isDayExpanded = this.expandedDays.has(day.key);
                return `
                    <div class="day-group ${isDayExpanded ? 'expanded' : 'collapsed'}" data-day="${day.key}">
                        <div class="day-header">
                            <span class="expand-icon">${isDayExpanded ? '▼' : '▶'}</span>
                            <span class="day-label">📆 ${day.label}</span>
                            <span class="day-count">${day.photos.length}枚</span>
                        </div>
                        <div class="photo-grid" style="${isDayExpanded ? '' : 'display: none;'}">
                            ${day.photos.map(photo => this.renderPhotoCard(photo)).join('')}
                        </div>
                    </div>
                `;
            }).join('');

            return `
            <div class="month-group ${isMonthExpanded ? 'expanded' : 'collapsed'}" data-month="${group.key}">
                <div class="month-header">
                    <span class="expand-icon">${isMonthExpanded ? '▼' : '▶'}</span>
                    <h3>📅 ${group.label}</h3>
                    <span class="month-count">${group.photos.length}枚</span>
                </div>
                <div class="month-content" style="${isMonthExpanded ? '' : 'display: none;'}">
                    ${daysHtml}
                </div>
            </div>
        `}).join('');

        this.elements.photoGallery.innerHTML = html;

        // Add month header click handlers
        this.elements.photoGallery.querySelectorAll('.month-header').forEach(header => {
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                const monthGroup = header.closest('.month-group');
                const monthKey = monthGroup.dataset.month;
                this.toggleMonthExpand(monthKey);
            });
        });

        // Add day header click handlers
        this.elements.photoGallery.querySelectorAll('.day-header').forEach(header => {
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                const dayGroup = header.closest('.day-group');
                const dayKey = dayGroup.dataset.day;
                this.toggleDayExpand(dayKey);
            });
        });

        // Add photo click handlers
        this.elements.photoGallery.querySelectorAll('.photo-card').forEach(card => {
            // Click on image to view large
            const img = card.querySelector('img');
            if (img) {
                img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // スマホ（768px以下）の場合は選択切り替え、PCの場合はビューワー表示
                    if (window.matchMedia('(max-width: 768px)').matches) {
                        this.toggleSelection(card.dataset.id);
                    } else {
                        this.openPhotoViewer(card.dataset.id);
                    }
                });
            }

            // Click on zoom button (Mobile only)
            const zoomBtn = card.querySelector('.mobile-zoom-btn');
            if (zoomBtn) {
                zoomBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openPhotoViewer(card.dataset.id);
                });
            }

            // Click on checkbox or card background to select
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSelection(card.dataset.id);
            });
        });

        // Load thumbnails only for already expanded sections (usually the first one or when filtering)
        this.elements.photoGallery.querySelectorAll('.month-group.expanded, .day-group.expanded').forEach(container => {
            this.loadThumbnails(container);
        });
    }

    renderPhotoCard(photo) {
        const isSelected = this.selectedItems.has(photo.id);
        const tagBadges = photo.tags.length > 0
            ? `<div class="photo-tags">${photo.tags.map(t => `<span class="tag-badge">🏷️${t}</span>`).join('')}</div>`
            : '';

        return `
            <div class="photo-card ${isSelected ? 'selected' : ''}" data-id="${photo.id}">
                <div class="photo-checkbox"></div>
                <div class="mobile-zoom-btn">🔍</div>
                <div class="photo-placeholder">
                    <span class="placeholder-icon">🖼️</span>
                </div>
                <img src="" alt="${photo.name}" data-thumbnail="${photo.thumbnailLink || ''}">
                ${tagBadges}
                <div class="photo-name">${photo.name}</div>
            </div>
        `;
    }

    openPhotoViewer(photoId) {
        const photo = this.photos.find(p => p.id === photoId);
        if (!photo) return;

        this.currentViewerPhotoId = photoId;

        // Show high quality image (replace thumbnail s220 with s2000)
        let highResUrl = photo.thumbnailLink;
        if (highResUrl) {
            highResUrl = highResUrl.replace(/=s\d+$/, '=s2000');
        }

        this.elements.viewerImage.src = highResUrl || '';
        this.elements.viewerFileName.textContent = photo.name;
        this.elements.viewerDate.textContent = photo.date.toLocaleString('ja-JP', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        this.elements.viewerTags.innerHTML = photo.tags
            .map(t => `<span class="tag-badge">🏷️${t}</span>`)
            .join('');

        this.elements.viewerModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scroll
    }

    closePhotoViewer() {
        this.elements.viewerModal.classList.remove('active');
        this.elements.viewerImage.src = '';
        document.body.style.overflow = '';
    }

    navigateViewer(direction) {
        const currentIndex = this.photos.findIndex(p => p.id === this.currentViewerPhotoId);
        if (currentIndex === -1) return;

        let nextIndex = currentIndex + direction;
        if (nextIndex < 0) nextIndex = this.photos.length - 1;
        if (nextIndex >= this.photos.length) nextIndex = 0;

        const nextPhoto = this.photos[nextIndex];
        this.openPhotoViewer(nextPhoto.id);
    }

    toggleMonthExpand(monthKey) {
        if (this.expandedMonths.has(monthKey)) {
            this.expandedMonths.delete(monthKey);
        } else {
            this.expandedMonths.add(monthKey);
        }

        const monthGroup = this.elements.photoGallery.querySelector(`.month-group[data-month="${monthKey}"]`);
        if (monthGroup) {
            const isExpanded = this.expandedMonths.has(monthKey);
            monthGroup.classList.toggle('expanded', isExpanded);
            monthGroup.classList.toggle('collapsed', !isExpanded);

            const expandIcon = monthGroup.querySelector(':scope > .month-header .expand-icon');
            expandIcon.textContent = isExpanded ? '▼' : '▶';

            const monthContent = monthGroup.querySelector('.month-content');
            monthContent.style.display = isExpanded ? '' : 'none';

            if (isExpanded) {
                this.loadThumbnails(monthGroup);
            }
        }
    }

    toggleDayExpand(dayKey) {
        if (this.expandedDays.has(dayKey)) {
            this.expandedDays.delete(dayKey);
        } else {
            this.expandedDays.add(dayKey);
        }

        const dayGroup = this.elements.photoGallery.querySelector(`.day-group[data-day="${dayKey}"]`);
        if (dayGroup) {
            const isExpanded = this.expandedDays.has(dayKey);
            dayGroup.classList.toggle('expanded', isExpanded);
            dayGroup.classList.toggle('collapsed', !isExpanded);

            const expandIcon = dayGroup.querySelector('.expand-icon');
            expandIcon.textContent = isExpanded ? '▼' : '▶';

            const photoGrid = dayGroup.querySelector('.photo-grid');
            photoGrid.style.display = isExpanded ? '' : 'none';

            if (isExpanded) {
                this.loadThumbnails(dayGroup);
            }
        }
    }

    loadThumbnails(container = this.elements.photoGallery) {
        container.querySelectorAll('.photo-card img').forEach(img => {
            // Skip if no thumbnail data (means already processed or doesn't have one)
            const thumbnail = img.dataset.thumbnail;
            if (!thumbnail) return;

            // Use original URL to prevent 403/404 errors
            const url = thumbnail;

            img.onload = () => {
                const card = img.closest('.photo-card');
                if (card) card.classList.add('loaded');
            };

            // Add referrer policy to handle Google Drive images correctly
            img.referrerPolicy = "no-referrer";
            img.src = url;

            // Remove data-thumbnail to prevent redundant processing
            img.removeAttribute('data-thumbnail');
        });
    }

    toggleSelection(photoId) {
        if (this.selectedItems.has(photoId)) {
            this.selectedItems.delete(photoId);
        } else {
            this.selectedItems.add(photoId);
        }

        const card = this.elements.photoGallery.querySelector(`.photo-card[data-id="${photoId}"]`);
        if (card) {
            card.classList.toggle('selected', this.selectedItems.has(photoId));
        }

        this.updateToolbar();
    }

    selectAll() {
        const filteredPhotos = this.getFilteredPhotos();
        filteredPhotos.forEach(photo => this.selectedItems.add(photo.id));
        this.elements.photoGallery.querySelectorAll('.photo-card').forEach(card => {
            card.classList.add('selected');
        });
        this.updateToolbar();
    }

    deselectAll() {
        this.selectedItems.clear();
        this.elements.photoGallery.querySelectorAll('.photo-card').forEach(card => {
            card.classList.remove('selected');
        });
        this.updateToolbar();
    }

    updateToolbar() {
        const count = this.selectedItems.size;
        this.elements.selectionCount.textContent = count;
        this.elements.downloadBtn.disabled = count === 0;
        this.elements.moveBtn.disabled = count === 0;
        this.elements.removeTagBtn.disabled = count === 0;
        this.elements.renameBtn.disabled = count === 0;
        this.elements.deleteBtn.disabled = count === 0;
    }

    // ===== UI Helpers =====
    showLoading(text = '読み込み中...') {
        this.elements.loadingOverlay.querySelector('.loading-text').textContent = text;
        this.elements.loadingOverlay.classList.add('active');
    }

    hideLoading() {
        this.elements.loadingOverlay.classList.remove('active');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PhotoAlbumApp();
});
