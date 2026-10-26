# The WebView bridge is called from JavaScript by name, so R8 must not rename or remove it.
-keepclassmembers class com.sarge.localflix.MainActivity$Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
