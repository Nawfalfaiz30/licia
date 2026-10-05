package com.licia.lifeos

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.MediaStore
import android.view.KeyEvent
import android.view.View
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.ComponentActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import java.io.File
import java.net.URLEncoder

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var refresh: SwipeRefreshLayout
    private lateinit var progress: ProgressBar
    private lateinit var offline: TextView

    private var uploadCallback: ValueCallback<Array<Uri>>? = null
    private var cameraUri: Uri? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { }

    private val cameraLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = uploadCallback ?: return@registerForActivityResult
        val uri = if (result.resultCode == Activity.RESULT_OK) cameraUri else null
        callback.onReceiveValue(uri?.let { arrayOf(it) })
        uploadCallback = null
        cameraUri = null
    }

    private val fileLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        uploadCallback?.onReceiveValue(uri?.let { arrayOf(it) })
        uploadCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = ContextCompat.getColor(this, R.color.licia_background)
        window.navigationBarColor = ContextCompat.getColor(this, R.color.licia_background)

        WindowCompat.setDecorFitsSystemWindows(window, true)
        setupViews()
        setupWebView()
        applySystemBarInsets()
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        setupBackNavigation()
        requestRuntimePermissions()

        val initial = initialUrl(intent)
        webView.loadUrl(initial)
    }

    private fun setupViews() {
        refresh = SwipeRefreshLayout(this).apply {
            setColorSchemeResources(R.color.licia_accent)
            setProgressBackgroundColorSchemeResource(R.color.licia_background)
            setOnRefreshListener { webView.reload() }
        }

        webView = WebView(this)
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal)
        offline = TextView(this).apply {
            text = "Koneksi belum tersedia\\n\\nCoba lagi"
            textSize = 16f
            setTextColor(0xFFFFFFFF.toInt())
            setBackgroundColor(0xFF101424.toInt())
            gravity = android.view.Gravity.CENTER
            visibility = View.GONE
            setOnClickListener { webView.reload() }
        }

        refresh.addView(webView, SwipeRefreshLayout.LayoutParams(-1, -1))
        setContentView(refresh)
        addContentView(
            progress,
            android.widget.FrameLayout.LayoutParams(-1, 5).apply {
                gravity = android.view.Gravity.TOP
            }
        )
        addContentView(
            offline,
            android.widget.FrameLayout.LayoutParams(-1, -1)
        )
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            safeBrowsingEnabled = true
            userAgentString = "$userAgentString LiciaAndroid/1.0"
        }

        webView.addJavascriptInterface(NativeBridge(), "LiciaNative")
        webView.isVerticalScrollBarEnabled = false
        webView.overScrollMode = View.OVER_SCROLL_NEVER

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                val host = uri.host ?: ""
                if (host.equals(BuildConfig.LICIA_HOST, ignoreCase = true)) return false
                return openExternal(uri)
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                offline.visibility = View.GONE
                progress.visibility = View.VISIBLE
                progress.progress = 15
            }

            override fun onPageFinished(view: WebView, url: String?) {
                refresh.isRefreshing = false
                progress.visibility = View.GONE
                offline.visibility = View.GONE
                injectNativeMarker()
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) {
                    refresh.isRefreshing = false
                    progress.visibility = View.GONE
                    offline.visibility = View.VISIBLE
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progress.progress = newProgress
                if (newProgress >= 100) progress.visibility = View.GONE
            }

            override fun onPermissionRequest(request: android.webkit.PermissionRequest) {
                runOnUiThread {
                    val resources = request.resources.toSet()
                    if (resources.contains(android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                        if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                            request.grant(request.resources)
                        } else {
                            requestRuntimePermissions()
                            request.deny()
                        }
                    } else {
                        request.deny()
                    }
                }
            }

            override fun onGeolocationPermissionsShowPrompt(origin: String?, callback: GeolocationPermissions.Callback?) {
                callback?.invoke(origin, false, false)
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                uploadCallback?.onReceiveValue(null)
                uploadCallback = filePathCallback

                val accept = fileChooserParams?.acceptTypes?.joinToString(",")?.lowercase().orEmpty()
                val wantsImage = accept.contains("image/") || accept.isBlank()
                val capture = fileChooserParams?.isCaptureEnabled == true
                if (capture && wantsImage) {
                    openCamera()
                } else {
                    fileLauncher.launch(if (wantsImage) "image/*" else "*/*")
                }
                return true
            }
        }
    }

    private fun requestRuntimePermissions() {
        val requested = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= 33) requested += Manifest.permission.POST_NOTIFICATIONS
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requested += Manifest.permission.CAMERA
        }
        if (requested.isNotEmpty()) permissionLauncher.launch(requested.toTypedArray())
    }

    private fun openCamera() {
        val dir = File(cacheDir, "images").apply { mkdirs() }
        val file = File(dir, "licia_${System.currentTimeMillis()}.jpg")
        cameraUri = FileProvider.getUriForFile(this, "${packageName}.fileprovider", file)
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, cameraUri)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        try {
            cameraLauncher.launch(intent)
        } catch (_: ActivityNotFoundException) {
            uploadCallback?.onReceiveValue(null)
            uploadCallback = null
            cameraUri = null
        }
    }


    private fun applySystemBarInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(0, bars.top, 0, bars.bottom)
            insets
        }
        ViewCompat.requestApplyInsets(webView)
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })
    }

    private fun initialUrl(intent: Intent?): String {
        if (intent == null) return BuildConfig.LICIA_URL
        val data = intent.data
        if (data != null && data.scheme == "https" && data.host.equals(BuildConfig.LICIA_HOST, ignoreCase = true)) {
            return data.toString()
        }
        if (intent.action == Intent.ACTION_SEND && intent.type == "text/plain") {
            val shared = intent.getStringExtra(Intent.EXTRA_TEXT).orEmpty()
            if (shared.isNotBlank()) {
                val encoded = URLEncoder.encode(shared, Charsets.UTF_8.name())
                return "${BuildConfig.LICIA_URL}/capture?shared=$encoded"
            }
        }
        return BuildConfig.LICIA_URL
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        webView.loadUrl(initialUrl(intent))
    }

    private fun openExternal(uri: Uri): Boolean {
        return try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
            true
        } catch (_: ActivityNotFoundException) {
            true
        }
    }

    private fun injectNativeMarker() {
        webView.evaluateJavascript(
            "document.documentElement.dataset.nativeApp='android';document.documentElement.classList.add('licia-native-app');",
            null
        )
    }

    private inner class NativeBridge {
        @android.webkit.JavascriptInterface
        fun haptic(type: String?) {
            val vibrator: Vibrator = if (Build.VERSION.SDK_INT >= 31) {
                val manager = getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager
                manager.defaultVibrator
            } else {
                @Suppress("DEPRECATION") getSystemService(VIBRATOR_SERVICE) as Vibrator
            }
            if (!vibrator.hasVibrator()) return
            val amplitude = when (type) {
                "success" -> 80
                "warning" -> 120
                else -> 60
            }
            if (Build.VERSION.SDK_INT >= 26) {
                vibrator.vibrate(VibrationEffect.createOneShot(25L, amplitude))
            } else {
                @Suppress("DEPRECATION") vibrator.vibrate(25L)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        uploadCallback?.onReceiveValue(null)
        uploadCallback = null
        webView.stopLoading()
        webView.loadUrl("about:blank")
        webView.clearHistory()
        webView.removeAllViews()
        webView.destroy()
        super.onDestroy()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_BACK && event.action == KeyEvent.ACTION_UP && webView.canGoBack()) {
            webView.goBack()
            return true
        }
        return super.dispatchKeyEvent(event)
    }
}
