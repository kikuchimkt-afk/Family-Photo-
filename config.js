/**
 * Google API Configuration
 * ========================
 * 
 * 使用前にGoogle Cloud Consoleで以下を設定してください:
 * 1. https://console.cloud.google.com/ にアクセス
 * 2. 新しいプロジェクトを作成
 * 3. 「APIとサービス」→「有効なAPIとサービス」→「Google Drive API」を有効化
 * 4. 「認証情報」→「認証情報を作成」→「OAuth クライアント ID」
 * 5. アプリケーションの種類: ウェブアプリケーション
 * 6. 承認済みJavaScriptオリジン: デプロイ先URL（例: https://your-app.vercel.app）
 * 7. 作成されたクライアントIDを下のCLIENT_IDに設定
 */

const CONFIG = {
    // Google OAuth Client ID (Google Cloud Consoleで取得)
    CLIENT_ID: '449495889409-f5dd2cfkk9hi5pt1b97ea04cvujon73s.apps.googleusercontent.com',

    // Google API Key (オプション: 公開データアクセス用)
    API_KEY: '',

    // Google Drive API Scopes
    SCOPES: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',

    // 写真を保存するフォルダ名 (自動作成されます)
    PHOTO_FOLDER_NAME: '家族写真アルバム',

    // プリント用フォルダ名
    PRINT_FOLDER_NAME: 'プリント用',

    // サムネイルサイズ
    THUMBNAIL_SIZE: 200,

    // 同時読み込み数
    CONCURRENT_LOADS: 6,

    // 対応する画像形式
    IMAGE_MIME_TYPES: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp'
    ]
};
