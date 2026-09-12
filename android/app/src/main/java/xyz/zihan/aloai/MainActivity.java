package xyz.zihan.aloai;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "AloAI";
    public static final String APP_URL = "https://ai.zihan.xyz/";

    private WebView mWebView;
    private SwipeRefreshLayout mSwipeRefresh;
    private View mOfflineView;

    private ValueCallback<Uri[]> mFilePathCallback;
    private Uri mCameraPhotoUri;
    private PermissionRequest mPendingPermissionRequest;

    private long mLastBackPressTime = 0;
    private static final long BACK_PRESS_INTERVAL = 2000;

    private final ActivityResultLauncher<Intent> mFileChooserLauncher =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                if (mFilePathCallback == null) return;

                Uri[] results = null;
                if (result.getResultCode() == RESULT_OK) {
                    Intent data = result.getData();
                    if (data != null && data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    } else if (data != null && data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    } else if (mCameraPhotoUri != null) {
                        // Check if file was actually captured
                        File file = new File(mCameraPhotoUri.getPath());
                        results = new Uri[]{mCameraPhotoUri};
                    }
                }

                mFilePathCallback.onReceiveValue(results);
                mFilePathCallback = null;
                mCameraPhotoUri = null;
            });

    private final ActivityResultLauncher<String[]> mPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), result -> {
                if (mPendingPermissionRequest != null) {
                    List<String> grantedResources = new ArrayList<>();
                    for (String res : mPendingPermissionRequest.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res) &&
                                ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                            grantedResources.add(res);
                        } else if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res) &&
                                ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                            grantedResources.add(res);
                        }
                    }

                    if (!grantedResources.isEmpty()) {
                        mPendingPermissionRequest.grant(grantedResources.toArray(new String[0]));
                    } else {
                        mPendingPermissionRequest.deny();
                    }
                    mPendingPermissionRequest = null;
                }
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        initViews();
        setupWebView();
        setupSwipeRefresh();
        setupBackNavigation();
        checkAndRequestInitialPermissions();

        if (isNetworkAvailable()) {
            mWebView.loadUrl(APP_URL);
        } else {
            showOfflineView(true);
        }
    }

    private void initViews() {
        mWebView = findViewById(R.id.webView);
        mSwipeRefresh = findViewById(R.id.swipeRefreshLayout);
        mOfflineView = findViewById(R.id.offlineView);

        Button btnRetry = findViewById(R.id.btnRetry);
        btnRetry.setOnClickListener(v -> retryLoading());
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = mWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        // Append custom Alo AI identifier to User-Agent
        String defaultUa = settings.getUserAgentString();
        settings.setUserAgentString(defaultUa + " AloAI-Android/1.0");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(mWebView, true);
        }

        mWebView.addJavascriptInterface(new WebAppInterface(this), "AloAndroid");

        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                mPendingPermissionRequest = request;
                List<String> requiredPermissions = new ArrayList<>();

                for (String resource : request.getResources()) {
                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                        if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                            requiredPermissions.add(Manifest.permission.RECORD_AUDIO);
                        }
                    } else if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                        if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                            requiredPermissions.add(Manifest.permission.CAMERA);
                        }
                    }
                }

                if (!requiredPermissions.isEmpty()) {
                    mPermissionLauncher.launch(requiredPermissions.toArray(new String[0]));
                } else {
                    request.grant(request.getResources());
                }
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (mFilePathCallback != null) {
                    mFilePathCallback.onReceiveValue(null);
                }
                mFilePathCallback = filePathCallback;

                Intent takePictureIntent = createCameraIntent();

                Intent contentSelectionIntent = new Intent(Intent.ACTION_GET_CONTENT);
                contentSelectionIntent.addCategory(Intent.CATEGORY_OPENABLE);
                contentSelectionIntent.setType("*/*");
                if (fileChooserParams != null && fileChooserParams.getAcceptTypes() != null && fileChooserParams.getAcceptTypes().length > 0) {
                    String[] types = fileChooserParams.getAcceptTypes();
                    if (types.length == 1 && !types[0].trim().isEmpty()) {
                        contentSelectionIntent.setType(types[0]);
                    } else {
                        contentSelectionIntent.putExtra(Intent.EXTRA_MIME_TYPES, types);
                    }
                }

                Intent[] intentArray = takePictureIntent != null ? new Intent[]{takePictureIntent} : new Intent[0];
                Intent chooserIntent = new Intent(Intent.ACTION_CHOOSER);
                chooserIntent.putExtra(Intent.EXTRA_INTENT, contentSelectionIntent);
                chooserIntent.putExtra(Intent.EXTRA_TITLE, getString(R.string.file_chooser_title));
                chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, intentArray);

                try {
                    mFileChooserLauncher.launch(chooserIntent);
                    return true;
                } catch (Exception e) {
                    Log.e(TAG, "Cannot launch file chooser", e);
                    if (mFilePathCallback != null) {
                        mFilePathCallback.onReceiveValue(null);
                        mFilePathCallback = null;
                    }
                    return false;
                }
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d(TAG, "[WebView Console] " + consoleMessage.message() + " -- From line "
                        + consoleMessage.lineNumber() + " of " + consoleMessage.sourceId());
                return true;
            }
        });

        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if (scheme != null && (scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
                    String host = uri.getHost();
                    if (host != null && host.contains("ai.zihan.xyz")) {
                        return false;
                    }
                }

                // Handle external links (tel:, mailto:, market:, or external web pages)
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                    startActivity(intent);
                    return true;
                } catch (Exception e) {
                    Log.w(TAG, "Could not launch external URL: " + uri, e);
                    return false;
                }
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                mSwipeRefresh.setRefreshing(false);
                showOfflineView(false);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    Log.e(TAG, "Page load error: " + error.getDescription());
                    showOfflineView(true);
                }
            }
        });

        mWebView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            handleDownload(url, contentDisposition, mimetype);
        });
    }

    private void setupSwipeRefresh() {
        mSwipeRefresh.setColorSchemeResources(R.color.primary);
        mSwipeRefresh.setProgressBackgroundColorSchemeResource(R.color.surface);

        // Disable pull-to-refresh on chat view to prevent accidental reloads when scrolling up through messages
        mSwipeRefresh.setEnabled(false);

        mSwipeRefresh.setOnRefreshListener(() -> {
            if (isNetworkAvailable()) {
                mWebView.reload();
            } else {
                mSwipeRefresh.setRefreshing(false);
                showOfflineView(true);
            }
        });
    }

    public void reloadWebView() {
        if (mWebView != null && isNetworkAvailable()) {
            showOfflineView(false);
            mWebView.reload();
        }
    }

    private void setupBackNavigation() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (mWebView.canGoBack()) {
                    mWebView.goBack();
                } else {
                    long currentTime = System.currentTimeMillis();
                    if (currentTime - mLastBackPressTime < BACK_PRESS_INTERVAL) {
                        finish();
                    } else {
                        mLastBackPressTime = currentTime;
                        Toast.makeText(MainActivity.this, getString(R.string.exit_prompt), Toast.LENGTH_SHORT).show();
                    }
                }
            }
        });
    }

    private void retryLoading() {
        if (isNetworkAvailable()) {
            showOfflineView(false);
            mWebView.loadUrl(APP_URL);
        } else {
            Toast.makeText(this, getString(R.string.error_offline_title), Toast.LENGTH_SHORT).show();
        }
    }

    private void showOfflineView(boolean show) {
        mOfflineView.setVisibility(show ? View.VISIBLE : View.GONE);
        mWebView.setVisibility(show ? View.GONE : View.VISIBLE);
        // Only enable swipe refresh on offline error view so user can pull down to retry
        mSwipeRefresh.setEnabled(show);
        if (show) {
            mSwipeRefresh.setRefreshing(false);
        }
    }

    private Intent createCameraIntent() {
        Intent takePictureIntent = new Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE);
        if (takePictureIntent.resolveActivity(getPackageManager()) != null) {
            File photoFile = null;
            try {
                photoFile = createImageFile();
            } catch (IOException ex) {
                Log.e(TAG, "Cannot create photo file", ex);
            }
            if (photoFile != null) {
                mCameraPhotoUri = FileProvider.getUriForFile(this,
                        getApplicationContext().getPackageName() + ".fileprovider",
                        photoFile);
                takePictureIntent.putExtra(android.provider.MediaStore.EXTRA_OUTPUT, mCameraPhotoUri);
                return takePictureIntent;
            }
        }
        return null;
    }

    private File createImageFile() throws IOException {
        String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
        String imageFileName = "JPEG_" + timeStamp + "_";
        File storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        return File.createTempFile(imageFileName, ".jpg", storageDir);
    }

    private void handleDownload(String url, String contentDisposition, String mimeType) {
        try {
            if (url.startsWith("data:")) {
                saveDataUri(url, mimeType);
                return;
            }

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setMimeType(mimeType);
            String cookies = CookieManager.getInstance().getCookie(url);
            request.addRequestHeader("cookie", cookies);
            request.addRequestHeader("User-Agent", mWebView.getSettings().getUserAgentString());
            request.setDescription(getString(R.string.download_started));
            String filename = URLUtil.guessFileName(url, contentDisposition, mimeType);
            request.setTitle(filename);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);

            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm != null) {
                dm.enqueue(request);
                Toast.makeText(this, getString(R.string.download_started), Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            Log.e(TAG, "Download failed", e);
            Toast.makeText(this, "ডাউনলোড করা সম্ভব হয়নি", Toast.LENGTH_SHORT).show();
        }
    }

    private void saveDataUri(String dataUri, String mimeType) {
        try {
            int commaIndex = dataUri.indexOf(",");
            if (commaIndex == -1) return;

            String base64Data = dataUri.substring(commaIndex + 1);
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);

            String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
            String ext = mimeType != null && mimeType.contains("png") ? ".png" : ".jpg";
            String filename = "AloAI_" + timeStamp + ext;

            File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            File file = new File(downloadsDir, filename);

            FileOutputStream fos = new FileOutputStream(file);
            fos.write(bytes);
            fos.flush();
            fos.close();

            Toast.makeText(this, getString(R.string.download_complete) + ": " + filename, Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Log.e(TAG, "Error saving data URI", e);
            Toast.makeText(this, "ফাইল সংরক্ষণ ব্যর্থ হয়েছে", Toast.LENGTH_SHORT).show();
        }
    }

    private void checkAndRequestInitialPermissions() {
        List<String> neededPermissions = new ArrayList<>();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            neededPermissions.add(Manifest.permission.RECORD_AUDIO);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            neededPermissions.add(Manifest.permission.CAMERA);
        }

        if (!neededPermissions.isEmpty()) {
            mPermissionLauncher.launch(neededPermissions.toArray(new String[0]));
        }
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return false;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            android.net.Network network = cm.getActiveNetwork();
            if (network == null) return false;
            NetworkCapabilities capabilities = cm.getNetworkCapabilities(network);
            return capabilities != null && (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET));
        } else {
            NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
            return activeNetwork != null && activeNetwork.isConnected();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (mWebView != null) {
            mWebView.onResume();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (mWebView != null) {
            mWebView.onPause();
        }
    }

    @Override
    protected void onDestroy() {
        if (mWebView != null) {
            mWebView.destroy();
        }
        super.onDestroy();
    }
}
